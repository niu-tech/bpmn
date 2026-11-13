/**
 * Fase F4 — memória da aba.
 *
 * O portão desta fase (openspec/roadmap.md) é AO VIVO: conversar no texto, trocar para voz e
 * perguntar *"sobre o que a gente estava falando?"* — a resposta cita o assunto anterior. Estes
 * testes são a metade determinística: o que precisa ser verdade para o portão ter chance.
 *
 * O que cada bloco protege, em uma frase:
 *  - quem guarda é o MODELO, chamando `lembrar`; nenhum código nosso lê o texto do aluno para
 *    decidir o que é memória (constituição §III — a mesma regra que proíbe keyword→tool);
 *  - memória sem teto vira transcrição, e transcrição não cabe no orçamento do prompt;
 *  - o que foi guardado volta ao modelo no turno seguinte, pelo caminho do contexto da F3;
 *  - nada sobrevive à aba: sem `localStorage`, sem rede, sem rastro.
 *
 * Run: node src/assistant/__tests__/memoria.mjs
 */
import assert from 'node:assert/strict';

import { FERRAMENTAS } from '../agent/catalog.js';
import { permitida } from '../agent/policy.js';
import { CATEGORIAS, ERROS_MEMORIA, criarMemoria } from '../agent/memory.js';
import { promptDoPerfil, renderizar } from '../agent/render.js';
import { resolverContexto } from '../agent/resolve.js';
import { buildSetup, DELIVERY_TOOL } from '../live/protocol.js';
import { codigoSemComentarios as codigo, report, test } from '../../../tools/test-harness.mjs';

console.log('\n▶ três categorias, e o modelo escolhe qual');

test('guarda nas tres categorias, com origem e carimbo', () => {
  const m = criarMemoria({ agora: () => 1000 });
  assert.equal(m.lembrar({ categoria: 'fato', texto: 'o processo é de atendimento', turno: 3 }).ok, true);
  assert.equal(m.lembrar({ categoria: 'decisao', texto: 'gateway exclusivo no desvio', turno: 4 }).ok, true);
  assert.equal(m.lembrar({ categoria: 'preferencia', texto: 'responda curto', turno: 5 }).ok, true);
  assert.equal(m.total, 3);
  const { fato } = m.estado;
  assert.equal(fato[0].turno, 3, 'sem a origem, nao da para saber de onde veio');
  assert.equal(fato[0].em, 1000);
});

test('categoria inventada e RECUSADA, dizendo quais existem', () => {
  const m = criarMemoria();
  const r = m.lembrar({ categoria: 'anotacao', texto: 'qualquer coisa' });
  assert.equal(r.ok, false);
  assert.equal(r.erro, ERROS_MEMORIA.CATEGORIA);
  // O modelo corrige a chamada quando o erro DIZ o que aceitar; "deu erro" faz ele repetir igual.
  assert.deepEqual(r.aceitas, [...CATEGORIAS]);
  assert.equal(m.total, 0);
});

test('texto vazio nao vira memoria', () => {
  const m = criarMemoria();
  assert.equal(m.lembrar({ categoria: 'fato', texto: '   ' }).erro, ERROS_MEMORIA.VAZIO);
  assert.equal(m.total, 0);
});

test('o mesmo lembrete duas vezes nao vira duas linhas', () => {
  const m = criarMemoria();
  m.lembrar({ categoria: 'preferencia', texto: 'Responda curto' });
  const r = m.lembrar({ categoria: 'preferencia', texto: 'responda curto' });
  assert.equal(r.ok, true);
  assert.equal(r.repetido, true);
  assert.equal(m.total, 1, 'duas linhas iguais gastam o dobro para dizer a mesma coisa');
});

console.log('\n▶ teto: memória é lembrete, não transcrição');

test('estourou o teto, sai o MAIS ANTIGO', () => {
  const m = criarMemoria({ teto: 3 });
  for (const n of [1, 2, 3, 4]) m.lembrar({ categoria: 'fato', texto: `fato ${n}` });
  assert.deepEqual(m.estado.fato.map((i) => i.texto), ['fato 2', 'fato 3', 'fato 4']);
});

test('o teto e POR CATEGORIA: preferencia demais nao come os fatos', () => {
  const m = criarMemoria({ teto: 2 });
  m.lembrar({ categoria: 'fato', texto: 'processo de atendimento' });
  for (const n of [1, 2, 3]) m.lembrar({ categoria: 'preferencia', texto: `pref ${n}` });
  assert.equal(m.estado.fato.length, 1, 'o fato continua la');
  assert.equal(m.estado.preferencia.length, 2);
});

test('texto gigante e cortado antes de entrar', () => {
  const m = criarMemoria();
  m.lembrar({ categoria: 'fato', texto: 'x'.repeat(5000) });
  assert.ok(m.estado.fato[0].texto.length <= 200);
});

console.log('\n▶ o que foi guardado volta ao modelo');

test('a memoria entra no prompt com a CATEGORIA na frente', () => {
  const m = criarMemoria();
  m.lembrar({ categoria: 'preferencia', texto: 'responda curto' });
  m.lembrar({ categoria: 'fato', texto: 'processo de atendimento' });
  // A categoria vai no texto porque é ela que diz ao modelo se aquilo é algo que o aluno É, algo
  // DECIDIDO, ou um pedido sobre COMO responder.
  assert.deepEqual(m.paraOPrompt, ['fato: processo de atendimento', 'preferencia: responda curto']);

  const texto = renderizar(resolverContexto({ modo: 'texto', memoria: m.paraOPrompt }));
  assert.match(texto, /O que você já sabe desta conversa/);
  assert.match(texto, /preferencia: responda curto/);
});

test('a memoria e VOLATIL: nao viaja no setup, viaja no quadro', () => {
  const m = criarMemoria();
  m.lembrar({ categoria: 'fato', texto: 'processo de atendimento' });
  const ctx = resolverContexto({ modo: 'texto', memoria: m.paraOPrompt });
  const { systemInstruction } = promptDoPerfil(ctx);
  assert.ok(!systemInstruction.includes('processo de atendimento'),
    'no setup, a memoria ficaria congelada no momento em que a sessao abriu');
});

console.log('\n▶ quem decide guardar é o modelo');

test('`lembrar` e DECLARADA, com as categorias no enum', () => {
  const lembrar = FERRAMENTAS.find((f) => f.nome === 'lembrar').declaracao;
  assert.deepEqual(lembrar.parameters.properties.categoria.enum, [...CATEGORIAS]);
  assert.deepEqual(lembrar.parameters.required, ['categoria', 'texto']);
});

test('a politica e default-deny: nome fora do catalogo nao passa', () => {
  const noModelador = { perfil: 'texto', pagina: 'modelador' };
  assert.equal(permitida('lembrar', noModelador), true);
  assert.equal(permitida('descrever_diagrama', noModelador), true);
  assert.equal(permitida('apagar_tudo', noModelador), false);
  assert.equal(permitida('', noModelador), false);
  assert.equal(permitida(undefined, noModelador), false);
  // Sem contexto nenhum, o default e o caso MAIS restrito - e nao "passa tudo".
  assert.equal(permitida('apagar_tudo'), false);
});

test('os DOIS perfis declaram as ferramentas; so o texto declara a ENTREGA', () => {
  const nomes = (modo) => {
    const { setup } = buildSetup(promptDoPerfil(resolverContexto({ modo })));
    return setup.tools[0].functionDeclarations.map((f) => f.name);
  };
  assert.deepEqual(nomes('texto'), [DELIVERY_TOOL, 'lembrar', 'descrever_diagrama']);
  // ⚠ A voz declara ferramenta. A medicao do P1 ("declarar emudece") era sobre a ENTREGA, e foi
  // generalizada indevidamente (achado P6). O gate 4.3 mede isto ao vivo.
  assert.deepEqual(nomes('voz'), ['lembrar', 'descrever_diagrama']);
});

test('NENHUM codigo nosso decide memoria por palavra-chave', () => {
  // A mesma regra que proibe keyword->tool: classificar o texto do aluno para guardar seria
  // adivinhar intencao no codigo, e sao exatamente os casos ambiguos que o modelo resolve bem.
  const fonte = codigo('src/assistant/agent/memory.js') + codigo('src/assistant/session-manager.js');
  for (const suspeito of ['includes(\'lembr', 'match(/lembr', 'startsWith(\'lembr', '/prefir', '/gosto de']) {
    assert.ok(!fonte.includes(suspeito), `heuristica de memoria no codigo: ${suspeito}`);
  }
});

console.log('\n▶ morre com a aba');

test('nada de localStorage, sessionStorage ou rede na memoria', () => {
  const fonte = codigo('src/assistant/agent/memory.js');
  for (const proibido of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'document.cookie']) {
    assert.ok(!fonte.includes(proibido), `a memoria nao pode usar ${proibido}`);
  }
});

test('limpar zera tudo', () => {
  const m = criarMemoria();
  m.lembrar({ categoria: 'fato', texto: 'a' });
  m.limpar();
  assert.equal(m.total, 0);
  assert.deepEqual(m.paraOPrompt, []);
});

report('memoria');
