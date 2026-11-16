## ADDED Requirements

### Requirement: O produto chama o agente por um nome só
O sistema SHALL apresentar o agente com um nome único, vindo de uma fonte única, e SHALL dizer
**uma vez por superfície** o que ele é — um agente de IA especializado em BPMN que lê o diagrama
aberto.

#### Scenario: A tela base diz o nome uma vez
- **WHEN** a tela base é mostrada
- **THEN** o nome do agente aparece uma única vez no texto da tela, acompanhado da frase que diz o
  que ele é

#### Scenario: Painel, alavanca e tela usam o mesmo nome
- **WHEN** a alavanca e o painel do agente são mostrados
- **THEN** o nome exibido é o mesmo que a tela base usa

### Requirement: Frase semeada cabe em uma linha do compositor
O sistema SHALL manter toda frase que escreve no compositor no lugar do aluno dentro do limite de
uma linha, e SHALL NOT escrever frase que o compositor corte.

#### Scenario: A sugestão da trilha em branco cabe
- **WHEN** a pessoa aciona a sugestão da tela em branco
- **THEN** o compositor mostra a frase inteira, sem transbordar a altura da caixa

#### Scenario: Frase acima do limite reprova
- **WHEN** uma frase semeada passa do limite medido de caracteres
- **THEN** a suíte de testes reprova, nomeando a frase

### Requirement: O caminho de volta ao início persiste
O sistema SHALL oferecer, nas três trilhas, um caminho visível e permanente de volta à tela base,
que SHALL sobreviver à edição do diagrama e ao fechamento da orientação, e SHALL NOT descartar o
trabalho aberto.

#### Scenario: Depois de editar, o caminho de volta continua lá
- **WHEN** a pessoa escolhe uma trilha, fecha a orientação e edita o diagrama
- **THEN** o caminho de volta à tela base continua visível e clicável

#### Scenario: Voltar ao início não descarta nada
- **WHEN** a pessoa aciona o caminho de volta
- **THEN** a tela base aparece e o trabalho salvo continua intacto

#### Scenario: Com a tela base no ar, o caminho de volta sai de cena
- **WHEN** a tela base está sendo mostrada
- **THEN** o caminho de volta não aparece

### Requirement: A tela base tem saída quando há trabalho aberto
O sistema SHALL oferecer, quando houver trabalho salvo, uma forma de sair da tela base continuando
o trabalho aberto, sem escolher trilha nenhuma.

#### Scenario: Continuar o que estava fazendo
- **WHEN** a pessoa chega à tela base pelo caminho de volta e há trabalho salvo
- **THEN** a tela base oferece continuar o trabalho aberto, e acioná-lo devolve o diagrama como
  estava

#### Scenario: Esc fecha a tela base
- **WHEN** há trabalho salvo e a pessoa pressiona `Esc` na tela base
- **THEN** a tela base fecha e o diagrama aberto continua como estava

### Requirement: Substituir o diagrama exige confirmação na tela base
O sistema SHALL pedir confirmação explícita antes de abrir o exemplo ou a tela em branco quando
houver trabalho salvo, e SHALL NOT substituir o diagrama no primeiro acionamento.

#### Scenario: O primeiro clique pergunta
- **WHEN** há trabalho salvo e a pessoa aciona uma trilha que substitui o diagrama
- **THEN** o próprio cartão pergunta antes, e o diagrama aberto não muda

#### Scenario: O segundo clique executa
- **WHEN** a pessoa aciona o mesmo cartão outra vez, com a pergunta no ar
- **THEN** a trilha é aberta

#### Scenario: Sem trabalho salvo não há pergunta
- **WHEN** não há trabalho salvo
- **THEN** a trilha abre no primeiro acionamento

## MODIFIED Requirements

### Requirement: Cada trilha chega dizendo o que dá para fazer
O sistema SHALL mostrar, ao abrir qualquer trilha da tela base, uma orientação visível que diga o
que o agente faz naquela trilha e ofereça uma sugestão de pergunta. A orientação SHALL NOT carregar
o caminho de volta nem a troca de trilha — navegação é do caminho permanente.

#### Scenario: O exemplo convida a perguntar sobre o desenho
- **WHEN** a pessoa escolhe ver o exemplo
- **THEN** a orientação diz que o agente lê o que está na tela e que dá para clicar num elemento e
  perguntar, e oferece uma pergunta sobre o diagrama

#### Scenario: A tela em branco convida a descrever o processo
- **WHEN** a pessoa escolhe começar do zero
- **THEN** a orientação diz que basta contar o processo em algumas frases, e oferece começar essa
  conversa

#### Scenario: Quem restaura o próprio trabalho não recebe orientação
- **WHEN** a pessoa volta e o diagrama dela é restaurado
- **THEN** nenhuma orientação de primeira vez aparece

#### Scenario: A orientação não oferece navegação
- **WHEN** a orientação está no ar
- **THEN** ela não traz "voltar ao menu" nem troca de trilha
