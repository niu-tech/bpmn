> **Bloco do roadmap:** F8a — a mecânica do tutor. Esta change entrega a metade "propõe e espera":
> sem ela, *propõe e não decide pelo aluno* continua sendo prosa no prompt. Irmã:
> `close-the-loop-with-the-canvas`. Destrava E1 (o que desfazer em bloco) e E2 (sugestão proativa).

## Why

A única confirmação que o ajudante tem hoje exige **clique**.

`remover` chama `pedirConfirmacao` e a interface desenha dois botões; sem clique, nada é apagado.
Isso é correto e continua. O problema é o que ele implica num produto cujo caminho principal é a
voz: o aluno está falando, olhando o desenho, de mãos livres — e a única forma de dizer "sim" é
largar a conversa e procurar um botão. Em voz, o fluxo quebra exatamente no momento em que o
agente mais precisa da pessoa.

O segundo motivo é a fase F8 (tutor). O roadmap pede "propõe e não decide pelo aluno", e hoje isso
é **prosa no prompt**: a única coisa que impede o agente de agir sozinho é ele obedecer à própria
instrução. Prosa não é portão. Quando a change irmã (`close-the-loop-with-the-canvas`) fizer o
agente enxergar o que o aluno faz no canvas, a tentação de agir sem pedir cresce, e a prosa fica
ainda mais fraca.

A PoC do *appointment agent* do Orbit atacou o mesmo problema e a resposta dela é mecânica, não
textual: **a ação fica recusada até o usuário falar DEPOIS de a pergunta ter aparecido**. Quem
conta não é o modelo — é a página, com um contador de turnos do usuário. Lá isso protege três
decisões clínicas ("este é o paciente?", "está tudo correto?", "há sintoma urgente?"); aqui
protege o diagrama do aluno e, principalmente, torna o tutor possível sem entregar a decisão ao
modelo.

## What Changes

**Época de turno.** Um contador no `session-manager` que sobe **toda vez que o aluno fala ou
digita** — e só nisso. Mensagem da página não conta (ela não é o aluno).

**Portão nomeado.** `portao(nome)` marca a época em que a pergunta apareceu. `respondido(nome)` é
verdadeiro quando a época atual é **maior** que a marcada: o aluno falou depois da pergunta.
`esperarResposta(nome, 3500)` tolera a transcrição que chega atrasada — a legenda final do que o
aluno disse costuma chegar depois de o modelo já ter agido.

**Ferramenta que exige portão recusa com fato.** O catálogo ganha `exigeConfirmacao: '<portão>'`.
Antes de executar, o despacho pergunta à página; sem resposta do aluno, devolve `falta_confirmacao`
com um texto que diz ao modelo o que fazer: pergunte em uma frase e espere. Isso é **resultado**,
não exceção — o modelo continua a conversa sabendo por que não aconteceu.

**`remover` passa a aceitar as duas formas.** A fala abre o portão; o diálogo continua para quem
está no mouse. E o portão é conferido **mesmo quando o diálogo foi usado**: duas travas, como no
resto do produto.

**O modelo nunca é a fonte.** Ele pode dizer "o aluno confirmou" o quanto quiser: quem responde é
a página. É a mesma regra do `nada_mudou` — não se confia na narração, confere-se o estado.

## Impact

- `src/assistant/session-manager.js` — época, portões, `esperarResposta`, e o repasse ao despacho.
- `src/assistant/agent/catalog.js` — `exigeConfirmacao` nas ferramentas que o pedem.
- `src/assistant/agent/dispatch.js` — a recusa `falta_confirmacao` antes do executor.
- `src/assistant/tools/escrita.js` — `remover` aceita a confirmação falada.
- `src/assistant/agent/sections.js` — uma frase: pergunte e **espere**, não aja antes.
- Testes: `__tests__/session-manager.mjs`, `__tests__/despacho.mjs`, `__tests__/escrita.mjs`.

**Fora desta change:** decidir **quais** ações passam a exigir portão além de `remover`. Esta
change entrega o mecanismo e aplica no caso que já existe; a lista cresce quando o tutor (F8)
definir o que ele propõe.

## Acceptance

1. Falar "sim" depois da pergunta remove o elemento, sem clique nenhum.
2. Um "sim" dito **antes** de a pergunta aparecer não conta.
3. Transcrição que chega 2 s atrasada ainda conta (espera curta), e 10 s não conta.
4. O modelo afirmando que o aluno confirmou não abre o portão.
5. A recusa volta como fato nomeado, e a conversa continua — nada de turno pendurado.
6. O caminho do clique continua funcionando igual.
