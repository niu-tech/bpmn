/**
 * Bateria autônoma do ajudante: abre o navegador, dirige a página, verifica e dá veredito.
 *
 * É o laço que o dono pediu (2026-11-11): "você precisa ser autônomo em testar a aplicação".
 * Nada aqui depende de alguém olhar a tela, clicar ou colar diagnóstico — e nada depende de uma
 * chave do Gemini, porque o WebSocket é dublado com frames REAIS do protocolo (os mesmos
 * formatos medidos ao vivo no P1).
 *
 * O que é sintético e o que é real, dito na cara:
 *   REAL  — a página publicada, o bundle de produção, o worklet de captura, a reamostragem, o
 *           PCM16, o layout, o CSS, o DOM, os eventos de clique, o áudio do microfone (WAV
 *           pt-BR gerado por SAPI, tocado pelo Chromium como se fosse o microfone).
 *   DUBLÊ — só o socket do Google. Os frames que ele devolve são cópias do que o servidor mandou
 *           de verdade: `setupComplete`, `toolCall`, `serverContent.modelTurn`, `interrupted`.
 *
 * Uso:
 *   node tools/battery.mjs                         # contra http://127.0.0.1:8126/
 *   node tools/battery.mjs https://niu-tech.github.io/bpmn/
 *   node tools/battery.mjs --ver                   # janela VISÍVEL, para acompanhar
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { dirigir } from './drive-page.mjs';

/**
 * Chave do Gemini para o cenário AO VIVO, lida de um `.env` que o git ignora.
 *
 * ⚠ O valor nunca passa por um prompt, por um log, por um argumento de linha de comando nem por
 * este console: é lido aqui dentro, interpolado no passo que roda NA PÁGINA, e o cenário termina
 * conferindo que ele não aparece em lugar nenhum. É o mesmo contrato do produto (a chave é do
 * dono dela), aplicado ao teste.
 *
 * Sem `.env`, o cenário ao vivo simplesmente não entra na bateria — os outros nove continuam
 * provando tudo o que não depende do Google.
 */
function chaveDoEnv() {
  if (!existsSync('.env')) return null;
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$/.exec(linha);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  return null;
}

const ALVO = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8126/';
const VISIVEL = process.argv.includes('--ver');
const WAV = 'artifacts/voz/gateway.wav';
const mic = existsSync(WAV) ? WAV : null;

const CHAVE = 'AQ.CHAVE-SINTETICA-DA-BATERIA-NAO-E-DE-NINGUEM-0123';

/** Instala o dublê do socket e abre o painel. Primeiro passo de todo cenário com sessão. */
const PREPARAR = `
window.__frames = [];
window.__sockets = 0;
window.WebSocket = function (url) {
  const self = this;
  window.__sockets++;
  window.__ws = this;
  this.url = url; this.readyState = 1;
  this.send = (d) => { window.__frames.push(String(d)); };
  this.close = () => { self.readyState = 3; self.onclose && self.onclose({ code: 1000, reason: 'dublê' }); };
  setTimeout(() => { self.onopen && self.onopen({}); }, 0);
};
window.__responde = (o) => window.__ws.onmessage({ data: JSON.stringify(o) });
window.__btn = (txt) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === txt);
document.querySelector('.bpmn-assist__toggle').click();
return { ok: true };
`;

const CONECTAR = `
document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(CHAVE)};
const c = document.querySelector('#bpmn-assist-consent');
c.checked = true; c.dispatchEvent(new Event('change'));
window.__btn('Começar').click();
await new Promise((r) => setTimeout(r, 150));
window.__responde({ setupComplete: {} });
await new Promise((r) => setTimeout(r, 200));
return { ok: document.querySelector('.bpmn-assist__status').textContent === 'pronto', status: document.querySelector('.bpmn-assist__status').textContent };
`;

const CENARIOS = [
  {
    nome: 'modelador carrega com o ajudante montado',
    url: ALVO,
    passos: [`
      const svg = document.querySelectorAll('#canvas .djs-visual').length;
      const montado = document.documentElement.dataset.bpmnAssistantMounted === '1';
      const botao = !!document.querySelector('.bpmn-assist__toggle');
      return { ok: svg > 10 && montado && botao, formas: svg, montado, botao };
    `],
  },
  {
    nome: 'viewer carrega com o ajudante montado',
    url: new URL('viewer.html', ALVO).href,
    passos: [`
      const svg = document.querySelectorAll('.djs-visual').length;
      return { ok: svg > 10 && !!document.querySelector('.bpmn-assist__toggle'), formas: svg };
    `],
  },
  {
    nome: 'primeira tela: acao visivel e dica certa',
    url: ALVO,
    passos: [PREPARAR, `
      const comecar = window.__btn('Começar');
      const painel = document.querySelector('.bpmn-assist__panel').getBoundingClientRect();
      const b = comecar.getBoundingClientRect();
      const dentro = b.bottom <= painel.bottom + 1 && b.top >= painel.top;
      const dica = document.querySelector('.bpmn-assist__hint').textContent;
      return { ok: !!comecar && dentro && /chave/i.test(dica), dentro, dica, altura: Math.round(painel.height) };
    `],
  },
  {
    nome: 'texto: pergunta digitada volta respondida',
    url: ALVO,
    passos: [PREPARAR, CONECTAR, `
      const ta = document.querySelector('.bpmn-assist__composer textarea');
      ta.value = 'qual a diferenca entre gateway exclusivo e paralelo?';
      window.__btn('Enviar').click();
      await new Promise((r) => setTimeout(r, 150));
      const perguntou = window.__frames.some((f) => f.includes('realtimeInput') && f.includes('gateway'));
      window.__responde({ toolCall: { functionCalls: [{ id: 'c1', name: 'entregar_resposta', args: { texto: 'O exclusivo escolhe UM caminho; o paralelo abre TODOS.' } }] } });
      await new Promise((r) => setTimeout(r, 100));
      window.__responde({ serverContent: { turnComplete: true } });
      await new Promise((r) => setTimeout(r, 200));
      const bolhas = [...document.querySelectorAll('.bpmn-assist__msg--assistant')].map((m) => m.textContent.trim());
      const respondeuTool = window.__frames.some((f) => f.includes('toolResponse'));
      return {
        ok: perguntou && respondeuTool && bolhas.some((b) => b.includes('escolhe UM caminho')),
        perguntou, respondeuTool, bolhas,
      };
    `],
  },
  {
    nome: 'voz: escuta continua com fala real no microfone',
    url: ALVO,
    mic,
    passos: [PREPARAR, CONECTAR, `
      window.__btn('Voz').click();
      await new Promise((r) => setTimeout(r, 200));
      window.__responde({ setupComplete: {} });
      await new Promise((r) => setTimeout(r, 1200));
      let pico = 0;
      for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 100)); pico = Math.max(pico, window.__bpmnAssist.estado.nivel); }
      const antes = window.__frames.filter((f) => f.includes('"audio"')).length;

      // O modelo comeca a responder. Em escuta continua o microfone NAO fecha.
      window.__responde({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAAAAAA' } }] } } });
      await new Promise((r) => setTimeout(r, 500));
      const depois = window.__frames.filter((f) => f.includes('"audio"')).length;

      return {
        ok: pico > 0.15 && window.__bpmnAssist.estado.micOn === true && depois > antes,
        picoDeNivel: Number(pico.toFixed(3)),
        micAbertoNaResposta: window.__bpmnAssist.estado.micOn,
        quadrosDuranteAResposta: depois - antes,
        rotulo: document.querySelector('.bpmn-assist__miclabel').textContent,
      };
    `],
  },
  {
    nome: 'rede de seguranca: laco de eco liga meia-duplex e avisa',
    url: ALVO,
    mic,
    passos: [PREPARAR, CONECTAR, `
      window.__btn('Voz').click();
      await new Promise((r) => setTimeout(r, 200));
      window.__responde({ setupComplete: {} });
      await new Promise((r) => setTimeout(r, 1000));
      for (let i = 0; i < 3; i++) {
        window.__responde({ serverContent: { interrupted: true } });
        await new Promise((r) => setTimeout(r, 80));
      }
      await new Promise((r) => setTimeout(r, 300));
      const aviso = [...document.querySelectorAll('.bpmn-assist__msg')].map((m) => m.textContent).find((t) => /microfone/i.test(t));
      return {
        ok: window.__bpmnAssist.estado.micOn === false && !!aviso,
        micFechado: window.__bpmnAssist.estado.micOn === false,
        avisou: !!aviso,
      };
    `],
  },
  {
    nome: 'controles ficam alcancaveis depois de muita conversa',
    url: ALVO,
    passos: [PREPARAR, CONECTAR, `
      // 12 turnos: o suficiente para a conversa passar da altura do painel.
      for (let i = 0; i < 12; i++) {
        const ta = document.querySelector('.bpmn-assist__composer textarea');
        ta.value = 'pergunta numero ' + i + ' sobre notacao BPMN e seus elementos';
        window.__btn('Enviar').click();
        window.__responde({ toolCall: { functionCalls: [{ id: 'c' + i, name: 'entregar_resposta', args: { texto: 'Resposta ' + i + ' com texto suficiente para ocupar espaco na lista da conversa.' } }] } });
        window.__responde({ serverContent: { turnComplete: true } });
        await new Promise((r) => setTimeout(r, 40));
      }
      await new Promise((r) => setTimeout(r, 300));
      const painel = document.querySelector('.bpmn-assist__panel').getBoundingClientRect();
      const enviar = window.__btn('Enviar').getBoundingClientRect();
      const corpo = document.querySelector('.bpmn-assist__body');
      const dentro = enviar.bottom <= painel.bottom + 1 && enviar.top >= painel.top;
      return {
        ok: dentro && corpo.scrollHeight > corpo.clientHeight,
        enviarVisivelSemRolar: dentro,
        conversaRolou: corpo.scrollHeight > corpo.clientHeight,
        mensagens: document.querySelectorAll('.bpmn-assist__msg').length,
      };
    `],
  },
  {
    nome: 'celular 375x812: painel cabe e nao cobre a barra',
    url: ALVO,
    janela: [375, 812],
    passos: [PREPARAR, `
      const painel = document.querySelector('.bpmn-assist__panel').getBoundingClientRect();
      const barra = document.querySelector('.bz-toolbar')?.getBoundingClientRect();
      const cobre = barra ? !(painel.bottom <= barra.top || painel.top >= barra.bottom) : false;
      const campo = document.querySelector('#bpmn-assist-key').getBoundingClientRect();
      return {
        ok: painel.height > 100 && painel.bottom <= window.innerHeight + 1 && !cobre && campo.width > 100,
        painel: [Math.round(painel.width), Math.round(painel.height)],
        cobreABarra: cobre,
      };
    `],
  },
  {
    nome: 'a chave nao vaza em lugar nenhum',
    url: ALVO,
    passos: [PREPARAR, CONECTAR, `
      const html = document.documentElement.outerHTML;
      const rel = window.__bpmnAssist.report();
      const ls = JSON.stringify(Object.entries(localStorage));
      const ss = JSON.stringify(Object.entries(sessionStorage));
      const achou = [
        ['dom', html.includes(${JSON.stringify(CHAVE)})],
        ['relatorio', rel.includes(${JSON.stringify(CHAVE)})],
        ['localStorage', ls.includes(${JSON.stringify(CHAVE)})],
        ['sessionStorage', ss.includes(${JSON.stringify(CHAVE)})],
        ['cookie', document.cookie.includes(${JSON.stringify(CHAVE)})],
        ['url', location.href.includes(${JSON.stringify(CHAVE)})],
      ].filter(([, v]) => v).map(([k]) => k);
      return { ok: achou.length === 0, vazouEm: achou, itensDeStorage: localStorage.length + sessionStorage.length };
    `],
  },
];

// ---------------------------------------------------------------- ao vivo (opcional)
const chaveViva = chaveDoEnv();
if (chaveViva) {
  CENARIOS.push({
    nome: 'AO VIVO: conversa de verdade contra o Gemini',
    url: ALVO,
    espera: 3000,
    passos: [
      // Sem dublê nenhum aqui: é o socket real do Google.
      `window.__btn = (txt) => [...document.querySelectorAll('.bpmn-assist__panel button')].find((b) => b.textContent.trim() === txt);
       document.querySelector('.bpmn-assist__toggle').click();
       document.querySelector('#bpmn-assist-key').value = ${JSON.stringify(chaveViva)};
       const c = document.querySelector('#bpmn-assist-consent');
       c.checked = true; c.dispatchEvent(new Event('change'));
       window.__btn('Começar').click();
       for (let i = 0; i < 40 && document.querySelector('.bpmn-assist__status').textContent !== 'pronto'; i++) {
         await new Promise((r) => setTimeout(r, 500));
       }
       return { ok: document.querySelector('.bpmn-assist__status').textContent === 'pronto', status: document.querySelector('.bpmn-assist__status').textContent };`,
      `const ta = document.querySelector('.bpmn-assist__composer textarea');
       ta.value = 'Em uma frase: qual a diferenca entre gateway exclusivo e paralelo?';
       window.__btn('Enviar').click();
       let resposta = '';
       for (let i = 0; i < 60; i++) {
         await new Promise((r) => setTimeout(r, 500));
         const b = [...document.querySelectorAll('.bpmn-assist__msg--assistant')].map((m) => m.textContent.trim());
         if (b.length && b.at(-1).length > 20) { resposta = b.at(-1); break; }
       }
       const rel = window.__bpmnAssist.report();
       const vazou = rel.includes(${JSON.stringify(chaveViva)})
         || document.documentElement.outerHTML.includes(${JSON.stringify(chaveViva)})
         || JSON.stringify(Object.entries(localStorage)).includes(${JSON.stringify(chaveViva)});
       return {
         ok: resposta.length > 20 && !vazou,
         respondeu: resposta.slice(0, 160),
         caracteres: resposta.length,
         vazouAChave: vazou,
         contagem: (rel.split('\n').find((l) => l.startsWith('contagem:')) ?? '').slice(0, 220),
       };`,
    ],
  });
  console.log('(cenario AO VIVO habilitado: .env com chave encontrado)\n');
} else {
  console.log('(sem .env com GEMINI_API_KEY: o cenario AO VIVO fica de fora)\n');
}

mkdirSync('artifacts/bateria', { recursive: true });

const resultados = [];
for (const c of CENARIOS) {
  const r = await dirigir({
    url: c.url,
    mic: c.mic ?? null,
    passos: c.passos,
    espera: c.espera ?? 2600,
    largura: c.janela?.[0] ?? 1280,
    altura: c.janela?.[1] ?? 860,
    shot: `artifacts/bateria/${c.nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`,
    headless: !VISIVEL,
  });

  const ultimo = r.passos.at(-1);
  const erroDePasso = r.passos.find((p) => p.erro);
  const ruido = r.console.filter((x) => !/favicon/.test(x.texto));
  const ok = !erroDePasso && !r.excecoes.length && ultimo?.valor?.ok === true;

  resultados.push({
    cenario: c.nome,
    ok,
    detalhe: ultimo?.valor ?? null,
    erro: erroDePasso?.erro ?? r.excecoes[0] ?? null,
    console: ruido,
    shot: r.shot,
  });

  console.log(`${ok ? '  OK  ' : '  FALHOU  '} ${c.nome}`);
  if (!ok) console.log(`        ${JSON.stringify(ultimo?.valor ?? erroDePasso?.erro ?? r.excecoes[0])}`);
  else if (ultimo?.valor) console.log(`        ${JSON.stringify(ultimo.valor)}`);
  if (ruido.length) console.log(`        ! console: ${ruido.map((x) => x.texto).join(' | ').slice(0, 200)}`);
}

const passaram = resultados.filter((r) => r.ok).length;
writeFileSync('artifacts/bateria/resultado.json', JSON.stringify({ alvo: ALVO, quando: new Date().toISOString(), passaram, de: resultados.length, resultados }, null, 2));

console.log(`\n========================================`);
console.log(`bateria: ${passaram} de ${resultados.length} em ${ALVO}`);
console.log(`prova em artifacts/bateria/ (prints + resultado.json)`);
console.log(`========================================`);
process.exit(passaram === resultados.length ? 0 : 1);
