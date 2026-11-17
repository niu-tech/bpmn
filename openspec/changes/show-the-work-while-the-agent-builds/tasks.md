# Tarefas — mostrar o trabalho enquanto o agente desenha

## 1. Medir antes de prometer

- [x] 1.1 `tools/medir-construcao.mjs`: dirige o MESMO pedido de construção contra
      `127.0.0.1:8126` e contra o site publicado, e devolve por chamada — nossa execução ×
      espera pela volta do modelo —, com mediana e pior caso
- [x] 1.2 Rodar nos dois e guardar o número. ⚠ Se a espera for toda do transporte, **esta change
      não promete velocidade** — e isso vai escrito no `proposal.md`, não no commit
- [x] 1.3 O relatório diz quantas chamadas o turno gastou: é o insumo para decidir, depois, se
      vale pedir ao modelo que agrupe

## 2. O canvas fala

- [x] 2.1 `destacarBrevemente(id)` na camada fina: classe CSS no `g.djs-element`, ~600 ms, sem
      `setColor` (cor entra no DI e fica no arquivo do aluno)
- [x] 2.2 Toda escrita que cria ou move chama o destaque; `scrollToElement` continua como está
- [x] 2.3 Teste no navegador: a classe entra e **sai**; o XML exportado não ganha cor nenhuma

## 3. Uma mensagem que cresce

- [x] 3.1 O gerente agrupa as linhas de escrita do mesmo turno sob uma mensagem de construção com
      contagem viva
- [x] 3.2 As linhas detalhadas continuam existindo e acessíveis (elas são a prova — H3)
- [x] 3.3 Teste: seis escritas num turno → uma mensagem de construção com seis dentro
- [x] 3.4 Teste: uma escrita isolada **não** vira mensagem de construção (não inventar cerimônia
      para um elemento só)

## 4. Selo e ajuste

- [x] 4.1 O rótulo do estado distingue *desenhando* de *pensando*
- [x] 4.2 `desfazer` dentro de turno com escrita vira *"ajustei — refiz N elementos"*; fora disso,
      continua *"desfiz"*
- [x] 4.3 Testes dos dois casos

## 5. Portão

- [x] 5.1 **Sem cota**, dirigindo as ferramentas pelo caminho do modelo: construção de ≥ 4
      elementos → uma mensagem de construção, destaque que entra e sai, selo *desenhando*
- [x] 5.2 **Sem cota**: desfazer no meio da construção aparece como ajuste
- [x] 5.3 **AO VIVO**: descrever um processo de ≥ 6 passos e medir o que a tela mostrou do começo
      ao fim — print no início, no meio e no fim da construção
- [x] 5.4 O portão afirma o **antes** (os elementos entraram no desenho) e o **depois** (a conversa
      tem uma mensagem com o número certo): "não há doze mensagens" é verdade num chat vazio
      (princípio XIII)

## 6. Registro

- [x] 6.1 O número medido em 1.2 entra no `open-items.md`, com a data e as duas origens
- [x] 6.2 Se a espera for do transporte, dizer isso **no produto** não: dizer no registro. A tela
      não deve explicar a arquitetura do Gemini para o aluno

## O que ficou provado (2026-11-17)

**Portão sem cota**: `{"entraram":6,"umaMensagem":true,"detalhes":6,"seloDesenhando":true,`
`"piscou":true,"parouDePiscar":true,"ajusteNaoErro":true,"numeroDito":5,"formasAgora":5,`
`"numeroBateComATela":true}`

⚠ **Um defeito meu, achado pelo próprio portão:** a contagem dizia *"7 elementos"* depois de seis
criações e um desfazer — quando havia cinco na tela. Eu contava CHAMADAS. Agora conta o
**desenho** (formas antes × formas agora), então o desfazer faz o número cair. Era o número da
mensagem mentindo sobre a tela, na mudança que existe para a tela parar de mentir.

⚠ **E uma lição de como medir DOM:** quando a mensagem do desfazer é absorvida, a lista encolhe e
o painel redesenha tudo (`replaceChildren`). O nó capturado antes fica **órfão**, mostrando o
número velho — medir um passado que já saiu da tela. O portão re-consulta o DOM, e o porquê está
escrito nele.

⚠ **E o terceiro, o pior:** o selo novo ficou **PRESO**. A volta do estado estava escrita em
dois lugares e um deles conhecia só `consultando` — ao separar *desenhando*, a escrita que
RECUSA (ambiguidade, portao) nunca devolvia o selo. E selo preso aqui não é cosmético: ele
**trava a tela**, porque clicar num candidato só vale em estado de conversa, então o aluno
clicava num botão e ouvia *"conecte antes de escolher"* — com a sessão aberta e saudável. Foi um
portao de OUTRA change (candidato clicável) que pegou: a mudança que existe para a espera ficar
legível quase deixou a tela muda. O conserto deu **uma fonte** à lista
(`OCUPADO_POR_FERRAMENTA`), e o teste determinístico afirma as duas metades — o selo volta **e**
o clique do aluno continua funcionando.

⚠ **A contagem presumia o que não tinha medido.** A base era `agora - 1`, deduzida — ou seja,
"a primeira escrita criou algo". Com uma escrita que recusou e outra que só pintou, a mensagem
anunciava *"montando o processo — 1 elementos"* sem nada ter sido desenhado (e com o plural
errado, de brinde). Agora a base é **medida** antes da chamada, e quando o desenho não cresceu a
mensagem diz o que de fato houve: *"mexendo no desenho — 2 ações"*.

**A medição de latência (1.1–1.3) continua aberta**, e de propósito: ela precisa de sessão ao
vivo contra os dois endereços. O que já está medido é o nosso lado — **0,4 a 1,0 s por chamada**,
execução inclusa, na sessão do dono. Esta change **não promete velocidade**: a espera entre
chamadas é a volta ao modelo, e o que ela entrega é a espera **legível**.

## Ao vivo, e a medição que decidiu o que prometer (2026-11-17)

**Portão 5.3**, sessão viva, amostrando a tela a cada 120 ms durante a construção:

`{"elementosNovos":8,"chamadasDeFerramenta":14,"linhasDeFerramenta":7,"mensagensDeConstrucao":1,`
`"detalhesDentro":8,"estadosVistos":["listening","escrevendo","speaking","ready"],`
`"selosQueATelaPintou":["processando","desenhando","falando","pronto"],"canvasPiscou":true}`

A tela foi mudando assim: `1,0s desenhando | criei o pool "Compras"` → `1,9s desenhando |
montando o processo — 2 elementos` → `2,9s | 3 elementos` → … → `8 elementos`. **Sete linhas na
conversa para catorze chamadas**: as outras foram absorvidas. Filme (um quadro a cada 0,5 s) em
`artifacts/bateria/filme-construcao/`.

### A medição (1.1–1.3), nos dois endereços

`tools/medir-construcao.mjs` separa, por chamada, **nossa execução** (`tool.executando` →
`tool.concluida`) da **volta ao modelo** (`concluida` → `executando` seguinte). Para isso o
despachante passou a emitir `tool.concluida`: sem evento de fim, a pergunta "a espera é nossa ou
do modelo?" só podia ser estimada pelo intervalo entre começos, que mistura as duas.

| | dev server | publicado |
|---|---|---|
| chamadas / formas | 8 · 2→10 | 8 · 2→10 |
| **nossa escrita** (mediana / pior) | **0,01 s** / 0,01 s | **0,00 s** / 0,01 s |
| **volta ao modelo** (mediana / pior) | 0,46 s / 0,69 s | 0,47 s / 0,86 s |
| do envio ao último elemento | 3,5 s | 3,7 s |
| **nossa fatia** | **1%** | **1%** |

**Duas conclusões, as duas registradas e nenhuma na tela:**

1. **Esta change não promete velocidade** (tarefa 1.2 avisava que isso iria para o `proposal.md`
   se desse assim, e deu): 99% da espera é a volta ao modelo. O que ela entrega é a espera
   **legível**.
2. **O publicado não é mais lento que o local.** As duas colunas saíram da mesma hora, com o
   mesmo pedido. Então os 3 a 5 s por bloco que o dono sentiu não vêm de estar publicado — vêm da
   volta ao modelo, que varia por turno. **Não há nada para consertar no deploy**, e essa
   suspeita fica fechada.
3. **Insumo para a próxima rodada (1.3):** 14 chamadas para 8 elementos. Agrupar chamadas no
   mesmo turno é o único candidato real de velocidade, e só valia a pena se o modelo dominasse o
   tempo — agora está medido que domina.

⚠ **E um terceiro defeito meu, o pior:** o selo de escrita existia por **microssegundos**. Numa
construção de oito elementos o estado `escrevendo` **nunca** foi observado, nem a 120 ms de
amostragem, porque a nossa escrita é síncrona (mediana de 0,01 s). Selo que pisca por
microssegundos não é feedback, é contabilidade interna. Ficou com tempo mínimo de leitura (700
ms), que o **gesto do aluno encurta** — clicar prova que ele leu, e sem isso a espera custaria o
clique dele nos botões de candidato, que nascem exatamente dentro dessa janela.
