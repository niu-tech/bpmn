// Página do spike: junta as três provas numa tela com estado visível. Nada daqui vai para o
// produto; o que sobreviver às provas migra para `src/assistant/**` na P2 (openspec tasks 2.2).
//
// ponytail: DOM na mão, zero framework. São quatro botões e dois <pre>.

import { createSession } from '../src/assistant/live/session.js';
import { startCapture, startPlayback } from '../src/assistant/live/audio.js';
import { probeEphemeralToken } from '../src/assistant/live/token-probe.js';
import { forgetSecrets, looksLikeSecret, redact, rememberSecret } from '../src/assistant/live/redact.js';

const $ = (id) => document.getElementById(id);
const els = {
  key: $('key'), connectText: $('connect-text'), connectVoice: $('connect-voice'),
  disconnect: $('disconnect'), state: $('state'),
  ask: $('ask'), send: $('send'), mic: $('mic'), mute: $('mute'), resume: $('resume'),
  frames: $('frames'), chunks: $('chunks'), buffered: $('buffered'), under: $('under'),
  probeText: $('probe-text'), probeToken: $('probe-token'), out: $('out'), log: $('log'),
};

// A chave vive AQUI: variável de módulo, memória da aba. Nenhum storage, por desenho (design D5).
let apiKey = null;
let session = null;
let capture = null;
let playback = null;
let frames = 0;
let chunks = 0;
let modo = null;   // 'texto' (entrega estruturada, mudo) | 'voz' (fala + legenda)

const lines = [];
function log(...parts) {
  const text = redact(parts.join(' '));
  // Cinto e suspensório: se ainda parece credencial depois do redact, não publica o texto.
  const safe = looksLikeSecret(text) ? '[linha suprimida: possível credencial]' : text;
  lines.push(`${new Date().toLocaleTimeString()}  ${safe}`);
  els.log.textContent = lines.slice(-200).join('\n');
  els.log.scrollTop = els.log.scrollHeight;
}

const out = [];
function say(prefix, text) {
  out.push(`${prefix} ${text}`);
  els.out.textContent = out.slice(-100).join('\n');
  els.out.scrollTop = els.out.scrollHeight;
}

function paint({ state, reason }) {
  els.state.textContent = reason ? `${state}(${reason})` : state;
  const live = state === 'ready' || state === 'listening' || state === 'speaking';
  els.send.disabled = !live;
  els.mic.disabled = !live || Boolean(capture);
  els.mute.disabled = !capture;
  els.disconnect.disabled = state === 'idle' || state === 'error';
  const ocupado = live || state === 'connecting';
  els.connectText.disabled = ocupado;
  els.connectVoice.disabled = ocupado;
  // Digitar vale nos DOIS modos: no texto a resposta volta estruturada, na voz volta falada com
  // legenda. Desabilitar no modo voz era um erro meu — o modelo responde pergunta digitada
  // normalmente (medido). O microfone, esse sim, so faz sentido no modo voz.
  els.send.disabled = !live;
  els.mic.disabled = !live || modo !== 'voz' || Boolean(capture);
  els.probeText.disabled = !apiKey;
}

async function ensurePlayback() {
  if (playback) return playback;
  playback = await startPlayback({
    onAudible: (id) => log('primeira amostra audível do trecho', String(id)),
    onStats: (s) => {
      els.buffered.textContent = `${s.bufferedMs} ms`;
      els.under.textContent = String(s.underflows);
    },
  });
  setInterval(() => playback?.stats(), 1000);
  log('reprodução pronta, contexto', playback.state);
  return playback;
}

function connect(setupOptions = {}) {
  session = createSession({
    apiKey,
    setupOptions,
    onState: paint,
    onLog: (m) => log('[sessão]', m),
    onText: ({ text, fallback, complete }) => {
      if (!complete) say(fallback ? 'A(fala)>' : 'A>', text);
      else if (fallback) log('turno fechou SEM entrega estruturada: texto veio da transcrição');
    },
    onTranscript: ({ side, text }) => say(side === 'input' ? 'você(voz)>' : '·', text),
    onAudio: async (b64) => {
      chunks++;
      els.chunks.textContent = String(chunks);
      (await ensurePlayback()).push(b64, chunks);
    },
    onInterrupted: () => { playback?.flush(); log('modelo interrompido: buffer descartado'); },
  });
  session.start();
}

function conectarComo(novoModo) {
  const digitada = els.key.value.trim();
  if (digitada) {
    apiKey = digitada;
    rememberSecret(apiKey);
    els.key.value = '';                     // o campo não guarda o valor depois de usado
    els.key.placeholder = 'chave em memória (F5 apaga)';
  }
  if (!apiKey) { log('informe a chave'); return; }
  modo = novoModo;
  session?.close();
  log(`conectando no modo ${novoModo}`,
    novoModo === 'texto' ? '(função declarada: o modelo não fala)' : '(sem função: o modelo fala e legenda)');
  connect({ withDeliveryTool: novoModo === 'texto' });
}

els.connectText.onclick = () => conectarComo('texto');
els.connectVoice.onclick = () => conectarComo('voz');

els.disconnect.onclick = async () => {
  await capture?.stop(); capture = null;
  await playback?.stop(); playback = null;
  session?.close(); session = null;
  apiKey = null; modo = null; forgetSecrets();
  frames = chunks = 0;
  els.frames.textContent = els.chunks.textContent = '0';
  log('encerrado: microfone, reprodução e socket liberados');
  paint({ state: 'idle', reason: null });
};

els.send.onclick = () => {
  const q = els.ask.value.trim();
  if (!q || !session) return;
  say('você>', q);
  session.ask(q);
};
els.ask.onkeydown = (e) => { if (e.key === 'Enter') els.send.click(); };

els.mic.onclick = async () => {
  try {
    await ensurePlayback();                 // o mesmo gesto libera o áudio de saída
    await playback.resume();
    capture = await startCapture({
      onFrame: (b64, n) => {
        frames = n;
        els.frames.textContent = String(n);
        session?.pushAudio(b64);
      },
      onError: (err) => log('erro na captura:', err?.message ?? String(err)),
    });
    log('microfone aberto, contexto a', capture.sampleRate, 'Hz, enviando 16 kHz');
    paint({ state: session?.state ?? 'ready', reason: session?.reason ?? null });
  } catch (err) {
    log('captura recusada:', err?.reason ?? err?.name ?? 'erro', '—', err?.message ?? '');
  }
};

els.mute.onclick = async () => {
  await capture?.stop();
  capture = null;
  // Sem avisar o fim da fala o servidor nao transcreve nada (medido em 2026-11-10).
  session?.endAudio();
  log('microfone fechado, audioStreamEnd enviado');
  paint({ state: session?.state ?? 'idle', reason: session?.reason ?? null });
};

els.resume.onclick = async () => {
  await (await ensurePlayback()).resume();
  log('contexto de áudio:', playback.state);
};

// Diagnóstico 1: pedir TEXT de propósito. O esperado, pela medição do outro projeto, é o servidor
// fechar com 1007. Medir aqui transforma nota de terceiro em evidência própria.
els.probeText.onclick = () => {
  if (!apiKey) { log('informe a chave primeiro'); return; }
  // O setup é ACEITO mesmo pedindo TEXT; a recusa (1007) só vem quando se pede conteúdo.
  log('abrindo sessão de diagnóstico pedindo responseModalities=TEXT…');
  session?.close();
  modo = 'diagnostico';
  connect({ modalities: ['TEXT'], withDeliveryTool: false });
  setTimeout(() => session?.ask('O que e um gateway paralelo?'), 1500);
};

// Diagnóstico 2: CORS do endpoint de token efêmero (E12).
els.probeToken.onclick = async () => {
  const key = apiKey || els.key.value.trim();
  if (!key) { log('informe a chave primeiro'); return; }
  log('sondando authTokens.create a partir do navegador…');
  const r = await probeEphemeralToken(key);
  log(`veredito do token efêmero: ${r.verdict} (status ${r.status}) — ${r.detail}`);
};

// Nunca deixar microfone nem socket vivos quando a aba sai.
window.addEventListener('beforeunload', () => {
  capture?.stop();
  session?.close();
});

paint({ state: 'idle', reason: null });
log('spike carregado. contexto seguro:', String(window.isSecureContext));
