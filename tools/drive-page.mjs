/**
 * Dirige uma página num navegador de verdade, sem ninguém olhando.
 *
 * Por que existe (dono, 2026-11-11): "a gente também precisa ter uma forma de testar e analisar
 * enquanto a gente trabalha". Até aqui, provar qualquer coisa de UI exigia uma pessoa abrindo o
 * site e descrevendo o que viu — o que custou um dia inteiro de ida e volta por um painel com
 * botões demais. Isto abre o Chrome/Edge em modo headless, FALA CDP com ele, clica, lê o DOM e
 * devolve erro de console e exceção. É o mesmo laço de `dotnet maia screen capture` da MAIA,
 * reduzido ao que um site estático precisa.
 *
 * Uso:
 *   node tools/drive-page.mjs <url> [--passo "<js>"]... [--shot <arquivo.png>] [--espera <ms>]
 *
 * Cada `--passo` é JavaScript avaliado NA PÁGINA, em ordem; o valor da última expressão é
 * impresso como JSON. `await` funciona. Exemplo:
 *   node tools/drive-page.mjs http://127.0.0.1:8123/ \
 *     --passo "document.querySelector('.bpmn-assist__toggle').click(); 'abriu'" \
 *     --passo "document.querySelectorAll('.bpmn-assist__panel button').length"
 *
 * ponytail: nenhuma dependência. `WebSocket` é global no Node 22+, e o CDP é JSON por um socket.
 * Instalar Playwright para clicar em dois botões seria 300 MB para uma coisa de 120 linhas.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const NAVEGADORES = [
  process.env.BPMN_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function acharNavegador() {
  const achado = NAVEGADORES.find((p) => existsSync(p));
  if (!achado) throw new Error(`nenhum navegador encontrado. Tente BPMN_BROWSER=<caminho>. Procurei em:\n  ${NAVEGADORES.join('\n  ')}`);
  return achado;
}

/** Espera o endpoint de depuração responder. Sem isto, a primeira conexão cai em ECONNREFUSED. */
async function esperarDevTools(porta, prazoMs = 15000) {
  const fim = Date.now() + prazoMs;
  while (Date.now() < fim) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`o navegador nao abriu a porta de depuracao ${porta} em ${prazoMs}ms`);
}

/** Cliente CDP minúsculo: um socket, um contador de id, uma tabela de promessas. */
function cdp(url) {
  const ws = new WebSocket(url);
  const pendentes = new Map();
  const eventos = [];
  let proximo = 1;

  const pronto = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', (e) => reject(new Error(`socket CDP falhou: ${e?.message ?? 'sem detalhe'}`)));
  });

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve, reject } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    eventos.push(msg);
  });

  return {
    pronto,
    eventos,
    async envia(method, params = {}) {
      await pronto;
      const id = proximo++;
      return new Promise((resolve, reject) => {
        pendentes.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    fecha() { try { ws.close(); } catch { /* já fechado */ } },
  };
}

function parseArgs(argv) {
  const out = { url: null, passos: [], shot: null, espera: 2500, largura: 1280, altura: 860 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--passo') out.passos.push(argv[++i]);
    else if (a === '--shot') out.shot = argv[++i];
    else if (a === '--espera') out.espera = Number(argv[++i]);
    else if (a === '--janela') { const [w, h] = argv[++i].split('x').map(Number); out.largura = w; out.altura = h; }
    else if (!out.url) out.url = a;
  }
  if (!out.url) throw new Error('faltou a URL. Uso: node tools/drive-page.mjs <url> [--passo "<js>"]...');
  return out;
}

export async function dirigir({ url, passos = [], shot = null, espera = 2500, porta = 9335, largura = 1280, altura = 860 } = {}) {
  const exe = acharNavegador();
  const perfil = `${process.env.TEMP ?? '/tmp'}/bpmn-drive-${porta}`;
  const filho = spawn(exe, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    // Microfone e camera SINTETICOS do proprio Chromium: getUserMedia devolve audio de verdade
    // (um tom), que passa pelo worklet de captura real. Sem isto nao ha como provar o caminho do
    // microfone sem uma pessoa falando.
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${largura},${altura}`,
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`,
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  const saida = { url, console: [], excecoes: [], passos: [], shot: null };

  try {
    await esperarDevTools(porta);
    const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
    const pagina = alvos.find((t) => t.type === 'page');
    if (!pagina) throw new Error('o navegador subiu sem nenhuma aba');

    const c = cdp(pagina.webSocketDebuggerUrl);
    await c.pronto;
    await c.envia('Runtime.enable');
    await c.envia('Page.enable');
    await c.envia('Log.enable');

    await c.envia('Page.navigate', { url });
    // Espera fixa em vez de `Page.loadEventFired`: a página monta o ajudante DEPOIS do load, e
    // esperar o evento certo para cada caso seria mais frágil que esperar um pouco.
    await new Promise((r) => setTimeout(r, espera));

    for (const passo of passos) {
      const r = await c.envia('Runtime.evaluate', {
        expression: `(async () => { ${passo} })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      saida.passos.push({
        passo: passo.length > 90 ? `${passo.slice(0, 90)}…` : passo,
        valor: r.result?.value ?? null,
        erro: r.exceptionDetails?.exception?.description ?? r.exceptionDetails?.text ?? null,
      });
      await new Promise((r2) => setTimeout(r2, 150));
    }

    if (shot) {
      const r = await c.envia('Page.captureScreenshot', { format: 'png' });
      mkdirSync(dirname(shot), { recursive: true });
      writeFileSync(shot, Buffer.from(r.data, 'base64'));
      saida.shot = shot;
    }

    for (const ev of c.eventos) {
      if (ev.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(ev.params.type)) {
        saida.console.push({ tipo: ev.params.type, texto: ev.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ') });
      }
      if (ev.method === 'Runtime.exceptionThrown') {
        saida.excecoes.push(ev.params.exceptionDetails?.exception?.description ?? ev.params.exceptionDetails?.text ?? 'excecao sem texto');
      }
      if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') {
        saida.console.push({ tipo: 'log', texto: `${ev.params.entry.text} ${ev.params.entry.url ?? ''}`.trim() });
      }
    }

    c.fecha();
  } finally {
    try { filho.kill(); } catch { /* já morreu */ }
  }

  return saida;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  dirigir(args).then((r) => {
    console.log(JSON.stringify(r, null, 2));
    const ruim = r.excecoes.length || r.passos.some((p) => p.erro);
    process.exit(ruim ? 1 : 0);
  }).catch((err) => {
    console.error(String(err?.stack ?? err));
    process.exit(2);
  });
}
