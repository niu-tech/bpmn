# Mostrar o trabalho enquanto o agente desenha

> Decisões: `design.md` (M1–M6). Plano: `tasks.md`. Evidência: a sessão de voz do dono em
> 2026-11-17, lida da aba dele — 17 chamadas de ferramenta em **9 segundos** no local, e o relato
> dele de **3 a 5 segundos por bloco** no site publicado.

## Why

O dono, descrevendo um processo inteiro por voz e vendo o agente desenhar:

> *"Eu acho que ela poderia ser melhor enquanto o modelo está trabalhando. (…) eu tentei hoje em
> produção e ele demorou, cada quadrado que foi criado ele demorou cerca de 3, 4, 5 segundos, e
> isso é ruim porque o usuário está vendo e não sabe que está acontecendo alguma coisa, a não ser
> a resposta visual que tem no chat, mas ela poderia ser melhor também."*

O que a sessão registrou, e que separa dois problemas que parecem um:

- **o nosso lado é rápido**: as 17 chamadas saíram entre 122,5 s e 131,4 s — de 0,4 a 1,0 s uma da
  outra, execução inclusa. Não há nada lento no produto;
- **o que demora é a volta ao modelo** entre uma chamada e a seguinte, e isso é do transporte: não
  dá para acelerar daqui. O que dá é **parar de parecer parado**.

E o que a tela oferece hoje durante esses segundos é **uma linha de chat por chamada**. Numa
construção de doze elementos isso vira uma parede de texto — com direito a duas linhas *"desfiz —
saiu 2 elementos"* no meio, que são o modelo se corrigindo e, para quem lê, parecem erro.

O desenho em si não dá sinal nenhum: o elemento aparece e pronto. Quem está olhando o canvas não
sabe se o agente terminou, se parou, ou se ainda vem mais.

## What Changes

- **O canvas conta a história**: o elemento que acabou de nascer **pisca uma vez** e a tela rola
  até ele. É onde a pessoa está olhando, e hoje é o único lugar que não diz nada.
- **Uma linha que cresce, não doze linhas**: enquanto o agente constrói, a conversa mostra **uma**
  mensagem viva — *"montando o processo — 6 elementos"* —, com os detalhes ainda lá para quem
  quiser abrir. Parede de texto vira resumo.
- **O selo diz "desenhando"**, e não "pensando": são estados diferentes para quem espera, e o
  produto já tem selo próprio para ferramenta rodando.
- **Autocorreção deixa de parecer erro**: `desfazer` no meio de uma construção entra como ajuste
  (*"ajustei — refiz 2 elementos"*), não como uma linha solta de desfazer.
- **A latência vira número medido**, no local e no publicado, com a ferramenta que já existe — em
  vez de promessa de que "ficou mais rápido".

## Non-Goals

- **Acelerar o modelo.** A espera entre chamadas é do transporte; esta change torna a espera
  legível, não curta. Prometer velocidade seria mentir sobre o que controlamos.
- Barra de progresso com percentual: o agente não sabe quantos elementos faltam, e um percentual
  inventado é pior que nenhum.
- Animação longa ou efeito de desenho a mão. O destaque é de um piscar; o resto é enfeite que
  atrasa quem está usando.
- Mudar o que o agente desenha. O gateway errado tem change própria
  (`give-gateways-their-second-path`); esta é sobre **mostrar**, não sobre desenhar certo.
