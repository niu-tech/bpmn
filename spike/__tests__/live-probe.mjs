/**
 * PROVA VIVA contra o Gemini Live de verdade. Usa os MESMOS modulos do spike
 * (`protocol.js`, `session.js`, os dois worklets) — nao uma reimplementacao.
 *
 * Gated por ambiente, como o `MAIA_E2E_LIVE` do CopilotSpeaker: sem `GEMINI_API_KEY` o script
 * SAI COM 0 dizendo que pulou. Assim ele pode ficar no `npm test` sem exigir credencial de
 * ninguem, e o CI nao quebra.
 *
 *   node spike/__tests__/live-probe.mjs        # pula
 *   GEMINI_API_KEY=... node spike/...          # mede
 *
 * A chave NUNCA e impressa: entra por ambiente, e registrada em `rememberSecret` antes da
 * primeira conexao, e toda saida passa por `redact`.
 *
 * O que mede (os itens do bloqueio B2 de validation.md):
 *   1. o servidor ACEITA o nosso setup                              -> setupComplete
 *   2. PROVA C: pergunta digitada -> entregar_resposta -> texto
 *   3. multiplos turnos na MESMA sessao, em ordem
 *   4. PROVA B: audio real do modelo atravessa o worklet de playback e sai audivel
 *   5. PROVA A: o audio do modelo, reamostrado pelo worklet de CAPTURA para 16 kHz, volta como
 *      entrada e o servidor o TRANSCREVE — prova que o nosso formato de captura e entendido
 *   6. responseModalities TEXT -> o servidor fecha com 1007 (medicao PROPRIA, nao citacao)
 *   7. authTokens.create aceita chamada com Origin de navegador? (CORS, item E12)
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSession } from '../live/session.js';
import { DELIVERY_TOOL, MODEL, buildSetup, buildTextTurn, socketUrl } from '../live/protocol.js';
import { base64ToPcm16, pcm16ToBase64 } from '../live/pcm.js';
import { redact, rememberSecret } from '../live/redact.js';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.log('PULADO: defina GEMINI_API_KEY para medir contra o servidor real.');
  console.log('        (sem a variavel este script nao faz rede nenhuma)');
  process.exit(0);
}
rememberSecret(KEY);

const liveDir = resolve(dirname(fileURLToPath(import.meta.url)), '../live');
const results = [];
const say = (...a) => console.log(redact(a.join(' ')));

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  say(`  ${ok ? '✔' : '✖'} ${id} — ${detail}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Carrega um worklet do disco com os globais do AudioWorkletGlobalScope esbulhados. */
function loadWorklet(file, sampleRate) {
  const source = readFileSync(join(liveDir, file), 'utf8');
  const registered = {};
  class AudioWorkletProcessor {
    constructor() {
      const self = this;
      this.port = {
        posted: [],
        onmessage: null,
        postMessage(data) { self.port.posted.push(data); },
        close() {},
      };
    }
  }
  // eslint-disable-next-line no-new-func
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', source)(
    AudioWorkletProcessor, (n, c) => { registered[n] = c; }, sampleRate,
  );
  return registered[Object.keys(registered)[0]];
}

/** Abre a sessao e espera `ready`. Rejeita com a razao nomeada. */
function connect(setupOptions = {}, opts = {}) {
  return new Promise((resolve, reject) => {
    const audio = [];
    const transcripts = [];
    const texts = [];
    const session = createSession({
      apiKey: KEY,
      setupOptions,
      connectTimeoutMs: 25000,
      idleTurnTimeoutMs: 40000,
      maxReconnects: 0,
      onAudio: (b64) => audio.push(b64),
      onTranscript: (t) => transcripts.push(t),
      onText: (t) => texts.push(t),
      onLog: (m) => opts.verbose && say('    [sessao]', m),
      onState: ({ state, reason }) => {
        if (state === 'ready' && !session.__settled) {
          session.__settled = true;
          resolve({ session, audio, transcripts, texts });
        }
        if (state === 'error' && !session.__settled) {
          session.__settled = true;
          reject(Object.assign(new Error(`estado error(${reason})`), { reason }));
        }
      },
    });
    session.start();
  });
}

/** Espera o turno fechar (ou estourar o prazo). */
async function waitTurn(session, before, ms = 40000) {
  const limit = Date.now() + ms;
  while (Date.now() < limit) {
    if (session.turns.length > before) return session.turns.at(-1);
    if (session.state === 'error') throw new Error(`error(${session.reason}) durante o turno`);
    await sleep(120);
  }
  throw new Error('turno nao fechou no prazo');
}

say(`\n=== PROVA VIVA — ${MODEL} — ${new Date().toISOString()} ===`);
say(`url: ${redact(socketUrl(KEY))}`);

let ctx;
try {
  // ---------------------------------------------------------------- 1. setup aceito
  say('\n▶ 1. o servidor aceita o nosso setup');
  const t0 = Date.now();
  ctx = await connect({}, { verbose: false });
  record('setup-aceito', true, `setupComplete em ${Date.now() - t0} ms, estado=${ctx.session.state}`);

  // ---------------------------------------------------------------- 2. PROVA C
  say('\n▶ 2. PROVA C — pergunta digitada -> entregar_resposta');
  const before = ctx.session.turns.length;
  ctx.session.ask('Em uma frase: qual a diferenca entre um gateway exclusivo e um paralelo em BPMN?');
  const turn = await waitTurn(ctx.session, before);
  record('prova-c', Boolean(turn.text) && turn.delivered === true,
    turn.delivered
      ? `texto veio dos ARGUMENTOS de ${DELIVERY_TOOL} (${turn.text.length} chars): "${turn.text.slice(0, 110)}…"`
      : `SEM entrega estruturada; fallback=${Boolean(turn.fallback)} texto="${String(turn.text).slice(0, 80)}"`);
  // Com a funcao declarada o modelo NAO fala: 0 quadros e o comportamento CORRETO do modo texto
  // (e mais barato, porque nao gera token de audio). Medido, nao suposto.
  record('modo-texto-nao-fala', turn.audioFrames === 0,
    `${turn.audioFrames} quadros de audio no modo texto (esperado 0: a funcao declarada substitui a fala)`);

  // ---------------------------------------------------------------- 3. multiplos turnos
  say('\n▶ 3. multiplos turnos na MESMA sessao');
  const perguntas = ['O que e uma raia (lane) em BPMN?', 'Para que serve um evento de borda?'];
  const respostas = [];
  for (const q of perguntas) {
    const n = ctx.session.turns.length;
    ctx.session.ask(q);
    respostas.push(await waitTurn(ctx.session, n));
  }
  record('multiplos-turnos', respostas.every((t) => t.complete && t.text),
    `${ctx.session.turns.length} turnos fechados, na ordem: ${ctx.session.turns.map((t) => (t.prompt || '').slice(0, 22) + '…').join(' | ')}`);

  // ---------------------------------------------------------------- 4. PROVA B (audio real)
  // MODO VOZ: SEM a funcao declarada. Com ela o modelo nao fala — medido em 2026-11-10, e foi
  // a primeira rodada desta prova que revelou o defeito.
  say('\n▶ 4. PROVA B — audio REAL do modelo atravessa o worklet de playback (modo voz)');
  ctx.session.close();
  const voz = await connect({ withDeliveryTool: false }, {});
  const antesVoz = voz.session.turns.length;
  voz.session.ask('Explique em duas frases para que serve uma raia em BPMN.');
  await waitTurn(voz.session, antesVoz, 60000);
  record('voz-fala', voz.audio.length > 0,
    `${voz.audio.length} frames de audio no modo voz; legenda: "${String(voz.session.turns.at(-1).spoken).slice(0, 90)}…"`);
  const pcmFrames = voz.audio.map(base64ToPcm16);
  const amostras = pcmFrames.reduce((n, f) => n + f.length, 0);
  if (!amostras) {
    record('prova-b', false, 'o modelo nao devolveu audio nem no modo voz');
  } else {
    const Playback = loadWorklet('playback-worklet.js', 48000);
    const node = new Playback({ processorOptions: { sourceRate: 24000, primeMs: 120 } });
    for (const f of pcmFrames) node.port.onmessage({ data: { type: 'pcm', pcm: f.buffer } });
    const out = new Float32Array(128);
    let blocosAudiveis = 0;
    let pico = 0;
    for (let i = 0; i < 400; i++) {
      out.fill(0);
      node.process([], [[out]]);
      let max = 0;
      for (const v of out) max = Math.max(max, Math.abs(v));
      if (max > 0.01) blocosAudiveis++;
      pico = Math.max(pico, max);
    }
    node.port.onmessage({ data: { type: 'stats' } });
    const stats = node.port.posted.find((m) => m.type === 'stats');
    record('prova-b', blocosAudiveis > 50 && pico > 0.05,
      `${amostras} amostras a 24 kHz (${(amostras / 24000).toFixed(1)} s) -> ${blocosAudiveis} blocos audiveis a 48 kHz, pico ${pico.toFixed(3)}, underflow ${stats.underflows}, descartado ${stats.overflowDropped}`);
  }

  // ---------------------------------------------------------------- 5. PROVA A (captura real)
  say('\n▶ 5. PROVA A — a fala do modelo, reamostrada pelo worklet de CAPTURA, volta e e transcrita');
  if (!amostras) {
    record('prova-a', false, 'sem audio do modelo para reinjetar');
  } else {
    // O worklet de captura roda com sampleRate=24000 (a taxa da fala que o modelo produziu) e
    // decima para 16 kHz — exatamente o que ele fara no navegador saindo de 48 kHz.
    const Capture = loadWorklet('capture-worklet.js', 24000);
    const cap = new Capture({ processorOptions: { rate: 16000, frameMs: 40 } });
    for (const f of pcmFrames) {
      const float = new Float32Array(f.length);
      for (let i = 0; i < f.length; i++) float[i] = f[i] / 32768;
      for (let i = 0; i < float.length; i += 128) cap.process([[float.subarray(i, i + 128)]]);
    }
    const quadros = cap.port.posted.filter((m) => m.type === 'pcm').map((m) => new Int16Array(m.pcm));
    say(`    worklet de captura produziu ${quadros.length} quadros de 40 ms a 16 kHz`);

    const eco = await connect({}, {});
    const antes = eco.transcripts.length;
    // ⚠ Ritmo REAL (40 ms por quadro) e `audioStreamEnd` no fim. Medido: em rajada, ou sem o
    // aviso de fim, o servidor aceita tudo sem erro e NAO transcreve nada.
    for (const q of quadros) {
      eco.session.pushAudio(pcm16ToBase64(q));
      await sleep(40);
    }
    eco.session.endAudio();
    // Espera a transcricao de ENTRADA aparecer.
    const limite = Date.now() + 30000;
    while (Date.now() < limite && !eco.transcripts.slice(antes).some((t) => t.side === 'input')) {
      if (eco.session.state === 'error') break;
      await sleep(200);
    }
    const ouvido = eco.transcripts.filter((t) => t.side === 'input').map((t) => t.text).join('');
    record('prova-a', ouvido.trim().length > 0,
      ouvido.trim().length
        ? `${quadros.length} quadros enviados; o servidor TRANSCREVEU: "${ouvido.trim().slice(0, 120)}…"`
        : `${quadros.length} quadros aceitos sem erro, mas nenhuma transcricao de entrada chegou (estado=${eco.session.state})`);
    eco.session.close();
  }

  voz.session.close();
  ctx = null;

  // ---------------------------------------------------------------- 6. TEXT -> 1007
  say('\n▶ 6. responseModalities TEXT (medicao PROPRIA do 1007)');
  // ⚠ O `setupComplete` CHEGA mesmo pedindo TEXT: a recusa so vem quando se PEDE conteudo. A
  // primeira versao desta medicao parava no `ready` e concluiu, errado, que o servidor aceitava.
  await new Promise((resolve) => {
    const ws = new WebSocket(socketUrl(KEY));
    let aceitouSetup = false;
    const fim = setTimeout(() => {
      try { ws.close(); } catch { /* ja fechada */ }
      record('text-recusado', false, 'nem aceitou nem recusou em 30 s');
      resolve();
    }, 30000);
    ws.onopen = () => ws.send(JSON.stringify(buildSetup({ modalities: ['TEXT'], withDeliveryTool: false })));
    ws.onmessage = async (ev) => {
      const raw = typeof ev.data === 'string' ? ev.data : await ev.data.text();
      if (JSON.parse(raw).setupComplete) {
        aceitouSetup = true;
        ws.send(JSON.stringify(buildTextTurn('O que e um gateway paralelo?')));
      }
    };
    ws.onclose = (e) => {
      clearTimeout(fim);
      record('text-recusado', e.code === 1007,
        `setupComplete=${aceitouSetup}, depois fechou com ${e.code}: "${String(e.reason).slice(0, 160)}"`);
      resolve();
    };
    ws.onerror = () => { /* o close traz o codigo */ };
  });
} catch (err) {
  record('fatal', false, redact(err?.message ?? String(err)));
  try { ctx?.session.close(); } catch { /* ja fechada */ }
}

// ------------------------------------------------------------------ 7. token efemero (E12)
say('\n▶ 7. token efemero: da para emitir do NAVEGADOR com a chave do aluno? (E12)');
const TOKENS = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';
const ORIGEM = 'https://bpmn.example.com';
let tokenName = null;
try {
  const pre = await fetch(TOKENS, { method: 'OPTIONS', headers: {
    origin: ORIGEM, 'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type,x-goog-api-key' } });
  const allow = pre.headers.get('access-control-allow-origin');
  record('token-preflight-cors', Boolean(allow),
    `HTTP ${pre.status}; allow-origin=${allow ?? '(ausente)'}; allow-headers=${pre.headers.get('access-control-allow-headers') ?? '(ausente)'}`);
} catch (err) { record('token-preflight-cors', false, redact(err?.message ?? String(err))); }

try {
  const r = await fetch(TOKENS, { method: 'POST', headers: {
      origin: ORIGEM, 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 120 * 1000).toISOString() }) });
  const j = await r.json().catch(() => ({}));
  tokenName = typeof j?.name === 'string' ? j.name : null;
  record('token-emitido-do-navegador', Boolean(tokenName),
    `HTTP ${r.status}; allow-origin=${r.headers.get('access-control-allow-origin') ?? '(ausente)'}; campos=${Object.keys(j).join(',')}`);
} catch (err) { record('token-emitido-do-navegador', false, redact(err?.message ?? String(err))); }

// Emitir nao basta: o token precisa ABRIR a sessao no lugar da chave.
if (tokenName) {
  const base = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage';
  const id = tokenName.split('/').pop();
  const formas = [
    ['v1beta access_token=<name>', `${base}.v1beta.GenerativeService.BidiGenerateContent?access_token=${encodeURIComponent(tokenName)}`],
    ['v1beta chave=<name>', `${base}.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(tokenName)}`],
    ['v1alpha chave=<name>', `${base}.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(tokenName)}`],
    ['v1alpha chave=<id>', `${base}.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(id)}`],
  ];
  const falhas = [];
  for (const [rotulo, url] of formas) {
    const fim = await new Promise((resolve) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { try { ws.close(); } catch { /* ja fechada */ } resolve('sem resposta'); }, 20000);
      ws.onopen = () => ws.send(JSON.stringify(buildSetup({ withDeliveryTool: false })));
      ws.onmessage = async (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : await ev.data.text();
        if (JSON.parse(raw).setupComplete) { clearTimeout(t); try { ws.close(1000); } catch { /* ja fechada */ } resolve('OK'); }
      };
      ws.onclose = (e) => { clearTimeout(t); resolve(e.code === 1000 ? 'OK' : `${e.code}`); };
      ws.onerror = () => { /* o close traz o codigo */ };
    });
    if (fim !== 'OK') falhas.push(`${rotulo}=${fim}`);
  }
  record('token-abre-a-sessao', falhas.length === 0,
    falhas.length ? `nenhuma forma funcionou: ${falhas.join(', ')}` : 'o token abre a sessao no lugar da chave');
}

// ------------------------------------------------------------------ veredito
const ok = results.filter((r) => r.ok).length;
say('\n' + '='.repeat(60));
say(`PROVA VIVA: ${ok} de ${results.length} medicoes positivas`);
for (const r of results) say(`  ${r.ok ? 'OK  ' : 'NAO '} ${r.id}`);
say('='.repeat(60));
process.exit(0);   // isto MEDE; quem decide o que e falha e quem le o relatorio
