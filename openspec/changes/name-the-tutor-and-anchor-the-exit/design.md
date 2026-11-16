# Decisões — N1 a N6

## N1. Um nome de PAPEL, numa fonte só: `Tutor BPMN`

O pedido do dono foi *"está repetido 3 vezes"* + *"deixar mais claro que temos um agente de IA
especializado em ensinar sobre BPMN"*. As duas metades têm a **mesma causa**: a coisa não tinha
nome. Levantamento antes de decidir:

| Onde | O que dizia |
|---|---|
| `tela.js` (selo) | "Modelador BPMN · com um **tutor** dentro" |
| `tela.js` (cartão) | "Conversar com o **tutor** →" |
| `tela.js` (descoberta) | "peça uma introdução ao **tutor**" |
| `widget.js` (alavanca + painel) | "**Ajudante BPMN**" |
| código, em toda parte | `ajudante`, `mountAssistant` |

Três nomes para uma coisa, e o mais visível deles repetido três vezes na mesma tela. Decisão:
**um nome, `Tutor BPMN`**, numa constante só (`src/assistant/identidade.js`), consumida pela tela,
pelo painel e pela alavanca. Dito **uma vez por superfície**, com **uma** frase ao lado que diz o
que ele é: um agente de IA especializado em BPMN que lê o diagrama aberto.

Recusado: **nome próprio humano** (Bia, Theo) — nome de papel comunica a capacidade, nome de pessoa
promete um personagem que este produto não sustenta, e a banca avalia uma ferramenta de ensino.
Recusado: **"IA" no nome** — a orientação de design system (Genesys) é manter "AI" fora do nome da
feature e usar papel; a capacidade entra na descrição, que é exatamente onde o dono pediu clareza.

O código continua dizendo `ajudante`/`assist` nos identificadores: renomear classe CSS e símbolo é
cascata grande sem ganho para quem usa. **Nome de produto e nome de símbolo são coisas diferentes**
— o que o aluno lê vem todo da constante.

## N2. A frase semeada cabe em UMA linha do compositor — 33 caracteres, medidos

O compositor é `height: 42px; resize: none; rows=1`: **uma linha, por desenho**. Medido na página
(1280×860, painel aberto): caixa de **317 px**, `clientHeight` 40.

| Frase | Caracteres | `scrollHeight` | Cabe? |
|---|---|---|---|
| `Quero modelar o MEU processo — vou te descrever` | 47 | 52 | **não** |
| `Vou te descrever o meu processo` | 31 | 40 | sim |
| `Quero montar o meu processo` | 27 | 40 | sim |
| `O que esse processo faz?` | 24 | 40 | sim |

Decisão: **teto de 33 caracteres** para toda frase que o produto escreve no lugar do aluno, com
teste puro que reprova quem passar. A pesquisa de sugestão clicável dá 3–6 palavras e ~20–25
caracteres como regra de bolso (Google/Assistant, shapeof.ai) — e diz, com razão, que **o limite
confiável é o que a sua interface corta**. O nosso corta em 33.

E o `MEU` em maiúscula sai. Ênfase gritada é a forma mais barata de parecer que o produto não
confia em quem lê — e aqui ela estava na frase que o aluno **manda como se fosse dele**.

## N3. A âncora: o caminho de volta é PERMANENTE, e tem um lugar só

O defeito, inteiro: a barra do tutor morre na primeira edição (de propósito), e com ela morria o
único "voltar ao menu". Sobrava o "♻️ Recomeçar" dentro da barra do modelador — que **nasce
recolhida** (`is-collapsed`) e é destrutiva. A diretriz de acessibilidade cognitiva do W3C ("Let
Users Go Back") e o levantamento de onboarding de 2026 convergem: **nunca prender a pessoa num
fluxo sem saída clara**, e manter o controle de volta **na moldura, rotulado e persistente**.

Decisão: uma **âncora** (`montarAncora()`), montada uma vez, que não morre com nada. Clique → o
convite, sem descartar. Fica escondida **por CSS** enquanto o convite está no ar (`body.pv-no-ar`):
você não precisa de um botão para ir onde já está, e isso não custa estado em JS.

**Onde ela mora foi medido, não escolhido por gosto** — os quatro cantos já têm dono:

| | 1280×860 | 375×812 |
|---|---|---|
| paleta do bpmn-js | y60–717, x20–68 | y60–717, x20–68 |
| barra do modelador | y795–846, x14–346 | y747–798, x14–346 |
| simulação | y14–65, **x934–1266** | y14–65, **x29–361** |
| alavanca do tutor | y760–816, x1042–1266 | y681–737, x141–365 |

Em tela larga o **alto à esquerda está livre**, e é onde todo aplicativo põe a marca e o caminho
para casa: a âncora vai para `top: 14px; left: 14px`, com texto. Em 375 px a barra de simulação
ocupa a faixa do alto **inteira** — então ali a âncora encolhe para o ícone e desce para o bolso
livre entre a paleta e a simulação (`top: 76px; left: 76px`). Cada número desses tem uma medição
atrás, e a bateria mede os dois tamanhos: se alguém mexer na simulação ou na paleta, o cenário
reprova em vez de o dono achar o botão embaixo de outra coisa.

## N4. A volta não pode virar uma segunda armadilha

Com a âncora, o convite passa a ser alcançável **com trabalho aberto** — coisa que antes não
acontecia (só se chegava lá descartando). Se ele continuasse opaco e sem saída, a change trocaria
uma porta trancada por outra: a pessoa veria as três opções e nenhuma forma de voltar ao desenho
dela.

Decisão: havendo trabalho salvo, o convite ganha **"⤴ Continuar o que eu estava fazendo"** como
primeira ação, e fecha no **`Esc`**. A pesquisa de 2026 pede o mesmo em uma linha: *um default só
ajuda quando a alternativa continua legível e recuperável.*

## N5. Trocar de trilha com trabalho vivo PERGUNTA antes (constituição §VII)

§VII é literal: *"Ação destrutiva (apagar elemento, **substituir o diagrama**) exige confirmação
explícita na interface antes de executar."* Abrir o exemplo ou a tela em branco **substitui o
diagrama** — e, até esta change, nenhum caminho levava alguém com trabalho vivo até esses botões.
A âncora cria esse caminho; logo, a confirmação passa a ser exigida pela constituição, não por
cautela minha.

Decisão: o cartão **pergunta nele mesmo** — primeiro clique arma por 5 s ("⚠️ Isto substitui o seu
desenho — clique de novo"), segundo clique executa. É o mesmo mecanismo já em pé no "Recomeçar", e
pelo mesmo motivo: **`confirm()` trava a página num ponto que nenhuma prova automática atravessa**,
e confirmação que não dá para provar vale tanto quanto nenhuma.

## N6. A barra do tutor deixa de carregar navegação

Ela tinha "voltar ao menu · ver um exemplo" no rodapé. Com a âncora permanente isso fica **errado
duas vezes**: duplica o caminho de volta, e põe o caminho no elemento que **morre primeiro**. O
dono já havia dito, na rodada anterior, que esses botões *"não ficaram bons onde estão e como
estão"*.

Decisão: a barra fica **só com a sugestão** — que é o que ela faz melhor e o que a pesquisa
sustenta (sugestão ligada ao que está na tela). Navegação é da âncora. Efeito colateral bem-vindo:
morre a causa do aperto de 375 px (era a linha "voltar ao menu" espremida embaixo da alavanca), e
o cenário de geometria da bateria passa a medir a âncora, que é quem agora precisa ser alcançável.

## N7. O visual responde três perguntas em vez de explicar três coisas

A pesquisa de primeira execução é direta: *uma tela, uma ideia, uma ação principal* — "quando uma
tela tenta explicar três coisas, ninguém lê nenhuma" — e a primeira tela deve responder **o que é
isto / como me ajuda / o que eu faço agora**, com a hierarquia conduzindo o olho.

Decisão, nessa ordem: (a) **um** visual, e o único honesto aqui é o próprio objeto do produto — um
mini-diagrama BPMN em **SVG inline** (início → tarefa → fim), que diz o que é isto sem uma palavra
e sem nenhum arquivo novo; (b) o cartão primário vira ação de verdade (fundo, peso, seta), os dois
caminhos secundários ficam visivelmente mais leves; (c) o selo do produto diz o nome **uma vez**.
Zero dependência, zero imagem: SVG inline são oito linhas e escala em qualquer tela.
