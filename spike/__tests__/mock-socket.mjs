// Ponteiro. O dublê de socket e o relógio controlado moram em `tools/mock-socket.mjs`, porque os
// testes do PRODUTO também precisam deles e `src/` não pode referenciar `spike/` (guard em
// `audio-and-safety.mjs`). Mantido aqui para os testes do spike não mudarem de import.
export { MockSocket, mockFactory, fakeClock, report, test, testAsync } from '../../tools/mock-socket.mjs';
