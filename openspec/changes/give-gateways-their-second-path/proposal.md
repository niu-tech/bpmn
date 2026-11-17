# Dar ao gateway o segundo caminho

> Decisões: `design.md` (D1–D6). Plano: `tasks.md`. Evidência: a sessão de voz do dono em
> 2026-11-17, lida da aba dele pelo `tools/attach-edge.mjs` — 17 chamadas de ferramenta em 9 s,
> duas delas desfazendo o que a anterior fez, e o desenho terminando com metade do processo solta.

## Why

O dono descreveu um processo inteiro por voz e o agente desenhou — **com o gateway errado**:

> *"A gente não está fazendo um bom uso de gateways. Quando os gateways acontecem, a gente deveria
> ter o correto, o não e sim. Não está seguindo dois caminhos, está seguindo um caminho só e o
> outro está desconectado."*

Lido do desenho que ficou na tela dele (11 nós, 8 ligações):

```
Chamado recebido → Receber chamado → Analisar chamado → ◇ Componentes suficientes?
                                                         └─ Sim → Montar base → Entregar p/ dev → ⬤ Fim

      Gerar resultado e README → Entregar ao cliente → ⬤ Fim do atendimento automatizado
      ↑ NINGUÉM aponta para cá
```

O gateway tem **uma** saída. O segundo caminho existe como três elementos soltos, sem nenhuma
ligação de entrada. E o rótulo *"Não"* foi parar na ligação que **entra** no gateway.

## A causa não é o modelo: é a nossa superfície de ferramenta

O handler de `criar_elemento` aceita `comoRamo` desde 2026-11-15 — e **o parâmetro nunca foi
declarado ao modelo**. A declaração tem `tipo`, `nome`, `depoisDe`, `dentroDe` e `entre`. Só.

A consequência é mecânica, e explica tudo o que a sessão registrou:

1. o modelo cria o gateway e a primeira tarefa depois dele (`depoisDe: gateway`) — correto;
2. para o segundo caminho ele chama de novo `depoisDe: gateway`. Como o gateway **já tem uma
   saída**, o produto faz o que a regra manda: **encadeia** — a tarefa entra NO MEIO do primeiro
   caminho, em vez de abrir o segundo;
3. o modelo percebe que o desenho ficou errado e chama `desfazer` (**duas vezes**, às 127,0 s e
   128,7 s — as duas linhas *"desfiz — saiu 2 elementos"* que aparecem no chat dele);
4. sem saída, ele cria os elementos **soltos** e nunca os liga;
5. e tenta nomear os caminhos renomeando as ligações pelo id — `renomear` em `Flow_07f31v0`
   **falhou** (`elemento_nao_encontrado`, 130,6 s), porque aquele id morreu num dos desfazeres.
   O rótulo que sobrou foi parar na ligação errada.

Ou seja: **hoje é impossível pedir o segundo caminho de um gateway.** O modelo não falhou em
escolher a ferramenta — ele escolheu a única que existe, e ela faz outra coisa.

## What Changes

- **`ramificar` nasce**: uma chamada cria o caminho inteiro de uma decisão — o ramo, a ligação e o
  **rótulo do caminho** (`Sim` / `Não` / o que o aluno disser). O id da ligação nunca sai do nosso
  código, e por isso não há id para o modelo perder.
- **`criar_elemento` passa a declarar `comoRamo`**, que já existia no handler: o caminho explícito
  para "mais uma saída deste elemento", quando o aluno não está nomeando uma decisão.
- **Rótulo de caminho vira conceito**, não um `renomear` em cima de um `Flow_…`: quem precisa
  escrever *"Sim"* numa seta faz isso pela ferramenta que criou a seta.
- **A seção do prompt sobre decisão** diz, em duas linhas, o que é uma decisão bem desenhada:
  pergunta no gateway, dois caminhos rotulados, cada um com o seu fim.
- **Portão ao vivo**: *"descreva um processo com uma decisão"* termina com **dois** caminhos
  ligados e rotulados, e **zero** elementos órfãos.

## Non-Goals

- Gateway paralelo, inclusivo e baseado em evento ganham o mesmo verbo, mas **não** ganham
  pedagogia nesta change: escolher ENTRE eles é F8, e está com o orientador.
- Juntar os caminhos de volta (o gateway de convergência) fica para depois: o desenho correto de
  uma decisão que reúne é outra conversa, e o aluno de hoje desenha decisões que terminam.
- Layout dos ramos. O bpmn-js posiciona ramo um degrau abaixo, e isso está certo; `alinhar`
  conserta o que ficar torto.
