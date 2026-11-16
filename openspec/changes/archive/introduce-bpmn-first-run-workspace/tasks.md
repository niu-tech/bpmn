> Decisões em `design.md` (B1–B9); referências e o que foi conferido em `research.md`; a
> comparação dos três conceitos, para o dono, em `openspec/apresentacoes/tela-base-conceitos.html`.
>
> **Ordem.** 1 é pura e nasce com teste. 2–4 são a tela. 5 é o verbo que falta no painel. 6 é a
> prova na tela de verdade — e é ela que fecha o bloco, não o `npm test`.

## 1. A decisão de abertura

- [x] 1.1 `src/primeira-vez/abertura.js`: `decidirAbertura({ salvo, escolha, atalho })` → `restaurar`
      · `exemplo` · `branco` · `convite`. Pura, sem DOM, sem `localStorage` — quem lê as chaves é o
      `app.js`
- [x] 1.2 `CHAVE_ESCOLHA` e as escolhas válidas moram aqui; valor desconhecido na chave cai em
      `convite` (B2)
- [x] 1.3 `src/primeira-vez/__tests__/abertura.mjs`, no `npm test`: primeira visita · trabalho
      salvo · escolheu branco e não desenhou · escolheu exemplo · escolha inválida · atalho vence
      o salvo · atalho não apaga nada

## 2. A tela base

- [x] 2.1 `src/primeira-vez/tela.js`: título, subtítulo, cartão primário "descreva o seu processo",
      dois cartões secundários (ver exemplo · começar do zero) e o link "não sabe o que é BPMN?"
- [x] 2.2 O texto sai da tabela do B9 — cada frase aponta para um portão fechado. Nada sobre
      proposta nomeada (F8) nem sobre citar a norma (FK)
- [x] 2.3 `primeira-vez.css`: paleta do `assistant.css`, foco visível, alvo de toque ≥ 44 px,
      `prefers-reduced-motion`, e o rodapé reservado com `RESERVA_MINIMA` de `assistant/layout.js`
      (B7)
- [x] 2.4 Em 375 px os três caminhos empilham e nada rola na horizontal
- [x] 2.6 **A FK fechou no meio desta change** (frente paralela, 2026-11-15): a linha de descoberta
      passou a dizer "ele explica com o exemplo na frente e **diz de onde tirou**", depois de
      conferir `declarada('consultar_norma')` no catálogo e de ver o cenário do acervo passar na
      bateria daqui. Com guard em `__tests__/abertura.mjs`: se a ferramenta sair do catálogo, o
      teste reprova nomeando o texto de `tela.js`
- [x] 2.5 Montar dentro de `try/catch`: defeito aqui não pode levar o modelador junto
      (constituição §X)

## 3. O encaixe no modelador

- [x] 3.1 `src/app.js`: `run()` passa a chamar `decidirAbertura` em vez de "salvo ? salvo :
      pizzaria"; `convite` e `branco` abrem com `modeler.createDiagram()` (B3)
- [x] 3.2 Cada caminho grava a escolha e fecha o convite; `tutor` e o link de descoberta abrem o
      painel existente — a página guarda o retorno de `mountAssistant()` para isso
- [x] 3.3 `#exemplo` abre o exemplo direto, sem convite e sem apagar o autosave (B8)
- [x] 3.4 O ajudante continua montando **depois** do import e do `fit-viewport` (a ordem que o
      comentário de `run()` protege)

## 4. A tira do exemplo

- [x] 4.1 Estado `exemplo`: "Exemplo: pedido de pizza · começar o meu". Estado `branco`: "ver um
      exemplo"
- [x] 4.2 Some no primeiro `commandStack.changed` — editar é o que transforma exemplo em trabalho
      (B6)
- [x] 4.3 Não cobre a barra do modelador, o painel da simulação nem a marca d'água
- [x] 4.4 **A causa raiz que a tira revelou (B10):** o autosave era `async` e devolvia uma Promise,
      o que no `EventBus` do diagram-js **encerra a propagação** — todo listener de
      `commandStack.changed` registrado depois dele nascia morto, em silêncio. Corrigido no
      autosave (`void (async () => {…})()`), não contornado com prioridade

## 5. O verbo que faltava no painel

- [x] 5.1 `widget.sugerir(texto)`: deixa a pergunta digitada no compositor, **sem enviar** e **sem
      mexer no foco** — quem decide para onde o foco vai é o `open()`, e sem chave ele manda para o
      campo da chave, não para um compositor que ainda não dá para usar. Nenhum segundo compositor (B5)
- [x] 5.2 `mountAssistant` devolve o widget (já devolve) e `app.js` passa a guardar o retorno

## 6. A prova na tela

- [x] 6.1 `tools/battery.mjs`: `ALVO` passa a carregar `#exemplo`, para os ~20 cenários que
      precisam do diagrama continuarem provando o que provavam (B8)
- [x] 6.2 Cenário novo, contra a URL **sem** hash: a tela base aparece, tem os três caminhos, não
      tem campo de chave, o painel está recolhido e a marca d'água não está coberta
- [x] 6.3 Cenário: clicar em "ver exemplo" carrega o diagrama e a tira aparece
- [x] 6.4 Cenário: clicar em "descrever o meu processo" abre o painel com a frase digitada e **nada
      enviado**
- [x] 6.5 Cenário em 375×812: os três caminhos empilhados, sem rolagem horizontal, alvo de toque
      ≥ 44 px, lançador do ajudante clicável e **título não coberto pela barra da simulação** (o
      print mostrou que estava: 76 px de folga no topo, medidos)
- [x] 6.6 Prints em `artifacts/e2e-shots/`: `tela-base.png` · `tela-base-375.png` ·
      `tela-base-exemplo.png` · `tela-base-tutor.png` · `tela-base-branco.png` — **olhados**, e dois
      defeitos saíram daí: o fundo semitransparente deixando o desenho vazar, e o título coberto em
      375 px
- [x] 6.7 `npm test` verde (25 suítes, 0 falhas, `primeira-vez: 13`) e bateria determinística
      **21 de 21** — inclusive os ~16 cenários anteriores, que passaram a entrar pelo atalho

## 7. Registro

- [x] 7.1 `openspec/open-items.md`: o botão "♻️ Novo" recarrega a pizzaria e apaga o autosave sem
      perguntar — anterior a esta change, e agora contradiz a tela nova
- [x] 7.2 `openspec/open-items.md`: o exemplo continua em inglês

## 8. O exemplo em português (pedido do dono, 2026-11-15, depois da entrega)

> Estava em `open-items.md` como ponta aberta desta change. O dono mandou fechar junto com o
> "pode subir".

- [x] 8.1 `diagrams/pizza-collaboration.bpmn`: os 25 `name=` traduzidos, **ids intactos**
      (`_6-463` continua `_6-463`) — é o que mantém de pé toda asserção de estrutura, a fixture de
      simulação e o `startEventId`
- [x] 8.2 O arquivo fica **ASCII puro**: o único acento (`cadê`) vira entidade `&#234;`, como o
      `&#8222;` que já estava lá. Encoding de `.bpmn` servido por HTTP não é lugar de descobrir
      mojibake
- [x] 8.3 Os dependentes que casam por NOME, atualizados no mesmo commit: `tools/battery.mjs` (22),
      `avaliacao/perguntas-douradas.json` (13), `diagrams/simulations/*.sim.json` (14),
      `src/batchsim/__tests__/{validate-pizza,smoke-refactor}.mjs` (5), `tools/avaliar.mjs` (2)
- [x] 8.4 **Não** entram: a fixture inline dos testes do ajudante (dublê autocontido, não é "o
      exemplo") nem `openspec/apresentacoes/*`, `changes/*/tasks.md` e `roadmap.md` — registro
      datado, medido com aqueles nomes
- [x] 8.5 `npm test` 25 suítes e bateria **21 de 21** com o diagrama traduzido; print olhado em
      `artifacts/e2e-shots/tela-base-exemplo.png` — pools Cliente/Pizzaria, raias atendente ·
      pizzaiolo · entregador, e o `cadê` com acento certo na tela

## 9. Os botões em volta (pedido do dono, 2026-11-15, depois de ver no ar)

- [x] 9.1 Com o convite no ar, a barra do modelador e os painéis de simulação saem de cena
      (`body.pv-no-ar` + CSS). Voltam no instante em que ele fecha — provado nos dois sentidos
- [x] 9.2 "voltar ao menu" na tira: reabre o convite, esquece a escolha, recolhe o painel e **não
      descarta nada** (a tira só existe antes da primeira edição, então não há o que perder)
- [x] 9.3 "♻️ Novo" vira "♻️ Recomeçar" e deixa de apagar sem perguntar: com trabalho salvo, o
      primeiro clique pergunta **no próprio botão** por 5 s; o segundo descarta e volta ao menu.
      Fecha a ponta de `open-items.md`
- [x] 9.4 Não é `confirm()` nativo: diálogo do navegador trava a página dirigida, e ação
      destrutiva sem prova viva vale tanto quanto nenhuma. O portão de dois cliques é dirigível e
      está na bateria
- [x] 9.5 A tela da chave vira **dois passos numerados**, com o AI Studio como botão de verdade
      ("abre numa aba nova — volte aqui com ela copiada"), e a dica de rodapé para de dizer pela
      terceira vez o que o passo 2 já diz
- [x] 9.6 Enquanto a chave não entrou, o painel ocupa mais espaço (520 px, altura pelo conteúdo) e
      volta sozinho ao tamanho normal quando ela resolve — por `:has(.bpmn-assist__setup:not([hidden])`,
      sem uma linha de JS
- [x] 9.7 Bateria: seis cenários da tela base verdes, incluindo os dois novos (voltar ao menu ·
      Recomeçar com confirmação)
