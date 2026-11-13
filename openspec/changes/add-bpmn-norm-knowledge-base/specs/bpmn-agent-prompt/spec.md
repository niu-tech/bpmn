## ADDED Requirements

### Requirement: As duas fontes de conhecimento são declaradas ao modelo
O prompt SHALL conter uma seção estável que distingue o que vem do acervo consultável do que vem do
conhecimento geral do modelo, e SHALL entrar pelo registro de seções, sem alteração no renderizador.

#### Scenario: Seção nova não muda o renderizador
- **WHEN** a seção das duas fontes é acrescentada ao registro
- **THEN** o prompt passa a trazê-la na ordem declarada, e nenhum arquivo do renderizador é tocado

#### Scenario: Afirmação do acervo chega com fonte
- **WHEN** o agente afirma algo que veio de `consultar_norma`
- **THEN** a resposta traz a chave de citação daquele trecho

#### Scenario: Conhecimento geral é dito como conhecimento geral
- **WHEN** o agente responde algo que não consultou no acervo
- **THEN** ele diz que é conhecimento geral de BPMN, sem inventar chave de citação

#### Scenario: A seção vale nos dois perfis
- **WHEN** o prompt é montado em voz e em texto
- **THEN** a prosa da seção é idêntica nos dois, como as demais seções estáveis
