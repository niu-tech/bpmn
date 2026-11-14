// Mini-harness de testes do repositorio. Sem dependencia, sem runner, sem config.
//
// Existe porque o repositorio ja testava assim (scripts `.mjs` rodados por `node` direto, em
// `src/batchsim/__tests__/`) e porque adicionar Jest ou Vitest custaria dependencias, configuracao
// e tempo de CI para resolver um problema que `node:assert` resolve.
//
// Mora em `tools/` e nao dentro de `spike/` ou de `src/`: as duas areas o usam, e nenhuma deve
// depender da outra so por causa de um `console.log` com um visto.

import { readFileSync } from 'node:fs';

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

/**
 * Veredito do arquivo.
 *
 * ⚠ O gancho de saída não é enfeite. `testAsync` devolve uma promessa que NINGUÉM espera: o
 * arquivo chama `report()` na última linha e termina, e as promessas resolvem depois. Sem o
 * gancho, um teste assíncrono reprovado imprimia o ✖ no console e o processo saía **0** — e como
 * `npm test` encadeia os arquivos com `&&`, a suíte inteira seguia verde com um guard quebrado.
 * Resultado que não pode falhar não é prova (achado em 2026-11-14, quando as novas provas de
 * escrita — todas assíncronas — ficaram fora da conta impressa).
 */
export function report(title) {
  const noReport = { passed, falhas: failures.length };
  console.log('\n' + '='.repeat(40));
  console.log(`${title}: ${passed} passed, ${failures.length} failed`);
  console.log('='.repeat(40));
  if (failures.length) process.exitCode = 1;

  process.once('exit', () => {
    const tardios = (passed + failures.length) - (noReport.passed + noReport.falhas);
    const reprovados = failures.length - noReport.falhas;
    if (tardios > 0) console.log(`${title}: +${tardios} assíncronos, ${reprovados} failed`);
    if (failures.length) process.exitCode = 1;
  });

  return failures.length === 0;
}


/**
 * Codigo de um arquivo, sem comentarios. As varreduras de seguranca precisam julgar IMPORT, nao
 * nota de rodape: citar `spike` ou `localStorage` num comentario que explica a regra e justamente
 * o que se quer escrito.
 *
 * ⚠ O `\r` e o detalhe que quebrou isto em silencio. O repositorio fica com CRLF no disco
 * (autocrlf do git), e em JavaScript o `.` NAO casa `\r`. Com `split('\n')`, cada linha termina
 * em `\r`, entao `/\/\/.*$/` nunca casava o fim e o comentario SOBREVIVIA — a varredura passava a
 * acusar prosa e, pior, podia deixar de acusar codigo depois de um ajuste. Normalizar a quebra de
 * linha antes de qualquer coisa.
 */
export function codigoSemComentarios(file) {
  return readFileSync(file, 'utf8')
    .replace(/\r\n?/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}
