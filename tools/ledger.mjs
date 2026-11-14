// Diário das corridas — a evidência do TCC, em arquivo que se lê e se cita (H5).
//
// Por que existe: hoje a prova de uma corrida é `artifacts/bateria/resultado.json`, que a corrida
// SEGUINTE sobrescreve. Para a dissertação isso não serve: "o portão F6 passou ao vivo" precisa de
// um registro com data que ninguém apagou ao rodar de novo.
//
// ⚠ O QUE NUNCA ENTRA — a invariante, e ela mora no CÓDIGO, não na boa intenção de quem chama:
// áudio, PCM, base64 de qualquer tipo, chave, e texto PARCIAL. O diário guarda **conteúdo final**.
// Na cápsula de onde isto vem a regra era do esquema do banco (não havia coluna para áudio); aqui
// é uma lista branca de campos, e um teste prova que o resto é descartado mesmo quando mandado.
//
// JSONL e não banco: a prova precisa ser lida por uma pessoa (e pelo orientador) com um `grep`, e
// `node:sqlite` traria um arquivo opaco para ganhar consultas que ninguém vai fazer.
//
// ponytail: um append e um filtro de campos. Sem ORM, sem índice, sem esquema.
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export const DIARIO_PADRAO = 'artifacts/ledger/corridas.jsonl';

/** Os únicos campos que um registro pode ter. Tudo fora desta lista é descartado. */
const CAMPOS = Object.freeze([
  'quando', 'corrida', 'cenario', 'ok', 'resposta', 'ferramentas', 'turnos', 'erro', 'nota',
]);

/** Nomes que denunciam conteúdo proibido, independentemente de onde apareçam. */
const PROIBIDOS = /audio|pcm|base64|wav|chave|key|token|parcial/i;

/** Texto que não é final não entra: o diário é prova, e parcial não prova nada. */
function limpar(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return null;
  if (profundidade > 4) return null;
  if (typeof valor === 'string') return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => limpar(v, profundidade + 1));
  if (typeof valor === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (PROIBIDOS.test(k)) continue;
      const limpo = limpar(v, profundidade + 1);
      if (limpo !== null) out[k] = limpo;
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}

/**
 * Registra UMA corrida. Devolve o que de fato foi gravado — para o chamador poder conferir que o
 * que ele mandou de errado não entrou.
 */
export function registrar(entrada, caminho = DIARIO_PADRAO) {
  const linha = { quando: new Date().toISOString() };
  for (const campo of CAMPOS) {
    if (campo === 'quando' || !(campo in entrada)) continue;
    if (PROIBIDOS.test(campo)) continue;
    const limpo = limpar(entrada[campo]);
    if (limpo !== null) linha[campo] = limpo;
  }
  mkdirSync(dirname(caminho), { recursive: true });
  appendFileSync(caminho, `${JSON.stringify(linha)}\n`, 'utf8');
  return linha;
}

/** Tudo que já foi registrado. Linha quebrada é pulada: um diário torto não derruba a leitura. */
export function ler(caminho = DIARIO_PADRAO) {
  if (!existsSync(caminho)) return [];
  return readFileSync(caminho, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
}

/** Quantas corridas, quantas passaram, e desde quando — o resumo que vai para a dissertação. */
export function resumo(caminho = DIARIO_PADRAO) {
  const linhas = ler(caminho);
  const porCenario = new Map();
  for (const l of linhas) {
    const atual = porCenario.get(l.cenario) ?? { cenario: l.cenario, corridas: 0, passaram: 0 };
    atual.corridas++;
    if (l.ok) atual.passaram++;
    porCenario.set(l.cenario, atual);
  }
  return {
    corridas: linhas.length,
    passaram: linhas.filter((l) => l.ok).length,
    primeira: linhas[0]?.quando ?? null,
    ultima: linhas.at(-1)?.quando ?? null,
    porCenario: [...porCenario.values()].sort((a, b) => b.corridas - a.corridas),
  };
}

if (process.argv[1]?.endsWith('ledger.mjs')) {
  const r = resumo(process.argv[2] ?? DIARIO_PADRAO);
  console.log(`${r.passaram} de ${r.corridas} corridas registradas` + (r.primeira ? ` · de ${r.primeira.slice(0, 10)} a ${r.ultima.slice(0, 10)}` : ''));
  for (const c of r.porCenario) console.log(`  ${String(c.passaram).padStart(3)}/${String(c.corridas).padEnd(3)} ${c.cenario}`);
}
