/**
 * Prova a CONVERSA do ajudante num navegador de verdade — sem chave, sem rede e sem ninguém
 * olhando. É o laço que faltava: os testes `.mjs` provam a lógica, este prova a TELA.
 *
 * Como engana o mundo exterior, e por que cada engano é honesto:
 *  - `window.WebSocket` é substituído por um dublê ANTES de conectar. O produto não sabe: ele
 *    chama `new WebSocket(url)` como sempre, e nós respondemos com frames reais do protocolo
 *    (`setupComplete`, `serverContent.modelTurn`), copiados do que o Gemini mandou de verdade no
 *    P1. Nada do produto é alterado para o teste.
 *  - O microfone é o do Chromium (`--use-fake-device-for-media-stream`): áudio sintético real,
 *    que passa pelo worklet de captura de verdade, vira PCM16 de verdade e move o medidor. Se o
 *    caminho do microfone quebrar, isto quebra junto.
 *  - A chave é sintética e nunca sai da aba.
 *
 * Uso: node tools/drive-assistant.mjs [url] [--shot <prefixo>]
 *      (sem url, assume http://127.0.0.1:8124/)
 */
import { dirigir } from './drive-page.mjs';

const CHAVE = 'AQ.CHAVE-SINTETICA-DO-DRIVE-NAO-E-DE-NINGUEM-012345';

/** Dublê de WebSocket instalado na página. Guarda o que o produto enviou, para inspeção. */
const DUBLAR_WS = `
window.__frames = [];
window.__sockets = 0;
window.WebSocket = function (url) {
  const self = this;
  window.__sockets++;
  window.__ws = this;
  this.url = url;
  this.readyState = 1;
  this.send = (d) => { window.__frames.push(String(d)); };
  this.close = () => { self.readyState = 3; self.onclose && self.onclose({ code: 1000, reason: 'dublê' }); };
  setTimeout(() => { self.onopen && self.onopen({}); }, 0);
};
window.__responde = (obj) => window.__ws.onmessage({ data: JSON.stringify(obj) });
return 'WebSocket dublado';
`;

const INFORMAR_CHAVE = `
document.querySelector('.bpmn-assist__toggle').click();
document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(CHAVE)};
const c = document.querySelector('#bpmn-assist-consent');
c.checked = true;
c.dispatchEvent(new Event('change'));
const btn = [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === 'Começar');
btn.click();
await new Promise((r) => setTimeout(r, 150));
return { sockets: window.__sockets, campoLimpo: document.querySelector('#bpmn-assist-key').value === '' };
`;

const ACEITAR_SETUP = `
window.__responde({ setupComplete: {} });
await new Promise((r) => setTimeout(r, 150));
return {
  status: document.querySelector('.bpmn-assist__status').textContent,
  botoes: [...document.querySelectorAll('.bpmn-assist__panel button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()),
  dica: document.querySelector('.bpmn-assist__hint').textContent,
  chaveCompacta: !document.querySelector('.bpmn-assist__compact').hidden,
};
`;

const IR_PARA_VOZ = `
[...document.querySelectorAll('.bpmn-assist__seg')].find((b) => b.textContent.trim() === 'Voz').click();
await new Promise((r) => setTimeout(r, 200));
window.__responde({ setupComplete: {} });
await new Promise((r) => setTimeout(r, 1200));
return {
  sockets: window.__sockets,
  falar: document.querySelector('.bpmn-assist__btn--talk').textContent,
  legenda: document.querySelector('.bpmn-assist__miclabel').textContent,
  micOn: window.__bpmnAssist.estado.micOn,
};
`;

const MEDIDOR = `
await new Promise((r) => setTimeout(r, 600));
const barras = [...document.querySelectorAll('.bpmn-assist__bar')].map((b) => b.style.transform);
const quadros = window.__frames.filter((f) => f.includes('"audio"')).length;
return {
  barrasMexeram: barras.some((t) => t && !t.includes('0.080')),
  amostraBarras: barras.slice(0, 4),
  quadrosDeMicEnviados: quadros,
  nivel: window.__bpmnAssist.estado.nivel,
};
`;

// Frame real de resposta do modelo: o mesmo formato medido no P1 (modelTurn com inlineData).
const MODELO_RESPONDE = `
const antes = window.__bpmnAssist.estado.micOn;
window.__responde({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAAAAAA' } }] }, outputTranscription: { text: 'Um gateway exclusivo' } } });
await new Promise((r) => setTimeout(r, 400));
return {
  micAntes: antes,
  micDepois: window.__bpmnAssist.estado.micOn,
  mandouFimDeFala: window.__frames.some((f) => f.includes('audioStreamEnd')),
  falar: document.querySelector('.bpmn-assist__btn--talk').textContent,
  legenda: document.querySelector('.bpmn-assist__miclabel').textContent,
  conversa: [...document.querySelectorAll('.bpmn-assist__msg')].map((m) => m.textContent.trim()).slice(-2),
};
`;

const DIAGNOSTICO = `
document.querySelector('.bpmn-assist__diag').open = true;
document.querySelector('.bpmn-assist__diag').dispatchEvent(new Event('toggle'));
await new Promise((r) => setTimeout(r, 120));
const texto = document.querySelector('.bpmn-assist__diagtext').textContent;
return { vazouChave: texto.includes(${JSON.stringify(CHAVE)}), trecho: texto.split('\\n').slice(0, 6) };
`;

const url = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:8124/';
const shotIdx = process.argv.indexOf('--shot');
const prefixo = shotIdx > 0 ? process.argv[shotIdx + 1] : 'artifacts/ui/voz';

const r = await dirigir({
  url,
  espera: 2500,
  passos: [DUBLAR_WS, INFORMAR_CHAVE, ACEITAR_SETUP, IR_PARA_VOZ, MEDIDOR, MODELO_RESPONDE, DIAGNOSTICO],
  shot: `${prefixo}.png`,
});

const NOMES = ['dublar ws', 'informar chave', 'aceitar setup', 'ir para voz', 'medidor', 'modelo responde', 'diagnostico'];
let falhou = false;
for (let i = 0; i < r.passos.length; i++) {
  const p = r.passos[i];
  console.log(`\n▶ ${NOMES[i] ?? i}`);
  if (p.erro) { console.log(`  ✘ ${p.erro}`); falhou = true; continue; }
  console.log(`  ${JSON.stringify(p.valor)}`);
}

if (r.excecoes.length) { falhou = true; console.log(`\n✘ excecoes: ${JSON.stringify(r.excecoes, null, 2)}`); }
const ruido = r.console.filter((c) => !/favicon/.test(c.texto));
if (ruido.length) console.log(`\n! console: ${JSON.stringify(ruido, null, 2)}`);
console.log(`\nshot: ${r.shot}`);
process.exit(falhou ? 1 : 0);
