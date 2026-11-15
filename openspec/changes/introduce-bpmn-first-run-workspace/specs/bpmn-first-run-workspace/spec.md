## ADDED Requirements

### Requirement: A abertura do modelador é decidida, não suposta
O sistema SHALL decidir o que abrir a partir de três entradas — o trabalho salvo, a escolha
anterior da pessoa e o atalho da URL — por uma função pura, e SHALL NOT tratar "não há nada salvo"
como "carregue o exemplo".

#### Scenario: Primeira visita
- **WHEN** não há trabalho salvo nem escolha anterior
- **THEN** o modelador abre com um diagrama novo e vazio, e a tela base aparece sobre o espaço do
  canvas

#### Scenario: Quem já tem trabalho nunca é interrompido
- **WHEN** existe diagrama salvo no navegador
- **THEN** o modelador restaura esse diagrama e a tela base **não** aparece

#### Scenario: O atalho abre o exemplo direto
- **WHEN** a URL termina em `#exemplo`
- **THEN** o exemplo é carregado sem a tela base, e o trabalho salvo **não** é apagado

### Requirement: A escolha da pessoa é um estado guardado
O sistema SHALL guardar qual caminho a pessoa escolheu e SHALL respeitá-lo na volta, mesmo que
nenhuma edição tenha acontecido.

#### Scenario: Começou do zero e fechou sem desenhar
- **WHEN** a pessoa escolhe começar do zero, não desenha nada e volta ao site depois
- **THEN** ela encontra um diagrama vazio, e **não** a tela base de novo

#### Scenario: Escolheu o exemplo e voltou
- **WHEN** a pessoa escolheu ver o exemplo e volta sem ter editado nada
- **THEN** o exemplo é carregado de novo, sem a tela base

#### Scenario: Escolha desconhecida não decide nada
- **WHEN** a chave da escolha contém um valor que o sistema não reconhece
- **THEN** a tela base aparece, como se não houvesse escolha

### Requirement: O exemplo é identificado enquanto for exemplo
O sistema SHALL marcar na tela que o diagrama aberto é um exemplo, e SHALL retirar essa marca
assim que a pessoa editar o diagrama.

#### Scenario: O exemplo chega marcado
- **WHEN** o exemplo é carregado pela tela base
- **THEN** uma tira na tela diz que aquilo é um exemplo e oferece começar o próprio

#### Scenario: Editar transforma exemplo em trabalho
- **WHEN** a pessoa faz a primeira alteração no diagrama
- **THEN** a tira desaparece

#### Scenario: Depois do zero, o exemplo continua a um clique
- **WHEN** a pessoa escolheu começar do zero
- **THEN** a mesma tira oferece ver um exemplo

### Requirement: A tela base não cobra nada de quem chegou
O sistema SHALL NOT pedir credencial na tela base, SHALL NOT abrir o painel do ajudante sem um
clique da pessoa, e SHALL NOT criar um segundo campo de conversa.

#### Scenario: Nenhum campo de chave na tela base
- **WHEN** a tela base está visível
- **THEN** não existe nela campo de chave, nem aviso de privacidade, nem botão de conectar

#### Scenario: O painel só abre a pedido
- **WHEN** a tela base aparece
- **THEN** o painel do ajudante continua recolhido no lançador

#### Scenario: Um compositor só
- **WHEN** a pessoa escolhe descrever o próprio processo
- **THEN** o painel existente abre com a frase **digitada e não enviada** no compositor dele, e
  nenhum outro campo de texto de conversa existe na página

### Requirement: A página oferece caminhos; o modelo conduz
O sistema SHALL limitar o efeito de cada caminho a carregar um diagrama, abrir o painel e sugerir
um texto, e SHALL NOT encadear perguntas de entrevista no código.

#### Scenario: Descrever o processo não vira roteiro
- **WHEN** a pessoa escolhe descrever o próprio processo
- **THEN** o código não decide nenhuma ferramenta nem a próxima pergunta: a condução fica com o
  modelo, por function calling

#### Scenario: A pergunta não é enviada sozinha
- **WHEN** um caminho deixa uma pergunta pronta no compositor
- **THEN** nada é enviado até a pessoa mandar

### Requirement: O convite respeita o que já mora na tela
O sistema SHALL deixar livre a área reservada da marca d'água do bpmn.io e SHALL NOT cobrir a
barra de ferramentas do modelador nem o painel do ajudante.

#### Scenario: A marca d'água fica visível
- **WHEN** a tela base está visível, em qualquer largura
- **THEN** a marca d'água do bpmn.io não é sobreposta

#### Scenario: Em 375 px os caminhos empilham
- **WHEN** a janela tem 375 px de largura
- **THEN** os três caminhos aparecem empilhados, sem rolagem horizontal, e o lançador do ajudante
  continua clicável

### Requirement: Nada do que já funciona regride
O sistema SHALL manter `/viewer.html`, a simulação em lote, o autosave e o ajudante exatamente como
estão, e SHALL falhar sozinho se a tela base não puder ser montada.

#### Scenario: O viewer não tem tela base
- **WHEN** `/viewer.html` é aberto
- **THEN** nenhuma tela base aparece, e o ajudante monta como antes

#### Scenario: Defeito na tela base não leva o modelador junto
- **WHEN** a montagem da tela base lança um erro
- **THEN** o modelador abre assim mesmo, com um diagrama carregado
