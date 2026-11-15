---
sourceId: fluxos
title: Fluxos — sequência, mensagem e associação
group: fundamentos
tags: [fluxo, sequência, mensagem, associação, conexão]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:sequencia -->
Localizador: Fluxos › de sequência
Citação: [fonte:fluxos:sequencia]

A seta de linha cheia com ponta preenchida é o **fluxo de sequência**: diz a ordem dentro de
**um mesmo processo**. Ela não atravessa a fronteira de um pool — esse é o erro mais comum de
quem começa. Pode ser condicional (losango pequeno na origem) ou padrão (barra cortando a
linha), e as duas formas só fazem sentido saindo de uma atividade ou de um gateway.
<!-- /chunk -->

<!-- chunk:mensagem -->
Localizador: Fluxos › de mensagem
Citação: [fonte:fluxos:mensagem]

A linha **tracejada** com círculo na origem e ponta vazada é o **fluxo de mensagem**: ele liga
participantes **diferentes** (pools diferentes), e representa algo que foi enviado — um pedido,
um comprovante, uma resposta. Dentro do mesmo pool ele não existe. Quando o desenho precisa de
uma seta entre dois pools, é esta; quando precisa de ordem dentro de um pool, é a de sequência.
<!-- /chunk -->

<!-- chunk:associacao -->
Localizador: Fluxos › associação
Citação: [fonte:fluxos:associacao]

A linha pontilhada fina liga **artefatos** (anotação, objeto de dados) ao elemento que eles
explicam. Não é caminho: nada "anda" por ela, e ela não muda a ordem de nada. É a forma correta
de pendurar um comentário ou dizer qual documento entra e sai de uma tarefa, sem inventar uma
seta de sequência que mentiria sobre o fluxo.
<!-- /chunk -->
