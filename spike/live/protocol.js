// Protocolo do Gemini Live (BidiGenerateContent) — PURO: só monta e interpreta frames JSON.
// Nenhum WebSocket, nenhum AudioContext, nenhum DOM. É o que o CI consegue testar sem chave e
// sem rede (openspec design D7).
//
// Os três fatos do fio que moldam este arquivo, com a fonte:
//
//  1. `gemini-3.8-live` RECUSA `responseModalities: ["TEXT"]` e fecha o socket com 1007.
//     Medido no CopilotSpeaker em 2026-09-17 (GeminiLiveBrainProvider.cs:12-13; o cabeçalho de
//     GeminiLiveSetup.cs é explícito: "nunca pedir TEXT"). Então o setup pede AUDIO SEMPRE, e o
//     texto final sai pelos ARGUMENTOS de uma função declarada.
//  2. Entrada textual em sessão viva vai por `realtimeInput.text`; histórico, por `clientContent`
//     sem fechar o turno (GeminiLiveBrainProvider.cs:696-731).
//  3. Todo `toolCall` PRECISA de `toolResponse`. Sem ela o turno do modelo fica pendurado e o
//     pedido seguinte cai no meio dele (GeminiLiveBrainSession.cs:10,277).
//
// ponytail: um módulo de funções puras em vez de uma classe de protocolo. O estado é da sessão,
// não do protocolo.

export const WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export const MODEL = 'gemini-3.8-live';

/** Nome da função por onde a resposta TEXTUAL volta (fato 1). */
export const DELIVERY_TOOL = 'entregar_resposta';

export const CAPTURE_RATE = 16000;   // aba -> Live
export const PLAYBACK_RATE = 24000;  // Live -> aba

export const SYSTEM_INSTRUCTION = [
  'Você é um assistente especialista em BPMN 2.0 embutido num modelador e visualizador de',
  'diagramas. Responda em português do Brasil, de forma curta e direta, sobre notação BPMN:',
  'eventos, atividades, gateways, pools, lanes, fluxo de mensagem, fluxo de sequência e boas',
  'práticas de modelagem. Se a pergunta não for sobre BPMN nem sobre o diagrama, diga isso em',
  'uma frase.',
  '',
  `IMPORTANTE: ao terminar de responder, chame a função ${DELIVERY_TOOL} com o texto completo da`,
  'sua resposta no campo "texto". A fala é para quem ouve; a função é para quem lê.',
].join(' ');

/** URL do socket. A chave vai na query string — é o contrato do Live, não escolha nossa. */
export function socketUrl(apiKey, base = WS_BASE) {
  if (!apiKey) throw new Error('sem credencial: a chave do aluno é obrigatória');
  return `${base}?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Frame de `setup`. `modalities` existe SÓ para a prova de incompatibilidade: pedir `['TEXT']` de
 * propósito e registrar o 1007 com medição própria (openspec spec, cenário "Saída TEXT é
 * incompatível e isso é medido"). Em uso normal não se passa nada.
 */
export function buildSetup({
  model = MODEL,
  systemInstruction = SYSTEM_INSTRUCTION,
  voiceName = 'Aoede',
  modalities = ['AUDIO'],
  withDeliveryTool = true,
} = {}) {
  const setup = {
    model: `models/${model}`,
    generationConfig: {
      responseModalities: modalities,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      // languageCode OMITIDO de propósito: o native-audio detecta sozinho, e mandar locale
      // enviesa a resposta para o inglês (mesmo racional do GeminiLiveSetup.cs do CopilotSpeaker).
    },
    systemInstruction: { parts: [{ text: systemInstruction }] },
    // As duas transcrições: a de entrada é o que o aluno falou; a de saída é a legenda do modelo
    // e o fallback quando o turno termina sem chamada de entrega.
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };

  if (withDeliveryTool) {
    setup.tools = [{
      functionDeclarations: [{
        name: DELIVERY_TOOL,
        description: 'Entrega a resposta final em texto, para exibir ao aluno.',
        parameters: {
          type: 'object',
          properties: { texto: { type: 'string', description: 'A resposta completa, em texto.' } },
          required: ['texto'],
        },
      }],
    }];
  }

  return { setup };
}

/** Pergunta digitada numa sessão viva (fato 2). */
export function buildTextTurn(text) {
  return { realtimeInput: { text: String(text ?? '') } };
}

/** Quadro de áudio do microfone. `pcm16Base64` = PCM16 mono 16 kHz em base64. */
export function buildAudioChunk(pcm16Base64) {
  return {
    realtimeInput: {
      mediaChunks: [{ mimeType: `audio/pcm;rate=${CAPTURE_RATE}`, data: pcm16Base64 }],
    },
  };
}

/** Histórico semeado sem fechar o turno (fato 2). `turns` = [{role, text}]. */
export function buildHistory(turns) {
  return {
    clientContent: {
      turns: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      turnComplete: false,
    },
  };
}

/** Resposta obrigatória a um `toolCall` (fato 3). */
export function buildToolResponse(calls) {
  return {
    toolResponse: {
      functionResponses: calls.map((c) => ({
        id: c.id,
        name: c.name,
        response: { ok: true },
      })),
    },
  };
}

/**
 * Lê um frame do servidor e devolve o que ele significa, sem interpretar estado.
 *
 * `{ kind: 'ready' }`                  setup aceito
 * `{ kind: 'audio', pcm16Base64 }`     áudio do modelo (24 kHz)
 * `{ kind: 'input-text', text }`       transcrição do que o aluno falou
 * `{ kind: 'output-text', text }`      legenda do que o modelo falou (fallback de texto)
 * `{ kind: 'tool-call', calls }`       chamadas de função; `delivery` traz o texto da entrega
 * `{ kind: 'interrupted' }`            o modelo foi cortado — descartar o buffer de reprodução
 * `{ kind: 'turn-complete', idle }`    fim do turno; `idle=false` = só o enchimento (ver abaixo)
 * `{ kind: 'go-away', timeLeft }`      o servidor vai desconectar
 * `{ kind: 'unknown', raw }`           qualquer outra coisa — nunca engolida em silêncio
 *
 * Sobre `idle`: no modo Extended, `turnComplete` com `interactionStatus: IN_PROGRESS` fecha só o
 * enchimento ("vou pensar…"); o trabalho real chega numa geração nova e o fim de verdade é o
 * `IDLE` (GeminiLiveBrainProvider.cs:17,457-461).
 */
export function parseServerFrame(raw) {
  let message;
  try {
    message = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { kind: 'unknown', raw };
  }
  if (!message || typeof message !== 'object') return { kind: 'unknown', raw };

  if (message.setupComplete) return { kind: 'ready' };

  if (message.goAway) {
    return { kind: 'go-away', timeLeft: message.goAway.timeLeft ?? null };
  }

  if (Array.isArray(message.toolCall?.functionCalls) && message.toolCall.functionCalls.length) {
    const calls = message.toolCall.functionCalls.map((c) => ({
      id: c.id ?? null,
      name: c.name,
      args: c.args ?? {},
    }));
    const hit = calls.find((c) => c.name === DELIVERY_TOOL);
    return { kind: 'tool-call', calls, delivery: hit ? deliveryText(hit.args) : null };
  }

  const content = message.serverContent;
  if (content) {
    if (content.interrupted) return { kind: 'interrupted' };

    const inline = content.modelTurn?.parts?.find((p) => p.inlineData?.data);
    if (inline) return { kind: 'audio', pcm16Base64: inline.inlineData.data };

    if (content.inputTranscription?.text) {
      return { kind: 'input-text', text: content.inputTranscription.text };
    }
    if (content.outputTranscription?.text) {
      return { kind: 'output-text', text: content.outputTranscription.text };
    }

    const status = content.interactionStatus ?? message.interactionStatus ?? null;
    if (content.turnComplete === true || content.generationComplete === true) {
      // IN_PROGRESS = ainda vem coisa. Qualquer outro valor (ou nenhum) = terminou de verdade.
      return { kind: 'turn-complete', idle: status !== 'IN_PROGRESS', status };
    }
    if (status === 'IDLE') return { kind: 'turn-complete', idle: true, status };
  }

  return { kind: 'unknown', raw: message };
}

/** Texto da entrega. Aceita `{texto}` e `{text}`, e um objeto inteiro como último recurso. */
function deliveryText(args) {
  if (typeof args?.texto === 'string') return args.texto;
  if (typeof args?.text === 'string') return args.text;
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args);
  } catch {
    return '';
  }
}
