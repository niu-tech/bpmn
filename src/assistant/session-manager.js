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
import { portaoDaFerramenta } from './agent/catalog.js';
import {
  avisoDeCitacaoNaVoz, candidatosDoResultado, fontesDoResultado, linhaDeFim, linhaDeInicio,
  mostraveisDoResultado,
} from './tools/apresentador.js';
import { montarQuadro, quadroDelta } from './agent/frame.js';
import { criarMemoria } from './agent/memory.js';
import { criarExecutoresDeLeitura } from './tools/leitura.js';
import { criarExecutoresDeEscrita } from './tools/escrita.js';
import { promptDoPerfil } from './agent/render.js';
import { resolverContexto } from './agent/resolve.js';
import { startCapture, startPlayback, criarDetectorDeFala } from './live/audio.js';
import { createSession } from './live/session.js';
import { EventoDeFala, RastreadorDeTurnos } from './live/turn-tracker.js';
import { criarExecutorDeNorma } from './tools/norma.js';
import { conferirCitacoes } from './knowledge/citacao.js';
import { redact } from './live/redact.js';
import { createDiagnostics } from './diagnostics.js';

export const MODES = /** @type {const} */ (['texto', 'voz']);

/** Rótulos para a UI. Estado técnico vira frase curta em pt-BR. */
export const STATE_LABELS = {
  idle: 'desligado',
  // DORMINDO: sem socket por inatividade, mas a conversa continua — a próxima pergunta acorda.
  dormindo: 'em espera',
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
  // ⚠ É ADMISSÃO, e não a aula: o servidor recusa ABRIR, e a sessão que já está aberta segue.
  //
  // O que medimos em 2026-11-15 (`tools/medir-cota.mjs`): seis sessões abertas em sequência sem
  // pausa nenhuma passam, e quatro ao mesmo tempo passam. Então 1011/1008 **não** é cadência e
  // **não** é a conversa longa — é vaga de sessão: o Google limita quantas Live cabem de uma vez
  // por projeto, e a vaga de um fio que cai sem o quadro de fecho leva um tempo para voltar. Por
  // isso a recusa some sozinha em segundos, e por isso o conserto do dia foi no harness (fechar
  // antes de matar o navegador), não no produto.
  //
  // O rótulo não fala em minuto: não sabemos o número, e o Google não publica o das Live. Fala o
  // que o aluno pode fazer — esperar e começar de novo — e nunca manda trocar a chave, que é
  // onde isto já nos fez perder um dia.
  quota: 'o limite de sessões da sua chave foi atingido — espere alguns segundos e comece de novo',
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

  /* ---------------------------------------------------------------- portões de confirmação
   *
   * Change `spoken-confirmation-gates`. Uma ação que exige o aluno fica recusada até ele falar ou
   * digitar **depois** de a pergunta ter sido feita. O que se mede é ORDEM, nunca conteúdo:
   *
   *  - olhar o texto ("tem 'sim'?") seria classificação por palavra-chave, proibida pela
   *    constituição §III — e erraria em "sim, mas antes me explica";
   *  - acreditar no modelo ("o aluno confirmou") é aceitar a narração no lugar do fato, que é
   *    justamente o que `nada_mudou` existe para não fazer.
   *
   * A época sobe com o ALUNO e só com ele: nota da página, clique em candidato e fala do modelo
   * não contam. */

  /**
   * OS DOIS MUDOS (pedido do dono, 2026-11-15, testando com gente falando perto):
   *
   *  - `micMudo`: o microfone DELE. Numa sala com conversa ao lado, qualquer voz interrompe o
   *    agente — a escuta contínua é o que permite cortar falando por cima, e numa mesa cheia
   *    isso vira corte sem querer. Mudo fecha a captura e **segura o automático**, senão o
   *    microfone reabre sozinho no fim do turno e desfaz o gesto dele.
   *  - `agenteMudo`: a VOZ do agente. *"às vezes a gente quer que ele responda só por texto,
   *    sendo que a gente está na versão live"* — a legenda já chega por `outputTranscription`,
   *    então calar é só não tocar o áudio. A sessão continua de voz: ele fala, o agente escreve.
   *
   * Nenhum dos dois encerra sessão: trocar de modo abriria outra, e vaga de sessão é o recurso
   * escasso.
   */
  let micMudo = false;
  let agenteMudo = false;
  /**
   * As chaves de citação que o acervo JÁ SERVIU nesta sessão (K6).
   *
   * ⚠ É o conjunto contra o qual a resposta é conferida: marca que nenhuma consulta devolveu
   * vira "[fonte não conferida]" antes de aparecer. Prompt pede; código impede.
   */
  const chavesServidas = new Set();
  /**
   * AS FONTES SERVIDAS DESDE QUE O ALUNO FALOU — e é isto que torna a citação conferivel na VOZ.
   *
   * ⚠ No texto dá para conferir a marca `[fonte:*]` que o modelo escreve. Na voz ele não
   * escreve: ele fala, e dizer "abre colchete fonte dois pontos gateways" em voz alta seria
   * pior que não citar. Então a proveniência na voz não sai do que ele diz — sai do que NÓS
   * servimos, que é registro nosso, e a tela a mostra com o localizador do acervo ("Gateways
   * › exclusivo (XOR)"), nunca a chave crua.
   *
   * ⚠ NÃO indexada por turno, e o portão do navegador é quem mostrou por quê: na voz o turno
   * da RESPOSTA falada nem sempre é o da pergunta (o servidor fecha o turno da fala e abre
   * outro para o áudio), então uma tabela por turno casava na bancada e falhava na tela. O
   * recorte certo é conversacional, não aritmético: **o que foi consultado desde que o aluno
   * falou** é exatamente a proveniência da resposta que ele está ouvindo.
   */
  let fontesDaVez = [];
  /** Nova fala (ou nova pergunta digitada): a proveniência da anterior morre com ela. */
  const zerarFontes = () => { fontesDaVez = []; };
  const guardarFontes = (fontes) => {
    const vistas = new Set(fontesDaVez.map((f) => f.chave));
    fontesDaVez = [...fontesDaVez, ...fontes.filter((f) => !vistas.has(f.chave))];
  };
  /**
   * O relógio que transforma UMA PAUSA DELE em "pensando…".
   *
   * ⚠ Em escuta contínua nada fecha quando o aluno para de falar: o microfone fica aberto, e o
   * único "fim de fala" que existe é o do servidor — que chega JUNTO com a resposta, ou seja,
   * quando a espera acabou. Era por isso que a tela ficava idêntica enquanto ele esperava, e o
   * dono relatou a mesma coisa duas rodadas seguidas (*"quando eu falo para apagar a tarefa, não
   * tem nenhuma resposta visual"*). A pausa na transcrição é o sinal que temos ANTES disso.
   */
  let relogioDeEspera = null;
  const PAUSA_PARA_ESPERAR_MS = 900;
  /**
   * O aluno MANDOU ÁUDIO desde a última vez que um turno fechou?
   *
   * ⚠ É a única pista de que existiu uma pergunta quando a queda chega ANTES da transcrição.
   * Na sessão do dono (2026-11-15) o turno 8 sumiu inteiro entre dois turnos numerados: ele
   * falou, o fio morreu antes de o servidor devolver uma sílaba, e a tela não tinha **nada** —
   * nem bolha, nem aviso. A conversa seguiu como se ele não tivesse falado, e a reconexão ainda
   * disse "pode continuar", porque não havia pergunta pendente para encontrar.
   */
  let falouSemResposta = false;

  /** Quantas vezes o aluno falou ou digitou nesta aba. */
  let epocaDoAluno = 0;
  /** O turno falado que já foi contado — a legenda chega em pedaços, e o aluno falou uma vez. */
  let turnoFaladoContado = null;
  /** portão -> `{ perguntou, aberto }`: a época em que a pergunta apareceu e se o aluno respondeu. */
  const portoes = new Map();

  /**
   * Quanto se espera pela resposta do aluno antes de recusar.
   *
   * ⚠ Não é generosidade: a legenda FINAL do que ele falou chega depois de o modelo já ter
   * chamado a ferramenta. Sem esta espera, ele diz "pode apagar", ouve "você ainda não confirmou"
   * e repete — a pior experiência possível, por meio segundo. Medido nos dois produtos que rodam
   * este modelo.
   */
  const TOLERANCIA_DE_FALA_MS = Number.isFinite(deps.toleranciaDeConfirmacaoMs)
    ? deps.toleranciaDeConfirmacaoMs
    : 3500;

  function alunoFalou() {
    epocaDoAluno++;
    // A vez é dele: o fato que a página ia contar morre aqui, e não espera a próxima brecha.
    if (notaDaPagina) descartarNota('o aluno falou primeiro');
  }

  /**
   * O aluno respondeu A ESTA pergunta?
   *
   * ⚠ A janela é a **próxima** fala dele, e não "qualquer uma depois" (`> p.perguntou`). O que
   * havia aqui deixava a marca pendente viva para sempre: numa conversa longa, uma recusa de
   * `remover` às 2 min 30 era aberta por algo que o aluno digitasse dez minutos depois, sobre
   * outro assunto — mina armada, e o agente apagava sem perguntar de novo. Visto na corrida ao
   * vivo das 33 perguntas de 2026-11-15, que foi a primeira a rodar numa sessão só (antes cada
   * pergunta tinha a sua, e a marca morria com a aba).
   *
   * Com a janela de uma fala, passado o momento a marca não vale mais: a ferramenta é recusada
   * de novo e o agente **pergunta outra vez**, que é o pior que pode acontecer aqui. Continua sem
   * olhar o TEXTO da resposta — é ordem, nunca palavra-chave (constituição §III: determinismo
   * perto de ferramenta serve para segurança, e "sim, mas antes me explica" nunca foi sim).
   */
  function portaoRespondido(nome) {
    const p = portoes.get(nome);
    return !!p && (p.aberto || epocaDoAluno === p.perguntou + 1);
  }

  /**
   * Esquece os portões pendentes. **Diagnóstico**, e existe porque a corrida ao vivo passou a
   * usar uma sessão só para o lote: o estado que a aba nova dava de graça precisa ser pedido.
   * Sem isto, a pergunta que mede "a recusa acontece" deixa a marca para a pergunta seguinte,
   * e a seguinte mede outra coisa.
   */
  function limparPortoes() {
    const quantos = portoes.size;
    portoes.clear();
    if (quantos) diag.state('portao', `${quantos} pendente(s) esquecido(s) por pedido`);
    return quantos;
  }

  function abrir(nome, motivo) {
    portoes.set(nome, { perguntou: epocaDoAluno, aberto: true });
    diag.state('portao', `${nome}: ${motivo}`);
    return true;
  }

  /**
   * O portão desta ação está aberto? Abre SÓ com fala ou digitação posterior à pergunta, e **é
   * consumido** quando abre: um "sim" autoriza uma ação, não todas as próximas.
   */
  async function esperarPortao(nome, { tolerancia = TOLERANCIA_DE_FALA_MS, passo = 120 } = {}) {
    if (portaoRespondido(nome)) return abrir(nome, 'aberto pelo aluno');

    /**
     * A pergunta é REFEITA, e a marca velha não é herdada.
     *
     * ⚠ Isto era `if (!portoes.has(nome))`, e a diferença é a mina: a marca de uma recusa
     * antiga ficava com a época ANTIGA, e ou autorizava algo que o aluno não respondeu (quando a
     * janela calhava de bater) ou nunca mais abria (quando ele já tinha falado duas vezes), e o
     * agente perguntava para sempre sem conseguir apagar. Tentativa nova = janela nova.
     */
    portoes.set(nome, { perguntou: epocaDoAluno, aberto: false });
    diag.state('portao', `${nome}: perguntado, esperando o aluno`);

    const fim = Date.now() + Math.max(0, tolerancia);
    while (Date.now() < fim) {
      await new Promise((r) => setTimeout(r, passo));
      if (portaoRespondido(nome)) return abrir(nome, 'aberto pelo aluno (legenda atrasada)');
    }

    return false;
  }

  /**
   * O portão já aberto, sem esperar — é o que faz `remover` não perguntar com um botão o que o
   * aluno acabou de responder falando.
   *
   * ⚠ CONSOME: um "sim" autoriza UMA ação, não todas as próximas da conversa. Quem lê aqui é o
   * executor, depois de o despachante já ter esperado — por isso a espera não pode consumir.
   */
  function portaoAberto(nome) {
    const p = portoes.get(nome);
    if (!p?.aberto) return false;
    portoes.delete(nome);
    return true;
  }

  /* ---------------------------------------------------------------- o canal da página
   *
   * Change `close-the-loop-with-the-canvas`. O aluno age no canvas (clica, importa, dá Ctrl+Z) e
   * a conversa seguia cega: o contexto só era recalculado na borda do turno seguinte, então ele
   * dizia "e esse aqui?" e ouvia sobre o elemento anterior.
   *
   * Três regras, e as três existem por causa de um defeito previsível:
   *
   *  - **marca obrigatória.** O texto sai sempre com `(da página)` e a marca é posta AQUI, não
   *    por quem chama: uma nota que chegue ao modelo sem marca é indistinguível de fala do aluno,
   *    e aí a conversa mente sobre quem disse o quê.
   *  - **a vez é do aluno.** Fila de UM, e ela morre se ele falar antes de sair. Mandar na hora
   *    faria o agente passar por cima da fala dele — a mesma reclamação que já consertamos no
   *    áudio, repetida na conversa.
   *  - **fato velho não vira pergunta.** Prazo declarado: uma seleção de um minuto atrás,
   *    contada agora, chega como pergunta fora de hora.
   *
   * ⚠ Vai por `enviarContexto` (par user+model FECHADO), e não por `ask`: a nota é informação que
   * o modelo passa a ter, nunca um turno pedindo resposta. Sugestão proativa é outra decisão
   * (E2/F8b) e precisa do portão de confirmação — aqui a página só CONTA. */

  /** A marca que faz a nota ser nota. Vive num lugar só, e o prompt fala dela. */
  const MARCA_DA_PAGINA = '(da página)';

  /** Prazo da nota pendente. Passou disto, o fato é velho e não vale um turno de contexto. */
  const PRAZO_DA_NOTA_MS = 45000;

  /** `{ texto, epoca, ate }` — uma por vez; a nova substitui a velha. */
  let notaDaPagina = null;

  function descartarNota(motivo) {
    if (!notaDaPagina) return false;
    const texto = notaDaPagina.texto;
    notaDaPagina = null;
    diag.record('pagina', 'descartou', `${motivo}: ${texto.slice(0, 60)}`);
    return true;
  }

  /** O modelo está calado e sem turno aberto? É a única hora em que a nota pode sair. */
  const momentoCalado = () => Boolean(session) && state === 'ready';

  function escoarNota() {
    if (!notaDaPagina) return false;
    if (notaDaPagina.epoca !== epocaDoAluno) return descartarNota('o aluno falou primeiro') && false;
    if (Date.now() > notaDaPagina.ate) return descartarNota('passou do prazo') && false;
    if (!momentoCalado()) return false;

    const { texto } = notaDaPagina;
    notaDaPagina = null;
    const foi = session.enviarContexto(texto);
    diag.record('pagina', foi ? 'enviou' : 'recusado', texto.slice(0, 80));
    // A bolha é NOTA DE SISTEMA. Nunca bolha de aluno: ele não disse isso.
    if (foi) note(texto, 'pagina');
    return foi;
  }

  function anunciarNaPagina(frase) {
    const t = String(frase ?? '').trim();
    if (!t) return false;
    if (!session) return false;                 // sem sessão não há a quem contar
    const texto = t.startsWith(MARCA_DA_PAGINA) ? t : `${MARCA_DA_PAGINA} ${t}`;
    notaDaPagina = { texto, epoca: epocaDoAluno, ate: Date.now() + PRAZO_DA_NOTA_MS };
    diag.record('pagina', 'enfileirou', texto.slice(0, 80));
    escoarNota();
    return true;
  }

  /* ---------------------------------------------------------------- teto de sessão
   *
   * Change `sustain-a-class-session`, tarefa 2. A sessão Live cobra enquanto existe, não enquanto
   * é usada: uma aba esquecida aberta depois da aula continua consumindo a cota DO ALUNO — e a
   * chave é dele, com cobrança na conta dele (é todo o contrato BYOK deste produto). Quem deixa
   * a aba aberta não é descuidado; é alguém que foi almoçar.
   *
   * O teto é por TEMPO DE SESSÃO e não por inatividade de propósito: medir inatividade exigiria
   * decidir o que conta como atividade (o aluno lendo a resposta está ativo?), e errar isso
   * derruba a sessão de quem está no meio de um raciocínio. Tempo total é grosseiro e honesto.
   *
   * 25 minutos: mais que uma explicação longa com idas e voltas, menos que uma aula inteira
   * esquecida. Ao encostar, a sessão ENCERRA com motivo nomeado e a tela diz como recomeçar —
   * em vez de morrer calada e o aluno descobrir pela cota. */

  /** Quanto uma sessão pode durar antes de o produto encerrá-la sozinho. */
  const TETO_DA_SESSAO_MS = Number.isFinite(deps.tetoDaSessaoMs) ? deps.tetoDaSessaoMs : 25 * 60 * 1000;
  let relogioDaSessao = null;

  function desarmarTetoDaSessao() {
    if (relogioDaSessao) { clearTimeout(relogioDaSessao); relogioDaSessao = null; }
  }

  function armarTetoDaSessao() {
    desarmarTetoDaSessao();
    if (!(TETO_DA_SESSAO_MS > 0)) return;
    relogioDaSessao = setTimeout(async () => {
      relogioDaSessao = null;
      if (state === 'idle') return;
      const minutos = Math.round(TETO_DA_SESSAO_MS / 60000);
      diag.state('teto-da-sessao', `${minutos} min`);
      await api.stop();
      // ⚠ A nota entra DEPOIS do `stop`: `teardown` não apaga a conversa, e é ela que o aluno vai
      // ler quando voltar. Sem explicação, "parou sozinho" vira "quebrou".
      note(
        `Encerrei a sessão depois de ${minutos} minutos para não gastar a sua cota com a aba `
        + 'aberta. A conversa continua aqui — clique em Começar para retomar.',
        'context-reset',
      );
    }, TETO_DA_SESSAO_MS);
    relogioDaSessao?.unref?.();
  }

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
    /**
     * ⚠ Um **NÃO explícito** desarma a marca pendente daquela ação.
     *
     * Sem isto, clicar "Cancelar" deixava o portão PRIMADO: a próxima fala do aluno abria a
     * marca que a recusa dele tinha deixado, e a ação destrutiva seguinte passava sem pergunta.
     * Dizer "não" nunca pode autorizar nada — e aqui não há adivinhação: o clique é o fato.
     *
     * ponytail: defensiva de uma linha. O diálogo com botão só aparece pelo caminho do EXECUTOR
     * direto (`pedirConfirmacao`), e não pelo despachante — que barra antes, pela ordem. Quem
     * exercita esse caminho é a camada determinística do acervo dourado.
     */
    if (!sim) portoes.delete(acao);
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
    // Os dois mudos: a tela precisa mostrar QUAL está ligado, senão o aluno acha que quebrou.
    micMudo, agenteMudo,
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
    // O botão de parar só existe enquanto há o que parar.
    falando: state === 'speaking' && !calado,
    busy: state === 'connecting' || state === 'closing',
    // `dormindo` também pergunta: a sessão dorme por inatividade e é o PRÓPRIO envio que a
    // acorda, retomando a mesma conversa. Sem isto, o fecho do servidor desligava a caixa de
    // texto na cara do aluno e o conserto do sono não chegava a ninguém (medido ao vivo:
    // o servidor fecha aos ~2 min de leitura, portão M4).
    canAsk: (state === 'ready' || state === 'listening' || state === 'speaking'
             || state === 'dormindo'),
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
  /**
   * O aluno mandou PARAR DE FALAR.
   *
   * ⚠ Esvaziar a fila não basta: o servidor continua mandando os quadros do resto da resposta, e
   * meio segundo depois a voz volta sozinha — o botão pareceria quebrado. Então o pedido vale
   * até o fim DESTE turno: o que chegar depois é descartado e contado.
   *
   * Não é interrupção de protocolo (o modelo não precisa saber que ninguém está ouvindo) nem
   * barge-in (ninguém falou por cima). É o aluno dizendo "chega" — e o silêncio é imediato.
   */
  let calado = false;

  function pararDeFalar() {
    if (!speaker) return false;
    calado = true;
    speaker.flush();
    diag.state('parar-de-falar', 'pedido do aluno');
    publish();
    return true;
  }

  /** Turno novo: o "chega" do turno anterior não cala a resposta seguinte. */
  function voltarAFalar(motivo) {
    if (!calado) return;
    calado = false;
    diag.state('volta-a-falar', motivo);
  }

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
    // A fala chegou ao servidor: deixou de ser uma pergunta perdida no caminho.
    falouSemResposta = false;
    if (!rastreador?.estaFalando) return;
    rastreador.fecharFala(motivo);
    /**
     * A ESPERA do turno FALADO — a mesma bolha "pensando…" que a pergunta digitada já tinha.
     *
     * ⚠ Faltava justamente no caminho em que a espera é mais longa: entre o aluno parar de
     * falar e a primeira palavra do agente cabem o transporte, a decisão do modelo e uma
     * ferramenta inteira. A tela ficava **idêntica** nesse intervalo, e o dono leu isso como o
     * produto parado: *"pareceu que ela não estava fazendo nada até ela fazer"* (2026-11-15,
     * sobre um apagar que funcionou). A bolha é a MESMA que a resposta vai ocupar: `bolhaDoTurno`
     * a encontra pelo turno e escreve por cima, e `tirarEspera` a remove se nada vier.
     */
    if (turnoDaFala != null && !bolhaDoTurno(turnoDaFala)) {
      push({ role: 'assistant', text: 'pensando…', rodando: true, turn: turnoDaFala });
    }
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

  /**
   * A pergunta que está esperando resposta AGORA, se houver.
   *
   * É a última bolha de assistente ainda "rodando" (o "pensando…") e a pergunta imediatamente
   * antes dela. Serve para a reconexão saber o que foi perdido na queda.
   */
  function perguntaSemResposta() {
    const espera = messages.filter((m) => m.role === 'assistant' && m.rodando).at(-1);
    if (!espera) return null;
    for (let i = messages.indexOf(espera) - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i];
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

  /**
   * Nota do sistema, sempre redigida: é por aqui que um erro com a URL do socket sairia.
   *
   * ⚠ **A MESMA nota não empilha.** Numa conversa longa a conexão cai várias vezes, e cada
   * queda escrevia outra cópia do mesmo recado — a tela virava uma coluna de "a conexão caiu e
   * voltou" por cima da conversa (dono, 2026-11-15: *"não precisava ficar a mesma mensagem
   * aparecendo inúmeras vezes e poluindo a tela"*). Repetir não informa: o que informa é que
   * aconteceu de novo, e isso cabe num contador.
   */
  function note(text, kind = 'info', { transitorio = false } = {}) {
    const limpo = redact(text);
    const ultima = messages.at(-1);
    if (ultima?.role === 'system' && ultima.kind === kind && ultima.baseTexto === limpo) {
      ultima.vezes = (ultima.vezes ?? 1) + 1;
      ultima.text = `${limpo} (${ultima.vezes}×)`;
      ultima.at = Date.now();
      publish();
      return ultima;
    }
    return push({ role: 'system', kind, text: limpo, baseTexto: limpo, transitorio });
  }

  /**
   * Apaga os avisos de CONEXÃO quando a conexão volta.
   *
   * ⚠ Relato do dono (2026-11-15), com dois prints lado a lado: o painel dizia **pronto** e o
   * recado vermelho de limite de sessão continuava lá, em cima da conversa. Aviso de conexão é
   * ESTADO, não conversa — estado que passou não fica na tela contando o que já não é verdade.
   * O que ele disse a respeito, inteiro: *"o erro ele continua e não era para eu ter que apertar
   * nada"*.
   *
   * Só o que foi marcado `transitorio` sai. Nada do que o aluno ou o agente disse é tocado.
   */
  function limparAvisosDeConexao() {
    const antes = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'system' && messages[i].transitorio) messages.splice(i, 1);
    }
    if (messages.length !== antes) publish();
    return antes - messages.length;
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
    desarmarTetoDaSessao();
    // ⚠ Confirmação em aberto na hora de fechar vira NÃO. A promessa tem de resolver: uma
    // ferramenta esperando um clique que não vem mais prende o turno até o teto, e o aluno vê o
    // ajudante "pensando" para sempre. Fechar é a resposta segura — ninguém apaga nada.
    fecharConfirmacao(false);
    // Nota pendente numa sessão que morreu não tem para quem ir — e ressuscitá-la na sessão
    // seguinte contaria um fato de outra conversa.
    descartarNota('a sessão encerrou');

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
    /**
     * A ESPERA COMEÇA QUANDO ELE PARA DE FALAR, e não quando o modelo começa a responder.
     *
     * ⚠ A bolha "pensando…" nascia em `fecharFala`, que roda no PRIMEIRO áudio do modelo —
     * ou seja, exatamente quando a espera acaba. Para quem olha a tela, ela nunca existiu: o
     * dono pediu para apagar e viu a mesma tela parada até a resposta chegar (2026-11-15, duas
     * vezes). Aqui é o gesto DELE: o microfone fechou com a fala dentro.
     */
    if (falouSemResposta && turnoDaFala != null && !bolhaDoTurno(turnoDaFala)) {
      push({ role: 'assistant', text: 'pensando…', rodando: true, turn: turnoDaFala });
    }
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
  /**
   * A vigia da saúde do som: um retrato a cada 3 s no diário.
   *
   * ⚠ Ela nascia na TROCA DE MODO, e por isso não existia numa sessão de texto — que é
   * justamente onde o dono ouviu a fala picotada (a resposta vem em áudio nos dois modos). O
   * portão lia `null` e passava: instrumento calado parecendo instrumento verde. Agora ela
   * começa junto do alto-falante, que é quem ela mede.
   */
  function vigiarSom() {
    if (relogioDeSom) clearInterval(relogioDeSom);
    speaker?.stats?.();                       // a primeira leitura não espera 3 s
    relogioDeSom = setInterval(() => {
      if (!speaker) return;
      speaker.stats?.();
    }, 3000);
    // ⚠ No Node (teste), um `setInterval` vivo SEGURA o processo: a suíte parou de terminar no
    // instante em que esta vigia passou a nascer com o alto-falante. No navegador `unref` não
    // existe, e o `?.` resolve. Relógio de diagnóstico não decide quando o programa acaba.
    relogioDeSom?.unref?.();
  }

  function ensureSpeaker() {
    if (speaker) return Promise.resolve(speaker);
    if (!speakerEmVoo) {
      speakerEmVoo = Promise.resolve(playbackFactory({
        /**
         * ⚠ A linha do diário sai AQUI, na resposta — não no relógio que pergunta.
         *
         * O relógio perguntava e lia `lastStats` no mesmo instante: na primeira volta a
         * resposta ainda não tinha chegado, e num turno curto não havia segunda volta. O
         * portão ao vivo lia `null` e eu quase tomei ausência de medida por medida boa.
         */
        onStats: (s) => {
          lastStats = s;
          diag.record('som', 'buffer',
          `ms=${s.bufferedMs} furos=${s.underflows} descartados=${s.overflowDropped}`,
          );
        },
      }))
        .then((s) => { speaker = s; speakerEmVoo = null; vigiarSom(); return s; })
        .catch((err) => { speakerEmVoo = null; throw err; });
    }
    return speakerEmVoo;
  }

  let lastStats = null;
  let speakerEmVoo = null;

  /**
   * GRAVACAO do que o modelo falou — diagnostico, desligada por padrao.
   *
   * Existe para a prova em VIDEO (change `prove-it-with-a-golden-set`, 5.1/5.2): sem o audio
   * recebido, o filme mostra a conversa acontecendo e NAO tem trilha sonora, e a banca ve bolhas
   * aparecendo sem ouvir o agente. Guarda o PCM como veio (base64, 24 kHz) com o carimbo de
   * tempo, que e' o que permite remontar a fala na linha do tempo real.
   *
   * ⚠ Nunca entra no diario nem em relatorio: o `tools/ledger.mjs` recusa audio e base64 por
   * regra, e esta gravacao morre com a aba.
   */
  let gravacaoDeAudio = null;
  /** Teto: ~4000 quadros e' mais do que qualquer prova precisa, e evita a aba crescer sem fim. */
  const MAX_QUADROS_GRAVADOS = 4000;

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
      // O que a ferramenta EXIGE está declarado no catálogo; se o aluno respondeu, quem sabe é a aba.
      portaoDe: (nome) => portaoDaFerramenta(nome),
      esperarPortao: (nome) => esperarPortao(nome),
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
          // + a assimetria da voz, quando ela importa (K6): ver `avisoDeCitacaoNaVoz`.
          atividade.text = linhaDeFim(nome, entrada, resultado) + avisoDeCitacaoNaVoz(nome, mode);
          atividade.rodando = false;
          /**
           * AMBIGUIDADE VIRA BOTÃO (change `close-the-loop-with-the-canvas`, tarefa 4).
           *
           * Os candidatos ficam na MENSAGEM da ferramenta, não num estado à parte do painel: eles
           * pertencem àquele momento da conversa. Uma lista num campo solto sobreviveria à
           * resposta seguinte, e o aluno clicaria num "em qual pool?" que já não está mais em pé.
           */
          const candidatos = candidatosDoResultado(nome, resultado);
          if (candidatos.length) atividade.candidatos = candidatos;
          /**
           * E O QUE DÁ PARA VER: o elemento que a ferramenta achou vira cartão clicável que
           * **seleciona no desenho** (harvest 6.4). Não fala com o modelo e não gasta cota —
           * é a resposta para *"onde fica isso?"*, que hoje o aluno só descobria procurando a
           * olho num diagrama de 47 elementos.
           */
          const mostraveis = mostraveisDoResultado(nome, resultado);
          if (mostraveis.length) atividade.mostraveis = mostraveis;
          /**
           * E A PROVENIÊNCIA: o que a consulta SERVIU, na bolha dela e guardado no turno.
           *
           * Na bolha porque é ali que o aluno está olhando quando a consulta termina; no turno
           * porque a resposta chega depois, e na voz ela é o único lugar onde a citação pode ser
           * conferida — o áudio já foi.
           */
          /**
           * ⚠ A proveniência vai na RESPOSTA, não aqui. A linha desta consulta já diz o
           * localizador no texto ("li 1 trecho do acervo — Gateways › exclusivo (XOR)"), e
           * repetir o mesmo rótulo num bloco colado embaixo dela seria a mesma informação duas
           * vezes em duas linhas seguidas. Quem precisa conferir está lendo a resposta.
           */
          const fontes = fontesDoResultado(nome, resultado);
          // Duas consultas antes da mesma resposta somam, sem repetir chave.
          if (fontes.length) guardarFontes(fontes);
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
        ...criarExecutoresDeEscrita({ acesso: deps.acesso, pedirConfirmacao, portaoAberto }),
        /**
         * O ACERVO (change `add-bpmn-norm-knowledge-base`). Cada chave servida entra em
         * `chavesServidas` — é contra esse conjunto que a resposta é conferida no modo texto (K6).
         */
        ...criarExecutorDeNorma({
          acervo: deps.acervo ?? null,
          aoServir: (chave) => chavesServidas.add(chave),
        }),
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
        /**
         * FIM DA FALA = começo da espera.
         *
         * ⚠ Em escuta contínua o microfone **não fecha** quando o aluno para de falar — então
         * pendurar a bolha de espera no fechamento do microfone só funcionava no modo
         * meia-duplex. Era por isso que o dono pedia para apagar e via a tela parada (duas
         * rodadas seguidas relatando a mesma coisa). Quem sabe que ele terminou é o servidor,
         * no FINAL da transcrição de entrada — e esse sinal chega aqui.
         */
        if (tipo === EventoDeFala.Final && !bolhaDoTurno(turnoDaFala)) {
          push({ role: 'assistant', text: 'pensando…', rodando: true, turn: turnoDaFala });
        }
        // Uma vez por TURNO falado: a legenda chega em pedaços, e quem conta é o aluno, não o pedaço.
        if (turnoFaladoContado !== turnoDaFala) {
          turnoFaladoContado = turnoDaFala;
          alunoFalou();
        }
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
      onSetupComplete: ({ reconectou, retomou, acordou }) => {
        chaveJaAbriuSessao = true;
        /**
         * DESPERTAR: a sessão dormia (fecho por inatividade) e a pergunta do aluno a reabriu. Nada
         * caiu, nada se perdeu — o frame dele está na fila e acabou de sair, com o contexto dentro
         * (o `ask` manda delta e pergunta no MESMO frame). Logo: nenhum aviso de queda, nenhuma
         * semeadura e nenhum reenvio — reenviar aqui mandaria a mesma pergunta duas vezes.
         */
        if (acordou) { diag.state('despertou', 'mesma sessão: histórico preservado no servidor'); return; }
        if (!reconectou) return;
        if (retomou) {
          /**
           * T17 — RETOMADA: do lado do servidor é a MESMA sessão, então o modelo não esqueceu.
           * Reenviar o histórico aqui duplicaria a conversa dentro do contexto dele (e pagaria
           * por isso em tokens). O que pode ter mudado enquanto o fio esteve fora é a **tela** —
           * é só o quadro do diagrama que vai.
           */
          const ctx = contextoAtual();
          contextoEnviado = null;
          const quadro = montarQuadro(ctx);
          if (quadro) { session.enviarContexto(quadro); contextoEnviado = ctx; }
          diag.state('retomada', 'mesma sessão: histórico preservado no servidor');
        } else {
          // Sessão nova no lugar da que caiu: o modelo precisa do diagrama e da conversa de volta.
          semearContexto(contextoAtual());
        }

        /**
         * A pergunta que ficou sem resposta volta a ser feita — UMA vez.
         *
         * ⚠ Sem isto, a queda levava a pergunta junto: a bolha de "pensando…" ficava pendurada
         * e o aluno tinha de redigitar. Só vale para pergunta DIGITADA: a falada não dá para
         * reenviar (o áudio já foi), e aí o aviso pede que ele repita.
         */
        // Com a alça, o que se perdeu foi o TURNO em voo, não a conversa — e dizer isso muda o
        // que o aluno faz em seguida (continuar vs. recomear contando o contexto de novo).
        const fio = retomou ? ' Continuamos na mesma conversa.' : '';
        const perdida = perguntaSemResposta();
        if (!perdida) {
          /**
           * ⚠ "Pode continuar" era MENTIRA quando a queda pegou a fala dele no meio: não havia
           * bolha de espera para `perguntaSemResposta` encontrar, porque o servidor nunca
           * devolveu a transcrição — e a tela ficava igual a uma conversa em que ninguém falou.
           * O rastro existe no nosso lado: quadros de microfone saíram (`falouSemResposta`).
           */
          if (falouSemResposta) {
            falouSemResposta = false;
            note(
              'A conexão caiu enquanto você falava, e o que você disse não chegou. '
              + 'Pode repetir — voltei na mesma conversa.',
              'context-reset',
            );
            return;
          }
          note(
            retomou
              ? 'A conexão caiu e voltou — sem perder o fio: continuamos na mesma conversa.'
              : 'A conexão caiu e voltou. Pode continuar.',
            'context-reset',
          );
          return;
        }
        if (perdida.via === 'texto' && !perdida.reenviada) {
          perdida.reenviada = true;
          tirarEspera();
          note(`A conexão caiu no meio da resposta. Voltei e refiz a sua pergunta.${fio}`, 'context-reset');
          const antes = messages.length;
          api.ask(perdida.text);
          // A pergunta refeita nasce MARCADA: uma queda seguinte avisa, mas não reenvia de novo.
          // Conexão instável refazendo a mesma pergunta a cada queda vira enxurrada de resposta.
          const nova = messages.slice(antes).find((m) => m.role === 'user');
          if (nova) nova.reenviada = true;
          return;
        }
        tirarEspera();
        note(`A conexão caiu no meio da resposta. Voltei — pode repetir a pergunta.${fio}`, 'context-reset');
      },
      onState: ({ state: s, reason: r }) => {
        if (s === 'error' && r === 'bad-key') credentials.markRejected();
        // Fim de turno é o retrato que interessa: o que acabou de ser falado saiu inteiro?
        if (s === 'ready') speaker?.stats?.();
        setState(s, r);
        // A brecha ENTRE turnos é a única hora em que a nota da página pode sair sem atropelar
        // ninguém. Em escuta contínua o turno reabre no quadro seguinte do microfone, então esta
        // é a janela — e é por isso que o escoamento é dirigido por estado, não por relógio.
        // A conexão voltou: o recado vermelho de quando ela caiu NÃO fica na tela por cima da
        // conversa (ver `limparAvisosDeConexao`).
        if (s === 'ready') { limparAvisosDeConexao(); escoarNota(); }
        // Pedido do dono (2026-11-11): "clicar em voz já poderia aparecer a parada de voz" — ou
        // seja, escolher voz é começar a falar, não desbloquear mais um botão. Consome a marca
        // UMA vez: `ready` também volta no fim de cada turno, e reabrir o microfone sozinho a
        // cada resposta seria um microfone que o aluno não mandou abrir.
        if (s === 'ready' && micAutomatico && !micMudo) {
          micAutomatico = false;
          api.startMic();
        }
        if (s !== 'error') return;
        // Mesma razão: erro com a bolha de espera na tela deixa duas mensagens contraditórias.
        tirarEspera();
        // `transitorio`: isto é estado da conexão. Quando ela voltar, sai da tela sozinho.
        note(`não deu: ${describeError(r)}`, 'error', { transitorio: true });
        // Chave recusada tem conserto, e o conserto é do aluno: dizer o que fazer vale mais que
        // repetir o código do erro.
        /**
         * COTA é o que mais trava a conversa na prática, e o que o servidor recusa é **abrir**:
         * a sessão que já está de pé não é cortada. Não há o que reconectar — então o que vale
         * é dizer O QUE FAZER. A conversa continua na tela, e o teste de conexão diz quando a vaga
         * voltou.
         */
        if (r === 'quota') {
          /**
           * ⚠ O RECADO DIZ O QUE FOI MEDIDO (tarefa 3.3), e foi CORRIGIDO em 2026-11-15 à noite.
           *
           * Primeiro mediu-se que não é cadência: seis sessões em sequência sem pausa nenhuma e
           * quatro ao mesmo tempo passam (`tools/medir-cota.mjs`). Daí concluiu-se "é consumo do
           * minuto" — e esse pulo estava errado: a corrida de 33 perguntas levava recusa na
           * ADMISSÃO alternando com sucessos no mesmo minuto, o que consumo não explica. A causa
           * era VAGA DE SESSÃO: o plano gratuito limita quantas Live cabem de uma vez por projeto,
           * e a vaga de um fio que morreu sem o quadro de fecho leva um tempo para voltar (o
           * harness matava o navegador — ver `tools/drive-page.mjs`).
           *
           * Por isso fechar aba agora ENTRA no recado: cada aba do ajudante segura uma vaga. O
           * que continua fora é "volte em X segundos": o número não é publicado e não foi medido.
           */
          note(
            'O Google não liberou uma sessão nova — tentei algumas vezes e ela não veio. Se você '
            + 'tiver o ajudante aberto em outra aba, feche (cada uma segura uma sessão); senão, '
            + 'espere alguns segundos e clique em Começar. A conversa continua aqui, e a sua '
            + 'chave está boa.',
            'error',
            { transitorio: true },
          );
        }
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
        // `let` porque a conferência de citação (K6) reescreve a etiqueta errada logo abaixo.
        let text = fallback ? limparLegenda(cru).trim() : cru;
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
        /**
         * A CONFERÊNCIA DE CITAÇÃO (K6), e ela acontece AQUI porque aqui é o nosso código.
         *
         * Toda marca `[fonte:verbete:trecho]` é medida contra as chaves que as consultas desta
         * sessão realmente serviram. A que nenhuma consulta devolveu vira "[fonte não conferida]"
         * ANTES de aparecer — o texto do modelo continua inteiro, só a etiqueta errada cai.
         *
         * ⚠ Este é o caminho do TEXTO. A legenda da voz tem a sua própria conferência (ver
         * `onTranscript`, side `output`): ela é o nosso texto, no nosso painel, e passou a ser
         * conferida em 2026-11-16. O que continua fora do nosso alcance é o áudio já falado.
         */
        const conferido = conferirCitacoes(text, chavesServidas);
        if (conferido.trocadas.length) {
          diag.state('citacao', `${conferido.trocadas.length} marca(s) sem consulta: ${conferido.trocadas.join(', ')}`);
        }
        text = conferido.texto;

        // ⚠ A bolha é procurada pelo TURNO, não por "qual era o turno atual". Texto atrasado do
        // turno anterior volta para a bolha dele; sem isto, virava bolha nova carimbada com o
        // turno recém-aberto e lida como resposta da pergunta nova (T9).
        const n = turnoLocal(turno);
        const bolha = bolhaDoTurno(n);
        const fontesDesteTurno = fontesDaVez;
        if (bolha) {
          bolha.text = text;
          if (fontesDesteTurno.length) bolha.fontes = fontesDesteTurno;
          bolha.rodando = false;
          // O turno FECHOU: quem lê não precisa adivinhar pelo texto ter parado de mudar. Uma
          // pausa do modelo no meio da frase é indistinguível do fim, e foi assim que o portão F6
          // leu "Sim, o elemento" como resposta inteira (2026-11-14).
          bolha.completa = Boolean(complete);
          bolha.fallback = Boolean(fallback);
          publish();
        } else {
          push({
            role: 'assistant',
            text,
            fallback: Boolean(fallback),
            completa: Boolean(complete),
            turn: n,
            ...(fontesDesteTurno.length ? { fontes: fontesDesteTurno } : {}),
          });
        }
      },
      onTranscript: ({ side, text, turno }) => {
        if (!text) return;
        if (side === 'input') {
          // Houve fala de verdade: o que veio antes não era laço de eco.
          interrupcoesSeguidas = 0;
          // ⚠ FALA NOVA ZERA A PROVENIÊNCIA: as fontes da resposta anterior não são fontes
          // desta. Só no começo da fala — um pedaço no meio dela não é uma fala nova (a mesma
          // conta da época do portão falado).
          if (!rastreador?.estaFalando) zerarFontes();
          // ⚠ UM pedaço não é uma pergunta. O rastreador junta os pedaços numa fala só e a bolha
          // CRESCE; quem fecha é sinal do servidor, nunca um relógio nosso.
          turnoDaFala = turnoLocal(turno);
          rastreador?.fragmentoDeEntrada(text);
          // Parou de chegar pedaço = ele parou de falar. A bolha de espera nasce aí, e não
          // quando a resposta começa (ver `relogioDeEspera`).
          if (relogioDeEspera) clearTimeout(relogioDeEspera);
          const turnoDaPausa = turnoDaFala;
          relogioDeEspera = setTimeout(() => {
            relogioDeEspera = null;
            if (turnoDaPausa != null && !bolhaDoTurno(turnoDaPausa)) {
              push({ role: 'assistant', text: 'pensando…', rodando: true, turn: turnoDaPausa });
            }
          }, PAUSA_PARA_ESPERAR_MS);
          relogioDeEspera?.unref?.();
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
        /**
         * A CONFERÊNCIA DE CITAÇÃO TAMBÉM AQUI (K6, corrigido em 2026-11-16).
         *
         * ⚠ Este caminho escrevia a legenda CRUA na tela. O áudio, de fato, não passa por nós
         * — mas a legenda passa: ela é o nosso texto, no nosso painel. Marca inventada aparecia
         * ali como se tivesse sido conferida, o que é pior do que não conferir: é a tela
         * emprestando credibilidade a uma fonte que nenhuma consulta devolveu.
         *
         * Confere o ACUMULADO, nunca o pedaço: marca partida entre dois pedaços não casa em
         * nenhum dos dois (a mesma razão de `legendaVisivel` filtrar o acumulado).
         */
        const conferida = conferirCitacoes(legendaVisivel(cru), chavesServidas);
        const visivel = conferida.texto;
        if (conferida.trocadas.length) {
          diag.state('citacao-voz', `${conferida.trocadas.length} marca(s) sem consulta: ${conferida.trocadas.join(', ')}`);
        }
        if (!visivel.trim()) return;
        const fontesDaFala = fontesDaVez;
        const bolha = bolhaDoTurno(n);
        if (bolha) {
          bolha.text = visivel;
          if (fontesDaFala.length) bolha.fontes = fontesDaFala;
          /**
           * O ÁUDIO JÁ FOI: a tela não pode consertar o que foi dito, então DIZ.
           *
           * No texto a etiqueta errada cai antes de aparecer e assunto encerrado. Na voz o aluno
           * já ouviu a frase — esconder que a fonte não fecha seria deixar a palavra falada valer
           * mais que o nosso registro. Marcado no turno, para a tela avisar naquela bolha.
           */
          if (conferida.trocadas.length) bolha.citacaoSuspeita = [...conferida.trocadas];
          /**
           * ⚠ CHEGOU RESPOSTA: para de pulsar. Este caminho (a legenda da VOZ) escrevia o texto
           * por cima da bolha de espera e **não limpava** `rodando` — então toda bolha já
           * respondida continuava piscando para sempre, e no modo voz isso é a conversa inteira
           * (dono, 2026-11-15: *"todas as mensagens estão piscando sempre"*). O caminho do texto
           * sempre limpou; o da voz nunca limpou.
           */
          bolha.rodando = false;
          publish();
        } else {
          push({
            role: 'assistant',
            text: visivel,
            fallback: true,
            turn: n,
            ...(fontesDaFala.length ? { fontes: fontesDaFala } : {}),
            ...(conferida.trocadas.length ? { citacaoSuspeita: [...conferida.trocadas] } : {}),
          });
        }
      },
      onAudio: async (b64) => {
        if (relogioDeEspera) { clearTimeout(relogioDeEspera); relogioDeEspera = null; }
        fecharFala('áudio do modelo');
        if (gravacaoDeAudio && gravacaoDeAudio.quadros.length < MAX_QUADROS_GRAVADOS) {
          gravacaoDeAudio.quadros.push({ b64, ms: Date.now() - gravacaoDeAudio.t0 });
        }
        // O aluno mandou parar: o resto deste turno não toca. Contado, não silenciado às escuras.
        if (calado) { diag.ws('audio-descartado', 'aluno mandou parar'); return; }
        // Agente mudo: a resposta CONTINUA chegando (e a legenda aparece) — só não soa.
        if (agenteMudo) { diag.ws('audio-descartado', 'agente mudo: só texto'); return; }
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

    /**
     * A PÁGINA conta um fato ao modelo (change `close-the-loop-with-the-canvas`).
     *
     * Devolve `true` quando o fato foi ACEITO na fila — não quando chegou ao modelo: a nota pode
     * esperar a brecha entre turnos, ou morrer porque o aluno falou. Quem quer saber o que de
     * fato saiu lê o diário (`pagina.enviou` / `pagina.descartou`).
     */
    anunciarNaPagina(frase) {
      return anunciarNaPagina(frase);
    },

    /** A nota que ainda não saiu, para teste e diagnóstico. Só leitura. */
    get notaDaPagina() {
      return notaDaPagina ? { ...notaDaPagina } : null;
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
     * Executa UMA ferramenta pelo caminho do MODELO — mesma política, mesmo teto, mesmo diário,
     * mesma linha na conversa — sem abrir sessão e sem gastar cota.
     *
     * ⚠ Existe porque provar uma ferramenta de escrita contra o bpmn-js de VERDADE exigia uma
     * sessão Live, e cota é o teto prático da aula (a trilha de 2026-11-14 terminou em
     * `erro: cota`, com o dono no meio de um teste). Com isto, o portão do navegador dirige
     * `mover`, `alinhar`, `trocar_tipo`, `entre`, `desfazer` e `destacar` contra o modelador de
     * verdade, e para a sessão ao vivo sobra o que só ela prova: o MODELO escolhendo a ferramenta.
     *
     * Não é porta de serviço: a política é consultada com o contexto de AGORA, então numa página
     * que só lê isto recusa igual. O que muda é apenas quem fez a chamada.
     */
    async dirigirFerramenta(nome, args = {}) {
      const [r] = await criarDespachante().despachar([{ id: 'diagnostico', name: nome, args }]);
      return r?.response ?? null;
    },

    /**
     * Relatório para COLAR em quem for depurar. Redigido pelo próprio diário — a chave não sai.
     * Também exposto em `window.__bpmnAssist.report()` pelo `mount.js`.
     */
    /**
     * TUDO o que esta sessão sabe de si, num objeto — para SALVAR e mandar para quem vai
     * consertar.
     *
     * ⚠ Existe porque "me manda o contexto" não pode depender de alguém copiar e colar um painel
     * (dono, 2026-11-14: "a gente precisa encontrar uma forma de que eu consiga testar… e você
     * consiga ter acesso a absolutamente todos os pontos"). O relatório de texto continua para
     * leitura humana; este é o que a análise usa: conversa com número de turno, diário completo,
     * contagens, contexto enviado, estado do som e o desenho de agora.
     *
     * Já vem redigido: o diário mascara segredo no momento em que grava, e a chave nunca entra
     * em mensagem nem em contexto.
     */
    capturar() {
      return {
        quando: new Date().toISOString(),
        url: typeof location === 'undefined' ? null : location.href,
        estado: { state, reason, mode, micOn, meiaDuplex, turnos: turnSeq },
        mensagens: messages.slice(),
        eventos: diag.events,
        contagem: diag.counts,
        contexto: contextoAtual(),
        contextoEnviado,
        som: lastStats,
        uso: session?.lastUsage ?? null,
        /**
         * O custo e a espera, por turno (change `sustain-a-class-session`, 4.2/5.2).
         *
         * ⚠ Sem os TURNOS aqui, a latência só existia como linha de diário — legível, mas não
         * somável. É desta lista que sai a tabela de latência por turno da dissertação.
         */
        turnos: (session?.turns ?? []).map((t) => ({
          n: t.n, tipo: t.kind, tempos: t.tempos ?? null,
          tokens: t.usage?.totalTokenCount ?? null, vazio: Boolean(t.empty), fallback: Boolean(t.fallback),
        })),
        usoAcumulado: session?.uso ?? null,
        relatorio: this.report(),
      };
    },

    report() {
      return diag.report({
        header: {
          modo: mode,
          estado: state + (reason ? `:${reason}` : ''),
          turnos: String(turnSeq),
          escuta: meiaDuplex ? 'meia-duplex (rede de seguranca)' : 'continua',
          mensagens: String(messages.length),
          // O ACUMULADO, e não o último turno: a pergunta do aluno é "quanto esta conversa gastou
          // da minha chave", e um turno sozinho não responde isso.
          uso: session?.uso?.turnos
            ? `${session.uso.total} tokens em ${session.uso.turnos} turno(s) (entrada ${session.uso.entrada}, saída ${session.uso.saida})`
            : '(sem contagem)',
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
      micAutomatico = targetMode === 'voz';
      await teardown();
      mode = targetMode;
      setState('connecting');
      openSession(targetMode);
      // O relógio começa com a SESSÃO, não com a aba: trocar de modo abre outra sessão e o teto
      // recomeça com ela, que é o que o servidor também faz.
      armarTetoDaSessao();
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
      if (!session || !(state === 'ready' || state === 'listening' || state === 'speaking'
                        || state === 'dormindo')) {
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
      voltarAFalar('pergunta nova');
      // Pergunta nova é resposta nova: as fontes da anterior não são fontes desta.
      zerarFontes();
      alunoFalou();
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
        voltarAFalar('microfone aberto');
      /**
       * ABRIR O MICROFONE É DESMUTAR — por qualquer caminho.
       *
       * ⚠ Sem isto o estado mente: o dono mutou, clicou no microfone para voltar a falar, o
       * microfone ABRIU e o botão continuou dizendo "Ativar meu microfone" (2026-11-15: *"ele
       * continua me ouvindo, mas aparece como se não estivesse"*). Duas verdades sobre a mesma
       * coisa é uma a mais.
       */
      micMudo = false;
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
            // Quadro de microfone SAINDO: a partir daqui existe uma pergunta em voo, mesmo que
            // nada tenha voltado ainda (ver `falouSemResposta`).
            // `pushAudio` devolve o número do turno quando o quadro SAIU, e `null` quando foi
            // descartado (sessão ainda não pronta). Só o que saiu conta como pergunta em voo.
            if (session?.pushAudio(b64) != null) falouSemResposta = true;
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
        /**
         * ⚠ MICROFONE NEGADO NÃO MATA A CONVERSA.
         *
         * Isto marcava a SESSÃO como `error`, e `error` desliga a caixa de texto (`canAsk`): quem
         * clicava em "Bloquear" no aviso do navegador perdia o ajudante inteiro, inclusive o modo
         * texto, que não tem nada a ver com microfone. Medido no portão M3 (2026-11-15) com o
         * `getUserMedia` recusando como o Chrome recusa: `estado: error`, `podeEscrever: false`.
         *
         * O que falhou foi a ENTRADA DE VOZ, e é isso que se diz. A sessão Live segue de pé — ela
         * foi aceita antes do microfone — e o aluno continua conversando por escrito. Só se a
         * própria sessão tiver morrido o estado vira erro.
         */
        if (state === 'ready' || state === 'listening' || state === 'speaking' || state === 'dormindo') {
          reason = motivo;   // o diagnóstico guarda a causa sem derrubar a conversa
          publish();
        } else {
          setState('error', motivo);
        }
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
    /**
     * TESTA A CONEXÃO sem gastar um turno.
     *
     * Abre uma sessão só para o aperto de mão e fecha assim que o servidor ACEITA o setup. É o
     * que separa as três coisas que quebram e que a tela antes resumia em "o servidor não
     * respondeu": a rede (o socket nem abre), a chave (o servidor recusa) e o modelo (o setup
     * não é aceito). Devolve o tempo, porque "demorou 8 s" e "respondeu em 300 ms" são
     * diagnósticos diferentes.
     *
     * ⚠ **SÓ abre socket quando NÃO há sessão no ar** (dono, 2026-11-15: *"só usamos uma por
     * vez"*). Com a conversa aberta, um segundo socket tomaria outra **vaga de sessão** do
     * projeto — que é exatamente o recurso escasso que a gente passou um dia lendo como "cota" —
     * e, com a invariante do transporte, encerraria a sessão do aluno para sondar se o servidor
     * responde. Com a sessão de pé a resposta já está dada: o servidor aceitou o setup dela.
     */
    async testarConexao({ tetoMs = 15000 } = {}) {
      if (!credentials.ready) return { ok: false, erro: 'sem chave guardada nesta aba' };
      if (session && state !== 'idle' && state !== 'error') {
        const aberta = state === 'connecting'
          ? 'A sua sessão está conectando agora — espere o painel dizer "pronto".'
          : 'A sua sessão está aberta agora: o servidor aceitou e a conversa está de pé.';
        diag.record('rede', 'teste', `sessão no ar (${state}): nenhum socket novo`);
        note(aberta, 'info');
        return { ok: state !== 'connecting', jaAberta: true, estado: state };
      }
      const inicio = Date.now();
      const quanto = () => Date.now() - inicio;

      return new Promise((resolve) => {
        let teste = null;
        let decidido = false;
        const acabar = (r) => {
          if (decidido) return;
          decidido = true;
          try { teste?.close(); } catch { /* já fechada */ }
          diag.record('rede', 'teste', r.ok ? `ok em ${r.ms} ms` : `falhou: ${r.erro}`);
          // O resultado vai para a CONVERSA: é lá que o aluno estava olhando quando desconfiou.
          note(
            r.ok
              ? `Conexão testada agora: o servidor aceitou a sessão em ${r.ms} ms.`
              : `Teste de conexão: ${r.erro}.`,
            r.ok ? 'info' : 'error',
          );
          resolve(r);
        };

        const relogio = setTimeout(() => acabar({ ok: false, erro: 'sem resposta no prazo', ms: quanto() }), tetoMs);
        relogio?.unref?.();

        try {
          teste = sessionFactory({
            apiKey: credentials.use(),
            // O MESMO setup da sessao de verdade: sonda com aperto de mao diferente nao prova o
            // aperto de mao do produto. E o `buildSetup` recusa sem prompt, com razao.
            setupOptions: promptDoPerfil(contextoAtual('texto')),
            onSetupComplete: () => acabar({ ok: true, ms: quanto() }),
            onState: ({ state: s, reason: r }) => {
              if (s === 'error') acabar({ ok: false, erro: describeError(r) ?? r, ms: quanto() });
            },
          });
          teste.start();
        } catch (err) {
          acabar({ ok: false, erro: err?.message ?? String(err), ms: quanto() });
        }
      });
    },

    /**
     * Liga/desliga a gravacao do audio do modelo (diagnostico; ver `gravacaoDeAudio`).
     * Ligar zera o que havia: uma prova grava a sua propria corrida, nao a anterior.
     */
    gravarAudioDoModelo(ligar = true) {
      gravacaoDeAudio = ligar ? { t0: Date.now(), quadros: [] } : null;
      diag.state('gravacao', ligar ? 'ligada' : 'desligada');
      return Boolean(gravacaoDeAudio);
    },

    /** O que foi gravado: `{ quadros: [{ b64, ms }] }` ou `null`. */
    get audioGravado() {
      return gravacaoDeAudio ? { t0: gravacaoDeAudio.t0, quadros: gravacaoDeAudio.quadros.slice() } : null;
    },

    /** Cala a resposta em curso. Devolve false quando não havia nada tocando. */
    pararDeFalar() {
      return pararDeFalar();
    },

    confirmar(sim) {
      fecharConfirmacao(sim);
    },

    /** Esquece portões pendentes (diagnóstico; ver `limparPortoes`). Devolve quantos havia. */
    limparPortoes() {
      return limparPortoes();
    },

    /** Mudo do MICROFONE dele. Fecha a captura e segura o automático (ver `micMudo`). */
    async mutarMicrofone(ligar = true) {
      micMudo = Boolean(ligar);
      diag.mic(micMudo ? 'mudo' : 'ativo', 'pedido do aluno');
      if (micMudo) {
        micAutomatico = false;
        await fecharMicrofone('o aluno mutou o próprio microfone');
      } else if (mode === 'voz' && session && state !== 'idle' && state !== 'error') {
        await api.startMic();
      }
      publish();
      return micMudo;
    },

    /** Mudo da VOZ DO AGENTE: ele continua respondendo, só que por escrito. */
    silenciarAgente(ligar = true) {
      agenteMudo = Boolean(ligar);
      diag.state('agente', agenteMudo ? 'mudo: só texto' : 'voltou a falar');
      // Calar com uma fala no ar deixaria o resto do turno tocando: corta o que já está na fila.
      if (agenteMudo) pararDeFalar();
      /**
       * ⚠ E destravar o `calado` ao voltar — senão o próximo turno também sai mudo e parece
       * que o botão não funciona (dono, 2026-11-15: *"quando eu cliquei para voltar ele não
       * continuou falando"*). O áudio JÁ descartado não volta: o que volta é a voz, da próxima
       * resposta em diante.
       */
      else voltarAFalar('o aluno pediu a voz de volta');
      publish();
      return agenteMudo;
    },

    /**
     * O aluno ESCOLHEU um candidato clicando (change `close-the-loop-with-the-canvas`, tarefa 4).
     *
     * Três decisões, e as três são sobre honestidade:
     *
     *  1. **Destaca primeiro.** Ele clicou num nome; o que ele quer saber é QUAL é no desenho. A
     *     cor vai antes da resposta do modelo porque a resposta leva segundos.
     *  2. **A mensagem é marcada como escolha**, não como digitação: ele não escreveu isso. A
     *     bolha diz "escolhido no chat", e o texto que vai ao modelo também.
     *  3. **NÃO conta como fala do aluno** para o portão de confirmação. Clicar num pool não
     *     autoriza apagar nada — o portão é da change irmã e exige fala ou digitação depois da
     *     pergunta. Confundir os dois transformaria um clique de desambiguação em consentimento.
     */
    escolherCandidato(candidato) {
      const alvo = candidato && typeof candidato === 'object' ? candidato : { rotulo: String(candidato ?? '') };
      const rotulo = String(alvo.rotulo ?? alvo.nome ?? alvo.id ?? '').trim();
      if (!rotulo) return false;
      if (!session || !(state === 'ready' || state === 'listening' || state === 'speaking')) {
        note('conecte antes de escolher.', 'error');
        return false;
      }

      if (alvo.id) {
        // Pelo caminho do MODELO: mesma política, mesmo teto, mesma linha na conversa.
        Promise.resolve(api.dirigirFerramenta('destacar', { ids: [alvo.id], cor: 'azul' }))
          .catch(() => { /* destacar é cortesia: a escolha segue mesmo sem cor */ });
      }

      voltarAFalar('escolha no chat');
      zerarFontes();
      const delta = calcularDelta();
      const daSessao = session.ask(`(escolhido no chat) ${rotulo}`, delta);
      const n = (daSessao === undefined || daSessao === null) ? ++turnSeq : turnoLocal(daSessao);
      push({ role: 'user', text: rotulo, via: 'escolha', turn: n });
      push({ role: 'assistant', text: 'pensando…', rodando: true, turn: n });
      return true;
    },

    /**
     * MOSTRA no desenho o que a ferramenta achou — sem falar com o modelo (harvest 6.4).
     *
     * ⚠ Seleciona, e **não** pinta. Pintar (`destacar`) escreve no diagrama do aluno: a cor fica
     * no arquivo dele depois que a curiosidade passou. Seleção é exatamente o que o clique dele
     * faria — inclusive a nota da página que conta ao modelo o que ele está olhando.
     */
    mostrarNoDesenho(alvo) {
      const id = typeof alvo === 'string' ? alvo : alvo?.id;
      if (!id) return false;
      try {
        const ok = Boolean(deps.acesso?.selecionar?.(id));
        diag.record('pagina', ok ? 'mostrou' : 'nao-mostrou', id);
        return ok;
      } catch (err) {
        diag.record('pagina', 'nao-mostrou', `${id}: ${err?.message ?? err}`);
        return false;
      }
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
