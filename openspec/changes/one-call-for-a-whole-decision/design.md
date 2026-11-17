# Decisões — uma chamada para a decisão inteira

## D1. A forma do pedido é a forma da frase do aluno

`criar_decisao({ pergunta, depoisDe, tipo, caminhos: [{ rotulo, passos }] })`.

- `pergunta` é o rótulo do gateway (*"Componentes suficientes?"*) — o que o aluno fala como
  pergunta;
- cada caminho tem `rotulo` (a resposta que leva por ali) e `passos`, na ordem;
- `tipo` é o tipo do gateway, com `ExclusiveGateway` como padrão — *"se… senão"* é exclusivo, e é
  isso que o aluno descreve. Paralelo e inclusivo entram por aqui, escolhidos **pelo modelo**.

Por que não um verbo de árvore genérica (decisão dentro de decisão, N níveis): o resultado teria de
devolver a árvore inteira e seria cortado pelo teto do corpo (4000 caracteres), e o aluno que fala
descreve **um** nível por frase. Decisão dentro de um caminho é outra chamada — e, a essa altura,
o modelo já tem o id do elemento onde ela entra.

## D2. Por dentro são os três verbos que já existem

```
criar_elemento(tipo: gateway, nome: pergunta, depoisDe)   → o gateway
  para cada caminho:
    ramificar(decisao, tipo/nome do 1º passo, rotulo)      → abre e ROTULA a seta
    criar_sequencia(depoisDe: ramo, passos: resto)         → completa o caminho
```

Nada de `appendShape` próprio, nada de rótulo escrito por fora. Isso não é economia de linhas: é o
que garante que a decisão desenhada numa chamada seja **idêntica** à desenhada em seis — a vaga do
`autoPlace`, o encadeamento, o gêmeo recusado, o rótulo da seta no mesmo comando (T12) e a recusa
nomeada de cada caso continuam vindo de quem já foi provado.

⚠ E o rótulo da seta continua **só** em `ramificar`: rotular depois exigiria o id da ligação, que é
a única coisa do desenho que o aluno nunca diz — e que morre a cada desfazer (incidente de
2026-11-17).

## D3. O gateway encadeia; os caminhos ramificam

O gateway entra no fluxo como qualquer elemento (`depoisDe`, encadeando) — *"e então uma decisão"*
é a próxima etapa do caminho, não um segundo caminho. Já o primeiro elemento de cada caminho nasce
como **ramo rotulado** do gateway, que é o que `ramificar` faz.

Essa assimetria é a regra que custou uma sessão ao vivo (2026-11-15) e está em `criar_elemento`:
*"depois de X"* encadeia; ramo só quando pedido.

## D4. Falha num galho não derruba a árvore

- O **gateway** falha ⇒ lança. Nada foi desenhado, e a recusa nomeada é o resultado.
- Um **caminho** falha ⇒ retorna o que entrou, com `parou: { caminho, rotulo, passo, erro,
  motivo }`. Os caminhos anteriores e o gateway ficam.

Mesmo motivo mecânico da fila: exceção vira `{ok:false}` no despachante e o corpo é **descartado**
— o modelo narraria o contrário do que o aluno está vendo na tela.

⚠ **Rótulo vazio é recusa de ENTRADA, conferida antes de desenhar qualquer coisa.** Se o terceiro
caminho vem sem rótulo, a decisão nem começa: metade de uma decisão na tela, por um erro que estava
na chamada desde o início, seria o pior dos dois mundos.

## D5. Tetos: 4 caminhos, e o total de passos do teto da fila

Quatro caminhos porque uma decisão de aula tem dois ou três, e cinco saídas num exclusivo é um
desenho que o aluno não consegue ler. E o total de elementos (gateway + todos os passos) respeita
o mesmo teto da fila (12), pelo mesmo motivo: o resultado volta ao modelo e é pago pela cota.

Acima de qualquer um dos dois: erro nomeado dizendo o teto, para o modelo quebrar em
`criar_decisao` + `criar_sequencia` em vez de repetir a chamada.

## D6. Um resultado, com a tela uma vez e os caminhos contados

`{ decisao, caminhos: [{ rotulo, criados }], caminhosDaDecisao, rotulados, comandos, parou, tela }`.

- `caminhosDaDecisao` / `rotulados` vêm da leitura do desenho (`caminhosDe`), como em `ramificar`:
  é assim que o modelo descobre sozinho que a decisão ficou pela metade, **sem o nosso código
  decidir nada**;
- `comandos` é o total medido no `commandStack` — e uma decisão com dois caminhos de dois passos
  passa dos 10 que `desfazer` aceita por chamada, então vale a mesma frase que entrou na declaração
  do `desfazer` na change da fila: a volta sai em duas chamadas, e a primeira avisa;
- `tela` uma vez, no fim.

## D7. A decisão no meio de um fluxo HERDA a continuação antiga — e isso se conta, não se conserta

Medido no portão (2026-11-17): com a tarefa base já tendo saída, o gateway entrou no meio dela e
ficou com **três** caminhos — os dois rotulados e o antigo, sem rótulo.

É a consequência correta de D3: *"e então uma decisão"* encadeia, e encadear preserva o que vinha
depois. A alternativa seria o produto **desligar** o resto do processo do aluno pelas costas dele,
para que o desenho ficasse parecido com o ideal de livro.

Então o que o produto faz é **contar**: `caminhosDaDecisao` e `rotulados` saem da leitura do
desenho, e o modelo decide o que fazer — perguntar ao aluno qual é a resposta daquele caminho,
rotular, ou tirar. É a mesma regra de `ramificar`, e a mesma linha que separa fato de decisão em
todo este produto.

## D8. O que esta change NÃO ganha: a guarda de gêmeo em `ramificar`

A recusa de gêmeo (mesmo tipo, mesmo nome, colado no mesmo lugar) vive em `criar_elemento`.
`ramificar` não a tem — então dois caminhos que abrem a **mesma** tarefa não são recusados, e a
decisão herda isso.

Fica fora de propósito: dois caminhos de uma decisão podem levar a tarefas homônimas legítimas
("Avisar o cliente" nos dois lados), e inventar a recusa aqui seria o produto decidindo o processo
do aluno. Está medido numa prova determinística, para quem for mexer em `ramificar` saber que a
guarda não existe ali.
