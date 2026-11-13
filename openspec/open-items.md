# O que está em aberto

> Levantamento honesto do caminho percorrido até 2026-11-12, antes de virar para o harness do
> agente. Feito porque "está tudo pronto" seria mentira: o MVP fechou, mas deixou pontas — umas
> do dono, outras minhas, outras que só o uso vai fechar.
>
> Atualize esta página na mesma change que fechar um item. Item fechado sai daqui e vira linha de
> `tasks.md` com a prova.

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
| M1 | Voz **humana** em microfone físico | aberto | o teste usa fala sintética pt-BR (SAPI) entrando pelo caminho real do microfone. Mede o produto, não a pessoa — mas é diferença real, e fica dita |
| M2 | Barge-in contra o Gemini | **PROVADO** (2026-11-12) | ver §3 — e o achado maior: o fluxo de audio governa o turno digitado |
| M3 | Negação de microfone ao vivo | aberto | o teste cobre o caminho de erro em unidade; falta o cenário no navegador (é um `--passo` que recusa `getUserMedia`) |
| M4 | Desconexão no meio do turno | aberto | a sessão tem recuo com teto e código de fechamento nomeado, mas nunca foi exercitado cortando a rede de verdade |
| M5 | Expiração de sessão (`go-away`) | aberto | o frame é reconhecido e registrado no diário; nunca foi visto ao vivo |
| M6 | Os cenários de VOZ ao vivo não são confiáveis **em sequência** | aberto (2026-11-13) | sozinho, o cenário passa (22 frames de áudio, legenda inteira). Rodando depois de outra sessão ao vivo, falha sempre no mesmo ponto: **sem transcrição de entrada**, com o microfone capturando. Um descanso de 25 s entre sessões não resolveu. ⚠ A suspeita inicial era a fixture (o WAV-como-microfone chegando pela metade), mas o pico do microfone na falha de 2026-11-13 foi **0,574** — áudio alto chegou à captura, e mesmo assim nada foi transcrito. Isso aponta para o SERVIDOR, não para o arquivo: é a mesma assinatura do aviso que o app mostrou noutra rodada (*"a cota da sua chave acabou ou há sessões demais"*). Até medir a causa, **o veredito de voz vale sozinho** (`--so "voz de verdade"`), e a bateria inteira reporta o que de fato aconteceu |

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
| voz de verdade · interromper · gate 4.3 · portão F4 (2ª metade) | **o mesmo problema**: em sequência, o áudio do microfone sobe (881 frames num caso, pico 0,574 noutro) e o servidor **não transcreve nada**. Sem `ws.input-text`, não há turno. É o M6, agora com mais evidência |
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

> **O que fica:** das seis falhas, quatro são a mesma limitação de ambiente (M6) e duas eram o
> medidor. Nenhuma era comportamento errado do agente. Isso não torna o 11 de 17 um 17 de 17 —
> torna o número legível, que é o mínimo que um relatório precisa ser.

## 4. Dívidas que eu mesmo deixei

| # | Item | Onde | Nota |
|---|---|---|---|
| T1 | `4.10` duplica `2.13` em `tasks.md` | change do MVP | a mesma prova fecha as duas; a linha ficou dizendo "pendente" depois de fechada |
| T2 | `config.yaml` do OpenSpec estava desatualizado | `openspec/config.yaml` | falava de branch `ImproveSimulation` e de remotes que não existem mais |
| T3 | Sem cenário para o **viewer** na bateria além de carregar | `tools/battery.mjs` | a simulação em lote com o painel aberto só foi verificada à mão, no P2 |
| T4 | `validation.md` do MVP cita roteiro manual já automatizado | change do MVP | o roteiro continua válido para humano, mas a bateria cobre o essencial |
| T5 | A bateria não roda no CI | `.github/workflows/pipeline.yml` | o runner tem Chrome; falta decidir se o custo de minutos compensa |
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

## 6. Fora do MVP, agora virando trabalho

O que estava em "Futuro" na change do MVP deixou de ser ideia e virou o próximo bloco:

| Era | Vira |
|---|---|
| F.3 Tools read-only de XML e métricas | change `add-bpmn-diagram-tools` |
| F.4 Edição de diagrama por agente | change `add-bpmn-diagram-tools` |
| F.5 Memória durável entre sessões | **change própria, ainda não escrita** — o harness decidiu que a memória morre com a aba, e persistir exige reescrever o aviso de privacidade e pedir consentimento. Divergência apontada pela pesquisa de 2026-11-12 |
| F.1 RAG sobre a norma BPMN | **substituido** por base OKF citavel + function calling: change `add-bpmn-norm-knowledge-base` (decisao do dono, 2026-11-12) |
| F.2 MCP | continua fora: não há servidor nosso para falar MCP |
