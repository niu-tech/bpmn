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
const CABECALHO_SELECAO = 'O aluno acabou de selecionar um elemento na tela (não é fala do aluno):';

/**
 * O quadro inteiro: todas as seções voláteis do contexto. `null` quando não há nada volátil —
 * e `null` significa **não mandar frame nenhum**, não mandar um frame vazio.
 */
export function montarQuadro(ctx, cabecalho = CABECALHO) {
  const corpo = corpoVolatil(ctx);
  return corpo ? `${cabecalho}\n${corpo}` : null;
}

/**
 * O que mandar neste turno, dado o que já foi mandado.
 *
 * - contexto idêntico ao anterior  -> `null`: a maioria dos turnos não muda nada, e repetir
 *                                     seria o aluno pagando duas vezes pelo mesmo texto
 * - só a seleção mudou             -> UMA linha. É o caso comum (o aluno clica muito) e o mais
 *                                     importante da fase ("o que é isto?")
 * - qualquer outra mudança         -> o quadro inteiro, com cabeçalho dizendo que mudou
 *
 * ⚠ Por que curto: o retrato completo já foi semeado na conexão, então o turno só precisa
 * carregar a diferença — e a diferença mais comum (a seleção) é uma linha. Economia simples.
 *
 * ⚠ **Correção do registro (2026-11-13).** Eu havia escrito aqui que o quadro inteiro embutido
 * fazia o modelo fechar o turno sem responder. Isso **não está provado**: as "respostas vazias"
 * que me levaram a essa conclusão eram, em boa parte, o laço de captura da bateria descartando
 * resposta curta (teto de 15 caracteres) e lendo a reescrita da bolha anterior como se fosse a
 * nova. Consertado o instrumento, o portão passa duas vezes seguidas. O delta curto fica por
 * ser menor e suficiente, não por uma causa que eu não medi.
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

  if (soMudouSelecao(anterior, atual)) {
    const corpo = corpoVolatil(soComSelecao(atual));
    if (corpo) return `${CABECALHO_SELECAO}\n${corpo}`;
  }

  return `${CABECALHO_MUDOU}\n${agora}`;
}

/** Tudo igual menos o elemento selecionado. */
function soMudouSelecao(a, b) {
  if (!a.diagrama || !b.diagrama) return false;
  return chave(a) === chave(b) && JSON.stringify(a.diagrama.selecionado) !== JSON.stringify(b.diagrama.selecionado);
}

function chave(ctx) {
  const { selecionado, ...resto } = ctx.diagrama ?? {};
  return JSON.stringify({ resto, memoria: ctx.memoria ?? [] });
}

/** O mesmo contexto, com o diagrama reduzido à seleção: é o corpo do delta curto. */
function soComSelecao(ctx) {
  return {
    ...ctx,
    memoria: [],
    diagrama: { ...ctx.diagrama, total: null, contagem: {}, raias: [], amostra: [] },
  };
}

/** As seções voláteis renderizadas, ou `null`. É o mesmo renderizador do prompt — de propósito. */
function corpoVolatil(ctx) {
  const secoes = renderizarSecoes(ctx, { tier: 'volatil' });
  if (!secoes.length) return null;
  return secoes.map((s) => `## ${s.titulo}\n${s.texto}`).join('\n\n');
}
