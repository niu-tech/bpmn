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
| `give-gateways-their-second-path` | 19 | **nova (2026-11-17)**, do teste ao vivo do dono: o gateway sai com UM caminho e o outro fica solto. Causa medida — `comoRamo` existe no handler e **nunca foi declarado**, então pedir o segundo caminho encadeia no primeiro |
| `start-a-new-process-without-losing-work` | 21 | **nova (2026-11-17)**: com um processo aberto não dá para começar do zero. A pergunta ganha três respostas (baixar · descartar · cancelar), porque guardar é **baixar o arquivo**, nunca servidor |
| `show-the-work-while-the-agent-builds` | 19 | **nova (2026-11-17)**: durante a construção o canvas não dá sinal e o chat vira parede de linhas. ⚠ Mede a latência antes de prometer velocidade: o nosso lado leva 0,4–1,0 s por chamada |

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
