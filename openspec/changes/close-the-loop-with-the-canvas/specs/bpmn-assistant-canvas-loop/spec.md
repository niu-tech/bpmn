## ADDED Requirements

### Requirement: Toda escrita devolve o estado da tela
O sistema SHALL acrescentar ao resultado de cada ferramenta de escrita uma leitura curta do
desenho **depois** da operação, produzida a partir do registro vivo da página.

#### Scenario: Criar devolve o que ficou na tela
- **WHEN** `criar_elemento` conclui
- **THEN** o resultado traz, além do elemento criado, o estado do desenho: tipo do diagrama,
  contagem, elemento selecionado, entradas e saídas do que foi criado e as pontas soltas

#### Scenario: A leitura vem do registro, não da chamada
- **WHEN** a camada de acesso aplica a operação e o registro fica num estado diferente do pedido
- **THEN** a leitura descreve o estado do registro, não os argumentos da chamada

#### Scenario: A leitura tem teto
- **WHEN** o diagrama tem mais elementos do que cabe na leitura
- **THEN** a leitura é cortada no teto declarado e diz que foi cortada

#### Scenario: O primeiro pool reestrutura o diagrama
- **WHEN** `criar_pool` é chamado num diagrama que ainda não tem pool
- **THEN** a leitura diz que o diagrama agora é uma colaboração e quantas formas passaram a estar
  dentro do pool novo

#### Scenario: A primeira raia nasce em dupla
- **WHEN** `criar_raia` cria a primeira faixa de um pool
- **THEN** a leitura diz quantas faixas esse pool tem agora

### Requirement: A página fala com o modelo sem virar o aluno
O sistema SHALL permitir que a página envie um fato ao modelo com a marca `(da página)`, e SHALL
NOT apresentar esse texto como mensagem do aluno nem deixá-lo alterar o idioma da resposta.

#### Scenario: Seleção do aluno chega ao modelo
- **WHEN** o aluno seleciona um elemento no canvas durante a conversa
- **THEN** o modelo recebe um texto marcado como da página nomeando o elemento selecionado

#### Scenario: A nota não é bolha do aluno
- **WHEN** uma mensagem da página é enviada
- **THEN** o painel mostra uma nota de sistema, e nenhuma bolha de aluno é criada

#### Scenario: O idioma não muda
- **WHEN** a mensagem da página chega em outra língua que não a do aluno
- **THEN** a resposta do agente continua no idioma do aluno

### Requirement: A vez é do aluno
O sistema SHALL segurar a mensagem da página enquanto houver turno aberto ou fala em curso, e
SHALL descartá-la se o aluno falar ou digitar antes de ela ser enviada.

#### Scenario: Não atropela a fala
- **WHEN** há uma mensagem da página pendente e o modelo está falando
- **THEN** nada é enviado até o turno terminar

#### Scenario: O aluno falou primeiro
- **WHEN** o aluno fala antes de a mensagem pendente sair
- **THEN** a mensagem é descartada e nunca chega ao modelo

#### Scenario: Fato velho não vira pergunta
- **WHEN** a mensagem pendente passa do prazo declarado
- **THEN** ela é descartada

### Requirement: Ambiguidade se resolve em um clique
O sistema SHALL desenhar como botões os candidatos devolvidos por uma ferramenta, e o clique SHALL
responder ao modelo e destacar o elemento escolhido no desenho.

#### Scenario: Dois pools possíveis
- **WHEN** `criar_elemento` recusa com `sem_lugar` e devolve dois pools
- **THEN** o painel mostra um botão por pool, e o clique manda a escolha ao modelo

#### Scenario: A busca achou vários
- **WHEN** `buscar_elemento` devolve mais de um elemento
- **THEN** cada um vira botão, e o clique destaca esse elemento no desenho

#### Scenario: Escolha clicada não é digitação do aluno
- **WHEN** o aluno clica num candidato
- **THEN** a mensagem enviada ao modelo é marcada como escolha feita no chat
