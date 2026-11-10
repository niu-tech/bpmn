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

import { startCapture, startPlayback } from './live/audio.js';
import { createSession } from './live/session.js';
import { redact } from './live/redact.js';

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
  let turnSeq = 0;
  let currentTurn = null;
  let teardownInFlight = null;

  /** Histórico SÓ em memória. Morre com a aba — como a chave. */
  const messages = [];

  const publish = () => onUpdate?.({
    state, reason, mode, micOn,
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
    session = null; mic = null; speaker = null;
    micOn = false; currentTurn = null;

    teardownInFlight = (async () => {
      // Ordem: microfone primeiro (apaga o indicador do navegador na hora), depois som, depois fio.
      try { await micRef?.stop(); } catch { /* já parado */ }
      try { await speakerRef?.stop(); } catch { /* já parado */ }
      try { sessionRef?.close(); } catch { /* já fechada */ }
    })().finally(() => { teardownInFlight = null; });

    return teardownInFlight;
  }

  async function ensureSpeaker() {
    if (speaker) return speaker;
    speaker = await playbackFactory({
      onStats: (s) => { lastStats = s; },
    });
    return speaker;
  }

  let lastStats = null;

  function openSession(targetMode) {
    const apiKey = credentials.use();
    session = sessionFactory({
      apiKey,
      setupOptions: { withDeliveryTool: targetMode === 'texto' },
      onState: ({ state: s, reason: r }) => {
        if (s === 'error' && r === 'bad-key') credentials.markRejected();
        setState(s, r);
        if (s === 'error') note(`não deu: ${describeError(r)}`, 'error');
      },
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
        try {
          const out = await ensureSpeaker();
          out.push(b64, ++audioSeq);
        } catch (err) {
          note(`não consegui tocar o áudio: ${err?.message ?? err}`, 'error');
        }
      },
      onInterrupted: () => {
        speaker?.flush();
        note('o modelo foi interrompido', 'info');
      },
    });
    session.start();
  }

  let audioSeq = 0;

  return {
    get state() { return state; },
    get reason() { return reason; },
    get mode() { return mode; },
    get micOn() { return micOn; },
    get messages() { return messages.slice(); },
    get stats() { return lastStats; },
    /** Só para teste e diagnóstico: a contagem de tokens que o servidor reportou. */
    get lastUsage() { return session?.lastUsage ?? null; },

    /** Conecta no modo pedido. Recusa sem chave ou sem consentimento — fail closed. */
    async connect(targetMode = mode) {
      if (!MODES.includes(targetMode)) throw new Error(`modo inválido: ${targetMode}`);
      if (!credentials.hasKey) { note('informe a sua chave do Google AI Studio para começar.', 'error'); return false; }
      if (!credentials.consented) { note('aceite o aviso sobre a chave antes de conectar.', 'error'); return false; }

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
      if (targetMode === mode && state !== 'idle' && state !== 'error') return false;
      const estavaVivo = state !== 'idle';
      const ok = await this.connect(targetMode);
      if (ok && estavaVivo) {
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

    /** Abre o microfone. Só no modo voz, e só a partir de um gesto do aluno. */
    async startMic() {
      if (mode !== 'voz') { note('o microfone só funciona no modo voz.', 'error'); return false; }
      if (!session) { note('conecte antes de falar.', 'error'); return false; }
      if (mic) return true;
      try {
        await (await ensureSpeaker()).resume();   // o mesmo gesto libera o alto-falante
        turnSeq++;
        currentTurn = null;
        mic = await capture({
          onFrame: (b64) => session?.pushAudio(b64),
          onError: (err) => note(`microfone: ${err?.message ?? err}`, 'error'),
        });
        micOn = true;
        publish();
        return true;
      } catch (err) {
        micOn = false;
        const motivo = err?.reason ?? 'unknown';
        setState('error', motivo);
        note(`microfone: ${describeError(motivo) ?? motivo}`, 'error');
        return false;
      }
    },

    /**
     * Fecha o microfone e AVISA o fim da fala. Sem `audioStreamEnd` o servidor não transcreve
     * nada — medido em 2026-11-10.
     */
    async stopMic() {
      if (!mic) return false;
      const ref = mic;
      mic = null;
      micOn = false;
      try { await ref.stop(); } catch { /* já parado */ }
      session?.endAudio();
      publish();
      return true;
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
}
