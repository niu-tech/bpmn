/**
 * O canal da PÁGINA: evento do bpmn-js -> frase marcada (change `close-the-loop-with-the-canvas`).
 *
 * O que se mede aqui é tradução e GUARDA, não protocolo: a fila, o prazo e a marca são da sessão
 * (`__tests__/session-manager.mjs`). Aqui a pergunta é outra — o fato que chega ao modelo é do
 * ALUNO, e não do agente mexendo no desenho?
 *
 * Run: node src/assistant/__tests__/pagina.mjs
 */
import assert from 'node:assert/strict';

import { ligarAnunciosDaPagina } from '../pagina.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

/** Dublê do `acesso`: guarda os handlers por evento para o teste disparar o que quiser. */
function fakeAcesso({ selecionado = null, selecionados = null, elementos = [] } = {}) {
  const handlers = new Map();
  const estado = { selecionado, selecionados, desassinados: 0 };
  return {
    estado,
    disparar(nome) {
      for (const fn of handlers.get(nome) ?? []) fn({});
    },
    acesso: {
      disponivel: true,
      editavel: true,
      elementos: () => elementos,
      porId: (id) => elementos.find((e) => e.id === id) ?? null,
      selecionado: () => estado.selecionado,
      // O verbo novo: a selecao INTEIRA (ver `bpmn-api.selecionados`).
      selecionados: () => estado.selecionados ?? (estado.selecionado ? [estado.selecionado] : []),
      entradasESaidas: () => ({ entradas: [], saidas: [] }),
      assinar(nomes, fn) {
        for (const n of [].concat(nomes)) handlers.set(n, [...(handlers.get(n) ?? []), fn]);
        return () => { estado.desassinados++; };
      },
    },
  };
}

const ESPERA = 10;

/** O debounce é de verdade: esperar um pouco mais que ele é o jeito honesto de medir. */
const deixarEscoar = () => new Promise((r) => setTimeout(r, ESPERA * 4));

const tarefa = { id: 'Task_1', type: 'bpmn:Task', parent: { id: 'Process_1' }, businessObject: { name: 'Assar a pizza' } };

function montar({ selecionado = null, elementos = [tarefa], ocupado = () => false } = {}) {
  const ditas = [];
  const f = fakeAcesso({ selecionado, elementos });
  const canal = ligarAnunciosDaPagina({
    acesso: f.acesso,
    anunciar: (frase) => { ditas.push(frase); return true; },
    ocupado,
    esperaDaSelecaoMs: ESPERA,
  });
  return { ...f, canal, ditas };
}

console.log('\n▶ o canal da página');

testAsync('seleção do aluno vira fato, com o nome e o tipo', async () => {
  const { disparar, ditas } = montar({ selecionado: tarefa });
  disparar('selection.changed');
  await deixarEscoar();

  assert.equal(ditas.length, 1);
  assert.match(ditas[0], /selecionou "Assar a pizza" \(task\)/);
  // A frase DIZ ao modelo para que serve o fato: sem isso ele recebe um aviso e não sabe o que
  // fazer com ele (e a seção do prompt sozinha não cobre o caso "esse aqui").
  assert.match(ditas[0], /esse aqui/i);
});

testAsync('dez cliques não produzem dez anúncios: debounce', async () => {
  const { disparar, ditas } = montar({ selecionado: tarefa });
  for (let i = 0; i < 10; i++) disparar('selection.changed');
  await deixarEscoar();

  assert.equal(ditas.length, 1, 'procurar o elemento certo é navegação, não dez fatos');
});

testAsync('desmarcar tudo não é fato', async () => {
  const { disparar, ditas } = montar({ selecionado: null });
  disparar('selection.changed');
  await deixarEscoar();

  assert.equal(ditas.length, 0, 'clicar no vazio do canvas não vale um turno de contexto');
});

testAsync('rótulo externo não vira fato', async () => {
  const { disparar, ditas } = montar({ selecionado: { id: 'Task_1_label', labelTarget: tarefa, type: 'label' } });
  disparar('selection.changed');
  await deixarEscoar();

  assert.equal(ditas.length, 0, 'o rótulo é o mesmo elemento desenhado duas vezes');
});

testAsync('elemento sem nome é dito pelo tipo e pelo id', async () => {
  const semNome = { id: 'Gateway_1', type: 'bpmn:ExclusiveGateway', businessObject: {} };
  const { disparar, ditas } = montar({ selecionado: semNome });
  disparar('selection.changed');
  await deixarEscoar();

  assert.match(ditas[0], /exclusivegateway Gateway_1/);
});

testAsync('import conta a tela inteira, com a MESMA leitura das ferramentas', async () => {
  const { disparar, ditas } = montar();
  disparar('import.done');
  await deixarEscoar();

  assert.equal(ditas.length, 1);
  assert.match(ditas[0], /abriu outro diagrama/);
  // Reuso, não paráfrase: trocar de arquivo muda tudo, e descrever isso com uma contagem própria
  // seria uma segunda verdade sobre a tela.
  assert.match(ditas[0], /O diagrama é um processo com 1 forma/);
});

testAsync('Ctrl+Z do aluno é fato; o desfazer do AGENTE não é', async () => {
  const comAgenteParado = montar();
  comAgenteParado.disparar('commandStack.reverted');
  await deixarEscoar();
  assert.equal(comAgenteParado.ditas.length, 1);
  assert.match(comAgenteParado.ditas[0], /desfez a última mudança \(Ctrl\+Z\)/);

  // ⚠ A guarda é o estado 'tool'. Enquanto uma ferramenta roda, quem desfaz é o agente — e
  // contar a própria ação de volta como fato do aluno é o agente conversando consigo mesmo.
  const comAgenteAgindo = montar({ ocupado: () => true });
  comAgenteAgindo.disparar('commandStack.reverted');
  await deixarEscoar();
  assert.equal(comAgenteAgindo.ditas.length, 0, 'o desfazer da ferramenta não volta como fato do aluno');
});

testAsync('a seleção que o AGENTE causa também não vira fato', async () => {
  // `criar_elemento` seleciona o que acabou de nascer: sem a guarda, cada criação produziria um
  // "o aluno selecionou…" com o elemento que o próprio agente criou.
  const { disparar, ditas } = montar({ selecionado: tarefa, ocupado: () => true });
  disparar('selection.changed');
  await deixarEscoar();

  assert.equal(ditas.length, 0);
});

testAsync('a simulação é contada pela PÁGINA, não por evento do modelador', async () => {
  const { canal, ditas } = montar();
  canal.simulacaoRodou({ summaryRows: [{}, {}, {}] });

  assert.equal(ditas.length, 1);
  assert.match(ditas[0], /rodou a simulação .*3 replicações/);
  // O agente comenta a corrida, não a dispara (design T5) — então a frase aponta a ferramenta.
  assert.match(ditas[0], /resumir_simulacao/);
});

test('sem modelador na página, o canal é inerte em vez de explodir', () => {
  const canal = ligarAnunciosDaPagina({ acesso: { disponivel: false }, anunciar: () => true });
  assert.equal(canal.simulacaoRodou(), false);
  canal.dispose();
});

test('sem quem anunciar, idem', () => {
  const canal = ligarAnunciosDaPagina({ acesso: { disponivel: true, assinar: () => () => {} } });
  assert.equal(canal.simulacaoRodou(), false);
});

testAsync('desmontar desliga os três eventos', async () => {
  const { canal, estado } = montar();
  canal.dispose();
  assert.equal(estado.desassinados, 3, 'seleção, import e Ctrl+Z');
});

testAsync('a nota conta a SELECAO INTEIRA, e nao apenas o primeiro', async () => {
  // ⚠ Dono, 2026-11-15, com quatro marcados por Shift e por laco: "ele sempre acha que eu estou
  // selecionando so' o elemento Hungry for Pizza". A nota da pagina era uma das tres bocas que
  // diziam "um so'" — e e' a que o modelo le como fato da tela.
  const quatro = [
    { id: 'Task_1', type: 'bpmn:Task', businessObject: { name: 'Select a pizza' } },
    { id: 'Task_2', type: 'bpmn:Task', businessObject: { name: 'Order a pizza' } },
    { id: 'Task_3', type: 'bpmn:Task', businessObject: { name: 'Pay the pizza' } },
    { id: 'Task_4', type: 'bpmn:Task', businessObject: { name: 'Eat the pizza' } },
  ];
  const { acesso, disparar } = fakeAcesso({ selecionados: quatro, elementos: quatro });
  const ditas = [];
  const canal = ligarAnunciosDaPagina({
    acesso,
    anunciar: (f) => { ditas.push(f); return true; },
    ocupado: () => false,
    esperaDaSelecaoMs: ESPERA,
  });

  disparar('selection.changed');
  await new Promise((r) => setTimeout(r, ESPERA * 4));

  assert.equal(ditas.length, 1);
  assert.match(ditas[0], /4 elementos/, 'diz QUANTOS');
  assert.match(ditas[0], /Select a pizza/);
  assert.match(ditas[0], /Eat the pizza/, 'e nomeia todos, nao apenas o primeiro');
  assert.match(ditas[0], /esses/, 'e ensina como o aluno vai chamar o conjunto');
  canal.dispose();
});

report('pagina');
