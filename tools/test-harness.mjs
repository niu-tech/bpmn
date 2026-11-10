// Mini-harness de testes do repositorio. Sem dependencia, sem runner, sem config.
//
// Existe porque o repositorio ja testava assim (scripts `.mjs` rodados por `node` direto, em
// `src/batchsim/__tests__/`) e porque adicionar Jest ou Vitest custaria dependencias, configuracao
// e tempo de CI para resolver um problema que `node:assert` resolve.
//
// Mora em `tools/` e nao dentro de `spike/` ou de `src/`: as duas areas o usam, e nenhuma deve
// depender da outra so por causa de um `console.log` com um visto.

let passed = 0;
const failures = [];

export function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✖ ${name}\n      ${err.message}`);
  }
}

export async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✖ ${name}\n      ${err.message}`);
  }
}

export function report(title) {
  console.log('\n' + '='.repeat(40));
  console.log(`${title}: ${passed} passed, ${failures.length} failed`);
  console.log('='.repeat(40));
  if (failures.length) process.exitCode = 1;
  return failures.length === 0;
}
