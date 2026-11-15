---
sourceId: gateways
title: Gateways — onde o caminho se divide e volta a juntar
group: fundamentos
tags: [gateway, exclusivo, paralelo, inclusivo, decisão, convergência]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:exclusivo -->
Localizador: Gateways › exclusivo (XOR)
Citação: [fonte:gateways:exclusivo]

O losango vazio (ou com "X") escolhe **um** caminho: as condições das setas de saída são
avaliadas e o fluxo segue por uma só. Convergindo, ele **não espera**: o que chegar passa. Duas
regras que evitam a maioria dos defeitos: toda saída condicional precisa de condição escrita, e
vale ter uma saída **padrão** (a barra cortando a seta) para o caso em que nenhuma condição dá
verdadeira — sem ela, a instância pode ficar sem caminho.
<!-- /chunk -->

<!-- chunk:paralelo -->
Localizador: Gateways › paralelo (AND)
Citação: [fonte:gateways:paralelo]

O losango com "+" divide o fluxo em caminhos que acontecem **ao mesmo tempo**, sem condição
nenhuma: todos saem. Convergindo, ele **espera todos** os caminhos que entram antes de seguir. O
erro clássico é abrir em paralelo e fechar com exclusivo: aí o processo segue na primeira
chegada e os outros ramos ficam órfãos. Abriu com "+", feche com "+".
<!-- /chunk -->

<!-- chunk:inclusivo-e-eventos -->
Localizador: Gateways › inclusivo e baseado em eventos
Citação: [fonte:gateways:inclusivo-e-eventos]

O **inclusivo** (losango com "O") libera **um ou mais** caminhos, conforme as condições — e, ao
convergir, espera exatamente os que foram abertos. É poderoso e difícil de ler: muita gente
prefere um paralelo com exclusivos dentro. O **baseado em eventos** (losango com pentágono) não
decide por condição: ele espera os eventos que vierem depois dele e segue pelo **primeiro que
acontecer** — é o jeito de modelar "o que vier primeiro: a resposta do cliente ou o prazo".
<!-- /chunk -->
