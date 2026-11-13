/**
 * A conversa por VOZ e o diário da sessão.
 *
 * Por que este arquivo existe (dono, 2026-11-11, depois do primeiro uso real na URL pública):
 * apertar "Falar" e falar produzia só "o modelo foi interrompido", sem resposta nenhuma. A causa
 * é meia-duplex ausente — microfone aberto durante a resposta faz o VAD do servidor cortar o
 * próprio modelo. Aqui ficam as provas de que isso não volta, e as do diário que permite
 * diagnosticar a próxima sem adivinhar.
 *
 * Run: node src/assistant/__tests__/conversa.mjs
 */
import assert from 'node:assert/strict';

import { createCredentialStore } from '../credential.js';
import { createAssistantSession } from '../session-manager.js';
import { createDiagnostics } from '../diagnostics.js';
import { nivelDoQuadro } from '../live/audio.js';
import { forgetSecrets, rememberSecret } from '../live/redact.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

const CHAVE = 'AQ.CHAVE-SINTETICA-DE-TESTE-NAO-E-DE-NINGUEM-0123456';

/** Dublê da sessão Live, com controle explícito de ESTADO (é o que o meia-duplex observa). */
function fakeLive() {
  const criadas = [];
  const factory = (opts) => {
    const s = {
      opts,
      enviados: [],
      audioEncerrado: false,
      fechada: false,
      get state() { return 'ready'; },
      get lastUsage() { return null; },
      start() { opts.onState?.({ state: 'connecting', reason: null }); },
      ask(t) { s.enviados.push({ tipo: 'texto', t }); },
      pushAudio(b) { s.enviados.push({ tipo: 'audio', b }); },
      endAudio() { s.audioEncerrado = true; },
      close() { s.fechada = true; },
      pronta() { opts.onState?.({ state: 'ready', reason: null }); },
      estado(e) { opts.onState?.({ state: e, reason: null }); },
      audio(b) { opts.onAudio?.(b); },
    };
    criadas.push(s);
    return s;
  };
  return { factory, criadas, get ultima() { return criadas.at(-1); } };
}

function fakeAudio() {
  const estado = { micsAbertos: 0, micsFechados: 0, playbacksAbertos: 0, emitir: null, nivel: null };
  const startCapture = async ({ onFrame, onLevel }) => {
    estado.micsAbertos++;
    estado.emitir = onFrame;
    estado.nivel = onLevel;
    return { stop: async () => { estado.micsFechados++; } };
  };
  const startPlayback = async () => {
    estado.playbacksAbertos++;
    return {
      push() {}, flush() {}, stats() {}, resume: async () => {}, state: 'running',
      stop: async () => {},
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

console.log('\n▶ meia-duplex (o defeito de 2026-11-11)');

await (async () => {
  await testAsync('entrar no modo voz abre o microfone sozinho', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));   // a abertura é assíncrona
    assert.equal(audio.estado.micsAbertos, 1, 'escolher voz É começar a falar');
    assert.equal(session.micOn, true);
    forgetSecrets();
  });

  await testAsync('o microfone NAO reabre sozinho a cada turno', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));
    await session.stopMic();
    live.ultima.pronta();                          // fim de turno: a sessão volta a `ready`
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(audio.estado.micsAbertos, 1, 'microfone que o aluno fechou fica fechado');
    forgetSecrets();
  });

  await testAsync('ESCUTA CONTINUA: o modelo responder NAO fecha o microfone', async () => {
    // Pedido do dono (2026-11-11): "ele poderia ficar ouvindo e quando a gente falar, poder
    // interromper ela". Fechar o microfone na resposta impedia justamente isso.
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(session.micOn, true);

    live.ultima.estado('speaking');
    live.ultima.audio('AAAA');
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(session.micOn, true, 'microfone fechado = nao da para interromper');
    assert.equal(audio.estado.micsFechados, 0);
    forgetSecrets();
  });

  await testAsync('ESCUTA CONTINUA: o quadro SOBE enquanto o modelo fala (e o que interrompe)', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));

    const antes = live.ultima.enviados.filter((e) => e.tipo === 'audio').length;
    live.ultima.estado('speaking');
    audio.estado.emitir('EU-FALANDO-POR-CIMA');
    const depois = live.ultima.enviados.filter((e) => e.tipo === 'audio').length;

    assert.equal(depois, antes + 1, 'o servidor so interrompe se o audio do aluno chegar');
    forgetSecrets();
  });

  await testAsync('REDE DE SEGURANCA: 3 interrupcoes sem fala nenhuma liga meia-duplex', async () => {
    // Assinatura do laco de eco: o som do proprio ajudante volta pelo microfone, o servidor
    // interrompe, e a conversa morre em silencio. Fala de verdade produz transcricao de
    // entrada; eco nao - e e isso que separa os dois casos.
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));

    live.ultima.opts.onInterrupted();
    live.ultima.opts.onInterrupted();
    assert.equal(session.meiaDuplex, false, 'duas ainda pode ser o aluno mudando de ideia');

    live.ultima.opts.onInterrupted();
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(session.meiaDuplex, true);
    assert.equal(audio.estado.micsFechados, 1, 'e o microfone fecha na hora');
    const aviso = session.messages.find((m) => /microfone/i.test(m.text ?? ''));
    assert.ok(aviso, 'o aluno precisa saber por que o comportamento mudou');
    forgetSecrets();
  });

  await testAsync('falar de verdade ZERA o contador de interrupcoes', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));

    live.ultima.opts.onInterrupted();
    live.ultima.opts.onInterrupted();
    live.ultima.opts.onTranscript({ side: 'input', text: 'espera, me responde curto' });
    live.ultima.opts.onInterrupted();
    live.ultima.opts.onInterrupted();

    assert.equal(session.meiaDuplex, false, 'interromper falando e o recurso, nao o defeito');
    forgetSecrets();
  });

  await testAsync('em meia-duplex o quadro atrasado morre no cliente', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 3; i++) live.ultima.opts.onInterrupted();   // liga a rede de seguranca
    await new Promise((r) => setTimeout(r, 0));
    await session.startMic();                                      // o aluno reabre

    const antes = live.ultima.enviados.filter((e) => e.tipo === 'audio').length;
    live.ultima.estado('speaking');
    audio.estado.emitir('QUADRO-ATRASADO');
    const depois = live.ultima.enviados.filter((e) => e.tipo === 'audio').length;

    assert.equal(depois, antes, 'com a rede ligada, nada sobe durante a resposta');
    assert.equal(session.diagnostics.count('mic.gated'), 1);
    forgetSecrets();
  });

  await testAsync('interrupcao NAO vira recado na conversa', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    live.ultima.opts.onInterrupted?.();
    assert.equal(
      session.messages.filter((m) => /interromp/i.test(m.text ?? '')).length,
      0,
      'interrupcao e evento de protocolo, nao mensagem ao aluno',
    );
    forgetSecrets();
  });
})();

console.log('\n▶ indicador de escuta');

await (async () => {
  await testAsync('o nivel do microfone chega a view', async () => {
    const { session, live, audio, vistas } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));
    audio.estado.nivel(0.42);
    assert.equal(vistas.at(-1).level, 0.42);
    assert.equal(session.level, 0.42);
    forgetSecrets();
  });

  await testAsync('fechar o microfone zera o nivel (barra parada = nao esta ouvindo)', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await new Promise((r) => setTimeout(r, 0));
    audio.estado.nivel(0.9);
    await session.stopMic();
    assert.equal(session.level, 0);
    forgetSecrets();
  });

  test('nivelDoQuadro: silencio em 0, saturacao em 1, voz no meio', () => {
    assert.equal(nivelDoQuadro(new Int16Array(320)), 0);
    assert.equal(nivelDoQuadro(null), 0);
    const cheio = new Int16Array(320).fill(32767);
    assert.ok(nivelDoQuadro(cheio) > 0.99);
    const fala = new Int16Array(320).fill(3000);
    const v = nivelDoQuadro(fala);
    assert.ok(v > 0.2 && v < 0.9, `voz normal tem de se mexer na barra, veio ${v}`);
  });
})();

console.log('\n▶ diario da sessao');

await (async () => {
  test('conta por chave e agrupa repeticao consecutiva', () => {
    const d = createDiagnostics();
    d.ws('audio'); d.ws('audio'); d.ws('audio');
    d.ws('turn-complete');
    assert.equal(d.count('ws.audio'), 3, 'a contagem nao perde nada');
    assert.equal(d.events.length, 2, 'mas a lista nao enche de linha igual');
    assert.equal(d.events[0].n, 3);
  });

  test('detalhe passa pelo redator', () => {
    const d = createDiagnostics();
    rememberSecret(CHAVE);
    d.ws('close', `code=1007 key=${CHAVE} invalid`);
    const texto = d.report();
    assert.ok(!texto.includes(CHAVE), 'a chave NAO pode entrar nem na memoria do diario');
    assert.match(texto, /ws\.close=1/);
    forgetSecrets();
  });

  test('o relatorio tem contagem e linha do tempo', () => {
    const d = createDiagnostics();
    d.out('setup', 'modo=voz');
    d.ws('ready');
    d.mic('open');
    const texto = d.report({ header: { modo: 'voz' } });
    assert.match(texto, /modo: voz/);
    assert.match(texto, /contagem:.*out\.setup=1/);
    assert.match(texto, /mic\.open/);
    assert.match(texto, /duracao:/);
  });

  test('reset recomeca: um relatorio = uma sessao', () => {
    const d = createDiagnostics();
    d.ws('ready');
    d.reset();
    assert.equal(d.events.length, 0);
    assert.equal(d.count('ws.ready'), 0);
  });

  test('o anel nao cresce sem fim', () => {
    const d = createDiagnostics({ max: 10 });
    for (let i = 0; i < 50; i++) d.ws('unknown', `n=${i}`);
    assert.equal(d.events.length, 10);
    assert.equal(d.count('ws.unknown'), 50, 'a contagem continua inteira');
  });

  await testAsync('conectar zera o diario, e o relatorio sai da sessao', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    const texto = session.report();
    assert.match(texto, /diagnostico do ajudante BPMN/);
    assert.match(texto, /modo: voz/);
    forgetSecrets();
  });
})();

report('conversa');
