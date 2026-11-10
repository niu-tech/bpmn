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

## D2. Token efêmero: o que é possível e o que é teatro

A doc oficial (E11) diz: o token é criado por `authTokens.create`, **a criação exige uma chave de
API**, e isso deve rodar num backend. Também diz que o token, como a chave, **pode ser extraído do
cliente** — o ganho é ser curto, não ser secreto.

Num cenário BYOK **sem backend**, o token efêmero resolve pouco: quem mintaria o token é a própria
aba, com a chave do aluno já em mãos. O ganho real seria limitar o estrago de um XSS (o token
expira; a chave não). Vale medir, não vale assumir.

**O que a P1 prova (ou derruba):** se `POST .../authTokens` responde a uma requisição de **origem
de navegador** (CORS) com a chave do aluno no cabeçalho (E12). Se responder, o fluxo preferido
passa a ser: chave → token de uso único e escopo travado → WS com o token; a chave só é tocada uma
vez por sessão. Se **não** responder, o fluxo é chave na query do WS (E5), e isso fica **registrado
como limitação**, não escondido.

Em nenhum caminho a chave vai para um servidor nosso.

## D3. Texto sai por function calling, não por `responseModalities: TEXT`

Fato medido (E6): `gemini-3.8-live` **fecha o socket com 1007** quando se pede saída `TEXT`. É o
mesmo modelo que a prova C precisa. Portanto:

- `setup.generationConfig.responseModalities = ["AUDIO"]`, **sempre** (E6/E7).
- `inputAudioTranscription` e `outputAudioTranscription` ligados: é daí que sai o texto do que o
  aluno falou e a legenda do que o modelo falou.
- Uma função declarada **`entregar_resposta`** com um campo de texto. Resposta final de verdade =
  **argumentos** dessa chamada (E7). A transcrição da fala é **fallback**, porque JSON falado não
  sobrevive à transcrição (E7).
- Cada `toolCall` **tem** de receber `toolResponse`. Sem isso o turno do modelo fica pendurado e o
  pedido seguinte cai no meio dele (E8).

A prova C, portanto, não é "pedi TEXT e recebi TEXT". É: *pergunta digitada por
`realtimeInput.text` → `toolCall` de `entregar_resposta` → texto nos argumentos → `toolResponse` →
`turnComplete`.* A P1 **também** registra o 1007 ao pedir TEXT de propósito, uma vez, para
documentar a incompatibilidade com medição própria em vez de nota de terceiro.

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

Isolamento verificado por **teste**, não por intenção (ver tasks 2.6).

## D7. Testes sem runner novo

O repositório já testa com `.mjs` + `node` direto (E4). Adicionar Jest/Vitest custaria
dependências, config e tempo de CI para resolver um problema que o `node:assert` resolve. Os testes
do spike seguem o mesmo padrão, em `spike/__tests__/*.mjs`, e `package.json` ganha scripts que os
nomeiam — `npm test` deixa de ser `exit 1` e passa a rodar o conjunto existente **mais** os novos.

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
