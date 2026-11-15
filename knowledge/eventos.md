---
sourceId: eventos
title: Eventos — o que acontece, e quando
group: fundamentos
tags: [evento, início, fim, intermediário, mensagem, temporizador, borda]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:tipos-por-posicao -->
Localizador: Eventos › posição no fluxo
Citação: [fonte:eventos:tipos-por-posicao]

Evento é algo que **acontece** e muda o rumo do processo. A posição no fluxo dá o primeiro nome:
**início** (círculo de linha fina) dispara uma instância do processo; **intermediário** (círculo
de linha dupla) acontece no meio, esperando ou lançando algo; **fim** (círculo de linha grossa)
encerra aquele caminho. Um processo pode ter vários fins — e ter vários é normal quando os
desfechos são diferentes de verdade ("pedido entregue" e "pedido cancelado" não são o mesmo fim).
<!-- /chunk -->

<!-- chunk:tipos-por-gatilho -->
Localizador: Eventos › gatilho
Citação: [fonte:eventos:tipos-por-gatilho]

O símbolo dentro do círculo diz o **gatilho**: envelope para mensagem, relógio para temporizador,
raio para erro, triângulo para sinal, entre outros. Um evento que **espera** o gatilho é de
captura (símbolo vazado); um que **provoca** o gatilho é de lançamento (símbolo preenchido). É
essa dupla — posição e gatilho — que separa "chegou o pagamento" de "avisar que o pagamento
chegou", duas coisas que o desenho precisa distinguir para a leitura não depender do nome.
<!-- /chunk -->

<!-- chunk:borda -->
Localizador: Eventos › de borda (interrompe ou não)
Citação: [fonte:eventos:borda]

Evento desenhado **na borda de uma atividade** vigia aquela atividade enquanto ela dura. Com linha
cheia ele **interrompe**: a atividade é abandonada e o fluxo segue pelo caminho do evento (o caso
clássico é o temporizador de prazo). Com linha tracejada ele **não interrompe**: a atividade
continua e um caminho paralelo nasce (o caso clássico é "o cliente ligou perguntando"). Trocar um
pelo outro muda o processo, e é um dos erros mais comuns em diagramas de aula.
<!-- /chunk -->
