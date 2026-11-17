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

> ⚠ **Como um princípio daqui se chama: pelo MECANISMO, nunca pela forma do exemplo que o
> gerou.** Dois nasceram errados no mesmo dia (2026-11-16) e foram alargados em menos de 24 h
> pela outra sessão: *"passe o caminho"* (forma) era na verdade *"pathspec lê a árvore"*
> (mecanismo), e *"negação anda em par"* (forma) era *"o vazio satisfaz a cláusula"*. Nos dois
> casos a regra estava **certa dentro do caso medido** e errada um passo fora — o erro não foi
> medir pouco, foi batizar pelo sintoma. Nome pela forma envelhece com o primeiro caso novo;
> nome pelo mecanismo cobre os casos que ainda não aconteceram.
>
> ⚠ E o nome pelo mecanismo **não sai na primeira vez**, por um motivo que vale saber: na hora
> de escrever, o mecanismo ainda é abstração e o sintoma é a coisa que acabou de doer. Daí a
> regra prática: **batize na SEGUNDA vez que o princípio for usado**, quando existe um segundo
> caso para o nome ter de cobrir — e, até lá, aceite que o título é provisório. O §XI foi
> batizado pela forma **duas vezes seguidas**, inclusive na renomeação que deveria ter
> consertado isso.

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

## XI. Commit por caminho lê a ÁRVORE; commit por índice lê o que você estagiou

Duas sessões trabalham neste mesmo diretório ao mesmo tempo, e o índice do git é **um só**.
`git add -A` e `git commit` sem caminho varrem o que a outra sessão deixou staged: o trabalho
dela entra num commit cujo texto fala de outra coisa. Aconteceu duas vezes em 2026-11-15 — a
segunda levou uma feature de interface inteira para dentro de um commit chamado `docs(pdf)`.

Então: **stage por caminho** (`git add -- <arquivos meus>`) e, antes de commitar, `git status`
para conferir que não há nada de terceiro staged.

⚠ **E aí vem a parte que esta regra dizia errado até 2026-11-16.** Estava escrito que
`git commit -- <arquivos meus>` *"ignora o resto do índice"*. Ignora — e pega a **ÁRVORE**
naqueles caminhos, não o que você estagiou neles. A diferença não aparece quando o arquivo é
só seu, e morde exatamente quando não é: a outra sessão mexeu no MESMO arquivo, você estagiou
só os seus trechos com `git apply --cached`, e o commit levou os dela junto assim mesmo
(medido: 88 inserções onde o índice tinha 34). Então:

- **arquivo inteiramente seu** → `git commit -F <msg> -- <arquivos meus>`. O caminho diz o que
  entra, e nada do índice alheio vai junto;
- **arquivo que a outra sessão também está editando** → estagie os seus trechos e commite
  **pelo ÍNDICE**: `git commit -F <msg>`, **sem** pathspec. É a única forma de o commit conter
  os seus hunks e só eles.

Pegou no `--stat` depois de commitar e antes de empurrar? `git reset --mixed HEAD~1` desfaz o
commit **sem encostar na árvore** — os arquivos do outro voltam intactos — e aí se refaz pelo
índice. Conferir o `--stat` antes do push é o que transforma essa topada em nota de rodapé.

⚠ A ordem das opções não é livre: **tudo o que vem depois do `--` é pathspec**. Então
`git commit -- <arquivos> -F -` falha com *"pathspec '-F' did not match any file(s)"*; o certo é
`git commit -F - -- <arquivos>`. As duas sessões tropeçaram nisso no mesmo dia, e a topada
é pior do que parece: ela acontece **depois** de a pessoa ter feito a coisa certa, e convida a
desistir da regra.

Nada se perde quando isso falha — o que se perde é a **mensagem**, e aqui ela não é detalhe: é a
evidência de método que o texto do TCC cita. Commit cuja mensagem não descreve o diff é um
registro que mente para quem vier ler.

Duas regras irmãs, da mesma convivência: **o script de teste e o arquivo que ele roda vão no
MESMO commit**, e **quem commita por índice privado (`GIT_INDEX_FILE`) ressincroniza o índice
compartilhado logo depois** — senão os blobs velhos que sobram no índice revertem o commit do
outro sem conflito nenhum.

## XII. Passo de prova não leva barra invertida

Todo passo da bateria (e do `drive-page`) é um **template literal**: o JS resolve os escapes DELE
antes de o texto chegar à página. \s vira `s`, \d vira `d`, \. vira ponto-qualquer-coisa — e uma
**crase** fecha o literal no meio do passo.

O caso da crase dá `SyntaxError` e se conserta em um minuto. O outro é que importa: **não dá erro
em lugar nenhum**. A regex continua válida, só passa a casar com outra coisa — quase sempre com
nada. E portão que não casa com nada **não reprova**: fica verde medindo o vazio, que é o pior
estado possível de uma prova, porque ensina a confiar nela.

Três vezes numa semana, nas duas sessões: a classe de dígito no número de replicações da
simulação (lida como zero), a classe de espaço no texto do acervo, e a crase num comentário
dentro do passo. Nenhuma foi por desconhecer a armadilha — as duas sessões já a conheciam.

⚠ **A auditoria que esta regra provocou achou TRÊS vivas no mesmo arquivo**, no dia em que ela
foi escrita — todas em portões ao vivo, todas verdes há semanas: um campo de relatório que
reportava `n/d` desde sempre; um `split` que partia o nome do elemento **na letra s** em vez
de no espaço (*"assar a pizza"* virava `["a", "ar a pizza"]`); e, a pior, a classe de espaço
no portão de **injeção**, que deixava de pegar uma resposta começando com espaço antes de
OWNED — exatamente o caso que aquela alternativa existe para pegar. Nenhuma delas reprovou
nada, nunca: é a assinatura do defeito.

As duas saídas, as duas em uso no repositório:

- **não usar regex**: `split`, `includes`, `startsWith`. É o que o portão do acervo faz desde que
  isso o pegou, e quase sempre é mais legível do que a regex que substituiu;
- **dobrar a barra** no fonte (`\\[object` aqui chega como `\[object` na página).

E não escreva crase dentro de um passo — nem em comentário.

⚠ **A crase agora TEM guarda** (quarta vez, 2026-11-17): `npm run test:sintaxe` roda
`node --check` na bateria e nos dois drives, e entra na frente da suíte. Não resolve a classe
inteira — só a crase, que é a metade que dá `SyntaxError` — mas custa 0,2 s e pega antes de a
corrida começar, em vez de no meio de um cenário ao vivo. A lição é a da própria quarta vez:
**regra escrita não impediu**. Quando um defeito volta pela terceira vez, o próximo passo não é
escrever a regra melhor — é achar a metade dele que uma máquina consegue checar, e checar.

⚠ **Por que não há uma guarda mecânica para a OUTRA metade** (a barra consumida em silêncio), e a
tentativa está registrada: em tempo de
execução a informação já se perdeu (a barra foi consumida ao carregar o arquivo), então a guarda
teria de ler o próprio fonte e distinguir o que está dentro de um template literal — e o
separador é a mesma crase que aparece em comentário e em markdown no arquivo inteiro. Um
analisador de verdade seria mais código (e mais falso positivo) do que o defeito que ele pega, e
guarda que grita à toa ensina a ignorar guarda. Se um dia valer a pena, o caminho certo não é
analisar: é escrever os passos com `String.raw`, que **não** processa escape nenhum — aí a
armadilha deixa de existir (e as barras dobradas de hoje passam a ser dobradas de verdade, que é
o que torna a migração uma frente, e não um sed).

## XIII. Cláusula que o VAZIO satisfaz não prova nada

*"Não achei nada de errado"* e *"não havia nada para achar"* são **indistinguíveis de fora**. Por
isso toda asserção negativa de um portão passa de graça no mundo em que o objeto dela nunca
existiu — e esse mundo é exatamente o que a gente mais precisa pegar, porque é o que acontece
quando uma entrega inteira some.

⚠ **E esta regra nasceu estreita.** Ela se chamava *"negação anda em par"* e durou meio dia:
na geometria o vazio satisfaz **afirmações** também. *"A barra fica acima da alavanca"* é
verdade para uma barra invisível, porque `0 <= 682`; *"a barra cabe na tela"* também, porque
`0 >= 0`. **Caixa de área zero é o elemento perfeito: cabe em tudo, não cruza ninguém e fica
acima de todo mundo.** O que importa não é o sinal da cláusula — é **de que lado da comparação
cai o zero**. Negação é só o caso mais comum.

Quatro, achadas no mesmo dia (2026-11-16), nas duas sessões, e nenhuma por leitura: as quatro
só apareceram quando alguém quebrou o produto e olhou o relatório:

- **verdadeira por lista vazia.** `!fontes.some((f) => f.includes(chave))` — *"a chave crua não
  aparece na tela"* — é sempre verdadeira quando **não há fonte nenhuma** na tela. A cláusula que
  existia para proteger a proveniência estava aprovando a tela SEM proveniência. Medido: quebra da
  proveniência saiu `fontesNaTela: []` com `semChaveCrua: true`;
- **verdadeira porque nunca nasceu.** `!document.querySelector('.pv-barra')` — *"a orientação sumiu
  depois da primeira edição"* — é também verdadeira se a orientação **nunca apareceu**. Medido:
  com a barra devolvendo `null` sempre, o cenário inteiro ficava verde enquanto a entrega da
  rodada anterior não existia mais;
- **verdadeira porque a caixa tem área zero.** Em portão de GEOMETRIA o objeto pode existir no
  DOM e **não existir na tela**: elemento escondido continua respondendo a `querySelector`, e
  `getBoundingClientRect` devolve **0×0 em 0,0 sem reclamar**. Caixa de área zero não sobrepõe
  ninguém e não é atravessada por nada — então *"não sobrepõe"* e *"nenhuma seta a atravessa"*
  ficam verdadeiras no mundo em que o elemento sumiu. É vazio disfarçado de coordenada, e foi
  medido nas duas sessões no mesmo dia: a paleta em `display:none` aprovando *"a âncora não
  cobre a paleta"*, e, aqui, *"Assar a pizza"* de 93×78 virando 0×0 — `antigaAprovaria: true`,
  `novaAprovaria: false`.

- **verdadeira porque o zero cai do lado certo.** `barra.bottom <= alavanca.top` e
  `barra.top >= 0` são duas AFIRMAÇÕES, sem negação nenhuma, e o elemento oculto satisfaz as
  duas. Medido: `{existeNoDom: true, caixaDepois: "0x0 em 0,0", acimaDaAlavancaANTIGA: true,
  barraCabeANTIGA: true}`.

São a mesma doença em tempos e dimensões diferentes: a primeira ignora o **objeto**, a segunda
ignora o **antes**, a terceira e a quarta ignoram o **tamanho** — uma por negação, outra por
afirmação. Então:

**Toda cláusula que o vazio satisfaz anda em par com a afirmação de que o objeto existe — e,
na tela, de que ele tem área.** As formas do par, todas em uso aqui:

- **no mesmo instante**: `!texto.includes(inventada) && /fonte não conferida/.test(texto)` — não
  basta a marca errada ter sumido, a troca tem de estar lá;
- **antes e depois**: `rotuloApareceu` medido ANTES do desfazer, `!rotuloSobrou` depois. Sem a
  primeira metade, *"o rótulo não sobrou"* aprovaria um rótulo que nunca foi criado.

⚠ E quando o par não cabe na cláusula, ele cabe no **medidor**. As respostas de geometria
(`__sobrepoe`, `__linhaAtravessa`) deixaram de devolver lista vazia para um elemento sem área:
devolvem um marcador nomeado e **não-vazio** (`SEM-CAIXA:<id>`, `SEM-ELEMENTO:<id>`), que
reprova em toda comparação de tamanho zero que já existia — dezesseis delas, sem tocar em
nenhuma. Consertar no instrumento vale mais que lembrar em dezesseis lugares: a memória de
quem escreve o próximo portão não entra na conta.

E o teste da regra é mecânico, não é leitura: **faça o objeto não existir** (a lista vazia, o
elemento que nunca nasce, a forma que some da tela) e veja se a cláusula ainda passa. Se passar,
ela nunca provou nada — e revisão humana não pega isto, porque ler uma cláusula dessas dá a
sensação de segurança que o código não tem.

⚠ **E, nas quatro, o relatório já tinha dito.** `caixa: "0x0"`, `fontesNaTela: []`,
`ofereceContinuar: false`, `formas: 0` — todos eram campos impressos há semanas, ao lado de um
`ok: true`. Nenhuma das quatro precisava de instrumento novo para ser vista: precisava de
alguém lendo a **linha inteira**, inclusive os campos que não estavam sob suspeita. Daí a
segunda metade da regra, que é de leitura e não de escrita: **o relatório de um portão se lê
todo, e um campo zerado ao lado de um verde é uma pergunta** — não um detalhe de formatação.
Portão que imprime pouco esconde isso de graça: imprima o número, não só o veredito.

## XIV. Conserte o INSTRUMENTO, nunca o produto, quando quem errou foi a medida

Portão vermelho é uma afirmação sobre o produto, e ela pode estar errada. Antes de mexer no
produto, pergunte se a MEDIDA está certa — porque consertar o produto para agradar um
instrumento quebrado é o pior resultado possível de uma corrida: o defeito real continua lá, e
agora há um conserto errado em cima dele.

Três vezes em dois dias, as três no mesmo dia em que a regra foi escrita (2026-11-17):

- **Contêiner contado como órfão.** O portão do gateway reprovou com
  `orfaos:["Participant \"Suporte\""]` enquanto a decisão tinha os dois caminhos rotulados. Pool
  e raia **não se ligam a nada por definição** — eles contêm o fluxo. "Órfão" é nó de fluxo sem
  entrada nem saída, e a definição do instrumento estava mais larga que o conceito.
- **Nó de DOM órfão.** O portão lia "6" onde a tela dizia "5": quando a lista encolhe, o painel
  redesenha tudo (`replaceChildren`) e o nó capturado antes fica fora da árvore, mostrando o
  número velho. Medir um passado que já saiu da tela. Quem re-consulta o DOM é o portão.
- **Medir o RÓTULO quando o produto decide pelo ESTADO.** O portão ao vivo dizia que o selo
  *desenhando* não existia, lendo o texto da tela. Lido o estado, apareceu o defeito de verdade
  — outro, e pior (principio XV). Medir só o rótulo confunde *"o selo não existe"* com *"a tela
  não pintou"*; medir só o estado perderia o defeito de tela. **O portão afirma o estado e
  REPORTA o rótulo**, e divergir entre os dois é defeito que tem de aparecer no relatório.

Como saber de qual lado está o erro, sem adivinhar: **leia o resto do veredito**. Um instrumento
errado reprova no meio de um relatório que, no restante, está dizendo que deu certo — dois
caminhos, dois rótulos, zero sobreposição, e um "órfão" que é um pool. É por isso que portão
imprime o número, e não só o veredito.

E a contrapartida, que é o que torna isto uma regra e não uma desculpa: **ajustar o pedido do
portão para ele passar é proibido** — a não ser quando o que você tira é ambiguidade que **outro**
portão mede. Na mesma corrida, o pedido do gateway ganhou "num pool novo chamado Suporte" porque
o agente perguntava, com razão, em qual dos dois pools desenhar — e ambiguidade de lugar tem
portão próprio (o do candidato clicável). Quem tira ambiguidade **escreve no portão qual outro
portão cobre o que ele deixou de cobrir**; sem essa frase, "tirei a ambiguidade" é só o nome
bonito de ajustar o teste ao defeito.

## XV. Estado que a tela mostra tem de SOBREVIVER ao que ele descreve — e morrer com ele

Um selo é duas promessas: ele aparece enquanto a coisa acontece, e **sai quando ela termina**.
Quebrar qualquer uma das duas custa mais do que não ter selo nenhum, e as duas quebras são
silênciosas — nenhum teste de "o estado foi setado" pega nenhuma delas.

As duas aconteceram no mesmo dia (2026-11-17), ao separar *desenhando* de *consultando*:

- **Preso.** A volta do estado estava escrita em DOIS lugares, e um deles conhecia só
  `consultando`: escrita que recusa (ambiguidade, portão) nunca devolvia o selo. E selo preso
  aqui não é cosmético — ele **trava a tela**: `escolherCandidato` só aceita clique em estado de
  conversa, então o aluno clicava no botão que o agente acabou de desenhar e ouvia *"conecte
  antes de escolher"*, com a sessão aberta. Conserto: a lista de "estou no meio de uma
  ferramenta" passou a ter **uma fonte**.
- **Instantâneo.** Numa construção de oito elementos o estado `escrevendo` **nunca** foi
  observado — nem amostrando a tela a cada 120 ms — porque a nossa escrita no bpmn-js é
  **síncrona** (mediana medida: 0,01 s). O selo nascia e morria no mesmo passo do laço de
  eventos. Selo que existe por microssegundos não é feedback, é contabilidade interna.

Daí a regra: **operação instantânea precisa de selo com tempo mínimo de LEITURA** (700 ms aqui),
e operação lenta **não** precisa (esticar o selo de leitura, que leva tempo de rede, seria mentir
sobre o presente). E a espera nunca pode custar o gesto do aluno: **agir prova que ele leu**,
então o clique dele encurta o selo em vez de ser recusado por ele.

Como se mede isto, porque não se mede olhando: amostre o estado em laço durante a operação
(nunca antes e depois), e afirme as duas metades — **apareceu** e **saiu sozinho**. Um teste que
só afirma que o selo volta aprova o selo instantâneo; um que só afirma que ele aparece aprova o
selo preso.

## XVI. Teto de cota é por DIA e por MODELO: um pedido por unidade natural não cabe

O recorte natural de uma peça falada é o parágrafo, e por isso o narrador pedia um áudio por
parágrafo — 28 pedidos numa peça. O teto gratuito do TTS, medido na resposta do próprio servidor
(2026-11-17), é `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, **`quotaValue: 10`**: dez
pedidos por **dia** e por **modelo**, com `retryDelay: 7590s` (a virada do dia no fuso do
Google). A peça morria no terceiro parágrafo, e o sintoma chega como *"o TTS está fora"*.

Duas consequências que valem para qualquer serviço medido assim:

- **Agrupe até o limite de ENTRADA, não até o recorte bonito.** O limite de entrada do modelo é
  muito maior que um parágrafo: blocos de ~1500 caracteres não custam qualidade, custam menos
  junta — e a peça passou de 28 pedidos para 5. Recuo exponencial **não** resolve teto diário:
  ele transforma uma falha rápida numa lenta.
- **O balde é por modelo.** Com o do canônico gasto, o irmão não-lite tem o próprio — então
  existe `--modelo`. Trocar muda a voz um pouco, e **quem troca diz no registro qual usou**:
  nunca implícito, porque a próxima pessoa vai comparar duas peças e achar que a voz regrediu.
