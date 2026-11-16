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
  barraPara,
} from '../abertura.js';
import { declarada } from '../../assistant/agent/catalog.js';
import { FRASES, LIMITE_COMPOSITOR, NOME, O_QUE_E } from '../../assistant/identidade.js';
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

test('a barra do tutor aparece so quando ha o que dizer', () => {
  assert.equal(barraPara('exemplo'), 'exemplo');   // fala do exemplo
  assert.equal(barraPara('branco'), 'branco');     // "ver um exemplo" continua a um clique
  assert.equal(barraPara('restaurar'), null);      // o trabalho e' dela: nao ha' o que explicar
  assert.equal(barraPara('convite'), null);        // a tira so' aparece depois da escolha
});

test('a tela so promete "diz de onde tirou" porque a ferramenta existe', () => {
  // A linha de descoberta da tela base promete que o tutor cita a fonte. Isso so' e' verdade
  // porque a FK fechou e `consultar_norma` esta' declarada ao modelo (change
  // `add-bpmn-norm-knowledge-base`). Se a ferramenta sair do catalogo, esta promessa vira mentira
  // na PRIMEIRA tela do produto — e e' aqui que isso reprova, com o nome do arquivo a corrigir.
  assert.equal(declarada('consultar_norma'), true,
    'a tela base promete fonte: ou a ferramenta volta ao catalogo, ou o texto de tela.js muda');
});

test('toda frase semeada cabe em UMA linha do compositor', () => {
  // ⚠ ESTE TESTE EXISTE POR UM DEFEITO QUE O DONO VIU NA TELA (2026-11-16): a frase que a tela
  // escrevia no lugar dele tinha 47 caracteres e o compositor tem UMA linha — ela chegava cortada.
  // O limite nao e' preferencia de redacao: foi MEDIDO na pagina (caixa de 317 px, `clientHeight`
  // 40, `scrollHeight` 52 com a frase antiga). Frase nova que passe do teto reprova AQUI, com o
  // nome dela, em vez de aparecer cortada na frente de quem usa.
  for (const [chave, frase] of Object.entries(FRASES)) {
    assert.ok(frase.length <= LIMITE_COMPOSITOR,
      `FRASES.${chave} tem ${frase.length} caracteres e o compositor corta em ${LIMITE_COMPOSITOR}: "${frase}"`);
  }
});

test('o nome do agente e de papel: sem "IA" dentro, e com o escopo do produto', () => {
  // A capacidade e' dita na frase ao lado, nao empurrada para dentro do nome (design N1, e a
  // orientacao de design system em research.md §2). Se alguem trocar o nome por "Assistente de
  // IA", isto reprova — e e' de proposito: nome e' papel, capacidade e' descricao.
  assert.ok(/BPMN/.test(NOME), 'o nome escopa o agente ao produto');
  // Palavra por palavra, e nao busca de substring: "Guia BPMN" tem "ia" dentro e seria um nome
  // legitimo — o que se recusa aqui e' a PALAVRA "IA", nao duas letras no meio de outra.
  const palavras = NOME.split(/[^\p{L}]+/u).filter(Boolean);
  assert.ok(!palavras.some((p) => /^(ia|ias|ai)$/i.test(p)),
    `"${NOME}" nao deveria carregar "IA" no nome`);
  // E a frase ao lado carrega a CAPACIDADE, que e' a outra metade do pedido do dono: que ali tem
  // um agente de IA, e que ele ENSINA. O escopo (BPMN) nao se repete aqui — ja' esta' no nome.
  assert.ok(/IA/.test(O_QUE_E), `"${O_QUE_E}" precisa dizer que e' um agente de IA`);
  assert.ok(/ensin/i.test(O_QUE_E), `"${O_QUE_E}" precisa dizer que ele ensina`);
});

report('primeira-vez');
