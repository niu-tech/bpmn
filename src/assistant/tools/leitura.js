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

/**
 * O nome de um elemento é o do `businessObject` — e SÓ ele.
 *
 * ⚠ Havia um `?? el.name` aqui, e ele mentia. `elementFactory.createShape({ type, name })` deixa
 * o `name` como atributo da FORMA e nunca o leva ao `businessObject`; o desenho lê o
 * businessObject, então a tarefa nascia em branco na tela — e a leitura de volta, caindo no
 * atributo da forma, devolvia o nome pedido e dizia que tinha dado certo. Confirmação que lê o
 * campo errado é pior que confirmação nenhuma: ela ASSINA a mentira (print do portão F7,
 * 2026-11-14, tarefa criada sem rótulo com o agente narrando o nome).
 */
function nomeDe(el) {
  const n = el?.businessObject?.name ?? null;
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

/* ---------------------------------------------------------------- a tela, depois da ação
 *
 * Por que isto existe (change `close-the-loop-with-the-canvas`): a ferramenta devolvia O QUE ELA
 * FEZ, e o aluno olha O QUE FICOU NA TELA. São coisas diferentes, e o modelo só recebia a
 * primeira — então decidia o passo seguinte pela memória do que pediu, não pelo desenho.
 *
 * O preço de não ter isto foi medido: em menos de 48 horas nasceram CINCO campos de ocasião, um
 * por surpresa do bpmn-js — `ramo` e `avisoDeRamo` (criar depois de quem já tem saída desenha um
 * caminho paralelo), `virouColaboracao` e `adotou` (o primeiro pool troca a raiz do XML e engole
 * o desenho), `criouAFaixaDoQueJaExistia` (a primeira raia nasce em dupla). Cada um verdadeiro,
 * nenhum reaproveitável. Esta leitura os substitui todos, porque descreve o DESENHO e não a
 * operação: a próxima surpresa do bpmn-js já cabe aqui sem campo novo.
 *
 * ⚠ Curta por construção (H4). Não é o XML, não é a lista inteira: é o que muda a próxima
 * decisão, com teto declarado e o corte DITO. */

/** Teto da leitura, em caracteres. Passou disto, o resto é custo sem decisão. */
const MAX_TELA = 760;

/** Quantas pontas soltas são nomeadas antes de virar contagem. */
const MAX_SOLTAS = 4;

const COLABORACAO = 'bpmn:Collaboration';
const POOL = 'bpmn:Participant';
const RAIA = 'bpmn:Lane';

/** Pool e raia são o CONTINENTE: não entram na conta de "o que o aluno desenhou". */
const CONTINENTE = new Set([POOL, RAIA]);

const marca = (el) => {
  const n = nomeDe(el);
  return n ? `"${n}"` : `${tipoCurto(el?.type)} ${el?.id ?? '?'}`;
};

function raizDe(todos) {
  return todos.find((e) => !e.parent) ?? null;
}

/** As faixas de cada pool, por id. Raia aninhada conta na faixa de cima, como o bpmn-js desenha. */
function faixasPorPool(todos) {
  const contagem = {};
  for (const el of todos) {
    if (el?.type !== RAIA || !el.parent) continue;
    const dono = el.parent.id;
    contagem[dono] = (contagem[dono] ?? 0) + 1;
  }
  return contagem;
}

/**
 * Retrato de ANTES, tirado pela ferramenta imediatamente antes de aplicar a operação.
 *
 * Três números, nada de árvore: é o que permite a leitura contar a TRANSIÇÃO ("o diagrama virou
 * uma colaboração e o pool adotou o que já existia") sem que cada ferramenta precise do seu
 * próprio campo para isso.
 */
export function instantaneoDaTela(acesso) {
  if (!acesso?.disponivel) return null;
  const todos = uteis(acesso.elementos());
  const raiz = raizDe(todos);
  return {
    colaboracao: raiz?.type === COLABORACAO,
    formas: todos.filter((e) => e !== raiz && !e.waypoints && !CONTINENTE.has(e.type)).length,
    faixas: faixasPorPool(todos),
  };
}

/**
 * Os três fatos de ARRANJO que a leitura descobre, **em forma** — não em prosa.
 *
 * ⚠ Existe porque a leitura tem DOIS leitores, e um deles não lê português: o modelo recebe o
 * texto de `estadoDaTela`, e a LINHA DA TELA do aluno (`tools/apresentador.js`) precisa dos
 * mesmos fatos para dizer "como ramo paralelo", "e pôs 2 elementos dentro", "(e uma faixa para o
 * que já estava lá)". Ao retirar os cinco campos de ocasião, essas três frases ficaram sem fonte
 * e a linha do aluno emagreceu em silêncio — ele via o desenho inteiro pular para dentro de um
 * pool e lia só "criei o pool X".
 *
 * Um campo, uma forma, o MESMO produtor do texto. Não são os cinco campos de volta: nenhuma
 * ferramenta calcula nada aqui, e a próxima surpresa do bpmn-js continua cabendo na leitura.
 */
export function fatosDaTela(acesso, { tocado = null, antes = null } = {}) {
  if (!acesso?.disponivel) return null;

  let todos;
  try {
    todos = uteis(acesso.elementos());
  } catch {
    return null;
  }

  const raiz = raizDe(todos);
  const colaboracao = raiz?.type === COLABORACAO;
  const faixas = faixasPorPool(todos);
  const fatos = { colaboracao, adotou: null, ramo: null, faixas: [] };

  // O primeiro pool troca a raiz do XML para `bpmn:Collaboration` e engole o desenho que já
  // existia. Conta FORMA, não conexão: o bpmn-js leva as setas junto, e somá-las daria um número
  // que não bate com o que o aluno vê.
  if (antes && !antes.colaboracao && colaboracao) fatos.adotou = antes.formas;

  for (const p of todos.filter((e) => e?.type === POOL)) {
    const agora = faixas[p.id] ?? 0;
    const tinha = antes?.faixas?.[p.id] ?? 0;
    // A primeira raia de um pool nasce em DUPLA: a do que já estava lá, e a nova.
    if (antes && agora > tinha + 1) {
      fatos.faixas.push({ pool: p.id, nome: nomeDe(p), de: tinha, para: agora });
    }
  }

  const alvo = tocado ? acesso.porId(tocado) : null;
  if (alvo) {
    try {
      const anterior = acesso.entradasESaidas(alvo.id).entradas[0]?.source ?? null;
      const irmas = anterior ? acesso.entradasESaidas(anterior.id).saidas.length : 0;
      // Ramo paralelo: quem vem antes já tinha outra saída, e por isso o bpmn-js desceu um degrau.
      if (irmas > 1) fatos.ramo = { de: anterior.id, nome: nomeDe(anterior), saidas: irmas };
    } catch {
      // Registro inconsistente no meio da operação: sem fato é melhor que fato inventado.
    }
  }

  return fatos;
}

/**
 * A tela como o aluno a vê agora, em uma frase por fato.
 *
 * `tocado` é o id do elemento que a operação mexeu (quando há um); `antes` é o retrato de
 * `instantaneoDaTela` tirado antes dela.
 */
export function estadoDaTela(acesso, { tocado = null, antes = null } = {}) {
  if (!acesso?.disponivel) return 'Não há diagrama aberto nesta página.';

  let todos;
  try {
    todos = uteis(acesso.elementos());
  } catch {
    return 'O diagrama não pôde ser lido agora.';
  }

  const raiz = raizDe(todos);
  const colaboracao = raiz?.type === COLABORACAO;
  const conteudo = todos.filter((e) => e !== raiz);
  const formas = conteudo.filter((e) => !e.waypoints && !CONTINENTE.has(e.type));
  const ligacoes = conteudo.filter((e) => e.waypoints);
  const pools = conteudo.filter((e) => e.type === POOL);
  const faixas = faixasPorPool(todos);
  // Os fatos de arranjo saem de UM lugar só: o texto daqui e a linha da tela do aluno não podem
  // discordar sobre o que aconteceu com o desenho.
  const fatos = fatosDaTela(acesso, { tocado, antes }) ?? { adotou: null, ramo: null, faixas: [] };

  const partes = [];
  partes.push(
    `O diagrama é ${colaboracao ? 'uma colaboração' : 'um processo'} com `
    + `${formas.length} ${formas.length === 1 ? 'forma' : 'formas'} e `
    + `${ligacoes.length} ${ligacoes.length === 1 ? 'ligação' : 'ligações'}.`,
  );

  // A transição que reorganiza o desenho inteiro: sem ela o aluno vê tudo mudar de lugar sem explicação.
  if (fatos.adotou !== null) {
    partes.push(
      `O diagrama virou uma colaboração: as ${fatos.adotou} formas que já estavam desenhadas `
      + 'passaram a ficar dentro do pool novo (as ligações foram junto).',
    );
  }

  // Processo com raias e SEM pool: existe (é o que vem de um diagrama importado, e de muito
  // material de aula). Sem esta linha, a leitura descreveria um desenho com faixas como se não
  // tivesse nenhuma — porque faixa é continente e não entra na conta de formas.
  if (!pools.length && (faixas[raiz?.id] ?? 0) > 0) {
    const n = faixas[raiz.id];
    partes.push(`O processo tem ${n} ${n === 1 ? 'faixa' : 'faixas'}, sem pool.`);
  }

  if (pools.length) {
    partes.push(`Pools: ${pools.map((p) => {
      const n = faixas[p.id] ?? 0;
      return `${marca(p)} (${n === 0 ? 'sem faixas' : `${n} ${n === 1 ? 'faixa' : 'faixas'}`})`;
    }).join(', ')}.`);
    for (const nova of fatos.faixas) {
      const p = pools.find((x) => x.id === nova.pool);
      if (!p) continue;
      partes.push(`${marca(p)} passou de ${nova.de} para ${nova.para} faixas: a faixa do que já estava no pool também foi criada.`);
    }
  }

  const selecionado = (() => {
    try {
      return acesso.selecionado();
    } catch {
      return null;
    }
  })();
  if (selecionado && !selecionado.labelTarget) {
    partes.push(`O aluno tem ${marca(selecionado)} selecionado.`);
  }

  const alvo = tocado ? acesso.porId(tocado) : null;
  if (alvo) {
    const { entradas, saidas } = acesso.entradasESaidas(alvo.id);
    partes.push(
      `${marca(alvo)} (${tipoCurto(alvo.type)}) tem `
      + `${entradas.length} de entrada e ${saidas.length} de saída.`,
    );
    // Ramo paralelo: quem vem antes já tinha outra saída, e por isso o bpmn-js desceu um degrau.
    const anterior = fatos.ramo ? entradas[0]?.source ?? null : null;
    if (anterior) {
      partes.push(
        `${marca(anterior)} tem ${fatos.ramo.saidas} saídas, então ${marca(alvo)} é um caminho paralelo, `
        + 'desenhado abaixo da linha — não a continuação dela. Para pôr no meio da sequência, '
        + 'use criar_elemento com entre.',
      );
    }
  }

  // Ponta solta é o defeito mais comum de aluno, e o agente não enxergava nenhuma.
  const soltas = formas.filter((e) => {
    const { entradas, saidas } = acesso.entradasESaidas(e.id);
    return entradas.length === 0 && saidas.length === 0;
  });
  if (soltas.length) {
    const nomeadas = soltas.slice(0, MAX_SOLTAS).map(marca).join(', ');
    partes.push(
      `Sem nenhuma ligação: ${nomeadas}`
      + (soltas.length > MAX_SOLTAS ? ` e mais ${soltas.length - MAX_SOLTAS}.` : '.'),
    );
  }

  partes.push('Você não apaga, não move e não troca o tipo de nada que o aluno não tenha pedido ou confirmado.');

  const texto = partes.join(' ');
  return texto.length <= MAX_TELA ? texto : `${texto.slice(0, MAX_TELA)}… (leitura cortada)`;
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
