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

import { ferramentasPermitidas, permitida } from './agent/policy.js';
import { createToolDispatcher } from './agent/dispatch.js';
import { linhaDeFim, linhaDeInicio } from './tools/apresentador.js';
import { montarQuadro, quadroDelta } from './agent/frame.js';
import { criarMemoria } from './agent/memory.js';
import { criarExecutoresDeLeitura } from './tools/leitura.js';
import { criarExecutoresDeEscrita } from './tools/escrita.js';
import { promptDoPerfil } from './agent/render.js';
import { resolverContexto } from './agent/resolve.js';
import { startCapture, startPlayback, criarDetectorDeFala } from './live/audio.js';
import { createSession } from './live/session.js';
import { EventoDeFala, RastreadorDeTurnos } from './live/turn-tracker.js';
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
  // Ferramenta rodando é um estado PRÓPRIO: dizer 'pronto' enquanto se varre o diagrama é mentir
  // para quem está esperando, e foi por falta deste selo que a espera parecia travamento.
  tool: 'consultando',
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

/**
 * Marcador CORTADO AO MEIO, no fim do texto — um `<no spe` à espera do resto.
 *
 * A legenda chega em pedaços e o marcador não respeita essa fronteira. Rodar o filtro em cada
 * pedaço não acha `<no speech>` partido entre dois, e o rabo cai na bolha: em 2026-11-13 o
 * portão F6 respondeu **`"speech>"`** (dívida T10). Não se conserta com mais padrão — conserta-se
 * filtrando o ACUMULADO, e segurando a cauda que ainda pode virar marcador.
 *
 * A regra é a abertura sem fechamento: `<` ou `{` sem o `>` ou `}` dele, perto do fim. Não há
 * perda — o acumulado é refiltrado a cada pedaço, então assim que o resto chega o texto aparece
 * inteiro (ou some inteiro, se era marcador mesmo).
 */
const MARCADOR_EM_VOO = /[<{][^<>{}]{0,14}$/;

/**
 * A legenda como o aluno a vê: o acumulado do turno, sem marca de não-fala e sem marcador pela
 * metade. Recebe o texto INTEIRO do turno, nunca o pedaço — é essa a diferença que fecha a T10.
 */
export function legendaVisivel(acumulado) {
  return limparLegenda(acumulado).replace(MARCADOR_EM_VOO, '');
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
  /**
   * A linha de ATIVIDADE da ferramenta que está rodando agora (H3).
   *
   * Uma por vez e a mesma bolha: começa com "procurando no diagrama…" e vira o resultado. Empurrar
   * uma bolha nova no fim deixaria duas linhas para um evento só.
   */
  let atividade = null;
  /** Para onde o selo volta quando a ferramenta termina. */
  let estadoAntesDaFerramenta = null;

  /** Detector de fala por cima da resposta (barge-in local, H4). Vive a sessão inteira. */
  const detectorDeFala = criarDetectorDeFala();
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
  /**
   * Identidade do turno DA SESSÃO -> número do turno NA CONVERSA.
   *
   * ⚠ São numerações diferentes de propósito. A sessão recomeça do 1 a cada reconexão e a cada
   * troca de modo; a conversa na tela não recomeça. O mapa é o que liga as duas — e é ele que
   * faz um texto atrasado voltar para a bolha de onde ele saiu, em vez de virar resposta da
   * pergunta seguinte (dívida T9).
   */
  let turnoDaSessao = new Map();
  /**
   * A legenda CRUA de cada turno, do jeito que o servidor mandou.
   *
   * Existe porque o filtro de não-fala precisa ver o texto inteiro (ver `legendaVisivel`): a
   * bolha mostra o filtrado, e o cru fica aqui para ser refiltrado quando o pedaço seguinte
   * chega. Guardar só o filtrado perderia a primeira metade de um marcador partido.
   */
  let legendaCruaDoTurno = new Map();
  /**
   * Fronteira da fala do aluno (ver `live/turn-tracker.js`).
   *
   * A transcrição de entrada chega em PEDAÇOS — e às vezes como a frase inteira repetida. Sem
   * juntar, cada pedaço virava uma bolha: com as fixtures curtas isso não aparecia, com fala de
   * verdade o aluno veria a própria pergunta picada.
   */
  /** Alguma sessão desta aba já chegou a `ready` com a chave atual. Ver `chaveJaFuncionou`. */
  let chaveJaAbriuSessao = false;
  let rastreador = null;
  /** O turno LOCAL da fala em curso: o rastreador fala de turno dele, a tela fala do nosso. */
  let turnoDaFala = null;
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

  /**
   * Memória da aba (fase F4). Quem escreve nela é o MODELO, chamando `lembrar` — por isso ela
   * mora aqui, ao lado do despachante, e não dentro do contexto declarado pelo chamador.
   */
  const memoria = deps.memoria ?? criarMemoria();

  /** Diário da sessão. Um relatório = uma conexão: `connect()` zera. */
  const diag = deps.diagnostics ?? createDiagnostics();

  /** Histórico SÓ em memória. Morre com a aba — como a chave. */
  const messages = [];

  /**
   * O pedido de confirmação em aberto — hoje só `remover` cria um (F7, tarefa 3.4).
   *
   * Fica aqui, e não na interface, porque é a SESSÃO que precisa resolvê-lo quando a conexão
   * cai: uma ferramenta esperando um clique que nunca vem prenderia o turno para sempre.
   */
  let confirmacao = null;

  /**
   * Pergunta ao aluno e devolve a resposta dele. Quem decide é ele; este módulo só espera.
   *
   * ⚠ Um pedido por vez, e o segundo é RECUSADO em vez de enfileirado: duas perguntas de apagar
   * empilhadas na tela, respondidas fora de ordem, apagariam o elemento errado.
   */
  function pedirConfirmacao({ acao, alvo, versao }) {
    if (confirmacao) return Promise.resolve(false);
    return new Promise((resolve) => {
      confirmacao = { acao, alvo, versao, resolver: resolve };
      diag.record('tool', 'confirmacao-pedida', `${acao} ${alvo?.id ?? ''}`);
      publish();
    });
  }

  /** Resposta do aluno (ou da sessão caindo, que responde NÃO por ele). */
  function fecharConfirmacao(sim) {
    if (!confirmacao) return;
    const { resolver, acao, alvo } = confirmacao;
    confirmacao = null;
    diag.record('tool', sim ? 'confirmacao-dada' : 'confirmacao-recusada', `${acao} ${alvo?.id ?? ''}`);
    publish();
    try { resolver(Boolean(sim)); } catch { /* promessa já resolvida */ }
  }

/**
   * O estado da interface, num lugar SÓ.
   *
   * ⚠ Isto era duplicado: `publish()` montava um objeto e o `mount.js` montava outro, do zero,
   * ignorando o que recebia. Os testes liam o primeiro, a tela renderizava o segundo — então um
   * campo novo podia estar provado e invisível ao mesmo tempo. Foi o que aconteceu com o pedido
   * de confirmação do `remover`: campo publicado, testes verdes, nada na tela.
   */
  const vista = () => ({
    state, reason, mode, micOn, level,
    // A interface precisa do PEDIDO, nunca da função que o resolve.
    confirmacao: confirmacao ? { acao: confirmacao.acao, alvo: confirmacao.alvo } : null,
    /**
     * O agente pode mexer no desenho AQUI?
     *
     * ⚠ Sai da POLÍTICA, não da página: a linha de contrato no rodapé e o que o modelo de fato
     * pode fazer nunca podem discordar. A linha dizia "ele lê o seu diagrama — não altera nada"
     * na mesma tela em que ele acabara de criar uma tarefa (visto no print do portão F7). Poder
     * sem contrato na tela é o aluno descobrindo por acidente.
     */
    podeEscrever: ferramentasPermitidas(contextoAtual()).some((f) => f.escreve),
    busy: state === 'connecting' || state === 'closing',
    canAsk: (state === 'ready' || state === 'listening' || state === 'speaking'),
    messages: messages.slice(),
  });

  const publish = () => onUpdate?.(vista());

  /**
   * O número deste turno na conversa. Turno novo da sessão ganha o próximo número; turno já
   * visto devolve o mesmo de antes — é isso que faz a bolha ser reencontrada.
   */
  function turnoLocal(nDaSessao) {
    if (nDaSessao === null || nDaSessao === undefined) return turnSeq;
    if (!turnoDaSessao.has(nDaSessao)) turnoDaSessao.set(nDaSessao, ++turnSeq);
    return turnoDaSessao.get(nDaSessao);
  }

  /**
   * Barge-in decidido AQUI: o aluno falou por cima, então o que está na fila morre agora, sem
   * esperar o `interrupted` voltar do servidor. A decisão é do detector (puro, em `live/audio.js`);
   * este lugar só age.
   */
  function bargeInLocal(rms) {
    if (!detectorDeFala.quadro(rms)) return false;
    speaker?.flush();
    diag.state('barge-in-local', `rms=${rms.toFixed(4)}`);
    return true;
  }

  /**
   * Fecha a fala do aluno — e SÓ por sinal do servidor: primeiro áudio do modelo, primeira legenda
   * de saída, ou turno fechado. Idempotente: o segundo sinal do mesmo turno não faz nada.
   */
  function fecharFala(motivo) {
    if (!rastreador?.estaFalando) return;
    rastreador.fecharFala(motivo);
    rastreador.abrirTurno();
  }

  /**
   * Tira a bolha de ESPERA ("pensando…") que nunca virou resposta.
   *
   * Pendurada para sempre é pior que erro nenhum: o aluno fica esperando algo que não vem. Some
   * em todo caminho que termina sem texto — turno vazio, legenda só de marcador, falha de serviço.
   */
  function tirarEspera(n = null) {
    const alvo = n == null
      ? messages.filter((m) => m.role === 'assistant' && m.rodando).at(-1)
      : bolhaDoTurno(n);
    if (!alvo?.rodando) return false;
    messages.splice(messages.indexOf(alvo), 1);
    publish();
    return true;
  }

  /** A bolha de FALA do aluno daquele turno, se já existir. É ela que cresce a cada pedaço. */
  function falaDoTurno(n) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].via === 'voz' && messages[i].turn === n) return messages[i];
    }
    return null;
  }

  /** A bolha do assistente DAQUELE turno, se já existir. */
  function bolhaDoTurno(n) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].turn === n) return messages[i];
    }
    return null;
  }

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
    micOn = false; level = 0;

    if (relogioDeSom) { clearInterval(relogioDeSom); relogioDeSom = null; }
    // ⚠ Confirmação em aberto na hora de fechar vira NÃO. A promessa tem de resolver: uma
    // ferramenta esperando um clique que não vem mais prende o turno até o teto, e o aluno vê o
    // ajudante "pensando" para sempre. Fechar é a resposta segura — ninguém apaga nada.
    fecharConfirmacao(false);

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
      // O que o modelo mandou guardar + o que o chamador declarou (teste e bateria).
      memoria: [...memoria.paraOPrompt, ...(contexto.memoria ?? [])],
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

  /**
   * O despachante desta sessão. Os executores são locais à aba — não há servidor nosso para
   * falar, e não vai haver (design: MCP está fora enquanto não existir backend).
   *
   * ⚠ `permitida` é default-deny: nome fora do catálogo não executa e volta como erro NOMEADO.
   * O que decide CHAMAR é o modelo; o que decide DEIXAR é esta política.
   */
  function criarDespachante() {
    return createToolDispatcher({
      // ⚠ A política é consultada A CADA CHAMADA, com o contexto de AGORA. Guardar o resultado
      // na abertura da sessão faria uma declaração velha valer como autorização depois que o
      // contexto mudou — e é exatamente assim que uma ferramenta de escrita acabaria rodando
      // numa página que só lê.
      permitido: (nome) => permitida(nome, contextoAtual()),
      onEvent: (src, kind, detail) => diag.record(src, kind, detail),
      // O aluno PRECISA ver o que foi consultado — a resposta sozinha não diz de onde veio.
      onAtividade: ({ nome, fase, entrada, resultado }) => {
        if (fase === 'inicio') {
          // `push` carimba id e hora como em qualquer mensagem — a linha da ferramenta é uma
          // mensagem da conversa, não um enfeite paralelo.
          estadoAntesDaFerramenta = state;
          atividade = push({ role: 'tool', text: linhaDeInicio(nome), rodando: true, turn: turnSeq });
          // Estado próprio: 'pronto' durante uma busca é mentira, e 'falando' também.
          setState('tool', nome);
          return;
        }
        if (atividade) {
          atividade.text = linhaDeFim(nome, entrada, resultado);
          atividade.rodando = false;
          atividade = null;
        }
        // Devolve o estado de onde veio. Sem isto o selo fica preso em "consultando" depois de a
        // ferramenta terminar — e selo preso é pior que selo nenhum: mente com confiança.
        if (state === 'tool') setState(micOn ? 'listening' : (estadoAntesDaFerramenta ?? 'ready'));
        publish();
      },
      executores: {
        lembrar: async ({ categoria, texto }) => {
          const r = memoria.lembrar({ categoria, texto, turno: turnSeq });
          // Erro de uso volta ao modelo com o nome do problema e as categorias aceitas: é assim
          // que ele corrige a chamada em vez de repetir a mesma.
          if (!r.ok) throw new Error(`${r.erro}${r.aceitas ? ` (use: ${r.aceitas.join(', ')})` : ''}`);
          publish();
          return { guardado: true, categoria, total: memoria.total };
        },
        // As ferramentas de leitura falam com a camada fina do bpmn-js, não com o contexto: é
        // justamente varrer o REGISTRO INTEIRO que as distingue da amostra que já viaja a cada
        // turno (design H13 + T6).
        ...criarExecutoresDeLeitura({ acesso: deps.acesso, lerSimulacao: deps.lerSimulacao }),
        // As que ESCREVEM (F7). A política já as esconde numa página que só lê; a camada fina
        // recusa de novo se a declaração vazar de uma sessão anterior.
        ...criarExecutoresDeEscrita({ acesso: deps.acesso, pedirConfirmacao }),
      },
      // `remover` espera uma pessoa decidir. Dois minutos é tempo de ler e clicar; o relógio do
      // turno fica pausado enquanto isso.
      tetosPorFerramenta: { remover: 120000 },
    });
  }

  function openSession(targetMode) {
    const apiKey = credentials.use();
    const ctxInicial = contextoAtual(targetMode);
    // Sessão nova numera do 1 de novo: o mapa não pode atravessar.
    turnoDaSessao = new Map();
    legendaCruaDoTurno = new Map();
    rastreador = new RastreadorDeTurnos({
      // Provisório ATUALIZA a mesma bolha; final apenas a fecha — a bolha já está certa.
      onFala: ({ tipo, texto }) => {
        if (turnoDaFala == null) return;
        const bolha = falaDoTurno(turnoDaFala);
        if (bolha) { bolha.text = texto; bolha.parcial = tipo !== EventoDeFala.Final; }
        else push({ role: 'user', text: texto, via: 'voz', turn: turnoDaFala, parcial: tipo !== EventoDeFala.Final });
        publish();
      },
    });
    session = sessionFactory({
      apiKey,
      dispatcher: criarDespachante(),
      // A sessão sozinha não sabe se a chave já funcionou ANTES dela; quem sabe é a aba.
      chaveJaFuncionou: () => chaveJaAbriuSessao,
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
        chaveJaAbriuSessao = true;
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
        // Mesma razão: erro com a bolha de espera na tela deixa duas mensagens contraditórias.
        tirarEspera();
        note(`não deu: ${describeError(r)}`, 'error');
        // Chave recusada tem conserto, e o conserto é do aluno: dizer o que fazer vale mais que
        // repetir o código do erro.
        if (r === 'bad-key') {
          note('confira a chave em aistudio.google.com e informe de novo em "Usar esta chave".', 'error');
        }
      },
      onEvent: (src, kind, detail) => diag.record(src, kind, detail),
      onLog: (m) => { if (deps.debug) note(m, 'debug'); },
      onText: ({ text: cru, fallback, complete, vazio, turno }) => {
        if (complete) fecharFala('turno fechado');
        // Turno que terminou sem nada utilizável: diga isso, em vez de deixar a tela muda.
        if (vazio) {
          // ⚠ Tirar a bolha de espera ANTES de avisar: "pensando…" pendurado para sempre é pior
          // que erro nenhum — some com o aviso e deixa o aluno esperando uma resposta que não vem.
          tirarEspera(turnoLocal(turno));
          note('o modelo encerrou o turno sem responder. Pergunte de novo, por favor.', 'error');
          return;
        }
        // ⚠ Na VOZ a legenda já foi aparecendo durante o turno, então o fechamento é repetição.
        // No TEXTO ela foi filtrada de propósito (ver `onTranscript`), e este é o único lugar
        // onde um turno respondido só com fala vira bolha. Ignorar aqui também deixava o aluno
        // sem resposta nenhuma — o que é pior que uma resposta feia.
        if (complete && fallback && mode === 'voz') return;
        const text = fallback ? limparLegenda(cru).trim() : cru;
        // ⚠ FALLBACK QUE LIMPA ATÉ NÃO SOBRAR NADA TAMBÉM É TURNO VAZIO — e precisa DIZER isso.
        //
        // Este era o buraco do portão F3: no modo texto o modelo às vezes fecha com um turno de
        // áudio sem fala, cuja legenda é só `<no speech>`/`{pause}`. O turno não era `vazio` (ele
        // tinha `spoken`), então caía aqui; o filtro limpava tudo, o `return` calado saía, e o
        // aluno ficava vendo a própria pergunta até o relógio de 45 s dizer "o servidor não
        // respondeu" — o que é falso: o servidor respondeu, só não tinha o que mostrar.
        if (!text) {
          if (complete) {
            tirarEspera(turnoLocal(turno));
            note('o modelo encerrou o turno sem responder. Pergunte de novo, por favor.', 'error');
          }
          return;
        }
        // ⚠ A bolha é procurada pelo TURNO, não por "qual era o turno atual". Texto atrasado do
        // turno anterior volta para a bolha dele; sem isto, virava bolha nova carimbada com o
        // turno recém-aberto e lida como resposta da pergunta nova (T9).
        const n = turnoLocal(turno);
        const bolha = bolhaDoTurno(n);
        if (bolha) {
          bolha.text = text;
          bolha.rodando = false;
          // O turno FECHOU: quem lê não precisa adivinhar pelo texto ter parado de mudar. Uma
          // pausa do modelo no meio da frase é indistinguível do fim, e foi assim que o portão F6
          // leu "Sim, o elemento" como resposta inteira (2026-11-14).
          bolha.completa = Boolean(complete);
          bolha.fallback = Boolean(fallback);
          publish();
        } else {
          push({ role: 'assistant', text, fallback: Boolean(fallback), completa: Boolean(complete), turn: n });
        }
      },
      onTranscript: ({ side, text, turno }) => {
        if (!text) return;
        if (side === 'input') {
          // Houve fala de verdade: o que veio antes não era laço de eco.
          interrupcoesSeguidas = 0;
          // ⚠ UM pedaço não é uma pergunta. O rastreador junta os pedaços numa fala só e a bolha
          // CRESCE; quem fecha é sinal do servidor, nunca um relógio nosso.
          turnoDaFala = turnoLocal(turno);
          rastreador?.fragmentoDeEntrada(text);
          return;
        }
        // A primeira saída do modelo é o servidor dizendo que o aluno parou de falar.
        fecharFala('o modelo começou a responder');
        // ⚠ Legenda é coisa do modo VOZ. No modo texto a resposta vem pelos argumentos de
        // `entregar_resposta`, e a legenda que chega junto é de um turno de áudio que o modelo
        // às vezes emite mesmo assim — vazio, transcrito como `<no speech>` ou `{pause}`. Isso
        // colava na bolha do aluno: *"9<no speech>{pause}"* (visto no portão F3, 2026-11-13).
        // Turno de texto que termine sem entrega ainda tem fallback: `endTurn` usa o falado.
        if (mode !== 'voz') return;
        // Legenda da fala: um turno, uma bolha que cresce — sem as marcas de não-fala.
        //
        // ⚠ Filtra o ACUMULADO, não o pedaço: `<no speech>` partido entre dois pedaços não casa
        // com o filtro em nenhum dos dois, e o rabo vira bolha (dívida T10, portão F6). Por isso
        // a bolha é ATRIBUÍDA, e não concatenada — o texto visível é função do turno inteiro.
        const n = turnoLocal(turno);
        const cru = (legendaCruaDoTurno.get(n) ?? '') + text;
        legendaCruaDoTurno.set(n, cru);
        const visivel = legendaVisivel(cru);
        if (!visivel.trim()) return;
        const bolha = bolhaDoTurno(n);
        if (bolha) {
          bolha.text = visivel;
          publish();
        } else {
          push({ role: 'assistant', text: visivel, fallback: true, turn: n });
        }
      },
      onAudio: async (b64) => {
        fecharFala('áudio do modelo');
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
    /** A mesma vista que `onUpdate` entrega — para quem precisa dela sem esperar um evento. */
    get vista() { return vista(); },
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

    /** O que o modelo mandou guardar nesta aba. Só leitura — escrever é pela ferramenta. */
    get memoria() { return memoria.estado; },

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
      // O que mudou na tela vai JUNTO com a pergunta, no mesmo frame: perguntar "o que é isto?"
      // com a seleção chegando em outro frame é perguntar sobre o elemento anterior — e foi
      // exatamente o que aconteceu ao vivo até 2026-11-13.
      const delta = calcularDelta();
      if (delta) diag.state('contexto', `com a pergunta, delta=${delta.length}b`);
      // A sessão devolve a identidade do turno; o mapa dá o número desta conversa. Pergunta e
      // resposta passam a carregar o MESMO número, que é o que permite casar uma com a outra.
      // Sessao que nao devolve identidade (duble antigo, implementacao futura) ainda conta um
      // turno: o numero e nosso, e perder a contagem quebraria desde o aviso de troca de modo
      // ate a origem do que o modelo mandar guardar.
      const daSessao = session.ask(q, delta);
      const n = (daSessao === undefined || daSessao === null) ? ++turnSeq : turnoLocal(daSessao);
      push({ role: 'user', text: q, via: 'texto', turn: n });
      // Entre a pergunta e a resposta não havia NADA na tela, e a resposta leva segundos: o aluno
      // ficava olhando a própria pergunta sem saber se mandou mesmo. A bolha de espera é a mesma
      // que a resposta vai ocupar — `bolhaDoTurno` a encontra pelo turno e escreve por cima.
      push({ role: 'assistant', text: 'pensando…', rodando: true, turn: n });
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
        // Abrir o microfone é começar um turno: o estado da tela tem de chegar antes da fala.
        atualizarContexto();
        diag.mic('open');
        mic = await capture({
          onFrame: (b64, _n, rms) => {
            // ⚠ BARGE-IN LOCAL (H4). O aluno falando por cima derruba o que está na fila AQUI, sem
            // esperar o `interrupted` voltar do servidor. Dois ganhos: a fala dele para de ser
            // atropelada na hora, e o teste deixa de depender do VAD do outro lado.
            //
            // O servidor continua mandando `interrupted`, e continua sendo tratado — isto é um
            // SOMADO, não um substituto: quem só confia no local erra quando o microfone está
            // baixo, quem só confia no remoto espera a ida e volta.
            if (state === 'speaking') bargeInLocal(rms);
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
     * Fecha o microfone e AVISA o fim da fala.
     *
     * ⚠ O aviso não é o que destrava a transcrição (a de 2026-11-10 dizia que sim; a de
     * 2026-11-13 falsificou) — é o fim de fala explícito, que não depende do VAD do servidor.
     */
    async stopMic() {
      detectorDeFala.reiniciar();
      return fecharMicrofone('aluno parou de falar');
    },

    /**
     * INJETA fala na sessão, quadro a quadro, sem passar pelo microfone.
     *
     * Por que existe (H11, colhido da cápsula, que tem isto como modo `inject`): o cenário de voz
     * dependia do microfone falso do navegador, e foi exatamente aí que a dívida M6 nasceu — o
     * Chromium recusava a fixture e trocava por um tom sintético **sem avisar**, três dias lidos
     * como "o servidor está mudo". Injetando, o navegador sai da conta: o que sobe é o PCM que o
     * chamador escolheu, no ritmo que ele escolheu.
     *
     * ⚠ NÃO substitui a captura. O produto real usa microfone de verdade, e uma suíte que só injeta
     * não sabe se a captura quebrou — por isso um cenário e o `tools/provar-captura.mjs` continuam
     * no caminho real. Isto é diagnóstico de harness, não caminho de aluno.
     */
    async injetarFala(quadrosBase64, { intervaloMs = 40 } = {}) {
      if (!session) return { ok: false, motivo: 'sem sessão' };
      if (mode !== 'voz') return { ok: false, motivo: 'injeção só no modo voz' };
      if (!Array.isArray(quadrosBase64) || !quadrosBase64.length) {
        return { ok: false, motivo: 'sem quadros' };
      }
      diag.state('injetar', `quadros=${quadrosBase64.length}`);
      let enviados = 0;
      for (const quadro of quadrosBase64) {
        session.pushAudio(quadro);
        enviados++;
        // Ritmo REAL: despejar tudo de uma vez mede outra coisa. 40 ms é o quadro do worklet.
        await new Promise((r) => setTimeout(r, intervaloMs));
      }
      return { ok: true, quadros: enviados };
    },

    /**
     * A resposta do aluno ao pedido de confirmação (F7, tarefa 3.4).
     *
     * ⚠ A interface chama isto; ela NUNCA executa a remoção. Quem remove é a ferramenta, depois
     * de a promessa resolver — é esse caminho único que garante a checagem de versão do diagrama
     * (H14) valer para todo clique.
     */
    confirmar(sim) {
      fecharConfirmacao(sim);
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
      chaveJaAbriuSessao = false;
      await this.stop();
      credentials.clear();
      note('chave removida desta aba.', 'info');
    },
  };

  return api;
}
