# Constituição do bpmn

> Princípios que valem para **toda** change deste repositório. Uma change que precise violar um
> princípio não é implementada antes de o princípio ser alterado aqui, com a razão escrita.
>
> Inspirada na constituição do `Infis/AgenteFinanceiro` (Spec Kit) e nas invariantes vivas do
> CopilotSpeaker/MAIA, reduzidas ao que um front-end estático de TCC realmente sustenta.
> Criada em 2026-11-12, depois que o MVP do ajudante entrou no ar e o trabalho passou a ser
> **o agente**, não mais o transporte.

> **Caminho atual:** `openspec/roadmap.md` (fases F1-F8, cada uma com portao de medicao).
> **Pendencias honestas:** `openspec/open-items.md`.

## I. Especificação antes de implementação

Toda mudança estrutural nasce em `openspec/changes/<nome>/` com **proposal** (por quê),
**design** (decisões com a alternativa recusada), **specs** (requisitos em SHALL + cenários) e
**tasks** (caixas verificáveis). Hotfix visual e correção de erro óbvio não precisam de change.

Divergência entre o código e a spec é **defeito da change**, não detalhe: resolve-se no artefato
antes de seguir.

## II. O produto é estático e a credencial é do visitante

Não há backend, não há banco, não há sessão de servidor. Tudo roda no navegador do aluno.

**A chave do modelo é dele** (BYOK): fica só na memória da aba, não é pré-preenchida, não é
compartilhada entre visitantes e some ao recarregar. Nenhuma chave de projeto pode existir — nem
em código, bundle, imagem, variável de build, documentação, log, print ou URL. Qualquer ocorrência
é vazamento, não configuração, e o CI varre os arquivos servidos a cada push.

Consequência para o agente: **memória, contexto e políticas vivem na aba** e morrem com ela,
a menos que uma change decida o contrário explicitamente e trate o risco por escrito.

## III. O MODELO decide a ação; o código decide o que é permitido

Ferramenta é escolhida por **function calling**, nunca por palavra-chave no código. É proibido
inserir detector de intenção que dispare ou roteie uma tool. O código determinístico perto de
ferramentas serve só para **segurança e endereçamento** (confirmação de ação destrutiva, a qual
elemento o pedido se refere) — nunca para despachar.

O catálogo é **default-deny**: o que é declarado ao modelo é exatamente o que a política permite.
Não existe segundo portão para divergir do primeiro.

> Herdado do CopilotSpeaker, onde a violação já custou regressões repetidas
> (`docs/wiki/concepts/tools.md`): *"Declarado = aplicado"*.

## IV. Prompt é contrato em camadas, não string concatenada

O prompt do sistema é montado por **seções tipadas**, cada uma com um papel declarado
(identidade, domínio, política de ferramentas, estado do diagrama, memória). Resolve-se o contexto
**uma vez**, projeta-se por perfil (voz × texto), e **um único renderizador** emite o texto final —
voz e texto renderizam a mesma prosa para não divergirem.

Persona é **estável** (cacheável); contexto e memória são **voláteis** e ficam abaixo do limite de
cache. Modelo de referência: `docs/wiki/concepts/prompt-assembly.md` do CopilotSpeaker.

## V. Honestidade sobre o que foi medido

Afirmação sobre comportamento exige medição. "Funciona" sem prova é hipótese.

- Camada determinística → teste `.mjs` que roda em `npm test`, sem rede e sem chave.
- Comportamento na tela → cenário em `tools/battery.mjs`, que abre o navegador e verifica sozinho.
- Caminho que precisa do Gemini → cenário **AO VIVO**, que só entra quando há `.env` com chave.

Degradação conhecida é dita (ex.: fala sintética não é voz humana). Caixa marcada sem prova é
proibida; `[~]` existe para "parcial, e aqui está o que falta".

## VI. O agente não fala de qualquer coisa

O ajudante é de **BPMN e do diagrama aberto**. Fora disso, recusa em uma frase e oferece o que
sabe fazer. Isso é requisito de produto, não preferência de estilo: o site é público, qualquer
pessoa entra, e a conta que paga é a do próprio visitante.

Recusa é **declarada no contrato do prompt** e verificada por cenário — nunca deixada ao acaso da
temperatura do modelo.

## VII. O que o agente altera, o aluno vê e desfaz

Toda ação que mude o diagrama acontece pelo `modeling` do bpmn-js (não por manipulação de XML por
fora), de modo que entre na pilha de **undo/redo** do modelador. O aluno sempre pode desfazer com
Ctrl+Z o que o agente fez.

Ação destrutiva (apagar elemento, substituir o diagrama) exige confirmação explícita na interface
antes de executar.

## VIII. O viewer é somente leitura

`/viewer.html` carrega um `NavigatedViewer`: ali o agente **explica, mede e aponta**, mas não
edita. Ferramenta de escrita só existe no modelador (`/index.html`). Declarar ao modelo uma
ferramenta que a página não pode executar é defeito de catálogo.

## IX. Economia de token é parte do desenho

Cada seção do prompt tem orçamento. Contexto do diagrama é **projetado** (o que importa para a
pergunta), nunca o XML inteiro despejado. A cota é do aluno: desperdício é custo real dele.

## X. Nada regride o que já está no ar

O modelador, o viewer e a simulação em lote continuam funcionando exatamente como hoje. O ajudante
falha **sozinho** (`try/catch` na montagem) — defeito no agente nunca leva o produto junto.
