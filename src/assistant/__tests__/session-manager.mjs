/**
 * AssistantSessionManager — modos, ciclo de vida, teardown idempotente, historico em memoria.
 * Tudo com dublês: sem rede, sem AudioContext, sem chave.
 *
 * Run: node src/assistant/__tests__/session-manager.mjs
 */
import assert from 'node:assert/strict';

import { createCredentialStore } from '../credential.js';
import { createAssistantSession, describeError, legendaVisivel } from '../session-manager.js';
import { forgetSecrets } from '../live/redact.js';
import { report, test, testAsync } from '../../../tools/test-harness.mjs';

const CHAVE = 'AQ.CHAVE-SINTETICA-DE-TESTE-NAO-E-DE-NINGUEM-0123456';

/** Dublê da sessão Live: registra o que foi pedido e deixa o teste dirigir os eventos. */
function fakeLive() {
  const criadas = [];
  const factory = (opts) => {
    let state = 'idle';
    const s = {
      opts,
      enviados: [],
      turnos: 0,
      setups: 0,
      fechada: false,
      audioEncerrado: false,
      get state() { return state; },
      get lastUsage() { return null; },
      start() { state = 'connecting'; opts.onState?.({ state, reason: null }); },
      // Como a sessao de verdade: devolve a identidade do turno E ABRE o turno.
      //
      // ⚠ O `setState('listening')` não é enfeite do dublê: é o que a `live/session.js` faz dentro
      // de `ask`. Sem ele o dublê ficava em 'pronto' com uma pergunta em voo — e aí qualquer coisa
      // que dependa de "o modelo está calado" (a fila da página, por exemplo) media o estado
      // errado e passava por engano.
      ask(t, ctx = null) {
        s.enviados.push({ tipo: 'texto', t, ctx });
        state = 'listening';
        opts.onState?.({ state, reason: null });
        return ++s.turnos;
      },
      // F3: o contexto viaja por fora do `setup`. O dublê registra os dois frames para o teste
      // poder perguntar O QUE o modelo recebeu, e não só se a chamada aconteceu.
      enviarContexto(texto) { s.enviados.push({ tipo: 'contexto', t: texto }); return true; },
      enviarHistorico(turnos) { s.enviados.push({ tipo: 'historico', turnos }); return true; },
      pushAudio(b) { s.enviados.push({ tipo: 'audio', b }); },
      endAudio() { s.audioEncerrado = true; },
      close() { s.fechada = true; state = 'idle'; },
      // gatilhos do teste
      // `pronta` = o servidor aceitou o setup. O ESTADO `ready` volta ao fim de cada turno;
      // o setup aceito, nao - e so o segundo que significa reconexao.
      pronta() { state = 'ready'; s.setups++; opts.onSetupComplete?.({ reconectou: s.setups > 1 }); opts.onState?.({ state, reason: null }); },
      fimDeTurno() { state = 'ready'; opts.onState?.({ state, reason: null }); },
      falha(reason) { state = 'error'; opts.onState?.({ state, reason }); },
      texto(t, extra = {}) { opts.onText?.({ text: t, fallback: false, complete: false, ...extra }); },
      legenda(t, side = 'output') { opts.onTranscript?.({ side, text: t }); },
      audio(b) { opts.onAudio?.(b); },
      interrompe() { opts.onInterrupted?.(); },
    };
    criadas.push(s);
    return s;
  };
  return { factory, criadas, get ultima() { return criadas.at(-1); } };
}

function fakeAudio() {
  const estado = { micsAbertos: 0, micsFechados: 0, playbacksAbertos: 0, playbacksFechados: 0, flushes: 0, quadrosTocados: 0, negarMic: null };
  const startCapture = async ({ onFrame }) => {
    if (estado.negarMic) { const e = new Error('negado'); e.reason = estado.negarMic; throw e; }
    estado.micsAbertos++;
    estado.emitir = onFrame;
    return { stop: async () => { estado.micsFechados++; } };
  };
  const startPlayback = async () => {
    estado.playbacksAbertos++;
    return {
      push() { estado.quadrosTocados++; }, flush() { estado.flushes++; }, stats() {},
      resume: async () => {}, state: 'running',
      stop: async () => { estado.playbacksFechados++; },
    };
  };
  return { estado, startCapture, startPlayback };
}

function montar(deps = {}) {
  const credentials = createCredentialStore();
  credentials.set(CHAVE);
  credentials.setConsent(true);
  const live = fakeLive();
  const audio = fakeAudio();
  const vistas = [];
  const session = createAssistantSession({
    credentials,
    onUpdate: (v) => vistas.push(v),
    deps: {
      createSession: live.factory,
      startCapture: audio.startCapture,
      startPlayback: audio.startPlayback,
      ...deps,
    },
  });
  return { session, credentials, live, audio, vistas };
}

console.log('\n▶ a queda da sessão não para a conversa');

testAsync('queda no meio da resposta: volta, avisa e REFAZ a pergunta digitada', async () => {
  // ⚠ Relato do dono (2026-11-14): "está acontecendo frequentemente a queda da sessão e nós não
  // estamos tratando isso, o que interrompe a conversa". A sessão volta sozinha (o socket calado
  // reabre), mas a PERGUNTA ia junto: a bolha de "pensando…" ficava pendurada para sempre.
  const { session, live } = montar();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('o que é um gateway exclusivo?');

  // O setup aceito de novo NA MESMA sessão é o sinal de que esta é a reconexão.
  live.ultima.pronta();

  const sistema = session.messages.filter((m) => m.role === 'system').at(-1);
  assert.match(sistema.text, /refiz a sua pergunta/i);
  const repetidas = session.messages.filter((m) => m.role === 'user' && /gateway exclusivo/.test(m.text));
  assert.equal(repetidas.length, 2, 'a pergunta perdida foi refeita');
  // E uma só bolha de espera: a antiga sai quando a nova entra.
  assert.equal(session.messages.filter((m) => m.rodando).length, 1);
});

testAsync('queda seguinte AVISA mas não refaz a mesma pergunta de novo', async () => {
  const { session, live } = montar();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('o que é um gateway exclusivo?');
  live.ultima.pronta();   // 1a queda: refaz
  live.ultima.pronta();   // 2a queda: so avisa

  const repetidas = session.messages.filter((m) => m.role === 'user' && /gateway exclusivo/.test(m.text));
  assert.equal(repetidas.length, 2, 'duas e o teto: conexão instável não vira enxurrada');
  assert.match(session.messages.filter((m) => m.role === 'system').at(-1).text, /repetir a pergunta/i);
});

testAsync('sem pergunta pendente, a volta é só um aviso curto', async () => {
  const { session, live } = montar();
  await session.connect('texto');
  live.ultima.pronta();
  live.ultima.pronta();
  assert.match(session.messages.filter((m) => m.role === 'system').at(-1).text, /caiu e voltou/i);
});

console.log('\n▶ parar de falar');

testAsync('"parar de falar" cala o RESTO do turno, não só a fila', async () => {
  // ⚠ Esvaziar a fila sozinho faria o botão parecer quebrado: o servidor continua mandando os
  // quadros do resto da resposta, e meio segundo depois a voz volta. O pedido do aluno vale até
  // o fim deste turno (relato do dono, 2026-11-14: "não temos um botão para o ajudante parar de
  // falar").
  const { session, live, audio } = montar();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('me explica o diagrama');
  live.ultima.audio('AAAA');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(audio.estado.quadrosTocados, 1, 'estava falando');

  assert.equal(session.pararDeFalar(), true);
  assert.equal(audio.estado.flushes, 1, 'o que já estava na fila morre agora');

  live.ultima.audio('BBBB');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(audio.estado.quadrosTocados, 1, 'o que chega depois do "chega" não toca');

  // E o silêncio é DESTE turno: a próxima pergunta é respondida em voz normalmente.
  session.ask('e agora?');
  live.ultima.audio('CCCC');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(audio.estado.quadrosTocados, 2, 'turno novo volta a falar');
});

testAsync('sem nada tocando, parar de falar não finge que parou', async () => {
  const { session } = montar();
  assert.equal(session.pararDeFalar(), false);
});

console.log('\n▶ o contrato na tela diz a verdade');

test('a linha de contrato segue a POLITICA, nao a pagina que alguem digitou', () => {
  // ⚠ A tela dizia "ele le o seu diagrama - nao altera nada" logo abaixo da conversa em que ele
  // acabara de criar uma tarefa (print do portao F7, 2026-11-14). A frase vem de `podeEscrever`,
  // e `podeEscrever` vem das ferramentas que a politica de fato liberou: assim as duas nunca
  // discordam. Poder sem contrato na tela e o aluno descobrindo por acidente.
  assert.equal(montar({ pagina: 'modelador' }).session.vista.podeEscrever, true);
  assert.equal(montar({ pagina: 'viewer' }).session.vista.podeEscrever, false);
  // Default-deny tambem aqui: sem pagina declarada, o contrato e o de leitura.
  assert.equal(montar().session.vista.podeEscrever, false);
});

console.log('\n▶ fail closed');

await (async () => {
  await testAsync('sem chave nao conecta, e NAO deixa recado preso', async () => {
    const credentials = createCredentialStore();
    const live = fakeLive();
    const s = createAssistantSession({ credentials, deps: { createSession: live.factory } });
    assert.equal(await s.connect('texto'), false);
    assert.equal(live.criadas.length, 0, 'nenhum socket pode ser aberto');
    // A recusa e DERIVADA na UI (a dica), nao uma mensagem guardada: mensagem guardada nao some
    // quando o aluno resolve o que faltava. Incidente 2026-11-11.
    assert.equal(s.messages.length, 0, 'recusa nao vira mensagem na conversa');
    assert.equal(s.diagnostics.count('state.recusado'), 1, 'mas fica registrada no diario');
  });

  await testAsync('com chave mas SEM consentimento tambem nao conecta', async () => {
    const credentials = createCredentialStore();
    credentials.set(CHAVE);
    const live = fakeLive();
    const s = createAssistantSession({ credentials, deps: { createSession: live.factory } });
    assert.equal(await s.connect('texto'), false);
    assert.equal(live.criadas.length, 0);
    assert.equal(s.messages.length, 0);
    forgetSecrets();
  });

  await testAsync('REGRESSAO: aceitar o aviso depois da recusa conecta e nao sobra erro antigo', async () => {
    // O que o dono viu na URL publica: marcou o aviso, conectou, e o painel seguia mostrando em
    // vermelho "aceite o aviso sobre a chave antes de conectar" ao lado de "Conectado".
    const credentials = createCredentialStore();
    credentials.set(CHAVE);
    const live = fakeLive();
    const s = createAssistantSession({ credentials, deps: { createSession: live.factory } });

    assert.equal(await s.connect('texto'), false);
    credentials.setConsent(true);
    assert.equal(await s.connect('texto'), true);

    assert.equal(live.criadas.length, 1);
    assert.equal(
      s.messages.filter((m) => m.kind === 'error').length,
      0,
      'nenhum erro pode sobreviver ao conserto do que faltava',
    );
    forgetSecrets();
  });

  await testAsync('trocar de modo SEM nada dito nao avisa nada', async () => {
    // Escolher voz logo depois de conectar nao perde contexto nenhum: o aviso ali so confunde
    // quem acabou de abrir o painel (visto no drive de UI, 2026-11-11).
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    await session.switchMode('voz');
    assert.equal(session.messages.filter((m) => m.kind === 'context-reset').length, 0);
    forgetSecrets();
  });

  test('perguntar sem sessao nao envia nada', () => {
    const { session, live } = montar();
    assert.equal(session.ask('oi'), false);
    assert.equal(live.criadas.length, 0);
    forgetSecrets();
  });

  await testAsync('chave recusada pelo servidor marca a credencial', async () => {
    const { session, credentials, live } = montar();
    await session.connect('texto');
    live.ultima.falha('bad-key');
    assert.equal(credentials.lastRejection, 'bad-key');
    assert.equal(session.state, 'error');
    forgetSecrets();
  });

  await testAsync('chave recusada DIZ ao aluno o que fazer, nao so o codigo', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.falha('bad-key');
    const textos = session.messages.map((m) => m.text).join(' ');
    assert.match(textos, /aistudio\.google\.com/, 'o conserto e do aluno: dizer onde');
    forgetSecrets();
  });

  await testAsync('a chave NAO e apagada quando o servidor recusa (daria para redigitar tudo)', async () => {
    const { session, credentials, live } = montar();
    await session.connect('texto');
    live.ultima.falha('bad-key');
    assert.equal(credentials.hasKey, true);
    forgetSecrets();
  });

  console.log('\n▶ contratos por modo');

  await testAsync('modo texto declara a funcao de entrega', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    assert.equal(live.ultima.opts.setupOptions.withDeliveryTool, true);
    forgetSecrets();
  });

  await testAsync('modo voz NAO declara a funcao (senao o modelo fica mudo)', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    assert.equal(live.ultima.opts.setupOptions.withDeliveryTool, false);
    forgetSecrets();
  });

  await testAsync('o contexto declarado CHEGA ao modelo - pelo quadro, nao pelo prompt', async () => {
    // ⚠ Ate a F2 este teste procurava o diagrama dentro do `systemInstruction`. Em F3 o
    // volatil saiu do `setup` (que e imutavel depois de aceito) e passou a viajar por
    // `clientContent`: o dado chega igual, por outro caminho, e o caminho e o ponto.
    const { session, live } = montar();
    session.definirContexto({
      diagrama: {
        total: 2,
        amostra: [
          { id: 'Task_1', tipo: 'bpmn:Task', nome: 'Assar a pizza' },
          { id: 'Task_2', tipo: 'bpmn:Task', nome: 'Entregar' },
        ],
      },
    });
    await session.connect('texto');
    const prompt = live.ultima.opts.setupOptions.systemInstruction;
    const quadro = live.ultima.enviados.find((e) => e.tipo === 'contexto')?.t ?? '';
    assert.match(quadro, /Assar a pizza/);
    assert.match(quadro, /DADOS_DO_ALUNO/, 'o dado do aluno continua delimitado no quadro');
    assert.ok(!prompt.includes('Assar a pizza'), 'o diagrama nao pode voltar para o setup');
    assert.match(prompt, /O que é dado e o que é ordem/, 'a REGRA fica no setup, imutavel');
    forgetSecrets();
  });

  await testAsync('mudar o contexto no MEIO da sessao ALCANCA o modelo (divida T6, fechada)', async () => {
    // Este teste documentava uma limitacao: o `setup` e imutavel depois de aceito, entao o agente
    // via o retrato do momento em que a sessao abriu, e criar uma tarefa durante a conversa nao
    // chegava nele. F3 fecha isso — o setup continua intocado (e tem de continuar), e o que
    // mudou vai por `clientContent` no comeco do proximo turno.
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    const antes = live.ultima.opts.setupOptions.systemInstruction;

    session.definirContexto({ diagrama: { total: 1, amostra: [{ id: 'X', tipo: 'bpmn:Task', nome: 'tarefa nova' }] } });
    assert.equal(live.ultima.opts.setupOptions.systemInstruction, antes, 'o setup NAO pode mudar');
    assert.ok(!antes.includes('tarefa nova'));

    session.ask('e agora?');
    const pergunta = live.ultima.enviados.filter((e) => e.tipo === 'texto').at(-1);
    assert.match(pergunta.ctx, /tarefa nova/, 'a mesma sessao tem de receber o que mudou');
    forgetSecrets();
  });

  await testAsync('a prosa do prompt so difere no que E DO MODO: entrega no texto, canais na voz', async () => {
    // O contrato continua sendo "nada de prosa divergente por acaso" - o que mudou e que agora ha
    // DUAS diferencas legitimas, e as duas sao do modo:
    //   texto -> "Como responder" (chamar a funcao de entrega, nao falar)
    //   voz   -> "O que nao se diz em voz alta" (id e caminho sao da tela, H2)
    const { session, live } = montar();
    await session.connect('texto');
    const texto = live.ultima.opts.setupOptions.systemInstruction;
    await session.switchMode('voz');
    const voz = live.ultima.opts.setupOptions.systemInstruction;
    assert.notEqual(texto, voz);

    assert.ok(texto.includes('## Como responder'), 'a entrega e do texto');
    assert.ok(!voz.includes('## Como responder'), 'a entrega NAO aparece na voz');
    assert.ok(voz.includes('## O que não se diz em voz alta'), 'os canais sao da voz');
    assert.ok(!texto.includes('## O que não se diz em voz alta'), 'os canais NAO aparecem no texto');

    // Tirando as duas secoes que sao do modo, o resto e identico - caracter por caracter.
    const semAsDoModo = (p) => p
      .split('## Como responder')[0]
      .split('## O que não se diz em voz alta')[0]
      .trim();
    assert.equal(semAsDoModo(texto), semAsDoModo(voz));
    forgetSecrets();
  });

  await testAsync('trocar de modo abre OUTRA sessao e fecha a anterior', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    const primeira = live.ultima;
    live.ultima.pronta();
    await session.switchMode('voz');
    assert.equal(live.criadas.length, 2);
    assert.equal(primeira.fechada, true);
    assert.equal(live.ultima.opts.setupOptions.withDeliveryTool, false);
    forgetSecrets();
  });

  await testAsync('turno aberto SEM nada dito: o aviso antigo continua valendo, palavra por palavra', async () => {
    // ⚠ Ate a F2 este teste exigia o aviso de perda SEMPRE: nao havia reconstrucao, entao
    // afirmar continuidade seria mentira. Em F3 a sessao nova nasce com o diagrama e com o
    // resumo da conversa — e o aviso passou a seguir o que de fato aconteceu. O caso sem nada a
    // reconstruir (microfone aberto, ninguem falou) continua existindo, e nele a verdade e a
    // antiga: o modelo recomeca do zero.
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();                      // abre turno, mas nenhuma fala foi transcrita
    await session.switchMode('texto');
    const aviso = session.messages.find((m) => m.kind === 'context-reset');
    assert.ok(aviso, 'sem reconstrucao, o aviso de perda e obrigatorio');
    assert.match(aviso.text, /recome[cç]a/i);
    assert.equal(live.ultima.enviados.filter((e) => e.tipo === 'historico').length, 0);
    forgetSecrets();
  });

  await testAsync('o historico VISUAL sobrevive a troca de modo', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('primeira');
    await session.switchMode('voz');
    assert.ok(session.messages.some((m) => m.role === 'user' && m.text === 'primeira'));
    forgetSecrets();
  });

  console.log('\n▶ turnos e historico');

  await testAsync('pergunta digitada vira bolha e vai para a sessao', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(session.ask('o que e um gateway?'), true);
    // `ctx: null` = sem diagrama declarado e sem modelador, nao ha quadro para viajar junto.
    assert.deepEqual(live.ultima.enviados, [{ tipo: 'texto', t: 'o que e um gateway?', ctx: null }]);
    // A bolha de ESPERA entra junto da pergunta: entre uma e a resposta nao havia nada na tela.
    const ultimas = session.messages.slice(-2).map((m) => m.role);
    assert.deepEqual(ultimas, ['user', 'assistant']);
    assert.equal(session.messages.at(-1).rodando, true, 'a de espera nasce marcada como rodando');
    forgetSecrets();
  });

  await testAsync('pergunta vazia nao conta turno nem envia', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(session.ask('   '), false);
    assert.equal(live.ultima.enviados.length, 0);
    forgetSecrets();
  });

  await testAsync('a legenda da voz CRESCE uma bolha so, nao uma por pedaco', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    session.ask('explique');
    live.ultima.legenda('Uma raia ');
    live.ultima.legenda('serve para ');
    live.ultima.legenda('organizar.');
    const doAssistente = session.messages.filter((m) => m.role === 'assistant');
    assert.equal(doAssistente.length, 1, 'uma bolha por turno');
    assert.equal(doAssistente[0].text, 'Uma raia serve para organizar.');
    forgetSecrets();
  });

  await testAsync('ferramenta rodando VIRA LINHA na conversa, e a linha vira o resultado', async () => {
    // O aluno via a resposta e nao via o que foi consultado: a ferramenta rodava invisivel, e
    // quando demorava ele nao sabia se o ajudante pensava, travou, ou se a cota acabou (H3).
    let soltar;
    const { session, live } = montar({
      acesso: {
        disponivel: () => true,
        elementos: () => [],
        porId: () => null,
        selecionado: () => null,
        entradasESaidas: () => ({ entradas: [], saidas: [] }),
        assinar: () => () => {},
      },
    });
    await session.connect('voz');
    live.ultima.pronta();
    session.ask('quantos elementos?');
    const d = live.ultima.opts.dispatcher;
    const espera = d.despachar([{ id: 'c1', name: 'descrever_diagrama', args: {} }]);
    // Enquanto roda: a linha existe e o selo NAO diz 'pronto'.
    const rodando = session.messages.filter((m) => m.role === 'tool');
    assert.equal(rodando.length, 1, 'uma linha de ferramenta');
    assert.ok(/olhando o diagrama/.test(rodando[0].text), rodando[0].text);
    assert.equal(rodando[0].rodando, true);
    assert.equal(session.state, 'tool', `o selo deveria dizer consultando, e diz ${session.state}`);
    await espera;
    const depois = session.messages.filter((m) => m.role === 'tool');
    assert.equal(depois.length, 1, 'a MESMA linha vira o resultado, nao uma linha nova');
    assert.equal(depois[0].rodando, false);
    assert.ok(!/olhando o diagrama…/.test(depois[0].text), `a linha nao virou resultado: ${depois[0].text}`);
    assert.notEqual(session.state, 'tool', 'o selo volta quando a ferramenta termina');
    forgetSecrets();
  });

  // PORTAO F3 — fallback que o filtro limpa ate nao sobrar nada TAMBEM e turno vazio.
  //
  // No modo texto o modelo as vezes fecha com um turno de audio sem fala, cuja legenda e so
  // `<no speech>`. O turno nao era `vazio` (tinha `spoken`), o filtro limpava tudo e o produto
  // saia calado: o aluno via a propria pergunta ate o relogio de 45 s dizer "o servidor nao
  // respondeu". Falso - o servidor respondeu, so nao tinha o que mostrar.
  await testAsync('fallback que vira texto vazio AVISA, nao fica calado', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('o que e um gateway?');
    live.ultima.texto('<no speech>{pause}', { fallback: true, complete: true });
    const notas = session.messages.filter((m) => m.role === 'system' || m.kind === 'error');
    const tudo = session.messages.map((m) => m.text ?? '').join(' | ');
    assert.ok(/encerrou o turno sem responder/.test(tudo), `nenhum aviso na tela: ${tudo}`);
    assert.equal(session.messages.filter((m) => m.role === 'assistant').length, 0, 'sem bolha de resposta');
    assert.ok(notas.length >= 0);
    forgetSecrets();
  });

  // DIVIDA T10 — o marcador de nao-fala chega PARTIDO entre dois pedacos da legenda.
  //
  // O filtro rodava em cada pedaco, entao `<no speech>` cortado ao meio nao casava em nenhum dos
  // dois e o rabo virava bolha: o portao F6 respondeu `"speech>"` ao vivo em 2026-11-13, e antes
  // dele o F3 tinha mostrado `"9<no speech>{pause}"`. Era o mesmo bug, e o conserto anterior so
  // cobria o caso em que o marcador cabia inteiro num pedaco.
  test('o marcador partido entre pedacos some do acumulado', () => {
    assert.equal(legendaVisivel('Uma raia <no ' + 'speech> serve.'), 'Uma raia serve.');
    assert.equal(legendaVisivel('9<no speech>{pause}'), '9');
    // Cauda que AINDA pode virar marcador fica segura ate o resto chegar.
    assert.equal(legendaVisivel('9<no spe'), '9');
    assert.equal(legendaVisivel('9{pau'), '9');
    // E o texto normal nao e tocado.
    assert.equal(legendaVisivel('Uma raia serve para organizar.'), 'Uma raia serve para organizar.');
  });

  await testAsync('legenda com marcador PARTIDO nao suja a bolha', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    session.ask('explique');
    // A fronteira dos pedacos cai NO MEIO do marcador — que e o caso que a T10 descreve.
    live.ultima.legenda('Uma raia <no ');
    live.ultima.legenda('speech>serve para ');
    live.ultima.legenda('organizar.');
    const doAssistente = session.messages.filter((m) => m.role === 'assistant');
    assert.equal(doAssistente.length, 1, 'uma bolha por turno');
    assert.equal(doAssistente[0].text, 'Uma raia serve para organizar.');
    forgetSecrets();
  });

  await testAsync('turno que so tem marcador nao cria bolha nenhuma', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    session.ask('explique');
    live.ultima.legenda('<no ');
    live.ultima.legenda('speech>');
    live.ultima.legenda('{pause}');
    // A bolha de espera existe (a pergunta foi feita), mas o marcador NAO escreve nela.
    const resp = session.messages.filter((m) => m.role === 'assistant');
    assert.equal(resp.length, 1, 'marcador nao cria bolha nova');
    assert.equal(resp[0].text, 'pensando…', 'marcador nao vira texto de resposta');
    forgetSecrets();
  });

  await testAsync('a pergunta falada em PEDACOS vira UMA bolha que cresce', async () => {
    // O consumidor empurrava uma bolha por fragmento. Com fixture curta nao aparecia; com fala de
    // verdade o aluno veria a propria pergunta picada. Agora o rastreador junta (divida H1).
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    live.ultima.legenda('O que e', 'input');
    live.ultima.legenda('O que e um gateway', 'input');
    live.ultima.legenda('O que e um gateway exclusivo?', 'input');
    const falas = session.messages.filter((m) => m.role === 'user' && m.via === 'voz');
    assert.equal(falas.length, 1, `uma bolha de fala, nao ${falas.length}`);
    assert.equal(falas[0].text, 'O que e um gateway exclusivo?');
    assert.equal(falas[0].parcial, true, 'ainda parcial: o servidor nao disse que ela acabou');
    // O primeiro audio do modelo e o servidor dizendo que o aluno parou.
    live.ultima.audio?.();
    forgetSecrets();
  });

  await testAsync('a fala fecha quando o modelo comeca a responder', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    live.ultima.legenda('quantas tarefas', 'input');
    live.ultima.legenda('saida do modelo', 'output');
    const fala = session.messages.find((m) => m.role === 'user' && m.via === 'voz');
    assert.equal(fala.parcial, false, 'a fala do aluno fechou quando o modelo comecou');
    forgetSecrets();
  });

  await testAsync('a fala do aluno entra como mensagem marcada "voz"', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    live.ultima.legenda('o que e uma pool', 'input');
    const m = session.messages.at(-1);
    assert.equal(m.role, 'user');
    assert.equal(m.via, 'voz');
    forgetSecrets();
  });

  await testAsync('historico so em memoria: um gerente novo nasce vazio', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('alguma coisa');
    assert.ok(session.messages.length > 0);
    const outro = montar();
    assert.deepEqual(outro.session.messages, []);
    forgetSecrets();
  });

  console.log('\n▶ microfone');

  await testAsync('microfone so no modo voz', async () => {
    const { session, live, audio } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(await session.startMic(), false);
    assert.equal(audio.estado.micsAbertos, 0);
    forgetSecrets();
  });

  await testAsync('abrir o microfone liga captura e reproducao', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    assert.equal(await session.startMic(), true);
    assert.equal(audio.estado.micsAbertos, 1);
    assert.equal(audio.estado.playbacksAbertos, 1, 'o mesmo gesto libera o alto-falante');
    assert.equal(session.micOn, true);
    forgetSecrets();
  });

  await testAsync('abrir duas vezes nao abre dois microfones', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await session.startMic();
    assert.equal(audio.estado.micsAbertos, 1);
    forgetSecrets();
  });

  await testAsync('fechar o microfone manda audioStreamEnd (fim de fala explicito)', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    assert.equal(await session.stopMic(), true);
    assert.equal(audio.estado.micsFechados, 1);
    assert.equal(live.ultima.audioEncerrado, true);
    assert.equal(session.micOn, false);
    forgetSecrets();
  });

  await testAsync('fechar o microfone duas vezes e inofensivo', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await session.stopMic();
    assert.equal(await session.stopMic(), false);
    assert.equal(audio.estado.micsFechados, 1);
    forgetSecrets();
  });

  await testAsync('microfone negado vira estado nomeado, sem derrubar a sessao', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    audio.estado.negarMic = 'mic-denied';
    assert.equal(await session.startMic(), false);
    assert.equal(session.reason, 'mic-denied');
    assert.equal(session.micOn, false);
    assert.match(session.messages.at(-1).text, /microfone/i);
    forgetSecrets();
  });

  await testAsync('quadros do microfone chegam a sessao', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    audio.estado.emitir('QUJD');
    assert.deepEqual(live.ultima.enviados.at(-1), { tipo: 'audio', b: 'QUJD' });
    forgetSecrets();
  });

  console.log('\n▶ encerramento');

  await testAsync('stop fecha microfone, reproducao e socket', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await session.stop();
    assert.equal(audio.estado.micsFechados, 1);
    assert.equal(audio.estado.playbacksFechados, 1);
    assert.equal(live.ultima.fechada, true);
    assert.equal(session.state, 'idle');
    forgetSecrets();
  });

  await testAsync('stop e IDEMPOTENTE: tres vezes nao fecha tres vezes', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    await Promise.all([session.stop(), session.stop(), session.stop()]);
    assert.equal(audio.estado.micsFechados, 1);
    assert.equal(audio.estado.playbacksFechados, 1);
    forgetSecrets();
  });

  await testAsync('conectar de novo nao deixa a sessao anterior viva', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    const primeira = live.ultima;
    await session.connect('texto');
    assert.equal(primeira.fechada, true);
    assert.equal(live.criadas.length, 2);
    forgetSecrets();
  });

  await testAsync('forgetKey encerra a sessao E limpa a credencial', async () => {
    const { session, credentials, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    await session.forgetKey();
    assert.equal(credentials.hasKey, false);
    assert.equal(live.ultima.fechada, true);
    assert.equal(session.state, 'idle');
  });

  await testAsync('interrupcao descarta o audio pendente (barge-in)', async () => {
    const { session, live, audio } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    await session.startMic();
    live.ultima.interrompe();
    assert.equal(audio.estado.flushes, 1);
    forgetSecrets();
  });

  console.log('\n▶ mensagens ao aluno');

  test('erro vira frase em portugues, nao codigo cru', () => {
    assert.equal(describeError('mic-denied'), 'o microfone foi negado');
    assert.equal(describeError('ws-closed:1007'), 'o servidor recusou a configuração da sessão');
    assert.match(describeError('ws-closed:1006'), /conex[aã]o caiu/);
    assert.equal(describeError(null), null);
  });

  console.log('\n▶ F3: a sessão nasce sabendo da tela, e o turno leva o que mudou');

  await testAsync('conectar SEMEIA o quadro de contexto, fora do setup', async () => {
    const { session, live } = montar();
    session.definirContexto({ diagrama: { processo: { id: 'P1', nome: 'Pizza' }, total: 1, amostra: [{ id: 'Task_1', tipo: 'Task', nome: 'Assar' }] } });
    await session.connect('texto');
    const quadros = live.ultima.enviados.filter((e) => e.tipo === 'contexto');
    assert.equal(quadros.length, 1, 'uma sessao nova, um quadro');
    assert.match(quadros[0].t, /Assar/);
    // E o setup NAO leva o diagrama: ele e imutavel depois de aceito (divida T6).
    assert.ok(!live.ultima.opts.setupOptions.systemInstruction.includes('Assar'));
  });

  await testAsync('turno seguinte sem mudanca NAO remanda o diagrama', async () => {
    const { session, live } = montar();
    session.definirContexto({ diagrama: { total: 1, amostra: [{ id: 'Task_1', tipo: 'Task', nome: 'Assar' }] } });
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('quantas tarefas?');
    const quadros = live.ultima.enviados.filter((e) => e.tipo === 'contexto');
    assert.equal(quadros.length, 1, 'o segundo quadro seria o aluno pagando duas vezes pelo mesmo texto');
    assert.equal(live.ultima.enviados.at(-1).ctx, null, 'sem mudanca, a pergunta vai sozinha');
  });

  await testAsync('o diagrama mudou antes da pergunta -> o delta vai JUNTO com ela', async () => {
    const { session, live } = montar();
    session.definirContexto({ diagrama: { total: 1, amostra: [{ id: 'Task_1', tipo: 'Task', nome: 'Assar' }] } });
    await session.connect('texto');
    live.ultima.pronta();
    session.definirContexto({ diagrama: { total: 2, amostra: [{ id: 'Task_1', tipo: 'Task', nome: 'Assar' }, { id: 'Task_2', tipo: 'Task', nome: 'Entregar' }] } });
    session.ask('e agora?');
    const ordem = live.ultima.enviados.map((e) => e.tipo);
    // ⚠ Um frame so. Em dois frames seguidos a PERGUNTA ULTRAPASSA o contexto: medido ao vivo em
    // 2026-11-13, o modelo respondia "voce nao selecionou nenhum elemento" com a selecao enviada
    // milissegundos antes. So o quadro da CONEXAO vai sozinho — ali ninguem esta perguntando.
    assert.deepEqual(ordem, ['contexto', 'texto']);
    assert.match(live.ultima.enviados[1].ctx, /Entregar/, 'o quadro tem de viajar com a pergunta');
    assert.equal(live.ultima.enviados[1].t, 'e agora?');
  });

  await testAsync('a projecao viva so e lida quando nao ha contexto declarado', async () => {
    let leituras = 0;
    const credentials = createCredentialStore();
    credentials.set(CHAVE);
    credentials.setConsent(true);
    const live = fakeLive();
    const s = createAssistantSession({
      credentials,
      deps: {
        createSession: live.factory,
        lerDiagrama: () => { leituras++; return { total: 3, amostra: [{ id: 'G1', tipo: 'ExclusiveGateway', nome: 'Tem queijo?' }] }; },
      },
    });
    await s.connect('texto');
    assert.ok(leituras >= 1, 'a pagina e a fonte quando ninguem declarou contexto');
    assert.match(live.ultima.enviados[0].t, /Tem queijo/);
    forgetSecrets();
  });

  await testAsync('trocar de modo LEVA o resumo da conversa, e o aviso conta a verdade', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('o que e um gateway?');
    live.ultima.texto('é um desvio no fluxo');

    await session.switchMode('voz');
    const historico = live.ultima.enviados.filter((e) => e.tipo === 'historico');
    assert.equal(historico.length, 1, 'a sessao nova precisa nascer com o passado');
    assert.deepEqual(historico[0].turnos.map((t) => t.role), ['user', 'model']);
    assert.match(historico[0].turnos[1].text, /desvio no fluxo/);

    // ⚠ O aviso segue a realidade: dizer "o modelo recomeca sem esse contexto" depois de levar o
    // contexto seria mentira, e aviso que mente e aviso que o aluno aprende a ignorar.
    const avisos = session.messages.filter((m) => m.role === 'system');
    assert.ok(avisos.some((m) => /levei junto/.test(m.text)), 'o aviso novo nao apareceu');
    assert.ok(!avisos.some((m) => m.kind === 'context-reset'), 'o aviso antigo nao pode sobrar');
  });

  await testAsync('o socket caiu e voltou: o contexto e semeado DE NOVO', async () => {
    // Reconexao e sessao nova do lado do servidor. O `setup` volta sozinho (o `onopen` o manda);
    // o quadro, nao — ele ja tinha saido da fila na primeira vez. Sem este reenvio o agente fica
    // cego para o diagrama ate o aluno reconectar a mao, e nada na tela diz que ele ficou cego.
    const { session, live } = montar();
    session.definirContexto({ diagrama: { total: 1, amostra: [{ id: 'T1', tipo: 'Task', nome: 'Assar' }] } });
    await session.connect('texto');
    live.ultima.pronta();
    assert.equal(live.ultima.enviados.filter((e) => e.tipo === 'contexto').length, 1);
    // Fim de turno devolve o estado para `ready` o tempo todo - e NAO pode re-semear nada.
    live.ultima.fimDeTurno();
    live.ultima.fimDeTurno();
    assert.equal(live.ultima.enviados.filter((e) => e.tipo === 'contexto').length, 1,
      'ouvir o estado em vez do setup re-semearia o contexto a cada pergunta');

    live.ultima.pronta();                          // setup aceito DE NOVO = o socket caiu e voltou
    assert.equal(live.ultima.enviados.filter((e) => e.tipo === 'contexto').length, 2);
  });

  await testAsync('sem conversa nenhuma, trocar de modo nao inventa historico', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    await session.switchMode('voz');
    assert.equal(live.ultima.enviados.filter((e) => e.tipo === 'historico').length, 0);
  });

  await testAsync('T9: texto ATRASADO volta para a bolha do turno dele', async () => {
    // Visto ao vivo nos portoes F3 e F5 (2026-11-13): o fim da resposta anterior chegava depois
    // que a pergunta seguinte ja tinha sido enviada, virava bolha nova carimbada com o turno
    // recem-aberto, e o teste - e o aluno - liam aquilo como a resposta da pergunta nova.
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();

    session.ask('quantas tarefas?');          // turno 1 na sessao
    live.ultima.texto('O diagrama tem 9 tarefas.', { turno: 1 });
    session.ask('o que e isto?');             // turno 2
    // ... e so AGORA chega o resto do turno 1.
    live.ultima.texto('O diagrama tem 9 tarefas. Posso detalhar cada uma.', { turno: 1 });

    const respostas = session.messages.filter((m) => m.role === 'assistant');
    // Duas bolhas: a do turno 1 (ja respondida) e a de ESPERA do turno 2. O que nao pode e o
    // atrasado criar uma TERCEIRA, ou escrever na espera do turno 2.
    assert.equal(respostas.length, 2, 'o atrasado nao pode virar bolha nova');
    assert.match(respostas[0].text, /Posso detalhar/, 'ele atualiza a bolha de onde saiu');
    assert.equal(respostas[1].rodando, true, 'a espera do turno 2 continua esperando');
    assert.equal(respostas[1].text, 'pensando…', 'o atrasado NAO escreveu na bolha do turno novo');
    assert.equal(respostas[0].turn, session.messages.find((m) => m.text === 'quantas tarefas?').turn);
  });

  await testAsync('pergunta e resposta carregam o MESMO numero de turno', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('primeira?');
    live.ultima.texto('resposta um', { turno: 1 });
    session.ask('segunda?');
    live.ultima.texto('resposta dois', { turno: 2 });

    const porTurno = (n) => session.messages.filter((m) => m.turn === n).map((m) => m.text);
    assert.deepEqual(porTurno(1), ['primeira?', 'resposta um']);
    assert.deepEqual(porTurno(2), ['segunda?', 'resposta dois']);
  });

  await testAsync('no modo TEXTO a legenda do audio nao suja a resposta', async () => {
    // Visto no portao F3 (2026-11-13): a bolha do aluno virou "9<no speech>{pause}". O modelo
    // emite um turno de audio vazio mesmo com a funcao de entrega declarada, e a legenda dele
    // colava na resposta. Legenda e do modo voz.
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('quantas tarefas?');
    live.ultima.texto('9');
    live.ultima.legenda('<no speech>');
    live.ultima.legenda('{pause}');
    assert.equal(session.messages.at(-1).text, '9');
  });

  await testAsync('texto: turno respondido SO falando ainda vira bolha, limpa', async () => {
    // O par do teste acima. Filtrar a legenda no modo texto e NAO deixar o fallback do fim do
    // turno passar deixava o aluno sem resposta nenhuma - pior que uma resposta feia.
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('quantas tarefas?');
    live.ultima.texto('<no speech>O diagrama tem 9 tarefas.{pause}', { fallback: true, complete: true });
    assert.equal(session.messages.at(-1).text, 'O diagrama tem 9 tarefas.');
  });

  await testAsync('turno que termina sem nada utilizavel AVISA, nao fica mudo', async () => {
    const { session, live } = montar();
    await session.connect('texto');
    live.ultima.pronta();
    session.ask('quantas tarefas?');
    live.ultima.texto('', { fallback: true, complete: true, vazio: true });
    const ultima = session.messages.at(-1);
    assert.equal(ultima.role, 'system');
    assert.match(ultima.text, /sem responder/);
  });

  await testAsync('no modo VOZ a legenda continua sendo a resposta', async () => {
    const { session, live } = montar();
    await session.connect('voz');
    live.ultima.pronta();
    live.ultima.legenda('o gateway ');
    live.ultima.legenda('exclusivo escolhe um caminho');
    assert.equal(session.messages.at(-1).text, 'o gateway exclusivo escolhe um caminho');
  });

  await testAsync('nota do sistema passa pelo redator', async () => {
    const { session, live, credentials } = montar();
    await session.connect('texto');
    live.ultima.falha(`ws-closed:1006 em wss://x?key=${CHAVE}`);
    const texto = session.messages.map((m) => m.text).join(' ');
    assert.ok(!texto.includes(CHAVE), `chave vazou na conversa: ${texto}`);
    assert.equal(credentials.hasKey, true);
    forgetSecrets();
  });

  /* ---------------------------------------------------------------- portões de confirmação
 *
 * Change `spoken-confirmation-gates`. O que estes testes protegem é ORDEM: a ação fica recusada
 * até o aluno falar ou digitar DEPOIS de a pergunta ter sido feita. Nenhum deles olha o conteúdo
 * do que ele disse — "sim" não é lido em lugar nenhum, e é assim de propósito (constituição §III).
 *
 * Os dois erros possíveis são caros e opostos: para o lado frouxo, o agente apaga o diagrama do
 * aluno sem ele ter dito nada; para o lado duro, a conversa trava. */

function montarComDiagrama(extra = {}) {
  const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: {} };
  const alvo = { id: 'Task_1', type: 'bpmn:Task', parent: raiz, businessObject: { name: 'Assar a pizza' } };
  const estado = { removido: false, perguntasNoBotao: 0 };
  const vivos = () => (estado.removido ? [raiz] : [raiz, alvo]);
  const acesso = {
    disponivel: true,
    editavel: true,
    elementos: vivos,
    porId: (id) => vivos().find((e) => e.id === id) ?? null,
    selecionado: () => null,
    entradasESaidas: () => ({ entradas: [], saidas: [] }),
    remover: () => { estado.removido = true; },
    // O clique num candidato DESTACA o elemento: o aluno clicou num nome e o que ele quer saber
    // é qual é no desenho. Sem estas duas, o destaque falha calado e o teste não veria nada.
    destacar: ({ els, cores }) => { estado.pintados = els.map((e) => e.id); estado.cor = cores.fill; },
    corDe: () => ({ fundo: estado.cor ?? null, borda: null }),
    assinar: () => () => {},
  };
  // Tolerância curta: o que se mede aqui é a ordem, não o relógio.
  //
  // `lerDiagrama` existe porque o contexto do prompt NÃO sai do `acesso`: ele sai da projeção
  // (`agent/diagram.js`), que na página vem do observador. Sem isto, uma sessão com diagrama
  // aberto aparecia para o modelo como página vazia — e um teste que afirme "o diagrama continua
  // no contexto" estaria medindo o dublê, não o produto.
  const montado = montar({
    acesso,
    pagina: 'modelador',
    toleranciaDeConfirmacaoMs: 40,
    lerDiagrama: () => ({
      processo: { id: raiz.id, nome: null },
      total: vivos().length - 1,
      contagem: { Task: estado.removido ? 0 : 1 },
      raias: [],
      amostra: vivos().filter((e) => e !== raiz).map((e) => ({ id: e.id, tipo: 'Task', nome: e.businessObject?.name ?? null })),
      selecionado: null,
    }),
    ...extra,
  });
  return { ...montado, estado };
}

const apagar = (d, id) => d.despachar([{ id, name: 'remover', args: { id: 'Task_1' } }]).then((r) => r[0].response);

testAsync('apagar fica RECUSADO até o aluno responder — e a resposta dele basta, sem clique', async () => {
  const { session, live, estado } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  // 1. O modelo tenta apagar antes de o aluno responder: recusa NOMEADA, e nada é apagado.
  const primeira = await apagar(d, 'c1');
  assert.equal(primeira.ok, false);
  assert.equal(primeira.erro, 'falta_confirmacao');
  assert.match(primeira.comoProsseguir, /espere/i);
  assert.equal(estado.removido, false);

  // 2. O aluno responde. (Digitar e falar produzem o mesmo turno de aluno.)
  session.ask('pode apagar');

  // 3. Agora passa — e sem nenhum clique: o diálogo não foi usado.
  const segunda = await apagar(d, 'c2');
  assert.equal(segunda.ok, true, JSON.stringify(segunda));
  assert.equal(estado.removido, true);
  forgetSecrets();
});

testAsync('um "sim" dito ANTES da pergunta não autoriza nada', async () => {
  const { session, live, estado } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  // O aluno falou — mas sobre outra coisa, antes de o agente perguntar qualquer coisa.
  session.ask('pode apagar, sim');

  const r = await apagar(d, 'c1');

  assert.equal(r.erro, 'falta_confirmacao', 'a fala anterior à pergunta não conta');
  assert.equal(estado.removido, false);
  forgetSecrets();
});

testAsync('o modelo alegando que o aluno confirmou não abre o portão', async () => {
  const { session, live, estado } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  const r = (await d.despachar([
    { id: 'c1', name: 'remover', args: { id: 'Task_1', confirmadoPeloAluno: true, oAlunoDisseSim: 'sim' } },
  ]))[0].response;

  assert.equal(r.erro, 'falta_confirmacao', 'quem conta é a aba, não a narração do modelo');
  assert.equal(estado.removido, false);
  forgetSecrets();
});

testAsync('a legenda atrasada ainda conta: o aluno falou, a transcrição chegou depois', async () => {
  const { session, live, estado } = montarComDiagrama({ toleranciaDeConfirmacaoMs: 1500 });
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  // A pergunta aparece e o modelo já chama a ferramenta; a resposta do aluno chega 150 ms depois.
  const esperando = apagar(d, 'c1');
  setTimeout(() => session.ask('pode apagar'), 150);

  assert.equal((await esperando).ok, true, 'a espera curta existe por causa deste atraso');
  assert.equal(estado.removido, true);
  forgetSecrets();
});

testAsync('o portão é CONSUMIDO: um sim autoriza uma remoção, não todas as próximas', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  assert.equal((await apagar(d, 'c1')).erro, 'falta_confirmacao');
  session.ask('pode apagar');
  assert.equal((await apagar(d, 'c2')).ok, true);

  // Mesmo aluno, mesma conversa, elemento já apagado: a próxima remoção pergunta de novo.
  assert.equal((await apagar(d, 'c3')).erro, 'falta_confirmacao');
  forgetSecrets();
});

testAsync('ferramenta sem portão não espera por ninguém', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  const r = (await d.despachar([{ id: 'c1', name: 'descrever_diagrama', args: {} }]))[0].response;

  assert.equal(r.ok, true, 'ler o diagrama nunca precisou de autorização');
  forgetSecrets();
});


console.log('\n▶ o canal da página (close-the-loop-with-the-canvas)');

/** O que o modelo de fato recebeu pelo canal — frames de contexto com a marca. */
const notasEnviadas = (live) => live.ultima.enviados
  .filter((e) => e.tipo === 'contexto' && e.t.startsWith('(da página)'))
  .map((e) => e.t);

testAsync('a nota sai marcada, vira nota de SISTEMA e nunca bolha de aluno', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();

  assert.equal(session.anunciarNaPagina('o aluno selecionou "Assar a pizza" (task) no desenho.'), true);

  const notas = notasEnviadas(live);
  assert.equal(notas.length, 1, 'o modelo recebeu a nota');
  assert.match(notas[0], /^[(]da página[)] o aluno selecionou/, 'a marca é posta pela sessão, não pelo chamador');

  const bolha = session.messages.at(-1);
  assert.equal(bolha.role, 'system', 'o aluno não disse isso: a bolha é nota de sistema');
  assert.equal(bolha.kind, 'pagina');
  assert.equal(session.messages.filter((m) => m.role === 'user').length, 0, 'nenhuma bolha de aluno foi criada');
  forgetSecrets();
});

testAsync('nota com turno aberto NÃO atropela: espera a brecha entre turnos', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('o que é um gateway?');          // turno aberto: o estado deixa de ser 'pronto'

  session.anunciarNaPagina('o aluno rodou a simulação do diagrama.');
  assert.equal(notasEnviadas(live).length, 0, 'nada sai enquanto o turno está aberto');
  assert.ok(session.notaDaPagina, 'a nota fica pendente');

  live.ultima.texto('um gateway exclusivo escolhe um caminho.', { complete: true });
  live.ultima.fimDeTurno();                    // a brecha
  assert.equal(notasEnviadas(live).length, 1, 'saiu na brecha entre turnos');
  forgetSecrets();
});

testAsync('o aluno falou primeiro: a nota é DESCARTADA, não enfileirada para depois', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('primeira pergunta');            // turno aberto

  session.anunciarNaPagina('o aluno selecionou "Assar a pizza" (task) no desenho.');
  assert.ok(session.notaDaPagina, 'pendente');

  // ⚠ A vez é dele. Perguntar algo novo mata o fato velho: entregá-lo depois faria o agente
  // responder sobre um clique que o aluno já esqueceu.
  session.ask('na verdade, me explica raia');
  assert.equal(session.notaDaPagina, null, 'a nota morreu quando ele falou');

  live.ultima.fimDeTurno();
  assert.equal(notasEnviadas(live).length, 0, 'ela nunca chegou ao modelo');
  const descartes = session.diagnostics.events.filter((e) => e.key === 'pagina.descartou');
  assert.equal(descartes.length, 1, 'o diário registra o descarte com o motivo');
  forgetSecrets();
});

testAsync('fato velho não vira pergunta fora de hora: expira', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('pergunta');

  session.anunciarNaPagina('o aluno desfez a última mudança (Ctrl+Z).');
  // Envelhece a nota à mão: o que se mede é o PRAZO, e relógio falso para 45 s seria teatro.
  const pendente = session.notaDaPagina;
  assert.ok(pendente.ate > Date.now(), 'nasce com prazo no futuro');

  const { session: s2, live: l2 } = montarComDiagrama();
  await s2.connect('texto');
  l2.ultima.pronta();
  s2.ask('pergunta');
  s2.anunciarNaPagina('fato velho');
  // 45 s depois, do ponto de vista da fila.
  const original = Date.now;
  Date.now = () => original() + 46000;
  try {
    l2.ultima.fimDeTurno();
  } finally {
    Date.now = original;
  }
  assert.equal(notasEnviadas(l2).length, 0, 'nota vencida não é entregue');
  assert.equal(s2.notaDaPagina, null);
  assert.ok(s2.diagnostics.events.some((e) => e.key === 'pagina.descartou'), 'e o descarte é registrado');
  forgetSecrets();
});

testAsync('uma nota por vez: a nova substitui a velha', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('pergunta');

  session.anunciarNaPagina('o aluno selecionou A.');
  session.anunciarNaPagina('o aluno selecionou B.');
  live.ultima.fimDeTurno();

  const notas = notasEnviadas(live);
  assert.equal(notas.length, 1, 'uma só chegou');
  assert.match(notas[0], /selecionou B/, 'a última é a que vale — a de antes já não é o estado da tela');
  forgetSecrets();
});

testAsync('sem sessão não há a quem contar, e nada fica guardado', async () => {
  const { session } = montarComDiagrama();
  assert.equal(session.anunciarNaPagina('o aluno selecionou A.'), false);
  assert.equal(session.notaDaPagina, null);
  forgetSecrets();
});

testAsync('encerrar a sessão derruba a nota pendente', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  session.ask('pergunta');
  session.anunciarNaPagina('o aluno selecionou A.');

  await session.stop();

  assert.equal(session.notaDaPagina, null, 'a nota não atravessa para a sessão seguinte');
  forgetSecrets();
});

console.log('\n▶ ambiguidade resolvida em um clique');

testAsync('escolher um candidato manda a escolha MARCADA e destaca no desenho', async () => {
  const { session, live, estado } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();

  const ok = session.escolherCandidato({ id: 'Task_1', nome: 'Assar a pizza', tipo: 'Task', rotulo: 'Assar a pizza (task)' });
  assert.equal(ok, true);
  // Deixa o destaque (que corre pelo caminho do modelo) terminar.
  await new Promise((r) => setTimeout(r, 10));

  const enviado = live.ultima.enviados.filter((e) => e.tipo === 'texto').at(-1);
  assert.match(enviado.t, /^\(escolhido no chat\) Assar a pizza \(task\)/, 'o modelo sabe que foi um clique, nao digitacao');

  const bolha = session.messages.filter((m) => m.role === 'user').at(-1);
  assert.equal(bolha.via, 'escolha', 'a conversa nao mente sobre o gesto');
  assert.equal(bolha.text, 'Assar a pizza (task)');
  assert.deepEqual(estado.pintados, ['Task_1'], 'o elemento escolhido aparece destacado');
  // E a bolha de espera e a mesma de qualquer pergunta: a escolha abre um turno.
  assert.ok(session.messages.at(-1).rodando);
  forgetSecrets();
});

testAsync('clicar num candidato NAO abre o portao de confirmacao', async () => {
  // ⚠ A invariante que liga as duas changes: clicar em "Pizza vendor" para desambiguar um pool
  // nao e o aluno autorizando apagar nada. Se o clique contasse como fala, um candidato clicado
  // viraria consentimento para a proxima remocao — e o aluno nunca disse sim a ela.
  const { session, live, estado } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  // O modelo tenta apagar: recusado, como deve ser.
  assert.equal((await apagar(d, 'c1')).erro, 'falta_confirmacao');

  // O aluno clica num candidato (outra conversa, outro assunto).
  session.escolherCandidato({ id: 'Task_1', rotulo: 'Assar a pizza' });
  await new Promise((r) => setTimeout(r, 10));

  // E a remocao continua recusada.
  assert.equal((await apagar(d, 'c2')).erro, 'falta_confirmacao', 'um clique nao e um sim');
  assert.equal(estado.removido, false);
  forgetSecrets();
});

testAsync('sem sessao, escolher avisa em vez de perder o clique', async () => {
  const { session } = montarComDiagrama();
  assert.equal(session.escolherCandidato({ id: 'Task_1', rotulo: 'Assar' }), false);
  assert.match(session.messages.at(-1).text, /conecte antes/i);
  forgetSecrets();
});

testAsync('candidato vazio nao vira turno', async () => {
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  const antes = live.ultima.enviados.length;

  assert.equal(session.escolherCandidato({}), false);
  assert.equal(session.escolherCandidato(null), false);
  assert.equal(live.ultima.enviados.length, antes);
  forgetSecrets();
});

testAsync('a FALA do aluno conta UMA vez por turno, nao uma por pedaco de legenda', async () => {
  // Tarefa 1.3 da change `spoken-confirmation-gates`. A legenda de entrada chega em pedacos (e as
  // vezes com a frase inteira repetida): se cada pedaco contasse como "o aluno falou", a epoca
  // subiria tres vezes numa fala so — e um portao perguntado DEPOIS da fala pareceria respondido.
  const { session, live, estado } = montarComDiagrama();
  await session.connect('voz');
  live.ultima.pronta();
  const d = live.ultima.opts.dispatcher;

  // 1. Uma fala do aluno, em tres pedacos, ANTES de qualquer pergunta.
  live.ultima.legenda('Apaga', 'input');
  live.ultima.legenda('Apaga essa', 'input');
  live.ultima.legenda('Apaga essa tarefa', 'input');

  // 2. O modelo tenta apagar: a fala veio ANTES da pergunta, entao o portao continua fechado.
  assert.equal((await apagar(d, 'c1')).erro, 'falta_confirmacao');
  assert.equal(estado.removido, false);

  // 2b. E SEM fala nova ele continua fechado. Esta e a metade que prova a contagem: se cada
  // pedaco de legenda contasse como "o aluno falou", os tres pedacos ja teriam passado da epoca
  // da pergunta, e esta chamada abriria o portao sem ninguem ter respondido nada.
  assert.equal((await apagar(d, 'c1b')).erro, 'falta_confirmacao', 'tres pedacos nao sao tres falas');

  // 3. Agora o aluno responde — tambem em pedacos. UMA fala, uma autorizacao.
  live.ultima.legenda('Pode', 'input');
  live.ultima.legenda('Pode apagar', 'input');
  assert.equal((await apagar(d, 'c2')).ok, true, 'a resposta falada abre o portao');
  assert.equal(estado.removido, true);
  forgetSecrets();
});

console.log('\n\u25b6 a aula inteira cabe numa sessao (sustain-a-class-session)');

testAsync('40 turnos: uma sessao so, sem corte e sem reabrir', async () => {
  // Tarefa 1.3. O medo e' concreto: ao encostar no teto de contexto o servidor ENCERRA a sessao,
  // e a conversa morre no meio da aula. A compressao de janela deslizante (no setup) e' o que
  // evita isso do lado do servidor; deste lado, o que se prova e' que NADA no produto reabre a
  // sessao sozinho ao longo de uma conversa longa — reabrir perderia o contexto do modelo.
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  const socketsNoComeco = live.criadas.length;

  for (let i = 1; i <= 40; i++) {
    session.ask(`pergunta ${i}`);
    live.ultima.texto(`resposta ${i}`, { complete: true });
    live.ultima.fimDeTurno();
  }

  assert.equal(live.criadas.length, socketsNoComeco, 'nenhuma sessao nova foi aberta');
  assert.equal(session.state, 'ready');
  assert.equal(session.messages.filter((m) => m.role === 'assistant' && m.completa).length, 40);
  // E o modelo continua enxergando o diagrama no fim da conversa: o contexto e' recalculado a
  // cada turno, nao semeado uma vez no comeco.
  assert.ok(session.contexto.diagrama, 'o diagrama continua no contexto depois de 40 turnos');
  forgetSecrets();
});

testAsync('o historico que viaja tem TETO: conversa longa nao vira transcricao', async () => {
  // O outro lado da mesma moeda: a sessao aguenta 40 turnos, mas o que se manda para uma sessao
  // NOVA nao pode ser a conversa inteira — isso e' cota do aluno indo embora.
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  for (let i = 1; i <= 40; i++) {
    session.ask(`pergunta ${i}`);
    live.ultima.texto(`resposta ${i}`, { complete: true });
    live.ultima.fimDeTurno();
  }

  await session.switchMode('voz');
  live.ultima.pronta();
  const historico = live.ultima.enviados.find((e) => e.tipo === 'historico');
  assert.ok(historico, 'a sessao nova nasce com o passado');
  assert.ok(historico.turnos.length <= 12, `levou ${historico.turnos.length} turnos`);
  forgetSecrets();
});

testAsync('a sessao tem TETO de tempo, e ela diz por que encerrou', async () => {
  // Tarefa 2.1/2.2/2.3. A sessao cobra enquanto existe, nao enquanto e' usada: a aba esquecida
  // depois da aula gasta a cota DO ALUNO. O teto e' injetado aqui para o teste medir ORDEM, nao
  // esperar 25 minutos.
  const { session, live } = montarComDiagrama({ tetoDaSessaoMs: 60 });
  await session.connect('texto');
  live.ultima.pronta();
  assert.equal(session.state, 'ready');

  await new Promise((r) => setTimeout(r, 140));

  assert.equal(session.state, 'idle', 'a sessao encerrou sozinha');
  assert.equal(live.ultima.fechada, true, 'e o socket foi fechado de verdade');
  const aviso = session.messages.filter((m) => m.role === 'system').at(-1);
  assert.match(aviso.text, /Encerrei a sess/i);
  assert.match(aviso.text, /cota/i, 'diz POR QUE encerrou');
  assert.match(aviso.text, /Comec|Começar/i, 'e como recomecar');
  assert.ok(session.diagnostics.events.some((e) => e.key === 'state.teto-da-sessao'), 'com motivo nomeado no diario');
  forgetSecrets();
});

testAsync('abaixo do teto, a sessao NAO encerra', async () => {
  const { session, live } = montarComDiagrama({ tetoDaSessaoMs: 5000 });
  await session.connect('texto');
  live.ultima.pronta();
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(session.state, 'ready');
  await session.stop();
  forgetSecrets();
});

testAsync('o recado de cota diz o que foi MEDIDO, e aponta o verbo que resolve', async () => {
  // Tarefa 3.4. "ha sessoes demais" era a nossa leitura do codigo 1011, e a medicao mostrou que
  // estava errada — seis sessoes seguidas e quatro ao mesmo tempo passam. Recado que manda o
  // aluno fechar abas quando o problema e' consumo faz ele perder tempo com o que nao resolve.
  const { session, live } = montarComDiagrama();
  await session.connect('texto');
  live.ultima.pronta();
  live.ultima.falha('quota');

  const avisos = session.messages.filter((m) => m.role === 'system').map((m) => m.text).join(' | ');
  assert.match(avisos, /consumo/i);
  assert.match(avisos, /Testar conex/i, 'aponta o verbo que diz quando voltou');
  // ⚠ A frase do recado CITA a leitura errada para negar ("não é por abrir sessões demais"),
  // então o que se cobra aqui é o RÓTULO do erro — que era onde a leitura errada estava afirmada.
  const rotulo = avisos.split('|')[0];
  assert.ok(!/há sessões demais/.test(rotulo), 'o rótulo do erro não afirma mais o que era falso');
  assert.match(rotulo, /consumo permitido/);
  forgetSecrets();
});

report('session-manager');
})();
