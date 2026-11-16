# Pesquisa — como nomear o agente, como medir a frase e como não prender ninguém

> Pedido do dono (2026-11-16): *"estude antes de implementar a melhor forma de fazer"*. Feita nesta
> sessão por busca na web, com as medições na própria página ao lado — porque metade das perguntas
> desta rodada **não se responde por fonte**, e sim medindo o que a nossa interface corta.

## 0. Honestidade sobre as fontes

| Peso | Fontes |
|---|---|
| **Forte** | a diretriz de acessibilidade cognitiva do W3C (padrão, não opinião); as nossas próprias medições na página (número, não citação) |
| **Médio** | guias de design system de fornecedor sobre redação de IA (Genesys, Siemens, SAP) — é o que eles padronizaram, e isso vale mais que um blog, mas ainda é parte interessada |
| **Fraco** | listas de "tendências de onboarding 2026" e blogs de naming. Usei **um** achado daí, e só porque ele repete o que a rodada anterior já havia medido |

## 1. O limite de uma sugestão é o que a SUA interface corta

A regra de bolso que as fontes dão: **3–6 palavras**, até ~20–25 caracteres, e verbo na frente
quando a sugestão dispara uma ação. O limite duro de 25 caracteres vem do Google Assistant (que é
legado) e os 20 de um guia de design; os números divergem porque são de produtos diferentes. A
observação útil, e que eu adotei, é a do próprio resumo: **o limite confiável é aquele em que a sua
interface trunca.**

**Decidiu:** medi o compositor em vez de copiar número de fonte — 317 px, uma linha, corta em 33
caracteres (`design.md` N2). A frase do dono tinha 47 e vinha cortada. O teto virou teste, não
recomendação.

## 2. Nome de PAPEL, e "IA" fora do nome

Convergência entre as fontes de design system e as de naming: um nome **carrega um papel e define
expectativa** — "um assistente de IA genérico é uma feature que ninguém lembra"; a Genesys
padroniza manter **"AI" fora do nome** da feature, usando papel ("Virtual Agent", "Agent Copilot");
a Addepar separou a **categoria** do produto do **nome** do assistente; e a recomendação recorrente
é escopar o assistente ao produto em vez de deixá-lo parecer um chatbot de uso geral.

**Decidiu:** `Tutor BPMN` — papel ("tutor" é literalmente o que o dono pediu deixar claro: ensinar),
escopo no nome ("BPMN"), sem "IA" dentro dele; a capacidade vai na frase ao lado, onde ela informa
em vez de inflar. E, sobretudo: **uma fonte só** para o nome, porque o defeito que o dono viu
("repetido 3 vezes") era sintoma de três nomes soltos (`design.md` N1).

## 3. Sempre dá para voltar — e o controle de volta mora na moldura

A diretriz de acessibilidade cognitiva do W3C ("Let Users Go Back") diz para **sempre** permitir
retornar a um ponto anterior, e lista como antipadrão o desenho que dificulta a volta. Os relatos
de produto apontam para o mesmo lugar: um gerenciador de modelos embutido na tela inicial **sem
caminho de volta** ao painel anterior; e a correção proposta num editor de CMS é fazer o botão de
voltar devolver à **lista**, como já acontece no resto do produto. O conselho prático que fecha o
assunto: manter um controle **persistente e rotulado na moldura do editor**, que devolva ao
seletor sem perder trabalho não salvo.

**Decidiu:** a âncora permanente (`design.md` N3) e, junto, a saída do convite (N4) — "sem perder
trabalho não salvo" é a metade que faria o botão novo virar armadilha nova. A posição dela saiu de
medição dos quatro cantos nos dois tamanhos, não de preferência.

## 4. Uma tela, uma ideia, uma ação

Do levantamento de primeira execução de 2026: *um* visual que carrega a ideia, *uma* ação principal
com a alternativa quieta ao lado, e a disciplina de **uma ideia por tela** — "quando uma tela tenta
explicar três coisas, ninguém lê nenhuma". A primeira tela deve responder **o que é isto / como me
ajuda / o que eu faço agora**. E, sobre oferecer caminhos: *recomende um sem fingir que é o único
válido; um default só reduz esforço quando a alternativa continua legível e recuperável.* A mesma
revisão diz, em uma linha, o defeito que o dono relatou: **nunca prenda a pessoa num fluxo sem
saída clara.**

**Decidiu:** N7 (um visual, hierarquia de verdade, nome uma vez) e N4 ("recuperável" é o convite
poder ser fechado). Peso baixo nesta fonte — ela confirma o que a rodada anterior já havia medido,
e não foi usada para decidir nada sozinha.

## 5. O que a pesquisa não resolve

- **Se `Tutor BPMN` é o melhor nome.** Nome se valida com gente, não com fonte. O que a pesquisa
  sustenta é a **forma** (papel, sem "IA", escopado ao produto) e a fonte única; a palavra é
  decisão do dono e troca-se numa linha.
  **FECHADO em 2026-11-16: o dono viu o nome na tela e decidiu — "fica assim".** Fica registrado
  aqui porque esta linha dizia que a escolha ainda era dele; quem ler depois precisa saber que ela
  foi feita, e não ficou esquecida. Trocar continua custando uma linha (`assistant/identidade.js`).
- **Se a âncora é descoberta.** Ela é permanente, rotulada e está na moldura — que é o que a
  diretriz pede. Se é notada no primeiro minuto, só teste com aluno diz, e não há telemetria (nem
  vai haver: o produto é estático).

## Fontes

- [W3C WAI — Cognitive Accessibility Pattern: Let Users Go Back](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p02-back-undo)
- [Genesys — AI writing guidelines](https://spark.genesys.com/latest/foundations/ai-foundations/ai-writing-guidelines-3y4Jk1Ag-3y4Jk1Ag)
- [Siemens iX — Conversational design: wording and terms](https://ix.siemens.io/docs/guidelines/conversational-design/essentials/wording-terms)
- [SAP — UX writing for AI](https://www.sap.com/design-system/hcm/getting-started/ux-writing/usage)
- [Addepar — Naming our AI assistant, Addison](https://addepar.com/blog/naming-our-ai-assistant-addison)
- [LogRocket — I've designed AI assistants: here's what actually works](https://blog.logrocket.com/ux-design/ive-designed-ai-assistants-heres-what-actually-works/)
- [Google — Conversation design: chips](https://developers.google.com/assistant/conversation-design/chips)
- [shapeof.ai — Suggestions](https://www.shapeof.ai/patterns/suggestions)
- [WordPress Gutenberg — back button should return to the template list](https://github.com/WordPress/gutenberg/issues/31591)
- [LibreOffice — template manager has no way back to the Start Center](https://bugs.documentfoundation.org/show_bug.cgi?id=83003)
- [ScreensDesign — app onboarding trends 2026](https://screensdesign.com/articles/app-onboarding-trends-2026/)
