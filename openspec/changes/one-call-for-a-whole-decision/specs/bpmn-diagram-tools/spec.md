# bpmn-diagram-tools — a decisão inteira numa chamada

## ADDED Requirements

### Requirement: Desenhar uma decisão com os caminhos dela é UMA chamada

O agente SHALL conseguir desenhar, numa única chamada, a decisão e cada um dos seus caminhos — o
gateway com a pergunta, a seta rotulada de cada caminho e os passos que vêm depois dela.

#### Scenario: Dois caminhos, cada um com os seus passos
- **WHEN** o agente pede uma decisão com dois caminhos, cada um com dois passos
- **THEN** o gateway nasce ligado ao fluxo, cada caminho nasce ligado ao gateway com o seu rótulo
  na seta, os passos de cada caminho nascem encadeados, e o resultado diz o que foi criado em cada
  caminho

#### Scenario: A decisão respeita as regras de cada verbo que a compõe
- **WHEN** qualquer elemento da decisão cairia num lugar que o diagrama não aceita, ou repetiria um
  elemento igual já ligado ali
- **THEN** a recusa é a mesma, nomeada, que o verbo correspondente daria sozinho — o produto não
  ganha um segundo jeito de criar elemento, ramo ou fila

#### Scenario: A contagem de caminhos é fato, não recusa
- **WHEN** uma decisão é desenhada
- **THEN** o resultado diz quantos caminhos ela tem e quantos têm rótulo, sem o produto decidir o
  que fazer a respeito

### Requirement: Rótulo de caminho é obrigatório e conferido antes de desenhar

A ferramenta SHALL recusar a chamada inteira, antes de desenhar qualquer elemento, quando algum
caminho vier sem rótulo.

#### Scenario: Um caminho sem rótulo
- **WHEN** o agente pede três caminhos e o terceiro vem sem rótulo
- **THEN** nada é desenhado, e o erro nomeado diz que o rótulo é a resposta que leva por aquele
  caminho

### Requirement: Falha num caminho preserva o que já entrou

Quando um caminho falha depois de o gateway ter nascido, a ferramenta SHALL devolver o que foi
criado junto do caminho e do passo que pararam.

#### Scenario: O segundo caminho falha
- **WHEN** o primeiro caminho entra inteiro e o segundo é recusado
- **THEN** o resultado traz o gateway, o primeiro caminho completo, o número e o rótulo do caminho
  que parou e o motivo nomeado — e o que está na tela continua lá

#### Scenario: O gateway falha
- **WHEN** o gateway não pode ser criado e nada foi desenhado
- **THEN** a ferramenta falha com o erro nomeado, como a criação de um elemento só faria

### Requirement: A decisão tem tetos declarados

A ferramenta SHALL recusar, com erro nomeado, mais caminhos que o teto de caminhos ou mais
elementos que o teto de passos, dizendo qual teto foi excedido.

#### Scenario: Caminhos acima do teto
- **WHEN** o agente pede mais caminhos que o teto
- **THEN** nada é desenhado e o erro diz quantos caminhos cabem

#### Scenario: Total de passos acima do teto
- **WHEN** a soma dos passos de todos os caminhos passa do teto da fila
- **THEN** nada é desenhado e o erro diz o teto, permitindo ao agente desenhar a decisão e
  completar os caminhos em outra chamada
