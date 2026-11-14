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
   * Onde cai um elemento SOLTO (sem âncora): embaixo de tudo o que já está desenhado.
   *
   * ponytail: é um `max(y)+folga`, não um motor de disposição. Sem âncora não há de onde o
   * bpmn-js pendurar, e a montagem guiada cria o início solto e PENDURA o resto nele — então
   * esta é a única posição que escolhemos, e ela só precisa não nascer por cima.
   */
  const vagaAbaixoDeTudo = () => {
    let formas = [];
    try {
      formas = (registry.getAll() ?? []).filter(
        (e) => e?.parent && !e.labelTarget && Number.isFinite(e.y) && Number.isFinite(e.height),
      );
    } catch { /* registro inconsistente: cai no ponto de partida */ }
    if (!formas.length) return { x: 220, y: 200 };
    return { x: 220, y: Math.max(...formas.map((e) => e.y + e.height)) + 80 };
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
      const novo = modeling.appendShape(ancora, forma, vagaDepoisDe(ancora, forma), alvo);
      // Criar fora da area visivel e, para o aluno, nao ter criado nada. O botao de append do
      // bpmn-js tambem rola ate o elemento novo.
      try { canvas.scrollToElement(novo); } catch { /* sem o verbo: o elemento ja' esta la' */ }
      return novo;
    },

    /**
     * Sem ancora: embaixo do que ja existe (ver `vagaAbaixoDeTudo`). Diagrama vazio comeca em
     * cima, que e onde o aluno esta olhando.
     */
    criarSolto({ tipo }) {
      const raiz = canvas.getRootElement();
      return modeling.createShape({ type: tipo }, vagaAbaixoDeTudo(), raiz);
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
