## 0. P0 — Auditoria e publicação reproduzível (sem deploy)

- [x] 0.1 Auditar git: branch, remotes, working tree, o que está versionado e o que não está
      → achado E1 (stack de deploy **untracked**), E2–E4; registrado em `proposal.md` e `audit.md`
- [x] 0.2 Ler e conferir `Dockerfile`, `docker-compose.yml`, `deploy/**`, `pipeline.yml`,
      `webpack.config.js`, `package.json` contra o que o build realmente emite
- [x] 0.3 Versionar o stack de deploy (os cinco caminhos de E1) — autorizado pelo dono e feito
      em `803aa36`; `.dockerignore` passou a excluir `spike/` e `openspec/`
- [ ] 0.4 Provar o build da imagem localmente + smoke test das cinco URLs do workflow
      (**bloqueado**: Docker não disponível nesta máquina — ver `validation.md` B1)
- [x] 0.5 Runbook de rollback em `deploy/README.md`: o que caracteriza falha, volta por checkout
      do commit bom + rebuild, e a saída rápida pela imagem anterior já no host
- [ ] 0.6 Decidir host/HTTPS e o (sub)domínio; registrar o valor real em `deploy/host-vhost.conf`
      (**gate do dono**: envolve DNS, fora deste bloco)

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
- [ ] 1.15 **Microfone físico com fala humana** — o único item que exige alguém falando; roteiro
      em `validation.md`

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
- [ ] 2.13 Conversa real pelo widget contra o Gemini — **pendente**: exige credencial, e o dono
      determinou não reusar a do cofre. Roteiro em `validation.md`

## 3. P3 — Integração, homologação e publicação

- [x] 3.1a Isolamento de credencial exercido na página: sem chave não conecta, chave curta
      recusada, sem consentimento não conecta, `localStorage`/`sessionStorage`/cookie em 0
- [ ] 3.1b Cenários que precisam de credencial ou de hardware: negação de microfone ao vivo,
      desconexão no meio do turno, expiração
- [ ] 3.2 Desktop e mobile (iOS exige gesto e tem regra própria de `AudioContext`)
- [ ] 3.3 Evidência de segurança: nenhuma chave em bundle, storage, log, URL ou commit
- [x] 3.4 CI roda `npm test` e inspeciona os arquivos **servidos pela imagem** procurando
      credencial (produto BYOK não tem motivo para conter nenhuma)
- [x] 3.6 **Publicar virou ato explícito**: push e PR rodam só CI; a implantação exige
      `workflow_dispatch` com `deploy: true` e o ambiente `production` (onde revisores
      obrigatórios podem ser configurados). Documentado em `deploy/README.md`
- [ ] 3.5 Publicar (gate do dono) e conferir o site no endereço real

## Futuro — fora do MVP

- [ ] F.1 RAG sobre a norma BPMN
- [ ] F.2 MCP
- [ ] F.3 Tools read-only de XML do diagrama e de métricas da simulação
- [ ] F.4 Edição de diagrama por agente
- [ ] F.5 Memória durável entre sessões
