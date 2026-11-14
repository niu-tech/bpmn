Apanhado falado. Blocos seis a nove, quatorze de novembro.

Este é o mesmo conteúdo da peça visual, escrito para o ouvido: frases curtas, sem lista, sem
código. A versão para ler está em apanhado e frentes, ponto H T M L, na mesma pasta.

Desde que as referências visuais entraram no repositório, foram cinco commits. Nesse trecho o
ajudante ganhou um painel redesenhado, passou a mexer no diagrama de verdade, e aprendeu a montar
um processo inteiro a partir de três frases. A change das ferramentas de diagrama está fechada,
com as vinte e quatro caixas marcadas, e a fase sete do roteiro recebeu o visto.

Começo pelo que mudou na tela. A pesquisa visual pediu uma coisa só, e foi ela que organizou todo
o resto: uma ação principal por estado. Em voz não existe mais o botão de enviar. O botão
flutuante some quando o painel está aberto. Encerrar a sessão saiu do seletor de modo e foi para
um menu discreto. A escuta deixou de ser vermelha, porque vermelho é erro, não é escuta. E a tela
da chave passou a avisar aquilo que faltava dizer: a chave do aluno aparece nas ferramentas de
rede do navegador, como em qualquer aplicação que roda no cliente.

Depois vieram as quatro ferramentas que escrevem no diagrama: criar, ligar, renomear e remover.
Todas passam pelo mesmo caminho interno do modelador, e é isso que faz o controle zê do aluno
desfazer o trabalho do agente. Apagar é diferente das outras três: o agente pergunta antes, e a
pergunta carrega a versão do desenho. Se o diagrama mudou entre a pergunta e o clique, a remoção
é recusada, porque o elemento daquele momento pode já ser outro.

No meio do caminho fechou uma dívida antiga da voz. Havia uma mensagem na tela dizendo que o
servidor não tinha respondido. A linha do tempo mostrou o contrário: o servidor respondia, com
vinte e cinco quadros de áudio chegando depois de o turno já ter fechado. Cada um desses quadros
rearmava o relógio de um turno que não existia mais, e quarenta e cinco segundos depois o relógio
acusava silêncio. O conserto foram duas linhas. A lição foi outra: a mensagem de erro estava
mentindo com toda a convicção.

Então veio a pergunta de onde o elemento novo nasce. O conserto não foi calcular posição. Foi
parar de não dizer posição: sem ela, a biblioteca usa um ponto fixo e empilha a tarefa nova em
cima da vizinha. Agora a vaga vem do mesmo serviço que o botão de append do próprio aluno usa, e
eu provei isso clicando o botão dele no mesmo evento de início: a tarefa caiu no ponto idêntico.

E aí o teste de verdade. O aluno escreve três frases, em prosa, dizendo em qual raia quer o
processo. O diagrama ganhou o evento de início, três tarefas e o evento de fim, com as quatro
ligações e um caminho completo de ponta a ponta. O portão não conta caixas: ele percorre as
ligações. Cinco elementos soltos passariam numa contagem, e não passam aqui.

O último bloco era para escrever o layout automático. A medição respondeu outra coisa: não
precisa. A cadeia coube no pool, não empilhou, e andou em ordem de leitura. E o pool cresceu
sozinho, de oitocentos e oitenta e cinco para mil trezentos e oitenta e seis pixels, porque a
própria biblioteca expande o participante quando um filho nasce além da borda. Escrever um motor
de disposição ali seria reimplementar, pior, o que já existia.

Agora a parte que eu acho que entra no texto do TCC. Nestes quatro blocos foram dez defeitos no
produto e seis defeitos no instrumento que mede o produto. Os dois piores do produto eram de
honestidade. A tarefa nascia sem nome na tela enquanto o agente narrava o nome, e a leitura de
volta, que existe justamente para impedir isso, conferia o campo errado e assinava embaixo. E
criar um elemento solto num diagrama de colaboração quebrava o modelo deixando a forma desenhada:
a ferramenta dizia que falhou, e o desenho ficava sujo. Do lado do instrumento, o medidor de
sobreposição lia caixas sem a translação do grupo, e concluía que todo mundo sobrepõe todo mundo.
Contava raia e pool como vizinhos, e reprovava o produto por fazer exatamente o que a biblioteca
faz. Reprovou uma pergunta certa do agente. E o pior: o harness de teste não sabia reprovar.
Teste assíncrono vermelho imprimia o símbolo de falha e o processo saía com código zero.

A conclusão não é que eu errei muito. É que sem medir, metade disso passaria por pronto. E que
uma medição não verificada reprova trabalho correto com a mesma facilidade com que aprova
trabalho quebrado. Os dois lados viraram regra escrita no repositório.

Agora, as frentes abertas. São seis.

A primeira, e a que eu recomendo, é a fase oito: o tutor. Metade do portão dela já está provada,
porque a montagem guiada funciona. O que falta não é mecânica, é pedagogia: propor antes de
aplicar, explicar a escolha quando há escolha, e não mexer no que não foi pedido. É o que
transforma a ferramenta naquilo que o título do trabalho promete.

A segunda é o conhecimento citável. Um acervo autoral de BPMN, servido como arquivo estático,
com a ferramenta de consulta escolhida pelo próprio modelo e uma chave de citação que o
aplicativo confere. É a diferença entre o modelo achar e o acervo dizer, com o lugar exato. Essa
change está inteira em aberto, com trinta e uma caixas, e não depende da fase oito.

A terceira é o acabamento do painel: escala de espaçamento, a introdução com uma ação só, o
consentimento que não pode vir pré-marcado, e os prints lado a lado que a própria change pede
como prova.

A quarta são duas pontas da trilha de colheita: os cartões clicáveis no resultado da ferramenta,
e o selo de ouvindo que ainda aparece numa sessão sem microfone.

A quinta são as duas pontas que a change de escrita deixou registradas. Desfazer em bloco, quando
o aluno diz desfaça tudo o que você acabou de fazer. E a sugestão proativa ao abrir um diagrama
com problema, que é a ponte natural para o tutor.

A sexta é o que só você fecha: a publicação definitiva na vê pê éssi, com domínio e segredos, e a
parte escrita do trabalho, que inclui declarar o reúso de código anterior seu e a licença da
biblioteca de diagramas.

Ficam faltando cinco medições: voz humana em microfone físico, negação de microfone, queda de
rede, expiração de sessão, e quantas sessões a chave aguenta em sequência. Essa última importa
pelo produto, não só pelo teste: o aluno traz a própria chave, vai bater nesse limite, e a tela
precisa dizer qual dos três motivos foi.

Fecho por aqui. Quinhentos e vinte e seis testes verdes, dois portões ao vivo passando, e o site
público no ar com o código desta rodada.
