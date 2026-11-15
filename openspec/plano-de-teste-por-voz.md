# Plano de teste por voz — o que o dono vai provar com a própria boca

> **Para que serve.** Quase tudo aqui já é provado sozinho: a suíte determinística roda sem
> navegador, o portão de navegador dirige o bpmn-js de verdade sem gastar cota, e os cenários AO
> VIVO falam com o Gemini usando um WAV pt-BR como microfone. O que **nenhum** desses prova é a
> cadeia física completa: o microfone do dono, a voz dele, o eco da sala, o alto-falante, e a
> impressão de estar conversando com alguém. É isso que este plano pede.
>
> **Como usar.** Cada caso tem: o que fazer, o que tem de acontecer, e o que já está provado
> automaticamente (para o dono saber o que está conferindo, e não repetir trabalho de máquina).
> Rode `npm run trilha` ANTES de começar: ela grava tudo e, ao fim, imprime o resumo que vira
> evidência.
>
> _Documento vivo: cresce a cada rodada. Última atualização: 2026-11-15._

## Antes de começar (uma vez)

```bash
npm run dev                      # o site, em http://127.0.0.1:8126/
npm run trilha                   # a gravação da sessão (deixe rodando; Ctrl+C no fim)
```

Na aba: cole a sua chave do Google AI Studio, marque o aviso, clique em **Começar**, e então no
**microfone**. Fone de ouvido ajuda — sem ele, o som do ajudante volta pelo microfone e ele se
interrompe sozinho (o produto detecta isso e avisa, e é um dos casos a conferir).

---

## Bloco A — a conversa básica por voz

| # | Você faz | Tem de acontecer | Já provado por máquina |
|---|---|---|---|
| A1 | "Qual a diferença entre gateway exclusivo e paralelo?" | Ele responde **falando**, em português, em uma ou duas frases. A sua pergunta aparece como UMA bolha que cresce — não uma por pedaço. | cenário AO VIVO `voz de verdade contra o Gemini` (WAV sintético) |
| A2 | Enquanto ele responde, fale por cima: "espera, chega". | Ele **para na hora**. | cenário AO VIVO `interromper o modelo falando por cima` |
| A3 | Clique em **Parar de falar** no meio de uma resposta. | Silêncio imediato, e o resto do turno não volta sozinho. | teste determinístico (`parar de falar cala o RESTO do turno`) |
| A4 | Pergunte algo fora de BPMN ("receita de bolo"). | Ele recusa em uma frase e volta ao assunto. | portão F5 ao vivo |

**O que só você pode dizer:** a voz dele soa natural? O tempo até ele começar a falar incomoda?
Dá para interromper sem gritar?

## Bloco B — o diagrama na frente dele

| # | Você faz | Tem de acontecer | Já provado por máquina |
|---|---|---|---|
| B1 | Clique numa tarefa do desenho e pergunte **"e esse aqui?"** sem dizer o nome. | Ele fala do elemento certo, citando o nome. | portão 5.3 AO VIVO (texto) |
| B2 | Clique em cinco elementos seguidos, rápido, e então pergunte. | Ele fala do **último**, e a conversa não enche de avisos. | teste do debounce + fila da página |
| B3 | Peça: "cria uma tarefa Conferir estoque depois do início". | O elemento aparece no desenho, com o nome escrito. | portão F7 + geometria sem cota |
| B4 | Peça: "põe uma tarefa Embalar entre essas duas". | Ele parte a seta e entra no meio — não cria um ramo embaixo. | geometria sem cota (`entre`) |
| B5 | Peça "alinha essas duas na mesma linha". | Elas ficam na mesma altura. | geometria sem cota (`alinhar`) |
| B6 | Importe outro arquivo `.bpmn` no meio da conversa e pergunte "o que mudou?". | Ele fala do diagrama **novo**. | canal da página (`import.done`) — só em teste |

**O que só você pode dizer:** o que ele desenha fica legível? Você entenderia o resultado sem
olhar o chat?

## Bloco C — o portão: ele não mexe no que você não pediu

| # | Você faz | Tem de acontecer | Já provado por máquina |
|---|---|---|---|
| C1 | Clique numa tarefa e diga "apaga essa tarefa". | Ele **pergunta** antes. Nada some. | portão 6.3 AO VIVO (voz) + sem cota |
| C2 | Responda "pode apagar". | Só então o elemento some, e ele confirma. | idem |
| C3 | Peça para apagar outra coisa logo depois, e **não responda**. | Ele pergunta de novo. O "sim" de antes não valeu para esta. | teste do portão consumido + sem cota |
| C4 | Diga "apaga" e, antes de responder, mude de assunto. | Nada é apagado, e a conversa segue. | teste de ordem (resposta antes da pergunta não conta) |

**O que só você pode dizer:** a pergunta dele é curta o bastante para você responder falando? Você
chegou a achar que ele tinha apagado antes de perguntar?

## Bloco D — quando dá errado

| # | Você faz | Tem de acontecer | Já provado por máquina |
|---|---|---|---|
| D1 | Desligue o Wi-Fi por uns segundos no meio de uma resposta. | Ele volta sozinho e **avisa** que caiu; se era pergunta digitada, refaz. | teste de reconexão |
| D2 | Use uma chave errada de propósito. | Mensagem clara, com o que fazer — e a chave **não** aparece em lugar nenhum. | cenário `a chave nao vaza em lugar nenhum` |
| D3 | Abra o ajudante em **duas ou três abas** e comece em todas, até uma recusar. | A tela diz **"o limite de sessões da sua chave foi atingido"**, manda fechar as outras abas, aponta "Testar conexão" — e **não** manda trocar a chave. A conversa continua ali. | medição de cota (M7) + teste do recado |
| D3b | Converse por **mais de 10 minutos** sem parar, e depois pergunte algo que só se responde com o que foi dito no começo. | Aos ~10 min o servidor derruba a conexão. A conversa volta dizendo *"Continuamos na mesma conversa"* — e o modelo **ainda lembra**: a volta retoma a sessão pela alça (T20) em vez de abrir outra. | retomada de sessão pronta e provada por teste; a queda de 10 min ao vivo é **sua** |
| D4 | Tire o fone e deixe o som alto perto do microfone. | Depois de três cortes seguidos ele avisa e passa a fechar o microfone enquanto responde. | cenário `rede de seguranca: laco de eco` |
| D5 | Deixe a aba aberta e vá almoçar. | Em 25 minutos ele encerra sozinho, **diz por quê** e a conversa continua na tela. | teste do teto de sessão |

---

## O que a máquina **não** consegue provar (e por isso está aqui)

1. **A cadeia física do som.** O microfone falso do Chromium toca um arquivo; o seu toca a sala.
   Eco, ruído de fundo, distância do microfone e o ganho da placa mudam o que o servidor ouve.
2. **A voz pt-BR de verdade.** As fixtures são SAPI (Microsoft Maria) — sotaque uniforme, ritmo
   constante, zero hesitação. Você fala com "ãhn", corta palavra no meio e muda de ideia na frase.
3. **O tempo como experiência.** A trilha mede segundos; só você sabe se três segundos de espera
   pareceram naturais ou pareceram travamento.
4. **A leitura do desenho.** O teste confere ids e coordenadas; você confere se o diagrama ficou
   *bonito o suficiente para entregar na faculdade*.

## O que levar de volta (a evidência da rodada)

Ao dar `Ctrl+C` na trilha, ela imprime e salva:

- `artifacts/sessoes/trilha-<carimbo>.json` — a conversa, o diário e o contexto enviado;
- a linha `página: N nota(s) entregue(s), M descartada(s)`;
- a linha `portão: N confirmação(ões), o aluno levou X s em média`.

Me mande o JSON (ou só essas linhas) e dá para reconstruir a sessão inteira sem você descrever
nada. Para reler sozinho: `npm run trilha -- --de artifacts/sessoes/trilha-<carimbo>.json`.
