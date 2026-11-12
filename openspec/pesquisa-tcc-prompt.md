# Pesquisa dirigida: o TCC e a base de conhecimento já construída

> **Como usar:** cole este arquivo inteiro numa conversa nova do GPT com o conector
> **CopilotSpeaker MAIA API (v4)** habilitado. Pré-requisito: a Maia Internal API de pé na
> máquina do dono. Segunda rodada — a primeira (`changes/give-bpmn-assistant-an-agent-harness/
> research-prompt.md`) tratou do harness do agente; esta trata do **TCC** e da **base de
> conhecimento**.
>
> O retorno orienta duas coisas: a change `add-bpmn-norm-knowledge-base` e a frente acadêmica.

---

## Quem é você nesta conversa

Pesquisador. Vai estudar **duas coisas já construídas** no CopilotSpeaker e dizer o que delas
serve a um projeto diferente, muito menor:

1. **A Alexandria TCC** — como um acervo científico virou conhecimento consultável e citável.
2. **A frente acadêmica do TCC** — norma, estrutura, referências, o que está pronto e o que falta.

Não escreva código, não proponha mudanças no CopilotSpeaker, não dispare nada.

## Regra dura: plano de LEITURA apenas

O conector tem dois planos. Use **só** o de CONTEXT: `listAllProjects`, `searchProjectsContent`,
`getProjectFile`, `listProjectFiles`, `getProjectGitLog`, e as sessões de contexto
(`createContextSession`, `addContextSessionProjects`, `searchContextSession`).

É **PROIBIDO** chamar `sendPromptClaudeCli`, `sendPromptClaudeDesktop`, `sendPromptCodex`,
`sendPromptMaiaEmbedded`, `sendPromptVisualStudio` ou mexer em `target`. Essas operações injetam
prompt em janela real na máquina do dono.

## Modo conversa

Abra uma sessão de contexto com `niu-tech/CopilotSpeaker` e `niu-tech/bpmn`, e trabalhe dentro
dela a conversa toda. Busque termo específico antes de listar pasta.

## O destino, para você calibrar o que importa

`niu-tech/bpmn` é um site estático de BPMN com um ajudante por voz e texto (Gemini Live, chave do
próprio visitante, nada roda em servidor nosso). Ele vai virar um tutor de BPMN. Decidiu-se
**cortar RAG clássico** (embeddings, vetor, servidor) e, no lugar, **reaproveitar o padrão da
Alexandria**: páginas OKF com trecho citável, consultadas por function calling.

Esse site é a **parte física e funcional do TCC do dono**. Quem o usa é usuário, não aluno
entregando trabalho.

## Onde começar

- `docs/wiki/tcc/research-context.md` e `docs/wiki/tcc/papers/**` (15 artigos)
- `roblox/worlds/alexandria-tcc/science/` — `OKF_INGESTION.md`, `catalog.json`, `authorship.json`
- `docs/wiki/concepts/alexandria-scientific-knowledge.md` e `concepts/alexandria-library.md`
- `docs/wiki/reference/okf-profile.md` e `reference/okf-consolidation-policy.md`
- `openspec/changes/propose-alexandria-tcc-interactive-research-visit/uff-tcc-guidance.md`
- `openspec/changes/connect-alexandria-tables-to-author-tcc`, `add-private-tcc-portal`
- `src/CopilotSpeaker.Tcc.Portal`, `tools/tcc-portal`
- `tools/maia-wiki.ps1` — as operações de leitura da wiki

Armadilhas: `openspec/changes/archive/` não existe mais; `capsules/**` é vendor; página
`deprecated` tem `superseded_by`.

## Bloco A — Como um texto vira conhecimento citável

A1. Descreva o **pipeline completo** de ingestão OKF: do PDF/registro primário até a página em
`docs/wiki/tcc/papers/`. Quais arquivos intermediários existem, quem valida o quê, e o que é
manual.

A2. Dissque a **anatomia de uma página de paper**: o que cada campo do frontmatter faz
(`tcc_record`, `tcc_inputs`, `tcc_agents`, `tcc_collection`), e por que há tanto hash.

A3. O que são os marcadores `<!-- tcc-chunk:… -->` e o campo `Localizador`? Como eles sustentam
uma citação como `[fonte:park2023:card]` — e o que impede alguém (ou um modelo) de citar um
trecho que não existe?

A4. O que significa `contentMode: curated_card_only` e `evidenceBoundary`? Como o sistema impede
que uma ficha editorial seja apresentada como se fosse o texto integral do artigo?

A5. Como a **consulta** funciona hoje: quais são as operações de leitura, o que elas devolvem, e
como o modelo é obrigado a citar em vez de resumir de memória.

A6. Quanto disso é **método portátil** (vale em qualquer projeto) e quanto é **infraestrutura
MAIA** (exige runtime, MCP, banco)? Separe explicitamente — é a pergunta que decide o que o bpmn
consegue copiar.

## Bloco B — O que isso vira num site estático

B7. Um bundle OKF de BPMN (trechos da norma 2.0 + artigos) teria que caber no navegador, servido
como arquivo estático, sem servidor. **É viável?** Que tamanho teria um acervo útil, e o que
quebra primeiro?

B8. Que tipo de **busca** sustenta isso sem embeddings — índice invertido, busca lexical, campos
estruturados? O que se perde em relação a RAG vetorial, e isso importa para perguntas de notação?

B9. Como declarar isso como **ferramenta de function calling** de modo que o modelo cite a fonte:
qual a forma do retorno (trecho + localizador + chave de citação) e como se garante que a resposta
ao usuário carregue a citação?

B10. Como lidar com **direito autoral**: a norma BPMN 2.0 é da OMG. O que pode ser hospedado como
trecho citável num site público e o que não pode? O que a Alexandria faz quando não pode ingerir o
texto integral?

B11. O agente vai responder sobre BPMN de duas fontes — o que o modelo sabe e o que a base diz.
Como a Alexandria separa as duas e deixa isso visível para quem lê?

## Bloco C — A frente acadêmica

C12. Resuma o que a conferência de normas da **UFF** estabeleceu: modalidade (monografia ou
artigo), normalização, estrutura exigida, prazos registrados e **o que está marcado como
divergente ou não confirmado**. Cite artigo e documento.

C13. O que já existe de **estrutura de TCC** no repositório — esqueleto de capítulos, portal,
registro de progresso, aprovação do orientador? O que é real e o que é proposta?

C14. Como o acervo de 15 artigos foi **recortado** (critério de inclusão, tópicos, prioridade)?
Esse método serve para montar um acervo de BPMN, ou foi feito sob medida para o tema da MAIA?

C15. Como as **referências bibliográficas** são geradas a partir do acervo (`bibKey`, DOI,
`canonicalUrl`)? Existe geração de ABNT, ou é manual?

C16. O que o material diz sobre **o que NÃO conta como aprovação** (ler, completar missão, a LLM
dizer que aprovou)? Quero a regra, porque ela vai valer igual aqui.

C17. Sendo o site BPMN a parte prática de um TCC: pelo que você leu das normas, o que uma banca
tipicamente espera que esteja **escrito** além do software — problema, objetivos, metodologia,
fundamentação, análise crítica — e o que do nosso material já serve para cada parte?

## Bloco D — Recomendação

D18. **Plano de reaproveitamento**, em tabela: o que o bpmn copia tal qual, o que adapta, o que
não serve. Uma linha de razão por item.

D19. **O menor acervo útil de BPMN**: quantas páginas, de que tipo (seções da norma, artigos,
guias), e por onde começar para o agente já responder citando.

D20. **O que você precisa de nós** para fechar a recomendação: arquivo, decisão ou medição, com
nome e pergunta.

D21. **O que nós não perguntamos e deveríamos** — sobre o TCC ou sobre a base de conhecimento.

## Formato do relatório

Em português. (1) Mapa do pipeline OKF em uma página. (2) Resposta numerada A1–D21, cada
afirmação com `caminho/arquivo:linha`. (3) Tabela portátil × infraestrutura. (4) Plano de
reaproveitamento. (5) **Lacunas** — o que procurou e não achou. (6) O que precisa de nós.

Honestidade: não invente caminho de arquivo; se não conseguiu abrir, diga. Prazo, norma e exigência
acadêmica só valem com a fonte citada — e diga quando o próprio material registra divergência.
