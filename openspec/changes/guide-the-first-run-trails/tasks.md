> Decisões em `design.md` (G1–G6); a pesquisa e o que cada achado decidiu em `research.md`.

## 1. A barra do tutor

- [x] 1.1 `montarBarra()` em `src/primeira-vez/tela.js`, no lugar de `montarTira()`: título, duas
      linhas do que dá para fazer, **uma** sugestão clicável e o rodapé com os caminhos de volta
- [x] 1.2 Texto por trilha (G1): exemplo convida a clicar numa forma e perguntar; branco convida a
      descrever o processo
- [x] 1.3 Encostada na alavanca do ajudante, com seta apontando para ela
- [x] 1.4 Fecha num clique e não volta na mesma visita (`research.md` §1)
- [x] 1.5 `aria-live="polite"`: o texto muda com a seleção, e o leitor de tela anuncia sem cortar

## 2. A sugestão que segue a seleção

- [x] 2.1 `selecionou(nome)`: com um elemento nomeado, a barra fala dele; sem nome, seleção múltipla
      ou nenhuma, volta ao padrão da trilha
- [x] 2.2 `src/app.js` escuta `selection.changed` e repassa **só o nome** — a barra não decide nada
      sobre o diagrama nem chama ferramenta (constituição §III)
- [x] 2.3 A sugestão abre o painel e **digita sem enviar** (`widget.sugerir`, G3)

## 3. Geometria

- [x] 3.1 `bottom` medido da alavanca, não constante (G6) — o print mostrou a linha "voltar ao menu"
      embaixo dela em 375 px
- [x] 3.2 A medida roda em três momentos (agora, próximo quadro, 400 ms) porque o ajudante escreve a
      reserva do rodapé por `ResizeObserver`, depois da montagem
- [x] 3.3 Reposiciona no `resize`, e solta o listener ao fechar
- [x] 3.4 Com o painel aberto, a barra some por CSS (`:has`), sem estado em JS (G5)

## 4. Prova

- [x] 4.1 Cenário novo na bateria: antes do clique a sugestão é a da trilha; depois de selecionar
      "Assar a pizza" ela nomeia a forma; o clique abre o painel com a pergunta digitada e **nada
      enviado**; e a barra sai de cena
- [x] 4.2 Os cenários de tela base passam a medir a barra (e que ela **explica**, não só navega)
- [x] 4.3 375×812: cenário próprio na bateria — a barra inteira **acima** da alavanca (folga
      medida), o "voltar ao menu" clicável e sem rolagem horizontal. Existe porque a outra sessão
      apontou o buraco: mexer na reserva do rodapé do painel quebraria a barra **sem nenhum teste
      reclamar**, e quem tinha pego isso da primeira vez foi um print, não a suíte
- [x] 4.4 `npm test` e a bateria determinística verdes
- [x] 4.5 Prints olhados: exemplo, seleção, celular

## 5. Fora desta change

- [ ] 5.1 Partidas por histórico de quem volta (`research.md` §5) — depende de memória entre
      visitas, que é decisão registrada em contrário
- [ ] 5.2 Medir se a orientação funcionou — não há telemetria, e não vai haver
