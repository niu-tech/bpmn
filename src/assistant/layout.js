// Geometria do ajudante contra as barras que já existem na página. Puro: sem DOM, sem CSS —
// é o que permite testar a conta em node, enquanto `mount.js` fica só com a medição e a escrita
// da variável CSS.

/** Abaixo disto o painel não serve para conversar. */
export const PAINEL_MINIMO = 320;

/** Acima desta largura cada overlay cabe no seu canto e não há disputa. */
export const LARGURA_ESTREITA = 520;

/** Respiro entre o painel e a barra de baixo. */
const FOLGA = 24;

/**
 * Quantos pixels o ajudante deve deixar livres no rodapé.
 *
 * Em tela estreita o painel ocupa a largura toda e passaria por cima da barra do modelador, que
 * mora no mesmo canto inferior. Medido em 375×812: colapsada ela é uma faixa de 51 px;
 * expandida, 265 px.
 *
 * Reservar a barra INTEIRA, não um pedaço: um teto fixo de 120 px (a primeira tentativa) deixava
 * o cabeçalho da barra coberto quando ela estava expandida — e é lá que fica o botão de recolher.
 * Cobrir o único jeito de recolher a barra é, na prática, travar o modelador. O único limite é
 * não espremer o próprio painel abaixo do que dá para usar.
 */
export function calcularReserva({ larguraJanela, alturaJanela, alturaBarra }) {
  if (larguraJanela > LARGURA_ESTREITA || !(alturaBarra > 0)) return 14;
  const teto = Math.max(14, alturaJanela - PAINEL_MINIMO);
  return Math.round(Math.min(alturaBarra + FOLGA, teto));
}
