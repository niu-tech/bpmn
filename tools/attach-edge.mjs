/**
 * Lê a aba que JÁ ESTÁ ABERTA no navegador do dono — a sessão de verdade, com a chave dele e o
 * microfone dele.
 *
 * Por que separado do `drive-page.mjs`: aquele ABRE um navegador descartável e manda nele. Este
 * se ANEXA a um que já existe, sem tocar em nada: nenhuma navegação, nenhum clique por padrão,
 * só leitura. É o que permite, depois de um teste real falhar, puxar o diagnóstico sem pedir que
 * alguém copie e cole.
 *
 * ⚠ Só funciona se o navegador tiver sido aberto com a porta de depuração. Um Edge/Chrome comum
 * não expõe nada — e isso é proteção, não limitação: qualquer página poderia ler as outras.
 * Quando não encontra a porta, este script diz exatamente o comando para reabrir.
 *
 * Uso:
 *   node tools/attach-edge.mjs                       # diagnóstico da aba do bpmn
 *   node tools/attach-edge.mjs --url localhost       # outro filtro de aba
 *   node tools/attach-edge.mjs --passo "return document.title"
 *   node tools/attach-edge.mjs --listar              # só mostra as abas visíveis
 */
import { cdp } from './drive-page.mjs';

const PORTA = Number(process.env.BPMN_CDP_PORT ?? 9222);

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : padrao;
}

const filtro = arg('--url', 'bpmn');
const listar = process.argv.includes('--listar');
const passoExtra = arg('--passo');

const COMO_ABRIR = `
Nenhum navegador escutando em 127.0.0.1:${PORTA}.

Para eu conseguir ler a sua aba, abra o Edge com a porta de depuracao. Feche o Edge antes
(ele reaproveita a janela existente e a nova flag nao vale), e entao:

  & "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=${PORTA}

Para nao mexer no seu perfil normal, de um perfil separado (a sessao do Google nao vai junto):

  & "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=${PORTA} --user-data-dir="$env:TEMP\\edge-bpmn"

Depois abra https://niu-tech.github.io/bpmn/ nessa janela e rode este script de novo.
`.trim();

async function alvos() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}/json/list`);
    if (!r.ok) throw new Error(`/json/list respondeu ${r.status}`);
    return await r.json();
  } catch {
    console.error(COMO_ABRIR);
    process.exit(3);
  }
}

const paginas = (await alvos()).filter((t) => t.type === 'page');

if (listar || paginas.length === 0) {
  console.log(JSON.stringify(paginas.map((p) => ({ url: p.url, titulo: p.title })), null, 2));
  if (paginas.length === 0) console.error('\nNenhuma aba aberta nesse navegador.');
  process.exit(paginas.length ? 0 : 4);
}

const alvo = paginas.find((p) => p.url.includes(filtro)) ?? paginas[0];
console.log(`aba: ${alvo.url}\n`);

const c = cdp(alvo.webSocketDebuggerUrl);
await c.pronto;
await c.envia('Runtime.enable');

async function avaliar(js) {
  const r = await c.envia('Runtime.evaluate', {
    expression: `(async () => { ${js} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    return { erro: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
  }
  return { valor: r.result?.value ?? null };
}

if (passoExtra) {
  console.log(JSON.stringify(await avaliar(passoExtra), null, 2));
} else {
  const presente = await avaliar('return typeof window.__bpmnAssist');
  if (presente.valor !== 'object') {
    console.error('Essa aba nao tem o ajudante montado (window.__bpmnAssist ausente).');
    console.error('Confira se e a aba do bpmn e se a pagina terminou de carregar.');
    c.fecha();
    process.exit(5);
  }
  const estado = await avaliar('return window.__bpmnAssist.estado');
  const relatorio = await avaliar('return window.__bpmnAssist.report()');
  console.log(`estado: ${JSON.stringify(estado.valor)}\n`);
  console.log(relatorio.valor ?? relatorio.erro);
}

c.fecha();
