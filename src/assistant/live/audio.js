// Ciclo de vida do áudio no navegador: quem abre o microfone, quem toca o que volta, e sobretudo
// quem FECHA. Microfone que fica aberto é o defeito que o usuário percebe como "o site está me
// ouvindo" — por isso `stop()` libera na ordem certa e é idempotente.
//
// DOIS contextos de propósito, não um: a captura é 16 kHz e a reprodução 24 kHz (contrato do
// Live). Um contexto só, na taxa do dispositivo, é o erro clássico que faz um dos lados sair
// acelerado ou arrastado.
//
// `getUserMedia` SÓ por gesto explícito e SÓ em contexto seguro (https: ou localhost): o
// verificador está em `assertSecureContext`, chamado antes de qualquer pedido de permissão.

import { CAPTURE_RATE, PLAYBACK_RATE } from './protocol.js';
import { base64ToPcm16, pcm16ToBase64 } from './pcm.js';

const CAPTURE_WORKLET = new URL('./capture-worklet.js', import.meta.url).href;
const PLAYBACK_WORKLET = new URL('./playback-worklet.js', import.meta.url).href;

/** Lança com razão NOMEADA quando o navegador não pode nem pedir microfone. */
export function assertSecureContext(win = globalThis) {
  const host = win.location?.hostname ?? '';
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  if (!win.isSecureContext && !local) {
    const err = new Error('getUserMedia exige https: ou localhost');
    err.reason = 'insecure-context';
    throw err;
  }
  if (!win.navigator?.mediaDevices?.getUserMedia || !win.AudioWorkletNode) {
    const err = new Error('navegador sem getUserMedia ou sem AudioWorklet');
    err.reason = 'unsupported';
    throw err;
  }
}

/**
 * Nível do quadro, 0..1, para o indicador de escuta.
 *
 * RMS, não pico: pico pisca com um estalo e fica pregado em 1; RMS acompanha a voz. A raiz no
 * fim é o que faz a barra ter movimento visível na faixa em que a fala realmente vive — sem ela
 * a conversa normal mal sai do chão da barra.
 */
export function nivelDoQuadro(pcm) {
  if (!pcm?.length) return 0;
  let soma = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768;
    soma += v * v;
  }
  return Math.min(1, Math.sqrt(Math.sqrt(soma / pcm.length)));
}

/**
 * RMS do quadro, 0..1 — a energia CRUA, sem a raiz cosmética do indicador.
 *
 * Existe separado de `nivelDoQuadro` porque servem a coisas diferentes: aquele é para a BARRA
 * (tem duas raízes para dar movimento visível), este é para DECIDIR. Comparar limiar contra um
 * número maquiado para a vista é como a dívida M6 começou — medir uma coisa e concluir outra.
 */
export function rmsDoQuadro(pcm) {
  if (!pcm?.length) return 0;
  let soma = 0;
  for (let i = 0; i < pcm.length; i++) { const v = pcm[i] / 32768; soma += v * v; }
  return Math.sqrt(soma / pcm.length);
}

/**
 * Limiar de FALA sobre a resposta do modelo, em RMS normalizado.
 *
 * 900 na escala PCM16 (≈ 0,0275 aqui) é o valor que a `WikiAgentCapsule` usa há meses para separar
 * voz de ruído de sala enquanto o modelo fala. Baixo demais e o ventilador corta o ajudante; alto
 * demais e o aluno precisa gritar para ser ouvido por cima.
 */
export const RMS_DE_FALA = 900 / 32768;

/**
 * Decide se o aluno está falando POR CIMA — a decisão de barge-in, isolada e pura.
 *
 * Mora aqui, e não dentro do consumidor, porque limiar é coisa que se prova com números e não com
 * sessão ao vivo: `quadro(rms)` devolve `true` UMA vez, no quadro em que a fala se confirma.
 *
 * Exige quadros SEGUIDOS acima do limiar porque um estalo não é uma interrupção — e porque o
 * caminho de captura tem supressão de ruído, que deixa picos curtos passarem.
 */
export function criarDetectorDeFala({ limiar = RMS_DE_FALA, quadros = 3 } = {}) {
  let acima = 0;
  return {
    /** `true` no quadro em que a fala se confirma; depois disso, só de novo após um silêncio. */
    quadro(rms) {
      if (!(rms > limiar)) { acima = 0; return false; }
      acima++;
      if (acima !== quadros) return false;
      return true;
    },
    /** Zera a contagem — ao fechar o microfone ou ao trocar de turno. */
    reiniciar() { acima = 0; },
    get quadrosAcima() { return acima; },
  };
}

/**
 * Abre o microfone e chama `onFrame(base64, frames, rms)` a cada 40 ms de PCM16 16 kHz.
 * `onLevel(0..1)` acompanha cada quadro: é o que a UI usa para provar ao aluno que ESTÁ ouvindo
 * — sem isso, microfone aberto e microfone mudo são a mesma tela.
 * Só chamar a partir de um handler de gesto do usuário.
 */
export async function startCapture({ onFrame, onLevel, onError } = {}) {
  assertSecureContext();

  let stream = null;
  let context = null;
  let source = null;
  let node = null;
  let stopped = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    // Ordem importa: parar as tracks PRIMEIRO apaga o indicador do navegador na hora.
    for (const track of stream?.getTracks() ?? []) {
      try { track.stop(); } catch { /* já encerrada */ }
    }
    try { node?.disconnect(); } catch { /* já desconectado */ }
    try { source?.disconnect(); } catch { /* já desconectado */ }
    try { node?.port.close(); } catch { /* já fechada */ }
    try { await context?.close(); } catch { /* já fechado */ }
    stream = context = source = node = null;
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });

    context = new AudioContext();
    await context.audioWorklet.addModule(CAPTURE_WORKLET);
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, 'bpmn-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: { rate: CAPTURE_RATE, frameMs: 40 },
    });
    node.port.onmessage = (e) => {
      if (e.data?.type !== 'pcm') return;
      try {
        const pcm = new Int16Array(e.data.pcm);
        onLevel?.(nivelDoQuadro(pcm));
        // O RMS cru vai JUNTO do quadro: quem decide barge-in precisa da energia, não da barra.
        onFrame?.(pcm16ToBase64(pcm), e.data.frames, rmsDoQuadro(pcm));
      } catch (err) {
        onError?.(err);
      }
    };
    source.connect(node);
    return { stop, sampleRate: context.sampleRate };
  } catch (err) {
    await stop();
    // NotAllowedError é o usuário dizendo não — é estado, não bug.
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') err.reason = 'mic-denied';
    else if (err?.name === 'NotFoundError') err.reason = 'no-mic';
    throw err;
  }
}

/** Reprodução do áudio do modelo. `resume()` é necessário porque a aba pode começar suspensa. */
export async function startPlayback({ onAudible, onStats } = {}) {
  const context = new AudioContext();
  await context.audioWorklet.addModule(PLAYBACK_WORKLET);
  const node = new AudioWorkletNode(context, 'bpmn-playback', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    // 240 ms de partida / 120 ms de recuperação: ver o cabeçalho do worklet. A latência extra
    // até a primeira palavra é o preço de não travar no meio da frase.
    processorOptions: { sourceRate: PLAYBACK_RATE, primeMs: 240, rePrimeMs: 120 },
  });
  node.port.onmessage = (e) => {
    if (e.data?.type === 'audible') onAudible?.(e.data.id);
    else if (e.data?.type === 'stats') onStats?.(e.data);
  };
  node.connect(context.destination);

  let stopped = false;
  return {
    /** Empurra um quadro base64 vindo do Live. Transfere o buffer: zero cópia extra. */
    push(pcm16Base64, markId) {
      if (stopped) return;
      const pcm = base64ToPcm16(pcm16Base64);
      if (markId !== undefined) node.port.postMessage({ type: 'mark', id: markId });
      node.port.postMessage({ type: 'pcm', pcm: pcm.buffer }, [pcm.buffer]);
    },
    /** Cancelamento / barge-in: descarta o que não saiu ainda. */
    flush() {
      if (!stopped) node.port.postMessage({ type: 'flush' });
    },
    stats() {
      if (!stopped) node.port.postMessage({ type: 'stats' });
    },
    resume() {
      return context.state === 'suspended' ? context.resume() : Promise.resolve();
    },
    get state() {
      return context.state;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      try { node.disconnect(); } catch { /* já desconectado */ }
      try { node.port.close(); } catch { /* já fechada */ }
      try { await context.close(); } catch { /* já fechado */ }
    },
  };
}
