/**
 * Como o produto chama o agente, e as frases que ele escreve no lugar do aluno.
 *
 * ⚠ ESTE ARQUIVO EXISTE PORQUE O NOME ESTAVA SOLTO EM TRÊS LUGARES. O dono, vendo a tela base
 * (2026-11-16): *"podemos melhorar isso de tutor, está repetido 3 vezes, podemos deixar mais claro
 * que temos um agente de IA especializado em ensinar sobre BPMN"*. A repetição era sintoma: a tela
 * dizia "tutor" 3×, o painel e a alavanca diziam "Ajudante BPMN" e o código diz `ajudante` —
 * três nomes para uma coisa, e nenhum deles dizendo o que ela é. Uma fonte resolve os dois.
 *
 * Puro de propósito (sem DOM, sem CSS): roda no `node`, no `npm test`, e é o que permite o teste
 * do limite do compositor existir sem navegador.
 */

/**
 * O nome, de PAPEL — não de pessoa, e sem "IA" dentro dele.
 *
 * "Tutor" é literalmente o que o dono pediu deixar claro (ensinar BPMN); "BPMN" escopa o agente ao
 * produto, em vez de deixá-lo parecer um chatbot de uso geral. A orientação de design system que
 * sustenta isso (Genesys) é manter "AI" fora do nome da feature e usar o papel — a capacidade vai
 * na frase abaixo, onde informa em vez de inflar. Detalhe e alternativas recusadas: `design.md` N1
 * da change `name-the-tutor-and-anchor-the-exit`.
 */
export const NOME = 'Tutor BPMN';

/**
 * O que ele é, dito UMA vez por superfície.
 *
 * ⚠ O ESCOPO (BPMN) ESTÁ NO NOME; aqui vai a CAPACIDADE. Separar as duas é o que evita "Tutor
 * BPMN — agente especializado em BPMN", que diz a mesma palavra duas vezes e informa uma.
 *
 * ⚠ Cada pedaço desta frase aponta para um portão que já fechou: "ensina a notação" porque o
 * acervo de verbetes e a `consultar_norma` existem (change `add-bpmn-norm-knowledge-base`), e
 * "desenha junto" porque a escrita passa pelo `modeling` do bpmn-js (constituição §VII). Nada
 * aqui promete proposta nomeada (F8, aberto). Prometer na primeira tela o que o agente ainda não
 * faz é a forma mais barata de estragar a primeira impressão.
 */
export const O_QUE_E = 'um agente de IA que ensina a notação e desenha junto com você';

/**
 * O teto de uma frase semeada no compositor, em caracteres — MEDIDO, não escolhido.
 *
 * O compositor é `rows=1`, `height: 42px`, `resize: none`: uma linha, por desenho. Medido na
 * página (1280×860, painel aberto): caixa de 317 px, `clientHeight` 40. A frase antiga
 * ("Quero modelar o MEU processo — vou te descrever", 47 caracteres) rendia `scrollHeight` 52 —
 * ou seja, a primeira coisa que o produto escrevia no lugar do aluno JÁ CHEGAVA CORTADA, que foi
 * exatamente o que o dono relatou. 33 é o que cabe com folga de uma palavra curta.
 *
 * As fontes de sugestão clicável dão 3–6 palavras e ~20–25 caracteres como regra de bolso, e dizem
 * — com razão — que o limite confiável é o que a SUA interface corta. O nosso corta aqui.
 */
export const LIMITE_COMPOSITOR = 33;

/**
 * As frases que a tela base e a orientação deixam PRONTAS no compositor — digitadas, nunca
 * enviadas. Quem manda continua sendo o aluno (constituição §III).
 *
 * ⚠ Todas abaixo de `LIMITE_COMPOSITOR`, e há teste que reprova quem passar. Note o que saiu:
 * o `MEU` em maiúscula. Ênfase gritada é a forma mais barata de parecer que o produto não confia
 * em quem lê — e ela estava justamente na frase que o aluno manda como se fosse dele.
 */
export const FRASES = Object.freeze({
  /** Trilha "descreva o seu processo", e a mesma frase clicável que o painel oferece. */
  descrever: 'Vou te descrever o meu processo',
  /** Quem não sabe o que é BPMN e pediu uma introdução. */
  descobrir: 'O que é BPMN?',
  /** Trilha do exemplo, sem nada selecionado. */
  exemplo: 'O que esse processo faz?',
});

/** Como a orientação pergunta sobre a forma que o aluno acabou de clicar. */
export function fraseSobre(nome) {
  return `O que faz "${nome}"?`;
}
