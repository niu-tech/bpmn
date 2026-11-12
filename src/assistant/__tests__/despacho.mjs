/**
 * Fase F1 — o despacho honesto.
 *
 * O portão desta fase (openspec/roadmap.md): uma ferramenta que falha devolve `ok:false`, uma que
 * demora devolve `tempo_esgotado`, e em nenhum dos casos o turno fica pendurado.
 *
 * Antes disto, `buildToolResponse` respondia `{ok:true}` para TODA chamada, enviada antes de
 * existir executor. Servia para a entrega textual e mentia para qualquer ferramenta real.
 *
 * Run: node src/assistant/__tests__/despacho.mjs
 */
import assert from 'node:assert/strict';

import { ERROS, createToolDispatcher } from '../agent/dispatch.js';
import { createSession } from '../live/session.js';
import { forgetSecrets, rememberSecret } from '../live/redact.js';
import { MockSocket, fakeClock, mockFactory } from '../../../tools/mock-socket.mjs';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

const tudoPermitido = () => true;

console.log('\n▶ resultado REAL, nunca ok:true de graça');

await (async () => {
  await testAsync('executor que conclui devolve ok:true com o resultado', async () => {
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      executores: { contar: async () => ({ tarefas: 7 }) },
    });
    const [r] = await d.despachar([{ id: 'a1', name: 'contar', args: {} }]);
    assert.equal(r.id, 'a1');
    assert.equal(r.response.ok, true);
    assert.deepEqual(r.response.resultado, { tarefas: 7 });
  });

  await testAsync('executor que lanca devolve ok:false, nao sucesso', async () => {
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      executores: { quebrar: async () => { throw new Error('o elemento sumiu'); } },
    });
    const [r] = await d.despachar([{ id: 'a2', name: 'quebrar', args: {} }]);
    assert.equal(r.response.ok, false);
    assert.equal(r.response.erro, ERROS.FALHOU);
    assert.match(r.response.motivo, /elemento sumiu/);
  });

  await testAsync('default-deny: sem politica, nada executa', async () => {
    let chamou = false;
    const d = createToolDispatcher({ executores: { apagar: async () => { chamou = true; } } });
    const [r] = await d.despachar([{ id: 'a3', name: 'apagar', args: {} }]);
    assert.equal(r.response.erro, ERROS.NAO_PERMITIDA);
    assert.equal(chamou, false, 'o executor nao pode nem ser tocado');
  });

  await testAsync('permitida mas sem executor e OUTRO erro: catalogo furado', async () => {
    // Separar os dois importa: um e decisao de politica, o outro e defeito nosso.
    const d = createToolDispatcher({ permitido: tudoPermitido, executores: {} });
    const [r] = await d.despachar([{ id: 'a4', name: 'fantasma', args: {} }]);
    assert.equal(r.response.erro, ERROS.NAO_ROTEADA);
  });

  await testAsync('sessao encerrada recusa em vez de executar no vazio', async () => {
    let chamou = false;
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      executores: { tarde: async () => { chamou = true; } },
    });
    d.encerrar();
    const [r] = await d.despachar([{ id: 'a5', name: 'tarde', args: {} }]);
    assert.equal(r.response.erro, ERROS.ENCERRADA);
    assert.equal(chamou, false);
  });
})();

console.log('\n▶ teto proprio da ferramenta');

await (async () => {
  await testAsync('estourar o teto devolve tempo_esgotado', async () => {
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      tetoMs: 20,
      executores: { lenta: () => new Promise((r) => setTimeout(() => r('tarde demais'), 200)) },
    });
    const [r] = await d.despachar([{ id: 'b1', name: 'lenta', args: {} }]);
    assert.equal(r.response.ok, false);
    assert.equal(r.response.erro, ERROS.TEMPO);
    assert.equal(r.response.tetoMs, 20);
  });

  await testAsync('executor lento que termina DEPOIS do teto nao sobrescreve a resposta', async () => {
    let resolver;
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      tetoMs: 15,
      executores: { lenta: () => new Promise((r) => { resolver = r; }) },
    });
    const [r] = await d.despachar([{ id: 'b2', name: 'lenta', args: {} }]);
    assert.equal(r.response.erro, ERROS.TEMPO);
    resolver('chegou tarde');
    await new Promise((x) => setTimeout(x, 10));
    assert.equal(r.response.erro, ERROS.TEMPO, 'a resposta ja foi: nao muda depois');
  });
})();

console.log('\n▶ correlacao, corte e segredo');

await (async () => {
  await testAsync('toda chamada recebe resposta, na ordem e com o id', async () => {
    const d = createToolDispatcher({
      permitido: (n) => n !== 'proibida',
      executores: { ok1: async () => 1, ok2: async () => 2 },
    });
    const r = await d.despachar([
      { id: 'x', name: 'ok1', args: {} },
      { id: 'y', name: 'proibida', args: {} },
      { id: 'z', name: 'ok2', args: {} },
    ]);
    assert.deepEqual(r.map((e) => e.id), ['x', 'y', 'z']);
    assert.equal(r[1].response.erro, ERROS.NAO_PERMITIDA);
    assert.equal(r[2].response.ok, true);
  });

  await testAsync('resultado gigante e cortado, e o corte e declarado', async () => {
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      executores: { despejar: async () => ({ texto: 'x'.repeat(9000) }) },
    });
    const [r] = await d.despachar([{ id: 'c1', name: 'despejar', args: {} }]);
    assert.equal(r.response.resultado.cortado, true);
    assert.ok(r.response.resultado.de > 9000);
    assert.ok(r.response.resultado.previa.length <= 4000);
  });

  await testAsync('a chave nao vaza pela mensagem de erro da ferramenta', async () => {
    const CHAVE = 'AQ.CHAVE-SINTETICA-DO-DESPACHO-NAO-E-DE-NINGUEM-01';
    rememberSecret(CHAVE);
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      executores: { vazar: async () => { throw new Error(`falhou em wss://x?key=${CHAVE}`); } },
    });
    const [r] = await d.despachar([{ id: 'c2', name: 'vazar', args: {} }]);
    assert.ok(!r.response.motivo.includes(CHAVE), 'erro de ferramenta e onde a URL com a chave vaza');
    forgetSecrets();
  });

  await testAsync('ocupado e verdadeiro enquanto executa', async () => {
    let liberar;
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      executores: { segura: () => new Promise((r) => { liberar = r; }) },
    });
    const emVoo = d.despachar([{ id: 'c3', name: 'segura', args: {} }]);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(d.ocupado, true);
    liberar('pronto');
    await emVoo;
    assert.equal(d.ocupado, false);
  });
})();

console.log('\n▶ na sessao: o relogio do turno nao corre durante a ferramenta');

await (async () => {
  function sessaoPronta(dispatcher) {
    // `mockFactory()` nao recebe o socket: ele CRIA um por conexao, e o teste pega o ultimo.
    const clock = fakeClock();
    const factory = mockFactory();
    const session = createSession({
      apiKey: 'AQ.CHAVE-SINTETICA-DO-DESPACHO-NAO-E-DE-NINGUEM-01',
      socketFactory: factory,
      dispatcher,
      clock,
      idleTurnTimeoutMs: 1000,
    });
    session.start();
    const ws = MockSocket.instances.at(-1);
    ws.open();
    ws.emit({ setupComplete: {} });
    return { session, ws, clock };
  }

  await testAsync('ferramenta em execucao SEGURA o relogio de silencio do turno', async () => {
    let liberar;
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      tetoMs: 60000,
      executores: { demorada: () => new Promise((r) => { liberar = r; }) },
    });
    const { session, ws, clock } = sessaoPronta(d);
    session.ask('faz ai');
    ws.emit({ toolCall: { functionCalls: [{ id: 'd1', name: 'demorada', args: {} }] } });
    await new Promise((r) => setTimeout(r, 0));

    // `flush` dispara TODO relogio pendente. Se o de silencio do turno estivesse armado, ele
    // dispararia aqui e a sessao morreria por "servidor calado" com a ferramenta ainda rodando.
    const disparados = clock.flush();
    assert.equal(disparados, 0, 'nenhum relogio pode estar armado enquanto a ferramenta roda');
    assert.notEqual(session.state, 'error', 'o turno nao pode morrer enquanto a ferramenta roda');

    liberar({ feito: true });
    await new Promise((r) => setTimeout(r, 0));
    const frames = ws.framesOf('toolResponse');
    assert.equal(frames.length, 1);
    assert.equal(frames[0].toolResponse.functionResponses[0].response.ok, true);
    forgetSecrets();
  });

  await testAsync('fechar a sessao no meio nao envia resposta em socket morto', async () => {
    let liberar;
    const d = createToolDispatcher({
      permitido: tudoPermitido,
      tetoMs: 60000,
      executores: { demorada: () => new Promise((r) => { liberar = r; }) },
    });
    const { session, ws } = sessaoPronta(d);
    session.ask('faz ai');
    ws.emit({ toolCall: { functionCalls: [{ id: 'd2', name: 'demorada', args: {} }] } });
    await new Promise((r) => setTimeout(r, 0));

    session.close();
    liberar({ feito: true });
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(ws.framesOf('toolResponse').length, 0, 'nada sai depois do fechamento');
    forgetSecrets();
  });
})();

report('despacho');
