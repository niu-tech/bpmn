## Why

Missão `mk-0310e432`. Para o TCC 1 o projeto precisa de duas coisas que hoje não existem:

1. **Estar publicado** num endereço que o orientador e os alunos abram no navegador. O stack de
   publicação (Dockerfile, nginx, compose, workflow do Actions, runbook) já está **escrito no
   disco** — e **nenhum desses arquivos está versionado** (`git status`: `?? Dockerfile`,
   `?? deploy/`, `?? docker-compose.yml`, `?? .github/`, `?? .dockerignore`). Enquanto não forem
   commitados, o CI/CD não existe para o GitHub: o workflow nunca roda e o deploy não é
   reproduzível. É o achado mais importante da auditoria desta change.
2. **Um ajudante de BPMN sobreposto ao diagrama**, que converse por **voz e texto** sobre BPMN
   usando **Gemini 3.8 Live** com a **chave do próprio aluno (BYOK)**.

> **Decisão do dono (2026-11-10), acima de qualquer conveniência:** o site público **não tem
> chave**. Cada aluno informa a sua ao entrar, ela vale só para a aba dele, não é pré-preenchida
> nem compartilhada entre visitantes, e some ao recarregar. A chave do autor serve apenas para
> teste local explícito — nunca como chave do produto. O risco residual (a chave viaja na query
> do WebSocket do Google) é **declarado ao aluno e aceito por ele** antes de qualquer conexão,
> nunca silenciado. Ver `design.md` D5.

RAG, MCP, memória durável e edição de diagrama por IA ficam **fora** deste MVP.

## What Changes

- **P0 — publicação auditável.** Versionar o stack de deploy que hoje só existe no disco, provar
  build e smoke test localmente, documentar host/HTTPS e rollback. **Sem deploy nesta etapa.**
- **P1 — spike técnico isolado (primeiro bloco de execução).** Corte vertical dev-only com três
  provas observáveis: (A) microfone do navegador → Live; (B) Live → alto-falante do navegador;
  (C) pergunta digitada → Live → resposta **textual estruturada**. Fora do bundle de produção.
- **P2 — widget flutuante** no modelador e no viewer: botão, painel, chat, voz, estados, sessão e
  chave BYOK, sem regressão no modelador, no viewer nem na simulação.
- **P3 — integração, homologação e publicação:** evidências de segurança, desktop/mobile, DevOps.
- **Futuro, fora do MVP:** RAG, MCP, tools read-only de XML e métricas, edição por agente.

## Capabilities

### New Capabilities
- `bpmn-live-assistant`: transporte Live com BYOK, captura e reprodução de áudio no navegador,
  resposta textual estruturada, widget sobreposto, estados e ciclo de vida de sessão.
- `bpmn-public-deploy`: publicação reproduzível do site estático (imagem, compose, CI/CD, host).

### Modified Capabilities
Nenhuma spec canônica existente neste repositório (`openspec/` nasce com esta change). O
modelador (`src/app.js`), o viewer (`src/viewer.js`) e a simulação (`src/batchsim/**`) são
**preservados por invariante** — ver spec, requisito "Nenhuma regressão no produto existente".

## Impact

- **Versionamento:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `deploy/**`,
  `.github/workflows/pipeline.yml` saem de untracked para rastreados.
- **Build:** `webpack.config.js` ganha uma entry **condicional** (`BPMN_SPIKE=1`) para a página do
  spike. Sem a variável, o grafo de módulos de produção é bit-a-bit o de hoje.
- **Novo código:** `spike/**` (dev-only) na P1; `src/assistant/**` na P2.
- **Sem backend novo** no MVP, agora por medição e não por aposta: o navegador fala direto com
  `generativelanguage.googleapis.com` (E13 confirmado na página). O relay fica descartado.

## Classificação da evidência

Esta é a base factual da change. Nada abaixo é suposição implícita.

| # | Afirmação | Classe | Fonte |
|---|---|---|---|
| E1 | Stack de deploy existe no disco e **não está versionado** | **EXISTENTE (verificado)** | `git status --porcelain` em `ImproveSimulation`, 2026-11-10 |
| E2 | Site é 100% estático; nenhum backend no repositório | **EXISTENTE (verificado)** | `package.json` (sem deps de servidor), `Dockerfile` (nginx), `webpack.config.js` |
| E3 | Duas páginas, duas entries; HTML só tem `#canvas` + `<script>` | **EXISTENTE (verificado)** | `src/index.html`, `src/viewer.html`, `webpack.config.js` |
| E4 | Testes são `.mjs` executados por `node` direto; `npm test` não existe | **EXISTENTE (verificado)** | `package.json` (`"test": "echo ... && exit 1"`), `src/batchsim/__tests__/*.mjs` |
| E5 | Live fala em `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=<API_KEY>` | **COMPROVADO EM OUTRO PROJETO** | CopilotSpeaker `src/CopilotSpeaker.Audio/A2A/GeminiLiveWebSocketClient.cs:23,51` |
| E6 | `gemini-3.8-live` **recusa** `responseModalities: ["TEXT"]` e fecha o socket com **1007** | **COMPROVADO EM OUTRO PROJETO** (medido 2026-09-17) | CopilotSpeaker `GeminiLiveBrainProvider.cs:12-13`; `GeminiLiveSetup.cs` (cabeçalho: "nunca pedir TEXT") |
| E7 | O contorno é saída `AUDIO` + function calling `entregar_resposta`, cujos **argumentos** carregam o texto | **COMPROVADO EM OUTRO PROJETO** | `GeminiLiveBrainProvider.cs:155-165` (`DeliveryToolName`), `GeminiLiveBrainSession.cs:8-10` |
| E8 | Entrada textual em sessão viva vai por `realtimeInput.text`; histórico por `clientContent`; `toolResponse` fecha a chamada — sem ela o turno fica pendurado | **COMPROVADO EM OUTRO PROJETO** | `GeminiLiveBrainProvider.cs:696-731`, `GeminiLiveBrainSession.cs:10,130,277` |
| E9 | Captura no navegador: `getUserMedia` + AudioWorklet, PCM16 mono 16 kHz, frames de 40 ms, média de janela como low-pass | **COMPROVADO EM OUTRO PROJETO** (gateway, não ligação direta ao Gemini) | CopilotSpeaker `tools/cloud-desktop/voice-worklet.js`, `voice.js:54-55,69-111` |
| E10 | Reprodução no navegador: PCM16 24 kHz, ring bounded, prime, reamostragem linear, underflow/overflow contados, `flush` para cancelar | **COMPROVADO EM OUTRO PROJETO** (prova só de playback) | CopilotSpeaker `src/CopilotSpeaker.Games.Gateway/Assets/npc-voice/worklet.js`, `app.js:141-154,289-353` |
| E11 | Token efêmero é criado por `auth_tokens` (snake_case), que exige uma chave de API | **MEDIDO POR NÓS** (2026-11-10) | `v1alpha/authTokens` camelCase devolve **404**; `v1alpha/auth_tokens` devolve **200** |
| E12 | O endpoint de token efêmero **aceita** chamada de **origem de navegador** (CORS) | **MEDIDO — CONFIRMADO** | preflight `OPTIONS` → 200 com `access-control-allow-origin` ecoado e `x-goog-api-key` em `allow-headers`; `POST` com `Origin` → 200, token emitido |
| E12b | O token emitido **abre** a sessão Live no lugar da chave | **MEDIDO — FALSO** | 4 formas testadas (`access_token`/`key` × `v1beta`/`v1alpha`): 1008 "unregistered callers" ou 1007 "API key not valid". A resposta traz só o campo `name` |
| E13 | O WebSocket do Live conecta de **origem de navegador** com a chave na query | **MEDIDO — CONFIRMADO** | sessão aberta e respondida na página do spike, Chrome 152, `isSecureContext=true` |
| E14 | Turnos múltiplos e barge-in numa única sessão | **MEDIDO (turnos múltiplos)** | 3 turnos seguidos na mesma sessão, em ordem, sem resto de um no outro. Barge-in segue não medido |
| E15 | `interactionStatus: IN_PROGRESS` no `turnComplete` fecha só o enchimento; o fim real é `IDLE` | COMPROVADO EM OUTRO PROJETO (não reproduzido aqui) | `GeminiLiveBrainProvider.cs:17,457-461`; nas nossas sessões o turno fechou direto com `turnComplete` |

### Achados que SÓ a medição ao vivo deu (2026-11-10)

Cinco fatos que nenhuma leitura de código de outro projeto entregaria, e dois deles quebrariam
o produto em silêncio:

| # | Achado | Consequência |
|---|---|---|
| M1 | **Declarar `entregar_resposta` faz o modelo não falar.** Com a função: `toolCall` e **0 frames de áudio**. Sem ela: 29–48 frames de `audio/pcm;rate=24000` + `outputTranscription` | O desenho anterior declarava a função **sempre** — o ajudante sairia **mudo**, e só se descobriria ao apertar o microfone. Virou escolha de **modo** (D3) |
| M2 | **`realtimeInput.mediaChunks[]` é aceito sem erro e IGNORADO.** O correto é `realtimeInput.audio` | Microfone que "funciona", socket saudável, e o servidor não ouve nada. Falha silenciosa |
| M3 | **`audioStreamEnd` é obrigatório.** Mesma fala, mesmo formato: com ele a transcrição chegou exata; sem ele, nada | Quem para de falar tem de avisar; o VAD automático não bastou |
| M4 | **O servidor manda muito frame vazio** (`{}`), além de `sessionResumptionUpdate`, `generationComplete` separado do `turnComplete`, e `usageMetadata` | O parser tratava tudo como "desconhecido" (log inútil) e fechava o turno um frame cedo |
| M5 | **`clock = { setTimeout, clearTimeout }` quebra no navegador** (`TypeError: Illegal invocation`): o método perde o `this` do `window`. No node funciona | Classe de defeito **invisível** para o teste e fatal na página — a sessão chegava a `ready` e a primeira pergunta morria antes de sair |

A medição também **confirmou E6 com evidência própria**: pedindo `responseModalities: ["TEXT"]`, o
`setupComplete` **chega**, e o socket só fecha com **1007** quando se pede conteúdo —
*"The requested combination of response modalities (TEXT) is not supported by the model."* A
primeira versão da sonda parava no `ready` e concluiu, errado, que o servidor aceitava.

## Baseline, ownership e riscos

- **Baseline:** branch `ImproveSimulation` em `cfcba83`, três remotes (`bpmn`, `origin`,
  `upstream`). Working tree sem arquivo modificado; só os untracked de E1, **preservados**.
- **Sem push, sem deploy, sem DNS, sem infra externa** neste bloco (restrição da missão).
- **Risco 1 — `dist/` está COMMITADO.** `dist/bundle.js` e `dist/viewer.js` estão no índice. Todo
  build sujo o diff. A change **não** mexe nisso (fora de escopo), mas registra: qualquer bundle
  gerado durante o trabalho **não** entra em commit.
- **Risco 2 — `.vs/` está COMMITADO** (incluindo `CopilotIndices/*.db` e sessões de copilot-chat).
  Mesma decisão: registrado, não corrigido aqui.
- **Risco 3 — chave do aluno.** Fluxo BYOK nunca grava chave em bundle, `localStorage`, log,
  histórico de CLI ou commit. Ver spec, requisito "Isolamento da credencial".
- **Risco 4 — custo/cota.** Sessão Live é cobrada por minuto de áudio na chave do aluno. O widget
  precisa de encerramento explícito e teto de sessão ociosa.
