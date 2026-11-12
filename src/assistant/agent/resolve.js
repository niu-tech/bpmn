// O ÚNICO lugar que lê estado para montar o prompt (openspec design H2).
//
// Por que existe: prompt que lê estado durante o render é prompt que muda sozinho entre duas
// chamadas — e aí não existe teste determinístico possível. Aqui o estado entra, sai um objeto
// congelado, e `render.js` nunca toca em nada além desse objeto.
//
// Em F2 o chamador entrega o que tem (modo, página, contexto declarado). Em F3 a projeção do
// diagrama passa a vir do `elementRegistry` — este arquivo é a costura, e não muda por isso.
//
// ponytail: uma função e dois normalizadores. Sem classe de contexto, sem store.

/** Teto de itens da memória no prompt. Mais que isso não é contexto, é despejo. */
const MAX_MEMORIA = 20;
/** Teto de elementos na amostra. O corte é DITO ao modelo (ver `descreverDiagrama`). */
const MAX_AMOSTRA = 25;

export function resolverContexto(estado = {}) {
  const perfil = estado.modo === 'voz' ? 'voz' : 'texto';
  const pagina = estado.pagina === 'viewer' ? 'viewer' : 'modelador';
  const somenteLeitura = pagina === 'viewer';

  return Object.freeze({
    perfil,
    pagina,
    somenteLeitura,
    diagrama: normalizarDiagrama(estado.diagrama, somenteLeitura),
    memoria: normalizarMemoria(estado.memoria),
  });
}

/**
 * `null` quando não há diagrama nenhum (a seção some). Objeto quando há — inclusive vazio, que é
 * diferente: "recebi o diagrama e ele não tem nada" não é "não recebi o diagrama".
 */
function normalizarDiagrama(d, somenteLeitura) {
  if (!d || typeof d !== 'object') return null;
  const amostraCrua = Array.isArray(d.amostra) ? d.amostra : [];
  const amostra = amostraCrua.slice(0, MAX_AMOSTRA).map((e) => ({
    id: texto(e?.id) ?? '?',
    tipo: texto(e?.tipo) ?? 'desconhecido',
    nome: texto(e?.nome),
  }));
  return Object.freeze({
    processo: d.processo ? { id: texto(d.processo.id), nome: texto(d.processo.nome) } : null,
    total: Number.isFinite(d.total) ? d.total : (amostraCrua.length || null),
    contagem: contagemLimpa(d.contagem),
    raias: Array.isArray(d.raias) ? d.raias.map((r) => texto(r) ?? '?').slice(0, 12) : [],
    amostra,
    selecionado: d.selecionado
      ? { id: texto(d.selecionado.id) ?? '?', tipo: texto(d.selecionado.tipo) ?? 'desconhecido', nome: texto(d.selecionado.nome) }
      : null,
    somenteLeitura,
  });
}

function contagemLimpa(c) {
  if (!c || typeof c !== 'object') return {};
  const saida = {};
  // Ordem alfabética: o render tem de ser determinístico, e ordem de chave de objeto não é
  // contrato quando o objeto vem de fora.
  for (const chave of Object.keys(c).sort()) {
    const n = c[chave];
    if (Number.isFinite(n) && n > 0) saida[chave] = n;
  }
  return saida;
}

function normalizarMemoria(m) {
  if (!Array.isArray(m)) return [];
  return m.map((item) => texto(item)).filter(Boolean).slice(0, MAX_MEMORIA);
}

/** String aparada, ou `null`. Nunca `undefined` — `undefined` vira texto "undefined" no prompt. */
function texto(v) {
  if (typeof v !== 'string') return v === null || v === undefined ? null : String(v);
  const t = v.trim();
  return t.length ? t : null;
}
