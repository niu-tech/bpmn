# Decisões — mostrar o trabalho enquanto o agente desenha

## M1 — O sinal vai no CANVAS, porque é onde a pessoa está olhando

Todo elemento criado ou alterado pelo agente recebe um **destaque de um piscar** (≈600 ms) e a
tela rola até ele — o `scrollToElement` já acontece; o que falta é o olho saber **qual** mudou.

**Por que no canvas e não só no chat:** quem pede *"desenha o meu processo"* olha o desenho. O
chat é o canal secundário nesse momento — e era o único que falava.

⚠ O destaque **não** é `setColor`: cor entra no DI e fica no arquivo do aluno. É uma classe CSS no
`g.djs-element`, que some sozinha e não existe no XML.

## M2 — Uma mensagem viva, não uma linha por chamada

Enquanto um turno de construção corre, a conversa mostra **uma** mensagem que cresce:

> *montando o processo — 6 elementos*

As linhas individuais continuam existindo (elas são a prova de o que foi feito), mas **agrupadas
sob essa mensagem**: a conversa não rola doze vezes enquanto a pessoa lê.

⚠ **Alternativa recusada: esconder as linhas de ferramenta durante a construção.** Elas são o que
permite o aluno (e o portão) saber o que o agente fez — foi por isso que nasceram (H3). Agrupar
mantém a prova e devolve a legibilidade; esconder trocaria um problema pelo outro.

## M3 — O selo distingue PENSANDO de DESENHANDO

Já existe estado próprio para ferramenta rodando (`tool`). O que falta é o rótulo dizer o que está
acontecendo: *"desenhando…"* enquanto há escrita em curso, *"pensando…"* enquanto o modelo decide.

**Por que importa para quem espera:** três segundos de "pensando" e três segundos de "desenhando"
são a mesma espera com significados diferentes — e a segunda explica por que o canvas está mudando
sozinho.

## M4 — Autocorreção é ajuste, não erro

`desfazer` **dentro de um turno em que o agente também criou** passa a ser apresentado como ajuste
(*"ajustei — refiz 2 elementos"*). Fora disso, continua sendo o desfazer de sempre.

**Por quê:** na sessão medida, as duas linhas de desfazer eram o modelo consertando a própria
tentativa de abrir um segundo caminho no gateway. O aluno leu "desfiz" duas vezes e achou que algo
quebrou. A informação é a mesma; o que muda é não acusar o produto de um erro que não houve.

⚠ Isso **não** é esconder desfazer: o número continua lá, e o aluno pode ver o que saiu e voltou.

## M5 — A latência é medida, não prometida

`tools/medir-construcao.mjs`: dirige o mesmo pedido de construção contra o local e contra o
publicado, e devolve por chamada — `nossa execução` × `espera pela volta do modelo` —, com mediana
e pior caso.

**Por que medir antes:** o dono viu 3–5 s por bloco em produção e nós medimos 0,4–1,0 s no local.
Se a diferença for toda do transporte, esta change não pode prometer velocidade — e o número é o
que separa "ficou mais rápido" de "ficou legível". Também é o que diz se vale a pena pedir ao
modelo que agrupe chamadas.

## M6 — O que o portão mede

- durante uma construção de ≥ 4 elementos, a conversa tem **uma** mensagem de construção viva, e
  não uma por elemento;
- o elemento criado recebe a classe de destaque e **a perde** depois (destaque que fica é sujeira);
- o selo diz *desenhando* enquanto há escrita em curso;
- um `desfazer` no meio da construção aparece como ajuste;
- e, ao fim, as linhas detalhadas **continuam acessíveis** — a prova não pode sumir.

⚠ Princípio XIII: *"não há doze mensagens"* é verdade num chat vazio. O portão afirma **antes** que
a construção criou os elementos (contagem no desenho) e **depois** que a conversa tem uma
mensagem viva com o número certo dentro.
