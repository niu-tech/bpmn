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
  // ⚠ A marca no `<body>` é o que tira as barras do modelador de cena enquanto o convite está na
  // tela (dono, 2026-11-15: *"não precisamos do bpmn bizagi like… e nem do simulação… na tela
  // inicial"*). Elas vivem acima do convite no empilhamento — e com razão, porque depois da
  // escolha são elas que o aluno usa. Quem esconde é o CSS; aqui só se diz que o convite está no ar.
  document.body.classList.add('pv-no-ar');
  tela.focus({ preventScroll: true });

  return {
    raiz: tela,
    fechar: () => {
      tela.remove();
      document.body.classList.remove('pv-no-ar');
    },
  };
}

/**
 * A BARRA DO TUTOR: o que fazer agora, no canto de quem pode ajudar.
 *
 * Substitui a pilula que ficava no alto do canvas. Ela dizia o que estava aberto e oferecia os
 * caminhos, mas (a) pousava EM CIMA do desenho, (b) nao explicava nada e (c) nao tinha relacao
 * visual nenhuma com o tutor — que e' quem resolve a duvida de quem acabou de chegar.
 *
 * O desenho vem da pesquisa de 2026-11-15, e tres achados a decidiram:
 *
 *   1. TUTORIAL SOBREPOSTO SAI PELA CULATRA. Quem le o passo-a-passo acha o produto MAIS
 *      complicado do que quem pula (NN/g, citado em conffab). Entao nada de tour, spotlight ou
 *      sequencia de "proximo" — e por isso tambem nao abrimos o painel sozinhos nem piscamos a
 *      alavanca: as duas sao interrupcao, e interrupcao e' o que a pesquisa desaconselha.
 *   2. CAIXA EM BRANCO ESCONDE O QUE O ASSISTENTE SABE FAZER. O remedio conhecido e' sugestao
 *      clicavel ("icebreakers"), e o conselho e' poucas e boas: tres caminhos focados valem mais
 *      que vinte exemplos (shapeof.ai; Adobe AI Assistant; Notion AI).
 *   3. SUGESTAO LIGADA AO QUE ESTA NA TELA vence sugestao generica (arXiv 2412.10933; Granola
 *      sugere pelo transcript, Gemini pela pagina aberta). Nos temos a melhor versao disso: o
 *      agente LE o diagrama. Entao, quando o aluno seleciona uma forma, a barra passa a falar
 *      DAQUELA forma.
 *
 * Ela nao e' modal, nao bloqueia o canvas, fecha num clique e nao volta na mesma visita.
 */
export function montarBarra({
  raiz = document.body,
  estado,
  aoClicar = () => {},
  aoVoltar = () => {},
  aoPerguntar = () => {},
} = {}) {
  if (estado !== 'exemplo' && estado !== 'branco') return null;

  const titulo = el('p', { className: 'pv-barra__titulo' });
  const texto = el('p', { className: 'pv-barra__texto' });
  const perguntar = el('button', { className: 'pv-barra__acao', type: 'button' });

  /** O que a barra diz quando NADA esta selecionado — por trilha. */
  const PADRAO = {
    exemplo: {
      titulo: 'Este diagrama é um exemplo',
      texto: 'O tutor lê o que está na tela. Clique em qualquer elemento e pergunte o que ele '
        + 'faz — ou peça para criar, ligar, renomear e mover.',
      acao: 'Perguntar sobre este diagrama',
      frase: 'O que esse processo faz?',
    },
    branco: {
      titulo: 'Sua tela em branco',
      texto: 'Conte o seu processo em algumas frases e o tutor desenha com você, passo a passo. '
        + 'O que ele desenhar você desfaz com Ctrl+Z.',
      acao: 'Descrever o meu processo',
      frase: 'Quero modelar o MEU processo — vou te descrever',
    },
  };

  function dizer({ titulo: t, texto: x, acao, frase }) {
    titulo.textContent = t;
    texto.textContent = x;
    perguntar.textContent = acao;
    perguntar.dataset.frase = frase;
  }

  dizer(PADRAO[estado]);
  perguntar.addEventListener('click', () => aoPerguntar(perguntar.dataset.frase));

  const trocar = el('button', {
    type: 'button',
    className: 'pv-barra__link',
    textContent: estado === 'exemplo' ? 'começar o meu' : 'ver um exemplo',
  });
  trocar.addEventListener('click', () => aoClicar(estado === 'exemplo' ? 'branco' : 'exemplo'));

  const voltar = el('button', {
    type: 'button',
    className: 'pv-barra__link',
    textContent: 'voltar ao menu',
  });
  voltar.addEventListener('click', () => aoVoltar());

  const fechar = el('button', { type: 'button', className: 'pv-barra__fechar', textContent: '×' });
  fechar.setAttribute('aria-label', 'Fechar esta ajuda');

  const barra = el('aside', { className: 'pv-barra' }, [
    fechar,
    titulo,
    texto,
    perguntar,
    el('p', { className: 'pv-barra__rodape' }, [
      trocar,
      el('span', { className: 'pv-barra__sep', textContent: ' · ' }),
      voltar,
    ]),
  ]);
  barra.dataset.estado = estado;
  // Nao e' alerta: e' ajuda que aparece junto com a tela. `polite` para o leitor de tela anunciar
  // a mudanca quando a selecao troca o texto, sem cortar o que estiver sendo lido.
  barra.setAttribute('aria-live', 'polite');

  const remover = () => {
    clearTimeout(segundaOlhada);
    window.removeEventListener('resize', sentarSobreAAlavanca);
    barra.remove();
  };
  fechar.addEventListener('click', remover);

  raiz.append(reservarRodape(barra));

  /**
   * A barra senta EM CIMA DA ALAVANCA, medindo-a — não num offset adivinhado.
   *
   * ⚠ O número fixo errou no celular, e o print mostrou: em 375 px o ajudante reserva a barra do
   * modelador INTEIRA no rodapé (`calcularReserva`), então a alavanca sobe e cobria a linha
   * "voltar ao menu". Medir é a única forma de acompanhar uma reserva que muda quando a barra do
   * modelador expande.
   */
  function sentarSobreAAlavanca() {
    const r = document.querySelector('.bpmn-assist__toggle')?.getBoundingClientRect();
    if (!r || !r.height) return;
    barra.style.setProperty('--pv-barra-bottom', `${Math.round(window.innerHeight - r.top + 10)}px`);
  }

  // ⚠ Três momentos, e cada um existe por um motivo medido: AGORA (caso a alavanca já esteja
  // posta), no PRÓXIMO QUADRO e de novo em 400 ms — porque o ajudante escreve a reserva do rodapé
  // por `ResizeObserver`, depois da montagem. Medir só na montagem deu 110 px contra os 131 px
  // que a alavanca passou a ocupar, e a linha "voltar ao menu" ficava embaixo dela em 375 px.
  sentarSobreAAlavanca();
  requestAnimationFrame(sentarSobreAAlavanca);
  const segundaOlhada = setTimeout(sentarSobreAAlavanca, 400);
  window.addEventListener('resize', sentarSobreAAlavanca);

  return {
    raiz: barra,
    remover,
    /**
     * O aluno clicou numa forma: a barra passa a falar DELA (achado 3). Sem nome, cai no padrao
     * da trilha — um fluxo sem rotulo nao rende pergunta melhor que "o que esse processo faz?".
     */
    selecionou(nome) {
      if (!nome) { dizer(PADRAO[estado]); return; }
      dizer({
        titulo: `Selecionado: «${nome}»`,
        texto: 'Pergunte o que ele faz, ou peça para renomear, mover ou ligar a outro elemento.',
        acao: `Perguntar sobre «${nome}»`,
        frase: `O que faz "${nome}"?`,
      });
    },
  };
}
