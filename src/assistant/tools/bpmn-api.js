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
// ponytail: um objeto com cinco funções e uma flag. Sem classe, sem injeção, sem container.

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
     * Cria o elemento JA LIGADO ao de antes. `appendShape` posiciona e conecta numa tacada — e
     * posicionar e conectar e justamente o que o aluno pede quando diz "depois do inicio".
     */
    criarDepoisDe({ ancora, tipo, nome }) {
      const alvo = ancora?.parent ?? canvas.getRootElement();
      return modeling.appendShape(ancora, { type: tipo, name: nome || undefined }, null, alvo);
    },

    /**
     * Sem ancora: posicao fixa na raiz.
     *
     * ponytail: ponto fixo, e dois elementos soltos se sobrepoem. O conserto e layout automatico
     * (tarefa 5.1, fora desta change) — nao um calculo de vaga livre inventado aqui.
     */
    criarSolto({ tipo, nome }) {
      const raiz = canvas.getRootElement();
      return modeling.createShape({ type: tipo, name: nome || undefined }, { x: 220, y: 200 }, raiz);
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
