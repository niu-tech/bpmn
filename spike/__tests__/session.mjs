/**
 * Sessao Live — turno, tool obrigatoria, multiplos turnos, erros nomeados, reconexao com teto.
 * WebSocket injetado (MockSocket), relogio controlado. Sem chave, sem rede.
 *
 * Run: node spike/__tests__/session.mjs
 */
import assert from 'node:assert/strict';
import { createSession } from '../../src/assistant/live/session.js';
import { DELIVERY_TOOL } from '../../src/assistant/live/protocol.js';
import { MockSocket, fakeClock, mockFactory, report, test } from './mock-socket.mjs';

/** Sessao ja conectada e com setup aceito. */
function ready(opts = {}) {
  const clock = fakeClock();
  const states = [];
  const texts = [];
  const logs = [];
  const audio = [];
  const session = createSession({
    apiKey: 'AIzaCHAVEFALSADETESTE123456',
    socketFactory: mockFactory(),
    clock,
    onState: (s) => states.push(s.reason ? `${s.state}(${s.reason})` : s.state),
    onText: (t) => texts.push(t),
    onAudio: (b) => audio.push(b),
    onLog: (m) => logs.push(m),
    ...opts,
  });
  session.start();
  const ws = MockSocket.instances.at(-1);
  ws.open();
  if (opts.skipSetupComplete !== true) ws.emit({ setupComplete: {} });
  return { session, ws, clock, states, texts, logs, audio };
}

console.log('\n▶ abertura');

test('o PRIMEIRO frame enviado e o setup', () => {
  const { ws } = ready();
  assert.ok(ws.sent[0].setup, 'primeiro frame deveria ser setup');
  assert.deepEqual(ws.setup.generationConfig.responseModalities, ['AUDIO']);
});

test('estado vai idle -> connecting -> ready', () => {
  const { states } = ready();
  assert.deepEqual(states.slice(0, 2), ['connecting', 'ready']);
});

test('sem chave: erro bad-key, nenhum socket aberto', () => {
  const factory = mockFactory();
  const s = createSession({ apiKey: '', socketFactory: factory, clock: fakeClock() });
  s.start();
  assert.equal(s.state, 'error');
  assert.equal(s.reason, 'bad-key');
  assert.equal(MockSocket.instances.length, 0);
});

test('nada sai antes do setupComplete: fica enfileirado e sai depois', () => {
  const { session, ws } = ready({ skipSetupComplete: true });
  session.ask('pergunta adiantada');
  assert.equal(ws.framesOf('realtimeInput').length, 0, 'nao deveria ter enviado ainda');
  ws.emit({ setupComplete: {} });
  assert.equal(ws.framesOf('realtimeInput').length, 1, 'deveria ter drenado a fila');
});

test('setup nao aceito dentro do prazo vira timeout', () => {
  const { session, clock } = ready({ skipSetupComplete: true });
  clock.flush();
  assert.equal(session.state, 'error');
  assert.equal(session.reason, 'timeout');
});

console.log('\n▶ PROVA C — pergunta digitada -> texto estruturado');

test('pergunta vai por realtimeInput.text', () => {
  const { session, ws } = ready();
  session.ask('o que e um gateway paralelo?');
  assert.deepEqual(ws.framesOf('realtimeInput').at(-1).realtimeInput, { text: 'o que e um gateway paralelo?' });
});

test('texto chega pelos argumentos da entrega e o turno fecha', () => {
  const { session, ws, texts } = ready();
  session.ask('p');
  ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'Abre todos os caminhos.' } }] } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(texts.at(-1).text, 'Abre todos os caminhos.');
  assert.equal(texts.at(-1).fallback, false);
  assert.equal(session.state, 'ready');
  assert.equal(session.turns.at(-1).delivered, true);
});

test('toda chamada de tool recebe toolResponse (sem isso o turno pendura)', () => {
  const { session, ws } = ready();
  session.ask('p');
  ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'x' } }] } });
  const resp = ws.framesOf('toolResponse');
  assert.equal(resp.length, 1);
  assert.equal(resp[0].toolResponse.functionResponses[0].id, 'c1');
});

test('tool que NAO e a entrega tambem e respondida', () => {
  const { session, ws } = ready();
  session.ask('p');
  ws.emit({ toolCall: { functionCalls: [{ id: 'z', name: 'outra_coisa', args: {} }] } });
  assert.equal(ws.framesOf('toolResponse').length, 1);
});

test('entrega repetida no mesmo turno e respondida e descartada (texto nao duplica)', () => {
  const { session, ws, texts, logs } = ready();
  session.ask('p');
  const call = { toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'uma vez' } }] } };
  ws.emit(call);
  ws.emit({ toolCall: { functionCalls: [{ id: 'c2', name: DELIVERY_TOOL, args: { texto: 'duas vezes' } }] } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(ws.framesOf('toolResponse').length, 2, 'as duas chamadas precisam de resposta');
  assert.equal(texts.filter((t) => !t.complete).length, 1, 'so o primeiro texto conta');
  assert.equal(session.turns.at(-1).text, 'uma vez');
  assert.ok(logs.some((m) => /repetida/.test(m)));
});

test('turno sem entrega usa a transcricao como FALLBACK, e diz que e fallback', () => {
  const { session, ws, texts } = ready();
  session.ask('p');
  ws.emit({ serverContent: { outputTranscription: { text: 'falei mas nao chamei a funcao' } } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(texts.at(-1).fallback, true);
  assert.equal(session.turns.at(-1).fallback, true);
});

test('turno vazio nao inventa resposta', () => {
  const { session, ws, texts } = ready();
  session.ask('p');
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(texts.length, 0);
  assert.equal(session.turns.at(-1).empty, true);
});

test('IN_PROGRESS nao fecha o turno: resposta parcial nao vira completa', () => {
  const { session, ws, texts } = ready();
  session.ask('p');
  ws.emit({ serverContent: { turnComplete: true, interactionStatus: 'IN_PROGRESS' } });
  assert.equal(session.turns.length, 0, 'turno nao deveria ter fechado');
  ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'resposta de verdade' } }] } });
  ws.emit({ serverContent: { interactionStatus: 'IDLE' } });
  assert.equal(session.turns.length, 1);
  assert.equal(texts.at(-1).text, 'resposta de verdade');
});

console.log('\n▶ multiplos turnos');

test('tres turnos seguidos fecham em ordem, sem resto de um no outro', () => {
  const { session, ws } = ready();
  for (const [i, q] of ['um', 'dois', 'tres'].entries()) {
    session.ask(q);
    ws.emit({ toolCall: { functionCalls: [{ id: `c${i}`, name: DELIVERY_TOOL, args: { texto: `r-${q}` } }] } });
    ws.emit({ serverContent: { turnComplete: true } });
  }
  assert.deepEqual(session.turns.map((t) => t.text), ['r-um', 'r-dois', 'r-tres']);
  assert.deepEqual(session.turns.map((t) => t.prompt), ['um', 'dois', 'tres']);
  assert.ok(session.turns.every((t) => t.complete));
});

console.log('\n▶ PROVAS A e B — audio');

test('quadro do microfone sai em realtimeInput.audio a 16 kHz', () => {
  const { session, ws } = ready();
  session.pushAudio('QUJD');
  const frame = ws.framesOf('realtimeInput').at(-1).realtimeInput;
  assert.match(frame.audio.mimeType, /rate=16000/);
  assert.equal(frame.audio.data, 'QUJD');
});

test('fechar o microfone avisa o fim da fala (sem isso o servidor nao transcreve)', () => {
  const { session, ws } = ready();
  session.pushAudio('QUJD');
  session.endAudio();
  assert.equal(ws.framesOf('realtimeInput').at(-1).realtimeInput.audioStreamEnd, true);
});

test('frame vazio e generationComplete nao fecham o turno nem poluem o log', () => {
  const { session, ws, logs } = ready();
  session.ask('p');
  ws.emit({});
  ws.emit({ serverContent: {} });
  ws.emit({ serverContent: { generationComplete: true } });
  assert.equal(session.turns.length, 0, 'nenhum deles encerra o turno');
  assert.ok(!logs.some((m) => /nao reconhecido/.test(m)), `log poluido: ${logs.join(' | ')}`);
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(session.turns.length, 1);
});

test('a legenda que vem JUNTO do audio entra na transcricao', () => {
  const trans = [];
  const { session, ws } = ready({ onTranscript: (t) => trans.push(t) });
  session.ask('p');
  ws.emit({ serverContent: {
    modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] },
    outputTranscription: { text: 'falando' } } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.deepEqual(trans.map((t) => t.text), ['falando']);
  assert.equal(session.turns.at(-1).fallback, true, 'sem entrega estruturada, a legenda e o texto');
});

test('a alca de retomada e guardada, nao virada ruido', () => {
  const { session, ws, logs } = ready();
  ws.emit({ sessionResumptionUpdate: { newHandle: 'h-42', resumable: true } });
  assert.equal(session.resumptionHandle, 'h-42');
  assert.ok(!logs.some((m) => /nao reconhecido/.test(m)));
});

test('a contagem de tokens do turno fica disponivel (custo e a cota do aluno)', () => {
  const { session, ws } = ready();
  session.ask('p');
  ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'x' } }] } });
  ws.emit({ serverContent: { turnComplete: true }, usageMetadata: { totalTokenCount: 771 } });
  assert.equal(session.turns.at(-1).usage.totalTokenCount, 771);
  assert.equal(session.lastUsage.totalTokenCount, 771);
});

test('audio do modelo chega ao playback e o estado vira speaking', () => {
  const { session, ws, audio } = ready();
  session.ask('p');
  ws.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });
  assert.deepEqual(audio, ['AAAA']);
  assert.equal(session.state, 'speaking');
  assert.equal(session.turns.length, 0);
});

test('interrupcao avisa para descartar o buffer', () => {
  let flushed = 0;
  const { session, ws } = ready({ onInterrupted: () => flushed++ });
  session.ask('p');
  ws.emit({ serverContent: { interrupted: true } });
  assert.equal(flushed, 1);
  assert.equal(session.state, 'ready');
});

test('o relogio injetado e chamado como METODO do proprio objeto', () => {
  // Protege o contrato da injecao. O defeito irmao — guardar `window.setTimeout` cru no relogio
  // DEFAULT e perder o `this` — so aparece no NAVEGADOR (TypeError: Illegal invocation) e esta
  // registrado em validation.md: por isso a rodada no browser faz parte do procedimento.
  const clock = {
    marca: 'eu',
    setTimeout(fn, ms) { if (this?.marca !== 'eu') throw new TypeError('Illegal invocation'); return setTimeout(fn, ms); },
    clearTimeout(id) { if (this?.marca !== 'eu') throw new TypeError('Illegal invocation'); clearTimeout(id); },
  };
  const s = createSession({ apiKey: 'AIzaCHAVEFALSADETESTE123456', socketFactory: mockFactory(), clock });
  s.start();
  const ws = MockSocket.instances.at(-1);
  ws.open();
  ws.emit({ setupComplete: {} });
  s.ask('p');                       // arma e desarma o relogio do turno
  ws.emit({ serverContent: { turnComplete: true } });
  s.close();
  assert.equal(s.state, 'idle');
});

console.log('\n▶ falhas nomeadas');

test('1007 (payload recusado) e nomeado e NAO vira retry', () => {
  const { session, ws } = ready();
  ws.serverClose(1007, 'invalid payload');
  assert.equal(session.state, 'error');
  assert.equal(session.reason, 'ws-closed:1007');
  assert.equal(MockSocket.instances.length, 1, 'nao deveria ter reconectado');
});

test('1011 vira quota, nao retry', () => {
  const { session, ws } = ready();
  ws.serverClose(1011);
  assert.equal(session.reason, 'quota');
  assert.equal(MockSocket.instances.length, 1);
});

test('queda comum reconecta com recuo e PARA no teto', () => {
  const { session, ws, clock } = ready({ maxReconnects: 2 });
  ws.serverClose(1006);
  assert.equal(session.state, 'connecting');
  clock.flush();                                   // 1a reconexao
  MockSocket.instances.at(-1).serverClose(1006);
  clock.flush();                                   // 2a reconexao
  MockSocket.instances.at(-1).serverClose(1006);
  assert.equal(session.state, 'error');
  assert.match(session.reason, /^ws-closed:1006$/);
  assert.equal(MockSocket.instances.length, 3, 'original + 2 tentativas, e para');
});

test('silencio do servidor depois do setup vira timeout em vez de travar', () => {
  const { session, ws, clock } = ready();
  session.ask('p');
  ws.emit({ serverContent: { outputTranscription: { text: 'oi' } } });
  clock.flush();
  assert.equal(session.state, 'error');
  assert.equal(session.reason, 'timeout');
});

test('close explicito encerra, nao reconecta e esvazia a fila', () => {
  const { session, ws, clock } = ready();
  session.close();
  assert.equal(session.state, 'idle');
  assert.equal(ws.closed.code, 1000);
  ws.serverClose(1006);
  clock.flush();
  assert.equal(MockSocket.instances.length, 1, 'fechamento nosso nao reconecta');
});

console.log('\n▶ credencial');

test('a chave aparece na URL do socket (contrato do Live) mas NUNCA no log', () => {
  const { ws, logs, session } = ready();
  assert.match(ws.url, /key=AIza/, 'o contrato do Live exige a chave na query');
  ws.error('WebSocket connection to ' + ws.url + ' failed');
  session.close();
  const all = logs.join('\n');
  assert.ok(!/AIzaCHAVEFALSADETESTE/.test(all), `chave vazou no log:\n${all}`);
  assert.match(all, /key=\*\*\*/);
});

report('session');
