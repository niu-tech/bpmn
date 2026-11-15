## Context

Três maneiras de saber que o aluno concordou, e só uma sobrevive ao escrutínio:

| Como | Por que não |
|---|---|
| O modelo diz que ele concordou | é a narração, não o fato — é o que o `nada_mudou` existe para não aceitar |
| A última mensagem do aluno contém "sim" | classificação por palavra-chave: proibida pela constituição §III, e errada ("sim, mas antes me explica") |
| O aluno falou **depois** de a pergunta aparecer | é **ordem**, não conteúdo: dá para provar sem ler o texto |

A terceira é a que esta change implementa. Ela não olha o que o aluno disse — olha **quando**.

## Decisions

### 1. Época conta o aluno, e só o aluno

Sobe em `ask()` (digitado) e no primeiro pedaço de `inputTranscription` de um turno falado. Não
sobe com mensagem da página, nem com clique em candidato — um clique é escolha, não consentimento
para agir.

Alternativa recusada: contar qualquer mensagem. Faria a própria nota da página abrir o portão que
ela mesma pediu, que é o pior defeito possível aqui.

### 2. O portão guarda a época da PERGUNTA, não um booleano

`portao('remover')` grava a época do momento em que a pergunta apareceu. Isso resolve de graça o
caso que um booleano erra: o aluno já tinha dito "pode apagar" **antes** de o agente perguntar
(falando de outra coisa, ou de um elemento anterior). Com época, aquele "sim" ficou para trás.

### 3. A espera curta existe porque a legenda chega atrasada

A transcrição final do que o aluno falou chega depois de o modelo já ter decidido chamar a
ferramenta — medido nos dois produtos. Sem a espera, o aluno fala "sim", o agente responde "ainda
não confirmou" e o aluno repete: a pior experiência possível, e por meio segundo.

`esperarResposta(nome, 3500)`: 3,5 s, o mesmo número que a PoC do Orbit usa depois de medir o
mesmo atraso. Vira constante nomeada com o motivo escrito em cima.

### 4. A recusa é resultado, não exceção

`{ ok: false, erro: 'falta_confirmacao', comoProsseguir: '…' }`. O modelo recebe a instrução junto
com a recusa: pergunte em uma frase curta e espere. Isso mantém o turno vivo — e é a mesma forma
que `sem_lugar` e `nada_mudou` já usam.

### 5. O portão é verificado mesmo quando há diálogo

`remover` continua pedindo confirmação na interface. O portão é a **segunda** trava, e as duas
valem: a fala abre o portão; o diálogo registra a decisão explícita; nenhuma das duas sozinha é
dispensada por carimbo da outra.

Alternativa recusada: substituir o diálogo pela fala. Perderia o aluno de mouse e teclado, e
perderia a assinatura da versão do diagrama (H14) que o diálogo carrega.

### 6. O portão vive no cliente, perto da conversa

Ele depende de duas coisas que só a aba sabe: quando a pergunta apareceu e quando o aluno falou.
Não há servidor aqui — e mesmo que houvesse, esta é a metade que **não** se delega ao modelo.

## Risks

- **Agente travado esperando resposta que não vem.** Mitigação: a recusa é imediata (a espera é de
  3,5 s, não de minutos) e o modelo é instruído a perguntar de novo, uma vez.
- **O aluno responde à pergunta errada.** Mitigação: um portão por nome; a pergunta de um não abre
  o outro. O cenário de teste cobre duas perguntas abertas ao mesmo tempo.
- **Falso negativo em ambiente ruidoso** (a fala não é transcrita). Mitigação: o caminho do clique
  continua, e a mensagem de recusa diz ao aluno que ele também pode clicar.
