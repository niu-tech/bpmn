> **Pesquisa concluída (2026-11-12).** Proveniência e o que foi conferido: `research.md`.
> Decisões: `design.md` (K1–K10). Plano: `tasks.md`. Duas das cinco perguntas abaixo continuam
> abertas — e viraram medição nossa e gate de build, não aviso em documento.

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

As oito afirmações da pesquisa sobre esse acervo foram conferidas no disco, uma por uma, e as oito
se confirmaram (`research.md` §1) — incluindo a que mais importa aqui: 14 das 15 fichas são
editoriais, e só uma tem trecho conferido. O acervo declara o próprio tamanho, e é isso que
estamos copiando.

## What Changes

- Um **acervo OKF de BPMN** servido como arquivo estático junto com o site: guias e verbetes
  autorais sobre a notação, cada página no mesmo formato da Alexandria, com link para a fonte
  oficial.
- Uma **ferramenta de consulta** declarada ao modelo (`consultar_norma`), que devolve trecho +
  localizador + chave de citação. Function calling escolhe quando consultar — nunca palavra-chave.
- **A resposta carrega a citação, e o aplicativo a confere.** No modo texto, chave de citação que
  nenhuma consulta devolveu é marcada como não conferida antes de a resposta aparecer (K6).
- **Separação visível entre as duas fontes**: o que vem do acervo e o que vem do conhecimento
  geral do modelo.

## O que esta change NÃO vai fazer

- Hospedar o texto integral da norma BPMN 2.0. Ela é da OMG, a licença de redistribuição de
  trechos **não** foi confirmada na pesquisa, e por isso o lote nasce inteiro em explicação
  autoral com link oficial — com o build **reprovando** qualquer trecho literal sem nota de
  direitos (K5).
- Embeddings, banco vetorial ou qualquer serviço. Se não couber em arquivo estático com busca
  lexical, a change muda de forma — não ganha servidor.
- Prometer que o agente "sabe a norma". Ele sabe **o que está no acervo**, e o acervo diz o seu
  próprio tamanho.
- Prometer conferência de citação na **voz**. O áudio não passa pelo nosso código; a assimetria é
  declarada na interface, não escondida (K6).

## As perguntas que bloqueavam, e onde foram parar

| # | Pergunta | Estado | Onde |
|---|---|---|---|
| 1 | Qual parte do pipeline OKF é método portátil e qual é infraestrutura MAIA? | **fechada** — método inteiro, nenhuma peça de servidor | design K1–K4 |
| 2 | Que tamanho de acervo cabe num site estático? | **aberta** — a pesquisa estimou sem medir | tarefa 5.1 (medimos nós) |
| 3 | Que busca sustenta isso sem embeddings? | **parcial** — índice estático confirmado; eficácia não | design K2 + tarefa 5.2 |
| 4 | O que da norma BPMN 2.0 pode ser hospedado? | **aberta** — licença não confirmada | design K5 (gate de build) |
| 5 | Como impedir citação de trecho inexistente? | **fechada** — o aplicativo confere a chave | design K6 |

## Impact

- Depende de: `give-bpmn-assistant-an-agent-harness` (catálogo, política, despacho) e de F6
  fechada — `consultar_norma` é a segunda ferramenta de leitura, não a primeira.
- Afeta: o acervo novo, a ferramenta de consulta, o despacho (que passa a guardar as chaves
  servidas) e a seção do prompt que declara as duas fontes.
- Fase no roadmap: **FK**, depois de F6. Não bloqueia F7 nem F8 — um tutor sem citação é um tutor
  pior, não um tutor impossível.
