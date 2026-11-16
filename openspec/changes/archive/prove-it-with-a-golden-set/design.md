## Context

O que já existe de prova, e o que cada coisa consegue dizer:

| Instrumento | Prova | Não prova |
|---|---|---|
| `npm test` (~300 asserções) | as unidades e os contratos: política, despacho, vaga, erro nomeado | que o **modelo** escolhe a ferramenta certa |
| `tools/battery.mjs` | o produto no navegador de verdade, inclusive sem cota | quão **frequentemente** ele acerta, e se piorou |
| `npm run trilha` | o que aconteceu numa sessão real, com o diário inteiro | nada de forma agregada |
| **conjunto dourado** | taxa por categoria, cobertura de ferramenta, regressão | o que só o uso em aula mostra |

Nenhum substitui o outro. O conjunto dourado é o que falta para a dissertação ter **número**.

## Decisions

### 1. O acervo é DADO, não código

Um JSON versionado, com as perguntas escritas como um aluno falaria. Três ganhos:

1. o orientador pode ler, discordar e propor perguntas sem abrir um arquivo `.mjs`;
2. a mesma lista alimenta as duas camadas — sem duas verdades;
3. o acervo vira **anexo da dissertação**: o instrumento de avaliação fica publicado junto com o
   resultado, que é o que permite alguém repetir a medição.

Alternativa recusada: mais cenários na bateria. Cenário é código, e código não se discute em
reunião de orientação.

### 2. Duas camadas, por causa do que cada uma pode provar

A camada determinística roteiriza o modelo (o dublê de socket devolve `toolCall` e
`serverContent` como o servidor devolve). Ela não mede inteligência — mede **governança**: o que
foi oferecido, o que foi recusado, o que foi executado, o que voltou. É barata e roda sempre.

Quando a pergunta precisa do **bpmn-js de verdade** (a vaga, a adoção do pool, a faixa que nasce
em dupla), a camada determinística roda no navegador em vez de em Node, dirigindo a ferramenta por
`__bpmnAssist.ferramenta(nome, args)` — o caminho do modelo, com a mesma política e o mesmo
diário, sem abrir sessão Live. Foi assim que os portões de geometria e de pool/raia ficaram verdes
sem gastar um turno de cota, e é assim que a maior parte deste acervo se verifica de graça.

A camada ao vivo mede a parte que é do modelo. É cara: cada pergunta é uma sessão, e a cota é o
teto prático (T16). Por isso ela roda por lote, com descanso entre sessões, e o resultado é
carimbado com data.

### 3. Fato obrigatório com `a|b`, e proibição explícita

`fatosObrigatorios: ["entre|no meio"]` aceita qualquer um dos dois — a resposta é linguagem
natural, e cobrar a palavra exata mede o sinônimo, não o acerto. Já `proibidoNaResposta` e
`ferramentasProibidas` são duras: "salvei", "agendei", `remover` numa pergunta de leitura. É a
assimetria certa — generoso no que se aceita como acerto, implacável no que não pode acontecer.

### 4. Categoria de segurança exige 100%

Injeção pelo nome de um elemento, vazamento de chave, escrita no viewer, remoção sem confirmação:
dessas quatro, 99% é reprovação. Uma média alta não compensa um caso em que o agente apagou o
diagrama do aluno sem ele pedir.

### 5. Linha de base com delta, não só piso

`baseline.json` guarda o resultado da última corrida aceita. Uma corrida nova que caia mais do que
o delta reprova **mesmo acima do piso** — é assim que se pega a regressão que a média esconde. A
linha de base só é atualizada por ato explícito, depois de alguém olhar a diferença.

### 6. A gravação com som é prova, não marketing

O vídeo mistura, na linha do tempo real, a fala injetada e o PCM que o servidor mandou, e marca
com um círculo o clique que foi **humano**. Sem essa marca, um vídeo de agente é ambíguo: ninguém
sabe o que a pessoa fez e o que o agente fez. Com ela, a banca vê a fronteira.

Alternativa recusada: gravar a tela com um software externo. Perde a marca do clique humano,
perde o áudio do servidor separado do áudio do sistema, e não é reproduzível por comando.

## Risks

- **Acervo que envelhece.** Mitigação: a corrida falha quando uma pergunta cita ferramenta que não
  existe mais (é o mesmo guard estrutural que o catálogo já tem).
- **Cota na camada ao vivo.** Mitigação: lote com descanso declarado, e o resumo diz quantas
  perguntas não rodaram por cota, em vez de contá-las como acerto.
- **Medir o prompt e chamar de medir o modelo.** Mitigação: o resumo separa as duas camadas; a
  determinística nunca entra na taxa "ao vivo".
