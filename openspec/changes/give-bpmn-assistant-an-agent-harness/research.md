# Pesquisa: o que a MAIA ensina, e o que ela desmentiu

**Origem.** Pesquisa profunda feita em 2026-11-12 por um GPT com o conector CopilotSpeaker MAIA
API v4, no plano de leitura, a partir de `research-prompt.md`. Sessão de contexto
`pesquisa-harness-maia-para-bpmn-2026-11-12`, com os projetos `niu-tech/CopilotSpeaker` e
`niu-tech/bpmn`. Nenhum código, git ou OpenSpec foi alterado por ela.

O relatório completo vive na conversa do GPT. Esta página guarda o que **mudou decisão aqui** —
que é o que a change precisa carregar.

## 1. O que eu conferi antes de aceitar

O relatório fez três afirmações concretas sobre o nosso código. Conferi as três no disco:

| Afirmação | Veredito | Onde |
|---|---|---|
| `buildToolResponse` devolve `{ok:true}` para **toda** chamada | **confirmado** | `src/assistant/live/protocol.js:164` |
| `session.js` responde à `toolCall` **antes** de qualquer executor | **confirmado** | `src/assistant/live/session.js:217` |
| A instrução de entrega só é anexada quando o prompt é a constante antiga | **confirmado** | `src/assistant/live/protocol.js:79` |

As três são defeitos reais do desenho atual para o que vem pela frente, e cada uma virou decisão
ou tarefa. O relatório ganhou crédito ao acertar o que era verificável.

## 2. O que o relatório DERRUBOU do que eu tinha escrito

Esta é a parte que importa. Quatro decisões minhas estavam erradas ou frouxas.

### 2.1 "Declarar ferramenta emudece o modelo na voz" era generalização indevida

Eu tratei a medição do P1 como se valesse para qualquer função declarada. O relatório mostra que
o CopilotSpeaker **executa ferramentas governadas durante turnos de voz** e o Gemini continua
falando (`docs/wiki/concepts/voice-live.md:75–95`).

O que foi medido aqui é mais estreito: declarar `entregar_resposta` **junto com a instrução que
manda entregar o texto por ela** produziu zero áudio. A causa provável é a **semântica da função
e a instrução**, não a existência de uma declaração.

→ Muda H9 e a tarefa de medição: o teste passa a ser uma função **read-only real**
(`descrever_diagrama`) numa sessão de voz, verificando se o modelo chama, recebe e **continua
falando**.

### 2.2 "Seção estável é cacheável" não tem prova

O registro de seções da MAIA classifica `Stable`/`Volatile`, mas o próprio comentário do código
diz que a classificação nasceu **informativa**
(`src/CopilotSpeaker.Maia.PromptAssembly/Runtime/MaiaPromptSectionRegistry.cs:1–51`). Não há prova
de economia de cache no Gemini só por etiquetar.

→ A razão real de separar estável e volátil continua de pé — **ordem, orçamento e o que pode
mudar sem reabrir a sessão** —, mas a promessa de cache sai do design.

### 2.3 Ausência na amostra não é ausência no diagrama

A projeção H4 manda **uma amostra** de elementos, com teto. Minha spec dizia "elemento inexistente
é reportado como ausente" — e com amostra truncada isso faz o agente afirmar que algo não existe
quando ele só não recebeu.

→ Para afirmar inexistência é preciso **consultar o registro inteiro** (`buscar_elemento`). Sem
isso, a resposta honesta é "não consta no que recebi; deixe eu procurar".

### 2.4 Divergência entre os meus próprios documentos

`open-items.md` listava memória durável como trabalho **desta** change; o design e a spec exigem
que tudo morra com a aba. Contradição minha, apontada pelo relatório.

→ Persistência vira change própria. `open-items.md` corrigido.

## 3. O que eu não tinha considerado

### 3.1 Texto do diagrama é entrada NÃO CONFIÁVEL

Nome de tarefa, documentação de elemento e o conteúdo de um `.bpmn` que o aluno **abre do disco**
entram no contexto do modelo. Qualquer um deles pode conter instrução dirigida ao agente.

É a armadilha F22.4 do relatório, e é a mais séria para nós: o produto já aceita upload de arquivo
(`#bz-file-input`). Vira decisão de design (H11) e requisito de spec.

### 3.2 Despacho de ferramenta precisa ser assíncrono e correlacionado

Hoje a resposta sai antes de haver execução, e sempre positiva. Ferramenta de verdade tem
duração, pode falhar, pode ser recusada pela política e pode ser cancelada. O relatório também
aponta que **um timeout único para o turno inteiro** faz o cliente desistir enquanto a ferramenta
ainda roda (`docs/wiki/reference/turn-budget-chain.md:36–108`).

→ H12 e H15.

### 3.3 Confirmação atrasada não pode valer para um diagrama que mudou

O aluno confirma uma remoção; entre o pedido e o clique, ele mexeu no diagrama. O relatório
registra que a confirmação precisa identificar **exatamente** o elemento e a operação.

→ H14: a confirmação carrega o `id` **e** a versão do diagrama; versão diferente, refaz o pedido.

## 4. O que foi tentado e abandonado na MAIA

Lista do relatório, mantida aqui porque é o tipo de conhecimento que não se redescobre barato.

| Abordagem | Por que caiu |
|---|---|
| Transcrição e contexto mutável dentro do `systemInstruction` | contamina a identidade estável; atualizar exige reconstruir a sessão |
| Resolver memória sem prova de entrega | o sistema calculava o contexto e o modelo continuava sem ele |
| Montagem de contexto duplicada por caminho de execução | um caminho mandava o pacote, o outro não |
| Decisão de ferramenta por palavra-chave | disparo e interpretação errados; duas fontes de decisão concorrendo |
| Skill como seleção permanente | skill é procedimento acionado por tarefa, não estado global |
| Carregar procedimento de skill no setup | desperdício de contexto; some a separação catálogo × execução |
| Ferramenta fora da capacidade real da superfície | o modelo acreditava poder executar o que o host não suporta |
| Resposta de voz por caminhos concorrentes | supressão de áudio, identidade errada, timeline divergente |
| Timeout único para o turno inteiro | o cliente desistia enquanto a ferramenta ainda executava |
| Reaproveitar conversa recente entre autorias distintas | contaminação de uma criação pela anterior |

## 5. Manter / adaptar / cortar

Veredito do relatório, que adoto:

**Manter** — persona de domínio, seções tipadas, renderizador único, projeção do diagrama,
catálogo com default-deny, executor governado, confirmação de remoção, telemetria redigida e
testes.

**Adaptar** — Context Frame vira objeto JS versionado (sem runtime distribuído); histórico e
memória ficam em RAM por aba.

**Cortar** — memória durável governada, RAG, MCP, motor de skills, multiagentes e delegação.

> A frase que resume: *"não é uma MAIA reduzida proporcionalmente; é um tutor BPMN com contrato
> de agente pequeno, contexto factual da tela e ferramentas locais governadas."*

## 6. Ordem recomendada, que passou a valer

1. **Harness primeiro**, com o gateway de ferramentas **sem nenhuma ferramenta de edição**.
2. **Ferramentas de leitura** (`descrever_diagrama`, `buscar_elemento`, `detalhar_elemento`,
   `resumir_simulacao`) antes de qualquer escrita.
3. **Gate transversal: voz com ferramentas.** Declaração, execução, `toolResponse`, retomada da
   fala, interrupção, timeout e erro — numa sessão de voz. Arquitetura correta no texto não
   garante comportamento no modo voz, e esse gate atravessa as duas changes.

## 7. O que continua sem medição

O relatório foi explícito sobre o que **não** fez, e isso continua nosso: não mediu o teto do
`clientContent`, não rodou o Gemini ao vivo, não reexecutou a bateria, não certificou voz humana
nem barge-in. Os relatos de git e OpenSpec são evidência de execução anterior, não teste novo.

Acrescento o que ele levantou e eu também não sei: não há prova de que a recusa de domínio
resista a entrada adversarial.
