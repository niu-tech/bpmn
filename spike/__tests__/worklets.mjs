/**
 * Os DOIS worklets, executados de verdade.
 *
 * Por que assim: o webpack copia arquivo de worklet VERBATIM (asset), então ele tem de ser
 * autossuficiente — sem `import`. Testar uma cópia paralela da matematica provaria a copia, nao o
 * arquivo que o navegador carrega. Aqui os globais do AudioWorkletGlobalScope sao esbulhados
 * (`AudioWorkletProcessor`, `registerProcessor`, `sampleRate`) e o PROPRIO arquivo roda.
 *
 * Run: node spike/__tests__/worklets.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { report, test } from './mock-socket.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const liveDir = resolve(here, '../../src/assistant/live');

/**
 * Carrega um worklet com os globais do escopo de worklet e devolve a classe registrada.
 * Usa `new Function` sobre o texto do arquivo: e exatamente o arquivo do disco que roda.
 */
function loadWorklet(file, { sampleRate = 48000 } = {}) {
  const source = readFileSync(join(liveDir, file), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source),
    `${file} nao pode ter import: o webpack copia o worklet verbatim e o import daria 404`);

  const registered = {};
  class AudioWorkletProcessor {
    constructor() {
      const self = this;
      this.port = {
        posted: [],
        onmessage: null,
        postMessage(data, transfer) { self.port.posted.push({ data, transfer }); },
        close() { self.port.closed = true; },
      };
    }
  }
  const registerProcessor = (name, ctor) => { registered[name] = ctor; };
  // eslint-disable-next-line no-new-func
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', source)(
    AudioWorkletProcessor, registerProcessor, sampleRate,
  );
  const names = Object.keys(registered);
  assert.equal(names.length, 1, `${file} deveria registrar exatamente 1 processor`);
  return { name: names[0], Ctor: registered[names[0]] };
}

/** Quadros Int16 que o worklet postou, na ordem. */
const framesOf = (node) => node.port.posted
  .filter((m) => m.data?.type === 'pcm')
  .map((m) => new Int16Array(m.data.pcm));

console.log('\n▶ capture-worklet (PROVA A)');

const capture = loadWorklet('capture-worklet.js');

test('registra bpmn-capture', () => {
  assert.equal(capture.name, 'bpmn-capture');
});

test('48 kHz -> 16 kHz: 1920 amostras de entrada = 1 quadro de 640 (40 ms)', () => {
  const node = new capture.Ctor({ processorOptions: { rate: 16000, frameMs: 40 } });
  assert.equal(node.process([[new Float32Array(1920)]]), true);
  const frames = framesOf(node);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].length, 640);
});

test('a fase ATRAVESSA chamadas: 15 blocos de 128 fecham exatamente 1 quadro', () => {
  const node = new capture.Ctor({ processorOptions: {} });
  for (let i = 0; i < 15; i++) node.process([[new Float32Array(128)]]);   // 15*128 = 1920
  assert.equal(framesOf(node).length, 1);
});

test('o buffer e TRANSFERIDO (nao copiado) junto com a mensagem', () => {
  const node = new capture.Ctor({ processorOptions: {} });
  node.process([[new Float32Array(1920)]]);
  const msg = node.port.posted.find((m) => m.data?.type === 'pcm');
  assert.deepEqual(msg.transfer, [msg.data.pcm], 'o ArrayBuffer deve ir na lista de transferencia');
});

test('sinal constante atravessa o passa-baixa sem distorcer', () => {
  const node = new capture.Ctor({ processorOptions: {} });
  node.process([[new Float32Array(1920).fill(0.5)]]);
  const [frame] = framesOf(node);
  assert.equal(frame[0], Math.round(0.5 * 0x7fff));
  assert.equal(frame[639], Math.round(0.5 * 0x7fff));
});

test('fundo de escala assimetrico e sem estouro (-1 -> -32768, +1 -> +32767)', () => {
  const low = new capture.Ctor({ processorOptions: {} });
  low.process([[new Float32Array(1920).fill(-1)]]);
  assert.equal(framesOf(low)[0][0], -32768);
  const high = new capture.Ctor({ processorOptions: {} });
  high.process([[new Float32Array(1920).fill(1)]]);
  assert.equal(framesOf(high)[0][0], 32767);
});

test('44,1 kHz tambem fecha quadros, sem acumular erro em 10 s', () => {
  const { Ctor } = loadWorklet('capture-worklet.js', { sampleRate: 44100 });
  const node = new Ctor({ processorOptions: {} });
  for (let i = 0; i < 1000; i++) node.process([[new Float32Array(441)]]);   // 10 s
  const frames = framesOf(node).length;
  assert.ok(Math.abs(frames - 250) <= 1, `esperava ~250 quadros de 40 ms, veio ${frames}`);
});

test('entrada ausente nao encerra o no nem emite quadro', () => {
  const node = new capture.Ctor({ processorOptions: {} });
  assert.equal(node.process([[]]), true);
  assert.equal(node.process([]), true);
  assert.equal(framesOf(node).length, 0);
});

test('o contador de quadros e monotonico', () => {
  const node = new capture.Ctor({ processorOptions: {} });
  node.process([[new Float32Array(1920 * 3)]]);
  const counts = node.port.posted.filter((m) => m.data?.type === 'pcm').map((m) => m.data.frames);
  assert.deepEqual(counts, [1, 2, 3]);
});

console.log('\n▶ playback-worklet (PROVA B)');

const playback = loadWorklet('playback-worklet.js');

/** Instancia e devolve o no + atalhos para empurrar e consumir. */
function player({ sampleRate = 24000, primeMs = 120, rePrimeMs, maxSeconds } = {}) {
  const { Ctor } = loadWorklet('playback-worklet.js', { sampleRate });
  const node = new Ctor({ processorOptions: { sourceRate: 24000, primeMs, rePrimeMs, maxSeconds } });
  const out = new Float32Array(128);
  return {
    node,
    send: (msg, transfer) => node.port.postMessage ? node.port.onmessage({ data: msg }, transfer) : null,
    push: (int16) => node.port.onmessage({ data: { type: 'pcm', pcm: int16.buffer } }),
    pull: () => { out.fill(0); node.process([], [[out]]); return Float32Array.from(out); },
    msgs: () => node.port.posted.map((m) => m.data),
  };
}

/**
 * A FALA TRAVANDO (relato do dono, 2026-11-11: "para de falar durante um periodo, um segundo, ou
 * um pouco mais"). Um furo no meio da frase zerava `primed` e obrigava a encher o buffer de
 * PARTIDA inteiro de novo - com a rajada do servidor, isso vira um buraco audivel por furo.
 * Agora recuperar tem limiar PROPRIO, mais curto.
 */
test('depois de um furo, recupera com o limiar CURTO (nao com o de partida)', () => {
  const p = player({ primeMs: 240, rePrimeMs: 40 });   // 240ms=5760 amostras, 40ms=960
  const quadro = (n, v = 1000) => { const a = new Int16Array(n); a.fill(v); return a; };

  p.push(quadro(5760));                 // enche a partida
  p.pull();                             // ja toca
  for (let i = 0; i < 60; i++) p.pull();  // drena ate o furo
  p.node.port.onmessage({ data: { type: 'stats' } });
  assert.ok(p.msgs().at(-1).underflows > 0, 'o teste precisa MESMO passar por um furo');

  // Chega 1 quadro de 100 ms: acima do limiar de recuperacao (40 ms) e MUITO abaixo do de
  // partida (240 ms). Com um limiar so, isto ficaria mudo.
  p.push(quadro(2400));
  const saida = p.pull();
  assert.ok(saida.some((v) => v !== 0), 'tinha de voltar a falar com 100 ms no buffer');
});

test('rePrimeMs default e metade da partida', () => {
  const p = player({ primeMs: 200 });
  assert.equal(p.node.rePrimeSamples, Math.round((100 * 24000) / 1000));
});

test('flush NAO deixa o estado de recuperacao ligado', () => {
  const p = player({ primeMs: 40, rePrimeMs: 10 });
  const a = new Int16Array(240); a.fill(900);
  p.push(a);
  for (let i = 0; i < 20; i++) p.pull();          // forca furo
  p.node.port.onmessage({ data: { type: 'flush' } });
  assert.equal(p.node.recuperando, false, 'interrupcao e comeco novo, nao continuacao de furo');
});

/**
 * O ATROPELO (relato do dono, 2026-11-14, com a voz nova: "ela vai cortando em pedacos muito
 * pequenos e vai falando por cima dela mesma... o inicio fala bem, o meio embola").
 *
 * O desenho tinha um teto de 8 s no anel, e o Gemini Live entrega o turno INTEIRO em rajada -
 * ele gera audio mais rapido que o tempo real. Uma resposta de 30 s chega em poucos segundos,
 * o leitor sai a 1x, e o escritor passa por cima: a politica de cheio descartava o MAIS ANTIGO,
 * ou seja, o pedaco que ainda ia ser falado. Dai o inicio sair certo (cabe nos 8 s), o meio
 * virar picote e o fim voltar.
 *
 * Estes dois casos sao a prova: nenhuma amostra pode ser descartada, e a fala tem de sair
 * INTEIRA e EM ORDEM.
 */
test('turno longo em RAJADA nao perde amostra (o atropelo de 2026-11-14)', () => {
  const p = player({ primeMs: 240, rePrimeMs: 120 });
  const quadro = (n, v) => { const a = new Int16Array(n); a.fill(v); return a; };

  // 30 s de fala a 24 kHz, em quadros de ~860 ms - a forma medida no portao F7 (29 quadros
  // para uma resposta de ~25 s). Tudo empurrado ANTES de tocar, que e como a rajada chega.
  const porQuadro = Math.round(24000 * 0.86);
  const quantos = Math.ceil((24000 * 30) / porQuadro);
  for (let i = 0; i < quantos; i++) p.push(quadro(porQuadro, 1000 + i));

  p.node.port.onmessage({ data: { type: 'stats' } });
  const stats = p.msgs().at(-1);
  assert.equal(stats.overflowDropped, 0,
    `a rajada perdeu ${stats.overflowDropped} amostras antes de tocar (anel pequeno demais)`);
});

test('a fala sai INTEIRA e em ordem: nenhum pedaco sumido, nenhum repetido', () => {
  const p = player({ primeMs: 240, rePrimeMs: 120 });
  // Cada quadro tem um valor proprio: da para ver, na saida, se algum sumiu ou voltou atras.
  const porQuadro = Math.round(24000 * 0.86);
  const quantos = 35;
  for (let i = 0; i < quantos; i++) {
    const a = new Int16Array(porQuadro); a.fill((i + 1) * 100);
    p.push(a);
  }

  // Drena tudo, em blocos de 128 como o navegador faz.
  const vistos = [];
  for (let i = 0; i < 40000; i++) {
    const bloco = p.pull();
    for (const v of bloco) {
      const marca = Math.round((v * 32768) / 100);
      if (marca > 0 && vistos.at(-1) !== marca) vistos.push(marca);
    }
    if (vistos.length === quantos && p.node.size === 0) break;
  }

  // Os valores de marca, na ordem em que sairam, sem a interpolacao entre dois quadros.
  const ordem = vistos.filter((v, i) => i === 0 || v !== vistos[i - 1]);
  assert.deepEqual(ordem, Array.from({ length: quantos }, (_, i) => i + 1),
    'a fala saiu picotada ou fora de ordem');
});

test('registra bpmn-playback', () => {
  assert.equal(playback.name, 'bpmn-playback');
});

test('antes do prime a saida e SILENCIO (nao chia nem toca meio quadro)', () => {
  const p = player({ primeMs: 120 });   // 120 ms a 24 kHz = 2880 amostras
  p.push(Int16Array.from({ length: 480 }, () => 10000));   // 20 ms: insuficiente
  assert.ok(p.pull().every((v) => v === 0), 'deveria estar em silencio esperando o prime');
});

test('depois do prime a saida toca de verdade', () => {
  const p = player({ primeMs: 120 });
  p.push(Int16Array.from({ length: 4000 }, () => 10000));
  assert.ok(p.pull().some((v) => Math.abs(v) > 0.2), 'deveria ter audio audivel');
});

test('underflow e CONTADO e volta a esperar o prime', () => {
  const p = player({ primeMs: 10 });
  p.push(Int16Array.from({ length: 300 }, () => 10000));
  for (let i = 0; i < 20; i++) p.pull();        // drena ate faltar dado
  p.node.port.onmessage({ data: { type: 'stats' } });
  const stats = p.msgs().find((m) => m.type === 'stats');
  assert.ok(stats.underflows > 0, 'underflow tem de ser contado, nao silenciado');
  assert.equal(stats.primed, false, 'deveria ter voltado a esperar o buffer de partida');
});

// O teto EXISTE (memoria tem de ter limite), mas o tamanho mudou de 8 s para 60 s em
// 2026-11-14: com 8 s ele comia o MEIO de toda resposta longa, que e o bug do atropelo.
// Aqui o anel e miniatura (1 s) de proposito - o que se prova e a barreira, nao o tamanho.
test('overflow DESCARTA o mais antigo em vez de crescer sem teto', () => {
  const p = player({ primeMs: 0, maxSeconds: 1 });
  const ringSamples = 24000 * 1;
  p.push(Int16Array.from({ length: ringSamples + 5000 }, () => 10000));
  p.node.port.onmessage({ data: { type: 'stats' } });
  const stats = p.msgs().find((m) => m.type === 'stats');
  assert.ok(stats.overflowDropped >= 5000, `esperava descarte, veio ${stats.overflowDropped}`);
  assert.ok(stats.bufferedMs <= 1000, 'o buffer nao pode passar do teto do ring');
});

test('flush descarta o que nao saiu (cancelamento / barge-in)', () => {
  const p = player({ primeMs: 10 });
  p.push(Int16Array.from({ length: 4000 }, () => 10000));
  p.node.port.onmessage({ data: { type: 'flush' } });
  p.node.port.onmessage({ data: { type: 'stats' } });
  const stats = p.msgs().find((m) => m.type === 'stats');
  assert.equal(stats.bufferedMs, 0, 'o buffer tem de ficar vazio depois do flush');
  assert.ok(p.pull().every((v) => v === 0), 'nenhuma amostra antiga pode sair depois do flush');
});

test('a marca avisa quando a PRIMEIRA amostra daquele trecho sai de fato', () => {
  const p = player({ primeMs: 0 });
  p.node.port.onmessage({ data: { type: 'mark', id: 'trecho-1' } });
  p.push(Int16Array.from({ length: 2000 }, () => 10000));
  for (let i = 0; i < 5; i++) p.pull();
  const audible = p.msgs().filter((m) => m.type === 'audible').map((m) => m.id);
  assert.deepEqual(audible, ['trecho-1']);
});

test('flush tambem limpa as marcas pendentes (nao avisa audivel do que foi cancelado)', () => {
  const p = player({ primeMs: 0 });
  p.node.port.onmessage({ data: { type: 'mark', id: 'cancelado' } });
  p.push(Int16Array.from({ length: 2000 }, () => 10000));
  p.node.port.onmessage({ data: { type: 'flush' } });
  for (let i = 0; i < 5; i++) p.pull();
  assert.equal(p.msgs().filter((m) => m.type === 'audible').length, 0);
});

test('reamostra 24 kHz -> 48 kHz consumindo METADE das amostras por bloco', () => {
  const p = player({ sampleRate: 48000, primeMs: 0 });
  p.push(Int16Array.from({ length: 2400 }, () => 10000));
  p.pull();                                   // 128 amostras de saida a 48 kHz
  p.node.port.onmessage({ data: { type: 'stats' } });
  const stats = p.msgs().find((m) => m.type === 'stats');
  const consumedMs = 100 - stats.bufferedMs;   // 2400 amostras = 100 ms
  // 128 amostras a 48 kHz = 2,67 ms de saida -> ~64 amostras-fonte = ~2,67 ms de fonte.
  assert.ok(consumedMs >= 2 && consumedMs <= 4, `consumo fora da faixa: ${consumedMs} ms`);
});

test('mensagem desconhecida nao derruba o processor', () => {
  const p = player({ primeMs: 0 });
  p.node.port.onmessage({ data: { type: 'coisa-nova' } });
  p.node.port.onmessage({ data: null });
  p.push(Int16Array.from({ length: 1000 }, () => 10000));
  assert.ok(p.pull().some((v) => Math.abs(v) > 0.1));
});

report('worklets');
