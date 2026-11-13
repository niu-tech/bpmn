## ADDED Requirements

### Requirement: O acervo é validado no build
O sistema SHALL gerar o índice do acervo a partir das páginas em `knowledge/*.md`, e o build SHALL
falhar nomeando o arquivo quando uma página violar o formato.

#### Scenario: Trecho literal sem nota de direitos reprova o build
- **WHEN** uma página declara `contentMode: verified_excerpt` e não traz `rightsNote`
- **THEN** o build falha nomeando o arquivo, e nenhum índice é publicado

#### Scenario: Chave de citação duplicada reprova o build
- **WHEN** duas páginas declaram a mesma `citationKey`
- **THEN** o build falha nomeando as duas

#### Scenario: Marca de fronteira no acervo reprova o build
- **WHEN** uma página do acervo contém a marca que delimita conteúdo do aluno
- **THEN** o build falha, porque o verbete poderia forjar o delimitador do prompt

#### Scenario: Índice é artefato, não arquivo mantido à mão
- **WHEN** uma página é editada e o build roda
- **THEN** `dist/knowledge/index.json` reflete a edição sem nenhuma alteração manual

### Requirement: Consulta ao acervo pelo modelo
O sistema SHALL declarar ao modelo a ferramenta `consultar_norma`, e a resposta SHALL trazer, para
cada acerto, `sourceId`, `title`, `contentMode`, `locator`, `citationKey`, `excerpt` e a URL da
fonte oficial.

#### Scenario: Acerto traz o trecho com a referência
- **WHEN** o modelo chama `consultar_norma` com "gateway exclusivo"
- **THEN** a resposta traz o verbete de gateways com o localizador e a chave de citação

#### Scenario: Busca sem acerto declara o tamanho do acervo
- **WHEN** a consulta não encontra nada
- **THEN** a resposta traz lista vazia **e** a contagem de verbetes do acervo, para o agente dizer
  "não está no meu acervo de N verbetes" em vez de "a norma não trata disso"

#### Scenario: Acervo indisponível não se passa por acervo vazio
- **WHEN** o carregamento do índice falha
- **THEN** a resposta é o erro nomeado `acervo_indisponivel`, e nunca uma lista vazia

#### Scenario: O índice só é baixado quando alguém pergunta
- **WHEN** a aba é aberta e nenhuma consulta acontece
- **THEN** `knowledge/index.json` não é requisitado

### Requirement: Limite de evidência declarado em cada resultado
O sistema SHALL informar em cada acerto se o conteúdo é ficha editorial do projeto
(`curated_card_only`) ou trecho conferido na fonte (`verified_excerpt`).

#### Scenario: Ficha editorial não é apresentada como texto da norma
- **WHEN** o acerto é `curated_card_only`
- **THEN** o resultado diz que é material do projeto, e o agente atribui a explicação a ele —
  não à norma da OMG

#### Scenario: Trecho conferido pode ser citado literalmente
- **WHEN** o acerto é `verified_excerpt`
- **THEN** o resultado traz o localizador que permite conferir na fonte

### Requirement: Citação inventada não chega ao aluno no modo texto
O sistema SHALL guardar as chaves de citação servidas na sessão e SHALL substituir por
`[fonte não conferida]` qualquer marca de fonte, na resposta entregue por `entregar_resposta`, que
não corresponda a uma chave servida.

#### Scenario: Chave servida passa intacta
- **WHEN** a resposta cita uma chave que a ferramenta devolveu nesta sessão
- **THEN** a citação aparece ao aluno como está

#### Scenario: Chave nunca servida é marcada
- **WHEN** a resposta cita uma chave que nenhuma consulta devolveu
- **THEN** a marca é substituída por `[fonte não conferida]` antes de a resposta aparecer

#### Scenario: O resto do texto não é reescrito
- **WHEN** uma citação é marcada como não conferida
- **THEN** o restante da resposta chega ao aluno sem alteração

#### Scenario: A assimetria do modo voz é declarada
- **WHEN** a sessão está em voz
- **THEN** a interface informa que a conferência de citação não se aplica, porque o áudio não passa
  pelo aplicativo
