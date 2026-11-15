// O canal da PÁGINA: o que o aluno faz no canvas, contado ao modelo.
//
// Por que existe (change `close-the-loop-with-the-canvas`, decisão 3): o aluno clica num
// elemento, importa um arquivo, dá `Ctrl+Z` — e a conversa seguia como se nada tivesse
// acontecido, porque o contexto só era recalculado na borda do turno seguinte. Ele dizia "e esse
// aqui?" e o agente respondia sobre o elemento anterior.
//
// A forma vem da PoC do *appointment agent* do Orbit (Gemini 3.8 Live, 2026-11), onde a página
// manda fatos ao modelo marcados como **da página** e nunca como fala do usuário. Nada daquele
// código entra aqui; o que entra é a forma, reescrita para o bpmn-js.
//
// ⚠ Este módulo NÃO decide nada e NÃO fala com o modelo: ele traduz evento do bpmn-js em frase e
// entrega a frase a quem tem a fila (`session-manager.js::anunciarNaPagina`). Quem marca com
// `(da página)` é a sessão — a marca não pode depender de cada chamador lembrar dela.
//
// ponytail: um `assinar`, um `setTimeout` de debounce e quatro frases. Sem store, sem bus próprio.

import { estadoDaTela } from './tools/leitura.js';

/**
 * Debounce da SELEÇÃO. Clicar em dez elementos para achar o certo é navegação, não dez fatos —
 * e dez anúncios seriam dez linhas na conversa do aluno (tarefa 3.4).
 */
const ESPERA_DA_SELECAO_MS = 500;

/** `bpmn:UserTask` -> `usertask`. O modelo recebe o tipo em minúscula, como na leitura. */
function tipoCurto(type) {
  const t = String(type ?? '').replace(/^bpmn:/, '');
  return t ? t.toLowerCase() : 'elemento';
}

function comoChamar(el) {
  const nome = el?.businessObject?.name;
  const limpo = typeof nome === 'string' ? nome.trim() : '';
  return limpo ? `"${limpo}" (${tipoCurto(el?.type)})` : `${tipoCurto(el?.type)} ${el?.id ?? '?'}`;
}

/**
 * Liga os eventos do modelador ao canal da página.
 *
 * `anunciar(frase)` é `session.anunciarNaPagina`. `ocupado()` diz se o AGENTE está agindo agora —
 * e é a única guarda de que este módulo precisa: enquanto uma ferramenta roda, a seleção que
 * muda, a forma que nasce e o `Ctrl+Z` que acontece são do agente, não do aluno. Contar a própria
 * ação de volta como fato do aluno seria o agente conversando consigo mesmo.
 */
export function ligarAnunciosDaPagina({
  acesso,
  anunciar,
  ocupado = () => false,
  esperaDaSelecaoMs = ESPERA_DA_SELECAO_MS,
} = {}) {
  const inerte = { dispose() {}, simulacaoRodou() { return false; } };
  if (!acesso?.disponivel || typeof anunciar !== 'function') return inerte;

  let relogio = null;

  const dizer = (frase) => {
    if (ocupado()) return false;
    return anunciar(frase);
  };

  const selecaoMudou = () => {
    if (relogio) clearTimeout(relogio);
    relogio = setTimeout(() => {
      relogio = null;
      let el = null;
      try {
        el = acesso.selecionado();
      } catch {
        return;
      }
      // Desmarcar não é fato: o aluno clicou no vazio do canvas, e anunciar isso seria ruído com
      // o custo de um turno de contexto.
      if (!el || el.labelTarget) return;
      dizer(`o aluno selecionou ${comoChamar(el)} no desenho. Se ele disser "esse aqui", é este.`);
    }, esperaDaSelecaoMs);
    relogio?.unref?.();
  };

  const importou = () => {
    // A leitura inteira, e não uma contagem nossa: trocar de arquivo muda tudo, e é a mesma
    // função que descreve a tela depois de qualquer escrita.
    dizer(`o aluno abriu outro diagrama nesta página. ${estadoDaTela(acesso)}`);
  };

  const desfez = () => {
    dizer('o aluno desfez a última mudança (Ctrl+Z). O desenho voltou ao estado anterior.');
  };

  const desassinar = acesso.assinar(['selection.changed'], selecaoMudou);
  const desassinarImport = acesso.assinar(['import.done'], importou);
  const desassinarUndo = acesso.assinar(['commandStack.reverted'], desfez);

  return {
    /**
     * A PÁGINA rodou a simulação (design T5: o agente comenta a corrida, não a dispara). Não é
     * evento do `eventBus` — quem sabe é o montador, que recebe o resultado.
     */
    simulacaoRodou(resumo = null) {
      const linhas = Array.isArray(resumo?.summaryRows) ? resumo.summaryRows.length : 0;
      return dizer(
        'o aluno rodou a simulação do diagrama'
        + (linhas ? ` (${linhas} ${linhas === 1 ? 'replicação' : 'replicações'})` : '')
        + '. Use resumir_simulacao se ele perguntar do resultado.',
      );
    },
    dispose() {
      if (relogio) clearTimeout(relogio);
      relogio = null;
      desassinar();
      desassinarImport();
      desassinarUndo();
    },
  };
}
