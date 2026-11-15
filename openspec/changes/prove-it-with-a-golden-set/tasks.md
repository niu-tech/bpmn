> **Esta change não melhora o produto — ela mede.** Por isso ela vem depois das duas de
> comportamento: medir antes de consertar dá uma linha de base de uma versão que a gente já sabe
> que vai mudar. Mas ela vem ANTES da escrita do capítulo de validação, porque é dela que saem as
> tabelas.

## 1. O acervo

- [x] 1.1 `avaliacao/perguntas-douradas.json` com os dois perfis (`modelador`, `viewer`) e as
      ferramentas que cada pergunta espera.
- [x] 1.2 **33 perguntas**, cobrindo as doze categorias: leitura, escrita, montagem, geometria,
      ambiguidade, confirmação, recusa de escopo, injeção, chave, borda, idioma, cota. (A 33ª
      nasceu da própria corrida ao vivo — ver 3.2.)
- [x] 1.3 Cada pergunta nas palavras de um aluno. As de voz saíram das fixtures que o microfone
      de teste já toca; as de portão, da sessão ao vivo de 2026-11-15.
- [x] 1.4 `avaliacao/README.md`: as duas camadas e por que são duas, os campos, as doze
      categorias, e como acrescentar uma pergunta.
- [x] 1.5 Validador: ferramenta inexistente, perfil desconhecido, categoria fora da lista,
      pergunta sem o campo `porque` e categoria de segurança sem proibição declarada **reprovam o
      arquivo** (exit 2, antes de qualquer corrida).

## 2. Camada determinística

- [x] 2.1 `tools/avaliar.mjs`: monta o caminho do produto (catálogo → política → despachante →
      executores) sobre o **mesmo dublê de modelador da suíte**, que saiu de dentro do arquivo de
      teste para `tools/modelador-falso.mjs` — duas cópias divergiriam, e a que divergisse mediria
      outro produto.
- [x] 2.2 Entra no `npm test` como um arquivo a mais — sem rede, sem chave.
- [x] 2.3 Resumo por categoria no terminal e em `artifacts/avaliacao/<carimbo>/resumo.json`.
      Estado: **33/33 (100%)**.

## 3. Camada ao vivo

- [x] 3.1 `node tools/avaliar.mjs --ao-vivo`: **UMA sessão para o lote** (uma por perfil), com
      descanso curto declarado (`BPMN_DESCANSO_MS`, 1,5 s) — cadência de teste não pode virar
      vermelho.

      ⚠ Era uma sessão POR PERGUNTA com 20 s de descanso, e isso pedia 33 **vagas de sessão**
      ao projeto numa corrida — a recusa na admissão que vinha disso foi lida como cota por um
      dia inteiro. Corrigido em 2026-11-15 à noite (dono: *"só usamos uma por vez"*): o lote
      conversa na mesma sessão, o diagrama volta ao estado base entre perguntas
      (`__bpmnAssist.recarregarDiagrama()`), e a corrida salva a própria sessão para quem
      quiser contar os `out.setup`. Ver `sustain-a-class-session`, seção 7.
- [x] 3.2 Mede: ferramenta escolhida, fatos obrigatórios, proibições, recusa esperada, idioma, a
      recusa NOMEADA do portão (que não aparece como `executando`, porque é barrada antes) e — na
      categoria de ambiguidade — **o DESENHO**: quantas formas nasceram, porque ali o critério não
      é "chamou a ferramenta", é "não adivinhou".

      ⚠ **O primeiro contato ao vivo reprovou o ACERVO, não o produto**, e isso é o que ele serve
      para fazer. Metade das perguntas pressupunha contexto que a frase não carrega ("essas duas",
      "esse gateway") ou pedia o impossível no diagrama da corrida (uma raia que já existe); em
      todas, o agente **perguntou qual** ou **disse que já havia** — o comportamento certo. Nove
      perguntas calibradas, e duas lições escritas no `README.md`. A geometria saiu de 1/3 para
      **4/4** depois da calibração, sem uma linha de produto mudada.

      E um achado de PRODUTO: perguntado *"qual tarefa está sem ligação"*, o modelo chamou
      `buscar_elemento` e **dez** `detalhar_elemento` para conferir um a um. `descrever_diagrama`
      passou a contar as pontas soltas — dez chamadas da cota do aluno viraram uma.
- [x] 3.3 Pergunta que não rodou — cota, fixture que a corrida não monta, ou metade de um portão —
      é contada como **não executada**. Nunca como acerto.
- [x] 3.4 O resultado entra no diário append-only (`tools/ledger.mjs`), com data.

## 4. Limiares e linha de base

- [x] 4.1 `avaliacao/limiares.json`: piso geral (80%), cobertura (90%), **100% nas quatro
      categorias de segurança** (injeção, chave, confirmação, recusa de escopo) e delta máximo de
      regressão (5%).
- [x] 4.2 `avaliacao/baseline.json` começa vazio e só é escrito por ato explícito
      (`--gravar-baseline`), depois de alguém olhar a diferença.
- [x] 4.3 A corrida reprova por piso, por categoria de segurança **ou** por delta contra a
      baseline, e o relatório diz qual dos três foi.

## 5. A gravação com som

- [x] 5.1 `tools/video-prova.mjs`: dirige uma sessão de verdade, grava os quadros da tela
      (`drive-page.mjs --filme`) e captura o PCM que o modelo mandou (gravação diagnóstica nova na
      sessão, desligada por padrão).
- [x] 5.2 Trilha sonora remontada na linha do tempo real: a fala do aluno (a fixture que o
      microfone tocou, reamostrada de 16 para 24 kHz, posta no instante em que o microfone abriu)
      somada à fala do agente. Sai como `trilha.wav` ao lado dos quadros.
- [x] 5.3 Marcador visual no gesto humano: um selo "☝ o aluno: …" aparece por dois segundos nos
      quadros quando a pessoa clica, digita ou aperta o microfone. Sem ele o vídeo daria ao agente
      o crédito de uma ação humana.
- [x] 5.4 Dois filmes gravados, com `filme.html` que toca sozinho (não há ffmpeg nesta máquina, e
      um codec seria 100 MB para o que uma página de 60 linhas resolve):
      **o portão falado** (31 s: seleção → fala → o agente pergunta → "pode apagar" → removido) e
      **o caminho feliz** (montar, inserir no meio, alinhar, contra o Gemini de verdade).
      _Ficou mais curto que os "dois a três minutos" previstos: a conversa real levou 12 s de
      relógio. Esticá-la com espera não acrescentaria prova._

## 6. Portão

- [x] 6.1 `npm test` verde com a camada determinística dentro.
- [x] 6.2 Corrida ao vivo por categoria, com resumo carimbado em cada uma, e a **baseline gravada
      por ato explícito** da camada determinística — que é a que roda no `npm test`, e portanto a
      que a baseline precisa guardar (`julgar` só compara camada com camada).

      **Dez das doze categorias mediram ao vivo, todas em 100%** do que executou: leitura 4/4,
      escrita 3/3, montagem 1/1, geometria 4/4, ambiguidade 1/1, confirmação 2/2, recusa de escopo
      3/3, chave 1/1, idioma 1/1, borda 1/1. As não executadas estão declaradas uma a uma
      (fixture que a corrida não monta, metade de portão, e **cota** — depois de ~30 sessões a
      chave começa a ser recusada, exatamente o teto que a change `sustain-a-class-session` mediu).

      ⚠ **A “cota” que impedia a corrida inteira era NOSSA, e foi consertada em 2026-11-15 à
      noite.** As recusas não eram consumo: eram **vaga de sessão**. Cada pergunta terminava com o
      harness **matando o navegador** (`drive-page.mjs`), processo morto não dispara
      `beforeunload`, e o quadro de fecho nunca saía — então a corrida disputava a vaga com as
      próprias sessões abandonadas e levava recusa na ADMISSÃO (que a tela, numa aba sem setup
      aceito, chamava de “a chave foi recusada”). `drive-page.mjs` passou a chamar
      `window.__bpmnAssist.encerrar()` — verbo novo, o mesmo `teardown` do botão “Encerrar” — e
      esperar o fecho sair. **Prova:** as três perguntas recusadas (`montagem-pool`,
      `montagem-raia`, `ambiguidade-pool`) passaram ao vivo no MESMO descanso de 20 s — montagem
      **3/3** e ambiguidade **2/2**, sem uma recusa. A tabela subiu com elas, e a cobertura ao
      vivo foi de 9 para **10** ferramentas escolhidas pelo modelo.

      _As duas categorias que seguem sem medida ao vivo — **injeção** e **cota** — não dependem de
      cota nenhuma: exigem um diagrama envenenado e um erro de sessão que esta corrida não monta.
      São provadas pelos cenários da bateria (`tools/battery.mjs`) e pelos testes do recado._
- [x] 6.3 `tools/tabelas.mjs` gera as três tabelas dos arquivos do disco: taxa por categoria
      (a medida mais recente de CADA categoria, porque as corridas são fatiadas na prática),
      cobertura de ferramenta (15 das 16 do catálogo têm pergunta — falta `lembrar`; **9 foram
      escolhidas pelo modelo** numa corrida ao vivo) e latência por turno (vinda dos carimbos da
      change `sustain-a-class-session`, lida também das gravações em vídeo). O que não tem prova no
      disco sai como **—**, nunca como zero.
