/**
 * Abre o Edge com a PORTA DE DEPURAÇÃO e o site do ajudante — o modo "trilha ao vivo".
 *
 * Por que existe: testar de verdade é no navegador do dono, com a chave dele e o microfone dele.
 * Só que uma janela comum não deixa ninguém ler nada de fora (e isso é proteção, não limitação).
 * Com a porta aberta, `tools/attach-edge.mjs` lê a sessão inteira sem pedir que alguém copie e
 * cole um painel — que é o pedido de 2026-11-14: *"preciso de uma forma de eu testar e você ter
 * acesso a absolutamente todos os pontos"*.
 *
 * ⚠ Perfil SEPARADO por padrão (`%TEMP%\edge-bpmn`): a janela de teste não carrega as suas
 * sessões nem os seus cookies, e nada que você faça nela mexe no seu Edge do dia a dia. A chave
 * do Gemini você cola nessa janela — ela vive na aba e morre com ela, como sempre.
 *
 * Uso:
 *   node tools/abrir-edge.mjs                  # site publicado
 *   node tools/abrir-edge.mjs --local          # http://127.0.0.1:8126
 *   node tools/abrir-edge.mjs --perfil meu     # usa o SEU perfil (cuidado: janela normal)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORTA = Number(process.env.BPMN_CDP_PORT ?? 9222);
const PUBLICADO = 'https://niu-tech.github.io/bpmn/';
const LOCAL = 'http://127.0.0.1:8126/index.html';

const arg = (nome, padrao = null) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : padrao;
};

const url = process.argv.includes('--local') ? LOCAL : (arg('--url') ?? PUBLICADO);
const perfilProprio = arg('--perfil') === 'meu';

const CANDIDATOS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const edge = CANDIDATOS.find((p) => existsSync(p));
if (!edge) {
  console.error('Não achei o msedge.exe nos caminhos conhecidos:');
  for (const c of CANDIDATOS) console.error(`  ${c}`);
  process.exit(2);
}

// Já tem alguém escutando? Então a janela de depuração já existe: não abrir uma segunda.
try {
  const r = await fetch(`http://127.0.0.1:${PORTA}/json/version`, { signal: AbortSignal.timeout(1500) });
  if (r.ok) {
    const v = await r.json();
    console.log(`Já existe navegador escutando em 127.0.0.1:${PORTA} (${v.Browser}).`);
    console.log('Abra a sua aba nessa janela e rode: npm run captura');
    process.exit(0);
  }
} catch { /* ninguém escutando: segue e abre */ }

const args = [`--remote-debugging-port=${PORTA}`];
if (!perfilProprio) args.push(`--user-data-dir=${join(tmpdir(), 'edge-bpmn')}`);
args.push('--no-first-run', '--no-default-browser-check', url);

const filho = spawn(edge, args, { detached: true, stdio: 'ignore' });
filho.unref();

console.log(`Edge aberto em ${url}`);
console.log(`porta de depuração: 127.0.0.1:${PORTA}${perfilProprio ? ' (SEU perfil)' : ' (perfil separado)'}`);
console.log('');
console.log('Agora: cole a sua chave, use o ajudante normalmente — e quando algo der errado,');
console.log('rode `npm run captura` aqui: eu leio a sessão inteira sem você copiar nada.');
