# Deploy do bpmn na VPS

O bpmn é só front-end estático — modelador em `/`, viewer + simulação em lote em `/viewer.html` —, sem backend nem banco.
Mesmo padrão do `javis.docker` (GitHub Actions → SSH → `docker-compose`) e dos demais projetos niu-tech: o nginx do host
termina o TLS e faz `proxy_pass` para o container, que só fala HTTP.

```
push (main | ImproveSimulation) → Actions: valida compose + build da imagem + smoke test
  → SSH na VPS: git fetch/checkout + docker-compose up -d --build
  → container nginx :80 → 127.0.0.1:8880 → nginx do host (TLS) → https://<dominio>
```

| Arquivo | Para quê |
|---|---|
| `Dockerfile` | build do webpack (`--mode production`) + nginx servindo o resultado |
| `deploy/nginx.conf` | nginx **dentro** do container |
| `docker-compose.yml` | sobe o container em `127.0.0.1:${BPMN_PORT:-8880}` |
| `.github/workflows/pipeline.yml` | CI (compose + build + smoke test) e CD (SSH na VPS) |
| `deploy/host-vhost.conf` | vhost de referência para o nginx **do host** (aplicado à mão) |

## Setup único

1. **DNS** — registro A do (sub)domínio → IP da VPS. Tem que ser um host próprio (ex.: `bpmn.seudominio.com`): as páginas
   usam caminhos absolutos (`/bundle.js`, `/pizza-collaboration.bpmn`) e não funcionam sob `seudominio.com/bpmn/`.
2. **GitHub** (Settings → Secrets and variables → Actions), mesmos nomes do `javis.docker`:
   - variables: `SSH_HOST`, `SSH_USER`, `SSH_PORT` (opcional, padrão 22)
   - secrets: `SSH_KEY`, `SSH_PASSPHRASE` (só se a chave tiver senha)
3. **Primeiro deploy** — push em `main`/`ImproveSimulation` (ou Actions → *Run workflow*). O workflow clona o repo em
   `~/github/bpmn` na VPS via HTTPS; se o repo for privado, clone antes à mão (deploy key) nesse mesmo caminho.
   Confira se a `8880` está livre (`ss -tlnp | grep 8880`); se não, crie `~/github/bpmn/.env` com `BPMN_PORT=<livre>`
   e use a mesma porta no passo 4.
4. **nginx do host** (uma vez, depois do primeiro deploy):
   ```bash
   sudo cp ~/github/bpmn/deploy/host-vhost.conf /etc/nginx/sites-available/bpmn   # edite server_name (e a porta, se mudou)
   sudo ln -s /etc/nginx/sites-available/bpmn /etc/nginx/sites-enabled/bpmn
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d <dominio>
   ```
   Se os outros vhosts do host emitem certificado de outro jeito, copie os `ssl_certificate` de um deles em vez do certbot.

## Depois disso

Todo push nas branches acima redeploya sozinho. Deploy manual: `cd ~/github/bpmn && git pull && docker-compose up -d --build`.

## Rollback

**O que caracteriza falha** (qualquer um basta): `/`, `/viewer.html`, `/bundle.js`, `/viewer.js` ou
`/pizza-collaboration.bpmn` sem responder 200; página branca com erro no console; container
reiniciando em laço (`docker-compose ps` fora de `Up`).

**Como voltar** — o deploy é `git checkout` + rebuild, então a versão anterior é um commit:

```bash
cd ~/github/bpmn
git log --oneline -5                 # ache o último commit que estava bom
git checkout -f <sha-bom>
docker-compose up -d --build
docker-compose ps                    # tem de voltar a Up
for p in / /viewer.html /bundle.js /viewer.js /pizza-collaboration.bpmn; do
  curl -fsS -o /dev/null -w "$p %{http_code}\n" "http://127.0.0.1:${BPMN_PORT:-8880}$p"
done
```

O checkout deixa a VPS em HEAD destacado de propósito: o próximo push na branch **não** sobe por
cima do rollback sem alguém decidir. Para voltar ao fluxo automático:
`git checkout -f -B <branch> origin/<branch> && docker-compose up -d --build`.

**Mais rápido, enquanto você investiga**: a imagem anterior ainda está no host.
`docker images bpmn` → `docker-compose stop bpmn` → suba a imagem antiga à mão com a mesma
publicação de porta. Não exige rede nem build.

## Atenção

- Tudo em `diagrams/` (inclusive `simulations/*.sim.json`) fica público na URL.
- O build roda na própria VPS (como no `javis.docker`). Se ela ficar apertada, buildar no Actions e publicar a imagem num registry.
- `spike/` e `openspec/` ficam **fora** da imagem (`.dockerignore` + `COPY` seletivo no `Dockerfile`).
