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

## O numero medido (2026-11-17) — e por que ele fecha a promessa

`tools/medir-construcao.mjs` correu o MESMO pedido contra o dev server e contra
`niu-tech.github.io/bpmn`, separando por chamada a nossa execucao (`tool.executando` →
`tool.concluida`) da volta ao modelo:

| | dev server | publicado |
|---|---|---|
| chamadas / formas | 8 · 2→10 | 8 · 2→10 |
| **nossa escrita** (mediana / pior) | **0,01 s** / 0,01 s | **0,00 s** / 0,01 s |
| **volta ao modelo** (mediana / pior) | 0,46 s / 0,69 s | 0,47 s / 0,86 s |
| do envio ao último elemento entrar | 3,5 s | 3,7 s |
| **nossa fatia do total** | **1%** | **1%** |

**99% da espera e' a volta ao modelo**, e a nossa escrita no bpmn-js e' SINCRONA. Entao a tarefa
1.2 se cumpre do jeito que ela mesma previu: esta change **nao promete velocidade**, e isso esta
escrito aqui — no documento — e nao no commit.

**O publicado nao e' mais lento que o local.** As duas colunas sairam da mesma hora, com o mesmo
pedido. Os 3 a 5 s por bloco que o dono sentiu em producao nao vem de estar publicado: vem da
volta ao modelo, que varia por turno (um turno com mais elementos tem mais voltas). Isso fecha a
suspeita: nao ha nada para consertar no deploy.

**O insumo que a medicao deixou (1.3):** 14 chamadas para 8 elementos na sessao ao vivo. Pedir ao
modelo que AGRUPE chamadas e' o unico candidato real de velocidade — e so' valia a pena se o
modelo dominasse o tempo, o que agora esta medido. Fica para uma change propria, com o numero na
mao.

## Non-Goals

- **Acelerar o modelo.** A espera entre chamadas é do transporte; esta change torna a espera
  legível, não curta. Prometer velocidade seria mentir sobre o que controlamos.
- Barra de progresso com percentual: o agente não sabe quantos elementos faltam, e um percentual
  inventado é pior que nenhum.
- Animação longa ou efeito de desenho a mão. O destaque é de um piscar; o resto é enfeite que
  atrasa quem está usando.
- Mudar o que o agente desenha. O gateway errado tem change própria
  (`give-gateways-their-second-path`); esta é sobre **mostrar**, não sobre desenhar certo.
