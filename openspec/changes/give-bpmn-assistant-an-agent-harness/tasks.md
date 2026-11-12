## 1. Contrato de prompt

- [ ] 1.1 `src/assistant/agent/sections.js` — registro ordenado de seções com `{id, titulo, tier,
      render}`; identidade, domínio BPMN, recusa, política de ferramentas, diagrama, memória
- [ ] 1.2 `src/assistant/agent/resolve.js` — o ÚNICO leitor de estado (modo, página, diagrama,
      memória, política); devolve objeto puro
- [ ] 1.3 `src/assistant/agent/render.js` — renderizador puro, com orçamento por seção e corte
      declarado no texto
- [ ] 1.4 `protocol.js`: `buildSetup` passa a receber o prompt pronto; `SYSTEM_INSTRUCTION` e
      `DELIVERY_INSTRUCTION` saem de constantes de módulo para seções do registro
- [ ] 1.5 Testes `.mjs`: mesma prosa em voz e texto, ordem estável antes de volátil, render
      determinístico, orçamento com corte declarado

## 2. Quadro de contexto

- [ ] 2.1 `src/assistant/agent/frame.js` — monta o quadro e o delta entre dois quadros
- [ ] 2.2 `session.js`: semear com `buildHistory` (que já existe e nunca foi usado em produção)
      logo após `setupComplete`; enviar delta antes de cada turno digitado
- [ ] 2.3 Trocar de modo reconstrói contexto e histórico resumido; o aviso de perda some quando a
      reconstrução está ativa
- [ ] 2.4 **Medir o teto do `clientContent`**: payload crescente até o servidor recusar, e
      registrar o número em `design.md`. Sem isso o semeador é uma aposta

## 3. Contexto do diagrama

- [ ] 3.1 `src/assistant/agent/diagram.js` — projeção a partir do `elementRegistry`: processo,
      contagem por tipo, raias/pools, amostra com teto, selecionado
- [ ] 3.2 `mount.js` assina `selection.changed` e `elements.changed` do `eventBus` e mantém a
      projeção fresca, sem recalcular a cada frame
- [ ] 3.3 Perfil `viewer`: `somenteLeitura: true` e nenhuma ferramenta de escrita declarada
- [ ] 3.4 Guarda: nenhum frame enviado contém `<bpmn:definitions`

## 4. Memória da aba

- [ ] 4.1 `src/assistant/agent/memory.js` — `fato` | `decisao` | `preferencia`, com origem,
      carimbo, teto por categoria e descarte do mais antigo
- [ ] 4.2 Entrada na memória vem de ferramenta declarada (`lembrar`), não de heurística sobre o
      texto do aluno
- [ ] 4.3 **Medir se declarar ferramenta emudece o modo voz.** O P1 mediu que
      `entregar_resposta` deixa o modelo mudo; é preciso saber se vale para QUALQUER função ou
      só para aquela. O resultado decide se voz tem ferramenta nesta rodada
- [ ] 4.4 Testes: preferência vale no turno seguinte; teto respeitado; recarregar zera

## 5. Guardrails e catálogo

- [ ] 5.1 `src/assistant/agent/catalog.js` — declarações; `policy.js` — permitido por perfil,
      default-deny
- [ ] 5.2 Despacho: nome fora da política devolve erro nomeado e registra no diário, sem executar
- [ ] 5.3 `toolResponse` para toda `toolCall`, inclusive recusada e repetida
- [ ] 5.4 Guarda mecânica: varredura que falha se aparecer decisão de ferramenta por palavra-chave
- [ ] 5.5 Cenários na bateria: recusa fora do domínio; pergunta de BPMN aplicada a outro assunto
      NÃO recusada; elemento inexistente reportado como ausente

## 6. Prova

- [ ] 6.1 Bateria: cenário AO VIVO que pergunta sobre o diagrama aberto e exige número real
- [ ] 6.2 Bateria: cenário AO VIVO que troca de modo e exige continuidade
- [ ] 6.3 `npm test` verde; bateria verde contra a URL pública
- [ ] 6.4 `open-items.md` atualizado com o que esta change fechou e o que ela abriu
