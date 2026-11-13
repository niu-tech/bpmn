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

// ⚠ O PROMPT NÃO MORA MAIS AQUI. Até 2026-11-12 este arquivo tinha `SYSTEM_INSTRUCTION` e
// `DELIVERY_INSTRUCTION`, e `buildSetup` anexava a segunda quando o prompt recebido era
// **exatamente** igual à primeira. Era uma comparação por identidade de constante: qualquer
// prompt novo perdia a instrução de entrega em silêncio, e o sintoma é o ajudante mudo no modo
// texto. O prompt virou contrato de seções em `agent/sections.js` + `agent/render.js`; este
// arquivo volta a ser só protocolo (openspec design H1, fase F2).

/** URL do socket. A chave vai na query string — é o contrato do Live, não escolha nossa. */
export function socketUrl(apiKey, base = WS_BASE) {
  if (!apiKey) throw new Error('sem credencial: a chave do aluno é obrigatória');
  return `${base}?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Frame de `setup`.
 *
 * ⚠ `withDeliveryTool` é a ESCOLHA DE MODO, medida ao vivo em 2026-11-10 (três sessões reais
 * contra `gemini-3.8-live`):
 *
 *   • COM a função declarada: o modelo **não fala**. Foi direto ao `toolCall` e a sessão
 *     inteira teve **0 frames de áudio**. Ótimo para o chat digitado: texto exato, sem gastar
 *     token de áudio.
 *   • SEM a função: o modelo fala — 29 frames de `audio/pcm;rate=24000` — e manda
 *     `outputTranscription` junto, que é a legenda. É o modo de VOZ.
 *
 * Ou seja, não dá para ter fala e entrega estruturada no mesmo turno: é um ou outro. O desenho
 * anterior declarava a função sempre e teria deixado o ajudante **mudo**, o que só apareceria
 * quando alguém apertasse o microfone.
 *
 * `modalities` existe SÓ para a prova de incompatibilidade: pedir `['TEXT']` de propósito e
 * registrar o 1007 com medição própria. Em uso normal não se passa nada.
 *
 * `systemInstruction` é OBRIGATÓRIO e usado verbatim — sem default e sem anexo surpresa. Quem
 * monta o prompt é `agent/render.js` (`promptDoPerfil`), que decide o perfil e a declaração da
 * função na MESMA chamada. Protocolo não opina sobre prosa.
 */
export function buildSetup({
  model = MODEL,
  systemInstruction,
  voiceName = 'Aoede',
  modalities = ['AUDIO'],
  withDeliveryTool = true,
  /**
   * Declarações de ferramenta do catálogo (`agent/catalog.js`). Entram no MESMO bloco
   * `functionDeclarations` da entrega — o Live aceita uma lista, e separá-las em dois objetos
   * `tools` faria o servidor considerar só o primeiro.
   */
  ferramentas = [],
} = {}) {
  if (typeof systemInstruction !== 'string' || !systemInstruction.trim()) {
    throw new Error('sem prompt: monte com agent/render.js (promptDoPerfil) antes de abrir a sessão');
  }
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

  const declaracoes = [];
  if (withDeliveryTool) {
    declaracoes.push({
      name: DELIVERY_TOOL,
      description: 'Entrega a resposta final em texto, para exibir ao aluno.',
      parameters: {
        type: 'object',
        properties: { texto: { type: 'string', description: 'A resposta completa, em texto.' } },
        required: ['texto'],
      },
    });
  }
  for (const f of ferramentas) if (f?.name) declaracoes.push(f);
  if (declaracoes.length) setup.tools = [{ functionDeclarations: declaracoes }];

  return { setup };
}

/** Pergunta digitada numa sessão viva (fato 2). */
export function buildTextTurn(text) {
  return { realtimeInput: { text: String(text ?? '') } };
}

/**
 * Quadro de áudio do microfone. `pcm16Base64` = PCM16 mono 16 kHz em base64.
 *
 * ⚠ É `realtimeInput.audio` (objeto único), NÃO `realtimeInput.mediaChunks[]`. Medido em
 * 2026-11-10: a forma antiga `mediaChunks` é aceita **sem erro nenhum** e simplesmente
 * IGNORADA — o socket segue saudável, os quadros são engolidos e nenhuma transcrição de entrada
 * chega. É a pior classe de falha: silenciosa. A primeira versão deste arquivo usava `mediaChunks`
 * e teria produzido um microfone que "funciona" e não é ouvido.
 */
export function buildAudioChunk(pcm16Base64) {
  return {
    realtimeInput: {
      audio: { mimeType: `audio/pcm;rate=${CAPTURE_RATE}`, data: pcm16Base64 },
    },
  };
}

/**
 * Fim da fala. **Obrigatório**: sem ele o servidor não transcreve nada.
 *
 * Medido em 2026-11-10 com a MESMA fala e o MESMO formato: com `audioStreamEnd`, a transcrição
 * de entrada chegou exata; sem ele, nada, e o turno nunca fechou. Quem para de falar tem de
 * avisar — o VAD automático do servidor sozinho não bastou nesta medição.
 */
export function buildAudioStreamEnd() {
  return { realtimeInput: { audioStreamEnd: true } };
}

/**
 * Histórico semeado sem fechar o turno (fato 2). `turns` = [{role, text}].
 *
 * ⚠ Sempre `turnComplete:false`, e isso é decisão medida (2026-11-13): com `true`, o mesmo
 * frame vira um TURNO e o modelo responde — só que responde **falando**, mesmo com a função de
 * entrega declarada, e a bolha do aluno recebe a legenda do áudio em vez do texto. Pergunta
 * digitada continua indo por `realtimeInput.text` (ver `session.ask`), que é onde a medição do
 * P1 vale. Este frame é para CONTEXTO e HISTÓRICO: dado que o modelo passa a ter, sem responder.
 */
export function buildHistory(turns) {
  return {
    clientContent: {
      turns: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      turnComplete: false,
    },
  };
}

/**
 * Resposta obrigatória a um `toolCall` (fato 3).
 *
 * ⚠ Recebe RESULTADOS, não chamadas. A versão anterior recebia `calls` e respondia
 * `{ok:true}` para todas — o que é verdade só para a função de entrega textual, que não tem
 * efeito a reportar, e mentira para qualquer ferramenta de verdade: uma remoção recusada
 * respondia sucesso e o modelo seguia achando que apagou algo. Quem produz o resultado é o
 * despachante (`agent/dispatch.js`).
 *
 * `resultados` = `[{ id, name, response }]`, com `response` já no formato
 * `{ok:true, resultado}` ou `{ok:false, erro}`.
 */
export function buildToolResponse(resultados) {
  return {
    toolResponse: {
      functionResponses: resultados.map((r) => ({
        id: r.id,
        name: r.name,
        response: r.response,
      })),
    },
  };
}

/** Resposta de efeito nulo — a entrega textual, que não executa nada. */
export function respostaDeEntrega(call) {
  return { id: call.id, name: call.name, response: { ok: true } };
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

  // Medido ao vivo: o servidor manda MUITO frame vazio (`{}`) entre os de conteúdo — 20 dos 64
  // de uma sessão de voz. Tratá-los como desconhecido enchia o log de "frame não reconhecido" e
  // escondia o que importa.
  if (Object.keys(message).length === 0) return { kind: 'noop' };

  // Alça de retomada da sessão. Não é usada ainda; reconhecida para não virar ruído, e porque é
  // por ela que uma reconexão preservaria o contexto depois do MVP.
  if (message.sessionResumptionUpdate) {
    return {
      kind: 'resumption',
      handle: message.sessionResumptionUpdate.newHandle ?? null,
      resumable: message.sessionResumptionUpdate.resumable === true,
    };
  }

  if (message.usageMetadata && !message.serverContent) {
    return { kind: 'usage', usage: message.usageMetadata };
  }

  const content = message.serverContent;
  if (content) {
    if (content.interrupted) return { kind: 'interrupted' };

    const inline = content.modelTurn?.parts?.find((p) => p.inlineData?.data);
    if (inline) {
      // O mesmo frame pode trazer áudio E legenda (medido: `{modelTurn,outputTranscription}`).
      // Devolver só um dos dois perdia a legenda de um frame a cada três.
      return {
        kind: 'audio',
        pcm16Base64: inline.inlineData.data,
        text: content.outputTranscription?.text ?? null,
      };
    }

    if (content.inputTranscription?.text) {
      return { kind: 'input-text', text: content.inputTranscription.text };
    }
    if (content.outputTranscription?.text) {
      return { kind: 'output-text', text: content.outputTranscription.text };
    }

    const status = content.interactionStatus ?? message.interactionStatus ?? null;

    // `generationComplete` chega num frame PRÓPRIO, logo antes do `turnComplete` (medido). Fechar
    // o turno nele encerrava um frame cedo e descartava o `usageMetadata` que vem junto do fim.
    if (content.generationComplete === true && content.turnComplete !== true) {
      return { kind: 'generation-complete' };
    }
    if (content.turnComplete === true) {
      // IN_PROGRESS = ainda vem coisa. Qualquer outro valor (ou nenhum) = terminou de verdade.
      return { kind: 'turn-complete', idle: status !== 'IN_PROGRESS', status, usage: message.usageMetadata ?? null };
    }
    if (status === 'IDLE') return { kind: 'turn-complete', idle: true, status, usage: message.usageMetadata ?? null };

    // `serverContent: {}` também aparece: abertura do turno, sem conteúdo.
    if (Object.keys(content).length === 0) return { kind: 'noop' };
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
