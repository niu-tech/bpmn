# Decisões

## D1 — Portar, não importar

A cápsula é um projeto .NET + Pi/Node com dependências próprias. Este projeto é uma página BYOK que
roda na aba do aluno. **Não há dependência a adicionar**: o que vem são módulos puros, copiados e
traduzidos, com a origem declarada no cabeçalho.

O critério do que vem é duro: **módulo puro, sem transporte e sem hardware**. `turn-tracker`,
`prompt-assembly`, `memory`, `turn-output` passam. `agent/ui/` e `agent/extensions/` são da TUI do
Pi; `src/` é .NET (AudioBridge, MCP server) — não passam, e olhar aquilo é perder tempo.

## D2 — Os testes vêm junto, e crescem

Cada item traz os testes de origem **e** ganha casos deste projeto. O `turn-tracker` veio com 3 e
ficou com 7: os 4 novos são a pergunta picada em bolhas e a convivência de delta com cumulativo,
que é a forma que o nosso consumidor produz.

Portar código sem portar a prova é trocar o defeito de lugar.

## D3 — O lado da entrada antes do lado do turno

O `RastreadorDeTurnos` faz três trabalhos. O da **entrada** (juntar fragmentos) é isolado e foi
ligado primeiro: ele só muda como a bolha do aluno cresce, e prova-se sozinho.

Os outros dois — prender evento ao turno e uma-execução-por-chamada — tocam o `session.js`, que
acabou de ser estabilizado. Eles entram **junto da F7**, que é onde passam a valer dinheiro: até
lá, um turno trocado custa uma bolha; depois, custa um desenho.

## D4 — Injetar e capturar são provas diferentes, e as duas ficam

A cápsula injeta o PCM direto na sessão (`mic` × `inject`). Isso teria tornado a dívida M6
impossível — lá o microfone falso do navegador nunca entra na conta.

A decisão aqui **não** é trocar um pelo outro:

- **injetar** vira o caminho padrão dos cenários de voz: determinístico, multi-turno, sem depender
  de o Chromium aceitar o arquivo;
- **capturar** continua provado, em **um** cenário e em `tools/provar-captura.mjs`, porque o produto
  real usa o microfone de verdade — e uma suíte que só injeta não sabe se a captura quebrou.

Trocar tudo por injeção trocaria uma cegueira por outra.

## D5 — O ledger é do harness, não do produto

A aba do aluno é BYOK e não tem banco local; prometer persistência ali seria errado. O ledger entra
no harness, onde cada corrida da bateria vira registro citável para a dissertação.

É também onde ele é honesto: só conteúdo final, sem parciais e **sem áudio** — e a invariante mora
no esquema, não no bom comportamento de quem escreve.

## D6 — A dívida acadêmica é de texto, não de código

O código colhido é reúso de trabalho anterior do próprio autor. Isso precisa estar **declarado** na
metodologia do TCC, separando o que foi feito para o trabalho do que foi reaproveitado, com a origem
nomeada.

Decisão do dono (2026-11-13): **adiado para a fase de escrita**, registrado como K-F. Não bloqueia
nenhuma tarefa desta change — bloqueia a entrega escrita, e resolve-se em um parágrafo.
