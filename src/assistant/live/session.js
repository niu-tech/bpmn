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
import { MARCA_XML } from '../agent/frame.js';
import {
  buildAudioChunk, buildAudioStreamEnd, buildHistory, buildSetup, buildTextTurn, buildToolResponse,
  parseServerFrame, respostaDeEntrega, socketUrl, DELIVERY_TOOL,
} from './protocol.js';
import { RastreadorDeTurnos } from './turn-tracker.js';

export const STATES = ['idle', 'connecting', 'ready', 'listening', 'speaking', 'closing', 'error'];

/**
 * A vez do modelo que FECHA o quadro de contexto. Não é fala que alguém ouça — é o que impede
 * o turno do aluno de ficar aberto no servidor (ver `enviarContexto`).
 */
const ACK_CONTEXTO = 'Entendido, estou com o estado atual da tela.';

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
  /** Setup ACEITO pelo servidor. `reconectou` diz se este socket substitui um que caiu. */
  onSetupComplete,
  // Diário da sessão: um evento por frame que entra e por frame que sai. É o que transforma
  // "o modelo foi interrompido" numa sequência (`out.audio x12 -> ws.interrupted`) que diz a
  // CAUSA. Opcional: sem ele a sessão funciona igual.
  onEvent,
  /**
   * Quem executa ferramenta (`agent/dispatch.js`). Sem ele, chamada que não seja a entrega
   * textual é respondida `ferramenta_nao_roteada` — que é a verdade, e não `{ok:true}`.
   */
  dispatcher,
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
  let seqTurno = 0;            // identidade do turno DENTRO desta sessão (1, 2, 3…)
  /**
   * O turno que o aluno atropelou perguntando por cima, e que o servidor ainda vai terminar.
   *
   * ⚠ Existe porque o Live NÃO carimba turno no frame. Quando uma pergunta nova entra com o
   * turno anterior ainda aberto, o servidor termina o anterior ANTES de começar o novo — então
   * tudo que chega até o próximo `turnComplete` pertence ao velho. Sem essa regra, o fim da
   * resposta anterior era carimbado com o turno novo e aparecia como resposta à pergunta nova
   * (dívida T9: *"…para responder dúvidas sobre o seu diagrama"* respondendo outra coisa).
   */
  let pendente = null;
  let resumptionHandle = null; // alça de retomada que o servidor manda; não usada ainda
  let lastUsage = null;
  let setupsAceitos = 0;       // quantos setups o servidor ja aceitou nesta sessao (reconexao > 1)        // contagem de tokens do último turno (custo é a cota do aluno)

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

  /**
   * ⚠ O relógio de silêncio do turno NÃO corre enquanto uma ferramenta executa. Com um relógio
   * só, o cliente desiste no meio da execução e o turno morre por "servidor calado" — o mesmo
   * defeito registrado na cadeia de orçamento de turno do CopilotSpeaker.
   */
  let ferramentasEmVoo = 0;

  function armTurnTimer() {
    if (turnTimer) clock.clearTimeout(turnTimer);
    turnTimer = null;
    if (ferramentasEmVoo > 0) return;
    turnTimer = clock.setTimeout(() => fail('timeout', 'servidor calado após o setup'), cfg.idleTurnTimeoutMs);
  }

  function pausarRelogioDoTurno() {
    ferramentasEmVoo++;
    if (turnTimer) { clock.clearTimeout(turnTimer); turnTimer = null; }
  }

  function retomarRelogioDoTurno() {
    ferramentasEmVoo = Math.max(0, ferramentasEmVoo - 1);
    if (ferramentasEmVoo === 0) armTurnTimer();
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
    // Perguntar por cima não apaga o turno anterior: ele vira `pendente` e continua recebendo o
    // que o servidor ainda mandar, até o `turnComplete` que o fecha.
    if (turn && !turn.complete) {
      if (pendente) encerrarTurno(pendente, false);   // dois atropelos seguidos: fecha o mais velho
      pendente = turn;
      ev('state', 'turno-atropelado', `n=${turn.n}`);
    }
    turn = { n: ++seqTurno, kind, prompt, text: '', spoken: '', delivered: false, audioFrames: 0, complete: false };
    // Turno novo no rastreador: tudo preso ao anterior passa a ser velho, inclusive chamada.
    rastreador.abrirTurno();
    armTurnTimer();
    return turn;
  }

  /**
   * O turno que acabou de FECHAR. É dele o quadro que chega depois do fim e antes da pergunta
   * seguinte — o protocolo não carimba turno em quadro nenhum, e a ordem é a única pista.
   *
   * Sem isto, esse quadro voltava sem dono (`turno: null`) e a camada de cima o entregava ao
   * "turno mais recente". Entre turnos os dois coincidem; depois de uma pergunta nova, não — e a
   * diferença é um pedaço da resposta anterior virando resposta da pergunta seguinte (portão F5).
   */
  let ultimoEncerrado = null;

  /**
   * Uma execução por `{turno, chamada}` (H1 · tarefa 1.4).
   *
   * O turno dele anda junto do nosso `beginTurn`. Chamada repetida — reconexão, retransmissão do
   * servidor — reaproveita o resultado memorizado em vez de executar de novo. Enquanto a
   * ferramenta só LÊ, repetir custa uma consulta; com a escrita da F7, repetir custa um elemento
   * duplicado no diagrama do aluno.
   */
  const rastreador = new RastreadorDeTurnos();

  /** De quem é o frame que acabou de chegar: do atropelado, do atual, ou do que acabou de fechar. */
  function dono() {
    return pendente ?? turn ?? ultimoEncerrado;
  }

  function encerrarTurno(alvo, idle) {
    if (!alvo) return;
    alvo.complete = true;
    const turn = alvo;   // o corpo abaixo fala do turno que está fechando, não do atual
    // Fallback: turno que termina sem chamada de entrega usa a transcrição da fala, e o registro
    // DIZ que foi fallback. JSON falado não sobrevive à transcrição, então isto é degradação
    // conhecida, não equivalência.
    //
    // ⚠ LEGENDA SEM ÁUDIO NÃO É FALA DESTE TURNO. O protocolo não carimba o turno nos quadros, e
    // um pedaço da legenda da geração ANTERIOR chega depois de o turno dela ter fechado — se a
    // pergunta seguinte já abriu, esse pedaço entra no `spoken` do turno NOVO. Foi assim que
    // *"sobre modelagem e boas práticas em BPMN 2.0 no seu diagrama aberto."* (o fim da recusa da
    // pergunta 1) virou a "resposta" da pergunta 2, no portão F5 de 2026-11-13 — um fragmento que
    // começa no meio da frase, que é a assinatura do problema.
    //
    // A regra que separa os dois casos sem adivinhar tempo: fala de verdade TRAZ ÁUDIO. Turno que
    // acumulou legenda e não recebeu um único quadro de áudio não falou — herdou. Esse turno é
    // VAZIO, e vazio o produto já sabe anunciar.
    const falouDeVerdade = turn.spoken && turn.audioFrames > 0;
    if (!turn.delivered && falouDeVerdade) {
      turn.text = turn.spoken;
      turn.fallback = true;
      onText?.({ text: turn.text, fallback: true, complete: true, turno: turn.n });
    } else if (turn.delivered) {
      onText?.({ text: turn.text, fallback: false, complete: true, turno: turn.n });
    } else {
      // Nem entrega nem fala: turno vazio. Não inventar resposta — mas AVISAR.
      //
      // ⚠ Ficava calado, e o aluno via a própria pergunta e mais nada. Apareceu no portão F3
      // (2026-11-13): no modo texto o modelo às vezes fecha o turno com um áudio sem fala, cuja
      // legenda é só `<no speech>`; depois que essas marcas passaram a ser limpas, não sobrava
      // bolha nenhuma. Silêncio é pior que resposta feia: o aluno não sabe se perguntou errado,
      // se travou, ou se a cota acabou.
      turn.empty = true;
      // Legenda emprestada é registrada, não exibida: some da tela e continua no diário, que é
      // onde se investiga de quem era.
      if (turn.spoken) {
        turn.legendaEmprestada = turn.spoken;
        ev('state', 'legenda-sem-audio', `n=${turn.n} chars=${turn.spoken.length}`);
      }
      if (!turn.usouFerramenta) onText?.({ text: '', fallback: true, complete: true, vazio: true, turno: turn.n });
    }
    turn.idle = idle;
    turn.usage = lastUsage;
    ultimoEncerrado = turn;
    turns.push(turn);
    if (turnTimer) { clock.clearTimeout(turnTimer); turnTimer = null; }
    setState('ready');
  }

  /**
   * Fecha o turno certo. O PRIMEIRO `turnComplete` depois de uma pergunta por cima fecha o
   * ATROPELADO — o servidor termina o anterior antes de começar o novo —, e o seguinte fecha o
   * atual. É a única pista de fronteira que o protocolo dá.
   */
  function endTurn(idle) {
    const alvo = pendente ?? turn;
    if (!alvo) return;

    // ⚠ TURNO DE FERRAMENTA É INTERMEDIÁRIO. Medido ao vivo no portão F6 (2026-11-13):
    //
    //   1,7s  ws.tool-call → tool.executando buscar_elemento → out.tool-response
    //   1,7s  ws.turn-complete idle=true          ← o servidor FECHA aqui
    //   2,3s  ws.tool-call (a entrega) → out.tool-response
    //   4,2s  ws.audio x21
    //
    // Ou seja: a resposta ao aluno vem numa GERAÇÃO NOVA, depois do turno que só executou a
    // ferramenta. Fechando o nosso turno no primeiro `turnComplete`, a entrega chegava sem
    // turno aberto e era descartada — o aluno via a pergunta, nenhuma resposta, e 45 s depois
    // "o servidor não respondeu". Era o turno certo fechando na hora errada.
    if (alvo.usouFerramenta && !alvo.delivered && !alvo.spoken) {
      log('turno de ferramenta fechado pelo servidor; aguardando a resposta na geração seguinte');
      ev('state', 'turno-de-ferramenta', `n=${alvo.n}`);
      armTurnTimer();
      return;
    }

    if (pendente) {
      pendente = null;
      encerrarTurno(alvo, idle);
      return;
    }
    turn = null;
    encerrarTurno(alvo, idle);
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
        // ⚠ Sinal do SETUP ACEITO, que não é a mesma coisa que o estado `ready`: aquele volta ao
        // fim de CADA turno. Quem precisa saber "o servidor aceitou um setup novo" — para
        // semear o contexto de novo depois de uma reconexão — tem de ouvir isto, e não o estado.
        onSetupComplete?.({ reconectou: setupsAceitos > 0 });
        setupsAceitos++;
        return;

      case 'audio': {
        const alvo = dono();
        if (alvo) alvo.audioFrames++;
        setState('speaking');
        armTurnTimer();
        onAudio?.(frame.pcm16Base64);
        // O mesmo frame costuma trazer a legenda junto; sem isto ela se perdia.
        if (frame.text) {
          if (alvo) alvo.spoken += frame.text;
          onTranscript?.({ side: 'output', text: frame.text, turno: alvo?.n ?? null });
        }
        return;
      }

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
        // A fala do aluno é do turno NOVO: é ela que o abre. Nunca do atropelado.
        onTranscript?.({ side: 'input', text: frame.text, turno: turn?.n ?? null });
        armTurnTimer();
        return;

      case 'output-text': {
        const alvo = dono();
        if (alvo) alvo.spoken += frame.text;
        onTranscript?.({ side: 'output', text: frame.text, turno: alvo?.n ?? null });
        armTurnTimer();
        return;
      }

      case 'tool-call': {
        // Responder é OBRIGATÓRIO, inclusive para chamada recusada ou repetida: sem a resposta o
        // turno fica pendurado e o pedido seguinte cai no meio dele. O que mudou é QUANDO e COM
        // O QUÊ — a resposta agora carrega o resultado real.
        if (frame.delivery !== null && frame.delivery !== undefined) {
          const alvo = dono();
          if (alvo?.delivered) {
            log('entrega repetida ignorada');
          } else if (alvo) {
            alvo.delivered = true;
            alvo.text = frame.delivery;
            onText?.({ text: frame.delivery, fallback: false, complete: false, turno: alvo.n });
          }
        }

        const entregas = frame.calls.filter((c) => c.name === DELIVERY_TOOL);
        const acoes = frame.calls.filter((c) => c.name !== DELIVERY_TOOL);

        // Entrega textual não executa nada: responde na hora, como sempre fez.
        if (!acoes.length) {
          send(buildToolResponse(entregas.map(respostaDeEntrega)));
          armTurnTimer();
          return;
        }

        // ⚠ UMA EXECUÇÃO POR `{turno, chamada}`. O servidor repete `toolCall` — reconexão,
        // retransmissão — e executar de novo é, com a escrita da F7, criar o elemento duas vezes.
        // Responder continua OBRIGATÓRIO para a repetida: o que muda é que ela devolve o resultado
        // memorizado em vez de bater na ferramenta.
        const classificadas = acoes.map((c) => ({ c, d: rastreador.classificarChamada(rastreador.turno, c.id) }));
        const novas = classificadas.filter((x) => x.d.acao === 'executar');
        const repetidas = classificadas.filter((x) => x.d.acao !== 'executar');
        const respostasRepetidas = repetidas.map(({ c, d }) => ({
          id: c.id,
          name: c.name,
          response: d.resultado ?? { ok: false, erro: 'chamada_repetida_sem_resultado' },
        }));
        if (repetidas.length) {
          log(`chamada repetida reaproveitada: ${repetidas.map((x) => x.c.name).join(', ')}`);
          ev('tool', 'repetida', String(repetidas.length));
        }

        if (!novas.length) {
          // Tudo repetido: responde com o memorizado, sem despachar nada.
          send(buildToolResponse([...entregas.map(respostaDeEntrega), ...respostasRepetidas]));
          armTurnTimer();
          return;
        }

        // Ação de verdade: despacho ASSÍNCRONO. `handleFrame` volta já — travar aqui travaria o
        // laço de recepção do socket, que é o deadlock que os invariantes de voz proíbem.
        pausarRelogioDoTurno();
        // ⚠ Turno que EXECUTOU ferramenta e fechou sem falar não é turno vazio: é o passo do
        // meio. Medido no gate 4.3 (2026-11-13): a voz chamou `descrever_diagrama`, o turno
        // fechou em 7,8 s, e a resposta falada veio no turno seguinte, aos 9 s — com o aviso de
        // "o modelo encerrou sem responder" plantado no meio, assustando à toa.
        { const alvo = dono(); if (alvo) alvo.usouFerramenta = true; }
        const paraExecutar = novas.map((x) => x.c);
        const despacho = dispatcher
          ? dispatcher.despachar(paraExecutar)
          : Promise.resolve(paraExecutar.map((c) => ({ id: c.id, name: c.name, response: { ok: false, erro: 'ferramenta_nao_roteada' } })));

        Promise.resolve(despacho)
          .then((resultados) => {
            if (closedByUs) return;
            // Memoriza ANTES de responder: se o servidor repetir a mesma chamada, a repetição já
            // encontra o resultado pronto.
            for (const r of resultados) {
              const casada = novas.find((x) => x.c.id === r.id);
              if (casada) rastreador.concluirChamada(casada.d.chave, r.response);
            }
            send(buildToolResponse([...entregas.map(respostaDeEntrega), ...respostasRepetidas, ...resultados]));
          })
          .catch((err) => {
            // O despachante não deveria lançar; se lançar, o modelo ainda precisa de resposta.
            log('despacho lancou:', err?.message ?? String(err));
            if (!closedByUs) {
              send(buildToolResponse([...respostasRepetidas, ...paraExecutar.map((c) => ({ id: c.id, name: c.name, response: { ok: false, erro: 'ferramenta_falhou' } }))]));
            }
          })
          .finally(() => { retomarRelogioDoTurno(); });
        return;
      }

      case 'interrupted': {
        // Interrupção fecha o atropelado: foi ele que o servidor cortou para atender o novo.
        const alvo = dono();
        if (alvo) alvo.interrupted = true;
        if (pendente) { const p = pendente; pendente = null; encerrarTurno(p, false); }
        onInterrupted?.();
        setState('ready');
        return;
      }

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

    /**
     * PROVA C: pergunta digitada -> Live -> texto pelos argumentos de `entregar_resposta`.
     *
     * `contexto` (opcional) é o quadro do estado da tela que mudou desde o último turno. Ele
     * entra NO TEXTO da própria pergunta, acima dela, com as marcas de dado que o renderizador
     * já escreveu. Um frame, um turno, nenhuma corrida.
     *
     * ⚠ Duas medições ao vivo moldaram esta linha, em 2026-11-13:
     *
     *  1. **Dois frames seguidos não funcionam.** Mandar o quadro por `clientContent` e, no
     *     mesmo instante, a pergunta por `realtimeInput.text` faz a pergunta ultrapassar o
     *     quadro: o modelo respondia *"você não selecionou nenhum elemento"* com a seleção
     *     enviada milissegundos antes (`out.history` logo antes de `out.text`, no diário). Com
     *     2 s de espera entre os dois, respondia certo — mas esperar seria número mágico.
     *  2. **Um `clientContent` com `turnComplete:true` também não serve.** Resolve a corrida e
     *     quebra outra coisa: nesse formato o modelo responde FALANDO, mesmo com a função de
     *     entrega declarada, e a bolha do aluno recebe a legenda do áudio (`<no speech>{pause}`)
     *     em vez da resposta. O fato medido no P1 — "declarar a função emudece o modelo" — vale
     *     para `realtimeInput.text`, e não para um turno de conteúdo.
     *
     * Daí a forma atual: o transporte provado, com o contexto dentro do texto.
     */
    ask(text, contexto = null) {
      const meu = beginTurn('text', text);
      setState('listening');
      const ctx = typeof contexto === 'string' ? contexto.trim() : '';
      // Contexto e pergunta no MESMO frame, pelo MESMO transporte de sempre.
      send(buildTextTurn(ctx && !ctx.includes(MARCA_XML) ? `${ctx}\n\n[fim do contexto]\n\nPergunta do aluno: ${text}` : text));
      // Devolve a identidade do turno: é com ela que a conversa casa pergunta e resposta.
      return meu.n;
    },

    /**
     * Quadro de contexto: o estado da tela por `clientContent` com `turnComplete:false`
     * (design H3). Não abre turno e não espera resposta — é informação que o modelo passa a ter.
     *
     * Chamável ANTES do `setupComplete`: o frame entra na fila e sai assim que o setup é aceito,
     * que é exatamente a semeadura que a fase pede. Quem monta o texto é `agent/frame.js`.
     *
     * ⚠ Guarda da tarefa 3.4, aqui e não no montador: este é o lugar onde o frame REALMENTE sai.
     * Um quadro com XML do diagrama é recusado e registrado — o XML tem 22 KB, queima a cota do
     * aluno e afoga o contexto útil, e a recusa precisa valer mesmo que algum chamador futuro
     * monte o texto por fora.
     */
    enviarContexto(texto) {
      const t = String(texto ?? '').trim();
      if (!t) return false;
      if (t.includes(MARCA_XML)) {
        ev('out', 'contexto-recusado', 'continha XML do diagrama');
        log('quadro de contexto recusado: XML não viaja (design H4)');
        return false;
      }
      // ⚠ O quadro vai FECHADO: um turno de `user` e um de `model`. Mandar só o turno do aluno
      // com `turnComplete:false` significa, no protocolo, "ainda estou compondo minha vez" — e
      // o servidor fica esperando o fim dela. Medido ao vivo em 2026-11-13: a fala era
      // transcrita certa ("qual a diferença entre gateway exclusivo e paralelo?") e o modelo
      // respondia com ZERO frames de áudio, porque o turno do aluno nunca fechava. No modo
      // texto o defeito não aparecia: `realtimeInput.text` abre e fecha o turno sozinho.
      send(buildHistory([{ role: 'user', text: t }, { role: 'model', text: ACK_CONTEXTO }]));
      return true;
    },

    /**
     * Histórico semeado como CONVERSA, com os papéis preservados (design H3, tarefa 2.3).
     *
     * `turns` = `[{role:'user'|'model', text}]`. Vai por `clientContent` sem fechar o turno, que
     * é a forma documentada de dar passado a uma sessão nova — é o que faz trocar de voz para
     * texto deixar de recomeçar do zero.
     *
     * ⚠ Papel preservado NÃO é fronteira perdida: um turno que o aluno disse continua sendo um
     * turno do aluno, com a mesma confiança que tinha quando foi dito. Repetir a fala dele como
     * se fosse instrução do sistema é que seria promoção de confiança.
     */
    enviarHistorico(turnos) {
      const limpos = (Array.isArray(turnos) ? turnos : [])
        .map((t) => ({ role: t?.role === 'model' ? 'model' : 'user', text: String(t?.text ?? '').trim() }))
        .filter((t) => t.text && !t.text.includes(MARCA_XML));
      // Pergunta que ficou sem resposta não entra: ela deixaria o turno do aluno ABERTO na
      // sessão nova, e o servidor esperaria o fim dele em vez de ouvir o microfone (medido em
      // 2026-11-13). Descartar é honesto — aquela pergunta não foi respondida mesmo.
      while (limpos.length && limpos.at(-1).role === 'user') limpos.pop();
      if (!limpos.length) return false;
      send(buildHistory(limpos));
      return true;
    },

    /** PROVA A: quadro do microfone (base64 PCM16 16 kHz). */
    pushAudio(pcm16Base64) {
      if (!turn) beginTurn('voice', null);
      send(buildAudioChunk(pcm16Base64));
      return turn.n;
    },

    /**
     * O aluno parou de falar. Chamar ao fechar o microfone, não a cada pausa.
     *
     * ⚠ NÃO é o que destrava a transcrição — a medição de 2026-11-13 (`tools/medir-voz.mjs`)
     * mostrou o servidor transcrevendo sem isto, pela cauda de silêncio. Ver `buildAudioStreamEnd`.
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
      try { dispatcher?.encerrar?.(); } catch { /* já encerrado */ }
      setState('closing');
      clearTimers();
      pending = [];
      try { ws?.close(1000, 'encerrado pelo usuário'); } catch { /* já fechado */ }
      setState('idle');
    },
  };
}
