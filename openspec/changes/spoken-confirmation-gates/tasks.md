> **Teste primeiro, aqui mais do que em qualquer lugar.** Um portão que se engana para o lado
> frouxo apaga o diagrama do aluno sem ele ter dito nada; para o lado duro, trava a conversa. Os
> dois erros são de ORDEM, e ordem se testa com relógio falso, não com fé.

## 1. A época do aluno

- [x] 1.1 Contador no `session-manager`: sobe em pergunta digitada e no primeiro pedaço de
      `inputTranscription` de cada turno falado.
- [x] 1.2 **Não** sobe com mensagem da página, com clique em candidato, nem com fala do modelo.
- [x] 1.3 Testes: digitada sobe (é o que abre os seis portões); a FALADA sobe uma vez por turno e
      não uma por pedaço de legenda — três pedaços de uma fala só não abrem o portão, e a fala
      seguinte abre; o clique em candidato não abre; a nota da página não abre.

## 2. Portões

- [x] 2.1 `portao(nome)` grava a época da pergunta; `respondido(nome)` compara com a de agora.
- [x] 2.2 `esperarResposta(nome, 3500)` — constante nomeada, com o motivo (legenda atrasada) escrito
      em cima, e relógio injetável.
- [x] 2.3 Testes de ORDEM: respondeu; não respondeu; respondeu **antes** da pergunta; respondeu
      com a legenda atrasada; e o portão **consumido** (um sim autoriza uma ação, não as próximas).
      A tolerância é injetada (`toleranciaDeConfirmacaoMs`) em vez de relógio falso — o que se mede
      aqui é ordem, não duração. Falta o caso de dois portões abertos (só existe com o segundo).

## 3. O despacho recusa antes do executor

- [x] 3.1 `exigeConfirmacao` no catálogo (começa só em `remover`).
- [x] 3.2 `dispatch.js` consulta a página antes de chamar o executor; sem resposta devolve
      `falta_confirmacao` + `comoProsseguir`.
- [x] 3.3 O diário registra `tool.sem-confirmacao` com o nome do portão.
- [x] 3.4 Testes de despacho: recusa não chama o executor; a recusa é `{ok:false}` com nome; o
      turno continua vivo.

## 4. `remover` nas duas formas

- [x] 4.1 A fala abre o portão; o diálogo continua existindo e continua conferindo a assinatura do
      diagrama (H14).
- [x] 4.2 Teste: fala sem clique remove; clique sem fala remove; nenhum dos dois não remove.
- [x] 4.3 Teste: o modelo afirmando "ele confirmou" não remove.

## 5. Prompt

- [x] 5.1 Uma frase em `agent/sections.js`: perguntas de confirmação se fazem em **uma** frase, e
      depois se **espera** — não se age antes da resposta. Virou seção própria (`confirmar`): a
      frase tinha sido enfiada no meio da identidade e partia a âncora de idioma ao meio.
- [x] 5.2 Teste de prompt: a frase existe nos dois perfis, e a seção não passa de 600 caracteres
      (o tier estável inteiro fica abaixo de 5 KB).

## 6. Portões de medição

- [x] 6.1 `npm test` verde com os testes novos.
- [x] 6.2 Cenário de navegador sem cota: a ferramenta é recusada, o elemento sobrevive, o aluno
      responde (turno de aluno de verdade) e só então ela apaga — e o portão seguinte é recusado
      de novo, porque o sim foi consumido.
- [x] 6.3 Cenário AO VIVO, com VOZ, contra o Gemini: 6,2 s o servidor transcreve *"apaga essa
      tarefa que eu selecionei"*; 9,8 s `tool.sem-confirmacao`; 11 s o agente PERGUNTA falando
      (*"Posso apagar a tarefa 'Bake the pizza'?"*); 22,9 s *"pode apagar, sim"* →
      `tool.executando remover` → *"removi 'Bake the pizza'"*. A ordem é a prova, e ela está
      gravada em vídeo (`tools/video-prova.mjs --cenario portao`).
- [x] 6.4 A trilha mede e imprime: `portão "remover": o aluno respondeu em 6,3 s`, com o resumo da
      corrida (*"portão: 1 confirmação(ões), o aluno levou 6,3 s em média"*). É esse número que
      diz se a tolerância de 3,5 s da legenda atrasada está calibrada.
