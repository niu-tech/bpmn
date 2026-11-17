# Tarefas — começar do zero sem perder o que está na tela

## 1. O diálogo

- [ ] 1.1 `perguntarFolhaLimpa()` em `src/primeira-vez/`: três respostas (baixar e começar ·
      começar sem baixar · cancelar), na linguagem do produto e **sem** `confirm()` do navegador
- [ ] 1.2 A frase diz a perda onde ela acontece: *"ele vive só nesta aba, não fica guardado em
      lugar nenhum"*
- [ ] 1.3 Sem trabalho na tela, não pergunta — o estado inicial não é trabalho do aluno
- [ ] 1.4 Teste: as três respostas, e a que não pergunta

## 2. Guardar = baixar

- [ ] 2.1 `baixarDiagrama()` pelo `saveXML({ format: true })` do modelador, com nome de arquivo
      derivado do processo (ou `processo.bpmn`)
- [ ] 2.2 Teste: o XML exportado **volta a importar** sem erro (ida e volta no `bpmn-moddle`)
- [ ] 2.3 ⚠ Nenhuma rede. A prova é o blob local; se aparecer `fetch` nesta tarefa, a change está
      errada

## 3. A folha limpa

- [ ] 3.1 `novoDiagrama()`: importa o XML mínimo com **um** evento de início e limpa o autosave
- [ ] 3.2 Teste: depois de começar do zero, `criar_elemento` com `depoisDe` no início **funciona**
      (era a recusa por falta de lugar no canvas vazio)
- [ ] 3.3 A âncora ganha a terceira saída (N5), sem cobrir paleta nem a barra da simulação —
      medido com caixa de área real, não com `0x0` (princípio XIII)

## 4. O verbo do agente

- [ ] 4.1 `comecar_do_zero` em `tools/escrita.js`, com `exigirEdicao` e **portão de confirmação**
- [ ] 4.2 Declaração no catálogo com `escreve: true`; nada de keyword no código (§III)
- [ ] 4.3 Teste: recusa com `falta_confirmacao`; o aluno responde; a segunda chamada limpa
- [ ] 4.4 Teste: a marca de confirmação **não vira mina** — a janela é a próxima fala (T22)
- [ ] 4.5 Apresentador: a linha diz o que aconteceu com o desenho anterior

## 5. Portão

- [ ] 5.1 **Sem cota**: com o exemplo da pizzaria aberto (57 formas), pedir folha limpa pergunta e
      **nada muda**; cancelar mantém as 57; começar sem baixar deixa **uma**
- [ ] 5.2 **Sem cota**: baixar e começar produz um arquivo que volta a abrir
- [ ] 5.3 **AO VIVO**, por voz: *"quero começar um processo do zero"* → recusa, o aluno responde,
      e só então a tela limpa
- [ ] 5.4 O portão afirma o **antes** (57 formas) e o **depois** (1): contagem sem piso aprovaria
      um canvas que nunca desenhou

## 6. Registro

- [ ] 6.1 `open-items.md`: o pedido do dono de 2026-11-17, com as palavras dele
- [ ] 6.2 Dizer no texto da change que **memória entre visitas continua fora** (F.5), para ninguém
      ler "guardar" como "servidor"
