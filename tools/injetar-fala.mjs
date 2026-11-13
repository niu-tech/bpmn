/**
 * Injeta uma fala na sessão de voz SEM microfone — e prova que o servidor transcreveu.
 *
 * Por que existe (H11, colhido da `WikiAgentCapsule`, que tem isto como modo `inject`): até
 * 2026-11-13 todo cenário de voz dependia do microfone falso do Chromium, e foi aí que a dívida M6
 * nasceu — o navegador recusava a fixture e trocava por um tom sintético **sem escrever uma linha
 * de log**. Três dias lidos como "o servidor está mudo". Injetando, o navegador sai da conta.
 *
 * ⚠ NÃO substitui a captura. O produto usa microfone de verdade, e uma suíte que só injeta não sabe
 * se a captura quebrou — `tools/provar-captura.mjs` e um cenário da bateria continuam no caminho
 * real. Isto aqui torna o RESTO determinístico, e permite **várias falas na mesma sessão**, que é o
 * que o barge-in precisa e o arquivo linear não dá.
 *
 * Uso:
 *   node tools/injetar-fala.mjs                                  # uma fala
 *   node tools/injetar-fala.mjs --wav a.wav --wav b.wav --pausa 3  # duas, com pausa entre elas
 */
import { existsSync, readFileSync } from 'node:fs';

import { dirigir } from './drive-page.mjs';

const TAXA = 16000;
const QUADRO_MS = 40;
const BYTES_POR_QUADRO = (TAXA * 2 * QUADRO_MS) / 1000;   // 1280 = 640 amostras PCM16

function arg(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

function todos(nome) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${nome}`) out.push(process.argv[i + 1]);
  return out;
}

/**
 * PCM16 mono do WAV, recusando formato diferente em vez de adivinhar: um WAV 44,1 kHz mandado como
 * `rate=16000` vira fala acelerada que o servidor não entende — e o sintoma seria "não transcreveu".
 */
export function quadrosDoWav(caminho) {
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
      fmt = { formato: corpo.readUInt16LE(0), canais: corpo.readUInt16LE(2), taxa: corpo.readUInt32LE(4), bits: corpo.readUInt16LE(14) };
    }
    if (id === 'data') dados = corpo;
    pos += 8 + tam + (tam % 2);
  }
  if (!fmt || !dados) throw new Error(`${caminho} sem fmt ou sem data`);
  if (fmt.formato !== 1 || fmt.canais !== 1 || fmt.bits !== 16 || fmt.taxa !== TAXA) {
    throw new Error(`${caminho}: esperado PCM16 mono ${TAXA} Hz, veio ${JSON.stringify(fmt)}`);
  }
  const quadros = [];
  for (let p = 0; p + BYTES_POR_QUADRO <= dados.length; p += BYTES_POR_QUADRO) {
    quadros.push(dados.toString('base64', p, p + BYTES_POR_QUADRO));
  }
  return quadros;
}

/** Quadros de SILÊNCIO — é o que o servidor usa para fechar o turno (medido em `medir-voz.mjs`). */
export function quadrosMudos(segundos) {
  const mudo = Buffer.alloc(BYTES_POR_QUADRO).toString('base64');
  return Array.from({ length: Math.round((segundos * 1000) / QUADRO_MS) }, () => mudo);
}

function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$/.exec(linha);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  return null;
}

if (process.argv[1]?.endsWith('injetar-fala.mjs')) {
  const chave = chaveDoEnv();
  if (!chave) { console.error('sem .env com GEMINI_API_KEY: a prova precisa do servidor de verdade'); process.exit(2); }

  const wavs = todos('wav');
  const falas = wavs.length ? wavs : ['artifacts/voz/gateway.wav'];
  const cauda = Number(arg('cauda', '3'));
  const pausa = Number(arg('pausa', '0'));
  const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';

  // Cada fala vai com a cauda muda atras: e o silencio que faz o VAD do servidor fechar o turno.
  const lotes = falas.map((w) => [...quadrosDoWav(w), ...quadrosMudos(cauda)]);
  console.log(`falas: ${falas.join(' · ')} | quadros: ${lotes.map((l) => l.length).join(' + ')}`);

  const r = await dirigir({
    url: ALVO,
    espera: 3000,
    headless: !process.argv.includes('--ver'),
    passos: [
      `window.__btn = (t) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === t);
       document.querySelector('.bpmn-assist__toggle').click();
       document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(chave)};
       const c = document.querySelector('#bpmn-assist-consent'); c.checked = true; c.dispatchEvent(new Event('change'));
       window.__btn('Voz').click();
       window.__btn('Começar').click();
       // ⚠ Esperar 'pronto', nao "deixou de ser desligado": o microfone AUTOMATICO so abre quando a
       // sessao fica pronta, e fechar antes disso nao fecha nada — ele abre depois. Medido em
       // 2026-11-13: a primeira versao injetou com status 'conectando', o microfone abriu sozinho
       // e o servidor transcreveu o TOM do dispositivo falso como "mhm", junto da fala injetada.
       for (let i = 0; i < 60 && document.querySelector('.bpmn-assist__status').textContent !== 'pronto'; i++) {
         await new Promise((r) => setTimeout(r, 500));
       }
       // Agora sim: fecha o microfone e CONFERE que fechou. A injecao tem de ser a unica fonte.
       for (let i = 0; i < 20 && window.__bpmnAssist.estado.micOn; i++) {
         await window.__bpmnAssist.pararMicrofone();
         await new Promise((r) => setTimeout(r, 250));
       }
       return {
         status: document.querySelector('.bpmn-assist__status').textContent,
         micOn: window.__bpmnAssist.estado.micOn,
       };`,

      `window.__lotes = ${JSON.stringify(lotes)};
       if (window.__bpmnAssist.estado.micOn) {
         return { ok: false, culpa: '[HARNESS] o microfone continua aberto: a injecao mediria os dois misturados' };
       }
       const falou = [];
       for (let i = 0; i < window.__lotes.length; i++) {
         if (i > 0) await new Promise((r) => setTimeout(r, ${pausa} * 1000));
         falou.push(await window.__bpmnAssist.injetarFala(window.__lotes[i]));
       }
       for (let i = 0; i < 60; i++) {
         await new Promise((r) => setTimeout(r, 500));
         const c = window.__bpmnAssist.contagem;
         if ((c['ws.input-text'] ?? 0) > 0 && (c['ws.audio'] ?? 0) > 3) break;
       }
       const c = window.__bpmnAssist.contagem;
       const falas = [...document.querySelectorAll('.bpmn-assist__msg--user')].map((m) => m.textContent.trim());
       const respostas = [...document.querySelectorAll('.bpmn-assist__msg--assistant')].map((m) => m.textContent.trim());
       return {
         ok: (c['ws.input-text'] ?? 0) > 0,
         injetou: falou,
         ouviu: falas.at(-1)?.slice(0, 140) ?? '(sem transcricao de entrada)',
         bolhasDeFala: falas.length,
         respondeu: respostas.at(-1)?.slice(0, 140) ?? '(sem legenda)',
         quadrosDeAudioDoModelo: c['ws.audio'] ?? 0,
         eventos: window.__bpmnAssist.eventos.map((e) => e.key + (e.n > 1 ? ' x' + e.n : '')),
       };`,
    ],
  });

  for (const passo of r.passos) {
    if (passo.erro) { console.error(`FALHOU: ${passo.erro}`); process.exitCode = 1; }
    else console.log(JSON.stringify(passo.valor, null, 1));
  }
}
