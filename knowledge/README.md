# O acervo — como escrever um verbete

Cada arquivo `.md` desta pasta é **um verbete**: uma página de conhecimento sobre BPMN que o
ajudante pode consultar, com referência que o aluno consegue conferir. O índice que o site serve
(`dist/knowledge/index.json`) é **gerado** por `node tools/build-knowledge.mjs` — não escreva
JSON à mão: duas fontes de verdade para o mesmo acervo divergem no primeiro verbete editado às
pressas (decisão K1).

## A forma

```markdown
---
sourceId: gateways            # id estável, igual ao nome do arquivo
title: Gateways — onde o caminho se divide
group: fundamentos            # fundamentos | modelagem | simulacao
tags: [gateway, decisão]      # as palavras que alguém usaria para procurar
contentMode: curated_card_only
officialUrl: https://www.omg.org/spec/BPMN/2.0/
---

<!-- chunk:exclusivo -->
Localizador: Gateways › exclusivo (XOR)
Citação: [fonte:gateways:exclusivo]

O texto do trecho, escrito por nós.
<!-- /chunk -->
```

## As regras que o validador cobra

1. **O MVP é inteiro `curated_card_only`** (K5): explicação **nossa**, com link para a fonte
   oficial. Nenhum verbete reproduz texto da norma da OMG — a licença de redistribuição de
   trechos não foi confirmada, e por isso o build **reprova** `verified_excerpt` sem `rightsNote`.
2. **Chave de citação única** (`[fonte:<sourceId>:<chunkId>]`). Duplicada reprova — uma chave que
   aponta para dois textos torna a conferência do aplicativo impossível.
3. **Nenhuma página contém a marca de fronteira do prompt** (`DADOS_DO_ALUNO`): o acervo é nosso,
   mas uma página com a marca poderia forjar o delimitador que separa dado de instrução (K9).
4. **Localizador e citação em todo trecho.** Sem eles o trecho não é citável, e conhecimento que
   não se cita não serve para o que este acervo existe.

## O que o acervo NÃO é

Não é cópia da norma, não é busca na internet e não é memória do modelo. É um conjunto pequeno
de páginas nossas, com tamanho declarado: quando a busca não acha, a resposta certa é *"não está
no meu acervo de N verbetes"* — e nunca *"a norma não trata disso"* (K8).
