// Catálogo de ferramentas: o que o modelo pode CHAMAR, declarado num lugar só.
//
// Por que existe: a declaração que vai no `setup` e a política que o despachante consulta têm de
// nascer da mesma lista. Duas listas divergem no primeiro dia — e a divergência aparece como
// `ferramenta_nao_roteada` no meio de uma conversa, que o aluno lê como o agente quebrado.
//
// ⚠ Quem ESCOLHE a ferramenta é o modelo, por function calling. Nunca palavra-chave no nosso
// código decidindo por ele (constituição §III). Aqui só se declara o que existe e para quem.
//
// Cada entrada declara o que a ferramenta FAZ (`escreve`) e onde ela vale (`perfis`); quem lê
// esses campos e decide é `policy.js`. A separação importa: catálogo é o que existe, política é
// o que está ligado NESTA sessão — e só a segunda muda quando o aluno troca de página ou de modo.
//
// ponytail: um array e duas funções. Sem registry, sem decorator, sem plugin.

import { CATEGORIAS } from './memory.js';
import { TIPOS_CRIAVEIS } from '../tools/escrita.js';

export const FERRAMENTAS = Object.freeze([
  {
    nome: 'lembrar',
    // Escreve na MEMÓRIA, não no diagrama do aluno: o viewer pode guardar lembrete sem risco.
    escreve: false,
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
    escreve: false,
    // Leitura pura. Nasceu no GATE 4.3 — é com ela que se mediu que uma sessão de VOZ chama
    // ferramenta e continua falando.
    declaracao: {
      name: 'descrever_diagrama',
      description:
        'Devolve o estado atual do diagrama aberto: contagem por tipo, raias e pools, e o '
        + 'elemento selecionado. Use quando precisar conferir o diagrama antes de responder.',
      parameters: { type: 'object', properties: {} },
    },
  },

  {
    nome: 'buscar_elemento',
    escreve: false,
    // ⚠ É a ferramenta que varre o REGISTRO INTEIRO. A lista que chega no contexto é amostra
    // com teto, e dela não se conclui ausência (design H13) — daqui, sim. A descrição diz isso
    // ao modelo, porque é a diferença que decide quando ele precisa chamar.
    declaracao: {
      name: 'buscar_elemento',
      description:
        'Procura elementos no diagrama INTEIRO por parte do nome e/ou por tipo, ignorando acento '
        + 'e maiúsculas. Use antes de afirmar que algo não existe: a lista de elementos que você '
        + 'recebe no contexto é só uma amostra, e esta busca varre tudo.',
      parameters: {
        type: 'object',
        properties: {
          termo: { type: 'string', description: 'Pedaço do nome do elemento, como o aluno falou.' },
          tipo: {
            type: 'string',
            description: 'Tipo BPMN, por exemplo Task, StartEvent, ExclusiveGateway, SequenceFlow.',
          },
        },
      },
    },
  },

  {
    nome: 'detalhar_elemento',
    escreve: false,
    declaracao: {
      name: 'detalhar_elemento',
      description:
        'Mostra um elemento pelo id: tipo, nome, onde ele está e quais fluxos entram e saem '
        + 'dele. Use para explicar o que o aluno selecionou ou o que a busca encontrou.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'O id do elemento, como veio da busca ou do contexto.' } },
        required: ['id'],
      },
    },
  },

  {
    nome: 'resumir_simulacao',
    escreve: false,
    // ⚠ LÊ a última corrida; não dispara simulação (design T5). Uma corrida em lote leva
    // segundos e repinta a tela inteira — efeito grande demais para sair de uma frase ambígua.
    declaracao: {
      name: 'resumir_simulacao',
      description:
        'Resume a ÚLTIMA simulação em lote que o aluno rodou: replicações, throughput médio, '
        + 'WIP médio e a tarefa com maior espera (o gargalo). Você não dispara simulação — se '
        + 'não houver corrida, diga que ele precisa rodar uma. O resultado avisa quando o '
        + 'diagrama mudou depois da corrida; nesse caso, diga que a métrica é do desenho anterior.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ---------------------------------------------------------------- escrita (F7, só modelador)
  // ⚠ As quatro nascem `escreve: true`, e é esse campo — não um nome especial — que faz a
  // política esconder todas numa página que só lê. A regra já existia desde a F5, esperando a
  // primeira ferramenta que escrevesse.

  {
    nome: 'criar_elemento',
    escreve: true,
    declaracao: {
      name: 'criar_elemento',
      description:
        'Cria um elemento no diagrama do aluno. Passe depoisDe com o id de um elemento que já '
        + 'existe sempre que der: assim o novo nasce posicionado E já ligado ao anterior, que é '
        + 'o que o aluno quer quando diz "uma tarefa depois do início". Sem depoisDe o elemento '
        + 'fica solto numa posição fixa e pode cobrir outro. O resultado diz o id criado e se a '
        + 'ligação foi feita.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: [...TIPOS_CRIAVEIS],
            description: 'Tipo BPMN do elemento, sem o prefixo bpmn:.',
          },
          nome: { type: 'string', description: 'O rótulo que aparece no desenho.' },
          depoisDe: {
            type: 'string',
            description: 'Id do elemento que vem ANTES. Use o id do contexto ou da busca.',
          },
        },
        required: ['tipo'],
      },
    },
  },

  {
    nome: 'conectar',
    escreve: true,
    // ⚠ A declaração NÃO pede o tipo da ligação, e isso é de propósito: quem decide entre fluxo
    // de sequência e fluxo de mensagem é a regra do BPMN dentro do bpmn-js. O resultado DIZ qual
    // nasceu — é daí que sai a explicação certa quando os dois estão em pools diferentes.
    declaracao: {
      name: 'conectar',
      description:
        'Liga dois elementos do diagrama pelos ids. Você não escolhe o tipo da ligação: dentro '
        + 'do mesmo processo nasce um fluxo de sequência, entre pools diferentes nasce um fluxo '
        + 'de mensagem. O resultado diz qual dos dois foi criado — conte isso ao aluno. Se a '
        + 'ligação não for permitida, o erro é conexao_invalida.',
      parameters: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'Id do elemento de origem.' },
          para: { type: 'string', description: 'Id do elemento de destino.' },
        },
        required: ['de', 'para'],
      },
    },
  },

  {
    nome: 'renomear',
    escreve: true,
    declaracao: {
      name: 'renomear',
      description:
        'Troca o rótulo de um elemento do diagrama. O resultado traz o nome de antes e o de '
        + 'agora. Id que não existe devolve elemento_nao_encontrado.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id do elemento.' },
          nome: { type: 'string', description: 'O novo rótulo.' },
        },
        required: ['id', 'nome'],
      },
    },
  },

  {
    nome: 'remover',
    escreve: true,
    // ⚠ Destrutiva, e o aluno CONFIRMA na tela antes de executar. A declaração avisa o modelo
    // disso para ele não narrar a remoção antes de ter o resultado — recusa do aluno é uma
    // resposta legítima e comum, não falha.
    declaracao: {
      name: 'remover',
      description:
        'Apaga um elemento do diagrama. O aluno CONFIRMA na tela antes de a remoção acontecer: '
        + 'não diga que removeu antes de receber o resultado. Se ele recusar, o resultado traz '
        + 'recusadoPeloAluno: true — avise que nada foi apagado. Se o diagrama mudar entre o '
        + 'pedido e o clique, o erro é diagrama_mudou e você deve procurar o elemento de novo.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Id do elemento a apagar.' } },
        required: ['id'],
      },
    },
  },
]);

/** Existe no catálogo? É só isso — se vale AQUI é pergunta da política (`policy.js`). */
export function declarada(nome) {
  return FERRAMENTAS.some((f) => f.nome === nome);
}
