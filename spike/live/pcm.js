// Conversão base64 <-> PCM16 para o MAIN THREAD (o que `audio.js` usa para enviar o microfone e
// receber o áudio do modelo).
//
// A matemática do reamostrador NÃO mora aqui: ela está dentro de `capture-worklet.js`, que é
// autossuficiente por obrigação do build (o webpack copia o worklet verbatim, então `import` lá
// dentro daria 404). O teste `__tests__/worklets.mjs` executa o worklet de verdade.
//
// ponytail: um arquivo sem dependência nenhuma.

/** Int16Array -> base64, como `realtimeInput.mediaChunks` pede. */
export function pcm16ToBase64(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa no navegador; Buffer no node (os testes).
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

/** base64 -> Int16Array, para o áudio que o modelo devolve (24 kHz). */
export function base64ToPcm16(b64) {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }
  const buf = Buffer.from(b64, 'base64');
  // Buffer.from pode devolver uma view de um pool compartilhado: copiar antes de reinterpretar,
  // senão o Int16Array enxerga bytes de outra alocação.
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return new Int16Array(copy.buffer);
}

/** Float [-1,1] -> Int16, com fundo de escala assimétrico. Mesma conta do worklet de captura. */
export function floatToPcm16(value) {
  const v = Math.max(-1, Math.min(1, value));
  return v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff);
}
