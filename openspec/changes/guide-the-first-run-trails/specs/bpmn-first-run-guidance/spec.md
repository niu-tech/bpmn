## ADDED Requirements

### Requirement: Cada trilha chega dizendo o que dá para fazer
O sistema SHALL mostrar, ao abrir qualquer trilha da tela base, uma orientação visível que diga o
que o tutor faz naquela trilha e ofereça uma sugestão de pergunta.

#### Scenario: O exemplo convida a perguntar sobre o desenho
- **WHEN** a pessoa escolhe ver o exemplo
- **THEN** a orientação diz que o tutor lê o que está na tela e que dá para clicar num elemento e
  perguntar, e oferece uma pergunta sobre o diagrama

#### Scenario: A tela em branco convida a descrever o processo
- **WHEN** a pessoa escolhe começar do zero
- **THEN** a orientação diz que basta contar o processo em algumas frases, e oferece começar essa
  conversa

#### Scenario: Quem restaura o próprio trabalho não recebe orientação
- **WHEN** a pessoa volta e o diagrama dela é restaurado
- **THEN** nenhuma orientação de primeira vez aparece

### Requirement: A sugestão acompanha o que está selecionado
O sistema SHALL trocar a sugestão para falar do elemento selecionado quando houver exatamente um, e
SHALL voltar à sugestão da trilha quando a seleção for desfeita, múltipla ou sem rótulo.

#### Scenario: Clicar numa tarefa muda a sugestão
- **WHEN** a pessoa seleciona um elemento com nome
- **THEN** a orientação nomeia esse elemento e oferece perguntar sobre ele

#### Scenario: A sugestão abre o painel com a pergunta digitada
- **WHEN** a pessoa aciona a sugestão
- **THEN** o painel do ajudante abre com a pergunta no compositor, **sem enviar**

#### Scenario: Seleção múltipla volta ao padrão da trilha
- **WHEN** a pessoa seleciona mais de um elemento, ou um elemento sem nome
- **THEN** a orientação volta a falar da trilha

### Requirement: A orientação não interrompe
O sistema SHALL NOT bloquear o canvas, abrir o painel sem pedido, nem repetir a orientação depois
de ela ser dispensada na mesma visita.

#### Scenario: Dá para fechar
- **WHEN** a pessoa fecha a orientação
- **THEN** ela some e não volta nessa visita

#### Scenario: O painel aberto dispensa a orientação
- **WHEN** o painel do ajudante está aberto
- **THEN** a orientação não aparece, porque os dois ocupam o mesmo canto

#### Scenario: O canvas continua utilizável
- **WHEN** a orientação está visível
- **THEN** nada do diagrama fica bloqueado e a barra do modelador continua alcançável

### Requirement: A orientação não cobre a alavanca do ajudante
O sistema SHALL posicionar a orientação a partir da medida da alavanca, e SHALL reposicioná-la
quando a janela mudar de tamanho.

#### Scenario: Em 375 px nada fica por baixo
- **WHEN** a janela tem 375 px de largura
- **THEN** a orientação fica inteiramente acima da alavanca do ajudante, com folga
