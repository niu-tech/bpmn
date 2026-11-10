/**
 * PCM (matematica da captura e da reproducao), mascaramento da credencial, contexto seguro,
 * sonda de token efemero e ISOLAMENTO do spike em relacao ao produto.
 *
 * Run: node spike/__tests__/audio-and-safety.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { base64ToPcm16, floatToPcm16, pcm16ToBase64 } from '../live/pcm.js';
import { MASK, forgetSecrets, looksLikeSecret, redact, rememberSecret } from '../live/redact.js';
import { assertSecureContext } from '../live/audio.js';
import { probeEphemeralToken } from '../live/token-probe.js';
import { report, test, testAsync } from './mock-socket.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

console.log('\n▶ PCM — base64 (ida e volta)');

test('Int16 -> base64 -> Int16 preserva as amostras', () => {
  const original = Int16Array.from([0, 1, -1, 32767, -32768, 12345]);
  const back = base64ToPcm16(pcm16ToBase64(original));
  assert.deepEqual([...back], [...original]);
});

test('um quadro de 640 amostras vira 1280 bytes', () => {
  const b64 = pcm16ToBase64(new Int16Array(640));
  assert.equal(Buffer.from(b64, 'base64').length, 1280);
});

console.log('\n▶ credencial — mascaramento');

test('chave na URL do socket e mascarada', () => {
  const url = 'wss://generativelanguage.googleapis.com/ws/x?key=AIzaSyAbCdEf0123456789xyz';
  const out = redact(`WebSocket connection to '${url}' failed`);
  assert.ok(!/AIzaSy/.test(out), out);
  assert.match(out, /key=\*\*\*/);
});

test('chave solta em texto qualquer e mascarada', () => {
  assert.equal(redact('minha chave e AIzaSyAbCdEf0123456789xyz ok'), `minha chave e ${MASK} ok`);
});

test('Error e objeto tambem passam pelo mascaramento', () => {
  assert.ok(!/AIzaSy/.test(redact(new Error('falhou com key=AIzaSyAbCdEf0123456789xyz'))));
  assert.ok(!/AIzaSy/.test(redact({ url: 'wss://x?key=AIzaSyAbCdEf0123456789xyz' })));
});

test('looksLikeSecret acusa antes e absolve depois', () => {
  const dirty = 'wss://x?key=AIzaSyAbCdEf0123456789xyz';
  assert.equal(looksLikeSecret(dirty), true);
  assert.equal(looksLikeSecret(redact(dirty)), false);
});

test('formato AQ. (a chave real de 2026-11-10) tambem e mascarado', () => {
  const k = 'AQ.VALOR-SINTETICO-DE-TESTE-NAO-E-CHAVE-DE-NINGUEM-0123';
  assert.ok(!/AQ\./.test(redact(`falhou com ${k} ok`)), 'o formato AQ. tem de ser mascarado');
  assert.equal(looksLikeSecret(k), true);
});

test('segredo REGISTRADO e mascarado mesmo em formato desconhecido', () => {
  // A regra por formato ja falhou uma vez (so conhecia AIza). O registro exato nao depende dela.
  const exotica = 'zzz-formato-que-ninguem-previu-123456789';
  assert.equal(redact(`vazou ${exotica}`), `vazou ${exotica}`, 'sem registro, nao ha como saber');
  rememberSecret(exotica);
  try {
    assert.equal(redact(`vazou ${exotica}`), `vazou ${MASK}`);
    assert.equal(looksLikeSecret(exotica), true);
  } finally {
    forgetSecrets();
  }
  assert.equal(redact(`vazou ${exotica}`), `vazou ${exotica}`, 'forgetSecrets tem de esquecer');
});

test('texto sem credencial sai intacto', () => {
  assert.equal(redact('turno concluido em 1,2 s'), 'turno concluido em 1,2 s');
});

console.log('\n▶ contexto seguro (getUserMedia)');

const fakeWin = (over) => ({
  isSecureContext: false,
  location: { hostname: 'exemplo.com' },
  navigator: { mediaDevices: { getUserMedia() {} } },
  AudioWorkletNode: class {},
  ...over,
});

test('http: em host remoto -> insecure-context, SEM pedir permissao', () => {
  let asked = false;
  const win = fakeWin({ navigator: { mediaDevices: { getUserMedia() { asked = true; } } } });
  assert.throws(() => assertSecureContext(win), (e) => e.reason === 'insecure-context');
  assert.equal(asked, false, 'nao deveria ter pedido o microfone');
});

test('localhost passa mesmo sem isSecureContext', () => {
  assertSecureContext(fakeWin({ location: { hostname: 'localhost' } }));
  assertSecureContext(fakeWin({ location: { hostname: '127.0.0.1' } }));
});

test('https passa', () => {
  assertSecureContext(fakeWin({ isSecureContext: true }));
});

test('navegador sem AudioWorklet -> unsupported (razao nomeada)', () => {
  const win = fakeWin({ isSecureContext: true, AudioWorkletNode: undefined });
  assert.throws(() => assertSecureContext(win), (e) => e.reason === 'unsupported');
});

console.log('\n▶ sonda do token efemero');

await testAsync('2xx -> minted, e o TOKEN nao entra no resultado', async () => {
  const r = await probeEphemeralToken('AIzaSyFake0123456789', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ name: 'authTokens/segredo-aqui' }) }),
  });
  assert.equal(r.verdict, 'minted');
  assert.ok(!/segredo-aqui/.test(JSON.stringify(r)), 'o token nao pode sair no resultado');
});

await testAsync('fetch sem resposta -> cors-blocked (sem fingir saber se foi CORS ou rede)', async () => {
  const r = await probeEphemeralToken('AIzaSyFake0123456789', {
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  assert.equal(r.verdict, 'cors-blocked');
  assert.match(r.detail, /CORS ou rede/);
});

await testAsync('403 -> rejected, e o corpo e mascarado', async () => {
  const r = await probeEphemeralToken('AIzaSyFake0123456789', {
    fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'API key AIzaSyFake0123456789 invalid' }),
  });
  assert.equal(r.verdict, 'rejected');
  assert.ok(!/AIzaSyFake/.test(r.detail), r.detail);
});

await testAsync('sem chave -> rejected, sem chamar a rede', async () => {
  let called = false;
  const r = await probeEphemeralToken('', { fetchImpl: async () => { called = true; } });
  assert.equal(r.verdict, 'rejected');
  assert.equal(called, false);
});

console.log('\n▶ isolamento spike <-> produto (design D6)');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(js|mjs|html)$/.test(name)) out.push(full);
  }
  return out;
}

test('nenhum arquivo de src/ referencia spike/', () => {
  const guilty = walk(join(root, 'src'))
    .filter((f) => /spike/i.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(guilty, [], `produto nao pode depender do spike: ${guilty.join(', ')}`);
});

test('nenhum arquivo de spike/ importa de src/', () => {
  const guilty = walk(join(root, 'spike'))
    .filter((f) => /from\s+['"][^'"]*(\.\.\/)+src\//.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(guilty, [], `spike nao pode importar do produto: ${guilty.join(', ')}`);
});

test('a entry do spike no webpack e CONDICIONAL a BPMN_SPIKE', () => {
  const cfg = readFileSync(join(root, 'webpack.config.js'), 'utf8');
  assert.match(cfg, /BPMN_SPIKE/, 'a entry do spike precisa estar atras da variavel');
  const line = cfg.split('\n').find((l) => /spike/.test(l) && /entry|:/.test(l)) ?? '';
  assert.ok(/BPMN_SPIKE/.test(cfg.slice(0, cfg.indexOf(line) + line.length)),
    'a mencao ao spike deve vir depois da guarda');
});

test('o Dockerfile NAO copia a pagina do spike para a imagem', () => {
  const docker = readFileSync(join(root, 'Dockerfile'), 'utf8');
  assert.ok(!/spike/i.test(docker), 'a imagem de producao nao pode conter o spike');
  assert.ok(!/BPMN_SPIKE/.test(docker), 'a imagem nao pode ligar a variavel do spike');
});

report('audio-and-safety');
