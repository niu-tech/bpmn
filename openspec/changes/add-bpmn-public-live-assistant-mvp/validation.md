# Validação — o que foi provado, o que foi simulado, o que falta

Atualizado: 2026-11-10, depois do **P2** (helper no produto). As seções do P1 ficam como
estão: são medições, não mudam porque o código andou.
Máquina: Windows 11, node v24.14.1, npm 11.11.0. Modelo: `gemini-3.8-live`.

A distinção que importa: **mock que passa não é o Google dizendo sim.** Cada item diz em que
nível foi provado.

## Níveis

| Nível | Significado |
|---|---|
| **REAL-LIVE** | Medido contra o servidor real do Gemini, com a chave do dono (P1). |
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

---

# P2 — helper no modelador e no viewer (2026-11-10)

**Nenhuma credencial foi usada nesta rodada.** O dono determinou não reusar a chave do cofre
DPAPI sem autorização nova, e nenhuma outra foi fornecida para teste. Então: MOCK e BROWSER até o
limite verificável, e o que exige credencial está marcado **MANUAL PENDENTE**, com roteiro.

## Suíte

`npm test` exit **0** — 269 assertions:

```
test:sim         33 + 63 + 28 passed  ·  smoke OK      (as 124 de sempre, intactas)
test:assistant   credential        15 passed, 0 failed
                 session-manager   28 passed, 0 failed
test:spike       protocol          33 passed, 0 failed
                 session           29 passed, 0 failed
                 worklets          19 passed, 0 failed
                 audio-and-safety  21 passed, 0 failed
```

## O que foi provado, e em que nível

| O quê | Nível | Resultado |
|---|---|---|
| Sem chave não conecta e nenhum socket é aberto | MOCK | ✔ |
| Com chave e **sem consentimento** também não conecta | MOCK + BROWSER | ✔ fail closed nas duas camadas |
| Chave curta recusada, campo limpo | BROWSER | ✔ |
| Modo texto declara a função; modo voz não | MOCK | ✔ (é o que mantém a voz viva) |
| Trocar de modo abre outra sessão e fecha a anterior | MOCK | ✔ |
| Trocar de modo **avisa** que o modelo perde o contexto | MOCK | ✔ `context-reset` |
| Histórico visual sobrevive à troca; o do modelo não | MOCK | ✔ |
| Microfone só no modo voz | MOCK | ✔ |
| Fechar o microfone manda `audioStreamEnd` | MOCK | ✔ |
| Abrir o microfone duas vezes não abre dois | MOCK | ✔ |
| Microfone negado vira razão nomeada sem derrubar a sessão | MOCK | ✔ |
| `stop()` idempotente — três chamadas simultâneas, um teardown | MOCK | ✔ |
| Interrupção descarta o áudio pendente (barge-in) | MOCK | ✔ caminho coberto; **ao vivo não** |
| Erro com a URL do socket não vaza a chave na conversa | MOCK | ✔ |
| Nenhum módulo toca storage do navegador | REAL-LOCAL | ✔ varredura de código, sem comentários |
| `credential.js` não tem `load()` | REAL-LOCAL | ✔ |
| Nenhum módulo mexe na URL da aplicação | REAL-LOCAL | ✔ |
| Nenhuma credencial nos arquivos emitidos | REAL-LOCAL | ✔ e virou passo de CI sobre a imagem |
| Modelador carrega com o helper, 0 erro de console | BROWSER | ✔ **depois** de corrigir D11 |
| Viewer carrega com o helper, 0 erro de console | BROWSER | ✔ |
| Helper não colide com as barras existentes (desktop) | BROWSER | ✔ (604,14) × (839,714) |
| Canvas continua clicável com o painel aberto | BROWSER | ✔ `rect.djs-hit` no centro |
| Teclado: foco ao abrir, Escape devolve ao botão | BROWSER | ✔ |
| Estado em região viva **e** em texto | BROWSER | ✔ cor nunca sozinha |
| Zero persistência depois de informar a chave | BROWSER | ✔ local/session/cookie = 0 |
| 375×812 com campo de digitar visível | BROWSER | ✔ |
| Push não publica; publicar exige acionamento manual | REAL-LOCAL | ✔ workflow conferido |

## Defeito meu, achado por baseline

O modelador passou a logar `Erro ao abrir BPMN: TypeError: ... 'scale' ... non-finite`.
O baseline do commit `0b29eeb`, extraído com `git archive` e servido em porta própria, tinha
console **limpo**. Causa: `mountAssistant()` antes de `fitAndOffsetCanvas`. Corrigido montando
depois (design D11). Cadeia A/B/A em `renders/p2-browser-evidence.txt`.

**Armadilha de diagnóstico registrada:** duas tentativas intermediárias leram um **bundle velho** —
o socket de HMR não conecta neste painel. Foi o número de linha do stack não bater com o arquivo
que denunciou. A rodada final usou porta nova para garantir bundle fresco.

## Limite real medido (não "resolvido")

Em **375 px**, com o painel aberto, ele **cobre** a `.bz-toolbar` do modelador (que fica em baixo
à esquerda). Dois painéis de largura cheia não cabem lado a lado num telefone. Os dois são
dispensáveis — fechar o ajudante devolve a barra. Não foi mexido porque a saída seria redesenhar
a barra do produto existente, fora do P2.

## Risco residual, declarado e não escondido

A chave do aluno **vai na query string do WebSocket do Google**. Dentro do TLS e para o dono da
credencial, mas visível em ferramentas de desenvolvedor e em proxy corporativo que termine TLS.

Não dá para evitar sem backend, e o token efêmero **não resolve hoje**: mintá-lo do navegador
funciona (CORS 200), mas ele **não abre a sessão** em nenhuma das 4 formas testadas (1007/1008).
Por isso o painel **avisa e exige aceite explícito antes de qualquer conexão**. Para a versão
pública, o caminho é um broker mínimo — e só quando o token passar a abrir a sessão; antes disso
o broker nos faria ver a chave, o que é pior. Detalhe em `design.md` D5.

## Teste manual — o que só o dono pode fazer

Precisa da chave dele. Nada aqui é feito por mim.

```bash
npm run dev      # http://localhost:8080/  (modelador) e /viewer.html
```

1. **Ajudante BPMN** → cole a chave → marque o aviso → **Usar esta chave** → **Conectar**.
2. **Texto**: pergunte *"qual a diferença entre gateway exclusivo e paralelo?"*.
   Esperado: resposta escrita, sem áudio.
3. **Voz** → **Conectar** → **Falar**, diga uma frase, **Parar de falar**.
   Esperado: a sua frase aparece marcada *por voz*, o modelo responde falando com legenda.
   → **é esta a prova de fala humana que continua pendente desde o P1.**
4. **Barge-in**: fale por cima enquanto ele responde. Esperado: o áudio corta na hora.
5. Negue o microfone no diálogo do navegador. Esperado: *"o microfone foi negado"*, texto segue.
6. **Remover chave** → esperado: sessão encerrada e nada guardado.
7. Recarregue (F5) → esperado: começa sem chave nenhuma.

Se algo divergir, o console e o estado no cabeçalho do painel dizem o quê — e a chave não aparece
em nenhum dos dois.

---

# P3 — homologação e preparação de release (2026-11-10)

**Nenhuma credencial do dono foi usada.** O cofre DPAPI não foi acessado. Onde um teste precisava
de chave, usei valor sintético que não autentica em lugar nenhum. Evidência completa em
`renders/p3-homologacao.txt`; veredito de release em `release-checklist.md`.

## Suíte

`npm test` exit **0** — **279 assertions** (124 originais intactas):

```
test:sim         33 + 63 + 28 passed  ·  smoke OK
test:assistant   credential        21 passed, 0 failed   (+6: reserva do rodapé)
                 session-manager   30 passed, 0 failed   (+2: chave recusada)
test:spike       protocol          33 passed, 0 failed
                 session           31 passed, 0 failed   (+2: 1007/1008 ambíguos)
                 worklets          19 passed, 0 failed
                 audio-and-safety  21 passed, 0 failed
```

## O bloqueio B1 caiu: Docker homologado

O Docker **estava** instalado, em caminho por-usuário (`%LOCALAPPDATA%\Programs\DockerDesktop`)
e não no padrão de *Program Files* — foi por isso que o bloco anterior o deu como indisponível.

| O quê | Nível | Resultado |
|---|---|---|
| `docker compose config` | LOCAL | ✔ publica `127.0.0.1:8880` → 80 |
| `docker build` (multi-stage, `--mode production`) | LOCAL | ✔ |
| Smoke das 5 URLs do workflow | LOCAL | ✔ 5/5 em 200 |
| Helper presente nos dois bundles **da imagem** | LOCAL | ✔ |
| `/spike/` e `/openspec/` servidos? | BROWSER | ✔ **404** nos dois |
| Credencial em qualquer caminho da imagem | LOCAL | ✔ nenhuma |
| Site da imagem no navegador | BROWSER | ✔ helper monta, 0 erro próprio |

**Isto prova a imagem, não a hospedagem.** Nenhuma VPS foi tocada.

## Navegador — bundle fresco a cada mudança

| O quê | Resultado |
|---|---|
| Modelador 1280×860 | 0 erro de console |
| Clique no canvas com o painel **aberto** | seleciona normalmente (o painel não é modal) |
| Viewer 1280×860 | 0 erro de console |
| **Simulação em lote com o painel aberto** | ✔ 30 replicações, throughput 0,1762, heatmap em 185 elementos |
| Barra da simulação responde com o painel aberto | ✔ |

## 375 px — resolvido, e o primeiro conserto estava errado

| Situação | Reserva | Painel | Barra | Sobrepõe? |
|---|---|---|---|---|
| Antes (P2) | — | …802 | 747–798 | **sim** |
| 1ª tentativa, teto fixo de 120 px, barra **expandida** | 144 | 211–668 | 533–798 | **sim** — cobria o cabeçalho, que é onde fica o botão de recolher |
| Agora, barra colapsada | 75 | 280–737 | 747–798 | não |
| Agora, barra expandida | 289 | 66–523 | 533–798 | não |

Cobrir o único jeito de recolher a barra é, na prática, **travar o modelador** — por isso o teto
fixo foi descartado. A conta virou `src/assistant/layout.js`, com 6 testes.

## Dois defeitos achados pela auditoria

**1. Chave inválida era reportada como erro de configuração.** O Google usa `1007` tanto para
"modalidade não suportada" quanto para "API key not valid", e `1008` tanto para cota quanto para
"unregistered callers". Para quem traz a própria chave, o caso de chave errada é o mais comum — e
a mensagem mandava procurar defeito no lugar errado. Agora o texto do fechamento decide.
Provado na imagem reconstruída: *"a chave foi recusada"* + *"confira a chave em
aistudio.google.com…"*.

**2. O removedor de comentários das varreduras estava quebrado em silêncio.** O repositório fica
com CRLF no disco e, em JavaScript, `.` **não casa `\r`** — então `/\/\/.*$/` nunca casava o fim
da linha e o comentário sobrevivia. A varredura acusava prosa e, pior, poderia deixar de acusar
código real depois de qualquer ajuste. Uma implementação só, em `tools/test-harness.mjs`.

## Dois riscos de publicação encontrados

**O botão de deploy não existiria.** `workflow_dispatch` só é oferecido para workflow presente na
branch **default**, e o arquivo está só em `ImproveSimulation`. O CI rodaria no push; o deploy não
teria como ser disparado. Não resolvi — exige push/merge, fora da autorização.

**Compose v1 × v2.** O passo de deploy usava `docker-compose` (nome do binário v1, aposentado).
Resolvido: detecta qual existe e falha nomeado se nenhum estiver.

## Teste manual — continua sendo do dono

Inalterado desde o P2, e agora é o **último impedimento técnico** antes de publicar:
seção *Teste manual* acima. São 2 minutos com `npm run dev`.
