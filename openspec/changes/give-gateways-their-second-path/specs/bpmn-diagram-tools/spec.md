# bpmn-diagram-tools — o segundo caminho da decisão

## ADDED Requirements

### Requirement: Abrir um caminho de decisão é UMA chamada

O agente SHALL conseguir abrir um caminho a partir de um gateway numa única chamada, que cria o
elemento do ramo, a ligação e o rótulo do caminho.

#### Scenario: O segundo caminho nasce ligado e rotulado
- **WHEN** existe um gateway com uma saída e o agente pede o caminho *"Não"* com uma tarefa
- **THEN** a tarefa nasce ligada ao gateway, a ligação recebe o rótulo *"Não"*, e a decisão passa a
  ter duas saídas

#### Scenario: O id da ligação não atravessa a fronteira do modelo
- **WHEN** um caminho é aberto com rótulo
- **THEN** o rótulo é escrito pela mesma chamada que criou a ligação, e o agente não precisa de
  nenhum id de ligação para isso

#### Scenario: Caminho pedido num elemento que não é decisão
- **WHEN** o agente pede um caminho a partir de um elemento que não é gateway
- **THEN** a ferramenta recusa com erro nomeado, dizendo que caminho rotulado pertence a uma
  decisão, e nada é desenhado

### Requirement: Ramo explícito em qualquer elemento

A criação de elemento SHALL declarar ao modelo a opção de nascer como **ramo** do elemento
anterior, em vez de entrar no meio da sequência.

#### Scenario: Ramo pedido explicitamente
- **WHEN** o agente cria um elemento depois de outro que já tem saída, pedindo ramo
- **THEN** o elemento nasce como segunda saída daquele elemento, e a sequência que já existia
  continua intacta

#### Scenario: Sem pedir ramo, o encadeamento continua
- **WHEN** o agente cria um elemento depois de outro que já tem exatamente uma saída de sequência,
  sem pedir ramo
- **THEN** o elemento entra NO MEIO daquela sequência, como hoje

### Requirement: A tela conta os caminhos de cada decisão

A leitura do diagrama SHALL informar, para cada gateway, quantas saídas de sequência ele tem e
quantas delas têm rótulo.

#### Scenario: Decisão incompleta é fato no resultado
- **WHEN** o agente lê a tela depois de criar um gateway
- **THEN** o resultado diz que aquela decisão tem zero caminhos, sem recusar nada e sem o produto
  decidir o que fazer a respeito

#### Scenario: Caminho sem rótulo aparece na contagem
- **WHEN** um gateway tem duas saídas e só uma tem rótulo
- **THEN** a leitura diz duas saídas e um rótulo
