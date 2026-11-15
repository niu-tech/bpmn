> **O 1.1 é de três linhas e é o item mais barato de todo o roadmap.** O resto desta change é
> medição: ela não muda o que o agente faz, muda o que a gente sabe sobre o que ele faz.

## 1. A conversa longa não pode ser cortada

- [x] 1.1 `contextWindowCompression: { slidingWindow: {} }` no `buildSetup`, com o comentário do
      motivo (ao encostar no teto de contexto o servidor ENCERRA a sessão) e o porquê do `{}`
      vazio — declarar número seria chutar um teto que a documentação não fixa.
- [x] 1.2 Teste de protocolo: o frame de `setup` tem a compressão, nos dois perfis.
- [x] 1.3 Sessão simulada de 40 turnos pelo dublê: **uma sessão só** (nada reabriu no meio), estado
      `pronto` no fim, as 40 respostas na tela e o diagrama ainda no contexto. Irmão: o histórico
      que viaja para uma sessão nova tem teto de 12 turnos — conversa longa não vira transcrição.

## 2. Teto de sessão, pela cota do aluno

- [x] 2.1 `TETO_DA_SESSAO_MS` = 25 min, com o motivo escrito: a sessão cobra enquanto EXISTE, não
      enquanto é usada, e a chave é do aluno. Por tempo total e não por inatividade de propósito —
      errar o que conta como atividade derruba quem está pensando.
- [x] 2.2 Ao encostar, encerra de verdade (socket fechado) e a conversa recebe a nota: por que
      encerrou, que a conversa continua ali, e como recomeçar.
- [x] 2.3 Teste com teto injetado: acima do teto encerra com `state.teto-da-sessao` no diário e o
      aviso na tela; abaixo, não encerra.

## 3. O número da cota (fecha T16 / M7)

- [x] 3.1 `tools/medir-cota.mjs`: abre sessões de verdade com o MESMO setup do produto e registra
      cada uma (aceita/recusada, código de fechamento, tempo). Três experimentos: sequencial sem
      pausa, com pausa crescente, e concorrentes.
- [x] 3.2 **Medido e escrito em `open-items.md` (M7/T16):** o limite **não é de cadência**. Seis
      sessões seguidas sem pausa e quatro simultâneas foram todas aceitas (~0,5–1,1 s cada).
      Ordem de grandeza medida ao vivo: um turno de texto com o diagrama no contexto custa
      5,7 k–7,6 k tokens, e cresce a cada turno.

      ⚠ **CORRIGIDO em 2026-11-15 à noite — a conclusão "é consumo" era um pulo.** Derrubar
      cadência não prova consumo, e a corrida de 33 perguntas mostrou o contrário: recusa na
      **admissão** alternando com sucesso no MESMO minuto, o que consumo não explica. É **vaga de
      sessão** (o plano gratuito limita quantas Live cabem de uma vez por projeto; a vaga de um
      fio que morre sem o quadro de fecho demora para voltar) — e a causa de ter aparecido aqui
      era NOSSA: o harness matava o navegador, então nenhuma das 33 sessões era fechada.
      `drive-page.mjs` passou a fechar a sessão antes de matar o navegador
      (`window.__bpmnAssist.encerrar()`).
- [x] 3.3 A tela parou de mentir — duas vezes. O rótulo era *"a cota da sua chave acabou ou há
      sessões demais"*, virou *"passou do consumo permitido neste minuto"* e, com a correção de
      3.2, virou **"o limite de sessões da sua chave foi atingido — espere alguns segundos e
      comece de novo"**. Fechar aba voltou ao recado (cada aba segura uma vaga), e "volte em X
      segundos" segue fora: o número não é publicado nem foi medido.
- [x] 3.4 Teste do recado: o rótulo não afirma mais o que era falso, e a frase cita consumo e o
      verbo que resolve.

## 4. Latência por turno

- [x] 4.1 Fechamento de turno no diário com os quatro instantes: `ouviu` (a transcrição da fala
      voltou), `primeira` (a primeira coisa que o aluno vê ou ouve), `audio` + `janela` (quando a
      fala começou e quanto durou a chegada dela — é aqui que fala picotada aparece) e `total`.
- [x] 4.2 `npm run trilha` imprime uma linha por turno (`state.turno-fechado n=… ouviu=… …`) e o
      resumo com a **mediana** (não a média: um turno travado estraga a média e não muda o que o
      aluno sente). O JSON de `capturar()` guarda os números por turno.
- [x] 4.3 Teste do cálculo com carimbos sintéticos (relógio injetável, nenhuma rede): os quatro
      números batem (400 / 1500 / 900 / 2700 ms), e o turno digitado devolve `ouviuMs: null` em
      vez de inventar um número bonito.

## 5. Custo por turno

- [x] 5.1 `usageMetadata` lido e somado por turno (entrada, saída, total, nº de turnos).
- [x] 5.2 A trilha mostra o acumulado da sessão (`custo: 29000 tokens em 25 turno(s)`), e o
      relatório do aluno também — o acumulado, não o último turno, que é a pergunta que ele faz.
- [x] 5.3 Teste: o frame de uso **não** abre turno, não fecha turno e não conta como resposta.

## 6. Portão

- [x] 6.1 `npm test` verde (633 asserções).
- [x] 6.2 `tools/aula-simulada.mjs`: 25 turnos pelo dublê, uma sessão só, diagrama ainda no
      contexto no fim, 29 000 tokens acumulados, mediana de turno 0,2 s — salvo em
      `artifacts/sessoes/aula-simulada-<carimbo>.json` e relido por `trilha --de`.
- [x] 6.3 Trilha AO VIVO curta (o vídeo do caminho feliz, 3 turnos contra o Gemini de verdade):
      `n=1 primeira=2,7 s total=2,7 s tokens=5713`, `n=2 2,2 s / 6748`, `n=3 1,3 s / 7620`, com o
      último `turn-complete` aos 12,4 s — batendo com o relógio de parede da gravação.
