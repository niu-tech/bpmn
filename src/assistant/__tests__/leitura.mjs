/**
 * Fase F6 — as ferramentas de leitura do diagrama.
 *
 * O portão desta fase (openspec/roadmap.md) é AO VIVO em VOZ: o modelo chama
 * `descrever_diagrama`, recebe o resultado e continua falando — e isso já foi medido no gate 4.3
 * (20 frames de áudio depois da ferramenta). Aqui fica a metade determinística das quatro.
 *
 * O que cada bloco protege, em uma frase:
 *  - a busca varre o REGISTRO INTEIRO, e é só por isso que o agente pode dizer "não existe"
 *    em vez de "não consta no resumo que recebi" (design H13);
 *  - erro é NOMEADO: `elemento_nao_encontrado` faz o modelo procurar, "deu erro" faz ele repetir;
 *  - resultado tem teto e o corte é dito — 400 elementos de volta é a cota do aluno indo embora;
 *  - métrica de simulação velha nunca é apresentada como estado atual (tarefa 2.4);
 *  - o dublê é da NOSSA camada fina, não do bpmn-js (design T6).
 *
 * Run: node src/assistant/__tests__/leitura.mjs
 */
import assert from 'node:assert/strict';

import { ERROS_LEITURA, assinaturaDoDiagrama, criarExecutoresDeLeitura, estadoDaTela, instantaneoDaTela } from '../tools/leitura.js';
import { criarAcessoBpmn } from '../tools/bpmn-api.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

/* ---------------------------------------------------------------- fixtures */

const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: { name: 'Pizzaria' } };

function el(id, type, name, extra = {}) {
  return { id, type, parent: raiz, businessObject: name ? { name } : {}, ...extra };
}

const inicio = el('StartEvent_1', 'bpmn:StartEvent', 'Pedido recebido');
const montar = el('Task_1', 'bpmn:Task', 'Montar a pizza');
const assar = el('Task_2', 'bpmn:Task', 'Assar a pizza');
const entregar = el('Task_3', 'bpmn:Task', 'Entregar ao cliente');
const gateway = el('Gateway_1', 'bpmn:ExclusiveGateway', 'Tem queijo?');
const raia = el('Lane_1', 'bpmn:Lane', 'Cozinha');
const fluxo = el('Flow_1', 'bpmn:SequenceFlow', null, { waypoints: [{ x: 0, y: 0 }] });
const rotulo = { id: 'Task_1_label', type: 'bpmn:Task', parent: raiz, labelTarget: montar, businessObject: { name: 'Montar a pizza' } };

montar.incoming = [fluxo];
montar.outgoing = [];

const DIAGRAMA = [raiz, inicio, montar, assar, entregar, gateway, raia, fluxo, rotulo];

/** Dublê da camada fina — cinco funções, como manda o design T6. */
function acessoFalso(elementos = DIAGRAMA, { selecionado = null } = {}) {
  return {
    disponivel: true,
    elementos: () => elementos,
    porId: (id) => elementos.find((e) => e.id === id) ?? null,
    selecionado: () => selecionado,
    entradasESaidas: (id) => {
      const e = elementos.find((x) => x.id === id);
      return { entradas: e?.incoming ?? [], saidas: e?.outgoing ?? [] };
    },
    assinar: () => () => {},
  };
}

const ferramentas = (opcoes = {}) => criarExecutoresDeLeitura({ acesso: acessoFalso(), ...opcoes });

console.log('\n▶ descrever: o diagrama inteiro, não a amostra');

await testAsync('conta por tipo sem contar rotulo nem a raiz', async () => {
  const r = await ferramentas().descrever_diagrama();
  assert.deepEqual(r.processo, { id: 'Process_1', nome: 'Pizzaria' });
  assert.equal(r.total, 7, 'raiz fora, rotulo fora');
  assert.equal(r.contagem.Task, 3);
  assert.deepEqual(r.raias, ['Cozinha']);
});

await testAsync('traz o elemento selecionado, e ignora rotulo selecionado', async () => {
  const comSel = criarExecutoresDeLeitura({ acesso: acessoFalso(DIAGRAMA, { selecionado: gateway }) });
  assert.deepEqual((await comSel.descrever_diagrama()).selecionado,
    { id: 'Gateway_1', tipo: 'ExclusiveGateway', nome: 'Tem queijo?' });

  const comRotulo = criarExecutoresDeLeitura({ acesso: acessoFalso(DIAGRAMA, { selecionado: rotulo }) });
  assert.equal((await comRotulo.descrever_diagrama()).selecionado, null);
});

console.log('\n▶ buscar: é esta que autoriza dizer "não existe"');

await testAsync('acha por pedaco do nome, sem acento e sem caixa', async () => {
  const r = await ferramentas().buscar_elemento({ termo: 'PIZZA' });
  assert.deepEqual(r.elementos.map((e) => e.id).sort(), ['Task_1', 'Task_2']);
  assert.equal(r.varreuODiagramaInteiro, true, 'e isso que permite concluir ausencia');
});

await testAsync('acha por tipo, com ou sem o prefixo bpmn:', async () => {
  const semPrefixo = await ferramentas().buscar_elemento({ tipo: 'Task' });
  const comPrefixo = await ferramentas().buscar_elemento({ tipo: 'bpmn:task' });
  assert.equal(semPrefixo.total, 3);
  assert.deepEqual(semPrefixo.elementos.map((e) => e.id), comPrefixo.elementos.map((e) => e.id));
});

await testAsync('nome E tipo se somam', async () => {
  const r = await ferramentas().buscar_elemento({ termo: 'pizza', tipo: 'Task' });
  assert.equal(r.total, 2);
  const soEvento = await ferramentas().buscar_elemento({ termo: 'pizza', tipo: 'StartEvent' });
  assert.equal(soEvento.total, 0);
});

await testAsync('busca sem resultado NAO e erro: e um fato', async () => {
  // "Nao achei" e informacao que o modelo usa; erro faria ele tentar de novo igual.
  const r = await ferramentas().buscar_elemento({ termo: 'calabresa' });
  assert.equal(r.total, 0);
  assert.deepEqual(r.elementos, []);
  assert.equal(r.varreuODiagramaInteiro, true);
});

await testAsync('resultado tem teto, e o corte e DITO', async () => {
  const muitos = [raiz, ...Array.from({ length: 50 }, (_, i) => el(`T${i}`, 'bpmn:Task', `tarefa ${i}`))];
  const r = await criarExecutoresDeLeitura({ acesso: acessoFalso(muitos) }).buscar_elemento({ tipo: 'Task' });
  assert.equal(r.total, 50, 'o total e o de verdade');
  assert.equal(r.elementos.length, 20);
  assert.equal(r.cortou, 30, 'cortar em silencio faria o modelo responder sobre meia lista');
});

await testAsync('rotulo externo nao aparece na busca', async () => {
  const r = await ferramentas().buscar_elemento({ termo: 'Montar' });
  assert.deepEqual(r.elementos.map((e) => e.id), ['Task_1']);
});

console.log('\n▶ detalhar: o que entra e o que sai');

await testAsync('traz tipo, nome, onde esta, entradas e saidas', async () => {
  const r = await ferramentas().detalhar_elemento({ id: 'Task_1' });
  assert.equal(r.tipo, 'Task');
  assert.equal(r.nome, 'Montar a pizza');
  assert.equal(r.dentroDe.id, 'Process_1');
  assert.deepEqual(r.entradas.map((e) => e.id), ['Flow_1']);
  assert.deepEqual(r.saidas, []);
});

await testAsync('id que nao existe vira erro NOMEADO', async () => {
  await assert.rejects(
    () => ferramentas().detalhar_elemento({ id: 'Task_404' }),
    (err) => err.nome === ERROS_LEITURA.NAO_ENCONTRADO,
  );
});

await testAsync('rotulo nao e elemento detalhavel', async () => {
  await assert.rejects(
    () => ferramentas().detalhar_elemento({ id: 'Task_1_label' }),
    (err) => err.nome === ERROS_LEITURA.NAO_ENCONTRADO,
  );
});

console.log('\n▶ simulação: lida, nunca disparada — e nunca velha sem aviso');

await testAsync('sem corrida, erro nomeado (e nao um resumo vazio)', async () => {
  await assert.rejects(
    () => ferramentas().resumir_simulacao(),
    (err) => err.nome === ERROS_LEITURA.SEM_CORRIDA,
  );
});

const CORRIDA = {
  summaryRows: [
    { replication: 1, throughput: 0.5, avgWip: 2, completedCases: 10 },
    { replication: 2, throughput: 0.7, avgWip: 4, completedCases: 14 },
  ],
  taskRows: [
    { taskId: 'Task_1', waitTime: 1, duration: 2 },
    { taskId: 'Task_1', waitTime: 3, duration: 2 },
    { taskId: 'Task_2', waitTime: 10, duration: 1 },
  ],
};

await testAsync('resume replicacoes, medias e o GARGALO pela espera', async () => {
  const acesso = acessoFalso();
  const f = criarExecutoresDeLeitura({
    acesso,
    lerSimulacao: () => ({ quando: 'ontem', resumo: CORRIDA, assinatura: assinaturaDoDiagrama(DIAGRAMA) }),
  });
  const r = await f.resumir_simulacao();
  assert.equal(r.replicacoes, 2);
  assert.equal(r.throughputMedio, 0.6);
  assert.equal(r.wipMedio, 3);
  // Gargalo e onde se ESPERA mais: fila, nao o trabalho em si.
  assert.equal(r.gargalo.id, 'Task_2');
  assert.equal(r.gargalo.nome, 'Assar a pizza', 'o id sozinho nao diz nada ao aluno');
  assert.equal(r.gargalo.esperaMedia, 10);
  assert.equal(r.diagramaMudouDepoisDaCorrida, false);
  assert.equal(r.aviso, undefined);
});

await testAsync('diagrama mudou depois da corrida: AVISA', async () => {
  // O aluno roda a simulacao, mexe no desenho e pergunta do gargalo. Sem o aviso, a resposta
  // apresenta metrica de um diagrama que nao existe mais como se fosse o estado atual.
  const f = criarExecutoresDeLeitura({
    acesso: acessoFalso(),
    lerSimulacao: () => ({ resumo: CORRIDA, assinatura: 'outra-coisa' }),
  });
  const r = await f.resumir_simulacao();
  assert.equal(r.diagramaMudouDepoisDaCorrida, true);
  assert.match(r.aviso, /desenho anterior/);
});

test('a assinatura muda quando o diagrama muda, e so quando muda', () => {
  const a = assinaturaDoDiagrama(DIAGRAMA);
  assert.equal(a, assinaturaDoDiagrama([...DIAGRAMA].reverse()), 'ordem nao e mudanca');
  assert.notEqual(a, assinaturaDoDiagrama([...DIAGRAMA, el('X', 'bpmn:Task', 'nova')]));
});

console.log('\n▶ sem diagrama na página');

await testAsync('sem acesso, toda leitura devolve sem_diagrama', async () => {
  const f = criarExecutoresDeLeitura({ acesso: criarAcessoBpmn(null) });
  for (const nome of ['descrever_diagrama', 'buscar_elemento', 'detalhar_elemento']) {
    await assert.rejects(() => f[nome]({ id: 'x' }), (err) => err.nome === ERROS_LEITURA.SEM_DIAGRAMA, nome);
  }
});

test('a camada fina sem modelador e inerte, e nao explode', () => {
  const a = criarAcessoBpmn(null);
  assert.equal(a.disponivel, false);
  assert.deepEqual(a.elementos(), []);
  assert.equal(a.porId('x'), null);
  assert.equal(a.selecionado(), null);
  assert.deepEqual(a.entradasESaidas('x'), { entradas: [], saidas: [] });
  assert.equal(typeof a.assinar([], () => {}), 'function');
});

test('modelador que nao responde .get tambem e inerte', () => {
  assert.equal(criarAcessoBpmn({}).disponivel, false);
  assert.equal(criarAcessoBpmn({ get: () => { throw new Error('nao existe'); } }).disponivel, false);
});

/* ---------------------------------------------------------------- a tela, depois da ação
 *
 * A leitura que toda escrita devolve (change `close-the-loop-with-the-canvas`). O que ela
 * protege: o modelo decide o próximo passo pelo DESENHO de agora, não pela memória do que pediu —
 * e os cinco campos de ocasião que nasceram em 48 horas (`ramo`, `avisoDeRamo`,
 * `virouColaboracao`, `adotou`, `criouAFaixaDoQueJaExistia`) saem todos daqui, com substituto. */

test('a leitura diz o que o diagrama é, e conta forma separada de ligação', () => {
  const tela = estadoDaTela(acessoFalso());

  assert.match(tela, /é um processo/);
  // 5 formas (início, 3 tarefas, gateway): raia é continente e o rótulo não conta duas vezes.
  assert.match(tela, /5 formas e 1 ligação/);
});

test('a leitura nomeia quem está sem nenhuma ligação — o defeito mais comum de aluno', () => {
  const tela = estadoDaTela(acessoFalso());

  assert.match(tela, /Sem nenhuma ligação/);
  assert.match(tela, /"Assar a pizza"/);
  // "Montar a pizza" tem entrada: não é ponta solta.
  assert.ok(!/Sem nenhuma ligação:[^.]*Montar/.test(tela));
});

test('a leitura diz o que o aluno selecionou, porque é com isso que ele fala "esse aqui"', () => {
  assert.match(estadoDaTela(acessoFalso(DIAGRAMA, { selecionado: assar })), /selecionado/);
  assert.ok(!/selecionado/.test(estadoDaTela(acessoFalso())));
});

test('a leitura sempre lembra o modelo do que ele não pode fazer sozinho', () => {
  assert.match(estadoDaTela(acessoFalso()), /não apaga, não move/);
});

test('sem diagrama a leitura diz isso, em vez de estourar', () => {
  assert.match(estadoDaTela(criarAcessoBpmn(null)), /Não há diagrama/);
  assert.equal(instantaneoDaTela(criarAcessoBpmn(null)), null);
});

test('diagrama grande não vira despejo: a lista de pontas soltas se limita sozinha', () => {
  const muitos = [raiz];
  for (let i = 0; i < 80; i++) {
    muitos.push(el('T' + i, 'bpmn:Task', 'Tarefa com um nome bem comprido numero ' + i));
  }

  const tela = estadoDaTela(acessoFalso(muitos));

  assert.ok(tela.length <= 800, 'passou do teto: ' + tela.length);
  assert.match(tela, /e mais 76./, 'nomeia alguns e conta o resto');
});

test('a leitura tem teto, e o corte é DITO', () => {
  // Quem pode estourar o teto é a linha dos pools, que nomeia TODOS: 30 pools com nome de clínica
  // são mais de 760 caracteres só nela.
  const colaboracao = { id: 'Collaboration_1', type: 'bpmn:Collaboration', businessObject: {} };
  const muitos = [colaboracao];
  for (let i = 0; i < 30; i++) {
    muitos.push({
      id: 'Pool_' + i, type: 'bpmn:Participant', parent: colaboracao,
      businessObject: { name: 'Departamento de atendimento ao cliente numero ' + i },
    });
  }

  const tela = estadoDaTela(acessoFalso(muitos));

  assert.ok(tela.length <= 800, 'passou do teto: ' + tela.length);
  assert.match(tela, /leitura cortada/);
});

test('processo com raias e SEM pool não é lido como um desenho sem faixas', () => {
  const tela = estadoDaTela(acessoFalso());

  assert.match(tela, /O processo tem 1 faixa, sem pool/);
});

test('o retrato de antes são três números, e é ele que deixa a leitura contar a transição', () => {
  const antes = instantaneoDaTela(acessoFalso());

  assert.equal(antes.colaboracao, false);
  assert.equal(antes.formas, 5);
  // A raia do diagrama pendura no processo, não num pool: o retrato conta por dono, qualquer que seja.
  assert.deepEqual(antes.faixas, { Process_1: 1 });

  // A mesma leitura, com o retrato de um diagrama que era processo e agora é colaboração.
  const colaboracao = { id: 'Collaboration_1', type: 'bpmn:Collaboration', businessObject: {} };
  const pool = { id: 'Pool_1', type: 'bpmn:Participant', parent: colaboracao, businessObject: { name: 'Pizzaria' } };
  const tela = estadoDaTela(acessoFalso([colaboracao, pool]), { antes });

  assert.match(tela, /virou uma colaboração/);
  assert.match(tela, /as 5 formas que já estavam desenhadas/);
});

testAsync('descrever_diagrama conta as PONTAS SOLTAS, em vez de deixar o modelo conferir uma a uma', async () => {
  // Achado da avaliacao ao vivo (2026-11-15): perguntado "qual tarefa esta sem ligacao", o modelo
  // chamou `buscar_elemento` e DEZ `detalhar_elemento` para conferir elemento por elemento. Dez
  // chamadas pagas pela cota do aluno para um fato que ja' se calcula numa linha.
  const solta = { id: 'Task_solta', type: 'bpmn:Task', parent: { id: 'P' }, businessObject: { name: 'Conferir estoque' } };
  const ligada = { id: 'Task_1', type: 'bpmn:Task', parent: { id: 'P' }, businessObject: { name: 'Assar' } };
  const raiz = { id: 'P', type: 'bpmn:Process', businessObject: {} };
  const acesso = {
    disponivel: true,
    elementos: () => [raiz, ligada, solta],
    porId: (id) => [raiz, ligada, solta].find((e) => e.id === id) ?? null,
    selecionado: () => null,
    entradasESaidas: (id) => (id === 'Task_1'
      ? { entradas: [{ id: 'Flow_1' }], saidas: [] }
      : { entradas: [], saidas: [] }),
  };

  const r = await criarExecutoresDeLeitura({ acesso }).descrever_diagrama();

  assert.deepEqual(r.semLigacao.map((e) => e.nome), ['Conferir estoque']);
  // A varredura foi COMPLETA: e' isso que autoriza o modelo a dizer "nao ha" em vez de "nao sei".
  assert.equal(r.varreuODiagramaInteiro, true);
});

testAsync('sem nenhuma ponta solta, a lista vem VAZIA — e nao ausente', async () => {
  // Lista vazia significa "procurei e nao ha"; campo ausente significa "nao olhei". O modelo
  // precisa poder dizer a primeira coisa.
  const raiz = { id: 'P', type: 'bpmn:Process', businessObject: {} };
  const ligada = { id: 'Task_1', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } };
  const acesso = {
    disponivel: true,
    elementos: () => [raiz, ligada],
    porId: () => ligada,
    selecionado: () => null,
    entradasESaidas: () => ({ entradas: [{ id: 'f' }], saidas: [{ id: 'g' }] }),
  };

  const r = await criarExecutoresDeLeitura({ acesso }).descrever_diagrama();

  assert.deepEqual(r.semLigacao, []);
});

report('leitura');
