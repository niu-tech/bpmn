// As quatro ferramentas de LEITURA do diagrama (fase F6, bloco 2 do `add-bpmn-diagram-tools`).
//
// O que muda em relação ao contexto que o agente já recebe a cada turno: o contexto é uma
// AMOSTRA com teto (design H4), e a amostra não permite afirmar inexistência (H13). Estas
// ferramentas varrem o REGISTRO INTEIRO — é exatamente essa diferença que justifica cada uma
// existir, e é ela que transforma *"não consta no resumo que recebi"* em *"não existe"*.
//
// Três regras que valem para todas:
//
//  1. **Erro nomeado, nunca silêncio** (design T3). Conjunto fechado: `elemento_nao_encontrado`,
//     `sem_diagrama`, `sem_corrida`. "Deu erro" faz o modelo tentar de novo igual; um nome faz
//     ele mudar de passo.
//  2. **Nenhuma delas escreve.** Nem no diagrama, nem na simulação (design T5: o agente comenta
//     a corrida, não a dispara — uma corrida em lote leva segundos e muda a tela inteira).
//  3. **Resultado com teto, e o corte é DITO.** Devolver 400 elementos ao modelo é a cota do
//     aluno indo embora para ele reler o que já tem.
//
// ponytail: funções puras sobre a camada fina. Sem classe de ferramenta, sem registry, sem
// middleware — o despachante já é o lugar da política e do teto de tempo.

/** Teto de itens por busca. O corte é declarado no próprio resultado. */
const MAX_RESULTADOS = 20;

export const ERROS_LEITURA = Object.freeze({
  SEM_DIAGRAMA: 'sem_diagrama',
  NAO_ENCONTRADO: 'elemento_nao_encontrado',
  SEM_CORRIDA: 'sem_corrida',
});

/** `bpmn:ExclusiveGateway` -> `ExclusiveGateway`. Mesma regra da projeção. */
function tipoCurto(type) {
  const t = String(type ?? 'desconhecido');
  return t.startsWith('bpmn:') ? t.slice(5) : t;
}

function nomeDe(el) {
  const n = el?.businessObject?.name ?? el?.name ?? null;
  const t = typeof n === 'string' ? n.trim() : '';
  return t.length ? t : null;
}

function resumir(el) {
  return { id: el?.id ?? '?', tipo: tipoCurto(el?.type), nome: nomeDe(el) };
}

/** Sem acento, sem caixa: o aluno escreve "pedido recebido" e o diagrama diz "Pedido Recebido". */
function dobrar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Rótulo externo é o mesmo elemento desenhado duas vezes — nunca entra em contagem nem em lista. */
function uteis(elementos) {
  return (Array.isArray(elementos) ? elementos : []).filter((e) => e && !e.labelTarget);
}

/**
 * Assinatura barata do diagrama: quantidade + ids em ordem. Serve para dizer se o desenho mudou
 * DEPOIS de uma corrida de simulação — apresentar métrica velha como estado atual é o erro que
 * a tarefa 2.4 existe para impedir.
 */
export function assinaturaDoDiagrama(elementos) {
  const ids = uteis(elementos).map((e) => e.id).sort();
  return `${ids.length}:${ids.join(',')}`;
}

/**
 * Monta os executores de leitura. Recebe a camada fina (`tools/bpmn-api.js`) e, opcionalmente,
 * de onde vem a última corrida de simulação — que é a PÁGINA quem registra, porque é ela que
 * roda a simulação (design T5).
 */
export function criarExecutoresDeLeitura({ acesso, lerSimulacao = () => null } = {}) {
  const exigirDiagrama = () => {
    if (!acesso?.disponivel) {
      const e = new Error(ERROS_LEITURA.SEM_DIAGRAMA);
      e.nome = ERROS_LEITURA.SEM_DIAGRAMA;
      throw e;
    }
  };

  return {
    /**
     * O estado do diagrama inteiro. É o mesmo retrato que o contexto já manda a cada turno —
     * existe como ferramenta para o modelo CONFERIR quando desconfia, e porque numa sessão de
     * voz foi ela que provou que dá para chamar ferramenta e continuar falando (gate 4.3).
     */
    async descrever_diagrama() {
      exigirDiagrama();
      const todos = uteis(acesso.elementos());
      const raiz = todos.find((e) => !e.parent) ?? null;
      const conteudo = todos.filter((e) => e !== raiz);

      const contagem = {};
      const raias = [];
      for (const e of conteudo) {
        const tipo = tipoCurto(e.type);
        contagem[tipo] = (contagem[tipo] ?? 0) + 1;
        if (e.type === 'bpmn:Lane' || e.type === 'bpmn:Participant') {
          raias.push(nomeDe(e) ?? `(${tipo.toLowerCase()} sem nome)`);
        }
      }

      const sel = acesso.selecionado();
      return {
        processo: raiz ? { id: raiz.id ?? null, nome: nomeDe(raiz) } : null,
        total: conteudo.length,
        contagem,
        raias,
        selecionado: sel && !sel.labelTarget ? resumir(sel) : null,
      };
    },

    /**
     * Busca no REGISTRO INTEIRO — não na amostra do contexto. É esta ferramenta que permite ao
     * agente dizer "não existe" em vez de "não consta no resumo que recebi" (design H13).
     *
     * `termo` casa por pedaço do nome, sem acento e sem caixa; `tipo` filtra por tipo BPMN
     * (com ou sem o prefixo `bpmn:`). Os dois são opcionais e se somam.
     */
    async buscar_elemento({ termo, tipo } = {}) {
      exigirDiagrama();
      const alvo = dobrar(termo);
      const tipoAlvo = dobrar(tipo).replace(/^bpmn:/, '');

      const todos = uteis(acesso.elementos()).filter((e) => e.parent);
      const achados = todos.filter((e) => {
        const casaNome = !alvo || dobrar(nomeDe(e)).includes(alvo);
        const casaTipo = !tipoAlvo || dobrar(tipoCurto(e.type)) === tipoAlvo;
        return casaNome && casaTipo;
      });

      const mostrados = achados.slice(0, MAX_RESULTADOS).map(resumir);
      return {
        procurou: { termo: termo ?? null, tipo: tipo ?? null },
        // A varredura foi COMPLETA: é isso que autoriza o modelo a concluir ausência.
        varreuODiagramaInteiro: true,
        total: achados.length,
        elementos: mostrados,
        cortou: achados.length > mostrados.length ? achados.length - mostrados.length : 0,
      };
    },

    /** Um elemento por `id`, com quem entra e quem sai dele. */
    async detalhar_elemento({ id } = {}) {
      exigirDiagrama();
      const el = acesso.porId(id);
      if (!el || el.labelTarget) {
        // Erro NOMEADO: é o que faz o modelo procurar antes de tentar de novo igual.
        const e = new Error(`${ERROS_LEITURA.NAO_ENCONTRADO}: ${id}`);
        e.nome = ERROS_LEITURA.NAO_ENCONTRADO;
        throw e;
      }
      const { entradas, saidas } = acesso.entradasESaidas(id);
      return {
        ...resumir(el),
        dentroDe: el.parent ? resumir(el.parent) : null,
        entradas: entradas.map(resumir),
        saidas: saidas.map(resumir),
      };
    },

    /**
     * A ÚLTIMA corrida de simulação — lida, nunca disparada (design T5).
     *
     * ⚠ Avisa quando o diagrama mudou depois da corrida. Sem isso, métrica velha é apresentada
     * como estado atual: o aluno move uma tarefa, pergunta do gargalo, e recebe o gargalo de um
     * desenho que não existe mais.
     */
    async resumir_simulacao() {
      const corrida = lerSimulacao();
      if (!corrida?.resumo) {
        const e = new Error(ERROS_LEITURA.SEM_CORRIDA);
        e.nome = ERROS_LEITURA.SEM_CORRIDA;
        throw e;
      }

      const { summaryRows = [], taskRows = [] } = corrida.resumo;
      const media = (lista, campo) => (lista.length
        ? Number((lista.reduce((a, b) => a + (Number(b?.[campo]) || 0), 0) / lista.length).toFixed(4))
        : null);

      // Gargalo = a tarefa onde se espera mais. Espera é fila; duração é o trabalho em si.
      const porTarefa = new Map();
      for (const linha of taskRows) {
        const id = linha?.taskId;
        if (!id) continue;
        const atual = porTarefa.get(id) ?? { id, execucoes: 0, esperaTotal: 0, duracaoTotal: 0 };
        atual.execucoes += 1;
        atual.esperaTotal += Number(linha.waitTime) || 0;
        atual.duracaoTotal += Number(linha.duration) || 0;
        porTarefa.set(id, atual);
      }
      const tarefas = [...porTarefa.values()].map((t) => ({
        id: t.id,
        nome: nomeDe(acesso?.porId?.(t.id)) ?? null,
        execucoes: t.execucoes,
        esperaMedia: Number((t.esperaTotal / t.execucoes).toFixed(4)),
        duracaoMedia: Number((t.duracaoTotal / t.execucoes).toFixed(4)),
      })).sort((a, b) => b.esperaMedia - a.esperaMedia);

      const assinaturaAgora = acesso?.disponivel ? assinaturaDoDiagrama(acesso.elementos()) : null;
      const mudou = Boolean(corrida.assinatura && assinaturaAgora && corrida.assinatura !== assinaturaAgora);

      return {
        quando: corrida.quando ?? null,
        replicacoes: summaryRows.length,
        throughputMedio: media(summaryRows, 'throughput'),
        wipMedio: media(summaryRows, 'avgWip'),
        casosConcluidosMedia: media(summaryRows, 'completedCases'),
        gargalo: tarefas[0] ?? null,
        tarefas: tarefas.slice(0, MAX_RESULTADOS),
        diagramaMudouDepoisDaCorrida: mudou,
        aviso: mudou
          ? 'o diagrama mudou depois desta corrida: as métricas são do desenho anterior'
          : undefined,
      };
    },
  };
}
