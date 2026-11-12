> **RASCUNHO.** Aguardando a rodada de pesquisa `openspec/pesquisa-tcc-prompt.md`. Design, spec e
> tasks só são escritos depois — o que está aqui é o rumo decidido, não o plano fechado.

## Why

Decisão do dono (2026-11-12), respondendo à pergunta 4 do resumo executivo: **cortar RAG foi
rejeitado**. O agente precisa conhecer BPMN **pela norma**, não só pela memória do modelo.

O que mudou não foi o veredito sobre RAG clássico — embeddings, banco vetorial e servidor
continuam fora, porque o produto é estático e roda na aba do visitante. O que mudou é que existe
**outro caminho, já construído e provado neste ecossistema**: a Alexandria TCC.

No CopilotSpeaker, 15 artigos científicos viraram páginas OKF em `docs/wiki/tcc/papers/`, cada uma
com:

- `id` estável e registro bibliográfico completo (`bibKey`, DOI, `canonicalUrl`, veículo, ano);
- **trechos delimitados** por marcador, cada um com `Localizador` e chave de citação
  (`[fonte:park2023:card]`);
- **limite de evidência declarado** — `contentMode: curated_card_only` diz, no próprio texto, que
  aquilo é ficha editorial e **não** o artigo integral;
- hash do conteúdo e do corpus, e `curationStatus` pendente de revisão humana.

É conhecimento **citável por construção**. A diferença para RAG não é técnica, é epistêmica: em
RAG o modelo resume um trecho recuperado; aqui ele devolve o trecho **com a referência**, e o que
não está no acervo ele não pode afirmar que está.

## What Changes

- Um **acervo OKF de BPMN** servido como arquivo estático junto com o site: seções da norma
  BPMN 2.0 que possam ser hospedadas, guias e artigos, cada página no mesmo formato da Alexandria.
- Uma **ferramenta de consulta** declarada ao modelo (`consultar_norma`), que devolve trecho +
  localizador + chave de citação. Function calling escolhe quando consultar — nunca palavra-chave.
- **A resposta carrega a citação.** Quando o agente afirma algo da norma, a fonte aparece para
  quem lê. Quando não achou, diz que não achou — não completa com memória do modelo sem avisar.
- **Separação visível entre as duas fontes**: o que vem do acervo e o que vem do conhecimento
  geral do modelo.

## O que esta change NÃO vai fazer

- Hospedar o texto integral da norma BPMN 2.0. Ela é da OMG; o que pode ser publicado é questão
  de direito autoral, e é uma das perguntas da rodada de pesquisa (B10).
- Embeddings, banco vetorial ou qualquer serviço. Se não couber em arquivo estático com busca
  lexical, a change muda de forma — não ganha servidor.
- Prometer que o agente "sabe a norma". Ele sabe **o que está no acervo**, e o acervo diz o seu
  próprio tamanho.

## Perguntas abertas, que a pesquisa precisa fechar

| # | Pergunta | Por que bloqueia |
|---|---|---|
| 1 | Qual parte do pipeline OKF é método portátil e qual é infraestrutura MAIA? | define se copiamos a forma ou também a ferramenta |
| 2 | Que tamanho de acervo cabe num site estático, e o que quebra primeiro? | decide se é viável sem servidor |
| 3 | Que busca sustenta isso sem embeddings, e o que se perde? | decide a qualidade da consulta |
| 4 | O que da norma BPMN 2.0 pode ser hospedado publicamente? | decide o conteúdo do acervo |
| 5 | Como a Alexandria impede citação de trecho inexistente? | é o guardrail que precisamos herdar |

## Impact

- Depende de: `give-bpmn-assistant-an-agent-harness` (catálogo, política, despacho).
- Afeta: o acervo novo, a ferramenta de consulta, e a seção do prompt que declara as duas fontes.
- Fase no roadmap: entra **depois de F6** (ferramentas de leitura), porque é uma ferramenta de
  leitura a mais — e antes de F8, porque um tutor que ensina a norma deveria citá-la.
