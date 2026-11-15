/**
 * Mede o que custa BAIXAR o acervo na rede pública — a tarefa 5.3 da change do acervo.
 *
 * A tarefa existe porque o acervo é um arquivo que o aluno busca sob demanda: quem nunca pergunta
 * sobre a notação não baixa nada, e quem pergunta paga esse tempo UMA vez na aula. Medir no
 * `localhost` seria inventar o número que a tarefa pede exatamente para não inventar — por isso
 * ela ficou aberta até o site voltar a ser publicado (o `pages` estava vermelho desde o acervo,
 * consertado em `54ca734`).
 *
 * ⚠ DUAS MEDIDAS, e confundi-las é o jeito fácil de mentir aqui:
 *
 *   • MESMA CONEXÃO — é o caso REAL do aluno. Quando ele faz a primeira pergunta sobre a notação,
 *     o navegador já abriu o site: TCP e TLS estão pagos, e o acervo desce por aquela conexão.
 *   • CONEXÃO NOVA — TCP + TLS do zero. É o pior caso (rede ruim, conexão expirada) e o teto.
 *
 * A primeira versão deste arquivo mediu `304 · 15 · 15 · 13 · 13 · 14 · 10 ms` e ia chamar isso
 * de "mediana 14 ms": o `fetch` do Node reaproveita a conexão, então as amostras em sequência
 * mediam o segundo acesso e a única amostra honesta do custo de abrir conexão era a primeira.
 * Separar as duas é o que torna o número utilizável no texto do TCC.
 *
 * Uso: node tools/medir-acervo.mjs [url-do-site] [amostras]
 *   node tools/medir-acervo.mjs                        # site publicado, 5 de cada
 *   node tools/medir-acervo.mjs http://127.0.0.1:8126/ 3
 */
import http from 'node:http';
import https from 'node:https';

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'https://niu-tech.github.io/bpmn/';
const AMOSTRAS = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5);
const ALVO = new URL('knowledge/index.json', BASE);
const cliente = ALVO.protocol === 'https:' ? https : http;

/**
 * Uma amostra. `agent` decide a medida: `false` abre socket novo (conexão nova), um agente com
 * `keepAlive` reaproveita o socket das amostras anteriores (mesma conexão).
 */
function baixar(agent) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const req = cliente.get(ALVO, {
      agent,
      headers: { 'Cache-Control': 'no-cache', 'Accept-Encoding': 'gzip' },
    }, (res) => {
      const pedacos = [];
      res.on('data', (c) => pedacos.push(c));
      res.on('end', () => {
        const ms = Math.round(performance.now() - t0);
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        resolve({
          ms,
          // Com `Accept-Encoding: gzip` e sem descompactar, isto é o que de fato viajou.
          bytes: Buffer.concat(pedacos).length,
          codificacao: res.headers['content-encoding'] ?? 'nenhuma',
          bruto: res.headers['content-encoding'] ? null : Buffer.concat(pedacos).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('15 s sem resposta')));
  });
}

const mediana = (ns) => {
  const o = [...ns].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- conexão nova a cada amostra
const novas = [];
let cabecalho = null;
for (let i = 0; i < AMOSTRAS; i++) {
  const r = await baixar(false);
  novas.push(r.ms);
  cabecalho = cabecalho ?? r;
  await espera(300);           // rajada mede a borda, não o aluno
}

// ---------------------------------------------------------------- a mesma conexão, como no site
const agente = new cliente.Agent({ keepAlive: true, maxSockets: 1 });
await baixar(agente);          // esta é a que paga o TCP/TLS, como a página do aluno paga
const mesmas = [];
for (let i = 0; i < AMOSTRAS; i++) {
  mesmas.push((await baixar(agente)).ms);
  await espera(150);
}
agente.destroy();

// O tamanho do conteúdo, para o texto do TCC: quantos verbetes vieram nesses bytes.
let verbetes = null;
try {
  const r = await fetch(ALVO.href, { headers: { 'Cache-Control': 'no-cache' } });
  const d = await r.json();
  verbetes = d.verbetes?.length ?? d.paginas?.length ?? null;
} catch { /* o número do conteúdo é enfeite: a medida é o tempo */ }

console.log(`acervo:    ${ALVO.href}`);
console.log(`tamanho:   ${cabecalho.bytes} bytes na rede (codificação: ${cabecalho.codificacao})`);
if (verbetes !== null) console.log(`conteúdo:  ${verbetes} verbetes`);
console.log(`conexão nova:  ${novas.join(' · ')} ms   (TCP + TLS do zero — o teto)`);
console.log(`mesma conexão: ${mesmas.join(' · ')} ms   (o caso real: o site já está aberto)`);
console.log(`RESULTADO: ${mediana(mesmas)} ms no caso real · ${mediana(novas)} ms abrindo conexão`
  + ` (${AMOSTRAS} amostras de cada)`);
