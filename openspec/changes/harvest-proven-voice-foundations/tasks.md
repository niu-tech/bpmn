> Trilha H do `openspec/roadmap.md`. A ordem é por **risco**, não por tamanho: o bloco 1 roda
> antes da F7 porque é onde um defeito deixa de ser bolha errada e passa a ser desenho errado.
>
> Regra desta change: **todo item vem com os testes de origem**. Portar código sem portar a prova
> deixa o projeto com a prova do autor antigo e o defeito do novo.

## 1. Fundação do turno — antes da F7

- [x] 1.1 **H1 · `RastreadorDeTurnos`** portado para `src/assistant/live/turn-tracker.js`, com os
      testes junto (`__tests__/turnos.mjs`, 7 casos: 3 da cápsula, 4 deste projeto — a pergunta
      picada e a convivência de delta com cumulativo)
- [x] 1.2 **H1 · lado da ENTRADA ligado**: a fala do aluno vira UMA bolha que cresce, e quem a fecha
      é sinal do servidor (primeiro áudio/legenda do modelo, ou turno fechado), nunca um relógio.
      Provado ao vivo: `bolhasDeFala: 1`, frase inteira, modelo respondeu
- [x] 1.3 **H1 · prender evento ao turno** — `dono()` agora é `pendente ?? turn ?? ultimoEncerrado`:
      o quadro que chega depois do fim pertence ao turno que FECHOU, e não volta mais sem dono para
      a camada de cima adivinhar "o mais recente". Teste determinístico em `spike/__tests__`.
      ⚠ **A heurística `audioFrames > 0` FICA**, e dizer o contrário seria mentir: ela cobre o caso
      em que a legenda atrasada chega **depois** de a pergunta seguinte já ter aberto turno — ali
      `turn` existe e vence, e o protocolo não carimba turno em quadro nenhum. O que mudou é que
      ela dispara muito menos: entre turnos, a atribuição agora está certa por construção
- [x] 1.4 **H1 · uma execução por `{turno, chamada}`** — o despacho classifica cada chamada antes
      de executar; a repetida devolve o resultado **memorizado** e continua sendo respondida (sem
      resposta o turno pendura). Dois testes: a mesma chamada repetida bate na ferramenta **1×** e
      ainda assim recebe duas respostas; ids distintos continuam sendo duas execuções
- [x] 1.5 **H11 · injeção de fala no nível da sessão** — `__bpmnAssist.injetarFala` + `pararMicrofone`
      e `tools/injetar-fala.mjs` (lê o WAV, corta em quadros de 40 ms, injeta no ritmo real, com
      cauda muda para o VAD fechar o turno). Provado ao vivo: 221 quadros, `ouviu` = a frase exata,
      `bolhasDeFala: 1`, modelo respondeu — **sem o microfone falso do navegador**.
      ⚠ A primeira corrida saiu suja (injetou com status `conectando`, o microfone automático abriu
      depois e o servidor transcreveu o tom como *"mhm"*): o passo agora espera `pronto`, fecha o
      microfone e **recusa injetar** se ele continuar aberto. Mantém-se um cenário no caminho real
- [x] 1.6 **H4 · barge-in por nível local** — `criarDetectorDeFala` (puro, em `live/audio.js`,
      limiar 900 na escala PCM16 como na cápsula, 3 quadros seguidos) + `rmsDoQuadro`, a energia
      CRUA ao lado do nível da barra. 7 testes determinísticos: ruído de sala não corta, estalo não
      corta, fala sustentada corta UMA vez, e volta a cortar depois de calar.
      **A calibração morreu**: a pergunta agora é injetada com o microfone fechado e o microfone
      abre no instante em que o modelo começa a falar, então a fixture de corte toca do primeiro
      quadro (`tools/provar-barge-in.mjs`). Ao vivo: `cortouAqui: true`, `rms=0.1391` (5× o
      limiar), modelo falando aos **7,6 s** — número que a fixture antiga jamais acertaria.
      ⚠ `servidorTambemViu: false` nessa corrida: o corte local funcionou onde o `interrupted` do
      servidor não chegou na janela observada. Os dois somam; nenhum substitui o outro

## 2. Honestidade do que aparece

- [x] 2.1 **H2 · canais separados** — `agent/fala.js` (formas de máquina, nunca vocabulário) +
      seção `canais` no prompt, só no perfil de VOZ. A medição é sobre a legenda, que espelha o que
      foi falado, e **zero é o contrato**. Ao vivo: `citacoesFaladas: []`.
      ⚠ Aqui não dá para "limpar a fala": o modelo fala direto pelo Live, não há texto nosso no
      meio. Então o lever é a prosa do prompt e o papel do código é **medir**, não esconder
- [x] 2.2 **H3 · apresentador de resultado** — `tools/apresentador.js` + evento `onAtividade` no
      despachante. A linha começa em "procurando no diagrama…" e **vira o resultado** na mesma
      bolha. Ao vivo: `procurei "pizza order" no diagrama inteiro — 1 resultado`.
      ⚠ Um defeito achado AO VIVO com os testes verdes: o despachante entrega `{ok, resultado}` e
      eu lia o envelope como se fosse o resultado — a busca dizia "na amostra" quando varre o
      diagrama inteiro. As fixtures dos testes usavam a forma crua, que nunca chega ali; foram
      corrigidas para o envelope real
- [x] 2.3 **H6 · estado tipado + medidor** — o selo e o medidor já existiam; o que faltava era o
      estado da FERRAMENTA. Dizer "pronto" enquanto se varre o diagrama é mentir para quem espera,
      e foi por isso que a espera parecia travamento. Agora há `tool: 'consultando'`, e o selo
      **volta** de onde veio quando a ferramenta termina — selo preso mente com confiança
- [x] 2.4 **H7 · contrato na interface** — linha sob o compositor: *"Ele lê o seu diagrama para
      explicar — não altera nada. O que muda no desenho é você que faz."* Confirmada na tela ao
      vivo. Quando a F7 entrar, é esta linha que passa a dizer que ele PROPÕE e o aluno confirma —
      e entra **junto** da escrita, porque poder sem contrato na tela é o aluno descobrindo por
      acidente

## 3. Fundação do prompt e da memória

- [ ] 3.1 **H8 · orçamento e diagnóstico do prompt**, e com ele a medição do teto do quadro de
      contexto — a tarefa 2.4 do harness, que nunca rodou
- [ ] 3.2 **H9 · idioma por preferência** do aluno, tirando o idioma da prosa do prompt
- [ ] 3.3 **H10 · memória com escopo e consolidação**, pré-requisito do tutor da F8

## 4. Evidência

- [ ] 4.1 **H5 · ledger de conversa no harness** — só conteúdo final, sem parciais e sem áudio, com
      a invariante no esquema. Cada corrida da bateria vira registro citável
- [ ] 4.2 **H12 · inventário de dependências** fixadas, com licença declarada, no modelo do
      `INVENTORY.md` da cápsula

## 6. A janela mais perto do vídeo (pedido do dono, 2026-11-13)

> O vídeo do assistente do Orbit é a referência. ⚠ O código dele **não está nesta máquina** —
> procurado duas vezes, nos dois drives e nas sessões locais, sem nenhum resultado. A referência é
> a gravação, e o que vier dela entra com o nosso desenho, não copiado por cima.

- [x] 6.1 **Carregar mensagem** — entre a pergunta e a resposta não havia NADA na tela, e a resposta
      leva segundos: o aluno olhava a própria pergunta sem saber se tinha mandado. Agora a bolha de
      espera entra junto da pergunta e **é a mesma** que a resposta ocupa. Some em todo caminho que
      termina sem texto (turno vazio, legenda só de marcador, falha) — "pensando…" pendurado é pior
      que erro nenhum
- [x] 6.2 **Som enquanto o aluno fala** — já existia e está certo: o medidor é alimentado pelo MESMO
      PCM que sai para o Gemini, e fica fixo acima do compositor. **Nada a fazer** — olhar antes de
      refazer é o que evitou um dia de trabalho
- [x] 6.3 **O que o bloco 2 entregou estava INVISÍVEL** — a linha da ferramenta e o contrato foram
      pintados de branco translúcido num painel CLARO. Estavam no DOM, os testes passavam, e não
      aparecia nada na tela. Corrigido para a cor do resto do painel (`#64748b`), com a armadilha
      escrita no CSS. ⚠ É a lição da dívida M6 outra vez: **olhe a tela**
- [ ] 6.4 **Cartões clicáveis** no resultado da ferramenta (no vídeo, médico + horário). Aqui seria
      o elemento encontrado, clicável para selecionar no diagrama. Vale decidir se entra antes ou
      depois da F7
- [ ] 6.5 **"Ouvindo" no modo texto** — o selo diz "ouvindo" numa sessão sem microfone. Anterior a
      esta change, e do mesmo assunto do bloco 2

## 5. Fechamento

- [ ] 5.1 Bateria ao vivo completa depois do bloco 1, com o número relatado como ele for
- [ ] 5.2 `openspec/roadmap.md` e `openspec/open-items.md` atualizados no MESMO change
- [ ] 5.3 Peça visual do plano atualizada e entregue ao dono (regra do `CLAUDE.md`)
