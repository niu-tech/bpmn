# bpmn-diagram-tools — a fila numa chamada

## ADDED Requirements

### Requirement: Desenhar uma sequência de passos é UMA chamada

O agente SHALL conseguir desenhar uma sequência de elementos encadeados numa única chamada,
informando os passos na ordem do fluxo, sem precisar do id de nenhum elemento intermediário.

#### Scenario: A fila nasce encadeada
- **WHEN** o agente pede uma fila de seis passos depois de um elemento que existe
- **THEN** os seis nascem na ordem pedida, cada um ligado ao anterior, e o resultado diz o id, o
  tipo e o nome de cada um

#### Scenario: Nenhum id intermediário atravessa a fronteira do modelo
- **WHEN** uma fila é desenhada
- **THEN** o encadeamento é feito pelo produto com os ids que ele mesmo acabou de criar, e o
  agente não precisa ter citado nenhum deles

#### Scenario: A fila respeita as regras de um elemento só
- **WHEN** um passo da fila cairia num lugar que o diagrama não aceita, ou repetiria um elemento
  igual já ligado ali
- **THEN** a recusa é a mesma, nomeada, que a criação de um elemento daria — o produto não ganha
  um segundo jeito de criar na ponta

### Requirement: Falha no meio da fila é fato, não exceção

Quando um passo da fila falha depois de o primeiro ter entrado, a ferramenta SHALL devolver o que
foi criado junto do passo que parou e do motivo, em vez de falhar inteira.

#### Scenario: Três entraram, o quarto não
- **WHEN** os três primeiros passos entram e o quarto é recusado
- **THEN** o resultado traz os três criados, o número do passo que parou e o motivo nomeado, e os
  três elementos continuam no desenho

#### Scenario: O primeiro passo falha
- **WHEN** o primeiro passo da fila é recusado e nada foi desenhado
- **THEN** a ferramenta falha com o erro nomeado da recusa, como a criação de um elemento só faria

### Requirement: A fila tem teto declarado

A ferramenta SHALL recusar, com erro nomeado, uma fila maior que o teto de passos, dizendo
quantos passos cabem.

#### Scenario: Fila acima do teto
- **WHEN** o agente pede uma fila com mais passos que o teto
- **THEN** nada é desenhado, o erro nomeado diz o teto, e a mensagem permite ao agente quebrar o
  pedido em mais de uma chamada

### Requirement: Uma fila, um resultado, um desfazer contado

O resultado de uma fila SHALL trazer o estado da tela uma única vez e o total de comandos que a
fila custou, lido do registro de comandos do editor.

#### Scenario: O aluno quer voltar atrás da fila inteira
- **WHEN** uma fila de seis passos acaba de ser desenhada
- **THEN** o resultado diz quantos desfazeres aquilo custou, e desfazer essa quantidade devolve o
  desenho ao estado anterior à fila

#### Scenario: O retrato é o de agora
- **WHEN** uma fila é desenhada
- **THEN** o resultado traz o estado da tela depois do último passo, e não um retrato por passo
