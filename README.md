# bpmn — modelador, viewer com simulação e ajudante BPMN

**No ar:** <https://niu-tech.github.io/bpmn/> — modelador em `/`, viewer com simulação em
`/viewer.html`. URL provisória, enquanto não há domínio.

Front-end **estático**: não há backend nem banco. Tudo roda no navegador.

| Página | O que é | Entry do webpack |
|---|---|---|
| `/` | Modelador bpmn-js (edição, autosave, token simulation) | `src/app.js` → `dist/bundle.js` |
| `/viewer.html` | Visualização + simulação em lote com heatmap | `src/viewer.js` → `dist/viewer.js` |

Sobre as duas, um **ajudante de BPMN** por voz e texto (`src/assistant/**`), ligado ao
Gemini Live. Ele não tem chave: **cada visitante informa a sua própria**.

## Rodar local

```bash
npm ci
npm run dev      # http://localhost:8080  (modelador) e /viewer.html
npm test         # 300 assertions, sem rede e sem credencial
npm run build    # bundles em dist/

# Dirigir a pagina num navegador de verdade, sem ninguem olhando (headless + CDP):
node tools/drive-page.mjs http://127.0.0.1:8080/ --passo "return document.title" --shot artifacts/ui/a.png
# Voz de verdade em teste automatizado (tecnica trazida do CopilotSpeaker): SAPI pt-BR gera o
# WAV, e o Chromium o usa COMO microfone - o caminho inteiro roda, so a fonte e sintetica.
powershell -ExecutionPolicy Bypass -File tools/make-voice-fixtures.ps1
node tools/drive-assistant.mjs --mic artifacts/voz/gateway.wav

# Ler a aba que JA esta aberta no navegador (so leitura; exige --remote-debugging-port=9222)
node tools/attach-edge.mjs

# BATERIA AUTONOMA: abre o navegador, dirige, verifica e da veredito. 9 cenarios, zero
# intervencao humana, zero chave do Gemini (o socket e dublado com frames reais do protocolo).
npm run bateria                              # contra o build local servido em :8126
node tools/battery.mjs https://niu-tech.github.io/bpmn/
node tools/battery.mjs --ver                 # janela VISIVEL, para acompanhar
```

## ⚠ Para quem vai publicar — leia antes

**O runbook é [`deploy/README.md`](deploy/README.md).** O essencial:

1. **Push NÃO publica.** O CI roda em push e PR (teste, build da imagem, smoke, varredura de
   credencial). Publicar é ato explícito: Actions → *CI-CD Pipeline* → *Run workflow* →
   `deploy: true`, com o ambiente `production`.
2. **Não existe segredo de aplicação para configurar.** O site é BYOK: a chave é do visitante,
   fica só na memória da aba dele e não é compartilhada entre visitantes. Se alguém pedir "a
   chave do Gemini do projeto", a resposta é que ela não existe — e não deve passar a existir.
   Os únicos segredos do pipeline são os de **acesso SSH à VPS** (ver runbook).
3. **Funciona em qualquer caminho.** Desde 2026-11-11 as páginas referenciam os assets por
   caminho **relativo**, então o site serve igual na raiz de um domínio (`exemplo.com/`) e sob um
   sufixo (`exemplo.com/bpmn/`, `org.github.io/bpmn/`). Não exige subdomínio próprio.
4. **Tudo em `diagrams/` fica público na URL**, inclusive `simulations/*.sim.json`.

### Qual arquivo é qual

| Arquivo | Para quê |
|---|---|
| `Dockerfile` | build do webpack (`--mode production`) + nginx servindo o resultado |
| `docker-compose.yml` | **é este**: sobe o container em `127.0.0.1:${BPMN_PORT:-8880}` |
| `deploy/nginx.conf` | nginx **dentro** do container |
| `deploy/host-vhost.conf` | vhost de referência para o nginx **do host** (TLS); aplicado à mão |
| `.github/workflows/pipeline.yml` | CI em push/PR; deploy só manual |
| `docker-composer.yaml` | ⚠ **não é deste projeto** — sobe Camunda na 8080, nada o usa. Ignorar |
| `compose.txt` | ⚠ idem, resquício |

## Estrutura

```
src/app.js            modelador
src/viewer.js         viewer + simulação
src/batchsim/**       motor de simulação em lote  (testes em __tests__/)
src/assistant/**      ajudante BPMN: live/ (protocolo Gemini), ui/, sessão, credencial,
                      diagnostics.js (diário da sessão, base do botão "Copiar diagnóstico")
tools/drive-*.mjs     drive de página headless: clica, lê o DOM, tira print, sem dependência
tools/attach-edge.mjs leitura da aba já aberta no navegador do dono (CDP, só leitura)
tools/make-voice-fixtures.ps1  WAVs pt-BR (SAPI) usados COMO microfone nos testes
spike/**              harness de prova do transporte, dev-only — NÃO entra no bundle
openspec/project.md   a constituição: princípios que valem para toda change
openspec/open-items.md  o que está em aberto, honesto (portões do dono, medições, dívidas)
openspec/changes/**   uma pasta por change: proposal, design, specs/<capacidade>, tasks
deploy/**             runbook e configuração de publicação
```

`spike/` e `openspec/` ficam **fora** da imagem (`.dockerignore` + `COPY` seletivo no
`Dockerfile`), e um teste guarda que `src/` nunca depende de `spike/`.

## Estado

O ajudante está implementado, homologado e **provado contra o Gemini real na URL pública**
(2026-11-12): conversa por texto e por voz, dentro da bateria automática, sem nenhum passo
humano. A única variante sem medição é voz humana num microfone físico — o teste usa fala
sintética pt-BR entrando pelo caminho real do microfone.

Veredito de release item a item:
[`release-checklist.md`](openspec/changes/add-bpmn-public-live-assistant-mvp/release-checklist.md).

Onde vive: **`niu-tech/bpmn`**, privado, branch default `main`.

Dois endereços, de propósitos diferentes:

| Endereço | Como sai | Para quê |
|---|---|---|
| **`https://niu-tech.github.io/bpmn/`** — no ar desde 2026-11-11 | **a cada push em `main`** (job `pages`) | URL provisória: mandar para o orientador e os alunos enquanto não há domínio |
| domínio próprio na VPS | só *Run workflow* com `deploy: true` | produção; configuração do DevOps |

A prévia do Pages **não** toca a VPS, e o deploy de produção continua sendo ato explícito. O que
falta para a produção está em [`deploy/README.md`](deploy/README.md) — é o handoff do DevOps.

O repositório é **público** desde 2026-11-11: é o que o GitHub Pages exige no plano da
organização, e o site é público de qualquer forma. Isso **não** expõe segredo nenhum — o produto é
BYOK (a chave é do visitante, fica só na memória da aba dele) e o CI varre os arquivos servidos
procurando credencial a cada push.

## Origem

Baseado em [`flavioluizseixas/bpmn`](https://github.com/flavioluizseixas/bpmn); a simulação em
lote e o ajudante foram acrescentados neste fork. O histórico preserva os commits originais.
