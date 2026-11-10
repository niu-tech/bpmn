# Validação — o que foi provado, o que foi simulado, o que falta

Atualizado: 2026-11-10, **depois** da rodada com a chave real.
Máquina: Windows 11, node v24.14.1, npm 11.11.0. Modelo: `gemini-3.8-live`.

A distinção que importa: **mock que passa não é o Google dizendo sim.** Cada item diz em que
nível foi provado.

## Níveis

| Nível | Significado |
|---|---|
| **REAL-LIVE** | Medido contra o servidor real do Gemini, com a chave do dono. |
| **REAL-BROWSER** | Medido numa página real, no navegador, com a chave do dono. |
| **REAL-LOCAL** | Executado nesta máquina, com o código do repositório. Determinístico. |
| **MOCK** | Protocolo exercido contra um duplo que fala o shape do fio. Prova o NOSSO lado. |
| **BLOQUEADO** | Não executado, com o motivo nomeado. |

## Como a credencial foi tratada

A chave é a **do dono**, autorizada por ele para este teste. Ela estava no **cofre DPAPI da MAIA**
(`voiceChat.providerCredentialRefs.googleApiKey` → `secrets/provider-credentials/<id>.dpapi`),
não em texto no `settings.json`. Foi resolvida com a mesma entropia que
`ProviderCredentialVault.cs` usa.

- **Nunca** apareceu em argumento de ferramenta, linha de comando, log, arquivo do repositório ou
  commit. Entrou nos processos **só** por variável de ambiente, e na página **só** por um canal
  local de um uso (`127.0.0.1`, expira em 120 s, morre depois de entregar).
- Os scripts que a manipulam vivem no scratchpad da sessão, **fora de qualquer repositório**.
- Conferido ao final por comparação direta: **nenhum arquivo de `spike/` ou `openspec/` contém a
  chave**. O que existe no código é o **formato** (`AQ.`), em comentário e num valor de teste
  sintético.
- Achado disso: a chave do dono começa com **`AQ.`** e tem 53 caracteres — e o `redact.js`
  original só conhecia `AIza…` (39, formato clássico). **A regra por formato já tinha um furo.**
  Daí nasceu `rememberSecret()`: mascaramento por igualdade exata, que não depende de adivinhar
  formato.

## Baseline antes de qualquer alteração

**REAL-LOCAL** — as quatro suítes existentes, intocadas: 33 + 63 + 28 assertions, smoke OK.

## Suíte depois da change

**REAL-LOCAL** — `npm test` (que antes era `exit 1`), exit **0**:

```
test:sim    33 + 63 + 28 passed, 0 failed · smoke OK
test:spike  protocol          33 passed, 0 failed
            session           29 passed, 0 failed
            worklets          19 passed, 0 failed
            audio-and-safety  21 passed, 0 failed
                              ------------------------
                              102 novas, 226 no total
```

## A rodada viva: 10 de 11

`spike/__tests__/live-probe.mjs`, gated por `GEMINI_API_KEY` (sem a variável **não faz rede** e
sai com 0, como o `MAIA_E2E_LIVE` do CopilotSpeaker).

| # | Medição | Nível | Resultado |
|---|---|---|---|
| 1 | Servidor aceita o nosso setup | REAL-LIVE | ✔ `setupComplete` em **612 ms** |
| 2 | **Prova C** — pergunta digitada → `entregar_resposta` | REAL-LIVE | ✔ 179 chars pelos **argumentos** da função |
| 3 | Modo texto não fala | REAL-LIVE | ✔ **0** quadros de áudio (é o comportamento correto, e mais barato) |
| 4 | Três turnos na mesma sessão | REAL-LIVE | ✔ em ordem, sem resto de um no outro |
| 5 | Modo voz fala | REAL-LIVE | ✔ **43** quadros + legenda |
| 6 | **Prova B** — áudio real pelo worklet de playback | REAL-LIVE | ✔ 341 280 amostras (14,2 s) → **381 blocos audíveis** a 48 kHz, pico 0,723, **0 underflow** |
| 7 | **Prova A** — captura real transcrita pelo servidor | REAL-LIVE | ✔ 355 quadros → transcrição **exata**: *"A raia serve para organizar e segmentar as atividades dentro de uma pool…"* |
| 8 | TEXT recusado com 1007 | REAL-LIVE | ✔ `setupComplete=true`, depois **1007**: *"The requested combination of response modalities (TEXT) is not supported by the model."* |
| 9 | Token efêmero: preflight CORS | REAL-LIVE | ✔ 200, `allow-origin` ecoado, `x-goog-api-key` em `allow-headers` |
| 10 | Token efêmero: emitido do navegador | REAL-LIVE | ✔ 200, campo `name` |
| 11 | Token efêmero **abre a sessão** | REAL-LIVE | ✖ **não** — 4 formas (`access_token`/`key` × `v1beta`/`v1alpha`): 1008 *"unregistered callers"* / 1007 *"API key not valid"* |

O único ✖ é um **resultado negativo real**, não uma falha de execução.

### Prova A: como foi provada sem um humano falando

O áudio do modelo (24 kHz) foi devolvido ao **worklet de captura do disco**, que o decimou para
16 kHz em quadros de 40 ms, e esses quadros voltaram ao servidor como entrada. O servidor
transcreveu **a frase exata**. Isso prova a conta da captura e o formato do fio ponta a ponta.

**Não prova** microfone físico com voz humana: isso é o item 1.15, e precisa de alguém falando.

## A rodada no navegador

**REAL-BROWSER**, Chrome 152, `isSecureContext=true`. Evidência completa em
`renders/browser-live-evidence.txt`.

| O quê | Resultado |
|---|---|
| **E13** — o WebSocket aceita **origem de navegador** com a chave na query | ✔ confirmado (era hipótese) |
| Modo texto na página | ✔ resposta real sobre evento de borda, **0** áudio |
| Modo voz na página | ✔ **29** quadros recebidos, **29** marcados como audíveis pelo worklet, 9 legendas, **0** entregas estruturadas, 1 underflow no começo |
| Worklet carrega do asset com hash que o webpack emite | ✔ |
| Modelador e viewer com o spike ligado | ✔ diagrama renderiza, zero erro de console |
| Microfone físico com fala humana | **BLOQUEADO** — item 1.15 |

## Defeitos encontrados — e todos por medição, nenhum por leitura

| # | Defeito | Como só podia ser pego |
|---|---|---|
| D1 | Worklet com `import`: o webpack copia **verbatim**, o módulo importado não é emitido, `addModule` daria 404 | inspeção do bundle emitido |
| D2 | `String.replace` com replacer recebendo o **offset** como grupo → mascarava `14***` | teste unitário |
| D3 | `primeMs: 0` virando 120 ms por `\|\|` num zero legítimo | teste unitário |
| D4 | `redact` só conhecia `AIza…`; a chave real é `AQ.` e escaparia fora de URL | **usar a chave real** |
| D5 | Declarar a função deixava o modelo **mudo** — o ajudante sairia sem voz | **sessão real** |
| D6 | `realtimeInput.mediaChunks[]` aceito em silêncio e **ignorado** | **sessão real** |
| D7 | Sem `audioStreamEnd`, **nenhuma** transcrição de entrada | **sessão real** |
| D8 | Frames vazios / `sessionResumptionUpdate` / `generationComplete` tratados como desconhecidos; turno fechava um frame cedo | **dump dos frames crus** |
| D9 | `clock = { setTimeout, clearTimeout }` → `TypeError: Illegal invocation`; a sessão chegava a `ready` e a primeira pergunta **morria antes de sair** | **só no navegador** (no node funciona) |
| D10 | Botão de perguntar desabilitado no modo voz, embora o modelo responda pergunta digitada falando | **dirigir a página** |

D9 é o mais instrutivo: **nenhum teste em node pegaria**. É por isso que a rodada no navegador faz
parte do procedimento.

## O que continua bloqueado

### B1 — Docker não disponível nesta máquina
A imagem não foi construída nem o smoke test das cinco URLs do workflow. O equivalente possível
foi feito contra o dev server: `/`, `/viewer.html`, `/bundle.js`, `/pizza-collaboration.bpmn` →
todos **200**. O `Dockerfile` foi conferido linha a linha contra o que o webpack emite.

### B2 — microfone físico com fala humana (item 1.15)
Tudo o mais de B2 foi destravado. Falta só isto, e precisa de alguém falando:

```bash
npm run dev:spike        # http://localhost:8080/spike/
```

1. Colar a chave, **Conectar (voz)**.
2. **Liberar áudio** → **Falar (abrir microfone)**, dizer uma frase, **Parar microfone**.
   Esperado: `quadros enviados` subindo, e a sua frase aparecendo como `você(voz)>`.
3. Negar o microfone no diálogo do navegador → esperado `error(mic-denied)`, texto segue vivo.
4. Desligar a rede no meio de um turno → `connecting` até o teto, depois erro visível.
5. **Encerrar** → o indicador de microfone do navegador tem de **sumir**.

### Não medido (e assumido)
- **Barge-in** (falar por cima do modelo): o caminho existe (`interrupted` → `flush`), nunca foi
  exercido ao vivo.
- **`interactionStatus: IN_PROGRESS`** (E15): nas nossas sessões o turno fechou direto com
  `turnComplete`; o código trata o caso, mas por herança do outro projeto, não por medição.
- **Custo**: `usageMetadata` chega (ex.: 729 + 42 = 771 tokens num turno de texto) e a sessão o
  expõe, mas nenhum teto de gasto foi implementado.
