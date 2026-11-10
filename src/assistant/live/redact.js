// Mascaramento da chave do aluno. Existe porque a chave viaja na QUERY STRING do WebSocket
// (contrato do Live), e todo erro de rede carrega a URL: `WebSocket connection to 'wss://...
// ?key=AQ...' failed`. Essa string chega a `console.error`, ao `onerror` e à tela. Sem passar
// por aqui, o jeito mais comum de vazar a chave é exatamente a mensagem que avisa que algo deu
// errado.
//
// ⚠ A regra por FORMATO já falhou uma vez: a primeira versão só conhecia `AIza…` (AI Studio
// clássico, 39 caracteres), e a chave real usada na medição de 2026-11-10 começa com `AQ.` e tem
// 53 — não seria mascarada fora de uma URL. Por isso existem DOIS mecanismos, e o primeiro é o
// que não depende de adivinhar formato nenhum:
//
//   1. `rememberSecret(valor)` — quem recebe a chave a registra, e qualquer ocorrência EXATA dela
//      é mascarada. À prova de formato novo.
//   2. padrões conhecidos — rede de segurança para o que não foi registrado.
//
// ponytail: nada de sanitizador genérico de "string longa". Mascarar hash e UUID de log honesto
// esconderia justamente o que serve para diagnosticar.

export const MASK = '***';

// Par [padrão, substituição]. A substituição é STRING, não função: o segundo argumento do
// replacer é o grupo quando o padrão tem grupo e o OFFSET quando não tem — tratar os dois como
// "prefixo" produzia `14***` no lugar de `***`. Pego por teste.
const PATTERNS = [
  [/([?&]key=)[^&\s'"]+/gi, `$1${MASK}`],        // a URL do WS — independe do formato da chave
  [/AIza[0-9A-Za-z_-]{10,}/g, MASK],             // chave do AI Studio (formato clássico)
  [/\bAQ\.[0-9A-Za-z_.-]{20,}/g, MASK],          // chave do AI Studio (formato `AQ.`)
];

/** Segredos registrados em runtime. Set: o mesmo valor nunca entra duas vezes. */
const known = new Set();

/**
 * Registra um valor para ser mascarado por igualdade exata, qualquer que seja o formato.
 * Chamar assim que a credencial chega, antes de qualquer conexão.
 */
export function rememberSecret(value) {
  if (typeof value === 'string' && value.length >= 8) known.add(value);
}

/** Esquece os segredos registrados (encerramento de sessão, troca de chave). */
export function forgetSecrets() {
  known.clear();
}

/** Troca qualquer credencial reconhecível por {@link MASK}. Entrada não-string volta como string. */
export function redact(value) {
  let text = typeof value === 'string' ? value : stringify(value);
  // Primeiro o exato: não depende de formato, então cobre o que os padrões não conhecem.
  for (const secret of known) text = text.split(secret).join(MASK);
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

/** `true` se sobrou algo que parece credencial. O valor já mascarado NÃO conta — senão a função
 *  acusaria a própria saída de {@link redact} e todo log honesto seria suprimido. */
export function looksLikeSecret(text) {
  const s = String(text);
  for (const secret of known) if (s.includes(secret)) return true;
  return /AIza[0-9A-Za-z_-]{10,}/.test(s)
    || /\bAQ\.[0-9A-Za-z_.-]{20,}/.test(s)
    || /[?&]key=(?!\*)[^&\s'"]+/i.test(s);
}

function stringify(value) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
