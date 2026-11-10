## ADDED Requirements

### Requirement: Nenhuma regressão no produto existente
O modelador em `/index.html`, o viewer em `/viewer.html` e a simulação em lote SHALL continuar
funcionando exatamente como hoje, e nenhum artefato do assistente ou do spike SHALL entrar no
grafo de módulos de produção sem a variável de ambiente que o habilita.

#### Scenario: Build de produção não contém o spike
- **WHEN** `npm run build` roda sem `BPMN_SPIKE=1`
- **THEN** `dist/` contém apenas `bundle.js` e `viewer.js` com o mesmo conjunto de módulos de
  antes da change, e nenhum arquivo de `spike/` aparece na saída

#### Scenario: Produto não depende do spike
- **WHEN** o diretório `spike/` é removido por completo
- **THEN** `npm run build` conclui e as duas páginas carregam sem erro de console

#### Scenario: Smoke do site continua passando
- **WHEN** a imagem Docker é construída e servida
- **THEN** `/`, `/viewer.html`, `/bundle.js`, `/viewer.js` e `/pizza-collaboration.bpmn` respondem
  200

### Requirement: Publicação reproduzível e versionada
Todo arquivo necessário para construir e publicar o site SHALL estar versionado no repositório, e
o pipeline SHALL validar a imagem antes de qualquer passo de implantação.

#### Scenario: Stack de deploy rastreado
- **WHEN** `git status --porcelain` roda numa árvore limpa
- **THEN** `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `deploy/**` e
  `.github/workflows/pipeline.yml` não aparecem como não rastreados

#### Scenario: Página servida pela imagem e não pelo dev server
- **WHEN** a imagem é construída
- **THEN** as páginas HTML e os diagramas estão dentro da imagem, porque o webpack emite apenas
  bundles e, em desenvolvimento, as páginas vêm de `devServer.static`

#### Scenario: Rollback declarado
- **WHEN** um deploy publica uma versão defeituosa
- **THEN** o runbook nomeia o comando que volta à anterior e a condição que caracteriza a falha

### Requirement: Transporte Live com chave do próprio aluno
A sessão SHALL ser aberta contra a API Live do Gemini usando credencial fornecida pelo aluno em
tempo de execução, e o projeto SHALL NOT embutir, versionar ou transmitir essa credencial a
qualquer destino que não seja o endpoint oficial do Google.

#### Scenario: Setup aceito pelo servidor
- **WHEN** a sessão abre com `responseModalities: ["AUDIO"]`, voz pré-construída,
  `systemInstruction` de domínio BPMN, transcrição de entrada e de saída ligadas, e a função
  `entregar_resposta` declarada
- **THEN** o servidor aceita o setup e a sessão fica pronta para receber turnos

#### Scenario: Saída TEXT é incompatível e isso é medido
- **WHEN** uma sessão de diagnóstico pede `responseModalities: ["TEXT"]`
- **THEN** o socket é fechado com código 1007 e a incompatibilidade é registrada na evidência da
  change com a medição própria, não apenas com citação de outro projeto

#### Scenario: Credencial ausente ou inválida
- **WHEN** o aluno não informou chave, ou a chave é recusada
- **THEN** o estado é `needs-key` ou `error(bad-key)` com mensagem honesta, e nenhuma tentativa
  silenciosa de reconexão ocorre

### Requirement: Isolamento da credencial
A credencial do aluno SHALL existir apenas em memória da aba enquanto a sessão durar, e SHALL NOT
ser escrita em armazenamento do navegador, em log, em mensagem de erro, na URL da página, no
bundle ou no repositório.

#### Scenario: Nenhuma persistência
- **WHEN** a sessão está ativa e depois a página é recarregada
- **THEN** nada relativo à chave permanece em `localStorage`, `sessionStorage` ou cookie, e o
  estado volta a `needs-key`

#### Scenario: Mensagem de erro mascarada
- **WHEN** uma falha de conexão produz uma mensagem que inclui a URL do WebSocket
- **THEN** o texto exibido e registrado substitui o valor da chave por uma marca fixa, e nenhum
  fragmento reconhecível da chave aparece

#### Scenario: Repositório limpo
- **WHEN** o trabalho é commitado
- **THEN** nenhum arquivo contém chave, e `.gitignore` cobre os arquivos de ambiente usados nos
  testes locais

### Requirement: Captura de áudio do navegador
A captura SHALL ser iniciada apenas por gesto explícito do usuário, apenas em contexto seguro, e
SHALL entregar ao transporte PCM16 mono a 16 kHz em quadros de 40 ms.

#### Scenario: Gesto e contexto seguro
- **WHEN** a página é servida por `http:` em host que não é `localhost`
- **THEN** o estado é `error(insecure-context)` e a permissão de microfone não é solicitada

#### Scenario: Permissão negada
- **WHEN** o usuário nega o microfone
- **THEN** o estado é `error(mic-denied)`, o texto continua disponível, e nenhum pedido automático
  é repetido

#### Scenario: Formato do quadro
- **WHEN** o contexto de áudio captura a 48 kHz
- **THEN** cada quadro emitido tem 640 amostras `Int16` e representa 40 ms a 16 kHz

#### Scenario: Liberação completa
- **WHEN** a sessão é encerrada
- **THEN** cada track é parado, os nós são desconectados, a porta do worklet é fechada, o
  `AudioContext` é fechado e o socket é fechado, nessa ordem, e o indicador de microfone do
  navegador desaparece

### Requirement: Reprodução de áudio no navegador
A reprodução SHALL consumir PCM16 mono a 24 kHz, reamostrar para a taxa do contexto, contar
underflow e overflow, e suportar cancelamento imediato.

#### Scenario: Buffer inicial
- **WHEN** o primeiro quadro de uma fala chega
- **THEN** a saída só começa após o buffer de partida, e a primeira amostra audível é sinalizada

#### Scenario: Falta de dados
- **WHEN** o fluxo atrasa e o buffer esvazia
- **THEN** a saída é preenchida com silêncio, o contador de underflow aumenta e a reprodução volta
  a aguardar o buffer de partida

#### Scenario: Cancelamento
- **WHEN** o modelo é interrompido ou o usuário fala por cima
- **THEN** o buffer é descartado e nenhuma amostra antiga é reproduzida depois da interrupção

### Requirement: Resposta textual estruturada
A resposta textual SHALL chegar pelos argumentos de uma chamada de função declarada no setup, e
cada chamada SHALL ser respondida.

#### Scenario: Pergunta digitada
- **WHEN** o aluno envia uma pergunta por texto numa sessão viva
- **THEN** a pergunta viaja como entrada textual em tempo real, o modelo chama
  `entregar_resposta`, o texto é lido dos argumentos e exibido

#### Scenario: Chamada sempre respondida
- **WHEN** uma chamada de função é recebida
- **THEN** a resposta correspondente é enviada antes do próximo pedido, e o turno conclui

#### Scenario: Chamada repetida
- **WHEN** o modelo chama a entrega mais de uma vez no mesmo turno
- **THEN** a repetição é respondida e descartada, e o texto exibido não duplica

#### Scenario: Fala sem entrega estruturada
- **WHEN** o turno termina sem nenhuma chamada de entrega
- **THEN** a transcrição da fala é usada como texto, e o registro marca que foi fallback

### Requirement: Estados e falhas nomeadas
O assistente SHALL expor um estado único e explícito, e toda falha SHALL ter razão nomeada, sem
estado travado nem retry infinito.

#### Scenario: Múltiplos turnos
- **WHEN** o aluno faz três perguntas seguidas na mesma sessão
- **THEN** cada turno conclui, a ordem das respostas corresponde à das perguntas, e nenhum resto
  de turno anterior aparece na resposta seguinte

#### Scenario: Queda de conexão
- **WHEN** o socket cai no meio de um turno
- **THEN** o estado vira `error(ws-closed:<código>)`, a reconexão respeita recuo exponencial e um
  teto de tentativas, e após o teto o estado permanece em erro visível

#### Scenario: Silêncio do servidor
- **WHEN** o servidor aceita o setup e não envia nada dentro do prazo
- **THEN** o estado vira `error(timeout)` em vez de permanecer em `connecting`

#### Scenario: Resposta truncada
- **WHEN** o turno é cortado antes do fim
- **THEN** o texto parcial é mostrado como parcial, nunca apresentado como resposta completa

### Requirement: Widget sobreposto sem tomar a tela
O assistente SHALL aparecer como botão e painel flutuantes sobre o diagrama, nas duas páginas, sem
substituir a tela, sem abrir aba nova e sem bloquear a interação com o canvas.

#### Scenario: Canvas continua utilizável
- **WHEN** o painel está aberto
- **THEN** mover, dar zoom e selecionar elementos no diagrama continuam funcionando, e no
  modelador a edição também

#### Scenario: Mesma superfície nas duas páginas
- **WHEN** o assistente é aberto em `/index.html` e em `/viewer.html`
- **THEN** o comportamento é o mesmo, e a página hospedeira não é alterada além do ponto de
  montagem

#### Scenario: Fechar encerra de verdade
- **WHEN** o painel é fechado
- **THEN** microfone, worklets e socket são liberados conforme o requisito de captura, e reabrir
  parte de `idle`
