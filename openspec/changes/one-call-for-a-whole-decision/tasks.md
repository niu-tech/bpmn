# Tarefas — uma chamada para a decisão inteira

> Baseline medido ANTES de implementar (é a regra desta frente: o "antes" é medido, nunca
> estimado): **6 chamadas** · 2,8 s · 2 → 10 formas, com
> `criar_pool · criar_sequencia · ramificar · criar_elemento · ramificar · criar_elemento`.

## 1. A ferramenta

- [x] 1.1 `criar_decisao({ pergunta, depoisDe, tipo, caminhos })` em `tools/escrita.js`, compondo
      `criar_elemento` + `ramificar` + `criar_sequencia` (D2) — nenhum desenho novo
- [x] 1.2 Validação de ENTRADA antes de desenhar: caminho sem rótulo, lista vazia, teto de 4
      caminhos e teto de passos da fila (D4, D5)
- [x] 1.3 Gateway falha ⇒ lança; caminho falha ⇒ retorna com `parou: { caminho, rotulo, passo }`
- [x] 1.4 Resultado com `caminhosDaDecisao`/`rotulados` lidos do desenho, `comandos` e `tela` uma
      vez (D6)

## 2. A declaração

- [x] 2.1 Declaração no catálogo com a fronteira dos quatro verbos — decisão · fila ·
      `criar_elemento` · `ramificar`, e **sem** tocar o prompt estável
- [x] 2.2 Apresentador: linha própria (*"desenhei a decisão «Componentes suficientes?» com 2
      caminhos"*), e o caminho que parou quando parar

## 3. Provas determinísticas

- [x] 3.1 Dois caminhos de dois passos: gateway ligado, duas setas rotuladas, passos encadeados
- [x] 3.2 Rótulo faltando no terceiro caminho: recusa ANTES de desenhar (o desenho não muda)
- [x] 3.3 Falha no segundo caminho: gateway e primeiro caminho ficam, `parou.caminho === 2`
- [x] 3.4 Tetos: 5 caminhos recusa; soma de passos acima do teto recusa; nada desenhado
- [x] 3.5 Uma `tela` só, `caminhosDaDecisao === 2` e `rotulados === 2`

## 4. Portão (sem cota, bpmn-js de verdade)

- [x] 4.1 Decisão com dois caminhos de dois passos: zero órfãos, zero sobreposição, nenhuma seta
      atravessando caixa, os dois rótulos no desenho
- [x] 4.2 A tela conta a decisão numa linha, e o selo de escrita aparece durante a chamada
- [x] 4.3 Desfazer o total informado volta o desenho ao estado anterior (em duas chamadas, se
      passar do teto de 10 — e a primeira avisa)

## 5. Ao vivo

- [x] 5.1 O **mesmo** pedido do baseline contra o dev server: medir chamadas e verbos
- [x] 5.2 O modelo **escolhe** `criar_decisao` sem ninguém dizer o nome da ferramenta
- [x] 5.3 Registrar antes × depois no `proposal.md`

## 6. Registro

- [x] 6.1 `openspec/changes/README.md` com a linha da change
- [ ] 6.2 Conferir no **publicado** depois do deploy (a lição de hoje: CI vermelho deixa o site
      parado, e medir o publicado é o que denuncia)

## Ao vivo (2026-11-17) — o mesmo pedido, antes e depois

| | antes | depois |
|---|---|---|
| **chamadas** | **6** | **3** |
| verbos escolhidos pelo modelo | `criar_pool` · `criar_sequencia` · `ramificar` · `criar_elemento` · `ramificar` · `criar_elemento` | `criar_pool` · `criar_sequencia` · **`criar_decisao`** |
| do envio ao último elemento | 2,8 s | **1,9 s** |
| nossa escrita (mediana) | 0,01 s | 0,01 s |
| nossa fatia | 2% | 2% |

**O modelo escolheu `criar_decisao` sozinho**, com o pedido em palavras e sem citar ferramenta
nenhuma. E a tela mostrou os três verbos numa mensagem só, que é o agrupamento da change anterior
funcionando por cima desta:

```
montando o processo — 7 elementos
  criei o pool "Suporte" e pôs 1 elemento dentro
  desenhei a fila: 1 passo — "analisar chamado"
  desenhei a decisão "Componentes suficientes?" — "sim" e "não", 4 elementos
```

⚠ O desenho ficou com **um elemento a menos** que o do baseline (2→9 contra 2→10): o modelo
entendeu *"o chamado chega"* como o evento de início que já existia, em vez de criar outro. É
escolha dele sobre o processo, não efeito do verbo — e vale registrar para ninguém ler a diferença
de contagem como perda.

## Os dois achados desta rodada

**1. Decisão no MEIO de um fluxo herda a continuação antiga** (portão, sem cota). A tarefa base já
tinha saída, então o gateway entrou no meio dela e ficou com **três** caminhos: os dois rotulados e
o antigo, sem rótulo. Não é defeito — é a regra de encadeamento (uma decisão no meio do caminho
continua ligada ao que vinha depois). O que o produto faz é **contar**: `caminhosDaDecisao: 3,
rotulados: 2`, e o modelo decide se pergunta ao aluno, rotula ou tira. Um portão que exigisse
"exatamente 2 saídas" estaria exigindo que o produto desligasse o resto do processo pelas costas
dele.

**2. A guarda de GÊMEO não existe em `ramificar`** (prova determinística). Ela vive em
`criar_elemento`, então dois caminhos que abrem a **mesma** tarefa, com o mesmo nome, não são
recusados — e a decisão herda isso. Fora do escopo desta change (dois caminhos podem levar a
tarefas homônimas de verdade), mas fica medido para quem for mexer em `ramificar`.

## Provas

- `npm test` verde — cinco provas determinísticas novas em `src/assistant/__tests__/escrita.mjs`
  (dois caminhos rotulados lidos do desenho, recusa de entrada sem rótulo, falha na abertura do
  galho **e** falha dentro da fila do galho, os dois tetos, uma tela só)
- Portão sem cota, bpmn-js de verdade: *"a decisão inteira numa chamada: dois caminhos rotulados,
  com os passos de cada um"* — `{umaChamadaDesenhouTudo, doisRotulosNoDesenho,
  encadeouDentroDoGalho, seloDesenhando, umaLinha, avisouQueFalta, voltouTudo, herdouSemRotulo,
  contouAHeranca}` todos verdadeiros, `orfaos: []`, `sobrepostos: []`, `atravessadas: []`
- Ao vivo: `artifacts/medicao/construcao.json`
