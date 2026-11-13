/**
 * Mede POR QUE a voz emudece (dívida M6) — no protocolo puro, sem navegador.
 *
 * O sintoma medido em 2026-11-13 (bateria, gate 4.3): socket saudável (`ws.ready` E
 * `ws.resumption`), 879 quadros de microfone subindo (35 s), e o servidor **não manda nada de
 * volta** — nem transcrição de entrada, nem áudio, nem fechamento. O cenário passava sozinho e
 * falhava em sequência, e a suspeita registrada era cota. Cota fecha o socket; este não fechava.
 *
 * A diferença que o navegador introduziu entre o "passava" e o "falha" é o SEMEADOR de contexto:
 * desde a F3 toda sessão manda `clientContent` (quadro da tela) ANTES de abrir o microfone — é o
 * `out.history` que aparece na linha do tempo logo antes do `mic.open`. A hipótese é que misturar
 * `clientContent` com `realtimeInput.audio` na mesma sessão faz o servidor engolir o áudio.
 *
 * Como mede: 2×2 de sessões reais, MESMA fala e MESMO formato nos quatro braços —
 *   contexto {com, sem} × fim-de-fala {com, sem `audioStreamEnd`}
 * Cada braço: setup -> setupComplete -> [contexto] -> stream do WAV em tempo real -> cauda de
 * silêncio (o microfone do navegador fica aberto; parar de mandar quadro não é o mesmo que calar)
 * -> [audioStreamEnd] -> escuta. Reporta a ORDEM dos quadros do servidor com carimbo de tempo.
 *
 * Braço que transcreve = caminho bom. Braço mudo = causa isolada, porque só uma variável mudou.
 *
 * ⚠ Gasta cota da chave do `.env` (a do dono) — quatro sessões por corrida. A chave nunca é
 * impressa: entra na URL do socket e sai daqui pelo `redact`.
 *
 * Uso: node tools/medir-voz.mjs [--wav artifacts/voz/evento.wav] [--cauda 3] [--escuta 20]
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';

import {
  buildAudioChunk, buildAudioStreamEnd, buildHistory, buildSetup,
  parseServerFrame, socketUrl, CAPTURE_RATE,
} from '../src/assistant/live/protocol.js';
import { redact, rememberSecret } from '../src/assistant/live/redact.js';

function arg(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$/.exec(linha);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  return null;
}

const chave = chaveDoEnv();
if (!chave) {
  console.error('sem .env com GEMINI_API_KEY: a medicao precisa do servidor de verdade');
  process.exit(2);
}
rememberSecret(chave);

const WAV = arg('wav', 'artifacts/voz/evento.wav');
const CAUDA_S = Number(arg('cauda', '3'));
const ESCUTA_S = Number(arg('escuta', '20'));
const SAIDA = arg('out', 'artifacts/voz/medicao-m6.json');

/**
 * PCM16 mono do WAV. Recusa formato diferente em vez de adivinhar: um WAV 44,1 kHz mandado como
 * `rate=16000` vira fala acelerada que o servidor não entende, e o sintoma seria "não transcreveu"
 * — exatamente o que estamos investigando. Medir com o instrumento errado é o erro a evitar aqui.
 */
function lerWav(caminho) {
  const b = readFileSync(caminho);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${caminho} nao e um WAV RIFF`);
  }
  let pos = 12;
  let fmt = null;
  let dados = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const tam = b.readUInt32LE(pos + 4);
    const corpo = b.subarray(pos + 8, pos + 8 + tam);
    if (id === 'fmt ') {
      fmt = {
        formato: corpo.readUInt16LE(0),
        canais: corpo.readUInt16LE(2),
        taxa: corpo.readUInt32LE(4),
        bits: corpo.readUInt16LE(14),
      };
    }
    if (id === 'data') dados = corpo;
    pos += 8 + tam + (tam % 2);
  }
  if (!fmt || !dados) throw new Error(`${caminho} sem fmt ou sem data`);
  if (fmt.formato !== 1 || fmt.canais !== 1 || fmt.bits !== 16 || fmt.taxa !== CAPTURE_RATE) {
    throw new Error(`${caminho}: esperado PCM16 mono ${CAPTURE_RATE} Hz, veio ${JSON.stringify(fmt)}`);
  }
  return dados;
}

const QUADRO_MS = 40;
const BYTES_POR_QUADRO = (CAPTURE_RATE * 2 * QUADRO_MS) / 1000;   // 1280 = 640 amostras PCM16

const PROMPT = [
  'Você é um ajudante de BPMN. Responde em português do Brasil, falando, em até duas frases.',
  'Quando o aluno perguntar algo, responda direto.',
].join(' ');

/** O MESMO par que `session.js::enviarContexto` manda: usuário + ACK do modelo, turno aberto. */
const CONTEXTO = [
  { role: 'user', text: 'Estado da tela: processo com 9 tarefas, 2 gateways, 1 evento de início. Selecionado: nenhum.' },
  { role: 'model', text: 'Entendido, estou com o estado atual da tela.' },
];

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function braco({ nome, comContexto, comFimDeFala, pcm }) {
  const t0 = Date.now();
  const linha = [];
  const marca = (o) => linha.push({ t: Date.now() - t0, ...o });

  const ws = new WebSocket(socketUrl(chave));
  ws.binaryType = 'arraybuffer';

  let pronto = false;
  let fechou = null;
  const entrada = [];
  const saidaTexto = [];
  let quadrosDeAudio = 0;
  const contagem = {};

  ws.addEventListener('message', async (ev) => {
    const cru = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
    const f = parseServerFrame(cru);
    contagem[f.kind] = (contagem[f.kind] ?? 0) + 1;
    if (f.kind === 'noop') return;              // ruído medido: ~1 em 3 é vazio
    if (f.kind === 'ready') pronto = true;
    if (f.kind === 'audio') quadrosDeAudio++;
    if (f.kind === 'input-text') entrada.push(f.text);
    if (f.kind === 'output-text' || (f.kind === 'audio' && f.text)) saidaTexto.push(f.text);
    if (f.kind === 'audio') { if (quadrosDeAudio === 1) marca({ q: 'audio (1o)' }); return; }
    marca({ q: f.kind, texto: (f.text ?? '').slice(0, 80) || undefined });
  });
  ws.addEventListener('close', (ev) => {
    fechou = { codigo: ev.code, motivo: redact(String(ev.reason ?? '')) };
    marca({ q: `close ${ev.code}`, texto: fechou.motivo || undefined });
  });
  ws.addEventListener('error', () => marca({ q: 'erro de socket' }));

  await new Promise((ok, falha) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => falha(new Error('socket nao abriu')), { once: true });
  });
  marca({ q: 'open' });

  // Voz = SEM a função de entrega (medido em 2026-11-10: com ela declarada o modelo não fala).
  ws.send(JSON.stringify(buildSetup({ systemInstruction: PROMPT, withDeliveryTool: false })));
  marca({ q: 'out.setup' });
  for (let i = 0; i < 100 && !pronto; i++) await dorme(100);
  if (!pronto) {
    try { ws.close(); } catch { /* já fechado */ }
    return { nome, comContexto, comFimDeFala, erro: 'setupComplete nunca chegou', linha, fechou };
  }

  if (comContexto) {
    ws.send(JSON.stringify(buildHistory(CONTEXTO)));
    marca({ q: 'out.history' });
    await dorme(500);
  }

  // Fala em TEMPO REAL: 40 ms por quadro, como o worklet do navegador. Despejar tudo de uma vez
  // mediria outra coisa.
  let enviados = 0;
  for (let p = 0; p + BYTES_POR_QUADRO <= pcm.length; p += BYTES_POR_QUADRO) {
    ws.send(JSON.stringify(buildAudioChunk(pcm.toString('base64', p, p + BYTES_POR_QUADRO))));
    enviados++;
    await dorme(QUADRO_MS);
  }
  marca({ q: `out.audio x${enviados} (fala)` });

  // Cauda de SILÊNCIO: no navegador o microfone continua aberto depois da fala, e é esse silêncio
  // que o VAD do servidor usa para fechar o turno. Parar de mandar quadro não é calar-se.
  const mudo = Buffer.alloc(BYTES_POR_QUADRO).toString('base64');
  let silencio = 0;
  for (let i = 0; i < (CAUDA_S * 1000) / QUADRO_MS; i++) {
    ws.send(JSON.stringify(buildAudioChunk(mudo)));
    silencio++;
    await dorme(QUADRO_MS);
  }
  marca({ q: `out.audio x${silencio} (silencio)` });

  if (comFimDeFala) {
    ws.send(JSON.stringify(buildAudioStreamEnd()));
    marca({ q: 'out.audio-end' });
  }

  for (let i = 0; i < ESCUTA_S * 2 && !fechou; i++) {
    await dorme(500);
    if (entrada.length && quadrosDeAudio > 3) break;
  }
  try { ws.close(); } catch { /* já fechado */ }

  return {
    nome,
    comContexto,
    comFimDeFala,
    transcreveuAEntrada: entrada.join(' ').trim() || null,
    legendaDaResposta: saidaTexto.join('').trim().slice(0, 160) || null,
    quadrosDeAudioDoModelo: quadrosDeAudio,
    quadrosDeMicrofone: enviados + silencio,
    contagem,
    fechou,
    linha,
  };
}

/**
 * `--ganho 0.1` atenua a fala antes de mandar. Existe para testar NIVEL como causa: o caminho de
 * captura do navegador entrega RMS ~0,014 onde o arquivo tem ~0,14 (medido em 2026-11-13, com o
 * `nivelPorSegundo` do cenario de voz) — 20 dB a menos. Se o servidor para de transcrever com a
 * mesma fala atenuada, o nivel e a causa; se transcreve igual, nao e.
 */
const GANHO = Number(arg('ganho', '1'));

function aplicarGanho(buf, ganho) {
  if (ganho === 1) return buf;
  const out = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const v = Math.max(-32768, Math.min(32767, Math.round(buf.readInt16LE(i) * ganho)));
    out.writeInt16LE(v, i);
  }
  return out;
}

const pcm = aplicarGanho(lerWav(WAV), GANHO);
const segundos = (pcm.length / (CAPTURE_RATE * 2)).toFixed(1);
console.log(`fala: ${WAV} (${segundos}s) · ganho: ${GANHO} · cauda de silencio: ${CAUDA_S}s · escuta: ${ESCUTA_S}s`);

const TODOS = [
  { nome: 'cru (sem contexto, sem fim-de-fala)', comContexto: false, comFimDeFala: false },
  { nome: 'contexto (com clientContent antes do audio)', comContexto: true, comFimDeFala: false },
  { nome: 'cru + fim-de-fala', comContexto: false, comFimDeFala: true },
  { nome: 'contexto + fim-de-fala', comContexto: true, comFimDeFala: true },
];
/** `--so cru` roda um braco so: cada braco e uma sessao real e gasta cota do dono. */
const SO = arg('so', null);
const BRACOS = SO ? TODOS.filter((b) => b.nome.includes(SO)) : TODOS;
if (!BRACOS.length) { console.error(`nenhum braco bate com "${SO}"`); process.exit(2); }

const resultados = [];
for (const b of BRACOS) {
  console.log(`\n--- ${b.nome}`);
  let r;
  try {
    r = await braco({ ...b, pcm });
  } catch (err) {
    r = { ...b, erro: redact(String(err?.message ?? err)) };
  }
  resultados.push(r);
  console.log(`    ouviu: ${r.transcreveuAEntrada ?? '(NADA)'}`);
  console.log(`    falou: ${r.quadrosDeAudioDoModelo ?? 0} quadros · legenda: ${r.legendaDaResposta ?? '(nenhuma)'}`);
  if (r.fechou) console.log(`    fechou: ${r.fechou.codigo} ${r.fechou.motivo}`);
  if (r.erro) console.log(`    erro: ${r.erro}`);
  console.log(`    ordem: ${(r.linha ?? []).map((l) => l.q).join(' -> ')}`);
  await dorme(5000);   // folga entre sessões: concorrência de sessão não é a variável medida
}

mkdirSync('artifacts/voz', { recursive: true });
writeFileSync(SAIDA, JSON.stringify({ wav: WAV, segundos, cauda: CAUDA_S, quando: new Date().toISOString(), resultados }, null, 2));

const ouviram = resultados.filter((r) => r.transcreveuAEntrada);
console.log(`\nRESULT: ${ouviram.length}/${resultados.length} bracos transcreveram a entrada`);
console.log(`gravado em ${SAIDA}`);
for (const r of resultados) {
  console.log(`  ${r.transcreveuAEntrada ? 'OUVIU ' : 'MUDO  '} ${r.nome}`);
}
