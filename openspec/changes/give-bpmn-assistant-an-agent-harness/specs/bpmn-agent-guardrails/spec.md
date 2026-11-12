## ADDED Requirements

### Requirement: O domínio é declarado e a recusa é verificada
O prompt SHALL conter uma seção que declara o domínio (BPMN 2.0 e o diagrama aberto) e instrui a
recusar, em uma frase, o que estiver fora dele, oferecendo em seguida o que o ajudante sabe fazer.

#### Scenario: Pergunta fora do domínio é recusada
- **WHEN** o aluno pergunta uma receita de bolo
- **THEN** a resposta diz, em uma frase, que o ajudante trata de BPMN e do diagrama, e oferece
  ajuda nesse escopo

#### Scenario: Pergunta de BPMN aplicada a outro assunto NÃO é recusada
- **WHEN** o aluno pergunta como modelar o processo de uma pizzaria em BPMN
- **THEN** a resposta ajuda a modelar, porque o assunto é BPMN

#### Scenario: A recusa não é filtro de entrada
- **WHEN** qualquer pergunta é digitada
- **THEN** ela é enviada ao modelo sem bloqueio por palavra-chave no cliente

### Requirement: O ajudante não inventa o que não está no diagrama
O prompt SHALL instruir que elementos, nomes e ligações só podem ser afirmados quando constarem
da projeção do diagrama, e que a ausência deve ser dita como ausência.

#### Scenario: Elemento inexistente é reportado como ausente
- **WHEN** o aluno pergunta sobre uma tarefa que não existe no diagrama aberto
- **THEN** a resposta diz que não encontrou esse elemento, em vez de descrevê-lo

### Requirement: Catálogo de ferramentas com política default-deny
O sistema SHALL manter um catálogo de declarações de ferramentas e uma política por perfil que
lista nominalmente o que é permitido. O sistema SHALL declarar ao modelo exatamente o conjunto
permitido — nem mais, nem menos — e SHALL NOT despachar ferramenta ausente da política.

#### Scenario: Declarado é igual a permitido
- **WHEN** o `setup` é montado para um perfil
- **THEN** o conjunto de funções declaradas é exatamente o conjunto permitido por aquele perfil

#### Scenario: Ferramenta fora da política é recusada com erro nomeado
- **WHEN** o modelo chama uma função que não está na política do perfil
- **THEN** o despacho devolve um erro nomeado ao modelo e registra o fato no diário, sem executar
  nada

#### Scenario: Catálogo vazio não quebra a sessão
- **WHEN** o perfil não permite nenhuma ferramenta
- **THEN** o `setup` não declara `tools` e a conversa funciona normalmente

### Requirement: Ação é escolhida pelo modelo, nunca por palavra-chave
O sistema SHALL NOT conter detecção de intenção por palavra-chave, stem ou expressão regular que
dispare ou roteie uma ferramenta.

#### Scenario: Guarda mecânica contra regressão
- **WHEN** a suíte de testes varre `src/assistant/**`
- **THEN** nenhuma ocorrência de comparação de texto do aluno contra lista de verbos decide
  chamada de ferramenta

### Requirement: Toda chamada de ferramenta é respondida
O sistema SHALL enviar `toolResponse` para toda `toolCall` recebida, inclusive para chamada
recusada pela política ou repetida.

#### Scenario: Chamada recusada ainda recebe resposta
- **WHEN** o modelo chama uma ferramenta não permitida
- **THEN** um `toolResponse` com o erro nomeado é enviado antes do turno seguinte
