/**
 * AS TRÊS TABELAS DA DISSERTAÇÃO, geradas dos arquivos (change `prove-it-with-a-golden-set`, 6.3).
 *
 * Por que existe: tabela escrita à mão num editor é tabela que envelhece em silêncio — a corrida
 * seguinte muda o número e ninguém volta no capítulo. Estas saem das provas que já estão no
 * disco, com a data da corrida de onde vieram, e podem ser regeradas no dia da entrega.
 *
 *   1. taxa por categoria      ← artifacts/avaliacao/<carimbo>/resumo.json
 *   2. cobertura de ferramenta ← o acervo + as corridas ao vivo
 *   3. latência por turno      ← artifacts/sessoes/*.json (os tempos que a sessão carimba)
 *
 * ⚠ O que NÃO tiver prova no disco aparece como "—", e não como zero. Zero é uma medida; ausência
 * de medida é outra coisa, e confundi-las é o jeito mais fácil de uma tabela mentir.
 *
 * Uso:
 *   node tools/tabelas.mjs                 # imprime e salva em artifacts/tabelas/
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { FERRAMENTAS } from '../src/assistant/agent/catalog.js';

const acervo = JSON.parse(readFileSync('avaliacao/perguntas-douradas.json', 'utf8'));

/** O conteúdo mais recente de uma pasta de corridas, por carimbo no nome. */
function maisRecentes(pasta, filtro = () => true) {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta, { withFileTypes: true })
    .filter((d) => filtro(d))
    .map((d) => d.name)
    .sort()
    .reverse();
}

function lerAvaliacoes() {
  const base = 'artifacts/avaliacao';
  const corridas = [];
  for (const nome of maisRecentes(base, (d) => d.isDirectory())) {
    const arq = `${base}/${nome}/resumo.json`;
    if (!existsSync(arq)) continue;
    try { corridas.push(JSON.parse(readFileSync(arq, 'utf8'))); } catch { /* corrida corrompida: ignora */ }
  }
  return corridas;
}

function lerSessoes() {
  const sessoes = [];
  const base = 'artifacts/sessoes';
  for (const nome of maisRecentes(base, (d) => d.isFile() && d.name.endsWith('.json'))) {
    try {
      const s = JSON.parse(readFileSync(`${base}/${nome}`, 'utf8'));
      if (Array.isArray(s.turnos) && s.turnos.length) sessoes.push({ nome, ...s });
    } catch { /* idem */ }
  }
  /**
   * As sessões que a CORRIDA DO ACERVO salva (uma por perfil, desde que o lote inteiro passou a
   * conversar na mesma sessão). São as mais honestas da tabela: um lote de 26 perguntas contra o
   * Gemini de verdade, com o contexto acumulando como numa aula — que é justamente o regime em
   * que a latência e o custo importam. Sem isto a tabela mostrava só o dublê (0,1 s / 0,2 s),
   * número verdadeiro e enganoso ao mesmo tempo.
   */
  for (const nome of maisRecentes('artifacts/avaliacao', (d) => d.isFile() && d.name.startsWith('sessao-ao-vivo'))) {
    try {
      const s2 = JSON.parse(readFileSync(`artifacts/avaliacao/${nome}`, 'utf8'));
      if (Array.isArray(s2.turnos) && s2.turnos.length) sessoes.push({ nome: `acervo/${nome.replace(/^sessao-ao-vivo-/, '').replace(/\.json$/, '')}`, ...s2 });
    } catch { /* idem */ }
  }
  // As gravacoes em VIDEO tambem sao sessoes — e sao as unicas AO VIVO que guardam os tempos.
  for (const dir of maisRecentes('artifacts/video', (d) => d.isDirectory())) {
    const arq = `artifacts/video/${dir}/captura.json`;
    if (!existsSync(arq)) continue;
    try {
      const s = JSON.parse(readFileSync(arq, 'utf8'));
      if (Array.isArray(s.turnos) && s.turnos.length) sessoes.push({ nome: `video/${dir}`, ...s });
    } catch { /* idem */ }
  }
  return sessoes;
}

const pct = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(0)}%`);
const seg = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
const mediana = (xs) => {
  const l = xs.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
  return l.length ? l[Math.floor(l.length / 2)] : null;
};

const corridas = lerAvaliacoes();
const vivo = corridas.filter((c) => c.camada === 'ao-vivo');
const deterministicas = corridas.filter((c) => c.camada === 'deterministica');

/**
 * A medida MAIS RECENTE de cada categoria — e não a última corrida inteira.
 *
 * ⚠ As corridas são fatiadas na prática (`--categoria`, e ao vivo pela cota), então pegar só a
 * última deixaria onze categorias como "—" por acidente de linha de comando — e uma tabela com
 * buraco por acidente é pior que uma tabela com buraco declarado.
 */
function porCategoriaMaisRecente(lista) {
  const mapa = {};
  for (const c of lista) {
    for (const [cat, v] of Object.entries(c.resumo?.porCategoria ?? {})) {
      // `corridas` já vem da mais nova para a mais velha: a primeira que aparecer vence.
      if (!(cat in mapa)) mapa[cat] = { ...v, quando: c.quando };
    }
  }
  return mapa;
}

const detPorCategoria = porCategoriaMaisRecente(deterministicas);
const vivoPorCategoria = porCategoriaMaisRecente(vivo);

/* ---------------------------------------------------------------- 1. taxa por categoria */

const categorias = [...new Set(acervo.perguntas.map((p) => p.categoria))];
const celula = (v) => {
  if (!v) return '—';
  const exec = v.total - v.naoExecutadas;
  return exec ? `${v.ok}/${exec} (${pct(v.taxa)})` : '—';
};
const linhas1 = categorias.map((cat) => {
  const d = detPorCategoria[cat];
  const a = vivoPorCategoria[cat];
  return {
    categoria: cat,
    perguntas: acervo.perguntas.filter((p) => p.categoria === cat).length,
    det: celula(d),
    vivo: celula(a),
    naoExec: (a?.naoExecutadas ?? 0) + (d?.naoExecutadas ?? 0) || '',
  };
});

/* ---------------------------------------------------------------- 2. cobertura de ferramenta */

const noAcervo = new Set(acervo.perguntas.flatMap((p) => p.ferramentasEsperadas ?? []));
const escolhidasAoVivo = new Set(vivo.flatMap((c) => c.resultados.flatMap((r) => r.ferramentas ?? [])));
const linhas2 = FERRAMENTAS.map((f) => ({
  ferramenta: f.nome,
  escreve: f.escreve ? 'sim' : 'não',
  acervo: noAcervo.has(f.nome) ? 'sim' : '—',
  aoVivo: escolhidasAoVivo.has(f.nome) ? 'sim' : '—',
}));
const cobertura = noAcervo.size / FERRAMENTAS.length;

/* ---------------------------------------------------------------- 3. latência por turno */

const sessoes = lerSessoes();
const linhas3 = sessoes.slice(0, 6).map((s) => {
  const t = s.turnos.filter((x) => x.tempos);
  return {
    sessao: s.nome.replace(/\.json$/, ''),
    quando: (s.quando ?? '').slice(0, 16).replace('T', ' '),
    turnos: t.length,
    ouviu: seg(mediana(t.map((x) => x.tempos.ouviuMs))),
    primeira: seg(mediana(t.map((x) => x.tempos.primeiraMs))),
    janela: seg(mediana(t.map((x) => x.tempos.janelaDeAudioMs))),
    total: seg(mediana(t.map((x) => x.tempos.totalMs))),
    tokens: s.usoAcumulado?.total ?? '—',
  };
});

/* ---------------------------------------------------------------- saída */

const tabela = (cabecalho, linhas, campos) => {
  const sep = cabecalho.map(() => '---');
  const corpo = linhas.map((l) => `| ${campos.map((c) => String(l[c] ?? '')).join(' | ')} |`);
  return [`| ${cabecalho.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...corpo].join('\n');
};

const quando = new Date().toISOString();
const md = `# As três tabelas da validação

> Geradas de \`artifacts/\` em ${quando.slice(0, 16).replace('T', ' ')} por \`node tools/tabelas.mjs\`.
> O que não tem prova no disco aparece como **—**, nunca como zero.

## 1. Taxa de acerto por categoria

${tabela(['categoria', 'perguntas', 'determinística', 'ao vivo', 'não executadas'], linhas1,
  ['categoria', 'perguntas', 'det', 'vivo', 'naoExec'])}

A camada determinística mede **o que é nosso** (a ferramenta é oferecida neste perfil? a política
deixa executar? o erro é nomeado?); a camada ao vivo mede **o que é do modelo** (ele escolhe a
ferramenta certa e diz os fatos certos?). Pergunta que não rodou é contada como **não executada**,
nunca como acerto.

## 2. Cobertura de ferramenta

Das **${FERRAMENTAS.length}** ferramentas do catálogo, **${noAcervo.size}** têm pergunta no acervo
(${pct(cobertura)}) e **${escolhidasAoVivo.size}** foram escolhidas pelo modelo numa corrida ao vivo.

${tabela(['ferramenta', 'escreve', 'no acervo', 'escolhida ao vivo'], linhas2,
  ['ferramenta', 'escreve', 'acervo', 'aoVivo'])}

## 3. Latência por turno

${linhas3.length
    ? tabela(['sessão', 'quando', 'turnos', 'ouviu', 'primeira resposta', 'janela do áudio', 'turno inteiro', 'tokens'],
      linhas3, ['sessao', 'quando', 'turnos', 'ouviu', 'primeira', 'janela', 'total', 'tokens'])
    : '_(nenhuma sessão com tempos carimbados em `artifacts/sessoes/`)_'}

Medianas, não médias: um turno travado estraga a média e não muda o que o aluno sente na maioria
das vezes. **ouviu** é o servidor devolvendo a transcrição da fala (só existe em turno de voz);
**primeira resposta** é a primeira coisa que o aluno vê ou ouve; **janela do áudio** é o tempo
entre o primeiro e o último quadro de som — fala picotada aparece aqui.
`;

mkdirSync('artifacts/tabelas', { recursive: true });
const destino = `artifacts/tabelas/tabelas-${quando.replace(/[:.]/g, '-')}.md`;
writeFileSync(destino, md, 'utf8');
writeFileSync('artifacts/tabelas/ultimas.md', md, 'utf8');

console.log(md);
console.log(`\n(salvo em ${destino})`);
