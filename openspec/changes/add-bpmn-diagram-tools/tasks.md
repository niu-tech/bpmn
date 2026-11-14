> Fases do `openspec/roadmap.md`: bloco 2 = **F6** (leitura), bloco 3 = **F7** (escrita).
> O portao de F6 e o gate de voz com ferramenta read-only.

## 0. Pré-requisito

- [x] 0.1 `give-bpmn-assistant-an-agent-harness` implementada: catálogo, política default-deny,
      despacho com erro nomeado e contexto do diagrama — F1 a F5 fechadas e provadas ao vivo
- [x] 0.2 **Despacho assíncrono correlacionado** de pé desde a F1: resultado real, erro nomeado,
      teto próprio por ferramenta e o relógio do turno pausado enquanto ela executa
- [x] 0.3 **Gate de voz com ferramenta read-only — SIM** (2026-11-13). Numa sessão de voz o
      modelo chamou `descrever_diagrama`, recebeu o resultado e **continuou falando** (20 frames
      de áudio depois da ferramenta, com as cinco raias certas). Não há perfil reduzido a
      entregar: as ferramentas valem nos dois modos

## 1. Acesso à página

- [x] 1.1 `app.js` entrega o `modeler` ao ajudante; `viewer.js` entrega o `viewer` e a página
      nasce `somenteLeitura` pelo perfil. Nenhum dos dois expõe o objeto globalmente — o que
      `window.__bpmnAssist` dá é projeção e diagnóstico, nunca o modelador
- [x] 1.2 Camada fina em `src/assistant/tools/bpmn-api.js` com **cinco funções** — `elementos`,
      `porId`, `selecionado`, `entradasESaidas`, `assinar` — mais a flag `disponivel`. As de
      escrita (`modeling`, `elementFactory`, `bpmnFactory`) entram na F7, quando houver quem as
      use: camada com função que ninguém chama é superfície de teste inventada.
      ⚠ O observador da projeção (`agent/diagram.js`) passou a falar com ESTA camada também —
      duas camadas sobre a mesma coisa é o que o design T6 existe para impedir. Sem modelador,
      tudo devolve inerte: montar o ajudante antes de importar diagrama é caso normal

## 2. Leitura

- [x] 2.1 `descrever_diagrama` — processo, contagem por tipo, raias e pools, e o elemento
      selecionado. Rótulo externo não conta duas vezes e a raiz não vira elemento
- [x] 2.2 `buscar_elemento` — por nome (sem acento, sem caixa) e/ou por tipo (com ou sem o
      prefixo `bpmn:`), varrendo o REGISTRO INTEIRO. Teto de 20, e o corte é dito (`cortou: 30`).
      O resultado carrega `varreuODiagramaInteiro: true` — é essa marca que autoriza o modelo a
      concluir ausência, coisa que a amostra do contexto nunca permite (design H13).
      Busca sem resultado **não é erro**: é um fato que o modelo usa
- [x] 2.3 `detalhar_elemento` — tipo, nome, onde está, entradas e saídas de um `id`. Id que não
      existe (ou id de rótulo) devolve `elemento_nao_encontrado`, nomeado: é o que faz o modelo
      procurar em vez de repetir a mesma chamada
- [x] 2.4 `resumir_simulacao` — última corrida: replicações, throughput médio, WIP médio e o
      **gargalo** (a tarefa onde mais se espera: fila, não o trabalho em si), com o nome do
      elemento junto do id. Sem corrida devolve `sem_corrida`, nomeado.
      **O aviso de métrica velha existe e é medido**: a página registra a corrida junto com uma
      assinatura do diagrama (quantidade + ids), e a ferramenta compara com a assinatura de
      agora — mudou, a resposta diz *"o diagrama mudou depois desta corrida: as métricas são do
      desenho anterior"*.
      ⚠ **Utilização por raia ficou de fora**, e não por esquecimento: `taskSpans` não carrega
      `laneId`, então não dá para calcular sem mudar o motor de simulação. Entregar um número
      inventado seria pior que não entregar
- [x] 2.5 `src/assistant/__tests__/leitura.mjs` (18 casos), com dublê da NOSSA camada fina e não
      do bpmn-js (design T6): busca sem resultado, busca por nome+tipo somados, teto com corte
      declarado, rótulo fora de tudo, erro nomeado, gargalo pela espera, aviso de diagrama
      mudado, e a página sem modelador devolvendo `sem_diagrama` em todas

## 3. Escrita (só modelador)

- [x] 3.1 `criar_elemento` — tipo (lista fechada de 18), nome e âncora. Com âncora o bpmn-js
      posiciona **e já liga** (`appendShape`), que é o que o aluno pede em palavras ("uma tarefa
      depois do início"); o retorno diz que a ligação existe, para o agente não ligar de novo.
      ⚠ **Direção ficou de fora.** A COLOCAÇÃO mudou em 2026-11-14 (ver 4.5): com âncora a vaga
      vem do bpmn-js — o mesmo evento `autoPlace` que o botão de append do aluno usa — e sem
      âncora o elemento cai embaixo do que já está desenhado. Está dito no código e na declaração
      ao modelo; o que não dá é prometer ao agente uma colocação que não existe
- [x] 3.2 `conectar` — e **nós não escolhemos o tipo**. A regra do BPMN mora no bpmn-js: entre
      pools nasce `MessageFlow`, no mesmo processo `SequenceFlow`. A ferramenta manda conectar e
      **lê de volta o tipo que nasceu**; é desse FATO que sai a explicação ao aluno, não de um
      `if` com palavra-chave. Recusa silenciosa do bpmn-js vira `conexao_invalida` — silêncio
      virando `{ok:true}` faria o agente afirmar uma ligação que não está no desenho
- [x] 3.3 `renomear` — devolve o nome de antes e o de agora, **lido do registro** depois da
      operação. Nome vazio é erro nomeado, não rótulo em branco
- [x] 3.4 `remover` — **confirmação na interface**, no rodapé, onde a ação do momento mora: com a
      pergunta na tela o compositor e a faixa de voz saem. `Cancelar` vem primeiro no DOM (é o
      que se aperta por reflexo). A confirmação carrega o alvo **e a versão do diagrama**, e se o
      desenho mudou entre o pedido e o clique a remoção é recusada com `diagrama_mudou` (H14).
      Recusa do aluno volta ao modelo como `recusadoPeloAluno: true` — fato, não silêncio.
      ⚠ Duas coisas que o caminho exigiu: o despachante ganhou **teto por ferramenta** (os 8 s
      gerais expiravam a confirmação enquanto a pessoa ainda lia, e o modelo recebia
      `tempo_esgotado` como se fosse falha nossa), e a sessão **responde NÃO ao cair** — promessa
      pendurada prenderia o turno até o teto, com o aluno vendo "pensando" para sempre
- [x] 3.5 Toda escrita por `modeling` — e o teste prova com um dublê do modelador que registra
      cada chamada: só `appendShape`, `createShape`, `connect`, `updateLabel` e `removeElements`.
      É isso que faz o `Ctrl+Z` do aluno alcançar o trabalho do agente
- [x] 3.6 Toda escrita devolve o que mudou — **e lido de volta do registro, nunca presumido**.
      Chamada que não estoura e não muda nada falha com `nada_mudou`: é o jeito mais fácil de o
      instrumento mentir. A linha da tela diz o que mudou com o nome e o id

## 4. Prova

- [x] 4.1 `src/assistant/__tests__/escrita.mjs` (28 casos): desfazer alcança o que o agente
      criou, as quatro recusam num viewer (mesmo com declaração vazada), `diagrama_mudou`,
      recusa do aluno preservando o elemento, e o guarda de que nada toca XML. O dublê é do
      **bpmn-js**, não da nossa camada — porque aqui quem está sob teste inclui `bpmn-api.js`.
      ⚠ **O harness não sabia reprovar** (achado em 2026-11-14 ao escrever estes casos): `report()`
      roda na última linha do arquivo e as promessas de `testAsync` resolvem DEPOIS, então teste
      assíncrono reprovado imprimia o ✖ e o processo saía **0** — e `npm test` encadeia os
      arquivos com `&&`. Todas as provas de escrita são assíncronas: ficavam fora da conta E fora
      do veredito. Consertado com um gancho de saída em `tools/test-harness.mjs`, provado com um
      arquivo que reprova de propósito (exit 1). Resultado que não pode falhar não é prova
- [x] 4.2 **Medido** (2026-11-14, página do modelador): pedido nas palavras do aluno, sem id —
      o agente chamou `criar_elemento`, e `Activity_0xd2gk8` + `Flow_0p25lx7` apareceram **no
      desenho**. Na tela: *"criei task «Receber pedido» depois de «Order received»"*.
      O critério é o elemento no registro, nunca a frase do agente.
      ⚠ **Defeito que só o PRINT pegou** (2026-11-14): a tarefa nascia **anônima** no desenho e o
      agente narrava o nome. `name` passado na criação fica como atributo da FORMA e nunca chega
      ao `businessObject` — que é o que o desenho lê —, e a leitura de volta caía no mesmo
      atributo, então **assinava a mentira**. O nome virou um comando próprio (`updateLabel`, que
      também cria o rótulo externo de evento e gateway) e é conferido no registro: não pegou,
      `nada_mudou`. Custo declarado: criar com nome são dois `Ctrl+Z`. O portão passou a exigir o
      nome **no desenho**, não no retorno da ferramenta
- [x] 4.3 **Medido**: a pergunta apareceu — *"Apagar «Receber pedido» (task) · Activity_0xd2gk8 do
      diagrama?"* —, o compositor saiu da tela, `Cancelar` clicado, **o elemento continua lá**, e
      a linha da ferramenta virou *"não removi «Receber pedido» — você não confirmou"*
- [x] 4.4 **Medido**: *"Não é possível ligar tarefas de pools diferentes com um fluxo de
      sequência. Para conectar elementos em pools distintos, você deve usar um fluxo de
      mensagem."*
      ⚠ **Duas correções no INSTRUMENTO antes de o portão medir o produto**: eu procurava pool e
      tarefa por padrão no id (`/Participant/i`, `/Task/i`), e no diagrama da pizzaria os ids são
      `_6-53` — a varredura achava zero e reprovava o produto por erro meu. Agora a pergunta vai
      nas palavras do aluno e quem acha os ids é o agente, que é como a coisa funciona. E o
      leitor de rótulo lia só o label EXTERNO: tarefa desenha o nome dentro da forma, então a
      criação aparecia sem nome
- [ ] 4.5 Cenário de montagem guiada: descrever um processo em 3 frases e verificar que o diagrama
      ganhou início, ao menos duas tarefas e fim, ligados.
      ✅ **Pré-requisito FECHADO em 2026-11-14.** Com âncora, a vaga sai do evento `autoPlace` do
      bpmn-js — o mesmo que o botão de append do aluno dispara; sem âncora, o elemento cai
      embaixo do que já está desenhado. Omitir a posição caía no `AppendBehavior`, que usa um
      ponto FIXO sem olhar o desenho.
      ⚠ Teto do bpmn-js: a busca de vaga dele só desvia do que está **ligado** à âncora, então
      sobrou um empurrão nosso para a direita — seis passos e desiste, devolvendo a vaga dele.
      ⚠ **Duas correções no INSTRUMENTO antes de ele poder julgar o produto** (a terceira e a
      quarta desta change): (a) `getBBox()` num `<g transform>` devolve a caixa dos FILHOS, sem a
      translação do próprio grupo — todo elemento media (0,0) e "todo mundo sobrepunha todo
      mundo"; é `getBoundingClientRect`. (b) raia e pool são **contêiner**, não vizinho: medido no
      próprio bpmn-js (botão de append do aluno, sem gastar sessão), a tarefa nasce no mesmo
      ponto que a nossa e encosta 3 px na borda da raia de cima, porque raias dividem borda.
      Reprovar isso era reprovar o produto por fazer exatamente o que o bpmn-js faz.
      **Medido com o portão corrigido**: `Activity_039d4gg = "Receber pedido"` no desenho, com o
      nome, e `nasceuPorCimaDe: []`
- [ ] 4.6 `open-items.md` atualizado

## 5. Depois (fora desta change)

- [ ] 5.1 Layout automático quando o agente cria vários elementos de uma vez.
      Um elemento sozinho **já não precisa disto** (2026-11-14): a vaga vem do bpmn-js e o
      empurrão cobre o vizinho solto parado nela. O que resta aqui é dispor **vários** de uma vez,
      e o teto conhecido do empurrão: seis passos para a direita e desiste
- [ ] 5.2 Desfazer em bloco ("desfaça tudo o que você acabou de fazer")
- [ ] 5.3 Sugestão proativa ao abrir um diagrama com problema de modelagem
