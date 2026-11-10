# Design — publicação + ajudante BPMN por voz e texto (Gemini 3.8 Live, BYOK)

Referências de código em outro projeto (CopilotSpeaker, mesmo dono) são citadas como **contrato
medido**, nunca copiadas em bloco: o que viaja é o **protocolo** e o **formato do áudio**, que são
da API do Google, não autoria de terceiro. Nenhuma dependência WPF/MAUI/Roblox entra no navegador.

## D1. Por que o navegador fala direto com o Gemini (e não um relay)

O bpmn é estático por construção (E2): não há processo nosso para hospedar um relay. Introduzir um
backend só para repassar bytes criaria servidor, deploy, TLS, autenticação e custo — tudo fora do
MVP, e tudo coisa que o aluno passaria a depender de **nós** em vez da **própria chave**.

Como a chave é **do aluno** (BYOK), o segredo não é nosso para esconder: o dono da chave é o dono
da aba. O risco que sobra não é "o usuário vê a chave dele" — é a chave **persistir** onde não
deveria, **vazar para terceiros**, ou **entrar no repositório**. D5 trata exatamente disso.

Decisão: **browser → Gemini direto**, chave em memória da aba. Relay mínimo em Node só se a P1
provar que o caminho direto não serve (handshake recusado por origem, por exemplo). A P1 **mede**
isso — E13 é hipótese, não fato.

## D2. Token efêmero: medido, e a resposta é "quase"

Tudo abaixo foi medido em 2026-11-10 com a chave do dono, não lido em documentação:

| Pergunta | Resposta |
|---|---|
| O endpoint existe? | Sim, em `v1alpha/**auth_tokens**` (snake_case). `authTokens` em camelCase devolve **404** — foi o que fez a primeira rodada concluir, errado, que não existia |
| Dá para chamar do **navegador**? | **Sim.** Preflight `OPTIONS` responde 200 com `access-control-allow-origin` ecoando a origem e `x-goog-api-key` em `allow-headers`. O `POST` com `Origin` responde 200 e emite o token |
| O token **abre a sessão** Live? | **Não.** Quatro formas testadas (`access_token` e `key`, em `v1beta` e `v1alpha`): 1008 *"unregistered callers"* ou 1007 *"API key not valid"*. A resposta traz **só** o campo `name` (`auth_tokens/<id>`), nenhum segredo separado |

**Decisão:** o caminho BYOK do MVP é a **chave na query string do WebSocket** (E13, confirmado na
página). O token efêmero fica registrado como **meio caminho**: mintável sem backend, inútil como
credencial de sessão para esta chave hoje. Quando o Google fechar essa lacuna, o troco é de uma
linha — `socketUrl` passa a receber o token. A sonda (`spike/live/token-probe.js`) fica no
repositório justamente para refazer a medição.

A consequência honesta: num app estático com BYOK, **a chave do aluno fica na URL do socket**
dentro da aba dele. Não há como evitar sem um backend, e um backend trocaria o problema por outro
(nós passaríamos a guardar a chave). D5 trata do que sobra: ela não persistir e não vazar.

## D3. Dois modos, e eles são exclusivos (medido)

Três fatos medidos contra `gemini-3.8-live` em 2026-11-10, cada um com sessão real:

1. **`responseModalities: ["TEXT"]` é recusado.** O `setupComplete` **chega** — e por isso a
   primeira versão da sonda concluiu errado que servia. O socket fecha com **1007** quando se
   pede conteúdo: *"The requested combination of response modalities (TEXT) is not supported by
   the model."* Então a saída é `AUDIO`, sempre.
2. **Com `entregar_resposta` declarada, o modelo não fala.** Foi direto ao `toolCall` e a sessão
   teve **0 frames de áudio**. Texto exato nos argumentos, e nenhum token de áudio gasto.
3. **Sem a função, o modelo fala** — 29 a 48 frames de `audio/pcm;rate=24000` — e manda
   `outputTranscription` junto, que é a legenda.

Ou seja: **fala e entrega estruturada não coexistem no mesmo turno.** O desenho anterior declarava
a função sempre; o ajudante teria saído **mudo**, e isso só apareceria quando alguém apertasse o
microfone. Vira escolha de modo, explícita em `buildSetup({ withDeliveryTool })`:

| Modo | Função declarada | O que volta | Para quê |
|---|---|---|---|
| **Texto** | sim | argumentos de `entregar_resposta`, zero áudio | chat digitado; mais barato |
| **Voz** | não | áudio 24 kHz + `outputTranscription` | microfone; a legenda é o texto |

A instrução de sistema acompanha o modo: mandar chamar uma função **não declarada** seria pedir
alucinação, então `DELIVERY_INSTRUCTION` só é anexada quando a função existe.

Em qualquer modo, todo `toolCall` **tem** de receber `toolResponse` — sem isso o turno do modelo
fica pendurado e o pedido seguinte cai no meio dele.

### O fio, como ele é de verdade

Medido numa sessão de voz de 64 frames: **20 eram `{}` vazios**. Também chegam
`sessionResumptionUpdate` (alça de retomada), `generationComplete` **num frame próprio, antes** do
`turnComplete`, e `usageMetadata` junto do fim. Tratar tudo isso como "desconhecido" enchia o log
e fechava o turno um frame cedo.

## D4. Formato do áudio: assimétrico de propósito

| Direção | Taxa | Formato | Quadro |
|---|---|---|---|
| Captura (aba → Live) | **16 kHz** | PCM16 mono LE | 40 ms |
| Reprodução (Live → aba) | **24 kHz** | PCM16 mono LE | o que vier |

As duas taxas são **do contrato do Live**, não escolha nossa (E9/E10). A assimetria é a causa de
um erro clássico: usar um `AudioContext` só, na taxa do dispositivo, e reamostrar errado num dos
lados. Desenho:

- **Captura** — `getUserMedia` → `AudioWorkletNode` que decima de `sampleRate` do contexto para
  16 kHz pela média da janela (box low-pass, suficiente para fala) e emite `Int16Array` de 640
  amostras por `postMessage` **transferindo** o buffer (E9).
- **Dois detalhes do fio que o microfone não perdoa**, ambos medidos em 2026-11-10 com a mesma
  fala e o mesmo formato:
  - o quadro vai em **`realtimeInput.audio`** (objeto único). A forma antiga
    `realtimeInput.mediaChunks[]` é aceita **sem erro nenhum** e simplesmente ignorada: socket
    saudável, quadros engolidos, nenhuma transcrição. É a pior classe de falha — silenciosa;
  - ao parar de falar é **obrigatório** mandar **`audioStreamEnd`**. Com ele, a transcrição de
    entrada chegou exata; sem ele, nada chegou e o turno nunca fechou.
- **Reprodução** — worklet com **ring bounded**, `prime` de ~120 ms, reamostragem linear
  24 kHz → `sampleRate` do contexto, `underflow`/`overflow` **contados** (não silenciados), e
  `flush` para cancelamento/barge-in (E10). Underflow que não é contado é underflow que ninguém
  descobre.

## D5. Isolamento da credencial (requisito duro)

- A chave entra por um campo `type="password"` **da sessão**, nunca de um arquivo versionado.
- Vive em **variável de módulo** (memória da aba). **Proibido:** `localStorage`,
  `sessionStorage`, cookie, bundle, URL, `console.log`, mensagem de erro, commit.
- A URL do WS contém a chave; logs e telas de erro **mascaram** qualquer coisa que casa com
  `key=` / `AIza[0-9A-Za-z_-]+` antes de exibir. O teste automatizado verifica isso no **texto da
  mensagem de erro**, que é por onde a chave escapa de verdade.
- `F5` perde a chave. É o comportamento desejado: o aluno reconhece que a sessão é efêmera.
- `.gitignore` ganha `.env*` e `*.key` **antes** de qualquer teste com chave real.

## D6. Isolamento do spike em relação ao produto

Terceira entry no webpack **condicional**:

```js
...(process.env.BPMN_SPIKE === '1' ? { spike: './spike/main.js' } : {})
```

- Build normal (`npm run build`) e **o Dockerfile** não definem `BPMN_SPIKE` → o grafo de módulos
  de produção é o de hoje, e nenhum byte do spike entra em `dist/bundle.js` ou `dist/viewer.js`.
- `spike/index.html` **não** é copiado pela imagem (o Dockerfile lista as páginas uma a uma).
- O spike não importa nada de `src/**`, e `src/**` não importa nada de `spike/**`. A direção
  importa: é o que garante que apagar `spike/` não quebra o produto.
- **Arquivo de worklet é copiado VERBATIM pelo webpack** (asset). Um `import` dentro dele
  sobrevive no arquivo emitido e o módulo importado **não** é emitido ao lado: `addModule` daria
  404 em runtime, depois de o teste ter passado. Por isso os dois worklets são autossuficientes,
  e o teste os **executa a partir do disco** com os globais do AudioWorkletGlobalScope
  esbulhados.

Isolamento verificado por **teste**, não por intenção (ver tasks 2.6).

## D7. Testes sem runner novo

O repositório já testa com `.mjs` + `node` direto (E4). Adicionar Jest/Vitest custaria
dependências, config e tempo de CI para resolver um problema que o `node:assert` resolve. Os testes
do spike seguem o mesmo padrão, em `spike/__tests__/*.mjs`, e `package.json` ganha scripts que os
nomeiam — `npm test` deixa de ser `exit 1` e passa a rodar o conjunto existente **mais** os novos.

**O que o mock não alcança, com nome:** `clock = { setTimeout, clearTimeout }` guardava o método
do `window` sem vínculo. No node funciona; no navegador o browser lança `TypeError: Illegal
invocation`, a sessão chega a `ready` e a primeira pergunta morre antes de ser enviada. Nenhum
teste em node pegaria isso — é por isso que **a rodada no navegador faz parte do procedimento**,
não é enfeite. O teste que sobrou protege o contrato vizinho (o relógio injetado é chamado como
método do próprio objeto).

**Mock de protocolo:** um duplo de `WebSocket` que fala o shape real do fio (frames de `setup`,
`serverContent`, `toolCall`, `toolResponse`, `turnComplete`, `goAway`). Isso cobre montagem do
setup, sequência de turno, resposta de tool obrigatória, reconexão e truncamento **sem chave e sem
rede** — então roda no CI. O que o mock **não** prova é o comportamento do servidor real; isso é a
validação manual com chave local, descrita em `validation.md`.

## D8. Ciclo de vida e estados

Máquina de estados explícita, uma só, consultada pela UI:

`idle → needs-key → connecting → ready → listening ⇄ speaking → closing → idle`
com `error(reason)` alcançável de qualquer um, e `reason` **nomeado** (`mic-denied`,
`insecure-context`, `bad-key`, `quota`, `ws-closed:<code>`, `timeout`).

- `getUserMedia` **só** por gesto explícito do usuário, e **só** em `https:` ou `localhost`
  (`window.isSecureContext`). Fora disso: `insecure-context`, sem pedir permissão.
- Encerrar libera, **nessa ordem**: `track.stop()` de cada track → `disconnect()` dos nós →
  `port.close()` → `AudioContext.close()` → `ws.close(1000)`. Microfone que fica aberto é o
  defeito que o usuário percebe como "o site está me ouvindo".
- Teto de sessão ociosa e encerramento explícito: cota é a chave do aluno (Risco 4).
- Reconexão com recuo exponencial e **teto de tentativas**; cada falha vira estado visível, nunca
  retry silencioso infinito.

## D9. O que fica para depois (e por quê)

| Fora do MVP | Por quê |
|---|---|
| RAG sobre a norma BPMN | O MVP mede transporte e UX; recuperação sem transporte provado é otimização prematura |
| MCP | Sem tools, não há o que um MCP sirva |
| Tools read-only de XML/métricas | A arquitetura **permite** (o setup já declara funções); a prova é P1 |
| Edição de diagrama por IA | Escrita no modelo pede desfazer, validação e confiança que o MVP não tem |
| Memória durável | Exige identidade e armazenamento — nada disso existe num site estático |

O desenho não **impede** nenhum deles: o canal de tools de D3 é o mesmo por onde uma leitura de
XML entraria depois, declarando mais uma função no mesmo `setup`.
