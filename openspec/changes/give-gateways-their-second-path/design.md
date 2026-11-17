# Decisões — dar ao gateway o segundo caminho

## D1 — Uma chamada cria o caminho INTEIRO, não três

`ramificar({ decisao, rotulo, tipo, nome })` cria, numa chamada só:

1. o elemento do ramo (`tipo` + `nome`), posicionado pelo bpmn-js;
2. a ligação da decisão até ele;
3. o **rótulo da ligação** (`rotulo`: *"Sim"*, *"Não"*, *"acima de R$ 1.000"*).

E devolve `{ criado, ligacao: { id, rotulo }, caminhosDaDecisao: N }`.

**Por que não deixar o modelo compor com as ferramentas que já existem.** Ele tentou, e a sessão
mostra o resultado: `criar_elemento` + `conectar` + `renomear(<id da ligação>)` são três chamadas
que dependem de o modelo **carregar um `Flow_…` entre elas**. Em voz ele não vê a tela; depois de
um `desfazer` o id morre; e o rótulo vai parar na seta errada. O id da ligação é informação do
nosso lado — ele não devia atravessar a fronteira do modelo em nenhum momento.

⚠ **Alternativa recusada: `criar_decisao` monolítico**, que receberia a pergunta e os dois caminhos
com as tarefas de cada um numa chamada só. Desenha mais rápido e **tira o aluno do meio**: o
produto é um tutor, e a decisão de quantos caminhos existem e como se chamam é exatamente a parte
que o aluno precisa tomar. Uma chamada por caminho mantém o passo-a-passo conversável — e continua
sendo uma chamada por caminho, não três.

## D2 — `comoRamo` passa a ser declarado, porque já existe

O handler aceita `comoRamo` desde a correção de 2026-11-15; a declaração nunca o expôs. Declarar é
**revelar uma capacidade que já está provada por teste**, não escrever código novo — e é o que
destrava "põe outra saída aqui" fora do contexto de decisão.

⚠ A regra de encadeamento **não muda**: `depoisDe` num elemento com uma saída continua entrando no
meio, porque foi exatamente isso que o dono pediu em 2026-11-15 (*"cria uma tarefa depois do
início"* tem de continuar a linha, não pendurar um ramo). `comoRamo: true` é o opt-in.

## D3 — Rótulo de caminho é coisa da ferramenta que cria o caminho

Nenhuma ferramenta nova para "nomear a seta". `renomear` continua existindo e continua aceitando
qualquer elemento — mas o caminho recomendado ao modelo deixa de passar por lá.

**Por quê:** renomear uma ligação exige o id dela, e id de ligação é a única informação do desenho
que o aluno nunca diz em voz alta. É um id que só existe para o modelo errar.

## D4 — Uma decisão sem segundo caminho é um FATO que volta ao modelo

`criar_elemento` com `tipo` de gateway passa a devolver `caminhos: 0` — e a leitura da tela
(`estadoDaTela`) passa a contar, para toda decisão do desenho, quantos caminhos ela tem.

Assim o modelo recebe, **no resultado da própria escrita**, a informação de que o desenho está
incompleto — do mesmo jeito que `avisoDeRamo` já avisa hoje. Sem heurística nossa, sem código
decidindo por ele: o fato está no retorno, a decisão é dele (constituição §III).

⚠ **Não** vamos recusar a criação de um gateway sem caminhos. Gateway recém-criado tem zero saídas
por definição; recusar seria impedir o passo 1 de todo mundo.

## D5 — O prompt ganha DUAS linhas, não um tratado

Na seção de domínio, sobre decisão:

> Decisão desenhada é: pergunta no losango, **um caminho por resposta**, cada caminho com o rótulo
> dela (Sim/Não ou o critério). Caminho sem rótulo e decisão com uma saída só são desenho
> incompleto — use `ramificar` para abrir cada caminho.

**Por que tão curto:** o teto do tier estável é orçamento pago pela cota do aluno em toda sessão
(§IX), e a regra que ninguém lê inteira não é regra. O que ensina de verdade é a ferramenta fazer a
coisa certa em uma chamada.

## D6 — O portão mede o DESENHO, não a narração

O portão ao vivo pede um processo com uma decisão e mede no registro do bpmn-js:

- a decisão tem **≥ 2** saídas de sequência;
- **toda** saída tem rótulo não-vazio;
- **zero** elementos órfãos (sem entrada e sem saída, fora o início);
- e nenhuma seta atravessando caixa (o medidor que já existe).

⚠ Pelo princípio XIII: o portão afirma **antes** que o desenho estava vazio e **depois** que ele
tem a decisão — contagem de órfãos sem piso aprovaria um canvas que não desenhou nada.
