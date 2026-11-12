## 0. Pré-requisito

- [ ] 0.1 `give-bpmn-assistant-an-agent-harness` implementada: catálogo, política default-deny,
      despacho com erro nomeado e contexto do diagrama. Sem isso, cada ferramenta aqui nasceria
      sem portão

## 1. Acesso à página

- [ ] 1.1 `app.js` entrega o `modeler` ao ajudante; `viewer.js` entrega o `viewer` marcado como
      somente leitura. Nenhum dos dois expõe o objeto globalmente
- [ ] 1.2 Uma camada fina sobre o bpmn-js (`src/assistant/tools/bpmn-api.js`) com o que as
      ferramentas usam — `elementRegistry`, `modeling`, `elementFactory`, `bpmnFactory`,
      `canvas`, `selection` — para que o dublê de teste tenha superfície pequena

## 2. Leitura

- [ ] 2.1 `descrever_diagrama` — processo, contagem por tipo, raias e pools
- [ ] 2.2 `buscar_elemento` — por nome (sem diferenciar acento/caixa) e por tipo; devolve lista
      com teto e diz quando cortou
- [ ] 2.3 `detalhar_elemento` — tipo, nome, entradas e saídas de um `id`
- [ ] 2.4 `resumir_simulacao` — última corrida: tempo médio, gargalo, utilização por raia; diz
      "sem corrida" quando não houver
- [ ] 2.5 Testes com dublê de `elementRegistry`, incluindo busca sem resultado

## 3. Escrita (só modelador)

- [ ] 3.1 `criar_elemento` — tipo, nome, âncora e direção; posição calculada a partir da âncora
- [ ] 3.2 `conectar` — sequência ou mensagem; valida existência dos dois lados e a regra de pools
- [ ] 3.3 `renomear`
- [ ] 3.4 `remover` — **confirmação na interface** antes de executar; recusa devolve resposta ao
      modelo
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
