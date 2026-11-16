> Decisões em `design.md` (N1–N7); o que a pesquisa decidiu, e com que fonte, em `research.md`.

## 1. O nome, numa fonte só

- [x] 1.1 `src/assistant/identidade.js` (novo, puro): `NOME`, `O_QUE_E`, as frases semeadas e
      `LIMITE_COMPOSITOR`
- [x] 1.2 `widget.js` consome o nome no painel e na alavanca (três strings, nenhuma literal nova)
- [x] 1.3 `tela.js` diz o nome **uma vez** e a frase do que ele é — as outras duas ocorrências de
      "tutor" saem (N1)
- [x] 1.4 A frase clicável do painel passa a ser a mesma constante da tela: uma fonte, duas
      superfícies

## 2. A frase que cabe

- [x] 2.1 `Vou te descrever o meu processo` (31 caracteres, medido) no lugar dos 47 cortados
- [x] 2.2 Sai o `MEU` em maiúscula
- [x] 2.3 Teste puro: toda frase semeada dentro de `LIMITE_COMPOSITOR`, nomeando quem passar

## 3. A âncora permanente

- [x] 3.1 `montarAncora()` em `tela.js`: montada uma vez, não morre com a orientação nem com a
      edição
- [x] 3.2 Clique → tela base, sem descartar nada
- [x] 3.3 Sai de cena com a tela base no ar, por CSS (`body.pv-no-ar`), sem estado em JS
- [x] 3.4 Posição medida: alto à esquerda com texto em tela larga; ícone no bolso livre entre
      paleta e simulação em 375 px (N3)
- [x] 3.5 A orientação perde o rodapé de navegação (N6)

## 4. A tela base deixa de ser armadilha

- [x] 4.1 Com trabalho salvo, "⤴ Continuar o que eu estava fazendo" como primeira ação
- [x] 4.2 `Esc` fecha a tela base quando há trabalho salvo
- [x] 4.3 Sem trabalho salvo, nada disso aparece — não há o que continuar

## 5. Confirmação de substituição (constituição §VII)

- [x] 5.1 Com trabalho salvo, o cartão de trilha pergunta nele mesmo; segundo clique executa
- [x] 5.2 Janela de 5 s, e o primeiro clique **não** muda o diagrama
- [x] 5.3 Sem `confirm()` — a bateria tem de atravessar a confirmação

## 6. O visual

- [x] 6.1 Mini-diagrama BPMN em SVG inline (início → tarefa → fim), sem arquivo novo
- [x] 6.2 Hierarquia: primário com peso de ação, dois secundários visivelmente mais leves
- [x] 6.3 Selo com o nome do produto, uma vez

## 7. Prova

- [x] 7.1 `npm test` verde, com o teste do limite incluído
- [x] 7.2 Bateria: a âncora existe depois de editar e leva ao início; a tela base fecha pelo `Esc`;
      a confirmação pede dois cliques; a frase não transborda
- [x] 7.3 Bateria: a âncora é clicável em 1280×860 **e** em 375×812 (a geometria deixa de depender
      de print — era a dívida da rodada anterior)
- [x] 7.4 Prints das três trilhas e da tela base, olhados antes de entregar
- [x] 7.5 Apresentação da rodada em `openspec/apresentacoes/`

## 8. Fora de escopo, declarado

- Renomear classe CSS e símbolo (`bpmn-assist`, `ajudante`, `mountAssistant`): cascata grande, zero
  ganho para quem usa. Nome de produto vem da constante; nome de símbolo fica (N1).
- Nome próprio humano para o agente, e "IA" dentro do nome: recusados com motivo (`research.md` §2).
- Validar o nome com aluno, e saber se a âncora é notada no primeiro minuto: exige gente, e não há
  telemetria (`research.md` §5).
