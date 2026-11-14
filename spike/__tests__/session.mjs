/**
 * Sessao Live — turno, tool obrigatoria, multiplos turnos, erros nomeados, reconexao com teto.
 * WebSocket injetado (MockSocket), relogio controlado. Sem chave, sem rede.
 *
 * Run: node spike/__tests__/session.mjs
 */
import assert from 'node:assert/strict';
import { createSession } from '../../src/assistant/live/session.js';
import { DELIVERY_TOOL } from '../../src/assistant/live/protocol.js';
import { MockSocket, fakeClock, mockFactory, report, test, testAsync } from './mock-socket.mjs';
import { promptDoPerfil } from '../../src/assistant/agent/render.js';
import { resolverContexto } from '../../src/assistant/agent/resolve.js';

/** O prompt e OBRIGATORIO desde a F2 (`buildSetup` recusa sem ele). Aqui vem do perfil texto. */
const SETUP = promptDoPerfil(resolverContexto({ modo: 'texto' }));

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
    setupOptions: SETUP,
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

await testAsync('tool que NAO e a entrega e respondida - com o resultado REAL, nao ok:true', async () => {
  // O despacho virou ASSINCRONO (fase F1): a resposta sai DEPOIS da execucao, nao antes. Sem
  // despachante registrado, a verdade e `ferramenta_nao_roteada` - e nao sucesso inventado.
  const { session, ws } = ready();
  session.ask('p');
  ws.emit({ toolCall: { functionCalls: [{ id: 'z', name: 'outra_coisa', args: {} }] } });
  assert.equal(ws.framesOf('toolResponse').length, 0, 'nada pode ser respondido antes de executar');

  await new Promise((r) => setTimeout(r, 0));

  const frames = ws.framesOf('toolResponse');
  assert.equal(frames.length, 1);
  const resposta = frames[0].toolResponse.functionResponses[0];
  assert.equal(resposta.id, 'z');
  assert.equal(resposta.response.ok, false);
  assert.equal(resposta.response.erro, 'ferramenta_nao_roteada');
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
  // ⚠ O quadro de AUDIO vai junto de proposito: fala de verdade traz audio, e o servidor manda os
  // dois (o parser ate documenta `{modelTurn, outputTranscription}` no mesmo quadro). A fixture
  // antes mandava so a legenda, e era por isso que ela nao distinguia fala de legenda emprestada.
  ws.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }] } } });
  ws.emit({ serverContent: { outputTranscription: { text: 'falei mas nao chamei a funcao' } } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(texts.at(-1).fallback, true);
  assert.equal(session.turns.at(-1).fallback, true);
});

test('legenda SEM audio nao vira resposta: e legenda emprestada da geracao anterior', () => {
  // Portao F5, 2026-11-13: o fim da recusa da pergunta 1 ("...sobre modelagem e boas praticas em
  // BPMN 2.0 no seu diagrama aberto.") chegou depois do turno dela ter fechado, caiu no turno da
  // pergunta 2 e virou a "resposta" dela - um fragmento comecando no meio da frase. O protocolo
  // nao carimba turno nos quadros; o que separa os casos e o audio.
  const { session, ws, texts } = ready();
  session.ask('como eu modelo uma pizzaria em bpmn?');
  ws.emit({ serverContent: { outputTranscription: { text: 'sobre modelagem e boas praticas em BPMN 2.0.' } } });
  ws.emit({ serverContent: { turnComplete: true } });
  const t = session.turns.at(-1);
  assert.equal(t.empty, true, 'turno sem audio proprio e VAZIO');
  assert.equal(t.text, '', 'nada de legenda emprestada no texto do turno');
  assert.equal(t.legendaEmprestada, 'sobre modelagem e boas praticas em BPMN 2.0.', 'fica no diario');
  assert.equal(texts.at(-1).vazio, true, 'a tela avisa em vez de mostrar texto de outro turno');
});

test('a MESMA chamada repetida executa UMA vez e reaproveita o resultado', () => {
  // O servidor repete `toolCall` - reconexao, retransmissao. Enquanto a ferramenta so LE, repetir
  // custa uma consulta; com a escrita da F7, repetir custa um elemento duplicado no diagrama.
  let batidas = 0;
  const { session, ws } = ready({
    dispatcher: {
      despachar: async (calls) => {
        batidas += calls.length;
        return calls.map((c) => ({ id: c.id, name: c.name, response: { ok: true, achou: 'Task_1' } }));
      },
    },
  });
  session.ask('existe esse elemento?');
  const chamada = { toolCall: { functionCalls: [{ id: 'fc-1', name: 'buscar_elemento', args: { termo: 'x' } }] } };
  ws.emit(chamada);
  ws.emit(chamada);                                  // o servidor repetiu a MESMA chamada
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    assert.equal(batidas, 1, `a ferramenta foi batida ${batidas}x; deveria ser 1`);
    const respostas = ws.sent.filter((f) => f.toolResponse);
    assert.equal(respostas.length, 2, 'as DUAS chamadas foram respondidas: sem resposta o turno pendura');
    const ultima = respostas.at(-1).toolResponse.functionResponses[0];
    assert.equal(ultima.response.achou, 'Task_1', 'a repetida devolve o resultado memorizado');
  });
});

test('chamada de id DIFERENTE no mesmo turno executa normalmente', () => {
  let batidas = 0;
  const { session, ws } = ready({
    dispatcher: {
      despachar: async (calls) => { batidas += calls.length; return calls.map((c) => ({ id: c.id, name: c.name, response: { ok: true } })); },
    },
  });
  session.ask('duas coisas');
  ws.emit({ toolCall: { functionCalls: [{ id: 'fc-1', name: 'buscar_elemento', args: {} }] } });
  ws.emit({ toolCall: { functionCalls: [{ id: 'fc-2', name: 'detalhar_elemento', args: {} }] } });
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    assert.equal(batidas, 2, 'ids distintos sao duas execucoes');
  });
});

test('quadro que chega DEPOIS do fim pertence ao turno que fechou, nao ao proximo', () => {
  // O protocolo nao carimba turno em quadro nenhum: a ordem e a unica pista. Sem dono explicito,
  // esse quadro voltava com `turno: null` e a camada de cima o entregava ao "turno mais recente" -
  // que, depois de uma pergunta nova, e o turno ERRADO (portao F5, 2026-11-13).
  const trans = [];
  const { session, ws } = ready({ onTranscript: (t) => trans.push(t) });
  session.ask('primeira');
  ws.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }] } } });
  ws.emit({ serverContent: { outputTranscription: { text: 'resposta da primeira' } } });
  const nDoPrimeiro = session.turns.length === 0 ? 1 : session.turns.at(-1)?.n ?? 1;
  ws.emit({ serverContent: { turnComplete: true } });
  // Cauda ATRASADA, com o turno ja fechado e nenhum turno novo aberto.
  ws.emit({ serverContent: { outputTranscription: { text: ' (cauda atrasada)' } } });
  const atrasado = trans.at(-1);
  assert.equal(atrasado.text, ' (cauda atrasada)');
  assert.equal(atrasado.turno, nDoPrimeiro, `a cauda ficou com o turno ${atrasado.turno}; deveria ser ${nDoPrimeiro}`);
  assert.notEqual(atrasado.turno, null, 'quadro atrasado nao volta mais sem dono');
});

test('o turno da FERRAMENTA nao fecha o turno do aluno', () => {
  // Medido no portao F6 (2026-11-13): o servidor fecha o turno logo depois do tool-response e
  // manda a RESPOSTA numa geracao nova. Fechando no primeiro turnComplete, a entrega chegava
  // sem turno aberto e era descartada - o aluno via a pergunta e nada mais.
  const { session, ws, texts } = ready({
    dispatcher: { despachar: async (calls) => calls.map((c) => ({ id: c.id, name: c.name, response: { ok: true } })) },
  });
  session.ask('existe esse elemento?');
  ws.emit({ toolCall: { functionCalls: [{ id: 't1', name: 'buscar_elemento', args: { termo: 'x' } }] } });
  ws.emit({ serverContent: { turnComplete: true } });          // fecho do turno de FERRAMENTA
  assert.equal(session.turns.length, 0, 'o turno do aluno continua aberto');

  // A resposta de verdade, na geracao seguinte.
  ws.emit({ toolCall: { functionCalls: [{ id: 'd1', name: DELIVERY_TOOL, args: { texto: 'existe, e uma tarefa' } }] } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(session.turns.length, 1, 'agora sim o turno fecha');
  assert.equal(session.turns[0].text, 'existe, e uma tarefa');
  assert.equal(texts.at(-1).text, 'existe, e uma tarefa');
});

test('T9: frame que chega depois da pergunta nova pertence ao turno ATROPELADO', () => {
  // O Live nao carimba turno no frame. A unica pista de fronteira e a ordem: o servidor termina
  // o turno anterior ANTES de comecar o novo, entao tudo que chega ate o proximo turnComplete e
  // do velho. Sem esta regra, o fim de uma resposta vira a resposta da pergunta seguinte.
  const { session, ws, texts } = ready();
  const t1 = session.ask('quantas tarefas?');
  const t2 = session.ask('o que e isto?');          // perguntou por cima
  assert.equal(t1, 1);
  assert.equal(t2, 2);

  ws.emit({ toolCall: { functionCalls: [{ id: 'd1', name: DELIVERY_TOOL, args: { texto: 'tem 9 tarefas' } }] } });
  assert.equal(texts.at(-1).turno, 1, 'o texto atrasado e do turno 1');

  ws.emit({ serverContent: { turnComplete: true } });   // fecha o ATROPELADO
  ws.emit({ toolCall: { functionCalls: [{ id: 'd2', name: DELIVERY_TOOL, args: { texto: 'e uma tarefa' } }] } });
  assert.equal(texts.at(-1).turno, 2, 'depois do fecho, o frame e do turno novo');
});

test('cada turno da sessao tem identidade propria e crescente', () => {
  const { session } = ready();
  assert.equal(session.ask('a'), 1);
  assert.equal(session.ask('b'), 2);
  assert.equal(session.ask('c'), 3);
});

test('turno que EXECUTOU ferramenta e fechou calado nao avisa nada', () => {
  // Medido no gate 4.3 e no portao F6 (2026-11-13): o fecho do turno de ferramenta nao e o fim
  // da conversa - a resposta vem na geracao seguinte. Nem aviso de "turno vazio" (que assusta a
  // toa), nem turno fechado (que descartaria a resposta quando ela chegar).
  const { session, ws, texts } = ready({
    dispatcher: { despachar: async (calls) => calls.map((c) => ({ id: c.id, name: c.name, response: { ok: true } })) },
  });
  session.ask('quantas raias?');
  ws.emit({ toolCall: { functionCalls: [{ id: 't1', name: 'descrever_diagrama', args: {} }] } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(texts.length, 0, 'o passo do meio nao anuncia nada');
  assert.equal(session.turns.length, 0, 'e nao fecha o turno do aluno');
});

test('turno vazio AVISA, e nao inventa resposta', () => {
  // Mudou em 2026-11-13: antes o turno vazio era silencio total, e o aluno via a propria
  // pergunta e mais nada. Agora sai um aviso com texto VAZIO e a marca `vazio` - quem escuta
  // decide o que mostrar. O que continua proibido e inventar conteudo.
  const { session, ws, texts } = ready();
  session.ask('p');
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(texts.length, 1, 'o turno vazio precisa ser anunciado');
  assert.equal(texts[0].text ?? texts[0], '');
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
  const s = createSession({ apiKey: 'AIzaCHAVEFALSADETESTE123456', socketFactory: mockFactory(), setupOptions: SETUP, clock });
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

// ⚠ O que separa "a chave nao presta" de "acabou a cota" NAO e a prosa do servidor.
// Classificar casando `api key` no texto de fechamento quebra calado no dia em que o Google muda
// a redacao - e ai o aluno e mandado procurar defeito no lugar errado. O sinal e o NOSSO estado:
// o setup ja foi aceito alguma vez nesta sessao?
test('recusa ANTES do setup aceito vira bad-key, qualquer que seja o texto', () => {
  for (const [code, texto] of [[1007, 'API key not valid.'], [1008, "unregistered callers"], [1007, ''], [1011, 'seja la o que for']]) {
    MockSocket.instances.length = 0;
    const { session, ws } = ready({ skipSetupComplete: true });
    ws.serverClose(code, texto);
    assert.equal(session.state, 'error');
    assert.equal(session.reason, 'bad-key', `${code} "${texto}" deveria ser bad-key`);
    assert.equal(MockSocket.instances.length, 1, 'credencial errada nao se conserta repetindo');
  }
});

test('recusa ANTES do setup, mas com a chave JA testada na aba, nao culpa a chave', () => {
  // Numa bateria longa o servidor passa a recusar SESSOES (divida M7) e o fecho vem antes do
  // setup. Dizer "a chave foi recusada" ali e mandar o aluno trocar uma chave que funciona -
  // visto no portao F3 em 2026-11-14, com a mesma chave respondendo nos outros cenarios.
  MockSocket.instances.length = 0;
  const { session, ws } = ready({ skipSetupComplete: true, chaveJaFuncionou: () => true });
  ws.serverClose(1011, '');
  assert.equal(session.reason, 'quota', 'chave que ja funcionou nao vira bad-key');
});

test('recusa DEPOIS do setup aceito vira quota: a chave ja autenticou', () => {
  for (const code of [1007, 1008, 1011]) {
    MockSocket.instances.length = 0;
    const { session, ws } = ready();          // `ready()` emite setupComplete
    ws.serverClose(code, 'API key not valid.');   // ate com o texto de chave: ela JA passou
    assert.equal(session.reason, 'quota', `${code} depois do setup deveria ser quota`);
    assert.equal(MockSocket.instances.length, 1, 'limite nao se conserta repetindo');
  }
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

/* -------------------------------------------------------------------------------------------
 * O portao F5 ficou aberto tres dias por UMA mensagem falsa: "o servidor nao respondeu".
 * A linha do tempo da sessao, no portao F7 (2026-11-14), mostrou o servidor respondendo — e o
 * relogio de silencio cobrando a conta de um turno que ja havia fechado.
 * ------------------------------------------------------------------------------------------- */

test('quadro que chega SEM turno aberto nao arma o relogio de silencio (dívida F5)', () => {
  const { session, ws, clock } = ready();
  session.ask('p');
  // Turno entregue e fechado: daqui em diante nao ha nada pedido.
  ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'pronto' } }] } });
  ws.emit({ serverContent: { turnComplete: true } });
  assert.equal(session.state, 'ready');

  // 25 quadros de audio depois do fim — o caso REAL medido. Cada um re-armava o relogio, e
  // quando eles paravam o relogio acusava o servidor de nao ter respondido.
  for (let i = 0; i < 25; i++) ws.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'AAAA' } }] } } });
  ws.emit({ serverContent: { generationComplete: true } });
  clock.flush();

  assert.notEqual(session.state, 'error', 'mensagem falsa: o servidor respondeu e foi acusado de calado');
  assert.equal(session.reason, null);
});

test('turno INTERROMPIDO e vazio espera a geracao seguinte, como o de ferramenta', () => {
  const { session, ws, clock, texts } = ready();
  session.ask('p');
  // A forma medida ao vivo: interrupted -> turnComplete -> a resposta, numa geracao nova.
  ws.emit({ serverContent: { interrupted: true } });
  ws.emit({ serverContent: { turnComplete: true } });
  // Fechando no turnComplete, isto chegava sem turno e era descartado.
  ws.emit({ toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'a resposta de verdade' } }] } });
  ws.emit({ serverContent: { turnComplete: true } });

  assert.equal(texts.at(-1)?.text, 'a resposta de verdade');
  clock.flush();
  assert.notEqual(session.state, 'error');
});

test('o relogio continua valendo para o que FOI pedido e nao veio', () => {
  // A trava nao pode virar "nunca mais reclamar": turno aberto e servidor calado segue erro.
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
