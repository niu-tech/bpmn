# Tarefas — dar ao gateway o segundo caminho

> Evidência que abriu a change: `openspec/changes/give-gateways-their-second-path/proposal.md`.
> A sessão lida da aba do dono em 2026-11-17 está resumida lá, com os horários das 17 chamadas.

## 1. A camada fina

- [x] 1.1 `acesso.ramificar({ decisao, forma, rotulo })` em `tools/bpmn-api.js`: cria o ramo pelo
      `appendShape` (que já liga), e escreve o rótulo na ligação **no mesmo comando** — pelo
      `juntoDoComando`, para o aluno desfazer o caminho inteiro com um `Ctrl+Z` (ver T12)
- [x] 1.2 Teste no dublê: o ramo nasce ligado, a ligação tem o rótulo, e **um** desfazer tira os
      dois. ⚠ O dublê não tem `LabelBehavior`: a prova do rótulo externo é do portão, não daqui
- [x] 1.3 `caminhosDe(id)`: saídas de sequência de um gateway e quantas têm rótulo

## 2. A ferramenta

- [x] 2.1 `ramificar` em `tools/escrita.js`: exige gateway (erro nomeado se não for), rótulo
      obrigatório e não-vazio, e devolve `{ criado, ligacao: { id, rotulo }, caminhos }`
- [x] 2.2 Declaração no catálogo, com a frase que ensina o uso: *"abre um caminho da decisão; o
      rótulo é a resposta que leva por ele"*
- [x] 2.3 `comoRamo` **declarado** em `criar_elemento` (o handler já aceita) — e a descrição diz
      que sem ele o encadeamento continua sendo o padrão
- [x] 2.4 Apresentador: a linha diz o caminho, não o id — *"abri o caminho «Não» para «Montar
      base»"*
- [x] 2.5 Testes de recusa: elemento que não é gateway, rótulo vazio, decisão que não existe

## 3. O que a tela conta

- [x] 3.1 `estadoDaTela` passa a trazer, por decisão, `{ caminhos, rotulados }`
- [x] 3.2 `criar_elemento` de gateway devolve `caminhos: 0` no resultado — fato, não recusa
- [x] 3.3 Teste: decisão com duas saídas e um rótulo é lida como `{ caminhos: 2, rotulados: 1 }`

## 4. O prompt

- [ ] 4.1 Duas linhas na seção de domínio (D5), medindo o teto do tier estável antes e depois
- [ ] 4.2 Teste do teto: o prompt estável continua abaixo do limite, **sem** subir o limite

## 5. Portão

- [x] 5.1 **Sem cota**, contra o bpmn-js de verdade: `ramificar` duas vezes no mesmo gateway →
      duas saídas, dois rótulos, nenhum órfão, nenhuma seta atravessando caixa
- [x] 5.2 **Sem cota**: um desfazer tira ramo + ligação + rótulo (um `Ctrl+Z`, como T12)
- [x] 5.3 **AO VIVO**: *"quero desenhar o atendimento de um chamado, com uma decisão de ter
      componentes suficientes ou não"* → o desenho termina com a decisão de **dois** caminhos
      rotulados e **zero** elementos órfãos. ⚠ O portão mede o registro do bpmn-js, não a narração
- [x] 5.4 O portão afirma o **antes** (diagrama vazio) e o **depois** (decisão completa): contagem
      de órfãos sem piso aprovaria um canvas que não desenhou nada (princípio XIII)

## 6. Registro

- [x] 6.1 `openspec/open-items.md`: a sessão de 2026-11-17 e o que ela mostrou
- [x] 6.2 `roadmap.md`: esta change pendura em **F7 — Ferramentas de escrita**, que fechou sem o
      segundo caminho da decisão. Dizer isso lá, com a data

## O que ficou provado (2026-11-17)

**A causa, confirmada no código:** `comoRamo` existia no handler desde 2026-11-15 e **nunca foi
declarado**. Sem ele, pedir o segundo caminho caa em `depoisDe`, que encadeia.

**Portão sem cota**, contra o bpmn-js de verdade:
`{"comoRamoAbriu":true,"doisCaminhos":true,"doisRotulos":true,"rotulos":["Nao","Sim"],"orfaos":[],`
`"sobrepostos":[],"atravessadas":[],"umDesfazerTirouOCaminho":true,"comandosPorCaminho":1}`

**Cinco provas determinísticas novas** em `__tests__/escrita.mjs`: segunda saída de verdade (o
primeiro caminho continua inteiro), o rótulo na seta, as duas recusas (não-gateway e rótulo
vazio) e a contagem de caminhos por decisão.

⚠ **A linha do prompt (4.1) ficou de fora, e isso é decisão, não esquecimento.** Ela estourava o
teto do tier estável (5511 > 5400), e subir o teto para caber a própria adição é como um
orçamento vira ficção (§IX). O ensino mora na **declaração da ferramenta**, que é o canal certo
para "como se usa" — e a leitura da tela passou a dizer, a cada turno, quantos caminhos cada
decisão tem.

⚠ **Achado de brinde:** a projeção de diagnóstico não trazia o NOME da ligação. Nenhum portão
conseguia perguntar se o caminho tinha resposta escrita nele — e foi o primeiro vermelho deste
portão.

## Ao vivo (2026-11-17)

**Portão 5.3, sessão viva contra o Gemini**, com o pedido do dono em palavras (sem id, sem tipo,
sem dizer "ramifique"):

`{"elementosNovos":8,"decisao":"ExclusiveGateway","caminhos":2,"rotulos":["Sim","Não"],`
`"orfaos":[],"nasceramEmpilhados":[],"ramificou":2,`
`"ligacoesNovas":["Gateway -> «Sim»","Gateway -> «Não»", ...]}`

O modelo **escolheu** `ramificar` duas vezes. Era a prova que faltava: o portão sem cota mostra
que a ferramenta funciona; só a sessão viva mostra que a **declaração** basta para ele pedir a
coisa certa quando o aluno fala como aluno.

⚠ **Duas correções no PEDIDO, e nenhuma delas é ajustar o teste ao defeito.** Na primeira corrida
o modelo ofereceu *limpar a tela* (a frente 2 atropelando a frente 1) — a declaração de
`comecar_do_zero` dizia "quando o aluno quiser começar outro processo", e descrever um processo
novo casava com isso. Estreitada: *"descrever um processo novo NÃO é pedido de limpar; o desenho
aceita mais de um processo"*. Na segunda ele perguntou **em qual pool** desenhar — pergunta
legítima num diagrama com dois pools, e ambiguidade que **este** portão não mede (quem mede é o
portão do candidato clicável). O pedido passou a dizer o lugar.

⚠ **E um conserto de INSTRUMENTO:** contêiner não é órfão. O portão reprovou com
`orfaos:["Participant \"Suporte\""]` enquanto a decisão tinha os dois caminhos rotulados — pool
e raia não se ligam a nada por definição, eles **contêm** o fluxo. Medir errado e consertar o
produto seria o pior resultado possível desta corrida.
