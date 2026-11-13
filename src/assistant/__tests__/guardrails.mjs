/**
 * Fase F5 — guardrails provados.
 *
 * O portão desta fase (openspec/roadmap.md) é AO VIVO: receita de bolo é recusada; *"como modelo
 * uma pizzaria em BPMN?"* **não** é recusada; e elemento fora da amostra não é declarado
 * inexistente. Aqui fica a metade determinística — o que precisa ser verdade antes de pedir
 * qualquer coisa ao modelo.
 *
 * O que cada bloco protege, em uma frase:
 *  - default-deny é o default de verdade, inclusive quando o chamador esquece o contexto;
 *  - política é decidida por CONTEXTO (página, modo), nunca pelo texto do aluno — olhar o texto
 *    para liberar ferramenta é a mesma classificação por palavra-chave que a constituição
 *    proíbe, só que com cara de segurança;
 *  - toda `toolCall` recebe resposta, inclusive a recusada e a repetida: sem isso o turno fica
 *    pendurado e o pedido seguinte cai no meio dele;
 *  - **a varredura mecânica**: nenhuma fonte do produto decide ferramenta olhando texto.
 *
 * Run: node src/assistant/__tests__/guardrails.mjs
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { FERRAMENTAS, declarada } from '../agent/catalog.js';
import { ERROS, createToolDispatcher } from '../agent/dispatch.js';
import { declaracoesPermitidas, ferramentasPermitidas, permitida } from '../agent/policy.js';
import { SECOES } from '../agent/sections.js';
import { createSession } from '../live/session.js';
import { forgetSecrets } from '../live/redact.js';
import { DELIVERY_TOOL } from '../live/protocol.js';
import { MockSocket, fakeClock, mockFactory } from '../../../tools/mock-socket.mjs';
import { codigoSemComentarios as codigo, report, test, testAsync } from '../../../tools/test-harness.mjs';

const CHAVE = 'AQ.CHAVE-SINTETICA-DE-TESTE-NAO-E-DE-NINGUEM-0123456';
const MODELADOR = { perfil: 'texto', pagina: 'modelador' };
const VIEWER = { perfil: 'texto', pagina: 'viewer' };

/** Catálogo de mentira, para provar a REGRA antes de existir ferramenta que a exerça. */
const CATALOGO_FALSO = [
  { nome: 'ler_coisa', escreve: false, declaracao: { name: 'ler_coisa' } },
  { nome: 'apagar_elemento', escreve: true, declaracao: { name: 'apagar_elemento' } },
  { nome: 'so_na_voz', escreve: false, perfis: ['voz'], declaracao: { name: 'so_na_voz' } },
];

console.log('\n▶ default-deny é o default, não um if de boa vontade');

test('nome fora do catalogo nao passa, em nenhum contexto', () => {
  for (const ctx of [MODELADOR, VIEWER, { perfil: 'voz', pagina: 'modelador' }, undefined]) {
    assert.equal(permitida('apagar_tudo', ctx), false);
    assert.equal(permitida('entregar_resposta', ctx), false, 'a entrega nao e ferramenta do catalogo');
  }
});

test('nome vazio, nulo ou esquisito e NEGADO sem explodir', () => {
  for (const nome of ['', '   ', null, undefined, 42, {}, []]) {
    assert.equal(permitida(nome, MODELADOR), false, `aceitou ${JSON.stringify(nome)}`);
  }
});

test('sem contexto nenhum, vale o caso MAIS restrito', () => {
  // Quem esquecer de passar o contexto nao pode ganhar a pagina que edita de brinde.
  assert.equal(permitida('apagar_elemento', undefined, CATALOGO_FALSO), false);
  assert.equal(permitida('ler_coisa', undefined, CATALOGO_FALSO), true);
});

console.log('\n▶ a política decide por contexto, nunca por texto');

test('ferramenta que ESCREVE nao existe no viewer', () => {
  assert.equal(permitida('apagar_elemento', MODELADOR, CATALOGO_FALSO), true);
  assert.equal(permitida('apagar_elemento', VIEWER, CATALOGO_FALSO), false);
  // E nem chega a ser DECLARADA: o modelo nao ve o que nao pode chamar.
  const nomes = declaracoesPermitidas(VIEWER, CATALOGO_FALSO).map((d) => d.name);
  assert.deepEqual(nomes, ['ler_coisa', 'so_na_voz'].filter((n) => n !== 'so_na_voz'));
});

test('ferramenta restrita a um perfil so aparece nele', () => {
  const noTexto = ferramentasPermitidas({ perfil: 'texto', pagina: 'modelador' }, CATALOGO_FALSO).map((f) => f.nome);
  const naVoz = ferramentasPermitidas({ perfil: 'voz', pagina: 'modelador' }, CATALOGO_FALSO).map((f) => f.nome);
  assert.ok(!noTexto.includes('so_na_voz'));
  assert.ok(naVoz.includes('so_na_voz'));
});

test('hoje TODAS as ferramentas valem nos dois perfis e nas duas paginas', () => {
  // Nenhuma escreve ainda: memoria e leitura sao inofensivas numa pagina que so le. Quando a
  // primeira de escrita nascer (F7), e este teste que muda - e o do viewer ja esta escrito.
  for (const ctx of [MODELADOR, VIEWER, { perfil: 'voz', pagina: 'modelador' }]) {
    assert.deepEqual(
      ferramentasPermitidas(ctx).map((f) => f.nome),
      ['lembrar', 'descrever_diagrama', 'buscar_elemento', 'detalhar_elemento', 'resumir_simulacao'],
    );
  }
  assert.equal(declarada('lembrar'), true);
  assert.equal(declarada('apagar_tudo'), false);
});

console.log('\n▶ recusa de domínio é seção do prompt, não boa vontade');

test('a recusa existe no prompt, com a largura certa', () => {
  const recusa = SECOES.find((s) => s.id === 'recusa').render({});
  assert.match(recusa, /UMA frase/, 'recusa de tres paragrafos e moralizacao');
  const dominio = SECOES.find((s) => s.id === 'dominio').render({});
  // ⚠ A recusa nao pode comer o produto: modelar processo de QUALQUER area e o trabalho.
  assert.match(dominio, /pizzaria, hospital, financeiro/);
  assert.match(dominio, /O tema do processo não limita você/);
});

test('a secao da amostra proibe afirmar inexistencia', () => {
  const amostra = SECOES.find((s) => s.id === 'amostra').render({});
  assert.match(amostra, /nunca que não existe/);
  assert.match(amostra, /diga\s+que precisa procurar/);
});

console.log('\n▶ toda toolCall recebe resposta — inclusive a recusada e a repetida');

await testAsync('recusada NAO executa, e volta com erro nomeado', async () => {
  let tocou = false;
  const d = createToolDispatcher({
    permitido: (nome) => permitida(nome, MODELADOR),
    executores: { apagar_tudo: async () => { tocou = true; } },
  });
  const [r] = await d.despachar([{ id: 'x1', name: 'apagar_tudo', args: {} }]);
  assert.equal(r.response.ok, false);
  assert.equal(r.response.erro, ERROS.NAO_PERMITIDA);
  assert.equal(tocou, false, 'o executor nao pode nem ser tocado');
});

function sessaoPronta(opcoes = {}) {
  const clock = fakeClock();
  const s = createSession({ apiKey: CHAVE, socketFactory: mockFactory(), clock, ...opcoes });
  s.start();
  const ws = MockSocket.instances.at(-1);
  ws.open();
  ws.emit({ setupComplete: {} });
  return { s, ws, clock };
}

await testAsync('duas chamadas no mesmo frame: UMA resposta para cada, na ordem', async () => {
  const dispatcher = createToolDispatcher({
    permitido: (nome) => permitida(nome, MODELADOR),
    executores: { descrever_diagrama: async () => ({ total: 7 }) },
  });
  const { s, ws } = sessaoPronta({ dispatcher });
  s.ask('e ai?');
  ws.emit({
    toolCall: {
      functionCalls: [
        { id: 'a', name: 'descrever_diagrama', args: {} },
        { id: 'b', name: 'apagar_tudo', args: {} },
      ],
    },
  });
  await new Promise((r) => setTimeout(r, 10));
  const [resposta] = ws.framesOf('toolResponse');
  const rs = resposta.toolResponse.functionResponses;
  assert.deepEqual(rs.map((r) => r.id), ['a', 'b']);
  assert.equal(rs[0].response.ok, true);
  assert.equal(rs[1].response.erro, ERROS.NAO_PERMITIDA);
  forgetSecrets();
});

await testAsync('a MESMA chamada repetida e respondida as duas vezes', async () => {
  // Sem resposta a segunda, o turno fica pendurado e o pedido seguinte cai no meio dele.
  const dispatcher = createToolDispatcher({
    permitido: (nome) => permitida(nome, MODELADOR),
    executores: { descrever_diagrama: async () => ({ total: 7 }) },
  });
  const { s, ws } = sessaoPronta({ dispatcher });
  s.ask('e ai?');
  const chamada = { toolCall: { functionCalls: [{ id: 'z', name: 'descrever_diagrama', args: {} }] } };
  ws.emit(chamada);
  ws.emit(chamada);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ws.framesOf('toolResponse').length, 2);
  forgetSecrets();
});

await testAsync('entrega textual e acao no MESMO frame: as duas respondidas', async () => {
  const dispatcher = createToolDispatcher({
    permitido: (nome) => permitida(nome, MODELADOR),
    executores: { lembrar: async () => ({ guardado: true }) },
  });
  const { s, ws } = sessaoPronta({ dispatcher });
  s.ask('guarda isso');
  ws.emit({
    toolCall: {
      functionCalls: [
        { id: 'e1', name: DELIVERY_TOOL, args: { texto: 'guardei' } },
        { id: 'm1', name: 'lembrar', args: { categoria: 'fato', texto: 'x' } },
      ],
    },
  });
  await new Promise((r) => setTimeout(r, 10));
  const rs = ws.framesOf('toolResponse')[0].toolResponse.functionResponses;
  assert.deepEqual(rs.map((r) => r.id).sort(), ['e1', 'm1']);
  forgetSecrets();
});

console.log('\n▶ varredura mecânica: nada decide ferramenta por palavra-chave');

/** Fontes do PRODUTO: sem testes, sem spike, sem ferramenta de medição. */
function fontesDoProduto(dir = 'src/assistant', saida = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === '__tests__') continue;
    const caminho = join(dir, entrada.name).replace(/\\/g, '/');
    if (entrada.isDirectory()) fontesDoProduto(caminho, saida);
    else if (caminho.endsWith('.js')) saida.push(caminho);
  }
  return saida;
}

const NOMES = FERRAMENTAS.map((f) => f.nome);
const METODOS_DE_TEXTO = ['includes', 'match', 'test', 'startsWith', 'endsWith', 'indexOf', 'search'];

test('as fontes existem (a varredura precisa ter o que varrer)', () => {
  const fontes = fontesDoProduto();
  assert.ok(fontes.length >= 10, `varredura vazia: ${fontes.length} arquivos`);
  assert.ok(fontes.includes('src/assistant/session-manager.js'));
});

test('NENHUMA fonte testa texto contra nome de ferramenta', () => {
  // A forma proibida: `if (texto.includes('lembrar')) chamar('lembrar')`. O modelo escolhe a
  // ferramenta por function calling; o nosso codigo so executa o que ele pediu.
  for (const arquivo of fontesDoProduto()) {
    const fonte = codigo(arquivo);
    for (const nome of NOMES) {
      for (const metodo of METODOS_DE_TEXTO) {
        const padrao = new RegExp(`\\.${metodo}\\s*\\(\\s*['"\`][^'"\`]*${nome}`, 'i');
        assert.ok(!padrao.test(fonte), `${arquivo}: ${metodo}() comparando texto com "${nome}"`);
      }
    }
  }
});

test('so o CATALOGO pode listar nomes de ferramenta como string', () => {
  // Dois nomes citados como literal no mesmo arquivo sao uma tabela de roteamento esperando
  // para acontecer. No catalogo isso e a declaracao; em qualquer outro lugar e despacho.
  for (const arquivo of fontesDoProduto()) {
    if (arquivo.endsWith('agent/catalog.js')) continue;
    const fonte = codigo(arquivo);
    const citados = NOMES.filter((n) => new RegExp(`['"\`]${n}['"\`]`).test(fonte));
    assert.ok(citados.length <= 1, `${arquivo}: cita ${citados.join(', ')} como string`);
  }
});

test('nenhuma fonte classifica INTENCAO do aluno por palavra', () => {
  // A classe inteira, nao so o caso das ferramentas: `intent`, `classificar`, `detectar` sobre
  // o texto. Foi assim que o CopilotSpeaker perdeu uma conversa inteira para um "chamado".
  const suspeitos = [/classificar\s*\(/i, /detectarIntencao/i, /\bintent\b\s*===?/i];
  for (const arquivo of fontesDoProduto()) {
    const fonte = codigo(arquivo);
    for (const padrao of suspeitos) {
      assert.ok(!padrao.test(fonte), `${arquivo}: cheiro de classificador de intencao (${padrao})`);
    }
  }
});

report('guardrails');
