/**
 * A tela base: o que o modelador mostra quando ninguém escolheu nada ainda.
 *
 * Mora no ESPAÇO do canvas, não antes dele (design B1) — é um overlay fixo, como o ajudante, e não
 * um `<div>` dentro do `#canvas`: o bpmn-js é dono daquela subárvore e não precisa de vizinho.
 *
 * ⚠ O que esta tela faz, inteiro: carregar um diagrama, abrir o painel que já existe e deixar uma
 * frase digitada. Ela NÃO encadeia perguntas, não escolhe ferramenta e não decide o próximo passo
 * — quem conduz é o modelo, por function calling (constituição §III). Um roteiro de entrevista
 * aqui seria a violação exata que o projeto proíbe.
 *
 * ⚠ O texto sai da tabela do design B9: cada frase aponta para um portão que já fechou. Nada sobre
 * "proposta nomeada que você aceita" (portão F8 inteiro, aberto) nem sobre resposta com fonte
 * citada (FK, 0 de 31 caixas). Prometer na primeira tela o que o agente ainda não faz é a forma
 * mais barata de estragar a primeira impressão.
 */
import './primeira-vez.css';
import { RESERVA_MINIMA } from '../assistant/layout.js';

/**
 * O rodapé que a marca d'água do bpmn.io exige livre, escrito no elemento em vez de repetido no
 * CSS. A constante (e a nota de licença que a explica) vive em `assistant/layout.js`: duas cópias
 * de um número que é exigência legal é exatamente o jeito de uma delas ficar para trás.
 */
function reservarRodape(n) {
  n.style.setProperty('--pv-rodape', `${RESERVA_MINIMA}px`);
  return n;
}

function el(tag, props = {}, filhos = []) {
  const n = Object.assign(document.createElement(tag), props);
  for (const f of filhos) n.append(f);
  return n;
}

/** Um cartão é um botão: o alvo de clique é o cartão inteiro, não só o texto dentro dele. */
function cartao({ caminho, titulo, texto, acao = null, primario = false }) {
  const b = el('button', {
    type: 'button',
    className: `pv__cartao${primario ? ' pv__cartao--primario' : ''}`,
  }, [
    el('b', { textContent: titulo }),
    el('span', { textContent: texto }),
    ...(acao ? [el('em', { textContent: acao })] : []),
  ]);
  b.dataset.caminho = caminho;
  return b;
}

/**
 * Monta o convite. `aoEscolher` recebe `'tutor'`, `'exemplo'`, `'branco'` ou `'descoberta'`, e é
 * quem decide o que acontece — esta função não conhece o modelador.
 */
export function montarTelaBase({ raiz = document.body, aoEscolher = () => {} } = {}) {
  const titulo = el('h1', {
    className: 'pv__titulo',
    id: 'pv-titulo',
    textContent: 'Seu processo começa aqui.',
  });

  const descobrir = el('button', {
    type: 'button',
    className: 'pv__link',
    textContent: 'peça uma introdução ao tutor',
  });
  descobrir.dataset.caminho = 'descoberta';

  const folha = el('div', { className: 'pv__folha' }, [
    el('p', { className: 'pv__marca', textContent: 'Modelador BPMN · com um tutor dentro' }),
    titulo,
    el('p', {
      className: 'pv__sub',
      textContent: 'Escolha por onde começar. Dá para mudar de caminho depois.',
    }),
    cartao({
      caminho: 'tutor',
      primario: true,
      titulo: 'Descreva o seu processo',
      texto: 'Conte em algumas frases o que acontece na sua rotina. Ele conversa com você em '
        + 'português e vai montando o diagrama junto — e o que ele desenhar você desfaz com Ctrl+Z.',
      acao: 'Conversar com o tutor →',
    }),
    el('div', { className: 'pv__dupla' }, [
      cartao({
        caminho: 'exemplo',
        titulo: 'Ver um exemplo',
        texto: 'Um pedido de pizza já modelado, com dois participantes. Pergunte o que ele faz e '
          + 'mude à vontade: ele lê o que está aberto na tela.',
      }),
      cartao({
        caminho: 'branco',
        titulo: 'Começar do zero',
        texto: 'Um diagrama novo, só com o evento de início. O ajudante fica no canto, para quando '
          + 'você quiser criar, ligar, renomear ou mover alguma coisa.',
      }),
    ]),
    el('p', { className: 'pv__descoberta' }, [
      el('span', { textContent: 'Não sabe o que é BPMN? ' }),
      descobrir,
      // ⚠ "diz de onde tirou" só entrou nesta linha porque a FK FECHOU (change
      // `add-bpmn-norm-knowledge-base`, 2026-11-15): existe um acervo de verbetes e a ferramenta
      // `consultar_norma` declarada ao modelo, e a resposta volta com a chave de citação. Enquanto
      // isso não existia, a tela não dizia — e o guard em `__tests__/abertura.mjs` reprova se a
      // ferramenta sumir do catálogo, para a promessa não sobreviver ao que a sustenta.
      el('span', { textContent: ' — ele explica com o exemplo na frente e diz de onde tirou.' }),
    ]),
  ]);

  const tela = el('section', { className: 'pv' }, [folha]);
  tela.setAttribute('aria-labelledby', 'pv-titulo');
  // O convite é a última coisa do `<body>`, então sem isto o Tab passaria por todo o modelador
  // antes de chegar nele. `-1` dá foco por código sem criar uma parada a mais no caminho.
  tela.tabIndex = -1;

  tela.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-caminho]');
    if (alvo) aoEscolher(alvo.dataset.caminho);
  });

  raiz.append(reservarRodape(tela));
  tela.focus({ preventScroll: true });

  return { raiz: tela, fechar: () => tela.remove() };
}

/**
 * A tira que diz o que está aberto.
 *
 * `exemplo`: o diagrama é de outra pessoa e precisa estar escrito, senão passa por trabalho da
 * própria (design B6). `branco`: o exemplo continua a um clique, que é a pergunta 4 do estudo.
 * Quem restaurou o próprio trabalho não recebe tira nenhuma.
 */
export function montarTira({ raiz = document.body, estado, aoClicar = () => {} } = {}) {
  if (estado !== 'exemplo' && estado !== 'branco') return null;

  const acao = el('button', {
    type: 'button',
    className: 'pv-tira__link',
    textContent: estado === 'exemplo' ? 'começar o meu' : 'ver um exemplo',
  });
  acao.addEventListener('click', () => aoClicar(estado === 'exemplo' ? 'branco' : 'exemplo'));

  const tira = el('div', { className: 'pv-tira' }, [
    ...(estado === 'exemplo'
      ? [el('span', { className: 'pv-tira__selo', textContent: 'Exemplo' }),
        el('span', { textContent: 'pedido de pizza · ' })]
      : []),
    acao,
  ]);
  tira.dataset.estado = estado;

  raiz.append(reservarRodape(tira));
  return { raiz: tira, remover: () => tira.remove() };
}
