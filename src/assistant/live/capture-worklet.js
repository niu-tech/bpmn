// PROVA A — captura do microfone: Float32 na taxa do dispositivo -> PCM16 mono 16 kHz em quadros
// de 40 ms, emitidos TRANSFERINDO o buffer (nada é copiado duas vezes).
//
// ⚠ AUTOSSUFICIENTE DE PROPÓSITO, sem nenhum `import`. O webpack trata este arquivo como ASSET e
// o copia VERBATIM (verificado: o `import` sobrevivia e o módulo importado não era emitido ao
// lado → `addModule` daria 404 em runtime). Então a matemática mora aqui, e o teste
// `__tests__/worklets.mjs` EXECUTA este arquivo com os globais do worklet esbulhados — a prova é
// sobre o arquivo que o navegador carrega, não sobre uma cópia paralela da conta.
//
// Desenho conferido contra `tools/cloud-desktop/voice-worklet.js` do CopilotSpeaker (em produção).

class BpmnCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const wanted = (options && options.processorOptions) || {};
    const outRate = wanted.rate || 16000;
    const frameMs = wanted.frameMs || 40;
    // `sampleRate` é global dentro do AudioWorkletGlobalScope.
    this.step = sampleRate / outRate;
    this.frameSamples = Math.max(160, Math.round((outRate * frameMs) / 1000));
    // Estado do reamostrador. Precisa ATRAVESSAR chamadas: o host entrega blocos de 128 amostras
    // e um quadro de 40 ms tem 640 — a conta nunca fecha dentro de um único `process`.
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
    this.out = new Int16Array(this.frameSamples);
    this.filled = 0;
    this.frames = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;   // sem entrada ainda: seguir vivo, não encerrar o nó

    for (let i = 0; i < input.length; i++) {
      this.sum += input[i];
      this.count++;
      this.phase++;
      if (this.phase < this.step) continue;
      this.phase -= this.step;

      // Média das amostras que esta saída abrange: passa-baixa de caixa. Grosseiro, e suficiente
      // para fala. O alternativo honesto seria um FIR; para 48k -> 16k de voz não paga o custo.
      const v = Math.max(-1, Math.min(1, this.sum / this.count));
      this.sum = 0;
      this.count = 0;
      // Fundo de escala assimétrico: o negativo vai a -32768, o positivo a +32767.
      this.out[this.filled++] = v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff);

      if (this.filled === this.frameSamples) {
        const full = this.out;
        this.out = new Int16Array(this.frameSamples);
        this.filled = 0;
        this.frames++;
        this.port.postMessage({ type: 'pcm', pcm: full.buffer, frames: this.frames }, [full.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('bpmn-capture', BpmnCapture);
