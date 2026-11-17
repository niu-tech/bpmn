# Começar um processo do zero sem perder o que está na tela

> Decisões: `design.md` (N1–N6). Plano: `tasks.md`. Continua
> `name-the-tutor-and-anchor-the-exit`, que deu o caminho de **volta** à tela inicial — esta
> resolve o que acontece quando ele é usado com trabalho vivo na tela.

## Why

O dono, testando ao vivo em 2026-11-17:

> *"A gente não tem uma opção dele estar com um processo, por exemplo, de exemplo aberto, ele não
> consegue tirar tudo e iniciar um novo. (…) eu estou olhando para um processo, mas eu quero fazer
> um do zero. (…) perguntar o que a gente quer fazer com o que tem, que a gente vai perder, ou
> arrumar uma forma de deixar isso guardado, ou abrir para perguntar se ele quer salvar."*

Hoje existem dois caminhos, e nenhum é o que ele pediu:

- **a âncora** leva de volta ao convite, e o convite pergunta antes de trocar de trilha — mas o
  que ele oferece é **outra trilha** (ver o exemplo, descrever o processo, descobrir o BPMN), não
  *"continuar daqui com a folha limpa"*;
- **"Recomeçar"**, dentro da barra do modelador, descarta — e descartar é a única coisa que ele
  faz. Não guarda, não pergunta o que fazer com o que existe, e nasce recolhido.

Então quem está olhando o exemplo da pizzaria e quer desenhar o processo **dele** tem duas saídas
ruins: apagar elemento por elemento (o agente faz, e gasta turnos), ou perder o que está na tela
sem escolher perder.

⚠ E há um agravante que o produto nunca contou: o diagrama vive num autosave do navegador e
**morre com a aba**. Hoje ninguém diz isso na hora em que importa, que é quando a pessoa vai
descartar.

## What Changes

- **"Começar do zero" vira trilha de verdade**, alcançável com trabalho vivo na tela — e não um
  efeito colateral de voltar ao menu.
- **Antes de descartar, o produto pergunta — e a pergunta oferece GUARDAR**, não só sim/não.
  Guardar é baixar o `.bpmn`: o arquivo é do aluno, abre em qualquer ferramenta BPMN e não depende
  de nós existirmos amanhã.
- **A folha limpa nasce desenhável**, com o evento de início já lá: canvas vazio de verdade é a
  caixa em branco que a pesquisa da `guide-the-first-run-trails` mandou evitar.
- **O agente ganha o verbo**, para a trilha funcionar por voz: *"quero começar do zero"* passa
  pelo mesmo portão de confirmação das ações destrutivas (§VII), com a mesma regra de ordem —
  recusa até o aluno responder.
- **A perda passa a ser dita onde ela acontece**: a mensagem de descarte conta que o desenho vive
  nesta aba e some com ela.

## Non-Goals

- **Memória entre visitas** (F.5) continua fora, e por decisão do dono: o diagrama morre com a aba
  por escolha, e o aviso de privacidade diz isso. Guardar aqui é **baixar arquivo**, nunca servidor.
- Histórico de versões, múltiplos diagramas abertos, abas internas. Um diagrama por vez continua
  sendo o produto.
- Importar `.bpmn` de volta: o viewer já tem *Load BPMN*, e o modelador ganhar o caminho inverso é
  outra frente (e sem ela o `.bpmn` baixado continua abrindo em qualquer ferramenta).
