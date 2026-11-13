// O que o aluno VÊ quando uma ferramenta roda (H3, colhido de `wiki-tool-activity.mjs`).
//
// Hoje ele vê a resposta e não vê o que foi consultado: a ferramenta roda invisível, e quando a
// resposta demora ele não sabe se o ajudante está pensando, travado, ou se a cota acabou.
//
// A separação é o ponto inteiro, e são três coisas distintas com três donos:
//
//   resultado  -> para o MODELO, completo e intocado. Ele continua recebendo cada fato.
//   detalhe    -> resumo TIPADO, só do lado do cliente. Não volta para o modelo.
//   linha      -> UMA linha curta para a tela.
//
// O defeito que isso mata está documentado na cápsula: a extensão devolvia `JSON.stringify(result)`
// como conteúdo da ferramenta e o renderizador imprimia — uma busca enterrava o terminal num muro
// de `{"results":[{"page":...}]}` antes de aparecer uma frase humana.
//
// ⚠ Este arquivo NÃO decide nada: não autoriza, não roteia, não escolhe ferramenta. Ele só
// apresenta o que já aconteceu. Quem decide o que pode rodar é a política; quem escolhe a
// ferramenta é o modelo.

/** Plural sem gambiarra: a conta é do chamador, a palavra é daqui. */
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

/**
 * Uma linha por ferramenta. Cada entrada recebe `(entrada, resultado)` e devolve a linha da tela.
 *
 * Ferramenta sem entrada aqui cai no genérico — o que é melhor que um `JSON.stringify` e pior que
 * uma linha escrita à mão, e por isso é só a rede de segurança.
 */
const COMO_MOSTRAR = {
  descrever_diagrama: (_e, r) => {
    if (!r || r.ok === false) return 'olhei o diagrama';
    const partes = [];
    if (r.total != null) partes.push(plural(r.total, 'elemento', 'elementos'));
    if (r.raias?.length) partes.push(plural(r.raias.length, 'raia', 'raias'));
    if (r.selecionado?.nome) partes.push(`selecionado: ${r.selecionado.nome}`);
    return partes.length ? `olhei o diagrama — ${partes.join(' · ')}` : 'olhei o diagrama';
  },

  buscar_elemento: (e, r) => {
    const termo = r?.procurou?.termo ?? e?.termo;
    const alvo = termo ? `"${termo}"` : 'o diagrama';
    if (!r || r.ok === false) return `procurei ${alvo}`;
    const achou = r.total ?? r.elementos?.length ?? 0;
    // O "no diagrama INTEIRO" é a diferença que o aluno precisa entender: a amostra do contexto é
    // parcial, a busca não é. Sem isso, "não achei" soa como "não existe" (contrato H13).
    const onde = r.varreuODiagramaInteiro ? 'no diagrama inteiro' : 'na amostra';
    if (!achou) return `procurei ${alvo} ${onde} — nada`;
    // `cortou` é o que separa "achei 3" de "achei 3 destes 47": esconder isso faria o aluno ler a
    // amostra como se fosse o diagrama.
    const resto = r.cortou ? ` (mostrando ${r.elementos?.length ?? 0})` : '';
    return `procurei ${alvo} ${onde} — ${plural(achou, 'resultado', 'resultados')}${resto}`;
  },

  detalhar_elemento: (e, r) => {
    if (!r || r.ok === false) return 'abri um elemento';
    const nome = r.nome || e?.id || 'um elemento';
    const entra = r.entradas?.length ?? 0;
    const sai = r.saidas?.length ?? 0;
    return `abri "${nome}" — ${entra} de entrada, ${sai} de saída`;
  },

  resumir_simulacao: (_e, r) => {
    if (!r || r.ok === false) return 'li a última simulação';
    const partes = [];
    if (r.replicacoes != null) partes.push(plural(r.replicacoes, 'replicação', 'replicações'));
    if (r.gargalo?.nome) partes.push(`gargalo: ${r.gargalo.nome}`);
    // Avisar que o diagrama mudou DEPOIS da corrida é o que impede o aluno de ler número velho
    // como se fosse do desenho de agora.
    if (r.diagramaMudouDepoisDaCorrida) partes.push('⚠ o diagrama mudou depois da corrida');
    return partes.length ? `li a última simulação — ${partes.join(' · ')}` : 'li a última simulação';
  },

  lembrar: (e, r) => (r?.guardado
    ? `anotei${e?.categoria ? ` (${e.categoria})` : ''}`
    : 'tentei anotar'),
};

/** Enquanto roda: o aluno precisa saber que há algo acontecendo, antes de haver resultado. */
export function linhaDeInicio(nome) {
  return ({
    descrever_diagrama: 'olhando o diagrama…',
    buscar_elemento: 'procurando no diagrama…',
    detalhar_elemento: 'abrindo o elemento…',
    resumir_simulacao: 'lendo a simulação…',
    lembrar: 'anotando…',
  })[nome] ?? `${nome}…`;
}

/**
 * A linha da tela para uma ferramenta que terminou.
 *
 * Falha vira frase, não código: `ferramenta_nao_roteada` não diz nada a um aluno de BPMN.
 */
export function linhaDeFim(nome, entrada, resposta) {
  if (resposta && resposta.ok === false) {
    return `${linhaDeInicio(nome).replace(/…$/, '')} — não deu`;
  }
  // ⚠ O despachante entrega um ENVELOPE — `{ ok, resultado }` —, não o retorno cru da ferramenta.
  // Ler o envelope como se fosse o resultado fazia a busca dizer "na amostra" quando ela varre o
  // diagrama inteiro: o campo estava um nível abaixo. Visto ao vivo em 2026-11-13, com os testes
  // verdes — porque eles alimentavam a forma crua, que nunca chega aqui.
  const resultado = (resposta && typeof resposta === 'object' && 'resultado' in resposta)
    ? resposta.resultado
    : resposta;
  const como = COMO_MOSTRAR[nome];
  try {
    return como ? como(entrada ?? {}, resultado ?? {}) : `usei ${nome}`;
  } catch {
    // Apresentador NUNCA derruba a conversa: na dúvida, a linha genérica.
    return `usei ${nome}`;
  }
}
