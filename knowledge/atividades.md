---
sourceId: atividades
title: Atividades — o trabalho que alguém faz
group: fundamentos
tags: [atividade, tarefa, subprocesso, user task, service task, marcador]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:tarefa -->
Localizador: Atividades › tarefa e seus tipos
Citação: [fonte:atividades:tarefa]

Tarefa é a unidade de trabalho: um retângulo de cantos arredondados, com nome. O ícone no canto
superior esquerdo diz **quem ou o que** executa — pessoa (user), sistema chamado pelo processo
(service), script, envio e recebimento de mensagem, regra de negócio, trabalho manual fora do
sistema. Tarefa sem ícone é tarefa abstrata: válida, e menos informativa. Nome de tarefa em
**verbo no infinitivo + objeto** ("Conferir estoque") é a convenção que mais ajuda quem lê.
<!-- /chunk -->

<!-- chunk:subprocesso -->
Localizador: Atividades › subprocesso
Citação: [fonte:atividades:subprocesso]

Subprocesso é uma atividade que **contém** outro fluxo. Serve para esconder detalhe que não cabe
no nível atual: colapsado mostra um "+" e o leitor vê um passo; expandido mostra o miolo. Existe
também o **subprocesso de evento** (linha pontilhada), que não fica no fluxo: ele dispara quando o
evento dele acontece dentro do processo pai. Use subprocesso quando o passo tem vida própria —
não só para economizar espaço, porque esconder complexidade sem fronteira real confunde mais.
<!-- /chunk -->

<!-- chunk:marcadores -->
Localizador: Atividades › marcadores (repetição e múltiplas instâncias)
Citação: [fonte:atividades:marcadores]

Marcadores na base da atividade dizem **quantas vezes** ela acontece: a seta circular é laço
(repete enquanto a condição valer); três barras verticais são múltiplas instâncias paralelas
("para cada item do pedido, separar o item"); três barras horizontais, múltiplas instâncias em
sequência. Sem marcador, a atividade acontece uma vez por instância do processo. Desenhar um laço
com gateway e seta de volta também funciona — e é mais verboso; a escolha é de legibilidade.
<!-- /chunk -->
