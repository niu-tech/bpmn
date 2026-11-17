# Tarefas — começar do zero sem perder o que está na tela

## 1. O diálogo

- [x] 1.1 `perguntarFolhaLimpa()` em `src/primeira-vez/`: três respostas (baixar e começar ·
      começar sem baixar · cancelar), na linguagem do produto e **sem** `confirm()` do navegador
- [x] 1.2 A frase diz a perda onde ela acontece: *"ele vive só nesta aba, não fica guardado em
      lugar nenhum"*
- [x] 1.3 Sem trabalho na tela, não pergunta — o estado inicial não é trabalho do aluno
- [x] 1.4 Teste: as três respostas, e a que não pergunta

## 2. Guardar = baixar

- [x] 2.1 `baixarDiagrama()` pelo `saveXML({ format: true })` do modelador, com nome de arquivo
      derivado do processo (ou `processo.bpmn`)
- [x] 2.2 Teste: o XML exportado **volta a importar** sem erro (ida e volta no `bpmn-moddle`)
- [x] 2.3 ⚠ Nenhuma rede. A prova é o blob local; se aparecer `fetch` nesta tarefa, a change está
      errada

## 3. A folha limpa

- [x] 3.1 `novoDiagrama()`: importa o XML mínimo com **um** evento de início e limpa o autosave
- [x] 3.2 Teste: depois de começar do zero, `criar_elemento` com `depoisDe` no início **funciona**
      (era a recusa por falta de lugar no canvas vazio)
- [x] 3.3 A âncora ganha a terceira saída (N5), sem cobrir paleta nem a barra da simulação —
      medido com caixa de área real, não com `0x0` (princípio XIII)

## 4. O verbo do agente

- [x] 4.1 `comecar_do_zero` em `tools/escrita.js`, com `exigirEdicao` e **portão de confirmação**
- [x] 4.2 Declaração no catálogo com `escreve: true`; nada de keyword no código (§III)
- [x] 4.3 Teste: recusa com `falta_confirmacao`; o aluno responde; a segunda chamada limpa
- [x] 4.4 Teste: a marca de confirmação **não vira mina** — a janela é a próxima fala (T22)
- [x] 4.5 Apresentador: a linha diz o que aconteceu com o desenho anterior

## 5. Portão

- [x] 5.1 **Sem cota**: com o exemplo da pizzaria aberto (57 formas), pedir folha limpa pergunta e
      **nada muda**; cancelar mantém as 57; começar sem baixar deixa **uma**
- [x] 5.2 **Sem cota**: baixar e começar produz um arquivo que volta a abrir
- [ ] 5.3 **AO VIVO**, por voz: *"quero começar um processo do zero"* → recusa, o aluno responde,
      e só então a tela limpa
- [x] 5.4 O portão afirma o **antes** (57 formas) e o **depois** (1): contagem sem piso aprovaria
      um canvas que nunca desenhou

## 6. Registro

- [ ] 6.1 `open-items.md`: o pedido do dono de 2026-11-17, com as palavras dele
- [ ] 6.2 Dizer no texto da change que **memória entre visitas continua fora** (F.5), para ninguém
      ler "guardar" como "servidor"

## O que ficou provado (2026-11-17)

**Portão sem cota**, com o exemplo da pizzaria na tela:
`{"antes":24,"depois":1,"perguntou":true,"nadaMudouAoPerguntar":true,"dizQueMorreComAAba":true,`
`"cancelarManteve":true,"limpouParaUma":true,"arquivoEBpmn":true,"temATarefaGuardada":true,`
`"primeiroPedidoFunciona":true,"tamanhoDoArquivo":1484}`

⚠ O **baixar** é provado de verdade: o portão intercepta o `createObjectURL` — o único ponto por
onde o arquivo passa antes de sair do navegador — e lê o blob. São 1484 bytes de BPMN **com a
tarefa que o aluno tinha desenhado dentro**. Sem isso o portão provaria só que o botão fecha.

**Três provas determinísticas** em `__tests__/escrita.mjs`: a pergunta carrega a versão do
diagrama (H14), a recusa do aluno é FATO que volta ao modelo **e a página não é chamada**, e
página sem a função recusa com nome **sem perguntar nada** (perguntar o que não se pode fazer é
pior que recusar).

⚠ **Um refactor que o guardrail cobrou e melhorou o desenho:** o nome do portão passou a vir do
catálogo (`ACOES_COM_PORTAO`) em vez de a ferramenta citar o próprio nome como string. De quebra,
o nome do portão passou a ter **uma fonte** — antes existia no `exigeConfirmacao` e na chamada,
sem nada impedindo de divergirem.
