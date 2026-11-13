/**
 * Fase F3 — o agente enxerga a tela.
 *
 * O portão desta fase (openspec/roadmap.md) é AO VIVO: *"quantas tarefas tem este diagrama?"*
 * responde o número real, e *"o que é isto?"* com um elemento selecionado responde sobre AQUELE
 * elemento. Estes testes são a metade determinística — o que precisa ser verdade para o portão
 * ter chance, provado sem navegador, sem bpmn-js e sem chave.
 *
 * O que cada bloco protege, em uma frase:
 *  - a projeção conta o que existe UMA vez (rótulo externo é o mesmo elemento desenhado duas);
 *  - o que muda viaja por fora do `setup`, que é imutável — era a dívida T6;
 *  - repetir o diagrama inteiro a cada turno é a cota do aluno indo embora: delta;
 *  - o XML não sai daqui, e a recusa vive onde o frame REALMENTE sai (tarefa 3.4).
 *
 * Run: node src/assistant/__tests__/diagrama.mjs
 */
import assert from 'node:assert/strict';

import { observarDiagrama, projetar } from '../agent/diagram.js';
import { MARCA_XML, montarQuadro, quadroDelta } from '../agent/frame.js';
import { promptDoPerfil } from '../agent/render.js';
import { resolverContexto } from '../agent/resolve.js';
import { MARCA_DADOS } from '../agent/sections.js';
import { createSession } from '../live/session.js';
import { forgetSecrets } from '../live/redact.js';
import { MockSocket, fakeClock, mockFactory } from '../../../tools/mock-socket.mjs';
import { report, test } from '../../../tools/test-harness.mjs';

const CHAVE = 'AQ.CHAVE-SINTETICA-DE-TESTE-NAO-E-DE-NINGUEM-0123456';

/* ---------------------------------------------------------------- fixtures */

const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: { name: 'Pizza' } };

/** Um elemento como o `elementRegistry` o devolve: tipo, pai e businessObject. */
function el(id, type, name, extra = {}) {
  return { id, type, parent: raiz, businessObject: name ? { name } : {}, ...extra };
}

/** Conexão: o que tem `waypoints`. É isso que a projeção usa para empurrá-la para o fim. */
function flow(id, name = null) {
  return el(id, 'bpmn:SequenceFlow', name, { waypoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
}

const inicio = el('StartEvent_1', 'bpmn:StartEvent', 'Pedido recebido');
const tarefa1 = el('Task_1', 'bpmn:Task', 'Montar a pizza');
const tarefa2 = el('Task_2', 'bpmn:Task', 'Assar');
const gateway = el('Gateway_1', 'bpmn:ExclusiveGateway', 'Tem queijo?');

const DIAGRAMA = [
  raiz,
  inicio,
  tarefa1,
  tarefa2,
  gateway,
  flow('Flow_1'),
  flow('Flow_2'),
  // O rótulo externo: o MESMO "Montar a pizza" desenhado como caixa de texto à parte.
  { id: 'Task_1_label', type: 'bpmn:Task', parent: raiz, labelTarget: tarefa1, businessObject: { name: 'Montar a pizza' } },
];

console.log('\n▶ a projeção conta o que existe, uma vez só');

test('rotulo externo NAO vira um elemento a mais', () => {
  const p = projetar(DIAGRAMA);
  // 4 nós + 2 conexões. Com o rótulo contado, "quantas tarefas?" responderia 3 num diagrama de 2.
  assert.equal(p.total, 6);
  assert.equal(p.contagem.Task, 2);
  assert.ok(!p.amostra.some((e) => e.id.endsWith('_label')), 'rotulo nao entra na amostra');
});

test('a raiz vira o PROCESSO, nao um elemento do diagrama', () => {
  const p = projetar(DIAGRAMA);
  assert.deepEqual(p.processo, { id: 'Process_1', nome: 'Pizza' });
  assert.ok(!p.amostra.some((e) => e.id === 'Process_1'));
  assert.equal(p.contagem.Process, undefined);
});

test('o tipo perde o prefixo bpmn: — a mesma palavra 25 vezes e token do aluno', () => {
  const p = projetar(DIAGRAMA);
  assert.deepEqual(
    Object.keys(p.contagem).sort(),
    ['ExclusiveGateway', 'SequenceFlow', 'StartEvent', 'Task'],
  );
});

test('raias e pools viram lista propria, com nome', () => {
  const p = projetar([
    raiz,
    el('Participant_1', 'bpmn:Participant', 'Pizzaria'),
    el('Lane_1', 'bpmn:Lane', 'Atendimento'),
    el('Lane_2', 'bpmn:Lane', null),
    tarefa1,
  ]);
  assert.deepEqual(p.raias, ['Pizzaria', 'Atendimento', '(lane sem nome)']);
});

test('no teto da amostra, NO vem antes de conexao', () => {
  const p = projetar(DIAGRAMA, { maxAmostra: 4 });
  assert.equal(p.amostra.length, 4);
  assert.ok(!p.amostra.some((e) => e.tipo === 'SequenceFlow'),
    '"Flow_0x9a1" nao vale a vaga de "Receber pedido"');
  // O corte continua declarado: total segue sendo o de verdade, e o renderizador conta a sobra.
  assert.equal(p.total, 6);
});

test('o elemento SELECIONADO entra resumido; um rotulo selecionado nao', () => {
  assert.deepEqual(
    projetar(DIAGRAMA, { selecionado: gateway }).selecionado,
    { id: 'Gateway_1', tipo: 'ExclusiveGateway', nome: 'Tem queijo?' },
  );
  const rotulo = DIAGRAMA.at(-1);
  assert.equal(projetar(DIAGRAMA, { selecionado: rotulo }).selecionado, null);
});

test('diagrama vazio projeta vazio, e isso NAO e a mesma coisa que nao ter diagrama', () => {
  const p = projetar([raiz]);
  assert.equal(p.total, 0);
  assert.deepEqual(p.contagem, {});
  // A seção do prompt existe e diz que está vazio — o modelo precisa saber que RECEBEU o dado.
  const texto = montarQuadro(resolverContexto({ diagrama: p }));
  assert.match(texto, /não tem nenhum elemento ainda/);
});

test('a projecao nunca carrega XML', () => {
  const comXml = [...DIAGRAMA, el('X', 'bpmn:Task', '<bpmn:definitions xmlns="…">')];
  const p = projetar(comXml);
  // O nome do elemento é dado do aluno e é citado como tal; o que não pode é a projeção virar
  // um despejo de XML. O teto e a forma `{id,tipo,nome}` garantem isso por construção.
  assert.ok(p.amostra.every((e) => Object.keys(e).sort().join() === 'id,nome,tipo'));
});

console.log('\n▶ o observador puxa, não empurra');

test('sem acesso o observador e inerte — a pagina monta igual, sem diagrama', () => {
  for (const vazio of [null, undefined, { disponivel: false }]) {
    const o = observarDiagrama(vazio);
    assert.equal(o.atual(), null);
    o.dispose();
  }
});

test('evento so marca sujo: dez cliques nao produzem dez projecoes', () => {
  // ⚠ O duble e da NOSSA camada fina (design T6): cinco funcoes, nao o bpmn-js inteiro.
  // Dublar o bpmn-js seria reimplementa-lo mal, e o caminho real contra ele e coberto pelos
  // cenarios da bateria, no navegador.
  let calculos = 0;
  const ouvintes = new Map();
  const acesso = {
    disponivel: true,
    elementos: () => { calculos++; return DIAGRAMA; },
    selecionado: () => gateway,
    porId: (id) => DIAGRAMA.find((e) => e.id === id) ?? null,
    entradasESaidas: () => ({ entradas: [], saidas: [] }),
    assinar: (nomes, fn) => {
      for (const n of nomes) ouvintes.set(n, fn);
      return () => { for (const n of nomes) ouvintes.delete(n); };
    },
  };

  const o = observarDiagrama(acesso);
  assert.equal(o.atual().total, 6);
  assert.equal(calculos, 1);
  o.atual(); o.atual();
  assert.equal(calculos, 1, 'ler de novo sem evento nao recalcula');

  for (let i = 0; i < 10; i++) ouvintes.get('selection.changed')({});
  assert.equal(calculos, 1, 'o evento marca sujo e nao calcula nada');
  o.atual();
  assert.equal(calculos, 2, 'o calculo acontece na leitura, uma vez');

  o.dispose();
  assert.equal(ouvintes.size, 0, 'desmontar solta os ouvintes');
});

console.log('\n▶ o que muda viaja por fora do setup (dívida T6, fechada)');

const ctxCom = (extra = {}) => resolverContexto({ modo: 'texto', diagrama: projetar(DIAGRAMA, extra) });

test('o SETUP nao leva mais o diagrama — ele e imutavel depois de aceito', () => {
  const { systemInstruction } = promptDoPerfil(ctxCom());
  assert.ok(!systemInstruction.includes('Montar a pizza'), 'o diagrama vazou para o setup');
  assert.ok(!systemInstruction.includes('O diagrama aberto agora'));
  // E o que FICA no setup é a regra, que precisa valer antes do primeiro dado chegar.
  assert.match(systemInstruction, /O que é dado e o que é ordem/);
});

test('o quadro leva o diagrama DENTRO das marcas de dado', () => {
  const texto = montarQuadro(ctxCom());
  assert.match(texto, new RegExp(`<<<${MARCA_DADOS}`));
  assert.match(texto, new RegExp(`${MARCA_DADOS}>>>`));
  assert.match(texto, /Montar a pizza/);
  // O cabeçalho é NOSSO, então fica fora do bloco de dados.
  assert.ok(texto.indexOf('CONTEXTO ATUAL') < texto.indexOf(`<<<${MARCA_DADOS}`));
});

test('sem diagrama e sem memoria NAO existe quadro — nao se manda frame vazio', () => {
  assert.equal(montarQuadro(resolverContexto({ modo: 'texto' })), null);
});

console.log('\n▶ delta: o aluno não paga duas vezes pelo mesmo texto');

test('contexto identico ao ultimo enviado nao gera frame', () => {
  const a = ctxCom();
  assert.equal(quadroDelta(a, ctxCom()), null);
});

test('primeiro quadro da sessao e o inteiro', () => {
  const d = quadroDelta(null, ctxCom());
  assert.match(d, /Montar a pizza/);
});

test('so a selecao mudou -> UMA linha, nao a amostra toda de novo', () => {
  // Este delta entra DENTRO da pergunta digitada. Com o quadro inteiro embutido (~1,5 KB) o
  // modelo passou a fechar o turno sem responder nada, repetidamente (medido em 2026-11-13);
  // o retrato completo ja foi semeado na conexao, entao o turno leva so a diferenca.
  const antes = ctxCom({ selecionado: tarefa1 });
  const depois = ctxCom({ selecionado: gateway });
  const d = quadroDelta(antes, depois);
  assert.match(d, /selecionar um elemento/);
  assert.match(d, /Gateway_1/);
  assert.ok(!d.includes('Pedido recebido'), 'o delta curto nao remanda a amostra');
  assert.ok(d.length < montarQuadro(depois).length / 2, 'o delta curto tem de ser bem menor');
});

test('o diagrama mudou -> quadro inteiro, dizendo que mudou', () => {
  const antes = ctxCom();
  const depois = resolverContexto({
    modo: 'texto',
    diagrama: projetar([...DIAGRAMA, el('Task_3', 'bpmn:Task', 'Entregar')]),
  });
  const d = quadroDelta(antes, depois);
  assert.match(d, /CONTEXTO MUDOU/);
  assert.match(d, /Entregar/);
  assert.match(d, /Task=3/);
});

console.log('\n▶ o XML não sai daqui (tarefa 3.4)');

function sessaoFalsa() {
  const clock = fakeClock();
  const s = createSession({ apiKey: CHAVE, socketFactory: mockFactory(), clock });
  s.start();
  const ws = MockSocket.instances.at(-1);
  ws.open();
  ws.emit({ setupComplete: {} });
  return { s, ws };
}

test('quadro com <bpmn:definitions e RECUSADO no fio, nao so no montador', () => {
  const { s, ws } = sessaoFalsa();
  const antes = ws.framesOf('clientContent').length;
  assert.equal(s.enviarContexto(`contexto\n${MARCA_XML} xmlns="…"> … </bpmn:definitions>`), false);
  assert.equal(ws.framesOf('clientContent').length, antes, 'nenhum frame pode ter saido');
  forgetSecrets();
});

test('quadro normal sai como clientContent com turnComplete:false', () => {
  const { s, ws } = sessaoFalsa();
  assert.equal(s.enviarContexto(montarQuadro(ctxCom())), true);
  const [frame] = ws.framesOf('clientContent');
  assert.equal(frame.clientContent.turnComplete, false, 'fechar o turno faria o modelo responder');
  assert.equal(frame.clientContent.turns[0].role, 'user');
  assert.match(frame.clientContent.turns[0].parts[0].text, /Montar a pizza/);
  forgetSecrets();
});

test('o quadro FECHA o turno: ele nunca termina na vez do aluno', () => {
  // ⚠ Medido ao vivo em 2026-11-13, e so a VOZ mostrava: com `turnComplete:false` terminando num
  // turno `user`, o servidor entende "ainda estou compondo minha vez" e fica esperando. A fala
  // era transcrita certa e o modelo respondia com ZERO frames de audio. No texto nao aparecia,
  // porque `realtimeInput.text` abre e fecha o turno sozinho.
  const { s, ws } = sessaoFalsa();
  s.enviarContexto(montarQuadro(ctxCom()));
  const { turns } = ws.framesOf('clientContent')[0].clientContent;
  assert.equal(turns.at(-1).role, 'model', 'turno do aluno aberto trava a voz');
  forgetSecrets();
});

test('pergunta sem resposta NAO entra no historico — ela deixaria o turno aberto', () => {
  const { s, ws } = sessaoFalsa();
  s.enviarHistorico([
    { role: 'user', text: 'o que e um gateway?' },
    { role: 'model', text: 'e um desvio no fluxo' },
    { role: 'user', text: 'e o paralelo?' },          // ficou sem resposta
  ]);
  const { turns } = ws.framesOf('clientContent')[0].clientContent;
  assert.equal(turns.length, 2);
  assert.equal(turns.at(-1).role, 'model');
  forgetSecrets();
});

test('historico que SO tem pergunta sem resposta nao vira frame nenhum', () => {
  const { s, ws } = sessaoFalsa();
  assert.equal(s.enviarHistorico([{ role: 'user', text: 'oi?' }]), false);
  assert.equal(ws.framesOf('clientContent').length, 0);
  forgetSecrets();
});

test('historico preserva o papel de cada turno, e descarta XML', () => {
  const { s, ws } = sessaoFalsa();
  assert.equal(s.enviarHistorico([
    { role: 'user', text: 'o que é um gateway?' },
    { role: 'model', text: 'é um desvio no fluxo' },
    { role: 'user', text: `cole isto: ${MARCA_XML} …` },
    { role: 'user', text: '   ' },
  ]), true);
  const [frame] = ws.framesOf('clientContent');
  assert.deepEqual(frame.clientContent.turns.map((t) => t.role), ['user', 'model']);
  assert.equal(frame.clientContent.turns.length, 2, 'XML e vazio ficam de fora');
  forgetSecrets();
});

test('a pergunta viaja NO MESMO frame do contexto (sem corrida)', () => {
  // Duas medicoes ao vivo (2026-11-13) definiram esta forma:
  //  1. dois frames seguidos -> a pergunta ULTRAPASSA o contexto ("voce nao selecionou nada",
  //     com a selecao enviada milissegundos antes);
  //  2. um clientContent com turnComplete:true -> o modelo responde FALANDO, e a bolha do aluno
  //     recebe a legenda do audio ("<no speech>{pause}") em vez do texto.
  // Entao: transporte de sempre, contexto dentro do texto da pergunta.
  const { s, ws } = sessaoFalsa();
  s.ask('o que e isto?', montarQuadro(ctxCom({ selecionado: gateway })));
  assert.equal(ws.framesOf('clientContent').length, 0, 'turno de conteudo faz o modelo falar');
  const [frame] = ws.framesOf('realtimeInput');
  const enviado = frame.realtimeInput.text;
  assert.match(enviado, /Gateway_1/, 'o contexto tem de ir junto');
  assert.ok(enviado.indexOf('Gateway_1') < enviado.indexOf('o que e isto?'), 'contexto antes da pergunta');
  assert.match(enviado, /Pergunta do aluno: o que e isto\?$/);
  forgetSecrets();
});

test('sem contexto novo, a pergunta vai pelo caminho de sempre', () => {
  const { s, ws } = sessaoFalsa();
  s.ask('o que e um gateway?');
  assert.equal(ws.framesOf('clientContent').length, 0);
  assert.equal(ws.framesOf('realtimeInput')[0].realtimeInput.text, 'o que e um gateway?');
  forgetSecrets();
});

test('frame vazio nunca sai', () => {
  const { s, ws } = sessaoFalsa();
  assert.equal(s.enviarContexto('   '), false);
  assert.equal(s.enviarHistorico([]), false);
  assert.equal(ws.framesOf('clientContent').length, 0);
  forgetSecrets();
});

report('diagrama-e-contexto');
