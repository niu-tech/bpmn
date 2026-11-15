/**
 * O que o modelador abre, e por quê.
 *
 * Puro de propósito: sem DOM, sem `localStorage`, sem `location` — quem lê as chaves e o endereço
 * é o `app.js`, e quem decide é esta função. É o mesmo corte de `assistant/layout.js`, e pela
 * mesma razão: assim a regra roda em `node`, no `npm test`, sem navegador.
 *
 * ⚠ O defeito que esta change existe para corrigir mora numa linha de `app.js`: "não achei nada
 * salvo ⇒ carregue a pizzaria". Ausência de arquivo virou ordem de abrir trabalho alheio. Aqui,
 * ausência de arquivo é o que ela é — **esta pessoa ainda não escolheu nada**.
 */

/** Onde fica a escolha da pessoa. Vizinha de `bpmn.autosave.xml`, que guarda o desenho. */
export const CHAVE_ESCOLHA = 'bpmn.primeira-vez';

/** O endereço que abre o exemplo direto, sem passar pelo convite (design B8). */
export const ATALHO_EXEMPLO = '#exemplo';

/**
 * Os três caminhos da tela base. `tutor` e `branco` abrem a mesma tela (vazia) — o que muda é que
 * `tutor` abriu o painel naquele momento. Guardar os dois separados é o que permite saber, depois,
 * por onde a pessoa entrou, sem ter de adivinhar.
 */
export const ESCOLHAS = Object.freeze(['exemplo', 'branco', 'tutor']);

export function escolhaValida(valor) {
  return ESCOLHAS.includes(valor);
}

/**
 * `restaurar` o trabalho salvo · abrir o `exemplo` · abrir em `branco` · mostrar o `convite`.
 *
 * Precedência, e o porquê de cada degrau:
 *   1. o atalho vence tudo — é um link que alguém mandou dizendo "olha a demonstração"; ele NÃO
 *      apaga o autosave (quem clicou por engano ainda tem o "⤴️ Restaurar" da barra);
 *   2. trabalho salvo vence a escolha — quem já desenhou não é interrompido por nada;
 *   3. a escolha anterior vence o convite — inclusive quando a pessoa escolheu começar do zero e
 *      fechou a aba sem desenhar: o autosave não teria registrado nada, e sem esta chave ela
 *      receberia o convite de novo para sempre;
 *   4. sem nada disso, é a primeira vez.
 */
export function decidirAbertura({ salvo = null, escolha = null, atalho = null } = {}) {
  if (atalho === ATALHO_EXEMPLO) return 'exemplo';
  if (salvo) return 'restaurar';
  if (!escolhaValida(escolha)) return 'convite';
  return escolha === 'exemplo' ? 'exemplo' : 'branco';
}

/**
 * Qual tira a tela mostra depois de abrir.
 *
 * `exemplo` precisa dizer que é exemplo (senão o diagrama de outra pessoa passa por trabalho da
 * própria); `branco` precisa manter o exemplo a um clique (pergunta 4 do estudo). Quem restaurou o
 * próprio trabalho não recebe tira nenhuma: não há o que explicar.
 */
export function tiraPara(abertura) {
  if (abertura === 'exemplo') return 'exemplo';
  if (abertura === 'branco') return 'branco';
  return null;
}
