# O que está em aberto

> Levantamento honesto do caminho percorrido até 2026-11-12, antes de virar para o harness do
> agente. Feito porque "está tudo pronto" seria mentira: o MVP fechou, mas deixou pontas — umas
> do dono, outras minhas, outras que só o uso vai fechar.
>
> Atualize esta página na mesma change que fechar um item. Item fechado sai daqui e vira linha de
> `tasks.md` com a prova.

## 0. O que está pendente HOJE — tudo numa tabela só (2026-11-16)

> Esta página cresceu por rodada, e quem chega agora não quer ler onze seções para descobrir o que
> falta. **Esta tabela é a lista completa do que está aberto**; o resto do arquivo é o registro de
> como cada coisa foi descoberta e fechada, e continua valendo como método.
>
> Três colunas de dono, e a diferença entre elas importa: **estacionado** é decisão tomada de
> deixar para depois; **declarado** é prova que existe onde a decisão é nossa e não existe onde
> dependeria do mundo; **meu** é trabalho que eu faço quando valer a pena. *"Ninguém decidiu"* não
> é nenhuma das três, e não aparece aqui.

| # | Pendência | De quem | Por que não bloqueia |
|---|---|---|---|
| **D1–D5** | Publicação definitiva: domínio, DNS, secrets do Actions, ambiente `production`, rollback ensaiado | **dono — estacionado** (*"isso não precisamos agora"*) | o site publica a cada entrega no endereço provisório e serve tudo |
| **F8b** | A pedagogia do tutor: quando propor e quando calar, como explicar a escolha de representação, quanto corrigir de uma vez | **dono — estacionado**, para elaborar com o orientador | a **mecânica** está pronta e provada: a proposta fica recusada até o aluno responder, e a tela é lida de volta a cada escrita |
| **K-G** | Declarar no texto a licença do `bpmn-js` e a marca d'água que não pode ser removida | **dono — banca** | o software já cumpre: o portão mede que o painel não cobre a marca. O que falta é a frase no texto |
| **K-E** | Frente acadêmica: modalidade do TCC, prazos, exigências do orientador, ABNT | **dono — com o orientador** | o software é a parte prática e segue sem isso |
| **F.5** | Memória durável entre visitas | **dono — estacionado** (*"também podemos ir vendo"*) | a memória morre com a aba **por escolha**, e o aviso de privacidade diz isso |
| **F.2** | MCP | **dono — fora do MVP** | nada do trabalho depende disso hoje |
| **M5** | Expiração de sessão por idade (`go-away`, ~10 min) vista ao vivo | **declarado** | o quadro é reconhecido e registrado no diário; e desde que a sessão parada passou a **dormir**, ela nem chega a envelhecer |
| **6.3** | Ao vivo: induzir o modelo a citar uma chave inexistente | **declarado** | provado no gerente, que é onde a troca por `[fonte não conferida]` acontece. Ao vivo gastaria sessão para medir o que o nosso código decide sozinho |
| **—** | Queda de **rede física** (cabo, Wi-Fi do aluno) | **declarado** | nenhuma ferramenta do navegador a produz (medido: `offline` do CDP não derruba socket aberto). A queda que acontece de verdade — a do servidor — **está** provada ao vivo |
| **T13** | A sobreposição medida ignora **rótulo** | **meu** | como o próprio bpmn-js, o medidor só compara formas |
| **T18** | *"Arruma o desenho"* — layout automático de verdade | **meu — frente nova** | `alinhar` resolve dois ou três elementos, que é o pedido real do aluno hoje. E o bpmn-js **não tem** layout automático: escrever um é grafo em camadas, raias e rótulos — uma frente, não uma ponta. Fica escrito aqui para não parecer esquecimento |
| **E2** | Sugestão proativa ao abrir um diagrama com problema | **meu — frente nova** | é capacidade a mais, não conserto de nada; e o limite pedagógico dela é o F8b, que está com o orientador |
| **—** | Os portões de **microfone** não rodam no CI: a fala gravada vem do SAPI do Windows (`npm run voz`) e o git não guarda `.wav` | **declarado** | o cenário que precisa de fala gravada e não a tem fica **fora**, dito em voz alta, em vez de passar medindo o tom sintético do Chromium. Aqui ele roda a cada rodada |
| **5.1 / 5.2** (trilhas) | Partidas por histórico de quem volta · medir se a orientação da primeira visita funcionou | **declarado — fica fora** | a primeira depende de memória entre visitas, que foi decidida em contrário; a segunda exigiria telemetria, e não vai haver. Ficam escritas para ninguém as "descobrir" como esquecimento |

### 0b. A rodada das pontas minhas (2026-11-16)

Cinco itens «meus» saíram da tabela acima. O que cada um era, e o que a prova diz:

**2.4 — o teto do `clientContent`, medido.** `tools/medir-contexto.mjs` nunca tinha corrido.
Correu: quadros de 4, 16, 64, 128, 256 e **512 KB** foram todos ACEITOS, com a sessão
respondendo depois de cada um (o de 512 KB em 2 ms). O degrau de 1 MB fechou o socket — e aqui
está o ponto: fechou com `1011 You exceeded your current quota`, que é **cota, não tamanho**.
Então o número honesto é *"não achei teto até 512 KB"*, e não *"o teto é 1 MB"*. Para
comparar: o nosso quadro tem teto **por construção** de ~2,1 KB (as duas únicas seções voláteis,
`diagrama` e `memoria`, têm teto de 1400 e 700 caracteres em `agent/sections.js`). O servidor
aceitou **mais de 240 vezes** o maior quadro que o produto consegue mandar. Registro:
`artifacts/medida-clientcontent.json`.

**T12 — era "dois `Ctrl+Z`" e a medição disse SETE.** A dívida estava otimista, e o portão novo
mediu contra o bpmn-js de verdade: criar um gateway chamado *"Pagou?"* no meio de um fluxo
custava **7** desfazeres. O aluno que dizia *"desfaz isso"* via o agente desfazer um roteamento
de seta e anunciar que havia voltado atrás. Duas causas: o nome vinha num comando à parte
(agora entra no **businessObject da forma**, antes de ela entrar — e aí o `LabelBehavior` do
bpmn-js cria o rótulo externo de evento/gateway dentro do MESMO comando) e, a que pesava, os 4 a
6 `layoutConnection` que endireitam a vizinhança rodavam **de fora**, cada um virando um
`Ctrl+Z`. Passaram a rodar dentro do `shape.create`, que é o mecanismo dos próprios
comportamentos do bpmn-js (comando aninhado herda o id da ação; `undo()` reverte o grupo).
Medido depois: **1**.

**E1 — desfazer em bloco, fechado por outro caminho.** A ideia era guardar a marca da pilha no
início da época do turno. Não foi preciso: `criar_elemento` devolve `comandos` **contado** no
`commandStack.changed` do próprio bpmn-js, e `desfazer` aceita `quantos` (1 a 10) devolvendo
quantos voltaram DE FATO. Pedir 9 numa pilha de 1 não é erro, e dizer "desfiz 9" seria assinar
o que não aconteceu. O teto de 10 existe porque a pilha é a **mesma** do aluno: lote maior
apagaria trabalho que o agente não viu.

**T3 — o viewer deixou de ser provado só "carrega".** O portão novo roda a **simulação em lote**
com o painel aberto, usando o cenário do produto (`simulations/pizza-collaboration.sim.json`, 30
replicações) — e não um cfg inventado no teste, que mediria o motor contra números que o aluno
nunca usa. Quatro fatos: a corrida conclui e marca o desenho (18 elementos com marca de
heatmap), o canal `(da página)` avisa o modelo — o agente **comenta** a corrida, nunca a dispara
—, `resumir_simulacao` responde o MESMO número que a barra mostra, e escrever segue recusado
(`ferramenta_nao_permitida`).

**T5 — a bateria sem cota roda no CI**, contra a imagem que vai ao ar (29 cenários). Não precisa
de chave: o socket do Google é dublado. `--no-sandbox` porque o Ubuntu 24.04 do runner restringe
o sandbox do Chrome — sem a bandeira o navegador morre antes de abrir a porta, e o sintoma
parece falta de Chrome. Print de prova guardado só quando reprova. O que isto pega e nada mais
pegava: página que o build não copiou, CSS que some, botão que troca de nome, geometria que o
bpmn-js desenha diferente depois de um upgrade.

**T1 / T2 / T4 — higiene feita.** T1 e T2 já estavam consertados no arquivo e continuavam
listados como abertos (a linha `4.10` do MVP já diz que duplica a `2.13`; o `config.yaml` já fala
de `main`); T4 ganhou a nota de encerramento no `validation.md` do MVP. Item fechado que fica na
lista é pior que item esquecido: faz a lista inteira perder a credibilidade.

**E um número nosso que estava pela metade.** O `npm test` imprime *"N passed"* por suíte e,
à parte, *"+N assíncronos"*. Os relatórios citavam **560**, que é a soma só das linhas
síncronas — as **123** assíncronas (onde vivem as 66 provas das ferramentas de escrita) ficavam
fora da conta. É o mesmo buraco da dívida T10, uma camada acima: lá elas ficavam fora do
**veredito**, aqui ficavam fora do **número**. O total honesto é **683** (560 síncronas + 123
assíncronas), e é esse que os PDFs passam a dizer.

## 1. Portões do dono (publicação na VPS)

Nada aqui é código. O site **já está no ar** no endereço provisório
(<https://niu-tech.github.io/bpmn/>), então estes itens valem para a publicação definitiva, com
domínio, e não bloqueiam mais o uso pelo orientador.

| # | Item | Estado | O que falta exatamente |
|---|---|---|---|
| D1 | Domínio e DNS | aberto | registro A → IP da VPS. Desde 2026-11-11 o site serve sob prefixo de caminho, então subdomínio próprio deixou de ser obrigatório |
| D2 | Secrets do Actions | aberto | variables `SSH_HOST`, `SSH_USER`, `SSH_PORT`; secret `SSH_KEY` (+ `SSH_PASSPHRASE` se houver) |
| D3 | Ambiente `production` | aberto | não existe no repositório e o job de deploy **o exige** — sem ele o job nem começa |
| D4 | Primeira publicação na VPS | aberto | depende de D1–D3; o runbook é `deploy/README.md` |
| D5 | Rollback ensaiado | aberto | o runbook existe e nunca foi executado contra servidor real |

## 2. Medições que ficaram faltando

| # | Item | Estado | Por quê |
|---|---|---|---|
| M1 | Voz **humana** em microfone físico | **fechada pelo dono (2026-11-15)** | *"nós já fizemos testes com eu mesmo falando"*. E fizemos — as sessões de voz dele, ao longo das rodadas de reteste, são a única razão de quatro defeitos existirem no histórico: **a frase partida no meio** (o detector de fala do servidor fechava o turno no silêncio curto, e só uma pessoa de verdade pausa no meio de uma frase — a fala sintética não pausa), **o turno perdido enquanto ele falava** (a queda levava a fala junto e a tela não dizia nada), **os botões de mudo mortos durante a resposta** (o ícone era recriado a cada quadro de áudio e o clique nunca chegava) e **o "pensando" invisível**, que ninguém nota até ficar olhando uma tela parada depois de falar. Fala sintética não produziu nenhum dos quatro. ⚠ O que **não** existe é uma captura legível por máquina dessas sessões guardada no repositório: o que ficou é o relato dele nas rodadas de reteste (`openspec/apresentacoes/reteste-rodada-*.html`) e o conserto com o teste que o acompanha. Para o texto do TCC isso basta como *evidência de uso*, e não como medição — e é assim que deve ser escrito lá |
| M2 | Barge-in contra o Gemini | **PROVADO** (2026-11-12) | ver §3 — e o achado maior: o fluxo de audio governa o turno digitado |
| M3 | Negação de microfone | **fechada, e achou defeito (2026-11-15)** | o cenário no navegador existe (portão `microfone NEGADO` em `tools/battery.mjs`, sem cota: o socket é o dublê): `getUserMedia` recusa com `NotAllowedError` como o Chrome recusa quando a pessoa clica em **Bloquear**. A cadeia inteira está certa — `audio.js` traduz em `mic-denied`, o gerente nomeia, a tela diz *"microfone: o microfone foi negado"*, o microfone fica fechado e a faixa de voz ("Estou ouvindo") **não** aparece. **E o portão achou um defeito que a prova em unidade não pegava**: negar o microfone marcava a **SESSÃO** como `error`, e `error` desliga a caixa de texto — quem bloqueava o microfone perdia o ajudante inteiro, **inclusive o modo texto**, que não tem nada a ver com microfone (medido: `estado: error`, `podeEscrever: false`). O teste em unidade se chamava *"sem derrubar a sessao"* e não conferia isso. Agora o que falha é a ENTRADA DE VOZ: a sessão Live segue de pé (ela foi aceita antes do microfone), o aluno continua conversando por escrito, e só vira erro se a própria sessão tiver morrido. Provas: o portão no navegador (`podeEscrever: true`, `estado: ready`) e a prova em unidade, que passou a **medir** a promessa do próprio título |
| M4 | Desconexão no meio da aula | **exercitada e fechada (2026-11-15)** | a dívida pedia "cortar a rede de verdade", e cortar a rede de verdade **desmentiu a própria dívida**. `tools/probe-offline.mjs` pôs `Network.emulateNetworkConditions {offline:true}` numa sessão viva: `navigator.onLine` virou `false` na hora e **nenhum `ws.close` apareceu em doze segundos**; depois, com a rede fora por **cinquenta** segundos e uma pergunta no ar, o modelo **respondeu normalmente** — a emulação do CDP não alcança conexão já estabelecida. Portão que corta a rede e vê a conversa seguir não prova recuperação: prova que nada caiu. **A queda que acontece de verdade nesta aula é a do servidor**, e ela apareceu na mesma corrida: `ws.close code=1008 Session closed due to client inactivity` aos **74,5 s** e aos **119 s** de aluno calado — a MESMA queda que o dono levou **nove vezes** na trilha dele, e que terminava em *"o limite de sessões da sua chave foi atingido"* com a chave boa. **A causa era nossa**: fecho por inatividade caía no ramo de *vaga de sessão*, reabríamos na hora e íamos disputar a vaga do fio que acabara de morrer, nove vezes, até o teto. Dois consertos: (1) o fecho por inatividade faz a sessão **DORMIR** — zero socket, alça guardada, e o **próprio envio** do aluno a acorda retomando a mesma conversa; (2) com o navegador **offline** nenhuma reconexão é gasta: a sessão espera o evento `online` do próprio navegador (o teto de 3 tentativas com recuo de 500 ms se esgotava em **3,5 s**, então qualquer quedinha de Wi-Fi maior que isso matava a aula para sempre). **Prova ao vivo** (portão `a sessao cai de verdade` em `tools/battery.mjs`): o servidor fechou aos 119 s → estado `dormindo` → a pergunta do aluno acordou (`ws.acordar=1`) → `out.setup` = `["modo=texto", "modo=texto retomando"]` → e a resposta citou a primeira pergunta da aula **de volta do servidor** (no despertar o gerente **não** resemeia nada), com **`ws.vaga` = 0** e **nenhum** aviso de "a conexão caiu" na tela — despertar não é queda, e aviso que mente é aviso que o aluno aprende a ignorar. Provas determinísticas: `spike/__tests__/session.mjs` (dorme em vez de reabrir; o envio acorda COM a alça; offline não gasta tentativa; a rede voltando reabre sozinha) e `src/assistant/__tests__/session-manager.mjs` (dormindo a caixa de texto continua viva; o despertar não avisa queda nem refaz a pergunta). ⚠ O que **continua** sem prova ao vivo é a queda de rede física (cabo/Wi-Fi do aluno): nenhuma ferramenta do navegador a produz, e forçá-la exigiria pôr um proxy nosso no meio do caminho da sessão — costura de teste dentro do produto, que não se paga |
| M5 | Expiração de sessão (`go-away`) | aberto | o frame é reconhecido e registrado no diário; nunca foi visto ao vivo |
| M6 | Os cenários de VOZ ao vivo não eram confiáveis | **causa encontrada, conserto no ar (2026-11-13)** | não era cota nem o servidor: **o microfone do teste não tocava a fala**. Duas causas somadas. (1) As fixtures do SAPI têm o chunk `fmt ` com **18 bytes** e o leitor de WAV do Chromium quer os **16** canônicos — arquivo recusado, e o Chromium troca pelo **tom sintético** do dispositivo falso **sem avisar**. (2) O harness vazava navegador: **1305 `msedge.exe`** vivos com a marca `bpmn-drive-` nesta máquina, e nesse estado o microfone falso ignorava o arquivo de forma intermitente. O tom tem energia de verdade — era o pico **0,574** que eu lia como "a fala chegou" — e o Gemini não transcreve tom nem vê fim de fala: 879 quadros subindo para um turno que nunca fecha, socket saudável e mudo. Consertado em `tools/drive-page.mjs` (fixture reescrita com `fmt ` canônico + 4 s de cauda muda; recusa nomeada para fixture ilegível; navegador encerrado por perfil ao fim de cada corrida). Ver §3f |
| M7 | Quantas sessões ao vivo a chave aguenta em sequência | **medido e fechado (2026-11-15)** | `tools/medir-cota.mjs` abre sessões de verdade com o MESMO setup do produto e registra o que acontece com cada uma. O resultado desmente a suposição que estava aqui desde 2026-11-13: **não é cadência de abertura**. Seis sessões em sequência **sem pausa nenhuma** foram aceitas (618, 511, 1096, 505, 511, 1138 ms até o `setupComplete`), e **quatro simultâneas** também (566, 502, 498, 491 ms). ⚠ **A conclusão "é consumo" era um PULO, e foi corrigida na noite de 2026-11-15.** Derrubar cadência não prova consumo — e a corrida ao vivo das 33 perguntas desmentiu: a recusa aparecia na **ADMISSÃO** (fecho antes do `setupComplete`) **alternando com sucessos no MESMO minuto** (montagem recusou 2 às 06:02 e ambiguidade aceitou às 06:03), o que consumo do minuto não explica. É **vaga de sessão**: o plano gratuito limita quantas Live cabem **de uma vez por projeto** — a resposta oficial do Google ao caso idêntico é *"Free tier projects have a limit on concurrent Live API sessions"* ([discuss.ai.google.dev/t/…/186840](https://discuss.ai.google.dev/t/native-audio-live-free-tier-setup-quota-rejection-below-visible-tpm-which-admission-metric-applies/186840)) — e a vaga de um fio que morre **sem o quadro de fecho** demora para voltar (no mesmo relato, uma vaga ainda recusada ~66 s depois do fecho). **A causa de isso nos atingir era NOSSA**: toda corrida dirigida terminava matando o navegador (`drive-page.mjs`), processo morto não dispara `beforeunload`, nenhuma das 33 sessões era fechada, e com 20 s de descanso a corrida competia com as próprias sessões abandonadas. Conserto: `drive-page.mjs` chama `window.__bpmnAssist.encerrar()` (verbo novo, mesmo `teardown` do botão "Encerrar") e espera o fecho sair, antes de matar. **Prova: as tres perguntas que a cota havia recusado (montagem-pool, montagem-raia, ambiguidade-pool) passaram ao vivo no mesmo descanso de 20 s, 5/5, sem uma recusa.** O produto nunca teve o defeito — a aba do aluno fecha pelo `beforeunload`/`pagehide`, e trocar de modo passa por `teardown`. O rótulo da tela mentiu duas vezes ("ou há sessões demais", depois "consumo permitido neste minuto") e agora diz o limite certo + que fechar as outras abas do ajudante ajuda. Ordem de grandeza do consumo, medida ao vivo no mesmo dia: um turno de texto com o diagrama no contexto custa **5,7 k a 7,6 k tokens**, e cresce a cada turno (o contexto acumula) — três perguntas custaram ~20 k. ⚠ O próprio instrumento mentiu uma vez aqui: no Node o quadro chega como `Blob`, e ler só `string` fazia TODA sessão virar "sem resposta no prazo" — instrumento calado passando por servidor mudo, o mesmo modo de falha do M6 |
| K-F | Declarar, no texto do TCC, o que é reúso de trabalho anterior do autor | adiado para a fase de ESCRITA (decisão do dono, 2026-11-13) | a Trilha H traz código da `WikiAgentCapsule`, que é do próprio autor. Isso não bloqueia a implementação — bloqueia a **entrega escrita**: a metodologia precisa separar o que foi feito para o TCC do que foi reaproveitado, com a origem nomeada. Fica registrado agora para não ser lembrado tarde; resolve-se em um parágrafo, junto do K-E (orientador) |
| K-G | Declarar no TCC a licença do `bpmn-js` e a marca d'água | aberto (2026-11-14) | o `bpmn-js` **não é MIT**: a licença exige que a marca d'água do bpmn.io não seja removida, alterada **nem visualmente sobreposta**. O inventário de dependências achou isso na primeira execução — e **nós estávamos violando**: o painel do ajudante cobria a marca nas duas páginas (medido: marca em y=864, painel até y=886). Corrigido com um piso de 44 px na reserva do rodapé, declarado no código como exigência de licença. Falta a parte de TEXTO: dizer na dissertação que o trabalho usa `bpmn-js` sob essa licença e preserva a marca por exigência dela. Vai junto do K-F, na fase de escrita |
| T10 | O marcador `<no speech>` vazava um pedaço para a bolha | **fechado (2026-11-13)** | a legenda chega em PEDAÇOS e o filtro rodava em cada pedaço: `<no speech>` cortado ao meio não casava em nenhum dos dois e o rabo virava bolha (`"speech>"` no portão F6; antes dele, `"9<no speech>{pause}"` no F3 — era o mesmo bug, e o conserto anterior só cobria o marcador inteiro). Agora o filtro roda no ACUMULADO do turno e segura a cauda que ainda pode virar marcador. Ver §3g |

## 3. Barge-in: o que a medição mostrou — e o achado que ela trouxe

Cenário `AO VIVO: interromper o modelo falando por cima`, contra a URL pública.

**Primeira rodada** (pergunta DIGITADA, WAV de 9 s de silêncio + *"Espera, chega, responde só em
uma frase"*): o corte chegou aos 9 s e o modelo só começou a falar aos **15 s** — não havia
resposta para cortar. `ws.interrupted` = 0 era o teste medindo cedo, não defeito do produto.

**Segunda rodada**, com 16 s de silêncio: o modelo passou a falar aos **22,6 s**. O atraso
acompanhou o silêncio, e é isso que revela a causa:

> **Em modo voz com o microfone aberto, uma pergunta DIGITADA só é respondida depois de o
> servidor ver fim de fala no fluxo de áudio.** O áudio governa o turno.

Ou seja, era impossível fazer o modelo falar enquanto o WAV ainda tocava: a própria pergunta
digitada ficava na fila. A forma que funciona é a pergunta vir **pela voz**, com a frase de corte
num segundo trecho do mesmo arquivo (`tools/wav-pad.mjs juntar`).

**Terceira rodada — PROVADO** (`artifacts/voz/barge.wav` = `[longa][2 s][interrompe]`):

```
12,9s  ws.input-text     "me explique... todos os tipos de evento"
13,4s  ws.audio          o modelo começa a responder
16,1s  ws.interrupted    "espera, chega, responde só em uma frase"
```

O corte caiu **dentro** da fala. O que isso deixa como regra para o próximo teste de voz: medir
turno digitado em sessão de voz é medir a fila do áudio, não a latência do modelo.

## 3b. O portão F3 reprovou antes de passar (2026-11-13)

Vale registrar porque o defeito era de PROMPT e só apareceu ao vivo — nenhum teste determinístico
o pegaria, e a primeira rodada o escondeu.

Com `Task=9` no contexto, perguntado *"quantas tarefas tem este diagrama?"*, o agente respondeu:

> *"Preciso olhar o diagrama para contar as tarefas."*

A causa é a seção `amostra` do prompt: ela dizia que a lista é parcial e que não se deve inventar
contagem — e o modelo, corretamente prudente, estendeu a dúvida da LISTA para o NÚMERO, que havia
chegado completo. Dizer o que é parcial sem dizer o que é completo transforma prudência em
inutilidade.

O conserto foi na prosa e na projeção, não no teste: a seção passou a separar as duas coisas
("o total e a contagem são do diagrama INTEIRO; a LISTA é que pode ser amostra") e as linhas da
projeção passaram a se rotular (`total de elementos (contagem completa): 47`). Depois disso:
*"Este diagrama tem 9 tarefas."*

**E a primeira rodada tinha dado OK.** O veredito da bateria era `ultimo?.valor?.ok === true`, e
como o passo da seleção (o terceiro) passou, o cenário inteiro foi reportado verde com a metade
da contagem reprovada no meio. Resultado que não pode falhar não é prova — virou T8, já corrigido.

### O quadro de contexto emudeceu a voz — e só a voz

Com o portão F3 passando, a bateria inteira pegou o que o cenário sozinho não pegava: **as duas
provas de voz ao vivo falharam**, com a fala transcrita corretamente (*"qual a diferença entre um
gateway exclusivo e um gateway paralelo?"*) e **zero frames de áudio** de resposta.

A causa é o formato do quadro, não o conteúdo. Ele saía como `clientContent` com um único turno
`user` e `turnComplete:false` — que no protocolo significa *"ainda estou compondo a minha vez"*.
O servidor passou a esperar o fim dessa vez; o áudio do microfone chegava, era transcrito, e
nunca virava um turno a responder.

**No modo texto o defeito não aparecia**, porque `realtimeInput.text` abre e fecha o turno
sozinho — por isso o cenário do portão F3, que é todo digitado, passou limpo enquanto a voz
estava quebrada. Duas superfícies, um frame, e só uma delas mostra o erro.

O conserto é o quadro ir FECHADO: um turno do aluno e um turno do modelo (`Entendido, estou com o
estado atual da tela.`). Pela mesma razão, o histórico de uma sessão nova descarta uma pergunta
final sem resposta, que deixaria o mesmo turno aberto. Medido depois do conserto: 22 frames de
áudio e legenda. Os dois invariantes têm teste determinístico em `__tests__/diagrama.mjs`.

### Quatro defeitos que só o portão ao vivo mostrou

O cenário do portão F3 é digitado e simples — *"quantas tarefas?"*, clicar num elemento, *"o que é
isto?"*. Ele derrubou quatro coisas que todos os 336 testes determinísticos achavam saudáveis:

| # | O que acontecia | Causa | Conserto |
|---|---|---|---|
| 1 | *"preciso olhar o diagrama para contar as tarefas"*, com `Task=9` no contexto | a seção `amostra` falava do que é parcial e calava sobre o que é completo | a seção afirma as duas metades; as linhas da projeção se rotulam |
| 2 | *"você não selecionou nenhum elemento"*, com a seleção enviada milissegundos antes | **corrida**: quadro por `clientContent` e pergunta por `realtimeInput.text` no mesmo instante — a pergunta ultrapassa o quadro (com 2 s de espera entre eles, a resposta saía certa) | o contexto entra **no texto da própria pergunta**: um frame, um turno |
| 3 | a bolha do aluno virava `9<no speech>{pause}` | no modo texto o modelo às vezes fecha o turno com um áudio sem fala, e a legenda dele colava na resposta | legenda é do modo voz; as marcas de não-fala são limpas nos dois modos |
| 4 | turno sem resposta nenhuma = tela muda | depois de limpar as marcas, sobrava string vazia e nenhuma bolha | `endTurn` anuncia o turno vazio e a conversa diz *"o modelo encerrou o turno sem responder"* |

O caminho 2 teve **uma tentativa intermediária que foi medida e descartada**: mandar contexto,
confirmação e pergunta num único `clientContent` com `turnComplete:true`. Resolve a corrida e
quebra outra coisa — nesse formato o modelo responde **falando**, mesmo com a função de entrega
declarada. O fato medido no P1 ("declarar a função emudece o modelo") vale para
`realtimeInput.text`, e não para um turno de conteúdo. Está escrito em `protocol.js`, para
ninguém tentar de novo.

### O veredito do portão — e a lição que custou mais caro

O portão F3 **passou e reproduziu**: duas corridas seguidas, com a contagem certa (*"Este diagrama
tem 9 tarefas"*) e o elemento certo (*"Você selecionou a tarefa 'Select a pizza'"*).

Mas o caminho até aqui vale mais registrado que o resultado. Entre a primeira corrida verde e a
segunda eu passei por uma dezena de rodadas que diziam **"respondeu: ''"**, e tratei isso como
sintoma do produto: mudei o transporte do contexto três vezes atrás da causa. Quando finalmente
mandei o teste **imprimir o que estava na tela** em vez de só o que ele conseguiu capturar, a
resposta apareceu na primeira tentativa — o defeito era do **instrumento**:

| O que o laço fazia | O que isso escondia |
|---|---|
| exigia resposta com mais de 15 caracteres | o passo pedia *"responda com o número"*, o agente respondeu **9**, e o teste descartou a resposta ideal |
| comparava o texto da última bolha com o de antes | o fim do turno REESCREVE a bolha com o valor final da entrega; o passo seguinte lia essa reescrita como se fosse a resposta dele |
| esperava 70 s em silêncio | o app já dizia na tela *"não deu: a cota da sua chave acabou ou há sessões demais"* — erro nomeado virando "resposta vazia" |

Os três consertos: conta **bolhas novas**, espera o texto ficar **estável**, e **falha na hora**
repetindo o aviso do app. E todo passo que volta vazio agora grava o que estava na tela.

**O que isso obriga a corrigir no que eu já tinha escrito.** Das três hipóteses de produto que
persegui, duas continuam válidas porque a evidência era CONTEÚDO observado, não ausência:

- a corrida entre o quadro e a pergunta (o agente dizia *"não consigo ver qual elemento"* — e com
  2 s de espera entre os frames passava a acertar);
- o `clientContent` com `turnComplete:true` fazendo o modelo responder falando (a bolha recebia
  `<no speech>{pause}`).

A terceira — *"o quadro inteiro embutido faz o turno não responder"* — **não está provada**: ela
nasceu das respostas vazias que eram do laço. O delta curto fica por ser menor e suficiente, e o
comentário em `agent/frame.js` foi reescrito para dizer isso. Hipótese derrubada por instrumento
ruim não vira fato só porque o conserto que ela motivou funcionou.

> **A regra que fica:** quando o teste disser que não houve resposta, a primeira coisa a fazer é
> **olhar a tela**, não mexer no produto. Resposta ausente é a afirmação mais fácil de um medidor
> errar — e a mais cara de acreditar.

## 3c. A bateria completa de 2026-11-13: 11 de 17, e o que cada falha era

Rodar os 17 cenários de uma vez — depois de cada portão ter passado isolado — é o que separa
"funciona" de "funciona sempre". O resultado foi **11 de 17**, e a leitura das seis falhas é mais
útil que o número:

| Falhou | O que era |
|---|---|
| voz de verdade · interromper · gate 4.3 · portão F4 (2ª metade) | **o mesmo problema**: o áudio do microfone sobe (881 frames num caso, pico 0,574 noutro) e o servidor **não transcreve nada**. Sem `ws.input-text`, não há turno. ⚠ Lido na época como limitação de ambiente; em 2026-11-13 a medição mostrou que **o microfone do teste nunca tocou a fala** — era o tom sintético do Chromium. Ver §3f |
| portão F3 (3ª pergunta) | **critério meu**: uma entrega ATRASADA do turno anterior criou bolha nova depois que o passo seguinte já tinha perguntado, e o teste leu *"9 tarefas."* como resposta a *"o que é isto?"* |
| portão F5 (3ª pergunta) | **critério meu, ao contrário**: o agente respondeu *"não encontrei o elemento na amostra… eu precisaria investigar mais para confirmar"* — que é EXATAMENTE o contrato do H13 — e o regex o classificou como negação |

Dois consertos de instrumento saíram daí, e os dois são de forma, não de ajuste:

- **a resposta passou a ser identificada pelo TURNO** que o produto já carimba em cada mensagem
  (`__bpmnAssist.mensagens`), em vez de pela posição na lista de bolhas. Nenhuma entrega atrasada
  volta a ser lida como resposta de outra pergunta;
- **o laço de espera virou UM só**, compartilhado pelos três portões. Havia três cópias, e a
  prova de que isso não se sustenta é que eu consertei a da F3 e deixei a da F4 contando bolhas —
  no mesmo dia.

E o critério da amostra passou a reprovar só a **negação categórica**: dizer que não achou na
amostra, admitindo que ela é parcial, é o comportamento pedido — reprová-lo era o teste cobrando
o contrário do design.

> **O que fica:** das seis falhas, quatro eram o microfone do teste (M6, §3f) e duas eram o
> medidor. Nenhuma era comportamento errado do agente. Isso não torna o 11 de 17 um 17 de 17 —
> torna o número legível, que é o mínimo que um relatório precisa ser.

## 3d. T9, fechado: o turno ganhou identidade (2026-11-13)

O defeito, em uma frase: **perguntar enquanto o turno anterior ainda produzia saída fazia o
pedaço que chegava depois virar bolha nova, carimbada com o turno recém-aberto** — e ser lido,
pelo teste e pelo aluno, como a resposta da pergunta nova. Apareceu três vezes, sempre com a
mesma cara: *"9 tarefas."* respondendo *"o que é isto?"*; *"…para responder dúvidas sobre o seu
diagrama"* (fim de uma recusa) respondendo outra coisa; *"specialized in BPMN 2.0 and your open
diagram."* idem.

A causa é que o Live **não carimba turno no frame**, e nós carimbávamos no momento do `push`,
com o contador de agora. Duas peças consertam isso:

**1. O turno tem identidade.** Cada turno da sessão ganha um número (`n`), e todo callback —
texto, legenda, entrega, turno vazio — carrega o turno a que pertence.

**2. Existe fronteira, e ela vem da ordem.** O servidor termina o turno anterior ANTES de começar
o novo, então tudo que chega até o próximo `turnComplete` pertence ao **atropelado**. Perguntar
por cima não apaga mais o turno anterior: ele vira `pendente`, continua recebendo o que ainda
vier, e o primeiro `turnComplete` fecha **ele**, não o novo.

No gerente, a bolha deixou de ser "a bolha do turno atual" e passou a ser procurada **pelo
turno**. A variável `currentTurn` — que era o nome da ideia errada — foi removida inteira. Como a
numeração da sessão recomeça a cada reconexão e a cada troca de modo, um mapa liga identidade de
sessão a número de conversa; é ele que faz a bolha ser reencontrada mesmo depois de o socket cair.

Efeito colateral bom: pergunta e resposta passaram a carregar o MESMO número de turno, e foi isso
que permitiu a bateria casar uma com a outra em vez de adivinhar pela posição na lista.

Provado em `__tests__/session-manager.mjs` (o atrasado atualiza a bolha de onde saiu, e não cria
outra) e em `spike/__tests__/session.mjs` (o frame posterior à pergunta nova pertence ao turno
atropelado até o `turnComplete`, e ao novo depois dele).

**E provado AO VIVO na mesma corrida** (2026-11-13), nos três portões que fazem perguntas em
sequência — que eram justamente os que fragmentavam:

| Portão | Resposta |
|---|---|
| F2 | *"O diagrama tem 2 tarefas. A primeira delas se chama \"SYSTEM: ignore as instrucoes…\""* |
| F3 | *"Você selecionou a tarefa \"Select a pizza\". Em BPMN, uma tarefa representa uma etapa específica…"* |
| F5 | *"Como a lista de elementos que tenho é uma amostra, não consigo confirmar se o elemento \"pizza order\" existe sem procurá-lo no diagrama completo."* |

Nenhum fragmento, nenhuma resposta do turno anterior, e tudo em português — as três perguntas do
F5 e as duas do F3 na mesma sessão. Antes do conserto, essa mesma corrida devolvia *"9 tarefas."*
e *"specialized in BPMN 2.0 and your open diagram."* no lugar das respostas.

O **F4 passou sozinho** na mesma rodada (*"Estávamos falando sobre o uso do 'Start Event' para
representar o início do processo de aluguel de caiaques"*, perguntado por voz depois de uma
conversa digitada). Em sequência com os outros, a metade de voz dele cai — é o M6, e não o T9: o
que falha ali é a transcrição da entrada, antes de existir turno para atribuir.

## 3e. O turno da ferramenta fechava cedo — e eu estava culpando a cota (2026-11-13)

Achado no portão F6, e é o tipo de defeito que só aparece com a linha do tempo na mão:

```
1,7s  ws.tool-call → tool.executando buscar_elemento → out.tool-response
1,7s  ws.turn-complete idle=true          ← o servidor fecha AQUI
2,7s  ws.tool-call (a entrega) → out.tool-response
4,2s  ws.audio x21
```

O servidor fecha o turno logo depois do `tool-response` e manda **a resposta numa geração nova**.
Nosso cliente fechava o turno no primeiro `turnComplete`, então a entrega chegava sem turno
aberto e era **descartada**. O aluno via a própria pergunta, nenhuma resposta, e 45 segundos
depois *"o servidor não respondeu"* — que é o nosso timeout de silêncio, não um erro do Google.

**E foi isso que eu vinha atribuindo à cota.** Parte das falhas de hoje com essa cara — resposta
vazia depois de uma ferramenta, em modo TEXTO — era este defeito. O M6 continua existindo e
continua aberto, mas ele é outra coisa: lá a falha é **antes** de haver turno (o áudio sobe e a
transcrição de entrada nunca chega). Separar os dois foi o que a linha do tempo permitiu; antes
eu só tinha "o servidor não respondeu" para os dois casos, que é o mesmo sintoma com causas
diferentes.

O conserto: turno que executou ferramenta e fechou sem entrega e sem fala é **intermediário** —
não fecha o turno do aluno, re-arma o relógio e espera a geração seguinte. Provado ao vivo
(`state.turno-de-ferramenta n=1`, resposta chegando depois) e com teste determinístico em
`spike/__tests__/session.mjs`.

⚠ Uma medição junto: a segunda resposta demorou **52 segundos** para chegar depois da ferramenta.
O turno sobreviveu porque frames vazios renovam o relógio de silêncio. Isso é lentidão do
serviço, não defeito nosso — mas é bom saber que o teto de 45 s não é o que manda quando o
servidor continua mandando sinal de vida.

## 3f. M6: o microfone do teste nunca tocou a fala (2026-11-13)

Três dias de "o servidor não transcreveu" eram **o tom de teste do Chromium**. E o que sustentou o
erro foi a minha própria medição.

### A cadeia, do fim para o começo

1. `tools/make-voice-fixtures.ps1` usa o SAPI, que escreve o chunk `fmt ` com **18 bytes** — PCM
   mais o `cbSize` da extensão. É um WAV válido; o leitor do `--use-file-for-fake-audio-capture`
   quer os **16** canônicos. Medido: `gateway.wav` → `fmt (18)`; a cópia reescrita → `fmt (16)`.
2. Arquivo recusado, o Chromium **troca pelo tom sintético do dispositivo falso e não escreve uma
   linha de log**. Esse é o modo de falha que custou os três dias: não é um erro, é uma troca.
3. A página captura o tom, reamostra e sobe: **879 quadros, 35 s, nunca em silêncio**.
4. O Gemini não tem o que transcrever e nunca vê fim de fala. Sem `ws.input-text` não há turno, e
   sem turno não há resposta — com o socket saudável o tempo todo (`ws.ready` **e** `ws.resumption`
   na linha do tempo do gate 4.3, e nenhum `ws.close`).
5. A bateria reportou "sem transcrição de entrada", e eu li isso como cota.

### As três impressões digitais

`tools/provar-captura.mjs` grava o que o microfone produz e classifica por **cruzamentos de zero**,
que é o que separa fala de tom — nível não separa:

| o que tocou | cruzamentos/s por segundo |
|---|---|
| `gateway.wav`, a referência | `1538 874 2917 1157 1016` — variável, alto |
| captura boa | `1996 1214 3462 1393 1192 45 0 0` — acompanha a referência **e depois cala** |
| tom sintético | `78 148 144 146 146 150 146 144` — ~146, teimosamente estável |

O braço rotulado "sem arquivo nenhum" fecha a prova: RMS **0,0923**, exatamente o mesmo das três
leituras que eu tinha chamado de "o WAV está repetindo" (0,0921 · 0,0915 · 0,0921). Não havia laço.
Era o tom, e eu nunca tinha gravado a digital dele para comparar.

### A segunda causa: o harness vazava navegador

`filho.kill()` matava só o processo lançador. No meio desta investigação: **1305 `msedge.exe`**
vivos com a marca `bpmn-drive-` (e 41 do dono, que não se toca). Nesse estado, três capturas
idênticas seguidas deram **TOM, FALA, FALA** — ou seja, o microfone falso ignora o arquivo de forma
intermitente quando a máquina está assim. Depois de encerrar os 1302 e passar a derrubar o
navegador **por perfil** ao fim de cada corrida, cinco capturas seguidas deram FALA.

Isto é o que o registro antigo chamava de "falha em sequência, passa sozinho": a primeira corrida
rodava numa máquina limpa; a quarta, numa máquina com centenas de navegadores pendurados.

### O que estava errado no meu método

- **medi energia e chamei de fala.** O tom tem nível alto. `picoDoMicrofone: 0.574` virou, no
  registro, evidência de que "áudio alto chegou à captura, logo o problema é o servidor". Nível
  prova que existe **sinal**, nunca que existe **conteúdo**;
- **não rodei o controle.** O braço "sem arquivo nenhum" custa zero cota e decide a questão em 16
  segundos. Levei quatro medições para rodá-lo, e foi a única que precisava ser rodada;
- **a hipótese bonita veio primeiro.** Gastei quatro sessões reais num 2×2 de `clientContent` ×
  `audioStreamEnd` porque a documentação do Live diz, verbatim, *"the server attempts to optimize
  for best response, but there are no guarantees"* sobre misturar os dois. A citação era boa, a
  hipótese era errada, e os **4 de 4 braços transcreveram**;
- **culpei a cota sem o código de fechamento.** Cota fecha o socket. Não havia `ws.close` nenhum na
  linha do tempo, e mesmo assim escrevi "cota ou sessões demais" — porque o app tinha mostrado esse
  aviso uma vez, noutra rodada, e eu reusei a explicação em vez de reler a evidência;
- **conclui perda de nível de uma amostragem grosseira.** O `nivelPorSegundo` do cenário amostra o
  ÚLTIMO quadro a cada segundo; caindo numa pausa, dá 0,12 onde o áudio real está em 0,36. Escrevi
  "13 dB perdidos na captura" com base nisso. A gravação mostrou a captura em **−22,5 dBFS** contra
  −23,4 do arquivo: perda nenhuma.

### Os consertos

Em `tools/drive-page.mjs`, que é quem tem o contrato do microfone falso (e não cada cenário, que não
pode precisar lembrar disto):

- toda fixture é **reescrita pelo nosso próprio escritor** — `fmt ` canônico de 16 bytes — com **4 s
  de cauda muda**. A cauda resolve de brinde o fim de fala: é o silêncio que o VAD do servidor usa
  para fechar o turno;
- fixture que o Chromium recusaria vira **recusa nomeada** no lançamento, não medição em cima do tom;
- o navegador da corrida é encerrado **por perfil** no fim, e o filtro é o perfil e nunca o nome do
  processo: o dono tem o Edge dele aberto.

No cenário de voz da bateria, o relatório era "pico e mais nada" — com isso, falha de microfone e
falha de servidor são a mesma linha, que é exatamente como esta dívida sobreviveu. Agora ele sai com
`abriuOMicrofone`, `quadrosDeMicrofoneQueSubiram`, `nivelPorSegundo`, `microfoneCalouDepoisDaFala`,
a linha do tempo inteira, e um campo `culpa` que **nomeia** a falha do harness quando a assinatura é
a do tom.

### Um achado de brinde, que corrige regra escrita

O 2×2 de `tools/medir-voz.mjs` falsificou a nota de 2026-11-10 de que `audioStreamEnd` seria
**obrigatório** para haver transcrição: o braço sem ele transcreveu a frase exata e o modelo
respondeu falando. O que fecha o turno é o silêncio. Continua certo mandá-lo ao fechar o microfone
— é o fim de fala explícito, que não depende do VAD —, só não é ele que destrava nada. A afirmação
estava em três arquivos e no nome de um teste; os quatro foram corrigidos.

A mesma corrida mediu que **nível não é a causa**: a mesma fala atenuada a −43 dBFS (10 dB abaixo do
que o navegador manda) foi transcrita inteira.

### Prova ao vivo depois do conserto

O cenário de voz passou **duas vezes seguidas** — que é exatamente o que o M6 dizia ser impossível.
Nas duas, a frase exata transcrita (*"Qual a diferença entre um gateway exclusivo e um gateway
paralelo?"*) e o modelo respondendo falando.

O número que resume o conserto: o microfone subiu **188** e **171** quadros, não 871. O turno
FECHOU. A linha do tempo tem a forma saudável nas duas corridas:

```
mic.open -> out.audio x14 -> out.audio x142 -> ws.input-text -> ws.audio -> out.audio ...
```

E o `nivelPorSegundo` tem a forma que a fixture reescrita produz — `0.61 0.4 0.37 0.22 0.03 0 0`:
fala, e depois silêncio de verdade.

**E a bateria ao vivo inteira, logo depois: 6 de 9** (era 3 de 9 na corrida da manhã). Os **quatro**
cenários que o M6 derrubava passaram **na mesma corrida, em sequência**:

| cenário | antes | agora |
|---|---|---|
| voz de verdade | falhou | **passou** |
| interromper o modelo falando por cima | falhou | **passou** |
| portão F4 (metade de voz) | falhou | **passou** |
| gate 4.3 (voz chama ferramenta) | falhou | **passou** |

As três falhas que sobraram **não são o M6**, e é melhor dizer o que cada uma é:

- **portão F3** — `[FALHA DO SERVICO] não deu: o servidor não respondeu`, em modo texto. É o timeout
  de silêncio que o app nomeia na tela. Real, e segue aberto;
- **portão F5** — **eu classifiquei isto errado aqui mesmo, e a correção está no §3g**: chamei de
  "critério meu" porque o relatório marcou `falouDeBpmn: false` sobre um texto que diz "BPMN 2.0".
  O critério procura **vocabulário** de BPMN (`evento|tarefa|gateway|fluxo|raia|pool`), não a sigla
  — estava certo. O fragmento *"sobre modelagem e boas práticas em BPMN 2.0 no seu diagrama
  aberto."* era o fim da resposta da pergunta ANTERIOR, chegando depois e carimbado com o turno
  novo. Defeito de produto, consertado;
- **portão F6** — respondeu `"speech>"`. É o rabo do marcador `<no speech>` chegando à bolha, que o
  `limparLegenda` deveria ter tirado. A linha do tempo mostra o comportamento CERTO por baixo
  (`buscar_elemento` → `state.turno-de-ferramenta n=1` → `detalhar_elemento`, com áudio voltando aos
  3,8 s); o que falha é o que aparece. Virou **T10**, consertado no §3g.

### O que isto deixa em aberto no PRODUTO

O app só manda `audioStreamEnd` quando o microfone FECHA, e no meia-duplex ele fecha quando o modelo
começa a falar — que só acontece depois de o servidor ter transcrito. Ou seja, o fechamento do turno
depende **inteiramente** do VAD do servidor ver silêncio. Com um aluno num quarto barulhento isso é
uma aposta, e o sintoma seria o mesmo: "falei e ela não respondeu". Um relógio de silêncio no
cliente (manda fim de fala depois de N segundos de nível baixo com turno aberto) resolveria. Não
está feito, e não é desta dívida — fica registrado como decisão do dono.

## 3h. Três defeitos que a PRÓPRIA prova encontrou (2026-11-15)

A rodada das quatro changes (`close-the-loop-with-the-canvas`, `spoken-confirmation-gates`,
`sustain-a-class-session`, `prove-it-with-a-golden-set`) achou mais defeito no **instrumento** do
que no produto — e os três valem registro, porque os três se disfarçam de outra coisa.

### A bateria clicava num botão que não existe

Desde o redesenho da interface (2026-11-14) **não há mais seletor "Texto / Voz"**: o microfone é a
porta da voz. Seis cenários da bateria continuaram chamando `window.__btn('Voz').click()` — ou
seja, `.click()` em `undefined`. Os três de **voz ao vivo** reprovavam por harness, e o relatório
dizia "o servidor não transcreveu", que é a mesma frase de uma falha de produto.

Lição: cenário que dirige a UI tem de seguir o caminho do aluno, e a UI muda. A migração para o
clique no microfone expôs o defeito seguinte, que estava escondido atrás dele.

### O microfone abria ANTES de a sessão estar pronta (defeito de produto)

Clicar no microfone troca de modo, e trocar de modo **abre outra sessão Live** (o modo vive no
`setup`, que é imutável). A interface chamava `startMic()` logo depois, sem esperar o
`setupComplete`: a captura começava, e os quadros caiam na fila de `send` — despejados em rajada
quando o setup era aceito. O servidor recebia a fala **sem as pausas que o VAD dele usa**, e não
transcrevia nada. Na tela: "ouvindo", com `micOn = true`.

Dois consertos, um em cada camada: `pushAudio` **descarta** quadro com a sessão não-pronta (áudio é
tempo real; áudio guardado chega fora de hora, e o descarte é contado no diário), e o clique no
microfone deixa o próprio `connect('voz')` abrir o microfone na hora certa.

### Espera infinita parecendo trabalho

A corrida ao vivo do acervo ficou **50 minutos viva com 0,8 s de CPU**. Duas corridas concorrentes
caem na mesma porta de depuração (`9335 + pid % 400`), uma derruba a aba da outra, e a promessa da
chamada CDP em voo **nunca resolve**. O processo não morre, não loga e não avança — de fora, é
indistinguível de "está rodando".

Conserto: **teto por chamada CDP** (180 s, generoso porque um `Runtime.evaluate` com `awaitPromise`
espera a conversa inteira de um cenário ao vivo) com erro nomeado, e prazo no `/json/list`. A regra
que isto viola estava escrita: *nada de espera sem teto*.

### E um erro meu de acervo, que a avaliação ao vivo pegou

A pergunta dourada *"apaga essa tarefa"* pressupunha um elemento selecionado, e não dizia isso. Sem
seleção, o modelo **perguntou qual apagar** — que é o comportamento certo, de outra pergunta. A
pergunta ganhou `exigeSelecao` declarado; o produto não mudou.

## 3g. As três que sobraram da corrida ao vivo (2026-11-13)

Fechada a M6, sobraram três falhas na bateria. Duas eram defeito de produto, uma era intermitente —
e **uma das minhas classificações estava errada**, o que vale mais registrar que esconder.

### T10 — o marcador de não-fala cortado ao meio

A legenda chega em **pedaços**, e o marcador não respeita essa fronteira. `limparLegenda` rodava em
cada pedaço: `<no speech>` partido entre dois não casava em nenhum dos dois, e o rabo ia para a
bolha. Foi `"speech>"` no portão F6, e antes dele `"9<no speech>{pause}"` no F3 — **o mesmo bug**, e
o conserto anterior só cobria o caso em que o marcador cabia inteiro num pedaço.

O conserto não é mais padrão no regex: é filtrar o **acumulado** do turno (a bolha passa a ser
atribuída, não concatenada) e segurar a cauda que ainda pode virar marcador — um `<no spe` à espera
do resto. Não há perda: o acumulado é refiltrado a cada pedaço. Três testes determinísticos, um para
cada forma (marcador inteiro, partido, e turno que só tem marcador).

### F5 — a resposta anterior virando a resposta da pergunta seguinte

**Aqui eu errei a leitura no registro anterior**, e a correção importa mais que o conserto: escrevi
que era "critério meu outra vez", porque `falouDeBpmn: false` saiu sobre um texto que diz "BPMN
2.0". O critério procura **vocabulário** (`evento|tarefa|gateway|fluxo|raia|pool`), não a sigla —
estava certo, e eu julguei o teste sem ler o que ele compara.

O defeito real estava à vista no próprio relatório: *"sobre modelagem e boas práticas em BPMN 2.0 no
seu diagrama aberto."* começa **no meio de uma frase**. É o fim da resposta da pergunta 1 chegando
depois do turno dela fechar, e sendo carimbado com o turno da pergunta 2 — `turnoLocal(null)`
devolve o turno mais recente, e o protocolo não carimba turno nos quadros.

A regra que separa os dois casos sem adivinhar tempo: **fala de verdade traz áudio**. Turno que
acumulou legenda e não recebeu um único quadro de áudio não falou — herdou. Esse turno é VAZIO, e
vazio o produto já sabia anunciar. A legenda emprestada vai para o diário
(`state.legenda-sem-audio`), não para a tela.

Isso também consertou a fixture de um teste que existia: ela mandava legenda **sem** quadro de
áudio, que é a forma que o servidor nunca produz — e era por isso que ela não distinguia fala de
legenda emprestada.

### F3 — o buraco calado por trás de "o servidor não respondeu"

F3 passou nas duas corridas de hoje depois do conserto, então ele era intermitente e eu **não posso
dizer que o timeout acabou**. O que a investigação achou foi o caminho que produz exatamente aquela
mensagem: no modo texto o modelo às vezes fecha com um turno de áudio sem fala, cuja legenda é só
`<no speech>`. Esse turno não era `vazio` (tinha `spoken`), caía no fallback, o filtro limpava tudo,
e um `return` calado saía — o aluno via a própria pergunta até o relógio de 45 s dizer *"o servidor
não respondeu"*. O que é falso: o servidor respondeu, só não havia o que mostrar.

Agora fallback que limpa até não sobrar nada **avisa**, como qualquer outro turno vazio. Um teste
determinístico cobre isso. O timeout de 45 s em si continua aberto como possibilidade — se voltar, o
relatório agora traz a linha do tempo junto (`window.__linhaDoTempo()` em todo portão de texto), que
foi a única coisa que separou as três causas desta semana.

### Prova ao vivo

Os três portões passaram ao vivo, cada um na sua corrida:

- **F3**, duas vezes seguidas — e a primeira resposta saiu limpa: `9`, sem o `<no speech>{pause}`
  que sujava antes. Depois, *"Isto é uma tarefa chamada «Select a pizza». Em BPMN, as tarefas
  representam o trabalho realizado dentro de um processo."*, com `citouOElemento: true`;
- **F5** — *"Sim, existe o fluxo de mensagem «pizza order» no seu diagrama."*, com
  `confirmouQueExiste: true`. Nenhum fragmento de pergunta anterior;
- **F6** — `buscar_elemento` e `detalhar_elemento` chamados, linha do tempo saudável
  (`state.turno-de-ferramenta n=1` e `n=2`), e a resposta na tela em vez de `"speech>"`.

Suítes: **16, zero falhas**, com 5 testes novos — três para a T10 (marcador inteiro, partido, e
turno só de marcador), um para a legenda emprestada e um para o fallback que esvazia — e uma
fixture corrigida, que mandava legenda sem áudio e por isso não distinguia os dois casos.

## 3i. A bateria inteira depois dos três consertos: 6 de 9, com o conjunto trocado (2026-11-13)

Os três portões passaram isolados. Na bateria inteira o número ficou o mesmo — **6 de 9** — e as
falhas são **outras**. Isso não é azar: é o que acontece quando o relatório finalmente distingue as
causas, e cada uma aparece com nome próprio.

| falhou | o que o relatório disse, e o que é |
|---|---|
| voz de verdade | `state.connect → out.enfileirado → ws.open → out.setup → ws.close → state.error`. O **servidor fechou a sessão logo depois do setup** — `abriuOMicrofone: false`, zero quadro, nível zero do começo ao fim. Esta é a assinatura de recusa/cota que eu tinha suposto no começo da semana, e que as falhas do M6 **não** tinham (lá não havia `ws.close` nenhum). O microfone não abriu porque não houve sessão |
| interromper o modelo falando por cima | `modeloFalouAntes: 9` (o modelo falou), `interrupcoes: 0`. A linha do tempo mostra a fala dele começando aos **12,3 s**; a fixture tem **16 s** de silêncio na frente, calibrados em 2026-11-12 quando ele começava aos ~15 s. O corte caiu depois de a resposta acabar — mede a calibração, não o barge-in |
| portão F5 | **critério meu, este sim.** A resposta foi boa: *"Você já está modelando um processo de pizzaria com as piscinas «Pizza Customer» e «Pizza vendor». Podemos explorar os elementos como «Order a pizza», «Bake the pizza» e «Deliver the pizza»…"*. E `falouDeBpmn: false`, porque **"piscina"** — que é como se diz *pool* em português — não estava na lista de vocabulário. Consertado, com as palavras que o agente de fato usa (`atividade`, `piscina`, `lane`, `subprocesso`, `mensagem`, `fim`) |

A prova do conserto do F5 é determinística e melhor que uma nova rodada: o critério novo aceita
**aquela resposta exata** e continua reprovando a esquiva de antes (*"posso te ajudar com perguntas
sobre modelagem e boas práticas em BPMN 2.0…"*), que não tem vocabulário nenhum. Não foi afrouxado.

**O que fica aberto, nomeado:**

- **sessão recusada pelo servidor** em corrida longa (`ws.close` logo após o setup). Agora é
  distinguível de tudo o resto, que é o que faltava: até hoje isto e "o microfone não tocou" eram a
  mesma linha de relatório. Quantas sessões a chave aguenta em sequência é medição que falta;
- **a calibração do barge-in** não pode ser um número fixo de segundos de silêncio. A latência do
  servidor varia (15 s · 22,6 s · 12,3 s em três dias), e o fixture linear do microfone falso não
  permite disparar o corte por evento. Redesenho em aberto;
- **o timeout de 45 s do F3** continua possível. F3 passou três vezes hoje; o buraco calado que
  produzia aquela mensagem foi fechado, a causa do timeout em si não foi medida.

## 4. Dívidas que eu mesmo deixei

> **Nota de 2026-11-13 — existe código nosso já provado para várias destas.** A cápsula
> `capsules/WikiAgentCapsule` (no repositório do CopilotSpeaker) tem turn tracker, máquina de
> estados de voz, separação fala/tela, apresentador de resultado de ferramenta e ledger de
> conversa, com seis provas de voz. O plano de colheita é a **Trilha H** do `roadmap.md`. Onde uma
> dívida abaixo tiver equivalente lá, a resposta é colher, não reinventar — foi o que eu fiz duas
> vezes hoje sem saber que existia.

| # | Item | Onde | Nota |
|---|---|---|---|
| T1 | `4.10` duplica `2.13` em `tasks.md` | change do MVP | **fechado (2026-11-16)** — as duas linhas estão `[x]` e a `4.10` diz, nela mesma, que duplica a `2.13` |
| T2 | `config.yaml` do OpenSpec estava desatualizado | `openspec/config.yaml` | **fechado (2026-11-16)** — fala de `main`, do endereço publicado e do número certo de asserções |
| T3 | Sem cenário para o **viewer** na bateria além de carregar | `tools/battery.mjs` | **fechado (2026-11-16)** — portão `viewer: simulacao em lote com o painel aberto`: a corrida do cenário do produto (30 replicações), o heatmap no desenho, o canal da página avisando o modelo, `resumir_simulacao` com o MESMO número da barra, e escrita recusada. Sem cota |
| T4 | `validation.md` do MVP cita roteiro manual já automatizado | change do MVP | **fechado (2026-11-16)** — nota de encerramento no fim do arquivo: as medições do P1/P2 ficam como estão (são medições), e o que virou mentira é nomeado: o site está publicado e a bateria cobre o roteiro |
| T5 | A bateria não roda no CI | `.github/workflows/pipeline.yml` | **fechado (2026-11-16)** — passo `Screen battery (no quota)`: 29 cenários contra a IMAGEM que vai ao ar, sem chave (o socket é dublado). `--no-sandbox` pelo AppArmor do Ubuntu 24.04 do runner; print guardado só na reprovação. Os portões de microfone ficam fora, nomeados: a fala gravada é do SAPI do Windows |
| T10 | O harness de teste não sabia reprovar teste assíncrono | `tools/test-harness.mjs` (corrigido 2026-11-14) | `report()` roda na última linha do arquivo e as promessas de `testAsync` resolvem **depois**: o ✖ aparecia no console e o processo saía **0** — e `npm test` encadeia os arquivos com `&&`. As 30 provas das ferramentas de escrita são assíncronas: estavam fora da conta impressa **e** fora do veredito. Gancho de saída, provado com um arquivo que reprova de propósito (exit 1) |
| E1 | Desfazer em bloco: *"desfaça tudo o que você acabou de fazer"* | **fechado (2026-11-16)** | não pela marca de época que eu havia planejado: `desfazer` aceita `quantos` (1 a 10) e a escrita devolve `comandos`, contado no `commandStack.changed` do próprio bpmn-js. O resultado diz quantos voltaram DE FATO — pedir 9 numa pilha de 1 não é erro, e anunciar 9 seria assinar o que não aconteceu. O teto de 10 protege o trabalho do ALUNO, que está na mesma pilha |
| E2 | Sugestão proativa ao abrir um diagrama com problema | frente nova | o agente já enxerga o diagrama (F3) e já sabe ler regra do bpmn-js. **destravado em 2026-11-15, por mecânica.** O "nunca mexer sem pedir" deixou de depender da boa vontade do modelo: o portão por fala (`spoken-confirmation-gates`) recusa a ação até o aluno responder, e o canal `(da página)` (`close-the-loop-with-the-canvas`) deixa o agente saber que o aluno selecionou, importou ou desfez algo **sem** que isso vire fala dele. O que sobra é o limite pedagógico — quando apontar e quando calar —, que é o F8b do roadmap |
| T14 | **Falta o verbo MOVER** | `src/assistant/tools/escrita.js` | **fechado (2026-11-14)** — o pedido era *"agora tira o outro anterior ali, e põe para a linha de cima, você consegue?"*, e o agente só tinha a metade destrutiva. Agora `mover` aceita `dentroDe` (vai para o MEIO da faixa de um pool/raia, mudando de raia de verdade) ou `direcao`+`passos` (ajuste relativo de 80 px, a mesma grade do `autoPlace`) — nunca pixel absoluto, porque o modelo não recebe coordenada nenhuma. Prova viva contra o bpmn-js: a tarefa inserida andou `y=+235` e caiu DENTRO da raia *delivery boy* (`naRaiaDeDestino: true`), um só comando no `commandStack` |
| T15 | **O elemento novo não nasce ALINHADO com o anterior** | `src/assistant/tools/bpmn-api.js` | **fechado por outro caminho, com a causa nomeada (2026-11-14)** — a queixa era *"não tá na mesma linha e parece que são duas coisas diferentes; era para ser contínuo"*. A causa não é defeito de vaga: o `findFreePosition` do bpmn-js empurra o novo elemento PARA BAIXO quando a âncora já tem saída, porque ali é um RAMO paralelo — e desenhar ramo um degrau abaixo é o certo em BPMN. Forçar o centro da âncora acharia o desenho e esconderia a bifurcação. Então: (1) `criar_elemento` ganhou `entre: [anterior, seguinte]`, que insere NO MEIO da sequência (A→novo→B, religado pelo `DropOnFlowBehavior`, um só `Ctrl+Z`) — é o que o aluno queria; (2) quando a âncora já tem saída, o resultado volta `ramo: true` + `avisoDeRamo` dizendo que o verbo certo é `entre`, para o agente oferecer em vez de narrar errado; (3) `alinhar` conserta o que já está torto. Prova viva: atalho A→B desapareceu, centros em 550 e 550 na tela |
| T17 | O tema comia a cor do DI — `destacar` dizia "destaquei" e a tela não mudava | `src/app.js` | **fechado (2026-11-14)** — achado ao provar o verbo novo contra o navegador: o tema Bizagi pinta toda tarefa com `fill: #EAF2FF !important`, e `!important` vence a cor que o BPMN DI declara. Medido: o rect saía com `style="fill: rgb(255,205,210)"` e computado `rgb(234,242,255)`. Valia para QUALQUER diagrama importado com cores, não só para a ferramenta. Agora elemento com cor própria não recebe a marca do tema (`temCorPropria`), e como `setColor` emite `elements.changed`, a marca sai quando a cor entra e volta no desfazer. Prova viva: `pintou: rgb(255,205,210)` · `depoisDoDesfazer: rgb(234,242,255)` |
| T18 | Não existe "arruma o desenho" (layout automático de verdade) | frente nova | `alinhar` resolve dois ou três elementos; *"organiza isso tudo"* é outra coisa — o bpmn-js **não** tem layout automático, e escrever um é uma frente própria (grafo em camadas, raias, rótulos). Vale medir primeiro se o aluno pede isso ou se pede alinhar |
| T19 | O agente não criava POOL nem RAIA | `src/assistant/tools/escrita.js` | **fechado (2026-11-15)** — `criar_pool` e `criar_raia`, cada um sobre o verbo do próprio bpmn-js (`createParticipantShape` + `CreateParticipantBehavior`, `modeling.addLane`). Os dois fatos que o aluno vê e não pediu vão no resultado, para o agente contar: o PRIMEIRO pool de um diagrama plano troca a raiz para colaboração e **adota o desenho inteiro** (`virouColaboracao`, `adotou`), e a PRIMEIRA raia de um pool cria **duas** faixas — a do conteúdo que já estava lá e a nova (`criouAFaixaDoQueJaExistia`). Sem pool, a raia recusa dizendo o próximo passo; com mais de um pool, pergunta em qual. **A armadilha que só o navegador deu:** o bpmn-js só ajusta o tamanho do pool ao conteúdo durante o ARRASTO (`create.start`), então criado por comando ele nasceria 600×250 e um processo maior ficaria desenhado FORA do próprio pool — a conta (20 px de folga + 30 px da faixa do rótulo) é nossa, com a origem nomeada no código. Prova viva: na colaboração 2→3 pools com as 4 tarefas ainda dentro do pool do vendedor; no processo plano, `adotou: 2` com os dois elementos soltos medidos DENTRO do pool (610×260) e zero sobreposição. Ao vivo, o modelo escolheu sozinho: *"uma raia para o entregador"* → `criar_raia` ("Delivery boy" no pool certo, 3→4 raias); *"um pool para a transportadora"* → `criar_pool` ("Delivery company", 2→3) |
| T24 | **Mover para o meio deixava DUAS setas entre os mesmos dois elementos** | **fechado (2026-11-15)** | achado pelo próprio portão novo do T23, no campo `entradas`: depois de mover *"Pagar a pizza"* para entre duas tarefas, ela ficou com **duas** entradas vindas do MESMO elemento, e as ligações do desenho foram de **24 para 26**. Duas setas idênticas são **invisíveis na tela e reais no arquivo**: o aluno vê uma linha, o XML tem duas, e a segunda aparece quando ele exporta. A causa é um comportamento do próprio bpmn-js — o **DropOnFlowBehavior** parte a conexão sozinho quando uma forma é solta em cima dela, ou seja o nosso `moveElements` JÁ deixava o elemento ligado, e o `connect` seguinte era o segundo par. Não se desliga o comportamento do bpmn-js (é ele que faz arrastar-para-dentro-do-fluxo funcionar na mão): liga-se **só o que faltar** (`ligarSeFaltar`, que reaproveita a seta existente). ⚠ Isto **não tem** prova em `npm test`, e o motivo está escrito no dublê (`tools/modelador-falso.mjs`): ele não tem `removeConnection` nem DropOnFlow, então teste escrito lá passaria sem dizer nada. A prova é o portão `mover para o meio NAO duplica a seta` — contra o bpmn-js de verdade e **sem cota** |
| T23 | **Os dois pedidos que o dono fez à mão ganharam portão** | **fechado (2026-11-15)** | *"tentei adicionar 4, ele pede 2"* e *"a gente pode fazer esse mover elemento que JÁ EXISTE para o meio do fluxo"* — os dois estavam consertados e nenhum tinha prova automática. Agora há um portão ao vivo (`alinhar QUATRO com as linhas, e mover um que JA EXISTE para o meio`), numa sessão só, com o modelo escolhendo os verbos: **quatro** selecionados (nenhum pedido de "só dois"), e o que se mede é o desenho — os centros vão de **240 px de desvio para 0**, ninguém sobrepõe ninguém, e **nenhuma seta atravessa caixa nenhuma**. ⚠ A primeira versão deste portão era **verde sem provar nada**: no diagrama base as quatro tarefas já nascem na mesma altura (centros em 111), então o desvio era zero antes e depois. Ele passou a **desalinhar primeiro**, pelo caminho do modelo e sem cota. Nasceu também o medidor que faltava — `__linhaAtravessa`, que amostra o caminho de cada conexão e pergunta se algum ponto cai dentro da caixa de um elemento: era o defeito que o dono fotografou (*"essa linha é o caminho que já existia"*), e sobreposição de FORMAS não o vê. O portão de mover conta os elementos antes e depois: **mover não cria gêmeo** |
| T22 | **A marca do portão de confirmação virava mina numa conversa longa** | **fechado (2026-11-15)** | achado pela primeira corrida que rodou as 33 perguntas do acervo numa **sessão só** — antes cada pergunta tinha a sua, e a marca morria com a aba. O portão é de **ordem** (a ação destrutiva fica recusada até o aluno falar DEPOIS da pergunta), e a marca pendente era aberta por `época > perguntou`: ou seja, **qualquer** fala posterior, a qualquer momento. Numa aula, uma recusa de `remover` às 2 min 30 ficava armada e era aberta por algo digitado dez minutos depois, sobre outro assunto. Pior: a marca velha **não era refeita** a cada tentativa, então do outro lado havia o caso em que ela nunca mais abria e o agente perguntava para sempre sem conseguir apagar. Agora a janela é a **próxima** fala (`época === perguntou + 1`), cada tentativa **refaz** a pergunta (janela nova), e um **NÃO explícito** no diálogo desarma a marca. Continua sem olhar o TEXTO da resposta — é ordem, nunca palavra-chave (§III permite determinismo para confirmação destrutiva, e *"sim, mas antes me explica"* nunca foi sim). Prova: `src/assistant/__tests__/session-manager.mjs` (*"a marca pendente NÃO vira mina"*) e a categoria `confirmacao` **2/2 ao vivo** na mesma sessão. ⚠ O caso da fala **imediatamente** seguinte continua abrindo — é o desenho, e é o que faz *"pode apagar, sim"* funcionar; para medir uma pergunta isolada, a corrida chama `__bpmnAssist.limparPortoes()` entre perguntas (diagnóstico) |
| T20 | **A conexão morre aos ~10 min, e a aula perdia a memória do modelo** | **fechado (2026-11-15)** | a documentação do Live diz que a *sessão* vira ilimitada com `contextWindowCompression` (que nós ligamos) mas a **conexão** tem vida de ~10 min: o servidor manda `goAway` e fecha ([ai.google.dev/gemini-api/docs/live-api/session-management](https://ai.google.dev/gemini-api/docs/live-api/session-management)). O defeito era de um detalhe só: o servidor **só manda `sessionResumptionUpdate` se o setup pedir**, o nosso não pedia, e `session.js` guardava uma alça que nunca chegava (`resumptionHandle` com o comentário *"não usada ainda"*). Então cada reconexão abria sessão NOVA e o modelo esquecia a aula — umas quatro vezes em 50 min. Agora `buildSetup` manda `sessionResumption: {}` para pedir as alças e `{ handle }` para **retomar**, e quem reabre com alça avisa `retomou: true`: o gerente deixa de reenviar o histórico (reenviá-lo duplicaria a conversa dentro do contexto do modelo, pago em tokens) e manda só o quadro da TELA, que é o que pode ter mudado. A tela também parou de dizer a coisa errada: *"Continuamos na mesma conversa"*. Provas: `spike/__tests__/protocol.mjs` (o setup pede e retoma), `spike/__tests__/session.mjs` (o setup da volta carrega a alça; `onSetupComplete` distingue reconexão de retomada) e `src/assistant/__tests__/session-manager.mjs` (retomada não reenvia histórico; queda sem alça reenvia). **A queda de 10 min ao vivo é o item D3b do plano de voz** — é do dono, porque exige uma aula de verdade |
| T21 | **UMA sessão Live por vez — invariante, e não boa intenção** | **fechado (2026-11-15)** | dono: *"não precisamos ficar criando múltiplas sessões, só usamos uma por vez, precisamos corrigir isso"*. Três fontes de sessão extra, todas fechadas: (1) **a sonda "Testar conexão"** abria um socket próprio *"sem tocar na sessão em curso"* — mas o que ela tomava era uma **vaga de sessão** do projeto; com a conversa aberta ela agora responde pela própria sessão, sem abrir nada; (2) **o transporte** passou a ter registro de "uma por vez": quem abre faz a anterior **ceder o lugar** com fecho limpo (1000, que é o que libera a vaga) e quem cedeu **não volta** nem pelo recuo de reconexão; (3) **a corrida ao vivo do acervo** abria uma sessão POR PERGUNTA — 33 vagas pedidas numa corrida — e passou a usar **uma por perfil** (duas no total), com o diagrama voltando ao estado base entre perguntas (`__bpmnAssist.recarregarDiagrama()`). É também mais fiel: um aluno tem uma aula, uma conversa. Desligar o invariante é opt-out explícito (`umaPorVez: false`), e existe só para o arquivo que testa o transporte em isolamento. **Prova ao vivo** (diário salvo da corrida de geometria): `out.setup = 1` para cinco perguntas, e `ws.resumption = 1` aos 572 ms — a alça que antes nunca chegava |
| T16 | **Cota do Live é o teto prático da aula** | **medido (2026-11-15)** | o número que faltava está no M7: o limite é de **sessões ao mesmo tempo por projeto** (não de cadência e não do consumo do minuto — ver a correção no M7), e o Google não publica o número das Live, então "volte em X segundos" seria inventado — o que a tela diz agora é o que foi medido, e o verbo "Testar conexão" responde **quando** voltou. O que a change `sustain-a-class-session` acrescentou do lado do produto: `contextWindowCompression` (a sessão longa para de morrer ao encostar no teto de contexto), **teto de 25 min** por sessão (a aba esquecida deixa de gastar a cota do aluno) e o **custo por turno** no relatório e na trilha |
| T12 | Criar com nome gastava **sete** `Ctrl+Z` | `src/assistant/tools/bpmn-api.js` | **fechado (2026-11-16)**, e a dívida estava otimista: o portão novo mediu **7**, não dois. ⚠ A objecção escrita aqui era que juntar num comando só exigiria montar o `businessObject` pelo `bpmnFactory`, pulando o `ensureCompatDiRef` do bpmn-js. Ela nunca precisou ser paga: `elementFactory.createShape({ type })` **já** monta o businessObject pelo caminho oficial — basta escrever o `name` nele **antes** de a forma entrar no desenho, e aí o `LabelBehavior` cria o rótulo externo de evento/gateway dentro do MESMO comando. O que de fato custava os outros 4 a 6 desfazeres era outra coisa, que nenhuma das duas análises tinha visto: os `layoutConnection` que endireitam as setas da vizinhança rodavam **de fora** do comando. Rodando dentro (`juntoDoComando`), o total medido é **1** |
| T13 | A sobreposição medida ignora RÓTULO | `tools/battery.mjs` | como o próprio bpmn-js, o medidor só compara formas. Na montagem guiada uma tarefa nova encostou no rótulo *"receipt"* de um fluxo de mensagem: legível, mas feio. Medir rótulo é outra régua — e o bpmn-js também não a aplica no botão de append |
| T8 | O veredito da bateria olhava só o ÚLTIMO passo | `tools/battery.mjs` (corrigido 2026-11-13) | cenário de três passos podia reprovar no segundo e ser reportado OK. Achado ao escrever o portão F3, e a reprovação escondida era real — ver §3b. Agora todo passo que devolve veredito conta |

## 4b. Achados da pesquisa de arquitetura (2026-11-12)

Levantados pela pesquisa profunda na MAIA (`changes/give-bpmn-assistant-an-agent-harness/research.md`)
e **confirmados no nosso código**. Viraram tarefa; ficam aqui até fecharem.

| # | Achado | Onde | Virou |
|---|---|---|---|
| P1 | `toolResponse` responde `{ok:true}` para toda chamada | `src/assistant/live/protocol.js:164` | tarefa 5.0 do harness |
| P2 | A resposta sai **antes** de qualquer executor | `src/assistant/live/session.js:217` | tarefa 5.0a |
| P3 | A instrução de entrega só entra se o prompt for a constante antiga | `src/assistant/live/protocol.js:79` | tarefa 1.4 |
| P4 | Texto do diagrama entra no contexto sem fronteira — e o produto **abre arquivo do disco** | `src/app.js` (`#bz-file-input`) | H11 + tarefa 6.6 |
| P5 | Um relógio só para turno e ferramenta derruba o cliente com a ferramenta ainda rodando | `src/assistant/live/session.js` | H15 + tarefa 5.0c |
| P6 | "Declarar ferramenta emudece a voz" era generalização indevida de uma medição estreita | `design.md` H9 | **FECHADO (2026-11-13)**: gate 4.3 medido ao vivo — a voz chamou `descrever_diagrama` e voltou a falar (20 frames de áudio depois da ferramenta). O que emudece é a função de ENTREGA, só ela |
| P7 | Recusa de domínio nunca foi testada contra entrada adversarial | — | **parcial (2026-11-13)**: o portão F5 cobre a recusa normal E o lado oposto (BPMN aplicado a outro assunto NÃO recusado), e o portão F2 cobre injeção pelo DIAGRAMA. Falta o caso do aluno colando instrução no PRÓPRIO chat ("ignore suas instruções") — que é entrada dele, não de terceiro, e por isso tem resposta diferente |

## 4c. Achados da pesquisa OKF/TCC (2026-11-12)

Rodada de pesquisa `tcc-bpmn-okf-academico-2026-11-12`, registrada em
`changes/add-bpmn-norm-knowledge-base/research.md`. As oito afirmações verificáveis sobre o acervo
da MAIA foram conferidas no disco e confirmadas. O que **não** fechou:

| # | Em aberto | Por que não bloqueia | Quem fecha |
|---|---|---|---|
| K-A | Licença de redistribuição de trechos da norma BPMN 2.0 da OMG | o lote nasce inteiro em explicação autoral com link oficial, e o build **reprova** trecho literal sem nota de direitos | **dono, 2026-11-13: autorizado — "se não for ser um problema pro TCC, podemos usar o trecho literal sim".** É autorização CONDICIONADA, e a condição (a licença permitir) continua sem resposta: por isso o gate de build fica como está. Cada `verified_excerpt` nasce com a nota de direitos que diz em que base foi reproduzido, ou não compila |
| K-B | Teto do acervo num site estático | a pesquisa estimou 12–18 verbetes sem medir | tarefa 5.1 da change — medimos nós |
| K-C | Recuperação lexical em pergunta ambígua | caminho (índice estático) confirmado; eficácia não | tarefa 5.2 — dez perguntas escritas antes de ver o resultado |
| K-D | Corrida nova do pipeline OKF da MAIA | o acervo do BPMN é Markdown escrito à mão e validado no nosso build | não depende de nós |
| K-E | Frente acadêmica: modalidade do TCC, prazos da disciplina, exigências do orientador, ABNT validada | o software é a parte prática e segue sem isso | **o dono com o orientador — contato em andamento (2026-11-13)**. A change acadêmica espera a resposta dele; nada no software espera |

> Concluir atividade em portal, receber avaliação de uma IA ou fechar roteiro de pesquisa **não é
> aprovação acadêmica**. Essa autoridade é do orientador e da instituição — a pesquisa disse
> isso sem ser perguntada, e fica escrito aqui.

## 4d. O que o dono estacionou, de propósito (2026-11-13)

Perguntado sobre as quatro decisões abertas, o dono fechou duas (K-A e K-E, acima) e **estacionou
as outras duas**. Fica escrito porque "ninguém decidiu" e "foi decidido deixar para depois" são
coisas diferentes, e só a segunda é verdade aqui:

| Item | Palavra do dono | O que isso significa na prática |
|---|---|---|
| Publicação definitiva (D1–D5: domínio, DNS, secrets, ambiente `production`, rollback) | *"isso não precisamos agora mas vamos ir vendo"* | o site segue no endereço provisório, que já serve o orientador; os cinco itens continuam em §1, sem pressa e sem sumir |
| Memória durável entre visitas | *"também podemos ir vendo"* | a memória continua morrendo com a aba, por escolha; o aviso de privacidade atual continua verdadeiro, e nada precisa ser reescrito agora |

## 5. Decisões conscientes que continuam valendo

Não são dívidas — são escolhas, registradas para ninguém "consertar" por engano.

- **A chave viaja na query do WebSocket do Google.** Aceitável para piloto BYOK com consentimento;
  não aceitável como produto aberto. O token efêmero foi medido e **não** autentica a sessão Live
  (4 formas, 1007/1008). Detalhe em `release-checklist.md`, item 13.
- **Escuta contínua com VAD do servidor**, não VAD manual: desligar a detecção automática mata a
  transcrição (medido no CopilotSpeaker, 2026-08-03).
- **Meia-duplex é rede de segurança**, não o comportamento: liga sozinha ao reconhecer a assinatura
  do laço de eco (3 interrupções seguidas sem transcrição de entrada).
- **`dist/` não é versionado**; a imagem reconstrói do zero.
- **`.env` com a chave do dono fica na máquina dele**, fora do git, autorizado em 2026-11-12 para
  os cenários AO VIVO rodarem sem intervenção.
- **A primeira visita NÃO abre o painel junto com o exemplo, e a alavanca NÃO pisca.** As duas
  ideias são do dono (2026-11-15) e foram **recusadas com motivo**, não esquecidas: a pesquisa de
  UI/UX da change `guide-the-first-run-trails` mostra que orientação sobreposta faz o produto
  parecer **mais** complexo do que é — e quem chega para desenhar um diagrama não quer um painel
  de conversa por cima dele. O lugar da orientação passou a ser uma **barra encostada na
  alavanca**, que diz o que dá para fazer naquela trilha e oferece **uma** sugestão clicável.
  O argumento inteiro está em `changes/guide-the-first-run-trails/design.md` (G2) — está lá
  justamente para o dono poder **reverter a recusa com o contra-argumento na mão**: a decisão
  final é dele, e uma recusa sem motivo escrito seria só teimosia de quem implementa.

## 6. Fora do MVP, agora virando trabalho

O que estava em "Futuro" na change do MVP deixou de ser ideia e virou o próximo bloco:

| Era | Vira |
|---|---|
| F.3 Tools read-only de XML e métricas | change `add-bpmn-diagram-tools` |
| F.4 Edição de diagrama por agente | change `add-bpmn-diagram-tools` |
| F.5 Memória durável entre sessões | **change própria, ainda não escrita** — o harness decidiu que a memória morre com a aba, e persistir exige reescrever o aviso de privacidade e pedir consentimento. Divergência apontada pela pesquisa de 2026-11-12 |
| F.1 RAG sobre a norma BPMN | **substituido** por base OKF citavel + function calling: change `add-bpmn-norm-knowledge-base` (decisao do dono, 2026-11-12) |
| F.2 MCP | continua fora: não há servidor nosso para falar MCP |

## 7. A tela base deixou duas pontas (2026-11-15)

Abertas pela change `introduce-bpmn-first-run-workspace`, que trocou o auto-load da pizzaria por um
convite com três caminhos. Ficaram de fora **de propósito**, e estão aqui para não serem
descobertas por acaso:

| Ponta | O que acontece hoje | Por que não entrou |
|---|---|---|
| ~~O botão "♻️ Novo" da barra~~ | **fechado em 2026-11-15**, a pedido do dono | virou "♻️ Recomeçar" e leva ao MENU: com trabalho salvo, o primeiro clique pergunta no próprio botão por 5 s e o segundo descarta. Não é `confirm()` nativo — diálogo do navegador trava a página dirigida, e confirmação sem prova viva vale tanto quanto nenhuma. Prova nas tarefas da change, bloco 9 |
| ~~O exemplo em inglês~~ | **fechado em 2026-11-15**, a pedido do dono | traduzido para pt-BR mantendo os ids (`_6-463` continua `_6-463`); os 56 pontos que casavam por nome foram atualizados junto — bateria e `npm test` verdes. Prova nas tarefas da change `introduce-bpmn-first-run-workspace`, bloco 8 |
