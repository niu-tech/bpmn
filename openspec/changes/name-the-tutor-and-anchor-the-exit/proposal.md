> Decisões em `design.md` (N1–N6); o que a pesquisa decidiu, e com que fonte, em `research.md`.
> Terceira rodada da tela base: `introduce-bpmn-first-run-workspace` resolveu **escolher** o
> caminho, `guide-the-first-run-trails` resolveu **o que acontece depois de escolher**, e esta
> resolve **como sair** — e como o produto chama quem está do outro lado da conversa.

## Why

Quatro observações do dono (2026-11-16), usando o produto no ar. As três primeiras são de texto e
de forma; a quarta é um defeito que a rodada anterior **criou**:

> *"Atualmente o texto abre: «Quero modelar o MEU processo — vou te descrever», podemos melhorar
> isso, não preciso do «MEU» escrito assim, e a outra coisa é que o texto aparece mal colocado pois
> tem 2 linhas, e quebra um pouco na visualização do chat que vai ser enviado."*

Medido, e ele está certo: o compositor tem **317 px de largura e 40 px de altura — uma linha**. A
frase tem 47 caracteres e rende `scrollHeight` 52. Ou seja, a primeira coisa que o produto escreve
no lugar do aluno **já chega cortada**.

> *"podemos melhorar isso de tutor, está repetido 3 vezes, podemos deixar mais claro que temos um
> agente de IA especializado em ensinar sobre BPMN"*

A palavra aparece três vezes na tela base — e a causa não é descuido de redação: **a mesma coisa tem
três nomes no produto** ("tutor" na tela, "Ajudante BPMN" no painel e na alavanca, "ajudante" no
código). Repetir não era ênfase, era a tela tentando dizer *o que aquilo é* sem nunca ter um nome
para dizer.

> *"indo para criar seu próprio diagrama, não temos mais nenhuma forma de voltar à tela inicial
> depois de fechar o balão, precisamos ter uma forma que persista."*

É o defeito mais grave, e é nosso: a barra do tutor **morre na primeira edição** (de propósito — o
que foi editado não é mais exemplo). Com ela morria o único "voltar ao menu" da tela. O que sobrava
era o "♻️ Recomeçar" **dentro da barra do modelador, que nasce recolhida** — e que é destrutivo.
Resultado: escolher uma trilha era uma porta de mão única.

## What Changes

- **Um nome, dito uma vez: o `Tutor BPMN`.** Nome de papel, numa fonte só
  (`src/assistant/identidade.js`), usado pela tela, pelo painel e pela alavanca. Com ele, a tela
  pode dizer **uma vez** o que antes repetia três: um agente de IA especializado em BPMN, que lê o
  diagrama aberto.
- **As frases que o produto semeia cabem em uma linha.** Teto de 33 caracteres, medido no
  compositor e guardado por teste. Sai o `MEU` em maiúscula.
- **A âncora: um caminho de volta PERMANENTE**, presente nas três trilhas, que sobrevive à edição e
  ao fechamento do balão. Leva ao início sem descartar nada.
- **O início deixa de ser armadilha nos dois sentidos**: com trabalho aberto, o convite oferece
  *continuar o que eu estava fazendo* e fecha no `Esc`.
- **Trocar de trilha com trabalho vivo pergunta antes** — constituição §VII: substituir o diagrama é
  ação destrutiva. A âncora torna isso alcançável, então o convite pergunta **no próprio cartão**,
  em dois cliques (o mecanismo já provado no "Recomeçar").
- **A barra do tutor deixa de carregar navegação.** Ela é efêmera; a navegação agora é permanente e
  tem um lugar só. Isso também apaga a causa do aperto de geometria em 375 px.
- **A tela base responde três perguntas em vez de explicar três coisas**: um visual (mini-diagrama
  em SVG inline), uma ação principal de verdade e dois caminhos visivelmente secundários.

## O que esta change NÃO vai fazer

- **Não dá nome próprio humano ao agente** ("Bia", "Theo"). Nome de papel diz o que ele faz; nome
  de pessoa promete um personagem que o produto não sustenta, e a banca vê uma ferramenta de ensino,
  não um mascote (`research.md` §2).
- **Não põe "IA" no nome.** `Tutor BPMN`, e a frase ao lado diz que é um agente de IA — que é o que
  o dono pediu deixar claro. Nome é papel; capacidade é descrição (Genesys, `research.md` §2).
- **Não abre o painel sozinha** e não pisca nada: a recusa de `guide-the-first-run-trails` (G2)
  continua de pé, com o mesmo motivo.
- **Não mexe na barra do modelador** além de ela continuar saindo de cena com o convite no ar, nem
  no prompt, no catálogo de ferramentas ou na política.

## Impact

- Afeta: `src/assistant/identidade.js` (novo), `src/primeira-vez/tela.js`, `primeira-vez.css`,
  `src/app.js`, `src/assistant/ui/widget.js` (três strings de nome e uma frase), e os cenários de
  tela base da bateria.
- Não afeta: `/viewer.html`, a simulação, o prompt, as ferramentas, o acervo.
