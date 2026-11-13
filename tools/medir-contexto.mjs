/**
 * Mede o TETO do quadro de contexto (`clientContent`) contra o servidor de verdade.
 *
 * Por que existe (openspec tarefa 2.4, design H3): o semeador manda o estado da tela por
 * `clientContent` com `turnComplete:false`. Isso foi medido no P1 com payload pequeno e nunca
 * com payload grande — e "o servidor aceita" sem número é aposta, não decisão. Um diagrama de
 * 400 elementos é um quadro de quantos KB? O teto decide se a amostra de 25 é conservadora
 * demais, ou se já está no limite.
 *
 * Como mede: abre UMA sessão real, manda quadros de tamanho crescente e, depois de cada um,
 * faz uma pergunta trivial. Sessão que responde = quadro aceito. Sessão que fecha ou emudece =
 * teto encontrado, e o tamanho anterior é o último bom.
 *
 * ⚠ Gasta cota da chave do `.env` (a do dono). Rode quando precisar do número, não por hábito.
 * A chave nunca é impressa: entra na URL do socket e sai daqui pelo `redact`.
 *
 * Uso: node tools/medir-contexto.mjs [--max 512]
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';

import { buildHistory, buildSetup, buildTextTurn, parseServerFrame, socketUrl } from '../src/assistant/live/protocol.js';
import { redact, rememberSecret } from '../src/assistant/live/redact.js';

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

const MAX_KB = Number(process.argv[process.argv.indexOf('--max') + 1]) || 512;
/** Degraus em KB. Dobrar é o bastante: queremos a ordem de grandeza, não o byte exato. */
const DEGRAUS = [4, 16, 64, 128, 256, 512, 1024].filter((kb) => kb <= MAX_KB);

const PROMPT = 'Você responde em uma palavra. Nada além disso.';
/** Texto de enchimento legível: payload de verdade é texto, não ruído aleatório. */
const encher = (kb) => 'elemento de teste do quadro de contexto. '.repeat(Math.ceil((kb * 1024) / 40)).slice(0, kb * 1024);

const ws = new WebSocket(socketUrl(chave));
const medidas = [];
let degrau = -1;
let pronto = false;
let esperando = null;

function proximo() {
  degrau++;
  if (degrau >= DEGRAUS.length) return terminar('todos os degraus passaram');
  const kb = DEGRAUS[degrau];
  const t0 = Date.now();
  process.stdout.write(`  ${String(kb).padStart(4)} KB ... `);
  ws.send(JSON.stringify(buildHistory([
    { role: 'user', text: encher(kb) },
    { role: 'model', text: 'Entendido.' },
  ])));
  // A pergunta é o teste de vida: a sessão respondeu depois do quadro, então o quadro entrou.
  ws.send(JSON.stringify(buildTextTurn('Responda apenas: ok')));
  esperando = setTimeout(() => {
    console.log('SEM RESPOSTA (teto)');
    medidas.push({ kb, aceito: false, motivo: 'sem resposta em 25s' });
    terminar(`teto em ${kb} KB: o servidor parou de responder`);
  }, 25000);
  medidas.push({ kb, aceito: null, t0 });
}

function respondeu() {
  if (esperando) { clearTimeout(esperando); esperando = null; }
  const m = medidas.at(-1);
  if (!m || m.aceito !== null) return;
  m.aceito = true;
  m.ms = Date.now() - m.t0;
  console.log(`ok (${m.ms} ms)`);
  proximo();
}

function terminar(resumo) {
  const ultimoBom = [...medidas].reverse().find((m) => m.aceito === true)?.kb ?? 0;
  const relatorio = {
    quando: new Date().toISOString(),
    modelo: 'gemini-3.8-live',
    degrausKB: DEGRAUS,
    medidas: medidas.map(({ t0, ...resto }) => resto),
    ultimoAceitoKB: ultimoBom,
    resumo,
  };
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/medida-clientcontent.json', JSON.stringify(relatorio, null, 2));
  console.log(`\nultimo quadro ACEITO: ${ultimoBom} KB — ${resumo}`);
  console.log('registro em artifacts/medida-clientcontent.json');
  try { ws.close(1000, 'medicao concluida'); } catch { /* ja fechado */ }
  setTimeout(() => process.exit(0), 200);
}

ws.onopen = () => {
  ws.send(JSON.stringify(buildSetup({ systemInstruction: PROMPT, withDeliveryTool: false })));
};

ws.onmessage = (ev) => {
  const frame = parseServerFrame(typeof ev.data === 'string' ? ev.data : String(ev.data));
  if (frame.kind === 'ready') {
    pronto = true;
    console.log('sessao pronta. medindo o teto do clientContent:\n');
    proximo();
    return;
  }
  // Qualquer sinal de vida do modelo serve: áudio, legenda ou fim de turno.
  if (['audio', 'output-text', 'turn-complete'].includes(frame.kind)) respondeu();
};

ws.onclose = (ev) => {
  if (esperando) { clearTimeout(esperando); esperando = null; }
  const m = medidas.at(-1);
  if (!pronto) { console.error('o socket fechou antes do setup:', redact(String(ev?.reason ?? ev?.code))); process.exit(1); }
  if (m && m.aceito === null) {
    m.aceito = false;
    m.motivo = `socket fechado: ${ev?.code ?? '?'} ${redact(String(ev?.reason ?? ''))}`.trim();
    console.log(`RECUSADO (${m.motivo})`);
    terminar(`teto em ${m.kb} KB: ${m.motivo}`);
  }
};

ws.onerror = () => { /* o onclose conta a história; o evento de erro traz a URL com a chave */ };
