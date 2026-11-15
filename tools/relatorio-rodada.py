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
    Paragraph("Ajudante BPMN — rodada autônoma da noite", H1),
    Paragraph("15 de novembro de 2026 · a aula deixou de cair junto com a conexão, e três "
              "defeitos apareceram porque passaram a existir portões que os medem", SUB),

    Paragraph("O que mudou de mais importante", H2),
    Paragraph(
        "A dívida dizia, desde o dia 13: <i>“a sessão tem recuo com teto e código de fechamento "
        "nomeado, mas nunca foi exercitada cortando a rede de verdade”</i>. Cortar a rede de "
        "verdade <b>desmentiu a própria dívida</b> — e revelou que a queda que acontece na sua "
        "aula é outra, vem do servidor, e era a <b>nossa reconexão</b> que a transformava em "
        "“o limite de sessões da sua chave foi atingido”. Isso está consertado, provado ao vivo "
        "duas vezes, e é o fim do sintoma que você levou nove vezes na sua última trilha.", P),

    Paragraph("A medição que contrariou o plano", H2),
    tabela([
        ["O que se mediu", "O que aconteceu", "O que isso significa"],
        ["Rede desligada por fora<br/>(12 s, sessão aberta)",
         "<font color='%s'><b>nenhum fechamento</b></font>: o navegador diz offline na hora, e o "
         "WebSocket sobrevive" % AMBAR,
         "cortar a rede e ver a conversa seguir não prova recuperação — prova que nada caiu"],
        ["Rede desligada por 50 s,<br/>com pergunta no ar",
         "o modelo <b>respondeu normalmente</b>",
         "a emulação do navegador não alcança conexão já estabelecida; a prova tinha de mudar de "
         "forma"],
        ["Aluno calado, lendo a resposta",
         "<font color='%s'><b>o servidor fecha</b></font>: “client inactivity”, aos 74 s e aos "
         "119 s" % AMBAR,
         "é esta a queda real da aula — e a que terminava em erro de cota com a chave boa"],
        ["Depois do conserto",
         "<font color='%s'><b>dorme, acorda e continua</b></font>" % VERDE,
         "a sessão dorme sem ocupar vaga, a sua pergunta a reabre, e o modelo lembra da aula"],
    ], [3.9 * cm, 5.3 * cm, 7.2 * cm]),

    Paragraph("A prova ao vivo, na íntegra", H2),
    Paragraph("Uma sessão só. Primeiro uma pergunta de aula; depois dois minutos de silêncio, "
              "como quem está lendo; o servidor fecha; e então:", P),
    Paragraph("“Repita, com as mesmas palavras, qual foi a MINHA primeira pergunta nesta "
              "conversa.” → <b>“A sua primeira pergunta foi: ‘Em uma frase: o que é um gateway "
              "exclusivo?’”</b>", CITA),
    Paragraph(
        "O que torna isso uma prova e não uma coincidência: no despertar o aplicativo <b>não "
        "reenvia nada</b> — nem o histórico, nem o diagrama. Essa frase voltou de dentro da "
        "sessão do servidor, pela alça de retomada, e o diário registra o segundo setup como "
        "<font face='Courier'>modo=texto retomando</font>, com <b>zero</b> disputa por vaga e "
        "<b>nenhum</b> aviso de “a conexão caiu” na tela. Despertar não é queda, e aviso que "
        "mente é aviso que o aluno aprende a ignorar.", P),

    Paragraph("Os três defeitos que os portões novos acharam", H2),
    Paragraph("Nenhum dos três aparecia em teste. Os três apareceram no primeiro minuto em que "
              "passou a existir alguém medindo:", P),
    bullets([
        "<b>Duas setas onde você vê uma.</b> Mover uma tarefa para o meio do fluxo deixava "
        "<b>duas</b> ligações entre os mesmos dois elementos — desenhadas uma sobre a outra, "
        "invisíveis na tela e reais no arquivo (as ligações do desenho iam de 24 para 26). A "
        "causa é do próprio bpmn-js: ele já religa quando uma forma é solta sobre a seta, e o "
        "nosso religamento era o segundo. Agora liga-se <b>só o que falta</b>.",
        "<b>Bloquear o microfone matava o modo texto.</b> Clicar em “Bloquear” no aviso do "
        "navegador marcava a <b>sessão</b> como erro — e erro desliga a caixa de texto. Quem "
        "negava o microfone perdia o ajudante inteiro, inclusive a parte que não tem nada a ver "
        "com microfone. Agora o que falha é a entrada de voz; a conversa escrita continua.",
        "<b>Um portão que passava sem provar nada.</b> O alinhamento dos quatro elementos dava "
        "verde porque, no diagrama base, os quatro já nascem na mesma altura. Ele passou a "
        "<b>desalinhar primeiro</b>: agora vai de 240 px de desvio para zero, e mede também o "
        "que você fotografou — <b>nenhuma seta atravessando caixa nenhuma</b>.",
    ]),

    Paragraph("Os seus dois pedidos, agora com portão", H2),
    Paragraph(
        "<b>“Tentei adicionar 4, ele pede 2”</b> e <b>“esse mover elemento que já existe para o "
        "meio do fluxo”</b> estavam consertados e sem prova automática. Agora os dois rodam numa "
        "sessão só, com o modelo escolhendo os verbos a partir do português: ele alinhou os "
        "quatro sem pedir dois, e moveu a tarefa existente para o meio <b>sem criar gêmeo</b> "
        "(24 elementos antes, 24 depois) e sem sobrepor ninguém.", P),

    Paragraph("O que ficou em aberto", H2),
    bullets([
        "<b>Queda de rede física</b> (o seu cabo, o seu Wi-Fi) — nenhuma ferramenta do navegador "
        "a produz. Forçá-la exigiria pôr um servidor nosso no meio do caminho da sessão: costura "
        "de teste dentro do produto, que não se paga. Fica declarado, e não escondido.",
        "<b>A tela base</b> — está na outra conversa, com worktree e branch próprios. Avisei lá "
        "que o estado novo <font face='Courier'>dormindo</font> é estado <b>vivo</b>, para a tela "
        "não desenhá-lo como erro.",
        "<b>A publicação definitiva</b> (D1–D5: domínio, DNS, secrets, rollback) — sua, e você "
        "estacionou de propósito. O endereço provisório voltou a publicar.",
        "<b>Expiração de sessão por idade (<font face='Courier'>go-away</font>, ~10 min)</b> — "
        "nunca vista ao vivo, e agora menos provável de aparecer: a sessão parada dorme antes de "
        "chegar lá. Exige uma aula de verdade, falando.",
    ]),

    Paragraph("O site estava fora do ar desde o acervo — e isso está consertado", H2),
    Paragraph(
        "Descoberto no fim da rodada, pela outra conversa: quando o <font face='Courier'>build</font> "
        "ganhou o passo do acervo, a imagem do servidor parou de ser construída (ela não copiava "
        "nem o script nem a pasta <font face='Courier'>knowledge/</font>), o teste de integração "
        "morria em 15 segundos e a publicação, que depende dele, <b>nunca rodava</b>. Três entregas "
        "seguidas ficaram vermelhas e o que estava no ar era o site das 21:49 — <b>sem o acervo e "
        "sem nada do que foi feito hoje</b>. Consertado, e as quatro entregas seguintes estão "
        "verdes: o endereço provisório já serve tudo.", P),
    Paragraph(
        "Com o site publicado, a última medição que faltava no acervo deixou de ser palpite: o "
        "índice pesa <b>6,8 KB na rede</b> (comprimido, de 21,9 KB no disco) e chega em <b>12 ms</b> "
        "no caminho real do aluno — quando ele pergunta, o navegador já abriu o site, então TCP e "
        "TLS estão pagos. Abrindo conexão nova, 49 ms. Em qualquer dos dois, a resposta do modelo "
        "leva <b>segundos</b>: a consulta ao acervo não é o que ele espera.", P),

    Spacer(1, 4),
    Paragraph("Como ver funcionando, sem esforço nenhum", H2),
    Paragraph(
        "Abra o ajudante, faça uma pergunta e <b>deixe a tela parada uns dois minutos</b>, como "
        "se estivesse lendo. O rótulo vai para <b>“em espera”</b> e <b>nada acontece</b> — "
        "nenhum aviso vermelho, nenhuma sessão nova. Então pergunte qualquer coisa sobre o que "
        "vocês já estavam falando: ele responde <b>na mesma conversa</b>. Antes, esse mesmo "
        "silêncio terminava em “o limite de sessões da sua chave foi atingido”.", P),
]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                        topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                        title="Ajudante BPMN — rodada autônoma", author="Ajudante BPMN (TCC)")
doc.build(story)
print(f"PDF: {OUT}")
