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

## 2. P2 — Widget no produto

- [ ] 2.1 `src/assistant/mount.js` — botão + painel flutuante, montado em `app.js` e `viewer.js`
      por uma linha cada, sem alterar o canvas
- [ ] 2.2 Mover de `spike/live/**` para `src/assistant/live/**` só o que as provas validaram
      (hoje: `protocol.js`, `session.js`, `audio.js`, `pcm.js`, `redact.js` e os dois worklets)
- [ ] 2.8 Seletor de modo na UI: digitar usa o modo texto, o microfone usa o modo voz, e trocar
      de modo reabre a sessão
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
