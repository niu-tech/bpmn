// Despacho de ferramenta: autorizar, executar, responder o que REALMENTE aconteceu.
//
// Por que existe (fase F1 do `openspec/roadmap.md`): até 2026-11-12 o caminho era
// `send(buildToolResponse(frame.calls))` — uma resposta `{ok:true}` para toda chamada, enviada
// ANTES de existir qualquer executor. Isso serve para a função de entrega textual, que não tem
// efeito a reportar, e **mente** para qualquer ferramenta de verdade: uma remoção recusada
// responderia sucesso, e o modelo seguiria a conversa achando que apagou algo.
//
// As quatro regras que este módulo garante:
//  1. **Resultado real.** `{ok:true, …}` só depois de concluir; qualquer outro caso é
//     `{ok:false, erro:'<nome>'}` com o nome vindo de um conjunto fechado.
//  2. **Default-deny.** Nome que a política não permite não executa — e nome que ninguém roteou
//     também não. São erros DIFERENTES de propósito: um é política, o outro é catálogo furado.
//  3. **Teto próprio.** Ferramenta que demora demais devolve `tempo_esgotado` em vez de deixar o
//     turno pendurado. O relógio de silêncio do turno é outro, e quem o controla é a sessão.
//  4. **Nada bloqueia o socket.** `despachar` é assíncrono e quem chama não espera dentro do
//     laço de recepção.
//
// ponytail: um dispatcher de ~90 linhas, sem fila, sem retry, sem backpressure. Uma ferramenta
// por chamada, N chamadas em paralelo, e o resultado volta na ordem em que chegou.

import { redact } from '../live/redact.js';

/** Conjunto FECHADO de erros. O modelo precisa de um fato para decidir o próximo passo —
 *  "deu erro" faz ele tentar de novo igual; `elemento_nao_encontrado` faz ele procurar antes. */
export const ERROS = Object.freeze({
  NAO_PERMITIDA: 'ferramenta_nao_permitida',
  NAO_ROTEADA: 'ferramenta_nao_roteada',
  TEMPO: 'tempo_esgotado',
  FALHOU: 'ferramenta_falhou',
  ENCERRADA: 'sessao_encerrada',
});

/** Teto do corpo da resposta. Resultado gigante volta ao modelo como custo do aluno. */
const MAX_CORPO = 4000;

function recortar(valor) {
  if (valor === undefined || valor === null) return null;
  let texto;
  try {
    texto = JSON.stringify(valor);
  } catch {
    return { aviso: 'resultado nao serializavel' };
  }
  if (texto.length <= MAX_CORPO) return valor;
  return { cortado: true, de: texto.length, previa: texto.slice(0, MAX_CORPO) };
}

export function createToolDispatcher({
  /** nome -> async (args) => resultado. Ausente = `ferramenta_nao_roteada`. */
  executores = {},
  /** Política do perfil. Default-deny de verdade mora em quem constrói este objeto. */
  permitido = () => false,
  tetoMs = 8000,
  clock = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
  onEvent,
  /**
   * Avisa a camada de cima que uma ferramenta COMEÇOU e TERMINOU, com entrada e resultado.
   *
   * Existe porque o aluno via a resposta e não via o que foi consultado: a ferramenta rodava
   * invisível e, quando demorava, ele não sabia se o ajudante pensava, travou ou acabou a cota.
   * O diário já registrava `tool.executando`, mas diário é para quem investiga depois — isto é
   * para quem está olhando agora.
   */
  onAtividade,
} = {}) {
  let encerrado = false;
  let emVoo = 0;

  const ev = (kind, detail) => { try { onEvent?.('tool', kind, detail); } catch { /* diário nunca derruba */ } };

  function comTeto(promessa, nome) {
    return new Promise((resolve) => {
      let pronto = false;
      const t = clock.setTimeout(() => {
        if (pronto) return;
        pronto = true;
        ev('tempo-esgotado', nome);
        resolve({ ok: false, erro: ERROS.TEMPO, tetoMs });
      }, tetoMs);

      Promise.resolve(promessa).then(
        (valor) => {
          if (pronto) return;
          pronto = true;
          clock.clearTimeout(t);
          resolve({ ok: true, resultado: recortar(valor) });
        },
        (err) => {
          if (pronto) return;
          pronto = true;
          clock.clearTimeout(t);
          // `redact` porque mensagem de erro é o lugar clássico onde a URL com a chave vaza.
          const motivo = redact(String(err?.message ?? err)).slice(0, 200);
          ev('falhou', `${nome}: ${motivo}`);
          resolve({ ok: false, erro: ERROS.FALHOU, motivo });
        },
      );
    });
  }

  async function uma(call) {
    const nome = call?.name;
    const resposta = await (async () => {
      if (encerrado) { ev('recusada', `${nome}: encerrada`); return { ok: false, erro: ERROS.ENCERRADA }; }
      if (!permitido(nome)) { ev('recusada', `${nome}: politica`); return { ok: false, erro: ERROS.NAO_PERMITIDA }; }
      const executor = executores[nome];
      if (typeof executor !== 'function') { ev('nao-roteada', nome); return { ok: false, erro: ERROS.NAO_ROTEADA }; }
      ev('executando', nome);
      const entrada = call.args ?? {};
      try { onAtividade?.({ nome, fase: 'inicio', entrada }); } catch { /* tela nunca derruba */ }
      return comTeto(executor(entrada), nome);
    })();
    try { onAtividade?.({ nome, fase: 'fim', entrada: call?.args ?? {}, resultado: resposta }); }
    catch { /* tela nunca derruba */ }
    return { id: call?.id ?? null, name: nome, response: resposta };
  }

  return {
    /** Há ferramenta rodando agora? É o que a sessão usa para pausar o relógio do turno. */
    get ocupado() { return emVoo > 0; },

    /**
     * Despacha N chamadas EM PARALELO e devolve um resultado por chamada, na mesma ordem.
     * Nunca lança: falha vira `{ok:false}` no corpo, porque o modelo precisa de resposta para
     * toda chamada — inclusive as que deram errado.
     */
    async despachar(calls = []) {
      if (!calls.length) return [];
      emVoo++;
      try {
        return await Promise.all(calls.map((c) => uma(c)));
      } finally {
        emVoo--;
      }
    },

    /** A sessão fechou: o que ainda chegar é recusado em vez de executar no vazio. */
    encerrar() {
      encerrado = true;
      ev('encerrado');
    },
  };
}
