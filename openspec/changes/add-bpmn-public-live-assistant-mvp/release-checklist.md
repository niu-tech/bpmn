# Checklist de release — GO / NO-GO

Estado em 2026-11-11. **Código implementado não é hospedagem efetiva**: nada foi publicado,
nenhuma VPS foi tocada, nenhum workflow foi disparado.

**Mudou em 2026-11-11** (ver *Migração para a organização*, no fim): o repositório passou a viver
em `niu-tech/bpmn` (privado), a branch default é `main` e o workflow já está nela — o item 17
virou GO e nasceu o item 24.

## Veredito por item

| # | Item | Veredito | Em que isso se apoia |
|---|---|---|---|
| 1 | **Suíte de testes** | **GO** | `npm test` exit 0, 279 assertions (124 originais intactas) |
| 2 | **Build de produção** | **GO** | webpack compila; worklets emitidos uma vez, compartilhados pelas duas entries |
| 3 | **Imagem Docker** | **GO** | `compose config` + `docker build` + container de pé |
| 4 | **Smoke das 5 URLs** | **GO** | todas 200 contra a imagem |
| 5 | **Helper na imagem** | **GO** | presente nos dois bundles; `/spike/` e `/openspec/` → 404 |
| 6 | **Sem segredo no artefato** | **GO** | nenhuma credencial em nenhum caminho da imagem; virou passo de CI |
| 7 | **Navegador — modelador** | **GO** | 0 erro de console; canvas clicável com o painel aberto |
| 8 | **Navegador — viewer** | **GO** | 0 erro; simulação em lote completa (30 replicações) com o painel aberto |
| 9 | **UX móvel (375 px)** | **GO** | sem sobreposição com a barra, colapsada e expandida; botão de recolher alcançável |
| 10 | **Acessibilidade** | **GO** | teclado, foco, Escape, `aria-live`, estado também em texto |
| 11 | **BYOK — isolamento** | **GO** | nada em storage/cookie/cache/IndexedDB/URL/console/resource-timing, com conexão real |
| 12 | **BYOK — chave inválida** | **GO** | mensagem correta e acionável, provada contra a imagem |
| 13 | **Risco residual da chave** | **GO condicional** | aceitável só para piloto voluntário com consentimento — ver abaixo |
| 14 | **Workflow: push não publica** | **GO** | CI em push/PR; deploy exige `workflow_dispatch` + `deploy: true` |
| 15 | **Compose v1 × v2 no deploy** | **GO** | o script detecta qual existe; antes quebraria no último passo |
| 16 | **Rollback documentado** | **GO (não ensaiado)** | runbook existe; nunca foi executado contra servidor real |
| 17 | **Botão de deploy disponível** | **GO** | `main` do `niu-tech/bpmn` é a default e tem o workflow; *Run workflow* aparece na UI |
| 18 | **Conversa real pelo widget** | **NO-GO** | exige a chave do aluno; nunca executado |
| 19 | **Fala humana + barge-in** | **NO-GO** | exige alguém falando |
| 20 | **Domínio e HTTPS** | **NO-GO para produção, contornado para a prévia** | `host-vhost.conf` tem placeholder; sem domínio, a URL provisória é o GitHub Pages (item 25) |
| 21 | **Secrets/vars do Actions** | **NO-GO** | `SSH_HOST`, `SSH_USER`, `SSH_KEY` nunca configurados; não toquei |
| 22 | **Ambiente `production`** | **NO-GO** | o ambiente **ainda não existe** no repo da org (*"There are no environments"*) e o job o exige — criar é obrigatório, pôr revisor é escolha |
| 23 | **Repositório acessível ao DevOps** | **GO** | `niu-tech/bpmn` **público**, `main` com 33 commits e histórico limpo, CI verde, job de deploy pulado (`skipped`) |
| 24 | ~~**Leitura da VPS no repo privado**~~ | **deixou de existir** | o repositório voltou a ser público, então o `git clone` do passo remoto não precisa de credencial |
| 25 | **URL provisória (GitHub Pages)** | **GO — NO AR** | <https://niu-tech.github.io/bpmn/>: 5/5 URLs em 200, as duas páginas renderizam o diagrama e montam o ajudante (navegador headless contra a URL pública), e `/spike/`, `/openspec/`, `/Dockerfile`, `/package.json` em 404 |
| 26 | **Site funciona sob prefixo de caminho** | **GO** | caminhos relativos; as duas páginas renderizam o diagrama servidas em `/bpmn/`, medido em navegador headless, e os worklets resolvem pelo `currentScript` |

## Impedimentos reais × sugestões futuras

**Impedem a publicação na VPS (20, 21, 22):** sem domínio e DNS não há endereço; sem os secrets
o passo de SSH falha; sem o ambiente `production` criado o job nem começa. Os três são atos de
configuração — do dono e do DevOps —, não de código, e nenhum leva mais de alguns minutos.
Handoff: `deploy/README.md`.

**Nada disso impede a URL provisória**, que está no ar: o GitHub Pages dispensa domínio, DNS, VPS
e secrets. A organização está em plano **Free**, onde o Pages exige repositório **público** —
medido pela API (`plan.name = free`, `has_pages = false` depois da primeira tentativa), que foi
exatamente por que o primeiro push não produziu URL.

> O repositório foi **recriado limpo e publicado** antes de virar público, justamente para que o
> commit com a sessão de `copilot-chat` não fosse junto. O `main` público tem 33 commits e
> **zero** arquivos `.vs` em qualquer um deles (varrido commit a commit), e a varredura de
> segredo no histórico inteiro só acha fixtures sintéticos de teste.

**Impedem declarar o produto validado (18, 19):** o transporte foi provado no P1 por sonda, mas a
conversa **pelo widget** e a **fala humana** nunca aconteceram. Publicar antes disso é publicar
algo que ninguém usou de ponta a ponta.

**Não impedem nada (sugestões):** ensaiar o rollback de verdade; configurar revisores no ambiente;
broker de token efêmero quando o token passar a abrir a sessão.

## Item 13 — o risco residual, com decisão explícita

A chave do aluno viaja na **query string do WebSocket do Google**. Dentro do TLS e para o dono da
credencial, mas visível em ferramentas de desenvolvedor e em proxy corporativo que termine TLS.

**Aceitável para um piloto voluntário BYOK com consentimento**, porque: a chave é do próprio
usuário, nada é compartilhado entre visitantes, não existe servidor nosso guardando nada, o aviso
é explícito e o aceite é obrigatório antes de qualquer conexão, e a chave morre ao recarregar.

**Não é aceitável como produto aberto** sem uma das saídas abaixo — e nenhuma pode ser ativada
sem prova:

| Saída | O que falta provar |
|---|---|
| Token efêmero direto do navegador | Emitir já funciona (CORS 200). **Autenticar o socket não**: 4 formas testadas, 1007/1008. Reavaliar com a sonda `live/token-probe.js` |
| Broker mínimo (recebe a chave, devolve só o token) | Depende do item acima funcionar. Antes disso o broker **veria** a chave — troca um risco por outro pior |
| Chave do projeto com cota por usuário | Contraria a decisão do dono: cada aluno usa a própria |

Enquanto nenhuma estiver provada, o caminho é o atual, com o aviso visível. **Sem servidor que
armazene chave de aluno** — isso não muda.

## Roteiro mínimo da primeira publicação controlada

Tudo abaixo é do dono. Nada aqui foi executado.

1. **Antes de tudo — validar com a própria chave** (2 min, `npm run dev`): abrir o ajudante,
   informar a chave, modo texto → perguntar; modo voz → falar. Se isso não funcionar, nada
   adiante importa. Roteiro completo em `validation.md`.
2. **Escolher o host**: um (sub)domínio próprio — as páginas usam caminhos absolutos
   (`/bundle.js`, `/pizza-collaboration.bpmn`) e **não** funcionam sob um sufixo de caminho.
   Registro A apontando para a VPS.
3. ~~**Levar o workflow para a branch default**~~ — **feito em 2026-11-11**: `main` do
   `niu-tech/bpmn` é a default e tem o workflow. O botão *Run workflow* existe.
4. **Configurar no GitHub** (Settings → Secrets and variables → Actions): variables `SSH_HOST`,
   `SSH_USER`, `SSH_PORT`; secrets `SSH_KEY` e, se a chave tiver senha, `SSH_PASSPHRASE`.
   **Criar o ambiente `production`** (Settings → Environments) — o job o exige; revisores nele são
   opcionais. E **dar leitura da VPS ao repo privado** (deploy key) — item 24.
5. **Push** → o CI roda sozinho e **não publica**. Conferir que passou antes de seguir.
6. **Publicar**: Actions → *CI-CD Pipeline* → *Run workflow* → `deploy: true`.
7. **Na VPS, uma vez**: conferir que a `8880` está livre (`ss -tlnp | grep 8880`; se não, criar
   `~/github/bpmn/.env` com `BPMN_PORT=<livre>`), aplicar `deploy/host-vhost.conf` com o domínio
   real no nginx do host e emitir o certificado.
8. **Conferir no ar**: as 5 URLs, o helper abrindo nas duas páginas, e o painel pedindo a chave
   do visitante — e **não** trazendo nenhuma.
9. **Se algo quebrar**: `deploy/README.md`, seção *Rollback* (nunca ensaiada contra servidor real).

**Nota de custo para os alunos:** cada sessão consome a cota da chave de quem a informou. Vale
dizer isso na apresentação, não só no painel.

## Migração para a organização (2026-11-11)

O projeto saiu do fork pessoal e passou a viver em **`niu-tech/bpmn`**, privado, para o DevOps da
organização poder publicar. O que foi feito, na ordem:

1. **Repositório criado na org** pela UI do GitHub, privado, com a sessão do dono no navegador.
2. **Branch default `main`** com tudo (modelador, viewer, simulação, ajudante, deploy, openspec),
   30 commits, histórico original do `flavioluizseixas/bpmn` preservado.
3. **`dist/` deixou de ser versionado** (`.gitignore`): artefato de build que a imagem gera.
4. **`.vs/` expurgado do histórico** com `git filter-branch`. Eram 14 arquivos do Visual Studio,
   entre eles uma sessão de `copilot-chat` — conteúdo de máquina, nunca deveria ter sido commitado.
   Os 42 arquivos de projeto são idênticos antes e depois do histórico reescrito.
5. **CI verde na org**: run #2 em 52 s, #3 em 58 s. O job de deploy marcou 0 s nas três corridas —
   ele **não roda em push**, por desenho.

### Achado: force-push não apaga nada no GitHub

Medido, não suposto. Depois de reescrever o histórico e empurrar à força:

| Verificação | Resultado |
|---|---|
| Branch aponta para o commit limpo, `.vs` fora da listagem | sim |
| Página do commit antigo ainda renderiza | **sim** |
| `git fetch <remote> <sha-antigo>` | **exit 0** |
| `.vs/.../copilot-chat/sessions/` navegável naquele SHA | **sim** |

O próprio GitHub avisa na página: *"This commit does not belong to any branch on this
repository"* — está fora das refs e continua servido. **Reescrever histórico só limpa clones
novos; o que já subiu precisa de exclusão do repositório ou de chamado no Suporte do GitHub.**

Consequência prática, por repositório:

- **`kaiosmacedo/bpmn`** (fork pessoal, **público**): o commit `cfcba83` continua servido por SHA,
  com a sessão de `copilot-chat` navegável. O topo do fork é ancestral da `main` da org, então o
  fork **não guarda nada exclusivo** — apagá-lo é seguro e é a única saída imediata.
- **`niu-tech/bpmn`** (org, **privado**): `9ac6531` também continua buscável e contém `.vs`. Como o
  repo é privado e novo, o alcance é a org; a página de **Actions** aponta para esses commits nos
  runs #1 e #2. Recriar o repo elimina o rastro, e custa pouco **enquanto ninguém além de nós
  clonou**.
- **`devInfomarcas/bpmn`** (remote `origin` herdado): responde *"Repository not found"* — apagado
  ou fora do alcance da credencial atual. **Não verificado nem limpo.**

**Regra que fica:** `.vs/`, `.idea/`, `dist/` e afins entram no `.gitignore` **antes** do primeiro
commit. Depois de empurrar, não existe desfazer de verdade.

### 2026-11-11, parte 2 — repositório recriado limpo e URL no ar

O plano Free da organização não publica Pages de repositório privado (medido: `plan.name = free`,
e `has_pages` continuou `false` depois da primeira tentativa do job). Como o site é público de
qualquer forma, o caminho foi tornar o repositório público — mas **nunca** por cima do histórico
que carregava o `.vs`. A sequência, feita sem janela de indisponibilidade:

1. **Varredura antes de qualquer coisa**: `.vs` em nenhum dos 33 commits de `main`; nenhum segredo
   no histórico inteiro (só fixtures sintéticos, que se identificam no próprio nome).
   `refs/original/*` — os backups do `filter-branch`, que ainda carregavam o `.vs` — apagados.
2. **`niu-tech/bpmn` renomeado para `niu-tech/bpmn-legacy-private`**, ainda privado. Renomear em
   vez de apagar primeiro significa que, se a criação do repositório novo falhasse, nada se
   perderia.
3. **`niu-tech/bpmn` criado público**, vazio, e `main` empurrada — só o histórico limpo.
4. **Pages ligado** (`build_type=workflow`) e o pipeline rodou: CI 38 s, Pages 33 s, deploy
   `skipped`. URL: <https://niu-tech.github.io/bpmn/>.
5. **Prova contra a URL pública**: 5/5 em 200; as duas páginas, em navegador headless, renderizam
   o diagrama e montam o ajudante; `/spike/`, `/openspec/`, `/Dockerfile` e `/package.json` em 404.

### O rastro do `.vs` foi fechado no mesmo dia

Antes de apagar, confirmei que nenhum dos dois guardava algo que o repositório novo não tivesse:
**toda ponta de branch dos dois era ancestral da `main` nova** (`git merge-base --is-ancestor`).
Então os dois foram apagados — `gh repo delete`, com um login de escopo `delete_repo` feito pelo
dono no terminal dele.

Verificação depois, exatamente o mesmo teste que antes provava que o conteúdo continuava vivo:

| Verificação | Antes | Agora |
|---|---|---|
| `github.com/kaiosmacedo/bpmn` | 200 | **404** |
| `github.com/niu-tech/bpmn-legacy-private` | 200 | **404** |
| página do commit `cfcba83` (o do `copilot-chat`) | renderizava | **404** |
| página do commit `9ac6531` | renderizava | **404** |
| `git fetch` dos dois SHAs no repositório novo | — | `couldn't find remote ref` |
| arquivos `.vs` em qualquer ref local | 22 commits | **0** |

**A lição continua valendo, e é o motivo de isto ter custado uma volta inteira:** force-push não
apaga; só a exclusão do repositório apaga. `.vs/`, `.idea/`, `dist/` e afins entram no
`.gitignore` **antes** do primeiro commit.
