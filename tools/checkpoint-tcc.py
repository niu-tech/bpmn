"""Checkpoint do TCC — gera artifacts/checkpoint-tcc.pdf (4 páginas), para o dono AVALIAR.

Diferente do `relatorio-rodada.py`, que conta UMA rodada: este é o retrato do projeto inteiro —
o que o produto faz hoje, o que está construído e provado, o que ficou pendente (de quem é cada
pendência) e o que vem a seguir, em ordem de recomendação.

Mesmo formato dos relatórios do MAIA Payments, que o dono preferiu: ReportLab, A4, Helvetica,
seções curtas, tabelas pequenas, nenhuma captura de tela. É documento para LER e decidir.

Uso: python tools/checkpoint-tcc.py
"""
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

OUT = Path(__file__).resolve().parent.parent / "artifacts" / "checkpoint-tcc.pdf"
# Contado na hora, para o número nunca envelhecer no documento.
TOOLS = Path(__file__).resolve().parent
FERRAMENTAS = len([f for f in TOOLS.iterdir() if f.suffix in {".mjs", ".py", ".ps1"}])
AZUL = "#0A7EA4"
AMBAR = "#A4601A"
VERDE = "#1F7A48"
CINZA = "#555555"

base = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=17,
                    leading=21, alignment=TA_LEFT, spaceAfter=2)
SUB = ParagraphStyle("SUB", parent=base["Normal"], fontName="Helvetica", fontSize=9.5,
                     leading=13, textColor=CINZA, spaceAfter=12)
H2 = ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12,
                    leading=15, textColor=AZUL, spaceBefore=11, spaceAfter=5)
P = ParagraphStyle("P", parent=base["Normal"], fontName="Helvetica", fontSize=9.6, leading=13.4,
                   spaceAfter=5)
CITA = ParagraphStyle("CITA", parent=P, leftIndent=10, textColor="#333333",
                      spaceBefore=3, spaceAfter=6, fontName="Helvetica-Oblique")
LI = ParagraphStyle("LI", parent=P, spaceAfter=3)
CEL = ParagraphStyle("CEL", parent=base["Normal"], fontName="Helvetica", fontSize=8.7, leading=11)
CELB = ParagraphStyle("CELB", parent=CEL, fontName="Helvetica-Bold")
NOTA = ParagraphStyle("NOTA", parent=P, fontSize=8.8, leading=11.6, textColor=CINZA)


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
    Paragraph("Ajudante BPMN — checkpoint para avaliação", H1),
    Paragraph("15 de novembro de 2026 · o que o produto faz hoje, o que está provado, o que "
              "ficou pendente e o que vem a seguir", SUB),

    # ---------------------------------------------------------------- 1. o produto hoje
    Paragraph("1. O que o produto faz hoje", H2),
    Paragraph(
        "O aluno abre o site, informa <b>a própria chave</b> do Google AI Studio e conversa — "
        "falando ou escrevendo — com um ajudante que está <b>dentro</b> do modelador BPMN. Esse "
        "ajudante lê o diagrama aberto, responde sobre os elementos que o aluno clica, "
        "<b>escreve</b> no desenho (cria, liga, renomeia, insere no meio do fluxo, move, alinha, "
        "cria pool e raia), <b>pergunta antes</b> de apagar, consulta um acervo autoral de BPMN e "
        "<b>cita a fonte</b> — e o aplicativo confere a citação antes de ela aparecer na tela.", P),
    Paragraph(
        "Nada disso depende de servidor nosso: a chave é do aluno, a conversa morre com a aba, e "
        "o site é um arquivo estático. É o que torna o trabalho reproduzível por quem for "
        "avaliá-lo — e é também o que limita a memória a uma aula, por escolha registrada.", P),

    # ---------------------------------------------------------------- 2. o que esta construido
    Paragraph("2. O que está construído, fase por fase", H2),
    tabela([
        ["Fase", "O que entrega", "Estado"],
        ["F1 · Despacho honesto", "o agente responde o que sabe e diz quando não sabe",
         "<font color='%s'><b>fechada</b></font>" % VERDE],
        ["F2 · Contrato de prompt", "seções tipadas, teto de tamanho, âncora de idioma",
         "<font color='%s'><b>fechada</b></font> 12/11" % VERDE],
        ["F3 · Enxerga a tela", "o diagrama aberto chega ao modelo a cada turno",
         "<font color='%s'><b>fechada</b></font> 13/11" % VERDE],
        ["F4 · Memória da aba", "continuidade entre turnos e entre modos",
         "<font color='%s'><b>fechada</b></font> 13/11" % VERDE],
        ["F5 · Guardrails", "injeção pelo nome do elemento, recusa nomeada, amostra",
         "<font color='%s'><b>fechada</b></font> 13/11" % VERDE],
        ["F6 · Ferramentas de leitura", "descrever, buscar, detalhar, resumir simulação",
         "<font color='%s'><b>fechada</b></font> 13/11" % VERDE],
        ["F7 · Ferramentas de escrita", "criar, ligar, renomear, remover com confirmação, pool e raia",
         "<font color='%s'><b>fechada</b></font> 14/11" % VERDE],
        ["FK · Conhecimento citável", "acervo OKF autoral, <font face='Courier'>consultar_norma</font>, chave de citação conferida",
         "<font color='%s'><b>fechada</b></font> 15/11" % VERDE],
        ["F8 · Tutor", "propõe antes de aplicar, explica a escolha, monta em passos",
         "<font color='%s'><b>metade</b></font>: a mecânica fechou, a pedagogia não" % AMBAR],
        ["Trilha H · cápsula de voz", "dono do turno, canais, barge-in por nível, estado tipado",
         "<font color='%s'><b>colhida</b></font>, menos dois enfeites" % VERDE],
        ["Tela base", "primeira tela em português, dois passos para a chave, sempre há volta",
         "<font color='%s'><b>no ar</b></font> 15/11" % VERDE],
    ], [4.0 * cm, 7.6 * cm, 4.4 * cm]),

    # ---------------------------------------------------------------- 3. as provas
    Paragraph("3. As provas que existem — e é isto que sustenta a dissertação", H2),
    tabela([
        ["Camada", "Tamanho", "O que ela garante"],
        ["<font face='Courier'>npm test</font> (determinística)",
         "<b>25 suítes · 560 asserções</b>",
         "o núcleo: prompt, despacho, ferramentas, memória, guardrails, protocolo, áudio. Roda "
         "sem rede, sem chave e sem cota"],
        ["Portões no navegador",
         "<b>42 cenários</b><br/>25 sem cota · 17 ao vivo",
         "o produto contra o bpmn-js de verdade, e contra o Gemini de verdade. É onde os defeitos "
         "de desenho e de sessão aparecem"],
        ["Conjunto dourado",
         "<b>35 perguntas · 13 categorias</b>",
         "taxa por categoria e linha de base — de onde saem as tabelas do texto"],
        ["Instrumentos de medição",
         f"<b>{FERRAMENTAS} ferramentas</b> em <font face='Courier'>tools/</font>",
         "cota, contexto, acervo, microfone, voz, barge-in, rede offline, trilha da aula, vídeo "
         "de prova. Cada número do texto tem o comando que o produziu"],
    ], [3.9 * cm, 3.8 * cm, 8.3 * cm]),
    Paragraph(
        "⚠ O que isso <b>não</b> é: cobertura de linha. É cobertura de <b>afirmação</b> — cada "
        "coisa que o texto vai dizer tem um comando que a reproduz. Três vezes nesta semana um "
        "portão reprovou o produto e estava certo; duas vezes passou sem provar nada e foi "
        "reescrito. Essa é a parte do método que vale contar na banca.", NOTA),

    # ---------------------------------------------------------------- 4. a rodada de hoje
    Paragraph("4. O que esta rodada acrescentou (15 de novembro)", H2),
    Paragraph(
        "Foram <b>74 entregas</b> no dia, em duas frentes paralelas. O detalhe está no "
        "<i>Relatório da rodada autônoma</i>; aqui vai o que mudou de estado:", P),
    bullets([
        "<b>A aula deixou de cair junto com a conexão.</b> O servidor fecha a sessão de quem está "
        "lendo (medido: 74 s e 119 s de silêncio). Agora ela <b>dorme</b> — zero conexão, nada "
        "ocupado — e a sua próxima pergunta a reabre <b>na mesma conversa</b>. Era isso que "
        "terminava em “o limite de sessões da sua chave foi atingido” com a chave boa.",
        "<b>O acervo citável entrou inteiro</b> (fase FK): 12 verbetes autorais, 28 trechos, "
        "citação conferida pelo aplicativo, e a resposta honesta quando a pergunta está fora dele "
        "— “não está no meu acervo de 12 verbetes”, e não “a norma não trata disso”.",
        "<b>O site voltou a ser publicado.</b> Estava fora do ar desde o acervo: a imagem do "
        "servidor não copiava o passo novo do build, o teste de integração morria em 15 s e a "
        "publicação, que depende dele, nunca rodava. Três entregas ficaram vermelhas sem ninguém "
        "notar.",
        "<b>Quatro defeitos que só apareceram porque passou a existir quem mede:</b> duas setas "
        "onde se vê uma, bloquear o microfone matando o modo texto, o gêmeo ao inserir no meio do "
        "fluxo, e um portão que dava verde sem provar nada.",
        "<b>A primeira tela</b> ficou em português, com dois passos para a chave e sempre um "
        "caminho de volta — e o exemplo da pizzaria foi traduzido.",
    ]),

    # ---------------------------------------------------------------- 5. pendencias
    Paragraph("5. O que ficou pendente — e de quem é", H2),
    tabela([
        ["Pendência", "Por que não bloqueia", "De quem é"],
        ["<b>A pedagogia do tutor</b> (F8b): quando propor e quando calar, como explicar a escolha "
         "de representação, quanto corrigir de uma vez",
         "a mecânica está pronta: o agente já propõe, a ferramenta recusa até o aluno responder, e "
         "a tela é lida de volta a cada escrita",
         "<b>decisão sua</b>, com diagrama de aula na frente"],
        ["<b>A sua voz</b> em microfone físico (M1)",
         "a voz é provada com fala sintética entrando pelo caminho real do microfone — mede o "
         "produto, não a pessoa",
         "<b>20 minutos seus</b>; o roteiro já está escrito"],
        ["<b>Duas declarações no texto</b>: a licença do <font face='Courier'>bpmn-js</font> (a "
         "marca d'água não pode ser removida) e o reúso de trabalho anterior seu",
         "não afeta o software; afeta a banca, e a correção é uma frase",
         "<b>sua</b>, com o orientador"],
        ["<b>Publicação definitiva</b> (domínio, DNS, secrets, rollback)",
         "o endereço provisório publica a cada entrega e serve tudo",
         "<b>estacionada por você</b>: “não precisamos agora”"],
        ["<b>Memória entre visitas</b>",
         "a memória morre com a aba, por escolha — e o aviso de privacidade diz isso",
         "<b>estacionada por você</b>"],
        ["<b>Três provas que exigem o mundo</b>: queda de rede física, expiração de sessão por "
         "idade, e a citação inventada ao vivo",
         "as três têm prova equivalente onde a decisão é nossa; forçá-las exigiria costura de "
         "teste dentro do produto",
         "<b>declaradas</b>, não escondidas"],
        ["<b>Sobras de acabamento</b>: escala de espaçamento, prints lado a lado, dois enfeites da "
         "cápsula (cartões clicáveis, selo “ouvindo” no texto)",
         "nada disso muda o que o produto faz",
         "minhas, quando você quiser"],
    ], [5.2 * cm, 6.4 * cm, 4.4 * cm]),

    PageBreak(),

    # ---------------------------------------------------------------- 6. proximos passos
    Paragraph("6. Próximos passos, em ordem de recomendação", H2),
    Paragraph(
        "<b>1. Fechar a fase F8 — o tutor.</b> É o último portão do roadmap e é o que separa “um "
        "agente que executa” de “um tutor que ensina”. A mecânica já existe; o que falta é "
        "conteúdo: as seções de ensino no prompt (explicar ancorado no diagrama aberto, "
        "recomendar quando há escolha, resposta curta por padrão e mais curta na voz) e o portão "
        "ao vivo: <b>descrever um processo em três frases produz uma proposta nomeada; ao "
        "aceitar, o diagrama ganha início, tarefas e fim ligados; e o agente não mexe no que não "
        "foi pedido</b>. Eu consigo escrever e provar a mecânica inteira; as escolhas "
        "pedagógicas precisam de você uma vez, por uns 15 minutos, com um diagrama de aula na "
        "frente.", P),
    Paragraph(
        "<b>2. A sua voz, uma vez.</b> Toda a camada de voz está provada com fala sintética. Uma "
        "sessão sua de verdade — com pausa, hesitação e sotaque — é a única coisa que pode "
        "derrubar suposições que eu não sei que estou fazendo. O roteiro curto já está pronto; "
        "são 20 minutos e eu leio a trilha depois.", P),
    Paragraph(
        "<b>3. As duas frases do texto.</b> A licença do <font face='Courier'>bpmn-js</font> e o "
        "reúso de trabalho anterior seu. São de banca, custam uma frase cada, e é o tipo de coisa "
        "que só dá problema se chegar lá sem estar escrita.", P),
    Paragraph(
        "<b>4. Higiene do quadro.</b> Seis das onze <i>changes</i> estão com todas as caixas "
        "fechadas e podem ser arquivadas; cinco têm caixas abertas, e três dessas caixas são o "
        "F8. Arquivar é meia hora e deixa o quadro dizendo a verdade sobre o que falta.", P),
    Paragraph(
        "<b>5. O acabamento.</b> As sobras de UI e os dois enfeites da cápsula, quando não "
        "houver nada melhor para fazer.", P),

    Spacer(1, 6),
    Paragraph("O que eu recomendo para a próxima sessão", H2),
    Paragraph(
        "Começar pelo <b>F8</b>, e começar pela parte que não depende de você: escrever as seções "
        "de ensino no prompt e montar o portão ao vivo da proposta nomeada. Quando ele estiver de "
        "pé, aí vale os seus 15 minutos de pedagogia — porque nessa hora a pergunta deixa de ser "
        "abstrata (“quando o tutor deve propor?”) e passa a ser concreta: você vê a proposta na "
        "tela, com o diagrama ao lado, e diz o que está errado nela.", P),
    Paragraph(
        "O produto está num estado em que dá para mostrar para outra pessoa sem pedir desculpa: "
        "ele ensina, desenha, cita a fonte, pergunta antes de apagar e não cai no meio da aula. "
        "O que falta é o que sempre faltou — a parte que é <b>sua</b> opinião sobre como se "
        "ensina.", P),
]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                        topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                        title="Ajudante BPMN — checkpoint para avaliação",
                        author="Ajudante BPMN (TCC)")
doc.build(story)
print(f"PDF: {OUT}")
