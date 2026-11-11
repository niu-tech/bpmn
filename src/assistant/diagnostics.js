// Diário da sessão: o que aconteceu, em ordem, com relógio — para depurar a conversa com o
// modelo sem adivinhar.
//
// Por que existe (dono, 2026-11-11): "precisamos ter uma forma de estruturar a saída e os logs
// de uma forma que a gente consiga ir debugando". Antes disto, a única pista que chegava da
// página era uma frase solta no meio da conversa ("o modelo foi interrompido") — que não diz
// QUANDO, nem quantas vezes, nem o que veio antes. Com o diário, o relato vira uma sequência:
// `mic.open -> ws.audio -> ws.interrupted` responde sozinho a pergunta que a frase não respondia.
//
// Três regras que este módulo garante:
//  1. **Nada aqui vaza a chave.** Todo detalhe passa por `redact` antes de ser guardado, não só
//     antes de ser exibido — assim nem a memória do navegador fica com o valor repetido.
//  2. **Memória limitada.** Anel de tamanho fixo: uma sessão de voz longa não cresce sem fim.
//  3. **O relatório é texto puro**, para o aluno (ou o dono) COLAR num chat. Nada de JSON que
//     ninguém lê, nada de download de arquivo para uma coisa de 30 linhas.
//
// ponytail: um array e um objeto de contagem. Não é um "TelemetryService", não tem transporte,
// não sai da aba.

import { redact } from './live/redact.js';

export const MAX_EVENTS = 400;
const MAX_DETAIL = 160;

/** Eventos que, sozinhos, explicam a maioria dos defeitos de conversa. Ordem = a do relatório. */
export const DESTAQUES = [
  'ws.open', 'ws.ready', 'ws.close', 'ws.error',
  'ws.audio', 'ws.input-text', 'ws.output-text', 'ws.tool-call', 'ws.interrupted',
  'ws.turn-complete', 'ws.unknown',
  'out.setup', 'out.text', 'out.audio', 'out.audio-end', 'out.tool-response',
  'mic.open', 'mic.close', 'mic.gated',
  'state.error',
];

export function createDiagnostics({ now = () => Date.now(), max = MAX_EVENTS } = {}) {
  let t0 = now();
  let events = [];
  const counts = Object.create(null);

  /** Quadros de áudio e legenda chegam às centenas: contam, mas não entram um a um na lista. */
  const AGRUPAR = new Set(['ws.audio', 'out.audio', 'ws.output-text']);

  function record(src, kind, detail) {
    const key = `${src}.${kind}`;
    counts[key] = (counts[key] ?? 0) + 1;

    if (AGRUPAR.has(key)) {
      // Colapsa a repetição: `ws.audio x47` em vez de 47 linhas iguais que empurram o que importa
      // para fora do anel.
      const last = events.at(-1);
      if (last && last.key === key) { last.n++; last.ms = now() - t0; return last; }
    }

    const e = {
      ms: now() - t0,
      key,
      n: 1,
      detail: detail === undefined || detail === null ? null : redact(String(detail)).slice(0, MAX_DETAIL),
    };
    events.push(e);
    if (events.length > max) events.shift();
    return e;
  }

  return {
    record,
    /** Atalhos nomeados — quem chama não precisa lembrar a convenção de `src`. */
    ws: (kind, detail) => record('ws', kind, detail),
    out: (kind, detail) => record('out', kind, detail),
    mic: (kind, detail) => record('mic', kind, detail),
    state: (kind, detail) => record('state', kind, detail),

    get events() { return events.slice(); },
    get counts() { return { ...counts }; },
    count(key) { return counts[key] ?? 0; },

    /** Recomeça o diário. Chamado a cada conexão nova: um relatório = uma sessão. */
    reset() {
      t0 = now();
      events = [];
      for (const k of Object.keys(counts)) delete counts[k];
    },

    /**
     * Relatório para COLAR. Curto de propósito: contagens primeiro (é o que responde "chegou
     * áudio?"), depois a linha do tempo recente.
     */
    report({ limit = 40, header = {} } = {}) {
      const linhas = [];
      linhas.push('--- diagnostico do ajudante BPMN ---');
      for (const [k, v] of Object.entries(header)) linhas.push(`${k}: ${redact(String(v))}`);
      linhas.push(`duracao: ${((now() - t0) / 1000).toFixed(1)}s`);

      const relevantes = DESTAQUES.filter((k) => counts[k]).map((k) => `${k}=${counts[k]}`);
      const extras = Object.keys(counts)
        .filter((k) => !DESTAQUES.includes(k))
        .map((k) => `${k}=${counts[k]}`);
      linhas.push(`contagem: ${[...relevantes, ...extras].join(' ') || '(nada)'}`);

      linhas.push(`--- ultimos ${Math.min(limit, events.length)} de ${events.length} eventos ---`);
      for (const e of events.slice(-limit)) {
        const vezes = e.n > 1 ? ` x${e.n}` : '';
        const det = e.detail ? ` ${e.detail}` : '';
        linhas.push(`${(e.ms / 1000).toFixed(2).padStart(7)}s ${e.key}${vezes}${det}`);
      }
      return linhas.join('\n');
    },
  };
}
