## ADDED Requirements

### Requirement: O contexto é semeado na sessão, não escrito no setup
O sistema SHALL enviar o quadro de contexto por `clientContent` com `turnComplete: false` logo
após o `setupComplete`, e SHALL enviar apenas o **delta** nos turnos seguintes. O sistema SHALL
NOT reabrir a sessão para atualizar contexto.

#### Scenario: Contexto chega sem abrir turno
- **WHEN** a sessão fica pronta e o quadro é semeado
- **THEN** o servidor não inicia uma resposta, e o próximo turno do aluno é o primeiro da conversa

#### Scenario: Diagrama que mudou entra no turno seguinte
- **WHEN** o aluno cria um elemento e em seguida pergunta algo
- **THEN** o delta enviado naquele turno menciona o elemento novo

### Requirement: Trocar de modo preserva a conversa
O sistema SHALL reconstruir, na sessão nova, o contexto e o histórico resumido da conversa ao
alternar entre voz e texto. O aviso de perda de contexto SHALL ser removido quando a reconstrução
estiver ativa.

#### Scenario: O agente lembra do que foi dito antes da troca
- **WHEN** o aluno conversa no modo texto, troca para voz e pergunta "sobre o que a gente estava
  falando?"
- **THEN** a resposta cita o assunto do turno anterior

#### Scenario: Sem contexto a reconstruir, nada é prometido
- **WHEN** a troca de modo acontece antes de qualquer turno
- **THEN** nenhum aviso de perda de contexto é mostrado e nenhum histórico é semeado

### Requirement: Memória da aba com categorias e teto
O sistema SHALL manter em memória da aba entradas classificadas como `fato`, `decisao` ou
`preferencia`, cada uma com o turno de origem e o carimbo de tempo, com teto por categoria e
descarte do mais antigo ao estourar.

#### Scenario: Preferência declarada vale nos turnos seguintes
- **WHEN** o aluno diz "responda sempre em uma frase" e depois faz outra pergunta
- **THEN** a seção de memória do turno seguinte contém essa preferência

#### Scenario: O teto é respeitado
- **WHEN** mais entradas que o teto de uma categoria são registradas
- **THEN** a categoria mantém exatamente o teto, preservando as mais recentes

### Requirement: A memória morre com a aba
O sistema SHALL NOT persistir memória em `localStorage`, `sessionStorage`, cookie, IndexedDB ou
qualquer outro armazenamento que sobreviva ao fechamento da aba, enquanto não houver change
própria com consentimento e aviso reescritos.

#### Scenario: Recarregar zera a memória
- **WHEN** a página é recarregada depois de uma conversa
- **THEN** a memória do agente está vazia e nenhum armazenamento do navegador contém entradas dela

#### Scenario: A varredura de vazamento continua limpa
- **WHEN** a bateria roda o cenário de vazamento depois de uma conversa com memória preenchida
- **THEN** nenhum armazenamento contém a chave nem o conteúdo da conversa
