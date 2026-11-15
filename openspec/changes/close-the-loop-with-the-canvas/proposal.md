## Why

Hoje a ferramenta devolve **o que ela fez**; o aluno olha **o que ficou na tela**. São duas coisas
diferentes, e o modelo só recebe a primeira.

Três sintomas da mesma falta, todos medidos nesta semana:

1. **O elemento nasceu como ramo e o agente narrou como sequência.** O `criar_elemento` respondia
   `{criado, ligadoA, ligacao}` — tudo verdade, e mesmo assim insuficiente: o bpmn-js tinha
   desenhado um caminho paralelo um degrau abaixo, e isso não estava na resposta. O conserto
   (`ramo` + `avisoDeRamo`, 2026-11-14) resolveu **esse** caso com um campo novo. O próximo caso
   vai pedir outro campo, e o seguinte outro: o que falta não é um campo, é a **leitura da tela**.
2. **Candidato devolvido morre como texto.** `sem_lugar` já devolve os pools possíveis e
   `buscar_elemento` já devolve os elementos que casam. O aluno lê os nomes e tem de digitar a
   resposta — num produto em que ele está falando, de mãos livres, olhando o desenho.
3. **O aluno age no canvas e o agente não sabe.** Ele clica num elemento, importa um arquivo, dá
   `Ctrl+Z` — e a conversa segue como se nada tivesse acontecido, porque o contexto só é
   recalculado na borda do turno seguinte.

A origem do remédio é externa e vale dizer: a PoC do *appointment agent* do Orbit (Gemini 3.8 Live,
2026-11), onde o agente dirige um assistente de agendamento, resolveu exatamente isto com três
mecanismos — o resultado da ferramenta é **uma descrição da tela depois da ação**, as mensagens que
a página manda ao modelo são marcadas como **da página** (e nunca viram fala do usuário), e as
opções ambíguas viram **botões no chat**. Nada daquele código entra aqui (é de outro repositório,
sob outra licença e com dado de paciente): o que entra é a forma, reescrita para o bpmn-js.

## What Changes

**1. Toda ferramenta de escrita devolve a leitura da tela.**

Um campo `tela` no resultado, produzido por uma função única `estadoDaTela()`: o que o diagrama é
agora (processo ou colaboração), o que está selecionado, quantos elementos existem, o que o
elemento tocado tem de entradas e saídas, quais são as **pontas soltas** (o que ainda não liga em
nada), e uma linha de regra sobre o que o agente **não** pode fazer sem perguntar.

Curta por construção: é a mesma economia da projeção (H4/H13), não o diagrama inteiro.

**2. Mensagens da PÁGINA, com a vez do aluno respeitada.**

Um canal novo: a página pode contar um fato ao modelo (`(da página) o aluno selecionou "Receber
pedido"`), e esse texto **nunca** é apresentado como fala do aluno. A fila tem três regras, e as
três existem por causa de um defeito previsível:

- só envia quando o modelo está calado e sem turno aberto — senão atropela a fala;
- é descartada se o aluno falar antes de ela sair — a vez é dele;
- expira em 45 s — fato velho não vira pergunta fora de hora.

Entram nesse canal: seleção mudou, diagrama importado, `Ctrl+Z` do aluno, simulação rodou.

**3. Candidato vira botão.**

Quando a ferramenta devolve candidatos (pools de `sem_lugar`, elementos de `buscar_elemento`,
qualquer ambiguidade), o painel desenha botões. O clique manda `(escolhido no chat) <nome>` e
**destaca o elemento no desenho** com o verbo `destacar` que já existe.

**4. Uma regra no prompt.**

Mensagem que começa com `(` vem da página: aja sobre ela, não a leia em voz alta, e ela não muda
o idioma da resposta.

## Impact

- `src/assistant/tools/leitura.js` — nasce `estadoDaTela()` (leitura pura, sem decisão).
- `src/assistant/tools/escrita.js` — cada executor acrescenta `tela` ao resultado.
- `src/assistant/session-manager.js` — a fila de mensagens da página e o canal `(da página)`.
- `src/assistant/ui/widget.js` — os botões de candidato e a bolha de nota da página.
- `src/assistant/agent/sections.js` — a regra do `(`.
- Testes: `__tests__/leitura.mjs`, `__tests__/escrita.mjs`, `__tests__/session-manager.mjs`;
  cenário de navegador em `tools/battery.mjs`.

**Fora desta change:** sugestão proativa (o agente comentar o que viu sem ser perguntado) — isso é
E2/F8 e precisa do portão de confirmação falada, que é a change irmã. Aqui a página só **conta**;
quem decide o que fazer com o fato continua sendo o modelo, e quem decide agir continua sendo o
aluno.

## Acceptance

1. Depois de qualquer escrita, o resultado entregue ao modelo descreve o desenho de agora.
2. Uma mensagem da página nunca aparece como bolha do aluno nem muda o idioma da resposta.
3. Uma mensagem da página enviada enquanto o aluno fala é descartada, não enfileirada para depois.
4. Ambiguidade de pool ou de elemento se resolve em **um clique**, e o elemento escolhido aparece
   destacado no desenho.
5. `npm test` verde; cenário de navegador provando (1) e (4) sem gastar cota.
