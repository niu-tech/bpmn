# Design — harness do ajudante BPMN

Decisões, cada uma com a alternativa recusada. O que não está aqui não foi decidido.

## H1 — Seções tipadas, não string concatenada

**Decisão.** O prompt é uma lista ordenada de seções `{ id, titulo, tier, render(ctx) }`. `tier` é
`estavel` (identidade, domínio, recusa, política de ferramentas) ou `volatil` (diagrama, memória).
As estáveis vêm primeiro; as voláteis depois.

**Por quê.** É o que permite orçamento por seção, cache do prefixo estável e — principalmente —
que voz e texto rendam **a mesma prosa**. Hoje o modo texto faz
`SYSTEM_INSTRUCTION + "\n\n" + DELIVERY_INSTRUCTION`: duas prosas que já divergem em um `+`.

**Recusado.** Template string com interpolação. Parece mais simples e é onde a divergência nasce:
não dá para orçar, não dá para testar seção por seção, e qualquer novo requisito vira mais um `+`.

## H2 — Resolver uma vez, renderizar uma vez

**Decisão.** `resolverContexto()` é o único lugar que lê estado (diagrama, memória, política,
modo). Devolve um objeto puro. `renderizarPrompt(secoes, ctx, perfil)` é puro e não lê nada.

**Por quê.** Prompt que lê estado durante o render é prompt que muda sozinho entre duas chamadas.
Separar deixa o render testável sem navegador: é o que faz a suíte `.mjs` cobrir o contrato.

**Recusado.** Cada seção buscar o que precisa. Mais direto de escrever, impossível de testar.

## H3 — Contexto viaja como quadro semeado, não como seção de prompt

**Decisão.** Diagrama e memória entram por `clientContent` com `turnComplete: false` (o
`buildHistory` que já existe), logo após o `setupComplete`. Em turno digitado, só o **delta** vai.
O `systemInstruction` fica com as seções estáveis.

**Por quê.** É a separação física entre persona e contexto que a MAIA adotou em
`converge-maia-memory-on-runtime-v2`: o `setup` é imutável depois de aceito, então tudo que muda
tem de viajar por fora dele — senão cada mudança de contexto exige **reabrir a sessão**, que é
exatamente o defeito de hoje ao trocar de modo.

**Recusado.** Pôr o estado do diagrama no `systemInstruction`. Simples, e condena o agente a
nunca saber que o aluno acabou de criar uma tarefa, a menos que se reconecte.

**Risco aceito.** `clientContent` com `turnComplete:false` foi medido no P1 como aceito pelo
servidor, mas nunca com payload grande. A change mede o teto antes de confiar (tarefa 2.4).

## H4 — Projeção do diagrama, nunca o XML

**Decisão.** O quadro traz: nome e id do processo, contagem por tipo de elemento, lista de raias e
pools, até N elementos com `{id, tipo, nome}`, e o elemento **selecionado** em destaque. `N` tem
teto e o corte é dito ao modelo (*"…e mais 23 elementos"*).

**Por quê.** O `pizza-collaboration.bpmn` tem 22 KB. Mandar XML a cada turno queima a cota do
aluno para o modelo reler o que ele já sabe. A pergunta quase sempre é sobre **um** elemento — e
esse a seleção já diz qual é.

**Recusado.** Mandar o XML e deixar o modelo filtrar. Caro, e piora a resposta: XML afoga o
contexto útil.

## H5 — Saber "de qual bloco estamos falando" tem duas fontes

**Decisão.** (a) a **seleção** do modelador, que o `eventBus` emite (`selection.changed`), entra no
quadro; (b) quando não há seleção, o modelo pode **perguntar** — e, com as ferramentas da change
irmã, procurar por nome.

**Por quê.** O caminho determinístico resolve o caso comum (o aluno clicou no elemento e
perguntou) sem gastar um turno. O resto é conversa, que é o que o agente faz bem.

**Recusado.** Adivinhar por similaridade de texto no código. É keyword→ação disfarçada, proibida
pela constituição (§III).

## H6 — Memória: três categorias, uma aba

**Decisão.** `fato` (o aluno declarou: *"meu processo é de atendimento"*), `decisao` (fechada na
conversa: *"vamos usar gateway exclusivo aqui"*), `preferencia` (*"responda curto"*). Cada entrada
tem origem (turno) e carimbo. Teto por categoria, descarte do mais antigo.

**Por quê.** Memória sem categoria vira transcrição, e transcrição não cabe no orçamento. As três
são o que muda a resposta seguinte.

**Recusado por ora.** Persistência entre visitas (`localStorage`). O produto hoje promete em texto
que **nada** fica na aba depois de fechar; mudar isso exige consentimento próprio e mudança do
aviso. Vira change separada, com o aviso reescrito.

## H7 — Guardrail é seção + cenário, não boa vontade

**Decisão.** A recusa ganha seção própria com: o que é o domínio, o que fazer fora dele (uma
frase + oferta do que sabe fazer), e a proibição de inventar elemento que não existe no diagrama.
Um cenário da bateria pergunta receita de bolo e exige recusa; outro pergunta por um elemento
inexistente e exige que o agente diga que não encontrou.

**Por quê.** O site é público. "O modelo normalmente recusa" não é requisito.

**Recusado.** Filtro de entrada por palavra-chave antes de mandar ao modelo. Bloquearia pergunta
legítima (*"como modelo o processo de uma pizzaria?"*) e é exatamente o anti-padrão da §III.

## H8 — Catálogo com portão, mesmo com zero ferramentas

**Decisão.** Esta change entrega `catalogo.js` (declarações), `politica.js` (default-deny, um
conjunto de nomes permitidos por perfil) e o ponto de despacho. Sem nenhuma ferramenta de produto.

**Por quê.** O portão tem de existir **antes** da primeira ferramenta, senão a primeira entra sem
portão e a segunda copia a primeira. Custa ~80 linhas agora e evita a dívida que a MAIA levou
anos para pagar.

**Recusado.** Esperar a change irmã. É como se cria o débito.

## H9 — Modo voz também declara ferramentas

**Decisão.** A escolha medida no P1 (declarar `entregar_resposta` deixa o modelo **mudo**) vale
para **aquela** função, que pede entrega textual. Ferramentas de ação não pedem silêncio. A change
mede isto explicitamente (tarefa 4.3) antes de ligar ferramenta em voz.

**Por quê.** Agente que só age quando o aluno digita é meio agente. Mas a medição do P1 é real e
não pode ser ignorada por conveniência.

**Se a medição disser que qualquer ferramenta declarada emudece o modelo:** voz fica sem
ferramenta de ação nesta rodada, o fato é registrado em `open-items.md`, e a UI diz ao aluno que
para editar é preciso digitar. Honesto e verificável.

## H10 — Nada disso roda no viewer

**Decisão.** O quadro de contexto do viewer declara `somenteLeitura: true`, e a política do perfil
`viewer` não permite nenhuma ferramenta de escrita.

**Por quê.** `/viewer.html` é um `NavigatedViewer`: não tem `modeling`. Declarar ao modelo uma
ferramenta que a página não executa é defeito de catálogo (constituição §VIII).
