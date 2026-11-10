/**
 * AssistantSessionManager — modos, ciclo de vida, teardown idempotente, historico em memoria.
 * Tudo com dublês: sem rede, sem AudioContext, sem chave.
 *
 * Run: node src/assistant/__tests__/session-manager.mjs
 */
import assert from 'node:assert/strict';

import { createCredentialStore } from '../credential.js';
import { createAssistantSession, describeError } from '../session-manager.js';
import { forgetSecrets } from '../live/redact.js';
import { report, test } from '../../../tools/test-harness.mjs';

const CHAVE = 'AQ.CHAVE-SINTETICA-DE-TESTE-NAO-E-DE-NINGUEM-0123456';

/** Dublê da sessão Live: registra o que foi pedido e deixa o teste dirigir os eventos. */
function fakeLive() {
  const criadas = [];
  const factory = (opts) => {
    let state = 'idle';
    const s = {
      opts,
      enviados: [],
      fechada: false,
      audioEncerrado: false,
      get state() { return state; },
      get lastUsage() { return null; },
      start() { state = 'connecting'; opts.onState?.({ state, reason: null }); },
      ask(t) { s.enviados.push({ tipo: 'texto', t }); },
      pushAudio(b) { s.enviados.push({ tipo: 'audio', b }); },
      endAudio() { s.audioEncerrado = true; },
      close() { s.fechada = true; state = 'idle'; },
      // gatilhos do teste
      pronta() { state = 'ready'; opts.onState?.({ state, reason: null }); },
      falha(reason) { state = 'error'; opts.onState?.({ state, reason }); },
      texto(t, extra = {}) { opts.onText?.({ text: t, fallback: false, complete: false, ...extra }); },
      legenda(t, side = 'output') { opts.onTranscript?.({ side, text: t }); },
      audio(b) { opts.onAudio?.(b); },
      interrompe() { opts.onInterrupted?.(); },
    };
    criadas.push(s);
    return s;
  };
  return { factory, criadas, get ultima() { return criadas.at(-1); } };
}

function fakeAudio() {
  const estado = { micsAbertos: 0, micsFechados: 0, playbacksAbertos: 0, playbacksFechados: 0, flushes: 0, negarMic: null };
  const startCapture = async ({ onFrame }) => {
    if (estado.negarMic) { const e = new Error('negado'); e.reason = estado.negarMic; throw e; }
    estado.micsAbertos++;
    estado.emitir = onFrame;
    return { stop: async () => { estado.micsFechados++; } };
  };
  const startPlayback = async () => {
    estado.playbacksAbertos++;
    return {
      push() {}, flush() { estado.flushes++; }, stats() {},
      resume: async () => {}, state: 'running',
      stop: async () => { estado.playbacksFechados++; },
    };
  };
  return { estado, startCapture, startPlayback };
}

function montar() {
  const credentials = createCredentialStore();
  credentials.set(CHAVE);
  credentials.setConsent(true);
  const live = fakeLive();
  const audio = fakeAudio();
  const vistas = [];
  const session = createAssistantSession({
    credentials,
    onUpdate: (v) => vistas.push(v),
    deps: { createSession: live.factory, startCapture: audio.startCapture, startPlayback: audio.startPlayback },
  });
  return { session, credentials, live, audio, vistas };
}

console.log('\n▶ fail closed');

await (async () => {
  test('sem chave nao conecta, e diz por que', async () => {
    const credentials = createCredentialStore();
    const live = fakeLive();
    const s = createAssistantSession({ credentials, deps: { createSession: live.factory } });
    assert.equal(await s.connect('texto'), false);
    assert.equal(live.criadas.length, 0, 'nenhum socket pode ser aberto');
    assert.match(s.messages.at(-1).text, /chave/i);
  });

  test('com chave mas SEM consentimento tambem nao conecta', async () => {
    const credentials = createCredentialStore();
    credentials.set(CHAVE);
    const live = fakeLive();
    const s = createAssistantSession({ credentials, deps: { createSession: live.factory } });
    assert.equal(await s.connect('texto'), false);
    assert.equal(live.criadas.length, 0);
    assert.match(s.messages.at(-1).text, /aviso/i);
    forgetSecrets();
  });

  test('perguntar sem sessao nao envia nada', () => {
    const { session, live } = montar();
    assert.equal(session.ask('oi'), false);
    assert.equal(live.criadas.length, 0);
    forgetSecrets();
  });

  test('chave recusada pelo servidor marca a credencial', async () => {
    const { session, credentials, live } = montar();
    await session.connect('texto');
    live.ultima.falha('bad-key');
    assert.equal(credentials.lastRejection, 'bad-key');
    assert.equal(session.state, 'error');
    forgetSecrets();
  });

  test('chave recusada DIZ ao aluno o que fazer, nao so o codigo', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.falha('bad-key');
    const textos = session.messages.map((m) => m.text).join(' ');
    assert.match(textos, /aistudio\.google\.com/, 'o conserto e do aluno: dizer onde');
    forgetSecrets();
  });

  test('a chave NAO e apagada quando o servidor recusa (daria para redigitar tudo)', async () => {
    const { session, credentials, live } = montar();
    await session.connect('texto');
    live.ultima.falha('bad-key');
    assert.equal(credentials.hasKey, true);
    forgetSecrets();
  });

  console.log('\n▶ contratos por modo');

  test('modo texto declara a funcao de entrega', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    assert.equal(live.ultima.opts.setupOptions.withDeliveryTool, true);
    forgetSecrets();
  });

  test('modo voz NAO declara a funcao (senao o modelo fica mudo)', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    assert.equal(live.ultima.opts.setupOptions.withDeliveryTool, false);
    forgetSecrets();
  });

  test('trocar de modo abre OUTRA sessao e fecha a anterior', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    const primeira = live.ultima;
    live.ultima.pronta();
    await session.switchMode('voz');
    assert.equal(live.criadas.length, 2);
    assert.equal(primeira.fechada, true);
    assert.equal(live.ultima.opts.setupOptions.withDeliveryTool, false);
    forgetSecrets();
  });

  test('trocar de modo AVISA que o modelo perde o contexto', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    await session.switchMode('voz');
    const aviso = session.messages.find((m) => m.kind === 'context-reset');
    assert.ok(aviso, 'afirmar continuidade sem reconstruir contexto seria mentira');
    assert.match(aviso.text, /recome[cç]a/i);
    forgetSecrets();
  });

  test('o historico VISUAL sobrevive a troca de modo', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('primeira');
    await session.switchMode('voz');
    assert.ok(session.messages.some((m) => m.role === 'user' && m.text === 'primeira'));
    forgetSecrets();
  });

  console.log('\n▶ turnos e historico');

  test('pergunta digitada vira bolha e vai para a sessao', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(session.ask('o que e um gateway?'), true);
    assert.deepEqual(live.ultima.enviados, [{ tipo: 'texto', t: 'o que e um gateway?' }]);
    assert.equal(session.messages.at(-1).role, 'user');
    forgetSecrets();
  });

  test('pergunta vazia nao conta turno nem envia', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(session.ask('   '), false);
    assert.equal(live.ultima.enviados.length, 0);
    forgetSecrets();
  });

  test('a legenda da voz CRESCE uma bolha so, nao uma por pedaco', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    session.ask('explique');
    live.ultima.legenda('Uma raia ');
    live.ultima.legenda('serve para ');
    live.ultima.legenda('organizar.');
    const doAssistente = session.messages.filter((m) => m.role === 'assistant');
    assert.equal(doAssistente.length, 1, 'uma bolha por turno');
    assert.equal(doAssistente[0].text, 'Uma raia serve para organizar.');
    forgetSecrets();
  });

  test('a fala do aluno entra como mensagem marcada "voz"', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    live.ultima.legenda('o que e uma pool', 'input');
    const m = session.messages.at(-1);
    assert.equal(m.role, 'user');
    assert.equal(m.via, 'voz');
    forgetSecrets();
  });

  test('historico so em memoria: um gerente novo nasce vazio', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('alguma coisa');
    assert.ok(session.messages.length > 0);
    const outro = montar();
    assert.deepEqual(outro.session.messages, []);
    forgetSecrets();
  });

  console.log('\n▶ microfone');

  test('microfone so no modo voz', async () => {
    const { session, live, audio } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(await session.startMic(), false);
    assert.equal(audio.estado.micsAbertos, 0);
    forgetSecrets();
  });

  test('abrir o microfone liga captura e reproducao', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    assert.equal(await session.startMic(), true);
    assert.equal(audio.estado.micsAbertos, 1);
    assert.equal(audio.estado.playbacksAbertos, 1, 'o mesmo gesto libera o alto-falante');
    assert.equal(session.micOn, true);
    forgetSecrets();
  });

  test('abrir duas vezes nao abre dois microfones', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await session.startMic();
    assert.equal(audio.estado.micsAbertos, 1);
    forgetSecrets();
  });

  test('fechar o microfone manda audioStreamEnd (sem ele nao ha transcricao)', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    assert.equal(await session.stopMic(), true);
    assert.equal(audio.estado.micsFechados, 1);
    assert.equal(live.ultima.audioEncerrado, true);
    assert.equal(session.micOn, false);
    forgetSecrets();
  });

  test('fechar o microfone duas vezes e inofensivo', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await session.stopMic();
    assert.equal(await session.stopMic(), false);
    assert.equal(audio.estado.micsFechados, 1);
    forgetSecrets();
  });

  test('microfone negado vira estado nomeado, sem derrubar a sessao', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    audio.estado.negarMic = 'mic-denied';
    assert.equal(await session.startMic(), false);
    assert.equal(session.reason, 'mic-denied');
    assert.equal(session.micOn, false);
    assert.match(session.messages.at(-1).text, /microfone/i);
    forgetSecrets();
  });

  test('quadros do microfone chegam a sessao', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    audio.estado.emitir('QUJD');
    assert.deepEqual(live.ultima.enviados.at(-1), { tipo: 'audio', b: 'QUJD' });
    forgetSecrets();
  });

  console.log('\n▶ encerramento');

  test('stop fecha microfone, reproducao e socket', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await session.stop();
    assert.equal(audio.estado.micsFechados, 1);
    assert.equal(audio.estado.playbacksFechados, 1);
    assert.equal(live.ultima.fechada, true);
    assert.equal(session.state, 'idle');
    forgetSecrets();
  });

  test('stop e IDEMPOTENTE: tres vezes nao fecha tres vezes', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await Promise.all([session.stop(), session.stop(), session.stop()]);
    assert.equal(audio.estado.micsFechados, 1);
    assert.equal(audio.estado.playbacksFechados, 1);
    forgetSecrets();
  });

  test('conectar de novo nao deixa a sessao anterior viva', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    const primeira = live.ultima;
    await session.connect('texto');
    assert.equal(primeira.fechada, true);
    assert.equal(live.criadas.length, 2);
    forgetSecrets();
  });

  test('forgetKey encerra a sessao E limpa a credencial', async () => {
    const { session, credentials, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    await session.forgetKey();
    assert.equal(credentials.hasKey, false);
    assert.equal(live.ultima.fechada, true);
    assert.equal(session.state, 'idle');
  });

  test('interrupcao descarta o audio pendente (barge-in)', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    live.ultima.interrompe();
    assert.equal(audio.estado.flushes, 1);
    forgetSecrets();
  });

  console.log('\n▶ mensagens ao aluno');

  test('erro vira frase em portugues, nao codigo cru', () => {
    assert.equal(describeError('mic-denied'), 'o microfone foi negado');
    assert.equal(describeError('ws-closed:1007'), 'o servidor recusou a configuração da sessão');
    assert.match(describeError('ws-closed:1006'), /conex[aã]o caiu/);
    assert.equal(describeError(null), null);
  });

  test('nota do sistema passa pelo redator', async () => {
    const { session, live, credentials } = montar();
    await session.connect('texto');
    live.ultima.falha(`ws-closed:1006 em wss://x?key=${CHAVE}`);
    const texto = session.messages.map((m) => m.text).join(' ');
    assert.ok(!texto.includes(CHAVE), `chave vazou na conversa: ${texto}`);
    assert.equal(credentials.hasKey, true);
    forgetSecrets();
  });

  report('session-manager');
})();
