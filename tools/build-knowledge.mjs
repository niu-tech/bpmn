/**
 * BUILD DO ACERVO — `knowledge/*.md` vira `dist/knowledge/index.json` (decisão K1).
 *
 * Por que existe: a página é a fonte e o índice é ARTEFATO. Markdown é o que uma pessoa revisa
 * num pull request; JSON escrito à mão apodrece, e duas fontes de verdade para o mesmo acervo
 * divergem no primeiro verbete editado às pressas.
 *
 * O build é também o VALIDADOR, e é aí que mora o que nenhum aviso em documento garante (K5, K9):
 *
 *  - `verified_excerpt` sem `rightsNote` **reprova**. A licença de redistribuição de trechos da
 *    norma da OMG não foi confirmada, então o lote nasce inteiro em explicação autoral com link
 *    oficial — e o build impede que um literal escape para o site publicado;
 *  - `citationKey` duplicada **reprova**: uma chave que aponta para dois textos torna impossível
 *    a conferência que o aplicativo faz na resposta (K6);
 *  - a marca de fronteira do prompt (`DADOS_DO_ALUNO`) em qualquer página **reprova**: o acervo é
 *    nosso, mas uma página contendo a marca poderia forjar o delimitador que separa dado de
 *    instrução.
 *
 * Uso:
 *   node tools/build-knowledge.mjs            # gera e valida
 *   node tools/build-knowledge.mjs --check    # só valida (não escreve), para o portão
 *
 * ponytail: parser de front-matter de ~20 linhas em vez de um `js-yaml`. O formato é nosso e o
 * validador recusa o que ele não entende — dependência nova para ler seis chaves não se paga.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

/**
 * A pasta do acervo. Paramétrica por causa do TESTE do validador: as três recusas (K5, chave
 * duplicada, marca de fronteira) precisam de páginas defeituosas de propósito, e escrevê-las em
 * `knowledge/` quebraria o acervo de verdade.
 */
const PASTA = (() => {
  const i = process.argv.indexOf('--pasta');
  return i > 0 ? process.argv[i + 1] : 'knowledge';
})();
const SAIDA = 'dist/knowledge/index.json';
const MODOS = ['curated_card_only', 'verified_excerpt'];
/** A marca de fronteira do prompt. Nenhuma página do acervo pode contê-la (K9). */
const MARCA_DE_FRONTEIRA = 'DADOS_DO_ALUNO';

const soChecar = process.argv.includes('--check');

/** Front-matter simples: `chave: valor` e `tags: [a, b]`. O que não for isso, o validador acusa. */
function lerCabecalho(texto, arquivo) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(texto);
  if (!m) throw new Error(`${arquivo}: sem front-matter entre --- e ---`);
  const campos = {};
  for (const linha of m[1].split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const par = /^([a-zA-Z][\w-]*)\s*:\s*(.*)$/.exec(linha);
    if (!par) throw new Error(`${arquivo}: linha de cabeçalho que não é "chave: valor" → ${linha}`);
    const [, chave, cru] = par;
    const valor = cru.trim();
    campos[chave] = /^\[.*\]$/.test(valor)
      ? valor.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean)
      : valor;
  }
  return { campos, corpo: texto.slice(m[0].length) };
}

/** Os trechos: `<!-- chunk:id -->` … `Localizador:` … `Citação:` … texto … `<!-- /chunk -->`. */
function lerTrechos(corpo, arquivo, sourceId) {
  const trechos = [];
  const re = /<!--\s*chunk:([\w-]+)\s*-->\r?\n([\s\S]*?)<!--\s*\/chunk\s*-->/g;
  let m;
  while ((m = re.exec(corpo)) !== null) {
    const [, chunkId, dentro] = m;
    const locator = /^Localizador:\s*(.+)$/m.exec(dentro)?.[1]?.trim() ?? null;
    const citationKey = /^Cita[çc][ãa]o:\s*\[fonte:([\w-]+):([\w-]+)\]/m.exec(dentro);
    if (!locator) throw new Error(`${arquivo}#${chunkId}: falta a linha "Localizador:"`);
    if (!citationKey) throw new Error(`${arquivo}#${chunkId}: falta a linha "Citação: [fonte:<sourceId>:<chunkId>]"`);
    if (citationKey[1] !== sourceId || citationKey[2] !== chunkId) {
      throw new Error(`${arquivo}#${chunkId}: a citação diz [fonte:${citationKey[1]}:${citationKey[2]}] e deveria dizer [fonte:${sourceId}:${chunkId}]`);
    }
    const texto = dentro
      .split(/\r?\n/)
      .filter((l) => !/^(Localizador|Cita[çc][ãa]o):/.test(l.trim()))
      .join('\n')
      .trim();
    if (texto.length < 40) throw new Error(`${arquivo}#${chunkId}: trecho curto demais para ser citável (${texto.length} caracteres)`);
    trechos.push({ chunkId, locator, citationKey: `${sourceId}:${chunkId}`, texto });
  }
  if (!trechos.length) throw new Error(`${arquivo}: nenhum trecho — uma página sem trecho não é citável`);
  return trechos;
}

function construir() {
  if (!existsSync(PASTA)) throw new Error(`não achei a pasta ${PASTA}`);
  const arquivos = readdirSync(PASTA).filter((n) => n.endsWith('.md') && n !== 'README.md').sort();
  if (!arquivos.length) throw new Error('acervo vazio');

  const verbetes = [];
  const chavesVistas = new Map();

  for (const nome of arquivos) {
    const caminho = `${PASTA}/${nome}`;
    const bruto = readFileSync(caminho, 'utf8');
    if (bruto.includes(MARCA_DE_FRONTEIRA)) {
      throw new Error(`${caminho}: contém a marca de fronteira do prompt (${MARCA_DE_FRONTEIRA}) — ver K9`);
    }
    const { campos, corpo } = lerCabecalho(bruto, caminho);
    for (const obrigatorio of ['sourceId', 'title', 'group', 'contentMode', 'officialUrl']) {
      if (!campos[obrigatorio]) throw new Error(`${caminho}: falta "${obrigatorio}" no cabeçalho`);
    }
    if (campos.sourceId !== nome.replace(/\.md$/, '')) {
      throw new Error(`${caminho}: sourceId "${campos.sourceId}" diferente do nome do arquivo`);
    }
    if (!MODOS.includes(campos.contentMode)) {
      throw new Error(`${caminho}: contentMode "${campos.contentMode}" (use: ${MODOS.join(' ou ')})`);
    }
    if (campos.contentMode === 'verified_excerpt' && !campos.rightsNote) {
      throw new Error(`${caminho}: verified_excerpt SEM rightsNote — trecho literal só entra com a nota de direitos (K5)`);
    }
    const trechos = lerTrechos(corpo, caminho, campos.sourceId);
    for (const t of trechos) {
      if (chavesVistas.has(t.citationKey)) {
        throw new Error(`chave de citação duplicada: ${t.citationKey} (${caminho} e ${chavesVistas.get(t.citationKey)})`);
      }
      chavesVistas.set(t.citationKey, caminho);
    }
    verbetes.push({
      sourceId: campos.sourceId,
      title: campos.title,
      group: campos.group,
      tags: Array.isArray(campos.tags) ? campos.tags : [],
      contentMode: campos.contentMode,
      officialUrl: campos.officialUrl,
      ...(campos.rightsNote ? { rightsNote: campos.rightsNote } : {}),
      chunks: trechos,
    });
  }

  return {
    // O acervo DECLARA O PRÓPRIO TAMANHO (K8): é isso que permite ao agente dizer "não está no
    // meu acervo de N verbetes" em vez de "a norma não trata disso".
    gerado: new Date().toISOString(),
    verbetes: verbetes.length,
    trechos: chavesVistas.size,
    paginas: verbetes,
  };
}

try {
  const indice = construir();
  if (!soChecar) {
    mkdirSync('dist/knowledge', { recursive: true });
    writeFileSync(SAIDA, JSON.stringify(indice, null, 2), 'utf8');
  }
  const tamanho = Buffer.byteLength(JSON.stringify(indice), 'utf8');
  console.log(`acervo OK (${PASTA}): ${indice.verbetes} verbetes, ${indice.trechos} trechos, ${(tamanho / 1024).toFixed(1)} KB${soChecar ? ' (só checagem)' : ` → ${SAIDA}`}`);
} catch (err) {
  console.error(`acervo REPROVADO — ${err.message}`);
  process.exit(2);
}
