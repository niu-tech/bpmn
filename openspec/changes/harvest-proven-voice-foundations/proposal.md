## Why

Em 2026-11-13, procurando o agente de um vídeo que o dono gravou, apareceu outra coisa: existe no
repositório do CopilotSpeaker uma **cápsula de agente de voz do próprio autor, já provada** —
`capsules/WikiAgentCapsule`, 60 commits, checkpoints CP0.5 a CP7.6, **5.111 linhas de agente e
9.344 de teste**.

Ela resolve, com mais rigor, problemas que este projeto teve **no mesmo dia**:

- a atribuição de turno foi consertada **duas vezes** em 13/11 — T9 de manhã, legenda herdada à
  tarde —, as duas com heurística escrita do zero. A cápsula já tinha o módulo e os testes;
- a dívida M6 custou três dias e a causa era o microfone do teste. A cápsula **não tem essa classe
  de defeito** porque injeta áudio no nível da sessão, sem depender do microfone falso do navegador.

O custo de não colher não é teórico: é trabalho refeito e dias perdidos, já medidos.

E há uma janela que fecha. A **F7** dá ao agente o poder de mudar o diagrama. Enquanto ele só lê, um
turno trocado produz bolha errada; com escrita no meio, produz **desenho errado**, **ferramenta
disparada cedo** sobre intenção não terminada, e **elemento duplicado** numa reconexão. Os três têm
peça pronta e testada do outro lado.

## What Changes

Colher por ordem de risco, cada item com **os testes de origem junto** — portar código sem portar a
prova deixa o projeto com a prova do autor antigo e o defeito do novo.

**Fundação do turno (antes da F7).**

- **H1** — `RastreadorDeTurnos`: junta fragmentos da fala distinguindo cumulativo de delta, prende
  cada evento ao turno dono, e garante uma execução por `{turno, chamada}`. ✅ *colhido*
- **H4** — barge-in por **nível local**, não por calibração de fixture.
- **H11** — **injeção de fala no nível da sessão** (`mic` × `inject`), que tira o teste de voz da
  dependência do microfone falso do navegador.

**Honestidade do que aparece.**

- **H2** — fala e tela são canais diferentes: o que soa como máquina (id, caminho, chave de citação)
  vai para a tela, nunca para o ouvido.
- **H3** — apresentador de resultado de ferramenta: completo para o modelo, resumo redigido para o
  cliente, uma linha na tela.
- **H6** — estado tipado da voz com selo e medidor de nível.
- **H7** — o contrato impresso na interface, que é o desenho da F7 escrito para o aluno.

**Fundação do prompt e da memória.**

- **H8** — orçamento e diagnóstico do prompt. Fecha a tarefa 2.4 do harness (o teto do quadro de
  contexto), que nunca rodou.
- **H9** — idioma por preferência do aluno, hoje uma frase no prompt.
- **H10** — memória com escopo e consolidação, pré-requisito do tutor da **F8**.

**Evidência.**

- **H5** — ledger de conversa **no harness** (não no produto: a aba do aluno é BYOK e não tem banco).
- **H12** — inventário de dependências fixadas com licença declarada, no modelo do `INVENTORY.md` da
  cápsula. É rigor que a banca cobra e que hoje não existe aqui.

## Impact

- **Specs:** `voice-turn-boundary` (nova). As demais capacidades afetadas já têm spec nas changes
  irmãs e são **alteradas**, não criadas.
- **Código:** `src/assistant/live/` (turno, barge-in), `src/assistant/session-manager.js` (consumo),
  `src/assistant/agent/` (prompt, memória, idioma), `tools/` (injeção, ledger, inventário).
- **O que NÃO vem:** `agent/ui/` e `agent/extensions/` da cápsula são da TUI do Pi; `src/` é .NET
  (AudioBridge, MCP server). Aqui o áudio é Web Audio na aba do aluno.
- **Dívida acadêmica K-F:** o texto do TCC precisa declarar o que é reúso de trabalho anterior do
  autor. Adiado pelo dono para a fase de escrita — **não bloqueia** a implementação.
