// A tela, do jeito que o agente a enxerga (openspec design H4, fase F3).
//
// Duas metades que não se misturam:
//
//   `projetar(elementos, …)`  PURA. Recebe a lista do `elementRegistry` e devolve a projeção.
//                             Testável em Node com objetos simples, sem bpmn-js e sem navegador.
//   `observarDiagrama(…)`     A costura com o bpmn-js: assina o `eventBus` e marca SUJO. Não
//                             recalcula no evento — recalcula quando alguém lê (tarefa 3.2).
//
// ⚠ NUNCA o XML (H4). O `pizza-collaboration.bpmn` tem 22 KB; mandá-lo a cada turno queima a cota
// do aluno para o modelo reler o que já sabe. O que vai é contagem, raias, amostra e o elemento
// selecionado — e a amostra DIZ que é amostra (H13).
//
// ponytail: duas funções e um `let sujo`. Sem store, sem observable, sem debounce com timer — o
// recálculo é preguiçoso por construção, que é mais simples do que agendar.

/** Teto da amostra. O corte é declarado ao modelo pelo renderizador, nunca silencioso. */
const MAX_AMOSTRA = 25;
/** Raias e pools: o bastante para situar, não o bastante para virar despejo. */
const MAX_RAIAS = 12;

/** Tipos que descrevem o continente, não o conteúdo. Entram em `raias`, fora da contagem útil. */
const TIPOS_DE_RAIA = new Set(['bpmn:Lane', 'bpmn:Participant']);

/**
 * Projeção a partir dos elementos do registro. `elementos` é o que `elementRegistry.getAll()`
 * devolve — ou qualquer array com a mesma forma (`{id, type, businessObject, parent, waypoints}`).
 *
 * `selecionado` é o elemento que o aluno clicou (`selection.get()[0]`), ou `null`.
 */
export function projetar(elementos, { selecionado = null, maxAmostra = MAX_AMOSTRA } = {}) {
  const todos = Array.isArray(elementos) ? elementos : [];

  // Rótulo externo é o MESMO elemento desenhado duas vezes: contá-lo dobraria toda tarefa que
  // tem nome, e o agente responderia "8 tarefas" para um diagrama de 4.
  const uteis = todos.filter((e) => e && !e.labelTarget);

  // A raiz é quem não tem pai: o processo (ou a colaboração) que contém o resto.
  const raiz = uteis.find((e) => !e.parent) ?? null;
  const conteudo = uteis.filter((e) => e !== raiz);

  const contagem = {};
  const raias = [];
  for (const e of conteudo) {
    const tipo = tipoCurto(e.type);
    contagem[tipo] = (contagem[tipo] ?? 0) + 1;
    if (TIPOS_DE_RAIA.has(e.type) && raias.length < MAX_RAIAS) {
      raias.push(nomeDe(e) ?? `(${tipo.toLowerCase()} sem nome)`);
    }
  }

  // Nós antes de conexões: numa amostra com teto, "Receber pedido" vale mais que `Flow_0x9a1`.
  const ordenados = [...conteudo].sort((a, b) => peso(a) - peso(b));

  return {
    processo: raiz ? { id: raiz.id ?? null, nome: nomeDe(raiz) } : null,
    total: conteudo.length,
    contagem,
    raias,
    amostra: ordenados.slice(0, maxAmostra).map(resumir),
    selecionado: selecionado && !selecionado.labelTarget ? resumir(selecionado) : null,
  };
}

/** `bpmn:ExclusiveGateway` -> `ExclusiveGateway`. O prefixo é a mesma palavra 25 vezes. */
function tipoCurto(type) {
  const t = String(type ?? 'desconhecido');
  return t.startsWith('bpmn:') ? t.slice(5) : t;
}

function nomeDe(e) {
  const n = e?.businessObject?.name ?? e?.name ?? null;
  const t = typeof n === 'string' ? n.trim() : '';
  return t.length ? t : null;
}

function resumir(e) {
  return { id: e?.id ?? '?', tipo: tipoCurto(e?.type), nome: nomeDe(e) };
}

/** Conexão por último: tem waypoints e quase nunca tem nome. */
function peso(e) {
  return Array.isArray(e?.waypoints) ? 1 : 0;
}

/**
 * Liga a projeção ao modelador vivo (tarefa 3.2).
 *
 * `modelador` é o `BpmnModeler` ou o `NavigatedViewer` — os dois respondem `.get('…')`. Qualquer
 * coisa diferente disso devolve um observador inerte, porque o ajudante não pode derrubar o
 * modelador: montar sem diagrama é um caso normal (o aluno abre o site antes de importar nada).
 *
 * O contrato é PUXADO, não empurrado: o evento só marca `sujo`, e o cálculo acontece no `atual()`
 * — que é chamado nas bordas de turno. Clicar em dez elementos seguidos não produz dez projeções.
 */
export function observarDiagrama(modelador, { onMudou = null } = {}) {
  const inerte = { atual: () => null, dispose() {} };
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

  let sujo = true;
  let cache = null;

  const sujar = () => {
    sujo = true;
    onMudou?.();
  };

  // `import.done` também: trocar de diagrama inteiro não emite `elements.changed` para o que
  // saiu, e sem ele a projeção ficaria falando do arquivo anterior.
  const eventos = ['elements.changed', 'selection.changed', 'import.done', 'shape.added', 'shape.removed'];
  for (const nome of eventos) eventBus.on(nome, sujar);

  return {
    atual() {
      if (!sujo && cache) return cache;
      try {
        cache = projetar(registry.getAll(), { selecionado: selection?.get?.()[0] ?? null });
        sujo = false;
      } catch {
        // Registro inconsistente no meio de um import: melhor o contexto anterior (ou nenhum)
        // do que derrubar o turno do aluno.
        return cache;
      }
      return cache;
    },
    dispose() {
      for (const nome of eventos) {
        try { eventBus.off(nome, sujar); } catch { /* já desligado */ }
      }
    },
  };
}
