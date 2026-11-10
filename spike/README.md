# spike — Gemini 3.8 Live no navegador (dev-only)

**Isto não é o ajudante** — o ajudante vive em `src/assistant/**` e está montado nas duas
páginas desde o P2. Isto é o **harness de prova do transporte**: a página e as sondas que
exercitam, com uma chave local, o mesmo código que vai ao ar.

Desde o P2 os módulos (`protocol.js`, `session.js`, `audio.js`, `pcm.js`, `redact.js` e os dois
worklets) moram em **`src/assistant/live/**`** e o spike os importa de lá. Uma cópia só: a prova
viva exercita exatamente o código do produto, e não um irmão que apodrece.

Change: `openspec/changes/add-bpmn-public-live-assistant-mvp` (P1).

## Rodar

```bash
npm run dev:spike     # http://localhost:8080/spike/
```

O modelador segue em `/` e o viewer em `/viewer.html` — o spike não encosta em nenhum dos dois.

## Fora da produção, por construção

A entry só existe com `BPMN_SPIKE=1` (`webpack.config.js`). `npm run build` e o `Dockerfile` não
definem a variável, então a **página** do spike nunca é servida. Os testes guardam a direção que
protege produção: **`src/` nunca referencia `spike/`** (varrendo código, não comentários — citar
a proveniência de uma medição é justamente o que se quer escrito), a entry é condicional, e o
`Dockerfile` não menciona nenhum dos dois.

Apagar este diretório inteiro não quebra o produto — o contrário não vale mais, e é de propósito:
o spike depende do produto.

## As três provas

| | O quê | Onde |
|---|---|---|
| **A** | microfone → Live | `live/capture-worklet.js` (PCM16 16 kHz, quadros de 40 ms) |
| **B** | Live → alto-falante | `live/playback-worklet.js` (24 kHz, ring bounded, prime, flush) |
| **C** | pergunta digitada → resposta textual | `live/protocol.js` + `live/session.js` |

C não é "pedi TEXT e recebi TEXT": o `gemini-3.8-live` **recusa** saída TEXT e fecha o socket com
1007 (medido aqui em 2026-11-10 — o `setupComplete` chega e a recusa só vem ao pedir conteúdo).
O texto sai pelos **argumentos** de `entregar_resposta`, e toda chamada tem de ser respondida com
`toolResponse` — senão o turno fica pendurado.

## Dois modos, e eles são exclusivos

Medido com sessões reais: **declarar a função faz o modelo não falar** (0 quadros de áudio);
**sem a função ele fala** (29–48 quadros) e manda a legenda junto. Não dá para ter os dois no
mesmo turno.

| Modo | Função | Volta | Para quê |
|---|---|---|---|
| texto | declarada | argumentos de `entregar_resposta`, zero áudio | chat digitado, mais barato |
| voz | ausente | áudio 24 kHz + legenda | microfone |

Dois detalhes que o microfone não perdoa, os dois medidos: o quadro vai em
**`realtimeInput.audio`** (a forma antiga `mediaChunks` é aceita **em silêncio** e ignorada), e ao
parar de falar é **obrigatório** mandar **`audioStreamEnd`** — sem ele não há transcrição.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `live/protocol.js` | puro: monta o setup e os frames, interpreta as respostas |
| `live/session.js` | máquina de estados + fio; o WebSocket entra por injeção (por isso é testável) |
| `live/audio.js` | `getUserMedia`, dois `AudioContext`, e o encerramento na ordem certa |
| `live/capture-worklet.js` | **autossuficiente** (o webpack copia worklet verbatim; `import` daria 404) |
| `live/playback-worklet.js` | idem |
| `live/pcm.js` | base64 ↔ PCM16 para o main thread |
| `live/redact.js` | a chave viaja na query do WS e vaza por mensagem de erro — isto mascara |
| `live/token-probe.js` | sonda: o `authTokens.create` aceita chamada do navegador? (ainda não medido) |
| `main.js`, `index.html` | a página que junta tudo, com estado visível |

## Credencial

A chave fica em **variável de módulo**, só na memória da aba. Nada de `localStorage`, cookie,
bundle, URL da página, log ou commit. F5 apaga — e isso é o comportamento desejado.

O que a sessão gasta é a cota **do aluno**: encerre quando terminar.

## Testes

```bash
npm run test:spike    # sem chave, sem rede
```

Prova contra o servidor real (opcional, gated — sem a variável não faz rede nenhuma):

```bash
GEMINI_API_KEY=<a sua chave> node spike/__tests__/live-probe.mjs
```

`__tests__/worklets.mjs` **executa os arquivos de worklet do disco**, com os globais do
AudioWorkletGlobalScope esbulhados — a prova é sobre o arquivo que o navegador carrega, não sobre
uma cópia paralela da conta.

O que o mock **não** prova é o servidor real. Esse roteiro está em
`openspec/changes/add-bpmn-public-live-assistant-mvp/validation.md`, bloqueio B2.
