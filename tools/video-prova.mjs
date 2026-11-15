/**
 * VÍDEO DE PROVA: a conversa acontecendo, com som, para quem não estava na frente da tela.
 *
 * Por que existe (change `prove-it-with-a-golden-set`, 5.1–5.4; pedido do dono em 2026-11-15:
 * "você mesmo pode fazer os testes de voz ao vivo, e deve fazer, gerando os vídeos de teste"):
 * a bateria já prova comportamento, e prova em TEXTO. Texto não mostra o microfone abrindo, a
 * pergunta aparecendo, o elemento sumindo do desenho — e é isso que a banca (e o dono) precisam
 * ver. Até aqui, provar qualquer coisa de voz dependia de alguém gravar a própria tela.
 *
 * O que sai (uma pasta por corrida, em `artifacts/video/<carimbo>/`):
 *   quadro-0001.jpg …  os quadros da tela, com carimbo de tempo
 *   trilha.wav         a fala do ALUNO e a fala do AGENTE remontadas na linha do tempo real
 *   linha-do-tempo.json  o que aconteceu e quando (eventos do diário + passos)
 *   filme.html         o reprodutor: toca os quadros no ritmo real, com o som e a legenda
 *
 * ⚠ Não há ffmpeg nesta máquina, e trazer um codec para montar um MP4 seria 100 MB para resolver
 * o que uma página de 60 linhas resolve. O `filme.html` toca sozinho ao abrir, com controle de
 * play/pausa e barra de tempo — é vídeo para quem vai assistir, sem ser vídeo para quem vai
 * instalar codec.
 *
 * Uso:
 *   node tools/video-prova.mjs                      # o caminho feliz (2–3 min)
 *   node tools/video-prova.mjs --cenario portao     # o portão falado (apaga com confirmação)
 *   node tools/video-prova.mjs --ver                # com janela visível, para acompanhar
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { dirigir } from './drive-page.mjs';
import { juntarComSilencio } from './wav-pad.mjs';

const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';
const VISIVEL = process.argv.includes('--ver');
const QUAL = (() => { const i = process.argv.indexOf('--cenario'); return i > 0 ? process.argv[i + 1] : 'feliz'; })();

function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$/.exec(linha);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  return null;
}

const CHAVE = chaveDoEnv();
if (!CHAVE) {
  console.error('sem .env com GEMINI_API_KEY: o vídeo de prova é de uma sessão de VERDADE');
  process.exit(2);
}

/**
 * O MARCADOR DE CLIQUE HUMANO (tarefa 5.3).
 *
 * ⚠ Num filme de agente trabalhando, a banca não tem como saber quem fez o quê: o elemento se
 * move, a cor muda, a tarefa some — e tudo parece obra do agente. Quando a PESSOA age (clica num
 * elemento, escolhe um candidato, aperta o microfone), um selo aparece por dois segundos nos
 * quadros. É um rótulo honesto, não enfeite: sem ele, o vídeo pode dar ao agente o crédito de
 * uma ação humana.
 */
const MARCADOR = `
window.__marcarHumano = (texto) => {
  let selo = document.getElementById('__humano');
  if (!selo) {
    selo = document.createElement('div');
    selo.id = '__humano';
    selo.style.cssText = 'position:fixed;z-index:2147483647;left:16px;top:16px;background:#1d4ed8;'
      + 'color:#fff;font:600 14px/1.3 system-ui,sans-serif;padding:8px 14px;border-radius:999px;'
      + 'box-shadow:0 6px 20px rgba(29,78,216,.45);transition:opacity .2s;pointer-events:none';
    document.body.append(selo);
  }
  selo.textContent = '\u261d o aluno: ' + texto;
  selo.style.opacity = '1';
  clearTimeout(window.__seloRelogio);
  window.__seloRelogio = setTimeout(() => { selo.style.opacity = '0'; }, 2000);
  return true;
};
`;

/** Abre o painel, informa a chave e conecta. Igual ao que o aluno faz. */
const CONECTAR = MARCADOR + `
window.__btn = (txt) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === txt);
document.querySelector('.bpmn-assist__toggle').click();
document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(CHAVE)};
const c = document.querySelector('#bpmn-assist-consent');
c.checked = true; c.dispatchEvent(new Event('change'));
// A gravação do áudio do modelo começa ANTES da primeira resposta: é ela que vira a trilha.
window.__bpmnAssist.gravarAudio(true);
window.__btn('Começar').click();
for (let i = 0; i < 40 && document.querySelector('.bpmn-assist__status').textContent !== 'pronto'; i++) {
  await new Promise((r) => setTimeout(r, 500));
}
return { ok: document.querySelector('.bpmn-assist__status').textContent === 'pronto', status: document.querySelector('.bpmn-assist__status').textContent };
`;

/** Espera a resposta desta pergunta (mesma ideia da bateria: o turno carimbado, não a posição). */
const ESPERAR = `
window.__resposta = async (pergunta) => {
  const ta = document.querySelector('.bpmn-assist__composer textarea');
  ta.value = pergunta;
  window.__btn('Enviar').click();
  const meu = window.__bpmnAssist.mensagens.filter((m) => m.role === 'user').at(-1)?.turn ?? null;
  for (let i = 0; i < 160; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const fechou = window.__bpmnAssist.mensagens.find((m) => m.role === 'assistant' && m.completa && (meu === null || m.turn === meu));
    if (fechou) return (fechou.text ?? '').trim();
  }
  return '(sem resposta no prazo)';
};
`;

/**
 * Os cenários do filme. Cada um é uma CENA do produto, não um teste: o que se quer é um minuto
 * que explique o que o ajudante faz.
 */
const CENARIOS = {
  /**
   * O CAMINHO FELIZ (5.4): o aluno descreve o processo em palavras, o agente monta, o aluno
   * corrige, o agente arruma. Tudo digitado — é a cena que mostra o produto inteiro sem depender
   * do microfone funcionar na máquina de quem assiste.
   */
  feliz: {
    titulo: 'O aluno descreve o processo, e o ajudante monta',
    mic: null,
    passos: [
      CONECTAR,
      `${ESPERAR}
       window.__marcarHumano('digita o pedido');
       const r1 = await window.__resposta('Monte para mim, no pool do cliente: um evento de início chamado Fome, depois uma tarefa Escolher a pizza, e ligue os dois.');
       await new Promise((r) => setTimeout(r, 1500));
       return { ok: true, pediu: 'montar', respondeu: r1.slice(0, 200) };`,
      `window.__marcarHumano('pede para inserir no meio');
       const r2 = await window.__resposta('Agora põe uma tarefa Conferir o endereço entre a Escolher a pizza e o que vem depois dela.');
       await new Promise((r) => setTimeout(r, 1500));
       return { ok: true, pediu: 'inserir no meio', respondeu: r2.slice(0, 200) };`,
      `window.__marcarHumano('pede para alinhar');
       const r3 = await window.__resposta('Deixa essas duas tarefas novas na mesma linha, por favor.');
       await new Promise((r) => setTimeout(r, 2000));
       const linhas = [...document.querySelectorAll('.bpmn-assist__msg--tool')].map((m) => m.textContent.trim());
       return { ok: true, pediu: 'alinhar', respondeu: r3.slice(0, 200), ferramentas: linhas.slice(-6) };`,
    ],
  },

  /**
   * O PORTÃO FALADO: a cena que mais importa para a dissertação, porque é a que mostra o agente
   * NÃO fazendo o que foi pedido até a pessoa confirmar — por voz, sem teclado.
   */
  portao: {
    titulo: 'Apagar só depois do "pode apagar"',
    mic: 'artifacts/voz/portao-falado.wav',
    passos: [
      `${CONECTAR}`,
      `// O aluno CLICA no elemento e depois fala. A seleção chega ao modelo pelo canal da página.
       const alvo = window.__bpmnAssist.desenho.nos.find((n) => n.tipo === 'Task' && /bake/i.test(n.nome ?? ''))
         ?? window.__bpmnAssist.desenho.nos.find((n) => n.tipo === 'Task' && n.nome);
       window.__alvo = alvo;
       window.__marcarHumano('clica em "' + alvo.nome + '" no desenho');
       window.__bpmnAssist.selecionar(alvo.id);
       await new Promise((r) => setTimeout(r, 1500));
       window.__marcarHumano('aperta o microfone e fala');
       document.querySelector('.bpmn-assist__mic').click();
       for (let i = 0; i < 60 && !window.__bpmnAssist.estado.micOn; i++) await new Promise((r) => setTimeout(r, 500));
       return { ok: window.__bpmnAssist.estado.micOn === true, selecionou: alvo.nome };`,
      `const existe = () => window.__bpmnAssist.desenho.nos.some((n) => n.id === window.__alvo.id);
       for (let i = 0; i < 100 && existe(); i++) await new Promise((r) => setTimeout(r, 500));
       await new Promise((r) => setTimeout(r, 2000));
       const ev = window.__bpmnAssist.eventos;
       const q = (k) => { const e = ev.find((x) => x.key === k); return e ? Number((e.ms / 1000).toFixed(1)) : null; };
       return { ok: !existe(), recusouEm: q('tool.sem-confirmacao'), sumiu: !existe() };`,
    ],
  },
};

const cena = CENARIOS[QUAL];
if (!cena) {
  console.error(`cenário desconhecido: ${QUAL} (use: ${Object.keys(CENARIOS).join(', ')})`);
  process.exit(2);
}

const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
const pasta = resolve(`artifacts/video/${QUAL}-${carimbo}`);
mkdirSync(pasta, { recursive: true });

console.log(`\n▶ gravando: ${cena.titulo}`);
console.log(`  alvo: ${ALVO}`);
console.log(`  pasta: ${pasta}\n`);

/** O último passo recolhe o que o filme precisa: diário, conversa e o áudio gravado. */
const RECOLHER = `
const a = window.__bpmnAssist.audioDoModelo;
return {
  ok: true,
  conversa: window.__bpmnAssist.mensagens.map((m) => ({ papel: m.role, via: m.via ?? null, turno: m.turn ?? null, texto: (m.text ?? '').slice(0, 400), at: m.at })),
  eventos: window.__bpmnAssist.eventos.map((e) => ({ chave: e.key, ms: e.ms, n: e.n, detalhe: e.detail ?? null })),
  // O áudio vai em base64, como veio do servidor: quem remonta é o Node, aqui fora.
  audio: a ? a.quadros : [],
};
`;

const r = await dirigir({
  url: ALVO,
  mic: cena.mic,
  passos: [...cena.passos, RECOLHER],
  espera: 3200,
  headless: !VISIVEL,
  filme: { pasta, intervaloMs: 700, qualidade: 60 },
});

const recolhido = r.passos.at(-1)?.valor ?? {};
const quadros = r.filme?.quadros ?? [];

/* ---------------------------------------------------------------- a trilha sonora
 *
 * Duas falas, duas taxas: o aluno entra a 16 kHz (a fixture que o microfone tocou) e o agente
 * sai a 24 kHz (o PCM do Live). A trilha é montada a 24 kHz, com a fala do aluno reamostrada e
 * posta no instante em que o microfone abriu — é isso que faz o som bater com a imagem.
 */
const TAXA = 24000;

function pcmDoModelo(quadrosDeAudio, duracaoMs) {
  const total = Math.ceil((duracaoMs / 1000) * TAXA);
  const saida = new Int16Array(Math.max(total, 1));
  for (const q of quadrosDeAudio) {
    const bytes = Buffer.from(q.b64, 'base64');
    const amostras = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
    const inicio = Math.floor((q.ms / 1000) * TAXA);
    for (let i = 0; i < amostras.length; i++) {
      const j = inicio + i;
      if (j >= saida.length) break;
      // Soma com teto: duas fontes no mesmo instante é o normal (o aluno fala por cima).
      const v = saida[j] + amostras[i];
      saida[j] = Math.max(-32768, Math.min(32767, v));
    }
  }
  return saida;
}

function misturarFala(saida, wavPath, offsetMs) {
  if (!wavPath || !existsSync(wavPath)) return false;
  const buf = readFileSync(wavPath);
  // O WAV das fixtures é PCM 16 bits mono 16 kHz, escrito pelo `wav-pad.mjs` (fmt canônico).
  let pos = 12;
  let taxa = 16000;
  let dados = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const tam = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') taxa = buf.readUInt32LE(pos + 12);
    if (id === 'data') { dados = buf.subarray(pos + 8, pos + 8 + tam); break; }
    pos += 8 + tam + (tam % 2);
  }
  if (!dados) return false;
  const entrada = new Int16Array(dados.buffer, dados.byteOffset, Math.floor(dados.length / 2));
  const fator = TAXA / taxa;
  const inicio = Math.floor((offsetMs / 1000) * TAXA);
  for (let i = 0; i < entrada.length; i++) {
    // Reamostragem por repetição (vizinho mais próximo). É trilha de prova, não masterização.
    const de = inicio + Math.floor(i * fator);
    for (let k = 0; k < fator; k++) {
      const j = de + k;
      if (j < 0 || j >= saida.length) continue;
      const v = saida[j] + Math.round(entrada[i] * 0.8);
      saida[j] = Math.max(-32768, Math.min(32767, v));
    }
  }
  return true;
}

function escreverWav(amostras, destino) {
  const corpo = Buffer.from(amostras.buffer, amostras.byteOffset, amostras.length * 2);
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0, 'ascii');
  cab.writeUInt32LE(36 + corpo.length, 4);
  cab.write('WAVEfmt ', 8, 'ascii');
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(TAXA, 24);
  cab.writeUInt32LE(TAXA * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36, 'ascii');
  cab.writeUInt32LE(corpo.length, 40);
  writeFileSync(destino, Buffer.concat([cab, corpo]));
}

const duracaoMs = Math.max(quadros.at(-1)?.ms ?? 0, ...(recolhido.audio ?? []).map((q) => q.ms)) + 3000;
const trilha = pcmDoModelo(recolhido.audio ?? [], duracaoMs);
/**
 * O instante em que o microfone abriu: é de lá que a fixture do aluno começa a tocar (o Chromium
 * só começa a ler o arquivo quando o `getUserMedia` abre).
 */
const abriuMic = (recolhido.eventos ?? []).find((e) => e.chave === 'mic.open')?.ms ?? 0;
const temFalaDoAluno = cena.mic ? misturarFala(trilha, resolve(cena.mic), abriuMic) : false;
escreverWav(trilha, resolve(pasta, 'trilha.wav'));

/* ---------------------------------------------------------------- o reprodutor */

const linhaDoTempo = {
  cenario: QUAL,
  titulo: cena.titulo,
  quando: new Date().toISOString(),
  alvo: ALVO,
  micDoAluno: cena.mic ?? null,
  duracaoMs,
  quadros,
  passos: r.passos.map((p) => p.valor ?? null),
  conversa: recolhido.conversa ?? [],
  eventos: recolhido.eventos ?? [],
  // O que é REAL e o que é de laboratório, dito na cara — a mesma regra da bateria.
  natureza: {
    sessao: 'Gemini Live de verdade, com a chave do dono',
    microfone: cena.mic ? 'WAV pt-BR (SAPI) tocado pelo Chromium como se fosse o microfone' : 'sem microfone: cena digitada',
    diagrama: 'bpmn-js de verdade, na página publicada',
    trilha: temFalaDoAluno ? 'fala do aluno (fixture) + fala do agente (PCM recebido)' : 'só a fala do agente (PCM recebido)',
  },
};
writeFileSync(resolve(pasta, 'linha-do-tempo.json'), JSON.stringify(linhaDoTempo, null, 2));

const html = `<!doctype html>
<meta charset="utf-8">
<title>${cena.titulo} — prova em vídeo</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b1020; color: #e2e8f0; font: 14px/1.5 system-ui, sans-serif; }
  header { padding: 14px 18px; border-bottom: 1px solid #1e293b; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .nat { color: #94a3b8; font-size: 12px; }
  main { display: grid; grid-template-columns: 1fr 320px; gap: 16px; padding: 16px; align-items: start; }
  img { width: 100%; border-radius: 10px; border: 1px solid #1e293b; background: #000; }
  .controles { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
  button { font: inherit; padding: 6px 14px; border-radius: 999px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; cursor: pointer; }
  input[type=range] { flex: 1; }
  ol { margin: 0; padding-left: 18px; max-height: 70vh; overflow: auto; }
  li { margin-bottom: 8px; }
  .papel { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; display: block; }
  li.user { color: #93c5fd; }
  li.assistant { color: #e2e8f0; }
  li.tool { color: #94a3b8; font-style: italic; }
  li.system { color: #fbbf24; }
  .agora { background: #1e293b; border-radius: 6px; padding: 2px 6px; margin-left: -6px; }
</style>
<header>
  <h1>${cena.titulo}</h1>
  <p class="nat">${Object.entries(linhaDoTempo.natureza).map(([k, v]) => `<b>${k}:</b> ${v}`).join(' · ')}</p>
</header>
<main>
  <div>
    <img id="tela" src="${quadros[0]?.arquivo ?? ''}" alt="a tela do aluno">
    <div class="controles">
      <button id="tocar">▶ tocar</button>
      <input id="barra" type="range" min="0" max="${duracaoMs}" value="0" step="100">
      <span id="relogio">0,0 s</span>
    </div>
    <audio id="som" src="trilha.wav" preload="auto"></audio>
  </div>
  <ol id="conversa">${(recolhido.conversa ?? []).map((m) => `<li class="${m.papel}" data-at="${m.at}"><span class="papel">${m.papel}${m.via ? ` · ${m.via}` : ''}</span>${(m.texto || '').replace(/[<&]/g, (c) => ({ '<': '&lt;', '&': '&amp;' }[c]))}</li>`).join('')}</ol>
</main>
<script>
const quadros = ${JSON.stringify(quadros)};
const t0Conversa = ${JSON.stringify((recolhido.conversa ?? [])[0]?.at ?? 0)};
const tela = document.getElementById('tela');
const som = document.getElementById('som');
const barra = document.getElementById('barra');
const relogio = document.getElementById('relogio');
const botao = document.getElementById('tocar');
let inicio = null;
let tocando = false;

function mostrar(ms) {
  let q = quadros[0];
  for (const x of quadros) { if (x.ms <= ms) q = x; else break; }
  if (q && tela.getAttribute('src') !== q.arquivo) tela.setAttribute('src', q.arquivo);
  barra.value = ms;
  relogio.textContent = (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  // A conversa acompanha: a bolha do momento fica destacada.
  for (const li of document.querySelectorAll('#conversa li')) {
    const at = Number(li.dataset.at || 0) - t0Conversa;
    li.classList.toggle('agora', at <= ms && at > ms - 4000);
  }
}

function laco() {
  if (!tocando) return;
  const ms = Math.min(${duracaoMs}, (performance.now() - inicio));
  mostrar(ms);
  if (ms >= ${duracaoMs}) { parar(); return; }
  requestAnimationFrame(laco);
}

function tocar() {
  tocando = true;
  botao.textContent = '❚❚ pausar';
  inicio = performance.now() - Number(barra.value);
  som.currentTime = Number(barra.value) / 1000;
  som.play().catch(() => {});
  requestAnimationFrame(laco);
}

function parar() {
  tocando = false;
  botao.textContent = '▶ tocar';
  som.pause();
}

botao.addEventListener('click', () => (tocando ? parar() : tocar()));
barra.addEventListener('input', () => { inicio = performance.now() - Number(barra.value); som.currentTime = Number(barra.value) / 1000; mostrar(Number(barra.value)); });
mostrar(0);
</script>
`;
writeFileSync(resolve(pasta, 'filme.html'), html);

const ok = r.passos.every((p) => !p.erro && (p.valor?.ok !== false));
console.log(`  quadros: ${quadros.length} (${(duracaoMs / 1000).toFixed(1)} s)`);
console.log(`  trilha:  ${temFalaDoAluno ? 'aluno + agente' : 'só o agente'} (${(recolhido.audio ?? []).length} quadros de áudio do modelo)`);
for (const p of r.passos.slice(0, -1)) {
  console.log(`  passo:   ${JSON.stringify(p.valor ?? p.erro).slice(0, 160)}`);
}
console.log(`\n${ok ? 'OK' : 'ATENÇÃO'} — abra: ${resolve(pasta, 'filme.html')}`);
process.exit(ok ? 0 : 1);
