// A camada fina sobre o bpmn-js (openspec design T6, tarefa 1.2).
//
// Por que existe: as ferramentas precisam de UM PUNHADO de coisas do modelador. Deixar cada uma chamar
// `modelador.get('elementRegistry')` espalha o acoplamento e, pior, obriga o teste a dublar o
// bpmn-js inteiro — que é reimplementá-lo mal. Aqui a superfície é pequena e é ELA que o teste
// dubla.
//
// ⚠ Esta camada não decide nada. Ela não filtra rótulo, não conta, não ordena: isso é da
// projeção (`agent/diagram.js`) e das ferramentas (`tools/leitura.js`). Camada de acesso que
// começa a ter regra vira um segundo modelo de domínio, e aí há dois lugares para consertar.
//
// ponytail: um punhado de funções e uma flag. Sem classe, sem injeção, sem container — e nada
// de layout próprio: a vaga de um elemento novo sai do `autoPlace` do bpmn-js.

/**
 * `modelador` é o `BpmnModeler` ou o `NavigatedViewer` — os dois respondem `.get()`. Qualquer
 * outra coisa (inclusive `null`) devolve um acesso INERTE: o ajudante monta igual, as
 * ferramentas respondem que não há diagrama, e nada quebra. Montar sem modelador é caso normal,
 * não erro.
 */
export function criarAcessoBpmn(modelador) {
  const inerte = {
    disponivel: false,
    editavel: false,
    elementos: () => [],
    porId: () => null,
    selecionado: () => null,
    selecionados: () => [],
    entradasESaidas: () => ({ entradas: [], saidas: [] }),
    assinar: () => () => {},
    // Escrita no acesso inerte NAO e no-op silencioso: quem chamar recebe o mesmo erro nomeado
    // que receberia num viewer. No-op silencioso faria o agente narrar uma criacao que nao houve.
    criarDepoisDe: () => { throw new Error('pagina_somente_leitura'); },
    ramificar: () => { throw new Error('pagina_somente_leitura'); },
    criarSolto: () => { throw new Error('pagina_somente_leitura'); },
    lugaresParaCriar: () => [],
    ligar: () => { throw new Error('pagina_somente_leitura'); },
    renomear: () => { throw new Error('pagina_somente_leitura'); },
    remover: () => { throw new Error('pagina_somente_leitura'); },
    mover: () => { throw new Error('pagina_somente_leitura'); },
    alinhar: () => { throw new Error('pagina_somente_leitura'); },
    trocarTipo: () => { throw new Error('pagina_somente_leitura'); },
    inserirEntre: () => { throw new Error('pagina_somente_leitura'); },
    desfazer: () => { throw new Error('pagina_somente_leitura'); },
    destacar: () => { throw new Error('pagina_somente_leitura'); },
    criarPool: () => { throw new Error('pagina_somente_leitura'); },
    criarRaia: () => { throw new Error('pagina_somente_leitura'); },
    raiz: () => null,
    pools: () => [],
    raiasDe: () => [],
    caixaDe: () => null,
    fluxoEntre: () => null,
    corDe: () => ({ fundo: null, borda: null }),
  };

  if (!modelador || typeof modelador.get !== 'function') return inerte;

  let registry;
  let selection;
  let eventBus;
  try {
    registry = modelador.get('elementRegistry');
    selection = modelador.get('selection');
    eventBus = modelador.get('eventBus');
  } catch {
    return inerte;
  }

  /**
   * `modeling` e `canvas` sao o que separa o modelador do viewer — e e por isso que `editavel`
   * nasce de PEDIR os dois, nao de um parametro. O `NavigatedViewer` nao tem `modeling`: o
   * `.get()` dele estoura, e a flag cai sozinha para falso.
   *
   * ⚠ Toda escrita sai daqui pelo `modeling` (tarefa 3.5): e ele que registra no `commandStack`,
   * e e o commandStack que faz o Ctrl+Z do aluno desfazer o que o agente fez.
   */
  let modeling = null;
  let canvas = null;
  try {
    modeling = modelador.get('modeling');
    canvas = modelador.get('canvas');
  } catch { /* viewer: segue sem escrita */ }
  const editavel = Boolean(modeling && canvas);

  /**
   * A fábrica de formas. Precisamos da forma PRONTA (com largura e altura) antes de escolher a
   * vaga — é com as medidas dela que se pergunta "cabe aqui?".
   *
   * Pedida em `try` próprio: modelador montado sem o módulo não pode derrubar a escrita toda.
   */
  let elementFactory = null;
  try {
    elementFactory = modelador.get('elementFactory');
  } catch { /* sem a fábrica: cai no append cru, que coloca no ponto fixo */ }

  /**
   * Onde cabe um elemento pendurado em `ancora` — a REGRA é do bpmn-js, o empurrão é nosso.
   *
   * ⚠ Por que não dá para omitir a posição: `modeling.appendShape(..., null, ...)` cai no
   * `AppendBehavior`, que usa um ponto FIXO (`source.x + width + 80`) sem olhar o que já está
   * desenhado. Num diagrama cheio isso nasce POR CIMA do vizinho — print do portão F7,
   * 2026-11-14: correto no registro, ilegível na tela.
   *
   * A base vem do evento `autoPlace`, o mesmo que o botão de append do ALUNO dispara: direção,
   * distância e desvio saem do bpmn-js, não de uma regra nossa.
   *
   * ⚠ E por que ainda sobra um empurrão nosso: a busca de vaga do bpmn-js só desvia do que está
   * LIGADO à âncora. Um vizinho solto parado na vaga é ignorado — medido ao vivo na mesma
   * corrida (`_6-650`). Então, enquanto a vaga estiver ocupada, andamos para a DIREITA, que é a
   * direção da leitura e mantém o elemento na própria raia; descer o jogaria na raia de baixo.
   *
   * ponytail: seis passos e desiste, devolvendo a posição do bpmn-js. Buscar a vaga perfeita num
   * diagrama cheio é layout automático (tarefa 5.1) — isto aqui só evita o empilhamento.
   */
  const ocupada = (caixa) => {
    const dentro = (p, q) => p.x <= q.x && p.y <= q.y && p.x + p.w >= q.x + q.w && p.y + p.h >= q.y + q.h;
    let desenhados = [];
    try { desenhados = registry.getAll() ?? []; } catch { return false; }
    return desenhados.some((el) => {
      // Rótulo não ocupa vaga; conexão não tem caixa.
      if (!el || el.labelTarget || el.waypoints) return false;
      /**
       * ⚠ Raia e pool são o FUNDO onde o elemento mora, não obstáculo.
       *
       * Medido em 2026-11-14 contra o diagrama da pizzaria: o botão de append do PRÓPRIO bpmn-js
       * coloca a tarefa no mesmo ponto que nós, e ela encosta 3 px na borda da raia de cima —
       * porque raias dividem a borda. Tratar isso como vaga ocupada fazia o empurrão correr os
       * seis passos e desistir, sempre, em qualquer diagrama com raias.
       *
       * Container é quem tem filhos: não precisa de lista de tipos para reconhecer um.
       */
      if (Array.isArray(el.children) && el.children.length) return false;
      if (!Number.isFinite(el.x) || !Number.isFinite(el.width)) return false;
      const b = { x: el.x, y: el.y, w: el.width, h: el.height };
      if (dentro(b, caixa) || dentro(caixa, b)) return false;
      return caixa.x + caixa.w > b.x && b.x + b.w > caixa.x
        && caixa.y + caixa.h > b.y && b.y + b.h > caixa.y;
    });
  };

  const vagaDepoisDe = (ancora, forma) => {
    let base = null;
    try { base = eventBus.fire('autoPlace', { source: ancora, shape: forma }) ?? null; } catch { base = null; }
    if (!base || !Number.isFinite(base.x) || !Number.isFinite(base.y)) return null;

    const caixaEm = (p) => ({ x: p.x - forma.width / 2, y: p.y - forma.height / 2, w: forma.width, h: forma.height });
    let vaga = base;
    for (let i = 0; i < 6 && ocupada(caixaEm(vaga)); i++) {
      vaga = { x: vaga.x + forma.width + 40, y: vaga.y };
    }
    return ocupada(caixaEm(vaga)) ? base : vaga;
  };

  /**
   * Onde um elemento NOVO pode nascer — pergunta respondida pelo bpmn-js, não por nós.
   *
   * ⚠ Isto nasceu de um crash medido ao vivo (2026-11-14, portão 4.5): criar um evento de início
   * sem âncora num diagrama de COLABORAÇÃO estourava
   * `Cannot read properties of undefined (reading 'push')` — e deixava a forma desenhada na tela
   * com o XML quebrado. A causa é do modelo BPMN, não um acidente: o `BpmnUpdater` guarda todo
   * `bpmn:FlowElement` em `flowElements`, e uma `bpmn:Collaboration` **não tem** essa coleção
   * (processo mora dentro de um pool). O agente tentou três vezes e deixou três fantasmas.
   *
   * O `rules` é a MESMA autoridade que decide se o aluno pode soltar a forma ali quando arrasta
   * da paleta. Perguntar a ele é mais curto — e mais certo — do que uma lista de tipos nossa.
   */
  let rules = null;
  try {
    rules = modelador.get('rules');
  } catch { /* sem regras: só a raiz, como antes */ }

  /**
   * `alignElements` e `bpmnReplace` são do Modeler e não do viewer — pedidos em `try` próprio,
   * como o resto, para que um modelador montado sem o módulo recuse com nome em vez de derrubar
   * a escrita toda.
   *
   * Os dois são serviços de ALTO nível de propósito: `alignElements.trigger` consulta a regra
   * `elements.align` e emite UM comando; `bpmnReplace.replaceElement` troca o tipo COPIANDO nome,
   * propriedades e religando os fluxos — fazer isso na mão seria apagar e recriar, e o aluno
   * perderia as ligações que ele desenhou.
   */
  let alinhador = null;
  let substituidor = null;
  let pilha = null;
  try { alinhador = modelador.get('alignElements'); } catch { /* sem alinhamento: recusa nomeada */ }
  try { substituidor = modelador.get('bpmnReplace'); } catch { /* sem troca de tipo: idem */ }
  /**
   * O `commandStack` é o MESMO que o `Ctrl+Z` do aluno usa — e é por isso que desfazer pela
   * conversa é seguro: não há uma segunda pilha nossa que possa discordar da dele.
   */
  try { pilha = modelador.get('commandStack'); } catch { /* sem pilha: desfazer recusa com nome */ }

  /**
   * `posicao` entra na pergunta porque a MESMA regra do bpmn-js responde duas coisas: pode cair
   * DENTRO deste container (`canDrop`) e pode ser inserido NESTE fluxo (`canInsert`). A segunda
   * olha a posição — é ela que autoriza "uma tarefa entre o início e a primeira tarefa".
   */
  const aceita = (forma, alvo, posicao = null) => {
    if (!alvo) return false;
    if (!rules) return !alvo.waypoints && !alvo.labelTarget;
    try {
      const ctx = { shape: forma, target: alvo };
      if (posicao) ctx.position = posicao;
      return rules.allowed('shape.create', ctx) !== false;
    } catch {
      return false;
    }
  };

  /** A caixa de um elemento, como o registro a guarda. Leitura pura: é o que prova que moveu. */
  const caixaDe = (el) => (el && Number.isFinite(el.x) && Number.isFinite(el.y)
    ? { x: el.x, y: el.y, w: el.width ?? 0, h: el.height ?? 0 }
    : null);

  /**
   * Quanto um passo de "mova para a direita" anda: 80 px, que é a MESMA distância horizontal que
   * o `autoPlace` do bpmn-js usa entre dois elementos ligados. Número arbitrário aqui faria o
   * elemento movido nunca cair na grade do resto do desenho.
   */
  const PASSO_PX = 80;
  const DIRECOES = Object.freeze({
    direita: { x: 1, y: 0 },
    esquerda: { x: -1, y: 0 },
    cima: { x: 0, y: -1 },
    baixo: { x: 0, y: 1 },
  });

  /** O ponto no MEIO de um fluxo, sobre a linha — é onde o elemento inserido entra. */
  /**
   * Empurra para a direita tudo que começa em `alvo.x` ou depois, no MESMO pai.
   *
   * Um comando só (`moveElements`), então o empurrão e a inserção somam DOIS `Ctrl+Z` — e só
   * acontece quando não cabe, que é o caso em que a alternativa era desenhar por cima. Pool,
   * raia e rótulo ficam parados: o pool cresce sozinho quando o conteúdo passa da borda, e
   * rótulo anda junto do dono.
   */
  /**
   * QUANTOS `Ctrl+Z` o aluno vai precisar — contado no evento do proprio bpmn-js.
   *
   * `commandStack.changed` dispara UMA vez por grupo desfazivel (o `_popAction` so' avisa
   * quando a pilha de acoes em voo esvazia), entao contar este evento durante uma escrita da'
   * exatamente o numero de desfazeres que aquela escrita custa. Comando aninhado nao conta duas
   * vezes, que e' o ponto.
   *
   * ⚠ Medido em 2026-11-15, e foi assim que a divida T12 mostrou o tamanho real: criar um
   * gateway com nome no MEIO de um fluxo custava **7** desfazeres, nao dois. Quem chama devolve
   * este numero ao modelo, e e' com ele que `desfazer({ quantos })` volta a escrita inteira.
   */
  let comandos = 0;
  try { eventBus?.on('commandStack.changed', () => { comandos += 1; }); } catch { /* sem eventBus: fica em 0 */ }

  /**
   * Roda o arrumado DENTRO do comando que o bpmn-js esta' executando — um desfazer, nao cinco.
   *
   * E' o mesmo mecanismo dos comportamentos do bpmn-js (`CommandInterceptor.postExecute`): o
   * `CommandStack` da' ao comando disparado durante a execucao de outro o **mesmo id de acao**
   * (`_pushAction`: `action.id = baseAction.id`), e `undo()` reverte o grupo inteiro. Nossos
   * comandos de cosmetica rodavam DEPOIS, de fora, e cada um virava um `Ctrl+Z` sozinho.
   *
   * ⚠ Nao e' lugar para efeito que o aluno pediu: o que entra aqui e' ajuste de desenho
   * (roteamento de seta), que ninguem quer desfazer separadamente do que o causou.
   */
  const juntoDoComando = (evento, fn) => {
    if (!eventBus || typeof eventBus.once !== 'function') { return () => fn(null); }
    let correu = false;
    eventBus.once(`commandStack.${evento}.postExecute`, (e) => {
      correu = true;
      try { fn(e?.context ?? null); } catch { /* cosmetica nunca derruba a escrita */ }
    });
    // Comando que nao aconteceu (regra recusou) deixa o gancho pendurado: o de fora o cobre.
    return () => { if (!correu) fn(null); };
  };

  const empurrarParaDireita = (alvo, quanto) => {
    if (!(quanto > 0) || !alvo?.parent || typeof modeling.moveElements !== 'function') return 0;
    const ESTATICOS = ['bpmn:Participant', 'bpmn:Lane'];
    const mover = (alvo.parent.children ?? []).filter((e) => e
      && e !== alvo.parent
      && !e.labelTarget
      && !Array.isArray(e.waypoints)
      && !ESTATICOS.includes(String(e.type))
      && Number.isFinite(e.x)
      && e.x >= (alvo.x ?? 0));
    if (!mover.length) return 0;
    modeling.moveElements(mover, { x: Math.round(quanto), y: 0 });
    return mover.length;
  };

  /**
   * Tira a sobreposição horizontal de um conjunto que acabou de ser alinhado. Devolve quantos
   * precisaram andar. Mantém a ORDEM que já existia: quem estava à esquerda continua à esquerda.
   */
  const separarNaLinha = (els, folga = 40) => {
    if (typeof modeling.moveElements !== 'function') return 0;
    const fila = (els ?? [])
      .filter((e) => e && Number.isFinite(e.x) && Number.isFinite(e.width))
      .sort((a, b) => a.x - b.x);
    let andaram = 0;
    let limite = null;
    for (const e of fila) {
      if (limite !== null && e.x < limite + folga) {
        modeling.moveElements([e], { x: Math.round(limite + folga - e.x), y: 0 });
        andaram++;
      }
      limite = e.x + e.width;
    }
    return andaram;
  };

  /**
   * Refaz o traçado das ligações cujos DOIS lados estão no conjunto. Devolve quantas.
   *
   * Só as de dentro do conjunto: refazer a seta que sai para fora moveria o desenho de quem o
   * aluno não mandou tocar.
   */
  /**
   * Refaz o traçado de TODAS as ligações que tocam estes elementos (e não só as internas).
   * Usado depois de inserir no meio de um fluxo, onde o que atrapalha é a seta de FORA.
   */
  /** O fluxo DIRETO de a para b, se existir. Lido do próprio elemento, sem busca. */
  const fluxoEntreDireto = (a, b) => (a?.outgoing ?? []).find((c) => c?.target === b) ?? null;
  /**
   * Liga dois elementos SÓ SE ainda não houver seta entre eles; devolve a seta (velha ou nova).
   *
   * Duas setas idênticas são invisíveis na tela e reais no arquivo: o aluno vê uma linha, o XML
   * tem duas, e a segunda aparece quando ele exporta ou quando alguém conta o fluxo. Quem religa
   * pergunta antes — ver o comentário do religamento em `moverParaOMeio`.
   */
  const ligarSeFaltar = (a, b) => fluxoEntreDireto(a, b) ?? modeling.connect(a, b);

  const endireitarVizinhanca = (els) => {
    if (typeof modeling.layoutConnection !== 'function') return 0;
    const vistas = new Set();
    let quantas = 0;
    for (const e of (els ?? []).filter(Boolean)) {
      for (const c of [...(e.incoming ?? []), ...(e.outgoing ?? [])]) {
        if (!c || vistas.has(c.id)) continue;
        vistas.add(c.id);
        try { modeling.layoutConnection(c); quantas++; } catch { /* roteador recusou */ }
      }
    }
    return quantas;
  };

  const endireitarEntre = (els) => {
    if (typeof modeling.layoutConnection !== 'function') return 0;
    const dentro = new Set((els ?? []).map((e) => e?.id).filter(Boolean));
    const vistas = new Set();
    let quantas = 0;
    for (const e of els ?? []) {
      for (const c of [...(e?.incoming ?? []), ...(e?.outgoing ?? [])]) {
        if (!c || vistas.has(c.id)) continue;
        if (!dentro.has(c.source?.id) || !dentro.has(c.target?.id)) continue;
        vistas.add(c.id);
        try { modeling.layoutConnection(c); quantas++; } catch { /* roteador recusou: a forma ja' esta' certa */ }
      }
    }
    return quantas;
  };

  const meioDoFluxo = (fluxo) => {
    const p = Array.isArray(fluxo?.waypoints) ? fluxo.waypoints.filter((w) => Number.isFinite(w?.x)) : [];
    if (!p.length) return null;
    if (p.length % 2 === 1) return { x: p[(p.length - 1) / 2].x, y: p[(p.length - 1) / 2].y };
    const a = p[p.length / 2 - 1];
    const b = p[p.length / 2];
    return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  };

  /**
   * A forma pronta (com largura e altura) que as regras e a vaga precisam para decidir.
   *
   * ⚠ O `nome` entra no **businessObject**, nao nos atributos da forma — e essa distincao e a
   * diferenca entre UMA e DUAS entradas no `commandStack` (divida T12). `createShape({name})`
   * pendura o nome na FORMA, onde nem o desenho nem o XML o leem: era por isso que o nome tinha
   * de vir depois, num `updateLabel` a parte, e o aluno gastava dois `Ctrl+Z` para desfazer uma
   * criacao. No businessObject o nome nasce COM o elemento: tarefa desenha o rotulo direto e,
   * em evento/gateway (rotulo externo), o `LabelBehavior` do bpmn-js cria o rotulo no
   * `postExecute` do MESMO comando — um comando, um desfazer.
   */
  const formaDe = (tipo, nome = '') => {
    const forma = elementFactory
      ? elementFactory.createShape({ type: tipo })
      : { type: tipo, width: 100, height: 80 };
    if (nome && forma.businessObject) forma.businessObject.name = nome;
    return forma;
  };

  /**
   * Candidatos a receber um elemento solto: a raiz e os filhos diretos dela (os pools). Raia de
   * dentro de pool não entra na lista — para ela o aluno diz o nome e o agente passa `dentro`.
   */
  const candidatosPara = (forma) => {
    let raiz = null;
    try { raiz = canvas.getRootElement(); } catch { return []; }
    const filhos = (raiz?.children ?? []).filter((e) => e && !e.waypoints && !e.labelTarget);
    return [raiz, ...filhos].filter((alvo) => aceita(forma, alvo));
  };

  /**
   * A vaga de um elemento SOLTO. Dentro de um pool ou raia, à direita do que já está lá e no meio
   * da faixa; na raiz sem bordas, embaixo de tudo.
   *
   * ponytail: é `max + folga`, não um motor de disposição. Sem âncora não há de onde o bpmn-js
   * pendurar, e a montagem guiada cria o início solto e PENDURA o resto nele — então esta é a
   * única posição que escolhemos, e ela só precisa não nascer por cima.
   */
  const vagaSolta = (alvo, forma) => {
    const medido = (e) => e && !e.waypoints && !e.labelTarget && Number.isFinite(e.x) && Number.isFinite(e.width);
    const container = (e) => Array.isArray(e.children) && e.children.length > 0;

    let desenhados = [];
    try { desenhados = (registry.getAll() ?? []).filter(medido); } catch { /* registro inconsistente */ }

    const dentroDeUmaCaixa = Number.isFinite(alvo?.x) && Number.isFinite(alvo?.width);
    if (dentroDeUmaCaixa) {
      /**
       * ⚠ Quem está na raia NÃO é `alvo.children`.
       *
       * Numa colaboração o nó pertence ao POOL; a raia é uma faixa por cima. Medir `children` de
       * uma raia dá lista VAZIA, e o elemento novo nasce na borda esquerda — em cima do primeiro
       * evento que já estava lá (visto no print do portão 4.5, 2026-11-14: o início novo caiu
       * sobre o "Order received"). O que vale é quem está DESENHADO dentro da caixa.
       */
      const ocupantes = desenhados.filter((e) => e !== alvo && !container(e)
        && e.x + e.width > alvo.x && e.x < alvo.x + alvo.width
        && e.y + e.height > alvo.y && e.y < alvo.y + alvo.height);
      const direita = ocupantes.length ? Math.max(...ocupantes.map((e) => e.x + e.width)) : alvo.x;
      return { x: direita + 60 + forma.width / 2, y: alvo.y + alvo.height / 2 };
    }

    if (!desenhados.length) return { x: 220, y: 200 };
    return { x: 220, y: Math.max(...desenhados.map((e) => e.y + e.height)) + 80 };
  };

  /**
   * As medidas do POOL, e por que elas são nossas de propósito.
   *
   * Os três números são do bpmn-js (`CreateParticipantBehavior`): 20 px de folga em volta do
   * conteúdo e 30 px de faixa do rótulo, na borda esquerda. A conta existe aqui porque aquele
   * comportamento só roda no ARRASTO (`create.start`): criando por comando, o pool nasce com o
   * tamanho padrão e o bpmn-js, logo depois, move TODO o processo para dentro dele — conteúdo
   * maior que 600×250 ficaria desenhado fora do próprio pool.
   */
  const FOLGA_DO_POOL = 20;
  const FAIXA_DO_ROTULO = 30;

  /** Quem está DESENHADO na tela, medido. É o que decide tamanho e vaga do pool. */
  const desenhadosMedidos = () => {
    try {
      return (registry.getAll() ?? []).filter((e) => e && !e.waypoints && !e.labelTarget
        && Number.isFinite(e.x) && Number.isFinite(e.width));
    } catch {
      return [];
    }
  };

  /**
   * Onde o pool novo nasce — e, no primeiro pool de um processo plano, de que TAMANHO.
   *
   * Dois casos, e eles são diferentes de verdade:
   *  - **processo plano com conteúdo**: o pool tem de ENVOLVER o que já existe, porque o bpmn-js
   *    vai mudar a raiz para colaboração e mover tudo para dentro dele. A forma é esticada aqui
   *    (mutação de `forma`, que é o objeto que vai ao `createShape`).
   *  - **colaboração, ou tela vazia**: embaixo do que já está desenhado, alinhado à esquerda com
   *    os pools que já existem.
   */
  const vagaDePool = (raiz, forma) => {
    const ehColaboracao = String(raiz?.type ?? '') === 'bpmn:Collaboration';
    const desenhados = desenhadosMedidos().filter((e) => e !== raiz);

    if (!ehColaboracao && desenhados.length) {
      const x1 = Math.min(...desenhados.map((e) => e.x));
      const y1 = Math.min(...desenhados.map((e) => e.y));
      const x2 = Math.max(...desenhados.map((e) => e.x + e.width));
      const y2 = Math.max(...desenhados.map((e) => e.y + e.height));
      forma.width = Math.max(forma.width ?? 0, (x2 - x1) + FOLGA_DO_POOL * 2 + FAIXA_DO_ROTULO);
      forma.height = Math.max(forma.height ?? 0, (y2 - y1) + FOLGA_DO_POOL * 2);
      // A faixa do rótulo fica à esquerda: sem o recuo, o primeiro elemento nasce debaixo dela.
      const esquerda = x1 - FOLGA_DO_POOL - FAIXA_DO_ROTULO;
      const topo = (y1 + y2) / 2 - forma.height / 2;
      return { x: Math.round(esquerda + forma.width / 2), y: Math.round(topo + forma.height / 2) };
    }

    if (!desenhados.length) return { x: 160 + forma.width / 2, y: 80 + forma.height / 2 };
    const esquerda = Math.min(...desenhados.map((e) => e.x));
    const fundo = Math.max(...desenhados.map((e) => e.y + e.height));
    return { x: Math.round(esquerda + forma.width / 2), y: Math.round(fundo + 60 + forma.height / 2) };
  };

  if (!registry || !eventBus) return inerte;

  return {
    disponivel: true,
    editavel,

    elementos() {
      try {
        return registry.getAll();
      } catch {
        // Registro inconsistente no meio de um import: lista vazia é melhor que exceção subindo
        // pelo despacho de ferramenta e virando `ferramenta_falhou` sem causa legível.
        return [];
      }
    },

    porId(id) {
      try {
        return registry.get(String(id ?? '')) ?? null;
      } catch {
        return null;
      }
    },

    selecionado() {
      try {
        return selection?.get?.()[0] ?? null;
      } catch {
        return null;
      }
    },

    /**
     * A seleção INTEIRA, na ordem do bpmn-js.
     *
     * ⚠ `selecionado()` devolve só o primeiro, e era a única coisa que o prompt sabia — então o
     * aluno selecionava quatro tarefas, pedia "alinha essas", e o agente respondia *"só consigo
     * identificar um elemento selecionado"* (2026-11-15). Ele estava dizendo a verdade sobre o
     * que recebia; quem via um só éramos nós.
     */
    selecionados() {
      try {
        return (selection?.get?.() ?? []).filter((e) => e && !e.labelTarget);
      } catch {
        return [];
      }
    },

    /**
     * SELECIONA um elemento — o MESMO servico que o clique do aluno usa (`selection.select`),
     * e por isso o mesmo evento `selection.changed` sai dele.
     *
     * Existe para o portao do navegador poder provar o canal da pagina sem uma pessoa clicando:
     * o que se prova aqui e a cadeia selecao -> nota -> modelo; que o clique no SVG produz
     * selecao e do bpmn-js, e nao e nosso para testar. Nenhuma ferramenta do modelo chama isto
     * (nao esta no catalogo): e verbo de diagnostico, como o resto de `window.__bpmnAssist`.
     */
    selecionar(id) {
      const el = this.porId(id);
      if (!el || !selection?.select) return null;
      selection.select(el);
      return { id: el.id, tipo: String(el.type ?? '').replace('bpmn:', '') };
    },

    /**
     * Seleciona VÁRIOS de uma vez — o mesmo `selection.select` com uma lista, que é o que o
     * bpmn-js faz quando o aluno arrasta um laço ou segura Shift.
     *
     * Existe para a prova poder reproduzir o caso do dono (quatro marcados, "alinha esses") sem
     * uma pessoa arrastando o mouse.
     */
    selecionarVarios(ids) {
      const els = (ids ?? []).map((id) => this.porId(id)).filter(Boolean);
      if (!els.length || !selection?.select) return [];
      selection.select(els);
      return els.map((el) => el.id);
    },

    /**
     * Entradas e saídas de um elemento. O bpmn-js guarda isso no próprio elemento (`incoming` e
     * `outgoing`), então não há busca — é leitura direta, e por isso cabe nesta camada.
     */
    entradasESaidas(id) {
      const el = this.porId(id);
      if (!el) return { entradas: [], saidas: [] };
      return {
        entradas: Array.isArray(el.incoming) ? el.incoming : [],
        saidas: Array.isArray(el.outgoing) ? el.outgoing : [],
      };
    },

    /**
     * Cria o elemento JA LIGADO ao de antes — posicionar e conectar e justamente o que o aluno
     * pede quando diz "depois do inicio".
     *
     * UM comando no commandStack (`appendShape`), com a vaga ja' resolvida: o Ctrl+Z do aluno
     * desfaz a forma e a ligacao de uma vez.
     */
    criarDepoisDe({ ancora, tipo, nome = '' }) {
      const alvo = ancora?.parent ?? canvas.getRootElement();
      // Sem a fabrica nao da' para medir a vaga: append cru, no ponto fixo — pode sobrepor.
      // Ali o nome vai como atributo e quem o poe no desenho e o `renomear` de quem chama.
      if (!elementFactory) return modeling.appendShape(ancora, { type: tipo }, null, alvo);

      const forma = formaDe(tipo, nome);
      /**
       * ⚠ O pai da ancora tambem pode NAO receber o tipo novo — "uma tarefa depois do pool X" e
       * um pedido que o modelo faz. E' o mesmo fantasma do `criarSolto`: o bpmn-js desenha a
       * forma e estoura ao guardar no XML. Perguntar antes custa uma linha.
       */
      if (!aceita(forma, alvo)) throw new Error('sem_lugar_para_criar');
      const novo = modeling.appendShape(ancora, forma, vagaDepoisDe(ancora, forma), alvo);
      // Criar fora da area visivel e, para o aluno, nao ter criado nada. O botao de append do
      // bpmn-js tambem rola ate o elemento novo.
      try { canvas.scrollToElement(novo); } catch { /* sem o verbo: o elemento ja' esta la' */ }
      return novo;
    },

    /**
     * ABRE UM CAMINHO DE DECISAO: o ramo, a ligacao e o ROTULO dela, num comando so'.
     *
     * ⚠ Por que isto existe, e nao e' acucar em cima de `criarDepoisDe`: para abrir o SEGUNDO
     * caminho de um gateway, `depoisDe` nao serve — num elemento que ja' tem saida ele ENCADEIA
     * (entra no meio do primeiro caminho), e essa regra e' de proposito desde 2026-11-15. Entao
     * o segundo caminho de uma decisao era, literalmente, impossivel de pedir (medido na sessao
     * do dono em 2026-11-17: o modelo tentou, encadeou, desfez duas vezes e terminou com tres
     * elementos soltos).
     *
     * ⚠ E o ROTULO entra aqui, dentro do mesmo comando, porque rotular depois exigiria o id da
     * ligacao — e id de ligacao e' a unica coisa do desenho que o aluno nunca diz em voz alta.
     * Na mesma sessao, o modelo tentou `renomear` num `Flow_...` que um desfazer ja' tinha
     * matado, e o rotulo "Nao" foi parar na seta que ENTRA no gateway.
     */
    ramificar({ decisao, tipo, nome = '', rotulo = '' }) {
      const forma = formaDe(tipo, nome);
      const alvo = decisao?.parent ?? canvas.getRootElement();
      if (!aceita(forma, alvo)) throw new Error('sem_lugar_para_criar');

      // O rotulo viaja DENTRO do `connection.create` que o append dispara: um `Ctrl+Z` tira o
      // caminho inteiro (ramo + seta + rotulo), como a divida T12 pede.
      let rotulada = false;
      const seNaoCorreu = juntoDoComando('connection.create', (ctx) => {
        const c = ctx?.connection;
        if (!c || !rotulo) return;
        modeling.updateLabel(c, rotulo);
        rotulada = true;
      });
      const novo = elementFactory
        ? modeling.appendShape(decisao, forma, vagaDepoisDe(decisao, forma), alvo)
        : modeling.appendShape(decisao, { type: tipo }, null, alvo);
      seNaoCorreu();

      const ligacao = fluxoEntreDireto(decisao, novo);
      // Reserva: caminho sem `eventBus.once` (dube antigo) ou comando que nao disparou o gancho.
      // Custa um desfazer a mais e salva o rotulo — que e' o que o aluno le na seta.
      if (rotulo && !rotulada && ligacao) modeling.updateLabel(ligacao, rotulo);
      try { canvas.scrollToElement(novo); } catch { /* sem o verbo: o elemento ja' esta la' */ }
      return { novo, ligacao };
    },

    /**
     * Os caminhos de uma DECISAO: quantas saidas de sequencia ela tem e quantas tem rotulo.
     *
     * Vai no resultado da escrita e na leitura da tela — e' assim que o modelo descobre, sem
     * ninguem decidir por ele, que a decisao que ele acabou de criar esta' pela metade.
     */
    caminhosDe(id) {
      const el = this.porId(id);
      if (!el) return null;
      const saidas = (Array.isArray(el.outgoing) ? el.outgoing : [])
        .filter((c) => String(c?.type) === 'bpmn:SequenceFlow');
      const rotulados = saidas.filter((c) => String(c?.businessObject?.name ?? '').trim()).length;
      return { caminhos: saidas.length, rotulados };
    },

    /**
     * Sem ancora. `dentro` e o elemento que vai receber (pool, raia, processo); sem ele, o
     * primeiro candidato que as REGRAS do bpmn-js aceitarem.
     *
     * ⚠ Nunca a raiz por padrao: numa colaboracao a raiz nao guarda fluxo, e insistir nela
     * desenha a forma na tela com o XML quebrado (ver `aceita`).
     */
    criarSolto({ tipo, dentro = null, nome = '' }) {
      const forma = formaDe(tipo, nome);
      const alvo = dentro ?? candidatosPara(forma)[0] ?? null;
      if (!alvo || !aceita(forma, alvo)) throw new Error('sem_lugar_para_criar');
      return modeling.createShape(forma, vagaSolta(alvo, forma), alvo);
    },

    /** Os lugares que ACEITAM um elemento deste tipo. Quem decide e o `rules` do bpmn-js. */
    lugaresParaCriar(tipo) {
      return candidatosPara(formaDe(tipo));
    },

    /** A raiz do desenho: é ela que diz se o diagrama é um processo plano ou uma colaboração. */
    raiz() {
      try {
        return canvas.getRootElement();
      } catch {
        return null;
      }
    },

    /**
     * Cria um POOL (participante).
     *
     * ⚠ `createParticipantShape` e não `createShape`: é ele que cria o `bpmn:Process` do pool
     * (`processRef`). Um participante SEM processo é um pool que não guarda nada — e o primeiro
     * elemento que o aluno pedisse lá dentro estouraria no `BpmnUpdater` com a forma já
     * desenhada, que é o mesmo fantasma do portão 4.5.
     *
     * No primeiro pool de um processo plano, o bpmn-js troca a RAIZ para colaboração e move todo
     * o conteúdo para dentro do pool novo (`CreateParticipantBehavior`). Isso não é efeito
     * colateral nosso: é o que o arrasto da paleta faz. O que é nosso é o tamanho (ver
     * `vagaDePool`) e dizer ao modelo que a raiz mudou.
     */
    criarPool({ nome = '' } = {}) {
      const raiz = canvas.getRootElement();
      const forma = elementFactory
        ? elementFactory.createParticipantShape()
        : { type: 'bpmn:Participant', width: 600, height: 250 };
      // Mesmo motivo de `formaDe`: o nome do pool no businessObject nasce com ele, e o
      // `Ctrl+Z` do aluno tira a caixa e o nome de uma vez.
      if (nome && forma.businessObject) forma.businessObject.name = nome;
      if (!aceita(forma, raiz)) throw new Error('sem_lugar_para_criar');
      const novo = modeling.createShape(forma, vagaDePool(raiz, forma), raiz);
      try { canvas.scrollToElement(novo); } catch { /* sem o verbo: o pool já está lá */ }
      return novo;
    },

    /**
     * Cria uma RAIA dentro de um pool (ou ao lado de outra raia).
     *
     * `modeling.addLane` é o mesmo verbo do botão de raia do bpmn-js: ele abre espaço no desenho
     * (empurra o que está abaixo), cria a faixa e — quando o pool ainda não tinha raia nenhuma —
     * cria TAMBÉM a faixa do conteúdo que já estava lá. É isso que faz "cria uma raia para o
     * entregador" não embaralhar o processo que o aluno já desenhou.
     */
    criarRaia({ alvo, onde = 'abaixo' }) {
      const lugar = String(onde).toLowerCase() === 'acima' ? 'top' : 'bottom';
      const nova = modeling.addLane(alvo, lugar);
      if (!nova) throw new Error('nada_mudou');
      try { canvas.scrollToElement(nova); } catch { /* sem o verbo: a raia já está lá */ }
      return nova;
    },

    /** As raias de um pool (ou as irmãs de uma raia). Leitura direta dos filhos. */
    raiasDe(el) {
      const dono = String(el?.type ?? '') === 'bpmn:Lane' ? el.parent : el;
      const filhos = Array.isArray(dono?.children) ? dono.children : [];
      return filhos.filter((e) => String(e?.type ?? '') === 'bpmn:Lane');
    },

    /** Os pools do desenho. Vazio = o diagrama é um processo plano. */
    pools() {
      return this.elementos().filter((e) => String(e?.type ?? '') === 'bpmn:Participant' && !e.labelTarget);
    },

    /**
     * Liga dois elementos e devolve a conexao que NASCEU.
     *
     * Nao escolhemos o tipo: entre pools o bpmn-js cria `bpmn:MessageFlow`, dentro do mesmo
     * processo `bpmn:SequenceFlow`. A regra do BPMN mora no bpmn-js; reimplementa-la aqui seria
     * ter duas versoes dela, e a nossa estaria errada primeiro.
     */
    ligar({ de, para }) {
      return modeling.connect(de, para);
    },

    renomear({ el, nome }) {
      modeling.updateLabel(el, nome);
    },

    remover({ el }) {
      modeling.removeElements([el]);
    },

    caixaDe(id) {
      return caixaDe(this.porId(id));
    },

    /**
     * O fluxo que vai de um elemento ao outro, se existir. Leitura direta do `outgoing` — a mesma
     * classe de `entradasESaidas`, sem busca e sem decisão.
     *
     * Existe porque o aluno fala em elementos ("entre o pedido e o preparo") e a inserção no meio
     * de uma sequência precisa do FLUXO. Fazer o modelo adivinhar um id de `Flow_…` seria pedir
     * que ele inventasse.
     */
    fluxoEntre(de, para) {
      const saidas = Array.isArray(de?.outgoing) ? de.outgoing : [];
      return saidas.find((f) => f?.target === para) ?? null;
    },

    /**
     * Move um elemento — `modeling.moveElements`, UM comando, um `Ctrl+Z`.
     *
     * Dois pedidos diferentes, de propósito:
     *  - `dentro`: "põe na raia de cima". O destino é um container, e o elemento vai para o MEIO
     *    da faixa dele mantendo o x (a coluna do processo). É assim que ele troca de raia/pool —
     *    e é o bpmn-js que atualiza o `flowNodeRef` do XML, não nós.
     *  - `direcao` + `passos`: "um pouco para a direita". Deslocamento relativo, porque o modelo
     *    NÃO vê coordenadas (a projeção manda id, tipo e nome — design H4) e um pixel absoluto
     *    vindo dele seria um palpite.
     *
     * ⚠ Sem verificação de vaga aqui: mover é o verbo com que o ALUNO arruma o desenho, e
     * recusar porque "tem alguém perto" tiraria dele a única ferramenta de arrumar. Quem recusa é
     * a regra do bpmn-js (a mesma do arrasto), e a leitura de volta diz se andou.
     */
    mover({ el, dentro = null, direcao = null, passos = 1 }) {
      const antes = caixaDe(el);
      if (!antes) throw new Error('sem_geometria');

      let delta;
      if (dentro) {
        const faixa = caixaDe(dentro);
        if (!faixa) throw new Error('sem_geometria');
        delta = { x: 0, y: Math.round((faixa.y + faixa.h / 2) - (antes.y + antes.h / 2)) };
        // Trocar de POOL costuma pedir o x também: a coluna do pool de origem pode estar fora da
        // caixa do destino, e aí o elemento ficaria desenhado do lado de fora da faixa nova.
        if (antes.x < faixa.x || antes.x + antes.w > faixa.x + faixa.w) {
          delta.x = Math.round(faixa.x + 60 - antes.x);
        }
      } else {
        const d = DIRECOES[String(direcao ?? '').toLowerCase()];
        if (!d) throw new Error('direcao_invalida');
        const n = Math.min(Math.max(Math.round(Number(passos) || 1), 1), 5) * PASSO_PX;
        delta = { x: d.x * n, y: d.y * n };
      }

      const alvo = dentro ?? el.parent ?? canvas.getRootElement();
      const centro = { x: antes.x + antes.w / 2 + delta.x, y: antes.y + antes.h / 2 + delta.y };
      if (rules) {
        try {
          const ok = rules.allowed('elements.move', { shapes: [el], target: alvo, delta, position: centro });
          if (ok === false) throw new Error('sem_lugar_para_mover');
        } catch (err) {
          if (/sem_lugar_para_mover/.test(err?.message ?? '')) throw err;
          // Regra que estoura não é recusa: segue para o `modeling`, que recusa por conta própria.
        }
      }

      modeling.moveElements([el], delta, alvo);
      try { canvas.scrollToElement(el); } catch { /* sem o verbo: o elemento já está lá */ }
      return { antes, depois: caixaDe(this.porId(el.id)) };
    },

    /**
     * Alinha dois ou mais elementos. `tipo` é o do bpmn-js: `middle` (mesma linha, centros na
     * mesma altura) ou `center` (mesma coluna).
     *
     * ⚠ `trigger` é SILENCIOSO quando a regra `elements.align` recusa ou quando sobra menos de
     * dois elementos — devolve `undefined` e não muda nada. Por isso quem chama LÊ de volta: sem
     * isso, "alinhei" seria dito sobre um desenho intacto.
     */
    alinhar({ els, tipo }) {
      if (!alinhador) throw new Error('sem_alinhador');
      const antes = els.map((e) => ({ id: e.id, caixa: caixaDe(e) }));
      alinhador.trigger(els, tipo);
      /**
       * ALINHAR NÃO PODE EMPILHAR.
       *
       * ⚠ `middle`/`top`/`bottom` igualam o Y e **não tocam no X** — então duas formas que já
       * estavam perto viram uma só na tela, com o nome de uma por cima do nome da outra. Foi o
       * que o dono fotografou em 2026-11-15, pedindo exatamente "deixa na mesma linha": o
       * comando fez o que promete e o desenho ficou ilegível. Depois de alinhar, quem ficou por
       * cima anda para a direita o mínimo para caber — na ordem em que já estavam.
       *
       * Só no eixo horizontal: `left`/`right`/`center` empilham na vertical de propósito (uma
       * coluna), e separá-las ali desfaria o que o aluno pediu.
       */
      const separados = ['middle', 'top', 'bottom'].includes(String(tipo)) ? separarNaLinha(els) : 0;
      /**
       * A SETA VAI JUNTO.
       *
       * ⚠ Alinhar mexe nas FORMAS; os waypoints da ligação continuam onde estavam, então duas
       * tarefas na mesma linha ficavam unidas por uma seta em degrau — o desenho dizendo que
       * estão desalinhadas enquanto elas estão alinhadas (print do dono, 2026-11-15: "ele alinhou
       * corretamente, só que a linha ficou errada ainda"). `layoutConnection` é o mesmo roteador
       * do bpmn-js que desenha a seta quando ela nasce.
       */
      const endireitadas = endireitarEntre(els);
      return {
        antes,
        depois: els.map((e) => ({ id: e.id, caixa: caixaDe(this.porId(e.id)) })),
        separados,
        endireitadas,
      };
    },

    /**
     * Troca o TIPO de um elemento preservando o que o aluno construiu em volta.
     *
     * `bpmnReplace.replaceElement` é o mesmo serviço do menu de troca do bpmn-js: copia nome e
     * propriedades compatíveis e RELIGA os fluxos. O caminho ingênuo (remover e criar) apagaria
     * as ligações — e o aluno pediu para mudar um símbolo, não para desmontar o processo.
     *
     * ⚠ O elemento novo tem id NOVO. Quem chama precisa devolver esse id ao modelo, senão o
     * próximo pedido dele fala de um elemento que não existe mais.
     */
    trocarTipo({ el, tipo }) {
      if (!substituidor) throw new Error('sem_substituidor');
      return substituidor.replaceElement(el, { type: tipo });
    },

    /**
     * Insere um elemento NO MEIO de um fluxo: A→B vira A→novo→B.
     *
     * Quem faz o religamento é o bpmn-js (`DropOnFlowBehavior`), disparado por criar a forma
     * tendo o FLUXO como pai — é o mesmo caminho de arrastar uma tarefa da paleta sobre uma seta.
     * Reconectar na mão seria três comandos (e três `Ctrl+Z`) fazendo o que um já faz.
     *
     * ⚠ É o verbo que faltava quando o aluno diz "esqueci de verificar o pagamento": `depoisDe`
     * num elemento que JÁ tem sucessor cria um RAMO, e o bpmn-js desenha ramo um degrau abaixo —
     * correto para o BPMN, e não era o que ele pediu.
     */
    /**
     * Desfaz o último comando — o MESMO `Ctrl+Z` do aluno, na mesma pilha.
     *
     * `canUndo()` antes é o que separa "desfiz" de "não havia nada": sem ele, `undo()` numa pilha
     * vazia não faz nada e não avisa, e o agente diria ao aluno que voltou atrás.
     */
    desfazer({ quantos = 1 } = {}) {
      if (!pilha || typeof pilha.undo !== 'function') throw new Error('sem_pilha');
      const da = () => (typeof pilha.canUndo === 'function' ? Boolean(pilha.canUndo()) : true);
      if (!da()) throw new Error('nada_para_desfazer');
      /**
       * EM LOTE, e com teto (divida E1). O aluno diz "desfaz isso tudo" depois de o agente ter
       * escrito tres vezes no mesmo turno, e um `undo` por pedido fazia o modelo chamar a
       * ferramenta em sequencia — cada chamada custando um turno.
       *
       * ⚠ O laco PARA quando a pilha esvazia, e devolve quantos de fato voltaram: pedir 5 numa
       * pilha de 2 nao e erro, e dizer "desfiz 5" seria mentira. Teto de 10 porque a pilha e a
       * MESMA do aluno — um lote maior apagaria o trabalho dele, que o agente nao viu.
       */
      const pedidos = Math.min(10, Math.max(1, Math.trunc(Number(quantos) || 1)));
      let feitos = 0;
      while (feitos < pedidos && da()) { pilha.undo(); feitos += 1; }
      return {
        desfeitos: feitos,
        pedidos,
        aindaDaParaDesfazer: typeof pilha.canUndo === 'function' ? Boolean(pilha.canUndo()) : null,
      };
    },

    /**
     * Quantos grupos desfaziveis o diagrama acumulou nesta sessao. A escrita compara antes e
     * depois e devolve a diferenca ao modelo — e' o `quantos` de `desfazer`.
     */
    get comandosRegistrados() { return comandos; },

    /**
     * PISCA o elemento que acabou de mudar — onde o aluno está olhando.
     *
     * ⚠ Durante uma construção de doze elementos, o canvas não dava sinal nenhum: a forma
     * aparecia e pronto. O dono (2026-11-17): *"o usuário está vendo e não sabe que está
     * acontecendo alguma coisa"*. O chat falava; o desenho, não.
     *
     * ⚠ NÃO é `setColor`: cor entra no DI e fica no arquivo do aluno depois que a curiosidade
     * passou. Marca do próprio canvas, que sai sozinha e não existe no XML.
     */
    destacarBrevemente(id, ms = 600) {
      const el = this.porId(id);
      if (!el || typeof canvas.addMarker !== 'function') return false;
      try {
        canvas.addMarker(el.id, 'bpmn-assist-pisca');
        setTimeout(() => {
          try { canvas.removeMarker(el.id, 'bpmn-assist-pisca'); } catch { /* elemento saiu: nada a tirar */ }
        }, Math.max(100, ms));
        return true;
      } catch {
        return false;
      }
    },

    /** Pinta (ou despinta) elementos. `modeling.setColor` grava no DI — desfazível como o resto. */
    destacar({ els, cores }) {
      modeling.setColor(els, cores);
    },

    /**
     * A cor que está no DI. É `moddle`, então aceita as duas formas de leitura — e nenhuma delas
     * pode derrubar a ferramenta se a propriedade não existir no descritor.
     */
    corDe(id) {
      const di = this.porId(id)?.di ?? null;
      const ler = (chave) => {
        try {
          const v = typeof di?.get === 'function' ? di.get(chave) : di?.[chave];
          return typeof v === 'string' ? v : null;
        } catch {
          return null;
        }
      };
      return { fundo: ler('background-color'), borda: ler('border-color') };
    },

    inserirEntre({ fluxo, tipo, nome = '' }) {
      const forma = formaDe(tipo, nome);
      /**
       * ABRIR ESPAÇO ANTES DE ENTRAR — senão o elemento novo nasce EM CIMA dos vizinhos.
       *
       * ⚠ Duas tarefas lado a lado têm uns 50 px de vão, e uma tarefa tem 100 de largura: o
       * meio do fluxo é exatamente onde não cabe. O resultado era o que o dono fotografou em
       * 2026-11-15 — "embalar" sobreposto a "Select a pizza" e a "Order a pizza", ilegível — e
       * o religamento estava certo: quem estava errado era o desenho.
       *
       * O empurrão vai para o que está À DIREITA do ponto de entrada, no mesmo pai, e só para
       * formas (pool e raia não andam: elas crescem sozinhas quando o conteúdo passa da borda).
       */
      const de = fluxo?.source;
      const para = fluxo?.target;
      if (de && para) {
        const precisa = (forma.width ?? 100) + 80;
        const vao = (para.x ?? 0) - ((de.x ?? 0) + (de.width ?? 0));
        if (vao < precisa) empurrarParaDireita(para, precisa - vao);
      }
      const ponto = meioDoFluxo(fluxo);
      if (!ponto || !aceita(forma, fluxo, ponto)) throw new Error('sem_lugar_para_criar');
      // O endireitamento entra DENTRO do `shape.create` (ver `juntoDoComando`): antes, as 4 ou 5
      // chamadas de roteamento viravam 4 ou 5 `Ctrl+Z` que o aluno gastava antes de a forma sair.
      const seNaoCorreu = juntoDoComando('shape.create', (ctx) => {
        endireitarVizinhanca([de, para, ctx?.shape ?? null]);
      });
      const novo = modeling.createShape(forma, ponto, fluxo);
      /**
       * E AS SETAS DA VIZINHANÇA SÃO REDESENHADAS.
       *
       * ⚠ Entrar no meio de um fluxo não mexe nas OUTRAS ligações que passam por ali — e numa
       * região com laço (o caso do dono: o gateway baseado em eventos volta para "Ask for the
       * pizza") uma delas passava POR CIMA do elemento novo. Pedir para "resolver" só movia a
       * forma: a linha continuava torta, porque ninguém a recalculava.
       *
       * Redesenha só o que toca a vizinhança imediata (origem, destino e o novo). Isso descarta
       * um traçado que o aluno tenha ajustado à mão ali — é o preço, e o outro lado da moeda era
       * uma seta cortando uma tarefa.
       */
      seNaoCorreu();
      try { canvas.scrollToElement(novo); } catch { /* sem o verbo: o elemento já está lá */ }
      return novo;
    },

    /**
     * Leva um elemento que JÁ EXISTE para o meio de um fluxo: A→B vira A→el→B.
     *
     * ⚠ É a operação que faltava, e a falta dela saiu cara duas vezes: o dono pediu para pôr
     * uma tarefa recém-criada entre outras duas e o modelo **criou outra**, porque criar era o
     * único verbo que sabia entrar num fluxo (os dois gêmeos de 2026-11-15).
     *
     * A ordem importa e é esta: fecha o buraco que o elemento deixa (liga o antecessor dele ao
     * sucessor, quando há um de cada), solta as ligações dele, abre espaço, leva a forma para o
     * meio e refaz as ligações — tudo pelo `modeling`, que é quem sabe reposicionar waypoints.
     * São vários comandos: o aluno desfaz com vários `Ctrl+Z`, e é o preço de não ter um verbo
     * único no bpmn-js para isto.
     */
    moverParaOMeio({ el, fluxo }) {
      if (!el || !fluxo?.source || !fluxo?.target) throw new Error('sem_lugar_para_mover');
      if (el === fluxo.source || el === fluxo.target) throw new Error('sem_lugar_para_mover');
      const de = fluxo.source;
      const para = fluxo.target;

      const entradas = (el.incoming ?? []).filter((c) => String(c.type) === 'bpmn:SequenceFlow');
      const saidas = (el.outgoing ?? []).filter((c) => String(c.type) === 'bpmn:SequenceFlow');
      // Fecha o buraco: quem vinha nele passa a ir direto para quem saía dele.
      const antes = entradas[0]?.source ?? null;
      const depois = saidas[0]?.target ?? null;
      for (const c of [...entradas, ...saidas]) {
        try { modeling.removeConnection(c); } catch { /* já removida */ }
      }
      if (antes && depois && antes !== depois && antes !== el && depois !== el) {
        try { ligarSeFaltar(antes, depois); } catch { /* o bpmn-js recusou: fica sem o atalho */ }
      }

      // Espaço e posição: o mesmo cálculo de quando o elemento nasce no meio.
      const caixa = caixaDe(el);
      const precisa = (caixa?.w ?? 100) + 80;
      const vao = (para.x ?? 0) - ((de.x ?? 0) + (de.width ?? 0));
      if (vao < precisa) empurrarParaDireita(para, precisa - vao);
      const alvoX = Math.round(((de.x ?? 0) + (de.width ?? 0) + (para.x ?? 0)) / 2 - (el.width ?? 100) / 2);
      const alvoY = Math.round((de.y ?? 0) + (de.height ?? 0) / 2 - (el.height ?? 80) / 2);
      modeling.moveElements([el], { x: alvoX - (el.x ?? 0), y: alvoY - (el.y ?? 0) }, el.parent);

      /**
       * E o religamento — **só do que faltar**.
       *
       * ⚠ O `moveElements` acima pode JÁ ter religado tudo, sem a gente pedir: o bpmn-js tem o
       * **DropOnFlowBehavior**, que parte a conexão sozinho quando uma forma é solta em cima
       * dela — e é exatamente isso que "levar para o meio do fluxo" faz. Chamar `connect` depois
       * dele criava o SEGUNDO par: duas setas entre os mesmos dois elementos, desenhadas uma
       * sobre a outra, que o aluno vê como uma e o XML conta como duas.
       *
       * Medido no portão `mover para o meio NAO duplica a seta` (2026-11-15): `entradas` e
       * `saidas` com **duas** cada, e as ligações do desenho indo de 24 para **26**. Não se
       * desliga o comportamento do bpmn-js (é ele que faz arrastar-para-dentro-do-fluxo
       * funcionar na mão) — liga-se só o que faltar.
       */
      const velho = fluxoEntreDireto(de, para);
      if (velho) {
        try { modeling.removeConnection(velho); } catch { /* já removida */ }
      }
      const entrada = ligarSeFaltar(de, el);
      const saida = ligarSeFaltar(el, para);
      endireitarVizinhanca([de, para, el]);
      return { entrada: entrada?.id ?? null, saida: saida?.id ?? null };
    },

    /**
     * Assina eventos do modelador e devolve como desassinar. Quem decide o que fazer é o dono.
     *
     * ⚠ **O RETORNO DO LISTENER É ENGOLIDO DE PROPÓSITO.** No EventBus do diagram-js, um
     * listener que devolve qualquer coisa diferente de `undefined` **encerra a propagação** — e
     * todo listener registrado DEPOIS dele deixa de ser chamado, em silêncio. A outra sessão
     * desta mesma tarde achou o estrago no `src/app.js`, onde o autosave era `async` (e `async`
     * devolve sempre uma Promise): ele vinha engolindo `commandStack.changed` para todo mundo,
     * desde sempre.
     *
     * Nossos três listeners hoje não devolvem nada — mas isso é disciplina, e disciplina quebra
     * no dia em que alguém escrever `() => dizer(...)` em vez de `() => { dizer(...); }`. Uma
     * linha aqui tira a classe inteira de defeito, para quem assina hoje e para quem assinar
     * depois. Quem precisar PARAR a propagação (ninguém precisa) usa o `eventBus` direto, e aí
     * está escolhendo isso.
     */
    assinar(nomes, fn) {
      const lista = Array.isArray(nomes) ? nomes : [nomes];
      const seguro = (...args) => { fn(...args); };
      for (const nome of lista) eventBus.on(nome, seguro);
      return () => {
        for (const nome of lista) {
          try { eventBus.off(nome, seguro); } catch { /* já desligado */ }
        }
      };
    },
  };
}
