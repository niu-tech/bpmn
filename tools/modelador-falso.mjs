/**
 * O DUBLÊ DO MODELADOR — o bpmn-js de mentira sobre o qual a camada fina de verdade roda.
 *
 * ⚠ Ele dubla o bpmn-js, e NÃO a nossa camada: o que está sob teste INCLUI `tools/bpmn-api.js`,
 * porque é ela que decide que só `modeling` escreve, que a vaga sai do `autoPlace` e que desfazer
 * passa pelo `commandStack`. Dublar a nossa camada provaria o dublê.
 *
 * Mora em `tools/` porque tem DOIS leitores: a suíte (`src/assistant/__tests__/escrita.mjs`) e a
 * avaliação do acervo dourado (`tools/avaliar.mjs`). Duas cópias divergiriam, e a que divergisse
 * mediria outro produto.
 */

/* ---------------------------------------------------------------- dublê do modelador
 * Dubla o bpmn-js de verdade, e não a nossa camada: aqui o que está sob teste INCLUI
 * `bpmn-api.js`, porque é ela que decide que só `modeling` escreve. */

export function criarModeladorFalso({
  semVaga = false,
  updateLabelMudo = false,
  regras = null,
  semAlinhador = false,
  semSubstituidor = false,
  semPilha = false,
} = {}) {
  const raiz = { id: 'Process_1', type: 'bpmn:Process', businessObject: {} };
  const mapa = new Map([[raiz.id, raiz]]);
  const chamadas = [];
  let seq = 0;

  const guardar = (el) => { mapa.set(el.id, el); return el; };

  /**
   * Os waypoints de um fluxo. O bpmn-js os calcula pelo desenho; aqui basta que EXISTAM e caiam
   * entre as duas pontas — é deles que sai o ponto onde um elemento inserido entra na seta.
   */
  const linhaEntre = (de, para) => {
    const meio = (e) => ({ x: (e?.x ?? 0) + (e?.width ?? 0) / 2, y: (e?.y ?? 0) + (e?.height ?? 0) / 2 });
    return [meio(de), meio(para)];
  };

  /**
   * Uma pilha de comandos de verdade, pequena: cada escrita empilha o seu INVERSO.
   *
   * Dublar o `commandStack` como `{ undo(){} }` seria o pior dos mundos — `canUndo` diria sim e
   * o desenho não voltaria, que é exatamente o defeito que a ferramenta precisa pegar. Com os
   * inversos, o teste prova o que o aluno vê: desfez, voltou.
   */
  const pilha = [];
  const registrar = (nome, desfazer) => pilha.push({ nome, desfazer });
  const commandStack = {
    canUndo: () => pilha.length > 0,
    undo() {
      chamadas.push({ fn: 'commandStack.undo' });
      pilha.pop()?.desfazer();
    },
  };

  const modeling = {
    appendShape(ancora, atributos, posicao, pai) {
      chamadas.push({ fn: 'appendShape', tipo: atributos.type, nome: atributos.name, de: ancora.id, posicao });
      const novo = guardar({
        id: `${atributos.type.replace('bpmn:', '')}_${++seq}`,
        type: atributos.type,
        parent: pai ?? raiz,
        businessObject: atributos.name ? { name: atributos.name } : {},
        incoming: [],
        outgoing: [],
      });
      // O bpmn-js cria a ligação junto — é isso que faz "uma tarefa depois do início" funcionar.
      const flow = guardar({
        id: `Flow_${++seq}`,
        type: 'bpmn:SequenceFlow',
        parent: pai ?? raiz,
        businessObject: {},
        source: ancora,
        target: novo,
        waypoints: linhaEntre(ancora, novo),
      });
      ancora.outgoing = [...(ancora.outgoing ?? []), flow];
      novo.incoming = [flow];
      registrar('appendShape', () => {
        mapa.delete(novo.id);
        mapa.delete(flow.id);
        ancora.outgoing = (ancora.outgoing ?? []).filter((f) => f !== flow);
      });
      return novo;
    },

    createShape(atributos, posicao, pai) {
      chamadas.push({ fn: 'createShape', tipo: atributos.type, nome: atributos.name, posicao, pai });
      // Pai que é um FLUXO = inserção no meio. No bpmn-js quem faz isso é o `DropOnFlowBehavior`,
      // dentro do MESMO comando `shape.create` — então o aluno desfaz tudo com um `Ctrl+Z`.
      const noFluxo = pai && Array.isArray(pai.waypoints) ? pai : null;
      const novo = guardar({
        id: `${atributos.type.replace('bpmn:', '')}_${++seq}`,
        type: atributos.type,
        parent: noFluxo ? (noFluxo.parent ?? raiz) : (pai ?? raiz),
        businessObject: atributos.name ? { name: atributos.name } : {},
        incoming: [],
        outgoing: [],
        // A forma chega PRONTA do `elementFactory` (um pool tem 600×250, e o nosso cálculo pode
        // tê-lo esticado para envolver o conteúdo): respeitar a medida dela é o que faz o teste
        // alcançar a geometria do pool.
        x: Math.round((posicao?.x ?? 0) - (atributos.width ?? 100) / 2),
        y: Math.round((posicao?.y ?? 0) - (atributos.height ?? 80) / 2),
        width: atributos.width ?? 100,
        height: atributos.height ?? 80,
      });
      if (!noFluxo) {
        /**
         * Primeiro pool de um processo plano: o bpmn-js troca a RAIZ para colaboração e move todo
         * o conteúdo para dentro do pool novo (`CreateParticipantBehavior`), no MESMO comando.
         * Sem dublar isso, o teste não alcança os dois fatos que a ferramenta promete ao modelo
         * (`virouColaboracao` e `adotou`) — e são justamente eles que explicam ao aluno por que o
         * desenho inteiro mudou de lugar.
         */
        const virou = atributos.type === 'bpmn:Participant' && raiz.type === 'bpmn:Process';
        const adotados = virou
          ? [...mapa.values()].filter((e) => e !== novo && e.parent === raiz && !e.waypoints && !e.labelTarget)
          : [];
        if (virou) {
          raiz.type = 'bpmn:Collaboration';
          for (const e of adotados) e.parent = novo;
          novo.children = adotados;
        }
        registrar('createShape', () => {
          mapa.delete(novo.id);
          if (!virou) return;
          raiz.type = 'bpmn:Process';
          for (const e of adotados) e.parent = raiz;
        });
        return novo;
      }

      const destino = noFluxo.target;
      const linhaAntes = noFluxo.waypoints;
      noFluxo.target = novo;
      noFluxo.waypoints = linhaEntre(noFluxo.source, novo);
      novo.incoming = [noFluxo];
      destino.incoming = (destino.incoming ?? []).filter((f) => f !== noFluxo);
      const segundo = guardar({
        id: `Flow_${++seq}`,
        type: noFluxo.type,
        parent: noFluxo.parent ?? raiz,
        businessObject: {},
        source: novo,
        target: destino,
        waypoints: linhaEntre(novo, destino),
      });
      novo.outgoing = [segundo];
      destino.incoming.push(segundo);
      // Inserção é UM comando: desfazer devolve a seta original e tira as duas peças novas.
      registrar('createShape+insercao', () => {
        mapa.delete(novo.id);
        mapa.delete(segundo.id);
        noFluxo.target = destino;
        noFluxo.waypoints = linhaAntes;
        destino.incoming = (destino.incoming ?? []).filter((f) => f !== segundo);
        destino.incoming.push(noFluxo);
      });
      return novo;
    },

    /**
     * ⚠ ESTE DUBLÊ NÃO PROVA "mover para o MEIO de um fluxo". Duas coisas faltam, e as duas
     * importam: ele não tem `removeConnection` (a chamada estoura e o produto a engole, então as
     * setas velhas ficam) e não tem o **DropOnFlowBehavior** do bpmn-js, que parte a conexão
     * sozinho quando uma forma é solta em cima dela.
     *
     * Era esse segundo que escondia um defeito real: `moverParaOMeio` religava por cima do
     * religamento do bpmn-js e deixava DUAS setas entre os mesmos dois elementos (medido ao vivo
     * em 2026-11-15: ligações do desenho de 24 para 26). Teste escrito aqui passaria e não diria
     * nada. A prova daquele verbo é o portão `mover para o meio NAO duplica a seta` em
     * `tools/battery.mjs`, contra o bpmn-js de verdade e **sem cota**.
     */
    moveElements(formas, delta, alvo) {
      chamadas.push({ fn: 'moveElements', ids: formas.map((f) => f.id), delta, alvo: alvo?.id ?? null });
      const antes = formas.map((f) => ({ f, x: f.x, y: f.y, pai: f.parent }));
      for (const f of formas) {
        f.x = (f.x ?? 0) + delta.x;
        f.y = (f.y ?? 0) + delta.y;
        if (alvo) f.parent = alvo;
      }
      registrar('moveElements', () => {
        for (const a of antes) { a.f.x = a.x; a.f.y = a.y; a.f.parent = a.pai; }
      });
    },

    alignElements(formas, alinhamento) {
      chamadas.push({ fn: 'alignElements', ids: formas.map((f) => f.id), alinhamento });
      const antes = formas.map((f) => ({ f, x: f.x, y: f.y }));
      for (const f of formas) {
        if (alinhamento.middle !== undefined) f.y = Math.round(alinhamento.middle - (f.height ?? 0) / 2);
        if (alinhamento.center !== undefined) f.x = Math.round(alinhamento.center - (f.width ?? 0) / 2);
      }
      registrar('alignElements', () => {
        for (const a of antes) { a.f.x = a.x; a.f.y = a.y; }
      });
    },

    /**
     * `addLane` como o bpmn-js o faz (`AddLaneHandler`): quando o pool ainda NÃO tem raia, ele
     * cria também a faixa do conteúdo que já estava lá — então o primeiro pedido de raia produz
     * DUAS. O dublê precisa disso porque é o fato que a ferramenta promete contar ao aluno.
     */
    addLane(alvo, lugar) {
      chamadas.push({ fn: 'addLane', alvo: alvo.id, lugar });
      const dono = String(alvo.type) === 'bpmn:Lane' ? alvo.parent : alvo;
      dono.children = dono.children ?? [];
      const criadas = [];
      const faixa = (y, altura) => {
        const l = guardar({
          id: `Lane_${++seq}`,
          type: 'bpmn:Lane',
          parent: dono,
          businessObject: {},
          x: (dono.x ?? 0) + 30,
          y,
          width: (dono.width ?? 600) - 30,
          height: altura,
          children: [],
        });
        dono.children.push(l);
        criadas.push(l);
        return l;
      };

      if (!dono.children.some((c) => String(c?.type) === 'bpmn:Lane')) {
        faixa(dono.y ?? 0, dono.height ?? 120);
      }
      const base = lugar === 'top' ? (alvo.y ?? 0) - 120 : (alvo.y ?? 0) + (alvo.height ?? 0);
      const nova = faixa(base, 120);
      registrar('addLane', () => {
        for (const l of criadas) {
          mapa.delete(l.id);
          dono.children = dono.children.filter((c) => c !== l);
        }
      });
      return nova;
    },

    setColor(formas, cores) {
      chamadas.push({ fn: 'setColor', ids: formas.map((f) => f.id), cores });
      const antes = formas.map((f) => ({ f, di: f.di }));
      for (const f of formas) {
        f.di = { ...(f.di ?? {}) };
        // O handler do bpmn-js grava no DI com os nomes do BPMN DI, não com `fill`/`stroke`.
        if ('fill' in cores) f.di['background-color'] = cores.fill;
        if ('stroke' in cores) f.di['border-color'] = cores.stroke;
      }
      registrar('setColor', () => { for (const a of antes) a.f.di = a.di; });
    },

    connect(de, para) {
      chamadas.push({ fn: 'connect', de: de.id, para: para.id });
      // A REGRA do BPMN mora aqui, como no bpmn-js: pools diferentes ⇒ fluxo de mensagem.
      const pool = (el) => {
        let p = el;
        while (p && p.type !== 'bpmn:Participant') p = p.parent;
        return p ?? null;
      };
      const mesmoPool = pool(de) === pool(para);
      if (de.type === 'bpmn:EndEvent') return null; // o que as regras proíbem: recusa silenciosa
      const conexao = guardar({
        id: `Conn_${++seq}`,
        type: mesmoPool ? 'bpmn:SequenceFlow' : 'bpmn:MessageFlow',
        parent: raiz,
        businessObject: {},
        source: de,
        target: para,
        waypoints: linhaEntre(de, para),
      });
      // O bpmn-js mantém `outgoing`/`incoming` nos dois lados — e é por ali que se acha o fluxo
      // entre dois elementos (a inserção no meio depende disso).
      de.outgoing = [...(de.outgoing ?? []), conexao];
      para.incoming = [...(para.incoming ?? []), conexao];
      return conexao;
    },

    updateLabel(el, nome) {
      chamadas.push({ fn: 'updateLabel', id: el.id, nome });
      // `updateLabelMudo` finge o bpmn-js aceitando a chamada e não pondo o nome no desenho —
      // que foi exatamente o que aconteceu ao vivo quando o nome ia junto na criação.
      if (updateLabelMudo) return;
      const antes = el.businessObject?.name;
      el.businessObject = { ...(el.businessObject ?? {}), name: nome };
      registrar('updateLabel', () => {
        el.businessObject = { ...(el.businessObject ?? {}), name: antes };
      });
    },

    removeElements(lista) {
      chamadas.push({ fn: 'removeElements', ids: lista.map((e) => e.id) });
      for (const el of lista) mapa.delete(el.id);
      registrar('removeElements', () => { for (const el of lista) guardar(el); });
    },
  };

  /**
   * A fábrica e o evento `autoPlace`, como o bpmn-js os entrega: a fábrica monta a forma com
   * largura e altura (é com elas que se pergunta "cabe aqui?"), e o evento devolve a vaga que o
   * botão de append do aluno usaria. Aqui a base é fixa — o que os testes provam é que ela vem
   * do bpmn-js e que o empurrão só acontece quando ela está ocupada.
   */
  const elementFactory = {
    createShape(atributos) {
      chamadas.push({ fn: 'elementFactory.createShape', tipo: atributos.type });
      return { ...atributos, width: 100, height: 80 };
    },
    /**
     * ⚠ Um pool nasce com 600×250 E com `processRef` — o processo de dentro dele. Participante
     * sem processo é pool que não guarda nada, e o primeiro elemento criado lá estouraria no
     * `BpmnUpdater` com a forma já desenhada (o fantasma do portão 4.5).
     */
    createParticipantShape(atributos = {}) {
      chamadas.push({ fn: 'elementFactory.createParticipantShape' });
      return {
        type: 'bpmn:Participant',
        width: 600,
        height: 250,
        businessObject: { processRef: { id: `Process_do_pool_${++seq}` } },
        ...atributos,
      };
    },
  };

  /**
   * EventBus com a semântica que importa: **listener que devolve algo ≠ undefined PARA a
   * propagação**. O dublê tinha `on() {}` vazio, e por isso não conseguia reprovar o defeito que
   * a outra sessão achou ao vivo no `src/app.js` (autosave `async` engolindo
   * `commandStack.changed` para todo listener seguinte).
   */
  const ouvintes = new Map();
  const eventBus = {
    on(nome, fn) {
      if (!ouvintes.has(nome)) ouvintes.set(nome, []);
      ouvintes.get(nome).push(fn);
    },
    off(nome, fn) {
      const lista = ouvintes.get(nome) ?? [];
      const i = lista.indexOf(fn);
      if (i >= 0) lista.splice(i, 1);
    },
    /** Dispara como o diagram-js: para no primeiro retorno diferente de `undefined`. */
    emitir(nome, dados) {
      for (const fn of [...(ouvintes.get(nome) ?? [])]) {
        const r = fn(dados);
        if (r !== undefined) return r;
      }
      return undefined;
    },
    fire(nome, dados) {
      if (nome !== 'autoPlace') return undefined;
      chamadas.push({ fn: 'consulta.vaga', de: dados?.source?.id });
      return { x: (dados?.source?.x ?? 0) + 180, y: dados?.source?.y ?? 0 };
    },
  };

  /**
   * O alinhador do bpmn-js, no essencial: ele consulta a regra `elements.align`, EXIGE dois
   * elementos e emite UM comando. E — o que mais importa para o teste — quando a regra recusa ou
   * sobra menos de dois, ele **não faz nada e não avisa**. É por isso que a ferramenta lê de
   * volta: silêncio virando "alinhei" é a mentira mais fácil deste instrumento.
   */
  const alignElements = {
    trigger(formas, tipo) {
      chamadas.push({ fn: 'alignElements.trigger', ids: formas.map((f) => f.id), tipo });
      const uteis = formas.filter((f) => !f.waypoints && !f.labelTarget);
      if (uteis.length < 2) return;
      const eixo = tipo === 'center' ? 'x' : 'y';
      const lado = tipo === 'center' ? 'width' : 'height';
      const centros = uteis.map((f) => (f[eixo] ?? 0) + (f[lado] ?? 0) / 2);
      const comum = Math.round((Math.min(...centros) + Math.max(...centros)) / 2);
      modeling.alignElements(uteis, tipo === 'center' ? { center: comum } : { middle: comum });
    },
  };

  /**
   * `bpmnReplace`: troca o tipo COPIANDO o businessObject (o nome vai junto) e RELIGANDO os
   * fluxos. O id é novo — como no bpmn-js de verdade, e é a parte que a ferramenta tem de
   * devolver ao modelo.
   */
  const bpmnReplace = {
    replaceElement(el, alvo) {
      chamadas.push({ fn: 'bpmnReplace.replaceElement', id: el.id, tipo: alvo?.type });
      const novo = guardar({
        id: `${String(alvo.type).replace('bpmn:', '')}_${++seq}`,
        type: alvo.type,
        parent: el.parent,
        businessObject: { ...(el.businessObject ?? {}) },
        incoming: [...(el.incoming ?? [])],
        outgoing: [...(el.outgoing ?? [])],
        x: el.x, y: el.y, width: el.width, height: el.height,
      });
      for (const f of novo.incoming) f.target = novo;
      for (const f of novo.outgoing) f.source = novo;
      mapa.delete(el.id);
      registrar('replaceElement', () => {
        mapa.delete(novo.id);
        guardar(el);
        for (const f of el.incoming ?? []) f.target = el;
        for (const f of el.outgoing ?? []) f.source = el;
      });
      return novo;
    },
  };

  const modelador = {
    get(nome) {
      if (nome === 'elementRegistry') {
        return { getAll: () => [...mapa.values()], get: (id) => mapa.get(id) ?? null };
      }
      if (nome === 'selection') return { get: () => [] };
      if (nome === 'eventBus') return semVaga ? { on() {}, off() {} } : eventBus;
      if (nome === 'modeling') return modeling;
      if (nome === 'canvas') return { getRootElement: () => raiz, scrollToElement() {} };
      if (nome === 'elementFactory' && !semVaga) return elementFactory;
      if (nome === 'alignElements' && !semAlinhador) return alignElements;
      if (nome === 'bpmnReplace' && !semSubstituidor) return bpmnReplace;
      if (nome === 'commandStack' && !semPilha) return commandStack;
      // `rules` é a autoridade do bpmn-js sobre ONDE uma forma pode nascer — e também sobre mover
      // e alinhar. Ausente (o padrão destes dublês) = o acesso cai no comportamento antigo.
      if (nome === 'rules' && regras) {
        return {
          allowed: (acao, ctx) => {
            if (acao === 'shape.create') return regras(ctx.shape, ctx.target);
            if (acao === 'elements.move') return regras(ctx.shapes?.[0], ctx.target);
            if (acao === 'elements.align') return ctx.elements;
            return true;
          },
        };
      }
      throw new Error(`sem ${nome}`);
    },
  };

  return { modelador, mapa, raiz, chamadas, guardar };
}
