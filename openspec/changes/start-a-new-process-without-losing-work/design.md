# Decisões — começar do zero sem perder o que está na tela

## N1 — A pergunta tem TRÊS respostas, não duas

Quando há trabalho na tela e alguém pede folha limpa:

> **Começar um processo do zero?** O que está desenhado agora sai da tela — e ele vive só nesta
> aba, não fica guardado em lugar nenhum.
> `Baixar e começar` · `Começar sem baixar` · `Cancelar`

**Por que três.** Sim/não transforma "quero desenhar o meu processo" numa aposta: a pessoa que
hesita cancela e fica presa no exemplo. A terceira resposta é o pedido literal do dono — *"abrir
para perguntar se ele quer salvar, caso sim a gente abra para salvar, caso não ele descarta"*.

⚠ **Alternativa recusada: guardar sozinho, sem perguntar** (um autosave do diagrama anterior).
Guardar o que a pessoa não pediu é decidir por ela, e aqui esconderia o fato que mais importa
contar: o desenho vive na aba. O produto prefere dizer a verdade uma vez a guardar silenciosamente
para sempre.

## N2 — Guardar é BAIXAR, nunca servidor

`Baixar e começar` exporta o `.bpmn` pelo mesmo `saveXML` que o modelador já usa e entrega o
arquivo. Sem conta, sem nuvem, sem backend — o produto inteiro é estático e BYOK (§ do MVP).

**O arquivo é do aluno**: abre no Camunda, no bizagi, em qualquer ferramenta BPMN, e continua
existindo se este site sumir. É a única forma de "guardar" que não cria uma promessa que a gente
não pode manter.

## N3 — A folha limpa já vem com o começo

O diagrama novo nasce com **um evento de início**, como o `diagram.bpmn` do modelador hoje — não
com o canvas vazio.

**Por quê:** a pesquisa da `guide-the-first-run-trails` mediu que caixa em branco esconde o que o
produto sabe fazer. E tem um motivo mecânico: `criar_elemento` sem âncora precisa de um lugar que
as regras aceitem, e o aluno que diz *"põe receber pedido"* na folha vazia recebe uma recusa em
vez de um desenho. Com o início lá, o primeiro `depoisDe` funciona.

## N4 — O verbo existe para o agente, com o portão de sempre

`comecar_do_zero` entra no catálogo **com `escreve: true` e portão de confirmação**, exatamente
como `remover`: a ação fica recusada (`falta_confirmacao`) até o aluno responder DEPOIS da
pergunta, com a janela de uma fala (a regra de ordem da `spoken-confirmation-gates`).

⚠ Nada de detectar *"começar do zero"* no texto: o modelo escolhe a ferramenta (§III). O que o
código faz é **recusar até haver resposta**, que é gate de segurança e não despacho.

## N5 — Onde a trilha fica na tela

A âncora permanente (que a `name-the-tutor-and-anchor-the-exit` colocou) ganha a terceira saída,
ao lado de *"voltar ao menu"* e *"continuar o que eu estava fazendo"*: **"começar do zero"**.

**Por que ali e não no convite:** o convite é a escolha de trilha de quem chega; esta é a escolha
de quem **já está trabalhando** e mudou de ideia. São momentos diferentes, e misturá-los traz de
volta o problema que a âncora resolveu — o caminho de volta que morria na primeira edição.

⚠ **Alternativa recusada: reaproveitar o "Recomeçar" da barra do modelador.** Ele nasce recolhido,
é destrutivo sem pergunta e vive numa barra que não é nossa. Deixá-lo como está e não citá-lo é
mais honesto que embrulhá-lo.

## N6 — O que o portão mede

- com trabalho na tela, pedir folha limpa **pergunta** e **não apaga nada** antes da resposta;
- `Cancelar` deixa o desenho **idêntico** (contagem de formas e ligações antes e depois);
- `Começar sem baixar` deixa a tela com **um** elemento (o início), não com zero;
- `Baixar e começar` entrega um arquivo que **volta a abrir** (parse do XML exportado);
- por voz, a ordem é a mesma de `remover`: recusa, o aluno responde, e só então limpa.

⚠ Princípio XIII: medir *"não sobrou nada do desenho velho"* contando zero aprova um canvas que
nunca desenhou. O portão afirma **antes** que havia 57 formas e **depois** que há uma.
