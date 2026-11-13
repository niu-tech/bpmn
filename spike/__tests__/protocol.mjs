/**
 * Protocolo Live — montagem do setup, frames de entrada, interpretação das respostas.
 * Sem chave, sem rede.
 *
 * Run: node spike/__tests__/protocol.mjs
 */
import assert from 'node:assert/strict';
import {
  CAPTURE_RATE, DELIVERY_TOOL, MODEL,
  buildAudioChunk, buildAudioStreamEnd, buildHistory, buildSetup, buildTextTurn,
  buildToolResponse, parseServerFrame, socketUrl,
} from '../../src/assistant/live/protocol.js';
// O prompt saiu do protocolo e virou contrato de secoes (F2). Aqui ele e so um argumento.
import { promptDoPerfil } from '../../src/assistant/agent/render.js';
import { resolverContexto } from '../../src/assistant/agent/resolve.js';

const TEXTO = promptDoPerfil(resolverContexto({ modo: 'texto' }));
const VOZ = promptDoPerfil(resolverContexto({ modo: 'voz' }));
import { test, report } from './mock-socket.mjs';

console.log('\n▶ setup');

test('pede AUDIO e nunca TEXT por default (o 3.8 recusa TEXT com 1007)', () => {
  const { setup } = buildSetup(TEXTO);
  assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
});

test('modelo e voz corretos', () => {
  const { setup } = buildSetup(TEXTO);
  assert.equal(setup.model, `models/${MODEL}`);
  assert.equal(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
});

test('languageCode OMITIDO (mandar locale enviesa a resposta para o ingles)', () => {
  const { setup } = buildSetup(TEXTO);
  assert.equal(setup.generationConfig.speechConfig.languageCode, undefined);
});

test('as duas transcricoes ligadas: entrada e saida', () => {
  const { setup } = buildSetup(TEXTO);
  assert.ok(setup.inputAudioTranscription);
  assert.ok(setup.outputAudioTranscription);
});

test('declara entregar_resposta com campo texto obrigatorio', () => {
  const { setup } = buildSetup(TEXTO);
  const decl = setup.tools[0].functionDeclarations[0];
  assert.equal(decl.name, DELIVERY_TOOL);
  assert.deepEqual(decl.parameters.required, ['texto']);
  assert.equal(decl.parameters.properties.texto.type, 'string');
});

test('modo TEXTO: declara a funcao E manda chamar', () => {
  const text = buildSetup(TEXTO).setup.systemInstruction.parts[0].text;
  assert.match(text, /BPMN/);
  assert.match(text, new RegExp(DELIVERY_TOOL));
});

test('sem prompt o setup RECUSA abrir (antes ele inventava um)', () => {
  // Era aqui que a armadilha vivia: o default era uma constante do proprio protocolo, e a
  // instrucao de entrega so era anexada quando o prompt recebido era IDENTICO a ela.
  assert.throws(() => buildSetup({ withDeliveryTool: true }), /sem prompt/);
  assert.throws(() => buildSetup({ systemInstruction: '   ' }), /sem prompt/);
});

test('modo VOZ: sem a funcao de ENTREGA, mas COM as ferramentas do catalogo', () => {
  // Medido em 2026-11-10: com a funcao de ENTREGA declarada o modelo nao fala (0 frames de
  // audio); sem ela fala e manda outputTranscription junto. Nao da para ter os dois no mesmo
  // turno - e e por isso que a entrega continua fora da voz.
  //
  // ⚠ O que mudou na F4: aquela medicao virou, por generalizacao, "qualquer declaracao emudece
  // o modelo" - e isso NAO foi medido (achado P6 da pesquisa de 2026-11-12). Agora a voz declara
  // as ferramentas de leitura e memoria, e o gate 4.3 mede ao vivo se ela continua falando. Se
  // emudecer, o registro vira regra; ate la, suposicao nao decide desenho.
  const { setup } = buildSetup(VOZ);
  const nomes = setup.tools[0].functionDeclarations.map((f) => f.name);
  assert.ok(!nomes.includes(DELIVERY_TOOL), 'a entrega emudece a voz: medido');
  assert.deepEqual(nomes, ['lembrar', 'descrever_diagrama', 'buscar_elemento', 'detalhar_elemento', 'resumir_simulacao']);
  assert.equal(setup.systemInstruction.parts[0].text, VOZ.systemInstruction);
  assert.ok(!setup.systemInstruction.parts[0].text.includes(DELIVERY_TOOL),
    'mandar chamar uma funcao nao declarada e pedir alucinacao');
});

test('sem ferramentas e sem entrega, o setup nao tem bloco de tools', () => {
  // A forma minima continua existindo - e e ela que o diagnostico usa.
  const { setup } = buildSetup({ systemInstruction: 'p', withDeliveryTool: false });
  assert.equal(setup.tools, undefined);
});

test('instrucao propria do chamador e respeitada, sem anexo surpresa', () => {
  const { setup } = buildSetup({ systemInstruction: 'instrucao minha' });
  assert.equal(setup.systemInstruction.parts[0].text, 'instrucao minha');
});

test('modo diagnostico consegue pedir TEXT de proposito (para medir o 1007)', () => {
  const { setup } = buildSetup({ ...VOZ, modalities: ['TEXT'], ferramentas: [] });
  assert.deepEqual(setup.generationConfig.responseModalities, ['TEXT']);
  assert.equal(setup.tools, undefined, 'a medicao do 1007 isola a modalidade, sem tools no meio');
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

test('audio vai em realtimeInput.audio, NAO em mediaChunks (medido: mediaChunks e ignorado em silencio)', () => {
  const frame = buildAudioChunk('QUJD').realtimeInput;
  assert.equal(frame.mediaChunks, undefined, 'a forma antiga e aceita sem erro e ignorada pelo servidor');
  assert.equal(frame.audio.mimeType, `audio/pcm;rate=${CAPTURE_RATE}`);
  assert.equal(frame.audio.data, 'QUJD');
});

test('existe um frame de FIM de fala (sem ele o servidor nao transcreve)', () => {
  assert.deepEqual(buildAudioStreamEnd(), { realtimeInput: { audioStreamEnd: true } });
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

test('frame vazio e noop (o servidor manda MUITOS: 20 de 64 numa sessao de voz)', () => {
  assert.equal(parseServerFrame({}).kind, 'noop');
  assert.equal(parseServerFrame({ serverContent: {} }).kind, 'noop');
});

test('sessionResumptionUpdate e reconhecido (nao vira ruido no log)', () => {
  const f = parseServerFrame({ sessionResumptionUpdate: { newHandle: 'h-1', resumable: true } });
  assert.equal(f.kind, 'resumption');
  assert.equal(f.handle, 'h-1');
  assert.equal(f.resumable, true);
});

test('generationComplete NAO fecha o turno (chega num frame proprio, antes do turnComplete)', () => {
  assert.equal(parseServerFrame({ serverContent: { generationComplete: true } }).kind, 'generation-complete');
});

test('audio e legenda no MESMO frame: os dois sao devolvidos', () => {
  const f = parseServerFrame({ serverContent: {
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }] },
    outputTranscription: { text: 'uma raia serve' } } });
  assert.equal(f.kind, 'audio');
  assert.equal(f.pcm16Base64, 'AAAA');
  assert.equal(f.text, 'uma raia serve', 'a legenda vinha junto e era descartada');
});

test('usageMetadata vem junto do turnComplete (custo e a cota do aluno)', () => {
  const f = parseServerFrame({ serverContent: { turnComplete: true }, usageMetadata: { totalTokenCount: 771 } });
  assert.equal(f.kind, 'turn-complete');
  assert.equal(f.usage.totalTokenCount, 771);
});

test('frame desconhecido nao e engolido em silencio', () => {
  assert.equal(parseServerFrame({ coisaNova: 1 }).kind, 'unknown');
  assert.equal(parseServerFrame('{{{').kind, 'unknown');
  assert.equal(parseServerFrame(null).kind, 'unknown');
});

report('protocol');
