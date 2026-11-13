# Pesquisa: o que a Alexandria ensina sobre conhecimento citável

**Origem.** Rodada de pesquisa feita em 2026-11-12 por um GPT com o conector CopilotSpeaker MAIA
API v4, no plano de leitura, a partir de `openspec/pesquisa-tcc-prompt.md`. Sessão de contexto
`tcc-bpmn-okf-academico-2026-11-12`. A rodada declarou não ter alterado arquivo, não ter rodado
teste e não ter usado dispatch — e nada no repositório contradiz isso.

O relatório inteiro vive na conversa. Esta página guarda o que **mudou decisão aqui**, o que eu
conferi antes de aceitar, e o que continua em aberto.

## 1. O que eu conferi antes de aceitar

O relatório fez afirmações concretas sobre o acervo da MAIA. Conferi todas no disco do
CopilotSpeaker, porque afirmação sobre código é verificável e a pesquisa ganha ou perde crédito
nela:

| Afirmação do relatório | Veredito | Onde |
|---|---|---|
| 15 artigos catalogados em páginas OKF | **confirmado** (15 arquivos) | `docs/wiki/tcc/papers/*.md` |
| 14 fichas editoriais preliminares | **confirmado** (14 × `curated_card_only`) | front-matter `tcc_record` |
| Um artigo com trechos conferidos | **confirmado** (1 × `verified_excerpt`, 3 trechos) | idem |
| Campos `tcc_record`/`tcc_inputs`/`tcc_agents`/`tcc_collection` | **confirmado** | `park2023.md` front-matter |
| Marcador de trecho, localizador e chave de citação | **confirmado** (`<!-- tcc-chunk:card -->`, `Localizador:`, `[fonte:park2023:card]`) | `park2023.md` corpo |
| `evidenceBoundary` separa o conferido da síntese editorial | **confirmado** | `tcc_record.evidenceBoundary` |
| Hash de conteúdo e de corpus, revisão humana pendente | **confirmado** (`contentHash`, `corpusHash`, `curationStatus: draft_pending_human_review`) | idem |
| As três páginas de wiki citadas existem | **confirmado** | `concepts/alexandria-scientific-knowledge.md`, `reference/okf-consolidation-policy.md`, `tcc/research-context.md` |

Oito de oito. E o relatório acertou também o que **não** tem: ele diz, sem ser perguntado, que o
acervo "não equivale a 15 PDFs integralmente ingeridos". É verdade — 14 das 15 fichas são
editoriais. Pesquisa que declara o próprio limite vale mais que pesquisa que preenche a lacuna.

**Correção de nome.** Eu ia chamar o modo de trecho literal de `verbatim_excerpt`. O nome real,
no disco, é **`verified_excerpt`** — e `kind: editorial_card` para a ficha. Herdamos os nomes da
Alexandria em vez de inventar sinônimos: um dia alguém vai comparar os dois acervos.

## 2. O que mudou de decisão

**Cortar MCP e banco deixou de ser hipótese.** O relatório separa, na mesma tabela, o que é
**método portátil** (páginas versionadas, proveniência e hash, marcador de trecho, fronteira de
evidência) do que é **infraestrutura da MAIA** (MCP de conhecimento, banco, embeddings, portal
acadêmico). O produto estático fica com o método inteiro e nenhuma peça de servidor. Era a
pergunta 1 da proposta, e está fechada.

**A verificação de citação é do aplicativo, não do modelo.** A frase do relatório que mais muda o
desenho: *"O aplicativo deverá conferir se a chave de citação existe entre os resultados
consultados."* Guardrail de prompt pede ao modelo que não invente fonte; isto **impede** que a
fonte inventada chegue ao aluno. Virou a decisão K6 — com a assimetria que o relatório não
mencionou e eu não vou esconder: só o modo texto passa pelo nosso código.

**O direito autoral virou gate de build.** O relatório não conseguiu confirmar a licença de
redistribuição de trechos da norma BPMN 2.0 da OMG, e recomenda explicações originais com
referência precisa. Em vez de deixar isso como aviso num documento, o validador do acervo recusa
um trecho marcado como literal sem nota de direitos (K5). A pergunta jurídica continua aberta e
fica **incapaz de vazar para o site publicado**.

**O tamanho do acervo saiu da pesquisa e entrou na medição.** O relatório estima 12 a 18 fichas e
diz, com honestidade, que é estimativa de projeto e não medição da Alexandria. Então nós medimos
(K10, bloco 5 das tarefas): tamanho do índice, latência da primeira consulta e qualidade em
perguntas ambíguas. Número medido aqui vale mais que número estimado lá.

## 3. O que a pesquisa NÃO fechou

| Pergunta da proposta | Estado | Onde foi parar |
|---|---|---|
| 1. Método portátil × infraestrutura MAIA | **fechada** | §2 e design K1–K4 |
| 2. Que tamanho de acervo cabe num site estático | **aberta** — estimativa, não medição | tarefa 5.1 (medimos) |
| 3. Que busca sustenta isso sem embeddings | **parcial** — índice estático + JS confirmado como caminho; eficácia não | design K2 + tarefa 5.2 |
| 4. O que da norma pode ser hospedado | **aberta** — licença não confirmada | design K5 (validador) + `open-items.md` §1 |
| 5. Como impedir citação de trecho inexistente | **fechada** | design K6 |

Também não foi comprovada uma corrida nova do pipeline OKF, nem geração ABNT validada. Nada disso
bloqueia esta change: o acervo do BPMN é escrito à mão em Markdown e validado no build — não
depende do pipeline da MAIA rodar.

## 4. A frente acadêmica, que esta change não resolve

O relatório levantou a infraestrutura de TCC do CopilotSpeaker (`docs/wiki/tcc/`,
`uff-tcc-guidance.md`, portal privado) e propôs um mapeamento parte-acadêmica × material
disponível. É útil e fica registrado, mas com a ressalva que ele mesmo escreveu: modalidade
exigida, prazos da disciplina e exigências do orientador **não** estão confirmados, e concluir
atividade em portal não é aprovação acadêmica. Isso é trabalho de uma change própria, não desta —
o relatório recomenda três frentes separadas e eu concordo.
