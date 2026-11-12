## Why

O MVP entregou **transporte**: o ajudante conecta, ouve, fala, responde e não vaza a chave. O que
ele **não** tem é um agente.

Estado medido hoje (2026-11-12), lendo `src/assistant/**`:

| O que um agente precisa | O que existe no bpmn |
|---|---|
| Prompt estruturado por seções | **uma constante de 5 linhas** (`SYSTEM_INSTRUCTION`, `protocol.js:31`) com um `+` condicional para o modo texto |
| Contexto da conversa | nenhum: trocar de modo **perde tudo** e o aviso só diz que perdeu |
| Contexto do que está na tela | **nenhum** — o agente não sabe qual diagrama está aberto, nem que existe um diagrama |
| Memória entre turnos | só o que o socket guarda; recarregar a aba zera |
| Guardrail de domínio | uma frase (*"Se a pergunta não for sobre BPMN... diga isso"*) sem verificação |
| Ferramentas | nenhuma declarada no modo voz; no modo texto, **uma** (`entregar_resposta`), que é transporte, não capacidade |

O dono pediu (2026-11-12) que o ajudante passe a: conhecer BPMN a fundo, **ensinar**, saber **de
qual bloco** se está falando, **sugerir** a melhor forma de representar um processo, e ajudar a
**montar** o diagrama conversando. Nada disso é possível sem contrato de prompt, contexto e
memória — e as ferramentas de edição (change irmã) seriam perigosas sem guardrail.

A MAIA já resolveu esses quatro problemas e a solução está escrita
(`docs/wiki/concepts/prompt-assembly.md`, `concepts/tools.md`, `concepts/memory.md`). Esta change
**traz o desenho, não o tamanho**: seções tipadas, resolver único, renderizador único, memória
como quadro de contexto — sem registry de capabilities, sem políticas por conta, sem runtime
hospedado.

Há um seam pronto e **nunca usado**: `buildHistory()` (`protocol.js:148`) já monta
`clientContent` com `turnComplete: false`, que é exatamente como se semeia contexto numa sessão
Live sem abrir turno. Hoje só o teste o exercita.

## What Changes

- **Contrato de prompt em camadas.** `SYSTEM_INSTRUCTION` sai de constante e vira um **registro de
  seções** (identidade, domínio BPMN, política de recusa, política de ferramentas, estado do
  diagrama, memória), cada uma com papel e orçamento. Um resolver lê o estado uma vez; um
  renderizador emite o texto; voz e texto usam a **mesma prosa**, mudando só os botões que o
  perfil liga.
- **Quadro de contexto (Context Frame).** O que o modelo precisa saber sobre a sessão deixa de ser
  texto no `systemInstruction` e passa a ser semeado por `clientContent` ao abrir a sessão e
  atualizado em delta nos turnos digitados. É o que faz trocar de modo **não** recomeçar do zero.
- **Contexto do diagrama.** Uma projeção do que está aberto — nome do processo, contagem por tipo,
  raias, o elemento selecionado — entra no quadro de contexto. **Projeção, nunca o XML inteiro**:
  a cota é do aluno.
- **Memória da aba.** Fatos que o aluno declarou e decisões tomadas na conversa sobrevivem à troca
  de modo e à reconexão, dentro da aba. Persistência entre visitas é **decisão separada**, com
  consentimento próprio, e não entra aqui.
- **Guardrail de domínio verificável.** A recusa deixa de ser uma frase no prompt e vira seção
  declarada + cenário de bateria que pergunta algo fora do domínio e exige a recusa.
- **Catálogo de ferramentas com política default-deny**, pronto para a change irmã plugar as
  ferramentas de diagrama. Nenhuma ferramenta nova de produto aqui — só o lugar onde elas entram,
  o portão que as autoriza e a seção de prompt que as declara.

## Impact

- Afeta: `src/assistant/live/protocol.js`, `src/assistant/live/session.js`,
  `src/assistant/session-manager.js`, `src/assistant/mount.js`, `src/assistant/ui/widget.js`.
- Novos: `src/assistant/agent/**` (seções, resolver, renderizador, memória, catálogo).
- Testes: suíte `.mjs` para o contrato (determinística, sem rede) + cenários na bateria,
  incluindo um AO VIVO que confere que o agente sabe responder sobre o diagrama aberto.
- Não afeta: modelador, viewer, simulação em lote. O ajudante continua falhando sozinho.
- Depende de: nada. **Habilita**: `add-bpmn-diagram-tools`.
