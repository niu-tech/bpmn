/**
 * Bloco 4 — o diário das corridas (H5): a invariante é que áudio, parcial e segredo NÃO entram.
 *
 * Run: node src/assistant/__tests__/diario.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ler, registrar, resumo } from '../../../tools/ledger.mjs';
import { report, test } from '../../../tools/test-harness.mjs';

const dir = mkdtempSync(join(tmpdir(), 'bpmn-diario-'));
const arq = join(dir, 'corridas.jsonl');

(() => {
  test('registra o essencial, e carimba a hora', () => {
    const l = registrar({ corrida: 'c1', cenario: 'portao F6', ok: true, resposta: 'existe sim' }, arq);
    assert.equal(l.cenario, 'portao F6');
    assert.equal(l.ok, true);
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(l.quando), 'a data e o que torna o registro citavel');
  });

  test('AUDIO nao entra, nem disfarcado', () => {
    // A invariante mora no codigo, nao na boa intencao de quem chama: na capsula de onde isto vem
    // ela era do esquema do banco (nao havia coluna para audio); aqui e lista branca de campos.
    const l = registrar({
      corrida: 'c2', cenario: 'voz', ok: true,
      audio: 'AAAABBBB', pcm: [1, 2, 3], base64: 'xxx', wav: 'arquivo.wav',
      resposta: { texto: 'ok', audioDoModelo: 'AAAA', quadros: 12 },
    }, arq);
    const bruto = JSON.stringify(l);
    for (const proibido of ['audio', 'pcm', 'base64', 'wav', 'AAAABBBB']) {
      assert.ok(!bruto.includes(proibido), `vazou "${proibido}" no registro: ${bruto}`);
    }
    assert.equal(l.resposta.quadros, 12, 'o que nao e proibido continua entrando');
  });

  test('chave e token nunca entram', () => {
    const l = registrar({ corrida: 'c3', cenario: 'x', ok: false, chave: 'AIzaSEGREDO', token: 'abc' }, arq);
    assert.ok(!JSON.stringify(l).includes('AIzaSEGREDO'));
    assert.ok(!('chave' in l) && !('token' in l));
  });

  test('texto PARCIAL nao entra: diario e prova, e parcial nao prova', () => {
    const l = registrar({ corrida: 'c4', cenario: 'y', ok: true, parcial: 'pensan…', resposta: 'final' }, arq);
    assert.ok(!('parcial' in l));
    assert.equal(l.resposta, 'final');
  });

  test('campo desconhecido e descartado em silencio, sem derrubar nada', () => {
    const l = registrar({ corrida: 'c5', cenario: 'z', ok: true, inventado: 'nao deveria entrar' }, arq);
    assert.ok(!('inventado' in l));
  });

  test('resposta gigante e cortada, nao guardada inteira', () => {
    const l = registrar({ corrida: 'c6', cenario: 'w', ok: true, resposta: 'x'.repeat(5000) }, arq);
    assert.ok(l.resposta.length <= 2001, `guardou ${l.resposta.length} caracteres`);
  });

  test('e append-only: a corrida seguinte NAO apaga a anterior', () => {
    // E o motivo do diario existir: `resultado.json` e sobrescrito a cada corrida, e "o portao F6
    // passou ao vivo" precisa de um registro com data que ninguem apagou ao rodar de novo.
    const antes = ler(arq).length;
    registrar({ corrida: 'c7', cenario: 'portao F6', ok: false }, arq);
    assert.equal(ler(arq).length, antes + 1);
    assert.ok(ler(arq).some((l) => l.corrida === 'c1'), 'a primeira corrida continua la');
  });

  test('o resumo conta por cenario', () => {
    const r = resumo(arq);
    assert.equal(r.corridas, ler(arq).length);
    const f6 = r.porCenario.find((c) => c.cenario === 'portao F6');
    assert.equal(f6.corridas, 2, 'duas corridas do mesmo cenario');
    assert.equal(f6.passaram, 1, 'uma passou, uma nao - e as duas ficaram registradas');
  });

  test('diario inexistente le vazio, em vez de estourar', () => {
    assert.deepEqual(ler(join(dir, 'nao-existe.jsonl')), []);
    assert.equal(resumo(join(dir, 'nao-existe.jsonl')).corridas, 0);
  });

  rmSync(dir, { recursive: true, force: true });
  report('diario');
})();
