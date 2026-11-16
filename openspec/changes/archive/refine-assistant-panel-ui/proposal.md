## Why

O dono olhou a janela e disse, duas vezes: *"ainda tá ruim"*. Encomendou então uma **pesquisa
visual** a um segundo trabalho, com os prints atuais e a referência que ele gosta. O retorno veio, e
o diagnóstico dele é mais duro — e mais útil — que o meu:

> *"o painel atual é funcional, mas a interface ainda parece um conjunto de controles técnicos de
> teste"*

E a frase que organiza esta change inteira:

> *"A mudança mais importante não é escolher um azul mais bonito ou aumentar os cantos
> arredondados. É reduzir a interface a **uma ação principal por estado**."*

Isso explica por que as rodadas anteriores não resolveram: eu vinha **somando** controles honestos
(selo, medidor, linha de ferramenta, contrato, microfone, enviar) sem nunca perguntar qual deles é
o principal **naquele momento**. O resultado é um painel que mostra tudo e não orienta nada.

## What Changes

A ordem é a da pesquisa, que é por impacto e não por tamanho.

**Estrutura — uma ação principal por estado.**

- **Launcher único.** O botão azul continua visível com o painel aberto: dois pontos de entrada
  para a mesma coisa. Aberto ⇒ o launcher some.
- **Nada de "Enviar" sem mensagem para enviar.** Em voz aparecem, juntos, medidor + parar vermelho
  + Enviar azul. O compositor de texto e os controles de voz passam a ser **mutuamente exclusivos**.
- **`Encerrar` sai do seletor.** Ele está lado a lado com `Texto` e `Voz`, misturando *modo de
  entrada* com *fim de sessão*, e com o mesmo peso visual. Vai para um menu secundário.
- **Menos regiões.** Chave, instrução, dica, diagnóstico, estado e contrato fragmentam o painel na
  vertical. Consolidar, e deixar o diagnóstico recolhido.

**Estados — o vermelho é de erro, não de escuta.**

- Escuta em **verde-azulado**; vermelho só para erro e para a ação de encerrar;
- a tabela de estados da pesquisa (ocioso · conectando · ouvindo · processando · consultando ·
  falando · reconectando · erro), cada um com a frase que o aluno lê;
- *"pode interromper falando"* só aparece quando o barge-in está de fato disponível — se o produto
  caiu em meia-duplex por suspeita de eco, a frase passa a ser outra.

**Legibilidade.** Corpo 14–15 px, metadados 12–13 px, nunca abaixo de 12. Escala de espaçamento
4/8/12/16/24. Foco visível em tudo que recebe foco, e `prefers-reduced-motion` respeitado.

**Primeira utilização (BYOK).** Introdução curta com uma ação primária, consentimento **não**
pré-marcado, e um aviso que hoje não existe: a chave viaja na URL do WebSocket e **aparece nas
ferramentas de rede** — "só em memória" não quer dizer invisível.

## Impact

- **Código:** `src/assistant/ui/widget.js` e `ui/assistant.css` (a maior parte), `session-manager.js`
  (os estados nomeados), `layout.js` (geometria).
- **Harness:** os cenários dirigem por `Começar`, `Voz`, `Enviar` e por `.bpmn-assist__*`. Esses
  nomes **ficam**: redesenhar a tela não pode derrubar a prova junto.
- **⚠ O piso de 44 px no rodapé é de LICENÇA** (marca d'água do bpmn.io, K-G). A geometria nova
  respeita isso ou o trabalho não pode ser publicado.

## O que NÃO vem da pesquisa

- **Indicador de etapas 1-2-3-4**: a própria pesquisa descarta — pergunta de BPMN é aberta, não há
  sequência fixa. Já tínhamos chegado nessa conclusão sozinhos;
- **cartões clicáveis**: decisão do dono, depois da F7;
- **modo lateral fixo** (Zendesk/Notion): é redesenho do produto inteiro, não do painel;
- **tokens efêmeros** no lugar da chave na URL: muda o transporte, e a pesquisa diz explicitamente
  que não validou. Fica como item de segurança, não como tarefa desta change.
