# Uma chamada para a sequência inteira

> Decisões: `design.md` (D1–D7). Plano: `tasks.md`. Evidência que abriu a change: a medição de
> `show-the-work-while-the-agent-builds`, em `artifacts/medicao/construcao.json` (2026-11-17).

## Why

A frente da espera legível terminou com um número que aponta para cá. O mesmo pedido, medido nos
dois endereços, com a nossa execução separada da volta ao modelo:

| | dev server | publicado |
|---|---|---|
| chamadas / formas | 8 · 2→10 | 8 · 2→10 |
| **nossa escrita** (mediana) | **0,01 s** | **0,00 s** |
| **volta ao modelo** (mediana / pior) | 0,46 s / 0,69 s | 0,47 s / 0,86 s |
| do envio ao último elemento | 3,5 s | 3,7 s |
| **nossa fatia** | **1%** | **1%** |

**99% da espera é a volta ao modelo**, e a volta ao modelo acontece **uma vez por chamada**. Então
o único jeito de o aluno esperar menos é haver **menos chamadas** — não há nada para otimizar no
nosso lado, porque o nosso lado é 0,01 s.

E o pedido que o dono fez, que é o pedido típico de quem está aprendendo, é uma **fila**:

> *"Monte um processo de compra com seis passos em sequência: o pedido chega, o comprador confere
> o estoque, cota com três fornecedores, escolhe o fornecedor, emite a ordem de compra e recebe o
> material; no fim o processo termina."*

Oito chamadas: um pool, seis tarefas, um fim. Sete delas são o **mesmo verbo** com o mesmo
formato, cada uma esperando a anterior.

## A causa não é o nosso despacho: é a dependência de dado

`despachar` já executa **N chamadas em paralelo** (`Promise.all`, em `agent/dispatch.js`) desde a
F1. O que serializa a construção não é o nosso código — é que `criar_elemento` precisa de
`depoisDe`, e o id que vai em `depoisDe` **só existe depois** de a chamada anterior responder.

O modelo não tem como agrupar isso sozinho: ele não pode citar um id que ainda não recebeu. A
sequência é, por construção, uma corrente de ida-e-volta — e cada elo custa uma volta ao modelo.

## What Changes

- **`criar_sequencia` nasce**: uma chamada recebe a lista de passos (`[{tipo, nome}]`) e desenha
  a fila inteira, cada passo encadeado ao anterior. Os ids nascem e morrem do nosso lado, então a
  dependência que serializava desaparece.
- **Reaproveita `criar_elemento`**, passo por passo: mesma vaga do `autoPlace`, mesma recusa
  nomeada, mesmo gêmeo, mesmo nome-no-mesmo-comando. Nenhum caminho novo de desenho.
- **Falha no meio é FATO, não exceção**: os passos que entraram ficam e são reportados, com o
  passo que parou e o motivo. O aluno viu as formas aparecerem; dizer que nada aconteceu seria
  mentir para o modelo e para ele.
- **Um resultado, não N**: a lista dos criados, a tela **uma** vez no fim, e o total de
  `comandos` — que é o `quantos` de `desfazer`, para o aluno poder voltar atrás da fila inteira.
- **O ensino vai na DECLARAÇÃO**, não no prompt estável: quando usar fila, quando usar
  `criar_elemento` e quando usar `ramificar`. Mesma decisão da change do gateway, pelo mesmo
  motivo — o tier estável tem 60 caracteres de folga, e `ramificar` provou ao vivo que a
  declaração basta.
- **Portão com número**: o mesmo pedido do dono, medido antes e depois. O que se afirma é a
  **contagem de chamadas**, não um tempo em segundos.

## O que a medição disse depois (2026-11-17)

Mesmo pedido, mesmas dez formas na tela: **8 chamadas → 2**, e a espera do aluno de **3,5 s → 1,4
s**. Os verbos que o modelo escolheu, registrados pelo instrumento: `criar_pool` e
**`criar_sequencia`** — ninguém disse o nome da ferramenta a ele.

⚠ A volta ao modelo **por chamada** subiu de 0,46 s para 1,38 s, porque agora cada chamada carrega
seis passos. Isso não contradiz nada: a conta é o **total**, e é o total que o aluno espera. Duas
voltas grandes custam menos que oito pequenas — e é só isso que esta change compra.

## Non-Goals

- **Não promete segundos.** A volta ao modelo varia por turno e por rede; o que esta change
  controla é quantas voltas existem. Prometer tempo seria prometer a rede do aluno.
- **Caminho de decisão continua uma chamada por caminho** (`ramificar`). Fila é fila; decisão é
  escolha, e o rótulo de cada caminho é informação que o aluno dá.
- **Não desenha o que o aluno não pediu.** A ferramenta recebe passos; ela não inventa o fim do
  processo nem adivinha gateway no meio de uma fila.
- **Layout.** Quem posiciona é o `autoPlace` do bpmn-js, igual a hoje.
- **Memória entre visitas** continua fora (F.5, decisão do dono, reafirmada em 2026-11-17).
