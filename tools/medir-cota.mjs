/**
 * Quanto a cota do Live aguenta — medido, não chutado (change `sustain-a-class-session`, 3.1/3.2).
 *
 * Por que existe: "a cota acabou ou há sessões demais" é a frase que mais trava a aula, e até aqui
 * ela era um palpite — a dívida T16/M7 dizia, com todas as letras, que não sabíamos se o limite é
 * por minuto, por concorrência ou por dia. Sem o número, a tela não pode dizer "volte em X
 * segundos", e um teste que abre duas sessões seguidas reprova por cadência de teste, que é a
 * pior espécie de vermelho.
 *
 * O que ele faz: abre sessões de VERDADE contra a chave do dono (a do `.env`, nunca impressa),
 * com o MESMO `setup` do produto, e registra o que aconteceu com cada uma — aceita, recusada,
 * código de fechamento, e quanto tempo levou. Três experimentos, nessa ordem:
 *
 *   1. SEQUENCIAL sem pausa  — fecha e abre na mesma hora. É o que a troca de modo faz.
 *   2. SEQUENCIAL com pausa  — procura o menor intervalo que o servidor aceita.
 *   3. CONCORRENTE           — N sockets abertos ao mesmo tempo, para separar "por minuto" de
 *                              "quantas ao mesmo tempo".
 *
 * ⚠ Gasta cota de propósito: é essa a medição. Rode uma vez e leia o arquivo.
 *
 * Uso:
 *   node tools/medir-cota.mjs                 # os três experimentos
 *   node tools/medir-cota.mjs --so pausa      # só o segundo
 *
 * ponytail: `WebSocket` global do Node 22+, nenhuma dependência. O relatório é um JSON e uma
 * tabela no terminal.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { buildSetup, socketUrl } from '../src/assistant/live/protocol.js';

/** A chave do dono, do `.env` que o git ignora. Nunca impressa, nunca em argumento. */
function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$/.exec(linha);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  return null;
}

const CHAVE = chaveDoEnv();
if (!CHAVE) {
  console.error('sem .env com GEMINI_API_KEY: não há o que medir');
  process.exit(2);
}

/** O MESMO setup do produto: sonda com aperto de mão diferente não mede o aperto de mão real. */
const SETUP = buildSetup({ systemInstruction: 'Voce e o ajudante de BPMN deste site.' });

/**
 * Abre UMA sessão e diz o que aconteceu. Fecha assim que o servidor aceita (ou recusa).
 *
 * `manterMs` > 0 mantém o socket aberto, que é como se mede concorrência.
 */
function umaSessao({ rotulo, manterMs = 0, tetoMs = 20000 } = {}) {
  const inicio = Date.now();
  return new Promise((resolve) => {
    let decidido = false;
    let ws;
    const acabar = (r) => {
      if (decidido) return;
      decidido = true;
      clearTimeout(relogio);
      if (!manterMs) { try { ws?.close(1000, 'fim da medicao'); } catch { /* já fechado */ } }
      resolve({ rotulo, ms: Date.now() - inicio, ...r });
    };
    const relogio = setTimeout(() => acabar({ ok: false, erro: 'sem resposta no prazo' }), tetoMs);

    try {
      ws = new WebSocket(socketUrl(CHAVE));
    } catch (err) {
      acabar({ ok: false, erro: `socket nao abriu: ${err?.message ?? err}` });
      return;
    }

    ws.addEventListener('open', () => ws.send(JSON.stringify(SETUP)));
    ws.addEventListener('message', async (e) => {
      // ⚠ No Node o quadro chega como Blob, e no navegador como string. Ler so' a string fazia
      // TODA sessao parecer "sem resposta no prazo" — instrumento calado passando por servidor
      // mudo, que e' o modo de falha que esta medicao existe para acabar.
      let texto;
      try { texto = typeof e.data === 'string' ? e.data : await e.data.text(); } catch { return; }
      let frame;
      try { frame = JSON.parse(texto); } catch { return; }
      if (frame?.setupComplete) {
        if (manterMs) setTimeout(() => { try { ws.close(1000, 'fim da medicao'); } catch { /* já fechado */ } }, manterMs);
        acabar({ ok: true, aceita: true });
      }
    });
    ws.addEventListener('close', (e) => acabar({
      ok: false,
      aceita: false,
      codigo: e.code,
      // 1011 com "exhausted" é a recusa por cota; 1007 é setup inválido; 1008 é chave.
      motivo: String(e.reason ?? '').slice(0, 120),
      cota: e.code === 1011 || /exhaust|quota|resource/i.test(String(e.reason ?? '')),
    }));
    ws.addEventListener('error', () => acabar({ ok: false, erro: 'erro de socket' }));
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const so = (() => { const i = process.argv.indexOf('--so'); return i > 0 ? process.argv[i + 1] : null; })();
const rodar = (nome) => !so || so === nome;

const resultado = { quando: new Date().toISOString(), modelo: SETUP?.setup?.model ?? null, experimentos: {} };

/**
 * 1. SEQUENCIAL SEM PAUSA — fecha e abre na mesma hora.
 *
 * É literalmente o que `switchMode` faz: o aluno clica no microfone, a sessão de texto fecha e a
 * de voz abre no mesmo instante. Se o servidor recusar aqui, o defeito não é do teste.
 */
if (rodar('sequencial')) {
  console.log('\n▶ 1. sessões em sequência, SEM pausa entre fechar e abrir');
  const linhas = [];
  for (let i = 1; i <= 6; i++) {
    const r = await umaSessao({ rotulo: `seq-${i}` });
    linhas.push(r);
    console.log(`  ${r.aceita ? 'aceita ' : 'RECUSADA'} #${i} em ${r.ms} ms${r.codigo ? ` (código ${r.codigo}${r.cota ? ', cota' : ''})` : ''}`);
    if (!r.aceita) break;
  }
  resultado.experimentos.sequencial = {
    aceitas: linhas.filter((l) => l.aceita).length,
    de: linhas.length,
    primeiraRecusa: linhas.findIndex((l) => !l.aceita) + 1 || null,
    linhas,
  };
}

/**
 * 2. COM PAUSA — qual é o menor intervalo que passa?
 *
 * É este número que a tela precisa dizer ("volte em X segundos") e que a troca de modo precisa
 * respeitar. Sobe até achar o primeiro que o servidor aceita duas vezes seguidas.
 */
if (rodar('pausa')) {
  console.log('\n▶ 2. qual pausa o servidor aceita entre uma sessão e a seguinte');
  const tentativas = [];
  for (const pausa of [0, 2, 5, 10, 20, 30]) {
    // Duas seguidas: uma sozinha pode passar por sorte de janela.
    const a = await umaSessao({ rotulo: `pausa-${pausa}-a` });
    await dormir(pausa * 1000);
    const b = await umaSessao({ rotulo: `pausa-${pausa}-b` });
    const ok = a.aceita && b.aceita;
    tentativas.push({ pausaSegundos: pausa, ok, a: a.aceita, b: b.aceita, codigo: b.codigo ?? a.codigo ?? null });
    console.log(`  pausa de ${String(pausa).padStart(2)}s: ${ok ? 'as duas passaram' : 'recusou'}`);
    if (ok) break;
    // Descanso entre tentativas: medir cadência com a cota já estourada mede o estouro.
    await dormir(20000);
  }
  resultado.experimentos.pausa = {
    menorPausaQuePassou: tentativas.find((t) => t.ok)?.pausaSegundos ?? null,
    tentativas,
  };
}

/**
 * 3. CONCORRÊNCIA — N sockets ABERTOS ao mesmo tempo.
 *
 * Separa "por minuto" de "quantas ao mesmo tempo": se três simultâneas passam e três em sequência
 * não, o limite é de cadência; se o contrário, é de concorrência. A frase da tela muda com isso.
 */
if (rodar('concorrencia')) {
  console.log('\n▶ 3. sessões ABERTAS ao mesmo tempo');
  await dormir(20000);
  const juntas = await Promise.all([1, 2, 3, 4].map((n) => umaSessao({ rotulo: `par-${n}`, manterMs: 8000 })));
  for (const r of juntas) {
    console.log(`  ${r.aceita ? 'aceita ' : 'RECUSADA'} ${r.rotulo} em ${r.ms} ms${r.codigo ? ` (código ${r.codigo})` : ''}`);
  }
  resultado.experimentos.concorrencia = {
    aceitas: juntas.filter((r) => r.aceita).length,
    de: juntas.length,
    linhas: juntas,
  };
}

mkdirSync('artifacts/cota', { recursive: true });
const arquivo = `artifacts/cota/medicao-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(arquivo, JSON.stringify(resultado, null, 2));
writeFileSync('artifacts/cota/ultima.json', JSON.stringify(resultado, null, 2));

console.log('\n========================================');
console.log(`medição da cota: ${arquivo}`);
const seq = resultado.experimentos.sequencial;
const pausa = resultado.experimentos.pausa;
const conc = resultado.experimentos.concorrencia;
if (seq) console.log(`sequência sem pausa: ${seq.aceitas} de ${seq.de} aceitas`);
if (pausa) console.log(`menor pausa que passou: ${pausa.menorPausaQuePassou ?? 'nenhuma das testadas'}s`);
if (conc) console.log(`ao mesmo tempo: ${conc.aceitas} de ${conc.de} aceitas`);
console.log('========================================');
