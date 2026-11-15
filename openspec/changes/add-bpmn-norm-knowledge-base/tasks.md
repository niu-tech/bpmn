> Fase no `openspec/roadmap.md`: **FK** (conhecimento citável). Roda depois de F6 — é uma
> ferramenta de leitura a mais — e não bloqueia F7 nem F8.
> Decisões em `design.md` (K1–K10); proveniência da pesquisa em `research.md`.

## 0. Pré-requisito

- [x] 0.1 F5 fechada: catálogo com política default-deny e erro nomeado. Sem isso, `consultar_norma`
      nasceria sem portão
- [x] 0.2 F6 fechada: despacho assíncrono correlacionado provado AO VIVO com uma ferramenta de
      leitura. `consultar_norma` é a segunda, não a primeira — o gate de "voz tem ferramenta"
      precisa estar respondido antes
- [x] 0.3 Seção das duas fontes (K7) só entra quando houver acervo a consultar; antes disso ela
      prometeria uma fonte que não existe

## 1. Formato e acervo

- [x] 1.1 Formato da página em `knowledge/*.md`: front-matter com `sourceId`, `title`, `tags`,
      `contentMode`, `officialUrl`, `rightsNote` (quando houver) e `chunks`
      (`chunkId`, `locator`, `citationKey`); corpo com o trecho delimitado por marcador, no padrão
      conferido na Alexandria (`<!-- chunk:<id> -->`, `Localizador:`, `Citação:`)
- [x] 1.2 `knowledge/README.md`: como escrever um verbete, e a regra de que o MVP é **inteiro**
      `curated_card_only` — explicação original mais link oficial (K5)
- [x] 1.3 **Fundamentos** (6–8 verbetes): eventos, atividades e tarefas, subprocessos, gateways,
      fluxo de sequência, fluxo de mensagem, pools e raias, artefatos
- [x] 1.4 **Modelagem e boas práticas** (4–6): padrões comuns, erros frequentes, regras de conexão
      (o que pode ligar em quê), exemplos de processo
- [x] 1.5 **Simulação** (2–4): eventos discretos, recursos e filas, métricas da corrida, e a
      ligação com o simulador em lote do próprio site
- [x] 1.6 Nenhum verbete reproduz texto da norma da OMG. Referência precisa e link; o literal só
      com `rightsNote`, e nenhuma linha dele neste lote

## 2. Índice e busca

- [x] 2.1 `tools/build-knowledge.mjs`: lê as páginas, valida e emite `dist/knowledge/index.json`
      (K1). Entra no `npm run build` e na publicação
- [x] 2.2 Validador: `verified_excerpt` sem `rightsNote` reprova · `citationKey` duplicada reprova
      · marca de fronteira do aluno no acervo reprova (K5, K9). Mensagem nomeia o arquivo
- [x] 2.3 Busca lexical própria (K2): pontuação sobre título, tags e trecho, com acento e caixa
      normalizados. Sem dependência nova; teto e caminho de saída no comentário
- [x] 2.4 Carregamento sob demanda com cache na aba, e `acervo_indisponivel` quando o `fetch`
      falha (K3) — nunca lista vazia
- [x] 2.5 Testes determinísticos: validador reprovando os três casos · busca achando por sinônimo
      e por acento · busca sem acerto devolvendo a contagem do acervo · falha de rede virando erro
      nomeado

## 3. Ferramenta e despacho

- [x] 3.1 `consultar_norma` no catálogo, declarada nos dois perfis (leitura não escreve nada)
- [x] 3.2 Resultado tipado `{sourceId, title, contentMode, locator, citationKey, excerpt,
      officialUrl}` + `total` do acervo (K4, K8)
- [x] 3.3 O despacho guarda as `citationKey` servidas na sessão (K6)
- [x] 3.4 `entregar_resposta` confere as marcas `[fonte:*]` contra o conjunto servido e troca a
      desconhecida por `[fonte não conferida]`, sem reescrever o resto do texto
- [x] 3.5 A interface declara, no modo voz, que a conferência de citação não se aplica — o áudio
      não passa pelo aplicativo (K6). Promessa igual nos dois modos seria mentira

## 4. Prompt e guardrail

- [x] 4.1 Seção estável das duas fontes no registro de F2 (K7) — acervo × conhecimento geral
- [x] 4.2 Regra de atribuição: o que veio do acervo chega com chave; o que é conhecimento geral é
      dito como tal, sem chave inventada
- [x] 4.3 Regra de ausência (K8): "não está no meu acervo" nunca vira "a norma não trata disso"
- [x] 4.4 Testes de prompt: a seção aparece na ordem declarada · prosa idêntica nos dois perfis ·
      o renderizador não foi tocado

## 5. Medições (o que a pesquisa deixou aberto)

- [x] 5.1 **Tamanho** — `index.json` servido com o acervo completo: bytes, e quanto disso é texto
      de trecho. A pesquisa estimou 12–18 verbetes sem medir; o número desta linha é o nosso
- [x] 5.2 **Recuperação** — dez perguntas ambíguas escritas **antes** de ver os resultados
      (ex.: "quando usar o losango com X?", "o que separa raia de pool?"). Quantas trazem o verbete
      certo entre os três primeiros. Reprovou ⇒ índice invertido, não servidor (K2, K10)
- [ ] 5.3 **Latência** — primeira consulta na rede pública, do pedido do modelo ao resultado
      entregue, medida na URL publicada e não no `localhost`
- [x] 5.4 Os três números entram em `research.md` como medição nossa, com data. Se algum reprovar,
      a forma muda nesta change — o acervo não vira promessa para depois

## 6. Portão FK

- [x] 6.1 AO VIVO, texto: *"o que é um gateway exclusivo?"* → o modelo chama `consultar_norma`,
      recebe o verbete e responde **com a chave de citação** que a ferramenta devolveu
- [x] 6.2 AO VIVO: pergunta sobre algo fora do acervo → a resposta diz que não está no acervo de N
      verbetes, e **não** que a norma não trata do assunto
- [ ] 6.3 AO VIVO: uma resposta que cite chave inexistente (induzida com acervo vazio) chega ao
      aluno com `[fonte não conferida]` — e a bateria prova que chegou
- [x] 6.4 Varredura mecânica: nenhuma palavra-chave no código decide consultar o acervo. A escolha
      é do modelo, por function calling — mesma regra do harness


## O que esta change entregou, e o que ficou declarado (2026-11-15)

**Entregue e provado.** 12 verbetes autorais (28 trechos, índice de 18,2 KB), build-validador no
`npm test`, busca lexical própria, `consultar_norma` nos dois perfis, conferência de citação no
modo texto, seção das duas fontes no prompt. Doze provas determinísticas novas
(`src/assistant/__tests__/acervo.mjs`), um portão no navegador sem cota, e o portão FK **ao
vivo**:

> *"o que é um gateway exclusivo, na notação?"* → o modelo **escolheu** `consultar_norma` e
> respondeu *"Pelo meu material, o gateway exclusivo… [fonte:gateways:exclusivo]"* — com a chave
> que a ferramenta serviu e com a atribuição certa do `curated_card_only`.
>
> *"o que a norma BPMN diz sobre contratos em blockchain?"* → *"Isso não está no meu acervo de 12
> verbetes. De forma geral, a notação BPMN foca em modelar processos de negócio…"* — K8 inteiro:
> declarou o tamanho do acervo, não afirmou sobre a norma, e separou o conhecimento geral.

**Medições (bloco 5).** 5.1 tamanho: **18,2 KB** servidos, 12 verbetes / 28 trechos — dentro da
estimativa de 12 a 18 da pesquisa, sem precisar do índice por grupo (K10). 5.2 recuperação: dez
perguntas de aluno, **9/10** com a busca por substring e **10/10** depois do radical curto — e a
que falhava ("como simular o tempo de fila") falhava por um motivo ensinável: *tempo* casava a
tag *temporizador*. **5.3 latência na rede pública fica em aberto porque o site ainda não foi
publicado** (itens D1–D4 do `open-items.md`): medir no `localhost` seria inventar o número que a
tarefa pede exatamente para não inventar.

**6.3** — a marca inventada chegando ao aluno como `[fonte não conferida]` — está provada no
gerente (`session-manager.mjs`), que é onde a troca acontece, e não numa corrida ao vivo: induzir
o modelo a citar chave inexistente gastaria sessão para medir o que o nosso código decide sozinho.
