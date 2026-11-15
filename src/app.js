import Modeler from "bpmn-js/lib/Modeler";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";

import "./themes/bizagi-theme.css";

import TokenSimulationModule from "bpmn-js-token-simulation";
import "bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css";

import "./batchsim/batch-sim.css";
import { bindSimulation } from "./batchsim/simulation-integration.js";

import { mountAssistant } from "./assistant/mount.js";
import { CHAVE_ESCOLHA, decidirAbertura, tiraPara } from "./primeira-vez/abertura.js";
import { montarTelaBase, montarTira } from "./primeira-vez/tela.js";

const DEFAULT_DIAGRAM_URL = "pizza-collaboration.bpmn";
const LOCAL_STORAGE_KEY = "bpmn.autosave.xml";

/**
 * As frases que a tela base deixa PRONTAS no compositor do ajudante — digitadas, nunca enviadas.
 *
 * A primeira é a mesma que o painel já oferece como exemplo clicável: a tela e o painel dizendo a
 * mesma coisa com as mesmas palavras é o que faz o produto parecer um só.
 */
const FRASE_DESCREVER = "Quero modelar o MEU processo — vou te descrever";
const FRASE_DESCOBRIR = "O que é BPMN?";

/* =====================================================
   Helpers
   ===================================================== */

async function fetchDiagram(url) {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Falha ao carregar diagrama: ${res.status} (${url})`);
  return res.text();
}

function downloadText(filename, text, mime = "application/xml") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isLabel(el) {
  return Boolean(el && el.labelTarget);
}

function isConnection(el) {
  return Array.isArray(el && el.waypoints);
}

function hasEventDefinition(el, typeName) {
  const bo = el && el.businessObject;
  const defs = bo && bo.eventDefinitions;
  return Array.isArray(defs) && defs.some((d) => d && d.$type === typeName);
}

/* =====================================================
   Marker mapping (Bizagi-like)
   ===================================================== */

function markerFor(el) {
  const t = el.type;

  if (t === "bpmn:StartEvent") return "bizagi-start-event";
  if (t === "bpmn:EndEvent") return "bizagi-end-event";

  if (t === "bpmn:BoundaryEvent") {
    if (hasEventDefinition(el, "bpmn:MessageEventDefinition"))
      return "bizagi-message-catch";
    return "bizagi-intermediate-catch";
  }

  if (t === "bpmn:IntermediateCatchEvent") {
    if (hasEventDefinition(el, "bpmn:MessageEventDefinition"))
      return "bizagi-message-catch";
    return "bizagi-intermediate-catch";
  }

  if (t === "bpmn:IntermediateThrowEvent") {
    if (hasEventDefinition(el, "bpmn:MessageEventDefinition"))
      return "bizagi-message-throw";
    return "bizagi-intermediate-throw";
  }

  if (
    t === "bpmn:ExclusiveGateway" ||
    t === "bpmn:ParallelGateway" ||
    t === "bpmn:InclusiveGateway" ||
    t === "bpmn:EventBasedGateway" ||
    t === "bpmn:ComplexGateway"
  )
    return "bizagi-gateway";

  if (
    t === "bpmn:SubProcess" ||
    t === "bpmn:Transaction" ||
    t === "bpmn:AdHocSubProcess"
  ) {
    return "bizagi-subprocess";
  }

  if (t && t.startsWith("bpmn:") && t.endsWith("Task")) return "bizagi-task";

  if (t === "bpmn:Participant" || t === "bpmn:Lane")
    return "bizagi-participant";

  return null;
}

const KNOWN_MARKERS = [
  "bizagi-task",
  "bizagi-subprocess",
  "bizagi-gateway",
  "bizagi-start-event",
  "bizagi-end-event",
  "bizagi-intermediate-catch",
  "bizagi-intermediate-throw",
  "bizagi-message-catch",
  "bizagi-message-throw",
  "bizagi-participant",
];

/**
 * Elemento com COR PRÓPRIA não recebe a marca do tema.
 *
 * ⚠ O tema pinta toda tarefa com `fill: #EAF2FF !important`, e `!important` vence a cor que o
 * BPMN DI declara. Consequências medidas em 2026-11-14, com o modelador aberto: (1) diagrama
 * importado COM cores chegava achatado, e (2) o `destacar` do ajudante — que grava no DI pelo
 * mesmo caminho do menu de cor do bpmn-js — ficava invisível: o rect saía com
 * `style="fill: rgb(255,205,210)"` e computado `rgb(234,242,255)`. A ferramenta dizia
 * "destaquei em vermelho" e a tela não mudava, que é a pior espécie de defeito aqui.
 *
 * Cor própria é escolha de quem desenhou; o tema é o padrão de quem NÃO escolheu.
 */
function temCorPropria(el) {
  const di = el && el.di;
  if (!di) return false;
  const ler = (chave) => {
    try {
      return typeof di.get === "function" ? di.get(chave) : di[chave];
    } catch {
      return null;
    }
  };
  return Boolean(ler("background-color") || ler("border-color"));
}

/**
 * Apply marker with retry (avoids losing markers on replace)
 */
function setBizagiMarker(modeler, el, attempt = 0) {
  if (!el || isLabel(el) || isConnection(el)) return;

  const canvas = modeler.get("canvas");
  const gfx = canvas.getGraphics(el.id);

  // retry if gfx not yet created (replace/change element)
  if (!gfx) {
    if (attempt < 2)
      setTimeout(() => setBizagiMarker(modeler, el, attempt + 1), 0);
    return;
  }

  for (const m of KNOWN_MARKERS) canvas.removeMarker(el.id, m);

  // Pintar e despintar passam por aqui: `setColor` emite `elements.changed`, então a marca do
  // tema sai quando a cor entra e volta quando ela sai (inclusive no desfazer).
  const m = temCorPropria(el) ? null : markerFor(el);
  if (m) canvas.addMarker(el.id, m);
}

function applyBizagiMarkersToAll(modeler) {
  const elementRegistry = modeler.get("elementRegistry");
  elementRegistry.forEach((el) => setBizagiMarker(modeler, el));
}

function enableAutoMarkers(modeler) {
  const eventBus = modeler.get("eventBus");

  eventBus.on("shape.added", (e) => setBizagiMarker(modeler, e.element));
  eventBus.on("shape.replaced", (e) =>
    setBizagiMarker(modeler, e.newShape || e.element),
  );
  eventBus.on("elements.changed", (e) =>
    (e.elements || []).forEach((el) => setBizagiMarker(modeler, el)),
  );

  eventBus.on("import.done", () => applyBizagiMarkersToAll(modeler));
}

/* =====================================================
   Toolbar CSS injected via JS (guarantees styling)
   ===================================================== */

function injectToolbarCssOnce() {
  if (document.getElementById("bz-toolbar-style")) return;

  const style = document.createElement("style");
  style.id = "bz-toolbar-style";
  style.textContent = `
    .bz-toolbar {
      position: fixed !important;
      left: 14px !important;
      bottom: 14px !important;
      z-index: 99999 !important;

      width: 330px !important;
      max-width: calc(100vw - 28px) !important;

      border: 1px solid rgba(15, 23, 42, 0.16) !important;
      border-radius: 14px !important;
      background: rgba(255,255,255,0.92) !important;
      backdrop-filter: blur(8px) !important;
      box-shadow: 0 18px 46px rgba(0,0,0,0.20) !important;
      overflow: hidden !important;

      font-family: Arial, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      color: #0f172a !important;
    }

    .bz-toolbar__header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 10px 10px 8px 12px !important;
      border-bottom: 1px solid rgba(15, 23, 42, 0.10) !important;
    }

    .bz-toolbar__title {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      letter-spacing: 0.2px !important;
    }

    .bz-pill {
      font-size: 10px !important;
      font-weight: 900 !important;
      padding: 3px 7px !important;
      border-radius: 999px !important;
      background: rgba(11,102,195,0.14) !important;
      border: 1px solid rgba(11,102,195,0.22) !important;
      color: #0b3b72 !important;
    }

    .bz-iconbtn {
      width: 30px !important;
      height: 30px !important;
      border-radius: 10px !important;
      border: 1px solid rgba(15, 23, 42, 0.14) !important;
      background: rgba(255,255,255,0.9) !important;
      cursor: pointer !important;
    }
    .bz-iconbtn:hover { background: rgba(2,6,23,0.06) !important; }

    .bz-toolbar__body { padding: 10px 12px 12px 12px !important; }

    .bz-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 8px !important;
    }

    .bz-row {
      display: flex !important;
      gap: 8px !important;
      margin-top: 10px !important;
    }

    .bz-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;

      border: 1px solid rgba(15, 23, 42, 0.14) !important;
      background: rgba(255,255,255,0.92) !important;
      padding: 9px 10px !important;
      border-radius: 12px !important;

      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      color: #0f172a !important;

      transition: transform 0.06s ease, background 0.12s ease !important;
    }

    .bz-btn:hover { background: rgba(2,6,23,0.06) !important; }
    .bz-btn:active { transform: translateY(1px) !important; }

    .bz-btn--primary { border-color: rgba(11,102,195,0.25) !important; }
    .bz-btn--danger  { border-color: rgba(198,40,40,0.25) !important; }

    .bz-btn--wide { width: 100% !important; }

    .bz-hint {
      margin-top: 10px !important;
      font-size: 12px !important;
      color: #64748b !important;
      line-height: 1.35 !important;
    }

    .bz-kbd {
      display: inline-block !important;
      font-size: 10px !important;
      font-weight: 900 !important;
      padding: 2px 6px !important;
      border-radius: 7px !important;
      background: rgba(148,163,184,0.18) !important;
      border: 1px solid rgba(148,163,184,0.35) !important;
      color: #334155 !important;
    }

    .bz-toolbar.is-collapsed .bz-toolbar__body { display: none !important; }
  `;
  document.head.appendChild(style);
}

/* =====================================================
   Floating toolbar (HTML + binding)
   ===================================================== */

function createFloatingToolbar() {
  injectToolbarCssOnce();

  const root = document.createElement("div");
  // ✅ start collapsed by default
  root.className = "bz-toolbar is-collapsed";

  root.innerHTML = `
    <div class="bz-toolbar__header">
      <div class="bz-toolbar__title">
        <span>⚙️ BPMN</span>
        <span class="bz-pill">Bizagi-like</span>
      </div>
      <!-- ✅ start in collapsed icon -->
      <button id="bz-collapse" class="bz-iconbtn" title="Minimizar / expandir">▸</button>
    </div>

    <div class="bz-toolbar__body">
      <div class="bz-grid">
        <label class="bz-btn bz-btn--primary bz-btn--wide" style="justify-content:center;">
          📂 Abrir
          <input id="bz-file-input" type="file" accept=".bpmn,.xml" style="display:none;" />
        </label>

        <button id="bz-save-bpmn" class="bz-btn bz-btn--primary bz-btn--wide" title="Salvar BPMN (Ctrl/Cmd+S)">
          💾 Salvar BPMN
        </button>

        <button id="bz-save-svg" class="bz-btn bz-btn--wide" title="Exportar SVG">
          🖼️ Exportar SVG
        </button>

        <button id="bz-save-local" class="bz-btn bz-btn--wide" title="Salvar no navegador">
          ☁️ Salvar Local
        </button>
      </div>

      <div class="bz-row">
        <button id="bz-restore-local" class="bz-btn bz-btn--wide" title="Restaurar do navegador">
          ↩️ Restaurar
        </button>
        <button id="bz-clear-local" class="bz-btn bz-btn--danger bz-btn--wide" title="Remover backup local">
          🧹 Limpar
        </button>
        <button id="bz-reset-default" class="bz-btn bz-btn--wide" title="Voltar ao diagrama inicial">
          ♻️ Novo
        </button>
      </div>

      <div class="bz-hint">
        Atalhos:
        <span class="bz-kbd">Ctrl/Cmd</span> + <span class="bz-kbd">S</span> salvar •
        <span class="bz-kbd">Ctrl/Cmd</span> + <span class="bz-kbd">O</span> abrir
      </div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

async function resetToDefault(modeler) {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    const xml = await fetchDiagram(DEFAULT_DIAGRAM_URL);
    await modeler.importXML(xml);
    applyBizagiMarkersToAll(modeler);
    modeler.get("canvas").zoom("fit-viewport");
  } catch (err) {
    console.error("Falha ao resetar para default:", err);
    alert("Falha ao resetar. Veja o console.");
  }
}

function bindFloatingToolbar(modeler) {
  const toolbar = createFloatingToolbar();

  const fileInput = toolbar.querySelector("#bz-file-input");
  const btnSaveBpmn = toolbar.querySelector("#bz-save-bpmn");
  const btnSaveSvg = toolbar.querySelector("#bz-save-svg");
  const btnSaveLocal = toolbar.querySelector("#bz-save-local");
  const btnRestoreLocal = toolbar.querySelector("#bz-restore-local");
  const btnClearLocal = toolbar.querySelector("#bz-clear-local");
  const btnResetDefault = toolbar.querySelector("#bz-reset-default");
  const btnCollapse = toolbar.querySelector("#bz-collapse");

  btnCollapse?.addEventListener("click", () => {
    toolbar.classList.toggle("is-collapsed");
    btnCollapse.textContent = toolbar.classList.contains("is-collapsed")
      ? "▸"
      : "▾";
  });

  fileInput?.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    try {
      const xml = await file.text();
      await modeler.importXML(xml);
      applyBizagiMarkersToAll(modeler);
      modeler.get("canvas").zoom("fit-viewport");

      // após abrir, salva como estado atual
      const { xml: current } = await modeler.saveXML({ format: true });
      localStorage.setItem(LOCAL_STORAGE_KEY, current);
    } catch (err) {
      console.error("Falha ao importar BPMN:", err);
      alert("Falha ao importar BPMN. Veja o console.");
    } finally {
      fileInput.value = "";
    }
  });

  btnSaveBpmn?.addEventListener("click", async () => {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      downloadText("diagram.bpmn", xml, "application/xml");
    } catch (err) {
      console.error("Falha ao salvar BPMN:", err);
      alert("Falha ao salvar BPMN. Veja o console.");
    }
  });

  btnSaveSvg?.addEventListener("click", async () => {
    try {
      const { svg } = await modeler.saveSVG();
      downloadText("diagram.svg", svg, "image/svg+xml");
    } catch (err) {
      console.error("Falha ao exportar SVG:", err);
      alert("Falha ao exportar SVG. Veja o console.");
    }
  });

  btnSaveLocal?.addEventListener("click", async () => {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      localStorage.setItem(LOCAL_STORAGE_KEY, xml);
      alert("Salvo no navegador (localStorage).");
    } catch (err) {
      console.error("Falha ao salvar local:", err);
      alert("Falha ao salvar local. Veja o console.");
    }
  });

  btnRestoreLocal?.addEventListener("click", async () => {
    const xml = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!xml) return alert("Não existe backup salvo no navegador.");

    try {
      await modeler.importXML(xml);
      applyBizagiMarkersToAll(modeler);
      modeler.get("canvas").zoom("fit-viewport");
      alert("Restaurado do navegador (localStorage).");
    } catch (err) {
      console.error("Falha ao restaurar local:", err);
      alert("Falha ao restaurar local. Veja o console.");
    }
  });

  btnClearLocal?.addEventListener("click", () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    alert("Backup local removido.");
  });

  btnResetDefault?.addEventListener("click", () => resetToDefault(modeler));

  // Keyboard shortcuts
  window.addEventListener("keydown", async (e) => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;

    if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      const { xml } = await modeler.saveXML({ format: true });
      downloadText("diagram.bpmn", xml, "application/xml");
    }

    if (e.key.toLowerCase() === "o") {
      e.preventDefault();
      fileInput?.click();
    }
  });
}

function fitAndOffsetCanvas(modeler, offsetX = 120) {
  const canvas = modeler.get("canvas");

  // 1) encaixa no viewport
  canvas.zoom("fit-viewport");

  // 2) desloca para a direita (evita sobrepor toolbar)
  canvas.scroll({ dx: offsetX, dy: 0 });
}

/* =====================================================
   Primeira vez (change `introduce-bpmn-first-run-workspace`)
   ===================================================== */

/** Carrega o que a decisão de abertura mandou carregar, e encaixa no viewport. */
async function abrirDiagrama(modeler, abertura) {
  if (abertura === "restaurar") {
    await modeler.importXML(localStorage.getItem(LOCAL_STORAGE_KEY));
  } else if (abertura === "exemplo") {
    await modeler.importXML(await fetchDiagram(DEFAULT_DIAGRAM_URL));
  } else {
    // `convite` e `branco`: o diagrama NOVO do bpmn-js — um evento de início e nada mais. Vazio
    // aqui não é "nada": sem import, o `fit-viewport` quebra com escala não-finita e o ajudante
    // nasce sem registro para ler.
    await modeler.createDiagram();
  }

  applyBizagiMarkersToAll(modeler);
  fitAndOffsetCanvas(modeler);
}

/**
 * Recebe quem chegou: o convite (quando ninguém escolheu nada ainda) e a tira que diz o que está
 * aberto.
 *
 * ⚠ Tudo o que esta função faz por conta própria é carregar um diagrama, abrir o painel que já
 * existe e deixar uma frase digitada. Ela NÃO encadeia perguntas de entrevista nem escolhe
 * ferramenta: quem conduz a conversa é o modelo, por function calling (constituição §III).
 */
function receberQuemChega(modeler, abertura, ajudante) {
  let convite = null;
  let tira = null;

  /**
   * A tira some na PRIMEIRA edição: editar é o que transforma um exemplo em trabalho da própria
   * pessoa, e continuar chamando de "exemplo" o que ela já mexeu seria falso.
   *
   * ⚠ UM listener, registrado aqui e para sempre — não um `once` por tira. A primeira versão usava
   * `eventBus.once(...)` dentro de `mostrarTira` e a tira **não sumia**: o rename chegava ao
   * `commandStack.changed` (o autosave guardava o nome novo, medido) e a tira continuava na tela.
   * Como `mostrarTira` é chamada no fim de um `async` que ninguém espera, a falha não aparecia
   * nem no console. `on` é o que o autosave já usa ali do lado, e o custo é um `if` por comando.
   *
   * Importar diagrama NÃO é comando (medido: depois de carregar o exemplo o autosave seguia
   * vazio), então trocar de caminho não apaga a própria tira que acabou de nascer.
   */
  modeler.get("eventBus").on("commandStack.changed", () => {
    tira?.remover();
    tira = null;
  });

  function mostrarTira(estado) {
    tira?.remover();
    tira = null;
    if (estado) tira = montarTira({ estado, aoClicar: (destino) => escolher(destino) });
  }

  async function escolher(caminho) {
    const destino = caminho === "descoberta" ? "exemplo" : caminho;
    localStorage.setItem(CHAVE_ESCOLHA, destino);
    await abrirDiagrama(modeler, destino === "exemplo" ? "exemplo" : "branco");

    convite?.fechar();
    convite = null;

    if (caminho === "tutor" || caminho === "descoberta") {
      const painel = ajudante()?.widget;
      painel?.open();
      painel?.sugerir(caminho === "tutor" ? FRASE_DESCREVER : FRASE_DESCOBRIR);
    }

    mostrarTira(destino === "exemplo" ? "exemplo" : "branco");
  }

  if (abertura === "convite") convite = montarTelaBase({ aoEscolher: escolher });
  else mostrarTira(tiraPara(abertura));
}

/* =====================================================
   Main
   ===================================================== */

async function run() {
  const modeler = new Modeler({
    container: "#canvas",
    additionalModules: [TokenSimulationModule],
  });

  enableAutoMarkers(modeler);
  bindFloatingToolbar(modeler);
  bindSimulation(modeler);

  // ✅ AUTOSAVE a cada modificação (evita perder no refresh)
  //
  // ⚠ ESTE LISTENER NÃO DEVOLVE VALOR, e isso não é estilo. No `EventBus` do diagram-js, listener
  // que devolve qualquer coisa diferente de `undefined` ENCERRA a propagação do evento — e
  // `async () => {}` devolve SEMPRE uma Promise. Enquanto este era um `async` direto, ele engolia
  // `commandStack.changed` para todo mundo registrado depois dele: a tira de "Exemplo" da tela
  // base nunca sumia ao editar, sem um erro sequer no console, e o mesmo teria acontecido com
  // qualquer listener futuro (medido em 2026-11-15, com o autosave gravando e o listener vizinho
  // nunca sendo chamado). O `void` mantém o evento vivo para os próximos.
  const eventBus = modeler.get("eventBus");
  eventBus.on("commandStack.changed", () => {
    void (async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true });
        localStorage.setItem(LOCAL_STORAGE_KEY, xml);
      } catch (e) {
        console.warn("Autosave falhou:", e);
      }
    })();
  });

  /**
   * O QUE ABRIR — e isto deixou de ser suposição.
   *
   * Até 2026-11-15 a regra era "não achei nada salvo ⇒ carregue a pizzaria", e era ela que punha
   * o trabalho de outra pessoa na frente de quem acabou de chegar. Agora a decisão é de
   * `primeira-vez/abertura.js` (pura, no `npm test`) e tem quatro saídas, uma delas sendo
   * "esta pessoa ainda não escolheu nada".
   */
  let abertura = "restaurar";
  try {
    abertura = decidirAbertura({
      salvo: localStorage.getItem(LOCAL_STORAGE_KEY),
      escolha: localStorage.getItem(CHAVE_ESCOLHA),
      atalho: location.hash,
    });
    await abrirDiagrama(modeler, abertura);
  } catch (err) {
    console.error("Erro ao abrir BPMN:", err);
  }

  // Ajudante BPMN (canto inferior direito), montado DEPOIS do diagrama e do fit-viewport.
  // Montar antes quebrava o `canvas.zoom("fit-viewport")` com escala nao-finita: medido contra o
  // baseline pre-P2, que nao tem erro nenhum no console. O ajudante e um overlay fixo e nao
  // precisa existir antes do diagrama. Falhar aqui nao pode levar o modelador junto.
  let ajudante = null;
  try {
    ajudante = mountAssistant({ modelador: modeler, diagramaBase: DEFAULT_DIAGRAM_URL });
  } catch (e) {
    console.warn("Ajudante indisponivel:", e);
  }

  // A tela base é a ÚLTIMA coisa a montar e falha sozinha (constituição §X): defeito no convite
  // não pode levar o modelador junto, e o ajudante precisa existir antes para o cartão primário
  // ter o que abrir.
  try {
    receberQuemChega(modeler, abertura, () => ajudante);
  } catch (e) {
    console.warn("Tela base indisponivel:", e);
  }
}

run();
