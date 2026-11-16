# Adendo — os verbos de escrita que nasceram da primeira trilha de uso (2026-11-15)

> **Leia isto quando:** for mexer em `tools/escrita.js`, `tools/bpmn-api.js`, no catálogo de
> ferramentas, ou quando precisar **provar uma ferramenta contra o bpmn-js sem gastar cota**.
>
> **Não leia quando:** estiver em voz, prompt, memória ou interface — nada aqui toca esses lados.
>
> É **adendo**, não mudança de rumo: o trabalho em `changes/archive/close-the-loop-with-the-canvas`
> segue como está, e este documento diz o que mudou embaixo dele enquanto ele era escrito.
> (A change desceu para o arquivo em 2026-11-15, com todas as caixas fechadas — ver
> `openspec/changes/README.md`.)

## 1. O que entrou

Três commits, todos em `main`, todos com portão:

| Commit | O que |
|---|---|
| `c974086` | `mover` · `alinhar` · `trocar_tipo` · `criar_elemento` com `entre` · `desfazer` · `destacar` |
| `4b1250f` | portão AO VIVO do function calling desses verbos |
| `fcb5eaf` | `criar_pool` · `criar_raia` |

Nenhum deles é invenção: saíram do que o aluno pediu na trilha de 2026-11-14 e não existia —
*"tira o outro ali e põe para a linha de cima"*, *"não tá na mesma linha, era para ser contínuo"*,
*"esqueci de verificar o pagamento"*, *"cria uma raia para o entregador"*.

Cada verbo é o serviço do **próprio bpmn-js**, nunca regra reimplementada:

| Verbo | Serviço | O que ele resolve |
|---|---|---|
| `mover` | `modeling.moveElements` | `dentroDe` leva ao meio da faixa de um pool/raia (muda de raia de verdade); `direcao`+`passos` anda 80 px, a grade do `autoPlace`. **Nunca pixel absoluto**: o modelo não recebe coordenada nenhuma (H4), então pedir x/y a ele é pedir palpite |
| `alinhar` | `alignElements.trigger` | mesma linha (`middle`) ou mesma coluna (`center`). O `trigger` é **silencioso** quando a regra `elements.align` recusa — a ferramenta lê de volta e devolve `nada_mudou` |
| `trocar_tipo` | `bpmnReplace.replaceElement` | preserva nome e **religa os fluxos**. O `id` MUDA e volta em `idNovo` |
| `criar_elemento` com `entre: [a, b]` | `DropOnFlowBehavior` (criar com o FLUXO como pai) | A→novo→B religado, **um só `Ctrl+Z`** |
| `desfazer` | `commandStack.undo` | a MESMA pilha do `Ctrl+Z` do aluno — a declaração diz isso, porque o último comando pode ter sido dele. Pilha vazia é `nada_mudou`, não "pronto, desfiz" |
| `destacar` | `modeling.setColor` | paleta FECHADA (vermelho, amarelo, verde, azul, roxo, nenhuma); cor lida de volta no DI |
| `criar_pool` | `createParticipantShape` + `CreateParticipantBehavior` | o **primeiro** pool de um diagrama plano troca a raiz para `bpmn:Collaboration` e adota o desenho inteiro |
| `criar_raia` | `modeling.addLane` | a **primeira** raia de um pool cria DUAS faixas: a do conteúdo que já estava lá e a nova |

Duas armadilhas de API que custaram prova e ficaram no código com a origem nomeada:

- `createParticipantShape`, **nunca** `createShape`: participante sem `processRef` é pool que não
  guarda nada, e o primeiro elemento criado lá dentro estouraria no `BpmnUpdater` com a forma já
  desenhada — o mesmo fantasma do portão 4.5.
- o bpmn-js ajusta o tamanho do pool ao conteúdo **apenas no arrasto** (`create.start`). Criado por
  comando, ele nasceria 600×250 e um processo maior ficaria desenhado **fora do próprio pool**. A
  conta (20 px de folga + 30 px da faixa do rótulo) é nossa, em `vagaDePool`.

## 2. Três campos novos de resultado — e por que eles REFORÇAM a change em voo

O `close-the-loop-with-the-canvas` nasceu dizendo que o remendo "um campo novo por caso" não escala.
Esta rodada acrescentou **três** desses campos, e por boas razões locais:

| Campo | Em que verbo | O fato que ele carrega |
|---|---|---|
| `ramo` + `avisoDeRamo` | `criar_elemento` | a âncora já tinha saída, então o bpmn-js desenhou um RAMO paralelo um degrau abaixo — e o verbo certo para o que o aluno queria é `entre` |
| `virouColaboracao` + `adotou` | `criar_pool` | a raiz do XML mudou de tipo e o desenho inteiro entrou no pool novo |
| `criouAFaixaDoQueJaExistia` | `criar_raia` | apareceram DUAS faixas, e ele pediu uma |

Os três dizem a mesma coisa de três jeitos: **o que ficou na tela é maior do que a operação**. A
tarefa `2.2` daquela change já prevê absorver o `avisoDeRamo` na leitura única; o pedido deste
adendo é absorver os outros dois no mesmo movimento — `estadoDaTela()` precisa dizer *o diagrama é
processo ou colaboração* (já está na tarefa `1.1`) e *quantas faixas este pool tem*, e aí os cinco
campos somem juntos, com substituto.

`adotou` conta **forma, não conexão**: o bpmn-js move as setas junto, e somá-las faria o número
dito ao aluno não bater com o que ele conta na tela.

## 3. A capacidade que mais serve a vocês: provar ferramenta SEM gastar cota

Cota do Live é o teto prático da aula (T16 / M7 — a trilha de 2026-11-14 morreu em `erro: cota` com
o dono no meio de um teste). Então:

```js
await window.__bpmnAssist.ferramenta('mover', { id: 'Task_1', dentroDe: 'Lane_2' });
```

`session.dirigirFerramenta(nome, args)`, exposto no `mount.js`. É o **caminho do modelo**: mesma
política (no viewer recusa igual), mesmo teto, mesmo diário, mesma linha na conversa. Não abre
sessão, não fala com o Google.

Os portões que isso destravou (todos verdes, nenhum gasta cota):

```bash
node tools/battery.mjs --so geometria
node tools/battery.mjs --so "pool e raia"
```

- `geometria`: inseriu no meio do fluxo `_6-450 → _6-652` e o atalho direto desapareceu; `mover`
  levou o elemento para a raia *delivery boy* (`y=+235`, dentro da faixa); `alinhar` pôs os centros
  em 550 e 550; `trocar_tipo` virou `UserTask` mantendo as duas ligações; `destacar` chegou ao SVG
  (`rgb(255,205,210)`) e `desfazer` tirou.
- `pool e raia`: na colaboração, 2→3 pools com as **4 tarefas ainda dentro** do pool do vendedor e
  3→6 raias; no processo plano (importado pelo input da própria barra, sem recarregar a aba),
  `adotou: 2` com os dois elementos soltos medidos **dentro** do pool (610×260), zero sobreposição,
  e dois `Ctrl+Z` (nome, depois faixas) devolvendo o desenho.

E o que **só** a sessão ao vivo prova — o modelo escolhendo o verbo a partir da frase do aluno —
ficou em dois cenários, um por rodada:

```bash
node tools/battery.mjs --so palavras     # entre + trocar_tipo
node tools/battery.mjs --so entregador   # criar_raia + criar_pool
```

Medido: *"entre X e Y tem que ter uma tarefa de conferir o pagamento"* → `criar_elemento` com
`entre`; *"devia ser uma tarefa do usuário"* → `trocar_tipo`; *"uma raia para o entregador"* →
`criar_raia` ("Delivery boy", pool certo); *"um pool para a transportadora"* → `criar_pool`
("Delivery company").

Determinísticos: `escrita.mjs` foi de 30 para **59** provas assíncronas + 5 síncronas. O dublê
ganhou pilha de comandos **com inversos reais** — `{ undo(){} }` diria "desfiz" sobre um desenho
intacto, que é justamente o defeito que o teste tem de pegar.

Guard estrutural novo: **toda** ferramenta com `escreve: true` precisa de executor roteado e é
recusada no viewer. Ferramenta nova que esquecer o executor reprova no `npm test`, em vez de virar
`ferramenta_nao_roteada` no meio de uma conversa.

## 4. Dois achados que mudam decisão, não só código

1. **O tema comia a cor do DI.** `src/themes/bizagi-theme.css` pinta toda tarefa com
   `fill: #EAF2FF !important`, e `!important` vence a cor que o BPMN DI declara. Medido: o `rect`
   saía com `style="fill: rgb(255,205,210)"` e computado `rgb(234,242,255)`. Ou seja, `destacar`
   dizia "destaquei" e a tela não mudava — **e o mesmo valia para qualquer diagrama importado com
   cores**. Conserto em `src/app.js`: elemento com cor própria não recebe a marca do tema
   (`temCorPropria`); como `setColor` emite `elements.changed`, a marca sai quando a cor entra e
   volta no desfazer.
2. **A escadinha de que o aluno reclamou não é defeito de vaga.** O `findFreePosition` do bpmn-js
   empurra o elemento para baixo quando a âncora já tem saída, porque ali é um ramo paralelo —
   desenhar ramo um degrau abaixo é o certo em BPMN. Forçar o centro da âncora acharia o desenho e
   **esconderia a bifurcação**. A resposta foi dar o verbo de inserir no meio e DIZER ao modelo que
   aquilo é um ramo.

## 5. O que ficou de fora, e por quê

- **Layout automático de verdade** ("organiza isso tudo"): o bpmn-js **não tem**. É frente própria
  (grafo em camadas, raias, rótulos). Registrado como `T18`.
- **Confirmação do primeiro pool**: ele reestrutura a raiz do XML, mas é aditivo e desfazível, e a
  regra de confirmação do projeto é para o destrutivo (`remover`). Ficou sem gate, com o aviso na
  declaração e os fatos no resultado. Se a aula mostrar susto, o gate é de uma linha.
- **Prova de function calling para `mover`, `alinhar`, `desfazer` e `destacar`**: têm portão de
  navegador, não têm "o modelo escolheu a partir da frase". Cada um custa uma sessão de cota, e o
  dono passa por eles no próximo teste de graça.
- **Criar pool/raia com conteúdo junto** ("uma raia para o entregador com a tarefa de entregar"):
  dois verbos encadeados pelo modelo resolvem; não virou verbo composto.

## 6. Próximos passos possíveis

| Frente | Custo | Risco | Nota |
|---|---|---|---|
| **`estadoDaTela()` absorvendo os cinco campos** (tarefas 1.1/2.1/2.2 da change em voo) | médio | baixo | é o caminho já desenhado, e esta rodada só engrossou o argumento dele |
| **T18 — arrumar o desenho** | alto | médio | sem apoio do bpmn-js; medir primeiro se o aluno pede isso ou se pede `alinhar` |
| **F8 tutor: propor antes de aplicar** | médio | baixo | a mecânica existe (as três frases já viram processo); falta a pedagogia — proposta nomeada que o aluno aceita |
| **M7/T16 — medir o teto de cota** | baixo | nenhum | abrir sessões em sequência até a recusa e dizer na tela "volte em X segundos"; hoje a tela diz o que fazer, não quando |
| **Confirmação falada** (`spoken-confirmation-gates`) | médio | baixo | com oito verbos de escrita, o "pode?" falado passou a valer mais do que valia com quatro |

Recomendação, se a escolha for minha: **`estadoDaTela()` primeiro**. Os cinco campos são dívida que
cresce a cada verbo novo, e ela já cresceu duas vezes nesta semana.

## 7. Como não pisar no pé (árvore compartilhada)

As duas sessões escrevem no MESMO working tree. Nesta rodada o `git add -- openspec` desta sessão
levou de carona dois arquivos da change em voo (`proposal.md` e `.openspec.yaml`) para o commit
`fcb5eaf` — nada se perdeu, mas a mensagem do commit não fala deles. Daqui para frente: stage por
caminho explícito do próprio escopo, e `git status` lido antes de qualquer `add`.
