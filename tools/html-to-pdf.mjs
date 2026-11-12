/**
 * HTML -> PDF pelo Chromium headless, por CDP. Sem dependência nova.
 *
 * Reaproveita o cliente CDP do `drive-page.mjs`: abre o navegador, carrega o arquivo local,
 * espera as fontes, e chama `Page.printToPDF`. É o mesmo motor que imprime a página de verdade,
 * então o que se vê no navegador é o que sai no PDF.
 *
 * Uso: node tools/html-to-pdf.mjs <entrada.html> <saida.pdf>
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { cdp } from './drive-page.mjs';

const NAVEGADORES = [
  process.env.BPMN_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

async function esperarDevTools(porta, prazoMs = 20000) {
  const fim = Date.now() + prazoMs;
  while (Date.now() < fim) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (r.ok) return;
    } catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`o navegador nao abriu a porta ${porta}`);
}

export async function imprimir(entrada, saida, opcoes = {}) {
  const exe = NAVEGADORES.find((p) => existsSync(p));
  if (!exe) throw new Error('nenhum navegador encontrado (defina BPMN_BROWSER)');

  const porta = 9341;
  const perfil = `${process.env.TEMP ?? '/tmp'}/bpmn-pdf-${process.pid}-${Date.now()}`;
  const filho = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, 'about:blank',
  ], { stdio: 'ignore' });

  try {
    await esperarDevTools(porta);
    const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
    const pagina = alvos.find((t) => t.type === 'page');
    const c = cdp(pagina.webSocketDebuggerUrl);
    await c.pronto;
    await c.envia('Page.enable');
    await c.envia('Page.navigate', { url: pathToFileURL(resolve(entrada)).href });
    // Espera o layout assentar: fonte carregada antes de medir quebra de página.
    await new Promise((r) => setTimeout(r, 2500));

    const r = await c.envia('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      ...opcoes,
    });
    mkdirSync(dirname(resolve(saida)), { recursive: true });
    writeFileSync(saida, Buffer.from(r.data, 'base64'));
    c.fecha();
    return saida;
  } finally {
    try { filho.kill(); } catch { /* ja morreu */ }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [entrada, saida] = process.argv.slice(2);
  if (!entrada || !saida) {
    console.error('uso: node tools/html-to-pdf.mjs <entrada.html> <saida.pdf>');
    process.exit(2);
  }
  imprimir(entrada, saida)
    .then((p) => console.log(`PDF: ${resolve(p)}`))
    .catch((e) => { console.error(String(e?.stack ?? e)); process.exit(1); });
}
