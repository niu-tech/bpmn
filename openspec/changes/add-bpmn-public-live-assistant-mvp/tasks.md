## 0. P0 — Auditoria e publicação reproduzível (sem deploy)

- [x] 0.1 Auditar git: branch, remotes, working tree, o que está versionado e o que não está
      → achado E1 (stack de deploy **untracked**), E2–E4; registrado em `proposal.md` e `audit.md`
- [x] 0.2 Ler e conferir `Dockerfile`, `docker-compose.yml`, `deploy/**`, `pipeline.yml`,
      `webpack.config.js`, `package.json` contra o que o build realmente emite
- [x] 0.3 Versionar o stack de deploy (os cinco caminhos de E1) — autorizado pelo dono e feito
      em `803aa36`; `.dockerignore` passou a excluir `spike/` e `openspec/`
- [x] 0.4 Build da imagem + smoke das cinco URLs: **feito no P3**. O Docker estava instalado em
      caminho por-usuário, não no padrão — por isso o bloco anterior concluiu "indisponível".
      `compose config` OK, imagem construída, 5/5 em 200, e a imagem auditada (helper nos dois
      bundles, `spike/` e `openspec/` em 404, nenhuma credencial em nenhum caminho)
- [x] 0.5 Runbook de rollback em `deploy/README.md`: o que caracteriza falha, volta por checkout
      do commit bom + rebuild, e a saída rápida pela imagem anterior já no host
- [ ] 0.6 Decidir host/HTTPS e o domínio; registrar o valor real em `deploy/host-vhost.conf`
      (**gate do dono**: envolve DNS). Deixou de ser bloqueio de endereço: a URL provisória do
      Pages (0.11) não precisa de domínio, e o site passou a servir sob prefixo de caminho
- [x] 0.7 **Workflow na branch default** — resolvido em 2026-11-11 pela migração: `main` do
      `niu-tech/bpmn` é a default e tem o `pipeline.yml`. O botão *Run workflow* existe
- [x] 0.8 **Projeto na organização** — `niu-tech/bpmn` privado, `main` com tudo, 30 commits,
      histórico original preservado, CI verde (#2 52 s, #3 58 s), deploy nunca executado.
      `dist/` saiu do versionamento e `.vs/` foi expurgado do histórico (`git filter-branch`)
- [x] 0.9 **Rastro do `.vs` — FECHADO**. O repo da org foi recriado limpo e público (zero `.vs`
      em 33 commits; `refs/original/*` apagados) e os dois que ainda serviam o commit antigo por
      SHA foram **apagados**: `kaiosmacedo/bpmn` e `niu-tech/bpmn-legacy-private`, os dois agora
      em 404, com as páginas dos commits `cfcba83`/`9ac6531` também em 404 e `git fetch` dos SHAs
      recusado. Nenhuma ponta de branch deles era exclusiva (todas ancestrais da `main` nova).
      `devInfomarcas/bpmn` confirmado inexistente pelo dono — remote local removido
- [x] 0.11 **URL provisória sem domínio** — site passou a usar caminhos **relativos** (4 linhas:
      as duas `<script src>` e as duas `DEFAULT_DIAGRAM_URL`), provado em navegador headless
      servido em `/bpmn/`: as duas páginas renderizam o diagrama e o ajudante monta. Job `pages`
      no workflow publica a cada push em `main`, extraindo o site **da própria imagem** que vai
      para a VPS, e liga o Pages sozinho (`enablement: true`). Falha nomeada e inofensiva se o
      plano da organização não permitir — foi o que aconteceu enquanto o repositório era privado
- [x] 0.12 **URL provisória NO AR**: <https://niu-tech.github.io/bpmn/>. CI 38 s, Pages 33 s,
      deploy `skipped`. 5/5 URLs em 200, as duas páginas renderizam o diagrama e montam o ajudante
      em navegador headless contra a URL pública, e `/spike/`, `/openspec/`, `/Dockerfile`,
      `/package.json` em 404
- [ ] 0.10 **Ambiente `production`** — não existe no repositório e o job de deploy o exige
      (**gate do dono**). A *deploy key* deixou de ser necessária: o repositório é público de novo

## 1. P1 — Spike técnico isolado (primeiro bloco de execução)

- [x] 1.1 Entry condicional `BPMN_SPIKE=1` no webpack + `spike/index.html`; produção intocada (D6)
- [x] 1.2 `spike/live/pcm.js` + `spike/live/capture-worklet.js` — captura PCM16 16 kHz, quadros de
      40 ms, gesto explícito, contexto seguro, liberação ordenada (prova **A**)
- [x] 1.3 `spike/live/playback-worklet.js` — ring bounded, prime, reamostragem 24 kHz → contexto,
      underflow/overflow contados, `flush` (prova **B**)
- [x] 1.4 `spike/live/session.js` — setup AUDIO + `entregar_resposta`, `realtimeInput.text`,
      `toolCall`/`toolResponse`, `turnComplete`, estados nomeados, recuo com teto (prova **C**)
- [x] 1.5 `spike/live/redact.js` — mascaramento de chave em erro e log (D5)
- [x] 1.6 `spike/main.js` — página dev-only que junta A, B e C com estado visível
- [x] 1.7 Mock de protocolo + testes `.mjs` sem chave e sem rede (D7)
- [x] 1.8 `npm test` deixa de ser `exit 1` e passa a rodar os testes existentes + os novos
- [x] 1.9 Teste de isolamento: produção não referencia `spike/`, spike não importa `src/`
- [x] 1.10 **Validação com chave real** (`spike/__tests__/live-probe.mjs`, gated por
      `GEMINI_API_KEY`): 10 de 11 medições positivas — setup aceito, prova C, 3 turnos, prova B
      com áudio real, prova A com transcrição exata, 1007 confirmado
- [x] 1.11 E12 medido: `v1alpha/auth_tokens` emite token de **origem de navegador** (CORS 200),
      mas o token **não abre** a sessão Live (4 formas, 1007/1008). Registrado em `design.md` D2
- [x] 1.12 E6 medido por nós: `setupComplete` chega e o socket fecha com **1007** ao pedir
      conteúdo, com a mensagem do servidor citada em `validation.md`
- [x] 1.13 Rodada no NAVEGADOR real com a chave: E13 confirmado, prova C e prova B na página,
      evidência em `renders/browser-live-evidence.txt`
- [x] 1.14 Correções que vieram da medição: modo voz × modo texto, `realtimeInput.audio`,
      `audioStreamEnd`, frames vazios/retomada/`generationComplete`/`usageMetadata`, e o
      relógio que quebrava só no navegador
- [~] 1.15 **Fala pelo microfone** — provado com fala SINTÉTICA pt-BR (SAPI) entrando pelo
      caminho real do microfone (`--use-file-for-fake-audio-capture`): o Gemini transcreveu a
      frase exata e respondeu falando. Falta só a variante com **voz humana num microfone
      físico**, que depende de alguém falar e deixou de ser bloqueio de produto

## 2. P2 — Helper no produto

- [x] 2.1 `src/assistant/mount.js` — botão + painel flutuante no canto inferior direito, montado
      por uma linha em `app.js` e outra em `viewer.js`, instância única por página, `try/catch`
      em volta: falhar o ajudante não leva o modelador junto
- [x] 2.2 Módulos validados MOVIDOS de `spike/live/**` para `src/assistant/live/**` (`git mv`,
      histórico preservado). O spike virou harness **sobre** o produto — uma cópia só, e a prova
      viva passa a exercitar o código que vai ao ar
- [x] 2.3 BYOK: campo `password`, aviso de privacidade e custo, consentimento obrigatório antes
      de conectar, trocar/remover, zero persistência (`credential.js`)
- [x] 2.4 Chat e voz na mesma superfície, com transcrição dos dois lados e uma bolha por turno
      que cresce conforme a legenda chega
- [x] 2.5 `SYSTEM_INSTRUCTION` de domínio BPMN versionada em `live/protocol.js`
- [x] 2.6 Não-regressão medida contra o baseline pré-P2: as duas páginas carregam, simulação
      intacta, build de produção sem credencial, `dist/` versionado intocado
- [x] 2.7 Encerramento em `beforeunload` **e** `pagehide` (bfcache do iOS), teardown idempotente
- [x] 2.8 Seletor de modo: texto declara a função de entrega, voz não; trocar reabre a sessão e
      **avisa** que o modelo perde o contexto (`context-reset`)
- [x] 2.9 Acessibilidade: `aria-expanded`/`aria-controls`, `role="dialog"` não-modal, foco ao
      abrir, Escape devolvendo o foco, estado em região viva **e** em texto (cor nunca sozinha),
      conversa em `aria-live`
- [x] 2.10 Responsivo: painel cabe em 375×812 com o campo de digitar visível
- [x] 2.11 `AssistantSessionManager` com ciclo observável, correlação de turnos, histórico só em
      memória, e `stop()` idempotente provado com três chamadas simultâneas
- [x] 2.12 **Defeito meu, achado por baseline**: montar antes do `fit-viewport` quebrava o
      modelador. Corrigido montando depois (design D11)
- [x] 2.13 **Conversa real pelo widget contra o Gemini — FEITA** (2026-11-12, com a chave do
      cofre liberada pelo dono). Texto: pergunta digitada → socket real → `entregar_resposta` →
      bolha, 187 caracteres corretos sobre gateways. Voz: o Gemini transcreveu *"Qual a diferença
      entre um gateway exclusivo e um gateway paralelo?"* e respondeu falando. Os dois rodam na
      bateria, contra a URL pública, sem nenhum passo humano

## 3. P3 — Homologação e preparação de release

- [x] 3.1a Isolamento de credencial exercido na página: sem chave não conecta, chave curta
      recusada, sem consentimento não conecta, `localStorage`/`sessionStorage`/cookie em 0
- [x] 3.1c Auditoria BYOK ponta a ponta **na imagem publicada**, com conexão real ao Google:
      a chave não aparece em console, `onerror`, DOM, HTML, storage, cookie, cache, IndexedDB,
      URL da aplicação, referrer nem resource timing
- [ ] 3.1b Cenários que precisam de credencial ou de hardware: negação de microfone ao vivo,
      desconexão no meio do turno, expiração
- [x] 3.2 Desktop (1280×860) e móvel (375×812) medidos nas duas páginas
- [x] 3.3 Evidência de segurança: nenhuma chave em bundle, imagem, storage, URL, log ou commit
- [x] 3.4 CI roda `npm test` e inspeciona os arquivos **servidos pela imagem** procurando
      credencial
- [x] 3.6 **Publicar virou ato explícito**: push e PR rodam só CI; a implantação exige
      `workflow_dispatch` com `deploy: true` e o ambiente `production`
- [x] 3.7 **Docker homologado de verdade**: `compose config`, build da imagem, container de pé,
      smoke 5/5, e a imagem auditada por dentro
- [x] 3.8 **Limite de 375 px resolvido**: o ajudante reserva a barra do modelador inteira,
      colapsada (51 px) ou expandida (265 px), sem cobrir o botão que a recolhe. A conta é função
      pura em `src/assistant/layout.js`, com 6 testes
- [x] 3.9 **Defeito de BYOK corrigido**: o servidor usa 1007 para "configuração recusada" E para
      "API key not valid", e 1008 para cota E para credencial. A mensagem mandava o aluno procurar
      defeito no lugar errado; agora o texto do fechamento decide
- [x] 3.10 **Defeito na ferramenta de auditoria corrigido**: o removedor de comentários das
      varreduras quebrava com CRLF (em JS, `.` não casa `
`), então comentários sobreviviam e a
      varredura podia deixar de acusar código real
- [x] 3.11 **Compose v1 × v2**: o passo de deploy usava o nome do binário v1, aposentado. Agora
      detecta qual existe e falha nomeado se nenhum estiver presente
- [x] 3.12 Checklist GO/NO-GO e roteiro da primeira publicação: `release-checklist.md`
- [ ] 3.5 Publicar (gate do dono) e conferir o site no endereço real

## 4. P4 — A conversa no ar (primeiro uso real do dono, 2026-11-11)

- [x] 4.1 **Defeito: a voz nunca respondia.** Apertar "Falar" e falar produzia só "o modelo foi
      interrompido". Causa: microfone aberto DURANTE a resposta — o VAD do servidor ouve a
      própria resposta (ou a respiração de quem espera) e corta o modelo, em ciclo. Agora é
      **meia-duplex por desenho**: o primeiro quadro de áudio da resposta fecha o microfone e
      manda `audioStreamEnd`; quadro atrasado morre no cliente (`mic.gated`). Barge-in fica fora
      do MVP de propósito — exige cancelamento de eco de verdade
- [x] 4.2 **Defeito: recado preso.** "aceite o aviso sobre a chave antes de conectar" ficava em
      vermelho na conversa mesmo depois do aviso aceito e da sessão conectada. A recusa deixou de
      virar mensagem: o que falta é **derivado** de `credentials` a cada render
- [x] 4.3 **Interrupção deixou de ser recado.** É evento de protocolo: descarta a fila de áudio e
      entra no diário, com relógio e contagem
- [x] 4.4 **UI: de 8 botões para 5.** Um único botão de ação ("Começar" guarda a chave E conecta;
      vira "Encerrar"), bloco da chave encolhe para uma linha depois de resolvido, aviso longo em
      `<details>`, campo de pergunta some quando não dá para perguntar
- [x] 4.5 **Escolher voz é começar a falar**: o microfone abre sozinho ao entrar no modo voz, uma
      vez por conexão (não reabre a cada turno)
- [x] 4.6 **Indicador de escuta**: medidor de 9 barras alimentado pelo MESMO PCM que sai para o
      Gemini — barra parada com microfone aberto significa que nada está chegando lá
- [x] 4.7 **Diário da sessão** (`diagnostics.js`): anel limitado, agrupamento de repetição,
      tudo redigido. Botão "Copiar diagnóstico" no painel e `window.__bpmnAssist.report()` no
      console
- [x] 4.8 **Drive de página** (`tools/drive-page.mjs`, `tools/drive-assistant.mjs`): dirige o
      site num Chromium headless por CDP, sem nenhuma dependência nova. O segundo prova a
      conversa de voz inteira com `WebSocket` dublado e microfone sintético do navegador — é como
      os defeitos acima foram verificados sem gastar chave nem pedir ao dono que olhasse
- [x] 4.9 **Defeitos achados pelo próprio drive**: dois `AudioContext` de reprodução abertos
      quando o microfone automático e o clique do aluno corriam juntos (resposta dobrada), e
      `endAudio` rebaixando o estado para "ouvindo" no instante em que o modelo respondia
- [x] 4.10 **Conversa real pelo widget** — mesma prova da caixa 2.13 (2026-11-12): texto e voz
      contra o Gemini real, na URL pública, dentro da bateria. Esta linha duplicava 2.13 e ficou
      dizendo "pendente" depois de fechada — registrado em `openspec/open-items.md` (T1)

## 5. P5 — Escuta contínua, fala sem travar, teste autônomo (2026-11-11, 2ª rodada)

- [x] 5.1 **A fala travava** ("para de falar durante um período, um segundo, ou um pouco mais").
      Causa no `playback-worklet`: QUALQUER furo zerava `primed` e obrigava a encher outra vez o
      buffer de PARTIDA inteiro — com a rajada do servidor, isso vira um buraco audível por furo.
      Agora são DOIS limiares: partida 240 ms, recuperação 120 ms. Três testes novos, incluindo o
      caso que reproduz o furo
- [x] 5.2 **Escuta contínua virou o default** ("ele poderia ficar ouvindo e quando a gente falar,
      poder interromper ela"): o microfone fica aberto durante a resposta e o quadro do aluno
      SOBE — é o que faz o servidor interromper o modelo. O meia-duplex da rodada anterior deixou
      de ser o comportamento e virou **rede de segurança**
- [x] 5.3 **Rede de segurança com assinatura medível**: três interrupções seguidas SEM nenhuma
      transcrição de entrada no meio é o laço de eco (fala de verdade produz transcrição; eco
      não). Ao reconhecê-lo, o microfone volta a fechar durante a resposta e o aluno é avisado
      uma vez, com a razão
- [x] 5.4 **Controles saíram do corpo rolável** ("a gente fala e aí tem que subir a conversa toda
      para falar de novo"): o botão de ouvir e o medidor moram no rodapé fixo; só a conversa rola
- [x] 5.5 **Saúde da reprodução no diário**: `som.buffer ms=… furos=…` a cada 3 s, que é o que
      transforma "a fala trava" em um número
- [x] 5.6 **Voz de verdade em teste automatizado.** Técnica trazida do CopilotSpeaker
      (`tools/live-first-m0/make-fixtures.ps1`): SAPI pt-BR gera WAV 16 kHz mono, e o Chromium o
      usa **como microfone** (`--use-file-for-fake-audio-capture`). O caminho roda inteiro —
      worklet, reamostragem, PCM16, socket. Medido: pico de nível **0,454** com fala contra
      **0,01** com o tom sintético, 79 quadros no socket
- [x] 5.7 **`tools/attach-edge.mjs`**: lê a aba já aberta no navegador do dono por CDP, só
      leitura, e diz o comando exato quando a porta de depuração não está ligada
- [x] 5.9 **Bateria de 11 cenários contra a URL pública**: 11 de 11, incluindo os dois AO VIVO.
      A chave sai do `.env` (git-ignored) em tempo de execução e cada cenário confere que ela não
      aparece no relatório, no DOM nem no storage
- [x] 5.10 **Publicação destravada**: o Actions da organização ficou ~7 h sem despachar (run
      criado 2026-11-11 20:46 UTC, zero jobs, `updated_at == created_at`). Voltou sozinho; a
      publicação saiu por `workflow_dispatch` e o bundle novo está no ar. A branch `gh-pages`
      criada como contorno foi apagada e o Pages voltou para `build_type=workflow`
- [x] 5.8 **Barge-in com voz real contra o Gemini — PROVADO** (2026-11-12). Duas medições
      corrigiram o teste antes de o produto ser julgado:
      (a) o corte caía no silêncio, antes de haver o que cortar;
      (b) **em modo voz com o microfone aberto, pergunta DIGITADA só é respondida depois de o
      servidor ver fim de fala no áudio** — com 9 s de silêncio o modelo falou aos 15 s; com
      16 s, aos 22,6 s. O fluxo de áudio governa o turno.
      A forma que funciona: pergunta **pela voz**, 2 s de pausa, frase de corte — tudo num WAV só
      (`tools/wav-pad.mjs juntar`). Resultado: `ws.input-text` 12,9 s → modelo fala 13,4 s →
      **`ws.interrupted` 16,1 s**. Cenário na bateria, 12 de 12

## Futuro — fora do MVP

- [ ] F.1 RAG sobre a norma BPMN
- [ ] F.2 MCP
- [ ] F.3 Tools read-only de XML do diagrama e de métricas da simulação
- [ ] F.4 Edição de diagrama por agente
- [ ] F.5 Memória durável entre sessões
