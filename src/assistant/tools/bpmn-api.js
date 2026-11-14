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
    entradasESaidas: () => ({ entradas: [], saidas: [] }),
    assinar: () => () => {},
    // Escrita no acesso inerte NAO e no-op silencioso: quem chamar recebe o mesmo erro nomeado
    // que receberia num viewer. No-op silencioso faria o agente narrar uma criacao que nao houve.
    criarDepoisDe: () => { throw new Error('pagina_somente_leitura'); },
    criarSolto: () => { throw new Error('pagina_somente_leitura'); },
    lugaresParaCriar: () => [],
    ligar: () => { throw new Error('pagina_somente_leitura'); },
    renomear: () => { throw new Error('pagina_somente_leitura'); },
    remover: () => { throw new Error('pagina_somente_leitura'); },
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

  const aceita = (forma, alvo) => {
    if (!alvo) return false;
    if (!rules) return !alvo.waypoints && !alvo.labelTarget;
    try {
      return rules.allowed('shape.create', { shape: forma, target: alvo }) !== false;
    } catch {
      return false;
    }
  };

  /** A forma pronta (com largura e altura) que as regras e a vaga precisam para decidir. */
  const formaDe = (tipo) => (elementFactory
    ? elementFactory.createShape({ type: tipo })
    : { type: tipo, width: 100, height: 80 });

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
    criarDepoisDe({ ancora, tipo }) {
      // ⚠ Sem `name` aqui: o atributo fica na FORMA e nunca chega ao `businessObject`, entao a
      // forma nasce anonima no desenho. Quem poe nome e `renomear` (`modeling.updateLabel`).
      const atributos = { type: tipo };
      const alvo = ancora?.parent ?? canvas.getRootElement();
      // Sem a fabrica nao da' para medir a vaga: append cru, no ponto fixo — pode sobrepor.
      if (!elementFactory) return modeling.appendShape(ancora, atributos, null, alvo);

      const forma = elementFactory.createShape(atributos);
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
     * Sem ancora. `dentro` e o elemento que vai receber (pool, raia, processo); sem ele, o
     * primeiro candidato que as REGRAS do bpmn-js aceitarem.
     *
     * ⚠ Nunca a raiz por padrao: numa colaboracao a raiz nao guarda fluxo, e insistir nela
     * desenha a forma na tela com o XML quebrado (ver `aceita`).
     */
    criarSolto({ tipo, dentro = null }) {
      const forma = formaDe(tipo);
      const alvo = dentro ?? candidatosPara(forma)[0] ?? null;
      if (!alvo || !aceita(forma, alvo)) throw new Error('sem_lugar_para_criar');
      return modeling.createShape(forma, vagaSolta(alvo, forma), alvo);
    },

    /** Os lugares que ACEITAM um elemento deste tipo. Quem decide e o `rules` do bpmn-js. */
    lugaresParaCriar(tipo) {
      return candidatosPara(formaDe(tipo));
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

    /** Assina eventos do modelador e devolve como desassinar. Quem decide o que fazer é o dono. */
    assinar(nomes, fn) {
      const lista = Array.isArray(nomes) ? nomes : [nomes];
      for (const nome of lista) eventBus.on(nome, fn);
      return () => {
        for (const nome of lista) {
          try { eventBus.off(nome, fn); } catch { /* já desligado */ }
        }
      };
    },
  };
}
