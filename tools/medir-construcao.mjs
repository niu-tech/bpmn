/**
 * MEDE uma construção: quanto é nosso, e quanto é a volta ao modelo.
 *
 * Existe por uma frase do dono (2026-11-17), depois de testar em produção: *"ele demorou, ficou
 * demorando cada bloco cerca de 5 segundos, sei lá, 3 segundos, 4 segundos, e isso é ruim porque
 * o usuário está vendo e não sabe que está acontecendo alguma coisa"*.
 *
 * A change `show-the-work-while-the-agent-builds` responde à segunda metade (a tela passou a
 * contar o que está sendo desenhado). Esta ferramenta responde à PRIMEIRA: de onde vem a espera.
 * E a resposta decide o que é honesto prometer — se o tempo é da volta ao modelo, nenhuma
 * mudança nossa deixa de ser 3 s por bloco, e dizer o contrário seria vender o que não temos.
 *
 * O MESMO pedido corre contra os dois endereços:
 *   - `http://127.0.0.1:8126/` — o dev server, onde nós iteramos
 *   - `https://niu-tech.github.io/bpmn/` — o site publicado, que é o que o dono usou
 *
 * Por chamada de ferramenta, dois números, que só existem porque o despachante emite
 * `tool.executando` e `tool.concluida`:
 *   - NOSSO    = executando → concluida  (a escrita no bpmn-js, síncrona)
 *   - ESPERA   = concluida → executando seguinte  (a volta ao modelo)
 *
 * ⚠ Gasta DUAS sessões Live da chave do dono (uma por endereço), com descanso entre elas. A
 * chave sai do `.env` git-ignored e nunca é impressa.
 *
 * Uso:
 *   node tools/medir-construcao.mjs
 *   node tools/medir-construcao.mjs --so-local
 *   node tools/medir-construcao.mjs --pedido "Monte um processo de ..."
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirigir } from './drive-page.mjs';

const LOCAL = 'http://127.0.0.1:8126/';
const PUBLICADO = 'https://niu-tech.github.io/bpmn/';

/** A chave do dono, do `.env` que o git ignora. Nunca impressa, nem no erro. */
function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  const m = /^GEMINI_API_KEY\s*=\s*(.+)$/m.exec(readFileSync('.env', 'utf8'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

const argv = process.argv.slice(2);
const soLocal = argv.includes('--so-local');
const soPublicado = argv.includes('--so-publicado');
const pedido = (() => {
  const i = argv.indexOf('--pedido');
  return i > 0 ? argv[i + 1] : 'Monte, num pool novo chamado Compras, um processo de compra com seis passos em sequencia: o pedido chega, o comprador confere o estoque, cota com tres fornecedores, escolhe o fornecedor, emite a ordem de compra e recebe o material; no fim o processo termina.';
})();

const chave = chaveDoEnv();
if (!chave) {
  console.error('sem .env com GEMINI_API_KEY: esta medicao precisa de sessao viva.');
  process.exit(2);
}

const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Number((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2).toFixed(2));
};

async function medir(url) {
  const r = await dirigir({
    url,
    espera: 5000,
    shot: `artifacts/medicao/${url.includes('127.0.0.1') ? 'local' : 'publicado'}.png`,
    passos: [
      `window.__btn = (txt) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === txt);
       document.querySelector('.bpmn-assist__toggle').click();
       document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(chave)};
       const c = document.querySelector('#bpmn-assist-consent');
       c.checked = true; c.dispatchEvent(new Event('change'));
       for (let i = 0; i < 40 && !window.__btn('Começar'); i++) await new Promise((r) => setTimeout(r, 250));
       window.__btn('Começar').click();
       for (let i = 0; i < 40 && document.querySelector('.bpmn-assist__status').textContent !== 'pronto'; i++) {
         await new Promise((r) => setTimeout(r, 500));
       }
       window.__nos = () => window.__bpmnAssist.desenho.nos.length;
       window.__antes = window.__nos();
       return { ok: document.querySelector('.bpmn-assist__status').textContent === 'pronto', formasAntes: window.__antes };`,

      `// Dispara e espera a resposta inteira: o que interessa e a linha do tempo das chamadas.
       const t0 = performance.now();
       const ta = document.querySelector('.bpmn-assist__composer textarea');
       ta.value = ${JSON.stringify(pedido)};
       window.__btn('Enviar').click();
       // Fim do turno: nenhuma ferramenta nova por 6 s seguidos depois da primeira.
       let ultima = 0;
       for (let i = 0; i < 300; i++) {
         await new Promise((r) => setTimeout(r, 400));
         const ev = window.__bpmnAssist.eventos.filter((e) => e.key === 'tool.executando');
         if (ev.length) {
           const fim = ev.at(-1).ms;
           if (fim === ultima && performance.now() - t0 - fim > 6000) break;
           ultima = fim;
         } else if (i > 60) break;
       }
       const ev = window.__bpmnAssist.eventos
         .filter((e) => e.key === 'tool.executando' || e.key === 'tool.concluida')
         .map((e) => ({ key: e.key, nome: e.detail ?? null, ms: e.ms }));
       return {
         ok: ev.length > 0,
         formasAntes: window.__antes,
         formasDepois: window.__nos(),
         eventos: ev,
         // O relogio que o ALUNO sente: do envio ao ultimo elemento entrar.
         doEnvioAoFimMs: ev.length ? Math.round(ev.at(-1).ms - ev[0].ms) : null,
       };`,
    ],
  });

  const passo = r.passos.at(-1)?.valor ?? {};
  const ev = passo.eventos ?? [];
  const nossos = [];
  const esperas = [];
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].key === 'tool.executando') {
      const fim = ev.slice(i + 1).find((e) => e.key === 'tool.concluida');
      if (fim) nossos.push((fim.ms - ev[i].ms) / 1000);
    }
    if (ev[i].key === 'tool.concluida') {
      const prox = ev.slice(i + 1).find((e) => e.key === 'tool.executando');
      if (prox) esperas.push((prox.ms - ev[i].ms) / 1000);
    }
  }
  return {
    url,
    erro: r.passos.find((p) => p.erro)?.erro ?? r.excecoes[0] ?? null,
    chamadas: nossos.length,
    formas: `${passo.formasAntes ?? '?'} -> ${passo.formasDepois ?? '?'}`,
    segundosDoAlunoEsperando: passo.doEnvioAoFimMs ? Number((passo.doEnvioAoFimMs / 1000).toFixed(1)) : null,
    nosso: { mediana: mediana(nossos), pior: nossos.length ? Number(Math.max(...nossos).toFixed(2)) : null },
    esperaPeloModelo: { mediana: mediana(esperas), pior: esperas.length ? Number(Math.max(...esperas).toFixed(2)) : null },
    // A conta que decide o que prometer: nossa fatia do total.
    nossaFatia: nossos.length && esperas.length
      ? `${Math.round(100 * nossos.reduce((a, b) => a + b, 0) / (nossos.reduce((a, b) => a + b, 0) + esperas.reduce((a, b) => a + b, 0)))}%`
      : null,
  };
}

mkdirSync('artifacts/medicao', { recursive: true });
const saida = [];
for (const url of [soPublicado ? null : LOCAL, soLocal ? null : PUBLICADO].filter(Boolean)) {
  if (saida.length) {
    // Duas sessoes Live seguidas na mesma chave: o servidor cobra o ritmo (ver battery.mjs).
    console.log('(descansando 25s antes da proxima sessao ao vivo)');
    await new Promise((r) => setTimeout(r, 25000));
  }
  console.log(`medindo ${url} ...`);
  const r = await medir(url);
  saida.push(r);
  console.log(JSON.stringify(r, null, 1));
}

writeFileSync('artifacts/medicao/construcao.json', JSON.stringify({ quando: new Date().toISOString(), pedido, medicoes: saida }, null, 2));
console.log('\nprova em artifacts/medicao/construcao.json');
/**
 * ⚠ Como LER o resultado, para não prometer o que não é nosso: se `nossaFatia` for uma fração
 * pequena, a espera que o aluno sente é a volta ao modelo, e nenhuma mudança nossa a encurta —
 * o que a change entrega é a espera LEGÍVEL. Dizer isso no registro, nunca na tela: o aluno não
 * precisa de uma aula sobre a arquitetura do Gemini.
 */
