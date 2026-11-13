/**
 * Prova o barge-in AO VIVO sem depender de calibração de fixture.
 *
 * O cenário antigo media a calibração, não o recurso: a frase de corte vinha depois de 16 s de
 * silêncio colados na frente do WAV, calibrados em 2026-11-12 quando o modelo começava a falar aos
 * ~15 s. Em 2026-11-13 ele começou aos **12,3 s** e o corte caiu depois de a resposta ter acabado —
 * `interrupcoes: 0` com o produto intacto.
 *
 * O desenho novo tira o relógio da conta, juntando duas peças colhidas no mesmo dia:
 *
 *   1. a pergunta é **injetada** (H11) com o microfone FECHADO — nada de fixture longa;
 *   2. assim que o modelo começa a falar, o microfone é **aberto** (H4), e a fixture de corte toca
 *      desde o primeiro quadro. Silêncio na frente deixa de ser necessário.
 *
 * O que se afirma: `state.barge-in-local` na linha do tempo = o corte foi decidido AQUI, sem
 * esperar o servidor. `ws.interrupted` junto = o servidor também viu. Os dois somam; nenhum
 * substitui o outro.
 *
 * Uso: node tools/provar-barge-in.mjs [--pergunta artifacts/voz/gateway.wav] [--corte artifacts/voz/interrompe.wav]
 */
import { existsSync, readFileSync } from 'node:fs';

import { dirigir } from './drive-page.mjs';
import { quadrosDoWav, quadrosMudos } from './injetar-fala.mjs';

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
if (!chave) { console.error('sem .env com GEMINI_API_KEY: a prova precisa do servidor de verdade'); process.exit(2); }

const PERGUNTA = arg('pergunta', 'artifacts/voz/gateway.wav');
const CORTE = arg('corte', 'artifacts/voz/interrompe.wav');
const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';
for (const w of [PERGUNTA, CORTE]) if (!existsSync(w)) { console.error(`sem fixture: ${w}`); process.exit(2); }

// A pergunta vai com cauda muda: e o silencio que faz o VAD do servidor fechar o turno.
const quadrosDaPergunta = [...quadrosDoWav(PERGUNTA), ...quadrosMudos(3)];
console.log(`pergunta injetada: ${PERGUNTA} (${quadrosDaPergunta.length} quadros) | corte pelo microfone: ${CORTE}`);

const r = await dirigir({
  url: ALVO,
  mic: CORTE,                       // o microfone falso toca a FRASE DE CORTE, do primeiro quadro
  espera: 3000,
  headless: !process.argv.includes('--ver'),
  passos: [
    `window.__btn = (t) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === t);
     document.querySelector('.bpmn-assist__toggle').click();
     document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(chave)};
     const c = document.querySelector('#bpmn-assist-consent'); c.checked = true; c.dispatchEvent(new Event('change'));
     window.__btn('Voz').click();
     window.__btn('Começar').click();
     for (let i = 0; i < 60 && document.querySelector('.bpmn-assist__status').textContent !== 'pronto'; i++) {
       await new Promise((r) => setTimeout(r, 500));
     }
     // Microfone FECHADO durante a pergunta: senao a fixture de corte comeca a tocar agora e o
     // corte chega antes de haver o que cortar - que e exatamente o defeito do cenario antigo.
     for (let i = 0; i < 20 && window.__bpmnAssist.estado.micOn; i++) {
       await window.__bpmnAssist.pararMicrofone();
       await new Promise((r) => setTimeout(r, 250));
     }
     return { status: document.querySelector('.bpmn-assist__status').textContent, micOn: window.__bpmnAssist.estado.micOn };`,

    `if (window.__bpmnAssist.estado.micOn) return { ok: false, culpa: '[HARNESS] microfone aberto antes da hora' };
     window.__quadros = ${JSON.stringify(quadrosDaPergunta)};
     // 1) pergunta injetada, sem microfone
     window.__bpmnAssist.injetarFala(window.__quadros);
     // 2) espera o modelo COMECAR a falar - e so entao abre o microfone
     let abriuEm = null;
     const t0 = performance.now();
     for (let i = 0; i < 160; i++) {
       await new Promise((r) => setTimeout(r, 250));
       if ((window.__bpmnAssist.contagem['ws.audio'] ?? 0) > 2) {
         abriuEm = Number(((performance.now() - t0) / 1000).toFixed(1));
         await window.__bpmnAssist.abrirMicrofone();
         break;
       }
     }
     if (abriuEm === null) return { ok: false, culpa: '[SERVICO] o modelo nunca comecou a falar' };
     // 3) a fixture de corte toca desde o primeiro quadro; espera o corte acontecer
     for (let i = 0; i < 60; i++) {
       await new Promise((r) => setTimeout(r, 250));
       const ev = window.__bpmnAssist.eventos;
       if (ev.some((e) => e.key === 'state.barge-in-local') || (window.__bpmnAssist.contagem['ws.interrupted'] ?? 0) > 0) break;
     }
     const ev = window.__bpmnAssist.eventos;
     const c = window.__bpmnAssist.contagem;
     const local = ev.find((e) => e.key === 'state.barge-in-local');
     return {
       ok: Boolean(local),
       cortouAqui: Boolean(local),
       detalheDoCorte: local?.detail ?? null,
       servidorTambemViu: (c['ws.interrupted'] ?? 0) > 0,
       modeloComecouAFalarEm: abriuEm + 's',
       quadrosDeAudioDoModelo: c['ws.audio'] ?? 0,
       naTela: [...document.querySelectorAll('.bpmn-assist__msg')].map((m) => m.textContent.trim().slice(0, 90)),
       linhaDoTempo: ev.map((e) => e.key + (e.n > 1 ? ' x' + e.n : '')),
     };`,
  ],
});

for (const passo of r.passos) {
  if (passo.erro) { console.error(`FALHOU: ${passo.erro}`); process.exitCode = 1; }
  else console.log(JSON.stringify(passo.valor, null, 1));
}
