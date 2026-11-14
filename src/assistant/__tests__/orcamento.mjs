/**
 * Bloco 3 — orçamento e diagnóstico do prompt (H8), idioma como valor (H9) e memória que não
 * esquece em silêncio (H10).
 *
 * Run: node src/assistant/__tests__/orcamento.mjs
 */
import assert from 'node:assert/strict';

import { diagnosticoDoPrompt, renderizar } from '../agent/render.js';
import { IDIOMA_PADRAO } from '../agent/sections.js';
import { criarMemoria } from '../agent/memory.js';
import { report, test } from '../../../tools/test-harness.mjs';

const ctx = (extra = {}) => ({ perfil: 'texto', ...extra });

(() => {
  // ---- H8: o diagnostico ------------------------------------------------------------------

  test('o diagnostico conta o que o prompt de fato levou', () => {
    const d = diagnosticoDoPrompt(ctx());
    assert.ok(d.caracteres > 0);
    assert.equal(d.caracteres, renderizar(ctx()).length, 'a conta e sobre o prompt REAL');
    assert.ok(d.secoes.length >= 5, 'uma entrada por secao renderizada');
    assert.ok(d.secoes.every((s) => s.id && s.caracteres > 0));
  });

  test('sem corte, nada aparece como cortado', () => {
    const d = diagnosticoDoPrompt(ctx());
    assert.deepEqual(d.cortadas, []);
    assert.equal(d.caracteresCortados, 0);
  });

  test('diagrama grande DENUNCIA o corte, em vez de truncar calado', () => {
    // O teto por secao ja cortava e ja avisava no texto; o que faltava era alguem SOMAR. Sem isto,
    // um diagrama grande empurrava o quadro para perto do limite e a unica pista era a resposta
    // do modelo ficar estranha.
    // A forma e a da PROJECAO (`agent/diagram.js`), nao uma invencao do teste: `amostra`, nao
    // `elementos`. Alimentar o teste com uma forma que o produto nunca produz e o erro de fixture
    // que ja custou um defeito ao vivo nesta semana.
    const enorme = {
      total: 400,
      amostra: Array.from({ length: 400 }, (_, i) => ({ id: `Task_${i}`, tipo: 'Task', nome: `Tarefa numero ${i} com um nome bem longo` })),
    };
    const d = diagnosticoDoPrompt(ctx({ diagrama: enorme }));
    assert.ok(d.caracteresCortados > 0, 'um diagrama de 400 elementos nao cabe inteiro');
    assert.ok(d.cortadas.some((c) => c.id === 'diagrama'), `cortou outra coisa: ${JSON.stringify(d.cortadas)}`);
    assert.ok(renderizar(ctx({ diagrama: enorme })).includes('cortado'), 'o corte e dito no proprio texto');
  });

  test('o diagnostico separa as camadas', () => {
    // So ha diferenca entre as camadas quando existe dado VOLATIL: sem diagrama aberto, o volatil
    // nao renderiza nada e as duas contas batem - o que e o comportamento certo, nao um bug.
    const comDiagrama = ctx({ diagrama: { total: 2, amostra: [{ id: 'A', tipo: 'Task', nome: 'uma' }] } });
    const so = diagnosticoDoPrompt(comDiagrama, { tier: 'estavel' });
    assert.equal(so.tier, 'estavel');
    assert.ok(so.secoes.every((s) => s.tier === 'estavel'));
    assert.ok(so.caracteres < diagnosticoDoPrompt(comDiagrama).caracteres, 'o volatil soma');
    assert.equal(diagnosticoDoPrompt(ctx(), { tier: 'estavel' }).caracteres, diagnosticoDoPrompt(ctx()).caracteres,
      'sem diagrama, nao ha volatil para somar');
  });

  // ---- H9: idioma como valor ---------------------------------------------------------------

  test('o idioma vem do contexto, e o padrao continua pt-BR', () => {
    assert.ok(renderizar(ctx()).includes(IDIOMA_PADRAO), 'sem declarar, responde em pt-BR');
    const outro = renderizar(ctx({ idioma: 'español' }));
    assert.ok(outro.includes('español'), 'o contexto manda');
    assert.ok(!outro.includes(IDIOMA_PADRAO), 'e nao sobra a lingua antiga no meio');
  });

  test('a ancora de idioma e dita DUAS vezes, como antes', () => {
    // A ancora so funciona repetida no fim: o diagrama costuma estar em ingles e puxa o modelo.
    const p = renderizar(ctx({ idioma: 'português do Brasil' }));
    const vezes = (p.match(/português do Brasil/g) ?? []).length;
    assert.ok(vezes >= 2, `a lingua aparece ${vezes}x; precisa da repeticao no fim`);
  });

  // ---- H10: memoria que nao esquece calada -------------------------------------------------

  test('o teto descarta o mais antigo, e DIZ que descartou', () => {
    const m = criarMemoria({ teto: 3 });
    for (let i = 1; i <= 3; i++) m.lembrar({ categoria: 'fato', texto: `fato ${i}` });
    assert.equal(m.esquecidos.total, 0, 'ate o teto, nada se perde');

    const r = m.lembrar({ categoria: 'fato', texto: 'fato 4' });
    assert.equal(r.ok, true);
    assert.equal(r.esqueceu, 1, 'o resultado da ferramenta avisa o MODELO');
    assert.equal(m.esquecidos.fato, 1);
    assert.equal(m.esquecidos.total, 1);
    assert.ok(!m.paraOPrompt.some((l) => l.includes('fato 1')), 'o mais antigo saiu mesmo');
  });

  test('repetir o mesmo lembrete nao conta como esquecimento', () => {
    const m = criarMemoria({ teto: 2 });
    m.lembrar({ categoria: 'decisao', texto: 'usar gateway exclusivo' });
    const r = m.lembrar({ categoria: 'decisao', texto: 'Usar Gateway Exclusivo' });
    assert.equal(r.repetido, true);
    assert.equal(m.esquecidos.total, 0);
  });

  test('cada categoria tem o proprio teto, e o proprio rastro', () => {
    const m = criarMemoria({ teto: 1 });
    m.lembrar({ categoria: 'fato', texto: 'a' });
    m.lembrar({ categoria: 'fato', texto: 'b' });
    m.lembrar({ categoria: 'preferencia', texto: 'curto' });
    assert.equal(m.esquecidos.fato, 1);
    assert.equal(m.esquecidos.preferencia, 0, 'encher fato nao derruba preferencia');
  });

  test('erro de uso nao mexe no rastro', () => {
    const m = criarMemoria({ teto: 1 });
    m.lembrar({ categoria: 'inventada', texto: 'x' });
    m.lembrar({ categoria: 'fato', texto: '' });
    assert.equal(m.esquecidos.total, 0);
    assert.equal(m.total, 0);
  });

  report('orcamento');
})();
