/**
 * Bloco 2 — honestidade do que aparece: canais (H2) e apresentador de ferramenta (H3).
 *
 * Run: node src/assistant/__tests__/canais.mjs
 */
import assert from 'node:assert/strict';

import { citacoesFaladas, contarCitacoesFaladas, instrucaoDeCanais } from '../agent/fala.js';
import { linhaDeFim, linhaDeInicio } from '../tools/apresentador.js';
import { report, test } from '../../../tools/test-harness.mjs';

(() => {
  // ---- H2: o que soa como maquina --------------------------------------------------------------

  test('id de elemento falado e contado', () => {
    assert.equal(contarCitacoesFaladas('Isto e a tarefa [_6-638] do seu processo.'), 1);
    assert.equal(contarCitacoesFaladas('O fluxo liga Task_1 a Gateway_0x9f.'), 2);
    assert.deepEqual(citacoesFaladas('a tarefa [_6-638]'), ['[_6-638]']);
  });

  test('explicacao limpa nao acusa nada', () => {
    const boa = 'Isto e uma tarefa chamada "Select a pizza". Em BPMN, tarefas representam trabalho.';
    assert.equal(contarCitacoesFaladas(boa), 0);
  });

  test('caminho, JSON e bloco de codigo tambem contam', () => {
    assert.ok(contarCitacoesFaladas('veja em docs/bpmn/guia.md') > 0);
    assert.ok(contarCitacoesFaladas('devolveu {"total": 47}') > 0);
    assert.ok(contarCitacoesFaladas('```js\nconst a = 1;\n```') > 0);
  });

  test('texto vazio e ausente nao quebram a conta', () => {
    for (const v of ['', null, undefined]) {
      assert.equal(contarCitacoesFaladas(v), 0);
      assert.deepEqual(citacoesFaladas(v), []);
    }
  });

  test('a instrucao de canais fala de NOME, que e a alternativa', () => {
    const t = instrucaoDeCanais();
    assert.ok(/NOME/.test(t), 'dizer o que NAO fazer sem dizer o que fazer nao muda comportamento');
    assert.ok(/tela/i.test(t), 'o id nao some: ele vai para a tela');
  });

  // ---- H3: o apresentador ----------------------------------------------------------------------

  test('enquanto roda, a linha diz o que esta acontecendo', () => {
    assert.equal(linhaDeInicio('buscar_elemento'), 'procurando no diagrama…');
    assert.equal(linhaDeInicio('descrever_diagrama'), 'olhando o diagrama…');
    // Ferramenta desconhecida nao quebra a tela.
    assert.ok(linhaDeInicio('ferramenta_nova').includes('ferramenta_nova'));
  });

  test('o ENVELOPE do despachante e desembrulhado, e nao lido como resultado', () => {
    // Visto ao vivo: lendo `{ok, resultado}` como se fosse o resultado, a busca dizia "na amostra"
    // quando varre o diagrama inteiro. Os testes nao pegaram porque alimentavam a forma crua.
    const r = { procurou: { termo: 'pizza order' }, varreuODiagramaInteiro: true, total: 0, elementos: [], cortou: 0 };
    const linha = linhaDeFim('buscar_elemento', { termo: 'pizza order' }, { ok: true, resultado: r });
    assert.ok(linha.includes('diagrama inteiro'), `leu o envelope como resultado: ${linha}`);
    assert.ok(!linha.includes('amostra'), linha);
  });

  test('a busca DIZ que varreu o diagrama inteiro', () => {
    // E o que separa "nao achei" de "nao existe" (contrato H13). Esconder isso faz o aluno ler a
    // amostra como se fosse o diagrama.
    const r = { procurou: { termo: 'pizza' }, varreuODiagramaInteiro: true, total: 3, elementos: [1, 2, 3], cortou: 0 };
    const linha = linhaDeFim('buscar_elemento', { termo: 'pizza' }, { ok: true, resultado: r });
    assert.ok(linha.includes('diagrama inteiro'), linha);
    assert.ok(linha.includes('3 resultados'), linha);
  });

  test('busca sem resultado diz "nada", e ainda assim diz ONDE procurou', () => {
    const r = { procurou: { termo: 'xyz' }, varreuODiagramaInteiro: true, total: 0, elementos: [], cortou: 0 };
    const linha = linhaDeFim('buscar_elemento', {}, { ok: true, resultado: r });
    assert.ok(linha.includes('nada'), linha);
    assert.ok(linha.includes('diagrama inteiro'), linha);
  });

  test('resultado cortado mostra que ha mais do que cabe', () => {
    const r = { procurou: { termo: 'task' }, varreuODiagramaInteiro: true, total: 47, elementos: new Array(20), cortou: 27 };
    const linha = linhaDeFim('buscar_elemento', {}, { ok: true, resultado: r });
    assert.ok(linha.includes('47 resultados'), linha);
    assert.ok(linha.includes('mostrando 20'), linha);
  });

  test('a simulacao AVISA quando o diagrama mudou depois da corrida', () => {
    const r = { replicacoes: 5, gargalo: { nome: 'Assar' }, diagramaMudouDepoisDaCorrida: true };
    const linha = linhaDeFim('resumir_simulacao', {}, { ok: true, resultado: r });
    assert.ok(linha.includes('Assar'), linha);
    assert.ok(/mudou depois/.test(linha), 'numero velho sem aviso e numero errado');
  });

  test('falha vira frase, nao codigo de erro', () => {
    const linha = linhaDeFim('buscar_elemento', {}, { ok: false, erro: 'ferramenta_nao_roteada' });
    assert.ok(!linha.includes('ferramenta_nao_roteada'), 'codigo interno nao diz nada ao aluno');
    assert.ok(linha.includes('não deu'), linha);
  });

  test('o apresentador NUNCA derruba a conversa', () => {
    // Resultado com forma inesperada: linha generica, sem excecao.
    const esquisito = { entradas: { nao: 'e um array' } };
    assert.doesNotThrow(() => linhaDeFim('detalhar_elemento', {}, { ok: true, resultado: esquisito }));
    assert.doesNotThrow(() => linhaDeFim('ferramenta_que_nao_existe', null, null));
  });

  test('a linha NUNCA e JSON cru', () => {
    // O defeito que o apresentador existe para matar: despejar o payload na tela.
    const r = { procurou: { termo: 'a' }, varreuODiagramaInteiro: true, total: 2, elementos: [{ id: 'Task_1' }], cortou: 0 };
    const linha = linhaDeFim('buscar_elemento', {}, { ok: true, resultado: r });
    assert.equal(contarCitacoesFaladas(linha.replace(/"[^"]*"/g, '')), 0, `a linha vazou estrutura: ${linha}`);
    assert.ok(!linha.includes('{'), linha);
  });

  report('canais');
})();
