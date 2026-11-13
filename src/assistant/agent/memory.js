// Memória da aba: três categorias, um teto, e morre quando a aba fecha (openspec design H6).
//
// Por que categorizada, e não uma lista de frases: memória sem categoria vira transcrição, e
// transcrição não cabe no orçamento do prompt. As três categorias são as que mudam a resposta
// SEGUINTE — e cada uma tem um teto próprio, porque preferência demais não é pior que fato
// demais pelo mesmo motivo.
//
//   fato        o aluno declarou algo sobre o mundo dele — "meu processo é de atendimento"
//   decisao     fechou na conversa — "vamos usar gateway exclusivo aqui"
//   preferencia como ele quer ser respondido — "responda curto"
//
// ⚠ Quem decide guardar é o MODELO, chamando a ferramenta `lembrar` (constituição §III: nada de
// palavra-chave disparando ação). Este módulo não lê o texto do aluno e não adivinha categoria.
//
// ⚠ NADA sai da aba. Sem `localStorage`, sem `sessionStorage`, sem rede: o produto promete em
// texto que nada fica depois de fechar, e persistir exigiria reescrever esse aviso e pedir
// consentimento (change própria — `open-items.md` §6).
//
// ponytail: três arrays e um `slice`. Sem store, sem reducer, sem índice.

export const CATEGORIAS = Object.freeze(['fato', 'decisao', 'preferencia']);

/** Teto por categoria. Estourou, sai o mais antigo — o recente é o que muda a próxima resposta. */
const TETO_PADRAO = 8;
/** Teto de caracteres por item. Memória é lembrete, não transcrição. */
const MAX_TEXTO = 200;

export const ERROS_MEMORIA = Object.freeze({
  CATEGORIA: 'categoria_invalida',
  VAZIO: 'texto_vazio',
});

export function criarMemoria({ teto = TETO_PADRAO, agora = () => Date.now() } = {}) {
  /** @type {Record<string, Array<{texto: string, turno: number|null, em: number}>>} */
  const itens = { fato: [], decisao: [], preferencia: [] };

  return {
    /**
     * Guarda um item. Devolve `{ok:true, item}` ou `{ok:false, erro}` — nunca lança, porque o
     * chamador é o despachante de ferramenta e ele precisa de um resultado para responder ao
     * modelo.
     */
    lembrar({ categoria, texto, turno = null } = {}) {
      const cat = String(categoria ?? '').trim().toLowerCase();
      if (!CATEGORIAS.includes(cat)) {
        return { ok: false, erro: ERROS_MEMORIA.CATEGORIA, aceitas: [...CATEGORIAS] };
      }
      const t = String(texto ?? '').trim().slice(0, MAX_TEXTO);
      if (!t) return { ok: false, erro: ERROS_MEMORIA.VAZIO };

      // Repetir o mesmo lembrete não cria dois: o modelo às vezes confirma o que já guardou, e
      // duas linhas iguais no prompt gastam o dobro para dizer a mesma coisa.
      const jaTem = itens[cat].find((i) => i.texto.toLowerCase() === t.toLowerCase());
      if (jaTem) return { ok: true, item: jaTem, repetido: true };

      const item = { texto: t, turno: Number.isFinite(turno) ? turno : null, em: agora() };
      itens[cat].push(item);
      const sobra = itens[cat].length - teto;
      if (sobra > 0) itens[cat].splice(0, sobra);
      return { ok: true, item, total: itens[cat].length };
    },

    /**
     * O que entra no prompt: uma linha por item, com a categoria na frente. A categoria vai no
     * texto de propósito — é ela que diz ao modelo se aquilo é algo que o aluno É, algo que foi
     * DECIDIDO, ou um pedido sobre COMO responder.
     */
    get paraOPrompt() {
      return CATEGORIAS.flatMap((cat) => itens[cat].map((i) => `${cat}: ${i.texto}`));
    },

    /** Cru, para teste e diagnóstico. Cópia: ninguém edita a memória por fora do `lembrar`. */
    get estado() {
      return Object.fromEntries(CATEGORIAS.map((c) => [c, itens[c].map((i) => ({ ...i }))]));
    },

    get total() {
      return CATEGORIAS.reduce((n, c) => n + itens[c].length, 0);
    },

    limpar() {
      for (const c of CATEGORIAS) itens[c].length = 0;
    },
  };
}
