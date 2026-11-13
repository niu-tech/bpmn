# CLAUDE.md — ajudante BPMN (TCC)

Regras de trabalho deste repositório. Valem para qualquer sessão, sem precisar ser repetidas.

## ⛔ Plano, panorama ou decisão para o dono = **peça visual para abrir na aba**

> Dono, 2026-11-13, duas correções seguidas no mesmo dia:
> *"Mas eu não quero um roadmap.md… em PDF da forma que a gente já falou sobre."* e, logo depois,
> *"tá muito longo, muita complexidade… não precisa necessariamente ser em páginas, pode ser
> contínuo ou como uma apresentação, porque como eu vou abrir aqui na aba."*
> Precisou ser pedido duas vezes. Virou regra.

Quando o retorno for **plano, panorama, comparação, proposta, resumo de rodada ou decisão a
tomar**, a entrega é um **HTML autocontido, contínuo**, entregue com `SendUserFile` e
`display: "render"` — ele abre direto na aba lateral.

O que faz a peça prestar:

- **executiva**: o dono decide a partir dela sem ter acompanhado a sessão. Cada cartão cabe em
  duas linhas; o que não couber não entra;
- **escaneável antes de legível**: números em destaque no topo, depois os blocos. Quem bate o olho
  tem que sair sabendo o essencial;
- **o espaço é o argumento**: grade, cartões e faixas — não parágrafo atrás de parágrafo. Contraste
  reservado para o que decide (o risco, a escolha que é dele);
- **contínua**, sem quebra de página artificial, e responsiva (a aba é estreita).

Onde ficam os arquivos:

- a fonte, versionada, em `openspec/apresentacoes/<nome>.html` — é dali que se edita;
- `artifacts/` é **ignorado pelo git**: serve de alvo de render, nunca de lugar de guardar.

**PDF só quando o destino for sair do computador** — enviar ao orientador, imprimir, anexar na
banca. Aí sim paginado em A4, com o estilo de
`openspec/changes/give-bpmn-assistant-an-agent-harness/apresentacao.html`, por:

```bash
node tools/html-to-pdf.mjs <entrada.html> artifacts/<nome>.pdf
```

Layout contínuo não vira PDF bonito: são desenhos diferentes, e misturar os dois entrega um
documento quebrado no meio dos cartões.

**O repositório continua recebendo o registro** (`openspec/roadmap.md`, `openspec/open-items.md`) —
é a memória da próxima sessão. Mas registro **não é entrega**: o dono não lê o repo para decidir.
Fazer só o `.md` é não ter respondido.

## ⛔ Idioma: a resposta ao dono é SEMPRE em pt-BR

Vale para a mensagem de fechamento, o recap, a peça visual e qualquer relatório — mesmo com código, logs ou
documentação em inglês. Identificadores, comandos e saída literal ficam como estão.

## ⛔ Provar ao vivo. Nunca pedir para o dono testar

Comportamento se prova dirigindo o produto de verdade (`tools/battery.mjs`, `tools/drive-page.mjs`,
`tools/provar-captura.mjs`, `tools/medir-voz.mjs`) e lendo a evidência. "Funcionou quando testei"
não é cobertura; o teste é. Validou na mão? **Codifique como teste.**

Quando faltar um verbo para dirigir ou provar algo, **construa o verbo** — "não dá para verificar"
não encerra tarefa.

## ⛔ Resposta ausente é a mentira mais fácil do instrumento

Lição de 2026-11-13 (dívida M6, três dias): o relatório dizia *"o servidor não respondeu"* e a causa
era o microfone do teste tocando um tom sintético. **Antes de culpar o produto ou o servidor, olhe a
tela e a linha do tempo.** Medir energia e chamar de fala é o erro que custou a semana — meça
conteúdo, e rode o braço de controle (o que mede o nada) antes da hipótese bonita.

## Não declarar pronto sem prova

Relatar o que de fato aconteceu: se o número foi 6 de 9, é 6 de 9. O que ficou aberto entra em
`openspec/open-items.md` com a evidência junto, nomeado. Falha de instrumento e falha de produto
são coisas diferentes e o relatório precisa distinguir as duas.

## Sync a cada checkpoint

Iteração coerente fechada ⇒ `git add` dos arquivos intencionais → commit conventional em pt-BR →
`pull --rebase` → `push`. Sem perguntar. Sempre em `main`.

## Segredo

A chave do `.env` (git-ignored) é do dono e serve só aos cenários ao vivo. **Nunca** é impressa, nem
em log, nem em relatório, nem no PDF. O site público é BYOK: a chave é do aluno, só em memória.
