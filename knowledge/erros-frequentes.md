---
sourceId: erros-frequentes
title: Erros frequentes — o que mais aparece em diagrama de aula
group: modelagem
tags: [erro, defeito, revisão, correção]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:os-cinco -->
Localizador: Erros › os cinco mais comuns
Citação: [fonte:erros-frequentes:os-cinco]

(1) Fluxo de **sequência** entre pools diferentes — ali só cabe mensagem. (2) Abrir em **paralelo**
e fechar em **exclusivo**, deixando ramos órfãos. (3) Saída de gateway exclusivo **sem condição**
e sem caminho padrão. (4) Tarefa com nome de substantivo solto ("Pedido"), que não diz o que se
faz. (5) Vários eventos de início no mesmo processo sem motivo — cada início é um gatilho
diferente, não um ponto de entrada qualquer.
<!-- /chunk -->

<!-- chunk:como-achar -->
Localizador: Erros › como procurar
Citação: [fonte:erros-frequentes:como-achar]

Três varreduras pegam a maior parte: procure **elementos sem ligação**; percorra cada caminho do
início até um fim e veja se algum morre no meio; e confira se **cada gateway que abre tem o par
que fecha**, do mesmo tipo. Depois disso, leia o diagrama em voz alta como uma história — o que
soar estranho falado costuma estar errado desenhado.
<!-- /chunk -->
