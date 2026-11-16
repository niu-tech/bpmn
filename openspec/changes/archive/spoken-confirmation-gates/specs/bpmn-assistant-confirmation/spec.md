## ADDED Requirements

### Requirement: Confirmação falada vale como confirmação
O sistema SHALL aceitar como confirmação de uma ação que a exija o fato de o aluno ter falado ou
digitado **depois** de a pergunta ter sido feita, sem exigir clique.

#### Scenario: Sim falado remove
- **WHEN** o agente pergunta se pode apagar e o aluno responde falando
- **THEN** a remoção acontece sem clique em botão nenhum

#### Scenario: Sim dito antes não conta
- **WHEN** o aluno já havia falado antes de a pergunta aparecer e não fala de novo
- **THEN** a ação é recusada com `falta_confirmacao`

#### Scenario: Transcrição atrasada ainda conta
- **WHEN** a fala do aluno é transcrita até 3,5 s depois da chamada da ferramenta
- **THEN** a ação espera a transcrição e acontece

#### Scenario: Silêncio não é consentimento
- **WHEN** o aluno não fala nem digita dentro da espera
- **THEN** a ação é recusada e o modelo é instruído a perguntar uma vez e aguardar

### Requirement: Quem conta a confirmação é a página
O sistema SHALL decidir a confirmação a partir do seu próprio registro de turnos do aluno, e SHALL
NOT aceitar como prova qualquer afirmação do modelo de que o aluno concordou.

#### Scenario: O modelo alega a confirmação
- **WHEN** o modelo chama a ferramenta afirmando no argumento ou na fala que o aluno já confirmou
- **THEN** a ação é recusada enquanto a página não registrar fala do aluno posterior à pergunta

#### Scenario: Mensagem da página não confirma
- **WHEN** a única mensagem posterior à pergunta é uma mensagem marcada como da página
- **THEN** a ação continua recusada

### Requirement: Cada pergunta tem o seu portão
O sistema SHALL manter um portão por nome, e a resposta a uma pergunta SHALL NOT abrir o portão de
outra.

#### Scenario: Duas perguntas abertas
- **WHEN** há um portão de remoção e outro de uma proposta do tutor, e o aluno responde à segunda
- **THEN** só a segunda ação fica liberada

### Requirement: A recusa mantém a conversa viva
O sistema SHALL devolver a falta de confirmação como resultado nomeado com a orientação do próximo
passo, e SHALL NOT deixar o turno pendurado nem lançar exceção.

#### Scenario: Recusa é fato
- **WHEN** a ferramenta é recusada por falta de confirmação
- **THEN** o modelo recebe `falta_confirmacao` e uma instrução de perguntar em uma frase curta

#### Scenario: O caminho do clique continua
- **WHEN** o aluno confirma pelo botão do diálogo
- **THEN** a remoção acontece como antes, com a assinatura do diagrama conferida
