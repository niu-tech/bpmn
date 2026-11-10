/**
 * Protocolo Live — montagem do setup, frames de entrada, interpretação das respostas.
 * Sem chave, sem rede.
 *
 * Run: node spike/__tests__/protocol.mjs
 */
import assert from 'node:assert/strict';
import {
  CAPTURE_RATE, DELIVERY_TOOL, MODEL, buildAudioChunk, buildHistory, buildSetup,
  buildTextTurn, buildToolResponse, parseServerFrame, socketUrl,
} from '../live/protocol.js';
import { test, report } from './mock-socket.mjs';

console.log('\n▶ setup');

test('pede AUDIO e nunca TEXT por default (o 3.8 recusa TEXT com 1007)', () => {
  const { setup } = buildSetup();
  assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
});

test('modelo e voz corretos', () => {
  const { setup } = buildSetup();
  assert.equal(setup.model, `models/${MODEL}`);
  assert.equal(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
});

test('languageCode OMITIDO (mandar locale enviesa a resposta para o ingles)', () => {
  const { setup } = buildSetup();
  assert.equal(setup.generationConfig.speechConfig.languageCode, undefined);
});

test('as duas transcricoes ligadas: entrada e saida', () => {
  const { setup } = buildSetup();
  assert.ok(setup.inputAudioTranscription);
  assert.ok(setup.outputAudioTranscription);
});

test('declara entregar_resposta com campo texto obrigatorio', () => {
  const { setup } = buildSetup();
  const decl = setup.tools[0].functionDeclarations[0];
  assert.equal(decl.name, DELIVERY_TOOL);
  assert.deepEqual(decl.parameters.required, ['texto']);
  assert.equal(decl.parameters.properties.texto.type, 'string');
});

test('systemInstruction e de dominio BPMN e manda chamar a funcao', () => {
  const text = buildSetup().setup.systemInstruction.parts[0].text;
  assert.match(text, /BPMN/);
  assert.match(text, new RegExp(DELIVERY_TOOL));
});

test('modo diagnostico consegue pedir TEXT de proposito (para medir o 1007)', () => {
  const { setup } = buildSetup({ modalities: ['TEXT'], withDeliveryTool: false });
  assert.deepEqual(setup.generationConfig.responseModalities, ['TEXT']);
  assert.equal(setup.tools, undefined);
});

console.log('\n▶ url');

test('chave vai na query string, escapada', () => {
  assert.match(socketUrl('a b+c/d'), /\?key=a%20b%2Bc%2Fd$/);
});

test('sem chave, falha alto em vez de conectar anonimo', () => {
  assert.throws(() => socketUrl(''), /credencial/);
});

console.log('\n▶ frames de entrada');

test('pergunta digitada vai por realtimeInput.text', () => {
  assert.deepEqual(buildTextTurn('oi'), { realtimeInput: { text: 'oi' } });
});

test('audio vai com mimeType declarando 16 kHz', () => {
  const chunk = buildAudioChunk('QUJD').realtimeInput.mediaChunks[0];
  assert.equal(chunk.mimeType, `audio/pcm;rate=${CAPTURE_RATE}`);
  assert.equal(chunk.data, 'QUJD');
});

test('historico vai por clientContent SEM fechar o turno', () => {
  const h = buildHistory([{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }]).clientContent;
  assert.equal(h.turnComplete, false);
  assert.equal(h.turns[1].parts[0].text, 'b');
});

test('toolResponse espelha id e nome de cada chamada', () => {
  const r = buildToolResponse([{ id: 'x1', name: DELIVERY_TOOL }]).toolResponse.functionResponses[0];
  assert.equal(r.id, 'x1');
  assert.equal(r.name, DELIVERY_TOOL);
});

console.log('\n▶ interpretacao das respostas');

test('setupComplete vira ready', () => {
  assert.equal(parseServerFrame({ setupComplete: {} }).kind, 'ready');
});

test('texto da entrega sai dos ARGUMENTOS da funcao', () => {
  const f = parseServerFrame({
    toolCall: { functionCalls: [{ id: 'c1', name: DELIVERY_TOOL, args: { texto: 'Gateway exclusivo escolhe um caminho.' } }] },
  });
  assert.equal(f.kind, 'tool-call');
  assert.equal(f.delivery, 'Gateway exclusivo escolhe um caminho.');
  assert.equal(f.calls[0].id, 'c1');
});

test('tool que nao e a entrega nao produz texto, mas ainda exige resposta', () => {
  const f = parseServerFrame({ toolCall: { functionCalls: [{ id: 'c9', name: 'outra', args: {} }] } });
  assert.equal(f.kind, 'tool-call');
  assert.equal(f.delivery, null);
  assert.equal(f.calls.length, 1);
});

test('audio inline e reconhecido', () => {
  const f = parseServerFrame({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'AAAA' } }] } } });
  assert.equal(f.kind, 'audio');
  assert.equal(f.pcm16Base64, 'AAAA');
});

test('transcricoes dos dois lados sao distinguidas', () => {
  assert.equal(parseServerFrame({ serverContent: { inputTranscription: { text: 'oi' } } }).kind, 'input-text');
  assert.equal(parseServerFrame({ serverContent: { outputTranscription: { text: 'ola' } } }).kind, 'output-text');
});

test('interrupted e reconhecido (barge-in descarta o buffer)', () => {
  assert.equal(parseServerFrame({ serverContent: { interrupted: true } }).kind, 'interrupted');
});

test('turnComplete normal fecha o turno', () => {
  const f = parseServerFrame({ serverContent: { turnComplete: true } });
  assert.equal(f.kind, 'turn-complete');
  assert.equal(f.idle, true);
});

test('turnComplete com IN_PROGRESS NAO fecha (e so o enchimento)', () => {
  const f = parseServerFrame({ serverContent: { turnComplete: true, interactionStatus: 'IN_PROGRESS' } });
  assert.equal(f.kind, 'turn-complete');
  assert.equal(f.idle, false);
});

test('IDLE sem turnComplete tambem fecha', () => {
  assert.equal(parseServerFrame({ serverContent: { interactionStatus: 'IDLE' } }).idle, true);
});

test('goAway e reconhecido', () => {
  assert.equal(parseServerFrame({ goAway: { timeLeft: '10s' } }).timeLeft, '10s');
});

test('frame desconhecido nao e engolido em silencio', () => {
  assert.equal(parseServerFrame({ coisaNova: 1 }).kind, 'unknown');
  assert.equal(parseServerFrame('{{{').kind, 'unknown');
  assert.equal(parseServerFrame(null).kind, 'unknown');
});

report('protocol');
