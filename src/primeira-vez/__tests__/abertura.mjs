/**
 * A decisão de abertura do modelador (change `introduce-bpmn-first-run-workspace`).
 *
 * O que se mede aqui é a REGRA, não a tela: quem desenha o convite é `tela.js`, e quem o prova é
 * a bateria, no navegador. Esta suíte existe porque o defeito que a change corrige era uma regra
 * — "não achei nada salvo ⇒ carregue a pizzaria" — e regra se prova sem navegador.
 *
 * Run: node src/primeira-vez/__tests__/abertura.mjs
 */
import assert from 'node:assert/strict';

import {
  ATALHO_EXEMPLO,
  CHAVE_ESCOLHA,
  decidirAbertura,
  escolhaValida,
  tiraPara,
} from '../abertura.js';
import { declarada } from '../../assistant/agent/catalog.js';
import { report, test } from '../../../tools/test-harness.mjs';

const PIZZA = '<?xml version="1.0"?><definitions/>';

test('primeira visita: ninguem escolheu nada, entao o convite', () => {
  assert.equal(decidirAbertura({}), 'convite');
  assert.equal(decidirAbertura({ salvo: null, escolha: null, atalho: '' }), 'convite');
});

test('primeira visita NAO carrega o exemplo', () => {
  // O defeito que a change corrige, em uma linha: ausencia de arquivo virava ordem de abrir
  // trabalho alheio.
  assert.notEqual(decidirAbertura({}), 'exemplo');
});

test('quem tem trabalho salvo abre o proprio trabalho', () => {
  assert.equal(decidirAbertura({ salvo: PIZZA }), 'restaurar');
  // e o convite nao aparece nem quando havia uma escolha anterior
  assert.equal(decidirAbertura({ salvo: PIZZA, escolha: 'exemplo' }), 'restaurar');
});

test('escolheu comecar do zero e fechou sem desenhar: continua em branco', () => {
  // O caso que exige a chave propria: o autosave so' escreve em `commandStack.changed`, entao
  // quem nao desenhou nao deixa rastro nenhum — e receberia o convite de novo para sempre.
  assert.equal(decidirAbertura({ salvo: null, escolha: 'branco' }), 'branco');
});

test('entrou pelo tutor: a tela continua em branco na volta', () => {
  assert.equal(decidirAbertura({ salvo: null, escolha: 'tutor' }), 'branco');
});

test('escolheu o exemplo: o exemplo volta, sem convite', () => {
  assert.equal(decidirAbertura({ salvo: null, escolha: 'exemplo' }), 'exemplo');
});

test('escolha desconhecida nao decide nada', () => {
  // Chave adulterada, versao antiga, outra aba: nada disso pode virar uma abertura silenciosa.
  for (const lixo of ['pizza', '', ' branco', 'EXEMPLO', '{}', null, undefined, 0]) {
    assert.equal(decidirAbertura({ escolha: lixo }), 'convite', `escolha=${String(lixo)}`);
  }
});

test('o atalho abre o exemplo direto, e vence ate o trabalho salvo', () => {
  assert.equal(decidirAbertura({ atalho: ATALHO_EXEMPLO }), 'exemplo');
  assert.equal(decidirAbertura({ salvo: PIZZA, atalho: ATALHO_EXEMPLO }), 'exemplo');
});

test('outro hash qualquer nao e o atalho', () => {
  assert.equal(decidirAbertura({ atalho: '#exemplos' }), 'convite');
  assert.equal(decidirAbertura({ atalho: '#' }), 'convite');
  assert.equal(decidirAbertura({ salvo: PIZZA, atalho: '#outro' }), 'restaurar');
});

test('a funcao e pura: nao le nem escreve estado', () => {
  // Sem `localStorage` e sem `location` neste processo. Se a regra os tocasse, isto explodiria.
  assert.equal(typeof globalThis.localStorage, 'undefined');
  assert.equal(decidirAbertura({ escolha: 'exemplo' }), 'exemplo');
});

test('a chave da escolha e vizinha do autosave, e nao a mesma', () => {
  assert.equal(CHAVE_ESCOLHA, 'bpmn.primeira-vez');
  assert.notEqual(CHAVE_ESCOLHA, 'bpmn.autosave.xml');
});

test('escolhaValida recusa o que nao e caminho', () => {
  assert.equal(escolhaValida('exemplo'), true);
  assert.equal(escolhaValida('branco'), true);
  assert.equal(escolhaValida('tutor'), true);
  assert.equal(escolhaValida('convite'), false);
  assert.equal(escolhaValida('restaurar'), false);
});

test('a tira diz o que esta aberto, e so quando ha o que dizer', () => {
  assert.equal(tiraPara('exemplo'), 'exemplo');   // "isto e' um exemplo"
  assert.equal(tiraPara('branco'), 'branco');     // "ver um exemplo" continua a um clique
  assert.equal(tiraPara('restaurar'), null);      // o trabalho e' dela: nao ha' o que explicar
  assert.equal(tiraPara('convite'), null);        // a tira so' aparece depois da escolha
});

test('a tela so promete "diz de onde tirou" porque a ferramenta existe', () => {
  // A linha de descoberta da tela base promete que o tutor cita a fonte. Isso so' e' verdade
  // porque a FK fechou e `consultar_norma` esta' declarada ao modelo (change
  // `add-bpmn-norm-knowledge-base`). Se a ferramenta sair do catalogo, esta promessa vira mentira
  // na PRIMEIRA tela do produto — e e' aqui que isso reprova, com o nome do arquivo a corrigir.
  assert.equal(declarada('consultar_norma'), true,
    'a tela base promete fonte: ou a ferramenta volta ao catalogo, ou o texto de tela.js muda');
});

report('primeira-vez');
