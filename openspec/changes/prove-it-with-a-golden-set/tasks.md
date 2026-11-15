> **Esta change não melhora o produto — ela mede.** Por isso ela vem depois das duas de
> comportamento: medir antes de consertar dá uma linha de base de uma versão que a gente já sabe
> que vai mudar. Mas ela vem ANTES da escrita do capítulo de validação, porque é dela que saem as
> tabelas.

## 1. O acervo

- [ ] 1.1 `avaliacao/perguntas-douradas.json` com perfis (`modelador`, `viewer`) e as ferramentas
      que cada um deve enxergar.
- [ ] 1.2 Trinta perguntas para começar, cobrindo as doze categorias: leitura, escrita, montagem,
      geometria, ambiguidade, confirmação, recusa de escopo, injeção, chave, borda, idioma, cota.
- [ ] 1.3 Cada pergunta nas palavras de um aluno — tiradas das trilhas reais quando houver.
- [ ] 1.4 `avaliacao/README.md`: como ler o arquivo, como acrescentar uma pergunta, o que cada
      campo cobra.
- [ ] 1.5 Validador: pergunta que cite ferramenta inexistente, perfil desconhecido ou categoria de
      segurança sem proibição declarada **reprova o arquivo**.

## 2. Camada determinística

- [ ] 2.1 `tools/avaliar.mjs`: monta a sessão com o dublê de socket, roteiriza o modelo conforme
      `ferramentasEsperadas`, e mede o que é nosso (oferta, política, execução, erro nomeado).
- [ ] 2.2 Entra no `npm test` como um arquivo a mais — sem rede, sem chave.
- [ ] 2.3 Resumo por categoria no terminal e em `artifacts/avaliacao/<carimbo>/resumo.json`.

## 3. Camada ao vivo

- [ ] 3.1 `npm run avaliar -- --ao-vivo`: uma sessão por pergunta, com o descanso declarado entre
      sessões (cadência de teste não pode virar vermelho).
- [ ] 3.2 Mede: ferramenta escolhida, argumentos que importam, fatos obrigatórios, proibições,
      recusas esperadas.
- [ ] 3.3 Pergunta que não rodou por cota é contada como **não executada**, nunca como acerto.
- [ ] 3.4 O resultado entra no diário append-only (`tools/ledger.mjs`), com data.

## 4. Limiares e linha de base

- [ ] 4.1 `avaliacao/limiares.json`: piso geral, cobertura e precisão de ferramenta, 100% nas
      categorias de segurança, delta máximo de regressão.
- [ ] 4.2 `avaliacao/baseline.json`: começa vazio (sem comparação), e só é atualizado por ato
      explícito depois de alguém olhar a diferença.
- [ ] 4.3 A corrida reprova por piso, por categoria de segurança **ou** por delta, e diz qual dos
      três foi.

## 5. A gravação com som

- [ ] 5.1 `tools/video-prova.mjs`: dirige uma sessão, injeta a fala, captura o PCM recebido.
- [ ] 5.2 Trilha sonora remontada na linha do tempo real (fala do aluno + fala do agente) como WAV
      ao lado do vídeo.
- [ ] 5.3 Marcador visual no clique humano, para a banca distinguir pessoa de agente.
- [ ] 5.4 Um vídeo de dois a três minutos do caminho feliz: descrever o processo, o agente montar,
      o aluno corrigir por voz, o agente alinhar.

## 6. Portão

- [ ] 6.1 `npm test` verde com a camada determinística dentro.
- [ ] 6.2 Uma corrida ao vivo completa, com resumo carimbado e `baseline.json` preenchido a partir
      dela (ato explícito, registrado).
- [ ] 6.3 As três tabelas da dissertação geradas dos arquivos: taxa por categoria, cobertura de
      ferramenta, latência por turno (esta vem da change `sustain-a-class-session`).
