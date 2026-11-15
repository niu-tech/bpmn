> **Teste primeiro, aqui mais do que em qualquer lugar.** Um portão que se engana para o lado
> frouxo apaga o diagrama do aluno sem ele ter dito nada; para o lado duro, trava a conversa. Os
> dois erros são de ORDEM, e ordem se testa com relógio falso, não com fé.

## 1. A época do aluno

- [ ] 1.1 Contador no `session-manager`: sobe em pergunta digitada e no primeiro pedaço de
      `inputTranscription` de cada turno falado.
- [ ] 1.2 **Não** sobe com mensagem da página, com clique em candidato, nem com fala do modelo.
- [ ] 1.3 Testes: digitada sobe; falada sobe uma vez por turno (não uma por pedaço de legenda);
      nota da página não sobe.

## 2. Portões

- [ ] 2.1 `portao(nome)` grava a época da pergunta; `respondido(nome)` compara com a de agora.
- [ ] 2.2 `esperarResposta(nome, 3500)` — constante nomeada, com o motivo (legenda atrasada) escrito
      em cima, e relógio injetável.
- [ ] 2.3 Testes com relógio falso: respondeu; não respondeu; respondeu antes; respondeu em 2 s;
      não respondeu em 10 s; dois portões abertos e só um respondido.

## 3. O despacho recusa antes do executor

- [ ] 3.1 `exigeConfirmacao` no catálogo (começa só em `remover`).
- [ ] 3.2 `dispatch.js` consulta a página antes de chamar o executor; sem resposta devolve
      `falta_confirmacao` + `comoProsseguir`.
- [ ] 3.3 O diário registra `tool.sem-confirmacao` com o nome do portão.
- [ ] 3.4 Testes de despacho: recusa não chama o executor; a recusa é `{ok:false}` com nome; o
      turno continua vivo.

## 4. `remover` nas duas formas

- [ ] 4.1 A fala abre o portão; o diálogo continua existindo e continua conferindo a assinatura do
      diagrama (H14).
- [ ] 4.2 Teste: fala sem clique remove; clique sem fala remove; nenhum dos dois não remove.
- [ ] 4.3 Teste: o modelo afirmando "ele confirmou" não remove.

## 5. Prompt

- [ ] 5.1 Uma frase em `agent/sections.js`: perguntas de confirmação se fazem em **uma** frase, e
      depois se **espera** — não se age antes da resposta.
- [ ] 5.2 Teste de prompt: a frase existe e a seção não cresceu além do teto.

## 6. Portões de medição

- [ ] 6.1 `npm test` verde com os testes novos.
- [ ] 6.2 Cenário de navegador sem cota: pergunta ⇒ ferramenta recusada; "resposta" injetada como
      turno do aluno ⇒ ferramenta executa.
- [ ] 6.3 Cenário AO VIVO (um só, com voz): "apaga essa tarefa" → o agente pergunta → o aluno diz
      "pode apagar" → o elemento some. Trilha salva como prova.
- [ ] 6.4 Registrar na trilha quanto tempo passou entre a pergunta e a resposta do aluno (entra na
      medição de latência da change `sustain-a-class-session`).
