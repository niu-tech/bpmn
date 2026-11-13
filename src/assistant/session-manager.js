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

import { montarQuadro, quadroDelta } from './agent/frame.js';
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

/**
 * Marcas que o transcritor do provedor emite no lugar de fala: `<no speech>`, `{pause}` e
 * companhia. Não são conteúdo e não são nossas — são ruído do canal de legenda, e chegavam
 * coladas na resposta do aluno (*"9<no speech>{pause}"*, visto no portão F3 em 2026-11-13).
 */
const LIXO_DE_LEGENDA = /<\s*no[ _-]?speech\s*>|\{\s*pause\s*\}|<\s*\/?\s*noise\s*>/gi;

export function limparLegenda(texto) {
  // ⚠ NÃO apara as pontas: a legenda chega em pedaços, e o espaço entre eles é o espaço
  // entre as palavras. Aparar cada pedaço produzia "Uma raiaserve paraorganizar.".
  return String(texto ?? '').replace(LIXO_DE_LEGENDA, '').replace(/[ \t]{2,}/g, ' ');
}

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
   * O que o agente sabe do mundo fora da conversa: diagrama aberto e memória da aba.
   *
   * Duas fontes, com precedência declarada: o que `definirContexto` escreveu VENCE o que
   * `deps.lerDiagrama()` observa. Na página ninguém chama `definirContexto`, então o diagrama
   * vem do `elementRegistry` vivo (fase F3); no teste e na bateria o chamador declara um
   * diagrama e dirige o caso que quer — inclusive o envenenado, que não se consegue desenhar.
   */
  let contexto = {};

  /**
   * O contexto do ÚLTIMO quadro enviado ao modelo. É contra ele que o delta é calculado: sem
   * essa memória, cada turno remandaria o diagrama inteiro e o aluno pagaria duas vezes pelo
   * mesmo texto.
   */
  let contextoEnviado = null;

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

  /**
   * O contexto como o modelo deve vê-lo AGORA. Recalcula a projeção do diagrama no momento da
   * leitura (o observador do `eventBus` só marca sujo) — então é chamado nas bordas de turno, e
   * não a cada evento do modelador.
   */
  function contextoAtual(modo = mode) {
    return resolverContexto({
      modo,
      pagina: deps.pagina ?? contexto.pagina,
      diagrama: contexto.diagrama ?? deps.lerDiagrama?.() ?? null,
      memoria: contexto.memoria,
    });
  }

  /**
   * Manda o que mudou desde o último quadro, no COMEÇO de cada turno — digitado (`ask`) ou de
   * voz (`startMic`).
   *
   * O aluno pode perguntar por cima da resposta (o composer aceita em `speaking`), então o
   * quadro às vezes sai com o modelo falando. É seguro porque ele vai FECHADO, como par
   * user+model: é história, não uma vez em aberto competindo com o turno em curso — a diferença
   * que emudeceu a voz em 2026-11-13.
   */
  function atualizarContexto() {
    if (!session) return false;
    const delta = calcularDelta();
    if (!delta) return false;
    session.enviarContexto(delta);
    diag.state('contexto', `delta=${delta.length}b`);
    return true;
  }

  /**
   * O que mudou desde o último quadro, já marcado como entregue. Separado do envio porque a
   * pergunta digitada manda o quadro DENTRO do próprio frame dela (ver `ask`): dois frames
   * seguidos deixavam a pergunta ultrapassar o contexto.
   */
  function calcularDelta() {
    const agora = contextoAtual();
    const delta = quadroDelta(contextoEnviado, agora);
    if (delta) contextoEnviado = agora;
    return delta;
  }

  /**
   * Semeia a sessão nova: o estado da tela e, quando já houve conversa, o passado dela.
   *
   * É isto que faz trocar de modo parar de recomeçar do zero (tarefa 2.3). Os dois frames saem
   * ANTES do `setupComplete` e ficam na fila da sessão — a ordem é garantida por lá.
   */
  function semearContexto(ctx) {
    contextoEnviado = null;
    const quadro = montarQuadro(ctx);
    if (quadro) {
      session.enviarContexto(quadro);
      contextoEnviado = ctx;
    }
    const passado = historicoResumido();
    if (passado.length) {
      session.enviarHistorico(passado);
      diag.state('historico', `turnos=${passado.length}`);
    }
    return { quadro: Boolean(quadro), turnos: passado.length };
  }

  /**
   * As últimas trocas, com os papéis preservados. Teto duplo (quantidade e tamanho) porque
   * histórico sem teto é transcrição, e transcrição não cabe no orçamento (design H6).
   */
  function historicoResumido({ maxTurnos = 12, maxChars = 600 } = {}) {
    return messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text)
      .slice(-maxTurnos)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text.length > maxChars ? `${m.text.slice(0, maxChars)}…` : m.text,
      }));
  }

  function openSession(targetMode) {
    const apiKey = credentials.use();
    const ctxInicial = contextoAtual(targetMode);
    session = sessionFactory({
      apiKey,
      // O perfil decide a prosa E a declaração da função, numa chamada só (ver render.js).
      // Só o tier ESTÁVEL vai aqui: o volátil viaja por `clientContent` (design H3).
      setupOptions: promptDoPerfil(ctxInicial),
      /**
       * ⚠ Reconexão é sessão NOVA do lado do servidor: o `setup` é reenviado pelo `onopen`, mas
       * o quadro de contexto não, porque ele já tinha saído da fila na primeira vez. Sem isto,
       * uma queda de rede no meio da conversa deixava o agente cego para o diagrama até o aluno
       * reconectar à mão — e nada na tela diria que ele ficou cego.
       *
       * O sinal é o SETUP ACEITO, não o estado `ready`: o estado volta ao fim de cada turno, e
       * ouvi-lo re-semearia contexto e histórico a cada pergunta.
       */
      onSetupComplete: ({ reconectou }) => {
        if (reconectou) semearContexto(contextoAtual());
      },
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
      onText: ({ text: cru, fallback, complete, vazio }) => {
        // Turno que terminou sem nada utilizável: diga isso, em vez de deixar a tela muda.
        if (vazio) {
          note('o modelo encerrou o turno sem responder. Pergunte de novo, por favor.', 'error');
          return;
        }
        // ⚠ Na VOZ a legenda já foi aparecendo durante o turno, então o fechamento é repetição.
        // No TEXTO ela foi filtrada de propósito (ver `onTranscript`), e este é o único lugar
        // onde um turno respondido só com fala vira bolha. Ignorar aqui também deixava o aluno
        // sem resposta nenhuma — o que é pior que uma resposta feia.
        if (complete && fallback && mode === 'voz') return;
        const text = fallback ? limparLegenda(cru).trim() : cru;
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
        // ⚠ Legenda é coisa do modo VOZ. No modo texto a resposta vem pelos argumentos de
        // `entregar_resposta`, e a legenda que chega junto é de um turno de áudio que o modelo
        // às vezes emite mesmo assim — vazio, transcrito como `<no speech>` ou `{pause}`. Isso
        // colava na bolha do aluno: *"9<no speech>{pause}"* (visto no portão F3, 2026-11-13).
        // Turno de texto que termine sem entrega ainda tem fallback: `endTurn` usa o falado.
        if (mode !== 'voz') return;
        // Legenda da fala: um turno, uma bolha que cresce — sem as marcas de não-fala.
        const limpo = limparLegenda(text);
        if (!limpo.trim()) return;
        if (currentTurn && currentTurn.role === 'assistant' && currentTurn.turn === turnSeq) {
          currentTurn.text += limpo;
          publish();
        } else {
          currentTurn = push({ role: 'assistant', text: limpo, fallback: true, turn: turnSeq });
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
    // Depois do `start`: o frame entra na fila da sessão e sai no `setupComplete` (design H3).
    ultimaSemeadura = semearContexto(ctxInicial);
  }

  /** O que a última sessão levou de berço. É o que decide o texto do aviso de troca de modo. */
  let ultimaSemeadura = null;

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
     * Declara o contexto à mão, vencendo o que o modelador observa. Vale JÁ: desde F3 o contexto
     * viaja por `clientContent`, então o próximo turno leva o que mudou — não é mais preciso
     * reabrir a sessão (dívida T6, fechada).
     */
    definirContexto(novo = {}) {
      contexto = { ...contexto, ...novo };
      return api.contexto;
    },

    /** O contexto resolvido como o prompt o vê. Para teste e diagnóstico. */
    get contexto() {
      return contextoAtual();
    },

    /** O que já foi entregue ao modelo. Só diagnóstico — é o espelho do delta. */
    get contextoEnviado() {
      return contextoEnviado;
    },

    /** Força a atualização do quadro fora de um turno. Usado pela prova e pelo diagnóstico. */
    sincronizarContexto() {
      return atualizarContexto();
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
        // ⚠ O aviso segue a REALIDADE da reconstrução, não um texto fixo. Desde F3 a sessão nova
        // nasce com o estado da tela e com o resumo da conversa (`clientContent`), então repetir
        // "o modelo recomeça sem esse contexto" seria mentira — e aviso que mente é aviso que o
        // aluno aprende a ignorar. Quando não houve o que reconstruir, o aviso antigo continua
        // valendo, palavra por palavra.
        const levou = ultimaSemeadura?.turnos ?? 0;
        if (levou) {
          note(
            `modo ${targetMode}: sessão nova, mas levei junto o estado do diagrama e as últimas ${levou} mensagens desta conversa.`,
            'info',
          );
        } else {
          note(
            `modo ${targetMode}: sessão nova. O que já foi dito continua aqui na tela, mas o modelo recomeça sem esse contexto.`,
            'context-reset',
          );
        }
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
      // O que mudou na tela vai JUNTO com a pergunta, no mesmo frame: perguntar "o que é isto?"
      // com a seleção chegando em outro frame é perguntar sobre o elemento anterior — e foi
      // exatamente o que aconteceu ao vivo até 2026-11-13.
      const delta = calcularDelta();
      if (delta) diag.state('contexto', `com a pergunta, delta=${delta.length}b`);
      push({ role: 'user', text: q, via: 'texto', turn: turnSeq });
      session.ask(q, delta);
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
        // Abrir o microfone é começar um turno: o estado da tela tem de chegar antes da fala.
        atualizarContexto();
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
