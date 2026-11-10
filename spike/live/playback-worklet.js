// PROVA B — reprodução. Ring BOUNDED + prime + reamostragem linear 24 kHz -> taxa do contexto,
// com underflow e overflow CONTADOS (underflow que ninguém conta é underflow que ninguém
// descobre) e `flush` para cancelamento/barge-in.
//
// Mesmo desenho do playback validado em produção no CopilotSpeaker
// (`src/CopilotSpeaker.Games.Gateway/Assets/npc-voice/worklet.js`), reduzido ao que a prova pede:
// as marcas de "primeira amostra audível" ficaram, porque é a única medição honesta de latência.

class BpmnPlayback extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const po = options?.processorOptions ?? {};
    // `||` nas taxas (uma taxa 0 não tem significado, então cai no default), mas `??` no prime:
    // `primeMs: 0` é um pedido LEGÍTIMO de começar sem buffer, e `|| 120` o trocava em silêncio
    // por 120 ms. Pego por teste.
    this.srcRate = po.sourceRate || 24000;
    this.step = this.srcRate / sampleRate;
    this.ring = new Float32Array(this.srcRate * 8);   // ~8 s: teto, não fila infinita
    this.w = 0; this.r = 0; this.size = 0; this.pos = 0;
    this.written = 0; this.consumed = 0;
    this.primeSamples = Math.round(((po.primeMs ?? 120) * this.srcRate) / 1000);
    this.primed = false;
    this.underflows = 0;
    this.overflowDropped = 0;
    this.marks = [];

    this.port.onmessage = (e) => {
      const d = e.data;
      if (!d) return;
      if (d.type === 'pcm') this.push(new Int16Array(d.pcm));
      else if (d.type === 'mark') this.marks.push({ id: d.id, at: this.written });
      else if (d.type === 'flush') {
        // Cancelamento: o que já estava no ar não pode sair depois da interrupção.
        this.size = 0; this.r = this.w; this.pos = 0; this.primed = false;
        this.consumed = this.written; this.marks = [];
      } else if (d.type === 'stats') {
        this.port.postMessage({
          type: 'stats',
          bufferedMs: Math.round((this.size / this.srcRate) * 1000),
          underflows: this.underflows,
          overflowDropped: this.overflowDropped,
          primed: this.primed,
        });
      }
    };
  }

  push(int16) {
    const len = this.ring.length;
    for (let i = 0; i < int16.length; i++) {
      if (this.size === len) {
        // Cheio: o mais antigo sai. Perder o começo é melhor que crescer sem teto.
        this.r = (this.r + 1) % len; this.size--; this.overflowDropped++; this.consumed++;
      }
      this.ring[this.w] = int16[i] / 32768;
      this.w = (this.w + 1) % len;
      this.size++; this.written++;
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0]?.[0];
    if (!out) return true;

    if (!this.primed) {
      if (this.size >= this.primeSamples) this.primed = true;
      else { out.fill(0); return true; }
    }

    const len = this.ring.length;
    for (let i = 0; i < out.length; i++) {
      if (this.size < 2) {
        for (let j = i; j < out.length; j++) out[j] = 0;
        this.underflows++;
        this.primed = false;   // volta a esperar o buffer de partida
        break;
      }
      const a = this.ring[this.r];
      const b = this.ring[(this.r + 1) % len];
      out[i] = a * (1 - this.pos) + b * this.pos;
      this.pos += this.step;
      while (this.pos >= 1 && this.size > 0) {
        this.pos -= 1;
        this.r = (this.r + 1) % len;
        this.size--; this.consumed++;
      }
    }

    while (this.marks.length && this.consumed > this.marks[0].at) {
      this.port.postMessage({ type: 'audible', id: this.marks.shift().id });
    }
    return true;
  }
}

registerProcessor('bpmn-playback', BpmnPlayback);
