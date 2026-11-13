/**
 * HTML -> PDF pelo Chromium headless, por CDP. Sem dependência nova.
 *
 * Reaproveita o cliente CDP do `drive-page.mjs`: abre o navegador, carrega o arquivo local,
 * espera as fontes, e chama `Page.printToPDF`. É o mesmo motor que imprime a página de verdade,
 * então o que se vê no navegador é o que sai no PDF.
 *
 * Uso: node tools/html-to-pdf.mjs <entrada.html> <saida.pdf>
 */
import { spawn, spawnSync } from 'node:child_process';
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

  // PORTA POR CORRIDA, nunca fixa. Com `9341` fixo, uma corrida anterior que deixou o navegador
  // vivo fazia a seguinte ANEXAR na instancia velha -- e o sintoma nao e "porta ocupada", e
  // `Printing is not available (-32000)`, que parece defeito do documento. Medido em 2026-11-13:
  // 30 `msedge.exe` de PDF pendurados nesta maquina, e o render falhando sem dizer por que.
  const porta = 9800 + (process.pid % 150);
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
    // `kill` sozinho nao basta: o Edge re-executa e deixa processos que nao sao filhos deste.
    // O filtro e o PERFIL (unico por corrida) e nunca o nome: o dono tem o Edge dele aberto.
    if (process.platform === 'win32') {
      const marca = perfil.split(/[\\/]/).pop();
      spawnSync('powershell', ['-NoProfile', '-Command',
        'Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\' or Name=\'chrome.exe\'" '
        + `| Where-Object { $_.CommandLine -like '*${marca}*' } `
        + '| ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue } catch { } }',
      ], { stdio: 'ignore', timeout: 20000 });
    }
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
