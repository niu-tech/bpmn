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

import { assinaturaDoDiagrama, estadoDaTela, fatosDaTela, instantaneoDaTela } from './leitura.js';

export const ERROS_ESCRITA = Object.freeze({
  SEM_DIAGRAMA: 'sem_diagrama',
  NAO_EDITAVEL: 'pagina_somente_leitura',
  NAO_ENCONTRADO: 'elemento_nao_encontrado',
  TIPO_INVALIDO: 'tipo_invalido',
  CONEXAO_INVALIDA: 'conexao_invalida',
  DIAGRAMA_MUDOU: 'diagrama_mudou',
  NAO_MUDOU: 'nada_mudou',
  SEM_LUGAR: 'sem_lugar',
  /**
   * JÁ EXISTE um elemento igual, no mesmo lugar do pedido.
   *
   * ⚠ Nasceu de dois gêmeos entregues ao dono (2026-11-15): *"conferir estoque"* duas vezes e
   * *"Notify delay"* duas vezes. Nos dois casos o modelo criou, conferiu o desenho, não
   * reconheceu o próprio trabalho e criou de novo — e o aluno ficou com um elemento a mais,
   * solto no meio do processo dele. Recusa nomeada é o único jeito de o modelo saber que o que
   * ele ia fazer já está feito: o resultado diz o id do que existe, para ele seguir dali.
   */
  JA_EXISTE: 'ja_existe',
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

/**
 * Erro NOMEADO, e — quando a recusa é por AMBIGUIDADE — com os candidatos em forma.
 *
 * ⚠ Os nomes já iam no texto da recusa, e o modelo lia bem. Quem não lê prosa é a TELA: o aluno
 * ouvia "em qual pool?" e tinha de digitar a resposta, num produto em que ele está falando, de
 * mãos livres, olhando o desenho. Os candidatos estruturados são o que o painel transforma em
 * botão (change `close-the-loop-with-the-canvas`, tarefa 4).
 */
function nomeado(nome, detalhe, candidatos = null) {
  const e = new Error(detalhe ? `${nome}: ${detalhe}` : nome);
  e.nome = nome;
  if (candidatos?.length) e.candidatos = candidatos;
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
export function criarExecutoresDeEscrita({ acesso, pedirConfirmacao = null, portaoAberto = () => false } = {}) {
  const exigirEdicao = () => {
    if (!acesso?.disponivel) throw nomeado(ERROS_ESCRITA.SEM_DIAGRAMA);
    // ⚠ Segunda trava, DEPOIS da política. A política esconde a ferramenta do modelo numa página
    // que só lê; esta recusa a execução mesmo que a declaração de uma sessão anterior tenha
    // vazado. Duas travas porque o custo de errar aqui é a tela do aluno.
    if (!acesso.editavel) throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL);
  };

  /**
   * A TELA, depois da ação — e não o que a ferramenta fez.
   *
   * Toda escrita devolve `tela`, porque o modelo decide o passo seguinte DENTRO do turno e o que
   * ele precisa é o desenho de agora. O retrato de antes é de três números e serve para a leitura
   * contar a transição (o diagrama virou colaboração, o pool ganhou duas faixas) sem que cada
   * ferramenta precise do seu próprio campo para isso — foram cinco em 48 horas antes desta regra.
   */
  const retrato = () => instantaneoDaTela(acesso);
  /**
   * Quantos `Ctrl+Z` uma escrita custou, lido no contador da camada de acesso.
   *
   * Existe porque uma escrita nao e' UM comando: inserir no meio de um fluxo abre espaco,
   * cria a forma e redesenha as setas da vizinhanca. Medido em 2026-11-15, criar um gateway
   * com nome no meio do caminho custava **7** desfazeres — e o aluno que dizia "desfaz isso"
   * via o agente desfazer um roteamento de seta e anunciar que havia voltado atras. Aninhar a
   * cosmetica derrubou para 2; o numero exato depende do desenho, e por isso e' MEDIDO.
   *
   * Vai ao MODELO no resultado, e e' o `quantos` de `desfazer`. Nao e' estimativa: sai do
   * `commandStack.changed` do proprio bpmn-js.
   */
  const contarComandos = () => Number(acesso.comandosRegistrados ?? 0);
  const tela = (tocado, antes) => estadoDaTela(acesso, { tocado, antes });
  /**
   * Os mesmos fatos, EM FORMA, para a linha que o aluno lê na tela.
   *
   * ⚠ Só nas três ferramentas cujo desenho se reorganiza (ramo paralelo, pool que adota o que já
   * existia, primeira raia que nasce em dupla). Não é o sexto campo de ocasião: é UM campo, com
   * forma declarada, produzido pela MESMA leitura — e existe porque o apresentador perdeu essas
   * três frases quando os cinco campos saíram, e a tela do aluno emagreceu em silêncio.
   */
  const fatos = (tocado, antes) => fatosDaTela(acesso, { tocado, antes });

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
  const criarSemAncora = (tipoBpmn, dentro, nome = '') => {
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
        throw nomeado(
          ERROS_ESCRITA.SEM_LUGAR,
          `há mais de um lugar possível — diga em qual com dentroDe: ${nomes}`,
          lugares.map(resumir),
        );
      }
    }
    return acesso.criarSolto({ tipo: tipoBpmn, dentro, nome });
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
    async criar_elemento({ tipo, nome, depoisDe, dentroDe, entre, comoRamo = false } = {}) {
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
      const comandosAntes = contarComandos();
      const anterior = nomesEntre.length ? exigirElemento(nomesEntre[0], 'entre[0]') : null;
      const seguinte = nomesEntre.length ? exigirElemento(nomesEntre[1], 'entre[1]') : null;

      const ancora = !anterior && depoisDe ? exigirElemento(depoisDe, 'depoisDe') : null;
      const dentro = !anterior && !ancora && dentroDe ? exigirElemento(dentroDe, 'dentroDe') : null;

      const retratoAntes = retrato();

      /**
       * O GÊMEO: o mesmo tipo, com o mesmo nome, já ligado ao mesmo lugar.
       *
       * Só recusa quando as DUAS coisas batem — nome e vizinhança —, porque "duas tarefas
       * chamadas Revisar" é legítimo num processo grande; o que não é legítimo é a segunda nascer
       * colada à primeira, no lugar que o aluno pediu uma vez só.
       */
      const rotuloPedido = typeof nome === 'string' ? nome.trim() : '';
      if (rotuloPedido) {
        const vizinhos = [anterior, seguinte, ancora].filter(Boolean);
        const gemeo = acesso.elementos().find((e) => {
          if (!e || e.labelTarget || String(e.type) !== tipoBpmn) return false;
          if (nomeDe(e) !== rotuloPedido) return false;
          if (!vizinhos.length) return false;
          const { entradas, saidas } = acesso.entradasESaidas(e.id);
          const liga = [...entradas, ...saidas];
          return vizinhos.some((v) => liga.some((c) => c.source?.id === v.id || c.target?.id === v.id));
        });
        if (gemeo) {
          throw nomeado(
            ERROS_ESCRITA.JA_EXISTE,
            `já existe ${tipoCurto(tipoBpmn)} "${rotuloPedido}" [${gemeo.id}] ligado aí — não criei outro; `
            + 'use este id se quiser movê-lo, renomeá-lo ou ligá-lo',
          );
        }
      }

      /**
       * `sem_lugar_para_criar` é o aviso da camada de acesso de que o bpmn-js NÃO guardaria o
       * elemento ali. Vale para os dois caminhos: o pai da âncora também pode recusar o tipo
       * ("uma tarefa depois do pool X"). Erro nomeado em vez de forma desenhada com XML quebrado.
       */
      let criado;
      let fluxoPartido = null;
      /** Entrou no meio do caminho que já existia (e não como ramo): quem narra precisa saber. */
      let encadeou = null;
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
          criado = acesso.inserirEntre({ fluxo: fluxoPartido, tipo: tipoBpmn, nome: rotuloPedido });
        } else if (ancora) {
          /**
           * "DEPOIS DE X" ENCADEIA — ramo paralelo só quando pedido.
           *
           * ⚠ Era o contrário, e custou a confiança do dono numa sessão ao vivo (2026-11-15):
           * ele pediu *"cria uma tarefa conferir estoque depois do início"*, a âncora já tinha
           * saída, e a tarefa nasceu como **ramo paralelo** pendurado embaixo da linha. Para
           * quem fala, "depois do início" é a próxima etapa do caminho, não um segundo caminho
           * — e o aviso `avisoDeRamo` chegava ao modelo, que não o repassou.
           *
           * A decisão é do DESENHO, não da frase: tem exatamente uma saída de sequência? entra
           * no meio dela. Quem quiser o ramo pede `comoRamo: true`.
           */
          const saidas = acesso.entradasESaidas(ancora.id).saidas
            .filter((f) => String(f.type) === 'bpmn:SequenceFlow');
          if (!comoRamo && saidas.length === 1) {
            fluxoPartido = saidas[0];
            encadeou = { de: resumir(ancora), para: resumir(saidas[0].target) };
            criado = acesso.inserirEntre({ fluxo: fluxoPartido, tipo: tipoBpmn, nome: rotuloPedido });
          } else {
            criado = acesso.criarDepoisDe({ ancora, tipo: tipoBpmn, nome: rotuloPedido });
          }
        } else {
          criado = criarSemAncora(tipoBpmn, dentro, rotuloPedido);
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
       * O NOME NASCE COM O ELEMENTO — um comando, um `Ctrl+Z` (divida T12, fechada).
       *
       * Era um comando a parte por um motivo que estava ERRADO pela metade: passar `name` nos
       * atributos de verdade nao funciona (fica na forma, e o desenho nasce anonimo), mas o nome
       * no **businessObject** da forma funciona — ver `formaDe` em `tools/bpmn-api.js`. Com ele,
       * tarefa desenha o rotulo direto e evento/gateway ganham o rotulo externo dentro do MESMO
       * comando, pelo `LabelBehavior` do bpmn-js.
       *
       * ⚠ O `renomear` fica como RESERVA, e a leitura de volta e quem decide: caminho sem
       * `elementFactory` (append cru) ainda nasce anonimo, e ali um comando a mais e melhor que
       * uma forma sem nome na tela do aluno.
       */
      if (rotuloPedido && nomeDe(acesso.porId(confirmado.id)) !== rotuloPedido) {
        acesso.renomear({ el: confirmado, nome: rotuloPedido });
      }
      if (rotuloPedido && nomeDe(acesso.porId(confirmado.id)) !== rotuloPedido) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `o elemento nasceu sem o nome "${rotuloPedido}"`);
      }

      const { entradas, saidas } = acesso.entradasESaidas(confirmado.id);
      return {
        criado: resumir(confirmado),
        // Quando há âncora o bpmn-js cria a ligação junto. Dizer isso evita o agente ligar de novo.
        ligadoA: ancora ? resumir(ancora) : null,
        ligacao: entradas[0] ? resumir(entradas[0]) : null,
        // Inserido no meio: o bpmn-js religou os dois lados, então ele JÁ está no caminho.
        inseridoEntre: anterior
          ? { de: resumir(anterior), para: resumir(seguinte) }
          : encadeou,
        religado: anterior ? { entradas: entradas.length, saidas: saidas.length } : null,
        total: acesso.elementos().filter((e) => e && !e.labelTarget && e.parent).length,
        // Quantos `Ctrl+Z` isto custou — o `quantos` de `desfazer`, se o aluno nao gostar.
        comandos: Math.max(1, contarComandos() - comandosAntes),
        // O ramo paralelo (a âncora já tinha saída) sai daqui: a leitura olha o DESENHO.
        tela: tela(confirmado.id, retratoAntes),
        fatos: fatos(confirmado.id, retratoAntes),
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
      const retratoAntes = retrato();
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
        tela: tela(destino.id, retratoAntes),
      };
    },

    /**
     * Cria um POOL (participante) — a caixa que representa quem executa o processo.
     *
     * ⚠ O primeiro pool de um diagrama plano REESTRUTURA o desenho: o bpmn-js troca a raiz de
     * `bpmn:Process` para `bpmn:Collaboration` e move todo o conteúdo para dentro do pool novo.
     * É exatamente o que acontece quando o aluno arrasta um pool da paleta, mas é grande o
     * bastante para o resultado DIZER que aconteceu (`virouColaboracao`, `adotou`) — senão o
     * agente narraria "criei um pool" e o aluno veria o diagrama inteiro mudar de lugar sem
     * explicação. Um `Ctrl+Z` desfaz tudo junto (os comandos ficam aninhados num só).
     */
    async criar_pool({ nome } = {}) {
      exigirEdicao();
      const retratoAntes = retrato();
      const poolsAntes = acesso.pools().length;

      const rotulo = typeof nome === 'string' ? nome.trim() : '';
      let criado;
      try {
        criado = acesso.criarPool({ nome: rotulo });
      } catch (err) {
        if (!/sem_lugar_para_criar/.test(err?.message ?? '')) throw err;
        // A raiz recusou o participante: é o caso do diagrama que não é processo nem colaboração.
        throw nomeado(ERROS_ESCRITA.SEM_LUGAR, 'este diagrama não recebe um pool');
      }

      const confirmado = acesso.porId(criado?.id);
      if (!confirmado) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'o pool não apareceu no registro');

      // Reserva, como em `criar_elemento`: o nome ja deve ter nascido com o pool.
      if (rotulo && nomeDe(acesso.porId(confirmado.id)) !== rotulo) {
        acesso.renomear({ el: confirmado, nome: rotulo });
      }
      if (rotulo && nomeDe(acesso.porId(confirmado.id)) !== rotulo) {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `o pool nasceu sem o nome "${rotulo}"`);
      }

      return {
        criado: resumir(acesso.porId(confirmado.id)),
        totalDePools: acesso.pools().length,
        poolsAntes,
        // A raiz virar colaboração e o pool adotar o desenho são fatos do DESENHO: saem da leitura,
        // que conta forma e não conexão (o bpmn-js leva as setas junto).
        tela: tela(confirmado.id, retratoAntes),
        fatos: fatos(confirmado.id, retratoAntes),
      };
    },

    /**
     * Cria uma RAIA dentro de um pool — a faixa de quem faz cada parte.
     *
     * Sem `dentroDe`, usa o único pool do diagrama; com mais de um, RECUSA e devolve os nomes,
     * como `criar_elemento` faz. Adivinhar o pool colocaria o papel novo na organização errada.
     *
     * ⚠ Diagrama plano não tem onde pôr raia: a recusa diz isso com o próximo passo no texto
     * (criar um pool primeiro), porque é um fato que o modelo consegue resolver sozinho.
     */
    async criar_raia({ nome, dentroDe, onde } = {}) {
      exigirEdicao();
      const retratoAntes = retrato();
      const lugar = String(onde ?? 'abaixo').toLowerCase();
      if (!['abaixo', 'acima'].includes(lugar)) {
        throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, `onde ${onde} (use: abaixo, acima)`);
      }

      let alvo = dentroDe ? exigirElemento(dentroDe, 'dentroDe') : null;
      if (alvo && !['bpmn:Participant', 'bpmn:Lane'].includes(String(alvo.type))) {
        throw nomeado(ERROS_ESCRITA.SEM_LUGAR, `${alvo.id} não é um pool nem uma raia`);
      }
      if (!alvo) {
        const pools = acesso.pools();
        if (!pools.length) {
          throw nomeado(
            ERROS_ESCRITA.SEM_LUGAR,
            'este diagrama não tem pool; crie um pool primeiro e depois as raias dele',
          );
        }
        if (pools.length > 1) {
          const nomes = pools.map((p) => {
            const r = resumir(p);
            return r.nome ? `"${r.nome}" (${r.id})` : r.id;
          }).join(', ');
          throw nomeado(
            ERROS_ESCRITA.SEM_LUGAR,
            `há mais de um pool — diga em qual com dentroDe: ${nomes}`,
            pools.map(resumir),
          );
        }
        [alvo] = pools;
      }

      const raiasAntes = acesso.raiasDe(alvo).length;
      let nova;
      try {
        nova = acesso.criarRaia({ alvo, onde: lugar });
      } catch (err) {
        if (/nada_mudou/.test(err?.message ?? '')) {
          throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'o bpmn-js não devolveu a raia nova');
        }
        throw err;
      }

      const confirmada = acesso.porId(nova?.id);
      if (!confirmada || String(confirmada.type) !== 'bpmn:Lane') {
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'a raia não apareceu no registro');
      }

      const rotulo = typeof nome === 'string' ? nome.trim() : '';
      if (rotulo) {
        acesso.renomear({ el: confirmada, nome: rotulo });
        if (nomeDe(acesso.porId(confirmada.id)) !== rotulo) {
          throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `a raia nasceu sem o nome "${rotulo}"`);
        }
      }

      return {
        criada: resumir(acesso.porId(confirmada.id)),
        em: resumir(alvo),
        onde: lugar,
        raiasAgora: acesso.raiasDe(alvo).length,
        raiasAntes,
        // As DUAS faixas do primeiro pedido (o `addLane` cria a do que já estava lá) são o
        // desenho mudando: quem conta isso é a leitura.
        tela: tela(confirmada.id, retratoAntes),
        fatos: fatos(confirmada.id, retratoAntes),
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
    async mover({ id, direcao, passos, dentroDe, entre } = {}) {
      exigirEdicao();
      const retratoAntes = retrato();
      const el = exigirElemento(id);
      const dentro = dentroDe ? exigirElemento(dentroDe, 'dentroDe') : null;

      /**
       * MOVER PARA O MEIO DE UM FLUXO — com o elemento que JÁ EXISTE.
       *
       * ⚠ Sem isto, "põe o conferir estoque entre o início e o select a pizza" só tinha um verbo
       * capaz de entrar num fluxo: `criar_elemento`. O modelo usava esse, e o aluno ficava com
       * duas tarefas iguais (dois gêmeos em 2026-11-15). Aqui ele reposiciona o que existe.
       */
      const nomesEntre = Array.isArray(entre) ? entre.filter((x) => typeof x === 'string' && x.trim()) : [];
      if (entre !== undefined && nomesEntre.length !== 2) {
        throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, 'entre pede exatamente dois ids, na ordem do fluxo');
      }
      if (nomesEntre.length === 2) {
        const anterior = exigirElemento(nomesEntre[0], 'entre[0]');
        const seguinte = exigirElemento(nomesEntre[1], 'entre[1]');
        const fluxo = acesso.fluxoEntre(anterior, seguinte);
        if (!fluxo) {
          throw nomeado(
            ERROS_ESCRITA.SEM_LUGAR,
            `não há fluxo de ${anterior.id} para ${seguinte.id}; ligue os dois antes`,
          );
        }
        let religado;
        try {
          religado = acesso.moverParaOMeio({ el, fluxo });
        } catch (err) {
          if (!/sem_lugar_para_mover/.test(err?.message ?? '')) throw err;
          throw nomeado(ERROS_ESCRITA.SEM_LUGAR, `${el.id} não pode entrar neste fluxo`);
        }
        const { entradas, saidas } = acesso.entradasESaidas(el.id);
        const entrou = entradas.some((c) => c.source?.id === anterior.id)
          && saidas.some((c) => c.target?.id === seguinte.id);
        if (!entrou) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'o elemento não ficou no meio do caminho');
        return {
          movido: resumir(el),
          inseridoEntre: { de: resumir(anterior), para: resumir(seguinte) },
          religado,
          tela: tela(el.id, retratoAntes),
          fatos: fatos(el.id, retratoAntes),
        };
      }

      if (!dentro && !direcao) {
        throw nomeado(
          ERROS_ESCRITA.TIPO_INVALIDO,
          `diga para onde: direcao (${DIRECOES_MOVER.join(', ')}), dentroDe (id do pool/raia) `
          + 'ou entre (dois ids, para pô-lo no meio do caminho)',
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
        tela: tela(id, retratoAntes),
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
      const retratoAntes = retrato();
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
        /**
         * ⚠ "Os elementos seguem fora de linha" é verdade e não ensina nada — e a causa mais
         * comum tem nome: eles estão em RAIAS (ou pools) diferentes, e uma forma não sai da raia
         * dela só porque alguém pediu alinhamento. O dono tentou quatro de uma vez e levou um
         * "me dê dois" do agente, que é o que sobra quando o erro não diz o motivo.
         */
        const faixas = new Set(els.map((e) => e?.parent?.id ?? '?'));
        if (faixas.size > 1) {
          throw nomeado(
            ERROS_ESCRITA.NAO_MUDOU,
            `${els.length} elementos em ${faixas.size} faixas diferentes (raia ou pool): alinhe os `
            + 'que estiverem na MESMA faixa, ou mova um deles antes com a ferramenta mover',
          );
        }
        throw nomeado(ERROS_ESCRITA.NAO_MUDOU, 'os elementos seguem fora de linha');
      }
      return {
        alinhados: els.map(resumir),
        eixo,
        em: centros[0],
        // Quantas setas foram redesenhadas junto: é o que separa "alinhou" de "alinhou e ficou bom".
        setasEndireitadas: r?.endireitadas ?? 0,
        separados: r?.separados ?? 0,
        tela: tela(lista[0], retratoAntes),
      };
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
      const retratoAntes = retrato();
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
        tela: tela(confirmado.id, retratoAntes),
      };
    },

    /**
     * DESFAZ o último comando do diagrama — a mesma pilha do `Ctrl+Z` do aluno.
     *
     * Existe porque em voz as mãos dele não estão no teclado: "desfaz isso" é uma frase, não um
     * atalho. E é honesto sobre o alcance: a pilha é UMA, então o último comando pode ter sido
     * dele. O resultado diz o que saiu e o que voltou, para o agente contar em vez de afirmar.
     */
    async desfazer({ quantos } = {}) {
      exigirEdicao();
      const retratoAntes = retrato();
      const idsDe = () => acesso.elementos().filter((e) => e && !e.labelTarget && e.parent).map((e) => e.id);
      const antes = idsDe();

      let r;
      try {
        r = acesso.desfazer({ quantos: quantos ?? 1 });
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
        // Quantos comandos voltaram DE FATO. Pedir mais do que a pilha tem nao e erro — e o
        // numero daqui e o que o agente conta ao aluno, em vez do que ele pediu.
        desfeitos: r?.desfeitos ?? 1,
        pedidos: r?.pedidos ?? 1,
        // Mudança de nome, de cor ou de posição não muda id nenhum: as duas listas vêm vazias e
        // isso não é erro. O que prova o desfazer é a pilha ter aceitado (`canUndo` antes).
        sairamDoDiagrama: antes.filter((id) => !depois.includes(id)),
        voltaramAoDiagrama: depois.filter((id) => !antes.includes(id)),
        total: depois.length,
        aindaDaParaDesfazer: r?.aindaDaParaDesfazer ?? null,
        tela: tela(null, retratoAntes),
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
      const retratoAntes = retrato();
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
      return { destacados: els.map(resumir), cor: chave, tela: tela(lista[0], retratoAntes) };
    },

    /**
     * Troca o nome de um elemento. `modeling.updateLabel` — desfazível como qualquer comando.
     *
     * ⚠ Serve para FLUXO também, e esse é o uso que o aluno não imagina estar pedindo: o rótulo
     * da seta que sai de um gateway é a CONDIÇÃO do caminho ("se aprovado", "se faltar item").
     */
    async renomear({ id, nome } = {}) {
      exigirEdicao();
      const retratoAntes = retrato();
      const el = exigirElemento(id);
      const antes = nomeDe(el);
      const novo = typeof nome === 'string' ? nome.trim() : '';
      if (!novo) throw nomeado(ERROS_ESCRITA.TIPO_INVALIDO, 'nome vazio');

      acesso.renomear({ el, nome: novo });

      const depois = nomeDe(acesso.porId(id));
      if (depois !== novo) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `nome segue "${depois ?? ''}"`);
      return { id, de: antes, para: depois, tela: tela(id, retratoAntes) };
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
      const retratoAntes = retrato();
      const el = exigirElemento(id);
      const alvo = resumir(el);

      if (typeof pedirConfirmacao !== 'function') {
        // Sem quem perguntar, não remove. Fail-closed vale especialmente para o destrutivo.
        throw nomeado(ERROS_ESCRITA.NAO_EDITAVEL, 'sem confirmação na interface');
      }

      const versao = assinaturaDoDiagrama(acesso.elementos());
      /**
       * O aluno já respondeu FALANDO (ou digitando) depois da pergunta? Então não se pergunta de
       * novo com um botão: ele acabou de responder. Em voz, as mãos dele não estão no teclado, e
       * exigir o clique era quebrar a conversa no único momento em que o agente precisa da pessoa.
       *
       * O diálogo continua para quem não respondeu — e a assinatura do diagrama (H14) é conferida
       * nos dois caminhos, logo abaixo.
       */
      const autorizado = portaoAberto('remover') || await pedirConfirmacao({ acao: 'remover', alvo, versao });
      if (!autorizado) {
        // Recusa é FATO que volta ao modelo. Sem isso ele narra a remoção como feita.
        return { removido: false, recusadoPeloAluno: true, alvo };
      }
      if (assinaturaDoDiagrama(acesso.elementos()) !== versao) {
        throw nomeado(ERROS_ESCRITA.DIAGRAMA_MUDOU, `${id} pode não ser mais o mesmo elemento`);
      }

      acesso.remover({ el });

      if (acesso.porId(id)) throw nomeado(ERROS_ESCRITA.NAO_MUDOU, `${id} continua no diagrama`);
      return {
        removido: true,
        alvo,
        total: acesso.elementos().filter((e) => e && !e.labelTarget && e.parent).length,
        tela: tela(null, retratoAntes),
      };
    },
  };
}
