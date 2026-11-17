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

- [ ] 2.1 `destacarBrevemente(id)` na camada fina: classe CSS no `g.djs-element`, ~600 ms, sem
      `setColor` (cor entra no DI e fica no arquivo do aluno)
- [ ] 2.2 Toda escrita que cria ou move chama o destaque; `scrollToElement` continua como está
- [ ] 2.3 Teste no navegador: a classe entra e **sai**; o XML exportado não ganha cor nenhuma

## 3. Uma mensagem que cresce

- [ ] 3.1 O gerente agrupa as linhas de escrita do mesmo turno sob uma mensagem de construção com
      contagem viva
- [ ] 3.2 As linhas detalhadas continuam existindo e acessíveis (elas são a prova — H3)
- [ ] 3.3 Teste: seis escritas num turno → uma mensagem de construção com seis dentro
- [ ] 3.4 Teste: uma escrita isolada **não** vira mensagem de construção (não inventar cerimônia
      para um elemento só)

## 4. Selo e ajuste

- [ ] 4.1 O rótulo do estado distingue *desenhando* de *pensando*
- [ ] 4.2 `desfazer` dentro de turno com escrita vira *"ajustei — refiz N elementos"*; fora disso,
      continua *"desfiz"*
- [ ] 4.3 Testes dos dois casos

## 5. Portão

- [ ] 5.1 **Sem cota**, dirigindo as ferramentas pelo caminho do modelo: construção de ≥ 4
      elementos → uma mensagem de construção, destaque que entra e sai, selo *desenhando*
- [ ] 5.2 **Sem cota**: desfazer no meio da construção aparece como ajuste
- [ ] 5.3 **AO VIVO**: descrever um processo de ≥ 6 passos e medir o que a tela mostrou do começo
      ao fim — print no início, no meio e no fim da construção
- [ ] 5.4 O portão afirma o **antes** (os elementos entraram no desenho) e o **depois** (a conversa
      tem uma mensagem com o número certo): "não há doze mensagens" é verdade num chat vazio
      (princípio XIII)

## 6. Registro

- [ ] 6.1 O número medido em 1.2 entra no `open-items.md`, com a data e as duas origens
- [ ] 6.2 Se a espera for do transporte, dizer isso **no produto** não: dizer no registro. A tela
      não deve explicar a arquitetura do Gemini para o aluno
