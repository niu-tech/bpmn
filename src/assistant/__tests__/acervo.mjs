/**
 * O ACERVO — busca lexical, carregamento sob demanda, a ferramenta e a conferência de citação.
 *
 * Sem rede e sem chave: o índice é um objeto literal e o `fetch` é injetado. O que se mede aqui é
 * o que a change `add-bpmn-norm-knowledge-base` promete em K2, K3, K5, K6, K8 e K9.
 *
 * Run: node src/assistant/__tests__/acervo.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buscar, criarAcervo } from '../knowledge/acervo.js';
import { conferirCitacoes, NAO_CONFERIDA } from '../knowledge/citacao.js';
import { criarExecutorDeNorma, ERRO_ACERVO } from '../tools/norma.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

const INDICE = {
  verbetes: 2,
  trechos: 3,
  paginas: [
    {
      sourceId: 'gateways',
      title: 'Gateways — onde o caminho se divide',
      group: 'fundamentos',
      tags: ['gateway', 'decisão', 'paralelo'],
      contentMode: 'curated_card_only',
      officialUrl: 'https://www.omg.org/spec/BPMN/2.0/',
      chunks: [
        {
          chunkId: 'exclusivo',
          locator: 'Gateways › exclusivo',
          citationKey: 'gateways:exclusivo',
          texto: 'O losango com X escolhe um caminho entre as saídas, conforme a condição de cada uma.',
        },
        {
          chunkId: 'paralelo',
          locator: 'Gateways › paralelo',
          citationKey: 'gateways:paralelo',
          texto: 'O losango com mais divide o fluxo em caminhos simultâneos e, ao convergir, espera todos.',
        },
      ],
    },
    {
      sourceId: 'simulacao',
      title: 'Simulação — o que o modelo responde quando roda',
      group: 'simulacao',
      tags: ['simulação', 'fila', 'recurso'],
      contentMode: 'curated_card_only',
      officialUrl: 'https://www.omg.org/spec/BPMN/2.0/',
      chunks: [
        {
          chunkId: 'metricas',
          locator: 'Simulação › métricas',
          citationKey: 'simulacao:metricas',
          texto: 'Tempo de ciclo, tempo em fila e utilização dos recursos são as três medidas que mais ensinam.',
        },
      ],
    },
  ],
};

console.log('\n▶ busca lexical (K2)');

test('acha pelo titulo e pela tag, com acento e caixa normalizados', () => {
  const r = buscar(INDICE, 'GATEWAY PARALELO', { max: 2 });
  assert.equal(r[0].citationKey, 'gateways:paralelo');
  assert.equal(r[0].contentMode, 'curated_card_only', 'o limite de evidencia viaja com o trecho (K4)');
  assert.ok(r[0].locator && r[0].officialUrl, 'localizador e link oficial vao junto');
});

test('o RADICAL aproxima simular e simulacao, e NAO aproxima tempo de temporizador', () => {
  // ⚠ Medido na primeira corrida da busca: com substring solta, "como simular o tempo de fila"
  // respondia sobre evento de BORDA, porque "tempo" casava a tag "temporizador". Token com
  // radical curto resolve sem dicionario.
  const r = buscar(INDICE, 'como simular o tempo de fila', { max: 1 });
  assert.equal(r[0].citationKey, 'simulacao:metricas');
});

test('pergunta sem palavra util nao inventa resultado', () => {
  assert.deepEqual(buscar(INDICE, 'e aí?'), []);
  assert.deepEqual(buscar(INDICE, ''), []);
});

console.log('\n▶ carregamento e falha (K3)');

testAsync('carrega UMA vez e reaproveita na aba', async () => {
  let chamadas = 0;
  const acervo = criarAcervo({
    fetchImpl: async () => { chamadas++; return { ok: true, json: async () => INDICE }; },
  });
  await acervo.consultar('gateway');
  await acervo.consultar('simulação');
  assert.equal(chamadas, 1, 'quem ja baixou nao baixa de novo');
  assert.deepEqual(acervo.tamanho, { verbetes: 2, trechos: 3 });
});

testAsync('falha de rede tem NOME e nao vira lista vazia', async () => {
  // ⚠ Lista vazia significa "procurei e nao ha". Deixar a falha de rede se passar por ausencia
  // de conteudo ensina o agente a afirmar que a norma nao diz algo que ela diz.
  const acervo = criarAcervo({ fetchImpl: async () => { throw new Error('offline'); } });
  const exec = criarExecutorDeNorma({ acervo });
  const err = await exec.consultar_norma({ termo: 'gateway' }).then(() => null, (e) => e);
  assert.ok(err, 'nao resolve em silencio');
  assert.equal(err.nome, ERRO_ACERVO);
});

console.log('\n▶ a ferramenta (K8)');

testAsync('sem acerto, o resultado diz o TAMANHO do acervo e a frase honesta', async () => {
  const acervo = criarAcervo({ fetchImpl: async () => ({ ok: true, json: async () => INDICE }) });
  const exec = criarExecutorDeNorma({ acervo });
  const r = await exec.consultar_norma({ termo: 'blockchain quântico' });
  assert.deepEqual(r.resultados, []);
  assert.equal(r.acervo.verbetes, 2);
  assert.match(r.comoProsseguir, /acervo de 2 verbetes/);
  assert.ok(!/norma n[ãa]o trata/i.test(r.comoProsseguir ?? ''), 'nunca afirma sobre a norma inteira');
});

testAsync('o que a ferramenta serve e REGISTRADO, para a conferencia ter contra o que medir', async () => {
  const servidas = new Set();
  const acervo = criarAcervo({ fetchImpl: async () => ({ ok: true, json: async () => INDICE }) });
  const exec = criarExecutorDeNorma({ acervo, aoServir: (k) => servidas.add(k) });
  await exec.consultar_norma({ termo: 'gateway exclusivo', max: 1 });
  assert.deepEqual([...servidas], ['gateways:exclusivo']);
});

console.log('\n▶ conferencia de citacao (K6)');

test('marca servida FICA; marca inventada vira "nao conferida"', () => {
  const servidas = new Set(['gateways:exclusivo']);
  const r = conferirCitacoes(
    'O exclusivo escolhe um caminho [fonte:gateways:exclusivo] e o paralelo espera todos [fonte:gateways:paralelo].',
    servidas,
  );
  assert.match(r.texto, /\[fonte:gateways:exclusivo\]/, 'o que foi consultado continua citado');
  assert.ok(r.texto.includes(NAO_CONFERIDA), 'o que nao foi consultado perde a etiqueta');
  assert.deepEqual(r.trocadas, ['gateways:paralelo']);
  // ⚠ O TEXTO do modelo continua inteiro: so a etiqueta errada cai. Apagar a frase seria
  // esconder o erro em vez de mostra-lo.
  assert.match(r.texto, /o paralelo espera todos/);
});

test('texto sem marca nenhuma passa intacto, sem custo', () => {
  const r = conferirCitacoes('Uma raia e uma subdivisao do pool.', new Set());
  assert.equal(r.texto, 'Uma raia e uma subdivisao do pool.');
  assert.deepEqual(r.trocadas, []);
});

console.log('\n▶ o validador do build (K5, K9)');

/** Escreve um acervo de mentira numa pasta temporaria e roda o build contra ela. */
function reprovou(nome, conteudo) {
  const pasta = mkdtempSync(join(tmpdir(), 'acervo-'));
  writeFileSync(join(pasta, nome), conteudo, 'utf8');
  const r = spawnSync(process.execPath, ['tools/build-knowledge.mjs', '--check', '--pasta', pasta], {
    encoding: 'utf8',
  });
  return { codigo: r.status, saida: `${r.stdout}${r.stderr}` };
}

const CABECALHO = '---\nsourceId: pagina\ntitle: P\ngroup: fundamentos\n'
  + 'contentMode: curated_card_only\nofficialUrl: https://exemplo\n---\n';
const TRECHO = (id) => `<!-- chunk:${id} -->\nLocalizador: L\nCitação: [fonte:pagina:${id}]\n\n`
  + 'Um texto com tamanho suficiente para ser citavel de verdade, com folga.\n<!-- /chunk -->\n';

test('verified_excerpt SEM rightsNote reprova o build (K5)', () => {
  // ⚠ A licenca de redistribuicao de trechos da norma da OMG nao foi confirmada. Aviso em
  // documento nao impede ninguem de colar tres paginas num verbete; o validador impede.
  const r = reprovou('pagina.md', CABECALHO.replace('curated_card_only', 'verified_excerpt') + TRECHO('a'));
  assert.equal(r.codigo, 2);
  assert.match(r.saida, /rightsNote/);
});

test('chave de citacao DUPLICADA reprova o build', () => {
  // Uma chave que aponta para dois textos torna impossivel a conferencia da resposta (K6).
  const r = reprovou('pagina.md', CABECALHO + TRECHO('a') + TRECHO('a'));
  assert.equal(r.codigo, 2);
  assert.match(r.saida, /duplicada|duplicado/i);
});

test('a MARCA DE FRONTEIRA do prompt em qualquer pagina reprova (K9)', () => {
  // O acervo e nosso, mas uma pagina com a marca poderia forjar o delimitador que separa dado
  // de instrucao. Uma linha de validador, e a fronteira continua valendo.
  const r = reprovou('pagina.md', CABECALHO + TRECHO('a').replace('Um texto', 'DADOS_DO_ALUNO Um texto'));
  assert.equal(r.codigo, 2);
  assert.match(r.saida, /fronteira/i);
});

report('acervo');
