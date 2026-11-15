---
sourceId: pools-e-raias
title: Pools e raias — quem participa e quem faz
group: fundamentos
tags: [pool, raia, participante, colaboração, organização]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:pool -->
Localizador: Pools › o participante
Citação: [fonte:pools-e-raias:pool]

Pool é um **participante** da colaboração: uma empresa, um cliente, um sistema. Cada pool contém
**um** processo, e por isso dois pools nunca se ligam por fluxo de sequência — só por mensagem.
Pool pode aparecer **fechado** (caixa vazia com o nome), quando o que importa é que ele existe e
troca mensagens, e não como ele trabalha por dentro: é uma escolha legítima, e muito comum para
representar o cliente.
<!-- /chunk -->

<!-- chunk:raia -->
Localizador: Raias › a divisão interna
Citação: [fonte:pools-e-raias:raia]

Raia é uma faixa **dentro** do pool: separa papéis, setores ou sistemas do mesmo participante. Ela
organiza a leitura e atribui responsabilidade — mas **não** muda a semântica do fluxo: uma seta
de sequência atravessa raias normalmente, porque continua dentro do mesmo processo. Se a divisão
que você quer desenhar troca mensagens com a outra, ela não é raia: é outro pool.
<!-- /chunk -->
