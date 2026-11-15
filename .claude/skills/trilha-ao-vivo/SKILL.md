---
name: trilha-ao-vivo
description: Abrir uma sessão de teste REAL no navegador do dono (Edge com porta de depuração) e capturar tudo — conversa, diário, contexto, som e desenho — sem pedir que ninguém copie e cole. Use quando o dono relatar algo que aconteceu "na tela dele", quando for preciso reproduzir um caso de uso ao vivo, ou antes de investigar qualquer defeito de voz, sessão ou interface.
---

# Trilha ao vivo

O teste de verdade é no navegador do dono: a chave é dele, o microfone é dele, o diagrama é o da
aula. O conserto é do outro lado, e precisa do diário inteiro. Esta skill é a ponte.

## O comando

```bash
npm run trilha
```

- Abre o Edge com a porta de depuração (perfil **separado**, não mexe no perfil do dia a dia) —
  ou reaproveita a janela que já estiver escutando.
- Aponta para o **servidor local** (`127.0.0.1:8126`) quando ele está de pé — é lá que o código
  desta sessão roda; cai para o publicado quando não está.
- Fica acompanhando: a cada 4 s grava `artifacts/sessoes/atual.json` e imprime uma linha por
  mensagem nova e por evento que muda o rumo (estado, erro, queda, ferramenta).
- `Ctrl+C` fecha e grava `artifacts/sessoes/trilha-<carimbo>.json`.

Variações: `npm run trilha -- --uma-vez` (captura o que já existe e sai), `-- --publicado`.

**Rode em background** e leia `artifacts/sessoes/atual.json` quando quiser: é sempre o retrato de
agora. Não peça print, não peça cópia do painel.

## O que vem na captura

`quando · url · estado · mensagens · eventos · contagem · contexto · contextoEnviado · som ·
uso · relatorio`

- `mensagens`: a conversa com **número de turno** — é o que liga pergunta e resposta.
- `eventos`: o diário completo (`ws.*`, `out.*`, `tool.*`, `state.*`, `som.buffer`, `rede.teste`).
- `som`: `bufferedMs`, `underflows`, `overflowDropped` — fala picotada se vê aqui.
- `contextoEnviado`: o que o modelo recebeu de fato.

## Se não houver porta de depuração

O dono clica em **⋯ → Salvar sessão**: baixa o mesmo JSON para o Downloads. Funciona em qualquer
navegador, sem flag nenhuma. Leia de `C:\Users\<usuário>\Downloads\ajudante-bpmn-*.json`.

## Armadilhas já pagas

- **Aba interna**: um Edge recém-aberto mostra o diálogo de sincronia como primeira página. O
  script ignora `edge://`, `chrome://`, `devtools://`.
- **Filtro por URL mente**: em desenvolvimento o endereço é `127.0.0.1:8126/index.html` e não tem
  a palavra "bpmn". A aba certa é a que **tem `window.__bpmnAssist`** — é assim que se procura.
- **Edge já aberto não ganha a flag**: `--remote-debugging-port` só vale em processo novo. Se já
  houver Edge rodando sem a porta, o comando abre uma janela com perfil próprio.
- **Cota do Live**: o plano gratuito tem teto de sessões por minuto. `erro: cota` não é queda de
  rede e não adianta reconectar — espere e use **Testar conexão** (menu ⋯).

## Depois da trilha

Leia a captura, isole o caso e **escreva o teste** antes de consertar — determinístico quando o
caso couber em `npm test`, cenário da bateria (`node tools/battery.mjs --so <nome>`) quando
depender do navegador. Trilha que vira conserto sem teste volta na semana seguinte.
