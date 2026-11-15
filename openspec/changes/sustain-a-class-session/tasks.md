> **O 1.1 é de três linhas e é o item mais barato de todo o roadmap.** O resto desta change é
> medição: ela não muda o que o agente faz, muda o que a gente sabe sobre o que ele faz.

## 1. A conversa longa não pode ser cortada

- [ ] 1.1 `contextWindowCompression: { slidingWindow: {} }` no `buildSetup`, com o comentário do
      motivo (teto de sessão em conversa longa) e a origem da medida.
- [ ] 1.2 Teste de protocolo: o frame de `setup` tem a compressão, nos dois perfis.
- [ ] 1.3 Sessão simulada de 40 turnos pelo dublê de socket: nenhum corte, nenhuma reabertura, e o
      contexto do último turno ainda cita o diagrama.

## 2. Teto de sessão, pela cota do aluno

- [ ] 2.1 Teto declarado em constante com o motivo escrito; ao chegar, encerra com motivo nomeado.
- [ ] 2.2 A tela diz o que aconteceu e como recomeçar — sem jargão e sem culpar o aluno.
- [ ] 2.3 Teste: relógio falso avança além do teto ⇒ encerra nomeado; abaixo do teto ⇒ não encerra.

## 3. O número da cota (fecha T16 / M7)

- [ ] 3.1 Experimento curto: abrir sessões em sequência contra a chave do dono até a recusa,
      registrando hora e código de fechamento.
- [ ] 3.2 Concluir se o limite é por minuto, por concorrência ou por dia, e **escrever o número**
      em `open-items.md`.
- [ ] 3.3 A tela passa a dizer "volte em X segundos" com o número medido, não com um chute.
- [ ] 3.4 Teste do recado: `erro: cota` ⇒ a frase traz o número e o verbo "Testar conexão".

## 4. Latência por turno

- [ ] 4.1 Fechamento de turno no diário com: ouviu (em relação ao fim da fala), primeira resposta,
      áudio (segundos e janela de chegada), fim do turno.
- [ ] 4.2 `npm run trilha` imprime uma linha por turno com esses tempos, e o JSON os guarda.
- [ ] 4.3 Teste do cálculo com carimbos sintéticos (nenhuma rede): os quatro números batem.

## 5. Custo por turno

- [ ] 5.1 Ler `usageMetadata` do servidor e guardar por turno (entrada, saída, total).
- [ ] 5.2 A trilha mostra o acumulado da sessão; o relatório do aluno também.
- [ ] 5.3 Teste: frame de uso não conta como "o modelo respondeu" (ele não abre turno nem reinicia
      o relógio de silêncio — defeito que a PoC do Orbit pagou e nós já evitamos; o teste fixa).

## 6. Portão

- [ ] 6.1 `npm test` verde.
- [ ] 6.2 Uma trilha de aula simulada (20+ turnos, dublê) com os tempos e o uso em cada turno,
      salva em `artifacts/sessoes/` como prova para a dissertação.
- [ ] 6.3 Uma trilha AO VIVO curta confirmando que os tempos medidos batem com o relógio de parede.
