"""O trabalho, do fork até aqui — peça para acompanhar a apresentação ao orientador.

Diferente dos outros dois: o `relatorio-rodada.py` conta uma rodada e o `checkpoint-tcc.py` é o
retrato de hoje para decidir o que vem. Este é para alguém de FORA ler enquanto vê o sistema
funcionando: o que já existia, o que foi acrescentado, como foi construído, o que dá para
demonstrar e onde estão os limites. Sem datas, sem cronologia, sem jargão interno de change.

Uso: python tools/resumo-para-banca.py
"""
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle)

OUT = Path(__file__).resolve().parent.parent / "artifacts" / "resumo-para-banca.pdf"
AZUL = "#0A7EA4"
VERDE = "#1F7A48"
CINZA = "#555555"

base = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=18,
                    leading=22, alignment=TA_LEFT, spaceAfter=2)
SUB = ParagraphStyle("SUB", parent=base["Normal"], fontName="Helvetica", fontSize=10,
                     leading=13.5, textColor=CINZA, spaceAfter=13)
H2 = ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12.5,
                    leading=15, textColor=AZUL, spaceBefore=12, spaceAfter=5)
P = ParagraphStyle("P", parent=base["Normal"], fontName="Helvetica", fontSize=9.8, leading=13.6,
                   spaceAfter=5)
CITA = ParagraphStyle("CITA", parent=P, leftIndent=10, textColor="#333333",
                      spaceBefore=3, spaceAfter=6, fontName="Helvetica-Oblique")
LI = ParagraphStyle("LI", parent=P, spaceAfter=3)
CEL = ParagraphStyle("CEL", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=11.5)
CELB = ParagraphStyle("CELB", parent=CEL, fontName="Helvetica-Bold")


def bullets(items):
    return ListFlowable([ListItem(Paragraph(t, LI), leftIndent=10) for t in items],
                        bulletType="bullet", start="•", leftIndent=12, bulletFontSize=7)


def tabela(linhas, larguras):
    dados = [[Paragraph(c, CELB if i == 0 else CEL) for c in linha] for i, linha in enumerate(linhas)]
    t = Table(dados, colWidths=larguras, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF4F7")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor(AZUL)),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


story = [
    Paragraph("Tutor BPMN — um agente de ensino dentro do modelador", H1),
    Paragraph("Do ponto em que o projeto estava — um modelador com simulação em lote — até um "
              "assistente que conversa por voz e por escrito, lê o diagrama aberto, desenha nele "
              "e cita a fonte do que ensina", SUB),

    Paragraph("De onde o trabalho partiu", H2),
    Paragraph(
        "O ponto de partida já era um sistema que funcionava: um <b>modelador BPMN</b> no "
        "navegador (bpmn-js), um visualizador separado e, acima de tudo, uma <b>simulação em "
        "lote</b> construída sobre ele — motor determinístico, distribuições estatísticas, "
        "métricas por elemento, mapa de calor e exportação dos resultados. Essa parte responde "
        "<i>“o que acontece se este processo rodar mil vezes?”</i>, e é dela que vem o número que "
        "o aluno usa para decidir.", P),
    Paragraph(
        "O que faltava era o outro lado da mesma pergunta: <b>alguém para explicar o diagrama e "
        "ajudar a construí-lo</b>. Simular um processo mal modelado dá um número preciso sobre "
        "um modelo errado. A pergunta deste trabalho é se um assistente conversacional, dentro "
        "da própria ferramenta, consegue ocupar esse lugar — ensinando a notação enquanto "
        "desenha com o aluno, em vez de depois dele.", P),

    Paragraph("O que foi acrescentado", H2),
    tabela([
        ["Capacidade", "O que o aluno faz", "Como isso é possível"],
        ["<b>Conversa por voz e por escrito</b>",
         "fala ou digita, e troca de um para o outro no meio da aula",
         "sessão de voz em tempo real com o provedor; a conversa continua quando a conexão cai e "
         "volta, e a aula não recomeça do zero"],
        ["<b>O agente enxerga a tela</b>",
         "clica num elemento e pergunta “e esse aqui?”",
         "o diagrama aberto é projetado em texto a cada turno, com teto de tamanho — e o que o "
         "aluno acabou de selecionar viaja junto com a pergunta"],
        ["<b>O agente desenha</b>",
         "“põe uma tarefa entre o início e a próxima”, “cria uma raia para o entregador”",
         "ferramentas de escrita sobre o próprio bpmn-js: criar, ligar, renomear, inserir no "
         "meio do fluxo, mover, alinhar, trocar o tipo, criar pool e raia — tudo desfazível com "
         "Ctrl+Z, porque passa pela pilha de comandos do modelador"],
        ["<b>Pergunta antes de apagar</b>",
         "pede para remover algo e precisa confirmar",
         "um portão de <b>ordem</b>: a remoção fica recusada até o aluno responder depois do "
         "pedido. Não é palavra-chave — é quem falou por último"],
        ["<b>Ensina com fonte</b>",
         "pergunta sobre a notação e recebe a resposta com a referência",
         "um acervo autoral de BPMN servido com o site; o modelo <b>escolhe</b> consultá-lo, e o "
         "aplicativo <b>confere a citação</b> antes de ela aparecer na tela"],
        ["<b>Orienta quem chega</b>",
         "entra pela primeira vez e sabe o que pedir, sem ler manual",
         "uma barra encostada no botão do tutor diz o que dá para fazer naquela trilha e "
         "oferece <b>uma</b> sugestão clicável — que acompanha o elemento selecionado no desenho"],
        ["<b>Diz o que não sabe</b>",
         "pergunta algo fora do acervo",
         "a resposta declara o tamanho do próprio acervo em vez de afirmar o que a norma inteira "
         "diz, e separa o que é material do trabalho do conhecimento geral do modelo"],
    ], [3.6 * cm, 5.2 * cm, 7.6 * cm]),

    Paragraph("Como foi construído — e por que isso importa para o texto", H2),
    Paragraph(
        "Cada mudança nasceu como uma proposta escrita (por que existe, que decisão de desenho "
        "ela toma, o que precisa ser verdade para ela estar pronta) e só foi dada por encerrada "
        "quando havia <b>um comando que a reproduz</b>. O resultado é que o trabalho não tem "
        "afirmações sem lastro:", P),
    tabela([
        ["Camada de prova", "Tamanho", "O que ela garante"],
        ["Testes determinísticos", "<b>32 suítes · 685 asserções</b>",
         "o núcleo — prompt, despacho, ferramentas, memória, proteções, protocolo, áudio. Roda "
         "sem rede, sem credencial e em segundos"],
        ["Portões no navegador", "<b>51 cenários</b><br/>34 sem credencial · 17 ao vivo",
         "o sistema real: o bpmn-js de verdade desenhando, e o modelo de verdade respondendo"],
        ["Conjunto de perguntas", "<b>35 perguntas · 13 categorias</b>",
         "taxa de acerto por categoria, que é o que vira tabela no texto"],
        ["Instrumentos de medição", "<b>33 ferramentas</b>",
         "latência por turno, custo em tokens, limite de sessões, tamanho do contexto, qualidade "
         "do microfone, corte de rede. Cada número citado tem o comando que o produziu"],
    ], [3.6 * cm, 4.0 * cm, 8.8 * cm]),
    Paragraph(
        "Três vezes um desses portões <b>reprovou o sistema e estava certo</b> — e duas vezes um "
        "portão passou <b>sem provar nada</b> e teve de ser reescrito (media uma diferença que o "
        "exemplo já tinha por acaso). E uma vez a medição contradisse a <b>anotação de quem "
        "escreveu o sistema</b>: estava registrado que uma operação custava dois "
        "<font face='Courier'>Ctrl+Z</font>, e o portão mediu <b>sete</b>. Esses episódios, "
        "registrados, são o que o trabalho tem a dizer sobre método: a diferença entre um teste "
        "que protege, um teste que apenas tranquiliza, e uma anotação que ninguém mediu.", P),

    Paragraph("Uma decisão de interface tomada por pesquisa, não por gosto", H2),
    Paragraph(
        "A orientação de quem chega pela primeira vez é um exemplo pequeno do método. A tentação "
        "era abrir o painel de conversa junto com o diagrama de exemplo e piscar o botão até a "
        "pessoa clicar. A literatura de usabilidade diz o contrário: <b>orientação sobreposta faz "
        "o produto parecer mais complexo do que é</b>, e quem chega para desenhar um diagrama não "
        "quer uma janela de conversa por cima dele. Também diz que a <b>caixa em branco</b> esconde "
        "o que um assistente sabe fazer — e que o remédio são <b>poucas sugestões, clicáveis e "
        "editáveis</b>, de preferência ligadas ao que está na tela, que funcionam melhor que as "
        "genéricas.", P),
    Paragraph(
        "O desenho saiu daí: uma barra discreta encostada no botão, com <b>uma</b> sugestão por "
        "vez, que muda conforme o elemento selecionado. As duas ideias recusadas ficaram "
        "<b>registradas com o motivo</b>, e não apagadas — escritas no documento de desenho "
        "justamente para que possam ser <b>revertidas com o contra-argumento na mão</b>. É a "
        "diferença entre recusar por teimosia e recusar com prova: a decisão final continua de "
        "quem orienta o trabalho, e ela volta a estar disponível a qualquer momento.", P),

    Paragraph("O que dá para demonstrar ao vivo, em poucos minutos", H2),
    bullets([
        "<b>Abrir pela primeira vez</b> — a tela pergunta o que a pessoa quer fazer, e a barra que "
        "aparece depois já sugere a primeira pergunta; clicando num elemento do desenho, a "
        "sugestão passa a ser sobre ele.",
        "<b>“O que é um gateway exclusivo?”</b> — a resposta vem com a referência do acervo; "
        "perguntando algo fora dele, o agente diz que não está no material e separa o que é "
        "conhecimento geral.",
        "<b>“Põe uma tarefa X entre o início e a próxima.”</b> — o elemento entra no meio do "
        "fluxo, as setas são refeitas e nada fica sobreposto.",
        "<b>Clicar num elemento e perguntar “e esse aqui?”</b> — a resposta é sobre o elemento "
        "selecionado, porque a seleção viaja junto com a pergunta.",
        "<b>“Apaga essa tarefa.”</b> — o agente pergunta antes, e só remove depois da resposta.",
        "<b>Ficar em silêncio dois minutos e voltar a perguntar</b> — a conversa continua de onde "
        "parou, mesmo tendo o servidor encerrado a sessão nesse intervalo.",
    ]),

    Paragraph("Os limites, ditos antes de alguém perguntar", H2),
    bullets([
        "<b>Cada pessoa usa a própria credencial</b> do provedor de IA, que fica só na aba e "
        "morre com ela. Não há servidor nosso, banco nem conta: o sistema inteiro é um site "
        "estático, e isso é o que torna o trabalho reproduzível por quem for avaliá-lo.",
        "<b>A memória dura uma aula.</b> Fechou a aba, acabou — por escolha registrada, não por "
        "limitação descoberta tarde.",
        "<b>No modo voz, a conferência da citação não existe</b>: o áudio vai do provedor ao "
        "alto-falante sem passar pelo aplicativo. A tela diz isso no momento da consulta, em vez "
        "de prometer igual nos dois modos.",
        "<b>A dimensão pedagógica está em elaboração com o orientador</b> — quando propor e "
        "quando calar, como explicar a escolha de representação, quanto corrigir de uma vez. A "
        "mecânica que a sustenta já existe e está provada: o agente propõe, a ferramenta recusa "
        "até o aluno responder, e a tela é lida de volta a cada alteração.",
    ]),
]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                        topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                        title="Tutor BPMN — um agente de ensino dentro do modelador",
                        author="Tutor BPMN (TCC)")
doc.build(story)
print(f"PDF: {OUT}")
