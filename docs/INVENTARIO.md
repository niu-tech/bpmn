# Inventário de dependências
> **Gerado** por `node tools/inventario.mjs` — não edite à mão. Tabela escrita à mão envelhece
> na primeira atualização e passa a mentir com cara de rigor.
Gerado em 2026-11-14 · **9 dependências diretas**, 378 no total com as transitivas.
## Runtime — vão para o navegador do aluno

São as que o aluno baixa ao abrir a página. Cada uma precisa de motivo, não só de uso.

| Pacote | Versão instalada | Faixa declarada | Licença |
|---|---|---|---|
| `bpmn-js` | 18.12.0 | ^18.12.0 | SEE LICENSE IN LICENSE |
| `bpmn-js-token-simulation` | 0.39.1 | ^0.39.1 | MIT |
| `bpmn-moddle` | 9.0.4 | ^9.0.2 | MIT |
| `tinyqueue` | 3.0.0 | ^3.0.0 | ISC |

## Desenvolvimento — não vão para o aluno

Empacotamento e servidor local. Não existem no site publicado.

| Pacote | Versão instalada | Faixa declarada | Licença |
|---|---|---|---|
| `css-loader` | 7.1.3 | ^7.1.3 | MIT |
| `style-loader` | 4.0.0 | ^4.0.0 | MIT |
| `webpack` | 5.105.0 | ^5.105.0 | MIT |
| `webpack-cli` | 6.0.1 | ^6.0.1 | MIT |
| `webpack-dev-server` | 5.2.3 | ^5.2.3 | MIT |

## O que NÃO há aqui
- **Nenhuma dependência de IA.** A conversa com o Gemini Live é WebSocket e JSON escritos à mão
  (`src/assistant/live/protocol.js`): sem SDK, sem cliente gerado.
- **Nenhum framework de interface.** O painel é `document.createElement` e uma folha de estilo.
- **Nenhuma biblioteca de teste.** O arnês é `node:assert` e 40 linhas em `tools/test-harness.mjs`.
- **Nenhuma dependência nova veio da colheita da cápsula**: o que foi trazido são módulos puros,
  copiados e traduzidos.