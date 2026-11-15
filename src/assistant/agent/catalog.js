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
import { CORES_DESTAQUE, DIRECOES_MOVER, EIXOS_ALINHAR, TIPOS_CRIAVEIS } from '../tools/escrita.js';

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
        + 'nasce solto, e aí ele precisa de um lugar: num diagrama com mais de um pool a '
        + 'ferramenta recusa com sem_lugar e devolve os nomes — pergunte ao aluno em qual e '
        + 'repita com dentroDe. Para pôr o elemento NO MEIO de uma sequência que já existe, use '
        + 'entre com os dois ids: depoisDe num elemento que já tem sucessor cria um RAMO '
        + 'paralelo, desenhado abaixo da linha, e o resultado avisa isso em avisoDeRamo. '
        + 'O resultado diz o id criado e se a ligação foi feita.',
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
          dentroDe: {
            type: 'string',
            description:
              'Id do pool, da raia ou do subprocesso que vai receber o elemento solto. Só faz '
              + 'sentido sem depoisDe. Use quando a ferramenta pedir, ou quando o aluno disser '
              + 'onde quer.',
          },
          entre: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Dois ids, na ordem do fluxo: o elemento novo entra NO MEIO da ligação que vai do '
              + 'primeiro para o segundo, e o diagrama fica anterior -> novo -> seguinte. Use '
              + 'quando o aluno disser que esqueceu um passo no meio do processo. Se não houver '
              + 'fluxo entre os dois, o erro é sem_lugar.',
          },
        },
        required: ['tipo'],
      },
    },
  },

  {
    nome: 'criar_pool',
    escreve: true,
    // ⚠ A declaração AVISA que o primeiro pool reestrutura o diagrama. Sem isso o modelo narra
    // "criei um pool" e o aluno vê o desenho inteiro mudar de lugar sem explicação.
    declaracao: {
      name: 'criar_pool',
      description:
        'Cria um pool (participante) — a caixa que representa QUEM executa o processo: uma '
        + 'empresa, um setor, um sistema. Use quando o aluno falar de mais de um lado do '
        + 'processo ("o cliente faz isso, a loja faz aquilo"). ATENÇÃO: num diagrama que ainda '
        + 'não tem pool, o primeiro pool muda o diagrama para colaboração e passa a CONTER tudo '
        + 'o que já estava desenhado — o resultado diz isso em virouColaboracao e adotou, e você '
        + 'deve contar ao aluno. Um Ctrl+Z desfaz tudo junto. Para as faixas de dentro do pool, '
        + 'use criar_raia.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'O nome de quem o pool representa.' },
        },
      },
    },
  },

  {
    nome: 'criar_raia',
    escreve: true,
    declaracao: {
      name: 'criar_raia',
      description:
        'Cria uma raia (faixa) dentro de um pool — o papel de quem faz cada parte do processo '
        + '("uma raia para o entregador"). Sem dentroDe usa o único pool do diagrama; se houver '
        + 'mais de um, a ferramenta recusa com sem_lugar e devolve os nomes: pergunte em qual. '
        + 'Num diagrama SEM pool a resposta é sem_lugar dizendo para criar um pool primeiro. '
        + 'ATENÇÃO: o primeiro pedido de raia num pool cria DUAS faixas — a do conteúdo que já '
        + 'estava lá e a nova (o resultado traz criouAFaixaDoQueJaExistia); avise o aluno, '
        + 'porque ele vê duas aparecerem e pediu uma.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'O nome do papel, como o aluno falou.' },
          dentroDe: {
            type: 'string',
            description: 'Id do pool que recebe a raia, ou de uma raia existente para pôr a nova ao lado dela.',
          },
          onde: {
            type: 'string',
            enum: ['abaixo', 'acima'],
            description: 'Onde a faixa nova entra em relação ao alvo. O padrão é abaixo.',
          },
        },
      },
    },
  },

  {
    nome: 'mover',
    escreve: true,
    // ⚠ Sem pixel na declaração de propósito: o modelo não recebe coordenada nenhuma no contexto
    // (a projeção manda id, tipo e nome), então pedir x/y a ele seria pedir palpite. As duas
    // formas que ele PODE saber são "para onde" (direção) e "para dentro de quê" (container).
    declaracao: {
      name: 'mover',
      description:
        'Muda um elemento de lugar no desenho. Use dentroDe com o id de um pool ou raia para '
        + 'mudar o elemento de faixa ("põe na raia do caixa", "joga para a linha de cima" quando '
        + 'a linha é uma raia). Use direcao com passos para um ajuste relativo ("um pouco para a '
        + 'direita"). O resultado diz quanto ele andou; se não saiu do lugar, o erro é '
        + 'nada_mudou. Para deixar vários elementos na mesma linha, prefira alinhar.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id do elemento a mover.' },
          dentroDe: {
            type: 'string',
            description: 'Id do pool, raia ou subprocesso de destino. O elemento vai para o meio dessa faixa.',
          },
          direcao: {
            type: 'string',
            enum: [...DIRECOES_MOVER],
            description: 'Para onde mover, quando o pedido é um ajuste relativo.',
          },
          passos: {
            type: 'integer',
            description: 'Quantos passos de 80 px, de 1 a 5. O padrão é 1.',
          },
        },
        required: ['id'],
      },
    },
  },

  {
    nome: 'alinhar',
    escreve: true,
    declaracao: {
      name: 'alinhar',
      description:
        'Deixa dois ou mais elementos na mesma linha (eixo linha) ou na mesma coluna (eixo '
        + 'coluna). É o que o aluno pede quando a sequência saiu em escadinha e ele diz que "não '
        + 'está na mesma linha" ou que "parecem coisas diferentes". Passe os ids na ordem que '
        + 'quiser: a altura comum é calculada pelo bpmn-js. Se eles continuarem fora de linha, o '
        + 'erro é nada_mudou.',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dois ids ou mais.',
          },
          eixo: {
            type: 'string',
            enum: [...EIXOS_ALINHAR],
            description: 'linha = mesma altura (um ao lado do outro); coluna = mesma vertical.',
          },
        },
        required: ['ids', 'eixo'],
      },
    },
  },

  {
    nome: 'trocar_tipo',
    escreve: true,
    // ⚠ Existe para NÃO apagar e recriar: o caminho ingênuo levava embora as ligações que o
    // aluno desenhou. Aqui o bpmn-js copia o nome e religa os fluxos.
    declaracao: {
      name: 'trocar_tipo',
      description:
        'Troca o tipo de um elemento que já existe, mantendo o nome e as ligações. Use quando o '
        + 'aluno disser que um elemento é outra coisa ("isso aí é uma decisão", "essa tarefa é '
        + 'do usuário", "esse evento é de mensagem"). ATENÇÃO: o elemento ganha um id NOVO, que '
        + 'vem em idNovo — use esse id nos próximos pedidos. Se já for daquele tipo, o erro é '
        + 'nada_mudou.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id do elemento de hoje.' },
          tipo: {
            type: 'string',
            enum: [...TIPOS_CRIAVEIS],
            description: 'O tipo BPMN novo, sem o prefixo bpmn:.',
          },
        },
        required: ['id', 'tipo'],
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
    nome: 'desfazer',
    escreve: true,
    // ⚠ A pilha é UMA — a mesma do Ctrl+Z do aluno. A declaração diz isso para o modelo não
    // prometer que desfaz "só o que ele fez": o último comando pode ter sido do aluno.
    declaracao: {
      name: 'desfazer',
      description:
        'Desfaz a última mudança no diagrama, como o Ctrl+Z do aluno — e é a MESMA pilha, então '
        + 'o que volta atrás pode ser uma ação dele. Use quando ele disser que não gostou do que '
        + 'acabou de sair ("desfaz isso", "volta"). O resultado diz quais elementos saíram e '
        + 'quais voltaram; conte isso em vez de só dizer que desfez. Sem nada para desfazer, o '
        + 'erro é nada_mudou. Uma criação com nome são dois comandos: desfazer uma vez tira o '
        + 'nome, desfazer de novo tira o elemento.',
      parameters: { type: 'object', properties: {} },
    },
  },

  {
    nome: 'destacar',
    escreve: true,
    declaracao: {
      name: 'destacar',
      description:
        'Pinta elementos do diagrama para o aluno achar na tela o que você está explicando: o '
        + 'gargalo da simulação, os passos de um caminho, o que ele pediu para revisar. A cor é '
        + 'de uma lista fechada; nenhuma limpa a cor. Prefira destacar a descrever a posição com '
        + 'palavras quando o diagrama é grande.',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Um id ou mais.',
          },
          cor: {
            type: 'string',
            enum: [...CORES_DESTAQUE],
            description: 'A cor do destaque, ou nenhuma para limpar.',
          },
        },
        required: ['ids', 'cor'],
      },
    },
  },

  {
    nome: 'renomear',
    escreve: true,
    declaracao: {
      name: 'renomear',
      description:
        'Troca o rótulo de um elemento do diagrama. Serve para FLUXO também: o rótulo da seta '
        + 'que sai de um gateway é a condição do caminho ("se aprovado", "se faltar item") — '
        + 'quando o aluno descrever a condição de um ramo, nomeie a seta. O resultado traz o '
        + 'nome de antes e o de agora. Id que não existe devolve elemento_nao_encontrado.',
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
    /**
     * ⚠ Exige CONFIRMAÇÃO do aluno, e o portão é da página (change `spoken-confirmation-gates`):
     * a ação fica recusada até ele falar ou digitar DEPOIS de a pergunta ter sido feita. Não é o
     * modelo que conta — ele pode afirmar que o aluno concordou e isso não abre nada.
     */
    exigeConfirmacao: 'remover',
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

/**
 * O portão que esta ferramenta exige, ou `null`.
 *
 * Fica no catálogo porque é declaração — "esta ação precisa do aluno" —, não decisão de execução.
 * Quem decide se o portão está aberto é a página; quem recusa antes do executor é o despachante.
 */
export function portaoDaFerramenta(nome) {
  return FERRAMENTAS.find((f) => f.nome === nome)?.exigeConfirmacao ?? null;
}
