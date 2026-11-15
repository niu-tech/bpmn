/**
 * TRILHA AO VIVO — um comando para testar de verdade e eu ver tudo.
 *
 * Abre (ou reaproveita) a janela do Edge com a porta de depuração, acha a aba do ajudante e fica
 * ACOMPANHANDO: a cada poucos segundos grava a sessão inteira em `artifacts/sessoes/atual.json`
 * e imprime, em uma linha, o que foi acontecendo — mensagem nova, erro, queda, ferramenta.
 *
 * Por que existe: testar é na mão do dono, com a chave e o microfone dele; consertar é do outro
 * lado, e precisa do diário completo. Sem isto, o meio de campo era copiar e colar um painel
 * (pedido de 2026-11-14: "crie uma forma que eu possa chamar isso pra gente começar essas
 * sessões de teste, você já abrir, eu já fazer o teste, você já conseguir ver tudo").
 *
 * Uso:
 *   npm run trilha              # abre no servidor local se ele estiver de pé, senão no publicado
 *   npm run trilha -- --publicado
 *   npm run trilha -- --uma-vez # só captura o que já existe e sai
 *   npm run trilha -- --de artifacts/sessoes/trilha-<carimbo>.json   # relê uma corrida salva
 *
 * O arquivo `atual.json` é sobrescrito a cada volta: é sempre o retrato de AGORA. O histórico
 * completo de cada corrida fica em `artifacts/sessoes/trilha-<carimbo>.json`, escrito no fim.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cdp } from './drive-page.mjs';

const PORTA = Number(process.env.BPMN_CDP_PORT ?? 9222);
const PUBLICADO = 'https://niu-tech.github.io/bpmn/';
const LOCAL = 'http://127.0.0.1:8126/index.html';
const INTERVALO_MS = 4000;
const INTERNA = /^(edge|chrome|devtools|about|view-source):/;

const umaVez = process.argv.includes('--uma-vez');
const forcarPublicado = process.argv.includes('--publicado');
/**
 * RELER uma corrida salva, sem navegador.
 *
 * Existe por dois motivos, e os dois valem mais que a economia de um clique: a narração é a parte
 * da trilha que mais muda (linha nova, resumo novo) e era a única que não dava para conferir sem
 * uma pessoa testando ao vivo; e uma corrida guardada continua legível meses depois, que é o que
 * a dissertação precisa de uma evidência.
 */
const deArquivo = (() => { const i = process.argv.indexOf('--de'); return i > 0 ? process.argv[i + 1] : null; })();

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function porta() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}/json/version`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function servidorLocal() {
  try {
    const r = await fetch(LOCAL, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

/** Abre o Edge com a porta, em perfil separado. Só quando não há ninguém escutando. */
async function abrirEdge(url) {
  const candidatos = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const edge = candidatos.find((p) => existsSync(p));
  if (!edge) throw new Error('não achei o msedge.exe');
  const filho = spawn(edge, [
    `--remote-debugging-port=${PORTA}`,
    `--user-data-dir=${join(tmpdir(), 'edge-bpmn')}`,
    '--no-first-run', '--no-default-browser-check', url,
  ], { detached: true, stdio: 'ignore' });
  filho.unref();
  for (let i = 0; i < 40 && !(await porta()); i++) await dormir(500);
}

async function abas() {
  const r = await fetch(`http://127.0.0.1:${PORTA}/json/list`);
  return (await r.json()).filter((t) => t.type === 'page' && !INTERNA.test(t.url ?? ''));
}

/** A aba do ajudante é a que TEM o ajudante — não a que tem a palavra certa na URL. */
async function acharAba() {
  for (const pagina of await abas()) {
    const c = cdp(pagina.webSocketDebuggerUrl);
    try {
      await c.pronto;
      await c.envia('Runtime.enable');
      const r = await c.envia('Runtime.evaluate', { expression: 'typeof window.__bpmnAssist', returnByValue: true });
      if (r.result?.value === 'object') return { pagina, c };
      c.fecha();
    } catch {
      try { c.fecha(); } catch { /* já fechada */ }
    }
  }
  return null;
}

async function capturar(c) {
  const r = await c.envia('Runtime.evaluate', {
    expression: '(async () => (window.__bpmnAssist?.capturar ? window.__bpmnAssist.capturar() : null))()',
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate falhou');
  return r.result?.value ?? null;
}

// ---------------------------------------------------------------- começo

const url = forcarPublicado ? PUBLICADO : (await servidorLocal() ? LOCAL : PUBLICADO);

if (!deArquivo && !(await porta())) {
  console.log(`abrindo o Edge em ${url} (perfil separado, porta ${PORTA})…`);
  await abrirEdge(url);
} else if (!deArquivo) {
  console.log(`navegador já escutando em 127.0.0.1:${PORTA}`);
}

let alvo = null;
for (let i = 0; i < 30 && !alvo && !deArquivo; i++) {
  alvo = await acharAba();
  if (!alvo) await dormir(1000);
}
if (!alvo && !deArquivo) {
  console.error('Nenhuma aba com o ajudante montado. Abra a página nessa janela e rode de novo.');
  process.exit(5);
}

if (!deArquivo) console.log(`aba: ${alvo.pagina.url}`);
if (!deArquivo) {
  console.log('');
  console.log('Pode testar à vontade. Eu vou gravando — Ctrl+C encerra.');
  console.log('retrato de agora: artifacts/sessoes/atual.json');
  console.log('');
}

mkdirSync('artifacts/sessoes', { recursive: true });
const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
let vistos = 0;
let mensagensVistas = 0;
let ultima = null;
/** portão -> instante da pergunta, para medir quanto o aluno levou para responder (6.4). */
const perguntasDoPortao = new Map();
const esperasDoPortao = [];

/** Uma linha por coisa que aconteceu: é o que dá para acompanhar sem abrir o JSON. */
function narrar(dados) {
  const msgs = dados.mensagens ?? [];
  if (msgs.length < mensagensVistas) mensagensVistas = 0;     // sessão nova: recomeça
  for (const m of msgs.slice(mensagensVistas)) {
    const quem = { user: 'aluno', assistant: 'ajudante', system: 'sistema', tool: 'ferramenta' }[m.role] ?? m.role;
    const via = m.via ? ` (${m.via})` : '';
    console.log(`  ${quem}${via}: ${String(m.text ?? '').replace(/\s+/g, ' ').slice(0, 110)}`);
  }
  mensagensVistas = msgs.length;

  const evs = dados.eventos ?? [];
  if (evs.length < vistos) vistos = 0;
  for (const e of evs.slice(vistos)) {
    // Só o que muda o rumo: estado, erro, queda, ferramenta, e o canal da PÁGINA. O resto fica no
    // JSON. ⚠ `pagina.` entrou aqui porque sem ele a nota saía, a conversa mudava de rumo por
    // causa dela, e a trilha não mostrava nada — o fato chegava ao modelo e não ao relatório.
    if (!/^(state|ws|tool|rede|pagina)\./.test(e.key)) continue;
    if (/^ws\.(audio|output-text)/.test(e.key)) continue;
    console.log(`    · ${e.key}${e.detail ? ' ' + e.detail : ''}`);

    /**
     * O RELÓGIO DO PORTÃO (change `spoken-confirmation-gates`, 6.4).
     *
     * Entre "posso apagar?" e "pode" existe uma pessoa pensando, e esse tempo é a diferença entre
     * um portão que conversa e um que atrapalha: curto demais e a confirmação some antes de ela
     * responder; longo demais e o turno fica pendurado. Sem medir, a tolerância de 3,5 s seria um
     * número escolhido no olho.
     */
    if (e.key === 'tool.sem-confirmacao') perguntasDoPortao.set(String(e.detail ?? '').split(':')[0].trim(), e.ms);
    if (e.key === 'state.portao' && /aberto pelo aluno/.test(e.detail ?? '')) {
      const nome = String(e.detail ?? '').split(':')[0].trim();
      const quando = perguntasDoPortao.get(nome);
      if (quando != null) {
        const seg = ((e.ms - quando) / 1000).toFixed(1).replace('.', ',');
        console.log(`    · portão "${nome}": o aluno respondeu em ${seg} s`);
        esperasDoPortao.push({ portao: nome, segundos: Number(((e.ms - quando) / 1000).toFixed(1)) });
        perguntasDoPortao.delete(nome);
      }
    }
  }
  vistos = evs.length;
}

async function umaVolta() {
  const dados = await capturar(alvo.c);
  if (!dados) return;
  ultima = dados;
  writeFileSync('artifacts/sessoes/atual.json', JSON.stringify(dados, null, 2), 'utf8');
  narrar(dados);
}

function encerrar() {
  if (ultima) {
    const nome = `artifacts/sessoes/trilha-${carimbo}.json`;
    writeFileSync(nome, JSON.stringify(ultima, null, 2), 'utf8');
    console.log(`\nTRILHA: ${nome}`);
    console.log(`mensagens=${ultima.mensagens?.length ?? 0} eventos=${ultima.eventos?.length ?? 0} estado=${ultima.estado?.state}`);
    // O resumo que interessa a quem for ler depois: o canal da página funcionou? o portão esperou?
    const evs = ultima.eventos ?? [];
    const conta = (k) => evs.filter((e) => e.key === k).reduce((n, e) => n + (e.n ?? 1), 0);
    const notas = { enviou: conta('pagina.enviou'), descartou: conta('pagina.descartou'), enfileirou: conta('pagina.enfileirou') };
    if (notas.enfileirou) {
      console.log(`página: ${notas.enviou} nota(s) entregue(s), ${notas.descartou} descartada(s) de ${notas.enfileirou}`);
    }
    if (esperasDoPortao.length) {
      const media = (esperasDoPortao.reduce((a, b) => a + b.segundos, 0) / esperasDoPortao.length).toFixed(1).replace('.', ',');
      console.log(`portão: ${esperasDoPortao.length} confirmação(ões), o aluno levou ${media} s em média`);
    }
  }
  /**
   * ⚠ Sair no MESMO instante em que os sockets fecham faz o libuv do Node reclamar
   * ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)") DEPOIS de a trilha ter dado certo
   * — e o dono lê isso como falha. Fecha, deixa um tique para o fechamento terminar, e aí sai.
   */
  try { alvo?.c?.fecha(); } catch { /* já fechada */ }
  setTimeout(() => process.exit(0), 120);
}

if (deArquivo) {
  if (!existsSync(deArquivo)) {
    console.error(`não achei ${deArquivo}`);
    process.exit(4);
  }
  const dados = JSON.parse(readFileSync(deArquivo, 'utf8'));
  console.log(`relendo ${deArquivo}`);
  console.log(`sessão de ${dados.quando ?? '(sem data)'} · ${dados.url ?? ''}`);
  console.log('');
  narrar(dados);
  ultima = dados;
  encerrar();
  // `encerrar` adia a saida em um tique (ver o comentario la dentro); sem esperar por ele, o
  // laco de captura rodaria sem aba e morreria com um TypeError DEPOIS de a releitura dar certo.
  await dormir(200);
  process.exit(0);
}

process.on('SIGINT', encerrar);

await umaVolta();
if (umaVez) encerrar();

for (;;) {
  await dormir(INTERVALO_MS);
  try {
    await umaVolta();
  } catch {
    // A aba recarregou ou fechou: procura de novo em vez de morrer no meio da trilha.
    console.log('  (perdi a aba — procurando de novo)');
    const achado = await acharAba();
    if (achado) { alvo = achado; vistos = 0; mensagensVistas = 0; console.log(`  aba: ${achado.pagina.url}`); }
  }
}
