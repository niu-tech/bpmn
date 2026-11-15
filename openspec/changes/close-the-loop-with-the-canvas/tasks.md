> **Ordem.** 1 → 2 destrava sozinha (o modelo já passa a decidir pelo desenho). 3 e 4 dependem da
> fila, e a fila é o pedaço com mais chance de defeito sutil: ela é escrita com teste primeiro.

## 1. A leitura da tela

- [ ] 1.1 `estadoDaTela({ tocado })` em `tools/leitura.js`: tipo do diagrama, contagem, selecionado,
      entradas/saídas do elemento tocado, pontas soltas, linha de regra. Texto, com teto declarado.
- [ ] 1.2 Testes determinísticos: processo x colaboração, sem seleção, elemento recém-criado como
      ramo, diagrama grande (corta e diz que cortou), diagrama vazio.
- [ ] 1.3 Prova de que a leitura sai do registro: dublê que aceita a operação e deixa o registro
      diferente ⇒ a leitura descreve o registro.

## 2. O resultado da escrita carrega a leitura

- [ ] 2.1 `criar_elemento`, `conectar`, `renomear`, `mover`, `alinhar`, `trocar_tipo`, `destacar`,
      `desfazer` e `remover` passam a devolver `tela`.
- [ ] 2.2 O `avisoDeRamo` deixa de ser campo próprio: o fato passa a sair da leitura (um lugar só).
- [ ] 2.3 Testes de escrita atualizados; nenhum campo existente some sem substituto.
- [ ] 2.4 Medir o tamanho que isso acrescenta ao turno (entra na conta de contexto por turno).

## 3. O canal da página

- [ ] 3.1 `anunciarNaPagina(texto)` no `session-manager`: fila de um, com época e prazo.
- [ ] 3.2 Envia só com `pronto && !turnoAberto && !falando`; descarta por época ou prazo.
- [ ] 3.3 A bolha é nota de sistema; o diário registra `pagina.enfileirou` / `pagina.enviou` /
      `pagina.descartou` com o motivo.
- [ ] 3.4 Os quatro eventos: seleção mudou, import concluído, `Ctrl+Z` do aluno, simulação rodou.
      (Seleção com debounce: clicar em dez elementos não produz dez anúncios.)
- [ ] 3.5 Regra do `(` em `agent/sections.js` + teste do prompt.
- [ ] 3.6 Testes: não atropela a fala; descarta quando o aluno fala; expira; nunca vira bolha de
      aluno; não muda o idioma.

## 4. Candidato clicável

- [ ] 4.1 O painel desenha botões quando o resultado traz candidatos (`sem_lugar`,
      `buscar_elemento`, ambiguidade de pool/raia).
- [ ] 4.2 Clique manda `(escolhido no chat) …` e chama `destacar` no elemento, quando houver id.
- [ ] 4.3 Testes de widget: um botão por candidato, clique manda uma vez só, teclado alcança.

## 5. Portões

- [ ] 5.1 `npm test` verde, com os testes novos de 1, 2, 3 e 4.
- [ ] 5.2 Cenário de navegador **sem cota** (`__bpmnAssist.ferramenta`): criar ⇒ o resultado traz a
      leitura; `sem_lugar` ⇒ botões; clique ⇒ elemento destacado.
- [ ] 5.3 Cenário AO VIVO (um só): o aluno seleciona um elemento e pergunta "e esse aqui?" — o
      agente responde sobre o elemento certo, sem o aluno nomear.
- [ ] 5.4 Trilha de uma conversa curta mostrando `pagina.*` no diário e nenhuma bolha de aluno
      indevida.
