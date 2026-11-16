## Why

O dono pediu (2026-11-12) conversar com o agente e **montar o diagrama**: descrever o processo e
ele ajudar, sugerir a melhor representação em BPMN, saber de qual bloco se está falando e ensinar
no caminho.

Hoje o ajudante só fala. Ele não enxerga o diagrama (a change irmã resolve), e não tem como tocar
nele. Sem ferramentas, "me ajude a montar" termina em texto que o aluno transcreve à mão para o
modelador — que é exatamente o trabalho que a conversa deveria poupar.

A matéria-prima já existe e é estável: o `bpmn-js` expõe `elementRegistry`, `modeling`,
`elementFactory`, `bpmnFactory`, `canvas` e `selection`; a simulação em lote expõe `buildGraph`,
`runBatch` e `computeMetrics`. Nada precisa ser inventado — precisa ser **declarado como
ferramenta e governado**.

## What Changes

Duas famílias, com portões diferentes.

**Leitura (todo perfil, inclusive o viewer).**

- `descrever_diagrama` — processo, contagem por tipo, raias, pools.
- `buscar_elemento` — por nome ou tipo; é assim que o agente responde "qual bloco?" quando não há
  seleção.
- `detalhar_elemento` — tipo, nome, entradas e saídas de um `id`.
- `resumir_simulacao` — última corrida: tempo médio, gargalo, utilização por raia.

**Escrita (só no modelador, e só pela pilha de undo do bpmn-js).**

- `criar_elemento` — tarefa, evento, gateway, com nome e posição relativa a um elemento âncora.
- `conectar` — fluxo de sequência ou de mensagem entre dois `id`s.
- `renomear` — rótulo de um elemento.
- `remover` — **exige confirmação na interface** antes de executar.

Toda escrita passa por `modeling`, nunca por XML: entra no Ctrl+Z do aluno. Toda escrita devolve
ao modelo o que mudou, para ele descrever ao aluno o que fez.

**Ensinar continua sendo conversa.** Nenhuma ferramenta "explica BPMN" — isso é o prompt. As
ferramentas existem para o agente **ver** e **fazer**, não para terceirizar o que o modelo já sabe.

## Impact

- Afeta: `src/assistant/agent/**` (catálogo e política da change irmã), `src/app.js` (expor o
  modeler ao ajudante), `src/viewer.js` (expor o viewer, só leitura).
- Novos: `src/assistant/tools/**` (uma função por ferramenta, pura sobre a API do bpmn-js).
- Testes: suíte `.mjs` com um `elementRegistry`/`modeling` dublê; cenários de bateria que mandam
  o modelo criar e conectar, e verificam o DOM/registro depois.
- **Depende de** `give-bpmn-assistant-an-agent-harness` (catálogo, política, despacho e contexto).
- Não afeta: simulação em lote (só é lida), deploy, BYOK.

## Risco declarado

Agente que edita o diagrama do aluno pode **estragar o trabalho dele**. As três contenções:
undo nativo do bpmn-js, confirmação obrigatória para remoção, e a regra de que o agente só age
quando o modelo chamou a ferramenta — nunca por palpite do código.
