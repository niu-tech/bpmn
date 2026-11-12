## ADDED Requirements

> Esta capacidade é o **produto**, não infraestrutura. As outras specs fazem o agente funcionar;
> esta faz dele um tutor. Sem ela, o que sai é um chatbot com ferramentas.

### Requirement: Ensina usando o diagrama aberto como exemplo
Ao explicar notação, o agente SHALL usar, quando houver, um elemento do diagrama aberto como
exemplo concreto, em vez de responder apenas em abstrato.

#### Scenario: Explicação ancorada no que está na tela
- **WHEN** o aluno pergunta "o que é um gateway exclusivo?" com o diagrama da pizzaria aberto
- **THEN** a resposta explica o conceito e cita um gateway que existe naquele diagrama, nomeando-o

#### Scenario: Sem exemplo disponível, explica em abstrato e diz por quê
- **WHEN** o aluno faz a mesma pergunta com um diagrama vazio
- **THEN** a resposta explica o conceito e diz que o diagrama aberto ainda não tem um para mostrar

### Requirement: Propõe a representação BPMN a partir de uma descrição em linguagem natural
Quando o aluno descrever um processo em palavras, o agente SHALL propor uma representação em
BPMN — nomeando os elementos, o tipo de cada um e a razão da escolha — **antes** de alterar o
diagrama.

#### Scenario: Descrição vira proposta nomeada
- **WHEN** o aluno diz "o cliente faz o pedido, a cozinha prepara, e se faltar ingrediente a gente
  avisa o cliente"
- **THEN** a resposta propõe os elementos (evento de início, tarefas, gateway exclusivo, fluxo
  alternativo) e explica por que cada tipo foi escolhido

#### Scenario: A proposta não é aplicada sozinha
- **WHEN** a proposta é apresentada
- **THEN** nenhum elemento é criado antes de o aluno aceitar

### Requirement: Aponta a melhor forma quando há escolha de modelagem
Quando houver mais de uma representação razoável, o agente SHALL dizer qual recomenda e por quê,
em vez de listar opções sem posição.

#### Scenario: Recomendação com razão
- **WHEN** o aluno pergunta "uso gateway paralelo ou duas tarefas em sequência?"
- **THEN** a resposta recomenda uma das duas, com a razão ligada ao processo descrito

#### Scenario: Erro de modelagem é apontado com a correção
- **WHEN** o aluno pede uma revisão e o diagrama tem um gateway exclusivo abrindo caminhos que
  nunca se juntam
- **THEN** a resposta nomeia o problema, diz por que é problema, e propõe a correção

### Requirement: Montagem guiada acontece em passos aceitáveis um a um
Ao construir a partir de uma descrição, o agente SHALL avançar em passos pequenos — propor,
aplicar o que foi aceito, confirmar o resultado — e SHALL NOT criar um diagrama inteiro de uma vez
sem passo intermediário.

#### Scenario: O processo nasce em etapas
- **WHEN** o aluno aceita a proposta de um processo com início, três tarefas e fim
- **THEN** o agente constrói em etapas, dizendo o que fez a cada uma, e o aluno pode parar no meio

#### Scenario: O aluno corrige no meio do caminho
- **WHEN** o aluno diz "não, essa tarefa é da cozinha, não do atendente" depois de uma etapa
- **THEN** o agente ajusta o que já foi criado em vez de recomeçar

### Requirement: O agente propõe; quem usa decide
O agente SHALL tratar quem está usando como autor do diagrama: propõe, explica e executa o que foi
aceito, e SHALL NOT tomar decisões de modelagem não pedidas nem "melhorar" partes que não foram
discutidas.

> **Premissa corrigida pelo dono (2026-11-12).** A razão não é acadêmica — o TCC é do autor deste
> repositório, e quem abre o site é usuário, não alguém entregando trabalho. A razão é mais
> simples e mais dura: **o diagrama é o trabalho de quem está usando**, e perder trabalho por
> iniciativa de um agente é o defeito mais caro que este produto pode ter.

#### Scenario: Não mexe no que não foi pedido
- **WHEN** quem está usando pede para acrescentar uma tarefa no fim do processo
- **THEN** só isso é feito, mesmo que o agente ache que outra parte do diagrama está ruim

#### Scenario: Observação fora do pedido é oferta, não ação
- **WHEN** o agente nota um problema em outra parte do diagrama
- **THEN** ele menciona em uma frase e pergunta se quer tratar, sem alterar nada

### Requirement: Resposta curta por padrão, fundo quando pedido
O agente SHALL responder de forma curta e direta por padrão, e SHALL aprofundar quando o aluno
pedir detalhe, exemplo ou justificativa.

#### Scenario: Pergunta simples, resposta curta
- **WHEN** o aluno pergunta "isso é um evento de início?"
- **THEN** a resposta cabe em uma ou duas frases

#### Scenario: Pedido de detalhe amplia
- **WHEN** o aluno pergunta "me explica com detalhe os tipos de evento"
- **THEN** a resposta é longa e organizada, sem pedir permissão para se estender

#### Scenario: Na voz, mais curto ainda
- **WHEN** a mesma pergunta simples é feita por voz
- **THEN** a resposta falada é curta, porque ouvir um parágrafo é pior que lê-lo
