> Ordem da pesquisa: por impacto. O bloco 1 é o que o retorno chamou de **crítico**.
>
> ⚠ Os nomes que o harness dirige — botões `Começar` · `Voz` · `Enviar`, e os seletores
> `.bpmn-assist__*` — **não mudam**. Redesenhar a tela não pode derrubar a prova junto.

## 1. Uma ação principal por estado (crítico)

- [x] 1.1 **Launcher único**: com o painel aberto, o botão some. Dois pontos de entrada para a
      mesma coisa é o que a pesquisa marcou como crítico
- [x] 1.2 **Compositor e voz são mutuamente exclusivos**: em voz não existe "Enviar" — não há
      mensagem para enviar. Em texto não existe controle de gravação.
      ⚠ **Estava no DOM e aparecia na tela**: havia uma SEGUNDA atribuição de `composer.hidden`
      mais abaixo no mesmo render, e ela vencia por ser a última. O print mostrou o campo de
      texto de volta ao lado do medidor — exatamente o defeito que esta change existe para
      remover. A medição é que pegou; a leitura do diff, não
- [x] 1.3 **`Encerrar` sai do seletor** e vai para um menu `⋯`: ele misturava modo de ENTRADA com
      fim de SESSÃO, com o mesmo peso visual dos outros dois
- [x] 1.4 **Menos regiões**: dica, contrato e estado consolidados; diagnóstico recolhido no menu

## 2. Estados, e a cor certa para cada um

- [x] 2.1 **Escuta deixa de ser vermelha** — verde-azulado (`#0F766E`); vermelho só para erro e
      para a ação de encerrar. Hoje "ouvindo" parece alerta
- [x] 2.2 **A tabela de estados** da pesquisa, com a frase de cada um: ocioso · conectando ·
      ouvindo · processando · consultando · falando · reconectando · erro
- [x] 2.3 **"Pode interromper falando" só quando for verdade**: em meia-duplex (o produto fecha o
      microfone ao suspeitar de eco) a frase vira *"microfone pausado durante a resposta"*

## 3. Legibilidade e acessibilidade

- [x] 3.1 Corpo 14–15 px, metadados 12–13 px, **nunca abaixo de 12**
- [ ] 3.2 Escala de espaçamento 4/8/12/16/24 e raios 16/12/10
- [x] 3.3 Foco visível em tudo que recebe foco; `prefers-reduced-motion` respeitado; o medidor é
      `aria-hidden` e o estado é `aria-live="polite"` — não se anuncia volume

## 4. Primeira utilização (BYOK)

- [ ] 4.1 Introdução curta com **uma** ação primária
- [x] 4.2 **Aviso de segurança que hoje não existe**: a chave viaja na URL do WebSocket e aparece
      nas ferramentas de rede do navegador. "Só em memória" não quer dizer invisível, e o aluno
      merece saber antes de colar
- [ ] 4.3 Consentimento **não** pré-marcado, e link de onde tirar a chave

> **Uma regra no lugar de nove.** `[hidden]` do navegador é `display:none` com peso MÍNIMO:
> qualquer `.classe { display: flex }` nossa vence o atributo, e o elemento fica na tela com o
> DOM dizendo que está escondido. Eram nove regras `[hidden]`, uma por classe, e cada elemento
> novo precisava lembrar da sua. Agora é `.bpmn-assist [hidden]`, uma só.

## 5. Prova

- [ ] 5.1 Prints dos mesmos cenários de antes, lado a lado com os antigos
- [ ] 5.2 Bateria ao vivo sem regressão — os seletores e textos que ela dirige continuam valendo
- [ ] 5.3 A marca d'água do bpmn.io continua sem sobreposição (K-G, exigência de licença)
