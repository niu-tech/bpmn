// AssistantSessionManager — o que a UI conversa. Junta credencial, sessão Live, captura e
// reprodução num ciclo de vida observável, e garante que encerrar encerra MESMO.
//
// Por que existe (e não é a `session.js` direto): a sessão Live sabe falar o protocolo, mas não
// sabe que existem DOIS MODOS que exigem sockets diferentes, nem que o microfone e o
// `AudioContext` morrem junto com ela, nem que a UI precisa de uma lista de mensagens. Isso é
// daqui.
//
// Os dois modos (medidos no spike, 2026-11-10, ver openspec design D3): declarar
// `entregar_resposta` faz o modelo NÃO falar; sem a função ele fala e manda a legenda. Como a
// escolha vive no `setup`, trocar de modo é **abrir outra sessão** — não há como renegociar.
//
// ⚠ E é por isso que trocar de modo PERDE O CONTEXTO do modelo. O histórico visual continua na
// tela porque é nosso; o modelo começa do zero. Afirmar continuidade sem reconstruir o contexto
// seria mentira, então o gerente emite um aviso explícito (`context-reset`) e a UI mostra.
//
// ponytail: uma fábrica com callbacks, não uma classe com EventEmitter. São seis eventos.

import { promptDoPerfil } from './agent/render.js';
import { resolverContexto } from './agent/resolve.js';
import { startCapture, startPlayback } from './live/audio.js';
import { createSession } from './live/session.js';
import { redact } from './live/redact.js';
import { createDiagnostics } from './diagnostics.js';

export const MODES = /** @type {const} */ (['texto', 'voz']);

/** Rótulos para a UI. Estado técnico vira frase curta em pt-BR. */
export const STATE_LABELS = {
  idle: 'desligado',
  connecting: 'conectando',
  ready: 'pronto',
  listening: 'ouvindo',
  speaking: 'falando',
  closing: 'encerrando',
  error: 'erro',
};

export const ERROR_LABELS = {
  'bad-key': 'a chave foi recusada',
  'mic-denied': 'o microfone foi negado',
  'no-mic': 'nenhum microfone encontrado',
  'insecure-context': 'precisa de https ou localhost',
  unsupported: 'este navegador não tem AudioWorklet',
  quota: 'a cota da sua chave acabou ou há sessões demais',
  timeout: 'o servidor não respondeu',
};

export function describeError(reason) {
  if (!reason) return null;
  if (ERROR_LABELS[reason]) return ERROR_LABELS[reason];
  if (reason.startsWith('ws-closed:1007')) return 'o servidor recusou a configuração da sessão';
  if (reason.startsWith('ws-closed:')) return `a conexão caiu (${reason.slice(10)})`;
  return reason;
}

export function createAssistantSession({ credentials, onUpdate, deps = {} } = {}) {
  const capture = deps.startCapture ?? startCapture;
  const playbackFactory = deps.startPlayback ?? startPlayback;
  const sessionFactory = deps.createSession ?? createSession;

  let session = null;
  let mic = null;
  let speaker = null;
  let mode = 'texto';
  let state = 'idle';
  let reason = null;
  let micOn = false;
  let level = 0;
  /** Abrir o microfone sozinho assim que a sessão de voz ficar pronta. Ver `connect`. */
  let micAutomatico = false;
  /** Abertura de microfone em voo: o automático e o clique do aluno compartilham a mesma. */
  let micEmVoo = null;

  /**
   * ESCUTA CONTÍNUA é o default (pedido do dono, 2026-11-11: "ele poderia ficar ouvindo e quando
   * a gente falar, poder interromper ela"). O microfone fica aberto durante a resposta, e falar
   * por cima interrompe o modelo — é o VAD do servidor que decide, como na MAIA.
   *
   * `meiaDuplex` é a REDE DE SEGURANÇA, não o default. Se o eco da própria resposta voltar pelo
   * microfone, o servidor interrompe o modelo sem parar, e a conversa morre em silêncio — foi
   * exatamente o defeito de hoje de manhã. Três interrupções seguidas SEM nenhuma transcrição de
   * entrada no meio é a assinatura desse laço (fala de verdade produz transcrição; eco não).
   * Ao reconhecê-la, o microfone volta a fechar durante a resposta e o aluno é avisado UMA vez.
   */
  let meiaDuplex = false;
  let interrupcoesSeguidas = 0;
  let relogioDeSom = null;
  let turnSeq = 0;
  let currentTurn = null;
  let teardownInFlight = null;

  /**
   * O que o agente sabe do mundo fora da conversa: diagrama aberto e memória da aba. Entra por
   * `definirContexto` e é lido no `setup` de cada sessão (fase F2). Em F3 quem alimenta é o
   * `eventBus` do bpmn-js, e o contexto passa a viajar por `clientContent` a cada turno — por
   * isso mora aqui e não dentro de `openSession`.
   */
  let contexto = {};

  /** Diário da sessão. Um relatório = uma conexão: `connect()` zera. */
  const diag = deps.diagnostics ?? createDiagnostics();

  /** Histórico SÓ em memória. Morre com a aba — como a chave. */
  const messages = [];

  const publish = () => onUpdate?.({
    state, reason, mode, micOn, level,
    busy: state === 'connecting' || state === 'closing',
    canAsk: (state === 'ready' || state === 'listening' || state === 'speaking'),
    messages: messages.slice(),
  });

  function push(entry) {
    messages.push({ id: messages.length + 1, at: Date.now(), ...entry });
    publish();
    return messages.at(-1);
  }

  /** Nota do sistema, sempre redigida: é por aqui que um erro com a URL do socket sairia. */
  function note(text, kind = 'info') {
    return push({ role: 'system', kind, text: redact(text) });
  }

  function setState(next, why = null) {
    state = next;
    reason = why;
    publish();
  }

  /**
   * Encerra tudo: microfone, reprodução, socket. **Idempotente** e serializado — duas chamadas
   * simultâneas (clicar Encerrar duas vezes, ou Encerrar durante `beforeunload`) compartilham a
   * mesma promessa em vez de correrem uma por cima da outra.
   */
  function teardown() {
    if (teardownInFlight) return teardownInFlight;
    const sessionRef = session;
    const micRef = mic;
    const speakerRef = speaker;
    session = null; mic = null; speaker = null; speakerEmVoo = null;
    micOn = false; level = 0; currentTurn = null;

    if (relogioDeSom) { clearInterval(relogioDeSom); relogioDeSom = null; }

    teardownInFlight = (async () => {
      // Ordem: microfone primeiro (apaga o indicador do navegador na hora), depois som, depois fio.
      try { await micRef?.stop(); } catch { /* já parado */ }
      try { await speakerRef?.stop(); } catch { /* já parado */ }
      try { sessionRef?.close(); } catch { /* já fechada */ }
    })().finally(() => { teardownInFlight = null; });

    return teardownInFlight;
  }

  /**
   * Fecha o microfone e avisa o fim da fala. Interno porque DOIS caminhos precisam dele: o botão
   * do aluno e o fecho automático de quando o modelo começa a responder (ver `onAudio`).
   */
  async function fecharMicrofone(motivo) {
    if (!mic) return false;
    const ref = mic;
    mic = null;
    micOn = false;
    level = 0;
    diag.mic('close', motivo);
    try { await ref.stop(); } catch { /* já parado */ }
    session?.endAudio();
    publish();
    return true;
  }

  /**
   * UM reprodutor, mesmo com dois pedidos ao mesmo tempo.
   *
   * ⚠ Sem a promessa compartilhada, duas chamadas concorrentes passam as duas pelo `if (speaker)`
   * (que ainda e nulo) e abrem DOIS `AudioContext` de 24 kHz — o aluno ouve a resposta dobrada e
   * so um deles e fechado no teardown. Virou possivel no mesmo dia em que o microfone passou a
   * abrir sozinho no modo voz: o automatico e o clique do aluno disputam este trecho.
   */
  function ensureSpeaker() {
    if (speaker) return Promise.resolve(speaker);
    if (!speakerEmVoo) {
      speakerEmVoo = Promise.resolve(playbackFactory({ onStats: (s) => { lastStats = s; } }))
        .then((s) => { speaker = s; speakerEmVoo = null; return s; })
        .catch((err) => { speakerEmVoo = null; throw err; });
    }
    return speakerEmVoo;
  }

  let lastStats = null;
  let speakerEmVoo = null;

  function openSession(targetMode) {
    const apiKey = credentials.use();
    session = sessionFactory({
      apiKey,
      // O perfil decide a prosa E a declaração da função, numa chamada só (ver render.js).
      setupOptions: promptDoPerfil(resolverContexto({
        modo: targetMode,
        pagina: deps.pagina ?? contexto.pagina,
        diagrama: contexto.diagrama,
        memoria: contexto.memoria,
      })),
      onState: ({ state: s, reason: r }) => {
        if (s === 'error' && r === 'bad-key') credentials.markRejected();
        setState(s, r);
        // Pedido do dono (2026-11-11): "clicar em voz já poderia aparecer a parada de voz" — ou
        // seja, escolher voz é começar a falar, não desbloquear mais um botão. Consome a marca
        // UMA vez: `ready` também volta no fim de cada turno, e reabrir o microfone sozinho a
        // cada resposta seria um microfone que o aluno não mandou abrir.
        if (s === 'ready' && micAutomatico) {
          micAutomatico = false;
          api.startMic();
        }
        if (s !== 'error') return;
        note(`não deu: ${describeError(r)}`, 'error');
        // Chave recusada tem conserto, e o conserto é do aluno: dizer o que fazer vale mais que
        // repetir o código do erro.
        if (r === 'bad-key') {
          note('confira a chave em aistudio.google.com e informe de novo em "Usar esta chave".', 'error');
        }
      },
      onEvent: (src, kind, detail) => diag.record(src, kind, detail),
      onLog: (m) => { if (deps.debug) note(m, 'debug'); },
      onText: ({ text, fallback, complete }) => {
        if (complete && fallback) return;             // a legenda já foi aparecendo
        if (!text) return;
        if (currentTurn && currentTurn.role === 'assistant') {
          currentTurn.text = text;
          currentTurn.fallback = Boolean(fallback);
          publish();
        } else {
          currentTurn = push({ role: 'assistant', text, fallback: Boolean(fallback), turn: turnSeq });
        }
      },
      onTranscript: ({ side, text }) => {
        if (!text) return;
        if (side === 'input') {
          // Houve fala de verdade: o que veio antes não era laço de eco.
          interrupcoesSeguidas = 0;
          push({ role: 'user', text, via: 'voz', turn: turnSeq });
          return;
        }
        // Legenda da fala: um turno, uma bolha que cresce.
        if (currentTurn && currentTurn.role === 'assistant' && currentTurn.turn === turnSeq) {
          currentTurn.text += text;
          publish();
        } else {
          currentTurn = push({ role: 'assistant', text, fallback: true, turn: turnSeq });
        }
      },
      onAudio: async (b64) => {
        // Em escuta contínua o microfone FICA ABERTO aqui — é o que permite interromper falando
        // por cima. Só a rede de segurança fecha.
        if (meiaDuplex && mic) fecharMicrofone('meia-duplex: modelo respondendo');
        try {
          const out = await ensureSpeaker();
          out.push(b64, ++audioSeq);
        } catch (err) {
          note(`não consegui tocar o áudio: ${err?.message ?? err}`, 'error');
        }
      },
      onInterrupted: () => {
        // Interrupção é EVENTO DE PROTOCOLO, não recado para o aluno: descarta o que estava na
        // fila e segue. Quando é o aluno falando por cima, isso É o barge-in funcionando.
        speaker?.flush();
        interrupcoesSeguidas++;
        diag.ws('interrompido-seguidas', String(interrupcoesSeguidas));
        if (interrupcoesSeguidas >= 3 && !meiaDuplex) {
          // Assinatura do laço de eco: ninguém interrompe três vezes seguidas sem dizer nada.
          meiaDuplex = true;
          diag.state('meia-duplex', 'laco de interrupcao detectado');
          note(
            'O ajudante estava sendo cortado sem parar — provavelmente o som dele voltando pelo '
            + 'microfone. Passei a fechar o microfone enquanto ele responde; use fone de ouvido '
            + 'para poder interromper falando por cima.',
            'context-reset',
          );
          if (mic) fecharMicrofone('meia-duplex ligada');
        }
      },
    });
    session.start();
  }

  let audioSeq = 0;

  const api = {
    get state() { return state; },
    get reason() { return reason; },
    get mode() { return mode; },
    get micOn() { return micOn; },
    get messages() { return messages.slice(); },
    get stats() { return lastStats; },
    /** Só para teste e diagnóstico: a contagem de tokens que o servidor reportou. */
    get lastUsage() { return session?.lastUsage ?? null; },
    get level() { return level; },
    get diagnostics() { return diag; },
    /** `true` quando a rede de segurança assumiu: microfone fecha durante a resposta. */
    get meiaDuplex() { return meiaDuplex; },

    /**
     * O que o agente deve saber do diagrama e da conversa. Vale a partir da PRÓXIMA sessão: o
     * `setup` é imutável depois de aceito, então mudar o contexto no meio não alcança o modelo
     * — é exatamente o que F3 conserta, mandando o contexto por fora do `setup`.
     */
    definirContexto(novo = {}) {
      contexto = { ...contexto, ...novo };
      return api.contexto;
    },

    /** O contexto resolvido como o prompt o vê. Para teste e diagnóstico. */
    get contexto() {
      return resolverContexto({ ...contexto, modo: mode, pagina: deps.pagina ?? contexto.pagina });
    },

    /**
     * Relatório para COLAR em quem for depurar. Redigido pelo próprio diário — a chave não sai.
     * Também exposto em `window.__bpmnAssist.report()` pelo `mount.js`.
     */
    report() {
      return diag.report({
        header: {
          modo: mode,
          estado: state + (reason ? `:${reason}` : ''),
          turnos: String(turnSeq),
          escuta: meiaDuplex ? 'meia-duplex (rede de seguranca)' : 'continua',
          mensagens: String(messages.length),
          uso: session?.lastUsage ? JSON.stringify(session.lastUsage) : '(sem contagem)',
          som: lastStats ? JSON.stringify(lastStats) : '(sem reproducao)',
        },
      });
    },

    /**
     * Conecta no modo pedido. Recusa sem chave ou sem consentimento — fail closed.
     *
     * ⚠ A recusa NÃO vira mensagem na conversa. Virava, e o recado ficava preso para sempre:
     * o dono marcou o aviso logo depois, conectou, e o painel continuou mostrando em vermelho
     * "aceite o aviso sobre a chave antes de conectar" ao lado de "Conectado" (2026-11-11).
     * O que falta é estado DERIVADO de `credentials` — a UI calcula e mostra, e some sozinho
     * quando deixa de faltar.
     */
    async connect(targetMode = mode) {
      if (!MODES.includes(targetMode)) throw new Error(`modo inválido: ${targetMode}`);
      if (!credentials.ready) {
        diag.state('recusado', credentials.hasKey ? 'sem consentimento' : 'sem chave');
        return false;
      }

      diag.reset();
      diag.state('connect', `modo=${targetMode}`);
      interrupcoesSeguidas = 0;
      // Saúde da reprodução no diário: é o que transforma "a fala trava" em um número
      // (`underflows`) em vez de uma impressão.
      if (relogioDeSom) clearInterval(relogioDeSom);
      relogioDeSom = setInterval(() => {
        if (!speaker) return;
        speaker.stats?.();
        if (lastStats) diag.record('som', 'buffer', `ms=${lastStats.bufferedMs} furos=${lastStats.underflows}`);
      }, 3000);
      micAutomatico = targetMode === 'voz';
      await teardown();
      mode = targetMode;
      setState('connecting');
      openSession(targetMode);
      return true;
    },

    /**
     * Troca de modo. Abre OUTRA sessão: o `setup` é imutável depois de aceito.
     * O histórico na tela fica; o do modelo não — e isso é dito, não escondido.
     */
    async switchMode(targetMode) {
      if (!MODES.includes(targetMode)) throw new Error(`modo inválido: ${targetMode}`);
      // Desligado, trocar de modo é só escolher: não gasta conexão nem cota, e deixa o aluno
      // decidir antes de informar a chave.
      if (state === 'idle' || state === 'error') {
        if (mode === targetMode) return false;
        mode = targetMode;
        publish();
        return true;
      }
      if (targetMode === mode) return false;
      // O aviso de contexto perdido só vale se houve contexto. Trocar para voz logo depois de
      // conectar não perde nada, e o aviso ali só confundia quem acabou de abrir o painel.
      const haviaContexto = turnSeq > 0;
      const ok = await this.connect(targetMode);
      if (ok && haviaContexto) {
        note(
          `modo ${targetMode}: sessão nova. O que já foi dito continua aqui na tela, mas o modelo recomeça sem esse contexto.`,
          'context-reset',
        );
      }
      return ok;
    },

    /** Pergunta digitada. Vale nos dois modos: no texto volta escrito, na voz volta falado. */
    ask(text) {
      const q = String(text ?? '').trim();
      if (!q) return false;
      if (!session || !(state === 'ready' || state === 'listening' || state === 'speaking')) {
        note('conecte antes de perguntar.', 'error');
        return false;
      }
      turnSeq++;
      currentTurn = null;
      push({ role: 'user', text: q, via: 'texto', turn: turnSeq });
      session.ask(q);
      return true;
    },

    /**
     * Abre o microfone. Só no modo voz, e só a partir de um gesto do aluno — ou do automático de
     * `connect('voz')`. Os dois podem chegar juntos, daí a promessa compartilhada.
     */
    async startMic() {
      if (mode !== 'voz') { note('o microfone só funciona no modo voz.', 'error'); return false; }
      if (!session) { note('conecte antes de falar.', 'error'); return false; }
      if (mic) return true;
      if (micEmVoo) return micEmVoo;
      micEmVoo = (async () => {
      try {
        await (await ensureSpeaker()).resume();   // o mesmo gesto libera o alto-falante
        turnSeq++;
        currentTurn = null;
        diag.mic('open');
        mic = await capture({
          onFrame: (b64) => {
            // Em escuta contínua o quadro SOBE mesmo durante a resposta: é assim que o servidor
            // percebe que o aluno começou a falar e interrompe o modelo.
            if (meiaDuplex && state === 'speaking') { diag.mic('gated'); return; }
            session?.pushAudio(b64);
          },
          onLevel: (v) => {
            level = v;
            publish();
          },
          onError: (err) => note(`microfone: ${err?.message ?? err}`, 'error'),
        });
        micOn = true;
        publish();
        return true;
      } catch (err) {
        micOn = false;
        level = 0;
        diag.mic('falhou', err?.reason ?? err?.message);
        const motivo = err?.reason ?? 'unknown';
        setState('error', motivo);
        note(`microfone: ${describeError(motivo) ?? motivo}`, 'error');
        return false;
      }
      })().finally(() => { micEmVoo = null; });
      return micEmVoo;
    },

    /**
     * Fecha o microfone e AVISA o fim da fala. Sem `audioStreamEnd` o servidor não transcreve
     * nada — medido em 2026-11-10.
     */
    async stopMic() {
      return fecharMicrofone('aluno parou de falar');
    },

    /** Encerramento completo e idempotente. */
    async stop() {
      if (state !== 'idle') setState('closing');
      await teardown();
      setState('idle');
      return true;
    },

    /** Trocar ou remover a chave implica derrubar a sessão: ela foi aberta com a antiga. */
    async forgetKey() {
      await this.stop();
      credentials.clear();
      note('chave removida desta aba.', 'info');
    },
  };

  return api;
}
