# Decisões — uma chamada para a sequência inteira

## D1. O verbo novo é uma FILA, e só uma fila

`criar_sequencia({ passos, depoisDe, dentroDe })`. `passos` é `[{ tipo, nome }]`, na ordem em que
o aluno falou. O primeiro passo nasce na âncora (`depoisDe`) ou no lugar (`dentroDe`), exatamente
como `criar_elemento` faz hoje; cada passo seguinte nasce **depois do passo anterior**.

Por que não um verbo genérico de lote (uma lista de chamadas quaisquer): porque aí o ganho vira
risco. Um lote genérico precisa de ids entre os itens — e id que o modelo cita é id que ele pode
errar, como a sessão do gateway mostrou (`renomear` num `Flow_…` que um desfazer já tinha
matado). A fila não tem esse problema: **nenhum id atravessa a fronteira do modelo**, porque os
ids nascem e são consumidos aqui.

⚠ E a fila é o caso que PAGA: no pedido medido, 7 das 8 chamadas eram a mesma fila.

## D2. Reaproveita `criar_elemento`, passo por passo — não um caminho novo de desenho

O executor chama o **próprio** `criar_elemento` em laço, com `depoisDe` apontando para o id que a
iteração anterior criou. Nada de posicionamento novo, nada de `appendShape` próprio.

Isto não é economia de linhas: é economia de **comportamento divergente**. `criar_elemento` carrega
regras que levaram duas sessões ao vivo para ficar certas — a vaga é do `autoPlace`, "depois de X"
encadeia em vez de ramificar, o nome nasce no mesmo comando, o gêmeo é recusado, `sem_lugar`
devolve os nomes dos pools. Uma segunda implementação de "criar na ponta" nasceria errada em pelo
menos uma dessas, e o defeito apareceria só no desenho do aluno.

## D3. Falha no meio DEVOLVE o que entrou — nunca estoura

Se o passo 4 de 6 falha, a ferramenta **retorna**: `{ criados: [...3...], parou: { passo: 4,
motivo, erro } }`. Não lança.

O motivo é mecânico, e está no despachante: exceção vira `{ ok:false, erro:'ferramenta_falhou' }`
e o corpo do resultado é **descartado**. Ou seja, lançar no passo 4 diria ao modelo que nada
aconteceu — enquanto o aluno está olhando três elementos novos na tela. O modelo narraria o
contrário do que ele vê, e tentaria a fila inteira de novo (criando gêmeos, ou sendo recusado por
eles).

**Exceção à exceção:** se o passo **1** falha, aí lança. Nada foi desenhado, e a recusa nomeada é
exatamente o que o modelo precisa — inclusive a de `sem_lugar`, que leva os nomes dos pools e os
candidatos clicáveis para a tela.

## D4. Teto de 12 passos, com erro nomeado

Por três motivos, nenhum deles estético:

1. **O resultado volta ao modelo e é pago pelo aluno.** O despachante corta em 4000 caracteres
   (`MAX_CORPO`); uma fila de 40 passos chegaria cortada ao meio, que é pior que recusada.
2. **O desenho reorganiza.** Cada passo mexe no canvas; uma fila enorme é um salto visual que o
   aluno não consegue acompanhar — e a change da espera legível existe justamente para ele
   acompanhar.
3. **Fila de 40 passos é outro problema de produto** (ditado longo, importação), não um pedido de
   aula.

Acima do teto: erro nomeado, dizendo quantos cabem. O modelo quebra em duas chamadas — e duas
chamadas para 24 passos continua sendo 1/12 do custo de hoje.

## D5. UM resultado, com a tela uma vez

O resultado tem `criados` (id · tipo · nome de cada passo), `ligacoes` (quantas nasceram),
`comandos` (o total, medido no `commandStack`, que é o `quantos` de `desfazer`) e `tela` **uma**
vez, no fim.

Não é a concatenação dos N resultados de `criar_elemento`: cada um deles traz `tela` e `fatos`
completos, e seis deles estourariam o `MAX_CORPO` sozinhos. O que o modelo precisa para o próximo
passo é o desenho **de agora** — o retrato intermediário não serve para nada e custa cota.

## D6. A tela do aluno continua honesta por MEDIÇÃO

A linha de construção conta formas antes e depois da chamada (regra XV, change anterior), então
uma chamada que cria 7 elementos aparece como 7 — sem nenhuma mudança na camada da tela. O
apresentador ganha uma linha própria (*"desenhei a fila: 6 passos"*) porque a frase de
`criar_elemento` fala de um elemento só.

⚠ E o selo de escrita: a fila é síncrona como o resto, então ela cai no mesmo tempo mínimo de
leitura de 700 ms. Nada novo — mas é por isso que o selo precisava existir antes desta change.

## D7. O ensino vai na DECLARAÇÃO, e isso é regra, não sobra de orçamento

O tier estável está com 5340 de 5400 caracteres. Ensinar "quando usar fila" ali custaria subir o
teto para caber a própria adição, que é como orçamento vira ficção (§IX).

A declaração da ferramenta é o canal **certo** para "como se usa este verbo": é o que o modelo lê
no momento de escolher a chamada, viaja no catálogo e some quando o perfil não tem escrita.
`ramificar` provou isso ao vivo em 2026-11-17 — escolhido duas vezes, sem uma linha de prompt.

A descrição diz as três fronteiras, porque é onde o modelo erra:

- **fila** → passos em sequência, um depois do outro;
- **`criar_elemento`** → um elemento só, ou um que entra no meio (`entre`), ou um ramo
  (`comoRamo`);
- **`ramificar`** → caminho de decisão, que leva rótulo.
