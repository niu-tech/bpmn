// Ponto de entrada único do ajudante. As duas páginas chamam `mountAssistant()` e mais nada.
//
// Guarda de instância única: as duas entries do webpack (`bundle` e `viewer`) nunca carregam na
// mesma página, mas uma importação repetida, um hot-reload ou uma segunda chamada por engano
// duplicariam botão, listeners e — pior — sessões Live, cada uma consumindo a cota do aluno.
// A marca vai no `document`, não num módulo, porque dois bundles têm escopos de módulo
// diferentes e um `let montado` não os enxergaria.

import './ui/assistant.css';
import { observarDiagrama } from './agent/diagram.js';
import { assinaturaDoDiagrama } from './tools/leitura.js';
import { criarAcessoBpmn } from './tools/bpmn-api.js';
import { calcularReserva } from './layout.js';
import { createCredentialStore } from './credential.js';
import { createAssistantSession } from './session-manager.js';
import { createWidget } from './ui/widget.js';
import { citacoesFaladas } from './agent/fala.js';
import { diagnosticoDoPrompt } from './agent/render.js';
import { startCapture } from './live/audio.js';

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

  // UMA camada fina sobre o bpmn-js, usada pelo observador E pelas ferramentas (design T6).
  const acesso = criarAcessoBpmn(modelador);
  // O observador só marca sujo; quem recalcula é o `lerDiagrama` abaixo, nas bordas de turno.
  const olho = observarDiagrama(acesso);

  /**
   * A última corrida de simulação, como a PÁGINA a registrou. O ajudante não dispara simulação
   * (design T5) — ele comenta o que o aluno rodou. A assinatura do diagrama é guardada JUNTO,
   * para a ferramenta poder avisar quando o desenho mudou depois da corrida.
   */
  let simulacao = null;

  const credentials = createCredentialStore({
    onChange: () => widget?.render(view()),
  });

  const session = createAssistantSession({
    credentials,
    deps: {
      debug,
      pagina,
      acesso,
      lerDiagrama: () => olho.atual(),
      lerSimulacao: () => simulacao,
    },
    // ⚠ Renderiza o que RECEBEU. Antes isto montava a vista de novo, do zero, e ignorava o
    // argumento: o estado da interface existia em dois lugares, e um campo novo na sessão podia
    // ficar provado pelos testes e invisível na tela. Quem define a vista é a sessão.
    onUpdate: (vista) => widget?.render(vista),
  });

  const view = () => session.vista;

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
    /** A corrida de simulação que o agente enxerga. Só leitura. */
    get simulacao() { return simulacao; },
    sincronizarContexto: () => session.sincronizarContexto(),
    definirContexto: (c) => session.definirContexto(c),
    /**
     * PROVA DA CAPTURA — grava o que o microfone produziria e devolve o PCM, SEM abrir sessão.
     *
     * Existe porque faltava exatamente isto para fechar a dívida M6 (2026-11-13): o relatório
     * sabia dizer o NÍVEL do que sai (`estado.nivel`) e não sabia devolver o ÁUDIO. Com nível
     * sozinho, "o microfone capturou ruído de fundo", "capturou um tom de teste" e "capturou a
     * fala" são a mesma linha — e foi assim que um tom sintético passou dias sendo lido como
     * "o servidor está mudo". O que se mede agora é o conteúdo: o PCM volta e pode ser ouvido,
     * medido ou mandado ao servidor de verdade por `tools/medir-voz.mjs`.
     *
     * Não gasta cota: roda `startCapture` direto, sem socket. Só diagnóstico, só leitura.
     */
    /**
     * Fecha o microfone pelo diagnóstico. Na injeção é obrigatório: com o microfone aberto, o
     * dispositivo falso do navegador despeja o tom dele JUNTO da fala injetada, e a prova mede os
     * dois misturados.
     */
    /**
     * O que, numa fala, soaria como máquina (H2). MEDIÇÃO, nunca filtro: serve para a bateria
     * reprovar a prosa do prompt quando ela não segura o modelo — não para esconder o que ele
     * disse. Zero é o contrato.
     */
    citacoesFaladas: (texto) => citacoesFaladas(texto),
    /** O que o prompt de AGORA leva, por seção, e o que foi cortado (H8). Só leitura. */
    diagnosticoDoPrompt: (opcoes) => diagnosticoDoPrompt(session.contexto, opcoes),
    pararMicrofone: () => session.stopMic(),
    /**
     * Abre o microfone pelo diagnóstico — é o que torna o barge-in provável SEM calibração: com a
     * pergunta injetada e o microfone aberto no instante em que o modelo começa a falar, a frase de
     * corte toca do começo, e os 16 s de silêncio na frente da fixture deixam de ser necessários.
     */
    abrirMicrofone: () => session.startMic(),
    /** Injeta fala sem microfone (H11). Ver `session-manager.js::injetarFala`. */
    injetarFala: (quadros, opcoes) => session.injetarFala(quadros, opcoes),
    async provarCaptura(segundos = 8) {
      const quadros = [];
      let niveis = [];
      const cap = await startCapture({
        onFrame: (base64) => { if (quadros.length < 2000) quadros.push(base64); },
        onLevel: (n) => { if (niveis.length < 4000) niveis.push(Number(n.toFixed(3))); },
      });
      await new Promise((r) => setTimeout(r, Math.max(1, segundos) * 1000));
      await cap.stop();
      return {
        taxaDoDispositivo: cap.sampleRate,
        quadros: quadros.length,
        // Base64 de cada quadro, na ordem. Quem chama remonta o WAV (PCM16 16 kHz mono).
        pcmBase64: quadros,
        nivelMaximo: niveis.length ? Math.max(...niveis) : 0,
      };
    },
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

    /**
     * A página avisa que o aluno rodou uma simulação. Guardamos o resultado E a assinatura do
     * diagrama naquele momento — é a comparação dessas duas assinaturas que permite dizer "esta
     * métrica é do desenho anterior" em vez de apresentar número velho como atual (tarefa 2.4).
     */
    registrarSimulacao(resultado) {
      if (!resultado) { simulacao = null; return null; }
      simulacao = {
        quando: new Date().toISOString(),
        resumo: resultado,
        assinatura: acesso.disponivel ? assinaturaDoDiagrama(acesso.elementos()) : null,
      };
      return simulacao;
    },
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
