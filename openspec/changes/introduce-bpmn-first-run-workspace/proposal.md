> **Estudo concluído (2026-11-15).** Referências e leitura: `research.md`. Decisões: `design.md`
> (B1–B9). Plano: `tasks.md`. Comparação visual dos três conceitos, para o dono decidir:
> `openspec/apresentacoes/tela-base-conceitos.html`.

## Why

Quem abre o site hoje recebe **uma pizzaria em inglês que não pediu**. O modelador tenta restaurar
o `localStorage`, não acha nada e carrega `pizza-collaboration.bpmn` automaticamente
(`src/app.js`, `run()`). O resultado, nos primeiros cinco segundos: a pessoa não sabe se aquele
diagrama é dela, se é exemplo, se pode mexer, nem que dá para conversar com ele.

O painel do ajudante **já resolveu a parte dele** (`refine-assistant-panel-ui`, 2026-11-15): ele se
apresenta, diz o que faz, oferece quatro exemplos clicáveis e só então pede a chave. O que ficou
sem dono é a **página**: o espaço onde o trabalho acontece não diz nada.

Pedido do dono (2026-11-15):

> *"A gente está sempre abrindo com um exemplo de pizza… a gente poderia ter uma tela base, e
> nessa tela base a gente tivesse esse diagrama como um exemplo de diagrama, mas mostrando para o
> usuário que a partir dali ele pode criar o diagrama dele e pode usar o próprio ajudante para
> iniciar esse processo, de forma que ele pode descrever o processo dele e o agente vai ajudar."*

E, no mesmo dia, a ampliação: a tela base é **a porta do tutor** — ela convida a perguntar o que é
BPMN e a descrever o próprio processo, não só a escolher um arquivo.

## What Changes

- **A pizzaria deixa de carregar sozinha.** Sem trabalho salvo, o modelador nasce com um diagrama
  novo do bpmn-js e o espaço do canvas recebe um convite com **três caminhos**: descrever o próprio
  processo (cartão primário), ver o exemplo, começar do zero. Mais uma entrada de descoberta —
  *"não sabe o que é BPMN?"* — que abre o exemplo **e** o ajudante com a pergunta pronta.
- **A escolha é um estado, não a ausência de desenho.** Uma segunda chave (`bpmn.primeira-vez`)
  guarda o que a pessoa escolheu, porque o autosave só escreve quando há edição: canvas em branco
  sem edição não distingue "escolhi começar do zero" de "ainda não decidi".
- **Quem já tem trabalho salvo nunca vê a tela base** — abre direto no que deixou.
- **O exemplo nasce identificado**: uma tira discreta diz que aquilo é um exemplo e oferece
  "começar o meu"; ela some na primeira edição, quando o desenho vira trabalho da pessoa. Depois de
  "começar do zero", a mesma tira oferece "ver um exemplo" — o exemplo continua a um clique.
- **`#exemplo` abre o exemplo direto**, para linkar a demonstração sem passar pelo convite.
- **A chave continua sendo assunto do painel.** A tela base não pede chave, não abre o painel
  sozinha e não cria um segundo campo de conversa.

## O que esta change NÃO vai fazer

- **Não promete o que o agente ainda não faz.** "Proposta nomeada que o aluno aceita antes de
  qualquer traço" é o portão F8 inteiro, que não passou; "resposta fundamentada na norma, com
  citação" é FK, que tem 0 de 31 caixas. A tela convida a conversar e a descrever — e o texto dela
  é escrito contra essa lista, não contra o roadmap.
- **Não vira galeria de modelos.** Miro e Whimsical vivem de catálogo; aqui um exemplo bem
  identificado basta.
- **Não é página separada nem tour modal.** Nenhuma URL nova, nenhum passo-a-passo obrigatório.
- **Não conduz a entrevista por código.** "Descreva o seu processo" abre a conversa com a pergunta
  digitada e **para por aí**: quem pergunta o que inicia, o que vem depois e quem faz é o modelo,
  por function calling (constituição §III). Roteiro com `if` seria a violação exata que o projeto
  proíbe.
- **Não mexe no botão "♻️ Novo" da barra** (que hoje recarrega a pizzaria e apaga o autosave sem
  perguntar) nem no viewer. Ficam registrados em `open-items.md`.

## Impact

- Afeta: `src/app.js` (a decisão de abertura), um módulo novo `src/primeira-vez/**`, um verbo novo
  no widget (`sugerir`, que deixa a pergunta pronta sem enviar) e a bateria de tela.
- Não afeta: `/viewer.html`, a simulação em lote, o protocolo do ajudante, o prompt, o catálogo de
  ferramentas, a política. Nenhuma dependência nova.
- Fase no roadmap: trabalho de **produto**, paralelo a F8b. Não bloqueia nem é bloqueado por F8/FK
  — mas o texto da tela depende do que esses dois já provaram, e é por isso que ele é curto.
