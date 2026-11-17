/**
 * Fase F7 — as quatro ferramentas que ESCREVEM no diagrama.
 *
 * O que cada bloco protege, em uma frase:
 *  - **toda escrita passa pelo `modeling`** (tarefa 3.5): é ele que registra no `commandStack`, e
 *    é o commandStack que faz o `Ctrl+Z` do aluno desfazer o que o agente fez. Um dublê de
 *    modelador registra as chamadas e o teste afirma que nenhuma tocou XML ou `businessObject`;
 *  - **confirmação é LIDA de volta**: se o registro não mudou, a ferramenta falha com
 *    `nada_mudou` em vez de devolver sucesso. Chamada que não estoura e não muda nada é o jeito
 *    mais fácil de o instrumento mentir;
 *  - **remover pede confirmação na interface** e recusa do aluno é FATO que volta ao modelo —
 *    sem isso ele narra a remoção como feita;
 *  - **`diagrama_mudou` (H14)**: se o desenho mudou entre o pedido e o clique, não apaga. O `id`
 *    de então pode ser outro elemento agora;
 *  - **página que só lê recusa as quatro**, mesmo que a declaração tenha vazado;
 *  - o tipo da ligação **não é escolhido por nós**: entre pools o bpmn-js faz `MessageFlow`, e o
 *    retorno diz qual nasceu;
 *  - **a VAGA também não é escolhida por nós**: o elemento ancorado nasce onde o `autoPlace` do
 *    bpmn-js disser, que é o mesmo serviço do botão de append do aluno. Omitir a posição cai no
 *    `AppendBehavior`, que usa um ponto fixo e nasce POR CIMA do vizinho num diagrama cheio
 *    (print do portão F7, 2026-11-14).
 *
 * Run: node src/assistant/__tests__/escrita.mjs
 */
import assert from 'node:assert/strict';

import { ERROS_ESCRITA, TIPOS_CRIAVEIS, criarExecutoresDeEscrita } from '../tools/escrita.js';
import { criarAcessoBpmn } from '../tools/bpmn-api.js';
import { permitida } from '../agent/policy.js';
import { FERRAMENTAS } from '../agent/catalog.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';
// O dublê do modelador mora em `tools/`: a avaliação do acervo dourado usa o MESMO.
import { criarModeladorFalso } from '../../../tools/modelador-falso.mjs';


/** Viewer: o `.get('modeling')` estoura, como no `NavigatedViewer` de verdade. */
function criarViewerFalso() {
  const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: {} };
  const tarefa = { id: 'Task_1', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Montar' } };
  const mapa = new Map([[raiz.id, raiz], [tarefa.id, tarefa]]);
  return {
    get(nome) {
      if (nome === 'elementRegistry') {
        return { getAll: () => [...mapa.values()], get: (id) => mapa.get(id) ?? null };
      }
      if (nome === 'selection') return { get: () => [] };
      if (nome === 'eventBus') return { on() {}, off() {} };
      throw new Error(`sem ${nome}`);
    },
  };
}

function montar({ confirmar = async () => true, semVaga = false, updateLabelMudo = false, semNomeNaCriacao = false } = {}) {
  const falso = criarModeladorFalso({ semVaga, updateLabelMudo, semNomeNaCriacao });
  const acesso = criarAcessoBpmn(falso.modelador);
  const pedidos = [];
  const exec = criarExecutoresDeEscrita({
    acesso,
    pedirConfirmacao: async (pedido) => { pedidos.push(pedido); return confirmar(pedido); },
  });
  return { ...falso, acesso, exec, pedidos };
}

/* ---------------------------------------------------------------- a camada fina */

test('o modelador é editável e o viewer não — a flag vem de PEDIR `modeling`, não de parâmetro', () => {
  assert.equal(criarAcessoBpmn(criarModeladorFalso().modelador).editavel, true);
  assert.equal(criarAcessoBpmn(criarViewerFalso()).editavel, false);
  assert.equal(criarAcessoBpmn(null).editavel, false);
});

test('acesso inerte não é no-op silencioso: escrever nele estoura com nome', () => {
  const inerte = criarAcessoBpmn(null);
  // No-op silencioso faria o agente narrar uma criação que não houve.
  assert.throws(() => inerte.criarSolto({ tipo: 'bpmn:Task' }), /pagina_somente_leitura/);
  assert.throws(() => inerte.remover({ el: {} }), /pagina_somente_leitura/);
});

/* ---------------------------------------------------------------- criar */

testAsync('criar com âncora devolve o elemento E a ligação que nasceu junto', async () => {
  const { exec, mapa, raiz, guardar } = montar();
  const inicio = guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  assert.equal(r.criado.tipo, 'Task');
  assert.equal(r.criado.nome, 'Receber pedido');
  assert.equal(r.ligadoA.id, 'StartEvent_1');
  // Dizer que a ligação já existe é o que impede o agente de ligar de novo e duplicar o fluxo.
  assert.equal(r.ligacao.tipo, 'SequenceFlow');
  assert.ok(mapa.has(r.criado.id));
});

testAsync('a VAGA do elemento ancorado vem do bpmn-js, não de um cálculo nosso', async () => {
  // ⚠ Este teste nasceu de um PRINT: no diagrama de 48 elementos da pizzaria, a tarefa criada
  // apareceu por cima da vizinha. A causa não era a vaga errada — era vaga NENHUMA: posição
  // ausente faz o `AppendBehavior` do bpmn-js usar `source.x + width + 80` sem olhar o que já
  // está desenhado. A vaga sai do evento `autoPlace`, o mesmo do botão de append do aluno.
  const { exec, chamadas, raiz, guardar } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, x: 100, y: 200, width: 36, height: 36, incoming: [], outgoing: [] });

  await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  const nomes = chamadas.map((c) => c.fn);
  assert.ok(nomes.includes('consulta.vaga'), nomes.join(','));
  const append = chamadas.find((c) => c.fn === 'appendShape');
  // O essencial: NUNCA mais `null`. Posição ausente é o defeito, não um detalhe.
  // Vaga livre ⇒ é a do bpmn-js, intacta: o empurrão só existe quando ela está ocupada.
  assert.deepEqual(append.posicao, { x: 280, y: 200 });
  assert.ok(nomes.indexOf('consulta.vaga') < nomes.indexOf('appendShape'));
});

testAsync('vaga ocupada por vizinho NÃO ligado: empurra para a direita até caber', async () => {
  // ⚠ O teto do bpmn-js, medido ao vivo (2026-11-14): a busca de vaga dele só desvia do que está
  // LIGADO à âncora. Um vizinho solto parado na vaga é ignorado, e a tarefa nasce por cima dele
  // (`_6-650`, no portão F7). Direita, não para baixo: mantém a raia e a ordem de leitura.
  const { exec, chamadas, raiz, guardar } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, x: 100, y: 200, width: 36, height: 36, incoming: [], outgoing: [] });
  // A vaga do bpmn-js seria o centro (280,200) ⇒ caixa 230..330 × 160..240. Este vizinho ocupa.
  guardar({ id: 'Task_parado', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Parado' }, x: 250, y: 160, width: 100, height: 80 });

  await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  // Um passo de largura + folga: 280 + 100 + 40.
  assert.deepEqual(chamadas.find((c) => c.fn === 'appendShape').posicao, { x: 420, y: 200 });
});

testAsync('raia NÃO é obstáculo: o elemento não foge da vaga por estar dentro de um pool', async () => {
  // ⚠ Medido ao vivo em 2026-11-14: o botão de append do PRÓPRIO bpmn-js põe a tarefa no mesmo
  // ponto que nós e ela encosta 3 px na borda da raia de cima — raias dividem borda. Enquanto a
  // raia contava como vaga ocupada, o empurrão corria os seis passos e desistia em TODO diagrama
  // com pools, que é o formato do diagrama da aula.
  const { exec, chamadas, raiz, guardar } = montar();
  const inicio = guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, x: 100, y: 200, width: 36, height: 36, incoming: [], outgoing: [] });
  // A raia cobre a vaga inteira e TEM FILHOS — é o fundo onde o elemento mora, não um vizinho.
  guardar({ id: 'Lane_1', type: 'bpmn:Lane', parent: raiz, businessObject: { name: 'clerk' }, x: 60, y: 150, width: 800, height: 124, children: [inicio] });

  await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  // A vaga do bpmn-js, intacta: nada de empurrão.
  assert.deepEqual(chamadas.find((c) => c.fn === 'appendShape').posicao, { x: 280, y: 200 });
});

testAsync('modelador montado SEM o módulo de vaga ainda cria — degrada, não quebra', async () => {
  const { exec, chamadas, raiz, guardar } = montar({ semVaga: true });
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  assert.equal(r.criado.tipo, 'Task');
  // Sem o serviço cai no append cru: cria e liga, no ponto fixo. Pior colocação, mesma garantia.
  const append = chamadas.find((c) => c.fn === 'appendShape');
  assert.ok(append);
  assert.equal(append.posicao, null);
});

testAsync('criar sem âncora cai EMBAIXO do que já está desenhado — e o retorno não finge que ligou algo', async () => {
  const { exec, chamadas, raiz, guardar } = montar();
  // Sem âncora não há de onde o bpmn-js pendurar, então a posição é nossa: ela só precisa não
  // nascer por cima. `220,200` fixo colocava o elemento solto sobre o diagrama do aluno.
  guardar({ id: 'Task_fundo', type: 'bpmn:Task', parent: raiz, businessObject: {}, x: 300, y: 400, width: 100, height: 80 });

  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });

  assert.equal(r.ligadoA, null);
  assert.equal(r.ligacao, null);
  const criar = chamadas.find((c) => c.fn === 'createShape');
  assert.ok(criar.posicao.y > 480, JSON.stringify(criar.posicao));
});

testAsync('diagrama vazio começa em cima, onde o aluno está olhando', async () => {
  const { exec, chamadas } = montar();
  await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });
  assert.deepEqual(chamadas.find((c) => c.fn === 'createShape').posicao, { x: 220, y: 200 });
});

/* ---------------------------------------------------------------- o nome CHEGA no desenho */

testAsync('o nome nasce no `businessObject` da FORMA — um comando, sem `updateLabel` de reserva', async () => {
  // ⚠ Print do portão F7 (2026-11-14): a tarefa nasceu ANÔNIMA na tela e o agente narrou o nome.
  // `createShape({ type, name })` deixa o `name` na forma e nunca no `businessObject`, que é o
  // que o desenho lê. A correção de 2026-11-15 (dívida T12) não foi voltar a mandar `name` por
  // atributo: foi escrever no businessObject DA FORMA, antes de ela entrar. Assim o nome chega
  // ao desenho e ao XML, o rótulo externo de evento/gateway sai do `LabelBehavior` no mesmo
  // comando, e o aluno desfaz a criação com UM `Ctrl+Z`.
  const { exec, chamadas, raiz, guardar } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });

  // Nenhuma chamada de criação carrega `name` COMO ATRIBUTO: aquele caminho continua morto.
  for (const c of chamadas.filter((x) => x.fn === 'appendShape' || x.fn === 'createShape')) {
    assert.equal(c.nome, undefined, c.fn);
  }
  // E nenhum comando de rótulo: um comando a mais aqui é um `Ctrl+Z` a mais para o aluno.
  assert.equal(chamadas.filter((c) => c.fn === 'updateLabel').length, 0);
  assert.equal(r.criado.nome, 'Receber pedido');
});

testAsync('nome que não pegou no desenho é `nada_mudou` — a criação não assina o que não vê', async () => {
  // O modelador aceita a chamada e não muda nada: o jeito mais fácil de o instrumento mentir.
  //
  // ⚠ Os DOIS caminhos mudos de propósito: a criação não guarda o nome da forma
  // (`semNomeNaCriacao`) E a reserva `updateLabel` também não põe. Com um só deles a tela do
  // aluno ainda fica certa — e é por isso que a reserva existe.
  const { exec, raiz, guardar } = montar({ updateLabelMudo: true, semNomeNaCriacao: true });
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /Receber pedido/.test(e.message),
  );
});

testAsync('tipo fora da lista é erro NOMEADO e a lista aceita vem na mensagem', async () => {
  const { exec } = montar();
  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'bpmn:Definitions' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /Task/.test(e.message),
  );
});

testAsync('tipo aceita `task`, `Task` e `bpmn:Task` — o aluno fala, o modelo repassa', async () => {
  for (const tipo of ['task', 'Task', 'bpmn:Task']) {
    const { exec } = montar();
    const r = await exec.criar_elemento({ tipo });
    assert.equal(r.criado.tipo, 'Task');
  }
});

testAsync('âncora que não existe não cria nada: `elemento_nao_encontrado` antes de escrever', async () => {
  const { exec, chamadas } = montar();
  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'Task', depoisDe: 'Task_999' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_ENCONTRADO && /depoisDe=Task_999/.test(e.message),
  );
  assert.equal(chamadas.length, 0);
});

/* ---------------------------------------------------------------- conectar */

testAsync('dentro do mesmo processo nasce fluxo de SEQUÊNCIA, e o retorno diz isso', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'A', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Montar' } });
  guardar({ id: 'B', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } });

  const r = await exec.conectar({ de: 'A', para: 'B' });
  assert.equal(r.tipoDaLigacao, 'SequenceFlow');
  assert.equal(r.ligou.de.nome, 'Montar');
});

testAsync('entre POOLS diferentes nasce fluxo de MENSAGEM — a regra é do bpmn-js, não nossa', async () => {
  const { exec, raiz, guardar } = montar();
  const cliente = guardar({ id: 'Pool_cliente', type: 'bpmn:Participant', parent: raiz, businessObject: { name: 'Cliente' } });
  const loja = guardar({ id: 'Pool_loja', type: 'bpmn:Participant', parent: raiz, businessObject: { name: 'Pizzaria' } });
  guardar({ id: 'A', type: 'bpmn:Task', parent: cliente, businessObject: { name: 'Pedir' } });
  guardar({ id: 'B', type: 'bpmn:Task', parent: loja, businessObject: { name: 'Receber' } });

  const r = await exec.conectar({ de: 'A', para: 'B' });
  // É deste fato que sai a explicação certa ao aluno (gate 4.4) — não de um `if` com palavra-chave.
  assert.equal(r.tipoDaLigacao, 'MessageFlow');
});

testAsync('recusa SILENCIOSA do bpmn-js vira `conexao_invalida`, nunca `{ok:true}`', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'Fim', type: 'bpmn:EndEvent', parent: raiz, businessObject: {} });
  guardar({ id: 'B', type: 'bpmn:Task', parent: raiz, businessObject: {} });
  // Silêncio virando sucesso faria o agente afirmar uma ligação que não está no desenho.
  await assert.rejects(
    () => exec.conectar({ de: 'Fim', para: 'B' }),
    (e) => e.nome === ERROS_ESCRITA.CONEXAO_INVALIDA,
  );
});

/* ---------------------------------------------------------------- renomear */

testAsync('renomear devolve o nome de antes e o de agora, lido de volta do registro', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Tarefa' } });
  const r = await exec.renomear({ id: 'T', nome: 'Assar a pizza' });
  assert.deepEqual({ id: r.id, de: r.de, para: r.para }, { id: 'T', de: 'Tarefa', para: 'Assar a pizza' });
  assert.match(r.tela, /Assar a pizza/, 'a leitura da tela acompanha toda escrita');
});

testAsync('nome vazio não vira rótulo em branco: erro nomeado', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Tarefa' } });
  await assert.rejects(() => exec.renomear({ id: 'T', nome: '   ' }), (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO);
});

/* ---------------------------------------------------------------- remover */

testAsync('remover PERGUNTA antes, e a pergunta carrega o alvo e a versão do diagrama', async () => {
  const { exec, raiz, guardar, pedidos } = montar();
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } });

  const r = await exec.remover({ id: 'T' });
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].acao, 'remover');
  assert.equal(pedidos[0].alvo.nome, 'Assar');
  assert.ok(pedidos[0].versao.includes('T'));
  assert.equal(r.removido, true);
});

testAsync('aluno recusando é FATO que volta ao modelo — e o elemento continua lá (gate 4.3)', async () => {
  const { exec, mapa, raiz, guardar, chamadas } = montar({ confirmar: async () => false });
  guardar({ id: 'T', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar' } });

  const r = await exec.remover({ id: 'T' });
  assert.equal(r.removido, false);
  assert.equal(r.recusadoPeloAluno, true);
  assert.ok(mapa.has('T'));
  // Nem o `modeling` foi tocado: a recusa acontece ANTES de qualquer comando.
  assert.equal(chamadas.filter((c) => c.fn === 'removeElements').length, 0);
});

testAsync('diagrama mudou entre o pedido e o clique: recusa com `diagrama_mudou` (H14)', async () => {
  const falso = criarModeladorFalso();
  const acesso = criarAcessoBpmn(falso.modelador);
  falso.guardar({ id: 'T', type: 'bpmn:Task', parent: falso.raiz, businessObject: { name: 'Assar' } });

  const exec = criarExecutoresDeEscrita({
    acesso,
    // O aluno demora a clicar, e nesse meio-tempo o diagrama muda. O `id` de então pode ser
    // outro elemento agora — apagar o errado por meio segundo de diferença é o pior defeito aqui.
    pedirConfirmacao: async () => {
      falso.guardar({ id: 'Outra', type: 'bpmn:Task', parent: falso.raiz, businessObject: {} });
      return true;
    },
  });

  await assert.rejects(() => exec.remover({ id: 'T' }), (e) => e.nome === ERROS_ESCRITA.DIAGRAMA_MUDOU);
  assert.ok(falso.mapa.has('T'));
});

testAsync('sem quem perguntar, não remove: fail-closed vale especialmente para o destrutivo', async () => {
  const falso = criarModeladorFalso();
  falso.guardar({ id: 'T', type: 'bpmn:Task', parent: falso.raiz, businessObject: {} });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador) });
  await assert.rejects(() => exec.remover({ id: 'T' }), (e) => e.nome === ERROS_ESCRITA.NAO_EDITAVEL);
  assert.ok(falso.mapa.has('T'));
});

/* ---------------------------------------------------------------- página que só lê */

testAsync('as quatro recusam num viewer, mesmo com a declaração vazada de outra sessão', async () => {
  const acesso = criarAcessoBpmn(criarViewerFalso());
  const exec = criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true });

  for (const [nome, args] of [
    ['criar_elemento', { tipo: 'Task' }],
    ['conectar', { de: 'Task_1', para: 'Task_1' }],
    ['renomear', { id: 'Task_1', nome: 'x' }],
    ['remover', { id: 'Task_1' }],
  ]) {
    await assert.rejects(() => exec[nome](args), (e) => e.nome === ERROS_ESCRITA.NAO_EDITAVEL, nome);
  }
});

test('a política esconde TODA ferramenta de escrita de uma página que só lê', () => {
  // ⚠ A lista cresce junto com o catálogo: `mover`, `alinhar` e `trocar_tipo` nasceram depois e
  // precisam do mesmo portão. Ferramenta de escrita nova que não entre aqui passa despercebida
  // no viewer — e o viewer é a página que o aluno abre para LER o processo de alguém.
  const nomes = ['criar_elemento', 'conectar', 'renomear', 'remover', 'mover', 'alinhar', 'trocar_tipo', 'criar_pool', 'criar_raia', 'desfazer', 'destacar'];
  for (const n of nomes) {
    assert.equal(permitida(n, { pagina: 'viewer' }), false, n);
    assert.equal(permitida(n, { pagina: 'modelador' }), true, n);
    // Default-deny também para o esquecimento: contexto ausente é o caso mais restrito.
    assert.equal(permitida(n, undefined), false, n);
  }
});

/* ---------------------------------------------------------------- toda escrita por `modeling` */

testAsync('nenhuma das quatro toca XML ou `businessObject` direto (tarefa 3.5)', async () => {
  const { exec, raiz, guardar, chamadas } = montar();
  guardar({ id: 'A', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'A' }, incoming: [], outgoing: [] });
  guardar({ id: 'B', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'B' }, incoming: [], outgoing: [] });

  await exec.criar_elemento({ tipo: 'Task', nome: 'C', depoisDe: 'A' });
  await exec.conectar({ de: 'A', para: 'B' });
  await exec.renomear({ id: 'B', nome: 'B2' });
  await exec.remover({ id: 'B' });

  // Só verbos do `modeling` — é o que garante que o `Ctrl+Z` do aluno desfaça tudo isso.
  //
  // `consulta.vaga` e `elementFactory.createShape` entram na lista porque NÃO escrevem: a
  // primeira só pergunta ao bpmn-js onde cabe, a segunda só monta o objeto. O que
  // a lista proíbe continua sendo o mesmo — XML na mão, `businessObject` direto, qualquer
  // caminho que o `commandStack` não veja.
  const permitidos = new Set([
    'appendShape', 'createShape', 'connect', 'updateLabel', 'removeElements',
    'consulta.vaga', 'elementFactory.createShape',
  ]);
  assert.deepEqual(chamadas.filter((c) => !permitidos.has(c.fn)), []);
  // 4 comandos para 4 operações: criar com nome é UM (o nome nasce no businessObject da forma,
  // divida T12), e ligar, renomear e remover são um cada. A vaga não conta — ela não escreve.
  assert.equal(chamadas.filter((c) => c.fn !== 'consulta.vaga' && c.fn !== 'elementFactory.createShape').length, 4);
});

testAsync('desfazer devolve o diagrama ao que era: o que o agente criou sai do registro (gate 4.1)', async () => {
  // O `commandStack` de verdade é do bpmn-js; o que PRECISA ser provado aqui é que toda escrita
  // nossa virou comando dele — porque é isso que faz o desfazer alcançar o trabalho do agente.
  const { exec, mapa, raiz, guardar, chamadas } = montar();
  guardar({ id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: raiz, businessObject: {}, incoming: [], outgoing: [] });
  const antes = new Set(mapa.keys());

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Receber pedido', depoisDe: 'StartEvent_1' });
  assert.ok(!antes.has(r.criado.id));

  // Desfaz na mão o que os comandos registraram — o espelho do que o commandStack faria.
  // A vaga vem antes do append e não é comando. Criar COM nome é UM comando: o nome viaja no
  // businessObject da forma, então não há `updateLabel` de reserva nenhum para desfazer depois.
  const comandos = chamadas.filter((c) => c.fn === 'appendShape' || c.fn === 'updateLabel').map((c) => c.fn);
  assert.deepEqual(comandos, ['appendShape']);
  for (const id of [...mapa.keys()]) if (!antes.has(id)) mapa.delete(id);
  assert.deepEqual([...mapa.keys()].sort(), [...antes].sort());
});

/* ---------------------------------------------------------------- onde o solto pode nascer */

/**
 * Um diagrama de COLABORAÇÃO: a raiz não recebe fluxo, os dois pools recebem.
 *
 * ⚠ Isto dubla a regra que o bpmn-js aplica de verdade, e que custou um crash ao vivo (portão
 * 4.5, 2026-11-14): `BpmnUpdater` guarda todo `bpmn:FlowElement` em `flowElements`, e uma
 * `bpmn:Collaboration` não tem essa coleção. Criar lá desenhava a forma na tela e quebrava o XML.
 */
function colaboracaoFalsa() {
  const falso = criarModeladorFalso({
    /**
     * A regra do bpmn-js, nos dois casos que importam: uma colaboração NÃO guarda fluxo (não tem
     * `flowElements`), mas RECEBE participante — é assim que o aluno acrescenta um pool a um
     * diagrama que já tem dois. Dublar só a primeira metade fazia o pool novo ser recusado.
     */
    regras: (forma, alvo) => (String(forma?.type) === 'bpmn:Participant'
      ? ['bpmn:Process', 'bpmn:Collaboration'].includes(String(alvo?.type))
      : alvo.type !== 'bpmn:Collaboration'),
  });
  falso.raiz.type = 'bpmn:Collaboration';
  const pool = (id, nome, y) => falso.guardar({
    id, type: 'bpmn:Participant', parent: falso.raiz, businessObject: { name: nome },
    x: 100, y, width: 600, height: 200, children: [],
  });
  falso.raiz.children = [pool('Pool_cliente', 'Pizza Customer', 100), pool('Pool_loja', 'Pizza vendor', 320)];
  return falso;
}

testAsync('colaboração com dois pools: a ferramenta PERGUNTA em qual, e não desenha nada', async () => {
  // Adivinhar o pool é pior que perguntar: o processo do aluno nasceria no lugar errado, e mover
  // depois é trabalho que ele não pediu. O erro carrega os NOMES para o agente poder perguntar.
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido por telefone' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /Pizza Customer/.test(e.message) && /Pizza vendor/.test(e.message),
  );
  // E NADA foi desenhado: recusa com nome é melhor que fantasma na tela.
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'createShape'), []);
});

testAsync('a leitura descreve o REGISTRO, não os argumentos da chamada', async () => {
  // Tarefa 1.3 da change `close-the-loop-with-the-canvas`. O ponto inteiro da leitura é não ser
  // uma paráfrase do pedido: a operação é aceita, o registro fica num estado que a chamada não
  // descreve, e é o registro que o modelo recebe.
  const falso = criarModeladorFalso();
  // Alguém já tinha deixado uma tarefa SOLTA no diagrama — o defeito mais comum de aluno, e algo
  // que nenhum argumento de `criar_elemento` menciona.
  falso.guardar({
    id: 'Task_orfa', type: 'bpmn:Task', parent: falso.raiz,
    businessObject: { name: 'Conferir estoque' }, incoming: [], outgoing: [],
  });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const r = await exec.criar_elemento({ tipo: 'Task', nome: 'Assar a pizza' });

  assert.match(r.tela, /Sem nenhuma ligação:/, 'a ponta solta do registro chegou ao modelo');
  assert.match(r.tela, /Conferir estoque/, 'inclusive o elemento que a chamada nunca citou');
  // E a contagem é a do registro, não "criei um": duas formas, a órfã e a nova.
  assert.match(r.tela, /com 2 formas/);
});

testAsync('a leitura cabe no turno: medida, não estimada', async () => {
  // Tarefa 2.4 — toda escrita passou a carregar um parágrafo a mais, e isso é pago pela cota do
  // aluno. O teto está em `MAX_TELA` (760); o que este teste fixa é o tamanho TÍPICO, que é o
  // que entra na conta de contexto por turno da change `sustain-a-class-session`.
  const falso = criarModeladorFalso();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const inicio = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido recebido' });
  const tarefa = await exec.criar_elemento({ tipo: 'Task', nome: 'Assar a pizza', depoisDe: inicio.criado.id });

  console.log(`      (leitura: ${inicio.tela.length} e ${tarefa.tela.length} caracteres)`);
  assert.ok(tarefa.tela.length <= 760, 'o teto declarado vale');
  assert.ok(tarefa.tela.length < 400, `a leitura típica ficou em ${tarefa.tela.length} caracteres`);
  // A linha de regra está sempre lá: é ela que o modelo lê antes de decidir mexer em algo.
  assert.match(tarefa.tela, /Você não apaga, não move e não troca o tipo/);
});

testAsync('a recusa por ambiguidade carrega os candidatos EM FORMA, e não só no texto', async () => {
  // Tarefa 4 da change `close-the-loop-with-the-canvas`. Os nomes já iam no texto e o modelo lia
  // bem; quem não lê prosa é a TELA. Sem isto, o aluno ouvia "em qual pool?" e tinha de digitar
  // a resposta — de mãos livres, olhando o desenho.
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const erro = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido' }).then(() => null, (e) => e);

  assert.ok(Array.isArray(erro.candidatos), 'a recusa traz a lista');
  assert.deepEqual(erro.candidatos.map((c) => c.id), ['Pool_cliente', 'Pool_loja']);
  assert.deepEqual(erro.candidatos.map((c) => c.nome), ['Pizza Customer', 'Pizza vendor']);
  assert.equal(erro.candidatos[0].tipo, 'Participant');
});

testAsync('duas raias possíveis: a recusa também traz os pools clicáveis', async () => {
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const erro = await exec.criar_raia({ nome: 'Atendimento' }).then(() => null, (e) => e);

  assert.equal(erro.nome, ERROS_ESCRITA.SEM_LUGAR);
  assert.deepEqual(erro.candidatos.map((c) => c.id), ['Pool_cliente', 'Pool_loja']);
});

testAsync('com `dentroDe`, o elemento nasce DENTRO do pool escolhido', async () => {
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido', dentroDe: 'Pool_loja' });

  const criar = falso.chamadas.find((c) => c.fn === 'createShape');
  assert.equal(criar.pai.id, 'Pool_loja');
  // À direita do que já está no pool (vazio ⇒ a partir da borda) e no meio da faixa.
  assert.deepEqual(criar.posicao, { x: 210, y: 420 });
  assert.equal(r.criado.nome, 'Pedido');
});

testAsync('`dentroDe` que as regras recusam é `sem_lugar`, não um elemento quebrado', async () => {
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'StartEvent', dentroDe: falso.raiz.id }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR,
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'createShape'), []);
});

testAsync('na raia, a vaga olha quem está DESENHADO dentro dela — não a lista de filhos', async () => {
  // ⚠ Print do portão 4.5 (2026-11-14): o início novo nasceu em cima do "Order received". Numa
  // colaboração o nó pertence ao POOL e a raia é uma faixa por cima, então `children` da raia vem
  // vazio e a vaga saía na borda esquerda, sobre quem já estava lá.
  const falso = colaboracaoFalsa();
  // Desenhado DENTRO do pool, mas pendurado na raiz: é esse o caso que a lista de filhos perde.
  falso.guardar({
    id: 'Event_ja_estava', type: 'bpmn:StartEvent', parent: falso.raiz, businessObject: { name: 'Order received' },
    x: 140, y: 400, width: 36, height: 36,
  });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Pedido', dentroDe: 'Pool_loja' });

  // À direita de quem já estava (borda em 140+36), mais a folga de 60 e meia largura da forma
  // (o dublê da fábrica devolve 100x80 para qualquer tipo), e no meio vertical da faixa.
  assert.deepEqual(falso.chamadas.find((c) => c.fn === 'createShape').posicao, { x: 286, y: 420 });
});

testAsync('âncora cujo pai não recebe o tipo é `sem_lugar` — e nada é desenhado', async () => {
  // "uma tarefa depois do pool X" é um pedido que o modelo faz. O pai da âncora é a colaboração,
  // que não guarda fluxo: sem este portão, o bpmn-js desenha a forma e estoura ao salvar.
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_elemento({ tipo: 'Task', nome: 'Depois do pool', depoisDe: 'Pool_loja' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /Pool_loja/.test(e.message),
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'appendShape' || c.fn === 'createShape'), []);
});

testAsync('processo simples: a raiz aceita, e o solto nasce nela sem perguntar nada', async () => {
  const falso = criarModeladorFalso({ regras: () => true });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  const r = await exec.criar_elemento({ tipo: 'StartEvent', nome: 'Início' });

  assert.equal(r.criado.tipo, 'StartEvent');
  assert.equal(falso.chamadas.find((c) => c.fn === 'createShape').pai.id, 'Process_1');
});

/* ---------------------------------------------------------------- mover, alinhar, trocar tipo
 *
 * Os três verbos que faltavam na trilha de 2026-11-14 (T14/T15). O aluno pediu, textualmente,
 * "tira o outro anterior ali e põe para a linha de cima" e disse do que nasceu: "não tá na mesma
 * linha e parece que são duas coisas diferentes; era para ser contínuo". O agente só tinha a
 * metade destrutiva do pedido — removia e não movia.
 *
 * O que estes blocos protegem: moveu de verdade (leitura de volta da geometria), alinhou de
 * verdade (o `trigger` do bpmn-js é SILENCIOSO quando a regra recusa), e trocar o tipo NÃO
 * desmonta o que o aluno ligou. */

/**
 * Um processo com geometria e DUAS RAIAS — é o diagrama em que "põe na linha de cima" tem
 * sentido. Os nós saem em escadinha de propósito: é o desenho de que o aluno reclamou.
 */
function processoComGeometria() {
  const falso = criarModeladorFalso({ regras: () => true });
  const raia = (id, nome, y) => falso.guardar({
    id, type: 'bpmn:Lane', parent: falso.raiz, businessObject: { name: nome },
    x: 100, y, width: 800, height: 200, children: [],
  });
  const deCima = raia('Lane_cima', 'Atendimento', 100);
  const deBaixo = raia('Lane_baixo', 'Cozinha', 300);
  falso.raiz.children = [deCima, deBaixo];

  const no = (id, type, nome, x, y, width = 100, height = 80) => falso.guardar({
    id, type, parent: falso.raiz, businessObject: { name: nome },
    x, y, width, height, incoming: [], outgoing: [],
  });
  const inicio = no('StartEvent_1', 'bpmn:StartEvent', 'Pedido', 140, 350, 36, 36);
  const primeira = no('Task_1', 'bpmn:Task', 'Registrar pedido', 260, 330);
  const segunda = no('Task_2', 'bpmn:Task', 'Despachar', 420, 390);

  const modeling = falso.modelador.get('modeling');
  modeling.connect(inicio, primeira);
  modeling.connect(primeira, segunda);
  falso.chamadas.length = 0; // o cenário não conta como chamada do agente
  return { ...falso, inicio, primeira, segunda, deCima, deBaixo };
}

function montarGeometria(falso = processoComGeometria()) {
  const acesso = criarAcessoBpmn(falso.modelador);
  return {
    ...falso,
    acesso,
    exec: criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true }),
  };
}

testAsync('mover para outra raia: o elemento vai para o MEIO da faixa e o pai passa a ser ela', async () => {
  const g = montarGeometria();

  const r = await g.exec.mover({ id: 'Task_2', dentroDe: 'Lane_cima' });

  // A faixa de cima vai de 100 a 300: o centro dela é 200, e o elemento tem 80 de altura.
  const depois = g.acesso.caixaDe('Task_2');
  assert.equal(depois.y + depois.h / 2, 200);
  assert.equal(depois.x, 420, 'a coluna do processo não muda sem motivo');
  assert.equal(r.andou.y, -230);
  assert.equal(r.dentroDe.nome, 'Atendimento');
  // UM comando no commandStack: o `Ctrl+Z` do aluno desfaz o movimento inteiro.
  const movimentos = g.chamadas.filter((c) => c.fn === 'moveElements');
  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].alvo, 'Lane_cima');
});

testAsync('mover relativo anda passos de 80 px — a mesma grade do autoPlace do bpmn-js', async () => {
  const g = montarGeometria();

  const r = await g.exec.mover({ id: 'Task_2', direcao: 'direita', passos: 2 });

  assert.deepEqual(r.andou, { x: 160, y: 0 });
  assert.equal(g.acesso.caixaDe('Task_2').x, 580);
});

testAsync('mover sem dizer para onde é `tipo_invalido` — e nada se mexe', async () => {
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.mover({ id: 'Task_2' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /direita/.test(e.message) && /dentroDe/.test(e.message),
  );
  await assert.rejects(
    () => g.exec.mover({ id: 'Task_2', direcao: 'nordeste' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /nordeste/.test(e.message),
  );
  assert.deepEqual(g.chamadas.filter((c) => c.fn === 'moveElements'), []);
});

testAsync('mover que NÃO move devolve `nada_mudou` — comando aceito não é desenho mudado', async () => {
  // O caso real: o bpmn-js aceita a chamada e a regra de dentro recusa o destino. Sem a leitura
  // de volta, o agente narraria "pronto, movi" sobre um desenho intacto.
  const falso = processoComGeometria();
  falso.modelador.get('modeling').moveElements = () => {};
  const g = montarGeometria(falso);

  await assert.rejects(
    () => g.exec.mover({ id: 'Task_2', direcao: 'cima' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /Task_2/.test(e.message),
  );
});

testAsync('alinhar na linha põe os centros na MESMA altura, e diz em qual', async () => {
  const g = montarGeometria();

  const r = await g.exec.alinhar({ ids: ['Task_1', 'Task_2'], eixo: 'linha' });

  const a = g.acesso.caixaDe('Task_1');
  const b = g.acesso.caixaDe('Task_2');
  assert.equal(a.y + a.h / 2, b.y + b.h / 2);
  assert.equal(r.em, a.y + a.h / 2);
  assert.equal(r.eixo, 'linha');
  assert.equal(r.alinhados.length, 2);
});

testAsync('alinhar o que JÁ está alinhado não é erro — portão que reprova a resposta certa ensina a ignorar portão', async () => {
  const g = montarGeometria();
  await g.exec.alinhar({ ids: ['Task_1', 'Task_2'], eixo: 'linha' });

  const r = await g.exec.alinhar({ ids: ['Task_1', 'Task_2'], eixo: 'linha' });

  assert.equal(r.alinhados.length, 2);
});

testAsync('alinhador SILENCIOSO devolve `nada_mudou` em vez de sucesso', async () => {
  // `AlignElements.trigger` não faz nada e não avisa quando a regra `elements.align` recusa.
  const falso = processoComGeometria();
  falso.modelador.get('alignElements').trigger = () => {};
  const g = montarGeometria(falso);

  await assert.rejects(
    () => g.exec.alinhar({ ids: ['Task_1', 'Task_2'], eixo: 'linha' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /fora de linha/.test(e.message),
  );
});

testAsync('alinhar pede dois ids e um eixo conhecido', async () => {
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.alinhar({ ids: ['Task_1'], eixo: 'linha' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /dois ids/.test(e.message),
  );
  await assert.rejects(
    () => g.exec.alinhar({ ids: ['Task_1', 'Task_2'], eixo: 'diagonal' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /linha/.test(e.message),
  );
});

testAsync('página sem o alinhamento do bpmn-js recusa com nome, não estoura', async () => {
  const falso = criarModeladorFalso({ regras: () => true, semAlinhador: true });
  falso.guardar({ id: 'A', type: 'bpmn:Task', parent: falso.raiz, businessObject: {}, x: 0, y: 0, width: 100, height: 80 });
  falso.guardar({ id: 'B', type: 'bpmn:Task', parent: falso.raiz, businessObject: {}, x: 200, y: 40, width: 100, height: 80 });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.alinhar({ ids: ['A', 'B'], eixo: 'linha' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_EDITAVEL,
  );
});

testAsync('trocar o tipo preserva o nome e as LIGAÇÕES — e devolve o id novo', async () => {
  // O caminho ingênuo (remover e criar) levaria embora as duas setas que o aluno desenhou. É por
  // isso que o verbo existe: ele pediu para mudar um símbolo, não para desmontar o processo.
  const g = montarGeometria();

  const r = await g.exec.trocar_tipo({ id: 'Task_1', tipo: 'ExclusiveGateway' });

  assert.equal(r.de.tipo, 'Task');
  assert.equal(r.para.tipo, 'ExclusiveGateway');
  assert.equal(r.para.nome, 'Registrar pedido');
  assert.notEqual(r.idNovo, 'Task_1');
  assert.equal(r.ligacoesPreservadas, 2, 'uma entrada e uma saída seguem no lugar');
  // O id antigo não existe mais: é esse fato que o modelo precisa receber.
  assert.equal(g.acesso.porId('Task_1'), null);
  const { entradas, saidas } = g.acesso.entradasESaidas(r.idNovo);
  assert.equal(entradas[0].source.id, 'StartEvent_1');
  assert.equal(saidas[0].target.id, 'Task_2');
});

testAsync('trocar para o tipo que o elemento JÁ tem é `nada_mudou`, sem tocar no desenho', async () => {
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.trocar_tipo({ id: 'Task_1', tipo: 'Task' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /já é/.test(e.message),
  );
  assert.deepEqual(g.chamadas.filter((c) => c.fn === 'bpmnReplace.replaceElement'), []);
});

/* ---------------------------------------------------------------- inserir no meio */

testAsync('inserir no meio: A -> B vira A -> novo -> B, num comando só', async () => {
  // O pedido da trilha: "esqueci de verificar o pagamento". Com `depoisDe` nasceria um RAMO.
  const g = montarGeometria();

  const r = await g.exec.criar_elemento({
    tipo: 'Task', nome: 'Verificar pagamento', entre: ['Task_1', 'Task_2'],
  });

  assert.equal(r.inseridoEntre.de.id, 'Task_1');
  assert.equal(r.inseridoEntre.para.id, 'Task_2');
  assert.equal(r.criado.nome, 'Verificar pagamento');
  // O caminho passa pelo novo: é isso que separa "inseriu" de "desenhou ao lado".
  assert.equal(g.primeira.outgoing[0].target.id, r.criado.id);
  assert.equal(g.segunda.incoming[0].source.id, r.criado.id);
  assert.deepEqual(r.religado, { entradas: 1, saidas: 1 });
  // UM `createShape`: o religamento é do bpmn-js, dentro do mesmo comando (um `Ctrl+Z`).
  assert.equal(g.chamadas.filter((c) => c.fn === 'createShape').length, 1);
});

testAsync('`entre` sem fluxo entre os dois é `sem_lugar` com os dois ids — e nada é desenhado', async () => {
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.criar_elemento({ tipo: 'Task', entre: ['StartEvent_1', 'Task_2'] }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /StartEvent_1/.test(e.message) && /Task_2/.test(e.message),
  );
  assert.deepEqual(g.chamadas.filter((c) => c.fn === 'createShape'), []);
});

testAsync('`entre` com um id só é `tipo_invalido`', async () => {
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.criar_elemento({ tipo: 'Task', entre: ['Task_1'] }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /dois ids/.test(e.message),
  );
});

testAsync('o GEMEO vira recusa: criar duas vezes o mesmo no mesmo lugar', async () => {
  // ⚠ Dois gemeos entregues ao dono em 2026-11-15: "conferir estoque" duas vezes e "Notify
  // delay" duas vezes. Nos dois o modelo criou, conferiu o desenho, nao reconheceu o proprio
  // trabalho e criou de novo — e o aluno ficou com um elemento a mais no processo dele.
  const g = montarGeometria();

  const primeiro = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Notify delay', depoisDe: 'Task_1' });
  assert.ok(primeiro.criado?.id, 'o primeiro nasce normalmente');

  const segundo = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Notify delay', depoisDe: 'Task_1' })
    .then(() => null, (err) => err);
  assert.ok(segundo, 'o segundo vira recusa');
  assert.equal(segundo.nome, 'ja_existe', 'com o nome do erro, que e o que o modelo le');
  assert.match(segundo.message, /Notify delay/, 'e o id/nome do que ja existe, para ele seguir dali');

  // E um nome DIFERENTE no mesmo lugar continua passando: a guarda e contra o gemeo, nao contra criar.
  const outro = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Avisar o cliente', depoisDe: 'Task_1' });
  assert.ok(outro.criado?.id);
});

testAsync('criar depois de quem JÁ tem saída ENCADEIA; ramo só quando pedido', async () => {
  // ⚠ Era o contrário, e custou a confiança do dono numa sessão ao vivo (2026-11-15): ele pediu
  // "cria uma tarefa conferir estoque depois do início", a âncora já tinha saída, e a tarefa
  // nasceu como RAMO PARALELO pendurado embaixo. Para quem fala, "depois do início" é a próxima
  // etapa do caminho. A decisão é do DESENHO (tem uma saída de sequência?), nunca da frase.
  const g = montarGeometria();

  const meio = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Avisar cliente', depoisDe: 'Task_1' });
  assert.ok(meio.inseridoEntre, 'entrou no meio do caminho que já existia');
  assert.equal(meio.inseridoEntre.de.id, 'Task_1');
  assert.ok(!/caminho paralelo/.test(meio.tela ?? ''), 'encadear não é ramificar');

  const ramo = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Avisar de novo', depoisDe: 'Task_1', comoRamo: true });
  assert.equal(ramo.inseridoEntre, null, 'com comoRamo o aluno pediu o segundo caminho');
  assert.match(ramo.tela, /caminho paralelo/);

  const emLinha = await g.exec.criar_elemento({ tipo: 'EndEvent', nome: 'Fim', depoisDe: 'Task_2' });
  assert.ok(!/caminho paralelo/.test(emLinha.tela), 'continuação da linha não é ramo');
});

/* ---------------------------------------------------------------- pool e raia
 *
 * O pedido que faltava: *"cria uma raia para o entregador"*. Estava fora da lista de tipos
 * criáveis de propósito — pool e raia não são "mais um elemento": o PRIMEIRO pool troca a raiz do
 * XML do aluno (`bpmn:Process` → `bpmn:Collaboration`) e adota todo o desenho, e a primeira raia
 * cria DUAS faixas. Os dois fatos vão no resultado, porque o aluno vê o desenho mudar e pediu uma
 * coisa pequena. */

testAsync('o primeiro pool de um processo plano ADOTA o desenho — e o resultado diz isso', async () => {
  const falso = criarModeladorFalso();
  falso.guardar({
    id: 'StartEvent_1', type: 'bpmn:StartEvent', parent: falso.raiz, businessObject: { name: 'Pedido' },
    x: 200, y: 200, width: 36, height: 36, incoming: [], outgoing: [],
  });
  falso.guardar({
    id: 'Task_1', type: 'bpmn:Task', parent: falso.raiz, businessObject: { name: 'Assar' },
    x: 300, y: 180, width: 100, height: 80, incoming: [], outgoing: [],
  });
  const acesso = criarAcessoBpmn(falso.modelador);
  const exec = criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true });

  const r = await exec.criar_pool({ nome: 'Pizzaria' });

  assert.equal(r.criado.tipo, 'Participant');
  assert.equal(r.criado.nome, 'Pizzaria');
  // Os dois fatos que explicam ao aluno por que o desenho inteiro mudou de lugar, ditos pela
  // leitura da tela: o campo por caso (`virouColaboracao`/`adotou`) foi aposentado.
  assert.match(r.tela, /virou uma colaboração/);
  assert.match(r.tela, /as 2 formas que já estavam desenhadas/);
  assert.equal(r.virouColaboracao, undefined);
  assert.equal(r.adotou, undefined);
  assert.equal(acesso.raiz().type, 'bpmn:Collaboration');
  // ⚠ A fábrica certa: participante SEM `processRef` é pool que não guarda nada.
  assert.ok(falso.chamadas.some((c) => c.fn === 'elementFactory.createParticipantShape'));
  // E o pool ENVOLVE o que adotou: criado por comando, o bpmn-js não o redimensiona sozinho —
  // conteúdo maior que 600×250 ficaria desenhado fora do próprio pool.
  const caixa = acesso.caixaDe(r.criado.id);
  assert.ok(caixa.x <= 200 - 50, `pool começa em ${caixa.x}`);
  assert.ok(caixa.x + caixa.w >= 400 + 20, `pool termina em ${caixa.x + caixa.w}`);
  assert.ok(caixa.y <= 180 - 20 && caixa.y + caixa.h >= 236 + 20);
});

testAsync('numa colaboração o pool novo nasce ABAIXO dos que já existem, sem mexer na raiz', async () => {
  const falso = colaboracaoFalsa();
  const acesso = criarAcessoBpmn(falso.modelador);
  const exec = criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true });

  const r = await exec.criar_pool({ nome: 'Entregador' });

  // Nada foi reestruturado: a leitura NÃO pode dizer que o diagrama virou colaboração (já era).
  assert.ok(!/virou uma colaboração/.test(r.tela));
  assert.match(r.tela, /O diagrama é uma colaboração/);
  assert.equal(r.poolsAntes, 2);
  assert.equal(r.totalDePools, 3);
  // Os pools de `colaboracaoFalsa` terminam em y=520; o novo entra embaixo, alinhado à esquerda.
  const caixa = acesso.caixaDe(r.criado.id);
  assert.ok(caixa.y >= 520, `nasceu em y=${caixa.y}`);
  assert.equal(caixa.x, 100);
});

testAsync('desfazer o primeiro pool devolve a raiz a processo — um Ctrl+Z, não dois', async () => {
  const falso = criarModeladorFalso();
  falso.guardar({
    id: 'Task_1', type: 'bpmn:Task', parent: falso.raiz, businessObject: { name: 'Assar' },
    x: 300, y: 180, width: 100, height: 80, incoming: [], outgoing: [],
  });
  const acesso = criarAcessoBpmn(falso.modelador);
  const exec = criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true });
  const r = await exec.criar_pool({});

  await exec.desfazer();

  assert.equal(acesso.porId(r.criado.id), null);
  assert.equal(acesso.raiz().type, 'bpmn:Process');
  assert.equal(acesso.porId('Task_1').parent, falso.raiz);
});

testAsync('raia num diagrama SEM pool é `sem_lugar` com o próximo passo no texto', async () => {
  // O modelo resolve isto sozinho se a recusa disser o que fazer — e não resolve com "deu erro".
  const falso = criarModeladorFalso();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_raia({ nome: 'Entregador' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /pool primeiro/.test(e.message),
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'addLane'), []);
});

testAsync('com mais de um pool, a raia PERGUNTA em qual — e devolve os nomes', async () => {
  const falso = colaboracaoFalsa();
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_raia({ nome: 'Entregador' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /Pizza Customer/.test(e.message) && /Pizza vendor/.test(e.message),
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'addLane'), []);
});

testAsync('a PRIMEIRA raia de um pool cria duas faixas, e o resultado avisa', async () => {
  const falso = colaboracaoFalsa();
  const acesso = criarAcessoBpmn(falso.modelador);
  const exec = criarExecutoresDeEscrita({ acesso, pedirConfirmacao: async () => true });

  const r = await exec.criar_raia({ nome: 'Entregador', dentroDe: 'Pool_loja' });

  assert.equal(r.criada.tipo, 'Lane');
  assert.equal(r.criada.nome, 'Entregador');
  assert.equal(r.em.id, 'Pool_loja');
  assert.equal(r.raiasAntes, 0);
  assert.equal(r.raiasAgora, 2, 'a do conteúdo que já estava lá + a nova');
  assert.match(r.tela, /passou de 0 para 2 faixas/, 'a leitura avisa a faixa que ele não pediu');
  assert.equal(r.criouAFaixaDoQueJaExistia, undefined);

  // A segunda já entra sozinha.
  const segunda = await exec.criar_raia({ nome: 'Atendimento', dentroDe: 'Pool_loja', onde: 'acima' });
  assert.equal(segunda.raiasAgora, 3);
  assert.ok(!/passou de/.test(segunda.tela), 'a segunda raia entra sozinha, sem surpresa a contar');
  assert.equal(segunda.onde, 'acima');
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'addLane').map((c) => c.lugar), ['bottom', 'top']);
});

testAsync('alvo que não é pool nem raia, e `onde` desconhecido, são recusas nomeadas', async () => {
  const falso = colaboracaoFalsa();
  falso.guardar({ id: 'Task_1', type: 'bpmn:Task', parent: falso.raiz, businessObject: {}, x: 150, y: 150, width: 100, height: 80 });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.criar_raia({ dentroDe: 'Task_1' }),
    (e) => e.nome === ERROS_ESCRITA.SEM_LUGAR && /não é um pool/.test(e.message),
  );
  await assert.rejects(
    () => exec.criar_raia({ dentroDe: 'Pool_loja', onde: 'no meio' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /abaixo/.test(e.message),
  );
  assert.deepEqual(falso.chamadas.filter((c) => c.fn === 'addLane'), []);
});

/* ---------------------------------------------------------------- desfazer e destacar */

/* ---------------------------------------------------------------- o caminho da decisao */

/**
 * Monta uma DECISAO com o primeiro caminho ja' aberto — o estado em que o modelo travava.
 *
 * ⚠ E' o cenario exato da sessao do dono (2026-11-17): o gateway tem UMA saida, e o que falta e'
 * a segunda. Com `depoisDe` isso encadeia (entra no meio do primeiro caminho), e era por ali que
 * o modelo ia, porque era a unica coisa que a declaracao oferecia.
 */
async function montarDecisao() {
  const g = montar();
  g.guardar({ id: 'Gateway_1', type: 'bpmn:ExclusiveGateway', parent: g.raiz, businessObject: { name: 'Tem componentes?' }, incoming: [], outgoing: [] });
  const primeiro = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Montar base', depoisDe: 'Gateway_1' });
  return { ...g, primeiro };
}

const saidasDe = (acesso, id) => acesso.entradasESaidas(id).saidas;

testAsync('ramificar abre a SEGUNDA saida da decisao — nao encadeia na primeira', async () => {
  const { exec, acesso, primeiro } = await montarDecisao();
  assert.equal(saidasDe(acesso, 'Gateway_1').length, 1, 'o primeiro caminho deveria existir');

  const r = await exec.ramificar({ decisao: 'Gateway_1', tipo: 'Task', nome: 'Gerar resultado', rotulo: 'N\u00e3o' });

  const saidas = saidasDe(acesso, 'Gateway_1');
  assert.equal(saidas.length, 2, 'a decisao ficou com um caminho so');
  // E o primeiro caminho continua INTEIRO: encadear teria posto o novo no meio dele.
  const alvos = saidas.map((c) => c.target.id);
  assert.ok(alvos.includes(primeiro.criado.id), 'o primeiro caminho foi quebrado');
  assert.ok(alvos.includes(r.criado.id), 'o caminho novo nao saiu da decisao');
});

testAsync('o ROTULO fica na seta, e o id dela nunca precisa sair daqui', async () => {
  const { exec, acesso } = await montarDecisao();
  const r = await exec.ramificar({ decisao: 'Gateway_1', tipo: 'Task', nome: 'Gerar resultado', rotulo: 'N\u00e3o' });

  const seta = acesso.porId(r.caminho.id);
  assert.equal(seta.businessObject.name, 'N\u00e3o', 'a seta ficou sem o rotulo do caminho');
  // O contrato com o modelo: ele recebe o rotulo, nunca precisa carregar o id da ligacao.
  assert.equal(r.caminho.rotulo, 'N\u00e3o');
  assert.equal(r.caminhosDaDecisao, 2, 'o resultado deveria contar os caminhos da decisao');
  assert.equal(r.rotulados, 1, 'so o caminho novo tem rotulo neste ponto');
});

testAsync('caminho com rotulo so sai de DECISAO, e a recusa diz o que usar no lugar', async () => {
  const { exec, raiz, guardar } = montar();
  guardar({ id: 'Task_1', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Receber' }, incoming: [], outgoing: [] });

  await assert.rejects(
    () => exec.ramificar({ decisao: 'Task_1', tipo: 'Task', rotulo: 'Sim' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /comoRamo/.test(e.message),
  );
});

testAsync('caminho sem rotulo e recusado: seta sem resposta nao e caminho de decisao', async () => {
  const { exec } = await montarDecisao();
  await assert.rejects(
    () => exec.ramificar({ decisao: 'Gateway_1', tipo: 'Task', rotulo: '   ' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /rotulo|r\u00f3tulo/i.test(e.message),
  );
});

testAsync('a leitura da tela conta os caminhos de cada decisao', async () => {
  const { exec, acesso } = await montarDecisao();
  // Um caminho, nenhum rotulo: a decisao esta' pela metade e o fato tem de estar legivel.
  assert.deepEqual(acesso.caminhosDe('Gateway_1'), { caminhos: 1, rotulados: 0 });

  await exec.ramificar({ decisao: 'Gateway_1', tipo: 'Task', nome: 'Gerar resultado', rotulo: 'N\u00e3o' });
  assert.deepEqual(acesso.caminhosDe('Gateway_1'), { caminhos: 2, rotulados: 1 });
});

testAsync('desfazer pela conversa é a MESMA pilha do Ctrl+Z: criar com nome é UM passo (T12)', async () => {
  // A declaração promete isto ao modelo, então o teste cobra. Era o contrário até 2026-11-15:
  // criar com nome custava dois `Ctrl+Z` (a forma e o rótulo), e a primeira desfeita deixava na
  // tela uma caixa anônima que o aluno não pediu. Promessa na descrição sem portão apodrece.
  const g = montarGeometria();
  const criado = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Verificar pagamento', depoisDe: 'Task_2' });
  assert.equal(g.acesso.porId(criado.criado.id).businessObject.name, 'Verificar pagamento');

  const unico = await g.exec.desfazer();
  assert.equal(unico.desfeito, true);
  assert.equal(unico.desfeitos, 1);
  // UMA desfeita tira o elemento, o nome e a ligação — não sobra forma anônima na tela.
  assert.ok(unico.sairamDoDiagrama.includes(criado.criado.id));
  assert.equal(g.acesso.porId(criado.criado.id), null);
});

testAsync('desfazer EM LOTE volta o turno inteiro, e conta o que de fato voltou (E1)', async () => {
  // O agente escreveu três vezes no mesmo turno e o aluno diz "desfaz isso tudo". Um `undo` por
  // chamada fazia o modelo gastar um turno por comando; `quantos` resolve em uma chamada.
  const g = montarGeometria();
  const a = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Primeira', depoisDe: 'Task_2' });
  const b = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Segunda', depoisDe: a.criado.id });
  const c = await g.exec.criar_elemento({ tipo: 'Task', nome: 'Terceira', depoisDe: b.criado.id });

  const lote = await g.exec.desfazer({ quantos: 3 });
  assert.equal(lote.desfeitos, 3);
  assert.equal(lote.pedidos, 3);
  for (const id of [a.criado.id, b.criado.id, c.criado.id]) assert.equal(g.acesso.porId(id), null);
});

testAsync('pedir mais do que a pilha tem desfaz o que dá — e DIZ quantos, sem inventar', async () => {
  // "Desfiz 9" numa pilha de 1 seria a ferramenta assinando o que não aconteceu. E o teto de 10
  // existe porque a pilha é a MESMA do aluno: um lote maior apagaria o trabalho dele.
  const g = montarGeometria();
  await g.exec.criar_elemento({ tipo: 'Task', nome: 'Só uma', depoisDe: 'Task_2' });

  const lote = await g.exec.desfazer({ quantos: 99 });
  assert.equal(lote.desfeitos, 1);
  assert.equal(lote.pedidos, 10);
  assert.equal(lote.aindaDaParaDesfazer, false);
});

testAsync('desfazer com a pilha vazia é `nada_mudou` — não "pronto, desfiz"', async () => {
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.desfazer(),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /nada para desfazer/.test(e.message),
  );
});

testAsync('página sem histórico de comandos recusa desfazer com nome', async () => {
  const falso = criarModeladorFalso({ semPilha: true });
  const exec = criarExecutoresDeEscrita({ acesso: criarAcessoBpmn(falso.modelador), pedirConfirmacao: async () => true });

  await assert.rejects(
    () => exec.desfazer(),
    (e) => e.nome === ERROS_ESCRITA.NAO_EDITAVEL,
  );
});

testAsync('destacar pinta no DI — e a cor é LIDA de volta de onde o desenho a lê', async () => {
  const g = montarGeometria();

  const r = await g.exec.destacar({ ids: ['Task_1', 'Task_2'], cor: 'vermelho' });

  assert.equal(r.cor, 'vermelho');
  assert.equal(r.destacados.length, 2);
  assert.equal(g.acesso.corDe('Task_1').fundo, '#FFCDD2');
  assert.equal(g.acesso.corDe('Task_2').borda, '#E53935');
});

testAsync('destacar com `nenhuma` limpa a cor', async () => {
  const g = montarGeometria();
  await g.exec.destacar({ ids: ['Task_1'], cor: 'verde' });

  await g.exec.destacar({ ids: ['Task_1'], cor: 'nenhuma' });

  assert.equal(g.acesso.corDe('Task_1').fundo, null);
});

testAsync('cor fora da paleta e lista vazia são `tipo_invalido` — e nada é pintado', async () => {
  // Cor livre vinda do modelo põe cinza sobre cinza, e quem perde a leitura do diagrama é o aluno.
  const g = montarGeometria();

  await assert.rejects(
    () => g.exec.destacar({ ids: ['Task_1'], cor: 'ciano' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO && /vermelho/.test(e.message),
  );
  await assert.rejects(
    () => g.exec.destacar({ ids: [], cor: 'verde' }),
    (e) => e.nome === ERROS_ESCRITA.TIPO_INVALIDO,
  );
  assert.deepEqual(g.chamadas.filter((c) => c.fn === 'setColor'), []);
});

testAsync('cor que não pega devolve `nada_mudou`', async () => {
  const falso = processoComGeometria();
  falso.modelador.get('modeling').setColor = () => {};
  const g = montarGeometria(falso);

  await assert.rejects(
    () => g.exec.destacar({ ids: ['Task_1'], cor: 'azul' }),
    (e) => e.nome === ERROS_ESCRITA.NAO_MUDOU && /Task_1/.test(e.message),
  );
});

/* ---------------------------------------------------------------- catálogo */

test('os tipos criáveis são uma lista fechada e pequena: o que cabe num processo de aula', () => {
  assert.ok(TIPOS_CRIAVEIS.length > 10 && TIPOS_CRIAVEIS.length < 30);
  // `bpmn:Definitions` e companhia travam o modelador de formas que o aluno não sabe desfazer.
  for (const proibido of ['Definitions', 'Process', 'Collaboration', 'Participant', 'Lane']) {
    assert.ok(!TIPOS_CRIAVEIS.includes(proibido), proibido);
  }
});

test('toda ferramenta que ESCREVE tem executor, nome coerente e portão no viewer', () => {
  // ⚠ Portão ESTRUTURAL, e é o que protege a PRÓXIMA ferramenta: declarar no catálogo sem rotear
  // um executor vira `ferramenta_nao_roteada` no meio da conversa — que o aluno lê como o
  // ajudante quebrado. A lista por nome, logo acima, não pega a que nascer amanhã.
  const falso = criarModeladorFalso();
  const exec = criarExecutoresDeEscrita({
    acesso: criarAcessoBpmn(falso.modelador),
    pedirConfirmacao: async () => true,
  });
  const escritoras = FERRAMENTAS.filter((f) => f.escreve);
  assert.ok(escritoras.length >= 11, `só ${escritoras.length} ferramentas de escrita no catálogo`);
  for (const f of escritoras) {
    assert.equal(typeof exec[f.nome], 'function', `${f.nome} declarada e não roteada`);
    assert.equal(f.declaracao?.name, f.nome, `${f.nome} com nome divergente na declaração`);
    assert.equal(permitida(f.nome, { pagina: 'viewer' }), false, `${f.nome} aparece no viewer`);
  }
});

report('escrita');
