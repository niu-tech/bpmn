/**
 * A tela base: o que o modelador mostra quando ninguém escolheu nada ainda — e o caminho de volta
 * até ela, que é permanente.
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
 * "proposta nomeada que você aceita" (portão F8 inteiro, aberto). Prometer na primeira tela o que
 * o agente ainda não faz é a forma mais barata de estragar a primeira impressão.
 *
 * ⚠ O NOME do agente vem de `assistant/identidade.js`, e é dito UMA vez. Antes a tela dizia
 * "tutor" três vezes enquanto o painel dizia "Ajudante BPMN" — três nomes para uma coisa (N1).
 */
import './primeira-vez.css';
import { RESERVA_MINIMA } from '../assistant/layout.js';
import { FRASES, NOME, O_QUE_E, fraseSobre } from '../assistant/identidade.js';

/** Quanto tempo a pergunta de "isto substitui o seu desenho" fica armada no cartão. */
const JANELA_CONFIRMACAO_MS = 5000;

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

/**
 * O VISUAL da tela: um mini-diagrama BPMN, em SVG inline.
 *
 * A pesquisa de primeira execução pede UM visual que carregue a ideia — e o único honesto aqui é o
 * próprio objeto do produto: início → tarefa → fim. Diz "isto desenha processos" sem uma palavra.
 * Inline porque são oito linhas, escalam em qualquer tela e não custam um arquivo novo nem uma
 * requisição (N7). `aria-hidden`: quem usa leitor de tela já recebe o título e a frase abaixo.
 */
function mini() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 168 34');
  svg.setAttribute('class', 'pv__mini');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<circle cx="12" cy="17" r="9"/>'
    + '<path d="M22 17h18"/>'
    + '<rect x="41" y="4" width="62" height="26" rx="5"/>'
    + '<path d="M104 17h18"/>'
    + '<circle cx="133" cy="17" r="9" class="pv__mini--fim"/>';
  return svg;
}

/**
 * Um cartão é um botão: o alvo de clique é o cartão inteiro, não só o texto dentro dele.
 *
 * Todo cartão tem a linha de ação (`<em>`) — e não só o primário, como antes: é nela que a
 * pergunta de confirmação aparece quando há trabalho a perder (N5), e um cartão sem essa linha não
 * teria onde perguntar.
 */
function cartao({ caminho, titulo, texto, acao, tipo = 'secundario' }) {
  const linha = el('em', { className: 'pv__acao', textContent: acao });
  const b = el('button', {
    type: 'button',
    className: `pv__cartao pv__cartao--${tipo}`,
  }, [
    el('b', { textContent: titulo }),
    el('span', { textContent: texto }),
    linha,
  ]);
  b.dataset.caminho = caminho;
  b.dataset.acao = acao;
  return b;
}

/**
 * Monta o convite. `aoEscolher` recebe `'tutor'`, `'exemplo'`, `'branco'` ou `'descoberta'`, e é
 * quem decide o que acontece — esta função não conhece o modelador.
 *
 * `temTrabalho` muda a tela de duas formas, e as duas vêm da âncora permanente (N3) ter tornado
 * esta tela alcançável COM trabalho vivo, coisa que antes não acontecia:
 *
 *   1. aparece a saída — "continuar o que eu estava fazendo" e o `Esc`. Sem isso, o caminho de
 *      volta novo trocaria uma porta trancada por outra: a pessoa veria as três opções e nenhuma
 *      forma de voltar ao desenho dela (N4);
 *   2. abrir o exemplo ou a tela em branco passa a PERGUNTAR antes. "Substituir o diagrama" é
 *      destrutivo pela constituição §VII, e a pergunta mora no próprio cartão — `confirm()` trava
 *      a página num ponto que nenhuma prova automática atravessa (N5).
 */
export function montarTelaBase({
  raiz = document.body,
  aoEscolher = () => {},
  temTrabalho = false,
  aoContinuar = () => {},
} = {}) {
  const titulo = el('h1', {
    className: 'pv__titulo',
    id: 'pv-titulo',
    textContent: 'Seu processo começa aqui.',
  });

  const descobrir = el('button', {
    type: 'button',
    className: 'pv__link',
    textContent: 'peça uma introdução',
  });
  descobrir.dataset.caminho = 'descoberta';

  const corpo = [
    el('div', { className: 'pv__selo' }, [
      mini(),
      // O selo diz o PRODUTO; quem apresenta o agente é o subtítulo, uma vez. Juntar os dois aqui
      // dava "Modelador BPMN · com o Tutor BPMN dentro" — a mesma palavra duas vezes numa linha.
      el('p', { className: 'pv__marca', textContent: 'Modelador BPMN' }),
    ]),
    titulo,
    el('p', {
      className: 'pv__sub',
      textContent: `Desenhe com o ${NOME} — ${O_QUE_E}. Escolha por onde começar; dá para mudar `
        + 'de caminho depois, sem perder o que já estiver na tela.',
    }),
  ];

  // ⤴ A SAÍDA, e só quando existe algo para voltar. Primeira ação da lista porque quem chegou aqui
  // pela âncora, com trabalho aberto, provavelmente só queria olhar as opções (N4).
  const continuar = temTrabalho
    ? el('button', {
      type: 'button',
      className: 'pv__continuar',
      textContent: '↩ Continuar o que eu estava fazendo',
    })
    : null;
  if (continuar) {
    continuar.addEventListener('click', () => aoContinuar());
    corpo.push(continuar);
  }

  corpo.push(
    cartao({
      caminho: 'tutor',
      tipo: 'primario',
      titulo: 'Descreva o seu processo',
      texto: 'Conte em algumas frases o que acontece na sua rotina. Ele conversa com você em '
        + 'português e vai montando o diagrama junto — e o que ele desenhar você desfaz com Ctrl+Z.',
      acao: 'Começar a conversa →',
    }),
    el('div', { className: 'pv__dupla' }, [
      cartao({
        caminho: 'exemplo',
        titulo: 'Ver um exemplo',
        texto: 'Um pedido de pizza já modelado, com dois participantes. Clique num elemento e '
          + 'pergunte o que ele faz: ele lê o que está aberto na tela.',
        acao: 'Abrir o exemplo',
      }),
      cartao({
        caminho: 'branco',
        titulo: 'Começar do zero',
        texto: 'Um diagrama novo, só com o evento de início — para quando você já sabe o que quer '
          + 'desenhar e prefere pedir peça por peça.',
        acao: 'Abrir tela em branco',
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
  );

  const tela = el('section', { className: 'pv' }, [el('div', { className: 'pv__folha' }, corpo)]);
  tela.setAttribute('aria-labelledby', 'pv-titulo');
  // O convite é a última coisa do `<body>`, então sem isto o Tab passaria por todo o modelador
  // antes de chegar nele. `-1` dá foco por código sem criar uma parada a mais no caminho.
  tela.tabIndex = -1;

  /** O cartão que está com a pergunta no ar, e o relógio que a desarma. */
  let armado = null;
  let relogio = null;

  function desarmar() {
    clearTimeout(relogio);
    relogio = null;
    if (!armado) return;
    armado.classList.remove('pv__cartao--armado');
    armado.querySelector('.pv__acao').textContent = armado.dataset.acao;
    armado = null;
  }

  /** Substituir o diagrama com trabalho vivo: pergunta no cartão, executa no segundo clique. */
  function precisaConfirmar(alvo, caminho) {
    if (!temTrabalho) return false;
    if (caminho !== 'exemplo' && caminho !== 'branco') return false;
    if (armado === alvo) { desarmar(); return false; }

    desarmar();
    armado = alvo;
    alvo.classList.add('pv__cartao--armado');
    alvo.querySelector('.pv__acao').textContent = '⚠️ Isto substitui o seu desenho — clique de novo';
    relogio = setTimeout(desarmar, JANELA_CONFIRMACAO_MS);
    return true;
  }

  tela.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-caminho]');
    if (!alvo) return;
    const caminho = alvo.dataset.caminho;
    if (precisaConfirmar(alvo, caminho)) return;
    aoEscolher(caminho);
  });

  // `Esc` fecha — mas só quando há para onde voltar. Sem trabalho aberto, fechar deixaria a pessoa
  // num canvas vazio sem nenhuma das três opções, que é a armadilha ao contrário.
  const noTeclado = (e) => {
    if (e.key === 'Escape' && temTrabalho) { e.preventDefault(); aoContinuar(); }
  };
  window.addEventListener('keydown', noTeclado);

  raiz.append(reservarRodape(tela));
  // ⚠ A marca no `<body>` é o que tira as barras do modelador de cena enquanto o convite está na
  // tela (dono, 2026-11-15: *"não precisamos do bpmn bizagi like… e nem do simulação… na tela
  // inicial"*). Elas vivem acima do convite no empilhamento — e com razão, porque depois da
  // escolha são elas que o aluno usa. Quem esconde é o CSS; aqui só se diz que o convite está no
  // ar — e é a mesma marca que tira a âncora de cena, porque você já está onde ela levaria.
  document.body.classList.add('pv-no-ar');
  tela.focus({ preventScroll: true });

  return {
    raiz: tela,
    fechar: () => {
      desarmar();
      window.removeEventListener('keydown', noTeclado);
      tela.remove();
      document.body.classList.remove('pv-no-ar');
    },
  };
}

/**
 * A ÂNCORA: o caminho de volta à tela base, e ele é permanente.
 *
 * ⚠ ESTE ELEMENTO EXISTE POR UM DEFEITO QUE A RODADA ANTERIOR CRIOU. A orientação (`montarBarra`)
 * morre na primeira edição — de propósito, porque o que foi editado não é mais exemplo — e com ela
 * morria o único "voltar ao menu" da tela. O que sobrava era o "♻️ Recomeçar" DENTRO da barra do
 * modelador, que nasce recolhida e é destrutiva. Resultado, nas palavras do dono (2026-11-16):
 * *"não temos mais nenhuma forma de voltar à tela inicial depois de fechar o balão, precisamos ter
 * uma forma que persista"*. A diretriz de acessibilidade cognitiva do W3C ("Let Users Go Back")
 * pede o mesmo: nunca prender a pessoa num fluxo sem saída, com o controle de volta rotulado e
 * persistente na moldura.
 *
 * Montada UMA vez, não escuta o `commandStack` e não tem ciclo de vida: é isso que faz dela um
 * caminho de volta, e não outra bolha que desaparece. Com a tela base no ar ela sai de cena por
 * CSS (`body.pv-no-ar`) — você não precisa de um botão para ir onde já está, e assim não existe
 * estado em JS para divergir.
 */
export function montarAncora({ raiz = document.body, aoVoltar = () => {} } = {}) {
  const botao = el('button', { type: 'button', className: 'pv-ancora', title: 'Voltar ao início' }, [
    el('span', { className: 'pv-ancora__icone', textContent: '⌂' }),
    el('span', { className: 'pv-ancora__txt', textContent: 'Início' }),
  ]);
  botao.setAttribute('aria-label', 'Voltar ao início e escolher outro caminho');
  botao.addEventListener('click', () => aoVoltar());
  raiz.append(botao);

  /**
   * A âncora senta AO LADO do interruptor da simulação, medindo-o.
   *
   * ⚠ O print pegou o que a medição dos "quatro cantos" não pegou: o alto à esquerda **não** está
   * livre — o `.bts-toggle-mode` ("Token Simulation") mora em y20–50, x20–168, e a âncora nasceu
   * em cima dele. Medir em vez de somar um número à mão é o que faz isto acompanhar um rótulo que
   * mude de tamanho (tradução, fonte do sistema) em vez de voltar a se sobrepor em silêncio.
   *
   * Em tela estreita não se mede nada: ali a faixa do alto é disputada pela simulação inteira, e a
   * âncora vive no bolso entre a paleta e ela, por `@media` — então a propriedade sai do elemento
   * para o CSS poder mandar.
   */
  function sentarAoLadoDaSimulacao() {
    if (window.innerWidth <= 520) { botao.style.removeProperty('--pv-ancora-left'); return; }
    const r = document.querySelector('.bts-toggle-mode')?.getBoundingClientRect();
    if (!r || !r.width) { botao.style.removeProperty('--pv-ancora-left'); return; }
    botao.style.setProperty('--pv-ancora-left', `${Math.round(r.right + 12)}px`);
  }

  sentarAoLadoDaSimulacao();
  requestAnimationFrame(sentarAoLadoDaSimulacao);
  const segundaOlhada = setTimeout(sentarAoLadoDaSimulacao, 400);
  window.addEventListener('resize', sentarAoLadoDaSimulacao);

  return {
    raiz: botao,
    remover: () => {
      clearTimeout(segundaOlhada);
      window.removeEventListener('resize', sentarAoLadoDaSimulacao);
      botao.remove();
    },
  };
}

/**
 * A ORIENTAÇÃO: o que fazer agora, no canto de quem pode ajudar.
 *
 * Substitui a pilula que ficava no alto do canvas. Ela dizia o que estava aberto e oferecia os
 * caminhos, mas (a) pousava EM CIMA do desenho, (b) nao explicava nada e (c) nao tinha relacao
 * visual nenhuma com o agente — que e' quem resolve a duvida de quem acabou de chegar.
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
 * ⚠ ELA NÃO CARREGA NAVEGAÇÃO (N6). Tinha "voltar ao menu · ver um exemplo" no rodapé, e isso
 * estava errado duas vezes: duplicava o caminho de volta e o punha no elemento que morre primeiro.
 * Navegação é da âncora, que é permanente. Some de quebra o aperto de 375 px, onde essa linha
 * ficava espremida embaixo da alavanca.
 *
 * Ela nao e' modal, nao bloqueia o canvas, fecha num clique e nao volta na mesma visita.
 */
export function montarBarra({
  raiz = document.body,
  estado,
  aoPerguntar = () => {},
} = {}) {
  if (estado !== 'exemplo' && estado !== 'branco') return null;

  const titulo = el('p', { className: 'pv-barra__titulo' });
  const texto = el('p', { className: 'pv-barra__texto' });
  const perguntar = el('button', { className: 'pv-barra__acao', type: 'button' });

  /** O que a barra diz quando NADA esta selecionado — por trilha. O nome, uma vez por texto. */
  const PADRAO = {
    exemplo: {
      titulo: 'Este diagrama é um exemplo',
      texto: `O ${NOME} lê o que está na tela. Clique em qualquer elemento e pergunte o que ele `
        + 'faz — ou peça para criar, ligar, renomear e mover.',
      acao: 'Perguntar sobre este diagrama',
      frase: FRASES.exemplo,
    },
    branco: {
      titulo: 'Sua tela em branco',
      texto: `Conte o seu processo em algumas frases e o ${NOME} desenha com você, passo a passo. `
        + 'O que ele desenhar você desfaz com Ctrl+Z.',
      acao: 'Descrever o meu processo',
      frase: FRASES.descrever,
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

  const fechar = el('button', { type: 'button', className: 'pv-barra__fechar', textContent: '×' });
  fechar.setAttribute('aria-label', 'Fechar esta ajuda');

  const barra = el('aside', { className: 'pv-barra' }, [fechar, titulo, texto, perguntar]);
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
   * modelador INTEIRA no rodapé (`calcularReserva`), então a alavanca sobe e cobria a última linha
   * da barra. Medir é a única forma de acompanhar uma reserva que muda quando a barra do modelador
   * expande.
   */
  function sentarSobreAAlavanca() {
    const r = document.querySelector('.bpmn-assist__toggle')?.getBoundingClientRect();
    if (!r || !r.height) return;
    barra.style.setProperty('--pv-barra-bottom', `${Math.round(window.innerHeight - r.top + 10)}px`);
  }

  // ⚠ Três momentos, e cada um existe por um motivo medido: AGORA (caso a alavanca já esteja
  // posta), no PRÓXIMO QUADRO e de novo em 400 ms — porque o ajudante escreve a reserva do rodapé
  // por `ResizeObserver`, depois da montagem. Medir só na montagem deu 110 px contra os 131 px
  // que a alavanca passou a ocupar.
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
        frase: fraseSobre(nome),
      });
    },
  };
}
