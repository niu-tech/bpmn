> **Ordem.** 1 → 2 destrava sozinha (o modelo já passa a decidir pelo desenho). 3 e 4 dependem da
> fila, e a fila é o pedaço com mais chance de defeito sutil: ela é escrita com teste primeiro.

## 1. A leitura da tela

- [x] 1.1 `estadoDaTela({ tocado })` em `tools/leitura.js`: tipo do diagrama, contagem, selecionado,
      entradas/saídas do elemento tocado, pontas soltas, linha de regra. Texto, com teto declarado.
- [x] 1.2 Testes determinísticos: processo x colaboração, sem seleção, elemento recém-criado como
      ramo, diagrama grande (corta e diz que cortou), diagrama vazio.
- [x] 1.3 Prova de que a leitura sai do registro: o diagrama tem uma tarefa SOLTA que a chamada
      nunca cita, e ela aparece na leitura ("Sem nenhuma ligação: …"), junto com a contagem do
      registro — não a da operação.

## 2. O resultado da escrita carrega a leitura

- [x] 2.1 `criar_elemento`, `conectar`, `renomear`, `mover`, `alinhar`, `trocar_tipo`, `destacar`,
      `desfazer`, `remover`, `criar_pool` e `criar_raia` passam a devolver `tela`.
- [x] 2.2 Os **cinco** campos de ocasião saem, cada um com substituto declarado na leitura:
      `ramo` e `avisoDeRamo` (ramo paralelo), `virouColaboracao` e `adotou` (a raiz virou
      colaboração e o pool adotou o desenho — forma, não conexão) e `criouAFaixaDoQueJaExistia`
      (o pool passou a ter duas faixas). Teste por campo: o fato continua chegando ao modelo.
- [x] 2.3 Testes de escrita atualizados; nenhum campo existente some sem substituto. **Conserto de
      regressão desta própria tarefa:** a LINHA DO ALUNO (`tools/apresentador.js`) lia os cinco
      campos e ficou sem fonte — ele via o desenho inteiro pular para dentro de um pool e lia só
      "criei o pool X". `fatosDaTela` devolve os três fatos de arranjo em forma, do mesmo produtor
      do texto, e as três frases voltaram.
- [x] 2.4 Medido: a leitura acrescenta **200–250 caracteres** ao turno de escrita (teto declarado:
      760). O teste imprime os dois números e reprova acima de 400 no caso típico.

## 3. O canal da página

- [x] 3.1 `anunciarNaPagina(texto)` no `session-manager`: fila de um, com época e prazo (45 s). A
      marca `(da página)` é posta pela SESSÃO, nunca por quem chama.
- [x] 3.2 Envia só na brecha entre turnos (`pronto`); descarta por época (o aluno falou) ou prazo.
- [x] 3.3 A bolha é nota de sistema (`kind: 'pagina'`); o diário registra `pagina.enfileirou` /
      `pagina.enviou` / `pagina.descartou` com o motivo.
- [x] 3.4 Os quatro eventos em `src/assistant/pagina.js`: seleção (com debounce de 500 ms), import
      concluído, `Ctrl+Z` do aluno e simulação rodada. A guarda é o estado `tool`: o que muda no
      canvas enquanto uma ferramenta roda é o AGENTE, e contar isso de volta seria ele conversando
      consigo mesmo.
- [x] 3.5 Regra do `(` em `agent/sections.js` (seção `pagina`) + teste de prompt.
- [x] 3.6 Testes: não atropela a fala; descarta quando o aluno fala; expira; nunca vira bolha de
      aluno; não muda o idioma (prompt). 7 no `session-manager.mjs` + 12 no `pagina.mjs`.

## 4. Candidato clicável

- [x] 4.1 O painel desenha botões quando o resultado traz candidatos: a recusa `sem_lugar` passa a
      carregar `candidatos` em forma, o despachante os atravessa, e `candidatosDoResultado` também
      os extrai de `buscar_elemento` com mais de um achado.
- [x] 4.2 Clique manda `(escolhido no chat) …`, destaca o elemento no desenho e **não** abre o
      portão de confirmação — desambiguar não é autorizar.
- [x] 4.3 Testes: um botão por candidato, clique manda uma vez só, teclado alcança (`<button>` de
      verdade, `tabIndex >= 0`) — no portão de navegador, contra o DOM real.

## 5. Portões

- [x] 5.1 `npm test` verde, com os testes novos de 1, 2, 3 e 4.
- [x] 5.2 Cenário de navegador **sem cota** (`__bpmnAssist.ferramenta`), contra o bpmn-js de verdade:
      `--so geometria`, `--so pool`, `--so "canal da pagina"` e `--so "candidato clicavel"`. A nota
      sai marcada, a bolha é de sistema, zero bolhas de aluno, e o clique escolhe "Pizza vendor
      (participant)" uma única vez, com o pool destacado em azul.
- [x] 5.3 Cenário AO VIVO: o aluno CLICA em "Bake the pizza" e pergunta "E esse aqui, o que é?" —
      resposta do Gemini: *"Essa é a tarefa 'Bake the pizza', onde o pizzaiolo prepara a pizza no
      processo do restaurante."* Sem o aluno nomear nada.
- [x] 5.4 Trilha mostrando `pagina.enfileirou` / `pagina.enviou` e o resumo *"página: 1 nota(s)
      entregue(s), 0 descartada(s) de 1"*, sem nenhuma bolha de aluno indevida. A trilha ganhou o
      modo `--de <captura.json>` para reler uma corrida guardada.
