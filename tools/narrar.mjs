/**
 * Versão FALADA de uma peça: texto → WAV, com a voz do Gemini.
 *
 * Este é o mesmo método das narrações do CopilotSpeaker (MAIA) — `tools/MaiaNarrationRender`
 * e `tools/cloud-desktop/narrate-presentation.py` —, portado para cá sem inventar nada:
 *
 *   modelo `gemini-3.8-flash-lite-tts` · voz `Zephyr` · `responseModalities: ['AUDIO']` com
 *   `speechConfig.voiceConfig.prebuiltVoiceConfig` · áudio que volta é `audio/L16; rate=24000`
 *   (PCM 16 bits, mono, 24 kHz) e vira WAV aqui.
 *
 * ⚠ **Nos modelos 3.x vai SÓ o texto.** Os 2.5 consomem a diretiva de estilo antes dos
 * dois-pontos; os 3.x a LEEM EM VOZ ALTA junto com a fala (medido no MaiaNarrationRender,
 * 2026-10-05: a locução saiu com "Narre em português do Brasil…" na frente) e recusam
 * `systemInstruction`. Então a pronúncia tem de estar escrita no próprio texto — é por isso que
 * o `.falado.md` escreve "vê pê éssi" e "ponto H T M L" por extenso.
 *
 * ⚠ A CHAVE é a do dono, lida do `.env` git-ignored deste repositório (o mesmo arquivo que os
 * cenários ao vivo usam). Nunca é impressa, nunca entra em argumento de linha de comando e
 * nunca vai para o repositório. O áudio sai em `artifacts/` (git-ignored): é gerado.
 *
 * Uso:
 *   node tools/narrar.mjs openspec/apresentacoes/apanhado-e-frentes.falado.md
 *   node tools/narrar.mjs <texto> --out artifacts/falado/x.wav --voz Zephyr
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const MODELO = 'gemini-3.8-flash-lite-tts';
const VOZ_PADRAO = 'Zephyr';
const TAXA = 24000;

/** A chave mora no `.env` que o git ignora. Mesmo contrato dos cenários ao vivo da bateria. */
function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$/.exec(linha);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  return null;
}

/** O leitor fala PROSA. Tira o que é só para o olho — e o travessão vira pausa. */
function paraFala(md) {
  return md
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[—–]/g, ',')
    .replace(/ /g, ' ')
    .trim();
}

/**
 * Um pedido por PARÁGRAFO. É o recorte natural da fala e o que o narrador da MAIA faz com as
 * falas dele: pedaço curto erra menos, e um pedaço que falhe não derruba a narração inteira.
 */
function emPedacos(texto) {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

const LIMITE = 6; // o TTS é compartilhado e responde 429/503 em rajada

/**
 * As AMOSTRAS cruas do que o modelo devolveu.
 *
 * ⚠ Os dois formatos existem, e o nosso é o segundo: o `gemini-2.5-flash-preview-tts` devolve
 * `audio/L16; rate=24000` (PCM nu, como está escrito nos narradores da MAIA), e o
 * `gemini-3.8-flash-lite-tts` devolve `audio/wav` — já com os 44 bytes de cabeçalho RIFF.
 * Medido aqui em 2026-11-14, na primeira chamada. Concatenar sem tirar o cabeçalho enfiaria
 * `RIFF…WAVEfmt` no meio da fala, como um estalo a cada parágrafo.
 */
function amostras(inline) {
  const bytes = Buffer.from(inline.data, 'base64');
  const tipo = String(inline.mimeType ?? '');

  if (/^audio\/L16/.test(tipo)) {
    if (!tipo.includes(`rate=${TAXA}`)) throw new Error(`taxa inesperada: ${tipo}`);
    return bytes;
  }

  if (/^audio\/wav/.test(tipo)) {
    if (bytes.subarray(0, 4).toString() !== 'RIFF') throw new Error('audio/wav sem RIFF');
    const taxa = bytes.readUInt32LE(24);
    if (taxa !== TAXA) throw new Error(`taxa inesperada no WAV: ${taxa}`);
    const dados = bytes.indexOf('data', 12, 'ascii');
    if (dados < 0) throw new Error('WAV sem bloco de dados');
    return bytes.subarray(dados + 8);
  }

  // Formato novo ⇒ parar e dizer qual, não adivinhar.
  throw new Error(`formato inesperado: ${tipo}`);
}

async function falar({ texto, chave, voz }) {
  const corpo = {
    contents: [{ parts: [{ text: texto }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } },
    },
  };

  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpo),
      },
    );
    const bruto = await r.text();

    if (r.ok) {
      const partes = JSON.parse(bruto)?.candidates?.[0]?.content?.parts ?? [];
      let pcm = Buffer.alloc(0);
      for (const p of partes) {
        const inline = p.inlineData;
        if (!inline?.data) continue;
        pcm = Buffer.concat([pcm, amostras(inline)]);
      }
      if (pcm.length < 4800 || pcm.length % 2) throw new Error('áudio ausente ou inválido');
      return pcm;
    }

    // "tente de novo" do TTS compartilhado: recuo exponencial, teto de tentativas.
    const transitorio = [429, 500, 502, 503, 504].includes(r.status);
    if (!transitorio || tentativa === LIMITE) {
      throw new Error(`Gemini TTS HTTP ${r.status}: ${bruto.slice(0, 200)}`);
    }
    const espera = Math.min(60, 2 ** tentativa * 3);
    console.log(`  HTTP ${r.status} (transitório) — nova tentativa em ${espera}s`);
    await new Promise((s) => setTimeout(s, espera * 1000));
  }
}

/** WAV mono 16 bits a partir do PCM cru. 44 bytes de cabeçalho, nada além. */
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(TAXA, 24);
  h.writeUInt32LE(TAXA * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const entrada = process.argv[2];
if (!entrada) throw new Error('uso: node tools/narrar.mjs <texto.falado.md> [--out x.wav] [--voz Zephyr]');
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : padrao;
};
const voz = arg('--voz', VOZ_PADRAO);
const saida = arg('--out', `artifacts/falado/${basename(entrada).replace(/\.falado\.md$|\.md$|\.txt$/, '')}.wav`);

const chave = chaveDoEnv();
if (!chave) throw new Error('sem .env com GEMINI_API_KEY: a narração usa a chave do dono, e ela mora lá');

const pedacos = emPedacos(paraFala(readFileSync(entrada, 'utf8')));
mkdirSync(dirname(saida), { recursive: true });

// Cache por impressão digital: refazer um parágrafo que não mudou é queimar cota à toa.
const cachePath = `${saida}.cache.json`;
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const marca = (t) => createHash('sha256').update(`${MODELO}|${voz}|${t}`).digest('hex');

console.log(`modelo ${MODELO} · voz ${voz} · ${pedacos.length} pedaços`);
const partes = [];
for (const [i, texto] of pedacos.entries()) {
  const id = marca(texto);
  const arquivo = `${saida}.${String(i + 1).padStart(2, '0')}.pcm`;
  if (cache[id] === arquivo && existsSync(arquivo)) {
    partes.push(readFileSync(arquivo));
    console.log(`  ${i + 1}/${pedacos.length} (cache)`);
    continue;
  }
  const pcm = await falar({ texto, chave, voz });
  writeFileSync(arquivo, pcm);
  cache[id] = arquivo;
  writeFileSync(cachePath, JSON.stringify(cache, null, 1), 'utf8');
  partes.push(pcm);
  console.log(`  ${i + 1}/${pedacos.length} — ${(pcm.length / (TAXA * 2)).toFixed(1)}s`);
  if (i < pedacos.length - 1) await new Promise((s) => setTimeout(s, 6000));
}

const pcm = Buffer.concat(partes);
writeFileSync(saida, wav(pcm));
console.log(`\nWAV: ${saida}`);
console.log(`DURACAO: ${(pcm.length / (TAXA * 2) / 60).toFixed(1)} min · ${(pcm.length / 1024 / 1024).toFixed(1)} MB`);
