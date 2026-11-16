> **Bloco do roadmap:** a frente acadêmica (TCC como entrega). É daqui que saem as tabelas do
> capítulo de validação; a latência por turno vem da irmã `sustain-a-class-session`.

## Why

A bateria prova **cenários**: dez situações escolhidas à mão, cada uma com o seu veredito. Isso
serve ao desenvolvimento e já pegou defeito de verdade. Não serve a duas perguntas que a
dissertação vai ter de responder:

- **"Quão bem ele responde?"** — hoje a resposta é uma lista de corridas verdes, não um número.
- **"Piorou?"** — hoje ninguém sabe. Um prompt reescrito pode melhorar três casos e quebrar dois
  sem que nada fique vermelho, porque os dois não estão em cenário nenhum.

O que falta é um **conjunto de perguntas douradas**: um arquivo de dados, não de código, com a
pergunta, quem pergunta, o que tem de acontecer e o que não pode acontecer. Com limiares e uma
linha de base, ele responde às duas perguntas sozinho — e, sendo um arquivo legível, o orientador
pode discutir **as perguntas**, que é a discussão certa, em vez de discutir o código do teste.

O modelo disso é o acervo de avaliação do agente do Orbit: 67 perguntas em 12 categorias, duas
camadas (uma determinística sem rede, outra contra o modelo de verdade), `limiares.json` com
piso de aprovação e **100% obrigatório nas categorias de segurança**, e `baseline.json` com o
recuo máximo tolerado entre duas corridas. A forma é boa e é pública na documentação deles; as
perguntas são do domínio clínico e não servem aqui. As nossas são de BPMN.

## What Changes

**O acervo.** `avaliacao/perguntas-douradas.json`, versionado, legível:

```jsonc
{
  "perfis": [ { "id": "modelador", "ferramentasOferecidas": ["..."] },
              { "id": "viewer",     "ferramentasOferecidas": ["..."] } ],
  "perguntas": [{
    "id": "esc-003",
    "categoria": "escrita",
    "perfil": "modelador",
    "diagrama": "pizza-collaboration",          // o estado inicial da tela
    "pergunta": "esqueci de verificar o pagamento entre receber e preparar",
    "ferramentasEsperadas": [{ "nome": "criar_elemento", "casaArgumentos": { "entre": "2" } }],
    "fatosObrigatorios": ["entre|no meio"],      // `a|b` = qualquer um basta
    "ferramentasProibidas": ["remover"],
    "proibidoNaResposta": ["agendei", "salvei"],
    "esperaRecusa": false
  }]
}
```

**Doze categorias**, cada uma existindo por um defeito que já vimos ou que tememos: leitura,
escrita, montagem guiada, geometria, ambiguidade, confirmação, recusa de escopo, injeção pelo
nome de elemento, vazamento de chave, borda (diagrama vazio, sem seleção), idioma, cota.

**Duas camadas, a mesma lista.**

- **Determinística** (`npm test`, sem rede, sem chave): o modelo é roteirizado pelo dublê de
  socket. Prova o que é nosso — qual ferramenta foi oferecida a qual perfil, a política, a
  execução, o erro nomeado, o que nunca chega ao modelo. Roda em segundos, a cada commit.
- **Ao vivo** (com `.env`): a mesma lista contra o Gemini. Mede o que só o modelo decide — ele
  escolhe a ferramenta certa a partir da frase do aluno? recusa o que tem de recusar? Cara em
  cota, então roda por lote e por decisão, não a cada commit.

**Limiares e linha de base.** `avaliacao/limiares.json` (taxa mínima geral, precisão e cobertura
de ferramenta, **100% nas categorias de segurança**) e `avaliacao/baseline.json` (o resultado
aceito da última corrida boa; uma queda além do delta reprova, mesmo com a taxa acima do piso).

**A prova para a banca.** Um comando que grava a sessão **com som**: a fala injetada e o áudio que
o servidor mandou, misturados na linha do tempo real, com marcação visual de quando o clique foi
humano. É assim que se mostra, em dois minutos, que o agente fez o que diz que fez — e o que foi a
pessoa que fez.

## Impact

- `avaliacao/` (novo): `perguntas-douradas.json`, `limiares.json`, `baseline.json`, `README.md`.
- `tools/avaliar.mjs` (novo): roda as duas camadas, escreve `artifacts/avaliacao/<carimbo>/`.
- `tools/ledger.mjs`: o resultado de cada corrida entra no diário append-only que já existe.
- `tools/video-prova.mjs` (novo): a gravação com trilha sonora.
- `package.json`: `npm run avaliar` e `npm run avaliar -- --ao-vivo`.
- Nada em `src/**`.

## Acceptance

1. `npm run avaliar` roda a camada determinística sem rede e imprime taxa por categoria.
2. Uma pergunta de segurança que falhe reprova a corrida inteira, mesmo com tudo o mais verde.
3. Uma queda além do delta contra `baseline.json` reprova, com a diferença nomeada.
4. `npm run avaliar -- --ao-vivo` mede o modelo real e grava o resumo com data que ninguém
   sobrescreve.
5. Existe um vídeo curto, com som, de uma sessão real, com os cliques humanos marcados.
6. As tabelas da dissertação (taxa por categoria, cobertura de ferramenta, latência) saem desses
   arquivos, não de anotação à mão.
