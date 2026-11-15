---
sourceId: boas-praticas
title: Boas práticas — o diagrama que a outra pessoa entende
group: modelagem
tags: [boas práticas, legibilidade, nome, convenção, revisão]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:nomes -->
Localizador: Boas práticas › nomes
Citação: [fonte:boas-praticas:nomes]

Tarefa recebe **verbo no infinitivo + objeto** ("Emitir nota fiscal"), evento recebe **estado
alcançado** ("Pedido aprovado", "Prazo esgotado") e saída de gateway recebe a **condição**
("valor acima de R$ 500"). O gateway em si não decide nada: quem decide é a atividade anterior,
e por isso nomear o losango com uma pergunta ("Tem desconto?") ajuda a ler, desde que as saídas
respondam à pergunta.
<!-- /chunk -->

<!-- chunk:leitura -->
Localizador: Boas práticas › legibilidade
Citação: [fonte:boas-praticas:leitura]

Fluxo principal da esquerda para a direita, na mesma linha, com os desvios acima ou abaixo. Evite
cruzar setas; quando cruzar for inevitável, prefira mover o elemento a torcer a linha. Um
diagrama que não cabe na tela sem zoom costuma estar pedindo um **subprocesso**. E o teste final
é humano: alguém que não participou do desenho consegue contar a história olhando para ele?
<!-- /chunk -->

<!-- chunk:granularidade -->
Localizador: Boas práticas › nível de detalhe
Citação: [fonte:boas-praticas:granularidade]

Mantenha o mesmo nível de granularidade dentro de um diagrama: "Receber pedido" e "Clicar no
botão salvar" não convivem bem. Escolha o nível pelo leitor — diagrama para discutir o negócio
fica no passo de negócio; diagrama para automação desce ao sistema. Quando os dois forem
necessários, são dois diagramas ligados por subprocesso, e não um só tentando servir aos dois.
<!-- /chunk -->
