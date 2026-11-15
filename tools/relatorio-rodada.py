"""Relatório executivo da rodada autônoma — gera artifacts/relatorio-rodada.pdf (2 páginas).

Mesmo formato dos relatórios do MAIA Payments, que o dono preferiu: ReportLab, A4, Helvetica
(Latin-1 cobre o português), seções curtas, tabelas pequenas e nenhuma captura de tela — é um
documento para LER, não para navegar.

Uso: python tools/relatorio-rodada.py
"""
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle)

OUT = Path(__file__).resolve().parent.parent / "artifacts" / "relatorio-rodada.pdf"
AZUL = "#0A7EA4"
AMBAR = "#A4601A"
VERDE = "#1F7A48"

base = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=17,
                    leading=21, alignment=TA_LEFT, spaceAfter=2)
SUB = ParagraphStyle("SUB", parent=base["Normal"], fontName="Helvetica", fontSize=9.5,
                     leading=13, textColor="#555555", spaceAfter=12)
H2 = ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12,
                    leading=15, textColor=AZUL, spaceBefore=11, spaceAfter=5)
P = ParagraphStyle("P", parent=base["Normal"], fontName="Helvetica", fontSize=9.6, leading=13.4,
                   spaceAfter=5)
CITA = ParagraphStyle("CITA", parent=P, leftIndent=10, textColor="#333333",
                      borderPadding=0, spaceBefore=3, spaceAfter=6, fontName="Helvetica-Oblique")
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
    Paragraph("Ajudante BPMN — rodada autônoma", H1),
    Paragraph("15 de novembro de 2026 · o que foi feito enquanto você esteve fora, e o que ficou "
              "em aberto", SUB),

    Paragraph("O que mudou de mais importante", H2),
    Paragraph(
        "O ajudante deixou de saber BPMN só pela memória do modelo. Agora existe um <b>acervo "
        "citável</b> dentro do site: doze verbetes autorais sobre a notação, cada trecho com "
        "localizador e chave de citação, que ele consulta por conta própria e cita na resposta — e "
        "o aplicativo <b>confere</b> a citação antes de ela aparecer. Era a change que estava "
        "inteira em aberto no board, e é também a peça que você pediu para a tela base: um tutor "
        "que explica com fonte, e não de cabeça.", P),

    Paragraph("A prova ao vivo, contra o Gemini de verdade", H2),
    Paragraph("Duas perguntas, numa sessão só, e as duas respostas na íntegra:", P),
    Paragraph("“o que é um gateway exclusivo, na notação?” → <b>Pelo meu material</b>, o gateway "
              "exclusivo, representado por um losango vazio ou com um “X”, escolhe apenas um "
              "caminho para o fluxo seguir, avaliando as condições das setas de saída "
              "<b>[fonte:gateways:exclusivo]</b>.", CITA),
    Paragraph("“o que a norma BPMN diz sobre contratos em blockchain?” → <b>Isso não está no meu "
              "acervo de 12 verbetes.</b> De forma geral, a notação BPMN foca em modelar processos "
              "de negócio, então a execução de contratos em blockchain é considerada uma "
              "implementação tecnológica fora do escopo da notação.", CITA),
    Paragraph(
        "A segunda é a que mais importa para o trabalho: ele <b>declarou o tamanho do próprio "
        "acervo</b> em vez de afirmar o que a norma inteira diz, e separou o que é material nosso "
        "do que é conhecimento geral dele. É a diferença entre o que você pode conferir e o que "
        "você tem de acreditar.", P),

    Paragraph("Os números do acervo", H2),
    tabela([
        ["O quê", "Medida", "O que significa"],
        ["Tamanho", "12 verbetes · 28 trechos · 18,2 KB",
         "dentro da estimativa da pesquisa, sem precisar dividir o índice por grupo"],
        ["Recuperação", "10 de 10 perguntas",
         "9/10 na primeira versão da busca; a que falhava confundia “tempo” com “temporizador”"],
        ["Carregamento", "sob demanda",
         "quem nunca pergunta sobre a notação não baixa nada"],
        ["Latência na rede pública", "em aberto",
         "o site ainda não foi publicado; medir no localhost seria inventar o número"],
    ], [3.4 * cm, 4.6 * cm, 8.4 * cm]),

    Paragraph("O que impede o acervo de virar promessa", H2),
    bullets([
        "<b>O build é o validador.</b> Trecho literal sem nota de direitos, chave de citação "
        "duplicada e a marca de fronteira do prompt numa página <b>reprovam a construção</b> — e o "
        "validador roda no <font face='Courier'>npm test</font>. Aviso em documento não impede "
        "ninguém de colar três páginas da norma num verbete; o validador impede.",
        "<b>A citação é conferida pelo código.</b> Marca que nenhuma consulta serviu vira “fonte "
        "não conferida” antes de a resposta aparecer, e o texto do modelo continua inteiro.",
        "<b>No modo voz isso não existe</b>, e a tela diz isso na hora da consulta: o áudio vai do "
        "provedor ao alto-falante sem passar por nós. Prometer igual nos dois modos seria mentira.",
    ]),

    Paragraph("Os consertos da sua lista", H2),
    bullets([
        "<b>O gêmeo.</b> Pedir duas vezes a mesma tarefa no mesmo lugar agora é recusado com o id "
        "do que já existe. E nasceu o verbo que faltava: <font face='Courier'>mover … entre</font> "
        "leva um elemento que <b>já existe</b> para o meio do fluxo, fechando o buraco que ele "
        "deixa — era a falta disso que fazia o modelo criar outro.",
        "<b>A sua pausa.</b> O detector de fala do servidor fechava o turno no silêncio curto e "
        "partia sua frase em dois. Agora tolera 1,2 s — e o servidor aceitou o ajuste (se o campo "
        "fosse inválido, a voz inteira morreria).",
        "<b>O fio da conversa.</b> “Pode continuar” retoma o último assunto, não um de dois turnos "
        "atrás. Conserto de prosa no prompt: nada no código detecta palavra.",
        "<b>Mais um caso no portão do desenho:</b> um gateway entrando no meio do fluxo, com "
        "sobreposição zero, como uma tarefa entraria.",
    ]),

    Paragraph("O que ficou em aberto", H2),
    bullets([
        "<b>A tela base</b> — está na outra conversa. Ela já recebeu o retorno do estudo e começou "
        "a implementar; eu avisei que estamos no mesmo checkout e dividi os arquivos.",
        "<b>Latência do acervo na rede pública</b> — depende da publicação do site (itens D1–D4).",
        "<b>Voltar a falar no meio da resposta</b> depois do “só texto”: o áudio daquele trecho foi "
        "descartado e o protocolo não reenvia. Só a próxima resposta sai falada.",
    ]),

    Spacer(1, 4),
    Paragraph("Como ver funcionando, em três perguntas", H2),
    Paragraph(
        "Na janela que já está aberta: <b>“o que é um gateway exclusivo?”</b> (ele consulta e cita), "
        "<b>“o que a norma diz sobre blockchain?”</b> (ele diz que não está no acervo de 12 "
        "verbetes) e <b>“põe uma tarefa Conferir estoque entre o início e o Select a pizza”</b> "
        "usando uma tarefa que já exista — para ver o verbo novo movendo em vez de criar outra.", P),
]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                        topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                        title="Ajudante BPMN — rodada autônoma", author="Ajudante BPMN (TCC)")
doc.build(story)
print(f"PDF: {OUT}")
