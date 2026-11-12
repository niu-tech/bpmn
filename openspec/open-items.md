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
| M2 | Barge-in contra o Gemini | **medido, inconclusivo** | ver §3 |
| M3 | Negação de microfone ao vivo | aberto | o teste cobre o caminho de erro em unidade; falta o cenário no navegador (é um `--passo` que recusa `getUserMedia`) |
| M4 | Desconexão no meio do turno | aberto | a sessão tem recuo com teto e código de fechamento nomeado, mas nunca foi exercitado cortando a rede de verdade |
| M5 | Expiração de sessão (`go-away`) | aberto | o frame é reconhecido e registrado no diário; nunca foi visto ao vivo |

## 3. Barge-in: o que a medição mostrou

Cenário `AO VIVO: interromper o modelo falando por cima`, contra a URL pública, com um WAV de
9 s de silêncio + a frase *"Espera, chega, responde só em uma frase"*.

Linha do tempo medida (diário da sessão):

```
15,0s  ws.input-text        o Gemini transcreveu a fala
15,0s  ws.audio   (12x)     começou a responder
19,2s  ws.turn-complete     terminou
```

O corte chegou aos **9 s** — quando ainda não havia resposta para cortar, porque o modelo só
começou a falar aos 15 s. **`ws.interrupted` = 0 não é defeito do produto: é o teste medindo
cedo.** O Gemini ouviu a frase de corte (transcrita: *"espera chega responde sua em uma frase"*),
o que prova que o microfone continua chegando ao servidor durante a sessão.

**O que falta:** refazer com silêncio de ~17 s (ou disparar a pergunta e só então abrir o
microfone) para que a fala caia dentro da janela 15–19 s. É ajuste de fixture, não de produto.

## 4. Dívidas que eu mesmo deixei

| # | Item | Onde | Nota |
|---|---|---|---|
| T1 | `4.10` duplica `2.13` em `tasks.md` | change do MVP | a mesma prova fecha as duas; a linha ficou dizendo "pendente" depois de fechada |
| T2 | `config.yaml` do OpenSpec estava desatualizado | `openspec/config.yaml` | falava de branch `ImproveSimulation` e de remotes que não existem mais |
| T3 | Sem cenário para o **viewer** na bateria além de carregar | `tools/battery.mjs` | a simulação em lote com o painel aberto só foi verificada à mão, no P2 |
| T4 | `validation.md` do MVP cita roteiro manual já automatizado | change do MVP | o roteiro continua válido para humano, mas a bateria cobre o essencial |
| T5 | A bateria não roda no CI | `.github/workflows/pipeline.yml` | o runner tem Chrome; falta decidir se o custo de minutos compensa |

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
| F.5 Memória durável entre sessões | change `give-bpmn-assistant-an-agent-harness` |
| F.1 RAG sobre a norma BPMN | continua fora: exige corpus e um lugar para hospedá-lo |
| F.2 MCP | continua fora: não há servidor nosso para falar MCP |
