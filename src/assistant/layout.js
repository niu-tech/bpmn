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
 * Piso do rodapé — e ele é uma exigência de LICENÇA, não de estética.
 *
 * A marca d'água do bpmn.io fica no canto inferior direito do canvas (medida: 53×21 px). A licença
 * do `bpmn-js` é explícita: ela não pode ser removida nem alterada e **"must stay fully visible
 * and not visually overlapped by other elements"**. Com os 14 px antigos o painel cobria a marca
 * nas duas páginas — medido em 2026-11-14, quando o inventário de dependências revelou que o
 * `bpmn-js` não é MIT puro.
 *
 * ⚠ Não baixe este número para ganhar altura de painel: ganha-se pixel e perde-se o direito de
 * publicar o trabalho.
 */
export const RESERVA_MINIMA = 44;

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
  if (larguraJanela > LARGURA_ESTREITA || !(alturaBarra > 0)) return RESERVA_MINIMA;
  const teto = Math.max(RESERVA_MINIMA, alturaJanela - PAINEL_MINIMO);
  return Math.round(Math.min(Math.max(alturaBarra + FOLGA, RESERVA_MINIMA), teto));
}
