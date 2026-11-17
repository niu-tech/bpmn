# Tarefas — uma chamada para a sequência inteira

> Por quê, com o número que abriu a change: `proposal.md`. Decisões: `design.md` (D1–D7).
> Medição de partida: `artifacts/medicao/construcao.json` — 8 chamadas, nossa fatia 1%.

## 1. A ferramenta

- [x] 1.1 `criar_sequencia({ passos, depoisDe, dentroDe })` em `tools/escrita.js`, chamando o
      **próprio** `criar_elemento` em laço (D2) — nenhum caminho novo de desenho
- [x] 1.2 Teto de 12 passos, erro nomeado dizendo quantos cabem (D4); lista vazia também recusa
- [x] 1.3 Falha depois do passo 1 **retorna** `{ criados, parou: { passo, motivo, erro } }`; falha
      no passo 1 **lança** a recusa nomeada (D3)
- [x] 1.4 Resultado com `criados`, `ligacoes`, `comandos` (do `commandStack`) e `tela` **uma** vez
      no fim (D5)

## 2. A declaração

- [x] 2.1 Declaração no catálogo com as três fronteiras — fila · `criar_elemento` · `ramificar`
      (D7), e **sem** tocar o prompt estável
- [x] 2.2 Teste do teto do prompt: o estável continua onde está (nenhum caractere novo)
- [x] 2.3 Apresentador: linha própria da fila (*"desenhei a fila: 6 passos"*), porque a frase de
      `criar_elemento` fala de um elemento só

## 3. Provas determinísticas (sem rede, sem chave)

- [x] 3.1 Fila de seis passos no dublê: seis criados, na ordem, cada um ligado ao anterior
- [x] 3.2 Falha no meio: três criados ficam, `parou.passo === 4`, e o desenho mantém os três
- [x] 3.3 Falha no passo 1 estoura com o erro nomeado, e o desenho não muda
- [x] 3.4 Teto: 13 passos recusa sem desenhar nada; `passos: []` recusa
- [x] 3.5 O resultado tem **uma** `tela` e um `comandos` ≥ número de passos
- [x] 3.6 Guardrails continuam verdes: nenhum nome de ferramenta citado como literal fora do
      catálogo, e o novo nome entra no mapa de ferramentas que escrevem

## 4. Portão (sem cota, bpmn-js de verdade)

- [x] 4.1 Fila de seis passos num diagrama novo: dez formas, nove ligações, **zero** órfãos
- [x] 4.2 Desfazer a quantidade que o resultado informou devolve o desenho ao estado de antes
- [x] 4.3 A tela conta a fila: o selo de escrita aparece e a linha de construção diz a contagem
      medida, não o número de chamadas

## 5. Ao vivo, com o número antes e depois

- [x] 5.1 O **mesmo** pedido do dono (`artifacts/medicao/construcao.json`) contra o dev server:
      medir chamadas e formas, e comparar com as 8 de 2026-11-17
- [x] 5.2 Sessão viva de voz/texto em que o modelo **escolhe** a fila sem ninguém dizer o nome da
      ferramenta — é a prova de que a declaração basta (D7)
- [x] 5.3 Registrar a comparação no `proposal.md`: chamadas antes × depois, e o que o número
      desmente. ⚠ A previsão desta caixa ("nossa fatia continua ~1%") saiu **errada por motivo
      bom**: a fatia virou 3% porque o TOTAL encolheu, não porque a nossa escrita piorou — ela
      continua em 0,02 s. Fatia é razão; quem promete em razão promete o denominador alheio

## 6. Registro

- [x] 6.1 `openspec/changes/README.md` com a linha da change (este repo não tem board separado)
- [x] 6.2 `openspec/roadmap.md`: a nota de que o custo por chamada é do modelo, e que a alavanca
      é a contagem

## Ao vivo (2026-11-17) — o mesmo pedido, antes e depois

`tools/medir-construcao.mjs --so-local`, com o **mesmo** pedido de palavras da medição anterior
(*"monte, num pool novo chamado Compras, um processo de compra com seis passos em sequência…"*) e
sem citar nome de ferramenta nenhum:

| | antes (2026-11-17, manhã) | depois |
|---|---|---|
| **chamadas** | **8** | **2** |
| verbos escolhidos pelo modelo | `criar_pool` + 7× `criar_elemento` | `criar_pool` + **`criar_sequencia`** |
| formas | 2 → 10 | 2 → 10 |
| **do envio ao último elemento** | **3,5 s** | **1,4 s** |
| nossa escrita (mediana) | 0,01 s | 0,02 s |
| volta ao modelo (mediana) | 0,46 s | 1,38 s |
| nossa fatia | 1% | 3% |

**O modelo escolheu a fila sozinho** — é o que o campo `verbos` registra, e é a prova de que a
declaração basta (D7, e a mesma lição de `ramificar`). O pedido foi palavra por palavra o de
antes.

⚠ **E a volta ao modelo por chamada TRIPLICOU** (0,46 s → 1,38 s), porque a chamada da fila carrega
seis passos em vez de um. É por isso que a conta certa é o **total**, nunca o custo por chamada:
duas voltas grandes custam menos que oito pequenas. Pela mesma razão a change não promete
segundos — ela promete menos voltas.

## E no PUBLICADO, depois do deploy (2026-11-17, 14h50)

`tools/medir-construcao.mjs --so-publicado` contra `niu-tech.github.io/bpmn`, com o mesmo pedido:
**2 chamadas** (`criar_pool` + `criar_sequencia`), **1,4 s**, 2 → 10 formas — idêntico ao local.

⚠ **E foi esta medição que achou um defeito de ESTEIRA, não de produto.** A primeira corrida contra
o publicado devolveu `verbos: [criar_pool, 8× criar_elemento]` — o código de ANTES da fila. Causa:
o CI do commit anterior (`0eb5417`) havia reprovado no passo da bateria com *"o navegador nao abriu
a porta de depuracao 9632 em 15000ms"*, no 25º cenário, depois de 24 navegadores terem subido na
mesma corrida (runner sob carga). Como **o job de deploy depende do build**, o site ficou parado no
commit anterior **o dia inteiro**, com as três frentes provadas ao vivo dentro do repositório e fora
do ar.

A lição é a do binário velho, aplicada ao site: **teto de instrumento curto demais não pega um
defeito antes — ele para a publicação por um motivo que não é do código.** Consertado em `a52b569`
(45 s na esteira, 15 s aqui, onde porta lenta é Edge zumbi). E a prova de que era intermitência: a
corrida da própria fila passou com o teto antigo, 4 minutos antes.

## O achado do portão: a fila longa volta em DUAS chamadas de desfazer

Seis passos custam **12** comandos no `commandStack`, e `desfazer` tem teto de **10 por chamada**
— de propósito (dívida E1: a pilha é a MESMA do aluno, e um lote maior apagaria o trabalho que o
agente não viu). O portão não afrouxou o teto: ele passou a afirmar o contrato honesto —

- a primeira chamada desfaz 10 e **avisa** (`aindaDaParaDesfazer`);
- a segunda fecha, e o desenho volta ao estado exato de antes da fila (`voltouTudo`).

E o modelo precisa saber disso **antes** de tentar: a frase entrou na declaração de `desfazer`.
Fila que só volta pela metade é pior que fila que não volta.

## Provas

- `npm test` — a fila tem cinco provas determinísticas em `src/assistant/__tests__/escrita.mjs`
  (encadeamento lido do desenho, falha no meio, falha no primeiro passo, teto, uma tela só)
- Portão sem cota, bpmn-js de verdade: *"a fila inteira numa chamada: seis passos encadeados, uma
  linha, um desfazer contado"* — `{seisNumaChamada, encadeou, seloDesenhando, umaLinha,
  voltouTudo, avisouQueFalta}` todos verdadeiros, `orfaos: []`, `sobrepostos: []`,
  `atravessadas: []`, `emQuantasChamadas: 2`
- Ao vivo: `artifacts/medicao/construcao.json`
