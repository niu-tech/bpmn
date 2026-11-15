/**
 * `consultar_norma` — a ferramenta que lê o ACERVO (decisões K3, K4, K8).
 *
 * Leitura pura: não toca no diagrama, não escreve nada, e vale nos dois perfis (voz e texto).
 * O que ela devolve não é prosa livre — é o registro que permite CITAR: modo de evidência,
 * localizador, chave de citação, trecho e link oficial.
 *
 * Três contratos que o resultado carrega e que o agente não pode inventar:
 *
 *  - **o limite de evidência** (`contentMode`): `curated_card_only` é ficha editorial NOSSA —
 *    "pelo meu material sobre X…" —, e nunca pode ser atribuída à norma da OMG como citação
 *    literal. Hoje o acervo inteiro é assim (K5);
 *  - **o tamanho do acervo**: busca sem acerto devolve `acervo: {verbetes, trechos}` para a
 *    resposta ser *"não está no meu acervo de N verbetes"* e não *"a norma não trata disso"* (K8);
 *  - **a falha tem nome**: índice que não carrega é `acervo_indisponivel`, nunca lista vazia.
 *    Deixar a falha de rede se passar por ausência de conteúdo ensina o agente a afirmar que a
 *    norma não diz algo que ela diz (K3).
 */

export const ERRO_ACERVO = 'acervo_indisponivel';

/**
 * `aoServir` recebe as chaves de citação devolvidas — é assim que a sessão sabe o que PODE ser
 * citado quando conferir a resposta (K6). Sem isso, a conferência não teria contra o que medir.
 */
export function criarExecutorDeNorma({ acervo, aoServir = () => {} } = {}) {
  return {
    async consultar_norma({ termo, max } = {}) {
      const busca = typeof termo === 'string' ? termo.trim() : '';
      if (!busca) {
        const e = new Error('termo vazio: diga o que procurar no acervo');
        e.nome = 'tipo_invalido';
        throw e;
      }
      if (!acervo) {
        const e = new Error('esta página não tem acervo configurado');
        e.nome = ERRO_ACERVO;
        throw e;
      }

      let r;
      try {
        r = await acervo.consultar(busca, { max: Math.min(Math.max(Number(max) || 3, 1), 5) });
      } catch (err) {
        const e = new Error(`não consegui carregar o acervo (${err?.message ?? 'falha'})`);
        e.nome = ERRO_ACERVO;
        throw e;
      }

      for (const achado of r.resultados) aoServir(achado.citationKey);

      return {
        termo: busca,
        // Lista vazia aqui significa "procurei e não achou" — e só isso, porque a falha de rede
        // tem nome próprio acima.
        resultados: r.resultados,
        procurouNoAcervoInteiro: true,
        acervo: r.acervo,
        /**
         * A frase que o agente deve usar quando não acha. Vai pronta no resultado porque a
         * diferença entre "não está no meu acervo" e "a norma não trata disso" é a diferença
         * entre honestidade e invenção — e não dá para deixá-la por conta da redação do turno.
         */
        ...(r.resultados.length ? {} : {
          comoProsseguir: `não está no meu acervo de ${r.acervo.verbetes} verbetes; diga isso ao `
            + 'aluno com estas palavras, ofereça o que você sabe como conhecimento geral (sem '
            + 'citar fonte) e aponte o link oficial se ele quiser conferir',
        }),
      };
    },
  };
}
