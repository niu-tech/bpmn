# bpmn-first-run-workspace — a folha limpa

## ADDED Requirements

### Requirement: Começar do zero é alcançável com trabalho na tela

A tela SHALL oferecer, a qualquer momento depois da primeira edição, um caminho para começar um
processo novo — sem passar pela escolha de trilha da primeira visita.

#### Scenario: A saída existe depois de editar
- **WHEN** o aluno já desenhou ou alterou o diagrama
- **THEN** o caminho para começar do zero continua alcançável na tela

#### Scenario: Não é a mesma coisa que trocar de trilha
- **WHEN** o aluno escolhe começar do zero
- **THEN** ele permanece no modelador, com um diagrama novo, e não é levado de volta ao convite

### Requirement: Antes de descartar, o produto pergunta e oferece guardar

Começar do zero com trabalho na tela SHALL perguntar antes, com três respostas: baixar e começar,
começar sem baixar, cancelar.

#### Scenario: Cancelar não muda nada
- **WHEN** o aluno cancela a pergunta
- **THEN** o diagrama continua exatamente como estava, com as mesmas formas e as mesmas ligações

#### Scenario: Baixar entrega um arquivo que volta a abrir
- **WHEN** o aluno escolhe baixar e começar
- **THEN** o arquivo entregue é o BPMN do desenho que estava na tela, e ele pode ser importado de
  volta sem erro

#### Scenario: A perda é dita onde ela acontece
- **WHEN** a pergunta aparece
- **THEN** ela diz que o desenho vive apenas nesta aba e não fica guardado em lugar nenhum

#### Scenario: Sem trabalho na tela, não há o que perguntar
- **WHEN** o diagrama está no estado inicial, sem nada que o aluno tenha feito
- **THEN** começar do zero não pergunta nada

### Requirement: A folha limpa nasce desenhável

O diagrama novo SHALL nascer com um evento de início.

#### Scenario: O primeiro pedido do aluno funciona
- **WHEN** o aluno pede uma tarefa logo depois de começar do zero
- **THEN** a tarefa nasce ligada ao início, sem recusa por falta de lugar

### Requirement: O agente abre a folha limpa pelo portão de confirmação

O agente SHALL conseguir começar um processo do zero, e a ação SHALL ficar recusada até o aluno
responder depois do pedido.

#### Scenario: Recusa até o aluno responder
- **WHEN** o agente pede para começar do zero e o aluno ainda não respondeu
- **THEN** a ferramenta recusa por falta de confirmação e nada é apagado

#### Scenario: O aluno responde e só então a tela limpa
- **WHEN** o aluno responde depois do pedido e o agente repete a ação
- **THEN** o diagrama novo entra, e o anterior sai da tela
