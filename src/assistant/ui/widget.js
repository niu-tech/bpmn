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
      el('strong', { textContent: 'Ajudante BPMN' }),
      el('small', { textContent: 'tire dúvidas sobre o seu diagrama' }),
    ]),
  ]);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', panelId);

  // ------------------------------------------------------------------ cabeçalho
  const statusChip = el('span', { className: 'bpmn-assist__status', textContent: 'desligado' });
  const closeBtn = el('button', { className: 'bpmn-assist__icon', type: 'button', textContent: '✕' });
  closeBtn.setAttribute('aria-label', 'Fechar o ajudante');

  const head = el('div', { className: 'bpmn-assist__head' }, [
    el('h2', { id: 'bpmn-assist-title', textContent: 'Ajudante BPMN' }),
    statusChip,
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
      textContent: 'Este site não tem chave própria e não guarda a sua: ela fica só na memória '
        + 'desta aba e some ao recarregar ou fechar. Não vai para nenhum servidor nosso — só '
        + 'para generativelanguage.googleapis.com. Pegue a sua em aistudio.google.com.',
    }),
  ]);

  const setupBlock = el('div', { className: 'bpmn-assist__setup' }, [
    privacidade,
    el('label', { className: 'bpmn-assist__field' }, [
      el('span', { textContent: 'Sua chave do Google AI Studio' }),
      keyInput,
    ]),
    consentLabel,
  ]);

  // A face compacta: tudo o que sobra depois que chave e aviso estão resolvidos.
  const trocarKey = el('button', { className: 'bpmn-assist__link', type: 'button', textContent: 'trocar' });
  const compacto = el('p', { className: 'bpmn-assist__compact' }, [
    el('span', { textContent: 'chave guardada nesta aba · ' }),
    trocarKey,
  ]);

  // ------------------------------------------------------------------ modo + liga/desliga
  const modeText = el('button', { className: 'bpmn-assist__seg', type: 'button', textContent: 'Texto' });
  const modeVoice = el('button', { className: 'bpmn-assist__seg', type: 'button', textContent: 'Voz' });
  modeText.setAttribute('aria-pressed', 'true');
  modeVoice.setAttribute('aria-pressed', 'false');
  const modeGroup = el('div', { className: 'bpmn-assist__segs', role: 'group' }, [modeText, modeVoice]);
  modeGroup.setAttribute('aria-label', 'Modo de conversa');

  // ⚠ O ÚNICO botão de ação. Guarda a chave (se houver uma digitada) e conecta; vira "Encerrar".
  const powerBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Começar' });

  const barraTopo = el('div', { className: 'bpmn-assist__row' }, [modeGroup, powerBtn]);

  // ------------------------------------------------------------------ falar + medidor
  const talkBtn = el('button', { className: 'bpmn-assist__mic', type: 'button', textContent: '●' });
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

  const empty = el('p', {
    className: 'bpmn-assist__empty',
    textContent: 'Pergunte sobre notação BPMN: eventos, atividades, gateways, raias, fluxo de mensagem.',
  });
  const log = el('ul', { className: 'bpmn-assist__log' });
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', 'Conversa com o ajudante');

  // ------------------------------------------------------------------ diagnóstico
  // Existe porque depurar conversa por descrição não funciona: o dono precisa COLAR o que
  // aconteceu. O texto é o mesmo de `session.report()`, já redigido pelo diário.
  const diagText = el('pre', { className: 'bpmn-assist__diagtext', textContent: '(abra para ver)' });
  const copyBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Copiar' });
  const copyState = el('span', { className: 'bpmn-assist__copystate', textContent: '' });
  const diagBox = el('details', { className: 'bpmn-assist__diag' }, [
    el('summary', { textContent: 'Diagnóstico da sessão' }),
    diagText,
    el('div', { className: 'bpmn-assist__row' }, [copyBtn, copyState]),
  ]);

  // ⚠ `talkRow` NÃO entra no corpo rolável. Entrava, e aí cada resposta empurrava o botão de
  // falar para fora da tela: "a gente fala e aí tem que subir a conversa toda para falar de
  // novo" (dono, 2026-11-11). Controle que se usa a cada turno mora no rodapé fixo; só a
  // conversa rola.
  // ⚠ `barraTopo` (Texto/Voz/Encerrar) saiu do corpo ROLÁVEL: ela sumia da tela assim que a
  // conversa crescia, e aí trocar de modo exigia rolar tudo de volta. Controle que se usa a
  // qualquer momento fica FIXO; só a conversa rola. Mesma razão que já tirou o microfone daqui.
  const body = el('div', { className: 'bpmn-assist__body' }, [
    setupBlock, compacto, hint, empty, log, diagBox,
  ]);

  // ------------------------------------------------------------------ composer
  const input = el('textarea', { placeholder: 'Escreva a sua pergunta…', rows: 1 });
  input.setAttribute('aria-label', 'Sua pergunta');
  const sendBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Enviar' });
  const composer = el('div', { className: 'bpmn-assist__composer' }, [input, meter, talkBtn, sendBtn]);

  /**
   * O CONTRATO, escrito para o aluno (H7).
   *
   * Vem do painel do Orbit, que diz embaixo do compositor o que o agente faz e o que depende da
   * pessoa. Enquanto só lemos, o texto é "ele lê, não altera"; quando a escrita entrar (F7), esta
   * é a linha que passa a dizer que ele PROPÕE e o aluno confirma — e ela entra JUNTO da escrita,
   * não depois, porque poder sem contrato na tela é o aluno descobrindo por acidente.
   */
  const contrato = el('p', {
    className: 'bpmn-assist__contrato',
    textContent: 'Ele lê o seu diagrama para explicar — não altera nada. O que muda no desenho é você que faz.',
  });

  const rodape = el('div', { className: 'bpmn-assist__footer' }, [micLabel, composer, contrato]);

  const panel = el('div', { className: 'bpmn-assist__panel', id: panelId }, [head, barraTopo, body, rodape, liveRegion]);
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');     // o diagrama continua utilizável de propósito
  panel.setAttribute('aria-labelledby', 'bpmn-assist-title');

  root.append(toggle, panel);

  // ------------------------------------------------------------------ render

  let renderedUpTo = 0;
  let lastAnnounced = '';

  function renderMessages(messages) {
    // Append incremental: redesenhar a lista inteira a cada frame de legenda faria o leitor de
    // tela reanunciar tudo e perderia a posição de rolagem.
    for (let i = renderedUpTo; i < messages.length; i++) {
      const m = messages[i];
      const li = el('li', { className: `bpmn-assist__msg bpmn-assist__msg--${m.role}` });
      if (m.kind) li.classList.add(`bpmn-assist__msg--${m.kind}`);
      if (m.rodando) li.classList.add('bpmn-assist__msg--rodando');
      li.dataset.id = String(m.id);
      if (m.via) li.append(el('span', { className: 'bpmn-assist__via', textContent: m.via === 'voz' ? 'por voz' : 'digitado' }));
      li.append(el('span', { className: 'bpmn-assist__text', textContent: m.text }));
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
    }
    renderedUpTo = messages.length;
    empty.hidden = messages.length > 0;
    log.scrollTop = log.scrollHeight;
  }

  /**
   * O que falta, calculado AGORA de `credentials` e do estado — nunca guardado. É o conserto do
   * recado vermelho que ficava preso na conversa.
   */
  function dica({ state, reason }) {
    if (!credentials.hasKey) return 'Cole a sua chave do Google AI Studio e clique em Começar.';
    if (!credentials.consented) return 'Marque o aviso sobre a chave para poder começar.';
    if (credentials.lastRejection === 'bad-key') {
      return 'O Google recusou essa chave. Confira em aistudio.google.com e informe de novo em "trocar".';
    }
    if (state === 'error') return `Não deu: ${describeError(reason)}.`;
    return '';
  }

  function renderMeter(level, ativo) {
    for (let i = 0; i < barras.length; i++) {
      const alt = ativo ? Math.max(0.08, Math.min(1, level * PERFIL[i] * 1.6)) : 0.08;
      barras[i].style.transform = `scaleY(${alt.toFixed(3)})`;
    }
  }

  function render(view) {
    const { state, reason, mode, micOn, level = 0, busy, canAsk, messages } = view;

    dot.setAttribute('data-state', state);
    const label = STATE_LABELS[state] ?? state;
    const detail = state === 'error' ? `: ${describeError(reason)}` : '';
    statusChip.textContent = `${label}${detail}`;

    if (statusChip.textContent !== lastAnnounced) {
      liveRegion.textContent = `Ajudante ${statusChip.textContent}.`;
      lastAnnounced = statusChip.textContent;
    }

    // Chave: o bloco inteiro só enquanto falta algo; depois, uma linha.
    const resolvido = credentials.ready;
    setupBlock.hidden = resolvido;
    compacto.hidden = !resolvido;
    consent.checked = credentials.consented;
    trocarKey.disabled = busy;

    modeText.setAttribute('aria-pressed', String(mode === 'texto'));
    modeVoice.setAttribute('aria-pressed', String(mode === 'voz'));
    modeText.disabled = busy;
    modeVoice.disabled = busy;

    // UM botão, dois papéis.
    powerBtn.textContent = canAsk ? 'Encerrar' : 'Começar';
    powerBtn.classList.toggle('bpmn-assist__btn--primary', !canAsk);
    powerBtn.disabled = busy || (!canAsk && !credentials.hasKey && !keyInput.value);

    // Falar só existe no modo voz e com sessão viva: esconder é mais honesto que desabilitar.
    // O microfone só existe no modo voz; o resto do compositor continua igual.
    talkBtn.hidden = !(mode === 'voz' && canAsk);
    micLabel.hidden = !(mode === 'voz' && canAsk);
    talkBtn.textContent = micOn ? '■' : '●';
    talkBtn.setAttribute('aria-label', micOn ? 'Parar de ouvir' : 'Falar com o ajudante');
    talkBtn.title = micOn ? 'Parar de ouvir' : 'Falar com o ajudante';
    talkBtn.setAttribute('aria-pressed', String(micOn));
    talkBtn.classList.toggle('bpmn-assist__mic--gravando', micOn);
    // Gravando, o campo de texto SAI de cena: duas entradas ao mesmo tempo é o padrão que confunde.
    composer.classList.toggle('bpmn-assist__composer--gravando', micOn);
    input.disabled = micOn;
    // Em escuta contínua o microfone fica aberto durante a resposta — e dizer isso em texto é o
    // que faz o aluno descobrir que pode interromper. A rede de segurança muda a frase, porque
    // aí NÃO dá para interromper.
    if (micOn && state === 'speaking') {
      micLabel.textContent = 'pode falar por cima para interromper';
    } else if (micOn) {
      micLabel.textContent = 'ouvindo — é só falar';
    } else if (state === 'speaking') {
      micLabel.textContent = session.meiaDuplex ? 'respondendo (microfone fechado)' : 'o ajudante está respondendo…';
    } else {
      micLabel.textContent = 'clique para o ajudante ouvir';
    }
    renderMeter(level, micOn);

    const texto = dica(view);
    hint.textContent = texto;
    hint.hidden = !texto;

    // Campo de pergunta desligado ocupa a mesma altura e não serve para nada: sumir devolve
    // espaço justamente na tela pequena, onde o problema aparece.
    composer.hidden = !canAsk;
    contrato.hidden = !canAsk;
    sendBtn.disabled = !canAsk;
    input.disabled = !canAsk;

    renderMessages(messages);
    if (diagBox.open) atualizarDiagnostico();
  }

  // ------------------------------------------------------------------ eventos

  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    (credentials.ready ? input : keyInput).focus();
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();                    // o foco volta de onde veio
    onClose?.();
  }

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

  modeText.addEventListener('click', () => session.switchMode('texto'));
  modeVoice.addEventListener('click', () => session.switchMode('voz'));
  talkBtn.addEventListener('click', () => (session.micOn ? session.stopMic() : session.startMic()));

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
      canAsk: ['ready', 'listening', 'speaking'].includes(session.state),
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
    get isOpen() { return !panel.hidden; },
    /** Para o `destroy()` do mount: relógio de diagnóstico não pode sobreviver ao painel. */
    dispose() { if (relogioDiag) { clearInterval(relogioDiag); relogioDiag = null; } },
  };
}
