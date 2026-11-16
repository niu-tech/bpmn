# O quadro de changes

Uma pasta por mudança, com `proposal.md`, `design.md`, `specs/` e `tasks.md`. A regra é uma só:
**o quadro de cima só mostra o que ainda tem caixa aberta.** Change em que tudo foi feito desce
para `archive/` — inteira, sem apagar nada, porque ela é a evidência de método que o texto do TCC
cita (o que foi proposto, o que foi medido, o que foi descoberto no caminho e o que mudou de
ideia).

> ⚠ Arquivar **não** é terminar o assunto, e muito menos apagar: é tirar do caminho de quem
> pergunta *"o que falta?"*. Quem pergunta *"como isso foi decidido?"* lê o arquivo.

## Ativas — o que ainda tem caixa aberta

| Change | Caixas abertas | O que são |
|---|---|---|
| `give-bpmn-assistant-an-agent-harness` | 10 | as seções de ensino do tutor (8.1–8.5, o portão F8) e a bateria da fase; a **pedagogia foi estacionada pelo dono** para elaborar com o orientador (ver `roadmap.md` §F8b). Também o teto do `clientContent`, que tem ferramenta pronta e nunca foi corrido |
| `add-bpmn-public-live-assistant-mvp` | 6 | publicação definitiva (domínio, ambiente `production`, o gate do dono), MCP e memória durável — as duas últimas **estacionadas por ele**, de propósito |
| `add-bpmn-norm-knowledge-base` | 1 | a 6.3 **ao vivo**: induzir o modelo a citar chave inexistente. Está provada no gerente, que é onde a troca por `[fonte não conferida]` acontece; ao vivo gastaria sessão para medir o que o nosso código decide sozinho |
| `harvest-proven-voice-foundations` | 1 | declarar no texto do TCC a licença do `bpmn-js` e a marca d'água (K-G) — é de banca, não de software |

## Arquivadas — tudo feito, e a prova está dentro

| Change | O que ela deixou |
|---|---|
| `add-bpmn-diagram-tools` | as ferramentas de leitura e de escrita do diagrama (F6 e F7), com a geometria provada contra o bpmn-js de verdade |
| `close-the-loop-with-the-canvas` | a leitura da tela de volta a cada escrita, o canal `(da página)` e a ambiguidade virando botão |
| `spoken-confirmation-gates` | o portão de ORDEM por voz: recusa até o aluno responder, e só então apaga |
| `sustain-a-class-session` | a aula que não bate no teto da sessão: compressão de contexto, teto de 25 min, a cota medida e a latência por turno |
| `prove-it-with-a-golden-set` | o conjunto dourado, a camada determinística dentro do `npm test` e as tabelas geradas dos arquivos |
| `introduce-bpmn-first-run-workspace` | a primeira tela: a pessoa escolhe o caminho antes de ver a pizzaria, e sempre há volta |
| `refine-assistant-panel-ui` | o redesenho do painel sem derrubar a prova: uma ação por estado, a cor certa para cada um, a escala de espaçamento, e a marca d'água do bpmn.io medida contra o painel |
