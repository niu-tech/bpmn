> Trilha H do `openspec/roadmap.md`. A ordem é por **risco**, não por tamanho: o bloco 1 roda
> antes da F7 porque é onde um defeito deixa de ser bolha errada e passa a ser desenho errado.
>
> Regra desta change: **todo item vem com os testes de origem**. Portar código sem portar a prova
> deixa o projeto com a prova do autor antigo e o defeito do novo.

## 1. Fundação do turno — antes da F7

- [x] 1.1 **H1 · `RastreadorDeTurnos`** portado para `src/assistant/live/turn-tracker.js`, com os
      testes junto (`__tests__/turnos.mjs`, 7 casos: 3 da cápsula, 4 deste projeto — a pergunta
      picada e a convivência de delta com cumulativo)
- [x] 1.2 **H1 · lado da ENTRADA ligado**: a fala do aluno vira UMA bolha que cresce, e quem a fecha
      é sinal do servidor (primeiro áudio/legenda do modelo, ou turno fechado), nunca um relógio.
      Provado ao vivo: `bolhasDeFala: 1`, frase inteira, modelo respondeu
- [ ] 1.3 **H1 · prender evento ao turno**: o `session.js` passa a perguntar ao rastreador de quem é
      cada quadro, em vez de `turnoLocal(null) → turno mais recente`. Remove as duas heurísticas de
      13/11 (`audioFrames > 0` e a legenda emprestada)
- [ ] 1.4 **H1 · uma execução por `{turno, chamada}`** no despacho de ferramenta, com o resultado
      memorizado. Prova: a mesma chamada repetida numa reconexão **não** executa de novo
- [x] 1.5 **H11 · injeção de fala no nível da sessão** — `__bpmnAssist.injetarFala` + `pararMicrofone`
      e `tools/injetar-fala.mjs` (lê o WAV, corta em quadros de 40 ms, injeta no ritmo real, com
      cauda muda para o VAD fechar o turno). Provado ao vivo: 221 quadros, `ouviu` = a frase exata,
      `bolhasDeFala: 1`, modelo respondeu — **sem o microfone falso do navegador**.
      ⚠ A primeira corrida saiu suja (injetou com status `conectando`, o microfone automático abriu
      depois e o servidor transcreveu o tom como *"mhm"*): o passo agora espera `pronto`, fecha o
      microfone e **recusa injetar** se ele continuar aberto. Mantém-se um cenário no caminho real
- [ ] 1.6 **H4 · barge-in por nível local** enquanto o modelo fala, tirando o teste da calibração de
      silêncio da fixture (que já envelheceu: 16 s calibrados, modelo falando aos 12,3 s)

## 2. Honestidade do que aparece

- [ ] 2.1 **H2 · canais separados**: o que soa como máquina vai para a tela. Guard: nenhuma resposta
      falada contém id de elemento, caminho ou chave de citação
- [ ] 2.2 **H3 · apresentador de resultado**: `content` completo para o modelo, `details` redigido no
      cliente, `render` em uma linha. `buscar_elemento` vira "procurei no diagrama inteiro — 3 de 47"
- [ ] 2.3 **H6 · estado tipado + medidor**: estados nomeados com guardas, selo na UI e o nível
      desenhando no compositor
- [ ] 2.4 **H7 · contrato na interface**: a tela diz o que o agente pode e o que depende do aluno.
      Entra **junto** da F7, não depois

## 3. Fundação do prompt e da memória

- [ ] 3.1 **H8 · orçamento e diagnóstico do prompt**, e com ele a medição do teto do quadro de
      contexto — a tarefa 2.4 do harness, que nunca rodou
- [ ] 3.2 **H9 · idioma por preferência** do aluno, tirando o idioma da prosa do prompt
- [ ] 3.3 **H10 · memória com escopo e consolidação**, pré-requisito do tutor da F8

## 4. Evidência

- [ ] 4.1 **H5 · ledger de conversa no harness** — só conteúdo final, sem parciais e sem áudio, com
      a invariante no esquema. Cada corrida da bateria vira registro citável
- [ ] 4.2 **H12 · inventário de dependências** fixadas, com licença declarada, no modelo do
      `INVENTORY.md` da cápsula

## 5. Fechamento

- [ ] 5.1 Bateria ao vivo completa depois do bloco 1, com o número relatado como ele for
- [ ] 5.2 `openspec/roadmap.md` e `openspec/open-items.md` atualizados no MESMO change
- [ ] 5.3 Peça visual do plano atualizada e entregue ao dono (regra do `CLAUDE.md`)
