# Tarefas — dar ao gateway o segundo caminho

> Evidência que abriu a change: `openspec/changes/give-gateways-their-second-path/proposal.md`.
> A sessão lida da aba do dono em 2026-11-17 está resumida lá, com os horários das 17 chamadas.

## 1. A camada fina

- [ ] 1.1 `acesso.ramificar({ decisao, forma, rotulo })` em `tools/bpmn-api.js`: cria o ramo pelo
      `appendShape` (que já liga), e escreve o rótulo na ligação **no mesmo comando** — pelo
      `juntoDoComando`, para o aluno desfazer o caminho inteiro com um `Ctrl+Z` (ver T12)
- [ ] 1.2 Teste no dublê: o ramo nasce ligado, a ligação tem o rótulo, e **um** desfazer tira os
      dois. ⚠ O dublê não tem `LabelBehavior`: a prova do rótulo externo é do portão, não daqui
- [ ] 1.3 `caminhosDe(id)`: saídas de sequência de um gateway e quantas têm rótulo

## 2. A ferramenta

- [ ] 2.1 `ramificar` em `tools/escrita.js`: exige gateway (erro nomeado se não for), rótulo
      obrigatório e não-vazio, e devolve `{ criado, ligacao: { id, rotulo }, caminhos }`
- [ ] 2.2 Declaração no catálogo, com a frase que ensina o uso: *"abre um caminho da decisão; o
      rótulo é a resposta que leva por ele"*
- [ ] 2.3 `comoRamo` **declarado** em `criar_elemento` (o handler já aceita) — e a descrição diz
      que sem ele o encadeamento continua sendo o padrão
- [ ] 2.4 Apresentador: a linha diz o caminho, não o id — *"abri o caminho «Não» para «Montar
      base»"*
- [ ] 2.5 Testes de recusa: elemento que não é gateway, rótulo vazio, decisão que não existe

## 3. O que a tela conta

- [ ] 3.1 `estadoDaTela` passa a trazer, por decisão, `{ caminhos, rotulados }`
- [ ] 3.2 `criar_elemento` de gateway devolve `caminhos: 0` no resultado — fato, não recusa
- [ ] 3.3 Teste: decisão com duas saídas e um rótulo é lida como `{ caminhos: 2, rotulados: 1 }`

## 4. O prompt

- [ ] 4.1 Duas linhas na seção de domínio (D5), medindo o teto do tier estável antes e depois
- [ ] 4.2 Teste do teto: o prompt estável continua abaixo do limite, **sem** subir o limite

## 5. Portão

- [ ] 5.1 **Sem cota**, contra o bpmn-js de verdade: `ramificar` duas vezes no mesmo gateway →
      duas saídas, dois rótulos, nenhum órfão, nenhuma seta atravessando caixa
- [ ] 5.2 **Sem cota**: um desfazer tira ramo + ligação + rótulo (um `Ctrl+Z`, como T12)
- [ ] 5.3 **AO VIVO**: *"quero desenhar o atendimento de um chamado, com uma decisão de ter
      componentes suficientes ou não"* → o desenho termina com a decisão de **dois** caminhos
      rotulados e **zero** elementos órfãos. ⚠ O portão mede o registro do bpmn-js, não a narração
- [ ] 5.4 O portão afirma o **antes** (diagrama vazio) e o **depois** (decisão completa): contagem
      de órfãos sem piso aprovaria um canvas que não desenhou nada (princípio XIII)

## 6. Registro

- [ ] 6.1 `openspec/open-items.md`: a sessão de 2026-11-17 e o que ela mostrou
- [ ] 6.2 `roadmap.md`: esta change pendura em **F7 — Ferramentas de escrita**, que fechou sem o
      segundo caminho da decisão. Dizer isso lá, com a data
