# Checklist de release — GO / NO-GO

Estado em 2026-11-10, depois do P3. **Código implementado não é hospedagem efetiva**: nada foi
publicado, nenhuma VPS foi tocada, nenhum workflow foi disparado.

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
| 17 | **Botão de deploy disponível** | **NO-GO** | o workflow só existe em `ImproveSimulation`; o GitHub só oferece *Run workflow* na branch **default** |
| 18 | **Conversa real pelo widget** | **NO-GO** | exige a chave do aluno; nunca executado |
| 19 | **Fala humana + barge-in** | **NO-GO** | exige alguém falando |
| 20 | **Domínio e HTTPS** | **NO-GO** | `host-vhost.conf` tem placeholder; DNS e domínio são decisão do dono |
| 21 | **Secrets/vars do Actions** | **NO-GO** | `SSH_HOST`, `SSH_USER`, `SSH_KEY` nunca configurados; não toquei |
| 22 | **Revisor do ambiente** | **pendente, opcional** | `environment: production` cria o portão; a exigência de aprovação só existe se configurada |

## Impedimentos reais × sugestões futuras

**Impedem a primeira publicação (17, 20, 21):** sem o workflow na branch default não há botão de
deploy; sem domínio e DNS não há endereço; sem os secrets o passo de SSH falha. Os três são atos
do dono, não de código.

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
3. **Levar o workflow para a branch default** (merge de `ImproveSimulation` → `main`, ou mudar a
   default). Sem isso o botão *Run workflow* não existe — item 17.
4. **Configurar no GitHub**: variables `SSH_HOST`, `SSH_USER`, `SSH_PORT`; secrets `SSH_KEY` e,
   se a chave tiver senha, `SSH_PASSPHRASE`. Opcional: revisores em
   Settings → Environments → `production`.
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
