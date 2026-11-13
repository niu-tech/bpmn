// Política: quem pode CHAMAR o quê, nesta sessão (openspec design H8, fase F5).
//
// Separada do catálogo de propósito. O catálogo diz o que EXISTE; a política diz o que está
// ligado AQUI — nesta página, neste modo. São perguntas diferentes e mudam em ritmos diferentes:
// ferramenta nova entra no catálogo uma vez; a política muda a cada sessão aberta.
//
// **Default-deny de verdade.** Não é um `if` de boa vontade: `permitida` só devolve `true` para
// nome que está no catálogo E passa nas regras do contexto. Nome desconhecido, nome vazio,
// `undefined`, nome de ferramenta que ainda não existe — tudo cai no mesmo lugar, e o despachante
// responde `ferramenta_nao_permitida` ao modelo sem tocar em executor nenhum.
//
// ⚠ A política NUNCA olha o texto do aluno. Ela decide por contexto (página, modo), nunca por
// conteúdo — olhar o texto para liberar ou bloquear ferramenta seria a mesma classificação por
// palavra-chave que a constituição proíbe, só que com cara de segurança.
//
// ponytail: duas funções puras sobre o array do catálogo. Sem engine de regras, sem DSL.

import { FERRAMENTAS } from './catalog.js';

/**
 * Normaliza o contexto da sessão. Tudo que falta vira o caso MAIS restrito — é isso que faz o
 * default-deny valer para quem esquecer de passar um campo.
 */
function contexto(ctx = {}) {
  // ⚠ Só um 'modelador' EXPLÍCITO ganha a página que edita. Qualquer outra coisa — inclusive
  // contexto ausente — é tratada como página de leitura. O default-deny tem de valer também
  // para o esquecimento: quem não disser onde está não recebe permissão de escrita de brinde.
  const pagina = ctx?.pagina === 'modelador' ? 'modelador' : 'viewer';
  return {
    perfil: ctx?.perfil === 'voz' ? 'voz' : 'texto',
    pagina,
    somenteLeitura: ctx?.somenteLeitura === undefined ? pagina !== 'modelador' : Boolean(ctx.somenteLeitura),
  };
}

function cabeNoContexto(ferramenta, ctx) {
  if (!ferramenta) return false;
  // Ferramenta que ESCREVE não existe numa página que só lê. Hoje nenhuma escreve (F7 traz as
  // primeiras), e a regra já está aqui para que a primeira nasça bloqueada no viewer.
  if (ferramenta.escreve && ctx.somenteLeitura) return false;
  if (Array.isArray(ferramenta.perfis) && !ferramenta.perfis.includes(ctx.perfil)) return false;
  return true;
}

/** As ferramentas ligadas neste contexto. É daqui que sai a declaração mandada ao modelo. */
export function ferramentasPermitidas(ctx, catalogo = FERRAMENTAS) {
  const c = contexto(ctx);
  return catalogo.filter((f) => cabeNoContexto(f, c));
}

/** As declarações, prontas para o `setup`. */
export function declaracoesPermitidas(ctx, catalogo = FERRAMENTAS) {
  return ferramentasPermitidas(ctx, catalogo).map((f) => f.declaracao);
}

/**
 * A pergunta do despachante, por chamada. Recebe o contexto da sessão porque o MESMO nome pode
 * ser permitido numa página e não em outra — e porque decidir isso na hora da chamada é o que
 * impede uma declaração velha (de uma sessão anterior) de valer como autorização.
 */
export function permitida(nome, ctx, catalogo = FERRAMENTAS) {
  if (typeof nome !== 'string' || !nome.trim()) return false;
  const c = contexto(ctx);
  const f = catalogo.find((x) => x.nome === nome);
  return cabeNoContexto(f, c);
}
