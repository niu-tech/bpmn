// Mascaramento da chave do aluno. Existe porque a chave viaja na QUERY STRING do WebSocket
// (contrato do Live), e todo erro de rede carrega a URL: `WebSocket connection to 'wss://...
// ?key=AIza...' failed`. Essa string chega a `console.error`, ao `onerror` e à tela. Sem passar
// por aqui, o jeito mais comum de vazar a chave é exatamente a mensagem que avisa que algo deu
// errado.
//
// ponytail: duas regras, não um sanitizador geral. `key=` cobre a URL; o prefixo `AIza` cobre a
// chave solta em qualquer outro texto. Mais do que isso só esconderia o que não é segredo.

export const MASK = '***';

// Par [padrão, substituição]. A substituição é STRING, não função: o segundo argumento do
// replacer é o grupo quando o padrão tem grupo e o OFFSET quando não tem — tratar os dois como
// "prefixo" produzia `14***` no lugar de `***`. Pego por teste.
const PATTERNS = [
  [/([?&]key=)[^&\s'"]+/gi, `$1${MASK}`],      // a URL do WS
  [/AIza[0-9A-Za-z_-]{10,}/g, MASK],           // chave do Google solta em qualquer texto
];

/** Troca qualquer credencial reconhecível por {@link MASK}. Entrada não-string volta como string. */
export function redact(value) {
  let text = typeof value === 'string' ? value : stringify(value);
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

/** `true` se sobrou algo que parece credencial. O valor já mascarado NÃO conta — senão a função
 *  acusaria a própria saída de {@link redact} e todo log honesto seria suprimido. */
export function looksLikeSecret(text) {
  const s = String(text);
  return /AIza[0-9A-Za-z_-]{10,}/.test(s) || /[?&]key=(?!\*)[^&\s'"]+/i.test(s);
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
