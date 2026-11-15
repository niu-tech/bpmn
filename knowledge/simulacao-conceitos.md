---
sourceId: simulacao-conceitos
title: Simulação — o que o modelo responde quando roda
group: simulacao
tags: [simulação, token, evento discreto, cenário]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:token -->
Localizador: Simulação › tokens e eventos discretos
Citação: [fonte:simulacao-conceitos:token]

Simular um diagrama é fazer **instâncias** percorrerem o fluxo. A metáfora do token ajuda: cada
instância é uma ficha que entra no início, espera o tempo de cada atividade e escolhe caminho nos
gateways. O relógio não anda de segundo em segundo: ele **pula de evento em evento** (uma
atividade terminando, uma ficha chegando) — é o que se chama simulação por eventos discretos, e
é por isso que milhares de instâncias cabem num instante de cálculo.
<!-- /chunk -->

<!-- chunk:parametros -->
Localizador: Simulação › o que você precisa informar
Citação: [fonte:simulacao-conceitos:parametros]

Um cenário mínimo pede: **com que frequência** chegam instâncias, **quanto dura** cada atividade,
**qual a probabilidade** de cada saída de gateway exclusivo e **quantos recursos** existem para
executar cada tarefa. Duração costuma ser uma distribuição, e não um número fixo — processos
reais variam, e usar a média para tudo esconde justamente a fila que você quer enxergar.
<!-- /chunk -->

<!-- chunk:metricas -->
Localizador: Simulação › o que ler no resultado
Citação: [fonte:simulacao-conceitos:metricas]

As três medidas que mais ensinam: **tempo de ciclo** (do início ao fim de uma instância),
**tempo em fila** por atividade e **utilização** de cada recurso. Gargalo aparece como fila
crescente diante de um recurso muito utilizado. Compare sempre **cenários**, nunca um número
isolado: "com dois atendentes em vez de um, a fila cai de X para Y" é uma conclusão; "a fila é
X" sozinho não é.
<!-- /chunk -->
