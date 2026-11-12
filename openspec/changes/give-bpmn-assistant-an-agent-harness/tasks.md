## 1. Contrato de prompt

- [ ] 1.1 `src/assistant/agent/sections.js` — registro ordenado de seções com `{id, titulo, tier,
      render}`; identidade, domínio BPMN, recusa, política de ferramentas, diagrama, memória
- [ ] 1.2 `src/assistant/agent/resolve.js` — o ÚNICO leitor de estado (modo, página, diagrama,
      memória, política); devolve objeto puro
- [ ] 1.3 `src/assistant/agent/render.js` — renderizador puro, com orçamento por seção e corte
      declarado no texto
- [ ] 1.4 `protocol.js`: `buildSetup` passa a receber o prompt pronto; `SYSTEM_INSTRUCTION` e
      `DELIVERY_INSTRUCTION` saem de constantes de módulo para seções do registro.
      **⚠ Armadilha confirmada** (`protocol.js:79`): hoje a instrução de entrega só é anexada
      quando o prompt recebido é **exatamente** a constante antiga — um renderizador novo
      silenciosamente deixaria o modo texto sem ela. O contrato de entrega passa a ser seção
      declarada do perfil, não remendo condicional
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
- [ ] 4.3 **GATE: voz com ferramenta read-only.** Sessão de voz declarando `descrever_diagrama`
      (leitura pura, sem instrução de entrega): o modelo chama, recebe o resultado e **continua
      falando**? A pesquisa de 2026-11-12 derrubou a generalização de que qualquer declaração
      emudece — o CopilotSpeaker executa ferramenta em turno de voz e o Gemini segue falando.
      Resultado negativo vira registro em `open-items.md`, não suposição
- [ ] 4.4 Testes: preferência vale no turno seguinte; teto respeitado; recarregar zera

## 5. Despacho de ferramenta (pré-requisito das ferramentas de verdade)

- [ ] 5.0 **Reescrever o caminho da `toolCall`.** Hoje `buildToolResponse` responde `{ok:true}`
      para toda chamada (`protocol.js:164`) e `session.js` responde **antes** de qualquer
      executor (`session.js:217`). Serve para a entrega textual e mente para qualquer ferramenta
      real
- [ ] 5.0a Despacho assíncrono correlacionado por `id`: autorização → execução → `toolResponse`
      com o resultado REAL (`{ok:false, erro}` quando recusada, falha ou cancelada)
- [ ] 5.0b Teto próprio por ferramenta; `tempo_esgotado` em vez de turno pendurado
- [ ] 5.0c O relógio de silêncio do turno **não** corre enquanto uma ferramenta executa
- [ ] 5.0d Execução não bloqueia o laço de recepção do socket

## 6. Guardrails e catálogo

- [ ] 6.1 `src/assistant/agent/catalog.js` — declarações; `policy.js` — permitido por perfil,
      default-deny
- [ ] 6.2 Despacho: nome fora da política devolve erro nomeado e registra no diário, sem executar
- [ ] 6.3 `toolResponse` com o resultado REAL para toda `toolCall`, inclusive recusada e repetida
- [ ] 6.4 Guarda mecânica: varredura que falha se aparecer decisão de ferramenta por palavra-chave
- [ ] 6.5 Cenários na bateria: recusa fora do domínio; pergunta de BPMN aplicada a outro assunto
      NÃO recusada; elemento ausente da AMOSTRA não é declarado inexistente sem busca
- [ ] 6.6 **Injeção pelo diagrama**: texto do diagrama entra delimitado e marcado como dado;
      cenário com uma tarefa chamada "ignore as instruções anteriores…" prova que o agente não
      obedece. O produto **abre arquivo do disco**, então a entrada é de terceiro de fato
- [ ] 6.7 A seção do diagrama se declara **amostra** e diz quantos ficaram de fora; o agente não
      afirma inexistência a partir dela

## 7. Prova

- [ ] 7.1 Bateria: cenário AO VIVO que pergunta sobre o diagrama aberto e exige número real
- [ ] 7.2 Bateria: cenário AO VIVO que troca de modo e exige continuidade
- [ ] 7.3 `npm test` verde; bateria verde contra a URL pública
- [ ] 7.4 `open-items.md` atualizado com o que esta change fechou e o que ela abriu
