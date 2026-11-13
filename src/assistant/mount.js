// Ponto de entrada único do ajudante. As duas páginas chamam `mountAssistant()` e mais nada.
//
// Guarda de instância única: as duas entries do webpack (`bundle` e `viewer`) nunca carregam na
// mesma página, mas uma importação repetida, um hot-reload ou uma segunda chamada por engano
// duplicariam botão, listeners e — pior — sessões Live, cada uma consumindo a cota do aluno.
// A marca vai no `document`, não num módulo, porque dois bundles têm escopos de módulo
// diferentes e um `let montado` não os enxergaria.

import './ui/assistant.css';
import { observarDiagrama } from './agent/diagram.js';
import { calcularReserva } from './layout.js';
import { createCredentialStore } from './credential.js';
import { createAssistantSession } from './session-manager.js';
import { createWidget } from './ui/widget.js';

const MARK = 'bpmnAssistantMounted';

/** Barras do produto que vivem no mesmo canto inferior e nao devem ser cobertas. */
const BARRAS_DO_RODAPE = '.bz-toolbar';

/**
 * A casca: mede a barra e escreve o resultado numa variavel CSS. `ResizeObserver` porque a barra
 * expande e recolhe no clique do usuario — reservar so a altura inicial deixaria o problema
 * voltar no primeiro toque.
 */
function reservarRodape(root) {
  const barra = document.querySelector(BARRAS_DO_RODAPE);
  if (!barra || typeof ResizeObserver === 'undefined') return () => {};

  const aplicar = () => {
    const px = calcularReserva({
      larguraJanela: window.innerWidth,
      alturaJanela: window.innerHeight,
      alturaBarra: barra.getBoundingClientRect().height,
    });
    root.style.setProperty('--bpmn-assist-bottom', `${px}px`);
  };

  const ro = new ResizeObserver(aplicar);
  ro.observe(barra);
  window.addEventListener('resize', aplicar);
  aplicar();

  return () => { ro.disconnect(); window.removeEventListener('resize', aplicar); };
}

/**
 * `pagina` diz QUAL das duas entries montou o ajudante: `'modelador'` ou `'viewer'`. Não é
 * cosmético — é o que faz o contexto nascer `somenteLeitura` e, quando as ferramentas de escrita
 * existirem (F7), o que impede que elas sejam declaradas ao modelo numa página que não edita.
 * Explícito em vez de adivinhado pela URL: o viewer pode ser servido em qualquer caminho.
 *
 * `modelador` é o `BpmnModeler` (ou o `NavigatedViewer`) da página. É o que faz o agente
 * ENXERGAR a tela (fase F3): sem ele o ajudante monta igual e conversa sobre BPMN em geral, com
 * o diagrama chegando vazio ao prompt — que era o estado até aqui (dívida T7).
 */
export function mountAssistant({ container = document.body, debug = false, pagina = 'modelador', modelador = null } = {}) {
  if (document.documentElement.dataset[MARK] === '1') return null;
  document.documentElement.dataset[MARK] = '1';

  let widget = null;

  // O observador só marca sujo; quem recalcula é o `lerDiagrama` abaixo, nas bordas de turno.
  const olho = observarDiagrama(modelador);

  const credentials = createCredentialStore({
    onChange: () => widget?.render(view()),
  });

  const session = createAssistantSession({
    credentials,
    deps: { debug, pagina, lerDiagrama: () => olho.atual() },
    onUpdate: () => widget?.render(view()),
  });

  const view = () => ({
    state: session.state,
    reason: session.reason,
    mode: session.mode,
    micOn: session.micOn,
    level: session.level,
    busy: session.state === 'connecting' || session.state === 'closing',
    canAsk: ['ready', 'listening', 'speaking'].includes(session.state),
    messages: session.messages,
  });

  widget = createWidget({ session, credentials });
  container.append(widget.root);
  widget.render(view());

  const pararDeMedir = reservarRodape(widget.root);

  // Depuração pelo console, sem precisar abrir o painel: `__bpmnAssist.report()` devolve o mesmo
  // texto redigido do botão "Copiar". Pedido do dono (2026-11-11): "precisamos ter uma forma de
  // estruturar a saída e os logs de uma forma que a gente consiga ir debugando".
  // Só leitura e diagnóstico — a chave não é exposta aqui (o store não tem getter de valor).
  window.__bpmnAssist = {
    report: () => session.report(),
    get estado() { return { modo: session.mode, estado: session.state, micOn: session.micOn, nivel: session.level }; },
    get eventos() { return session.diagnostics.events; },
    get contagem() { return session.diagnostics.counts; },
    /** O contexto como o prompt o vê — e por onde a prova de injeção pelo diagrama entra (F2). */
    get contexto() { return session.contexto; },
    /**
     * A conversa com o NÚMERO DO TURNO em cada mensagem. É o que permite dizer "esta resposta é
     * desta pergunta" — a bolha sozinha não diz, e uma entrega atrasada do turno anterior já foi
     * lida como resposta do seguinte (portão F3, 2026-11-13). Cópia, só leitura.
     */
    get mensagens() { return session.messages; },
    /** A projeção crua do diagrama aberto, recalculada na leitura (F3). `null` sem modelador. */
    get diagrama() { return olho.atual(); },
    /** O último quadro que o modelo de fato recebeu. É o espelho do delta. */
    get contextoEnviado() { return session.contextoEnviado; },
    sincronizarContexto: () => session.sincronizarContexto(),
    definirContexto: (c) => session.definirContexto(c),
  };

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
      pararDeMedir();
      olho.dispose();
      widget.dispose?.();
      if (window.__bpmnAssist) delete window.__bpmnAssist;
      window.removeEventListener('beforeunload', bye);
      window.removeEventListener('pagehide', bye);
      await session.stop();
      widget.root.remove();
      delete document.documentElement.dataset[MARK];
    },
  };
}
