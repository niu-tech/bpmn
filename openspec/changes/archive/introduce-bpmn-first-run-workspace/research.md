# Estudo da tela base — referências, e o que foi de fato conferido

> Pedido do dono (2026-11-15): *"para fazer essa tela base, a gente vai fazer um estudo maior… e
> também ter uma referência visual, não fazer do zero assim."*

## 0. Proveniência, antes de tudo

O levantamento de referências foi feito **em outra conversa** (ChatGPT) e chegou aqui como handoff
colado, em 2026-11-15. Esta sessão **não abriu os oito sites**: o que está na §1 é o que aquele
levantamento concluiu, registrado como tal.

O que **esta** sessão conferiu no disco, e que é o que sustenta as decisões do `design.md`:

| Afirmação | Como foi conferida | Resultado |
|---|---|---|
| o site carrega a pizzaria sozinha quando não há nada salvo | `src/app.js`, `run()` | confirmado: `localStorage` → senão `fetchDiagram(DEFAULT_DIAGRAM_URL)` |
| o painel já se apresenta (não refazer) | `widget.js` → `convite`, `empty`; `artifacts/e2e-shots/boas-vindas*.png` | confirmado, inclusive nos prints |
| a página não tem nada de boas-vindas | `src/index.html` | confirmado: `<div id="canvas">` e o bundle |
| o autosave só escreve quando há edição | `src/app.js`, `eventBus.on('commandStack.changed')` | confirmado — é a razão de B2 |
| a marca d'água exige 44 px livres | `src/assistant/layout.js`, `RESERVA_MINIMA` | confirmado, com a nota de licença |
| o acervo citável não existe ainda | `openspec/changes/add-bpmn-norm-knowledge-base/tasks.md` | **0 de 31 caixas** |
| F8 passou pela metade | `openspec/roadmap.md` §F8 | confirmado: 3 frases → início, tarefas e fim ligados; a pedagogia (F8b) está aberta |
| a árvore está verde antes de mexer | `npm test` | 20 suítes, 585 verificações, 0 falhas |

Prints das referências **não** foram capturados. Se o dono quiser as oito telas lado a lado como
imagem, é uma rodada à parte — e aí são capturas feitas aqui, não descrição de terceiro.

## 1. As oito referências, e o que cada uma resolve

| # | Referência | O que copiar | O que descartar |
|---|---|---|---|
| 1 | **bpmn.io** · https://bpmn.io/ | a distinção clara entre *abrir* e *criar*; o exemplo é interativo | exemplo sem identificação — é exatamente o nosso defeito |
| 2 | **Camunda Modeler** · https://camunda.com/ | começar por um processo simples e crescer a partir dele | tutorial sequencial obrigatório |
| 3 | **Miro** · https://miro.com/templates/ | a escolha explícita "modelo × tela em branco", com preview | catálogo extenso: vira menu, que é o que a pergunta 2 proíbe |
| 4 | **Whimsical** · https://whimsical.com/ | miniatura que mostra o que vem antes de clicar | galeria com centenas de opções |
| 5 | **FigJam** · https://www.figma.com/figjam/ | reaproveitar o mesmo modelo em tela nova ou existente | modelo que ocupa o canvas sem contexto nenhum |
| 6 | **Linear** · https://linear.app/ | **uma** ação principal, campos mínimos | a estrutura de times/projetos, que aqui não existe |
| 7 | **Notion** · https://www.notion.so/ | tela em branco com estrutura **opcional**, nunca imposta | excesso de menus na primeira tela |
| 8 | **ChatGPT** · https://chatgpt.com/ | entrar pela **intenção**, com exemplos clicáveis | virar chat genérico: aqui o assunto é BPMN e o diagrama aberto (constituição §VI) |

**A síntese do levantamento:** bpmn.io e Camunda dão o enquadramento de modelagem; Miro e Notion
dão a escolha do ponto de partida; ChatGPT dá a entrada por intenção. Nenhuma das oito resolve o
nosso caso inteiro, e a razão é a mesma em todas: **nenhuma tem um agente que lê o canvas e desenha
junto**. Copiar tela inteira de qualquer uma seria importar o problema de outro produto.

## 2. As cinco perguntas, respondidas

| # | Pergunta | Resposta | Onde |
|---|---|---|---|
| 1 | O que a pessoa vê nos primeiros 5 s? | hoje, trabalho alheio; passa a ver um convite com três caminhos e o que o ajudante faz | B1 |
| 2 | Como oferecer três caminhos sem virar menu? | hierarquia, não lista: **um** cartão primário (descrever) e dois secundários; a quarta entrada é um link | B1, B5 |
| 3 | Onde isso mora? | no espaço do canvas, enquanto não há trabalho — nem página separada, nem faixa sobre o desenho | B1 |
| 4 | O exemplo continua existindo? | sim, e identificado; depois de "começar do zero" a tira oferece "ver um exemplo" | B6 |
| 5 | E a chave? | continua no painel. A tela base não pede nada | B4 |

## 3. O que a tela pode prometer, medido contra os portões

| Promessa | Estado | Base |
|---|---|---|
| abrir um exemplo e conversar sobre ele | **pode** | F6 fechada |
| começar um diagrama em branco | **pode** | o modelador já faz |
| explicar o que é BPMN com o desenho na frente | **pode**, sem citar fonte | conhecimento do modelo |
| criar, ligar, mover, renomear, apagar a pedido | **pode** | F7, F7b, F7c |
| "conte o seu processo e ele vai montando com você" | **parcial** | metade do portão F8 |
| proposta nomeada aceita antes de qualquer traço | **não** | portão F8 inteiro não passou |
| resposta fundamentada na norma, com citação | **virou possível no mesmo dia** | FK: 0 de 31 quando o estudo começou, **29 de 31 ao fim dele** (commits `6c1cb4e` e `9e904b5`, portão ao vivo) |

As duas últimas linhas são a razão de o texto da tela ser curto. Ver B9.

> ⚠ **Esta tabela mudou enquanto era escrita, e isso é o registro honesto.** Ela foi medida contra
> `92008fa`, quando a FK tinha **0 de 31** caixas. Horas depois, no mesmo working tree, uma frente
> paralela fechou a FK: `6c1cb4e` (acervo, índice, `consultar_norma`) e `9e904b5` (portão **AO
> VIVO**), deixando 29 de 31 — abertas só a latência na URL pública (5.3) e o cenário de citação
> inventada (6.3).
>
> **Consequência para a tela base, aplicada ainda nesta rodada:** a linha de descoberta passou a
> dizer que o tutor *"explica com o exemplo na frente e diz de onde tirou"*. Não entrou pela palavra
> da outra frente: entrou porque `consultar_norma` está declarada no catálogo (conferido) e porque o
> cenário dela passou na bateria que rodei aqui (*"o acervo responde pelo caminho do modelo, e
> declara o próprio tamanho"*, 21 de 21). E entrou **com guard**: `__tests__/abertura.mjs` reprova
> se a ferramenta sumir do catálogo, nomeando o texto de `tela.js` a corrigir.
