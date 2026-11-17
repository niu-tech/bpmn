# bpmn-assistant-canvas-loop — o trabalho visível

## ADDED Requirements

### Requirement: O canvas mostra o que acabou de mudar

Toda escrita do agente no diagrama SHALL destacar brevemente o elemento afetado, e o destaque
SHALL desaparecer sozinho.

#### Scenario: O elemento criado pisca
- **WHEN** o agente cria um elemento
- **THEN** aquele elemento recebe a marca de destaque e a tela rola até ele

#### Scenario: O destaque não fica
- **WHEN** o destaque termina
- **THEN** o elemento não carrega mais a marca, e o arquivo do aluno não tem cor nova

### Requirement: A construção é UMA mensagem que cresce

Enquanto o agente escreve várias vezes no mesmo turno, a conversa SHALL mostrar uma mensagem de
construção viva, com a contagem do que já entrou.

#### Scenario: Doze escritas não viram doze mensagens
- **WHEN** o agente cria seis elementos no mesmo turno
- **THEN** a conversa mostra uma mensagem de construção com a contagem, e não uma mensagem por
  elemento

#### Scenario: O detalhe continua disponível
- **WHEN** a construção termina
- **THEN** o que cada escrita fez continua acessível na conversa

### Requirement: O selo diz desenhando enquanto há escrita em curso

O estado mostrado na tela SHALL distinguir o agente decidindo do agente escrevendo no diagrama.

#### Scenario: Escrita em curso
- **WHEN** uma ferramenta de escrita está rodando
- **THEN** o selo diz que o agente está desenhando

### Requirement: Autocorreção no meio da construção não parece erro

Um desfazer disparado pelo agente dentro de um turno em que ele também escreveu SHALL ser
apresentado como ajuste.

#### Scenario: O agente conserta a própria tentativa
- **WHEN** o agente cria elementos e desfaz parte deles no mesmo turno
- **THEN** a linha mostrada diz que houve ajuste, com o número de elementos que voltaram

#### Scenario: Desfazer pedido pelo aluno continua sendo desfazer
- **WHEN** o aluno pede para desfazer e o agente não escreveu nada naquele turno
- **THEN** a linha continua dizendo que desfez
