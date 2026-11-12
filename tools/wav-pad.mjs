/**
 * Põe silêncio na FRENTE de um WAV.
 *
 * Existe por causa do barge-in. O microfone falso do Chromium começa a tocar o arquivo quando a
 * captura abre, e o que precisamos provar é o contrário disso: que a fala chegue DEPOIS, no meio
 * da resposta do modelo. Sem silêncio na frente, a frase de corte entra antes de haver o que
 * cortar.
 *
 * Só PCM de 16 bits, que é o que o SAPI gera e o que o Live aceita.
 *
 * Uso: node tools/wav-pad.mjs <entrada.wav> <segundos> <saida.wav>
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Acha um chunk pelo id, andando pela lista de chunks RIFF (não assume posição fixa). */
function acharChunk(buf, id) {
  let pos = 12;                                  // depois de "RIFF" + tamanho + "WAVE"
  while (pos + 8 <= buf.length) {
    const nome = buf.toString('ascii', pos, pos + 4);
    const tam = buf.readUInt32LE(pos + 4);
    if (nome === id) return { inicio: pos + 8, tamanho: tam };
    pos += 8 + tam + (tam % 2);                  // chunks têm padding para tamanho par
  }
  throw new Error(`chunk ${id} nao encontrado`);
}

export function prefixarSilencio(entrada, segundos) {
  const buf = readFileSync(entrada);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${entrada} nao e um WAV RIFF`);
  }
  const fmt = acharChunk(buf, 'fmt ');
  const canais = buf.readUInt16LE(fmt.inicio + 2);
  const taxa = buf.readUInt32LE(fmt.inicio + 4);
  const bits = buf.readUInt16LE(fmt.inicio + 14);
  if (bits !== 16) throw new Error(`so PCM de 16 bits; este tem ${bits}`);

  const data = acharChunk(buf, 'data');
  const corpo = buf.subarray(data.inicio, data.inicio + data.tamanho);
  const silencio = Buffer.alloc(Math.round(segundos * taxa) * canais * 2);   // zeros = silêncio
  const novoCorpo = Buffer.concat([silencio, corpo]);

  // Cabeçalho canônico de 44 bytes: mais simples que remendar o original, e o resultado é o
  // mesmo formato que o SAPI emite.
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0, 'ascii');
  cab.writeUInt32LE(36 + novoCorpo.length, 4);
  cab.write('WAVEfmt ', 8, 'ascii');
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);                       // PCM
  cab.writeUInt16LE(canais, 22);
  cab.writeUInt32LE(taxa, 24);
  cab.writeUInt32LE(taxa * canais * 2, 28);       // byte rate
  cab.writeUInt16LE(canais * 2, 32);              // block align
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36, 'ascii');
  cab.writeUInt32LE(novoCorpo.length, 40);

  return { wav: Buffer.concat([cab, novoCorpo]), taxa, canais, segundosTotais: novoCorpo.length / (taxa * canais * 2) };
}

/**
 * Junta WAVs com silêncio entre eles: `[fala A][silencio][fala B]`.
 *
 * Existe para o barge-in. Medido em 2026-11-12: em modo voz com o microfone aberto, uma pergunta
 * DIGITADA só é respondida depois de o servidor ver fim de fala no fluxo de áudio — com 9 s de
 * silêncio o modelo falou aos 15 s, com 16 s falou aos 22,6 s. Ou seja, não dá para fazer o
 * modelo falar enquanto o WAV ainda toca. A única forma de sobrepor é a pergunta vir PELA VOZ,
 * e a frase de corte vir num segundo trecho do mesmo arquivo.
 */
export function juntarComSilencio(partes) {
  let taxa = null;
  let canais = null;
  const pedacos = [];
  for (const parte of partes) {
    if (typeof parte === 'number') {
      if (taxa === null) throw new Error('o primeiro item precisa ser um WAV, nao silencio');
      pedacos.push(Buffer.alloc(Math.round(parte * taxa) * canais * 2));
      continue;
    }
    const buf = readFileSync(parte);
    const fmt = acharChunk(buf, 'fmt ');
    const c = buf.readUInt16LE(fmt.inicio + 2);
    const r = buf.readUInt32LE(fmt.inicio + 4);
    const bits = buf.readUInt16LE(fmt.inicio + 14);
    if (bits !== 16) throw new Error(`so PCM de 16 bits; ${parte} tem ${bits}`);
    if (taxa !== null && (r !== taxa || c !== canais)) throw new Error('taxas/canais diferentes entre os WAVs');
    taxa = r; canais = c;
    const data = acharChunk(buf, 'data');
    pedacos.push(buf.subarray(data.inicio, data.inicio + data.tamanho));
  }
  const corpo = Buffer.concat(pedacos);
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0, 'ascii');
  cab.writeUInt32LE(36 + corpo.length, 4);
  cab.write('WAVEfmt ', 8, 'ascii');
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(canais, 22);
  cab.writeUInt32LE(taxa, 24);
  cab.writeUInt32LE(taxa * canais * 2, 28);
  cab.writeUInt16LE(canais * 2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36, 'ascii');
  cab.writeUInt32LE(corpo.length, 40);
  return { wav: Buffer.concat([cab, corpo]), taxa, canais, segundosTotais: corpo.length / (taxa * canais * 2) };
}

if (process.argv[2] === 'juntar') {
  const saida = process.argv.at(-1);
  const partes = process.argv.slice(3, -1).map((a) => (/^[\d.]+$/.test(a) ? Number(a) : a));
  const r = juntarComSilencio(partes);
  writeFileSync(saida, r.wav);
  console.log(`${saida}: ${r.segundosTotais.toFixed(1)}s, ${r.taxa} Hz`);
} else if (process.argv[1]?.endsWith('wav-pad.mjs')) {
  const [entrada, seg, saida] = process.argv.slice(2);
  if (!entrada || !seg || !saida) {
    console.error('uso: node tools/wav-pad.mjs <entrada.wav> <segundos> <saida.wav>');
    process.exit(2);
  }
  const r = prefixarSilencio(entrada, Number(seg));
  writeFileSync(saida, r.wav);
  console.log(`${saida}: ${r.taxa} Hz, ${r.canais} canal(is), ${r.segundosTotais.toFixed(1)}s (${seg}s de silencio na frente)`);
}
