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
node tools/avaliar.mjs --ao-vivo            # sessão de verdade por pergunta, com descanso entre elas
node tools/avaliar.mjs --ao-vivo --gravar-baseline   # ato EXPLÍCITO: fixa a linha de base
```

Cada corrida escreve `artifacts/avaliacao/<carimbo>/resumo.json` e, ao vivo, um registro no
diário append-only (`artifacts/ledger/corridas.jsonl`).

## Os campos de uma pergunta

| campo | o que faz |
|---|---|
| `id` | estável; é por ele que a baseline compara |
| `categoria` | uma das doze (ver abaixo) |
| `perfil` | `modelador` (edita) ou `viewer` (só lê) |
| `pergunta` | **nas palavras de um aluno** — tirada de trilha real sempre que houver |
| `ferramentasEsperadas` | as que resolvem. Lista vazia = **não é para chamar nenhuma** |
| `ferramentasProibidas` | as que não podem nem ser oferecidas neste perfil |
| `argumentosQueImportam` | só os que mudam o resultado (o nome que vai para o rótulo, a direção, o eixo) |
| `fatosObrigatorios` | pedaços que a resposta tem de conter |
| `proibicoes` | o que não pode aparecer na resposta (id cru, palavra de injeção, frase que mente) |
| `erroEsperado` | quando o certo é **recusar com nome** (`sem_lugar`, `falta_confirmacao`, `sem_corrida`) |
| `recusaEsperada` | quando o certo é dizer que não é com ele |
| `respostaNoIdioma` | `pt` quando a pergunta puxa outro idioma (diagrama em inglês, injeção) |
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
   desconhecido, categoria fora da lista ou categoria de segurança sem proibição declarada
   **reprova o arquivo**.
4. Rode a camada determinística. Se ela reprovar, decida: a pergunta está errada ou o produto está?

## Limiares e linha de base

`limiares.json` tem o piso geral, o piso por categoria de segurança e o delta máximo de regressão.
`baseline.json` começa vazio — e só é preenchido por **ato explícito** (`--gravar-baseline`),
depois de alguém olhar a diferença. Baseline que se atualiza sozinha mede o último erro, não o
produto.
