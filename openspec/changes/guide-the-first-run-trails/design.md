## Context

A change anterior respondeu *"por onde começo?"*. Ela não respondeu a seguinte, que é a que o dono
viu acontecer no ar: **a pessoa escolhe, chega na tela e ela fica parada.** O tutor está ali, sabe
ler o diagrama, desenhar e explicar — e nada na tela diz isso.

O que havia de orientação era a tira no alto do canvas. Três defeitos, e o terceiro é o que importa:

| Defeito | Por que custa |
|---|---|
| pousava **em cima do desenho** | cobria o pool de cima no diagrama do exemplo |
| **não explicava nada** | dizia "ver um exemplo · voltar ao menu" — navegação, não ajuda |
| **não tinha relação com o tutor** | a dúvida é "o que eu faço aqui?", e quem responde isso é o ajudante, no outro canto |

As decisões abaixo saem da pesquisa (`research.md`), e cada uma diz qual achado a decidiu.

## Decisions

### G1. Uma barra, encostada na alavanca do ajudante

Posição: canto inferior direito, **em cima** da alavanca, com uma seta apontando para ela.

Alternativa recusada: manter no alto do canvas, só que mais bonita.

A posição é o argumento. A pergunta de quem chega é *"e agora?"*, e a resposta é *"fale com ele"* —
pôr as duas coisas no mesmo canto, ligadas por uma seta, diz isso sem uma linha de texto. No alto, a
ajuda e quem ajuda ficavam em pontas opostas da tela, e ainda por cima do desenho.

### G2. Sem tour, sem piscar, e sem abrir o painel sozinho

O dono levantou duas ideias: abrir o painel junto com o exemplo, ou piscar a alavanca. Recusadas as
duas, e o motivo fica escrito aqui porque a decisão é dele e pode ser revista.

A pesquisa é direta contra: quem **lê** o tutorial acha o produto mais complicado do que quem pula
(`research.md` §1), *spotlight* só se justifica para interação não óbvia, e modal que bloqueia
impede a pessoa de se sentir competente. Abrir o painel sozinho é pior ainda no nosso caso: na
trilha do exemplo ele cobriria justamente o diagrama que a pessoa pediu para ver, e em 375 px
cobriria a tela toda — sem contar que, sem chave, o que ela veria primeiro seria o pedido de chave.

O que a barra faz é a versão não-interrompente do mesmo objetivo: está **visível**, aponta para a
alavanca e diz o que dá para pedir. Quem quer ignorar, ignora; quem quer fechar, fecha.

### G3. Uma sugestão por estado, e ela chega DIGITADA

O padrão da pesquisa é sugestão clicável, com duas ressalvas: poucas e boas, e editáveis
(`research.md` §2). Então é **uma** por estado, e o clique **digita no compositor sem enviar**.

Não enviar não é cautela: é o contrato. Quem decide o que vai para o modelo é o aluno, e o que o
modelo faz com isso é dele e do function calling (constituição §III). A barra monta uma frase; ela
não chama ferramenta, não decide ação e não fala com o modelo.

E tem o lado prático: quem acabou de chegar provavelmente não tem chave ainda. Enviar sozinho
produziria um erro como primeira resposta do produto.

### G4. A sugestão segue a seleção do canvas

Sem seleção, a barra fala da trilha. Com **uma** forma selecionada, ela fala daquela forma pelo
nome: *"Selecionado: «Assar a pizza»"*, botão *"Perguntar sobre «Assar a pizza»"*, frase
`O que faz "Assar a pizza"?`.

É o achado com a melhor fonte (`research.md` §3) e a melhor versão que o nosso produto podia ter
dele: o Granola sugere pelo transcript e o Gemini pela página, mas o nosso agente **lê o diagrama**
— a sugestão não é chute sobre o que a pessoa quer, é sobre o que ela acabou de clicar.

Também é a resposta literal ao *"pode clicar nos elementos e perguntar"*: em vez de escrever isso
numa dica, o produto **demonstra** no instante em que ela clica.

Seleção múltipla e forma sem rótulo caem no padrão da trilha: um fluxo sem nome não rende pergunta
melhor que *"o que esse processo faz?"*.

### G5. Com o painel aberto, a barra sai

Os dois moram no mesmo canto, e o painel diz as mesmas coisas melhor — tem a conversa inteira, os
exemplos e o campo. Some por CSS (`body:has(.bpmn-assist__panel:not([hidden]))`), sem estado em JS
para alguém esquecer de limpar.

### G6. A barra senta sobre a alavanca MEDINDO, não adivinhando

`bottom` sai da medida da alavanca, não de um número fixo.

Foi um print que decidiu: com offset fixo, em 375 px a linha "voltar ao menu" ficava **embaixo** da
alavanca. O ajudante reserva no rodapé a barra do modelador INTEIRA em tela estreita
(`calcularReserva`), então a alavanca sobe — e qualquer constante que eu escolhesse estaria errada
em alguma largura.

A medida roda em três momentos (agora, no próximo quadro e 400 ms depois) porque o ajudante escreve
aquela reserva por `ResizeObserver`, **depois** da montagem: medir só na montagem deu 110 px contra
os 131 px que a alavanca passou a ocupar.

## Risks / Trade-offs

- **Mais uma coisa no canto inferior direito.** Mitigado por: sai sozinha quando o painel abre, fecha
  num clique, e não volta na mesma visita. Quem restaura o próprio trabalho nunca a vê.
- **A barra fala do que está selecionado, e pode falar demais.** Ela troca de texto a cada clique no
  canvas. É `aria-live="polite"`, então o leitor de tela anuncia sem cortar o que estava lendo; e o
  texto é curto de propósito.
- **Fechou, foi.** Depois disso, o caminho de volta ao menu é o "Recomeçar" da barra do modelador,
  que pergunta antes. Decisão da pesquisa (dispensada não volta na mesma sessão), não esquecimento.
- **Sem medir se funcionou.** O produto é estático e sem telemetria — e vai continuar. A prova
  possível é a da bateria: o caminho existe, é alcançável e leva ao resultado certo.
