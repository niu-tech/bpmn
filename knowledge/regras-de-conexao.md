---
sourceId: regras-de-conexao
title: Regras de conexão — o que pode ligar em quê
group: modelagem
tags: [conexão, regra, ligação, válido, erro]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:quem-liga-em-quem -->
Localizador: Regras › quem liga em quem
Citação: [fonte:regras-de-conexao:quem-liga-em-quem]

Fluxo de sequência sai de evento de início, atividade, gateway ou evento intermediário, e chega em
atividade, gateway, evento intermediário ou evento de fim — sempre **dentro do mesmo pool**.
Evento de início não recebe seta; evento de fim não emite. Fluxo de mensagem liga **pools
diferentes**, e só encosta em pool, atividade ou evento de mensagem. Associação liga artefato a
elemento, e nunca participa do caminho.
<!-- /chunk -->

<!-- chunk:cada-caminho-termina -->
Localizador: Regras › todo caminho começa e termina
Citação: [fonte:regras-de-conexao:cada-caminho-termina]

Todo caminho aberto deveria chegar a um evento de fim, e todo elemento do fluxo deveria ser
alcançável a partir de um início. Elemento solto — sem entrada e sem saída — é quase sempre
engano de edição, e é a primeira coisa a procurar quando o diagrama "não fecha". O mesmo vale
para gateway que abre e nunca fecha: não é proibido pela notação, e costuma ser defeito.
<!-- /chunk -->
