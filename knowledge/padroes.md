---
sourceId: padroes
title: Padrões comuns — formas que se repetem
group: modelagem
tags: [padrão, aprovação, prazo, exceção, retrabalho]
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:aprovacao -->
Localizador: Padrões › aprovação com retrabalho
Citação: [fonte:padroes:aprovacao]

Tarefa de análise, gateway exclusivo com duas saídas ("aprovado" e "ajustes necessários"), e a
saída de ajustes voltando para a tarefa que produziu o material. É o laço mais comum em processos
de negócio. Duas cautelas: nomeie as duas saídas, e pense em como o laço termina — "volta para
corrigir" sem limite é um processo que, no papel, pode não acabar.
<!-- /chunk -->

<!-- chunk:prazo -->
Localizador: Padrões › espera com prazo
Citação: [fonte:padroes:prazo]

Para "esperar a resposta, mas no máximo X", há duas formas boas: um **gateway baseado em
eventos** com duas saídas (mensagem de resposta e temporizador), ou uma tarefa de recebimento com
**evento de borda** de temporizador. A primeira deixa a espera explícita no fluxo; a segunda
mantém o caminho principal mais limpo. As duas dizem a mesma coisa — escolha pela leitura.
<!-- /chunk -->
