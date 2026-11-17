Macrocheckpoint das três frentes. Dezessete de novembro.

Este é o mesmo conteúdo do relatório, escrito para o ouvido: frases curtas, sem lista e sem
código. A versão para ler está em artifacts, no pê dê éfe do macrocheckpoint.

Você dirigiu o produto por inteiro pela primeira vez, com o diagrama da aula aberto, e trouxe
três coisas. As três estão feitas e provadas na sessão ao vivo. E apareceu uma quarta, que não é
entrega: é um número.

Começo pelo gateway, porque é o que tinha causa no código.

Você viu uma decisão com um caminho só, e o outro elemento solto na tela. O modelo estava certo
em tentar. Abrir o segundo caminho de um gateway era impossível. O parâmetro que faz um elemento
nascer como ramo de uma decisão existia no código desde o dia quinze, e nunca foi declarado ao
modelo. Sem ele, pedir o segundo caminho caía na opção depois de, que enfileira. Então o modelo
recebia uma fila onde pediu uma bifurcação, desfazia, tentava de novo, e sobrava lixo. Na sua
sessão isso custou dezessete chamadas, dois desfazeres, e uma tentativa de renomear uma seta que
já não existia.

Agora existe um verbo só para isso. Ele cria o elemento, liga à decisão e escreve a resposta na
seta, tudo num comando. Isso importa pelo seu Ctrl Zê: um desfazer tira o caminho inteiro, e não
três pedaços dele. E a leitura da tela passou a dizer, a cada turno, quantos caminhos cada decisão
tem e quantos têm resposta escrita. Uma decisão pela metade fica visível para o modelo antes de
você notar.

A lição vale para os próximos blocos, e está escrita no roteiro. Verbo declarado não é capacidade
alcançável. Um parâmetro que o código aceita e a declaração não cita é uma capacidade que o
produto tem e o modelo não pode usar. E o sintoma chega como: o modelo não entende gateway.

A segunda frente é começar do zero.

São três respostas, e nenhuma delas é um aviso do navegador: baixar e começar, começar sem
baixar, ou cancelar. A frase diz a perda onde ela acontece. Ele vive só nesta aba, não fica
guardado em lugar nenhum. Isso é a verdade: não há servidor nosso e não há conta. Guardar, aqui,
quer dizer baixar o arquivo. E o arquivo baixado volta a abrir, o que está provado lendo o que
saiu, e não só olhando se o botão fecha.

Dá para pedir pelo botão ao lado da alavanca, ou falando. Falando, vale o mesmo portão do apagar:
o agente recusa e pergunta, e só limpa depois que você responde.

A terceira frente é a tela durante a construção, e é a que você sentiu em produção.

Três coisas mudaram. O elemento que acabou de mudar pisca no canvas, onde você está olhando. As
linhas de escrita do mesmo pedido viram uma mensagem que cresce, montando o processo, N
elementos, com a lista por dentro, em vez de doze linhas rolando. E o selo distingue desenhando de
pensando, porque três segundos de cada um são a mesma espera com significados diferentes.

A contagem conta o desenho, e não as chamadas. Se o agente desfaz, o número cai. Essa foi a
primeira coisa que o portão desta frente pegou: a mensagem dizia sete elementos com cinco na
tela, na mudança que existe justamente para a tela parar de mentir.

Agora o número, que é a parte que decide o que é honesto prometer.

Antes de prometer velocidade, medimos de onde vem a espera. A ferramenta corre o mesmo pedido e
separa, por chamada, a nossa execução da volta ao modelo. A nossa escrita no modelador tem
mediana de um centésimo de segundo. A volta ao modelo tem mediana de quatro décimos, com pior
caso de um segundo e um décimo. A nossa fatia do tempo total é de um por cento.

E tem mais: o site publicado não é mais lento que o nosso servidor de desenvolvimento. Medi os dois na mesma hora, com o mesmo pedido, e deu praticamente o mesmo número. Então os três a cinco segundos por bloco que você sentiu não vêm de estar publicado. Vêm da volta ao modelo, que varia de turno para turno. Isso fecha uma suspeita: não há nada para consertar no deploy.

Então esta frente não promete velocidade, e isso é decisão, não desculpa. A espera entre blocos é
a volta ao modelo, e nenhuma mudança nossa a encurta. O que ela entrega é a espera legível: você
passa a saber que algo está acontecendo, o quê, e quantos elementos já entraram. Isso fica
escrito no registro, e não na tela. O aluno não precisa de uma aula sobre a arquitetura do Gemini
para entender uma barra de progresso.

Vale contar os três defeitos meus que os portões acharam nesta rodada, porque é o que diferencia
passou de foi medido.

O primeiro foi a contagem que mentia, e já contei.

O segundo foi o selo que ficou preso. Ao separar desenhando de consultando, a volta do estado
conhecia só o segundo. E selo preso aqui não é cosmético: ele trava a tela. Clicar num botão que
o agente acabou de desenhar respondia conecte antes de escolher, com a sessão aberta e saudável.
Quem pegou foi um portão de outra frente.

O terceiro é o mais interessante. Numa construção de oito elementos, o selo de desenhando nunca
foi observado. Nem amostrando a tela a cada cento e vinte milissegundos. A causa é que a nossa
escrita é instantânea: o estado nascia e morria no mesmo instante. Um selo que existe por
microssegundos não é feedback, é contabilidade interna. Agora ele tem tempo mínimo de leitura, e
o seu gesto o encurta, porque clicar prova que você leu.

A prova tem três camadas, e as três estão verdes. Mil cento e vinte e sete asserções
determinísticas, sem rede. Trinta e oito portões no navegador contra o modelador de verdade, sem
gastar cota. E três sessões ao vivo, uma por frente.

A prova ao vivo da voz é a que mais vale a pena ler, porque mede ordem, e não estado final. Ouviu
quero começar um processo do zero aos cinco segundos e sete. Recusou aos nove e três, com as
vinte e quatro formas intactas. Ouviu pode limpar aos vinte e quatro e três. E só então a tela
ficou com uma forma. Um portão frouxo apagaria o seu desenho sem você ter dito nada; um duro
travaria a conversa. Os dois erros são de ordem.

Há também um filme da construção, um quadro a cada meio segundo, em artifacts, na pasta filme
construção. É o que dá para assistir em vez de ler.

Três pontas ficaram abertas, de propósito.

As duas linhas de gateway no prompt ficaram de fora porque estouravam o teto do tier estável:
cinco mil quinhentos e onze contra cinco mil e quatrocentos. Subir o teto para caber a própria
adição é como um orçamento vira ficção. O ensino foi para a declaração da ferramenta, que é o
canal certo para como se usa.

Memória entre visitas continua fora, e essa decisão é sua: persistir exige reescrever o aviso de
privacidade e pedir consentimento.

E agrupar várias chamadas no mesmo turno é o próximo candidato real de velocidade. Só valia a
pena se a volta ao modelo dominasse o tempo. Agora está medido que domina.
