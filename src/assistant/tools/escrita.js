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
  SEM_LUGAR: 'sem_lugar',
});

/**
 * As direções de `mover`, em palavras — porque o modelo NÃO vê coordenadas (a projeção manda id,
 * tipo e nome, design H4). Pedir pixel a quem não vê a régua é pedir palpite.
 */
export const DIRECOES_MOVER = Object.freeze(['direita', 'esquerda', 'cima', 'baixo']);

/**
 * Os eixos de `alinhar`, nas palavras do aluno, mapeados para os do bpmn-js:
 * "mesma linha" = centros na mesma altura (`middle`), "mesma coluna" = `center`.
 */
const EIXOS = Object.freeze({ linha: 'middle', coluna: 'center' });
export const EIXOS_ALINHAR = Object.freeze(Object.keys(EIXOS));

/**
 * A paleta de `destacar`, nas palavras do aluno. Lista FECHADA — e não por desconfiança: cor
 * livre vinda do modelo põe texto cinza sobre fundo cinza, e quem perde a leitura do próprio
 * diagrama é o aluno. Os pares são os da paleta do bpmn.io (fundo claro, borda forte).
 */
const CORES = Object.freeze({
  vermelho: { fill: '#FFCDD2', stroke: '#E53935' },
  amarelo: { fill: '#FFF9C4', stroke: '#FBC02D' },
  verde: { fill: '#C8E6C9', stroke: '#43A047' },
  azul: { fill: '#BBDEFB', stroke: '#1E88E5' },
  roxo: { fill: '#E1BEE7', stroke: '#8E24AA' },
  // Limpar é um pedido legítimo ("tira a cor"): `undefined` apaga a propriedade no DI.
  nenhuma: { fill: undefined, stroke: undefined },
});
export const CORES_DESTAQUE = Object.freeze(Object.keys(CORES));

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

  /**
   * Criar SEM âncora: o elemento precisa de um lugar que o aceite, e quem diz quais aceitam é o
   * bpmn-js (`lugaresParaCriar`).
   *
   * ⚠ Dois casos que parecem o mesmo e não são:
   *  - **nenhum lugar**: o diagrama não recebe este tipo solto. Erro nomeado, sem desenhar nada.
   *  - **mais de um** (uma colaboração tem um pool por participante): ADIVINHAR é pior que
   *    perguntar — o processo do aluno nasceria no pool errado, e mover depois é trabalho que
   *    ele não pediu. A ferramenta devolve os nomes para o agente perguntar em qual.
   *
   * Isto nasceu de um crash ao vivo (portão 4.5, 2026-11-14): criar solto numa colaboração
   * estourava dentro do bpmn-js e deixava a forma desenhada com o XML quebrado — três vezes,
   * porque o agente tentou de novo. Fantasma na tela é pior que recusa com nome.
   */
  const criarSemAncora = (tipoBpmn, dentro) => {
    if (!dentro) {
      const lugares = acesso.lugaresParaCriar(tipoBpmn);
      if (!lugares.length) {
        throw nomeado(ERROS_ESCRITA.SEM_LUGAR, 'este diagrama não recebe um elemento solto; use depoisDe');
      }
      if (lugares.length > 1) {
        const nomes = lugares.map((l) => {
          const r = resumir(l);
          return r.nome ? `"${r.nome}" (${r.id})` : `${r.tipo} ${r.id}`;
        }).join(', ');
        throw nomeado(ERROS_ESCRITA.SEM_LUGAR, `há mais de um lugar possível — diga em qual com dentroDe: ${nomes}`);
      }
    }
    return acesso.criarSolto({ tipo: tipoBpmn, dentro });
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
    async criar_elemento({ tipo, nome, depoisDe, dentroDe, entre } = {}) {
      exigirEdicao();
      const tipoBpmn = resolverTipo(tipo);

      /**
       * `entre` vem PRIMEIRO porque é o pedido mais específico: inserir no meio de uma sequência
       * que já existe. Os outros dois criam numa ponta.
       */
      const nomesEntre = Array.isArray(entre) ? entre.filter((x) => typeof x === 'string' && x.trim()) : [];
      if (entre !== undefined && nomesEntre.length !== 2) {
        throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, 'entre pede exatamente dois ids, na ordem do fluxo');
      }
      const anterior = nomesEntre.length ? exigirElemento(nomesEntre[0], 'entre[0]') : null;
      const seguinte = nomesEntre.length ? exigirElemento(nomesEntre[1], 'entre[1]') : null;

      const ancora = !anterior && depoisDe ? exigirElemento(depoisDe, 'depoisDe') : null;
      const dentro = !anterior && !ancora && dentroDe ? exigirElemento(dentroDe, 'dentroDe') : null;

      /**
       * Quantas saídas a âncora já tinha. É o FATO que distingue os dois desenhos possíveis de
       * "depois de X": com zero saídas a cadeia segue em linha; com uma ou mais, o bpmn-js
       * desenha um RAMO — um degrau abaixo, correto para o BPMN e quase nunca o que o aluno
       * pediu ("não tá na mesma linha, era para ser contínuo", trilha de 2026-11-14). Dizer isso
       * no resultado deixa o modelo oferecer `entre`, que é o verbo certo para esse caso.
       */
      const saidasAntes = ancora ? acesso.entradasESaidas(ancora.id).saidas.length : 0;

      /**
       * `sem_lugar_para_criar` é o aviso da camada de acesso de que o bpmn-js NÃO guardaria o
       * elemento ali. Vale para os dois caminhos: o pai da âncora também pode recusar o tipo
       * ("uma tarefa depois do pool X"). Erro nomeado em vez de forma desenhada com XML quebrado.
       */
      let criado;
      let fluxoPartido = null;
      try {
        if (anterior) {
          fluxoPartido = acesso.fluxoEntre(anterior, seguinte);
          if (!fluxoPartido) {
            // Sem fluxo não há meio onde entrar. Nomear os dois lados faz o modelo ligar primeiro
            // (ou usar `depoisDe`) em vez de repetir a mesma chamada.
            throw nomeado(
              ERROS_ESCRITA.SEM_LUGAR,
              `não há fluxo de ${anterior.id} para ${seguinte.id}; ligue os dois antes, ou use depoisDe`,
            );
          }
          criado = acesso.inserirEntre({ fluxo: fluxoPartido, tipo: tipoBpmn });
        } else {
          criado = ancora
            ? acesso.criarDepoisDe({ ancora, tipo: tipoBpmn })
            : criarSemAncora(tipoBpmn, dentro);
        }
      } catch (err) {
        if (!/sem_lugar_para_criar/.test(err?.message ?? '')) throw err;
        throw nomeado(
          ERROS_ESCRITA.SEM_LUGAR,
          anterior ? `um ${tipoCurto(tipoBpmn)} não entra no fluxo entre ${anterior.id} e ${seguinte.id}`
            : ancora ? `não cabe um ${tipoCurto(tipoBpmn)} depois de ${ancora.id}`
              : dentro ? `${dentro.id} não recebe este tipo` : 'não há onde criar',
        );
      }

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

      const { entradas, saidas } = acesso.entradasESaidas(confirmado.id);
      return {
        criado: resumir(confirmado),
        // Quando há âncora o bpmn-js cria a ligação junto. Dizer isso evita o agente ligar de novo.
        ligadoA: ancora ? resumir(ancora) : null,
        ligacao: entradas[0] ? resumir(entradas[0]) : null,
        // Inserido no meio: o bpmn-js religou os dois lados, então ele JÁ está no caminho.
        inseridoEntre: anterior ? { de: resumir(anterior), para: resumir(seguinte) } : null,
        religado: anterior ? { entradas: entradas.length, saidas: saidas.length } : null,
        /**
         * ⚠ Ramo: a âncora já tinha saída, então isto nasceu como CAMINHO PARALELO e o bpmn-js o
         * desenhou um degrau abaixo. Se o aluno queria a sequência contínua, o verbo é
         * `criar_elemento` com `entre`.
         */
        ramo: ancora ? saidasAntes > 0 : false,
        avisoDeRamo: ancora && saidasAntes > 0
          ? `${ancora.id} já tinha ${saidasAntes} saída(s): este elemento é um ramo paralelo, desenhado abaixo da linha. `
            + 'Para pôr no meio da sequência, use entre: [anterior, seguinte].'
          : null,
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

    /**
     * MOVE um elemento. O verbo que faltava: até 2026-11-14 o agente conseguia criar e remover,
     * e quando o aluno dizia "tira esse e põe na linha de cima" ele só conseguia a metade
     * destrutiva do pedido (trilha T14).
     *
     * Dois pedidos, um verbo:
     *  - `dentroDe` = o container de destino (raia, pool, subprocesso): "põe na raia do caixa".
     *  - `direcao` + `passos` = deslocamento relativo: "um pouco para a direita".
     *
     * O resultado traz a caixa de antes e a de depois. É isso que separa "mandei mover" de
     * "moveu": `alignElements` e `moveElements` podem não fazer nada, e silêncio virando sucesso
     * é a mentira mais fácil deste instrumento.
     */
    async mover({ id, direcao, passos, dentroDe } = {}) {
      exigirEdicao();
      const el = exigirElemento(id);
      const dentro = dentroDe ? exigirElemento(dentroDe, 'dentroDe') : null;
      if (!dentro && !direcao) {
        throw nomeado(
          ERROS_ESCRITA.TIPO_INVALIDO,
          `diga para onde: direcao (${DIRECOES_MOVER.join(', ')}) ou dentroDe (id do pool/raia)`,
        );
      }

      let r;
      try {
        r = acesso.mover({ el, dentro, direcao, passos });
      } catch (err) {
        const m = err?.message ?? '';
        if (/direcao_invalida/.test(m)) {
          throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, `direcao ${direcao} (use: ${DIRECOES_MOVER.join(', ')})`);
        }
        if (/sem_lugar_para_mover/.test(m)) {
          throw nomeado(
            ERROS_ESCRITA.SEM_LUGAR,
            dentro ? `${dentro.id} não recebe este elemento` : 'o desenho não permite mover para lá',
          );
        }
        // Elemento sem geometria é elemento que não está desenhado (rótulo solto, fluxo sem
        // waypoint): não existe "mover" para ele, e dizer isso é melhor que estourar sem nome.
        if (/sem_geometria/.test(m)) throw nomeado(ERROS_ESCRITA.NAO_ENCONTRADO, `${id} não está desenhado`);
        throw err;
      }

      const { antes, depois } = r ?? {};
      if (!depois || (antes.x === depois.x && antes.y === depois.y)) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `${id} não saiu do lugar`);
      }
      return {
        movido: resumir(acesso.porId(id)),
        andou: { x: depois.x - antes.x, y: depois.y - antes.y },
        dentroDe: dentro ? resumir(dentro) : null,
      };
    },

    /**
     * Alinha dois ou mais elementos na MESMA LINHA ou na mesma coluna.
     *
     * É o conserto do que já está torto — e o pedido literal do aluno quando a cadeia sai em
     * escadinha ("não tá na mesma linha e parece que são duas coisas diferentes"). Quem calcula a
     * altura comum é o `alignElements` do bpmn-js, o mesmo do menu de alinhamento.
     *
     * Já estar alinhado NÃO é erro: `trigger` não faz nada e a leitura de volta confirma que os
     * centros coincidem. Portão que reprova a resposta certa ensina a ignorar portão.
     */
    async alinhar({ ids, eixo } = {}) {
      exigirEdicao();
      const lista = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && x.trim()) : [];
      if (lista.length < 2) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, 'alinhar pede pelo menos dois ids');
      const tipo = EIXOS[String(eixo ?? '').toLowerCase()];
      if (!tipo) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, `eixo ${eixo} (use: ${EIXOS_ALINHAR.join(', ')})`);
      const els = lista.map((x) => exigirElemento(x));

      let r;
      try {
        r = acesso.alinhar({ els, tipo });
      } catch (err) {
        if (/sem_alinhador/.test(err?.message ?? '')) {
          throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL, 'esta página não tem o alinhamento do bpmn-js');
        }
        throw err;
      }

      const meio = (c) => (tipo === 'middle' ? c.y + c.h / 2 : c.x + c.w / 2);
      const centros = (r?.depois ?? []).map((d) => (d.caixa ? Math.round(meio(d.caixa)) : null));
      if (!centros.length || centros.some((v) => v === null)) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'não consegui medir os elementos depois de alinhar');
      }
      // Um pixel de folga: o bpmn-js arredonda a geometria para a grade.
      if (centros.some((v) => Math.abs(v - centros[0]) > 1)) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'os elementos seguem fora de linha');
      }
      return { alinhados: els.map(resumir), eixo, em: centros[0] };
    },

    /**
     * Troca o TIPO de um elemento sem desmontar o processo em volta.
     *
     * "Isso devia ser um gateway exclusivo" era, até aqui, apagar e recriar — o que levava
     * embora as ligações que o aluno desenhou. O `bpmnReplace` do bpmn-js copia nome e
     * propriedades e RELIGA os fluxos.
     *
     * ⚠ O id MUDA. O resultado devolve o novo, e o modelo precisa usá-lo nos pedidos seguintes.
     */
    async trocar_tipo({ id, tipo } = {}) {
      exigirEdicao();
      const el = exigirElemento(id);
      const tipoBpmn = resolverTipo(tipo);
      const de = resumir(el);
      if (el.type === tipoBpmn) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `${id} já é um ${tipoCurto(tipoBpmn)}`);
      }

      let novo;
      try {
        novo = acesso.trocarTipo({ el, tipo: tipoBpmn });
      } catch (err) {
        if (/sem_substituidor/.test(err?.message ?? '')) {
          throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL, 'esta página não tem a troca de tipo do bpmn-js');
        }
        throw err;
      }

      const confirmado = acesso.porId(novo?.id);
      if (!confirmado || confirmado.type !== tipoBpmn) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `${id} continua sendo um ${de.tipo}`);
      }
      const { entradas, saidas } = acesso.entradasESaidas(confirmado.id);
      return {
        de,
        para: resumir(confirmado),
        // O id novo é a parte que o modelo PRECISA guardar: o antigo não existe mais.
        idNovo: confirmado.id,
        ligacoesPreservadas: entradas.length + saidas.length,
      };
    },

    /**
     * DESFAZ o último comando do diagrama — a mesma pilha do `Ctrl+Z` do aluno.
     *
     * Existe porque em voz as mãos dele não estão no teclado: "desfaz isso" é uma frase, não um
     * atalho. E é honesto sobre o alcance: a pilha é UMA, então o último comando pode ter sido
     * dele. O resultado diz o que saiu e o que voltou, para o agente contar em vez de afirmar.
     */
    async desfazer() {
      exigirEdicao();
      const idsDe = () => acesso.elementos().filter((e) => e && !e.labelTarget && e.parent).map((e) => e.id);
      const antes = idsDe();

      let r;
      try {
        r = acesso.desfazer();
      } catch (err) {
        const m = err?.message ?? '';
        // Pilha vazia NÃO é falha nossa: é um fato que o agente precisa contar ao aluno.
        if (/nada_para_desfazer/.test(m)) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'não há nada para desfazer');
        if (/sem_pilha/.test(m)) throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL, 'esta página não tem histórico de comandos');
        throw err;
      }

      const depois = idsDe();
      return {
        desfeito: true,
        // Mudança de nome, de cor ou de posição não muda id nenhum: as duas listas vêm vazias e
        // isso não é erro. O que prova o desfazer é a pilha ter aceitado (`canUndo` antes).
        sairamDoDiagrama: antes.filter((id) => !depois.includes(id)),
        voltaramAoDiagrama: depois.filter((id) => !antes.includes(id)),
        total: depois.length,
        aindaDaParaDesfazer: r?.aindaDaParaDesfazer ?? null,
      };
    },

    /**
     * Pinta elementos para o aluno ACHAR o que está sendo explicado — o gargalo da simulação, os
     * três passos de um caminho, o que ele pediu para revisar.
     *
     * Cor é de uma lista fechada: cor livre vinda do modelo produz fundo ilegível, e quem perde a
     * leitura do próprio diagrama é ele. `nenhuma` limpa.
     */
    async destacar({ ids, cor } = {}) {
      exigirEdicao();
      const lista = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && x.trim()) : [];
      if (!lista.length) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, 'destacar pede pelo menos um id');
      const chave = String(cor ?? '').toLowerCase();
      const cores = CORES[chave];
      if (!cores) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, `cor ${cor} (use: ${CORES_DESTAQUE.join(', ')})`);
      const els = lista.map((x) => exigirElemento(x));

      acesso.destacar({ els, cores });

      // Leitura de volta no DI: é lá que a cor fica, e é de lá que o desenho a lê.
      const esperado = (cores.fill ?? '').toLowerCase();
      const pintados = els.map((el) => ({ id: el.id, ...acesso.corDe(el.id) }));
      const confere = pintados.every((p) => String(p.fundo ?? '').toLowerCase() === esperado);
      if (!confere) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `a cor não ficou em ${pintados.map((p) => p.id).join(', ')}`);
      return { destacados: els.map(resumir), cor: chave };
    },

    /**
     * Troca o nome de um elemento. `modeling.updateLabel` — desfazível como qualquer comando.
     *
     * ⚠ Serve para FLUXO também, e esse é o uso que o aluno não imagina estar pedindo: o rótulo
     * da seta que sai de um gateway é a CONDIÇÃO do caminho ("se aprovado", "se faltar item").
     */
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
