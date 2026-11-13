/**
 * Barge-in local (H4) — o aluno falando por cima derruba a fala do modelo AQUI, sem esperar o
 * `interrupted` voltar do servidor.
 *
 * Por que isto é testado com números e não ao vivo: o cenário de barge-in da bateria media a
 * **calibração da fixture** — 16 s de silêncio calibrados quando o modelo falava aos 15 s, e em
 * 2026-11-13 ele falou aos 12,3 s e o corte caiu depois da resposta acabar. Limiar se prova com
 * limiar; o ao vivo prova que o caminho existe.
 *
 * Run: node src/assistant/__tests__/barge-in.mjs
 */
import assert from 'node:assert/strict';

import { criarDetectorDeFala, rmsDoQuadro, RMS_DE_FALA } from '../live/audio.js';
import { report, test } from '../../../tools/test-harness.mjs';

/** Quadro PCM16 com amplitude constante — o jeito mais direto de escolher o RMS. */
function quadro(amplitude, n = 640) {
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = i % 2 === 0 ? amplitude : -amplitude;
  return pcm;
}

(() => {
  test('o RMS cru nao tem a maquiagem do indicador', () => {
    // `nivelDoQuadro` tem duas raizes para a BARRA ter movimento; decidir com ele seria comparar
    // limiar contra numero maquiado — foi assim que a divida M6 comecou.
    assert.equal(rmsDoQuadro(quadro(0)), 0);
    assert.ok(Math.abs(rmsDoQuadro(quadro(32767)) - 1) < 0.001, 'fundo de escala da ~1');
    assert.ok(Math.abs(rmsDoQuadro(quadro(900)) - 900 / 32768) < 0.0005, 'amplitude 900 da RMS 900/32768');
  });

  test('ruido de sala NAO corta o ajudante', () => {
    const d = criarDetectorDeFala();
    // Metade do limiar, por muito tempo: e ventilador, nao aluno.
    for (let i = 0; i < 50; i++) assert.equal(d.quadro(RMS_DE_FALA / 2), false);
    assert.equal(d.quadrosAcima, 0);
  });

  test('um estalo NAO e uma interrupcao', () => {
    const d = criarDetectorDeFala();
    assert.equal(d.quadro(RMS_DE_FALA * 4), false, 'um quadro alto nao basta');
    assert.equal(d.quadro(RMS_DE_FALA / 10), false, 'o silencio seguinte zera a contagem');
    assert.equal(d.quadro(RMS_DE_FALA * 4), false, 'a contagem recomeca do zero');
    assert.equal(d.quadrosAcima, 1);
  });

  test('fala sustentada corta, e corta UMA vez', () => {
    const d = criarDetectorDeFala();
    const alto = RMS_DE_FALA * 3;
    assert.equal(d.quadro(alto), false);
    assert.equal(d.quadro(alto), false);
    assert.equal(d.quadro(alto), true, 'no terceiro quadro seguido, a fala se confirma');
    // Enquanto ele CONTINUA falando, nao se despeja um flush por quadro.
    for (let i = 0; i < 20; i++) assert.equal(d.quadro(alto), false, 'nao redispara enquanto fala');
  });

  test('depois de calar, uma fala nova corta de novo', () => {
    const d = criarDetectorDeFala();
    const alto = RMS_DE_FALA * 3;
    d.quadro(alto); d.quadro(alto); d.quadro(alto);
    for (let i = 0; i < 5; i++) d.quadro(0);          // o aluno parou
    assert.equal(d.quadro(alto), false);
    assert.equal(d.quadro(alto), false);
    assert.equal(d.quadro(alto), true, 'a segunda fala tambem corta');
  });

  test('reiniciar zera a contagem', () => {
    const d = criarDetectorDeFala();
    d.quadro(RMS_DE_FALA * 3);
    d.quadro(RMS_DE_FALA * 3);
    d.reiniciar();
    assert.equal(d.quadro(RMS_DE_FALA * 3), false, 'depois de reiniciar, conta do zero');
  });

  test('o limiar e ajustavel, e o default e o da capsula', () => {
    assert.ok(Math.abs(RMS_DE_FALA - 900 / 32768) < 1e-9, 'default = 900 na escala PCM16');
    const sensivel = criarDetectorDeFala({ limiar: 0.001, quadros: 1 });
    assert.equal(sensivel.quadro(0.002), true, 'limiar e numero de quadros sao do chamador');
  });

  report('barge-in');
})();
