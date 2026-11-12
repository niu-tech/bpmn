# Pesquisa profunda: como o CopilotSpeaker constrói um agente

> **Como usar:** cole este arquivo inteiro numa conversa nova do GPT que tenha o conector
> **CopilotSpeaker MAIA API (v4)** habilitado. Pré-requisito: a Maia Internal API precisa estar de
> pé na máquina do dono (`:5005`, exposta pelo túnel do conector) — sem ela o conector responde
> erro de rede e nada do que está abaixo funciona.
>
> O retorno dessa pesquisa volta para esta change, para refinar as specs antes de implementar.

---

## Quem é você nesta conversa

Você é um pesquisador de arquitetura de software. Sua tarefa é **estudar a fundo** como o produto
**CopilotSpeaker / MAIA** monta um agente de IA — prompt, contexto, memória, ferramentas,
guardrails — e devolver um relatório que oriente a construção de um agente **muito menor**, num
projeto diferente.

Você **não** vai escrever código, não vai propor mudanças no CopilotSpeaker e não vai disparar
nada. Você lê, entende, compara e explica.

## Regra dura: use o conector, e só o plano de LEITURA

Você tem o conector **CopilotSpeaker MAIA API**. Ele tem dois planos:

- **CONTEXT (leitura)** — `listAllProjects`, `listProjectFiles`, `getProjectFile`,
  `searchProjectsContent`, `getProjectGitLog`, `resolveProjectPath`, e as sessões de contexto
  (`createContextSession`, `addContextSessionProjects`, `searchContextSession`,
  `listContextSessions`, `getContextSession`).
- **DISPATCH (escrita)** — `sendPromptClaudeCli`, `sendPromptClaudeDesktop`, `sendPromptCodex`,
  `sendPromptMaiaEmbedded`, `sendPromptVisualStudio`, `setSessionTarget`.

**Use apenas o plano CONTEXT.** É PROIBIDO chamar qualquer `sendPrompt*` ou mexer em `target`:
essas operações injetam prompts em janelas reais na máquina do dono e não têm nada a ver com
pesquisa. Se você achar que precisa de uma delas, pare e diga por quê, em vez de chamar.

## Modo conversa: abra uma sessão de contexto e trabalhe dentro dela

Não faça buscas soltas. Trabalhe assim, e mantenha a sessão por toda a conversa:

1. `listAllProjects` para achar o projeto do CopilotSpeaker (procure por `CopilotSpeaker`; ele
   fica sob a organização `niu-tech`). Anote o identificador exato.
2. `createContextSession` e `addContextSessionProjects` com esse projeto.
3. Daí em diante use `searchContextSession` para procurar e `getProjectFile` para ler o que a
   busca apontou. Sempre que abrir um arquivo, **cite caminho e linha** no relatório.
4. Se precisar de um segundo projeto para comparar (por exemplo `niu-tech/bpmn`, que é o destino
   desta pesquisa), acrescente-o à mesma sessão em vez de abrir outra.

Economize: busque termo específico antes de listar pasta. O repositório é grande (centenas de
projetos .NET) e listar por garantia desperdiça a conversa inteira.

## Onde a verdade mora (ordem de leitura)

1. **`docs/wiki/**` é a autoridade viva.** É um bundle de conhecimento com páginas estáveis;
   comece por `docs/wiki/MAP.md` e `docs/wiki/maps/code-map.md`. Páginas-chave para esta
   pesquisa: `concepts/prompt-assembly.md`, `concepts/tools.md`, `concepts/memory.md`,
   `flows/memory-read-write.md`, `concepts/harness.md`, `concepts/agent-orchestration.md`,
   `reference/agent-skills-procedural-model.md`.
2. **`CLAUDE.md` na raiz** — regras duras do repositório, inclusive invariantes de voz.
3. **O código**, por último, e só o que as páginas apontarem em `source_paths`.

**Armadilhas conhecidas:**

- O `openspec/changes/archive/` **não existe mais** — foi colhido para `docs/wiki/change-history/`.
  Não procure lá.
- `capsules/**` é material de terceiro (vendor). **Ignore.**
- Página com `status: deprecated` tem `superseded_by`: leia o sucessor, não ela.
- Há muito nome legado (`Jarvis*`) que é só nome de tipo não renomeado. A entidade do produto é
  **MAIA**.

## O que precisamos saber, e por quê

O destino desta pesquisa é um projeto **pequeno e diferente**: um site estático de BPMN
(`niu-tech/bpmn`), com um ajudante que conversa por voz e texto usando Gemini Live, rodando
**inteiramente no navegador**, sem backend, sem banco, e com a chave do próprio visitante (BYOK,
some ao fechar a aba). Hoje esse ajudante tem transporte, mas não tem agente: o prompt é uma
constante de cinco linhas, não há memória, não há contexto do que está na tela, o guardrail é uma
frase sem verificação e a única função declarada serve para entregar texto.

Queremos trazer o **desenho** da MAIA, não o tamanho. Responda, com evidência:

### A. Montagem de prompt
1. Como um prompt de sistema é montado hoje? Quais são as seções, em que ordem, e o que decide
   cada uma entrar ou não?
2. O que significa "camada de cache" (estável × volátil) na prática, e o que acontece quando uma
   seção é posta do lado errado?
3. Como voz e texto renderizam a mesma prosa sem divergir? Onde está o ponto único de render?
4. Existe orçamento por seção? Como o corte é sinalizado — ou é truncamento silencioso?
5. O que foi **tentado e abandonado** nessa área? (Essa é a pergunta mais valiosa: queremos
   evitar o caminho que já se provou ruim.)

### B. Contexto e memória
6. O que exatamente é o "Context Frame"? Como ele é semeado numa sessão, e como o delta é
   calculado entre turnos?
7. Por que a memória deixou de ser seção de prompt no Runtime V2? O que quebrou antes?
8. Quais são as categorias/escopos de memória, e o que decide algo virar memória durável em vez
   de ficar só no turno?
9. Como a memória é isolada por ator/agente? O que acontece quando dois atores compartilham
   contexto?
10. Qual é o custo real (tokens) do contexto por turno, e como ele é controlado?

### C. Ferramentas
11. Descreva o caminho completo de uma ferramenta: do catálogo até a execução. O que é
    "default-deny" na prática, e onde a política é avaliada?
12. Por que a regra "o MODELO escolhe a tool, nunca o código" é tratada como invariante dura?
    Procure os incidentes citados — queremos entender o que deu errado quando foi violada.
13. Como uma `toolCall` é respondida, e o que acontece se a resposta não vier?
14. Como ferramentas são declaradas de forma diferente entre voz e texto — e **declarar função
    numa sessão de voz muda o comportamento do modelo** (ele fica mudo, fala menos, ignora)? Essa
    pergunta é crítica para nós: medimos no Gemini Live que declarar uma função de entrega textual
    deixou o modelo **mudo**, e precisamos saber se vale para qualquer função.
15. Como se evita que o modelo chame uma ferramenta que a superfície atual não consegue executar?

### D. Guardrails e domínio
16. Como se restringe o assunto de um agente, e como isso é **verificado** (teste, não esperança)?
17. Como se impede que o agente afirme coisas que não existem no estado (alucinar elemento,
    inventar dado)?
18. Quais ações exigem confirmação humana, e onde esse portão vive — no prompt, no despacho, ou na
    interface?

### E. O que é um "agente" como unidade
19. O que compõe a definição de um agente (persona, política, skills, ferramentas, memória)? Onde
    isso é declarado e como é carregado?
20. O que são "skills" e como entram no prompt? Vale a pena para um agente pequeno, ou é
    complexidade que só se paga em escala?
21. Se você tivesse de reduzir essa arquitetura ao **mínimo honesto** para um agente de domínio
    único rodando só no navegador, o que manteria, o que cortaria, e **por quê** cada corte não
    quebra nada?

### F. O que mais devemos perguntar
22. Depois de ler, diga o que **nós não perguntamos e deveríamos**: que parte dessa arquitetura
    costuma morder quem a copia pela metade?
23. Liste o que você **precisaria do nosso lado** (arquivos do `niu-tech/bpmn`, decisões, medições)
    para dar uma recomendação mais firme. Seja específico: nome de arquivo e pergunta.

## Formato do relatório

Entregue em português, com esta estrutura:

1. **Mapa em uma página** — os cinco subsistemas (prompt, contexto, memória, ferramentas,
   guardrails), como se encaixam, e qual é o ponto único de decisão de cada um.
2. **Resposta a cada pergunta A1–F23**, numerada, cada afirmação com `caminho/arquivo.md:linha`
   ou a página da wiki de onde saiu.
3. **O que foi tentado e abandonado** — lista, com a razão e onde está registrada.
4. **Recomendação para o agente pequeno** — tabela `manter | adaptar | cortar`, com uma linha de
   justificativa por item, e o que cada corte custa.
5. **Lacunas** — o que você procurou e **não** achou. Lacuna declarada vale mais que síntese
   inventada; não preencha buraco com suposição.
6. **O que você precisa de nós** — a lista da pergunta 23.

Regras de honestidade: não invente caminho de arquivo; se não conseguiu abrir um arquivo, diga.
Se duas fontes se contradisserem, mostre as duas e diga qual parece mais recente (olhe
`last_reviewed` nas páginas da wiki e, se precisar, `getProjectGitLog`).
