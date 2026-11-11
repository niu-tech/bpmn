// Sessão Live: máquina de estados + fio. O WebSocket entra por INJEÇÃO (`socketFactory`), e é só
// por isso que o CI consegue provar turno, tool, reconexão e truncamento sem chave e sem rede.
//
// Estados (openspec design D8):
//   idle -> connecting -> ready -> (listening | speaking) -> closing -> idle
//   error(reason) alcançável de qualquer um. `reason` SEMPRE nomeado:
//   mic-denied | insecure-context | unsupported | bad-key | quota | ws-closed:<code> | timeout
//
// Invariantes que o código garante, não que a documentação pede:
//  - todo `toolCall` recebe `toolResponse` ANTES do próximo pedido (sem isso o turno pendura);
//  - nenhuma mensagem sai antes do `setupComplete`: o que chega antes é enfileirado;
//  - nenhum retry infinito: recuo exponencial com TETO, e depois do teto o erro FICA visível;
//  - toda mensagem de erro passa por `redact` antes de sair (a chave viaja na URL do socket).

import { redact, rememberSecret } from './redact.js';
import {
  buildAudioChunk, buildAudioStreamEnd, buildSetup, buildTextTurn, buildToolResponse,
  parseServerFrame, socketUrl,
} from './protocol.js';

export const STATES = ['idle', 'connecting', 'ready', 'listening', 'speaking', 'closing', 'error'];

const DEFAULTS = {
  connectTimeoutMs: 20000,
  // Silêncio total DEPOIS do setup aceito. Existe porque o provedor às vezes aceita o setup e não
  // manda nada — nem transcrição, nem turnComplete, nem fechamento. Sem isto a UI fica em
  // `connecting` para sempre, que é pior que um erro.
  idleTurnTimeoutMs: 45000,
  maxReconnects: 3,
  reconnectBaseMs: 500,
};

export function createSession({
  apiKey,
  socketFactory,
  setupOptions = {},
  onState,
  onText,
  onTranscript,
  onAudio,
  onInterrupted,
  onLog,
  // Diário da sessão: um evento por frame que entra e por frame que sai. É o que transforma
  // "o modelo foi interrompido" numa sequência (`out.audio x12 -> ws.interrupted`) que diz a
  // CAUSA. Opcional: sem ele a sessão funciona igual.
  onEvent,
  // ⚠ Envoltórios, NUNCA as referências cruas. No navegador `setTimeout` é método de `window`:
  // guardá-lo num objeto e chamar `clock.setTimeout(...)` perde o `this` e o browser lança
  // `TypeError: Illegal invocation`. No node a mesma linha funciona — então o defeito é
  // INVISÍVEL para os testes e fatal na página. Medido ao vivo em 2026-11-10: a sessão chegava
  // a `ready` e a primeira pergunta morria antes de ser enviada.
  clock = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
  ...options
} = {}) {
  const cfg = { ...DEFAULTS, ...options };

  let ws = null;
  let state = 'idle';
  let reason = null;
  let ready = false;
  let pending = [];            // o que tentou sair antes do setupComplete
  let attempts = 0;
  let connectTimer = null;
  let turnTimer = null;
  let closedByUs = false;
  const turns = [];            // histórico de turnos concluídos, para diagnóstico
  let turn = null;
  let resumptionHandle = null; // alça de retomada que o servidor manda; não usada ainda
  let lastUsage = null;        // contagem de tokens do último turno (custo é a cota do aluno)

  const log = (...parts) => onLog?.(parts.map((p) => redact(p)).join(' '));
  const ev = (src, kind, detail) => { try { onEvent?.(src, kind, detail); } catch { /* diário nunca derruba a sessão */ } };

  /** Nome curto do frame que sai, para o diário. Não serializa conteúdo — só a forma. */
  function nomeDoEnvio(frame) {
    if (frame.setup) return 'setup';
    if (frame.toolResponse) return 'tool-response';
    const r = frame.realtimeInput;
    if (r?.audio) return 'audio';
    if (r?.audioStreamEnd) return 'audio-end';
    if (r?.text !== undefined) return 'text';
    if (frame.clientContent) return 'history';
    return 'outro';
  }

  function setState(next, why = null) {
    if (state === next && reason === why) return;
    state = next;
    reason = why;
    onState?.({ state, reason: why });
  }

  function fail(why, detail) {
    clearTimers();
    ev('state', 'error', detail ? `${why}: ${detail}` : why);
    if (detail) log('falha:', detail);
    setState('error', why);
  }

  function clearTimers() {
    if (connectTimer) { clock.clearTimeout(connectTimer); connectTimer = null; }
    if (turnTimer) { clock.clearTimeout(turnTimer); turnTimer = null; }
  }

  function armTurnTimer() {
    if (turnTimer) clock.clearTimeout(turnTimer);
    turnTimer = clock.setTimeout(() => fail('timeout', 'servidor calado após o setup'), cfg.idleTurnTimeoutMs);
  }

  function send(frame) {
    if (!ready) { pending.push(frame); ev('out', 'enfileirado', nomeDoEnvio(frame)); return false; }
    try {
      ws.send(JSON.stringify(frame));
      ev('out', nomeDoEnvio(frame));
      return true;
    } catch (err) {
      fail('ws-closed:send', err);
      return false;
    }
  }

  function flushPending() {
    const queued = pending;
    pending = [];
    for (const frame of queued) send(frame);
  }

  function beginTurn(kind, prompt) {
    turn = { kind, prompt, text: '', spoken: '', delivered: false, audioFrames: 0, complete: false };
    armTurnTimer();
    return turn;
  }

  function endTurn(idle) {
    if (!turn) return;
    turn.complete = true;
    // Fallback: turno que termina sem chamada de entrega usa a transcrição da fala, e o registro
    // DIZ que foi fallback. JSON falado não sobrevive à transcrição, então isto é degradação
    // conhecida, não equivalência.
    if (!turn.delivered && turn.spoken) {
      turn.text = turn.spoken;
      turn.fallback = true;
      onText?.({ text: turn.text, fallback: true, complete: true });
    } else if (turn.delivered) {
      onText?.({ text: turn.text, fallback: false, complete: true });
    } else {
      // Nem entrega nem fala: turno vazio. Não inventar resposta.
      turn.empty = true;
    }
    turn.idle = idle;
    turn.usage = lastUsage;
    turns.push(turn);
    turn = null;
    if (turnTimer) { clock.clearTimeout(turnTimer); turnTimer = null; }
    setState('ready');
  }

  function handleFrame(raw) {
    const frame = parseServerFrame(raw);

    // `noop` é frame vazio por definição (20 de 64 numa sessão medida): registrá-lo empurraria
    // para fora do anel justamente o que explica o defeito.
    if (frame.kind !== 'noop') {
      ev('ws', frame.kind, frame.kind === 'turn-complete' ? `idle=${frame.idle}` : undefined);
    }

    switch (frame.kind) {
      case 'ready':
        ready = true;
        attempts = 0;
        if (connectTimer) { clock.clearTimeout(connectTimer); connectTimer = null; }
        setState('ready');
        flushPending();
        return;

      case 'audio':
        if (turn) turn.audioFrames++;
        setState('speaking');
        armTurnTimer();
        onAudio?.(frame.pcm16Base64);
        // O mesmo frame costuma trazer a legenda junto; sem isto ela se perdia.
        if (frame.text) {
          if (turn) turn.spoken += frame.text;
          onTranscript?.({ side: 'output', text: frame.text });
        }
        return;

      case 'noop':
      case 'generation-complete':
        // Frame vazio e fim-de-geração: vivos, mas não dizem nada. Só renovam o relógio — sem
        // isso o silêncio entre eles contaria como servidor calado.
        armTurnTimer();
        return;

      case 'resumption':
        resumptionHandle = frame.handle;
        return;

      case 'usage':
        lastUsage = frame.usage;
        return;

      case 'input-text':
        onTranscript?.({ side: 'input', text: frame.text });
        armTurnTimer();
        return;

      case 'output-text':
        if (turn) turn.spoken += frame.text;
        onTranscript?.({ side: 'output', text: frame.text });
        armTurnTimer();
        return;

      case 'tool-call': {
        // Responder é OBRIGATÓRIO, inclusive para chamada repetida: responder e descartar.
        // Sem a resposta o turno fica pendurado e o pedido seguinte cai no meio dele.
        send(buildToolResponse(frame.calls));
        if (frame.delivery !== null && frame.delivery !== undefined) {
          if (turn?.delivered) {
            log('entrega repetida ignorada');
          } else if (turn) {
            turn.delivered = true;
            turn.text = frame.delivery;
            onText?.({ text: frame.delivery, fallback: false, complete: false });
          }
        }
        armTurnTimer();
        return;
      }

      case 'interrupted':
        if (turn) turn.interrupted = true;
        onInterrupted?.();
        setState('ready');
        return;

      case 'turn-complete':
        // `idle=false` é só o enchimento ("vou pensar…"): ainda vem geração nova. Fechar aqui
        // apresentaria resposta parcial como completa.
        if (frame.usage) lastUsage = frame.usage;
        if (!frame.idle) { log('turno em progresso (enchimento), aguardando IDLE'); armTurnTimer(); return; }
        endTurn(true);
        return;

      case 'go-away':
        log('servidor avisou desconexão, timeLeft=', String(frame.timeLeft));
        return;

      default:
        log('frame não reconhecido:', JSON.stringify(frame.raw ?? frame).slice(0, 200));
        return;
    }
  }

  function wire() {
    ws.onopen = () => {
      ev('ws', 'open');
      // O setup é o primeiro frame SEMPRE. `ready` só depois do setupComplete.
      try {
        ws.send(JSON.stringify(buildSetup(setupOptions)));
        ev('out', 'setup', setupOptions.withDeliveryTool ? 'modo=texto' : 'modo=voz');
      } catch (err) {
        fail('ws-closed:setup', err);
      }
    };
    ws.onmessage = (event) => {
      const data = event?.data ?? event;
      if (typeof data === 'string') { handleFrame(data); return; }
      // Blob (navegador) chega assíncrono; ArrayBuffer é decodificado na hora.
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        data.text().then(handleFrame).catch((err) => log('blob ilegível:', err));
        return;
      }
      if (data instanceof ArrayBuffer) { handleFrame(new TextDecoder().decode(data)); return; }
      handleFrame(data);
    };
    ws.onerror = (event) => {
      // `event` carrega a URL com a chave. NUNCA sair daqui sem redact.
      ev('ws', 'error', event?.message ?? 'sem detalhe');
      log('erro de socket:', event?.message ?? 'sem detalhe');
    };
    ws.onclose = (event) => {
      const code = event?.code ?? 0;
      const texto = String(event?.reason ?? '');
      ev('ws', 'close', `code=${code} ${texto}`.trim());
      ready = false;
      clearTimers();
      if (closedByUs) { setState('idle'); return; }

      // ⚠ 1007 é AMBÍGUO: o servidor usa o mesmo código para "configuração recusada" (o pedido de
      // saída TEXT, que o 3.8 nega) e para "API key not valid". Para quem traz a própria chave, o
      // segundo caso é de longe o mais comum — e dizer "o servidor recusou a configuração" manda
      // o aluno procurar defeito no lugar errado. Medido nas duas situações no P1, o que separa
      // uma da outra é o TEXTO do fechamento.
      if (code === 1007) {
        if (/api[ _-]?key/i.test(texto)) fail('bad-key', 'o servidor recusou a credencial');
        else fail('ws-closed:1007', 'servidor recusou o payload do setup');
        return;
      }
      if (code === 1008 || code === 1011) {
        // 1008 também aparece como "unregistered callers" quando a credencial não autentica.
        if (/unregistered|credential|api[ _-]?key/i.test(texto)) { fail('bad-key', 'credencial não aceita'); return; }
        fail('quota', `fechado com ${code}`);
        return;
      }

      if (attempts < cfg.maxReconnects) {
        const delay = cfg.reconnectBaseMs * 2 ** attempts;
        attempts++;
        log(`reconectando (${attempts}/${cfg.maxReconnects}) em ${delay}ms`);
        setState('connecting', `ws-closed:${code}`);
        clock.setTimeout(() => { if (!closedByUs) open(); }, delay);
        return;
      }
      fail(`ws-closed:${code}`, `teto de ${cfg.maxReconnects} reconexões atingido`);
    };
  }

  function open() {
    setState('connecting');
    ready = false;
    try {
      ws = socketFactory
        ? socketFactory(socketUrl(apiKey))
        : new WebSocket(socketUrl(apiKey));
    } catch (err) {
      fail('bad-key', err);
      return;
    }
    wire();
    connectTimer = clock.setTimeout(
      () => { if (!ready) fail('timeout', 'setup não foi aceito no prazo'); },
      cfg.connectTimeoutMs,
    );
  }

  return {
    get state() { return state; },
    get reason() { return reason; },
    get turns() { return turns.slice(); },
    get isReady() { return ready; },
    get resumptionHandle() { return resumptionHandle; },
    get lastUsage() { return lastUsage; },

    start() {
      if (!apiKey) { fail('bad-key', 'chave ausente'); return; }
      // Registra ANTES de conectar: a partir daqui qualquer eco dela em log ou erro e mascarado
      // por igualdade exata, sem depender de reconhecer o formato.
      rememberSecret(apiKey);
      closedByUs = false;
      attempts = 0;
      open();
    },

    /** PROVA C: pergunta digitada -> Live -> texto pelos argumentos de `entregar_resposta`. */
    ask(text) {
      beginTurn('text', text);
      setState('listening');
      send(buildTextTurn(text));
    },

    /** PROVA A: quadro do microfone (base64 PCM16 16 kHz). */
    pushAudio(pcm16Base64) {
      if (!turn) beginTurn('voice', null);
      send(buildAudioChunk(pcm16Base64));
    },

    /**
     * O aluno parou de falar. **Obrigatório** — sem isto o servidor não transcreve (medido).
     * Chamar ao fechar o microfone, não a cada pausa.
     */
    endAudio() {
      send(buildAudioStreamEnd());
      // ⚠ NÃO rebaixar o estado quando o modelo já está falando. O fim de fala agora também é
      // enviado pelo fecho automático do microfone (meia-duplex), que acontece JUNTO com o
      // primeiro quadro de áudio da resposta: forçar `listening` ali fazia o selo piscar
      // "ouvindo" no exato momento em que o ajudante respondia — e derrubava a guarda que
      // descarta quadro de microfone enquanto o modelo fala.
      if (state !== 'speaking') setState('listening');
    },

    /** Encerramento explícito: sem isto a cota do aluno continua correndo. */
    close() {
      closedByUs = true;
      setState('closing');
      clearTimers();
      pending = [];
      try { ws?.close(1000, 'encerrado pelo usuário'); } catch { /* já fechado */ }
      setState('idle');
    },
  };
}
