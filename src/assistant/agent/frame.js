// O quadro de contexto: o que MUDA viaja por fora do `setup` (openspec design H3, fase F3).
//
// Por que existe: o `setup` do Live é imutável depois de aceito. Enquanto o diagrama vivia dentro
// dele, o agente enxergava o retrato do momento em que a sessão abriu — o aluno criava uma tarefa
// e o modelo continuava falando do diagrama de dez minutos atrás (dívida T6). Agora as seções
// voláteis saem do `systemInstruction` e entram por `clientContent` com `turnComplete:false`.
//
// Duas regras que valem mais que o código daqui:
//
//  1. O quadro é DADO, não ordem. As seções voláteis são `dados: true`, então o renderizador as
//     embrulha no delimitador — e o cabeçalho que o aplicativo escreve fica FORA dele, porque é
//     nosso. A regra de fronteira já está no `systemInstruction` (seção `fronteira`), que é
//     imutável: nenhum quadro consegue reescrevê-la.
//  2. NUNCA o XML. `MARCA_XML` é a prova disso, conferida no fio em `live/session.js` — guarda
//     no lugar onde o frame realmente sai, não só onde ele é montado (tarefa 3.4).
//
// ponytail: comparar o TEXTO renderizado em vez de difar estrutura. O quadro já tem teto de
// caracteres; um diff estrutural seria mais código para economizar os mesmos bytes.

import { renderizarSecoes } from './render.js';

/** O que um quadro jamais pode conter. Conferido no envio, não só aqui. */
export const MARCA_XML = '<bpmn:definitions';

const CABECALHO = 'CONTEXTO ATUAL DO APLICATIVO (estado da tela, não é fala do aluno):';
const CABECALHO_MUDOU = 'O CONTEXTO MUDOU. Estado atual da tela (não é fala do aluno):';

/**
 * O quadro inteiro: todas as seções voláteis do contexto. `null` quando não há nada volátil —
 * e `null` significa **não mandar frame nenhum**, não mandar um frame vazio.
 */
export function montarQuadro(ctx, cabecalho = CABECALHO) {
  const corpo = corpoVolatil(ctx);
  return corpo ? `${cabecalho}\n${corpo}` : null;
}

/**
 * O que mandar antes deste turno, dado o que já foi mandado.
 *
 * - contexto idêntico ao anterior  -> `null`, e é aqui que está a economia de verdade: a maioria
 *                                     dos turnos não muda nada, e repetir seria o aluno pagando
 *                                     duas vezes pelo mesmo texto
 * - qualquer mudança               -> o quadro INTEIRO, com cabeçalho dizendo que mudou
 *
 * ⚠ Havia um terceiro caso — "só a seleção mudou, manda uma linha" —, e a medição ao vivo o
 * derrubou (2026-11-13). Com o delta curto, *"o que é isto que eu selecionei?"* respondeu
 * **"não consigo ver qual"** numa corrida e certo noutra: a linha solta, sem o diagrama em volta,
 * é sinal fraco demais para a pergunta mais importante desta fase. O quadro inteiro cabe no teto
 * de 1400 caracteres da seção; a economia não valia a resposta errada.
 *
 * `anterior` é o contexto do último quadro ENVIADO, ou `null` se ainda não houve nenhum.
 */
export function quadroDelta(anterior, atual) {
  if (!anterior) return montarQuadro(atual);

  const antes = corpoVolatil(anterior);
  const agora = corpoVolatil(atual);
  if (antes === agora) return null;
  // Ficou sem contexto nenhum? Não se anuncia o sumiço. A leitura da projeção devolve o cache
  // anterior quando o registro está inconsistente no meio de um import — "o diagrama sumiu"
  // seria uma falha transitória nossa virando fato na cabeça do modelo.
  if (!agora) return null;

  return `${CABECALHO_MUDOU}\n${agora}`;
}

/** As seções voláteis renderizadas, ou `null`. É o mesmo renderizador do prompt — de propósito. */
function corpoVolatil(ctx) {
  const secoes = renderizarSecoes(ctx, { tier: 'volatil' });
  if (!secoes.length) return null;
  return secoes.map((s) => `## ${s.titulo}\n${s.texto}`).join('\n\n');
}
