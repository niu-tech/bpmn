## 0. P0 — Auditoria e publicação reproduzível (sem deploy)

- [x] 0.1 Auditar git: branch, remotes, working tree, o que está versionado e o que não está
      → achado E1 (stack de deploy **untracked**), E2–E4; registrado em `proposal.md` e `audit.md`
- [x] 0.2 Ler e conferir `Dockerfile`, `docker-compose.yml`, `deploy/**`, `pipeline.yml`,
      `webpack.config.js`, `package.json` contra o que o build realmente emite
- [ ] 0.3 Versionar o stack de deploy (`git add` explícito dos cinco caminhos de E1) — **pendente
      de decisão do dono**, porque muda o que o GitHub passa a executar em push
- [ ] 0.4 Provar o build da imagem localmente + smoke test das cinco URLs do workflow
      (**bloqueado**: Docker não disponível nesta máquina — ver `validation.md` B1)
- [ ] 0.5 Runbook de rollback nomeado em `deploy/README.md` (hoje o README cobre setup e deploy
      manual, não cobre volta)
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
- [ ] 1.10 **Validação com chave real local** (A/B/C ao vivo, 3 turnos, negação de microfone,
      queda de socket) — **bloqueado**: exige chave do aluno; roteiro em `validation.md`
- [ ] 1.11 Medir E12 (CORS do `authTokens.create` a partir de origem de navegador) — **bloqueado**
      pela mesma chave; sonda já escrita em `spike/live/token-probe.js`
- [ ] 1.12 Medir E6 na nossa própria instalação (pedir TEXT de propósito, esperar 1007) —
      **bloqueado** pela mesma chave; já é um botão da página do spike

## 2. P2 — Widget no produto

- [ ] 2.1 `src/assistant/mount.js` — botão + painel flutuante, montado em `app.js` e `viewer.js`
      por uma linha cada, sem alterar o canvas
- [ ] 2.2 Mover de `spike/live/**` para `src/assistant/live/**` só o que as provas validaram
- [ ] 2.3 Entrada de chave BYOK da sessão, com aviso de custo e encerramento explícito
- [ ] 2.4 Chat (texto) + voz na mesma superfície, com transcrição visível dos dois lados
- [ ] 2.5 `systemInstruction` de domínio BPMN, versionada no repositório
- [ ] 2.6 Teste de não-regressão: as duas páginas carregam, simulação roda, `dist/` sem spike
- [ ] 2.7 Teto de sessão ociosa e liberação em `beforeunload`

## 3. P3 — Integração, homologação e publicação

- [ ] 3.1 Cenários manuais: negação de microfone, desconexão, expiração, isolamento de credencial
- [ ] 3.2 Desktop e mobile (iOS exige gesto e tem regra própria de `AudioContext`)
- [ ] 3.3 Evidência de segurança: nenhuma chave em bundle, storage, log, URL ou commit
- [ ] 3.4 CI com os testes novos; smoke test cobrindo a página do assistente
- [ ] 3.5 Publicar (gate do dono) e conferir o site no endereço real

## Futuro — fora do MVP

- [ ] F.1 RAG sobre a norma BPMN
- [ ] F.2 MCP
- [ ] F.3 Tools read-only de XML do diagrama e de métricas da simulação
- [ ] F.4 Edição de diagrama por agente
- [ ] F.5 Memória durável entre sessões
