// Inventário de dependências, com versão FIXADA e licença declarada (H12).
//
// Por que existe: a banca pergunta o que o trabalho usa e sob que licença, e "está no
// package.json" não é resposta — ali está o intervalo (`^18.12.0`), não a versão que de fato
// rodou, e não há licença nenhuma. Este arquivo lê o `package-lock.json` (a versão REAL) e o
// `node_modules` (a licença REAL), e escreve a tabela.
//
// ⚠ GERADO, nunca editado à mão: tabela escrita à mão envelhece na primeira atualização e passa a
// mentir com cara de rigor. Rode de novo depois de mexer nas dependências.
//
// Uso: node tools/inventario.mjs [--out docs/INVENTARIO.md]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};

const SAIDA = arg('out', 'docs/INVENTARIO.md');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

/** A versão que de fato está instalada, do lock — não o intervalo do `package.json`. */
function doLock(nome) {
  return lock.packages?.[`node_modules/${nome}`] ?? null;
}

/** A licença como o próprio pacote a declara. Sem adivinhar: ausente é ausente, e isso se diz. */
function licenca(nome) {
  const doPacote = doLock(nome)?.license;
  if (doPacote) return Array.isArray(doPacote) ? doPacote.join(' / ') : doPacote;
  const p = join('node_modules', nome, 'package.json');
  if (!existsSync(p)) return '(não instalado)';
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const l = j.license ?? j.licenses;
    if (!l) return '(não declarada)';
    return typeof l === 'string' ? l : [].concat(l).map((x) => x.type ?? x).join(' / ');
  } catch { return '(ilegível)'; }
}

function tabela(titulo, deps, nota) {
  const nomes = Object.keys(deps ?? {}).sort();
  if (!nomes.length) return '';
  const linhas = nomes.map((n) => {
    const l = doLock(n);
    return `| \`${n}\` | ${l?.version ?? '(não instalado)'} | ${deps[n]} | ${licenca(n)} |`;
  });
  return [
    `## ${titulo}`,
    '',
    ...(nota ? [nota, ''] : []),
    '| Pacote | Versão instalada | Faixa declarada | Licença |',
    '|---|---|---|---|',
    ...linhas,
    '',
  ].join('\n');
}

const diretas = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
const total = Object.keys(lock.packages ?? {}).filter((k) => k.startsWith('node_modules/')).length;

const texto = [
  '# Inventário de dependências',
  '',
  '> **Gerado** por `node tools/inventario.mjs` — não edite à mão. Tabela escrita à mão envelhece',
  '> na primeira atualização e passa a mentir com cara de rigor.',
  '',
  `Gerado em ${new Date().toISOString().slice(0, 10)} · **${diretas} dependências diretas**, `
  + `${total} no total com as transitivas.`,
  '',
  tabela(
    'Runtime — vão para o navegador do aluno',
    pkg.dependencies,
    'São as que o aluno baixa ao abrir a página. Cada uma precisa de motivo, não só de uso.',
  ),
  tabela(
    'Desenvolvimento — não vão para o aluno',
    pkg.devDependencies,
    'Empacotamento e servidor local. Não existem no site publicado.',
  ),
  '## O que NÃO há aqui',
  '',
  '- **Nenhuma dependência de IA.** A conversa com o Gemini Live é WebSocket e JSON escritos à mão',
  '  (`src/assistant/live/protocol.js`): sem SDK, sem cliente gerado.',
  '- **Nenhum framework de interface.** O painel é `document.createElement` e uma folha de estilo.',
  '- **Nenhuma biblioteca de teste.** O arnês é `node:assert` e 40 linhas em `tools/test-harness.mjs`.',
  '- **Nenhuma dependência nova veio da colheita da cápsula**: o que foi trazido são módulos puros,',
  '  copiados e traduzidos.',
  '',
].filter(Boolean).join('\n');

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, texto, 'utf8');
console.log(`${SAIDA}: ${diretas} diretas, ${total} com transitivas`);
