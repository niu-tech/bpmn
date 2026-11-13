# Design — base de conhecimento citável de BPMN

Decisões tomadas depois da rodada de pesquisa (`research.md`). O que a pesquisa fechou está
marcado; o que ela deixou aberto virou medição ou gate de build, nunca suposição escrita como se
fosse fato.

A forma vem da Alexandria TCC do CopilotSpeaker, conferida no disco: página versionada com
front-matter, trecho delimitado por marcador, localizador, chave de citação, limite de evidência
e hash. O que não vem é infraestrutura: nada de MCP, banco, embeddings ou serviço.

## K1 — A página é a fonte; o índice é gerado no build

O acervo mora em `knowledge/*.md`, uma página por verbete, com front-matter no formato da
Alexandria (`sourceId`, `title`, `contentMode`, `chunks` com `chunkId`/`locator`/`citationKey`).
Markdown porque é o que uma pessoa revisa num pull request — JSON escrito à mão apodrece.

Um script de build (`tools/build-knowledge.mjs`) lê as páginas e emite
`dist/knowledge/index.json`. Índice é **artefato**, não arquivo mantido à mão: duas fontes de
verdade para o mesmo acervo divergem no primeiro verbete editado às pressas.

## K2 — Busca lexical própria, sem dependência nova

Pontuação sobre título, tags e texto do trecho, com normalização de acento e caixa. Trinta linhas.

Não entra `lunr` nem `flexsearch`: para 12–18 verbetes com algumas dezenas de trechos, uma
varredura pontuada responde em microssegundos e não adiciona 30 KB ao que o visitante baixa.

O teto fica declarado no código (`ponytail:`), com o caminho de saída: se o acervo passar de ~200
trechos ou a medição 5.2 mostrar recuperação ruim, troca-se a função de busca por um índice
invertido — **sem trocar o formato da página**, que é o que custa caro.

## K3 — Carregado sob demanda, e a falha tem nome

O índice não entra no bundle. Na primeira consulta, `fetch('knowledge/index.json')`, e fica em
memória pela aba. Quem nunca pergunta sobre a norma não baixa o acervo.

Se o `fetch` falhar, a ferramenta devolve `acervo_indisponivel` — **nunca** uma lista vazia. Lista
vazia significa "procurei e não achou", e deixar a falha de rede se passar por ausência de
conteúdo ensina o agente a afirmar que a norma não diz algo que ela diz.

## K4 — O limite de evidência viaja com o trecho

Todo resultado carrega `contentMode`, com os nomes herdados da Alexandria:

| Modo | O que é | Como o agente fala |
|---|---|---|
| `curated_card_only` | ficha editorial nossa, original | "pelo meu material sobre X…", citando a ficha |
| `verified_excerpt` | trecho literal conferido na fonte | pode citar literalmente, com localizador |

A diferença não é cosmética: é o que impede atribuir à norma da OMG uma frase que foi escrita por
nós. O resultado da ferramenta não é prosa livre — é `{sourceId, title, contentMode, locator,
citationKey, excerpt, officialUrl}`.

## K5 — Direito autoral resolvido no validador, não na conversa

A pesquisa não confirmou a licença de redistribuição de trechos da norma BPMN 2.0 da OMG. Então:

- o acervo do MVP nasce **inteiro** em `curated_card_only` — explicação original mais link para a
  fonte oficial;
- uma página marcada `verified_excerpt` **sem** `rightsNote` faz o build **falhar**, nomeando o
  arquivo.

Aviso em documento não impede ninguém de colar três páginas da norma num verbete. O validador
impede. A pergunta jurídica continua aberta e fica incapaz de chegar ao site publicado.

## K6 — Verificação mecânica de citação só existe no modo texto

A pesquisa entregou o guardrail certo: *o aplicativo confere se a chave de citação existe entre os
resultados consultados*. Prompt pede; código impede.

O despacho guarda o conjunto de `citationKey` servidos **nesta sessão**. No modo texto a resposta
passa por `entregar_resposta`, que é nosso código: toda marca `[fonte:*]` é conferida contra esse
conjunto, e uma chave nunca servida é substituída por `[fonte não conferida]` antes de a resposta
aparecer. Não reescrevemos o texto do modelo — só a etiqueta que ele usou errado.

**No modo voz isso não existe.** O áudio vai do provedor ao alto-falante sem passar por nós. Lá o
que há é a regra do prompt e o fato de o trecho real estar no resultado da ferramenta. A assimetria
é do desenho do transporte, não da nossa preguiça — e vai declarada na interface e nas limitações
do TCC, em vez de prometida como se fosse igual nos dois modos.

## K7 — Duas fontes declaradas, como seção do registro de F2

O prompt ganha uma seção estável nova — acervo × conhecimento geral do modelo — pelo registro de
seções que F2 construiu. Nenhuma linha do renderizador muda: era exatamente a prova que F2 já
fazia ("seção nova sem tocar o renderizador").

## K8 — Ausência no acervo não é ausência na norma

Mesma forma do H13 do harness (amostra ≠ diagrama). O resultado de uma busca sem acerto diz
**quantos verbetes o acervo tem**, para a resposta ser "não está no meu acervo de N verbetes" e
não "a norma não trata disso". O acervo declara o próprio tamanho; o modelo não precisa adivinhar.

## K9 — Conteúdo nosso também passa pelo validador de marca

O acervo é escrito por nós, mas um verbete contendo a marca de fronteira `DADOS_DO_ALUNO` poderia
forjar o delimitador que F2 criou. O validador recusa a marca em qualquer página do acervo. Uma
linha, e a fronteira continua valendo.

## K10 — O teto do acervo é medido aqui

A pesquisa estimou 12 a 18 verbetes e disse que era estimativa. As três medições (bloco 5) são:
tamanho do índice servido, latência da primeira consulta na rede pública, e acerto em dez
perguntas ambíguas escritas antes de ver os resultados.

Se o número reprovar, a forma muda — índice separado por grupo, carregado só quando aquele grupo é
consultado. **Não** ganha servidor: o produto é estático porque a chave é do visitante e não há
backend nosso, e isso não está em jogo.
