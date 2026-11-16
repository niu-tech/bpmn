# Design — ferramentas de diagrama

## T1 — Tudo por `modeling`, nada por XML

**Decisão.** Criar, conectar, renomear e remover passam pelos serviços `modeling` do bpmn-js.

**Por quê.** É o que põe a alteração na pilha de desfazer: o aluno aprieta Ctrl+Z e some, como se
ele mesmo tivesse feito. Mexer no XML por fora produz um diagrama que o modelador não sabe que
mudou — e um desfazer que restaura o estado errado.

**Recusado.** Gerar XML e recarregar o diagrama. Funciona na demonstração e destrói o trabalho do
aluno no primeiro uso real: perde seleção, perde posição de viewport e perde o histórico.

## T2 — Âncora relativa, não coordenada absoluta

**Decisão.** `criar_elemento` recebe um elemento âncora e uma direção (`depois`, `antes`,
`abaixo`), não `x`/`y`.

**Por quê.** O modelo não vê a tela. Pedir coordenada a ele produz elementos empilhados no canto.
Âncora é a linguagem que ele tem: *"depois do evento de início"*.

**Limite conhecido.** Vários elementos criados em sequência vão se acumular sem layout bonito.
Layout automático fica para depois (tarefa 5.1) — melhor um diagrama feio e correto do que um
layout heurístico que embaralha o que o aluno já posicionou.

## T3 — Erro nomeado, nunca silêncio

**Decisão.** Toda ferramenta devolve `{ok:false, erro:'<nome>'}` com um conjunto fechado de nomes
(`elemento_nao_encontrado`, `ligacao_invalida`, `somente_leitura`, `cancelado_pelo_aluno`).

**Por quê.** O modelo precisa de um fato para decidir o próximo passo. "Deu erro" faz ele tentar
de novo igual; `elemento_nao_encontrado` faz ele procurar primeiro.

## T4 — Remoção é o único gate de confirmação

**Decisão.** Só `remover` pede confirmação. Criar, conectar e renomear executam direto.

**Por quê.** Criar a mais é ruído que o aluno apaga; remover o que ele fez é perda. Pedir
confirmação em tudo transforma a conversa num formulário, que é o oposto do pedido.

## T5 — Simulação é leitura, nunca disparo

**Decisão.** `resumir_simulacao` lê a última corrida. O agente **não** dispara simulação.

**Por quê.** Uma corrida em lote leva segundos e muda a tela inteira (heatmap). Disparar isso a
partir de uma frase ambígua é efeito grande demais para um mal-entendido. Se o aluno quiser,
clica — e aí o agente comenta o resultado.

**Reavaliar quando.** Houver confirmação na interface e o agente já estiver provado nas
ferramentas de escrita.

## T6 — O dublê de teste é da nossa camada, não do bpmn-js

**Decisão.** As ferramentas falam com `src/assistant/tools/bpmn-api.js`; os testes dublam **essa**
camada.

**Por quê.** Dublar o bpmn-js inteiro é reimplementá-lo mal. A camada fina tem seis funções, e é
contra ela que a lógica das ferramentas precisa ser provada. O caminho real contra o bpmn-js de
verdade é coberto pelos cenários da bateria, no navegador.
