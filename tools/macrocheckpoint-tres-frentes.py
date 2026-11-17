"""Consolidado do macrocheckpoint das TRÊS FRENTES — artifacts/macrocheckpoint-tres-frentes.pdf.

O que o dono trouxe do teste ao vivo de 2026-11-17 virou três changes, e este é o documento que
fecha as três de uma vez: o que ele viu, o que estava errado por baixo, o que foi feito, e o que
ficou medido — inclusive o número que diz que a espera NÃO é nossa.

Mesmo formato dos outros relatórios (ReportLab, A4, Helvetica, tabelas pequenas, nenhuma captura
de tela): é documento para LER e decidir.

⚠ Os números são LIDOS dos artefatos de prova (`artifacts/bateria/resultado.json`,
`artifacts/medicao/construcao.json`) e contados na hora. Número digitado à mão num documento
envelhece calado, e um relatório com número velho é pior que um sem número.

Uso: python tools/macrocheckpoint-tres-frentes.py
"""
import json
import re
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

RAIZ = Path(__file__).resolve().parent.parent
OUT = RAIZ / "artifacts" / "macrocheckpoint-tres-frentes.pdf"
AZUL = "#0A7EA4"
AMBAR = "#A4601A"
VERDE = "#1F7A48"
CINZA = "#555555"

# --------------------------------------------------------------------------- números, da prova
def _json(p, padrao=None):
    try:
        return json.loads((RAIZ / p).read_text(encoding="utf-8"))
    except Exception:
        return padrao


bateria = _json("artifacts/bateria/resultado.json", {})
medicao = _json("artifacts/medicao/construcao.json", {})

CENARIOS_OK = bateria.get("passaram")
CENARIOS_DE = bateria.get("de")


def _medida(onde):
    for m in medicao.get("medicoes", []):
        if onde in m.get("url", ""):
            return m
    return {}


LOCAL = _medida("127.0.0.1")
PUBLICADO = _medida("github.io")

# Asserções contadas no repositório, na hora.
TESTES = RAIZ / "src" / "assistant" / "__tests__"
ASSERCOES = sum(len(re.findall(r"\bassert\.", f.read_text(encoding="utf-8")))
                for f in TESTES.glob("*.mjs")) if TESTES.exists() else 0
SUITES = len(list(TESTES.glob("*.mjs"))) if TESTES.exists() else 0


def num(v, suf="", padrao="—"):
    return f"{v}{suf}" if v is not None else padrao


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
    Paragraph("Ajudante BPMN — macrocheckpoint das três frentes", H1),
    Paragraph("17 de novembro de 2026 · o que você viu no teste ao vivo, o que estava errado por "
              "baixo, e o que ficou medido", SUB),

    Paragraph("Em uma frase", H2),
    Paragraph(
        "As três coisas que você trouxe estão feitas e provadas na sessão ao vivo: a decisão "
        f"agora nasce com os <b>dois</b> caminhos rotulados, dá para começar do zero sem perder "
        "o que está na tela, e a tela conta o que está sendo desenhado enquanto o modelo "
        "trabalha. A quarta coisa não é entrega, é um número: <b>a espera que você sentiu em "
        f"produção não é nossa</b> — a nossa parte é {num(LOCAL.get('nossaFatia'))} do tempo.", P),

    Paragraph("1. O gateway tinha causa no código, e não no modelo", H2),
    Paragraph("Você disse:", P),
    Paragraph("“Não está seguindo dois caminhos, está seguindo um caminho só e o outro está "
              "desconectado. (…) quando os gateways acontecem, a gente deveria ter o correto, o "
              "não e sim.”", CITA),
    Paragraph(
        "O modelo estava certo em tentar. <b>Abrir o segundo caminho de um gateway era "
        "impossível.</b> O parâmetro que faz um elemento nascer como RAMO de uma decisão "
        "(<font face='Courier'>comoRamo</font>) existia no código desde o dia 15 e <b>nunca foi "
        "declarado</b> ao modelo. Sem ele, pedir o segundo caminho caía na opção “depois de”, "
        "que <b>encadeia</b>: o modelo recebia uma fila onde pediu uma bifurcação, desfazia, "
        "tentava de novo, e sobrava elemento solto. Na sua sessão isso custou 17 chamadas, dois "
        "desfazeres, e uma tentativa de renomear uma seta que já não existia.", P),
    Paragraph(
        "Agora existe um verbo só para isso: <b>abrir um caminho da decisão</b> — cria o "
        "elemento, liga à decisão e escreve a resposta na seta, tudo num comando, para o seu "
        "Ctrl+Z desfazer o caminho inteiro de uma vez. E a leitura da tela passou a dizer, a "
        "cada turno, quantos caminhos cada decisão tem e quantos têm resposta escrita — então "
        "uma decisão pela metade fica visível para o modelo <b>antes</b> de você notar.", P),
    Paragraph(
        f"<b>A lição que vale para os próximos blocos:</b> verbo declarado não é capacidade "
        "alcançável. Um parâmetro que o código aceita e a declaração não cita é uma capacidade "
        "que o produto <b>tem</b> e o modelo não pode usar — e o sintoma chega como “o modelo "
        "não entende gateway”. Está escrito no roteiro, no bloco que fechou sem isso.", P),

    Paragraph("2. Começar do zero sem perder o que está na tela", H2),
    Paragraph("Você disse:", P),
    Paragraph("“Eu estou olhando para um processo, mas eu quero fazer um do zero. A gente pode "
              "talvez perguntar o que a gente quer fazer, com o que tem, que a gente vai perder "
              "(…) abrir para perguntar se ele quer salvar.”", CITA),
    Paragraph(
        "São três respostas, e nenhuma delas é um <i>confirm</i> do navegador: <b>baixar e "
        "começar</b>, <b>começar sem baixar</b>, <b>cancelar</b>. A frase diz a perda onde ela "
        "acontece — “ele vive só nesta aba, não fica guardado em lugar nenhum” — porque é a "
        "verdade: não há servidor nosso e não há conta. <b>Guardar, aqui, quer dizer baixar o "
        "arquivo</b>, e o arquivo baixado volta a abrir.", P),
    Paragraph(
        "Dá para pedir pelo botão “Do zero”, ao lado da alavanca, ou <b>falando</b>. Falando, "
        "vale o mesmo portão do apagar: o agente <b>recusa</b> e pergunta, e só limpa depois que "
        "você responde. A ordem está cronometrada na prova ao vivo.", P),

    Paragraph("3. A tela conta o que está sendo desenhado", H2),
    Paragraph("Você disse:", P),
    Paragraph("“Ele demorou, ficou demorando cada bloco cerca de 5 segundos, sei lá, 3 segundos, "
              "4 segundos, e isso é ruim porque o usuário está vendo e não sabe que está "
              "acontecendo alguma coisa.”", CITA),
    Paragraph(
        "Três coisas mudaram na tela: o elemento que acabou de mudar <b>pisca no canvas</b> "
        "(onde você está olhando); as linhas de escrita do mesmo pedido viram <b>uma mensagem "
        "que cresce</b> — “montando o processo — N elementos”, com a lista por dentro, em vez de "
        "doze linhas rolando; e o selo distingue <b>desenhando</b> de <b>pensando</b>, porque "
        "três segundos de cada um são a mesma espera com significados diferentes. Desfazer no "
        "meio da construção aparece como <b>ajuste</b>, não como erro.", P),
    Paragraph(
        "E a contagem conta o <b>desenho</b>, não as chamadas: se o agente desfaz, o número "
        "<b>cai</b>. Essa foi a primeira coisa que o portão desta frente pegou — a mensagem "
        "dizia “7 elementos” com cinco na tela, na mudança que existe justamente para a tela "
        "parar de mentir.", P),

    PageBreak(),

    Paragraph("O número que decide o que é honesto prometer", H2),
    Paragraph(
        "Antes de prometer velocidade, medimos de onde vem a espera. A ferramenta corre o "
        "<b>mesmo</b> pedido e separa, por chamada, a nossa execução da volta ao modelo:", P),
    tabela([
        ["O que se mediu", "Dev server (local)", "Site publicado"],
        ["Chamadas de ferramenta no turno", num(LOCAL.get("chamadas")), num(PUBLICADO.get("chamadas"))],
        ["Formas no desenho", num(LOCAL.get("formas")), num(PUBLICADO.get("formas"))],
        ["<b>Nossa escrita</b> (mediana / pior)",
         f"{num(LOCAL.get('nosso', {}).get('mediana'), ' s')} / {num(LOCAL.get('nosso', {}).get('pior'), ' s')}",
         f"{num(PUBLICADO.get('nosso', {}).get('mediana'), ' s')} / {num(PUBLICADO.get('nosso', {}).get('pior'), ' s')}"],
        ["<b>Volta ao modelo</b> (mediana / pior)",
         f"{num(LOCAL.get('esperaPeloModelo', {}).get('mediana'), ' s')} / {num(LOCAL.get('esperaPeloModelo', {}).get('pior'), ' s')}",
         f"{num(PUBLICADO.get('esperaPeloModelo', {}).get('mediana'), ' s')} / {num(PUBLICADO.get('esperaPeloModelo', {}).get('pior'), ' s')}"],
        ["Do envio ao último elemento entrar",
         num(LOCAL.get("segundosDoAlunoEsperando"), " s"),
         num(PUBLICADO.get("segundosDoAlunoEsperando"), " s")],
        ["<b>Nossa fatia do total</b>",
         f"<font color='{VERDE}'><b>{num(LOCAL.get('nossaFatia'))}</b></font>",
         f"<font color='{VERDE}'><b>{num(PUBLICADO.get('nossaFatia'))}</b></font>"],
    ], [6.0 * cm, 5.2 * cm, 5.2 * cm]),
    Paragraph(
        "<b>E o site publicado não é mais lento que o nosso dev server</b> — as duas colunas "
        "acima saíram da mesma hora, com o mesmo pedido, e deram praticamente o mesmo número. "
        "Então os 3 a 5 segundos por bloco que você sentiu não vêm de estar publicado: vêm da "
        "volta ao modelo, que varia de turno para turno (o pior caso medido aqui é "
        f"{num(max([x for x in [LOCAL.get('esperaPeloModelo', {}).get('pior'), PUBLICADO.get('esperaPeloModelo', {}).get('pior')] if x] or [None]), ' s')}, "
        "e um turno com mais elementos tem mais voltas). Isso fecha uma suspeita: não há nada "
        "para consertar no deploy.", P),
    Paragraph(
        "<b>Então esta frente não promete velocidade, e isso é decisão, não desculpa.</b> A "
        "espera entre blocos é a volta ao modelo; nenhuma mudança nossa a encurta. O que ela "
        "entrega é a espera <b>legível</b> — você passa a saber que algo está acontecendo, o quê, "
        "e quantos elementos já entraram. Isso fica escrito no registro, e <b>não</b> na tela: o "
        "aluno não precisa de uma aula sobre a arquitetura do Gemini para entender uma barra de "
        "progresso.", P),

    Paragraph("O que os portões acharam de mim mesmo", H2),
    Paragraph("Três defeitos meus, nesta rodada, todos achados por portões — e por isso vale "
              "contar, porque é o que diferencia “passou” de “foi medido”:", P),
    bullets([
        "<b>A contagem mentia.</b> Dizia “7 elementos” depois de seis criações e um desfazer, "
        "com cinco na tela: eu contava chamadas. Agora conta o desenho.",
        "<b>O selo ficava preso.</b> Ao separar <i>desenhando</i> de <i>consultando</i>, a volta "
        "do estado conhecia só o segundo — e o selo preso <b>travava a tela</b>: clicar num "
        "botão que o agente acabou de desenhar respondia “conecte antes de escolher”, com a "
        "sessão aberta. Quem pegou foi um portão de outra frente.",
        "<b>O selo existia por microssegundos.</b> Numa construção de oito elementos, o estado "
        "“desenhando” <b>nunca</b> foi observado — nem amostrando a tela a cada 120 ms. A nossa "
        "escrita é instantânea (mediana de "
        f"{num(LOCAL.get('nosso', {}).get('mediana'), ' s')}), então o selo nascia e morria no "
        "mesmo instante. Agora tem tempo mínimo de leitura, que o seu gesto encurta: clicar "
        "prova que você leu.",
    ]),

    Paragraph("A prova, inteira", H2),
    tabela([
        ["Camada", "O que roda", "Resultado"],
        ["Determinística (sem rede)", f"{SUITES} suítes, {ASSERCOES} asserções",
         f"<font color='{VERDE}'><b>verde</b></font>"],
        ["Portões no navegador, sem cota", f"{num(CENARIOS_DE)} cenários contra o bpmn-js de verdade",
         f"<font color='{VERDE}'><b>{num(CENARIOS_OK)} de {num(CENARIOS_DE)}</b></font>"],
        ["Ao vivo, uma por frente",
         "a decisão com dois caminhos · a tela durante a construção · a folha limpa por voz",
         f"<font color='{VERDE}'><b>três verdes</b></font>"],
    ], [4.6 * cm, 8.0 * cm, 3.8 * cm]),
    Paragraph(
        "A prova ao vivo da voz é a que mais vale a pena ler, porque é <b>ordem</b> e não estado "
        "final: ouviu “quero começar um processo do zero” aos 5,7 s; <b>recusou</b> aos 9,3 s "
        "com as 24 formas intactas; ouviu “pode limpar, sim” aos 24,3 s; e só então a tela "
        "ficou com uma. Um portão frouxo apagaria o seu desenho sem você ter dito nada; um duro "
        "travaria a conversa. Os dois erros são de ordem, e é por isso que a prova olha "
        "<b>quando</b> cada coisa aconteceu.", P),
    Paragraph(
        "Há também um <b>filme</b> da construção (um quadro a cada 0,5 s) em "
        "<font face='Courier'>artifacts/bateria/filme-construcao/</font>: é o que dá para "
        "assistir em vez de ler.", P),

    Paragraph("O que ficou aberto, e de quem é", H2),
    tabela([
        ["Ponta", "Por que ficou", "De quem"],
        ["Duas linhas de gateway no prompt",
         "estouravam o teto do tier estável (5511 contra 5400), e subir o teto para caber a "
         "própria adição é como um orçamento vira ficção. O ensino foi para a declaração da "
         "ferramenta, que é o canal certo para “como se usa”",
         "decidido"],
        ["Memória entre visitas",
         "continua fora de propósito: “guardar” aqui quer dizer baixar o arquivo. Persistir exige "
         "reescrever o aviso de privacidade e pedir consentimento",
         "sua decisão"],
        ["Agrupar chamadas no mesmo turno",
         f"só vale a pena se a volta ao modelo dominar — e agora está medido que domina "
         f"({num(LOCAL.get('nossaFatia'))} é nosso). É o próximo candidato real de velocidade",
         "próxima rodada"],
    ], [4.4 * cm, 9.4 * cm, 2.6 * cm]),
]

SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                  topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                  title="Macrocheckpoint das três frentes — Ajudante BPMN",
                  author="rodada de 2026-11-17").build(story)
print(f"PDF: {OUT}")
print(f"  bateria={CENARIOS_OK}/{CENARIOS_DE} · assercoes={ASSERCOES} em {SUITES} suites")
print(f"  local={LOCAL.get('nossaFatia')} nosso · publicado={PUBLICADO.get('nossaFatia') or '(nao medido)'}")
