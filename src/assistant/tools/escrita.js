// As quatro ferramentas que ESCREVEM no diagrama (fase F7, bloco 3 do `add-bpmn-diagram-tools`).
//
// A diferença de todas as anteriores: estas mudam a tela do aluno. Daí as quatro regras que
// valem para as quatro:
//
//  1. **Toda escrita passa por `modeling`** (tarefa 3.5). Nunca pelo XML, nunca pelo
//     `businessObject` na mão: só o `modeling` registra no `commandStack`, e é o commandStack que
//     faz `Ctrl+Z` desfazer o que o agente fez. Escrita que o aluno não consegue desfazer é
//     escrita que ele vai ter medo de pedir.
//  2. **Confirmação lida de volta, nunca presumida.** O retorno não diz "mandei criar": ele
//     procura o elemento no registro DEPOIS da operação e devolve o que achou. Chamada que
//     retorna sem erro e não mudou nada é o jeito mais fácil de o instrumento mentir.
//  3. **Remover pede confirmação na interface** (tarefa 3.4) e a confirmação carrega a VERSÃO do
//     diagrama: se o desenho mudou entre o pedido do modelo e o clique do aluno, a remoção é
//     recusada com `diagrama_mudou` — porque o `id` de então pode ser outro elemento agora (H14).
//  4. **Recusa é resposta, não silêncio.** Aluno que diz "não" devolve um fato ao modelo
//     (`recusadoPeloAluno`), e ele narra isso. Sem resposta, o modelo reconta a remoção como
//     feita.
//
// ponytail: funções sobre a camada fina, como as de leitura. Sem transação, sem fila de
// comandos própria — o `commandStack` do bpmn-js já é as duas coisas.

import { assinaturaDoDiagrama } from './leitura.js';

export const ERROS_ESCRITA = Object.freeze({
  SEM_DIAGRAMA: 'sem_diagrama',
  NAO_EDITAVEL: 'pagina_somente_leitura',
  NAO_ENCONTRADO: 'elemento_nao_encontrado',
  TIPO_INVALIDO: 'tipo_invalido',
  CONEXAO_INVALIDA: 'conexao_invalida',
  DIAGRAMA_MUDOU: 'diagrama_mudou',
  NAO_MUDOU: 'nada_mudou',
});

function nomeado(nome, detalhe) {
  const e = new Error(detalhe ? `${nome}: ${detalhe}` : nome);
  e.nome = nome;
  return e;
}

/**
 * Os tipos que o agente pode criar. Lista FECHADA, e não por desconfiança do modelo: `bpmn:`
 * tem mais de cem tipos, e os que não cabem num processo simples (artefatos, correlação,
 * `bpmn:Definitions`) travam o modelador de formas que o aluno não sabe desfazer.
 *
 * ⚠ Isto NÃO é classificação por palavra-chave do texto do aluno (constituição §III): é a lista
 * do que a ferramenta aceita como argumento, declarada ao modelo no catálogo. Quem escolhe o
 * tipo continua sendo ele.
 */
export const TIPOS_CRIAVEIS = Object.freeze([
  'Task', 'UserTask', 'ServiceTask', 'ManualTask', 'ScriptTask', 'SendTask', 'ReceiveTask',
  'StartEvent', 'EndEvent', 'IntermediateThrowEvent', 'IntermediateCatchEvent',
  'ExclusiveGateway', 'ParallelGateway', 'InclusiveGateway', 'EventBasedGateway',
  'SubProcess', 'DataObjectReference', 'DataStoreReference',
]);

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

/** `task` / `Task` / `bpmn:Task` -> `bpmn:Task`. Tipo fora da lista é erro NOMEADO. */
function resolverTipo(tipo) {
  const curto = tipoCurto(tipo).trim();
  const achado = TIPOS_CRIAVEIS.find((t) => t.toLowerCase() === curto.toLowerCase());
  if (!achado) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, `${tipo} (use um de: ${TIPOS_CRIAVEIS.join(', ')})`);
  return `bpmn:${achado}`;
}

/**
 * Monta os executores de escrita.
 *
 * `pedirConfirmacao({ acao, alvo, versao })` devolve `Promise<boolean>` e é da INTERFACE — quem
 * decide é o aluno, nunca este módulo. Sem ela, remover é recusado: ferramenta destrutiva sem
 * quem perguntar não roda.
 */
export function criarExecutoresDeEscrita({ acesso, pedirConfirmacao = null } = {}) {
  const exigirEdicao = () => {
    if (!acesso?.disponivel) throw nomeado(ERROS_ESCRITA.SEM_DIAGRAMA);
    // ⚠ Segunda trava, DEPOIS da política. A política esconde a ferramenta do modelo numa página
    // que só lê; esta recusa a execução mesmo que a declaração de uma sessão anterior tenha
    // vazado. Duas travas porque o custo de errar aqui é a tela do aluno.
    if (!acesso.editavel) throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL);
  };

  const exigirElemento = (id, papel) => {
    const el = acesso.porId(id);
    if (!el || el.labelTarget) throw nomeado(ERROS_ESCRITA.NAO_ENCONTRADO, papel ? `${papel}=${id}` : String(id));
    return el;
  };

  return {
    /**
     * Cria um elemento, de preferência ANCORADO num que já existe: `depoisDe` faz o bpmn-js
     * posicionar e JÁ LIGAR o novo elemento ao anterior, que é o que o aluno pede em palavras
     * ("uma tarefa depois do início").
     *
     * ⚠ A POSIÇÃO não é escolhida aqui nem na camada por cálculo nosso: com âncora, quem diz
     * onde cabe é o `autoPlace` do bpmn-js (o mesmo serviço do botão de append do aluno); sem
     * âncora, o elemento cai embaixo do que já está desenhado. Omitir a posição era o defeito:
     * o bpmn-js caía num ponto fixo e a tarefa nova nascia POR CIMA da vizinha.
     */
    async criar_elemento({ tipo, nome, depoisDe } = {}) {
      exigirEdicao();
      const tipoBpmn = resolverTipo(tipo);
      const ancora = depoisDe ? exigirElemento(depoisDe, 'depoisDe') : null;

      const criado = ancora
        ? acesso.criarDepoisDe({ ancora, tipo: tipoBpmn })
        : acesso.criarSolto({ tipo: tipoBpmn });

      // Leitura de volta: é o registro que diz se existe, não a chamada que não deu erro.
      const confirmado = acesso.porId(criado?.id);
      if (!confirmado) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'o elemento não apareceu no registro');

      /**
       * O NOME é um comando à parte, de propósito.
       *
       * Passá-lo junto na criação não funciona: ele fica como atributo da forma e o desenho
       * continua em branco. Quem põe nome no diagrama é `modeling.updateLabel` — e é ele também
       * que CRIA o rótulo externo de evento e gateway, que a criação sozinha não cria.
       *
       * ponytail: dois comandos ⇒ dois `Ctrl+Z` para desfazer uma criação com nome. É o preço de
       * usar o verbo certo; o errado deixava a forma anônima na tela do aluno.
       */
      const rotulo = typeof nome === 'string' ? nome.trim() : '';
      if (rotulo) {
        acesso.renomear({ el: confirmado, nome: rotulo });
        if (nomeDe(acesso.porId(confirmado.id)) !== rotulo) {
          throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `o elemento nasceu sem o nome "${rotulo}"`);
        }
      }

      const { entradas } = acesso.entradasESaidas(confirmado.id);
      return {
        criado: resumir(confirmado),
        // Quando há âncora o bpmn-js cria a ligação junto. Dizer isso evita o agente ligar de novo.
        ligadoA: ancora ? resumir(ancora) : null,
        ligacao: entradas[0] ? resumir(entradas[0]) : null,
        total: acesso.elementos().filter((e) => e && !e.labelTarget && e.parent).length,
      };
    },

    /**
     * Liga dois elementos. **Não reimplementa as regras do BPMN**: manda o `modeling` conectar e
     * LÊ o tipo que nasceu.
     *
     * É isso que faz a pergunta "liga a tarefa do cliente na do restaurante" responder certo: em
     * pools diferentes o bpmn-js cria um `MessageFlow`, não um `SequenceFlow`, e o retorno diz
     * qual foi — o agente narra a diferença porque ela está no fato, não num `if` nosso.
     */
    async conectar({ de, para } = {}) {
      exigirEdicao();
      const origem = exigirElemento(de, 'de');
      const destino = exigirElemento(para, 'para');

      let conexao;
      try {
        conexao = acesso.ligar({ de: origem, para: destino });
      } catch (err) {
        throw nomeado(ERROS_ESCRITA.CONEXAO_INVALIDA, err?.message ?? `${de} -> ${para}`);
      }
      if (!conexao || !acesso.porId(conexao.id)) {
        // O bpmn-js recusa silenciosamente o que as regras proíbem. Silêncio virando `{ok:true}`
        // faria o agente afirmar uma ligação que não existe no desenho.
        throw nomeado(ERROS_ESCRITA.CONEXAO_INVALIDA, `${de} -> ${para}`);
      }

      return {
        ligou: { de: resumir(origem), para: resumir(destino) },
        // `SequenceFlow` ou `MessageFlow`: quem decidiu foi a regra do BPMN dentro do bpmn-js.
        tipoDaLigacao: tipoCurto(conexao.type),
        id: conexao.id,
      };
    },

    /** Troca o nome de um elemento. `modeling.updateLabel` — desfazível como qualquer comando. */
    async renomear({ id, nome } = {}) {
      exigirEdicao();
      const el = exigirElemento(id);
      const antes = nomeDe(el);
      const novo = typeof nome === 'string' ? nome.trim() : '';
      if (!novo) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, 'nome vazio');

      acesso.renomear({ el, nome: novo });

      const depois = nomeDe(acesso.porId(id));
      if (depois !== novo) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `nome segue "${depois ?? ''}"`);
      return { id, de: antes, para: depois };
    },

    /**
     * Remove um elemento — **só depois do aluno confirmar na interface** (tarefa 3.4).
     *
     * A confirmação carrega a versão do diagrama. Se o desenho mudou entre o pedido do modelo e
     * o clique, recusa: o `id` de então pode ser outro elemento agora, e apagar o errado por
     * causa de meio segundo de diferença é o pior defeito possível aqui (H14).
     */
    async remover({ id } = {}) {
      exigirEdicao();
      const el = exigirElemento(id);
      const alvo = resumir(el);

      if (typeof pedirConfirmacao !== 'function') {
        // Sem quem perguntar, não remove. Fail-closed vale especialmente para o destrutivo.
        throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL, 'sem confirmação na interface');
      }

      const versao = assinaturaDoDiagrama(acesso.elementos());
      const autorizado = await pedirConfirmacao({ acao: 'remover', alvo, versao });
      if (!autorizado) {
        // Recusa é FATO que volta ao modelo. Sem isso ele narra a remoção como feita.
        return { removido: false, recusadoPeloAluno: true, alvo };
      }
      if (assinaturaDoDiagrama(acesso.elementos()) !== versao) {
        throw nomeado(ERROS_ESCRITA.DIAGRAMA_MUDOU, `${id} pode não ser mais o mesmo elemento`);
      }

      acesso.remover({ el });

      if (acesso.porId(id)) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `${id} continua no diagrama`);
      return { removido: true, alvo, total: acesso.elementos().filter((e) => e && !e.labelTarget && e.parent).length };
    },
  };
}
