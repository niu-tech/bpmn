## ADDED Requirements

### Requirement: Ferramentas de leitura disponíveis nos dois perfis
O sistema SHALL declarar ao modelo as ferramentas de leitura do diagrama e da simulação tanto no
modelador quanto no viewer, e elas SHALL responder a partir do estado real da página.

#### Scenario: Contagem vem do registro, não do modelo
- **WHEN** o modelo chama `descrever_diagrama`
- **THEN** a resposta traz a contagem por tipo obtida do `elementRegistry` da página

#### Scenario: Buscar por nome encontra o elemento
- **WHEN** o modelo chama `buscar_elemento` com o nome de uma tarefa existente
- **THEN** a resposta traz `{id, tipo, nome}` dessa tarefa

#### Scenario: Busca sem resultado é dita como sem resultado
- **WHEN** o modelo chama `buscar_elemento` com um nome que não existe
- **THEN** a resposta é uma lista vazia e o agente diz ao aluno que não encontrou

#### Scenario: Busca varre o registro inteiro, não a amostra
- **WHEN** `buscar_elemento` procura um elemento que não está na amostra do contexto
- **THEN** ele é encontrado, porque a busca consulta o `elementRegistry` completo

#### Scenario: Resumo de simulação só existe depois de uma corrida
- **WHEN** `resumir_simulacao` é chamada antes de qualquer corrida
- **THEN** a resposta diz que não há corrida, sem inventar métrica

### Requirement: Escrita só no modelador
O sistema SHALL declarar ferramentas de escrita apenas quando a página oferecer `modeling`, e
SHALL recusar com erro nomeado qualquer despacho de escrita no viewer.

#### Scenario: Viewer não declara escrita
- **WHEN** a sessão é aberta em `/viewer.html`
- **THEN** o `setup` não contém `criar_elemento`, `conectar`, `renomear` nem `remover`

### Requirement: Toda alteração entra na pilha de desfazer
O sistema SHALL aplicar alterações exclusivamente pelos serviços `modeling` do bpmn-js, e SHALL
NOT manipular o XML do diagrama diretamente.

#### Scenario: Ctrl+Z desfaz o que o agente fez
- **WHEN** o agente cria uma tarefa e o aluno aciona desfazer
- **THEN** a tarefa deixa de existir no registro, como se o aluno a tivesse criado

#### Scenario: Criação devolve o que mudou
- **WHEN** `criar_elemento` conclui
- **THEN** a resposta ao modelo traz o `id` novo, o tipo e a posição, para ele descrever ao aluno

### Requirement: Remoção exige confirmação do aluno
O sistema SHALL pedir confirmação explícita na interface antes de executar `remover`, e SHALL NOT
remover nada enquanto a confirmação não for dada.

#### Scenario: Sem confirmação, nada é removido
- **WHEN** o modelo chama `remover` e o aluno não confirma
- **THEN** o elemento continua no registro e o modelo recebe uma resposta dizendo que foi recusado

#### Scenario: Com confirmação, remove e diz o que removeu
- **WHEN** o aluno confirma
- **THEN** o elemento sai do registro e a resposta ao modelo nomeia o que saiu

#### Scenario: Confirmação velha não vale para diagrama novo
- **WHEN** o diagrama muda entre o pedido de remoção e a confirmação do aluno
- **THEN** a remoção é recusada com `diagrama_mudou` e nada é removido

### Requirement: Métrica de simulação declara a que diagrama pertence
`resumir_simulacao` SHALL informar se o diagrama foi alterado depois da corrida, para que o agente
não apresente métrica velha como estado atual.

#### Scenario: Diagrama editado depois da corrida
- **WHEN** o aluno roda a simulação e depois altera o diagrama
- **THEN** o resumo diz que as métricas são de uma versão anterior do diagrama

### Requirement: Conectar valida os dois lados
O sistema SHALL recusar `conectar` quando qualquer um dos identificadores não existir, ou quando
a ligação for inválida para o BPMN, devolvendo erro nomeado em vez de criar uma ligação quebrada.

#### Scenario: Identificador inexistente é recusado
- **WHEN** `conectar` recebe um `id` que não está no registro
- **THEN** nenhuma conexão é criada e o modelo recebe `elemento_nao_encontrado`

#### Scenario: Fluxo de sequência entre pools é recusado
- **WHEN** `conectar` pede fluxo de sequência entre elementos de pools diferentes
- **THEN** a ligação é recusada com erro nomeado, e o agente explica que entre pools se usa fluxo
  de mensagem

### Requirement: Nenhuma ferramenta ensina BPMN
O sistema SHALL NOT declarar ferramentas cujo efeito seja produzir explicação didática; ensino é
responsabilidade do prompt.

#### Scenario: O catálogo não tem ferramenta de explicação
- **WHEN** o catálogo é inspecionado
- **THEN** nenhuma declaração tem por efeito devolver texto explicativo sobre notação
