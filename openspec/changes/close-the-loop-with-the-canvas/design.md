## Context

O ajudante já tem duas formas de enxergar o diagrama, e nenhuma das duas serve para o que esta
change resolve:

| O que existe | Quando chega | Por que não basta aqui |
|---|---|---|
| A projeção do contexto (`agent/diagram.js`) | na **borda** do turno, puxada | o modelo decide o próximo passo **dentro** do turno, logo depois da ferramenta |
| O retorno da ferramenta (`{criado, ligadoA, …}`) | no mesmo turno | descreve **a operação**, não o desenho que sobrou dela |

O caso que mostrou a diferença: `criar_elemento` com `depoisDe` num elemento que já tinha saída.
A operação foi correta (o bpmn-js desenha ramo paralelo um degrau abaixo — regra dele, não defeito
nosso), o retorno foi correto, e a narração ficou errada, porque "o que o aluno vê" não estava
escrito em lugar nenhum.

## Decisions

### 1. A leitura vai no RESULTADO da ferramenta, não num quadro de contexto

Alternativa recusada: marcar o contexto como sujo e deixar a projeção contar na próxima borda.

Não serve porque o encadeamento acontece **dentro** do turno: o modelo cria, olha o resultado e
decide se liga, se renomeia, se avisa o aluno. Um fato que só chega na borda chega tarde — e foi
assim que o ramo virou narração errada. A PoC do Orbit chegou à mesma conclusão por outro caminho
(lá o servidor **espera** o relatório da página e o entrega como resultado da ferramenta).

### 2. A leitura é CURTA, e é a mesma função para todo mundo

`estadoDaTela()` devolve texto, não JSON de árvore. Teto declarado, e o que entra é escolhido pela
pergunta "o que muda a próxima decisão?":

- o diagrama é processo ou colaboração, e quantos elementos tem;
- o que está selecionado (é com isso que o aluno diz "esse aqui");
- do elemento tocado: entradas e saídas, e se ficou como ramo;
- **pontas soltas**: o que não liga em nada (é o defeito mais comum de aluno, e o agente hoje não
  enxerga);
- uma linha de regra: o que o agente não faz sem perguntar.

Alternativa recusada: devolver o XML ou a lista inteira. É o erro H4 de novo — 22 KB por turno
para o modelo reler o que já sabe, pago pela cota do aluno.

### 3. Mensagem da página é um TIPO, não um texto esperto

O canal existe no protocolo como qualquer turno de texto, mas carrega prefixo `(` e é registrado
no diário como `pagina.*`. Três consequências que o teste vai cobrar:

1. A bolha na tela é **nota de sistema**, não bolha de aluno (senão a conversa mente sobre quem
   disse o quê).
2. O idioma da resposta continua sendo o do aluno (o CopilotSpeaker já pagou por deriva de idioma;
   o Orbit escreveu a mesma regra depois).
3. O modelo é instruído a **agir, não narrar**: ninguém quer ouvir "a página informou que você
   selecionou a tarefa X".

### 4. A fila cede a vez ao aluno

Estado mínimo: `{ texto, epoca, ate }`. Envia quando `pronto && !turnoAberto && !falando`;
descarta quando `epoca !== epocaAtual` (o aluno falou) ou `agora > ate`.

Alternativa recusada: mandar na hora. O agente passaria por cima da fala do aluno — exatamente a
reclamação "ela fala por cima dela mesma" que já consertamos no áudio, repetida na conversa.

### 5. Candidato clicável reusa o que já existe

Nada de componente novo: a mesma lista que o painel já sabe desenhar (os chips de exemplo), com o
clique mandando `(escolhido no chat) …` e chamando `destacar`. O verbo `destacar` nasceu ontem por
outro motivo e paga essa conta sozinho.

## Risks

- **Verbosidade.** Toda escrita passa a carregar um parágrafo a mais no turno. Mitigação: teto de
  caracteres em `estadoDaTela()` e medição do contexto por turno (a change `sustain-a-class-session`
  mede isso).
- **Mensagem da página virando enxurrada.** Mitigação: uma única pendente por vez (a nova
  substitui a velha), e só os quatro eventos declarados.
- **O modelo lendo a nota em voz alta.** Mitigação: a regra do `(` no prompt, e um cenário de
  bateria que reprova se a legenda contiver o texto da nota.
