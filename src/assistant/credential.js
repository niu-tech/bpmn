// A chave é do ALUNO, e só existe enquanto a aba existir.
//
// Decisão do dono (2026-11-10): o site público não embute chave nenhuma. Cada visitante informa a
// própria credencial ao entrar, ela vale só para a sessão dele, e nada é compartilhado entre
// visitantes. A chave do autor serve apenas para teste local explícito — nunca como chave do
// produto.
//
// Por isso este módulo NÃO tem `load()`. Não há de onde carregar: `localStorage`,
// `sessionStorage`, cookie, IndexedDB, query string e cache estão todos fora por desenho, não por
// esquecimento. Um `load()` existindo já seria o começo da persistência.
//
// ponytail: um módulo de ~60 linhas em vez de um "CredentialService". O que ele guarda é uma
// string e um booleano.

import { forgetSecrets, rememberSecret } from './live/redact.js';

/** Formato aceito. Não valida a chave — só evita gastar uma conexão com um campo obviamente vazio. */
const MIN_LEN = 20;

export function createCredentialStore({ onChange } = {}) {
  let value = null;          // a chave, só aqui, só em memória
  let consented = false;     // o aluno leu e aceitou o aviso de exposição e custo
  let lastRejection = null;  // 'bad-key' quando o servidor recusou

  const notify = () => onChange?.({
    hasKey: Boolean(value),
    consented,
    lastRejection,
  });

  return {
    get hasKey() { return Boolean(value); },
    get consented() { return consented; },
    get lastRejection() { return lastRejection; },
    /** Pronto para conectar = tem chave E o aviso foi aceito. */
    get ready() { return Boolean(value) && consented; },

    /** O aluno marcou o aviso de exposição e custo. Sem isso, nada conecta. */
    setConsent(ok) {
      consented = Boolean(ok);
      notify();
    },

    /**
     * Guarda a chave informada pelo aluno. Devolve `{ ok, reason }` — nunca o valor.
     * Registra no redator ANTES de qualquer conexão, para que um eco dela em log ou erro já saia
     * mascarado, qualquer que seja o formato.
     */
    set(raw) {
      const key = String(raw ?? '').trim();
      if (key.length < MIN_LEN) {
        lastRejection = 'too-short';
        notify();
        return { ok: false, reason: 'too-short' };
      }
      value = key;
      lastRejection = null;
      rememberSecret(key);
      notify();
      return { ok: true };
    },

    /** Só quem abre a conexão chama isto. Nunca para exibir, logar ou serializar. */
    use() { return value; },

    /** O servidor recusou a credencial. Mantém a chave para o aluno corrigir, e marca o estado. */
    markRejected() {
      lastRejection = 'bad-key';
      notify();
    },

    /** Trocar ou remover: apaga da memória e do redator. Idempotente. */
    clear() {
      value = null;
      lastRejection = null;
      forgetSecrets();
      notify();
    },
  };
}
