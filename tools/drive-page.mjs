/**
 * Dirige uma página num navegador de verdade, sem ninguém olhando.
 *
 * Por que existe (dono, 2026-11-11): "a gente também precisa ter uma forma de testar e analisar
 * enquanto a gente trabalha". Até aqui, provar qualquer coisa de UI exigia uma pessoa abrindo o
 * site e descrevendo o que viu — o que custou um dia inteiro de ida e volta por um painel com
 * botões demais. Isto abre o Chrome/Edge em modo headless, FALA CDP com ele, clica, lê o DOM e
 * devolve erro de console e exceção. É o mesmo laço de `dotnet maia screen capture` da MAIA,
 * reduzido ao que um site estático precisa.
 *
 * Uso:
 *   node tools/drive-page.mjs <url> [--passo "<js>"]... [--shot <arquivo.png>] [--espera <ms>]
 *
 * Cada `--passo` é JavaScript avaliado NA PÁGINA, em ordem; o valor da última expressão é
 * impresso como JSON. `await` funciona. Exemplo:
 *   node tools/drive-page.mjs http://127.0.0.1:8123/ \
 *     --passo "document.querySelector('.bpmn-assist__toggle').click(); 'abriu'" \
 *     --passo "document.querySelectorAll('.bpmn-assist__panel button').length"
 *
 * ponytail: nenhuma dependência. `WebSocket` é global no Node 22+, e o CDP é JSON por um socket.
 * Instalar Playwright para clicar em dois botões seria 300 MB para uma coisa de 120 linhas.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { juntarComSilencio } from './wav-pad.mjs';

/**
 * Segundos de silêncio colados ATRÁS de toda fixture de microfone. 3 s já bastaram para o
 * servidor transcrever na medição de 2026-11-13 (`tools/medir-voz.mjs`); 4 dá folga para o
 * reamostrador e para o atraso da rede.
 */
const CAUDA_MUDA_S = 4;

/**
 * Chunk `fmt ` do WAV, lido andando pela lista de chunks (não por posição fixa).
 *
 * Existe por causa da dívida M6: o leitor de WAV do Chromium quer o `fmt ` PCM **canônico de 16
 * bytes**, e o SAPI (`tools/make-voice-fixtures.ps1`) escreve **18** — PCM com o `cbSize` da
 * extensão, que é válido e é recusado assim mesmo. Medido em 2026-11-13: `gateway.wav` tem
 * `fmt (18)`, a cópia reescrita tem `fmt (16)`.
 */
function formatoDoWav(buf) {
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const tam = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      return {
        tamanhoDoFmt: tam,
        codigo: buf.readUInt16LE(pos + 8),
        canais: buf.readUInt16LE(pos + 10),
        taxa: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    }
    pos += 8 + tam + (tam % 2);
  }
  return null;
}

/**
 * Fixture pronta para o microfone falso: cabeçalho CANÔNICO + cauda de silêncio.
 *
 * ⚠ As duas coisas são a correção da dívida M6, e a primeira é a que importa. Quando o Chromium
 * não consegue ler o arquivo ele **não reclama**: troca pelo TOM SINTÉTICO do dispositivo falso e
 * segue. Medido em 2026-11-13 com `tools/medir-microfone.mjs`, comparando o braço sem arquivo
 * nenhum com o braço com a fixture:
 *
 *   • sem arquivo (tom):   0.41 0.40 0.08 0.39 0.05 0.26 0.40 … — energia alta que NUNCA cala
 *   • com a fixture lida:  0.33 0.16 0.16 0.14 0.16 0.01 0 0 0 … — fala e depois silêncio
 *
 * O tom tem energia de verdade, então todo medidor que olha só o nível diz "o microfone ouviu" —
 * foi assim que o pico 0,574 da bateria virou "o servidor está mudo" por três dias. E o Gemini
 * não transcreve tom nem vê fim de fala: a sessão sobe 879 quadros para um turno que não fecha.
 *
 * Reescrever pelo nosso próprio escritor resolve pela raiz (o `fmt ` sai com 16 bytes) e ainda
 * dá a pausa que o VAD do servidor usa para fechar o turno. Mora aqui, e não em cada cenário,
 * porque quem tem o contrato do microfone falso é esta função.
 */
function fixtureDoMicrofone(wavAbs, segundos) {
  const destino = `${process.env.TEMP ?? '/tmp'}/bpmn-mic-${segundos}s-${wavAbs.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
  if (!existsSync(destino)) writeFileSync(destino, juntarComSilencio([wavAbs, segundos]).wav);
  return destino;
}

/**
 * Recusa NOMEADA em vez de medição silenciosa em cima do tom sintético. Chamado sempre, inclusive
 * quando alguém passar um caminho cru por atalho: o modo de falha que esta dívida custou foi
 * exatamente "parece que funcionou".
 */
function exigirFixtureLegivel(wavAbs) {
  const f = formatoDoWav(readFileSync(wavAbs));
  if (!f) throw new Error(`${wavAbs}: sem chunk fmt — o Chromium cairia no tom sintetico`);
  if (f.tamanhoDoFmt !== 16 || f.codigo !== 1 || f.bits !== 16) {
    throw new Error(
      `${wavAbs}: fmt(${f.tamanhoDoFmt}) codigo=${f.codigo} bits=${f.bits} — o microfone falso do `
      + 'Chromium recusa isto e troca pelo TOM SINTETICO sem avisar (divida M6). Reescreva pelo '
      + 'juntarComSilencio (fmt canonico de 16 bytes) antes de passar para --use-file-for-fake-audio-capture.',
    );
  }
  return f;
}

const NAVEGADORES = [
  process.env.BPMN_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function acharNavegador() {
  const achado = NAVEGADORES.find((p) => existsSync(p));
  if (!achado) throw new Error(`nenhum navegador encontrado. Tente BPMN_BROWSER=<caminho>. Procurei em:\n  ${NAVEGADORES.join('\n  ')}`);
  return achado;
}

/**
 * Espera o endpoint de depuração responder. Sem isto, a primeira conexão cai em ECONNREFUSED.
 *
 * ⚠ Cada tentativa tem PRAZO PRÓPRIO, e isso não é zelo: uma porta que ACEITA a conexão e nunca
 * responde (um Edge zumbi de uma corrida anterior segurando a mesma porta) prende o `await` para
 * sempre — e o `while (Date.now() < fim)` nem chega a reavaliar a condição. Foi assim que duas
 * corridas ao vivo do acervo ficaram ~30 e ~50 minutos vivas com menos de 1 s de CPU, parecendo
 * que estavam trabalhando (2026-11-15).
 */
/**
 * Prazo para o navegador abrir a porta. **Maior na esteira**, e isso tem uma consequência medida.
 *
 * ⚠ Incidente 2026-11-17: o passo `Screen battery (no quota)` do CI reprovou com *"o navegador nao
 * abriu a porta de depuracao 9632 em 15000ms"* — no **vigésimo quinto** cenário, depois de 24
 * navegadores terem subido na mesma corrida. Não foi defeito do produto nem do instrumento: foi um
 * runner sob carga demorando mais que o prazo local.
 *
 * E o preço não foi um vermelho: o job de **deploy depende do build**, então o site publicado
 * ficou parado no commit anterior **o dia inteiro**, enquanto o repositório tinha o conserto. Um
 * teto curto demais no instrumento não "pega um defeito antes" — ele para a publicação por um
 * motivo que não é do código. Local continua curto de propósito (15 s): aqui, porta que não abre
 * rápido é Edge zumbi de outra corrida, e esperar 45 s por ele é esconder o problema.
 */
const PRAZO_DEVTOOLS_MS = process.env.CI ? 45000 : 15000;

async function esperarDevTools(porta, prazoMs = PRAZO_DEVTOOLS_MS) {
  const fim = Date.now() + prazoMs;
  while (Date.now() < fim) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return await r.json();
    } catch { /* ainda subindo, ou porta tomada por um zumbi */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`o navegador nao abriu a porta de depuracao ${porta} em ${prazoMs}ms`);
}

/**
 * Teto de UMA chamada CDP. Generoso de propósito: um `Runtime.evaluate` com `awaitPromise` espera
 * a conversa inteira de um cenário ao vivo (até ~60 s só de resposta do modelo).
 *
 * ⚠ O que ele impede é a espera INFINITA, que já aconteceu: duas corridas concorrentes caem na
 * mesma porta de depuração (`9335 + pid % 400`), uma derruba a aba da outra, e a promessa da
 * chamada em voo nunca resolve — o processo fica vivo, com 0,8 s de CPU em 50 minutos, parecendo
 * que está trabalhando. Medido em 2026-11-15, na corrida ao vivo do acervo dourado.
 */
const TETO_DA_CHAMADA_MS = 180000;

/** Cliente CDP minúsculo: um socket, um contador de id, uma tabela de promessas. */
export function cdp(url) {
  const ws = new WebSocket(url);
  const pendentes = new Map();
  const eventos = [];
  let proximo = 1;

  const pronto = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', (e) => reject(new Error(`socket CDP falhou: ${e?.message ?? 'sem detalhe'}`)));
  });

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve, reject } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    eventos.push(msg);
  });

  return {
    pronto,
    eventos,
    async envia(method, params = {}, { tetoMs = TETO_DA_CHAMADA_MS } = {}) {
      await pronto;
      const id = proximo++;
      return new Promise((resolve, reject) => {
        const relogio = setTimeout(() => {
          if (!pendentes.has(id)) return;
          pendentes.delete(id);
          // Erro NOMEADO: "a aba sumiu" e "o passo demorou" são coisas diferentes, e quem lê o
          // relatório precisa saber qual foi.
          reject(new Error(`CDP sem resposta em ${Math.round(tetoMs / 1000)}s: ${method} (a aba pode ter sido derrubada por outra corrida)`));
        }, tetoMs);
        relogio?.unref?.();
        pendentes.set(id, {
          resolve: (v) => { clearTimeout(relogio); resolve(v); },
          reject: (e) => { clearTimeout(relogio); reject(e); },
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    fecha() { try { ws.close(); } catch { /* já fechado */ } },
  };
}

function parseArgs(argv) {
  const out = { url: null, passos: [], shot: null, espera: 2500, largura: 1280, altura: 860, mic: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--passo') out.passos.push(argv[++i]);
    else if (a === '--shot') out.shot = argv[++i];
    else if (a === '--espera') out.espera = Number(argv[++i]);
    else if (a === '--janela') { const [w, h] = argv[++i].split('x').map(Number); out.largura = w; out.altura = h; }
    else if (a === '--mic') out.mic = argv[++i];
    else if (!out.url) out.url = a;
  }
  if (!out.url) throw new Error('faltou a URL. Uso: node tools/drive-page.mjs <url> [--passo "<js>"]...');
  return out;
}

/**
 * Porta de depuracao DIFERENTE por processo. Com porta fixa, duas baterias ao mesmo tempo
 * (aconteceu em 2026-11-12: uma contra a URL publica, outra local) disputam a mesma instancia e
 * a segunda derruba a primeira - o sintoma e `Inspected target navigated or closed (-32000)` no
 * meio de um cenario, que parece defeito do produto e e colisao de porta.
 */
const PORTA_PADRAO = 9335 + (process.pid % 400);

/**
 * Mata o navegador DESTA corrida, pelo caminho do perfil (que é único por lançamento).
 *
 * `filho.kill()` sozinho não basta: o Edge re-executa e deixa um enxame de processos vivos que
 * não são filhos do que lançamos. Medido em 2026-11-13, no meio da dívida M6: **1305 `msedge.exe`
 * vivos** com a marca `bpmn-drive-` neste PC, acumulados corrida após corrida. Isso não é só lixo
 * — é o principal suspeito da intermitência que sustentou a dívida: com o PC nesse estado, três
 * capturas idênticas seguidas deram TOM, FALA, FALA (`tools/provar-captura.mjs`), ou seja, o
 * microfone falso às vezes simplesmente não toca o arquivo.
 *
 * O filtro é o PERFIL, nunca o nome do processo: o dono tem o Edge dele aberto (41 processos na
 * mesma medição) e matar por nome fecharia o navegador dele.
 */
function encerrarNavegador(perfil) {
  if (process.platform !== 'win32') return;
  const alvo = perfil.replace(/\\/g, '/');
  spawnSync('powershell', [
    '-NoProfile', '-Command',
    'Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\' or Name=\'chrome.exe\'" '
    + `| Where-Object { $_.CommandLine -like '*${alvo.split('/').pop()}*' } `
    + '| ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue } catch { } }',
  ], { stdio: 'ignore', timeout: 20000 });
}

/** A pasta de perfis efemeros: `%TEMP%`, onde o nome comeca com o prefixo da ferramenta. */
const TEMP = process.env.TEMP ?? '/tmp';

/**
 * APAGA o perfil da corrida. Sem isto, cada corrida deixa ~43 MB em `%TEMP%` para sempre.
 *
 * ⚠ Isto nao e' zelo: em 16/11/2026 eram **1.464 pastas `bpmn-drive-*`, 62,6 GB**, com o disco
 * do dono quase cheio. O perfil NOVO a cada corrida esta certo (o comentario do `--user-data-dir`
 * diz por que), mas quem cria o efemero e' quem o apaga.
 *
 * O retry existe porque o Edge solta os arquivos alguns milissegundos DEPOIS do kill: apagar na
 * hora falha com EBUSY e deixa a pasta inteira.
 */
function apagarPerfil(perfil) {
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    // Perfil preso e' lixo de 43 MB, nunca motivo para derrubar a corrida que ja terminou.
  }
}

/**
 * VARRE os perfis que ficaram de corridas mortas (Ctrl-C, timeout, crash) -- onde o `finally`
 * nunca rodou. Idade minima de uma hora, para nunca alcancar uma corrida em paralelo.
 */
function varrerPerfisVelhos(prefixo = 'bpmn-drive-', horas = 1) {
  const limite = Date.now() - horas * 3600_000;
  let apagados = 0;
  let bytes = 0;
  try {
    for (const nome of readdirSync(TEMP)) {
      if (!nome.startsWith(prefixo)) continue;
      const caminho = `${TEMP}/${nome}`;
      try {
        const st = statSync(caminho);
        if (!st.isDirectory() || st.mtimeMs > limite) continue;
        // ⚠ Idade NAO basta: uma corrida longa (bateria ao vivo leva minutos) tem perfil antigo
        // e navegador vivo. O dono do perfil e' quem o tem na linha de comando -- o mesmo filtro
        // do `encerrarNavegador`, usado aqui ao contrario: para NAO apagar.
        if (navegadorVivoCom(nome)) continue;
        rmSync(caminho, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        apagados += 1;
        bytes += st.size;
      } catch {
        // Pasta de outro usuario, ou que sumiu no meio: segue.
      }
    }
  } catch {
    // Sem TEMP legivel nao ha faxina, e isso nunca impede a corrida.
  }
  return { apagados, bytes };
}

/** Ha' navegador vivo com este perfil na linha de comando? (So Windows; fora dele, conservador.) */
function navegadorVivoCom(nome) {
  if (process.platform !== 'win32') return true;
  const r = spawnSync('powershell', [
    '-NoProfile', '-Command',
    'Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\' or Name=\'chrome.exe\'" '
    + `| Where-Object { $_.CommandLine -like '*${nome}*' } | Measure-Object | Select-Object -Expand Count`,
  ], { encoding: 'utf8', timeout: 20000 });
  // Falha da consulta nao autoriza apagar: no escuro, preserva.
  if (r.status !== 0) return true;
  return Number(String(r.stdout).trim()) > 0;
}

/**
 * FILMAR a corrida: um quadro a cada `intervaloMs` enquanto os passos rodam.
 *
 * Por que existe: prova de comportamento em texto e' leitura; o dono (e a banca) precisam VER a
 * conversa acontecendo — o microfone abrindo, a pergunta aparecendo, o elemento sumindo. Nao ha
 * ffmpeg nesta maquina, entao o "video" e' uma sequencia de quadros com carimbo de tempo, que o
 * `tools/video-prova.mjs` monta num reprodutor HTML que toca sozinho.
 *
 * JPEG e qualidade modesta de proposito: sao centenas de quadros, e o que se precisa enxergar e'
 * o painel e o desenho, nao o antialias da fonte.
 */
function comecarAFilmar(c, filme) {
  const { pasta, intervaloMs = 700, qualidade = 55 } = filme;
  mkdirSync(pasta, { recursive: true });
  const quadros = [];
  const t0 = Date.now();
  let ocupado = false;
  const relogio = setInterval(async () => {
    // Sem reentrancia: uma captura lenta nao pode enfileirar outra em cima.
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await c.envia('Page.captureScreenshot', { format: 'jpeg', quality: qualidade });
      const nome = `quadro-${String(quadros.length + 1).padStart(4, '0')}.jpg`;
      writeFileSync(resolve(pasta, nome), Buffer.from(r.data, 'base64'));
      quadros.push({ arquivo: nome, ms: Date.now() - t0 });
    } catch {
      // Aba ocupada ou navegando: um quadro perdido nao derruba a corrida.
    } finally {
      ocupado = false;
    }
  }, intervaloMs);
  relogio?.unref?.();
  return { quadros, t0, parar() { clearInterval(relogio); return quadros; } };
}

export async function dirigir({ url, passos = [], shot = null, espera = 2500, porta = PORTA_PADRAO, largura = 1280, altura = 860, mic = null, micEmLaco = false, micSemCauda = false, headless = true, filme = null, onPasso = null } = {}) {
  const exe = acharNavegador();
  // WAV como MICROFONE. A flag faz o getUserMedia devolver o arquivo em vez do tom sintetico,
  // entao o caminho do microfone roda inteiro (worklet, reamostragem, PCM16, socket) com fala
  // de verdade. Os WAVs saem de `tools/make-voice-fixtures.ps1` (SAPI pt-BR, 16 kHz mono) — a
  // mesma tecnica dos laboratorios de voz do CopilotSpeaker.
  const micAbs = mic ? resolve(mic) : null;
  if (micAbs && !existsSync(micAbs)) throw new Error(`WAV de microfone nao encontrado: ${micAbs}`);
  // CAUDA DE SILENCIO — a correção da dívida M6, medida em 2026-11-13.
  //
  // `%noloop` NÃO é honrado por este navegador: medido com `tools/medir-microfone.mjs`, um WAV de
  // 5,9 s produziu 20 s de energia contínua COM o sufixo aplicado, repetindo o mesmo padrão. E
  // microfone que nunca cala é turno que o VAD do servidor nunca fecha: a sessão sobe 879 quadros
  // e o servidor não transcreve nada — exatamente o sintoma que passou dias sendo lido como cota.
  // O `tools/medir-voz.mjs` provou o outro lado no mesmo dia: a MESMA fala, com 3 s de silêncio
  // atrás, foi transcrita nos quatro braços do 2×2.
  //
  // Então o silêncio não vem da flag, vem do ARQUIVO: toda fixture roda com uma cauda muda, e o
  // seam do laço vira uma pausa de verdade. Fica aqui, e não em cada cenário, porque quem tem o
  // contrato do microfone falso é esta função — cenário novo não pode precisar lembrar disto.
  const micParaOChromium = micAbs && !micSemCauda ? fixtureDoMicrofone(micAbs, CAUDA_MUDA_S) : micAbs;
  if (micParaOChromium) exigirFixtureLegivel(micParaOChromium);
  // Perfil NOVO a cada corrida: um perfil compartilhado que ficou travado por uma corrida
  // anterior faz o Edge anexar na instancia velha e sair sem abrir a porta - e o sintoma e
  // "o navegador nao abriu a porta", que parece problema de rede e e lixo de disco.
  // Faxina ANTES de criar o proximo: cobre a corrida que morreu sem rodar o `finally`.
  varrerPerfisVelhos();
  const perfil = `${TEMP}/bpmn-drive-${porta}-${process.pid}-${Date.now()}`;
  /**
   * Bandeiras EXTRAS do navegador, por ambiente (`BPMN_BROWSER_FLAGS`, separadas por espaco).
   *
   * Existe pelo CI: no runner Ubuntu 24.04 o sandbox do Chrome depende de user namespace sem
   * privilegio, que o AppArmor de la' restringe — o navegador morre antes de abrir a porta e o
   * sintoma e' "nenhum navegador abriu a porta", que parece falta de Chrome e e' politica do
   * sistema. O workflow passa `--no-sandbox`; nesta maquina a variavel nao existe e nada muda.
   */
  const extras = String(process.env.BPMN_BROWSER_FLAGS ?? '').split(' ').map((f) => f.trim()).filter(Boolean);
  const filho = spawn(exe, [
    ...(headless ? ['--headless=new'] : []),
    ...extras,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    // Microfone e camera SINTETICOS do proprio Chromium: getUserMedia devolve audio de verdade
    // (um tom), que passa pelo worklet de captura real. Sem isto nao ha como provar o caminho do
    // microfone sem uma pessoa falando.
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    // `%noloop`: sem ele o Chromium repete o WAV sem parar, e o VAD do servidor nunca ve o
    // silencio que FECHA o turno — a fala ficaria eternamente "em andamento".
    ...(micParaOChromium ? [`--use-file-for-fake-audio-capture=${micParaOChromium}${micEmLaco ? '' : '%noloop'}`] : []),
    `--window-size=${largura},${altura}`,
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`,
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  const saida = { url, mic: micAbs, console: [], excecoes: [], passos: [], shot: null, filme: null };

  try {
    await esperarDevTools(porta);
    // Com teto também: um navegador meio morto aceita a conexão e nunca responde.
    const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`, { signal: AbortSignal.timeout(10000) })).json();
    const pagina = alvos.find((t) => t.type === 'page');
    if (!pagina) throw new Error('o navegador subiu sem nenhuma aba');

    const c = cdp(pagina.webSocketDebuggerUrl);
    await c.pronto;
    await c.envia('Runtime.enable');
    await c.envia('Page.enable');
    await c.envia('Log.enable');
    // Viewport por EMULACAO, nao por --window-size: a flag inclui a moldura do navegador, entao
    // pedir 375 dava ~466 de viewport e o teste de celular media a tela errada.
    await c.envia('Emulation.setDeviceMetricsOverride', {
      width: largura, height: altura, deviceScaleFactor: 1, mobile: largura < 768,
    });

    await c.envia('Page.navigate', { url });
    // Espera fixa em vez de `Page.loadEventFired`: a página monta o ajudante DEPOIS do load, e
    // esperar o evento certo para cada caso seria mais frágil que esperar um pouco.
    await new Promise((r) => setTimeout(r, espera));

    // A camera comeca ANTES do primeiro passo: o que se quer ver e' a conversa inteira, inclusive
    // o painel abrindo.
    const camera = filme ? comecarAFilmar(c, filme) : null;

    for (const passo of passos) {
      /**
       * PASSO DE CDP, e não de página: `cdp:Metodo {json}`.
       *
       * Existe para o que a página NÃO consegue fazer a si mesma — cortar a rede, por exemplo.
       * A dívida M4 ("desconexão no meio do turno nunca foi exercitada cortando a rede de
       * verdade") ficou aberta por falta deste gancho: `Network.emulateNetworkConditions` é o
       * único jeito honesto de provar reconexão e retomada sem desligar o Wi-Fi na mão.
       */
      if (typeof passo === 'string' && passo.startsWith('cdp:')) {
        const corte = passo.slice(4).trim();
        const espaco = corte.indexOf(' ');
        const metodo = espaco > 0 ? corte.slice(0, espaco) : corte;
        const params = espaco > 0 ? JSON.parse(corte.slice(espaco + 1)) : {};
        const rc = await c.envia(metodo, params);
        saida.passos.push({ passo, valor: rc ?? null, erro: null });
        continue;
      }
      const r = await c.envia('Runtime.evaluate', {
        expression: `(async () => { ${passo} })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      const resultado = {
        passo: passo.length > 90 ? `${passo.slice(0, 90)}…` : passo,
        valor: r.result?.value ?? null,
        erro: r.exceptionDetails?.exception?.description ?? r.exceptionDetails?.text ?? null,
      };
      saida.passos.push(resultado);
      // PROGRESSO NA HORA: um lote de 30 passos numa chamada só ficaria mudo por dez minutos, e
      // "saber onde parou" vale mais do que o relatório bonito no fim (que não chega, se travar).
      try { onPasso?.(resultado, saida.passos.length - 1); } catch { /* progresso nunca derruba a corrida */ }
      await new Promise((r2) => setTimeout(r2, 150));
    }

    if (camera) {
      saida.filme = { pasta: filme.pasta, quadros: camera.parar() };
    }

    if (shot) {
      const r = await c.envia('Page.captureScreenshot', { format: 'png' });
      mkdirSync(dirname(shot), { recursive: true });
      writeFileSync(shot, Buffer.from(r.data, 'base64'));
      saida.shot = shot;
    }

    /**
     * FECHA A SESSÃO ANTES DE MATAR O NAVEGADOR — e espera o quadro de fecho sair.
     *
     * Sem isto, cada corrida deixava um socket caíndo sem aviso: `filho.kill()` não dispara
     * `beforeunload`, e o servidor só libera a vaga de sessão depois de notar o fio morto. Uma
     * bateria de 33 perguntas abria 33 sessões e abandonava as 33 — e as recusas na admissão que
     * saíam disso foram lidas como cota por um dia inteiro (2026-11-15). Mora aqui, no Único lugar
     * por onde TODAS as corridas passam, e não em cada cenário.
     *
     * ponytail: melhor esforço — página sem o ajudante montado não tem o verbo, e aí não há nada
     * para fechar.
     */
    try {
      await c.envia('Runtime.evaluate', {
        expression: '(async () => { try { await window.__bpmnAssist?.encerrar?.(); } catch {} })()',
        awaitPromise: true,
      });
      await new Promise((r) => setTimeout(r, 700));
    } catch { /* aba já foi: nada a fechar */ }

    for (const ev of c.eventos) {
      if (ev.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(ev.params.type)) {
        saida.console.push({ tipo: ev.params.type, texto: ev.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ') });
      }
      if (ev.method === 'Runtime.exceptionThrown') {
        saida.excecoes.push(ev.params.exceptionDetails?.exception?.description ?? ev.params.exceptionDetails?.text ?? 'excecao sem texto');
      }
      if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') {
        saida.console.push({ tipo: 'log', texto: `${ev.params.entry.text} ${ev.params.entry.url ?? ''}`.trim() });
      }
    }

    c.fecha();
  } finally {
    try { filho.kill(); } catch { /* já morreu */ }
    encerrarNavegador(perfil);
    apagarPerfil(perfil);
  }

  return saida;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  dirigir(args).then((r) => {
    console.log(JSON.stringify(r, null, 2));
    const ruim = r.excecoes.length || r.passos.some((p) => p.erro);
    process.exit(ruim ? 1 : 0);
  }).catch((err) => {
    console.error(String(err?.stack ?? err));
    process.exit(2);
  });
}
