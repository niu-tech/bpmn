# Uma chamada para a decisão inteira

> Decisões: `design.md` (D1–D6). Plano: `tasks.md`. Mede o mesmo que a change anterior
> (`one-call-for-a-whole-sequence`): **a contagem de chamadas**, nunca segundos.

## Why

A fila fechou o caso mais comum, e sobrou o segundo: a **decisão com os caminhos dela**. Medido
hoje, com o pedido em palavras de quem está aprendendo (sem citar ferramenta nenhuma):

> *"Num pool novo chamado Suporte, monte este processo: o chamado chega, o atendente analisa o
> chamado, e então uma decisão se os componentes são suficientes; se sim, montar a base e entregar
> para o dev, e aí o processo termina; se não, gerar o resultado e entregar ao cliente, e aí
> termina também."*

Baseline (dev server, `artifacts/medicao/construcao.json`): **6 chamadas** · 2,8 s · 2 → 10 formas.
Os verbos que o modelo escolheu, na ordem:

```
criar_pool · criar_sequencia · ramificar · criar_elemento · ramificar · criar_elemento
```

A fila cobriu o tronco numa chamada. O que ficou caro é a **árvore**: um `ramificar` por caminho,
mais uma chamada por elemento depois de cada ramo. E é o pedaço que o aluno descreve de um jato —
*"se sim, …; se não, …"* é **uma** frase, não quatro.

## A causa é a mesma da fila, com um galho a mais

`ramificar` abre **um** caminho, e isso está certo: o rótulo é informação que só o aluno dá. Mas o
que vem **depois** do primeiro elemento de cada caminho volta a depender do id que a chamada
anterior devolveu — a mesma corrente de ida-e-volta que a fila desfez no tronco, agora repetida
uma vez por galho.

## What Changes

- **`criar_decisao` nasce**: uma chamada recebe a pergunta da decisão e a lista de caminhos, cada
  um com o seu rótulo e os seus passos. Desenha o gateway, abre cada caminho **já rotulado** e
  completa cada um como uma fila.
- **Composição, não desenho novo**: por dentro são os três verbos que já existem e já estão
  provados — `criar_elemento` (o gateway), `ramificar` (o primeiro elemento de cada caminho, com o
  rótulo da seta) e `criar_sequencia` (o resto do caminho).
- **Falha num galho não derruba a árvore**: o que entrou fica, e o resultado diz **em qual
  caminho** e **em qual passo** parou.
- **A contagem de caminhos continua sendo FATO do resultado**, como `ramificar` já fazia: decisão
  com um caminho só está pela metade, e quem decide o que fazer a respeito é o modelo.
- **O ensino vai na declaração** (terceira vez, mesma razão): o prompt estável fica onde está.

## O que a medição disse depois (2026-11-17)

Mesmo pedido, mesmas palavras: **6 chamadas → 3**, e a espera do aluno de **2,8 s → 1,9 s**. Os
verbos, registrados pelo instrumento: `criar_pool` · `criar_sequencia` · **`criar_decisao`** —
ninguém disse o nome da ferramenta ao modelo.

Somando as duas changes da frente, no pedido que o dono descreveu por voz: o tronco saiu de sete
chamadas para uma, e a árvore de quatro para uma.

## Non-Goals

- **Não promete segundos.** A volta ao modelo é dele e da rede do aluno.
- **Não inventa rótulo.** Caminho sem rótulo é recusado — a resposta que leva por ali é informação
  do aluno, e adivinhar *"Sim/Não"* seria o produto decidindo o processo dele.
- **Não junta os caminhos de volta** (gateway de convergência): continua fora, como na change do
  gateway.
- **Não decide o TIPO da decisão.** O padrão é exclusivo porque é o que o aluno descreve com
  *"se… senão"*; paralelo e inclusivo entram por parâmetro, escolhidos pelo modelo.
- **Nada de aninhar decisão dentro de decisão** nesta change: uma decisão dentro de um caminho é
  outra chamada, e a árvore inteira numa chamada só viraria um resultado que o teto do corpo corta.
