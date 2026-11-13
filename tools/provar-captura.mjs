/**
 * Grava o que o MICROFONE DO NAVEGADOR produz e salva como WAV, para ouvir/medir/mandar ao servidor.
 *
 * Por que existe (dívida M6, 2026-11-13): o relatório sabia dizer o NÍVEL do que sai e não sabia
 * devolver o ÁUDIO. Com nível sozinho, "capturou um tom de teste", "capturou ruído" e "capturou a
 * fala" viram a mesma linha — e foi assim que o tom sintético do Chromium passou dias sendo lido
 * como "o servidor está mudo". O que importa é o CONTEÚDO.
 *
 * Não gasta cota: a página roda `startCapture` sem abrir socket (`__bpmnAssist.provarCaptura`).
 * O WAV que sai pode ir direto para o servidor de verdade:
 *
 *   node tools/provar-captura.mjs --segundos 10
 *   node tools/medir-voz.mjs --wav artifacts/voz/captura-do-navegador.wav --so cru
 *
 * Servidor transcreve o WAV capturado ⇒ o caminho de captura está bom e o problema é adiante.
 * Servidor não transcreve ⇒ o defeito está na captura, e agora dá para ouvi-lo.
 *
 * Uso: node tools/provar-captura.mjs [--wav <fixture>] [--segundos 10] [--out <saida.wav>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { dirigir } from './drive-page.mjs';

function arg(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';
const FIXTURE = arg('wav', 'artifacts/voz/gateway.wav');
const SEGUNDOS = Number(arg('segundos', '10'));
const SAIDA = arg('out', 'artifacts/voz/captura-do-navegador.wav');
/**
 * `--atraso N` espera N segundos depois do load antes de abrir o microfone.
 *
 * É a pergunta que sobrou da dívida M6: com `%noloop` honrado, a fixture toca UMA vez — e se o
 * relógio dela começa a correr antes de o produto abrir o microfone, o cenário real (painel →
 * chave → consentimento → Voz → Começar → sessão pronta → startMic, uns 8-15 s) abre o microfone
 * depois de a fala ter acabado. Aí não há o que transcrever, e o sintoma é "o servidor está mudo".
 */
const ATRASO = Number(arg('atraso', '0'));
const TAXA = 16000;

/** Cabeçalho PCM canônico de 16 bytes — o único que o microfone falso do Chromium aceita reler. */
function wavDePcm(pcm, taxa = TAXA) {
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0, 'ascii');
  cab.writeUInt32LE(36 + pcm.length, 4);
  cab.write('WAVEfmt ', 8, 'ascii');
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(taxa, 24);
  cab.writeUInt32LE(taxa * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36, 'ascii');
  cab.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([cab, pcm]);
}

/**
 * Cruzamentos de zero por segundo. É o que separa FALA de TOM, e nível não separa.
 *
 * Medido em 2026-11-13 (dívida M6), mesmo instante, mesma página:
 *   • `gateway.wav` (referência):      1538 874 2917 1157 1016      — variável, alto
 *   • captura boa:                     1996 1214 3462 1393 1192 45 0 — segue a referência, cala
 *   • captura do tom sintético:          78  148  144  146  146 150  — ~146, teimosamente estável
 *
 * O tom tem energia de verdade; foi medindo energia que eu li o tom como fala por três medições.
 */
function cruzamentosPorSegundo(pcm, taxa = TAXA) {
  const porSegundo = taxa * 2;
  const out = [];
  for (let p = 0; p + porSegundo <= pcm.length; p += porSegundo) {
    let c = 0;
    let anterior = pcm.readInt16LE(p);
    for (let i = p + 2; i < p + porSegundo; i += 2) {
      const v = pcm.readInt16LE(i);
      if ((v < 0) !== (anterior < 0)) c++;
      anterior = v;
    }
    out.push(c);
  }
  return out;
}

/**
 * Veredito sobre QUEM tocou. O modo de falha desta dívida foi "parece que funcionou": quando o
 * Chromium não consegue ler a fixture ele troca pelo tom sintético e não avisa. Então quem mede
 * precisa dizer isto em voz alta, ou a próxima pessoa relê a mesma medição errada.
 */
function quemTocou(cruzamentos) {
  const vivos = cruzamentos.filter((c) => c > 20);
  if (!vivos.length) return { veredito: 'SILENCIO', detalhe: 'nada acima do chao de ruido' };
  const media = vivos.reduce((a, b) => a + b, 0) / vivos.length;
  const desvio = Math.sqrt(vivos.reduce((a, b) => a + (b - media) ** 2, 0) / vivos.length);
  const variacao = desvio / media;
  // Fala varia muito entre segundos (consoante x vogal x pausa); tom nao varia.
  if (media < 400 && variacao < 0.25) {
    return { veredito: 'TOM SINTETICO', detalhe: `~${Math.round(media)} cruzamentos/s, variacao ${variacao.toFixed(2)} — o Chromium NAO tocou a fixture` };
  }
  return { veredito: 'FALA', detalhe: `media ${Math.round(media)} cruzamentos/s, variacao ${variacao.toFixed(2)}` };
}

function rmsPorSegundo(pcm, taxa = TAXA) {
  const porSegundo = taxa * 2;
  const out = [];
  for (let p = 0; p < pcm.length; p += porSegundo) {
    const fim = Math.min(pcm.length, p + porSegundo);
    let soma = 0;
    let n = 0;
    for (let i = p; i + 1 < fim; i += 2) { const v = pcm.readInt16LE(i) / 32768; soma += v * v; n++; }
    out.push(n ? Number(Math.sqrt(soma / n).toFixed(4)) : 0);
  }
  return out;
}

const r = await dirigir({
  url: ALVO,
  // `--wav -` = NENHUM arquivo: grava a digital do dispositivo sintetico, que e a referencia
  // rotulada para classificar qualquer captura futura (divida M6).
  mic: FIXTURE === '-' ? null : FIXTURE,
  espera: 2500,
  headless: !process.argv.includes('--ver'),
  passos: [
    `document.querySelector('.bpmn-assist__toggle').click();
     await new Promise((r) => setTimeout(r, ${ATRASO * 1000}));
     const r = await window.__bpmnAssist.provarCaptura(${SEGUNDOS});
     return { taxaDoDispositivo: r.taxaDoDispositivo, quadros: r.quadros, nivelMaximo: r.nivelMaximo, pcmBase64: r.pcmBase64 };`,
  ],
});

const v = r.passos[0]?.valor;
if (r.passos[0]?.erro || !v) {
  console.error(`falhou: ${r.passos[0]?.erro ?? 'sem valor'}`);
  process.exit(1);
}

const pcm = Buffer.concat(v.pcmBase64.map((b) => Buffer.from(b, 'base64')));
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, wavDePcm(pcm));

const bandas = rmsPorSegundo(pcm);
const rmsGeral = Math.sqrt(bandas.reduce((a, b) => a + b * b, 0) / Math.max(1, bandas.length));
console.log(`fixture tocada: ${FIXTURE} · microfone aberto ${ATRASO}s depois do load`);
console.log(`dispositivo: ${v.taxaDoDispositivo} Hz · quadros: ${v.quadros} · nivel maximo do app: ${v.nivelMaximo}`);
console.log(`gravado: ${SAIDA} (${(pcm.length / (TAXA * 2)).toFixed(1)}s, PCM16 ${TAXA} Hz mono)`);
console.log(`rms por segundo: ${bandas.join(' ')}`);
console.log(`rms geral: ${rmsGeral.toFixed(4)} (${(20 * Math.log10(Math.max(1e-6, rmsGeral))).toFixed(1)} dBFS)`);

const cruz = cruzamentosPorSegundo(pcm);
const q = quemTocou(cruz);
console.log(`cruzamentos/s: ${cruz.join(' ')}`);
console.log(`VEREDITO: ${q.veredito} — ${q.detalhe}`);
if (q.veredito === 'TOM SINTETICO') process.exitCode = 3;
