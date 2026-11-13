/**
 * O WAV-como-microfone chega mesmo ao `getUserMedia`? E QUANDO?
 *
 * Por que existe (dívida M6): a bateria reporta "sem transcrição de entrada" e eu vinha lendo
 * isso como servidor mudo. A medição de 2026-11-13 (`tools/medir-voz.mjs`) provou que o servidor
 * transcreve nos quatro braços do 2×2 — então o áudio que o navegador manda é a próxima suspeita,
 * e o pico de microfone **0,077** (chão de ruído) na corrida solo apontou para cá.
 *
 * A pergunta é de ORDEM, não de volume: `--use-file-for-fake-audio-capture=...%noloop` toca o
 * arquivo UMA vez. Se o relógio dele começa a correr antes de o produto abrir o microfone, a fala
 * acabou antes de alguém ouvir — e o sintoma é idêntico ao de um servidor mudo.
 *
 * Mede SEM chave e SEM sessão: abre o microfone na página, mede o RMS quadro a quadro e diz em
 * que segundo a energia apareceu. `--atraso N` adia o `getUserMedia` em N segundos, que é o que
 * separa as duas explicações:
 *   • pico alto com atraso 0 e nada com atraso 8  ⇒ o arquivo toca a partir do START do navegador
 *     e acaba antes de o produto pedir o microfone. Defeito do HARNESS.
 *   • pico alto nos dois                           ⇒ o áudio está lá quando se pede. Olhar o produto.
 *
 * Uso: node tools/medir-microfone.mjs [--wav artifacts/voz/gateway.wav] [--atraso 0,8] [--ver]
 */
import { existsSync } from 'node:fs';

import { dirigir } from './drive-page.mjs';

function arg(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

/**
 * `--wavs a.wav,b.wav,-` mede varios arquivos na mesma corrida; `-` = NENHUM arquivo, so o
 * dispositivo sintetico do Chromium.
 *
 * Esse controle e o que separa "a flag esta sendo ignorada" de "o arquivo chegou": se a
 * impressao digital do braco `-` for igual a de um braco com arquivo, quem tocou foi o tom
 * sintetico -- e o Chromium cai nele CALADO quando nao consegue abrir o arquivo. Foi a falta
 * deste braco que me fez ler energia como fala em tres medicoes seguidas (2026-11-13).
 */
const WAVS = arg('wavs', arg('wav', 'artifacts/voz/gateway.wav')).split(',');
const WAV = WAVS[0];
const ATRASOS = arg('atraso', '0,8').split(',').map(Number);
const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';
const JANELA_S = Number(arg('janela', '12'));

for (const w of WAVS) {
  if (w !== '-' && !existsSync(w)) {
    console.error(`sem fixture: ${w} (rode tools/make-voice-fixtures.ps1)`);
    process.exit(2);
  }
}

/**
 * Passo que roda DENTRO da página. Mede com o mesmo caminho do produto (AudioWorklet não, que
 * exigiria servir o worklet; `ScriptProcessor` não, que está depreciado) — `AnalyserNode` basta:
 * a pergunta é se existe energia, não qual é o espectro.
 */
function passoDeMedicao(atrasoS, janelaS) {
  return `
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, ${atrasoS * 1000}));
    const pedidoEm = (performance.now() - t0) / 1000;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return { erro: String(e && e.name || e) };
    }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const amostras = [];
    let pico = 0;
    let picoEm = null;
    for (let i = 0; i < ${janelaS} * 10; i++) {
      await new Promise((r) => setTimeout(r, 100));
      an.getFloatTimeDomainData(buf);
      let soma = 0;
      for (let k = 0; k < buf.length; k++) soma += buf[k] * buf[k];
      const rms = Math.sqrt(soma / buf.length);
      const quando = Number(((performance.now() - t0) / 1000).toFixed(1));
      amostras.push({ t: quando, rms: Number(rms.toFixed(4)) });
      if (rms > pico) { pico = rms; picoEm = quando; }
    }
    for (const tr of stream.getTracks()) tr.stop();
    await ctx.close();
    // Faixas de 1 s com o RMS maximo: e assim que da pra VER a fala comecando e acabando.
    const faixas = [];
    for (let s = 0; s < ${janelaS}; s++) {
      const de = pedidoEm + s;
      const dentro = amostras.filter((a) => a.t >= de && a.t < de + 1).map((a) => a.rms);
      faixas.push(dentro.length ? Number(Math.max(...dentro).toFixed(3)) : 0);
    }
    return {
      taxaDoContexto: ctx.sampleRate,
      pedidoEm: Number(pedidoEm.toFixed(1)),
      pico: Number(pico.toFixed(4)),
      picoEm,
      // Limiar 0,02: silencio digital da ~0,000x; fala do SAPI passa de 0,05 com folga.
      houveFala: pico > 0.02,
      rmsPorSegundo: faixas,
    };
  `;
}

/** `--laco 1` tira o sufixo `%noloop`; `--cru 1` tira a cauda de silencio que o harness cola. */
const EM_LACO = arg('laco', '0') === '1';
const CRU = arg('cru', '0') === '1';

let arm = 0;
for (const wav of WAVS) for (const atraso of ATRASOS) {
  const rotulo = wav === '-' ? 'SEM ARQUIVO (dispositivo sintetico)' : wav;
  console.log(`\n--- ${rotulo} | getUserMedia aos ${atraso}s${EM_LACO ? ' | sem %noloop' : ''}${CRU ? ' | sem cauda' : ''}`);
  const r = await dirigir({
    url: ALVO,
    mic: wav === '-' ? null : wav,
    micEmLaco: EM_LACO,
    micSemCauda: CRU,
    // Porta por braco: `PORTA_PADRAO` deriva do pid, entao os bracos disputariam a mesma porta.
    porta: 9700 + (arm++),
    espera: 1500,
    headless: !process.argv.includes('--ver'),
    passos: [passoDeMedicao(atraso, JANELA_S)],
  });
  const v = r.passos[0]?.valor;
  const erro = r.passos[0]?.erro;
  if (erro || !v) { console.log(`    FALHOU: ${erro ?? 'sem valor'}`); continue; }
  if (v.erro) { console.log(`    getUserMedia recusou: ${v.erro}`); continue; }
  console.log(`    contexto: ${v.taxaDoContexto} Hz · pedido aos ${v.pedidoEm}s`);
  console.log(`    pico: ${v.pico} aos ${v.picoEm}s · houve fala: ${v.houveFala ? 'SIM' : 'NAO'}`);
  console.log(`    rms por segundo: ${v.rmsPorSegundo.join(' ')}`);
}
