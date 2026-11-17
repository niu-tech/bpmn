# Tarefas — mostrar o trabalho enquanto o agente desenha

## 1. Medir antes de prometer

- [ ] 1.1 `tools/medir-construcao.mjs`: dirige o MESMO pedido de construção contra
      `127.0.0.1:8126` e contra o site publicado, e devolve por chamada — nossa execução ×
      espera pela volta do modelo —, com mediana e pior caso
- [ ] 1.2 Rodar nos dois e guardar o número. ⚠ Se a espera for toda do transporte, **esta change
      não promete velocidade** — e isso vai escrito no `proposal.md`, não no commit
- [ ] 1.3 O relatório diz quantas chamadas o turno gastou: é o insumo para decidir, depois, se
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
- [ ] 5.3 **AO VIVO**: descrever um processo de ≥ 6 passos e medir o que a tela mostrou do começo
      ao fim — print no início, no meio e no fim da construção
- [x] 5.4 O portão afirma o **antes** (os elementos entraram no desenho) e o **depois** (a conversa
      tem uma mensagem com o número certo): "não há doze mensagens" é verdade num chat vazio
      (princípio XIII)

## 6. Registro

- [ ] 6.1 O número medido em 1.2 entra no `open-items.md`, com a data e as duas origens
- [ ] 6.2 Se a espera for do transporte, dizer isso **no produto** não: dizer no registro. A tela
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
