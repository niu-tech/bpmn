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

- [x] 3.1 **H8 · diagnóstico do prompt** — `diagnosticoDoPrompt(ctx)` conta o que o prompt de fato
      levou, por seção, e **soma o que foi cortado**. O teto por seção já cortava e já avisava no
      texto; o que faltava era alguém somar — sem isso, um diagrama grande empurrava o quadro para
      perto do limite e a única pista era a resposta do modelo ficar estranha.
- [x] 3.1b **O teto do quadro de contexto, medido** (tarefa 2.4 do harness, que nunca tinha
      rodado): **256 KB aceitos**, com resposta entre 24 e 88 ms em todos os degraus — 4, 16, 64,
      128 e 256. Não medimos acima porque já são ~180× o nosso teto de seção (1400 caracteres).
      **O limite do quadro não é o fio**: é custo, latência e atenção do modelo. A amostra de 25
      elementos é conservadora por escolha de qualidade, não por limite de protocolo.
      ⚠ A ferramenta nunca tinha rodado e tinha DOIS defeitos: `String(ev.data)` virava
      `"[object Blob]"` (o `setupComplete` nunca era reconhecido e o servidor fechava por
      inatividade — com uma mensagem que parece credencial) e faltava `binaryType`
- [x] 3.2 **H9 · o idioma virou valor** — `ctx.idioma`, com `IDIOMA_PADRAO` em pt-BR e a âncora
      ainda repetida no fim (ela só funciona repetida: o diagrama costuma estar em inglês e puxa o
      modelo). Enquanto era prosa escrita à mão, mudá-lo exigia reeditar a identidade inteira.
      ⚠ **O seletor na tela NÃO foi feito**, de propósito: a interface está sendo redesenhada, e
      construir um controle para jogar fora na semana seguinte é desperdício. Quem ligar o seletor
      troca `ctx.idioma` e pronto
- [x] 3.3 **H10 · a memória não esquece mais em silêncio** — o teto descartava o item mais antigo
      sem ninguém saber: nem o aluno, nem o modelo, nem o diagnóstico. Para o tutor da F8 isso é
      perder o que o aluno disse no começo, que é o que define o processo dele. Agora o descarte é
      contado por categoria e **sai no resultado da própria ferramenta**, para o modelo decidir se
      vale relembrar.
      ⚠ **Escopo e consolidação da cápsula NÃO se aplicam**: lá a memória persiste em SQLite entre
      sessões; aqui o produto promete em texto que **nada sai da aba**. E resumir dois lembretes
      num só é decisão de SIGNIFICADO — quem decide o que lembrar aqui é o modelo (constituição
      §III), não um algoritmo nosso

## 4. Evidência

- [x] 4.1 **H5 · diário das corridas** — `tools/ledger.mjs`, JSONL append-only, e a bateria passou a
      registrar cada cenário. O `resultado.json` é da ÚLTIMA corrida e a seguinte o sobrescreve;
      para a dissertação, "o portão F6 passou ao vivo" precisa de registro com data que ninguém
      apagou ao rodar de novo. **A invariante mora no código**: lista branca de campos mais um
      filtro de nomes — áudio, PCM, base64, chave, token e texto parcial são descartados mesmo
      quando mandados. 9 testes, incluindo o do áudio disfarçado dentro de um objeto aninhado.
      JSONL e não banco: a prova precisa ser lida por uma pessoa (e pelo orientador) com um `grep`
- [x] 4.2 **H12 · inventário de dependências** — `tools/inventario.mjs` GERA `docs/INVENTARIO.md`
      do `package-lock` (a versão real) e do `node_modules` (a licença real). 9 diretas, 378 com
      transitivas. Gerado e não escrito à mão: tabela à mão envelhece na primeira atualização e
      passa a mentir com cara de rigor.
      ⚠ **E o inventário achou um problema de LICENÇA na primeira execução** — ver §7

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
- [x] 6.6 **O compositor ficou igual ao do vídeo** — microfone DENTRO dele, à direita, ao lado do
      enviar e nunca no lugar dele; gravando, vira **parar** em vermelho, o campo de texto sai de
      cena e o medidor ocupa a faixa. Duas entradas ao mesmo tempo é o padrão que confunde: o
      ditado substitui a digitação. Acabaram os dois botões numa fileira em cima
- [x] 6.7 **Respiro** — painel de 360×560 para **420×720**, e Texto/Voz/Encerrar saíram do corpo
      rolável para uma faixa fixa: eles sumiam assim que a conversa crescia
- [x] 6.8 **O minimizado diz o que o ajudante faz** — era uma pílula com um nome; ganhou segunda
      linha ("tire dúvidas sobre o seu diagrama"). É a primeira coisa que o aluno vê
- [x] 6.9 **As barras do medidor têm altura dentro do compositor** — sem isso o `scaleY` trabalhava
      sobre 22 px e virava um fio de pontinhos: o medidor existe justamente para o aluno ver que
      está sendo ouvido
- [ ] 6.4 **Cartões clicáveis** no resultado da ferramenta (no vídeo, médico + horário). Aqui seria
      o elemento encontrado, clicável para selecionar no diagrama. **Decidido pelo dono
      (2026-11-13): depois da F7** — fica documentado, não é o ponto mais importante agora
- [ ] 6.5 **"Ouvindo" no modo texto** — o selo diz "ouvindo" numa sessão sem microfone. Anterior a
      esta change, e do mesmo assunto do bloco 2

## 7. O achado de licença (2026-11-14)

O `bpmn-js` **não é MIT**. A licença dele é permissiva, com uma condição explícita:

> *The source code responsible for displaying the bpmn.io project watermark that links back to
> https://bpmn.io as part of rendered diagrams MUST NOT be removed or changed. When this software
> is being used in a website or application, the watermark must stay fully visible and **not
> visually overlapped by other elements**.*

- [x] 7.1 **Nós estávamos violando.** A marca fica no canto inferior direito do canvas (53×21 px,
      topo em y=864 numa janela de 900) e o painel do ajudante ia até y=886 — **sobrepondo, nas
      duas páginas**. Medido, não deduzido
- [x] 7.2 **Corrigido**: a reserva do rodapé ganhou um piso de **44 px**, e ele é de licença e não
      de estética — está dito assim no código, para ninguém baixar o número e ganhar altura de
      painel perdendo o direito de publicar. Reconferido: painel termina em 856, marca começa em
      864, sem sobreposição
- [ ] 7.3 **Declarar no texto do TCC** que o trabalho usa `bpmn-js` sob essa licença e que a marca
      é preservada por exigência dela. Vai junto do K-F (declaração de reúso), na fase de escrita

> Este é o motivo de o inventário existir. Ele não é burocracia de banca: na **primeira execução**
> achou uma condição de licença que o projeto estava quebrando havia meses, sem ninguém saber.

## 5. Fechamento

- [x] 5.1 **Bateria ao vivo completa: 7 de 9** (2026-11-14), relatado como ele é. As falhas:
      **portão F5** com o timeout de silêncio em texto, que segue aberto; e **portão F3** com
      *"a chave foi recusada"* — que era **defeito da regra nova**, não da chave (ver 7.4).
      ⚠ A corrida ANTERIOR deu 6 de 9 por **regressão do próprio harness**: a bolha de espera
      ("pensando…") é uma mensagem de assistente ESTÁVEL, e o laço a leu como resposta pronta em
      1 s. Dois consertos saíram daí, e os dois tiram adivinhação do teste:
      o laço passa a **descartar bolha em curso**, e passa a esperar o **fim declarado pelo
      produto** (`completa`) em vez de "o texto parou de mudar" — uma pausa do modelo no meio da
      frase é indistinguível do fim, e foi assim que o F6 leu *"Sim, o elemento"* como resposta

- [x] 7.4 **A regra estrutural do bloco anterior tinha um furo, e a bateria o encontrou.**
      "Nunca aceitou o setup NESTA sessão" não é o mesmo que "a chave não presta": numa corrida
      longa o servidor passa a recusar SESSÕES (dívida M7) e o fecho vem antes do setup. O aluno
      era mandado trocar uma chave que funciona. Agora a pergunta é se **esta chave já abriu
      sessão nesta aba** — quem sabe disso é quem guarda a credencial, então a resposta é
      injetada. Teste determinístico junto
- [x] 5.2 `openspec/roadmap.md` e `openspec/open-items.md` atualizados no MESMO change
- [ ] 5.3 Peça visual do plano atualizada e entregue ao dono (regra do `CLAUDE.md`)
