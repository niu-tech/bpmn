> Pesquisa de UI/UX com as fontes e o que cada achado decidiu: `research.md`. Decisões: `design.md`
> (G1–G6). Plano: `tasks.md`. Continua `introduce-bpmn-first-run-workspace`, que já está arquivada
> — aquela resolveu **escolher** o caminho; esta resolve **o que acontece depois de escolher**.

## Why

A tela base entregou a escolha e parou ali. Observação do dono (2026-11-16), vendo o produto no ar:

> *"Quando clicamos no exemplo da pizza pela tela inicial, estamos levando o usuário para a tela e
> deixando a tela estática. (…) uma pessoa provavelmente não vai entender muito, precisamos deixar
> claro que ela pode perguntar, que pode clicar nos elementos e perguntar, tudo isso deve estar
> claro em todas as trilhas."*

É o defeito clássico da **caixa em branco**: o produto tem um tutor que lê o diagrama, desenha e
explica, e nada na tela diz isso. Quem escolhe "ver um exemplo" cai num diagrama de pizzaria com um
botão azul no canto, e a chance de descobrir sozinho que dá para clicar numa tarefa e perguntar
sobre ela é baixa.

E o que havia de orientação — a tira com "ver um exemplo · voltar ao menu" — estava no lugar errado
e na forma errada: pousava **em cima do desenho**, não explicava nada e não tinha relação visual
nenhuma com o tutor, que é quem resolve a dúvida.

## What Changes

- **A barra do tutor**, encostada na alavanca do ajudante: diz, em duas linhas, o que dá para fazer
  **naquela trilha**, oferece **uma** sugestão clicável e carrega os caminhos de volta no rodapé.
  Substitui a tira. Não é modal, fecha num clique e não volta na mesma visita.
- **A sugestão segue a seleção.** Clicou numa forma do diagrama? A barra passa a falar dela:
  *"Selecionado: «Assar a pizza»"*, e o botão vira *"Perguntar sobre «Assar a pizza»"*, que abre o
  painel com a pergunta digitada — sem enviar. É o que responde ao *"pode clicar nos elementos e
  perguntar"*.
- **Cada trilha chega com o seu recado.** Exemplo: *"o tutor lê o que está na tela — clique em
  qualquer elemento e pergunte"*. Do zero: *"conte o seu processo em algumas frases e ele desenha
  com você"*. Tutor: o painel já abre com a frase pronta (desde a rodada anterior).
- **A barra sai quando o painel abre**: os dois moram no mesmo canto, e o painel diz as mesmas
  coisas melhor.

## O que esta change NÃO vai fazer

- **Nenhum tour, spotlight ou sequência de "próximo".** A pesquisa é contrária, e com medida: quem
  lê o passo-a-passo acha o produto **mais complicado** do que quem pula (`research.md` §1).
- **Não abre o painel sozinha ao carregar o exemplo, e não pisca a alavanca.** As duas foram
  cogitadas pelo dono, e as duas são interrupção — o que a pesquisa desaconselha. A barra expõe o
  tutor sem tomar a vez de ninguém; o porquê está em `design.md` G2, para a decisão poder ser
  revista com o motivo à mão.
- **Não vira catálogo de exemplos.** Uma sugestão por estado, e ela muda com o contexto. Três
  caminhos focados valem mais que vinte exemplos (`research.md` §2).
- **Não mexe no pedido de chave** (resolvido na rodada anterior) nem no prompt, no catálogo de
  ferramentas ou na política.

## Impact

- Afeta: `src/primeira-vez/tela.js` (a barra no lugar da tira), `primeira-vez.css`, `src/app.js`
  (a ligação com a seleção do canvas) e os cenários de tela base da bateria.
- Não afeta: o painel do ajudante, `/viewer.html`, a simulação, o prompt, as ferramentas.
- Depende de `widget.sugerir()` e do atalho `#exemplo`, que já existem.
