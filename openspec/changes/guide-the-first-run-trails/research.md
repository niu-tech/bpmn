# Pesquisa de UI/UX — a primeira vez nas três trilhas

> Pedido do dono (2026-11-16): *"vamos fazer uma pesquisa em ui/ux para melhorar nossa estrutura e
> como lidamos com o usuário ao entrar, e nas 3 trilhas principais"*. Feita nesta sessão, em
> 2026-11-16, por busca na web. O que cada achado **decidiu** está na última coluna — pesquisa que
> não muda nada não precisava ter sido feita.

## 0. Honestidade sobre as fontes

A maior parte do que se publica sobre onboarding é blog de fornecedor de ferramenta de onboarding,
ou seja, parte interessada. Separei:

| Peso | Fontes |
|---|---|
| **Forte** | o artigo do arXiv (método e medição), a documentação de produto da Adobe e da Canva (é o que eles de fato fazem, não o que recomendam) |
| **Médio** | o relato de um achado da Nielsen Norman Group (chega de segunda mão, por um resumo de palestra — não consegui o estudo original, e isso fica dito) |
| **Fraco** | números de ativação de blogs sem estudo nomeado. **Não** usei nenhum para decidir |

## 1. Tutorial sobreposto sai pela culatra

O achado que mais mudou o desenho, e é contra-intuitivo: participantes que **leram** o tutorial de
um aplicativo acharam o que ele ensinava **mais complexo** do que quem pulou (NN/g, de segunda mão).
Na mesma direção: *spotlight* só se justifica para interação não óbvia, tooltip dispensada não deve
voltar na mesma sessão, e modal que bloqueia impede a pessoa de se sentir competente.

**Decidiu:** nada de tour, nada de sequência de "próximo", nada de piscar. A ajuda é **uma** peça,
sem bloquear nada, que fecha num clique e não volta. Também matou as duas ideias que o próprio dono
levantou (abrir o painel sozinho / piscar a alavanca) — e por isso o motivo ficou escrito no
`design.md` G2, onde ele pode ser revisto.

## 2. Caixa em branco esconde o que o assistente sabe fazer

O consenso das fontes: um campo de texto vazio não comunica capacidade nenhuma, e o remédio
conhecido é **sugestão clicável** (o padrão "icebreakers"). Duas ressalvas que vieram junto, e que
valem mais que o padrão: **poucas e boas** (três caminhos focados valem mais que vinte exemplos), e
**editáveis** — a sugestão ensina a formular, não substitui a pessoa.

**Decidiu:** **uma** sugestão por estado, não uma lista; e ela chega **digitada no compositor**, não
enviada. Quem manda continua sendo o aluno — o que também mantém a constituição §III de pé: a
sugestão é texto, não despacho de ferramenta.

## 3. Sugestão ligada ao que está na tela vence sugestão genérica

É o achado com a melhor fonte (arXiv 2412.10933, sobre sugestão proativa de perguntas em assistente
corporativo, medido no AI Assistant da Adobe) e com os exemplos mais claros de produto: o Granola
sugere a partir do transcript da reunião, o Gemini a partir da página aberta, a Adobe tem um painel
de descoberta com perguntas por categoria, o Notion AI não tem tela de chat vazia — ele aparece
**no ponto de trabalho**, com partidas no formato da tarefa.

**Decidiu:** a barra **segue a seleção do canvas**. Sem seleção, a sugestão é a da trilha; com uma
forma selecionada, ela é sobre aquela forma, pelo nome. É a melhor versão disso que o nosso produto
podia ter, porque o agente **lê o diagrama** — a sugestão não é um chute sobre o que a pessoa quer,
é sobre o que ela acabou de clicar.

## 4. Estado vazio é convite, não erro

Para ferramenta de criação, o padrão é **encher o canvas com um exemplo editável** em vez de deixar
em branco; e o estado vazio precisa de manchete, uma ação principal e uma dica visual, senão vira
beco sem saída.

**Decidiu:** nada aqui — nós já fazemos. É o que a tela base e o exemplo identificado resolveram na
change anterior. Entra como confirmação de que aquele caminho estava certo, não como mudança.

## 5. O que fica em aberto, e que a pesquisa não resolve

- **Quanto tempo a barra deve ficar?** Hoje fica até a pessoa fechar ou abrir o painel. Nenhuma
  fonte dá número, e inventar um seria chute.
- **Quem volta pela segunda vez.** Uma fonte sugere trocar as partidas por um histórico das
  perguntas que a própria pessoa fez. Não temos memória entre visitas (decisão registrada), então
  está fora por construção, não por esquecimento.
- **Medir se funcionou.** Sem telemetria — e não vai haver, o produto é estático e sem backend. A
  prova possível é a da bateria: o caminho existe, é alcançável e leva ao resultado certo.

## Fontes

- [Proactive Question Suggestions, arXiv 2412.10933](https://arxiv.org/html/2412.10933v1)
- [Adobe — discoverability panel do AI Assistant](https://experienceleague.adobe.com/en/docs/platform-learn/tutorials/ai-assistant/discoverability-panel)
- [Canva Dev — assistente com partidas sugeridas](https://community.canva.dev/t/ai-assistant-now-available-on-canva-dev/8342)
- [shapeof.ai — Suggestions](https://www.shapeof.ai/patterns/suggestions) e [Icebreakers](https://www.shapeof.ai/patterns/icebreakers-suggestions)
- [Notion AI — teardown de onboarding](https://aiuxplayground.com/teardowns/notion/onboarding)
- [Better Onboarding (resumo de palestra, de onde vem o achado da NN/g)](https://conffab.com/presentation/better-onboarding/)
- [UI/UX Atlas — onboarding e primeira execução](https://uiux-atlas.pages.dev/lessons/ui-patterns/onboarding-and-first-run-experiences)
- [Produktly — estados vazios como onboarding](https://produktly.com/guides/how-to-use-empty-states-for-onboarding)
