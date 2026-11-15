/**
 * UMA AULA INTEIRA, sem cota e sem ninguém digitando (change `sustain-a-class-session`, 6.2).
 *
 * Por que existe: a pergunta "a conversa aguenta uma aula?" não se responde com um turno. O teto
 * de contexto, a memória da aba, o histórico que viaja e o custo acumulado só aparecem depois de
 * algumas dezenas de trocas — e esperar que alguém converse vinte minutos para medir isso é como
 * não medir. Aqui a conversa é longa de verdade (25 turnos) e o socket é o dublê: os frames são
 * cópias do que o servidor manda, com `usageMetadata` em cada turno, então os tempos e o custo
 * saem do mesmo caminho que eles seguem ao vivo.
 *
 * O que NÃO é: uma prova de que o modelo responde bem. Aqui o modelo é um dublê — o que se prova
 * é o PRODUTO aguentando a aula: uma sessão só, nada reaberto, o diagrama ainda no contexto no
 * fim, e os números por turno guardados.
 *
 * Uso:
 *   node tools/aula-simulada.mjs                 # 25 turnos
 *   node tools/aula-simulada.mjs --turnos 40
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { dirigir } from './drive-page.mjs';

const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';
const TURNOS = (() => { const i = process.argv.indexOf('--turnos'); return i > 0 ? Number(process.argv[i + 1]) : 25; })();

/**
 * As perguntas de uma aula de BPMN, nas palavras de um aluno. Repetem em ciclo quando o número de
 * turnos passa da lista — o que se mede aqui é a DURAÇÃO, não a variedade.
 */
const PERGUNTAS = [
  'o que é um gateway exclusivo?',
  'e o paralelo, qual a diferença?',
  'quando eu uso um evento de temporizador?',
  'pool e lane são a mesma coisa?',
  'quantas tarefas tem este diagrama?',
  'o que o fluxo de mensagem liga?',
  'posso ter dois eventos de início?',
  'como eu mostro que uma tarefa é automática?',
  'o que é um subprocesso?',
  'para que serve o evento de fim de erro?',
  'esse diagrama está correto?',
  'o que eu deveria melhorar nele?',
];

const PREPARAR = `
window.__frames = [];
window.WebSocket = function (url) {
  const self = this;
  window.__ws = this;
  this.url = url; this.readyState = 1;
  this.send = (d) => { window.__frames.push(String(d)); };
  this.close = () => { self.readyState = 3; self.onclose && self.onclose({ code: 1000, reason: 'duble' }); };
  setTimeout(() => { self.onopen && self.onopen({}); }, 0);
};
window.__responde = (o) => window.__ws.onmessage({ data: JSON.stringify(o) });
window.__btn = (t) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === t);
for (let i = 0; i < 40 && !document.querySelector('.bpmn-assist__toggle'); i++) await new Promise((r) => setTimeout(r, 250));
document.querySelector('.bpmn-assist__toggle').click();
document.querySelector('#bpmn-assist-key').value = 'AQ.CHAVE-SINTETICA-DA-AULA-NAO-E-DE-NINGUEM-01234';
const c = document.querySelector('#bpmn-assist-consent');
c.checked = true; c.dispatchEvent(new Event('change'));
for (let i = 0; i < 40 && !window.__btn('Começar'); i++) await new Promise((r) => setTimeout(r, 250));
window.__btn('Começar').click();
await new Promise((r) => setTimeout(r, 200));
window.__responde({ setupComplete: {} });
await new Promise((r) => setTimeout(r, 300));
return { ok: document.querySelector('.bpmn-assist__status').textContent === 'pronto' };
`;

/**
 * Um turno completo, como o servidor o entrega no modo texto: a chamada de entrega com a
 * resposta, o `usageMetadata` e o `turnComplete`. Os atrasos entre eles são de verdade — é deles
 * que saem os tempos medidos.
 */
const AULA = `
const perguntas = ${JSON.stringify(PERGUNTAS)};
const sockets = () => window.__frames.filter((f) => f.includes('"setup"')).length;
const socketsAntes = sockets();
let tokens = 0;
for (let i = 0; i < ${TURNOS}; i++) {
  const p = perguntas[i % perguntas.length];
  const ta = document.querySelector('.bpmn-assist__composer textarea');
  ta.value = p;
  window.__btn('Enviar').click();
  // O servidor leva um tempo para responder; aqui ele é curto de propósito (a prova é de
  // duração da CONVERSA, não de paciência de quem roda).
  await new Promise((r) => setTimeout(r, 120));
  window.__responde({ toolCall: { functionCalls: [{ id: 'e' + i, name: 'entregar_resposta', args: { texto: 'Resposta ' + (i + 1) + ' sobre ' + p } }] } });
  await new Promise((r) => setTimeout(r, 60));
  const entrada = 800 + i * 20;        // o contexto cresce com a conversa
  const saida = 120;
  tokens += entrada + saida;
  window.__responde({ usageMetadata: { promptTokenCount: entrada, responseTokenCount: saida, totalTokenCount: entrada + saida } });
  window.__responde({ serverContent: { turnComplete: true } });
  await new Promise((r) => setTimeout(r, 40));
}
const captura = window.__bpmnAssist.capturar();
return {
  ok: sockets() === socketsAntes && captura.turnos.length >= ${TURNOS} - 1,
  // Uma sessão só: nada reabriu no meio da aula.
  sessoesAbertas: sockets(),
  turnosMedidos: captura.turnos.length,
  usoAcumulado: captura.usoAcumulado,
  diagramaNoFim: Boolean(captura.contexto?.diagrama),
  estadoNoFim: captura.estado,
  captura,
};
`;

const r = await dirigir({ url: ALVO, espera: 2600, headless: true, passos: [PREPARAR, AULA] });
const valor = r.passos.at(-1)?.valor;

if (!valor?.captura) {
  console.error('a aula não terminou:', JSON.stringify(r.passos.at(-1) ?? {}).slice(0, 400));
  process.exit(1);
}

mkdirSync('artifacts/sessoes', { recursive: true });
const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
const destino = `artifacts/sessoes/aula-simulada-${carimbo}.json`;
writeFileSync(destino, JSON.stringify(valor.captura, null, 2), 'utf8');

const tempos = valor.captura.turnos.filter((t) => t.tempos?.totalMs != null).map((t) => t.tempos.totalMs);
const mediana = tempos.sort((a, b) => a - b)[Math.floor(tempos.length / 2)] ?? null;

console.log(`\naula simulada: ${valor.turnosMedidos} turnos`);
console.log(`  sessões abertas: ${valor.sessoesAbertas} (uma só = nada reabriu no meio)`);
console.log(`  diagrama no contexto no fim: ${valor.diagramaNoFim ? 'sim' : 'NÃO'}`);
console.log(`  custo acumulado: ${valor.usoAcumulado?.total ?? '?'} tokens em ${valor.usoAcumulado?.turnos ?? '?'} turnos`);
console.log(`  turno (mediana): ${mediana == null ? '-' : (mediana / 1000).toFixed(1).replace('.', ',') + ' s'}`);
console.log(`  prova: ${destino}`);
console.log(`  releia com: node tools/trilha.mjs --de ${destino}`);

const ok = valor.ok && valor.diagramaNoFim && (valor.usoAcumulado?.turnos ?? 0) >= TURNOS - 1;
console.log(`\n${ok ? 'OK' : 'ATENÇÃO'}`);
process.exit(ok ? 0 : 1);
