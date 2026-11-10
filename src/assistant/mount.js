// Ponto de entrada único do ajudante. As duas páginas chamam `mountAssistant()` e mais nada.
//
// Guarda de instância única: as duas entries do webpack (`bundle` e `viewer`) nunca carregam na
// mesma página, mas uma importação repetida, um hot-reload ou uma segunda chamada por engano
// duplicariam botão, listeners e — pior — sessões Live, cada uma consumindo a cota do aluno.
// A marca vai no `document`, não num módulo, porque dois bundles têm escopos de módulo
// diferentes e um `let montado` não os enxergaria.

import './ui/assistant.css';
import { createCredentialStore } from './credential.js';
import { createAssistantSession } from './session-manager.js';
import { createWidget } from './ui/widget.js';

const MARK = 'bpmnAssistantMounted';

export function mountAssistant({ container = document.body, debug = false } = {}) {
  if (document.documentElement.dataset[MARK] === '1') return null;
  document.documentElement.dataset[MARK] = '1';

  let widget = null;

  const credentials = createCredentialStore({
    onChange: () => widget?.render(view()),
  });

  const session = createAssistantSession({
    credentials,
    deps: { debug },
    onUpdate: () => widget?.render(view()),
  });

  const view = () => ({
    state: session.state,
    reason: session.reason,
    mode: session.mode,
    micOn: session.micOn,
    busy: session.state === 'connecting' || session.state === 'closing',
    canAsk: ['ready', 'listening', 'speaking'].includes(session.state),
    messages: session.messages,
  });

  widget = createWidget({ session, credentials });
  container.append(widget.root);
  widget.render(view());

  // Sair da página sem isto deixa o microfone aberto e a sessão consumindo cota. `pagehide`
  // cobre o caso que `beforeunload` não cobre em iOS/Safari (bfcache).
  const bye = () => { try { session.stop(); } catch { /* indo embora de qualquer jeito */ } };
  window.addEventListener('beforeunload', bye);
  window.addEventListener('pagehide', bye);

  return {
    session,
    credentials,
    widget,
    /** Desmonta de verdade: encerra a sessão, tira os listeners e libera a marca. */
    async destroy() {
      window.removeEventListener('beforeunload', bye);
      window.removeEventListener('pagehide', bye);
      await session.stop();
      widget.root.remove();
      delete document.documentElement.dataset[MARK];
    },
  };
}
