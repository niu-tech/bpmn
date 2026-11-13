// A camada fina sobre o bpmn-js (openspec design T6, tarefa 1.2).
//
// Por que existe: as ferramentas precisam de SEIS coisas do modelador. Deixar cada uma chamar
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
    elementos: () => [],
    porId: () => null,
    selecionado: () => null,
    entradasESaidas: () => ({ entradas: [], saidas: [] }),
    assinar: () => () => {},
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
  if (!registry || !eventBus) return inerte;

  return {
    disponivel: true,

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
