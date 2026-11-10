# P0 — Auditoria do repositório (2026-11-10)

Medições, não impressões. Todo comando abaixo foi executado em
`C:\Users\kaios\source\repos\bpmn`.

## Git

```
$ git branch --show-current
ImproveSimulation

$ git remote -v
bpmn      https://github.com/kaiosmacedo/bpmn            (fetch/push)
origin    https://github.com/devInfomarcas/bpmn.git      (fetch/push)
upstream  https://github.com/flavioluizseixas/bpmn       (fetch/push)

$ git log --oneline -1
cfcba83 Add simple deterministic BPMN model and simulation configuration

$ git status --porcelain
?? .dockerignore
?? .github/
?? Dockerfile
?? deploy/
?? docker-compose.yml
```

### Achado 1 (crítico) — o stack de publicação não existe para o GitHub

Os cinco caminhos acima estão **apenas no disco**. Consequências medidas:

- `.github/workflows/pipeline.yml` **nunca roda**: o GitHub só executa workflow que está num
  commit. Não há CI e não há CD, por mais completo que o arquivo seja.
- `docker-compose.yml` e `Dockerfile` não chegam à VPS pelo `git fetch/checkout` que o próprio
  workflow faz — o passo de deploy, se rodasse, falharia no `docker-compose up`.
- Nada disso é reproduzível por outra pessoa (nem pelo orientador, nem por outra máquina).

**Não foi corrigido neste bloco** porque commitar esses arquivos muda o que o GitHub passa a
executar automaticamente a cada push, incluindo um passo de SSH em servidor. É o item 0.3 das
tasks, com gate explícito. Os arquivos ficaram **preservados** e intactos.

### Achado 2 — `dist/` está versionado

```
$ git ls-files dist/ | head
dist/1e08c7f04f4855050724.eot
dist/bundle.js
dist/viewer.js
...
```

Bundles compilados estão no índice. Todo `npm run build` sujo o diff com arquivos gerados. O
`Dockerfile` não usa esse `dist/` (ele builda de novo, com `--mode production`), então o `dist/`
commitado é **só** ruído de histórico. Fora do escopo desta change; registrado para decisão.

Efeito prático imediato: **nenhum bundle gerado durante este trabalho entra em commit.**

### Achado 3 — `.vs/` está versionado

```
$ git ls-files .vs/ | head -4
.vs/ProjectSettings.json
.vs/VSWorkspaceState.json
.vs/bpmn.slnx/FileContentIndex/7273b932-....vsidx
.vs/bpmn/CopilotIndices/18.5.39068.60183/CodeChunks.db
```

Inclui índices binários do Copilot e uma sessão de copilot-chat
(`.vs/bpmn.slnx/copilot-chat/2c29644d/sessions/...`). `.gitignore` tem só `node_modules/` e
`.DS_Store`. Fora do escopo; registrado.

### Achado 4 — dois arquivos de compose, um deles enganoso

- `docker-compose.yml` — **untracked**, correto: builda este repositório, publica em
  `127.0.0.1:${BPMN_PORT:-8880}`.
- `docker-composer.yaml` — **versionado**, sobe `camunda/camunda-bpm-platform` na 8080. Não tem
  relação com o site estático deste repositório e não é usado por nada.
- `compose.txt` — versionado, conteúdo não relacionado ao deploy atual.

Quem clonar o repositório hoje encontra **só** o arquivo enganoso.

## Build

```
$ node --version && npm --version
v24.14.1
11.11.0
```

`webpack.config.js`: `mode: 'development'` fixo, duas entries (`bundle` ← `src/app.js`,
`viewer` ← `src/viewer.js`), saída `[name].js` em `dist/` com `clean: true`, loader só de CSS,
dev server na 8080 servindo `src/` **e** `diagrams/` na raiz.

Consequência confirmada no `Dockerfile`: o webpack emite **apenas** bundles e fontes; as páginas
(`index.html`, `viewer.html`) e os diagramas vêm de `devServer.static` em desenvolvimento, e por
isso a imagem precisa copiá-los à mão. O `Dockerfile` **já faz isso** corretamente, e o smoke test
do workflow cobre exatamente essa classe de erro (`/pizza-collaboration.bpmn`).

## Testes

```
$ node -e "console.log(require('./package.json').scripts.test)"
echo "Error: no test specified" && exit 1
```

Não há runner. Os quatro arquivos em `src/batchsim/__tests__/*.mjs` são scripts executados
diretamente por `node`, documentados no próprio cabeçalho
(`Run: node src/batchsim/__tests__/validate-deterministic.mjs`).

Baseline executado neste bloco — ver `validation.md`.

## Host e HTTPS

`deploy/host-vhost.conf` é referência, com `server_name bpmn.example.com` (placeholder) e
`proxy_pass http://127.0.0.1:8880`. O `README.md` de `deploy/` descreve DNS, secrets do Actions,
primeiro deploy e certbot. **Não existe** seção de rollback — item 0.5.

Restrição do domínio, já documentada e confirmada no código: as páginas usam caminhos **absolutos**
(`/bundle.js`, `/pizza-collaboration.bpmn`), então o site exige um (sub)domínio próprio e **não**
funciona sob um sufixo de caminho.
