# O que está em aberto

> Levantamento honesto do caminho percorrido até 2026-11-12, antes de virar para o harness do
> agente. Feito porque "está tudo pronto" seria mentira: o MVP fechou, mas deixou pontas — umas
> do dono, outras minhas, outras que só o uso vai fechar.
>
> Atualize esta página na mesma change que fechar um item. Item fechado sai daqui e vira linha de
> `tasks.md` com a prova.

## 1. Portões do dono (publicação na VPS)

Nada aqui é código. O site **já está no ar** no endereço provisório
(<https://niu-tech.github.io/bpmn/>), então estes itens valem para a publicação definitiva, com
domínio, e não bloqueiam mais o uso pelo orientador.

| # | Item | Estado | O que falta exatamente |
|---|---|---|---|
| D1 | Domínio e DNS | aberto | registro A → IP da VPS. Desde 2026-11-11 o site serve sob prefixo de caminho, então subdomínio próprio deixou de ser obrigatório |
| D2 | Secrets do Actions | aberto | variables `SSH_HOST`, `SSH_USER`, `SSH_PORT`; secret `SSH_KEY` (+ `SSH_PASSPHRASE` se houver) |
| D3 | Ambiente `production` | aberto | não existe no repositório e o job de deploy **o exige** — sem ele o job nem começa |
| D4 | Primeira publicação na VPS | aberto | depende de D1–D3; o runbook é `deploy/README.md` |
| D5 | Rollback ensaiado | aberto | o runbook existe e nunca foi executado contra servidor real |

## 2. Medições que ficaram faltando

| # | Item | Estado | Por quê |
|---|---|---|---|
| M1 | Voz **humana** em microfone físico | aberto | o teste usa fala sintética pt-BR (SAPI) entrando pelo caminho real do microfone. Mede o produto, não a pessoa — mas é diferença real, e fica dita |
| M2 | Barge-in contra o Gemini | **PROVADO** (2026-11-12) | ver §3 — e o achado maior: o fluxo de audio governa o turno digitado |
| M3 | Negação de microfone ao vivo | aberto | o teste cobre o caminho de erro em unidade; falta o cenário no navegador (é um `--passo` que recusa `getUserMedia`) |
| M4 | Desconexão no meio do turno | aberto | a sessão tem recuo com teto e código de fechamento nomeado, mas nunca foi exercitado cortando a rede de verdade |
| M5 | Expiração de sessão (`go-away`) | aberto | o frame é reconhecido e registrado no diário; nunca foi visto ao vivo |

## 3. Barge-in: o que a medição mostrou — e o achado que ela trouxe

Cenário `AO VIVO: interromper o modelo falando por cima`, contra a URL pública.

**Primeira rodada** (pergunta DIGITADA, WAV de 9 s de silêncio + *"Espera, chega, responde só em
uma frase"*): o corte chegou aos 9 s e o modelo só começou a falar aos **15 s** — não havia
resposta para cortar. `ws.interrupted` = 0 era o teste medindo cedo, não defeito do produto.

**Segunda rodada**, com 16 s de silêncio: o modelo passou a falar aos **22,6 s**. O atraso
acompanhou o silêncio, e é isso que revela a causa:

> **Em modo voz com o microfone aberto, uma pergunta DIGITADA só é respondida depois de o
> servidor ver fim de fala no fluxo de áudio.** O áudio governa o turno.

Ou seja, era impossível fazer o modelo falar enquanto o WAV ainda tocava: a própria pergunta
digitada ficava na fila. A forma que funciona é a pergunta vir **pela voz**, com a frase de corte
num segundo trecho do mesmo arquivo (`tools/wav-pad.mjs juntar`).

**Terceira rodada — PROVADO** (`artifacts/voz/barge.wav` = `[longa][2 s][interrompe]`):

```
12,9s  ws.input-text     "me explique... todos os tipos de evento"
13,4s  ws.audio          o modelo começa a responder
16,1s  ws.interrupted    "espera, chega, responde só em uma frase"
```

O corte caiu **dentro** da fala. O que isso deixa como regra para o próximo teste de voz: medir
turno digitado em sessão de voz é medir a fila do áudio, não a latência do modelo.

## 4. Dívidas que eu mesmo deixei

| # | Item | Onde | Nota |
|---|---|---|---|
| T1 | `4.10` duplica `2.13` em `tasks.md` | change do MVP | a mesma prova fecha as duas; a linha ficou dizendo "pendente" depois de fechada |
| T2 | `config.yaml` do OpenSpec estava desatualizado | `openspec/config.yaml` | falava de branch `ImproveSimulation` e de remotes que não existem mais |
| T3 | Sem cenário para o **viewer** na bateria além de carregar | `tools/battery.mjs` | a simulação em lote com o painel aberto só foi verificada à mão, no P2 |
| T4 | `validation.md` do MVP cita roteiro manual já automatizado | change do MVP | o roteiro continua válido para humano, mas a bateria cobre o essencial |
| T5 | A bateria não roda no CI | `.github/workflows/pipeline.yml` | o runner tem Chrome; falta decidir se o custo de minutos compensa |
| T6 | Em F2 o contexto do diagrama viaja **dentro do `setup`** | `agent/render.js` (`promptDoPerfil`) | o `setup` é imutável depois de aceito, então o agente vê o retrato do momento em que a sessão abriu: editar o diagrama no meio da conversa não chega ao modelo. É o que F3 conserta com `clientContent`; o filtro de camada do renderizador já existe para a troca ser uma linha |
| T7 | A projeção do diagrama ainda não tem fonte | `session-manager.definirContexto` | em F2 quem alimenta é o teste/bateria; em F3 passa a ser o `elementRegistry` pelo `eventBus`. Até lá, na página o diagrama chega VAZIO ao prompt — a fronteira existe e o dado não |

## 4b. Achados da pesquisa de arquitetura (2026-11-12)

Levantados pela pesquisa profunda na MAIA (`changes/give-bpmn-assistant-an-agent-harness/research.md`)
e **confirmados no nosso código**. Viraram tarefa; ficam aqui até fecharem.

| # | Achado | Onde | Virou |
|---|---|---|---|
| P1 | `toolResponse` responde `{ok:true}` para toda chamada | `src/assistant/live/protocol.js:164` | tarefa 5.0 do harness |
| P2 | A resposta sai **antes** de qualquer executor | `src/assistant/live/session.js:217` | tarefa 5.0a |
| P3 | A instrução de entrega só entra se o prompt for a constante antiga | `src/assistant/live/protocol.js:79` | tarefa 1.4 |
| P4 | Texto do diagrama entra no contexto sem fronteira — e o produto **abre arquivo do disco** | `src/app.js` (`#bz-file-input`) | H11 + tarefa 6.6 |
| P5 | Um relógio só para turno e ferramenta derruba o cliente com a ferramenta ainda rodando | `src/assistant/live/session.js` | H15 + tarefa 5.0c |
| P6 | "Declarar ferramenta emudece a voz" era generalização indevida de uma medição estreita | `design.md` H9 | gate 4.3 reescrito |
| P7 | Recusa de domínio nunca foi testada contra entrada adversarial | — | aberto, sem tarefa ainda |

## 5. Decisões conscientes que continuam valendo

Não são dívidas — são escolhas, registradas para ninguém "consertar" por engano.

- **A chave viaja na query do WebSocket do Google.** Aceitável para piloto BYOK com consentimento;
  não aceitável como produto aberto. O token efêmero foi medido e **não** autentica a sessão Live
  (4 formas, 1007/1008). Detalhe em `release-checklist.md`, item 13.
- **Escuta contínua com VAD do servidor**, não VAD manual: desligar a detecção automática mata a
  transcrição (medido no CopilotSpeaker, 2026-08-03).
- **Meia-duplex é rede de segurança**, não o comportamento: liga sozinha ao reconhecer a assinatura
  do laço de eco (3 interrupções seguidas sem transcrição de entrada).
- **`dist/` não é versionado**; a imagem reconstrói do zero.
- **`.env` com a chave do dono fica na máquina dele**, fora do git, autorizado em 2026-11-12 para
  os cenários AO VIVO rodarem sem intervenção.

## 6. Fora do MVP, agora virando trabalho

O que estava em "Futuro" na change do MVP deixou de ser ideia e virou o próximo bloco:

| Era | Vira |
|---|---|
| F.3 Tools read-only de XML e métricas | change `add-bpmn-diagram-tools` |
| F.4 Edição de diagrama por agente | change `add-bpmn-diagram-tools` |
| F.5 Memória durável entre sessões | **change própria, ainda não escrita** — o harness decidiu que a memória morre com a aba, e persistir exige reescrever o aviso de privacidade e pedir consentimento. Divergência apontada pela pesquisa de 2026-11-12 |
| F.1 RAG sobre a norma BPMN | **substituido** por base OKF citavel + function calling: change `add-bpmn-norm-knowledge-base` (decisao do dono, 2026-11-12) |
| F.2 MCP | continua fora: não há servidor nosso para falar MCP |
