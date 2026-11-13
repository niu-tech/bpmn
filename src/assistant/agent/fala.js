// Fala e tela são canais DIFERENTES (H2, colhido de `turn-output.mjs` da WikiAgentCapsule).
//
// A regra: o que soa como máquina — id de elemento, caminho, chave de citação, JSON — pertence à
// TELA, nunca ao ouvido. No incidente que originou o módulo lá, o agente falava
// `wiki/concepts/x.md line 42` no meio da frase. Aqui o equivalente é dizer em voz alta
// `[_6-638]`: o aluno não tem o que fazer com isso ouvindo, e perde o fio da explicação.
//
// ⚠ DIFERENÇA IMPORTANTE para a cápsula: lá o texto passa por nós antes de virar áudio, então dá
// para LIMPAR. Aqui o modelo fala direto pelo Gemini Live — não existe texto nosso no meio. Então
// este arquivo faz duas coisas honestas, e nenhuma delas é "consertar a fala depois":
//
//   1. `instrucaoDeCanais()` — a regra, dita ao modelo no prompt. É o único lugar onde ela pode
//      atuar de verdade;
//   2. `contarCitacoesFaladas()` — a MEDIÇÃO, sobre a legenda (que espelha o que foi falado).
//      Serve de asserção mecânica na bateria: se a conta não é zero, o modelo falou id, e o
//      conserto é a prosa do prompt — não um filtro que esconde o sintoma.
//
// ⚠ E uma coisa que este arquivo NÃO faz: decidir comportamento a partir de palavra. Os padrões
// abaixo são de FORMA (um id tem formato, um caminho tem barra), nunca de vocabulário — nenhum
// deles pergunta "o aluno disse tal palavra?". Essa classe de heurística é proibida neste projeto.

/** Formas que soam como máquina quando lidas em voz alta. Forma, nunca vocabulário. */
const FORMAS_DE_MAQUINA = [
  /\[[A-Za-z_][\w-]*\]/g,               // [_6-638], [Task_1] — id de elemento entre colchetes
  /\b[A-Za-z]+_[0-9A-Za-z][0-9A-Za-z-]*\b/g,     // Task_1, StartEvent_0x9f — id solto
  /\b[\w.-]+\/[\w./-]+\.\w{2,4}\b/g,    // caminho/arquivo.ext
  /[{[]\s*"[\w-]+"\s*:/g,               // JSON cru
  /```[\s\S]*?```/g,                    // bloco de código
];

/**
 * Quantas citações de máquina há num texto FALADO. Zero é o contrato.
 *
 * É medição, não filtro: o número existe para reprovar a prosa do prompt quando ela não segura o
 * modelo, e não para mascarar o que ele disse.
 */
export function contarCitacoesFaladas(texto) {
  if (!texto) return 0;
  let n = 0;
  for (const re of FORMAS_DE_MAQUINA) n += (String(texto).match(re) ?? []).length;
  return n;
}

/** As citações encontradas, para o relatório poder MOSTRAR o que vazou em vez de só contar. */
export function citacoesFaladas(texto) {
  if (!texto) return [];
  const achadas = [];
  for (const re of FORMAS_DE_MAQUINA) achadas.push(...(String(texto).match(re) ?? []));
  return achadas;
}

/** A regra, como o modelo a recebe. Em voz é instrução; em texto a tela é o próprio canal. */
export function instrucaoDeCanais() {
  return [
    'Você está FALANDO com o aluno. Id de elemento, caminho de arquivo, JSON e código não se dizem',
    'em voz alta — ninguém anota um id ouvindo, e o aluno perde o fio da explicação. Refira-se aos',
    'elementos pelo NOME e pelo tipo ("a tarefa Preparar pedido", "o gateway depois dela"). O id',
    'continua existindo e aparece na tela quando for preciso; a sua parte é a explicação.',
  ].join(' ');
}
