// Catálogo de ferramentas: o que o modelo pode CHAMAR, declarado num lugar só.
//
// Por que existe: a declaração que vai no `setup` e a política que o despachante consulta têm de
// nascer da mesma lista. Duas listas divergem no primeiro dia — e a divergência aparece como
// `ferramenta_nao_roteada` no meio de uma conversa, que o aluno lê como o agente quebrado.
//
// ⚠ Quem ESCOLHE a ferramenta é o modelo, por function calling. Nunca palavra-chave no nosso
// código decidindo por ele (constituição §III). Aqui só se declara o que existe e para quem.
//
// Esta é a forma MÍNIMA da fase F4: duas ferramentas e uma política por perfil. A F5 traz o
// catálogo completo com política default-deny declarada, a varredura mecânica contra
// keyword→tool e os cenários de recusa (tarefas 6.1–6.5 do `tasks.md`).
//
// ponytail: um array e duas funções. Sem registry, sem decorator, sem plugin.

import { CATEGORIAS } from './memory.js';

export const FERRAMENTAS = Object.freeze([
  {
    nome: 'lembrar',
    // Só o modelo sabe que "responda curto" é preferência e que "meu processo é de atendimento"
    // é fato. Tentar adivinhar isso no código seria classificar intenção por texto — exatamente
    // o que a constituição proíbe.
    declaracao: {
      name: 'lembrar',
      description:
        'Guarda uma informação desta conversa para usar nos próximos turnos. Use quando o aluno '
        + 'disser algo sobre o processo dele, quando vocês fecharem uma decisão de modelagem, ou '
        + 'quando ele pedir um jeito de ser respondido. Não guarde o que já está no diagrama.',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            enum: [...CATEGORIAS],
            description:
              'fato = algo que o aluno declarou sobre o processo ou o contexto dele; '
              + 'decisao = escolha de modelagem fechada na conversa; '
              + 'preferencia = como ele quer que você responda.',
          },
          texto: {
            type: 'string',
            description: 'A informação em uma frase curta, nas palavras do aluno quando possível.',
          },
        },
        required: ['categoria', 'texto'],
      },
    },
  },

  {
    nome: 'descrever_diagrama',
    // Leitura pura. Existe nesta fase por causa do GATE 4.3: é com ela que se mede se uma sessão
    // de VOZ consegue chamar ferramenta e continuar falando. A versão completa (com busca e
    // detalhe por elemento) é da F6, na change irmã.
    declaracao: {
      name: 'descrever_diagrama',
      description:
        'Devolve o estado atual do diagrama aberto: contagem por tipo, raias e pools, e o '
        + 'elemento selecionado. Use quando precisar conferir o diagrama antes de responder.',
      parameters: { type: 'object', properties: {} },
    },
  },
]);

/**
 * O que é declarado ao modelo neste perfil.
 *
 * ⚠ `viewer` não muda nada AINDA porque as duas ferramentas desta fase são inofensivas numa
 * página que só lê. Quando a escrita existir (F7), é aqui que ela deixa de ser declarada — e o
 * teste do viewer já confere `somenteLeitura` no contexto desde a F2.
 */
export function ferramentasDoPerfil() {
  return FERRAMENTAS.map((f) => f.declaracao);
}

/** Política do despachante: default-deny de verdade — nome fora da lista não executa. */
export function permitida(nome) {
  return FERRAMENTAS.some((f) => f.nome === nome);
}
