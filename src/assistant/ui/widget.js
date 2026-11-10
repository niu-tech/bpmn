// O widget: botão flutuante + painel. Só DOM e eventos — nenhuma regra de sessão mora aqui, e
// nenhuma credencial é lida daqui para exibição.
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
//  - a cor do ponto NUNCA é o único sinal — o texto ao lado diz a mesma coisa.
//
// ponytail: `textContent` em todo lugar; nenhum `innerHTML` com dado de modelo. Resposta de LLM
// é entrada não confiável, e a tela é do aluno.

import { STATE_LABELS, describeError } from '../session-manager.js';

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of [].concat(children)) node.append(c);
  return node;
};

export function createWidget({ session, credentials, onClose } = {}) {
  const root = el('div', { className: 'bpmn-assist' });
  const panelId = 'bpmn-assist-panel';

  // ------------------------------------------------------------------ botão
  const dot = el('span', { className: 'bpmn-assist__dot' });
  dot.setAttribute('data-state', 'idle');
  const toggle = el('button', {
    className: 'bpmn-assist__toggle',
    type: 'button',
  }, [dot, el('span', { textContent: 'Ajudante BPMN' })]);
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
    placeholder: 'cole aqui a sua chave',
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

  const saveKey = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Usar esta chave' });
  const forgetKey = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Remover chave' });

  const keyBlock = el('div', {}, [
    el('p', { className: 'bpmn-assist__privacy' }, [
      el('strong', { textContent: 'A chave é sua. ' }),
      el('span', {
        textContent: 'Este site não tem chave própria e não guarda a sua: ela fica só na memória '
          + 'desta aba e some ao recarregar ou fechar. Não vai para nenhum servidor nosso — só '
          + 'para generativelanguage.googleapis.com. Pegue a sua em aistudio.google.com.',
      }),
    ]),
    el('label', { className: 'bpmn-assist__field' }, [
      el('span', { textContent: 'Sua chave do Google AI Studio' }),
      keyInput,
    ]),
    consentLabel,
    el('div', { className: 'bpmn-assist__row' }, [saveKey, forgetKey]),
  ]);

  // ------------------------------------------------------------------ modo e conexão
  const modeText = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Texto' });
  const modeVoice = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Voz' });
  modeText.setAttribute('aria-pressed', 'true');
  modeVoice.setAttribute('aria-pressed', 'false');
  const modeGroup = el('div', { className: 'bpmn-assist__row', role: 'group' }, [modeText, modeVoice]);
  modeGroup.setAttribute('aria-label', 'Modo de conversa');

  const connectBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Conectar' });
  const stopBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Encerrar' });
  const micBtn = el('button', { className: 'bpmn-assist__btn', type: 'button', textContent: 'Falar' });
  micBtn.setAttribute('aria-pressed', 'false');

  const controls = el('div', { className: 'bpmn-assist__row' }, [connectBtn, stopBtn, micBtn]);

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

  const body = el('div', { className: 'bpmn-assist__body' }, [keyBlock, modeGroup, controls, empty, log]);

  // ------------------------------------------------------------------ composer
  const input = el('textarea', { placeholder: 'Escreva a sua pergunta…', rows: 1 });
  input.setAttribute('aria-label', 'Sua pergunta');
  const sendBtn = el('button', { className: 'bpmn-assist__btn bpmn-assist__btn--primary', type: 'button', textContent: 'Enviar' });
  const composer = el('div', { className: 'bpmn-assist__composer' }, [input, sendBtn]);

  const panel = el('div', { className: 'bpmn-assist__panel', id: panelId }, [head, body, composer, liveRegion]);
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
      li.dataset.id = String(m.id);
      if (m.via) li.append(el('span', { className: 'bpmn-assist__via', textContent: m.via === 'voz' ? 'por voz' : 'digitado' }));
      li.append(el('span', { className: 'bpmn-assist__text', textContent: m.text }));
      log.append(li);
    }
    // A última bolha pode CRESCER (legenda chegando em pedaços): atualiza no lugar.
    const last = messages.at(-1);
    if (last && renderedUpTo >= messages.length) {
      const li = log.querySelector(`[data-id="${last.id}"] .bpmn-assist__text`);
      if (li && li.textContent !== last.text) li.textContent = last.text;
    }
    renderedUpTo = messages.length;
    empty.hidden = messages.length > 0;
    log.scrollTop = log.scrollHeight;
    body.scrollTop = body.scrollHeight;
  }

  function render(view) {
    const { state, reason, mode, micOn, busy, canAsk, messages } = view;

    dot.setAttribute('data-state', state);
    const label = STATE_LABELS[state] ?? state;
    const detail = state === 'error' ? `: ${describeError(reason)}` : '';
    statusChip.textContent = `${label}${detail}`;

    if (statusChip.textContent !== lastAnnounced) {
      liveRegion.textContent = `Ajudante ${statusChip.textContent}.`;
      lastAnnounced = statusChip.textContent;
    }

    const pronto = credentials.ready;
    keyInput.placeholder = credentials.hasKey ? 'chave guardada nesta aba' : 'cole aqui a sua chave';
    saveKey.disabled = busy;
    forgetKey.disabled = !credentials.hasKey || busy;
    consent.checked = credentials.consented;

    modeText.setAttribute('aria-pressed', String(mode === 'texto'));
    modeVoice.setAttribute('aria-pressed', String(mode === 'voz'));
    modeText.disabled = busy;
    modeVoice.disabled = busy;

    connectBtn.disabled = !pronto || busy || canAsk;
    connectBtn.textContent = canAsk ? 'Conectado' : 'Conectar';
    stopBtn.disabled = state === 'idle' || busy;
    micBtn.disabled = !canAsk || mode !== 'voz';
    micBtn.textContent = micOn ? 'Parar de falar' : 'Falar';
    micBtn.setAttribute('aria-pressed', String(micOn));

    sendBtn.disabled = !canAsk;
    input.disabled = !canAsk;

    renderMessages(messages);
  }

  // ------------------------------------------------------------------ eventos

  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    (credentials.hasKey ? input : keyInput).focus();
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

  saveKey.addEventListener('click', () => {
    const r = credentials.set(keyInput.value);
    keyInput.value = '';               // o campo nunca mantém o valor
    if (!r.ok) liveRegion.textContent = 'A chave parece curta demais. Confira e tente de novo.';
  });
  keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveKey.click(); } });
  consent.addEventListener('change', () => credentials.setConsent(consent.checked));
  forgetKey.addEventListener('click', () => session.forgetKey());

  modeText.addEventListener('click', () => session.switchMode('texto'));
  modeVoice.addEventListener('click', () => session.switchMode('voz'));
  connectBtn.addEventListener('click', () => session.connect());
  stopBtn.addEventListener('click', () => session.stop());
  micBtn.addEventListener('click', () => (session.micOn ? session.stopMic() : session.startMic()));

  const submit = () => {
    if (session.ask(input.value)) input.value = '';
  };
  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  return { root, render, open, close, get isOpen() { return !panel.hidden; } };
}
