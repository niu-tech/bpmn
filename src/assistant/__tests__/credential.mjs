/**
 * BYOK — a chave e do ALUNO, so na memoria da aba, e nada conecta sem consentimento.
 *
 * Run: node src/assistant/__tests__/credential.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCredentialStore } from '../credential.js';
import { calcularReserva } from '../layout.js';
import { forgetSecrets, looksLikeSecret, redact } from '../live/redact.js';
import { codigoSemComentarios as codigo, report, test } from '../../../tools/test-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const CHAVE = 'AQ.CHAVE-SINTETICA-DE-TESTE-NAO-E-DE-NINGUEM-0123456';

console.log('\n▶ guarda da credencial');

test('comeca sem chave e sem consentimento: nada pronto', () => {
  const c = createCredentialStore();
  assert.equal(c.hasKey, false);
  assert.equal(c.consented, false);
  assert.equal(c.ready, false);
  assert.equal(c.use(), null);
});

test('chave curta demais e recusada, e nada fica guardado', () => {
  const c = createCredentialStore();
  const r = c.set('abc');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'too-short');
  assert.equal(c.hasKey, false);
  assert.equal(c.use(), null);
});

test('chave aceita fica disponivel so por use()', () => {
  const c = createCredentialStore();
  assert.equal(c.set(CHAVE).ok, true);
  assert.equal(c.hasKey, true);
  assert.equal(c.use(), CHAVE);
  forgetSecrets();
});

test('chave sem consentimento NAO esta pronta (fail closed)', () => {
  const c = createCredentialStore();
  c.set(CHAVE);
  assert.equal(c.ready, false, 'sem aceitar o aviso, nao conecta');
  c.setConsent(true);
  assert.equal(c.ready, true);
  forgetSecrets();
});

test('consentimento sem chave tambem nao basta', () => {
  const c = createCredentialStore();
  c.setConsent(true);
  assert.equal(c.ready, false);
});

test('guardar a chave JA a registra no redator (antes de qualquer conexao)', () => {
  const c = createCredentialStore();
  c.set(CHAVE);
  const texto = `falhou com ${CHAVE} no meio`;
  assert.ok(!texto.includes('***'), 'premissa do teste');
  assert.equal(redact(texto), 'falhou com *** no meio');
  assert.equal(looksLikeSecret(redact(texto)), false);
  forgetSecrets();
});

test('clear apaga da memoria E do redator, e e idempotente', () => {
  // Valor que NENHUM padrao de formato reconhece: e o unico jeito de provar que o que mascarava
  // era o REGISTRO, e nao a regra por formato.
  const opaca = 'chave-de-formato-que-ninguem-preve-98765';
  const c = createCredentialStore();
  c.set(opaca);
  c.setConsent(true);
  assert.equal(redact(`vazou ${opaca}`), 'vazou ***', 'enquanto registrada, mascara');
  c.clear();
  c.clear();
  assert.equal(c.hasKey, false);
  assert.equal(c.use(), null);
  assert.equal(redact(`vazou ${opaca}`), `vazou ${opaca}`, 'sem registro, o redator nao conhece mais');
});

test('recusa do servidor marca o estado e PRESERVA a chave para o aluno corrigir', () => {
  const c = createCredentialStore();
  c.set(CHAVE);
  c.markRejected();
  assert.equal(c.lastRejection, 'bad-key');
  assert.equal(c.hasKey, true, 'apagar a chave aqui obrigaria a redigitar tudo');
  forgetSecrets();
});

test('trocar a chave substitui, e a antiga para de ser reconhecida', () => {
  const antiga = 'antiga-opaca-sem-formato-conhecido-4321';
  const nova = 'nova-opaca-sem-formato-conhecido-8765';
  const c = createCredentialStore();
  c.set(antiga);
  c.clear();
  c.set(nova);
  assert.equal(c.use(), nova);
  assert.equal(redact(`era ${antiga}`), `era ${antiga}`, 'a antiga saiu do redator');
  assert.equal(redact(`agora ${nova}`), 'agora ***');
  forgetSecrets();
});

test('onChange avisa a UI sem NUNCA carregar o valor', () => {
  const vistos = [];
  const c = createCredentialStore({ onChange: (v) => vistos.push(v) });
  c.set(CHAVE);
  c.setConsent(true);
  assert.equal(vistos.length, 2);
  assert.deepEqual(Object.keys(vistos[0]).sort(), ['consented', 'hasKey', 'lastRejection']);
  assert.ok(!JSON.stringify(vistos).includes(CHAVE), 'o valor nao pode viajar no evento');
  forgetSecrets();
});

console.log('\n▶ ausencia de persistencia (por codigo, nao por promessa)');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== '__tests__') out.push(...walk(full)); }
    else if (/\.(js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
const fontes = walk(join(root, 'src', 'assistant'));

test('nenhum modulo do ajudante toca armazenamento do navegador', () => {
  const proibido = /localStorage|sessionStorage|indexedDB|document\.cookie|caches\./;
  const culpados = fontes.filter((f) => proibido.test(codigo(f)))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(culpados, [], `persistencia proibida em: ${culpados.join(', ')}`);
});

test('a credencial nao tem load(): nao ha de onde carregar', () => {
  const src = codigo(join(root, 'src/assistant/credential.js'));
  assert.ok(!/\bload\s*\(/.test(src), 'um load() seria o comeco da persistencia');
});

test('nenhuma chave real mora no codigo do ajudante', () => {
  const formato = /AIza[0-9A-Za-z_-]{10,}|\bAQ\.[0-9A-Za-z_.-]{20,}/;
  const culpados = fontes.filter((f) => {
    // o proprio redator cita os formatos nos padroes; isso nao e uma chave
    return formato.test(codigo(f)) && !f.endsWith('redact.js');
  }).map((f) => f.slice(root.length + 1));
  assert.deepEqual(culpados, [], `parece credencial em: ${culpados.join(', ')}`);
});

test('o campo da chave e password e nao guarda o valor depois de usado', () => {
  const widget = readFileSync(join(root, 'src/assistant/ui/widget.js'), 'utf8');
  assert.match(widget, /type:\s*'password'/, 'a chave tem de ser mascarada na tela');
  assert.match(widget, /autocomplete:\s*'off'/, 'o navegador nao pode guardar o campo');
  assert.match(widget, /keyInput\.value\s*=\s*''/, 'o campo tem de ser limpo apos guardar');
});

test('a chave nunca e escrita na URL da APLICACAO', () => {
  // A chave vai na query do WebSocket do Google (contrato do Live, risco declarado em design D2),
  // e isso e outra coisa: nenhum modulo pode mexer no endereco da PAGINA.
  const proibido = /location\.(search|hash|href)\s*=|history\.(push|replace)State/;
  const culpados = fontes.filter((f) => proibido.test(codigo(f)))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(culpados, [], `mexe na URL da pagina: ${culpados.join(', ')}`);
});



console.log('\n▶ reserva do rodape em tela estreita (medido em 375x812)');

test('tela larga: cada um no seu canto, sem reserva', () => {
  assert.equal(calcularReserva({ larguraJanela: 1280, alturaJanela: 900, alturaBarra: 51 }), 14);
});

test('tela estreita com a barra COLAPSADA (51 px) reserva a faixa inteira', () => {
  assert.equal(calcularReserva({ larguraJanela: 375, alturaJanela: 812, alturaBarra: 51 }), 75);
});

test('tela estreita com a barra EXPANDIDA (265 px) reserva a barra INTEIRA', () => {
  // Um teto fixo de 120 px deixava o cabecalho da barra coberto — e e la que fica o botao de
  // recolher. Cobrir o unico jeito de recolher a barra trava o modelador.
  assert.equal(calcularReserva({ larguraJanela: 375, alturaJanela: 812, alturaBarra: 265 }), 289);
});

test('barra absurda nao espreme o painel abaixo do usavel', () => {
  const r = calcularReserva({ larguraJanela: 375, alturaJanela: 812, alturaBarra: 900 });
  assert.equal(r, 812 - 320);
  assert.ok(812 - r >= 320, 'sobra pelo menos a altura minima util do painel');
});

test('sem barra no rodape, nada a reservar', () => {
  assert.equal(calcularReserva({ larguraJanela: 375, alturaJanela: 812, alturaBarra: 0 }), 14);
});

test('tela minuscula nao produz reserva negativa', () => {
  assert.ok(calcularReserva({ larguraJanela: 320, alturaJanela: 300, alturaBarra: 51 }) >= 14);
});

report('credential');
