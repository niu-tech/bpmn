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
 *    retorno diz qual nasceu.
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

function criarModeladorFalso() {
  const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: {} };
  const mapa = new Map([[raiz.id, raiz]]);
  const chamadas = [];
  let seq = 0;

  const guardar = (el) => { mapa.set(el.id, el); return el; };

  const modeling = {
    appendShape(ancora, atributos, posicao, pai) {
      chamadas.push({ fn: 'appendShape', tipo: atributos.type, nome: atributos.name, de: ancora.id });
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
      chamadas.push({ fn: 'createShape', tipo: atributos.type, nome: atributos.name, posicao });
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
      el.businessObject = { ...(el.businessObject ?? {}), name: nome };
    },

    removeElements(lista) {
      chamadas.push({ fn: 'removeElements', ids: lista.map((e) => e.id) });
      for (const el of lista) mapa.delete(el.id);
    },
  };

  const modelador = {
    get(nome) {
      if (nome === 'elementRegistry') {
        return { getAll: () => [...mapa.values()], get: (id) => mapa.get(id) ?? null };
      }
      if (nome === 'selection') return { get: () => [] };
      if (nome === 'eventBus') return { on() {}, off() {} };
      if (nome === 'modeling') return modeling;
      if (nome === 'canvas') return { getRootElement: () => raiz };
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

function montar({ confirmar = async () => true } = {}) {
  const falso = criarModeladorFalso();
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

testAsync('criar sem âncora usa a posição fixa — e o retorno não finge que ligou algo', async () => {
  const { exec, chamadas } = montar();
  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });
  assert.equal(r.ligadoA, null);
  assert.equal(r.ligacao, null);
  assert.equal(chamadas.at(-1).fn, 'createShape');
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
  const permitidos = new Set(['appendShape', 'createShape', 'connect', 'updateLabel', 'removeElements']);
  assert.deepEqual(chamadas.filter((c) => !permitidos.has(c.fn)), []);
  assert.equal(chamadas.length, 4);
});

testAsync('desfazer devolve o diagrama ao que era: o que o agente criou sai do registro (gate 4.1)', async () => {
  // O `commandStack` de verdade é do bpmn-js; o que PRECISA ser provado aqui é que toda escrita
  // nossa virou comando dele — porque é isso que faz o desfazer alcançar o trabalho do agente.
  const { exec, mapa, raiz, guardar, chamadas } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });
  const antes = new Set(mapa.keys());

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });
  assert.ok(!antes.has(r.criado.id));

  // Desfaz na mão o que o único comando registrou — o espelho do que o commandStack faria.
  const comando = chamadas.at(-1);
  assert.equal(comando.fn, 'appendShape');
  for (const id of [...mapa.keys()]) if (!antes.has(id)) mapa.delete(id);
  assert.deepEqual([...mapa.keys()].sort(), [...antes].sort());
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
