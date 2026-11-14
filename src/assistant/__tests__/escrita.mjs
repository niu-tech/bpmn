/**
 * Fase F7 — as quatro ferramentas que ESCREVEM no diagrama.
 *
 * O que cada bloco protege, em uma frase:
 *  - **toda escrita passa pelo `modeling`** (tarefa 3.5): é ele que registra no `commandStack`, e
 *    é o commandStack que faz o `Ctrl+Z` do aluno desfazer o que o agente fez. Um dublê de
 *    modelador registra as chamadas e o teste afirma que nenhuma tocou XML ou `businessObject`;
 *  - **confirmação é LIDA de volta**: se o registro não mudou, a ferramenta falha com
 *    `nada_mudou` em vez de devolver sucesso. Chamada que não estoura e não muda nada é o jeito
 *    mais fácil de o instrumento mentir;
 *  - **remover pede confirmação na interface** e recusa do aluno é FATO que volta ao modelo —
 *    sem isso ele narra a remoção como feita;
 *  - **`diagrama_mudou` (H14)**: se o desenho mudou entre o pedido e o clique, não apaga. O `id`
 *    de então pode ser outro elemento agora;
 *  - **página que só lê recusa as quatro**, mesmo que a declaração tenha vazado;
 *  - o tipo da ligação **não é escolhido por nós**: entre pools o bpmn-js faz `MessageFlow`, e o
 *    retorno diz qual nasceu;
 *  - **a VAGA também não é escolhida por nós**: o elemento ancorado nasce onde o `autoPlace` do
 *    bpmn-js disser, que é o mesmo serviço do botão de append do aluno. Omitir a posição cai no
 *    `AppendBehavior`, que usa um ponto fixo e nasce POR CIMA do vizinho num diagrama cheio
 *    (print do portão F7, 2026-11-14).
 *
 * Run: node src/assistant/__tests__/escrita.mjs
 */
import assert from 'node:assert/strict';

import { ERROS_ESCRITA, TIPOS_CRIAVEIS, criarExecutoresDeEscrita } from '../tools/escrita.js';
import { criarAcessoBpmn } from '../tools/bpmn-api.js';
import { permitida } from '../agent/policy.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

/* ---------------------------------------------------------------- dublê do modelador
 * Dubla o bpmn-js de verdade, e não a nossa camada: aqui o que está sob teste INCLUI
 * `bpmn-api.js`, porque é ela que decide que só `modeling` escreve. */

function criarModeladorFalso({ semVaga = false, updateLabelMudo = false, regras = null } = {}) {
  const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: {} };
  const mapa = new Map([[raiz.id, raiz]]);
  const chamadas = [];
  let seq = 0;

  const guardar = (el) => { mapa.set(el.id, el); return el; };

  const modeling = {
    appendShape(ancora, atributos, posicao, pai) {
      chamadas.push({ fn: 'appendShape', tipo: atributos.type, nome: atributos.name, de: ancora.id, posicao });
      const novo = guardar({
        id: `${atributos.type.replace('bpmn:', '')}_${++seq}`,
        type: atributos.type,
        parent: pai ?? raiz,
        businessObject: atributos.name ? { name: atributos.name } : {},
        incoming: [],
        outgoing: [],
      });
      // O bpmn-js cria a ligação junto — é isso que faz "uma tarefa depois do início" funcionar.
      const flow = guardar({
        id: `Flow_${++seq}`,
        type: 'bpmn:SequenceFlow',
        parent: pai ?? raiz,
        businessObject: {},
        source: ancora,
        target: novo,
      });
      ancora.outgoing = [...(ancora.outgoing ?? []), flow];
      novo.incoming = [flow];
      return novo;
    },

    createShape(atributos, posicao, pai) {
      chamadas.push({ fn: 'createShape', tipo: atributos.type, nome: atributos.name, posicao, pai });
      return guardar({
        id: `${atributos.type.replace('bpmn:', '')}_${++seq}`,
        type: atributos.type,
        parent: pai ?? raiz,
        businessObject: atributos.name ? { name: atributos.name } : {},
        incoming: [],
        outgoing: [],
      });
    },

    connect(de, para) {
      chamadas.push({ fn: 'connect', de: de.id, para: para.id });
      // A REGRA do BPMN mora aqui, como no bpmn-js: pools diferentes ⇒ fluxo de mensagem.
      const pool = (el) => {
        let p = el;
        while (p && p.type !== 'bpmn:Participant') p = p.parent;
        return p ?? null;
      };
      const mesmoPool = pool(de) === pool(para);
      if (de.type === 'bpmn:EndEvent') return null; // o que as regras proíbem: recusa silenciosa
      return guardar({
        id: `Conn_${++seq}`,
        type: mesmoPool ? 'bpmn:SequenceFlow' : 'bpmn:MessageFlow',
        parent: raiz,
        businessObject: {},
        source: de,
        target: para,
      });
    },

    updateLabel(el, nome) {
      chamadas.push({ fn: 'updateLabel', id: el.id, nome });
      // `updateLabelMudo` finge o bpmn-js aceitando a chamada e não pondo o nome no desenho —
      // que foi exatamente o que aconteceu ao vivo quando o nome ia junto na criação.
      if (updateLabelMudo) return;
      el.businessObject = { ...(el.businessObject ?? {}), name: nome };
    },

    removeElements(lista) {
      chamadas.push({ fn: 'removeElements', ids: lista.map((e) => e.id) });
      for (const el of lista) mapa.delete(el.id);
    },
  };

  /**
   * A fábrica e o evento `autoPlace`, como o bpmn-js os entrega: a fábrica monta a forma com
   * largura e altura (é com elas que se pergunta "cabe aqui?"), e o evento devolve a vaga que o
   * botão de append do aluno usaria. Aqui a base é fixa — o que os testes provam é que ela vem
   * do bpmn-js e que o empurrão só acontece quando ela está ocupada.
   */
  const elementFactory = {
    createShape(atributos) {
      chamadas.push({ fn: 'elementFactory.createShape', tipo: atributos.type });
      return { ...atributos, width: 100, height: 80 };
    },
  };

  const eventBus = {
    on() {},
    off() {},
    fire(nome, dados) {
      if (nome !== 'autoPlace') return undefined;
      chamadas.push({ fn: 'consulta.vaga', de: dados?.source?.id });
      return { x: (dados?.source?.x ?? 0) + 180, y: dados?.source?.y ?? 0 };
    },
  };

  const modelador = {
    get(nome) {
      if (nome === 'elementRegistry') {
        return { getAll: () => [...mapa.values()], get: (id) => mapa.get(id) ?? null };
      }
      if (nome === 'selection') return { get: () => [] };
      if (nome === 'eventBus') return semVaga ? { on() {}, off() {} } : eventBus;
      if (nome === 'modeling') return modeling;
      if (nome === 'canvas') return { getRootElement: () => raiz, scrollToElement() {} };
      if (nome === 'elementFactory' && !semVaga) return elementFactory;
      // `rules` é a autoridade do bpmn-js sobre ONDE uma forma pode nascer. Ausente (o padrão
      // destes dublês) = o acesso cai no comportamento antigo, só a raiz.
      if (nome === 'rules' && regras) return { allowed: (acao, ctx) => acao === 'shape.create' && regras(ctx.shape, ctx.target) };
      throw new Error(`sem ${nome}`);
    },
  };

  return { modelador, mapa, raiz, chamadas, guardar };
}

/** Viewer: o `.get('modeling')` estoura, como no `NavigatedViewer` de verdade. */
function criarViewerFalso() {
  const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: {} };
  const tarefa = { id: 'Task_1', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Montar' } };
  const mapa = new Map([[raiz.id, raiz], [tarefa.id, tarefa]]);
  return {
    get(nome) {
      if (nome === 'elementRegistry') {
        return { getAll: () => [...mapa.values()], get: (id) => mapa.get(id) ?? null };
      }
      if (nome === 'selection') return { get: () => [] };
      if (nome === 'eventBus') return { on() {}, off() {} };
      throw new Error(`sem ${nome}`);
    },
  };
}

function montar({ confirmar = async () => true, semVaga = false, updateLabelMudo = false } = {}) {
  const falso = criarModeladorFalso({ semVaga, updateLabelMudo });
  const acesso = criarAcessoBpmn(falso.modelador);
  const pedidos = [];
  const exec = criarExecutoresDeEscrita({
    acesso,
    pedirConfirmacao: async (pedido) => { pedidos.push(pedido); return confirmar(pedido); },
  });
  return { ...falso, acesso, exec, pedidos };
}

/* ---------------------------------------------------------------- a camada fina */

test('o modelador é editável e o viewer não — a flag vem de PEDIR `modeling`, não de parâmetro', () => {
  assert.equal(criarAcessoBpmn(criarModeladorFalso().modelador).editavel, true);
  assert.equal(criarAcessoBpmn(criarViewerFalso()).editavel, false);
  assert.equal(criarAcessoBpmn(null).editavel, false);
});

test('acesso inerte não é no-op silencioso: escrever nele estoura com nome', () => {
  const inerte = criarAcessoBpmn(null);
  // No-op silencioso faria o agente narrar uma criação que não houve.
  assert.throws(() => inerte.criarSolto({ tipo: 'bpmn:Task' }), /pagina_somente_leitura/);
  assert.throws(() => inerte.remover({ el: {} }), /pagina_somente_leitura/);
});

/* ---------------------------------------------------------------- criar */

testAsync('criar com âncora devolve o elemento E a ligação que nasceu junto', async () => {
  const { exec, mapa, raiz, guardar } = montar();
  const inicio = guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  assert.equal(r.criado.tipo, 'Task');
  assert.equal(r.criado.nome, 'Receber pedido');
  assert.equal(r.ligadoA.id, 'StartEvent_1');
  // Dizer que a ligação já existe é o que impede o agente de ligar de novo e duplicar o fluxo.
  assert.equal(r.ligacao.tipo, 'SequenceFlow');
  assert.ok(mapa.has(r.criado.id));
});

testAsync('a VAGA do elemento ancorado vem do bpmn-js, não de um cálculo nosso', async () => {
  // ⚠ Este teste nasceu de um PRINT: no diagrama de 48 elementos da pizzaria, a tarefa criada
  // apareceu por cima da vizinha. A causa não era a vaga errada — era vaga NENHUMA: posição
  // ausente faz o `AppendBehavior` do bpmn-js usar `source.x + width + 80` sem olhar o que já
  // está desenhado. A vaga sai do evento `autoPlace`, o mesmo do botão de append do aluno.
  const { exec, chamadas, raiz, guardar } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, x: 100, y: 200, width: 36, height: 36, incoming: [], outgoing: [] });

  await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  const nomes = chamadas.map((c) => c.fn);
  assert.ok(nomes.includes('consulta.vaga'), nomes.join(','));
  const append = chamadas.find((c) => c.fn === 'appendShape');
  // O essencial: NUNCA mais `null`. Posição ausente é o defeito, não um detalhe.
  // Vaga livre ⇒ é a do bpmn-js, intacta: o empurrão só existe quando ela está ocupada.
  assert.deepEqual(append.posicao, { x: 280, y: 200 });
  assert.ok(nomes.indexOf('consulta.vaga') < nomes.indexOf('appendShape'));
});

testAsync('vaga ocupada por vizinho NÃO ligado: empurra para a direita até caber', async () => {
  // ⚠ O teto do bpmn-js, medido ao vivo (2026-11-14): a busca de vaga dele só desvia do que está
  // LIGADO à âncora. Um vizinho solto parado na vaga é ignorado, e a tarefa nasce por cima dele
  // (`_6-650`, no portão F7). Direita, não para baixo: mantém a raia e a ordem de leitura.
  const { exec, chamadas, raiz, guardar } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, x: 100, y: 200, width: 36, height: 36, incoming: [], outgoing: [] });
  // A vaga do bpmn-js seria o centro (280,200) ⇒ caixa 230..330 × 160..240. Este vizinho ocupa.
  guardar({ id: 'Task_parado', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Parado' }, x: 250, y: 160, width: 100, height: 80 });

  await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  // Um passo de largura + folga: 280 + 100 + 40.
  assert.deepEqual(chamadas.find((c) => c.fn === 'appendShape').posicao, { x: 420, y: 200 });
});

testAsync('raia NÃO é obstáculo: o elemento não foge da vaga por estar dentro de um pool', async () => {
  // ⚠ Medido ao vivo em 2026-11-14: o botão de append do PRÓPRIO bpmn-js põe a tarefa no mesmo
  // ponto que nós e ela encosta 3 px na borda da raia de cima — raias dividem borda. Enquanto a
  // raia contava como vaga ocupada, o empurrão corria os seis passos e desistia em TODO diagrama
  // com pools, que é o formato do diagrama da aula.
  const { exec, chamadas, raiz, guardar } = montar();
  const inicio = guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, x: 100, y: 200, width: 36, height: 36, incoming: [], outgoing: [] });
  // A raia cobre a vaga inteira e TEM FILHOS — é o fundo onde o elemento mora, não um vizinho.
  guardar({ id: 'Lane_1', type: 'bpmn:Lane', parent: raiz, businessObject: { name: 'clerk' }, x: 60, y: 150, width: 800, height: 124, children: [inicio] });

  await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  // A vaga do bpmn-js, intacta: nada de empurrão.
  assert.deepEqual(chamadas.find((c) => c.fn === 'appendShape').posicao, { x: 280, y: 200 });
});

testAsync('modelador montado SEM o módulo de vaga ainda cria — degrada, não quebra', async () => {
  const { exec, chamadas, raiz, guardar } = montar({ semVaga: true });
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  assert.equal(r.criado.tipo, 'Task');
  // Sem o serviço cai no append cru: cria e liga, no ponto fixo. Pior colocação, mesma garantia.
  const append = chamadas.find((c) => c.fn === 'appendShape');
  assert.ok(append);
  assert.equal(append.posicao, null);
});

testAsync('criar sem âncora cai EMBAIXO do que já está desenhado — e o retorno não finge que ligou algo', async () => {
  const { exec, chamadas, raiz, guardar } = montar();
  // Sem âncora não há de onde o bpmn-js pendurar, então a posição é nossa: ela só precisa não
  // nascer por cima. `220,200` fixo colocava o elemento solto sobre o diagrama do aluno.
  guardar({ id: 'Task_fundo', type: 'bpmn:Task', parent: raiz, businessObject: {}, x: 300, y: 400, width: 100, height: 80 });

  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });

  assert.equal(r.ligadoA, null);
  assert.equal(r.ligacao, null);
  const criar = chamadas.find((c) => c.fn === 'createShape');
  assert.ok(criar.posicao.y > 480, JSON.stringify(criar.posicao));
});

testAsync('diagrama vazio começa em cima, onde o aluno está olhando', async () => {
  const { exec, chamadas } = montar();
  await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });
  assert.deepEqual(chamadas.find((c) => c.fn === 'createShape').posicao, { x: 220, y: 200 });
});

/* ---------------------------------------------------------------- o nome CHEGA no desenho */

testAsync('o nome vai num comando PRÓPRIO — `updateLabel`, não atributo da criação', async () => {
  // ⚠ Print do portão F7 (2026-11-14): a tarefa nasceu ANÔNIMA na tela e o agente narrou o nome.
  // `createShape({ type, name })` deixa o `name` na forma e nunca no `businessObject`, que é o
  // que o desenho lê — e o rótulo externo de evento e gateway só existe se alguém o criar.
  const { exec, chamadas, raiz, guardar } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  // Nenhuma chamada de criação carrega `name`: o nome não viaja por atributo.
  for (const c of chamadas.filter((x) => x.fn === 'appendShape' || x.fn === 'createShape')) {
    assert.equal(c.nome, undefined, c.fn);
  }
  const rotulo = chamadas.find((c) => c.fn === 'updateLabel');
  assert.equal(rotulo.nome, 'Receber pedido');
  assert.equal(r.criado.nome, 'Receber pedido');
});

testAsync('nome que não pegou no desenho é `nada_mudou` — a criação não assina o que não vê', async () => {
  // O modelador aceita a chamada e não muda nada: o jeito mais fácil de o instrumento mentir.
  const { exec, raiz, guardar } = montar({ updateLabelMudo: true });
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /Receber pedido/.test(e.message),
  );
});

testAsync('tipo fora da lista é erro NOMEADO e a lista aceita vem na mensagem', async () => {
  const { exec } = montar();
  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'bpmn:Definitions' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /Task/.test(e.message),
  );
});

testAsync('tipo aceita `task`, `Task` e `bpmn:Task` — o aluno fala, o modelo repassa', async () => {
  for (const tipo of ['task', 'Task', 'bpmn:Task']) {
    const { exec } = montar();
    const r = await exec.criar_elemento({ tipo });
    assert.equal(r.criado.tipo, 'Task');
  }
});

testAsync('âncora que não existe não cria nada: `elemento_nao_encontrado` antes de escrever', async () => {
  const { exec, chamadas } = montar();
  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'Task', depoisDe: 'Task_999' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_ENCONTRADO && /depoisDe=Task_999/.test(e.message),
  );
  assert.equal(chamadas.length, 0);
});

/* ---------------------------------------------------------------- conectar */

testAsync('dentro do mesmo processo nasce fluxo de SEQUÊNCIA, e o retorno diz isso', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'A', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Montar' } });
  guardar({ id: 'B', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } });

  const r = await exec.conectar({ de: 'A', para: 'B' });
  assert.equal(r.tipoDaLigacao, 'SequenceFlow');
  assert.equal(r.ligou.de.nome, 'Montar');
});

testAsync('entre POOLS diferentes nasce fluxo de MENSAGEM — a regra é do bpmn-js, não nossa', async () => {
  const { exec, raiz, guardar } = montar();
  const cliente = guardar({ id: 'Pool_cliente', type: 'bpmn:Participant', parent: raiz, businessObject: { name: 'Cliente' } });
  const loja = guardar({ id: 'Pool_loja', type: 'bpmn:Participant', parent: raiz, businessObject: { name: 'Pizzaria' } });
  guardar({ id: 'A', type: 'bpmn:Task', parent: cliente, businessObject: { name: 'Pedir' } });
  guardar({ id: 'B', type: 'bpmn:Task', parent: loja, businessObject: { name: 'Receber' } });

  const r = await exec.conectar({ de: 'A', para: 'B' });
  // É deste fato que sai a explicação certa ao aluno (gate 4.4) — não de um `if` com palavra-chave.
  assert.equal(r.tipoDaLigacao, 'MessageFlow');
});

testAsync('recusa SILENCIOSA do bpmn-js vira `conexao_invalida`, nunca `{ok:true}`', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'Fim', type: 'bpmn:EndEvent', parent: raiz, businessObject: {} });
  guardar({ id: 'B', type: 'bpmn:Task', parent: raiz, businessObject: {} });
  // Silêncio virando sucesso faria o agente afirmar uma ligação que não está no desenho.
  await assert.rejects(
    () => exec.conectar({ de: 'Fim', para: 'B' }),
    (e) => e.nome === ERROS_ESCRITA.CONEXAO_INVALIDA,
  );
});

/* ---------------------------------------------------------------- renomear */

testAsync('renomear devolve o nome de antes e o de agora, lido de volta do registro', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Tarefa' } });
  const r = await exec.renomear({ id: 'T', nome: 'Assar a pizza' });
  assert.deepEqual(r, { id: 'T', de: 'Tarefa', para: 'Assar a pizza' });
});

testAsync('nome vazio não vira rótulo em branco: erro nomeado', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Tarefa' } });
  await assert.rejects(() => exec.renomear({ id: 'T', nome: '   ' }), (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO);
});

/* ---------------------------------------------------------------- remover */

testAsync('remover PERGUNTA antes, e a pergunta carrega o alvo e a versão do diagrama', async () => {
  const { exec, raiz, guardar, pedidos } = montar();
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } });

  const r = await exec.remover({ id: 'T' });
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].acao, 'remover');
  assert.equal(pedidos[0].alvo.nome, 'Assar');
  assert.ok(pedidos[0].versao.includes('T'));
  assert.equal(r.removido, true);
});

testAsync('aluno recusando é FATO que volta ao modelo — e o elemento continua lá (gate 4.3)', async () => {
  const { exec, mapa, raiz, guardar, chamadas } = montar({ confirmar: async () => false });
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } });

  const r = await exec.remover({ id: 'T' });
  assert.equal(r.removido, false);
  assert.equal(r.recusadoPeloAluno, true);
  assert.ok(mapa.has('T'));
  // Nem o `modeling` foi tocado: a recusa acontece ANTES de qualquer comando.
  assert.equal(chamadas.filter((c) => c.fn === 'removeElements').length, 0);
});

testAsync('diagrama mudou entre o pedido e o clique: recusa com `diagrama_mudou` (H14)', async () => {
  const falso = criarModeladorFalso();
  const acesso = criarAcessoBpmn(falso.modelador);
  falso.guardar({ id: 'T', type: 'bpmn:Task', parent: falso.raiz, businessObject: { name: 'Assar' } });

  const exec = criarExecutoresDeEscrita({
    acesso,
    // O aluno demora a clicar, e nesse meio-tempo o diagrama muda. O `id` de então pode ser
    // outro elemento agora — apagar o errado por meio segundo de diferença é o pior defeito aqui.
    pedirConfirmacao: async () => {
      falso.guardar({ id: 'Outra', type: 'bpmn:Task', parent: falso.raiz, businessObject: {} });
      return true;
    },
  });

  await assert.rejects(() => exec.remover({ id: 'T' }), (e) => e.nome === ERROS_ESCRITA.DIAGRAMA_MUDOU);
  assert.ok(falso.mapa.has('T'));
});

testAsync('sem quem perguntar, não remove: fail-closed vale especialmente para o destrutivo', async () => {
  const falso = criarModeladorFalso();
  falso.guardar({ id: 'T', type: 'bpmn:Task', parent: falso.raiz, businessObject: {} });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador) });
  await assert.rejects(() => exec.remover({ id: 'T' }), (e) => e.nome === ERROS_ESCRITA.NAO_EDITAVEL);
  assert.ok(falso.mapa.has('T'));
});

/* ---------------------------------------------------------------- página que só lê */

testAsync('as quatro recusam num viewer, mesmo com a declaração vazada de outra sessão', async () => {
  const acesso = criarAcessoBpmn(criarViewerFalso());
  const exec = criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true });

  for (const [nome, args] of [
    ['criar_elemento', { tipo: 'Task' }],
    ['conectar', { de: 'Task_1', para: 'Task_1' }],
    ['renomear', { id: 'Task_1', nome: 'x' }],
    ['remover', { id: 'Task_1' }],
  ]) {
    await assert.rejects(() => exec[nome](args), (e) => e.nome === ERROS_ESCRITA.NAO_EDITAVEL, nome);
  }
});

test('a política esconde as quatro de uma página que só lê, e libera no modelador', () => {
  const nomes = ['criar_elemento', 'conectar', 'renomear', 'remover'];
  for (const n of nomes) {
    assert.equal(permitida(n, { pagina: 'viewer' }), false, n);
    assert.equal(permitida(n, { pagina: 'modelador' }), true, n);
    // Default-deny também para o esquecimento: contexto ausente é o caso mais restrito.
    assert.equal(permitida(n, undefined), false, n);
  }
});

/* ---------------------------------------------------------------- toda escrita por `modeling` */

testAsync('nenhuma das quatro toca XML ou `businessObject` direto (tarefa 3.5)', async () => {
  const { exec, raiz, guardar, chamadas } = montar();
  guardar({ id: 'A', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'A' }, incoming: [], outgoing: [] });
  guardar({ id: 'B', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'B' }, incoming: [], outgoing: [] });

  await exec.criar_elemento({ tipo: 'Task', nome: 'C', depoisDe: 'A' });
  await exec.conectar({ de: 'A', para: 'B' });
  await exec.renomear({ id: 'B', nome: 'B2' });
  await exec.remover({ id: 'B' });

  // Só verbos do `modeling` — é o que garante que o `Ctrl+Z` do aluno desfaça tudo isso.
  //
  // `consulta.vaga` e `elementFactory.createShape` entram na lista porque NÃO escrevem: a
  // primeira só pergunta ao bpmn-js onde cabe, a segunda só monta o objeto. O que
  // a lista proíbe continua sendo o mesmo — XML na mão, `businessObject` direto, qualquer
  // caminho que o `commandStack` não veja.
  const permitidos = new Set([
    'appendShape', 'createShape', 'connect', 'updateLabel', 'removeElements',
    'consulta.vaga', 'elementFactory.createShape',
  ]);
  assert.deepEqual(chamadas.filter((c) => !permitidos.has(c.fn)), []);
  // 5 comandos para 4 operações: criar com nome são dois (a forma e o rótulo), e ligar,
  // renomear e remover são um cada. A vaga não conta — ela não escreve.
  assert.equal(chamadas.filter((c) => c.fn !== 'consulta.vaga' && c.fn !== 'elementFactory.createShape').length, 5);
});

testAsync('desfazer devolve o diagrama ao que era: o que o agente criou sai do registro (gate 4.1)', async () => {
  // O `commandStack` de verdade é do bpmn-js; o que PRECISA ser provado aqui é que toda escrita
  // nossa virou comando dele — porque é isso que faz o desfazer alcançar o trabalho do agente.
  const { exec, mapa, raiz, guardar, chamadas } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });
  const antes = new Set(mapa.keys());

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });
  assert.ok(!antes.has(r.criado.id));

  // Desfaz na mão o que os comandos registraram — o espelho do que o commandStack faria.
  // A vaga vem antes do append e não é comando. Criar COM nome são dois: a forma e o rótulo,
  // então o aluno desfaz duas vezes. É o preço de o nome chegar ao desenho.
  const comandos = chamadas.filter((c) => c.fn === 'appendShape' || c.fn === 'updateLabel').map((c) => c.fn);
  assert.deepEqual(comandos, ['appendShape', 'updateLabel']);
  for (const id of [...mapa.keys()]) if (!antes.has(id)) mapa.delete(id);
  assert.deepEqual([...mapa.keys()].sort(), [...antes].sort());
});

/* ---------------------------------------------------------------- onde o solto pode nascer */

/**
 * Um diagrama de COLABORAÇÃO: a raiz não recebe fluxo, os dois pools recebem.
 *
 * ⚠ Isto dubla a regra que o bpmn-js aplica de verdade, e que custou um crash ao vivo (portão
 * 4.5, 2026-11-14): `BpmnUpdater` guarda todo `bpmn:FlowElement` em `flowElements`, e uma
 * `bpmn:Collaboration` não tem essa coleção. Criar lá desenhava a forma na tela e quebrava o XML.
 */
function colaboracaoFalsa() {
  const falso = criarModeladorFalso({
    regras: (forma, alvo) => alvo.type !== 'bpmn:Collaboration',
  });
  falso.raiz.type = 'bpmn:Collaboration';
  const pool = (id, nome, y) => falso.guardar({
    id, type: 'bpmn:Participant', parent: falso.raiz, businessObject: { name: nome },
    x: 100, y, width: 600, height: 200, children: [],
  });
  falso.raiz.children = [pool('Pool_cliente', 'Pizza Customer', 100), pool('Pool_loja', 'Pizza vendor', 320)];
  return falso;
}

testAsync('colaboração com dois pools: a ferramenta PERGUNTA em qual, e não desenha nada', async () => {
  // Adivinhar o pool é pior que perguntar: o processo do aluno nasceria no lugar errado, e mover
  // depois é trabalho que ele não pediu. O erro carrega os NOMES para o agente poder perguntar.
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido por telefone' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /Pizza Customer/.test(e.message) && /Pizza vendor/.test(e.message),
  );
  // E NADA foi desenhado: recusa com nome é melhor que fantasma na tela.
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'createShape'), []);
});

testAsync('com `dentroDe`, o elemento nasce DENTRO do pool escolhido', async () => {
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido', dentroDe: 'Pool_loja' });

  const criar = falso.chamadas.find((c) => c.fn === 'createShape');
  assert.equal(criar.pai.id, 'Pool_loja');
  // À direita do que já está no pool (vazio ⇒ a partir da borda) e no meio da faixa.
  assert.deepEqual(criar.posicao, { x: 210, y: 420 });
  assert.equal(r.criado.nome, 'Pedido');
});

testAsync('`dentroDe` que as regras recusam é `sem_lugar`, não um elemento quebrado', async () => {
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'StartEvent', dentroDe: falso.raiz.id }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR,
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'createShape'), []);
});

testAsync('na raia, a vaga olha quem está DESENHADO dentro dela — não a lista de filhos', async () => {
  // ⚠ Print do portão 4.5 (2026-11-14): o início novo nasceu em cima do "Order received". Numa
  // colaboração o nó pertence ao POOL e a raia é uma faixa por cima, então `children` da raia vem
  // vazio e a vaga saía na borda esquerda, sobre quem já estava lá.
  const falso = colaboracaoFalsa();
  // Desenhado DENTRO do pool, mas pendurado na raiz: é esse o caso que a lista de filhos perde.
  falso.guardar({
    id: 'Event_ja_estava', type: 'bpmn:StartEvent', parent: falso.raiz, businessObject: { name: 'Order received' },
    x: 140, y: 400, width: 36, height: 36,
  });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido', dentroDe: 'Pool_loja' });

  // À direita de quem já estava (borda em 140+36), mais a folga de 60 e meia largura da forma
  // (o dublê da fábrica devolve 100x80 para qualquer tipo), e no meio vertical da faixa.
  assert.deepEqual(falso.chamadas.find((c) => c.fn === 'createShape').posicao, { x: 286, y: 420 });
});

testAsync('âncora cujo pai não recebe o tipo é `sem_lugar` — e nada é desenhado', async () => {
  // "uma tarefa depois do pool X" é um pedido que o modelo faz. O pai da âncora é a colaboração,
  // que não guarda fluxo: sem este portão, o bpmn-js desenha a forma e estoura ao salvar.
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'Task', nome: 'Depois do pool', depoisDe: 'Pool_loja' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /Pool_loja/.test(e.message),
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'appendShape' || c.fn === 'createShape'), []);
});

testAsync('processo simples: a raiz aceita, e o solto nasce nela sem perguntar nada', async () => {
  const falso = criarModeladorFalso({ regras: () => true });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });

  assert.equal(r.criado.tipo, 'StartEvent');
  assert.equal(falso.chamadas.find((c) => c.fn === 'createShape').pai.id, 'Process_1');
});

/* ---------------------------------------------------------------- catálogo */

test('os tipos criáveis são uma lista fechada e pequena: o que cabe num processo de aula', () => {
  assert.ok(TIPOS_CRIAVEIS.length > 10 && TIPOS_CRIAVEIS.length < 30);
  // `bpmn:Definitions` e companhia travam o modelador de formas que o aluno não sabe desfazer.
  for (const proibido of ['Definitions', 'Process', 'Collaboration', 'Participant', 'Lane']) {
    assert.ok(!TIPOS_CRIAVEIS.includes(proibido), proibido);
  }
});

report('escrita');
