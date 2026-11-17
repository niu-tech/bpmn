// O widget: botão flutuante + painel. Só DOM e eventos — nenhuma regra de sessão mora aqui, e
// nenhuma credencial é lida daqui para exibição.
//
// ⚠ REDESENHO 2026-11-11, depois do primeiro uso real do dono na URL pública. O que ele viu:
// oito botões ao mesmo tempo ("Usar esta chave", "Remover chave", "Texto", "Voz", "Conectar",
// "Encerrar", "Falar", "Enviar"), um recado vermelho preso dizendo para aceitar um aviso que já
// estava aceito, e nenhum sinal de que o microfone estava ouvindo. Palavras dele: "a UI tá
// horrível, tá muito difícil de entender, são muitos botões".
//
// As quatro decisões que respondem a isso:
//  1. **Um botão de ação por vez.** "Começar" guarda a chave E conecta; vira "Encerrar" quando a
//     sessão está viva. Dois passos viraram um porque não existe caso em que alguém queira
//     guardar a chave e NÃO começar.
//  2. **O bloco da chave encolhe** para uma linha ("chave guardada nesta aba · trocar") assim que
//     chave e aviso estão prontos. O que já foi resolvido para de ocupar a tela.
//  3. **A dica é DERIVADA, nunca uma mensagem guardada.** O que falta é calculado de
//     `credentials` a cada render, então marcar o aviso faz a dica sumir no mesmo instante — era
//     exatamente o recado que ficava preso.
//  4. **Escutar é visível.** Medidor de nível ao lado do botão de falar, alimentado pelo mesmo
//     PCM que vai para o Gemini: se as barras não se mexem, o microfone não está chegando lá, e
//     isso se vê antes de gastar um turno.
//
// Acessibilidade, do que o painel realmente precisa (não é checklist decorativo):
//  - o botão é `aria-expanded` + `aria-controls`, então leitor de tela sabe que abre algo;
//  - o painel é `role="dialog"` `aria-modal="false"`: NÃO é modal de propósito — o aluno tem de
//    continuar mexendo no diagrama com o painel aberto;
//  - Esc fecha e devolve o foco ao botão, que é de onde ele veio;
//  - o estado vai numa região `aria-live="polite"`, senão quem não vê a bolinha não sabe que
//    conectou;
//  - a conversa é `aria-live="polite"` também: resposta que chega sem anúncio não existe para
//    leitor de tela;
//  - a cor do ponto NUNCA é o único sinal — o texto ao lado diz a mesma coisa, e o medidor tem
//    `aria-hidden` porque a frase "ouvindo você" já carrega o significado.
//
// ponytail: `textContent` em todo lugar; nenhum `innerHTML` com dado de modelo. Resposta de LLM
// é entrada não confiável, e a tela é do aluno.

import { STATE_LABELS, describeError } from '../session-manager.js';
import { FRASES, NOME } from '../identidade.js';

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of [].concat(children)) node.append(c);
  return node;
};

/** Barras do medidor. Nove é o bastante para parecer som e pouco para não custar layout. */
const BARRAS = 9;
/** Perfil de altura: as do meio sobem mais, senão parece uma régua e não um medidor. */
const PERFIL = Array.from({ length: BARRAS }, (_, i) => 0.35 + 0.65 * Math.sin(((i + 1) / (BARRAS + 1)) * Math.PI));

export function createWidget({ session, credentials, onClose } = {}) {
  const root = el('div', { className: 'bpmn-assist' });
  const panelId = 'bpmn-assist-panel';

  // ------------------------------------------------------------------ botão
  const dot = el('span', { className: 'bpmn-assist__dot' });
  dot.setAttribute('data-state', 'idle');
  const toggle = el('button', {
    className: 'bpmn-assist__toggle',
    type: 'button',
  }, [
    dot,
    el('span', { className: 'bpmn-assist__toggletxt' }, [
      el('strong', { textContent: NOME }),
      el('small', { textContent: 'tire dúvidas sobre o seu diagrama' }),
    ]),
  ]);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', panelId);

  // ------------------------------------------------------------------ cabeçalho
  /**
   * O SELO de estado, com ponto.
   *
   * ⚠ Era só uma palavra cinza ("ouvindo", "falando") e se perdia no cabeçalho — o aluno não
   * sabia, de relance, se o ajudante estava ouvindo ou só ligado (dono, 2026-11-14: "vamos
   * melhorar aquele 'Ouvindo' no header"). O ponto tem a cor do estado e PULSA enquanto há algo
   * acontecendo, então o estado se lê sem ler.
   */
  const statusDot = el('i', { className: 'bpmn-assist__statusdot' });
  const statusTxt = el('span', { className: 'bpmn-assist__statustxt', textContent: 'desligado' });
  const statusChip = el('span', { className: 'bpmn-assist__status' }, [statusDot, statusTxt]);
  const closeBtn = el('button', { className: 'bpmn-assist__icon', type: 'button', textContent: '✕' });
  closeBtn.setAttribute('aria-label', `Fechar o ${NOME}`);

  /**
   * O menu `⋯` — e ele existe para TIRAR coisa do caminho principal.
   *
   * `Encerrar` estava lado a lado com `Texto` e `Voz`, misturando **modo de entrada** com **fim de
   * sessão**, com o mesmo peso visual. Trocar a chave e o diagnóstico também não são ações do
   * turno: são de manutenção, e ocupavam linha fixa no painel.
   */
  const menuBtn = el('button', { className: 'bpmn-assist__icon', type: 'button', textContent: '⋯' });
  menuBtn.setAttribute('aria-label', 'Mais opções');
  menuBtn.setAttribute('aria-expanded', 'false');
  const menu = el('div', { className: 'bpmn-assist__menu' });
  menu.hidden = true;

  const head = el('div', { className: 'bpmn-assist__head' }, [
    el('h2', { id: 'bpmn-assist-title', textContent: NOME }),
    statusChip,
    menuBtn,
    closeBtn,
  ]);

  // ------------------------------------------------------------------ chave (BYOK)
  const keyInput = el('input', {
    type: 'password',
    autocomplete: 'off',
    placeholder: 'cole aqui a sua chave do Google AI Studio',
    id: 'bpmn-assist-key',
  });
  keyInput.setAttribute('spellcheck', 'false');
  keyInput.setAttribute('aria-label', 'Sua chave do Google AI Studio');

  const consent = el('input', { type: 'checkbox', id: 'bpmn-assist-consent' });
  const consentLabel = el('label', { className: 'bpmn-assist__consent', htmlFor: 'bpmn-assist-consent' }, [
    consent,
    el('span', {
      textContent: 'Entendi que a minha chave vai direto para o Google nesta aba, que ela viaja '
        + 'no endereço da conexão, e que o uso é cobrado na minha conta.',
    }),
  ]);

  // ⚠ O aviso continua INTEIRO e sempre alcançável — o que muda é que o parágrafo longo não
  // empurra o botão de ação para fora da primeira tela. Medido em 756x488 com o drive de página:
  // com o texto aberto, "Começar" nascia abaixo da dobra. O resumo visível e o texto do
  // consentimento, logo abaixo, já dizem os três fatos que importam (vai para o Google, viaja no
  // endereço, é cobrado de você).
  const privacidade = el('details', { className: 'bpmn-assist__privacy' }, [
    el('summary', {}, [
      el('strong', { textContent: 'A chave é sua. ' }),
      el('span', { textContent: 'Fica só nesta aba e vai só para o Google.' }),
    ]),
    el('p', {
      // ⚠ "Só em memória" NÃO quer dizer invisível, e o aluno merece saber isso ANTES de colar.
      // A conexão é direta do navegador e a chave vai na URL do WebSocket: ela aparece nas
      // ferramentas de rede e no histórico de requisições. Apontado na pesquisa visual de
      // 2026-11-14 como a informação que faltava nesta tela.
      textContent: 'Este site não tem chave própria e não guarda a sua: ela fica só na memória '
        + 'desta aba e some ao recarregar ou fechar. Não vai para nenhum servidor nosso — só '
        + 'para generativelanguage.googleapis.com. Como a conexão sai direto do seu navegador, a '
        + 'chave aparece nas ferramentas de rede dele: guardar só em memória não a torna '
        + 'invisível. Use uma chave que você possa revogar, e pegue a sua em aistudio.google.com.',
    }),
  ]);

  /**
   * ⚠ A ORDEM MUDOU, e ela é o recado. Esta tela abria pelo aviso de privacidade e pelo campo
   * da chave — ou seja, a primeira coisa que o produto fazia era **cobrar** algo de quem acabou
   * de chegar (dono, 2026-11-15: *"já chegar pedindo para a pessoa… meio complicado"*). Agora
   * abre dizendo o que ele é e quanto custa começar (nada), e só então pede a chave — com o
   * link de onde tirar. O aviso de privacidade continua inteiro, logo abaixo, onde ele já estava.
   */
  const convite = el('div', { className: 'bpmn-assist__convite' }, [
    // ⚠ O TÍTULO NÃO REPETE O NOME: o cabeçalho do painel, dois centímetros acima, já diz
    // `Tutor BPMN`. Esta linha dizia "Um ajudante que vê o seu diagrama" — o quinto lugar onde a
    // mesma coisa tinha outro nome, e o que sobrou da convergência de N1.
    el('p', { className: 'bpmn-assist__convite-titulo', textContent: 'Ele enxerga o diagrama que está aberto.' }),
    el('p', {
      className: 'bpmn-assist__convite-sub',
      // ⚠ "São dois passos, e o primeiro é gratuito" SAIU (dono, 2026-11-16): lido como está,
      // ele diz que existe um segundo passo que se paga — e não existe passo pago nenhum, aqui
      // nem depois. A intenção era dizer "começar não custa nada"; dizer qual é cada passo faz
      // isso melhor e sem deixar a dúvida para trás.
      textContent: 'Converse por voz ou por escrito: ele explica o que está na tela e desenha com '
        + 'você. São dois passos: pegar uma chave gratuita e colar aqui.',
    }),
  ]);

  /**
   * OS DOIS PASSOS.
   *
   * ⚠ A versão anterior já abria dizendo o que o produto é antes de pedir a chave — o que
   * resolveu o "chegar pedindo". O que sobrou foi a forma: um parágrafo contava três coisas de
   * uma vez (pegue a chave, cole, aceite), o link de onde tirar era texto solto no meio dela, e
   * quem nunca viu uma chave de API não tinha como saber que precisava SAIR do site e voltar.
   * Numerar é o que torna isso óbvio sem explicar (dono, 2026-11-15: *"melhorar essa primeira
   * tela de input de token, para deixar mais amigável ao usuário"*).
   *
   * O que NÃO mudou, de propósito: o texto do consentimento e o aviso de privacidade inteiro.
   * Eles dizem os três fatos que importam (vai para o Google, viaja no endereço, é cobrado de
   * você) e não são lugar de ganhar simpatia.
   */
  function passo(numero, titulo, corpo) {
    // O número é desenho: a lista já é `<ol>`, e o leitor de tela anuncia "item 1 de 2" sozinho.
    // Lê-lo duas vezes seria ruído, então a bolinha sai da árvore de acessibilidade.
    const n = el('span', { className: 'bpmn-assist__passo-n', textContent: String(numero) });
    n.setAttribute('aria-hidden', 'true');
    return el('li', { className: 'bpmn-assist__passo' }, [
      n,
      el('div', { className: 'bpmn-assist__passo-corpo' }, [
        el('b', { textContent: titulo }),
        ...corpo,
      ]),
    ]);
  }

  const linkAiStudio = (() => {
    const a = el('a', {
      className: 'bpmn-assist__botao-externo',
      textContent: 'Abrir o Google AI Studio ↗',
    });
    a.href = 'https://aistudio.google.com/apikey';
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    return a;
  })();

  const setupBlock = el('div', { className: 'bpmn-assist__setup' }, [
    convite,
    el('ol', { className: 'bpmn-assist__passos' }, [
      passo(1, 'Pegue a sua chave', [
        el('p', {
          // "Gratuita" agora é dito uma vez só, no convite logo acima. Repetir aqui era a mesma
          // palavra duas vezes em duas linhas — o defeito que os dois passos existem para evitar.
          textContent: 'Leva um minuto. Abre numa aba nova — volte aqui com ela copiada.',
        }),
        linkAiStudio,
      ]),
      passo(2, 'Cole a sua chave do Google AI Studio', [
        // Sem `<span>` visível: o título do passo JÁ é o rótulo, e repeti-lo logo abaixo era a
        // mesma frase duas vezes em duas linhas. O nome acessível vem do `aria-label`, não do
        // placeholder — placeholder some ao digitar e nunca foi rótulo.
        el('label', { className: 'bpmn-assist__field' }, [keyInput]),
        consentLabel,
      ]),
    ]),
    privacidade,
  ]);

  // A face compacta: tudo o que sobra depois que chave e aviso estão resolvidos.
  const trocarKey = el('button', { className: 'bpmn-assist__link', type: 'button', textContent: 'trocar' });
  const compacto = el('p', { className: 'bpmn-assist__compact' }, [
    el('span', { textContent: 'chave guardada nesta aba · ' }),
    trocarKey,
  ]);

  // ------------------------------------------------------------------ modo + liga/desliga
  /**
   * ⚠ NÃO existe mais seletor "Texto / Voz" no topo.
   *
   * O modo não é uma preferência que o aluno declara antes de falar: ele é consequência do que
   * ele FAZ. Escreveu e mandou, é texto; clicou no microfone ao lado de "Enviar", é voz. O
   * seletor ocupava a barra mais nobre da janela para perguntar algo que o próprio gesto já
   * responde (pedido do dono, 2026-11-14).
   */
  // ⚠ O ÚNICO botão de ação. Guarda a chave (se houver uma digitada) e conecta; vira "Encerrar".
  const powerBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Começar' });

  // `powerBtn` ANDA: enquanto é "Começar" ele é a ação principal e fica no rodapé; virando
  // "Encerrar" ele deixa de ser do turno e vai para o menu. Um elemento, dois lugares — porque o
  // que muda não é o botão, é a importância dele.
  /** As ações do rodapé: "Começar" antes de conectar, "Parar de falar" enquanto ele responde. */
  const acoes = el('div', { className: 'bpmn-assist__acoes' });

  // ------------------------------------------------------------------ falar + medidor
  /**
   * O MICROFONE, desenhado.
   *
   * ⚠ Era o caractere `●`: na tela virava um ponto azul que ninguém reconhece como microfone
   * (dono, 2026-11-14: "não tem o microfone"). Ícone de verdade, em `currentColor`, então ele
   * acompanha a cor do botão em cada estado em vez de precisar de uma imagem por estado.
   */
  const ICONE_MIC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
    + '<path fill="currentColor" d="M12 14.5a3 3 0 0 0 3-3v-5a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"/>'
    + '<path fill="currentColor" d="M17.5 11.5a1 1 0 1 0-2 0 3.5 3.5 0 0 1-7 0 1 1 0 1 0-2 0 5.5 5.5 0 0 0 4.5 5.41V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.09a5.5 5.5 0 0 0 4.5-5.41Z"/>'
    + '</svg>';
  /** Quadrado de PARAR: mesma família de desenho, para o botão não trocar de linguagem. */
  const ICONE_PARAR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">'
    + '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';

  /**
   * ÍCONES DOS DOIS MUDOS. Texto comprido em botão pequeno rouba a faixa inteira (dono,
   * 2026-11-15: *"poderiam ser botões ao invés de ser explicitamente escrito"*) — o nome
   * continua no `title` e no `aria-label`, que é onde ele serve.
   */
  const ICONE_MIC_MUDO = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">'
    + '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="currentColor"/>'
    + '<path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M4 4l16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICONE_MIC_ATIVO = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">'
    + '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="currentColor"/>'
    + '<path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICONE_SOM = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">'
    + '<path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/>'
    + '<path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICONE_SOM_MUDO = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">'
    + '<path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/>'
    + '<path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const talkBtn = el('button', { className: 'bpmn-assist__mic', type: 'button' });
  talkBtn.innerHTML = ICONE_MIC;
  /**
   * PARAR DE FALAR. Não é encerrar a sessão nem fechar o microfone: é calar a resposta em curso.
   *
   * Faltava (pedido do dono, 2026-11-14: "não temos um botão para o ajudante parar de falar").
   * Sem ele, o único jeito de interromper era falar por cima — e no modo texto nem isso.
   */
  const calarBtn = el('button', {
    className: 'bpmn-assist__btn bpmn-assist__btn--calar', type: 'button', textContent: 'Parar de falar',
  });
  talkBtn.setAttribute('aria-pressed', 'false');

  const barras = PERFIL.map(() => el('span', { className: 'bpmn-assist__bar' }));
  const meter = el('div', { className: 'bpmn-assist__meter' }, barras);
  meter.setAttribute('aria-hidden', 'true');          // a frase ao lado já diz o que isto mostra
  const micLabel = el('span', { className: 'bpmn-assist__miclabel', textContent: '' });

  // ⚠ O microfone mora DENTRO do compositor, à direita, ao lado do enviar — nunca numa fileira
  // própria em cima. Dois motivos, e os dois são de uso e não de gosto:
  //   • a mão do aluno já está no compositor; subir para outra fileira para falar é o atrito que
  //     o dono apontou vendo o vídeo do Orbit (2026-11-13);
  //   • separar o campo de texto do microfone é o padrão que confunde — a pessoa vê DUAS entradas
  //     e não sabe qual vale. O ditado SUBSTITUI a digitação; não se empilha com ela.
  // Enquanto grava, o compositor vira a faixa do medidor e o microfone vira PARAR.

  // ------------------------------------------------------------------ dica derivada
  const hint = el('p', { className: 'bpmn-assist__hint' });

  // ------------------------------------------------------------------ conversa
  const liveRegion = el('p', { className: 'bpmn-assist__sr' });
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');

  /**
   * A PRIMEIRA TELA da conversa — e a única chance de dizer o que isto é.
   *
   * ⚠ Era uma linha cinza ("Pergunte sobre notação BPMN: eventos, atividades, gateways…"), que
   * descrevia um glossário e escondia o produto: ele **lê o diagrama aberto**, **desenha junto**
   * e **fala**. O dono, depois de usar: *"vamos apresentar realmente o poder que é esse nosso
   * projeto, que ele pode perguntar o que quiser, pode mudar o diagrama"*.
   *
   * Os exemplos são BOTÕES, e não uma lista de sugestões: a forma mais curta de aprender o que
   * dá para pedir é pedir uma vez. Clicar escreve a frase no campo — e, com a sessão de pé,
   * manda. Sem sessão, só escreve e foca: quem decide começar (e gastar a chave) é ele.
   */
  const EXEMPLOS = [
    'O que esse processo faz?',
    'Crie uma tarefa "Conferir estoque" depois do início',
    FRASES.descrever,
    'Qual a diferença entre gateway exclusivo e paralelo?',
  ];
  const exemplos = el('div', { className: 'bpmn-assist__exemplos' },
    EXEMPLOS.map((frase) => {
      const b = el('button', { className: 'bpmn-assist__exemplo', type: 'button', textContent: frase });
      b.addEventListener('click', () => {
        input.value = frase;
        // `submit` e' declarado mais abaixo; aqui dentro do clique ja' existe.
        if (ultimaVista?.canAsk) { submit(); } else { input.focus(); }
      });
      return b;
    }));
  const empty = el('div', { className: 'bpmn-assist__empty' }, [
    el('p', { className: 'bpmn-assist__empty-titulo', textContent: 'Converse com o seu diagrama.' }),
    el('p', {
      className: 'bpmn-assist__empty-sub',
      textContent: 'Ele enxerga o que está aberto na tela, responde em português e desenha junto '
        + '— por voz ou por escrito. Pode pedir para criar, ligar, mover, renomear e apagar; antes '
        + 'de apagar, ele pergunta.',
    }),
    exemplos,
    el('p', {
      className: 'bpmn-assist__empty-rodape',
      textContent: 'O diagrama que está aberto é um exemplo — mude à vontade, ou descreva o seu '
        + 'processo e construa o seu do zero com ele.',
    }),
  ]);
  const log = el('ul', { className: 'bpmn-assist__log' });
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', `Conversa com o ${NOME}`);

  // ------------------------------------------------------------------ diagnóstico
  // Existe porque depurar conversa por descrição não funciona: o dono precisa COLAR o que
  // aconteceu. O texto é o mesmo de `session.report()`, já redigido pelo diário.
  const diagText = el('pre', { className: 'bpmn-assist__diagtext', textContent: '(abra para ver)' });
  const copyBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Copiar' });
  /**
   * SALVAR A SESSÃO INTEIRA num arquivo.
   *
   * Copiar texto serve para colar numa conversa; isto serve para INVESTIGAR: sai um JSON com a
   * conversa (com número de turno), o diário completo, as contagens, o contexto que foi enviado,
   * a saúde do som e o desenho. É o que transforma "deu erro aqui" em um caso que alguém
   * consegue reconstruir sem estar na frente da tela.
   */
  const salvarBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Salvar sessão' });
  const copyState = el('span', { className: 'bpmn-assist__copystate', textContent: '' });
  const diagBox = el('details', { className: 'bpmn-assist__diag' }, [
    el('summary', { textContent: 'Diagnóstico da sessão' }),
    diagText,
    el('div', { className: 'bpmn-assist__row' }, [copyBtn, salvarBtn, copyState]),
  ]);

  // ⚠ `talkRow` NÃO entra no corpo rolável. Entrava, e aí cada resposta empurrava o botão de
  // falar para fora da tela: "a gente fala e aí tem que subir a conversa toda para falar de
  // novo" (dono, 2026-11-11). Controle que se usa a cada turno mora no rodapé fixo; só a
  // conversa rola.
  // Menos regiões: a linha da chave e o diagnóstico saem do corpo e vão para o menu. Eles
  // fragmentavam o painel na vertical sem nunca serem a ação do momento.
  /**
   * TESTAR A CONEXÃO: o aluno precisava de um jeito de saber se o problema é dele ou do servidor.
   * Antes a única informação era "o servidor não respondeu", no meio de uma conversa morta.
   */
  const testarBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Testar conexão' });

  menu.append(powerBtn, testarBtn, compacto, diagBox);

  const body = el('div', { className: 'bpmn-assist__body' }, [
    setupBlock, hint, empty, log,
  ]);

  // ------------------------------------------------------------------ composer
  const input = el('textarea', { placeholder: 'Escreva a sua pergunta…', rows: 1 });
  input.setAttribute('aria-label', 'Sua pergunta');
  const sendBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Enviar' });
  const composer = el('div', { className: 'bpmn-assist__composer' }, [input, talkBtn, sendBtn]);

  /**
   * A faixa de VOZ. Substitui o compositor enquanto a sessão de áudio está ativa — não convive
   * com ele.
   *
   * ⚠ Em voz NÃO existe "Enviar": não há mensagem para enviar. Mostrar os três juntos (medidor,
   * parar e enviar) foi apontado como defeito crítico na pesquisa visual, e o motivo é simples —
   * o aluno não sabe qual é a ação daquele momento.
   */
  const vozEstado = el('p', { className: 'bpmn-assist__vozestado' }, [
    el('strong', { className: 'bpmn-assist__voztitulo', textContent: 'Estou ouvindo' }),
    el('span', { className: 'bpmn-assist__vozdica', textContent: 'pode falar normalmente' }),
  ]);
  const pararBtn = el('button', { className: 'bpmn-assist__parar', type: 'button' });
  pararBtn.setAttribute('aria-label', 'Encerrar a conversa por voz');
  pararBtn.innerHTML = ICONE_PARAR;
  pararBtn.title = 'Encerrar a conversa por voz';
  /**
   * OS DOIS MUDOS, na faixa de voz e sempre à mão (pedido do dono, 2026-11-15).
   *
   * ⚠ Ficam AQUI, e não no menu ⋯: os dois existem para um momento que chega sem aviso —
   * alguém começa a falar na sala (e a escuta contínua corta o agente), ou a resposta falada
   * atrapalha quem está por perto. Botao escondido em menu não serve para urgência.
   *
   * Não encerram sessão nem trocam de modo: continuar na mesma sessão é o que mantém a
   * conversa e a vaga.
   */
  const mudoMicBtn = el('button', { className: 'bpmn-assist__mudo', type: 'button' });
  const mudoAgenteBtn = el('button', { className: 'bpmn-assist__mudo', type: 'button' });
  const mudos = el('div', { className: 'bpmn-assist__mudos' }, [mudoMicBtn, mudoAgenteBtn]);
  const faixaVoz = el('div', { className: 'bpmn-assist__voz' }, [vozEstado, meter, mudos, pararBtn]);

  /**
   * ⚠ A linha de contrato SAIU do rodapé (pedido do dono, 2026-11-14: "essa mensagem embaixo…
   * polui a tela"). Ela dizia, a cada tela, o que o ajudante pode fazer no diagrama — informação
   * de PRIMEIRA vez, cobrando espaço para sempre. O que o aluno precisa ver todo dia é a
   * conversa; o que o ajudante faz sem pedir ele descobre no momento em que acontece, e o
   * destrutivo continua perguntando antes.
   */

  /**
   * A confirmação de uma ação destrutiva (F7, tarefa 3.4).
   *
   * Fica no RODAPÉ, no lugar onde a ação do momento mora — é a regra desta change: uma ação
   * principal por estado. Enquanto ela está na tela, o pedido é a ação; o resto do rodapé sai.
   *
   * ⚠ Os dois botões respondem a MESMA pergunta, e nenhum deles remove nada: eles resolvem a
   * promessa que a ferramenta está esperando. A remoção continua acontecendo num lugar só.
   */
  const confirmaTexto = el('p', { className: 'bpmn-assist__confirmatxt' });
  const simBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--perigo', type: 'button', textContent: 'Apagar' });
  const naoBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Cancelar' });
  const confirmaBox = el('div', { className: 'bpmn-assist__confirma' }, [
    confirmaTexto,
    // Cancelar PRIMEIRO no DOM: é ele que recebe o foco antes, porque é o que o aluno
    // aperta por reflexo quando não leu a frase inteira.
    el('div', { className: 'bpmn-assist__confirmabtns' }, [naoBtn, simBtn]),
  ]);
  confirmaBox.hidden = true;
  confirmaBox.setAttribute('role', 'alertdialog');
  confirmaBox.setAttribute('aria-live', 'assertive');

  const rodape = el('div', { className: 'bpmn-assist__footer' }, [confirmaBox, faixaVoz, micLabel, composer, acoes]);

  // O olho do aluno fica EMBAIXO: é de lá que saem enviar, falar, começar e parar.
  const panel = el('div', { className: 'bpmn-assist__panel', id: panelId }, [head, menu, body, rodape, liveRegion]);
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');     // o diagrama continua utilizável de propósito
  panel.setAttribute('aria-labelledby', 'bpmn-assist-title');

  root.append(toggle, panel);

  // ------------------------------------------------------------------ render

  let renderedUpTo = 0;
  let lastAnnounced = '';

  /**
   * Quem rola é o CORPO, não a lista.
   *
   * ⚠ `log.scrollTop` nunca fez nada: a `<ul>` não tem barra, quem tem `overflow: auto` é o
   * `.bpmn-assist__body` em volta dela. Então a conversa crescia e a tela ficava parada — o
   * aluno tinha de arrastar a barra a cada resposta (dono, 2026-11-14: "a cada nova mensagem do
   * agente a tela não desce").
   *
   * E só desce se ele JÁ estava no fim: quem subiu para reler não pode ser puxado de volta no
   * meio da leitura.
   */
  const corpoRolavel = () => log.closest('.bpmn-assist__body') ?? log.parentElement ?? log;

  function estaNoFim(folga = 40) {
    const c = corpoRolavel();
    return c.scrollHeight - c.scrollTop - c.clientHeight <= folga;
  }

  /**
   * A ROLAGEM É DELE enquanto ele estiver lendo — e o agente falando não muda isso.
   *
   * ⚠ Medir "está no fim?" a cada pedaço de legenda não basta: a resposta falada chega várias
   * vezes por segundo, e com a folga de 140 px uma volta da rodinha ainda contava como "no fim" —
   * então a tela puxava ele de volta para baixo no meio da leitura (dono, 2026-11-15: *"enquanto
   * ele está falando, eu não consigo subir a conversa"*). Agora a intenção dele é LEMBRADA:
   * subiu, descola; voltou ao fim, cola de novo. Mandar uma mensagem sempre cola.
   */
  let coladoNoFim = true;
  corpoRolavel().addEventListener('scroll', () => { coladoNoFim = estaNoFim(); }, { passive: true });

  function descerAteOFim() {
    const c = corpoRolavel();
    c.scrollTop = c.scrollHeight;
  }

  /**
   * Os CANDIDATOS de uma mensagem de ferramenta, como botões (change close-the-loop, tarefa 4).
   *
   * ⚠ Nascem DENTRO da bolha da ferramenta, e não numa área fixa do painel: a escolha pertence
   * àquele momento da conversa. Numa área fixa ela sobreviveria à resposta seguinte, e o aluno
   * clicaria num "em qual pool?" que já não está mais em pé.
   *
   * São `<button>` de verdade (não `div` com clique): foco por Tab, Enter e Espaço de graça, e
   * leitor de tela os anuncia como ação. O aluno de mãos livres é o caso de uso inteiro.
   */
  /**
   * Os cartões de **VER NO DESENHO** (harvest 6.4). Mesma forma dos candidatos, outro verbo.
   *
   * ⚠ Não desabilitam depois do clique, e isso é de propósito: escolher é uma vez (a segunda
   * escolha chegaria ao modelo fora de ordem), mas OLHAR é quantas vezes o aluno quiser — ele
   * compara dois elementos clicando em um, depois no outro.
   */
  function montarMostraveis(m) {
    const caixa = el('div', { className: 'bpmn-assist__cands bpmn-assist__cands--ver' });
    caixa.setAttribute('role', 'group');
    caixa.setAttribute('aria-label', 'Ver no desenho');
    for (const c of m.mostraveis) {
      const b = el('button', {
        className: 'bpmn-assist__cand bpmn-assist__cand--ver',
        type: 'button',
        textContent: c.rotulo,
      });
      b.title = `ver ${c.rotulo} no desenho (${c.id})`;
      b.addEventListener('click', () => {
        const ok = session.mostrarNoDesenho(c);
        // Marca o ÚLTIMO que o aluno olhou: sem isso, clicar em três seguidos não dá retorno
        // nenhum na tela, e ele não sabe se o clique pegou.
        for (const outro of caixa.querySelectorAll('button')) {
          outro.classList.remove('bpmn-assist__cand--escolhido');
        }
        if (ok) b.classList.add('bpmn-assist__cand--escolhido');
      });
      caixa.append(b);
    }
    return caixa;
  }

  /**
   * A PROVENIÊNCIA da resposta: título e localizador do que a consulta SERVIU.
   *
   * ⚠ Existe por causa da voz (K6, 2026-11-16). No texto o aluno vê a marca `[fonte:*]` já
   * conferida dentro da frase; na voz o modelo não escreve marca nenhuma — ele fala —, e sem
   * isto a resposta falada não tinha de onde ser conferida. A lista NÃO vem do que o modelo
   * disse: vem do registro da consulta, que é nosso.
   *
   * Chave não aparece: `gateways:exclusivo` é prova para nós e ruído para quem lê. O que o
   * aluno confere é "Gateways §10.5".
   */
  /**
   * O DETALHE da construção, dentro da mensagem que cresce.
   *
   * ⚠ As linhas continuam existindo — elas são a prova do que o agente fez (H3). O que muda é
   * que elas param de rolar a conversa doze vezes enquanto a pessoa lê.
   */
  function montarConstrucao(m) {
    const caixa = el('div', { className: 'bpmn-assist__constr' });
    for (const linha of m.construcao.detalhes) {
      caixa.append(el('div', { className: 'bpmn-assist__constr-item', textContent: linha }));
    }
    return caixa;
  }

  function montarFontes(m) {
    const caixa = el('div', { className: 'bpmn-assist__fontes' });
    caixa.append(el('span', { className: 'bpmn-assist__fontes-rotulo', textContent: 'fonte:' }));
    for (const f of m.fontes) {
      // O LOCALIZADOR visível; o título inteiro fica no tooltip. Ver o apresentador: o
      // localizador é o ponteiro ("Gateways › exclusivo (XOR)"), o título é a frase do verbete.
      const rotulo = f.localizador || f.titulo || f.chave;
      // Link só quando o índice traz um: a referência oficial é onde o aluno confere por fora.
      const item = f.link
        ? el('a', { className: 'bpmn-assist__fonte', textContent: rotulo, href: f.link })
        : el('span', { className: 'bpmn-assist__fonte', textContent: rotulo });
      if (f.link) { item.target = '_blank'; item.rel = 'noopener noreferrer'; }
      // ⚠ Material NOSSO não pode ser lido como texto da norma da OMG — a distinção é do
      // acervo (`contentMode`) e precisa sobreviver até a tela.
      const detalhe = [f.titulo, f.chave].filter(Boolean).join(' · ');
      item.title = f.nosso ? `material deste site · ${detalhe}` : detalhe;
      caixa.append(item);
    }
    if (m.fontes.every((f) => f.nosso)) {
      caixa.append(el('span', { className: 'bpmn-assist__fontes-nota', textContent: 'material deste site' }));
    }
    return caixa;
  }

  /**
   * O AVISO de citação que não fecha — e ele existe por causa do áudio.
   *
   * No texto a etiqueta errada vira `[fonte não conferida]` antes de aparecer e assunto
   * encerrado. Na voz o aluno JÁ OUVIU a frase: a legenda também é corrigida, mas calar que a
   * fonte não fecha deixaria a palavra falada valer mais que o nosso registro.
   */
  function montarCitacaoSuspeita(m) {
    const quantas = m.citacaoSuspeita.length;
    return el('div', {
      className: 'bpmn-assist__citacao-suspeita',
      textContent: quantas === 1
        ? 'a fala citou uma fonte que nenhuma consulta desta sessão devolveu'
        : `a fala citou ${quantas} fontes que nenhuma consulta desta sessão devolveu`,
    });
  }

  function montarCandidatos(m) {
    const caixa = el('div', { className: 'bpmn-assist__cands' });
    caixa.setAttribute('role', 'group');
    caixa.setAttribute('aria-label', 'Escolha uma opção');
    for (const c of m.candidatos) {
      const b = el('button', { className: 'bpmn-assist__cand', type: 'button', textContent: c.rotulo });
      b.title = c.id ? `escolher ${c.rotulo} (${c.id})` : `escolher ${c.rotulo}`;
      b.addEventListener('click', () => {
        // UMA vez: duas escolhas para a mesma pergunta chegariam ao modelo fora de ordem, e a
        // segunda valeria — o aluno veria o agente agir sobre o que ele NÃO clicou.
        if (caixa.dataset.escolhido === '1') return;
        caixa.dataset.escolhido = '1';
        for (const outro of caixa.querySelectorAll('button')) outro.disabled = true;
        b.classList.add('bpmn-assist__cand--escolhido');
        session.escolherCandidato(c);
      });
      caixa.append(b);
    }
    return caixa;
  }

  function renderMessages(messages) {
    // A intenção do aluno, e não uma medição por pedaço de legenda (ver `coladoNoFim`).
    const seguir = coladoNoFim;
    /**
     * A lista ENCOLHEU: alguém tirou uma mensagem (a bolha de espera que não virou resposta, ou
     * o aviso de conexão que a conexão de volta apagou). O append incremental não dá conta
     * disso — sem este ramo, a bolha some do estado e **fica na tela**.
     */
    if (messages.length < renderedUpTo) {
      log.replaceChildren();
      renderedUpTo = 0;
    }
    // Append incremental: redesenhar a lista inteira a cada frame de legenda faria o leitor de
    // tela reanunciar tudo e perderia a posição de rolagem.
    for (let i = renderedUpTo; i < messages.length; i++) {
      const m = messages[i];
      const li = el('li', { className: `bpmn-assist__msg bpmn-assist__msg--${m.role}` });
      if (m.kind) li.classList.add(`bpmn-assist__msg--${m.kind}`);
      if (m.rodando) li.classList.add('bpmn-assist__msg--rodando');
      li.dataset.id = String(m.id);
      if (m.via) {
        // ⚠ "escolhido no chat" é um terceiro canal, e não um sinônimo de digitado: o aluno
        // clicou num candidato. Dizer "digitado" ali seria a conversa mentindo sobre o gesto.
        const comoVeio = { voz: 'por voz', escolha: 'escolhido no chat' }[m.via] ?? 'digitado';
        li.append(el('span', { className: 'bpmn-assist__via', textContent: comoVeio }));
      }
      li.append(el('span', { className: 'bpmn-assist__text', textContent: m.text }));
      if (m.construcao?.detalhes?.length) li.append(montarConstrucao(m));
      if (m.citacaoSuspeita?.length) li.append(montarCitacaoSuspeita(m));
      if (m.fontes?.length) li.append(montarFontes(m));
      if (m.candidatos?.length) li.append(montarCandidatos(m));
      if (m.mostraveis?.length) li.append(montarMostraveis(m));
      log.append(li);
    }
    // Bolhas CRESCEM no lugar: a legenda chega em pedaços, e a linha da ferramenta começa em
    // "procurando…" e vira o resultado. ⚠ A da ferramenta nem sempre é a última — a resposta do
    // modelo pode chegar depois dela —, então não dá para atualizar só o fim da lista.
    for (let i = Math.max(0, messages.length - 6); i < messages.length; i++) {
      const m = messages[i];
      const alvo = log.querySelector(`[data-id="${m.id}"] .bpmn-assist__text`);
      if (alvo && alvo.textContent !== m.text) alvo.textContent = m.text;
      const li = log.querySelector(`[data-id="${m.id}"]`);
      if (li) li.classList.toggle('bpmn-assist__msg--rodando', Boolean(m.rodando));
      // ⚠ Os candidatos chegam DEPOIS da bolha: a linha da ferramenta nasce em "criando…" e só
      // no fim se sabe que a ferramenta recusou por ambiguidade. Sem este ramo, os botões só
      // apareceriam na próxima mensagem — ou nunca.
      // ⚠ As fontes chegam DEPOIS do texto, e na voz a bolha já existia quando a consulta
      // terminou: sem este ramo a proveniência só apareceria na mensagem seguinte — ou nunca.
      // A construção CRESCE: a lista de detalhes é reescrita a cada elemento novo.
      if (li && m.construcao?.detalhes?.length) {
        const atual = li.querySelector('.bpmn-assist__constr');
        if (!atual || atual.children.length !== m.construcao.detalhes.length) {
          atual?.remove();
          li.append(montarConstrucao(m));
        }
      }
      if (li && m.citacaoSuspeita?.length && !li.querySelector('.bpmn-assist__citacao-suspeita')) {
        li.append(montarCitacaoSuspeita(m));
      }
      if (li && m.fontes?.length && !li.querySelector('.bpmn-assist__fontes')) {
        li.append(montarFontes(m));
      }
      if (li && m.mostraveis?.length && !li.querySelector('.bpmn-assist__cands--ver')) {
        li.append(montarMostraveis(m));
      }
      if (li && m.candidatos?.length && !li.querySelector('.bpmn-assist__cands')) {
        li.append(montarCandidatos(m));
        if (seguir) descerAteOFim();
      }
    }
    renderedUpTo = messages.length;
    // ⚠ Um convite por vez. Antes da chave, a tela é o convite (o que isto é + como começar);
    // depois dela, as boas-vindas com os exemplos. Os dois juntos repetiam o mesmo discurso em
    // dois títulos e empurravam o campo da chave para fora da dobra.
    // ⚠ `credentials.ready`, e não a variável `resolvido` do `render`: esta função é outra, e
    // usar a de lá derrubou a tela inteira com "resolvido is not defined" (visto no print da aba
    // do dono em 2026-11-15, antes de ele tocar em nada).
    empty.hidden = messages.length > 0 || !credentials.ready;
    if (seguir) descerAteOFim();
  }

  /**
   * O que falta, calculado AGORA de `credentials` e do estado — nunca guardado. É o conserto do
   * recado vermelho que ficava preso na conversa.
   */
  function dica({ state, reason }) {
    // ⚠ VAZIO de propósito: com os dois passos numerados na tela, esta linha dizia pela TERCEIRA
    // vez a mesma coisa (o título do passo 2, o placeholder do campo e aqui). Repetir instrução
    // não deixa ninguém mais seguro — só empurra o botão para longe.
    if (!credentials.hasKey) return '';
    if (!credentials.consented) return 'Marque o aviso sobre a chave para poder começar.';
    if (credentials.lastRejection === 'bad-key') {
      return 'O Google recusou essa chave. Confira em aistudio.google.com e informe de novo em "trocar".';
    }
    // ⚠ O erro NÃO se repete aqui: ele já está no alto, do lado do nome do ajudante, e já
    // virou linha na conversa. Três cópias da mesma frase na mesma tela (pedido do dono,
    // 2026-11-14: "ela tá duplicada hoje, tá lá embaixo, lá em cima; só precisa estar lá em
    // cima") não informam mais — só empurram a conversa para fora da tela.
    return '';
  }

  function renderMeter(level, ativo) {
    for (let i = 0; i < barras.length; i++) {
      const alt = ativo ? Math.max(0.08, Math.min(1, level * PERFIL[i] * 1.6)) : 0.08;
      barras[i].style.transform = `scaleY(${alt.toFixed(3)})`;
    }
  }

  /** A última vista publicada. Os botões de mudo perguntam a ela qual é o estado de agora. */
  let ultimaVista = null;
  /** O que cada botão de ícone está mostrando AGORA — para não recriar o `<svg>` à toa (ver render). */
  let ultimoIconeMic = null;
  let ultimoIconeSom = null;
  let ultimoIconeMicrofoneGrande = null;

  function render(view) {
    ultimaVista = view;
    const { state, reason, mode, micOn, level = 0, busy, canAsk, messages, confirmacao = null, falando = false } = view;
    /**
     * ⚠ Declarado AQUI, antes de QUALQUER uso.
     *
     * A faixa de voz FICA quando o microfone está mudo: mudo é um estado DENTRO da conversa por
     * voz, não a saída dela (era `mode === 'voz' && micOn`, e mutar zera o `micOn` — então a
     * faixa sumia e a tela virava a de quem encerrou a voz). E mora no topo porque já derrubei a
     * tela do dono uma vez usando uma constante acima da linha em que ela nasce.
     */
    const emVoz = mode === 'voz' && (micOn || Boolean(view.micMudo));

    dot.setAttribute('data-state', state);
    /**
     * ⚠ **"OUVINDO" EXIGE MICROFONE ABERTO.** O estado técnico `listening` significa *"a vez é
     * do aluno"*, e o turno digitado passa por ele também — então o selo dizia "ouvindo" numa
     * sessão de TEXTO, sem microfone nenhum aberto (dívida 6.5 da colheita da cápsula). Numa
     * ferramenta de voz, dizer que está ouvindo quando não está é a mentira mais cara que a
     * tela pode contar: o aluno fala e ninguém escuta.
     */
    const label = (state === 'listening' && !micOn)
      ? 'processando'
      : (STATE_LABELS[state] ?? state);
    /**
     * ⚠ O selo diz o ESTADO, não o motivo. Ele carregava a frase inteira do erro — e a mesma
     * frase estava na conversa, logo abaixo: duas cópias na mesma tela (dono, 2026-11-14: "está
     * aparecendo em cima e embaixo"), com a de cima ainda espremendo o título do painel em duas
     * linhas. O motivo fica no balão da conversa, onde tem lugar, e aqui vira o `title` para
     * quem passar o mouse.
     */
    statusTxt.textContent = label;
    statusChip.title = state === 'error' ? describeError(reason) ?? '' : '';
    statusChip.setAttribute('data-state', state);
    statusDot.setAttribute('data-state', state);

    if (statusChip.textContent !== lastAnnounced) {
      // O nome por extenso, e não "Ajudante": esta linha é o que o leitor de tela ANUNCIA a cada
      // troca de estado — era o sexto lugar onde a coisa tinha outro nome, e o único que só
      // aparece para quem não vê o cabeçalho.
      liveRegion.textContent = `${NOME} ${statusChip.textContent}.`;
      lastAnnounced = statusChip.textContent;
    }

    // Chave: o bloco inteiro só enquanto falta algo; depois, uma linha.
    const resolvido = credentials.ready;
    setupBlock.hidden = resolvido;
    compacto.hidden = !resolvido;
    consent.checked = credentials.consented;
    trocarKey.disabled = busy;

    // UM botão, dois papéis — e dois LUGARES. Como "Começar" ele é a ação principal e fica no
    // RODAPÉ, junto do resto do que se clica; como "Encerrar" ele é manutenção e vai para o menu.
    powerBtn.textContent = canAsk ? 'Encerrar sessão' : 'Começar';
    powerBtn.classList.toggle('bpmn-assist__btn--primary', !canAsk);
    powerBtn.classList.toggle('bpmn-assist__btn--perigo', canAsk);
    powerBtn.disabled = busy || (!canAsk && !credentials.hasKey && !keyInput.value);
    const ondeDeveEstar = canAsk ? menu : acoes;
    if (powerBtn.parentElement !== ondeDeveEstar) ondeDeveEstar.append(powerBtn);

    // Os dois mudos dizem o que FAZEM agora, e marcam quando estão ligados.
    /**
     * ⚠ **O ÍCONE SÓ É REDESENHADO QUANDO MUDA**, e isto não é micro-otimização: era o
     * defeito.
     *
     * Trocar `innerHTML` destrói e recria o `<svg>` de dentro do botão. Durante a resposta
     * falada o painel republica várias vezes por segundo (um publish por pedaço de áudio), então
     * o filho do botão era recriado no meio do clique — o `mousedown` caía num nó que já não
     * existia no `mouseup`, e o navegador **não dispara `click`**. Para o dono, o botão
     * simplesmente não fazia nada (2026-11-15), e numa página parada funcionava — que é o pior
     * tipo de bug: só aparece quando o produto está vivo.
     */
    const micEstaMudo = Boolean(view.micMudo);
    const agenteEstaMudo = Boolean(view.agenteMudo);
    if (ultimoIconeMic !== micEstaMudo) {
      mudoMicBtn.innerHTML = micEstaMudo ? ICONE_MIC_MUDO : ICONE_MIC_ATIVO;
      ultimoIconeMic = micEstaMudo;
    }
    mudoMicBtn.title = micEstaMudo
      ? 'O seu microfone está mudo — clique para voltar a falar'
      : 'Mutar o seu microfone (a conversa continua)';
    mudoMicBtn.setAttribute('aria-label', mudoMicBtn.title);
    mudoMicBtn.setAttribute('aria-pressed', String(micEstaMudo));
    mudoMicBtn.classList.toggle('bpmn-assist__mudo--ligado', micEstaMudo);

    if (ultimoIconeSom !== agenteEstaMudo) {
      mudoAgenteBtn.innerHTML = agenteEstaMudo ? ICONE_SOM_MUDO : ICONE_SOM;
      ultimoIconeSom = agenteEstaMudo;
    }
    mudoAgenteBtn.title = agenteEstaMudo
      ? 'Ele está respondendo só por escrito — clique para ouvir de novo'
      : 'Só texto: ele responde por escrito, sem falar';
    mudoAgenteBtn.setAttribute('aria-label', mudoAgenteBtn.title);
    mudoAgenteBtn.setAttribute('aria-pressed', String(agenteEstaMudo));
    mudoAgenteBtn.classList.toggle('bpmn-assist__mudo--ligado', agenteEstaMudo);

    faixaVoz.classList.toggle('bpmn-assist__voz--mudo', micEstaMudo);

    // Parar de falar só existe enquanto há fala. Fora disso, nem ocupa linha.
    if (calarBtn.parentElement !== acoes) acoes.append(calarBtn);
    // Com a faixa de voz na tela, calar é o ícone de som (que também corta a resposta em curso):
    // o botão largo embaixo virou uma segunda porta para a mesma ação.
    calarBtn.hidden = !falando || emVoz;
    acoes.hidden = Boolean(confirmacao) || (!falando && canAsk);

    // ⚠ UMA AÇÃO PRINCIPAL POR ESTADO. Ouvindo, o rodapé é a faixa de voz — sem campo de texto e
    // sem "Enviar", porque não há mensagem para enviar. Digitando, não existe controle de gravação.
    // Mostrar os dois juntos foi o defeito crítico apontado na pesquisa visual.
    // ⚠ `micOn` e não `canAsk`: durante uma ferramenta `canAsk` é falso, e a faixa inteira
    // desaparecia no meio do turno — justamente quando ela tem de dizer "consultando o diagrama".
    // Rodapé que se esvazia no meio do turno é o que faz o aluno achar que travou.
    // Pedido de confirmação é a ação do momento: ele toma o rodapé e o resto sai.
    const perguntando = Boolean(confirmacao);
    const perguntaNova = perguntando && confirmaBox.hidden;
    confirmaBox.hidden = !perguntando;
    if (perguntando) {
      const alvo = confirmacao.alvo ?? {};
      const comoChamar = alvo.nome ? `"${alvo.nome}"` : (alvo.id ?? 'o elemento');
      const tipo = alvo.tipo ? ` (${alvo.tipo.toLowerCase()})` : '';
      // O id entra junto do nome: dois elementos com o mesmo rótulo é caso comum num diagrama,
      // e o aluno precisa saber QUAL vai embora.
      const qual = alvo.nome && alvo.id ? ` · ${alvo.id}` : '';
      confirmaTexto.textContent = `Apagar ${comoChamar}${tipo}${qual} do diagrama?`;
      /**
       * ⚠ A pergunta tem de APARECER. Ela nasce no rodapé, e com a conversa longa o aluno estava
       * olhando para o meio dela — "o botão que apareceu para confirmar a exclusão ficou muito
       * escondido, sequer tinha visto" (dono, 2026-11-14). Então a conversa desce até o fim e o
       * foco vai para o botão SEGURO (Cancelar), que é o que a tecla Enter deve acionar.
       */
      if (perguntaNova) {
        descerAteOFim();
        confirmaBox.scrollIntoView?.({ block: 'nearest' });
        naoBtn.focus?.();
      }
    }
    faixaVoz.hidden = perguntando || !emVoz;
    composer.hidden = perguntando || !canAsk || emVoz;
    /**
     * ⚠ UMA linha sobre o estado da voz, nunca duas. Com o microfone mudo, a faixa dizia
     * "Microfone mudo" e esta linha dizia "o ajudante está respondendo…" logo abaixo — duas
     * frases sobre a mesma coisa, com uma quebra visual no meio (print do dono, 2026-11-15).
     * Enquanto a faixa existe, ela é a voz da tela.
     */
    micLabel.hidden = perguntando || !(mode === 'voz' && canAsk) || micOn || emVoz;

    // O microfone é a PORTA da voz: clicar nele é que leva a sessão para o modo voz. Por isso
    // ele aparece no modo texto também — era o seletor lá de cima que fazia esse papel.
    talkBtn.hidden = perguntando || !canAsk;
    // O ícone troca com o ESTADO (microfone ⇄ parar), e só quando ele muda: reescrever o SVG a
    // cada render trocaria o nó debaixo do clique do aluno.
    const queIcone = micOn ? 'parar' : 'mic';
    if (talkBtn.dataset.icone !== queIcone) {
      talkBtn.dataset.icone = queIcone;
      // Mesmo cuidado do botão de mudo: recriar o ícone a cada publish mata o clique.
      if (ultimoIconeMicrofoneGrande !== micOn) {
        talkBtn.innerHTML = micOn ? ICONE_PARAR : ICONE_MIC;
        ultimoIconeMicrofoneGrande = micOn;
      }
    }
    talkBtn.classList.toggle('bpmn-assist__mic--gravando', micOn);
    const oQueFaz = micOn ? 'Parar de ouvir' : `Falar com o ${NOME}`;
    talkBtn.setAttribute('aria-label', oQueFaz);
    talkBtn.title = oQueFaz;
    talkBtn.setAttribute('aria-pressed', String(micOn));

    // A frase de estado, da tabela da pesquisa. Cada estado diz o que está acontecendo AGORA.
    const falandoAgora = state === 'speaking';
    const consultando = state === 'tool';
    /**
     * O TÍTULO DIZ O ESTADO REAL, e mudo é um estado.
     *
     * ⚠ Com o microfone mudo a faixa continuava dizendo "Estou ouvindo / pode falar
     * normalmente" — a tela afirmando o contrário do que acabou de acontecer.
     */
    vozEstado.querySelector('.bpmn-assist__voztitulo').textContent = view.micMudo
      ? 'Microfone mudo'
      : (consultando ? 'Consultando o diagrama…' : (falandoAgora ? 'Respondendo' : 'Ouvindo você'));
    // ⚠ "Pode interromper falando" só quando for VERDADE: em meia-duplex o microfone fecha
    // durante a resposta, e prometer o que não existe é pior que não prometer.
    vozEstado.querySelector('.bpmn-assist__vozdica').textContent = view.micMudo
      ? 'ele não está te ouvindo — a conversa continua aberta'
      : (consultando
        ? 'já volto com o resultado'
        : (falandoAgora
          ? (session.meiaDuplex ? 'microfone pausado durante a resposta' : 'pode falar por cima')
          : (view.agenteMudo ? 'respondendo só por escrito' : 'pode falar — ou escrever')));
    faixaVoz.classList.toggle('bpmn-assist__voz--falando', falandoAgora || consultando);
    // Em escuta contínua o microfone fica aberto durante a resposta — e dizer isso em texto é o
    // que faz o aluno descobrir que pode interromper. A rede de segurança muda a frase, porque
    // aí NÃO dá para interromper.
    if (micOn && state === 'speaking') {
      micLabel.textContent = 'pode falar por cima para interromper';
    } else if (micOn) {
      micLabel.textContent = 'ouvindo — é só falar';
    } else if (state === 'speaking') {
      // "ele", e não o nome: o bloco inteiro já fala assim ("ele não está te ouvindo"), e repetir
      // a marca em cada linha de estado seria ruído — o nome vive no cabeçalho e no botão de voz.
      micLabel.textContent = session.meiaDuplex ? 'respondendo (microfone fechado)' : 'ele está respondendo…';
    } else {
      micLabel.textContent = 'clique para falar com ele';
    }
    renderMeter(level, micOn);

    const texto = dica(view);
    hint.textContent = texto;
    hint.hidden = !texto;

    // ⚠ O compositor JÁ foi decidido acima (ele dá lugar à faixa de voz). Havia uma segunda
    // atribuição aqui, e ela vencia por ser a última: em voz o campo de texto voltava à tela com
    // "Enviar" ao lado do medidor — exatamente o defeito que esta change existe para remover. Em
    // tela estava lá; no DOM eu tinha "corrigido".
    sendBtn.disabled = !canAsk;
    input.disabled = !canAsk;

    renderMessages(messages);
    if (diagBox.open) atualizarDiagnostico();
  }

  // ------------------------------------------------------------------ eventos

  function open() {
    panel.hidden = false;
    // ⚠ Dois pontos de entrada para a MESMA coisa: o launcher azul continuava visível por cima do
    // painel aberto, competindo com ele. Aberto, o launcher some (crítico na pesquisa visual).
    toggle.hidden = true;
    toggle.setAttribute('aria-expanded', 'true');
    (credentials.ready ? input : keyInput).focus();
  }

  function close() {
    panel.hidden = true;
    toggle.hidden = false;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();                    // o foco volta de onde veio
    onClose?.();
  }

  menuBtn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  // Clique fora fecha o menu: menu aberto esquecido come a conversa.
  panel.addEventListener('click', (e) => {
    if (menu.hidden || menu.contains(e.target) || e.target === menuBtn) return;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  });
  testarBtn.addEventListener('click', async () => {
    if (testarBtn.disabled) return;
    testarBtn.disabled = true;
    testarBtn.textContent = 'testando…';
    try {
      await session.testarConexao();
    } finally {
      testarBtn.disabled = false;
      testarBtn.textContent = 'Testar conexão';
      menu.hidden = true;                 // o resultado está na conversa, não no menu
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /**
   * O STOP da voz CALA TAMBÉM.
   *
   * ⚠ Ele fechava só o microfone, e o aluno voltava para a tela de escrever com o agente ainda
   * falando (dono, 2026-11-15: *"às vezes ela continua falando, mesmo a gente clicando em
   * stop"*). Sair da conversa por voz e continuar ouvindo a voz é contradição.
   */
  pararBtn.addEventListener('click', () => {
    session.pararDeFalar();
    session.stopMic();
  });
  mudoMicBtn.addEventListener('click', () => session.mutarMicrofone(!(ultimaVista?.micMudo ?? false)));
  mudoAgenteBtn.addEventListener('click', () => session.silenciarAgente(!(ultimaVista?.agenteMudo ?? false)));
  simBtn.addEventListener('click', () => session.confirmar(true));
  naoBtn.addEventListener('click', () => session.confirmar(false));

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()));
  closeBtn.addEventListener('click', close);

  // Esc fecha — mas só quando o foco está aqui dentro. Senão o ajudante roubaria o Esc do
  // bpmn-js (que o usa para cancelar uma ferramenta no canvas).
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); }
  });

  /** Guardar a chave e conectar são o MESMO gesto. */
  function comecar() {
    if (keyInput.value) {
      const r = credentials.set(keyInput.value);
      keyInput.value = '';             // o campo nunca mantém o valor
      if (!r.ok) {
        liveRegion.textContent = 'A chave parece curta demais. Confira e tente de novo.';
        return;
      }
    }
    session.connect();
  }

  powerBtn.addEventListener('click', () => {
    if (powerBtn.textContent === 'Encerrar') session.stop();
    else comecar();
  });
  keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); comecar(); } });
  keyInput.addEventListener('input', () => render(viewVazia()));
  consent.addEventListener('change', () => credentials.setConsent(consent.checked));
  trocarKey.addEventListener('click', () => session.forgetKey());

  /**
   * O microfone é o que ABRE a voz: sem seletor de modo, este clique é a troca de modo.
   * Clicar de novo fecha o microfone — e a sessão continua, agora para texto.
   */
  talkBtn.addEventListener('click', async () => {
    if (session.micOn) { await session.stopMic(); return; }
    /**
     * ⚠ Trocar de modo ABRE OUTRA sessão (o modo vive no `setup`, que é imutável), e ela leva
     * alguns segundos para ficar pronta. Chamar `startMic` aqui abria o microfone ANTES disso: a
     * captura começava, os quadros não tinham para onde ir, e a primeira frase do aluno se perdia
     * com o painel dizendo "ouvindo". Quem abre o microfone na hora certa é o próprio
     * `connect('voz')`, assim que o servidor aceita a sessão.
     */
    if (session.mode !== 'voz') { await session.switchMode('voz'); return; }
    await session.startMic();
  });
  calarBtn.addEventListener('click', () => session.pararDeFalar());

  const submit = () => {
    if (session.ask(input.value)) input.value = '';
  };
  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  // Digitar no campo da chave muda só o botão (de desabilitado para "Começar"); montar uma view
  // inteira para isso seria pedir estado à sessão por causa de uma tecla.
  function viewVazia() {
    return {
      state: session.state, reason: session.reason, mode: session.mode,
      micOn: session.micOn, level: session.level ?? 0,
      busy: session.state === 'connecting' || session.state === 'closing',
      canAsk: ['ready', 'listening', 'speaking', 'dormindo'].includes(session.state),
      falando: session.state === 'speaking',
      messages: session.messages,
    };
  }

  // ------------------------------------------------------------------ diagnóstico
  let relogioDiag = null;

  function atualizarDiagnostico() {
    try {
      diagText.textContent = session.report?.() ?? '(sem diagnóstico)';
    } catch (err) {
      diagText.textContent = `(diagnóstico falhou: ${err?.message ?? err})`;
    }
  }

  diagBox.addEventListener('toggle', () => {
    if (relogioDiag) { clearInterval(relogioDiag); relogioDiag = null; }
    if (!diagBox.open) return;
    atualizarDiagnostico();
    // Durante uma prova ao vivo o diário muda sozinho: sem isto o aluno abriria, veria um retrato
    // de um segundo atrás e acharia que parou.
    relogioDiag = setInterval(atualizarDiagnostico, 1000);
  });

  salvarBtn.addEventListener('click', () => {
    try {
      const dados = session.capturar();
      const nome = `ajudante-bpmn-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: nome });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      copyState.textContent = `salvo: ${nome}`;
    } catch (err) {
      copyState.textContent = `não deu para salvar: ${err?.message ?? err}`;
    }
    setTimeout(() => { copyState.textContent = ''; }, 8000);
  });

  copyBtn.addEventListener('click', async () => {
    atualizarDiagnostico();
    const texto = diagText.textContent;
    try {
      await navigator.clipboard.writeText(texto);
      copyState.textContent = 'copiado';
    } catch {
      // Sem permissão de área de transferência: seleciona para o Ctrl+C do aluno.
      const sel = window.getSelection?.();
      const range = document.createRange();
      range.selectNodeContents(diagText);
      sel?.removeAllRanges();
      sel?.addRange(range);
      copyState.textContent = 'selecionado — use Ctrl+C';
    }
    setTimeout(() => { copyState.textContent = ''; }, 4000);
  });

  return {
    root,
    render,
    open,
    close,
    /**
     * Deixa uma pergunta PRONTA no compositor, sem enviar.
     *
     * É o que a tela base usa para "descreva o seu processo" e "o que é BPMN?" — em vez de um
     * segundo campo de conversa na página, que duplicaria o estado do turno. Não envia de
     * propósito: quem acabou de chegar provavelmente ainda não tem chave, e um erro seria a
     * primeira resposta que o produto daria.
     *
     * Não mexe no foco: quem decide para onde ele vai é o `open()` — com chave, o compositor; sem
     * chave, o campo da chave. Roubar o foco daqui mandaria quem chegou agora para um campo que
     * ele ainda não pode usar.
     */
    sugerir(texto) {
      input.value = texto;
    },
    get isOpen() { return !panel.hidden; },
    /** Para o `destroy()` do mount: relógio de diagnóstico não pode sobreviver ao painel. */
    dispose() { if (relogioDiag) { clearInterval(relogioDiag); relogioDiag = null; } },
  };
}
