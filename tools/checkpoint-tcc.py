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
    Paragraph("Tutor BPMN — checkpoint para avaliação", H1),
    Paragraph("16 de novembro de 2026 · o que o produto faz hoje, o que está provado, o que "
              "ficou pendente — e o que vem a seguir, depois das suas decisões desta noite", SUB),

    # ---------------------------------------------------------------- 1. o produto hoje
    Paragraph("1. O que o produto faz hoje", H2),
    Paragraph(
        "O aluno abre o site, informa <b>a própria chave</b> do Google AI Studio e conversa — "
        "falando ou escrevendo — com o <b>Tutor BPMN</b>, que fica <b>dentro</b> do modelador. Ele "
        "lê o diagrama aberto, responde sobre os elementos que o aluno clica, "
        "<b>escreve</b> no desenho (cria, liga, renomeia, insere no meio do fluxo, move, alinha, "
        "cria pool e raia), <b>pergunta antes</b> de apagar, consulta um acervo autoral de BPMN e "
        "<b>cita a fonte</b> — e o aplicativo confere a citação antes de ela aparecer na tela, "
        "nos dois modos: a legenda da voz passa pela mesma conferência que o texto.", P),
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
         "<b>mecânica fechada</b>; a pedagogia você <b>estacionou</b> para elaborar com o orientador"],
        ["Trilha H · cápsula de voz", "dono do turno, canais, barge-in por nível, estado tipado, "
         "cartões clicáveis",
         "<font color='%s'><b>colhida inteira</b></font>" % VERDE],
        ["Tela base", "primeira tela em português, dois passos para a chave, sempre há volta",
         "<font color='%s'><b>no ar</b></font> 15/11" % VERDE],
        ["Acabamento do painel", "escala de espaçamento, consentimento, marca d'água, o selo que não mente",
         "<font color='%s'><b>fechado</b></font> 15/11" % VERDE],
        ["Orientação da primeira visita", "barra encostada na alavanca: o que dá para fazer naquela "
         "trilha, uma sugestão clicável, e ela segue o que você clica no desenho",
         "<font color='%s'><b>no ar</b></font> 15/11" % VERDE],
        ["Nome único e saída permanente", "o agente passou a se chamar <b>Tutor BPMN</b> em "
         "toda superfície, e a volta à tela inicial deixou de morrer na primeira edição",
         "<font color='%s'><b>no ar</b></font> 16/11" % VERDE],
    ], [4.0 * cm, 7.6 * cm, 4.4 * cm]),

    # ---------------------------------------------------------------- 3. as provas
    Paragraph("3. As provas que existem — e é isto que sustenta a dissertação", H2),
    tabela([
        ["Camada", "Tamanho", "O que ela garante"],
        ["<font face='Courier'>npm test</font> (determinística)",
         "<b>32 suítes · 685 asserções</b><br/>562 síncronas · 123 assíncronas",
         "o núcleo: prompt, despacho, ferramentas, memória, guardrails, protocolo, áudio. Roda "
         "sem rede, sem chave e sem cota"],
        ["Portões no navegador",
         "<b>51 cenários</b><br/>34 sem cota · 17 ao vivo",
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
        "reescrito. E uma vez a medição <b>contradisse a minha própria anotação</b>: eu havia "
        "escrito que criar um elemento com nome custava dois <font face='Courier'>Ctrl+Z</font>, o portão mediu <b>sete</b>. "
        "Essa é a parte do método que vale contar na banca.", NOTA),

    # ---------------------------------------------------------------- 4. a rodada de hoje
    Paragraph("4. O que esta rodada acrescentou (15 e 16 de novembro)", H2),
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
        "<b>A primeira visita ganhou orientação</b> — e a forma dela veio de pesquisa, não de "
        "gosto: tutorial sobreposto faz o produto parecer <b>mais</b> complexo, caixa em branco "
        "esconde o que o assistente sabe fazer, e sugestão ligada ao que está na tela vence a "
        "genérica. Resultado: uma barra encostada na alavanca, com <b>uma</b> sugestão clicável "
        "que <b>segue a sua seleção</b> — clicou em “Assar a pizza”, ela passa a falar dessa "
        "tarefa e deixa a pergunta pronta no painel, sem enviar.",
        "<b>O acabamento do painel fechou</b>, e trouxe uma capacidade nova: o que a ferramenta "
        "acha vira <b>cartão clicável que mostra o elemento no desenho</b> — sem falar com o "
        "modelo e <b>sem gastar turno</b>. Junto com isso: o selo deixou de dizer “ouvindo” numa "
        "sessão sem microfone, a escala de espaçamento ficou uniforme, e dois portões novos medem "
        "o consentimento não pré-marcado e a marca d’água do bpmn.io livre — esta última é "
        "exigência da licença, não zelo estético.",
        "<b>“Desfaz isso” passou a desfazer de verdade — e o número que eu tinha anotado estava "
        "errado.</b> Minha própria lista dizia que criar um elemento com nome custava dois "
        "<font face='Courier'>Ctrl+Z</font>. O portão novo mediu <b>sete</b>: o nome era um "
        "comando, e o endireitamento das setas em volta era outros cinco ou seis. Você dizia "
        "“desfaz” e o agente desfazia o traçado de uma linha, anunciando que havia voltado atrás. "
        "Agora é <b>um</b> — e, quando for mais de um (abrir espaço para a forma é comando "
        "legítimo), a ferramenta devolve o número <b>contado</b>, não estimado, e desfaz o lote.",
        "<b>A prova de tela entrou no CI</b>: 32 cenários rodam a cada envio, no servidor do "
        "GitHub, contra a imagem que vai ao ar — e sem credencial nenhuma. Pega o que nada mais "
        "pegava: página que o build não copiou, botão que trocou de nome, geometria que o "
        "bpmn-js desenha diferente depois de uma atualização. E o <b>viewer</b> deixou de ser "
        "provado só “carrega”: agora um portão roda a <b>simulação em lote</b> com o painel "
        "aberto e cobra que o tutor saiba comentar o resultado sem poder editar nada.",
        "<b>Você perguntou se a voz usa o acervo. Usa — e a pergunta achou dois defeitos.</b> O "
        "que faltava não era a consulta: era a <b>conferência</b>. A nossa própria frase dizia "
        "que “na voz a citação não é conferida”, e isso juntava duas coisas: o <b>áudio</b> "
        "realmente não passa por nós, mas a <b>legenda</b> passa — e aparecia crua, com a marca "
        "inventada exibida como se tivesse sido conferida, que é pior que não conferir. Agora a "
        "legenda é conferida como o texto, a bolha <b>avisa</b> quando a fala citou fonte que "
        "não fecha (o áudio já foi), e a fonte aparece com o localizador do acervo — tirada do "
        "que o aplicativo <b>serviu</b>, não do que o modelo disse. O segundo defeito: a linha "
        "que mostra o que a consulta leu estava escrita dentro da função errada e <b>nunca "
        "apareceu, em modo nenhum</b> — o erro caía numa rede de segurança que o engolia.",
        "<b>Os quatro pontos que você apontou na tela inicial foram atendidos — e dois eram "
        "defeito nosso.</b> A frase que o produto escrevia no seu lugar tinha 47 caracteres numa "
        "caixa de uma linha: <b>chegava cortada</b>, e agora o teto (33) é teste. O “tutor” "
        "repetido três vezes não era redação: a mesma coisa tinha <b>três nomes</b> (na tela, no "
        "painel e no código) — agora é <b>Tutor BPMN</b>, de uma fonte só, com a capacidade dita "
        "uma vez ao lado. E o mais sério: <b>depois de fechar o balão não havia mais como voltar "
        "à tela inicial</b> — a barra morria na primeira edição e carregava o único caminho de "
        "volta. Entrou uma âncora permanente; e porque ela torna o menu alcançável <b>com "
        "trabalho vivo</b>, trocar de trilha passou a perguntar antes.",
    ]),

    # ---------------------------------------------------------------- 5. pendencias
    Paragraph("5. O que ficou pendente — e de quem é", H2),
    tabela([
        ["Pendência", "Por que não bloqueia", "De quem é"],
        ["<b>A pedagogia do tutor</b> (F8b): quando propor e quando calar, como explicar a escolha "
         "de representação, quanto corrigir de uma vez",
         "a mecânica está pronta e provada: o agente propõe, a ferramenta recusa até o aluno "
         "responder, e a tela é lida de volta a cada escrita",
         "<b>estacionada por você</b>, para elaborar com o orientador"],
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
        ["<b>Duas da orientação que ficam fora</b>: partidas pelo histórico de quem volta, e medir "
         "se a orientação funcionou",
         "a primeira depende de memória entre visitas, que você decidiu não ter; a segunda "
         "exigiria telemetria, e não vai haver",
         "<b>declaradas</b> — escritas para ninguém as descobrir como esquecimento"],
        ["<b>Pontas minhas, o que sobrou</b>: um layout automático de verdade (“arruma o "
         "desenho”), sugestão proativa ao abrir um diagrama com problema, e o medidor de "
         "sobreposição que ignora rótulo",
         "nenhuma conserta nada — são frentes novas ou higiene. As outras cinco saíram nesta "
         "rodada, com prova",
         "minhas, quando valer a pena"],
        ["<b>Os portões de microfone não rodam no servidor do GitHub</b>: a fala gravada é "
         "gerada pela voz do Windows e não entra no repositório",
         "o cenário que precisa dela fica <b>de fora</b>, dito em voz alta, em vez de passar "
         "medindo o tom sintético do navegador. Aqui ele roda a cada rodada",
         "<b>declarada</b>"],
    ], [5.2 * cm, 6.4 * cm, 4.4 * cm]),

    # ---------------------------------------------------------------- 6. proximos passos
    Paragraph("6. Próximos passos, depois das suas decisões", H2),
    Paragraph(
        "<b>1. A conversa com o orientador.</b> Você levou a pedagogia do tutor para lá, e isso "
        "reordena o resto: enquanto a forma do que o tutor diz não estiver decidida, correr o "
        "portão F8 seria carimbar uma pedagogia que ninguém escolheu. Na mesma conversa cabem as "
        "duas frases que faltam no texto — a licença do <font face='Courier'>bpmn-js</font> (a "
        "marca d’água não pode ser removida, e o software já cumpre isso com portão) e o reúso de "
        "trabalho anterior seu —, além da modalidade, dos prazos e da ABNT.", P),
    Paragraph(
        "<b>2. Quando a pedagogia voltar: fechar o F8.</b> São as seções de ensino no prompt "
        "(explicar ancorado no diagrama aberto, recomendar quando há escolha, resposta curta por "
        "padrão e mais curta na voz) e o portão ao vivo: <b>descrever um processo em três frases "
        "produz uma proposta nomeada; ao aceitar, o diagrama ganha início, tarefas e fim "
        "ligados; e o agente não mexe no que não foi pedido</b>. A mecânica inteira já está de "
        "pé — o que entrar ali é conteúdo, e é rápido.", P),
    Paragraph(
        "<b>3. Publicar de verdade, se e quando você quiser.</b> Domínio, DNS, secrets e o "
        "ensaio do rollback. Hoje o endereço provisório publica a cada entrega e serve tudo, "
        "então isto é melhoria, não conserto.", P),
    Paragraph(
        "<b>4. As pontas minhas — cinco saíram enquanto você estava fora.</b> Ficaram, sem pressa e "
        "sem bloquear nada: um <b>layout automático de verdade</b> (“arruma o desenho”), que é uma "
        "frente própria — o bpmn-js não tem layout automático, e escrever um é grafo em camadas, "
        "raias e rótulos —, a <b>sugestão proativa</b> ao abrir um diagrama com problema (que "
        "depende do mesmo limite pedagógico que você levou ao orientador) e o medidor de "
        "sobreposição que ignora rótulo, como o próprio bpmn-js ignora.", P),

    Spacer(1, 6),
    Paragraph("Onde o trabalho está, em uma frase", H2),
    Paragraph(
        "Num estado <b>estável e mostrável</b>: o tutor ensina, desenha, cita a fonte, pergunta "
        "antes de apagar, não cai no meio da aula e tem como provar cada uma dessas afirmações "
        "com um comando. O que falta não é engenharia — é a parte acadêmica, que é de quem "
        "orienta, e foi exatamente para lá que você mandou. Enquanto ela acontece, nada aqui "
        "para de funcionar: o site publica a cada entrega, e a prova roda inteira num comando.", P),
]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                        topMargin=1.8 * cm, bottomMargin=1.6 * cm,
                        title="Tutor BPMN — checkpoint para avaliação",
                        author="Tutor BPMN (TCC)")
doc.build(story)
print(f"PDF: {OUT}")
