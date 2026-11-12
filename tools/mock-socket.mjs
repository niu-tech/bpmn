// Dublê de WebSocket e relógio controlado — infraestrutura de TESTE compartilhada.
//
// ⚠ Mora em `tools/` e não em `spike/` por causa de uma invariante do repositório: nenhum arquivo
// de `src/` pode referenciar `spike/` (o guard `nenhum arquivo de src/ referencia spike/` em
// `spike/__tests__/audio-and-safety.mjs` falha se isso acontecer). Quando os testes do produto
// passaram a precisar do mesmo dublê, mover foi a saída certa — a alternativa seria duplicar o
// mock ou enfraquecer o guard, e as duas são piores.


export class MockSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 0;
    this.closed = null;
    MockSocket.instances.push(this);
  }

  /** O código em teste registra os handlers; o teste dispara os eventos. */
  send(payload) {
    if (this.readyState === 3) throw new Error('socket fechado');
    this.sent.push(JSON.parse(payload));
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.closed = { code, reason };
  }

  // --- gatilhos do teste ---

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  /** Entrega um frame do servidor (objeto; o código aceita string e objeto). */
  emit(frame) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  serverClose(code, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  error(message = 'falhou') {
    this.onerror?.({ message, target: { url: this.url } });
  }

  // --- leitura pelo teste ---

  /** Os frames enviados que têm a chave `name` no topo. */
  framesOf(name) {
    return this.sent.filter((f) => Object.prototype.hasOwnProperty.call(f, name));
  }

  get setup() {
    return this.sent[0]?.setup ?? null;
  }
}

/** Fábrica para injetar em `createSession({ socketFactory })`. */
export function mockFactory() {
  MockSocket.instances = [];
  return (url) => new MockSocket(url);
}

/** Relógio controlado: nada de `setTimeout` real nos testes. */
export function fakeClock() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    /** Dispara todos os timers pendentes, uma vez. */
    flush() {
      const due = [...timers.entries()];
      timers.clear();
      for (const [, t] of due) t.fn();
      return due.length;
    },
    get pending() { return timers.size; },
  };
}

// O mini-harness mora em `tools/test-harness.mjs`. Reexportado aqui por conveniência.
export { report, test, testAsync } from './test-harness.mjs';
