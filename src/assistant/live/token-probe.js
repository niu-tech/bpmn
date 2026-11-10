// SONDA de E12 — o endpoint de token efêmero do Live aceita ser chamado de ORIGEM DE NAVEGADOR
// com a chave do aluno? (openspec design D2)
//
// Por que é sonda e não implementação: a doc oficial diz que `authTokens.create` exige uma chave
// de API e manda rodar isso num BACKEND, e diz também que o token, como a chave, pode ser
// extraído do cliente — o ganho é ser curto, não ser secreto.
// (ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)
//
// Num cenário BYOK sem backend, quem mintaria o token é a própria aba, com a chave já em mãos. O
// ganho real seria limitar o estrago de um XSS. Se o CORS recusar, o caminho fica sendo a chave na
// query do WebSocket — e isso vai REGISTRADO como limitação, não escondido.
//
// A sonda não é usada pelo caminho normal da sessão. Ela existe para MEDIR, uma vez, com chave
// local, e o veredito entra em `validation.md`.

import { redact } from './redact.js';

// ⚠ snake_case. `v1alpha/authTokens` (camelCase) devolve 404 — medido em 2026-11-10, e foi o
// que fez a primeira rodada concluir, errado, que o recurso nao existia.
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';

/**
 * Tenta criar um token efêmero a partir do navegador.
 * Devolve `{ ok, status, verdict, detail }` — nunca o token, nunca a chave.
 *
 * `verdict`:
 *   'minted'       conseguiu: o fluxo preferido (chave -> token -> WS) é viável sem backend
 *   'cors-blocked' o navegador barrou: só com backend; usar a chave na query do WS
 *   'rejected'     o servidor respondeu e recusou (chave, escopo, preview indisponível)
 */
export async function probeEphemeralToken(apiKey, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  if (!apiKey) return { ok: false, status: 0, verdict: 'rejected', detail: 'sem chave' };

  const expire = new Date(now() + 30 * 60 * 1000).toISOString();
  let response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        // Limites EXPLÍCITOS: há relato público de exemplos que emitem token sem restrição.
        uses: 1,
        expireTime: expire,
        newSessionExpireTime: new Date(now() + 60 * 1000).toISOString(),
      }),
    });
  } catch (err) {
    // `TypeError: Failed to fetch` é o que o navegador dá tanto para CORS quanto para rede caída.
    // A sonda não finge saber a diferença: nomeia o que observou.
    return {
      ok: false, status: 0, verdict: 'cors-blocked',
      detail: redact(`fetch falhou sem resposta (CORS ou rede): ${err?.message ?? err}`),
    };
  }

  if (response.ok) {
    let hasName = false;
    try { hasName = Boolean((await response.json())?.name); } catch { /* corpo inesperado */ }
    return {
      ok: true, status: response.status, verdict: 'minted',
      detail: hasName ? 'token emitido (valor não registrado)' : 'resposta 2xx sem campo name',
    };
  }

  let detail = `HTTP ${response.status}`;
  try { detail += ` — ${redact((await response.text()).slice(0, 300))}`; } catch { /* sem corpo */ }
  return { ok: false, status: response.status, verdict: 'rejected', detail };
}
