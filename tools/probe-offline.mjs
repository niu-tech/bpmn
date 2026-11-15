/**
 * Sonda: o `offline` do CDP mata mesmo um WebSocket JÁ ABERTO?
 *
 * Existe porque a resposta decide a FORMA do portão M4. Se o socket cai, o portão é curto (corta,
 * espera voltar, pergunta). Se o socket sobrevive e só os quadros se perdem, a queda só é
 * detectada pelo relógio de silêncio (45 s) — e o portão tem de ser escrito para isso, sob pena
 * de "provar" uma reconexão que nunca aconteceu.
 *
 * Roda com a chave do `.env` e uma sessão de texto. Uso: node tools/probe-offline.mjs
 */
import { readFileSync } from 'node:fs';
import { dirigir } from './drive-page.mjs';

const chave = (readFileSync('.env', 'utf8').match(/GEMINI_API_KEY\s*=\s*(\S+)/) ?? [])[1];
if (!chave) { console.error('sem chave no .env'); process.exit(2); }

const r = await dirigir({
  url: 'http://127.0.0.1:8126/#exemplo',
  espera: 3000,
  passos: [
    `window.__btn = (txt) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === txt);
     document.querySelector('.bpmn-assist__toggle').click();
     document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(chave)};
     const c = document.querySelector('#bpmn-assist-consent');
     c.checked = true; c.dispatchEvent(new Event('change'));
     window.__btn('Começar').click();
     for (let i = 0; i < 40 && document.querySelector('.bpmn-assist__status').textContent !== 'pronto'; i++) {
       await new Promise((r) => setTimeout(r, 500));
     }
     return { ok: document.querySelector('.bpmn-assist__status').textContent === 'pronto', onLine: navigator.onLine };`,
    'cdp:Network.enable {}',
    'cdp:Network.emulateNetworkConditions {"offline":true,"latency":0,"downloadThroughput":0,"uploadThroughput":0}',
    `const marcos = [];
     for (let i = 0; i < 24; i++) {
       await new Promise((r) => setTimeout(r, 500));
       marcos.push([i * 500, navigator.onLine, window.__bpmnAssist.estado.estado, window.__bpmnAssist.contagem['ws.close'] ?? 0].join(' '));
       if ((window.__bpmnAssist.contagem['ws.close'] ?? 0) > 0) break;
     }
     return { ok: true, fechou: (window.__bpmnAssist.contagem['ws.close'] ?? 0) > 0, ultimos: marcos.slice(-4) };`,
    'cdp:Network.emulateNetworkConditions {"offline":false,"latency":0,"downloadThroughput":-1,"uploadThroughput":-1}',
    `try { window.__bpmnAssist.encerrar?.(); } catch {}
     return { ok: true };`,
  ],
  headless: true,
});
for (const p of r.passos) console.log(JSON.stringify(p.valor ?? p.erro));
