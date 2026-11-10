# spike — Gemini 3.8 Live no navegador (dev-only)

**Isto não é o ajudante.** É a prova do transporte: o corte vertical mínimo que responde se dá
para falar com o Gemini Live direto do navegador, com a chave do próprio aluno, antes de escrever
qualquer widget sobre o diagrama.

Change: `openspec/changes/add-bpmn-public-live-assistant-mvp` (P1).

## Rodar

```bash
npm run dev:spike     # http://localhost:8080/spike/
```

O modelador segue em `/` e o viewer em `/viewer.html` — o spike não encosta em nenhum dos dois.

## Fora da produção, por construção

A entry só existe com `BPMN_SPIKE=1` (`webpack.config.js`). `npm run build` e o `Dockerfile` não
definem a variável, então nenhum byte daqui entra em `dist/bundle.js` nem em `dist/viewer.js`.
Três testes em `__tests__/audio-and-safety.mjs` guardam isso: `src/` não referencia `spike/`,
`spike/` não importa de `src/`, e o `Dockerfile` não menciona nenhum dos dois.

Apagar este diretório inteiro não quebra o produto.

## As três provas

| | O quê | Onde |
|---|---|---|
| **A** | microfone → Live | `live/capture-worklet.js` (PCM16 16 kHz, quadros de 40 ms) |
| **B** | Live → alto-falante | `live/playback-worklet.js` (24 kHz, ring bounded, prime, flush) |
| **C** | pergunta digitada → resposta textual | `live/protocol.js` + `live/session.js` |

C não é "pedi TEXT e recebi TEXT": o `gemini-3.8-live` **recusa** saída TEXT e fecha o socket com
1007. O texto sai pelos **argumentos** de uma função declarada (`entregar_resposta`), e toda
chamada tem de ser respondida com `toolResponse` — senão o turno fica pendurado.

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

`__tests__/worklets.mjs` **executa os arquivos de worklet do disco**, com os globais do
AudioWorkletGlobalScope esbulhados — a prova é sobre o arquivo que o navegador carrega, não sobre
uma cópia paralela da conta.

O que o mock **não** prova é o servidor real. Esse roteiro está em
`openspec/changes/add-bpmn-public-live-assistant-mvp/validation.md`, bloqueio B2.
