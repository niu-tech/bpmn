"""Consolidado do macrocheckpoint das TRÊS FRENTES — artifacts/macrocheckpoint-tres-frentes.pdf.

O que o dono trouxe do teste ao vivo de 2026-11-17 virou três changes, e este é o documento que
fecha as três de uma vez: o que ele viu, o que estava errado por baixo, o que foi feito, e o que
ficou medido — inclusive o número que diz que a espera NÃO é nossa.

E uma QUARTA frente, que não saiu de um relato e sim desse número: se a espera é a volta ao modelo,
o que o produto controla é *quantas chamadas* a construção pede. Duas changes de agrupamento
depois (`one-call-for-a-whole-sequence`, `one-call-for-a-whole-decision`), o mesmo pedido custa 3
chamadas em vez de 17 — e a alavanca seguinte ficou medida e fechada sem código.

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

# A medição que EXISTE, e o endereço dela. Uma corrida `--so-publicado` não tem coluna local, e um
# documento com travessão onde devia haver número parece defeito nosso. O publicado vem primeiro
# porque é o endereço que o dono usa de verdade.
M = PUBLICADO or LOCAL
ONDE = "site publicado" if PUBLICADO else "dev server (local)"
TURNOS = M.get("turnos")
POR_TURNO = M.get("porTurno") or []

# Asserções contadas no repositório, na hora.
TESTES = RAIZ / "src" / "assistant" / "__tests__"
ASSERCOES = sum(len(re.findall(r"\bassert\.", f.read_text(encoding="utf-8")))
                for f in TESTES.glob("*.mjs")) if TESTES.exists() else 0
SUITES = len(list(TESTES.glob("*.mjs"))) if TESTES.exists() else 0


def num(v, suf="", padrao="—"):
    """O número da prova, com vírgula decimal e a seta que se lê.

    O valor vem CRU do JSON (`1.9`, `2 -> 10`), e o documento é em português: "1.9 s" ao lado de
    "2,8 s" parece erro de digitação, e `->` numa tabela parece código vazando. A troca é aqui, no
    formatador, e não no número — para o artefato de prova continuar sendo o artefato de prova.
    """
    if v is None:
        return padrao
    if isinstance(v, float):
        v = f"{v}".replace(".", ",")
    return f"{v}{suf}".replace(" -> ", " → ")


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
    Paragraph("Ajudante BPMN — macrocheckpoint do dia: três frentes e o agrupamento", H1),
    Paragraph("17 de novembro de 2026 · o que você viu no teste ao vivo, o que estava errado por "
              "baixo, o que a medição mandou fazer depois, e onde a alavanca acabou", SUB),

    Paragraph("Em uma frase", H2),
    Paragraph(
        "As três coisas que você trouxe estão feitas e provadas na sessão ao vivo: a decisão "
        "agora nasce com os <b>dois</b> caminhos rotulados, dá para começar do zero sem perder "
        "o que está na tela, e a tela conta o que está sendo desenhado enquanto o modelo "
        "trabalha. A quarta não veio de um relato, veio de um número: <b>a espera que você "
        f"sentiu não é nossa</b> — a nossa parte é {num(M.get('nossaFatia'))} do tempo —, então o "
        "que havia para fazer era pedir <b>menos vezes</b>. Dois verbos novos depois, o mesmo "
        f"processo que custou 17 chamadas na sua sessão custa <b>{num(M.get('chamadas'))}</b>, em "
        f"{num(M.get('segundosDoAlunoEsperando'), ' s')}. E a alavanca seguinte está medida: ela "
        "acaba aqui.", P),

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

    Paragraph("4. Pedir menos vezes: uma chamada para a fila, uma para a decisão", H2),
    Paragraph(
        "Esta frente saiu da medição da anterior, e não de uma reclamação. Se a nossa escrita no "
        f"desenho é {num(M.get('nosso', {}).get('mediana'), ' s')} e cada volta ao modelo é "
        f"{num(M.get('esperaPeloModelo', {}).get('mediana'), ' s')}, então o relógio que o aluno "
        "sente não mede o nosso código: mede <b>quantas chamadas</b> a construção pediu. E uma "
        "ferramenta por elemento transforma <i>uma</i> frase em oito idas e vindas — quem fala "
        "descreve uma fila (“o pedido chega, o comprador confere, depois cota”) e uma decisão "
        "inteira (“se sim…; se não…”), não um elemento por vez.", P),
    Paragraph(
        "Nasceram dois verbos — a <b>fila</b> e a <b>decisão com os caminhos dela</b> — e nenhum "
        "dos dois tem desenho novo por dentro: ambos <b>compõem</b> os verbos que já estavam "
        "provados. Isso não é economia de linhas, é o que garante que o desenho feito numa "
        "chamada seja idêntico ao feito em oito: a mesma vaga, o mesmo encadeamento, o mesmo "
        "gêmeo recusado, o mesmo Ctrl+Z.", P),
    tabela([
        ["O mesmo pedido, em palavras de quem aprende", "antes", "agora"],
        ["o tronco — uma fila de seis passos", "8 chamadas", "<b>1</b>"],
        ["a árvore — a decisão e os dois caminhos", "4 chamadas", "<b>1</b>"],
        ["o processo do Suporte inteiro (10 formas)", "6 chamadas · 2,8 s",
         f"<b>{num(M.get('chamadas'))} chamadas · {num(M.get('segundosDoAlunoEsperando'), ' s')}</b>"],
        ["a sessão que você testou ao vivo", "17 chamadas, 2 desfazeres", "—"],
    ], [7.4 * cm, 4.5 * cm, 4.5 * cm]),
    Paragraph(
        "Os números de “antes” foram medidos <b>antes</b> de implementar — é a regra desta frente, "
        "e por isso eles não envelhecem: são fato histórico, registrado nas duas changes. Os de "
        "“agora” saem do artefato de prova a cada vez que este documento é gerado.", P),
    Paragraph(
        "Duas coisas que valem mais que os segundos. A primeira: <b>o ensino foi para a declaração "
        "da ferramenta</b>, e não para o prompt — terceira vez que essa escolha se repete, e é o "
        "que mantém o tier estável dentro do teto. A segunda: <b>o modelo escolheu os dois verbos "
        "sozinho</b>, com o pedido em palavras e sem ninguém citar nome de ferramenta nenhum. O "
        "instrumento registra os nomes na ordem, porque “ele escolheu” sem os nomes é dedução, e "
        "dedução não é evidência.", P),

    PageBreak(),

    Paragraph("O número que decide o que é honesto prometer", H2),
    Paragraph(
        "Antes de prometer velocidade, medimos de onde vem a espera. A ferramenta corre o "
        "<b>mesmo</b> pedido e separa, por chamada, a nossa execução da volta ao modelo:", P),
    tabela([
        ["O que se mediu", f"No {ONDE}, com os dois verbos novos"],
        ["Chamadas de ferramenta", num(M.get("chamadas"))],
        ["<b>Idas e voltas ao modelo</b> (turnos)", f"<b>{num(TURNOS)}</b>"],
        ["Formas no desenho", num(M.get("formas"))],
        ["<b>Nossa escrita</b> (mediana / pior)",
         f"{num(M.get('nosso', {}).get('mediana'), ' s')} / {num(M.get('nosso', {}).get('pior'), ' s')}"],
        ["<b>Volta ao modelo</b> (mediana / pior)",
         f"{num(M.get('esperaPeloModelo', {}).get('mediana'), ' s')} / {num(M.get('esperaPeloModelo', {}).get('pior'), ' s')}"],
        ["Do envio ao último elemento entrar", num(M.get("segundosDoAlunoEsperando"), " s")],
        ["<b>Nossa fatia do total</b>",
         f"<font color='{VERDE}'><b>{num(M.get('nossaFatia'))}</b></font>"],
    ], [8.4 * cm, 8.0 * cm]),
    Paragraph(
        "<b>E o site publicado não é mais lento que o nosso dev server</b> — a primeira medição "
        "correu nos dois endereços, na mesma hora e com o mesmo pedido, e deu praticamente o "
        "mesmo número. Então os 3 a 5 segundos por bloco que você sentiu não vêm de estar "
        "publicado: vêm da volta ao modelo, que varia de turno para turno (o pior caso medido "
        f"agora é {num(M.get('esperaPeloModelo', {}).get('pior'), ' s')}, e um turno com mais "
        "elementos tem mais voltas). Isso fecha uma suspeita: não há nada para consertar no "
        "deploy. <b>Toda medição desde então corre contra o publicado</b>, que é o endereço que "
        "você usa — e foi ela que denunciou, no mesmo dia, um deploy que a esteira havia deixado "
        "parado por um teste vermelho.", P),
    Paragraph(
        "<b>Então esta frente não promete velocidade, e isso é decisão, não desculpa.</b> A "
        "espera entre blocos é a volta ao modelo; nenhuma mudança nossa a encurta. O que ela "
        "entrega é a espera <b>legível</b> — você passa a saber que algo está acontecendo, o quê, "
        "e quantos elementos já entraram. Isso fica escrito no registro, e <b>não</b> na tela: o "
        "aluno não precisa de uma aula sobre a arquitetura do Gemini para entender uma barra de "
        "progresso.", P),

    Paragraph("Onde a alavanca acaba — e isso também é medido", H2),
    Paragraph(
        "Com os dois verbos novos dava para dizer “3 chamadas” e parar aí. Mas 3 chamadas em "
        "<b>um</b> ida-e-volta ao modelo e 3 chamadas em <b>três</b> são esperas diferentes, e o "
        "instrumento não sabia distinguir. Agora sabe: chamadas do mesmo turno chegam juntas e se "
        "sobrepõem no tempo, então o que separa um turno do seguinte é o <b>silêncio</b> da volta "
        "ao modelo.", P),
    tabela([["Turno", "O que o modelo pediu", "Formas no desenho", "Elementos"]] +
           [[str(i + 1), " · ".join(f"<font face='Courier'>{v}</font>" for v in t.get("verbos", [])),
             num(t.get("formas")), num(t.get("elementos"))]
            for i, t in enumerate(POR_TURNO)],
           [1.8 * cm, 6.6 * cm, 4.2 * cm, 2.4 * cm]),
    Paragraph(
        f"São <b>{num(M.get('chamadas'))} chamadas em {num(TURNOS)} turnos</b> — uma por volta. "
        f"Dos {num(M.get('segundosDoAlunoEsperando'), ' s')} que o aluno espera, as voltas ao "
        "modelo são quase tudo; a nossa escrita, somada, não passa de "
        f"{num(M.get('nosso', {}).get('pior'), ' s')} no pior caso.", P),
    Paragraph(
        "<b>E as três não dão para juntar num turno só</b>, porque cada uma precisa de um <b>id "
        "que a anterior devolveu</b>: a fila nasce DENTRO do pool que acabou de ser criado, e a "
        "decisão entra DEPOIS do último passo da fila. É a mesma dependência de dados que a fila "
        "desfez dentro de uma corrente, um nível acima — não é preguiça do modelo, e nenhuma "
        "instrução no prompt a remove.", P),
    Paragraph(
        "Juntar exigiria endereçar os elementos por <b>nome</b> em vez de id e então sequenciar o "
        "despachante, que hoje roda as chamadas do mesmo turno em paralelo de propósito. Seria o "
        "produto decidindo uma ordem que o aluno não disse, para ganhar cerca de um segundo de "
        f"{num(M.get('segundosDoAlunoEsperando'), ' s')}. <b>Então a alavanca fecha aqui, sem "
        "código</b> — com o número no lugar da intuição. O que restou da espera é a volta ao "
        "modelo: é dele e da rede do aluno, não nossa, e dizer o contrário seria vender o que não "
        "temos.", P),

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
        f"{num(M.get('nosso', {}).get('mediana'), ' s')}), então o selo nascia e morria no "
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
        ["Agrupar as chamadas de uma construção",
         f"<b>feito no mesmo dia</b>, porque a medição mostrou que a volta ao modelo domina (só "
         f"{num(M.get('nossaFatia'))} é nosso): a fila e a decisão viraram um verbo cada, e o "
         f"mesmo pedido saiu de 6 chamadas para {num(M.get('chamadas'))}",
         "fechado"],
        ["Juntar os três turnos restantes num só",
         "<b>medido e fechado sem código</b>: cada chamada precisa do id que a anterior devolveu, "
         "então juntar exigiria endereçar por nome e sequenciar o despachante — o produto "
         "decidindo uma ordem que o aluno não disse, por cerca de um segundo",
         "decidido"],
    ], [4.4 * cm, 9.4 * cm, 2.6 * cm]),
]

SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                  topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                  title="Macrocheckpoint das três frentes — Ajudante BPMN",
                  author="rodada de 2026-11-17").build(story)
print(f"PDF: {OUT}")
print(f"  bateria={CENARIOS_OK}/{CENARIOS_DE} · assercoes={ASSERCOES} em {SUITES} suites")
print(f"  medido no {ONDE}: {M.get('chamadas')} chamadas em {TURNOS} turnos \u00b7 "
      f"{M.get('nossaFatia')} nosso \u00b7 {M.get('segundosDoAlunoEsperando')} s de espera")
