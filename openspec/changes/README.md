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
| `give-bpmn-assistant-an-agent-harness` | 9 | as seções de ensino do tutor (8.1–8.5, o portão F8) e a bateria da fase; a **pedagogia foi estacionada pelo dono** para elaborar com o orientador (ver `roadmap.md` §F8b). O teto do `clientContent` saiu da lista em 2026-11-16: medido, sem teto até 512 KB |
| `add-bpmn-public-live-assistant-mvp` | 6 | publicação definitiva (domínio, ambiente `production`, o gate do dono), MCP e memória durável — as duas últimas **estacionadas por ele**, de propósito |
| `add-bpmn-norm-knowledge-base` | 1 | a 6.3 **ao vivo**: induzir o modelo a citar chave inexistente. Está provada no gerente, que é onde a troca por `[fonte não conferida]` acontece; ao vivo gastaria sessão para medir o que o nosso código decide sozinho |
| `harvest-proven-voice-foundations` | 1 | declarar no texto do TCC a licença do `bpmn-js` e a marca d'água (K-G) — é de banca, não de software |
| `guide-the-first-run-trails` | 2 | o que fica **fora** dela, de propósito: partidas por histórico de quem volta (depende de memória entre visitas, decidida em contrário) e medir se a orientação funcionou (não há telemetria) |
| `give-gateways-their-second-path` | 17/19 | **feita e provada AO VIVO (2026-11-17)**: verbo `ramificar` — um comando abre o caminho, liga e escreve a resposta na seta, e um `Ctrl+Z` desfaz o caminho inteiro. Ao vivo o modelo escolheu `ramificar` 2× e a decisão nasceu com «Sim»/«Não», zero órfãos. Causa: `comoRamo` existia no handler e **nunca foi declarado**. Abertas de propósito: as 2 linhas de prompt (estouravam o teto do tier estável) |
| `start-a-new-process-without-losing-work` | **21/21** | **fechada e provada AO VIVO por voz (2026-11-17)**: três respostas (baixar · descartar · cancelar) e o verbo `comecar_do_zero` com portao falado. Ordem cronometrada: ouviu 5,7 s → recusou 9,3 s (24 formas intactas) → o aluno respondeu 24,3 s → limpou. Guardar = **baixar o arquivo**, nunca servidor |
| `show-the-work-while-the-agent-builds` | **19/19** | **fechada e provada AO VIVO (2026-11-17)**: canvas pisca, uma mensagem que cresce (7 linhas para 14 chamadas) e o selo *desenhando*. ⚠ **Não promete velocidade, e agora com número**: a nossa escrita é **1%** do tempo (mediana 0,01 s) — 99% é a volta ao modelo, igual no local e no publicado |
| `one-call-for-a-whole-sequence` | **21/21** | **fechada e provada AO VIVO (2026-11-17)**: verbo `criar_sequencia` — a fila inteira numa chamada, porque a medição mostrou que o relógio do aluno é a **contagem de chamadas** (nossa escrita: 0,01 s). Mesmo pedido, mesmas dez formas: **8 chamadas → 2**, 3,5 s → 1,4 s, e o modelo escolheu `criar_sequencia` sozinho. Achado de brinde: fila de 6 custa 12 comandos e `desfazer` tem teto de 10 — a volta sai em duas chamadas, e a primeira **avisa** |
| `one-call-for-a-whole-decision` | **21/21** | **feita e provada AO VIVO (2026-11-17)**: verbo `criar_decisao` — o gateway, cada caminho rotulado e os passos de cada um numa chamada, compondo `criar_elemento` + `ramificar` + `criar_sequencia`. Mesmo pedido: **6 chamadas → 3**, 2,8 s → 1,9 s, com o modelo escolhendo `criar_decisao` sozinho. Achados: decisão no meio do fluxo **herda** a continuação antiga (3 caminhos, 2 rotulados — o produto CONTA, não conserta) e `ramificar` não tem guarda de gêmeo. Conferida no **publicado** com o CI verde: 3 chamadas, 1,7 s |

> A orientação da primeira visita teve uma segunda metade, e ela está **arquivada**: `name-the-tutor-and-anchor-the-exit` (2026-11-16) nomeou o agente e consertou o caminho de volta. Quem for ler a trilha inteira lê as duas.

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
| `name-the-tutor-and-anchor-the-exit` | o agente passou a ter **um** nome (`Tutor BPMN`, fonte única em `src/assistant/identidade.js`) e a tela inicial ganhou uma **saída que persiste**: a barra morria na primeira edição e carregava o único caminho de volta |
