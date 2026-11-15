## Why

Uma aula é uma conversa longa. O ajudante nunca foi medido numa.

As provas que temos são de turnos avulsos e de sessões de teste de poucos minutos. O que acontece
depois de quarenta minutos de conversa com o mesmo diagrama aberto é, hoje, desconhecido — e há
três coisas sabidas que trabalham contra:

1. **O teto de contexto da sessão.** Não mandamos `contextWindowCompression` no `setup`. O
   comentário da PoC do Orbit é literal: *"sem isto uma conversa longa bate no teto da sessão"*.
   São três linhas no frame de abertura, e é o tipo de defeito que só aparece na aula de verdade,
   na frente dos alunos.
2. **A cota.** A trilha de 2026-11-14 terminou em `erro: cota` depois de ~8 turnos, e o item T16
   diz o que falta: o **número**. Sem ele a tela só consegue dizer "acabou", quando deveria dizer
   "volte em X segundos".
3. **A latência é invisível.** O diário carimba hora em cada evento, mas ninguém soma: não sabemos
   quanto tempo passa entre o aluno calar e o agente começar a falar, nem quanto do turno é o
   modelo pensando, o áudio chegando, ou a nossa própria fila. Para a dissertação isso é uma
   tabela que não existe.

A PoC do Orbit resolveu (3) com um formato de registro por turno que vale copiar como **forma**:
`ouviu -0,3 s · primeira resposta 2,1 s · áudio 12,2 s chegando de 2,1 a 4,0 s · fim de turno
14,3 s`. Quatro números por turno, do mesmo diário que já temos.

## What Changes

**No produto**

- `contextWindowCompression: { slidingWindow: {} }` no `setup` — a janela deslizante do servidor,
  que é o que permite a conversa longa não ser cortada.
- **Teto de sessão declarado** e um recado honesto quando ele chega ("a sessão atingiu o tempo
  limite; peça de novo para abrir outra"). Não é limitação técnica: é proteção da cota do aluno,
  que é dele e é pequena — uma aba esquecida aberta não pode consumir a aula seguinte.
- **A cota medida.** Um experimento curto (abrir sessões em sequência até a recusa) que responde
  se o limite é por minuto, por concorrência ou por dia; a tela passa a dizer o que fazer com o
  número na mão.

**Na medição**

- O diário ganha o fechamento de turno com os quatro tempos: ouviu, primeira resposta, áudio
  (quanto e quando), fim.
- `npm run trilha` imprime esses tempos por turno e grava no JSON — vira tabela de latência da
  dissertação sem trabalho extra.
- `usageMetadata` (que o servidor já manda e nós ignoramos) vira contagem de tokens por turno: é o
  custo por turno que a PoC do Orbit não chegou a medir, e que um TCC sobre um produto BYOK
  deveria ter.

## Impact

- `src/assistant/live/protocol.js` — três linhas no `setup`; leitura de `usageMetadata`.
- `src/assistant/live/session.js` — teto de sessão e o encerramento nomeado.
- `src/assistant/diagnostics.js` — fechamento de turno com tempos.
- `tools/trilha.mjs` — a linha de tempos por turno.
- `src/assistant/ui/widget.js` — o recado do teto e o da cota com o número.
- Nenhuma mudança no catálogo, nas ferramentas ou no desenho.

## Acceptance

1. O `setup` enviado contém `contextWindowCompression`, e o teste de protocolo cobra isso.
2. Uma sessão simulada de 40 turnos (dublê de socket, sem rede) não é cortada por tamanho, e a
   conversa continua coerente.
3. Chegado o teto de tempo, a sessão encerra com motivo nomeado e a tela diz o que fazer.
4. A trilha mostra, por turno, os quatro tempos e a contagem de tokens.
5. O número da cota está escrito em `open-items.md` (fecha T16/M7) e a tela usa esse número.
