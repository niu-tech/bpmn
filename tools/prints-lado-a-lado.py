"""Prova 5.1 do refine: os mesmos dois estados, ANTES e DEPOIS, lado a lado.

A tarefa pede o par, e não um print novo bonito: "melhorou" é afirmação, e afirmação sem o antes
é propaganda. Os dois estados são os que a pesquisa de UI marcou como críticos — a primeira tela
(onde o aluno decide se continua) e a tela com a voz aberta (onde ele não lê, só olha).

As imagens de ANTES são as capturas de 13 de novembro, guardadas em `artifacts/`; as de DEPOIS
saem da bateria, que tira um print por cenário. Os pares têm a MESMA altura e a mesma largura por
lado — um par com escalas diferentes esconde justamente o que mudou de tamanho.

Uso: python tools/prints-lado-a-lado.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
BATERIA = RAIZ / "artifacts" / "bateria"
SAIDA = RAIZ / "artifacts" / "ui"

PARES = [
    {
        "nome": "primeira-tela",
        "titulo": "A primeira tela — onde o aluno decide se continua",
        "antes": RAIZ / "artifacts" / "ui-1-chave.png",
        "depois": BATERIA / "primeira-tela-acao-visivel-e-os-dois-passos-da-chave.png",
        "mudou": "uma ação principal · dois passos numerados · o caminho da chave na tela · "
                 "consentimento não pré-marcado · a dica deixou de repetir o passo",
    },
    {
        "nome": "voz-aberta",
        "titulo": "Com a voz aberta — onde ele não lê, só olha",
        "antes": RAIZ / "artifacts" / "ui-2-gravando.png",
        "depois": BATERIA / "a-faixa-de-voz-aguenta-re-render-e-quatro-selecionados-chegam-ao-prompt.png",
        "mudou": "escuta deixou de ser vermelha · compositor e voz são exclusivos · os dois mudos "
                 "viraram ícones · o selo não diz “ouvindo” sem microfone",
    },
]

FAIXA = 92          # a tarja de texto acima das duas imagens
RODAPE = 46         # a linha do que mudou
GAP = 14


def fonte(tam, negrito=False):
    for nome in (("arialbd.ttf", "seguisb.ttf") if negrito else ("arial.ttf", "segoeui.ttf")):
        try:
            return ImageFont.truetype(nome, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def quebrar(texto, f, largura, desenho):
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if desenho.textlength(teste, font=f) <= largura:
            atual = teste
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def compor(par):
    a = Image.open(par["antes"]).convert("RGB")
    d = Image.open(par["depois"]).convert("RGB")

    # Mesma altura nos dois lados, e a largura de cada lado é a mesma: escala diferente num par
    # lado a lado é o jeito clássico de a comparação mentir.
    alvo_h = min(a.height, d.height, 900)
    def ajustar(img):
        escala = alvo_h / img.height
        return img.resize((max(1, round(img.width * escala)), alvo_h), Image.LANCZOS)
    a, d = ajustar(a), ajustar(d)
    lado = min(a.width, d.width)
    a = a.crop((a.width - lado, 0, a.width, a.height))      # o painel mora à direita
    d = d.crop((d.width - lado, 0, d.width, d.height))

    largura = lado * 2 + GAP
    tela = Image.new("RGB", (largura, FAIXA + alvo_h + RODAPE), "#f4f6f9")
    desenho = ImageDraw.Draw(tela)

    f_tit = fonte(26, True)
    f_sub = fonte(17, True)
    f_pe = fonte(16)
    desenho.text((12, 14), par["titulo"], font=f_tit, fill="#0f172a")
    desenho.text((12, FAIXA - 30), "ANTES", font=f_sub, fill="#a4601a")
    desenho.text((lado + GAP + 12, FAIXA - 30), "DEPOIS", font=f_sub, fill="#1f7a48")

    tela.paste(a, (0, FAIXA))
    tela.paste(d, (lado + GAP, FAIXA))
    desenho.rectangle([0, FAIXA, lado - 1, FAIXA + alvo_h - 1], outline="#a4601a", width=2)
    desenho.rectangle([lado + GAP, FAIXA, largura - 1, FAIXA + alvo_h - 1], outline="#1f7a48", width=2)

    y = FAIXA + alvo_h + 8
    for linha in quebrar(f"O que mudou: {par['mudou']}", f_pe, largura - 24, desenho)[:2]:
        desenho.text((12, y), linha, font=f_pe, fill="#334155")
        y += 20

    SAIDA.mkdir(parents=True, exist_ok=True)
    out = SAIDA / f"lado-a-lado-{par['nome']}.png"
    tela.save(out)
    return out


if __name__ == "__main__":
    for par in PARES:
        if not par["antes"].exists():
            print(f"FALTA o antes: {par['antes']}")
            continue
        if not par["depois"].exists():
            print(f"FALTA o depois (rode a bateria): {par['depois']}")
            continue
        print(f"par: {compor(par)}")
