# Validação — o que foi provado, o que foi simulado, o que está bloqueado

Data: 2026-11-10. Máquina: Windows 11, node v24.14.1, npm 11.11.0.

A distinção que importa: **mock que passa não é o Google dizendo sim.** Cada item abaixo diz em
que nível foi provado.

## Níveis

| Nível | Significado |
|---|---|
| **REAL-LOCAL** | Executado nesta máquina, com o código do repositório. Determinístico. |
| **REAL-BROWSER** | Carregado e exercido num navegador de verdade, com evidência visual. |
| **MOCK** | Protocolo exercido contra um duplo que fala o shape do fio. Prova o NOSSO lado. |
| **BLOQUEADO** | Não executado, com o motivo nomeado. Nada aqui é dado como funcionando. |

## Baseline antes de qualquer alteração

**REAL-LOCAL** — as quatro suítes existentes, intocadas:

```
node src/batchsim/__tests__/validate.mjs                 -> 33 passed, 0 failed
node src/batchsim/__tests__/validate-deterministic.mjs   -> 63 passed, 0 failed
node src/batchsim/__tests__/validate-pizza.mjs           -> 28 passed, 0 failed
node src/batchsim/__tests__/smoke-refactor.mjs           -> OK (exit 0)
```

## Depois da change

**REAL-LOCAL** — `npm test` (que antes era `exit 1`), exit **0**:

```
test:sim    33 + 63 + 28 passed, 0 failed · smoke OK
test:spike  protocol          24 passed, 0 failed
            session           23 passed, 0 failed
            worklets          19 passed, 0 failed
            audio-and-safety  19 passed, 0 failed
                              ------------------------
                              85 novas, 209 no total
```

## Prova A — microfone → Live

| O quê | Nível | Resultado |
|---|---|---|
| Decimação 48 kHz → 16 kHz, 1920 amostras = 1 quadro de 640 (40 ms) | REAL-LOCAL | ✔ o **arquivo do worklet** é executado com os globais esbulhados, não uma cópia da conta |
| Fase atravessa chamadas (15 blocos de 128 fecham 1 quadro) | REAL-LOCAL | ✔ |
| 44,1 kHz: ~250 quadros em 10 s, sem erro acumulado | REAL-LOCAL | ✔ |
| Buffer **transferido** (zero-cópia) junto da mensagem | REAL-LOCAL | ✔ |
| Fundo de escala assimétrico, sem estouro | REAL-LOCAL | ✔ |
| Quadro sai com `mimeType: audio/pcm;rate=16000` | MOCK | ✔ |
| `getUserMedia` só por gesto e só em contexto seguro | REAL-LOCAL | ✔ (http remoto → `insecure-context` **sem pedir permissão**) |
| Captura real do microfone contra o Live | **BLOQUEADO** | exige chave do aluno — ver B2 |

## Prova B — Live → alto-falante

| O quê | Nível | Resultado |
|---|---|---|
| Worklet de reprodução **carrega num navegador real** e o contexto fica `running` | **REAL-BROWSER** | ✔ `renders/spike-page-boot.jpg`, log `reprodução pronta, contexto running` |
| Prime: silêncio antes do buffer de partida, áudio depois | REAL-LOCAL | ✔ |
| Underflow **contado** e volta a esperar o prime | REAL-LOCAL | ✔ |
| Overflow descarta o mais antigo; buffer não passa do teto (8 s) | REAL-LOCAL | ✔ |
| `flush` descarta o não-reproduzido e limpa as marcas | REAL-LOCAL | ✔ |
| Marca de "primeira amostra audível" dispara na hora certa | REAL-LOCAL | ✔ |
| Reamostragem 24 kHz → 48 kHz consome na proporção certa | REAL-LOCAL | ✔ |
| Áudio de verdade vindo do modelo | **BLOQUEADO** | exige chave — ver B2 |

## Prova C — pergunta digitada → resposta textual estruturada

| O quê | Nível | Resultado |
|---|---|---|
| Setup pede `AUDIO` e nunca `TEXT` por default | REAL-LOCAL | ✔ |
| `entregar_resposta` declarada com `texto` obrigatório | REAL-LOCAL | ✔ |
| Pergunta sai por `realtimeInput.text` | MOCK | ✔ |
| Texto chega pelos **argumentos** da função e o turno fecha | MOCK | ✔ |
| **Toda** chamada de tool recebe `toolResponse` | MOCK | ✔ (inclusive tool que não é a entrega) |
| Entrega repetida é respondida e descartada (texto não duplica) | MOCK | ✔ |
| Turno sem entrega cai na transcrição e **diz** que é fallback | MOCK | ✔ |
| Turno vazio **não** inventa resposta | MOCK | ✔ |
| `IN_PROGRESS` não fecha o turno; só `IDLE` fecha | MOCK | ✔ |
| Três turnos seguidos, em ordem, sem resto de um no outro | MOCK | ✔ |
| Resposta de verdade do `gemini-3.8-live` | **BLOQUEADO** | exige chave — ver B2 |

## Estados, falhas e credencial

| O quê | Nível | Resultado |
|---|---|---|
| Nada sai antes do `setupComplete` (fila drenada depois) | MOCK | ✔ |
| Setup não aceito no prazo → `timeout` (não trava em `connecting`) | MOCK | ✔ |
| Silêncio do servidor depois do setup → `timeout` | MOCK | ✔ |
| `1007` nomeado e **sem** retry | MOCK | ✔ |
| `1011`/`1008` → `quota`, **sem** retry | MOCK | ✔ |
| Queda comum: recuo exponencial e **para no teto** | MOCK | ✔ (original + 2 tentativas, depois erro visível) |
| `close()` nosso não reconecta | MOCK | ✔ |
| Chave na URL do socket **nunca** aparece no log | MOCK + REAL-LOCAL | ✔ |
| Mascaramento cobre URL, chave solta, `Error` e objeto | REAL-LOCAL | ✔ |
| `looksLikeSecret` não acusa a própria saída mascarada | REAL-LOCAL | ✔ |

## Isolamento spike ↔ produto (design D6)

| O quê | Nível | Resultado |
|---|---|---|
| Build de produção compila e emite **só** `bundle.js` + `viewer.js` | REAL-LOCAL | ✔ saída em diretório temporário; `dist/` versionado **intocado** |
| Nenhum marcador do spike nos bundles de produção | REAL-LOCAL | ✔ `grep` por `BidiGenerateContent`/`entregar_resposta`/`bpmn-capture`/`bpmn-playback`: 0 ocorrências |
| Nenhum arquivo de `src/` referencia `spike/` | REAL-LOCAL | ✔ |
| Nenhum arquivo de `spike/` importa de `src/` | REAL-LOCAL | ✔ |
| Entry do spike é condicional a `BPMN_SPIKE` | REAL-LOCAL | ✔ |
| `Dockerfile` não copia nem liga o spike | REAL-LOCAL | ✔ |
| Build **com** `BPMN_SPIKE=1` compila e emite `spike.js` + 2 worklets | REAL-LOCAL | ✔ |
| Modelador e viewer continuam carregando com o spike ligado | **REAL-BROWSER** | ✔ diagrama renderizado, paleta e token simulation presentes, **zero erro de console** |

### Defeito encontrado e corrigido aqui (vale registrar)

O webpack trata arquivo de worklet como **asset** e o copia **verbatim**. A primeira versão do
`capture-worklet.js` importava a matemática de `pcm.js`: o `import` **sobrevivia** no arquivo
emitido e o módulo importado **não** era emitido ao lado — `addModule` daria 404 em runtime, e a
prova A quebraria só no navegador, depois de o teste ter passado. Os worklets passaram a ser
autossuficientes, e o teste `worklets.mjs` **executa o arquivo do disco** com os globais do
AudioWorkletGlobalScope esbulhados. Verificado depois: os dois assets emitidos têm **0 imports
pendentes**.

Outros dois defeitos pegos por teste, ambos no código novo: o replacer de `String.replace`
recebendo o **offset** como se fosse o grupo (produzia `14***` em vez de `***`), e
`primeMs: 0` virando 120 ms por causa de `||` num valor legitimamente zero.

## Bloqueios

### B1 — Docker não disponível nesta máquina
`docker` não está instalado/em execução aqui, então **não** foi possível construir a imagem nem
rodar o smoke test das cinco URLs do workflow. O que foi possível validar sem Docker: a conferência
linha a linha do `Dockerfile` contra o que o webpack realmente emite (as páginas e os diagramas
**precisam** ser copiados, e o `Dockerfile` já os copia), e o smoke equivalente contra o dev server
(`/`, `/viewer.html`, `/bundle.js`, `/pizza-collaboration.bpmn` → todos **200**).

### B2 — chave do Gemini não solicitada
Nenhuma chave foi pedida, usada, impressa ou gravada. Por consequência, ficam **não medidos**:

1. O servidor aceitar o nosso setup (`setupComplete`).
2. O 1007 ao pedir `responseModalities: TEXT` — hoje é evidência **de outro projeto** (E6), não
   nossa. A página do spike já tem o botão que mede isso.
3. CORS do `authTokens.create` a partir do navegador (**E12**) — a sonda está escrita e testada
   contra os três desfechos (`minted` / `cors-blocked` / `rejected`), mas **nunca** foi executada
   contra o endpoint real.
4. Conexão do WebSocket a partir de origem de navegador (**E13**, hipótese forte).
5. Áudio real nos dois sentidos, múltiplos turnos ao vivo e barge-in (**E14**).

### Roteiro para destravar B2 (quando houver chave)

```bash
npm run dev:spike        # http://localhost:8080/spike/
```

1. Colar a chave no campo e **Conectar** → esperado: estado `ready`.
2. **Perguntar** (prova C) → esperado: texto na caixa, `fallback: false` no log.
3. **Liberar áudio** → **Falar** (provas A e B) → esperado: quadros subindo, áudio voltando,
   transcrição dos dois lados.
4. Repetir 2 três vezes (múltiplos turnos) → esperado: três respostas, em ordem.
5. **Pedir saída TEXT** → esperado: `error(ws-closed:1007)`. **Registrar aqui o código real.**
6. **Sondar token efêmero** → registrar aqui o veredito (`minted` / `cors-blocked` / `rejected`).
7. Negar o microfone no diálogo do navegador → esperado: `error(mic-denied)`, texto segue vivo.
8. Desligar a rede no meio de um turno → esperado: `connecting`, até o teto, depois erro visível.
9. **Encerrar** → o indicador de microfone do navegador tem de **sumir**.

Antes de qualquer um desses passos: confirmar que `.gitignore` cobre `.env*` e `*.key`, e que a
chave não é colada em terminal, script ou commit.
