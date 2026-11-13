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

- [ ] 3.1 `criar_elemento` — tipo, nome, âncora e direção; posição calculada a partir da âncora
- [ ] 3.2 `conectar` — sequência ou mensagem; valida existência dos dois lados e a regra de pools
- [ ] 3.3 `renomear`
- [ ] 3.4 `remover` — **confirmação na interface** antes de executar; recusa devolve resposta ao
      modelo. A confirmação carrega `id` **e versão do diagrama**: se o diagrama mudou entre o
      pedido e o clique, recusa com `diagrama_mudou` (H14)
- [ ] 3.5 Toda escrita por `modeling`; guarda que falha se alguma ferramenta tocar XML
- [ ] 3.6 Toda escrita devolve o que mudou, para o agente narrar ao aluno

## 4. Prova

- [ ] 4.1 Teste: desfazer remove o que o agente criou
- [ ] 4.2 Bateria AO VIVO: "crie uma tarefa chamada Receber pedido depois do evento de início" →
      verificar no registro que a tarefa existe e está conectada
- [ ] 4.3 Bateria AO VIVO: pedir remoção e **não** confirmar → elemento continua lá
- [ ] 4.4 Bateria AO VIVO: pedir fluxo de sequência entre pools → agente explica que é mensagem
- [ ] 4.5 Cenário de montagem guiada: descrever um processo em 3 frases e verificar que o diagrama
      ganhou início, ao menos duas tarefas e fim, ligados
- [ ] 4.6 `open-items.md` atualizado

## 5. Depois (fora desta change)

- [ ] 5.1 Layout automático quando o agente cria vários elementos de uma vez
- [ ] 5.2 Desfazer em bloco ("desfaça tudo o que você acabou de fazer")
- [ ] 5.3 Sugestão proativa ao abrir um diagrama com problema de modelagem
