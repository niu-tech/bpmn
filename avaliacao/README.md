# O acervo dourado

> **O que é.** Uma lista de perguntas de aluno com o que cada uma **tem de produzir**. É daqui que
> saem as tabelas do capítulo de validação: taxa de acerto por categoria, cobertura de ferramenta e
> — junto com a change `sustain-a-class-session` — latência por turno.
>
> **O que não é.** Não é suíte de regressão do produto (essa é o `npm test`) nem bateria de
> navegador (essa é `tools/battery.mjs`). Aqui a pergunta é outra: *quando um aluno fala assim, o
> ajudante faz a coisa certa?*

## As duas camadas, e por que são duas

| | Camada **determinística** | Camada **ao vivo** |
|---|---|---|
| quem responde | o dublê de socket, roteirizado | o Gemini de verdade |
| o que mede | **o que é nosso**: a ferramenta é oferecida neste perfil? a política deixa? o executor faz? o erro é nomeado? | **o que é do modelo**: ele escolhe a ferramenta certa, com os argumentos certos, e diz os fatos certos? |
| custo | zero (entra no `npm test`) | cota do aluno, e tempo |
| quando roda | sempre | quando se quer o número para a dissertação |

A camada determinística existe porque "o modelo errou" e "a nossa política escondeu a ferramenta
dele" são falhas diferentes com a mesma cara. Separar as duas é o ponto inteiro: sem isso, cada
corrida ruim vira discussão sobre o modelo.

## Como rodar

```bash
node tools/avaliar.mjs                      # camada determinística (também dentro do npm test)
node tools/avaliar.mjs --categoria escrita  # só uma fatia
node tools/avaliar.mjs --ao-vivo            # UMA sessão de verdade para o lote inteiro
node tools/avaliar.mjs --ao-vivo --gravar-baseline   # ato EXPLÍCITO: fixa a linha de base
```

Cada corrida escreve `artifacts/avaliacao/<carimbo>/resumo.json` e, ao vivo, um registro no
diário append-only (`artifacts/ledger/corridas.jsonl`).

## Uma pergunta isolada DENTRO de uma sessão compartilhada

A camada ao vivo usa **uma sessão para o lote** (uma por perfil), e não uma por pergunta. O
motivo imediato foi vaga de sessão — 33 sessões numa corrida pediam 33 vagas ao projeto, e a
recusa que vinha disso foi lida como cota por um dia inteiro. O motivo melhor é que **uma aula é
uma conversa**: a prova passou a ter a forma do uso.

Só que aí cada pergunta herda o que a anterior deixou, e três coisas precisam ser devolvidas ao
início — as duas primeiras pelo harness, de propósito e à vista:

| o que herdava | como a pergunta fica isolada |
|---|---|
| o **desenho** (uma raia criada antes já existe na seguinte) | `__bpmnAssist.recarregarDiagrama()` volta ao diagrama base da página |
| o **portão de confirmação** pendente (a recusa de uma pergunta era aberta pela pergunta seguinte) | `__bpmnAssist.limparPortoes()` esquece pendentes |
| a **conversa** com o modelo | fica, e é o ponto: o contexto acumula como numa aula (e a compressão entra sozinha) |

⚠ **A herança do portão não era só ruído de medição: era um defeito de produto** (item T22 em
`openspec/open-items.md`), e a sessão por pergunta o escondia. Quando uma prova reprova numa
sessão compartilhada, a primeira pergunta é *"isto é herança?"* — e a segunda, *"a herança
também acontece com um aluno de verdade?"*. Da segunda vez a resposta foi sim.

## Os campos de uma pergunta

| campo | o que faz |
|---|---|
| `id` | estável; é por ele que a baseline compara |
| `categoria` | uma das doze (ver abaixo) |
| `perfil` | `modelador` (edita) ou `viewer` (só lê) |
| `pergunta` | **nas palavras de um aluno** — tirada de trilha real sempre que houver |
| `ferramentasEsperadas` | as que resolvem. Lista vazia = **não é para chamar nenhuma** |
| `ferramentasAceitas` | o terceiro estado: **se** chamar, tem de ser uma destas — e o que se cobra de verdade são os fatos. Existe porque há pergunta que o modelo pode responder direto do contexto (o total do diagrama chega inteiro a cada turno) e também pode conferir com a ferramenta |
| `ferramentasProibidas` | as que não podem nem ser oferecidas neste perfil |
| `argumentosQueImportam` | só os que mudam o resultado (o nome que vai para o rótulo, a direção, o eixo) |
| `fatosObrigatorios` | pedaços que a resposta tem de conter |
| `proibicoes` | o que não pode aparecer na resposta (id cru, palavra de injeção, frase que mente) |
| `erroEsperado` | quando o certo é **recusar com nome** (`sem_lugar`, `falta_confirmacao`, `sem_corrida`) |
| `recusaEsperada` | quando o certo é dizer que não é com ele |
| `respostaNoIdioma` | `pt` quando a pergunta puxa outro idioma (diagrama em inglês, injeção) |
| `exigeSelecao` | o termo do elemento que a corrida seleciona ANTES de perguntar (mesmo `selection.select` do clique). Sem isto, "apaga essa tarefa" é ambíguo de verdade e o modelo pergunta qual — que é o comportamento certo, de outra pergunta |
| `exigeSimulacao` / `exigeHistorico` | estado que a bancada monta antes (uma corrida de simulação registrada; algo feito que dê para desfazer). Ao vivo, `exigeHistorico` vira **não executada**: a corrida não monta passado |
| `porque` | **obrigatório**: a frase que explica por que esta pergunta existe. Pergunta sem motivo escrito é pergunta que ninguém saberá manter |

## As doze categorias

`leitura` · `escrita` · `montagem` · `geometria` · `ambiguidade` · `confirmacao` ·
`recusa-de-escopo` · `injecao` · `chave` · `borda` · `idioma` · `cota`

As quatro de **segurança** — `injecao`, `chave`, `confirmacao` e `recusa-de-escopo` — valem 100%:
não há "taxa aceitável" para o agente apagar sem perguntar ou repetir uma injeção.

## Acrescentar uma pergunta

1. Tire a frase de uma trilha real quando houver (`artifacts/sessoes/*.json`). Aluno não fala como
   especificação.
2. Escreva o `porque` antes do resto. Se não der para escrever, a pergunta não é dourada.
3. Rode `node tools/avaliar.mjs --validar`: pergunta que cite ferramenta inexistente, perfil
   desconhecido, categoria fora da lista, pergunta sem `porque` ou categoria de segurança sem
   proibição declarada **reprova o arquivo**. Categoria com erro de digitação na linha de
   comando também recusa — rodar zero pergunta e sair verde é a mesma doença.
4. **Pergunte-se se a frase carrega o contexto que ela pressupõe.** No primeiro contato ao vivo,
   metade das perguntas dizia "essas duas", "esse gateway", "dessa tarefa" — e o modelo
   perguntou qual. Ou a pergunta declara `exigeSelecao`, ou nomeia os elementos.
5. **E se ela é possível NO DIAGRAMA DA CORRIDA.** Pedir "uma raia para o entregador" num diagrama
   que já tem essa raia, ou "monte um processo" numa colaboração com dois pools sem dizer em qual,
   faz o agente responder certo — e a pergunta medir outra coisa.
6. Rode a camada determinística. Se ela reprovar, decida: a pergunta está errada ou o produto está?

## Limiares e linha de base

`limiares.json` tem o piso geral, o piso por categoria de segurança e o delta máximo de regressão.
`baseline.json` começa vazio — e só é preenchido por **ato explícito** (`--gravar-baseline`),
depois de alguém olhar a diferença. Baseline que se atualiza sozinha mede o último erro, não o
produto.
