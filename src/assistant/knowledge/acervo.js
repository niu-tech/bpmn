/**
 * O ACERVO — busca lexical sobre `dist/knowledge/index.json` (decisões K2, K3, K8).
 *
 * Duas funções e nenhuma dependência:
 *
 *  - `buscar(indice, termo)` é PURA: pontua título, tags, localizador e texto do trecho, com
 *    acento e caixa normalizados. Trinta linhas. Não entra `lunr` nem `flexsearch` — para 12
 *    verbetes e algumas dezenas de trechos, uma varredura pontuada responde em microssegundos e
 *    não acrescenta 30 KB ao que o visitante baixa.
 *  - `criarAcervo()` carrega o índice SOB DEMANDA e o mantém na aba. Quem nunca pergunta sobre a
 *    norma não baixa o acervo.
 *
 * ⚠ Falha de rede NÃO é lista vazia (K3). Lista vazia significa "procurei e não achou", e deixar
 * a falha se passar por ausência de conteúdo ensina o agente a afirmar que a norma não diz algo
 * que ela diz. O erro tem nome: `acervo_indisponivel`.
 *
 * ponytail: a busca é uma varredura O(trechos). O teto está medido na decisão K10 — passando de
 * ~200 trechos, troca-se por um índice invertido SEM trocar o formato da página, que é o que
 * custa caro.
 */

/** Sem acento, sem caixa, sem pontuação: "Gateway Exclusivo!" e "gateway exclusivo" casam. */
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Palavras que não distinguem nada numa pergunta de BPMN em português. Não é "stop words" de
 * linguística: é a lista curta do que apareceu nas perguntas reais e empatava tudo com tudo.
 */
const VAZIAS = new Set(['que', 'qual', 'quais', 'como', 'para', 'por', 'com', 'uma', 'dos', 'das',
  'nos', 'nas', 'sobre', 'quando', 'onde', 'isso', 'esse', 'essa', 'ele', 'ela', 'the', 'and']);

const PESOS = { titulo: 5, tag: 4, localizador: 3, texto: 1 };

/**
 * RADICAL CURTO, e não substring solta.
 *
 * ⚠ Com substring, "tempo" casava a tag **temporizador** e "como simular o tempo de fila"
 * respondia sobre evento de borda — medido na primeira corrida da busca. Com radical, "simular"
 * e "simulação" viram `simul` e se encontram, enquanto "tempo" e "temporizador" continuam
 * palavras diferentes. Corta terminações comuns do português e trunca em cinco: é grosseiro, cabe
 * em cinco linhas e resolve o caso real.
 */
function radical(palavra) {
  const p = palavra.replace(/(coes|cao|mentos|mento|ndo|dades|dade|mente|ais|oes|res|es|as|os|s)$/, '');
  return (p.length >= 4 ? p : palavra).slice(0, 5);
}

/** Os radicais ÚNICOS de um texto, como CONJUNTO: comparação por token, nunca por pedaço. */
function radicais(texto) {
  return new Set(normalizar(texto).split(' ').filter(Boolean).map(radical));
}

/**
 * Busca pontuada. Devolve os trechos mais próximos, cada um com o que a resposta precisa para
 * citar: modo de evidência, localizador, chave de citação e link oficial.
 */
export function buscar(indice, termo, { max = 3 } = {}) {
  const palavras = normalizar(termo).split(' ').filter((p) => p.length >= 3 && !VAZIAS.has(p));
  if (!palavras.length || !indice?.paginas?.length) return [];

  const procurados = palavras.map(radical);

  const achados = [];
  for (const pagina of indice.paginas) {
    const titulo = radicais(pagina.title);
    const tags = radicais((pagina.tags ?? []).join(' '));
    for (const trecho of pagina.chunks ?? []) {
      const localizador = radicais(trecho.locator);
      const texto = radicais(trecho.texto);
      let pontos = 0;
      for (const p of procurados) {
        if (titulo.has(p)) pontos += PESOS.titulo;
        if (tags.has(p)) pontos += PESOS.tag;
        if (localizador.has(p)) pontos += PESOS.localizador;
        // Conta UMA vez por palavra, e não por ocorrência: um trecho longo não ganha por ser longo.
        if (texto.has(p)) pontos += PESOS.texto;
      }
      if (pontos > 0) {
        achados.push({
          pontos,
          sourceId: pagina.sourceId,
          title: pagina.title,
          group: pagina.group,
          contentMode: pagina.contentMode,
          locator: trecho.locator,
          citationKey: trecho.citationKey,
          excerpt: trecho.texto,
          officialUrl: pagina.officialUrl,
          ...(pagina.rightsNote ? { rightsNote: pagina.rightsNote } : {}),
        });
      }
    }
  }

  return achados
    .sort((a, b) => b.pontos - a.pontos || a.citationKey.localeCompare(b.citationKey))
    .slice(0, Math.max(1, max))
    .map(({ pontos, ...resto }) => resto);
}

/**
 * O acervo da aba: carrega uma vez, responde sempre. `fetchImpl` e `url` são injetáveis para o
 * teste rodar sem rede e sem navegador.
 */
export function criarAcervo({ url = 'knowledge/index.json', fetchImpl = null } = {}) {
  let indice = null;
  let carregando = null;

  async function carregar() {
    if (indice) return indice;
    if (carregando) return carregando;
    const buscarRede = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
    if (!buscarRede) throw new Error('acervo_indisponivel');
    carregando = (async () => {
      let resposta;
      try {
        resposta = await buscarRede(url);
      } catch {
        throw new Error('acervo_indisponivel');
      }
      if (!resposta?.ok) throw new Error('acervo_indisponivel');
      try {
        indice = await resposta.json();
      } catch {
        throw new Error('acervo_indisponivel');
      }
      return indice;
    })().finally(() => { carregando = null; });
    return carregando;
  }

  return {
    get carregado() { return Boolean(indice); },
    /** O tamanho do acervo, para a resposta poder dizer "de N verbetes" (K8). */
    get tamanho() { return indice ? { verbetes: indice.verbetes, trechos: indice.trechos } : null; },
    async consultar(termo, { max = 3 } = {}) {
      const atual = await carregar();
      return {
        resultados: buscar(atual, termo, { max }),
        acervo: { verbetes: atual.verbetes, trechos: atual.trechos },
      };
    },
  };
}
