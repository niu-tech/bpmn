## Context

O boot do modelador tem hoje exatamente dois estados, e um deles é uma suposição:

| O que `run()` faz | Quando | O que a pessoa conclui |
|---|---|---|
| `importXML(localStorage['bpmn.autosave.xml'])` | tem trabalho salvo | certo: é o meu diagrama |
| `importXML(pizza-collaboration.bpmn)` | não tem nada salvo | **errado**: parece que o diagrama é dela, ou que o site é sobre pizza |

O segundo caso é o produto inteiro falando pela primeira vez — e dizendo a coisa errada. Não é
falta de texto: é falta de **um estado**. "Não há nada salvo" foi tratado como "abra alguma
coisa", quando na verdade quer dizer "esta pessoa ainda não escolheu nada".

O estudo (`research.md`) olhou oito produtos e chegou a três conceitos; a comparação visual está em
`openspec/apresentacoes/tela-base-conceitos.html`. O que segue são as decisões, cada uma com a
alternativa recusada.

## Decisions

### B1. A tela base mora no ESPAÇO DO CANVAS, não antes dele

Alternativas recusadas: uma página `/boas-vindas.html` antes do modelador, e uma faixa sobre o
canvas com a pizzaria atrás (o conceito **B** do estudo).

A página separada atrasa quem já sabe o que quer, cria uma segunda URL para manter e um segundo
lugar onde a marca d'água e a barra podem ser esquecidas. A faixa sobre a pizzaria mantém a
primeira impressão errada (o diagrama de outra pessoa) e **cobre justamente o desenho que ela
deveria explicar**.

Ocupar o canvas resolve as cinco perguntas de uma vez: a pessoa está no modelador (o contexto é
óbvio), não há diagrama alheio competindo, e no instante em que ela escolhe o convite some e o
espaço volta a ser o que era.

### B2. "Ainda não escolheu" é uma chave própria, não a ausência de desenho

`bpmn.primeira-vez` guarda `exemplo` · `branco` · `tutor`. A decisão de abertura é uma função
pura, `decidirAbertura({ salvo, escolha, atalho })`, com quatro saídas: `restaurar`, `exemplo`,
`branco`, `convite`.

Alternativa recusada: deduzir pelo canvas ("está vazio ⇒ mostre o convite").

Não funciona, e o motivo é mecânico: o autosave só escreve em `commandStack.changed`. Quem escolhe
"começar do zero" e fecha a aba antes de desenhar **não deixa rastro nenhum** — e receberia o
convite de novo, para sempre, como se nunca tivesse decidido. Decisão da pessoa é dado da pessoa:
guarda-se explicitamente.

### B3. Atrás do convite, o modelador nasce vivo e vazio

`modeler.createDiagram()` — o diagrama novo do próprio bpmn-js (um evento de início e nada mais).

Alternativas recusadas: deixar o modelador sem nenhum import (o `fitAndOffsetCanvas` quebra com
escala não-finita, e o ajudante nasceria sem registro para ler) e carregar a pizzaria desfocada
atrás do convite (volta a pôr trabalho alheio na tela de quem chegou agora).

Consequência honesta: "começar do zero" entrega o diagrama novo do bpmn-js, não uma folha
absolutamente em branco. É o mesmo ponto de partida do Camunda Modeler, e o evento de início é o
único elemento de que todo processo precisa.

### B4. A tela base NÃO pede chave e NÃO abre o painel sozinha

Alternativa recusada: o conceito **C** do estudo (ajudante aberto, já perguntando).

Pedir a chave antes de mostrar valor é o defeito que o painel acabou de corrigir — repeti-lo uma
camada acima seria andar para trás. E o painel aberto por cima do canvas, em 375 px, não deixa
nada do modelador visível. O cartão primário é a conversa; **o clique é que abre o painel**.

### B5. A página oferece caminhos; quem conduz é o MODELO

O que o código faz ao clicar, e só isso:

| Caminho | Ação determinística |
|---|---|
| descrever o processo | abre o painel e deixa a frase digitada no compositor — **sem enviar** |
| o que é BPMN | carrega o exemplo, abre o painel, deixa a pergunta digitada — **sem enviar** |
| ver exemplo | carrega `pizza-collaboration.bpmn` |
| começar do zero | nada: o diagrama novo já está lá |

Não existe roteiro "pergunte o que inicia, depois quem faz": isso é condução, e condução é do
modelo por function calling (constituição §III). Deixar digitado em vez de enviar tem uma segunda
razão, prática: quem chegou agora provavelmente não tem chave, e enviar sozinho produziria um erro
como primeira resposta do produto.

`sugerir(texto)` entra no widget (quatro linhas) em vez de um segundo compositor na tela base —
requisito explícito do estudo e, de resto, a única forma de não duplicar estado de conversa.

### B6. O exemplo nasce IDENTIFICADO, e a tira some quando vira trabalho

Uma tira discreta no topo: *"Exemplo: pedido de pizza · começar o meu"*. Ela desaparece no primeiro
`commandStack.changed` — o instante em que o desenho deixa de ser exemplo e passa a ser da pessoa.

Alternativa recusada: selo permanente. Aviso que não sai vira ruído, e continuar chamando de
"exemplo" o diagrama que a pessoa já editou é falso.

Depois de "começar do zero", a mesma tira muda de texto e oferece *"ver um exemplo"* — é assim que
o exemplo continua alcançável sem virar menu (pergunta 4 do estudo).

### B7. A marca d'água do bpmn.io continua livre

O convite reserva `RESERVA_MINIMA` (44 px) no rodapé, a mesma constante de
`src/assistant/layout.js`, com a mesma razão escrita lá: a licença do bpmn-js exige que a marca
fique **inteiramente visível e não sobreposta**. Reusar a constante, e não repetir o número, é o
que impede as duas cópias de divergirem.

### B8. `#exemplo` é um atalho de verdade, não um gancho de teste

`location.hash === '#exemplo'` abre o exemplo direto, sem convite.

Alternativa recusada: um gancho só para a bateria (`window.__primeiraVez.escolher(...)`).

A bateria precisa do diagrama carregado em ~20 cenários que não têm nada a ver com boas-vindas; sem
isso, cada um deles teria de clicar no convite. Mas um gancho de diagnóstico prova um caminho que
**não é o do produto**. O atalho é melhor pelos dois lados: é o link que mostra a demonstração a
alguém (a banca, o orientador) e é o que a bateria usa. O convite tem o seu próprio cenário, contra
a URL sem hash.

Precedência: o atalho vence o trabalho salvo. O `localStorage` **não é apagado** — quem clicou o
link por engano continua com o "⤴️ Restaurar" da barra até a primeira edição.

### B9. O texto da tela é escrito contra o que foi PROVADO

A regra de escrita: cada frase da tela aponta para um portão fechado.

| A tela diz | Porque está provado |
|---|---|
| "ele lê o que está aberto e responde" | F6 |
| "pode pedir para criar, ligar, mover, renomear e apagar" | F7 / F7b / F7c |
| "antes de apagar, ele pergunta" | `spoken-confirmation-gates` |
| "o que ele desenhar você desfaz com Ctrl+Z" | constituição §VII |
| "conte o seu processo e ele vai montando com você" | metade do portão F8 (três frases → início, tarefas e fim ligados) |
| "ele explica … e diz de onde tirou" | **FK**, fechada em 2026-11-15 na frente paralela: acervo de 12 verbetes, `consultar_norma` declarada nos dois perfis e portão AO VIVO passado |

E o que a tela **não** diz, por não estar provado: que ele **propõe antes de aplicar** (portão F8
inteiro, aberto). Prometer na primeira tela o que o agente ainda não faz é a forma mais barata de
estragar a primeira impressão — e está escrito assim no handoff do dono.

A linha da fonte é o caso que mostra a regra funcionando nos dois sentidos. Quando esta change
começou, a FK tinha **0 de 31** caixas e a tela calava sobre citação. A FK fechou no mesmo dia, numa
frente paralela, e a linha entrou — com um **guard** em `__tests__/abertura.mjs` que reprova se
`consultar_norma` sair do catálogo. A promessa não pode sobreviver ao que a sustenta.

### B10. O autosave engolia `commandStack.changed` — corrigido na raiz, não contornado

Achado implementando a tira: ela **não sumia** ao editar o exemplo. O sintoma mentia bem — o
`commandStack.changed` claramente acontecia (o autosave gravava o nome novo no `localStorage`,
medido), o listener da tira estava no **mesmo** `eventBus` e no **mesmo** modelador (comparados por
identidade na página), e não havia um erro sequer no console.

A causa é uma regra do `EventBus` do diagram-js: **listener que devolve qualquer coisa diferente de
`undefined` encerra a propagação** do evento. O autosave era `eventBus.on("commandStack.changed",
async () => {…})`, e `async` devolve **sempre** uma Promise. Ele estava registrado primeiro, então
engolia o evento para todo mundo que viesse depois.

Alternativa recusada: registrar a tira com prioridade maior para passar na frente do autosave.
Funcionaria, e deixaria a armadilha montada para o próximo — qualquer listener futuro de
`commandStack.changed` nasceria morto, em silêncio. O autosave passou a não devolver valor
(`void (async () => {…})()`), com a razão escrita na linha de cima dele.

É um defeito anterior a esta change, e o conserto é de três linhas: fica aqui porque foi ela que o
revelou, e porque "a tira não some" é o único sintoma que ele produziu em um ano de uso.

## Risks / Trade-offs

- **O convite pode virar obstáculo para quem só quer desenhar.** Mitigado por três cliques
  visíveis, nenhum passo obrigatório, e o atalho `#exemplo`. Medido pelo número de elementos na
  tela depois de UM clique.
- **Uma chave a mais no `localStorage`.** É dado local, morre com o navegador da pessoa, e a
  alternativa (deduzir pelo canvas) está errada por construção (B2).
- **Quem clica em "descreva o seu processo" sem chave vê a tela da chave.** É o contrato BYOK:
  conversar exige credencial, e o painel já explica isso bem. A frase fica guardada no compositor e
  aparece no instante em que a conexão abre — a tela base não pede nada por conta própria.
- ~~**O exemplo continua em inglês.**~~ **Fechado no mesmo dia**, a pedido do dono: o diagrama foi
  traduzido mantendo os **ids** intactos, que é o que permitiu mexer em 56 pontos de teste sem
  reescrever uma asserção de estrutura. Ver tarefas, bloco 8.
- **"Novo" da barra ainda recarrega a pizzaria** e apaga o autosave sem perguntar. É anterior a
  esta change e contradiz a tela nova; fica em `open-items.md` em vez de virar escopo escondido.
