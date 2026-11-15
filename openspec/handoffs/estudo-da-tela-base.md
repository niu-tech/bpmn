# Handoff — estudo da tela base (a primeira vez de quem chega)

> **Para que serve este arquivo.** Abrir uma conversa NOVA só para este estudo, sem o histórico da
> sessão de hoje. Tudo o que ela precisa saber está aqui. Última atualização: 2026-11-15.

## O pedido, nas palavras do dono

> *"A gente está sempre abrindo com um exemplo de pizza. A gente poderia deixar isso melhor, por
> exemplo, ter uma introdução ali, uma tela base, e nessa tela base a gente tivesse esse diagrama
> como um exemplo de diagrama, mas a gente tivesse mostrando para o usuário que a partir dali ele
> pode criar o diagrama dele e pode usar, por exemplo, o próprio ajudante para iniciar esse
> processo, de forma que ele pode descrever o processo dele e o agente vai ajudar ele."*

E, sobre o método:

> *"Para fazer essa tela base, a gente vai fazer um estudo maior… e também ter uma referência
> visual, não fazer do zero assim."*

## O produto, em cinco linhas

Ajudante de BPMN que vive **dentro** de um modelador bpmn-js (`https://bpmn.io` embutido na
página). Ele **lê o diagrama aberto**, conversa em português por **voz ou texto** (Gemini Live) e
**desenha junto**: cria, liga, move, renomeia, alinha e apaga — e pergunta antes de apagar. É o
TCC do dono; o repositório é `C:\Users\kaios\source\repos\bpmn`, branch **main**.

**Restrições que não se negociam:**

- **BYOK.** Cada aluno informa a **própria** chave do Google AI Studio. Não existe chave do
  projeto em lugar nenhum — nem no bundle, nem em variável de build, nem em doc, nem em print.
- **Sem backend.** Tudo roda no navegador; a chave vive só na memória da aba.
- **A conversa é o produto.** Qualquer tela nova divide espaço com o painel do ajudante (hoje um
  painel flutuante à direita, ~380 px).

## O que JÁ existe (não refazer)

Entregue hoje, 2026-11-15 — veja antes de propor qualquer coisa:

| onde | o que é |
|---|---|
| `src/assistant/ui/widget.js` → `const convite` | a tela da chave: diz o que o produto é, que a chave é gratuita, link para pegá-la, e só então o campo |
| `src/assistant/ui/widget.js` → `const empty` | a conversa vazia: "Converse com o seu diagrama", o que ele faz em duas linhas, **quatro exemplos clicáveis** e a linha "o diagrama aberto é um exemplo" |
| `artifacts/e2e-shots/boas-vindas*.png` | prints dos dois estados |

Ou seja: o **painel** já se apresenta. O que falta é a **página** — o momento em que alguém abre
o site e vê uma pizzaria pronta sem saber por quê.

## As perguntas do estudo

1. **O que a pessoa vê nos primeiros 5 segundos?** Hoje: um diagrama de pizzaria em inglês, com
   dois pools, e um botão de ajudante no canto. Ela não sabe se aquilo é dela, se é exemplo, se
   pode mexer, nem que dá para falar com ele.
2. **Como oferecer os três caminhos sem transformar a tela num menu?**
   - *"me mostra como funciona"* → o exemplo guiado (a pizzaria serve);
   - *"quero começar do zero"* → tela em branco, e o ajudante puxa conversa;
   - *"vou descrever o meu processo"* → **o caminho novo**: a pessoa fala/escreve o processo dela
     e o agente modela junto, passo a passo.
3. **Onde isso mora?** Tela cheia antes do modelador? Faixa sobre o canvas? Estado vazio do
   próprio canvas? Cada opção tem custo: a tela cheia atrasa quem já sabe o que quer; a faixa
   compete com a barra de ferramentas do bpmn-js; o canvas vazio exige decidir o que fazer com o
   exemplo.
4. **O exemplo continua existindo?** Se a pessoa escolhe começar do zero, a pizzaria some — e com
   ela a chance de aprender por imitação. Há meio-termo (abrir em branco com um link "ver um
   exemplo")?
5. **E a chave?** Hoje ela é pedida dentro do painel. Numa tela base, pedir antes de mostrar valor
   é o erro que acabamos de corrigir no painel — não repetir.

## Referências visuais (obrigatório antes de desenhar)

Não desenhar do zero. Colher referências, mostrá-las ao dono e **só então** propor:

- **bpmn.io / Camunda Modeler** — como o próprio ecossistema recebe quem chega (bpmn.io abre um
  diagrama de exemplo, o Camunda Modeler abre em branco com um painel de boas-vindas);
- **Miro, Whimsical, FigJam** — templates e "comece do zero vs. use um modelo", que é exatamente a
  nossa pergunta 2;
- **Linear, Notion, Height** — estados vazios que explicam o produto sem tutorial modal;
- **ChatGPT / Claude** — a tela inicial com exemplos clicáveis (já usamos a ideia no painel, vale
  ver como eles tratam a *primeira* pergunta de um domínio específico);
- **o que o dono já aprovou** — `openspec/apresentacoes/*.html` mostram a linguagem visual que ele
  gosta nos documentos; a UI do painel (`src/assistant/ui/assistant.css`) tem a paleta.

Entregar as referências como **imagens lado a lado** com uma legenda do que cada uma resolve, e
dizer o que NÃO serve para nós (a maioria dessas telas não tem um agente que desenha junto).

## O que entregar

1. **Um levantamento** com as referências e a leitura de cada uma (o que copiar, o que descartar).
2. **Duas ou três propostas** de tela base, em mockup — não em código. Pode ser HTML estático no
   padrão de `openspec/apresentacoes/`, que é o formato que o dono lê rápido.
3. **A recomendação**, com o porquê, e o custo de cada caminho.
4. **Uma change OpenSpec** (`openspec/changes/<slug>/`) com proposta, design e tarefas, pronta
   para implementar. O repositório usa esse fluxo; veja `openspec/project.md` (a "constituição")
   e qualquer change existente como modelo.

## Como rodar o projeto

```bash
cd C:\Users\kaios\source\repos\bpmn
npm install
npm run dev          # webpack serve; o dono usa a porta 8126
npm test             # suíte inteira, sem rede e sem chave
```

Para **ver** a tela sem uma pessoa na frente: `node tools/drive-page.mjs "http://127.0.0.1:8126/index.html"
--shot artifacts/e2e-shots/<nome>.png --passo "<js>"` — é como os prints acima foram feitos.

## Duas regras do repositório que valem para este estudo

- **Nada de chave em lugar nenhum**, nem de exemplo, nem em print.
- **O modelo decide a ação; o código decide o que é permitido** (`openspec/project.md`, §III).
  Se a tela base oferecer "descreva o seu processo", quem conduz é o **modelo**, por function
  calling — não um roteiro com `if` no código.
