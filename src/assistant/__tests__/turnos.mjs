/**
 * RastreadorDeTurnos — fronteira do turno, fala em fragmentos e uma execução por chamada.
 *
 * ⚠ Os três primeiros blocos são os testes da `WikiAgentCapsule` (CP7.6) trazidos junto com o
 * módulo: quem porta o código sem portar a prova fica com a prova do autor antigo e o defeito do
 * novo. Os blocos seguintes são deste projeto — o caso que a nossa transcrição de entrada produz.
 *
 * Run: node src/assistant/__tests__/turnos.mjs
 */
import assert from 'node:assert/strict';

import { EventoDeFala, RastreadorDeTurnos } from '../live/turn-tracker.js';
import { report, test } from '../../../tools/test-harness.mjs';

(() => {
  // ---- A. fragmento NÃO é fala final -----------------------------------------------------------

  test('fragmento so emite provisorio; o final vem do sinal do servidor', () => {
    const vistos = [];
    const r = new RastreadorDeTurnos({ onFala: (f) => vistos.push(f) });

    r.fragmentoDeEntrada('Consegue me dizer sobre');
    assert.equal(r.estaFalando, true, 'ainda compondo depois do primeiro fragmento');
    assert.ok(vistos.every((f) => f.tipo === EventoDeFala.Provisorio), 'fragmento nunca emite final');

    r.fragmentoDeEntrada('Consegue me dizer sobre o ecossistema da Orbit?');   // cumulativo
    const fim = r.fecharFala('activityEnd');

    const finais = vistos.filter((f) => f.tipo === EventoDeFala.Final);
    assert.equal(finais.length, 1, 'exatamente uma fala final');
    assert.equal(fim.texto, 'Consegue me dizer sobre o ecossistema da Orbit?', 'o final e a frase inteira');
    assert.ok(!/Consegue me dizer sobre Consegue/.test(fim.texto), 'o cumulativo nao e colado em si mesmo');
    assert.equal(r.fecharFala('turnComplete'), null, 'fechar duas vezes nao emite um segundo final');
  });

  // ---- B. velho por turno ----------------------------------------------------------------------

  test('evento preso a um turno ja substituido e velho', () => {
    const r = new RastreadorDeTurnos();
    const antigo = r.turno;
    r.abrirTurno();
    assert.equal(r.eVelho(antigo), true, 'o turno anterior ficou velho');
    assert.equal(r.eVelho(r.turno), false, 'o turno atual nao e velho');
    assert.equal(r.classificarChamada(antigo, 'fc1').acao, 'velho', 'chamada presa a turno velho e recusada');
  });

  // ---- C. uma execução por {turno, chamada} ----------------------------------------------------

  test('a mesma chamada repetida reaproveita o resultado, nao bate na ferramenta de novo', () => {
    const r = new RastreadorDeTurnos();
    let batidas = 0;
    const executar = (id) => {
      const d = r.classificarChamada(r.turno, id);
      if (d.acao !== 'executar') return d;
      batidas++;
      return { ...d, resultado: r.concluirChamada(d.chave, { elemento: 'Task_1' }) };
    };

    executar('call-1');
    const repetida = executar('call-1');
    executar('call-2');

    assert.equal(batidas, 2, 'uma batida por id distinto');
    assert.equal(repetida.acao, 'repetir', 'o id duplicado e classificado como repeticao');
    assert.equal(repetida.resultado?.elemento, 'Task_1', 'a repeticao reusa o resultado memorizado');
    assert.equal(r.chamadasExecutadas, 2, 'a contagem bate com os ids distintos');
  });

  // ---- D. o caso DESTE projeto: a pergunta picada em bolhas -------------------------------------

  test('fala com pausas vira UMA frase, nao uma bolha por pausa', () => {
    // O `session-manager` empurrava uma bolha a cada fragmento. Com fixture curta isso nao aparecia;
    // com fala de verdade, o aluno via a propria pergunta picada.
    const vistos = [];
    const r = new RastreadorDeTurnos({ onFala: (f) => vistos.push(f) });

    for (const pedaco of ['O que e', 'O que e um gateway', 'O que e um gateway exclusivo?']) {
      r.fragmentoDeEntrada(pedaco);
    }
    const fim = r.fecharFala('turnComplete');

    assert.equal(fim.texto, 'O que e um gateway exclusivo?');
    assert.equal(vistos.filter((f) => f.tipo === EventoDeFala.Final).length, 1, 'uma bolha fechada, nao tres');
    assert.equal(vistos.filter((f) => f.tipo === EventoDeFala.Provisorio).length, 3, 'tres atualizacoes da MESMA bolha');
  });

  test('delta de verdade e cumulativo convivem na mesma fala', () => {
    const r = new RastreadorDeTurnos();
    r.fragmentoDeEntrada('Quantas ');          // delta
    r.fragmentoDeEntrada('Quantas tarefas');   // cumulativo
    r.fragmentoDeEntrada(' tem aqui?');        // delta
    assert.equal(r.fecharFala().texto, 'Quantas tarefas tem aqui?');
  });

  test('fala vazia nao fecha bolha nenhuma', () => {
    const r = new RastreadorDeTurnos();
    assert.equal(r.fragmentoDeEntrada(''), null, 'fragmento vazio e ignorado');
    assert.equal(r.fecharFala(), null, 'sem fala, nao ha final');
    assert.equal(r.estaFalando, false);
  });

  test('turno novo zera a fala, e o que sobrou do anterior nao vaza', () => {
    const r = new RastreadorDeTurnos();
    r.fragmentoDeEntrada('pergunta anterior');
    const anterior = r.turno;
    r.abrirTurno();
    assert.equal(r.falaAtual, '', 'a fala do turno novo comeca vazia');
    assert.equal(r.eVelho(anterior), true);
    assert.equal(r.fecharFala(), null, 'sem fala no turno novo, nada e emitido');
  });

  report('turnos');
})();
