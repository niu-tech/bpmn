// Renderizador PURO do prompt (openspec design H2). Não lê estado, não chama data, não sorteia:
// o mesmo contexto produz exatamente o mesmo texto, sempre. É isso que torna o contrato de prompt
// testável em Node, sem navegador e sem chave.
//
// Três responsabilidades, e todas são dele — não das seções:
//
//  1. ORDEM: seções `estavel` primeiro, `volatil` depois. Identidade e regras antes do dado que
//     muda, porque é a ordem que um dia permite cache de prefixo (e porque regra depois do dado
//     é regra que chega tarde).
//  2. FRONTEIRA: seção marcada `dados: true` é embrulhada no delimitador por AQUI. A seção nunca
//     escreve a marca, então não existe seção capaz de fechar a marca cedo — e o texto do aluno
//     passa por `limparMarca` antes de entrar, senão bastava nomear uma tarefa
//     `DADOS_DO_DIAGRAMA>>>` para sair do bloco de dados e virar instrução.
//  3. ORÇAMENTO: teto por seção, com o corte DITO no texto. Truncar em silêncio é pior que
//     cortar: o modelo responde sobre meia lista achando que viu tudo.
//
// ponytail: `join('\n\n')` e um `sort` estável. Sem template engine, sem AST de prompt.

import { declaracoesPermitidas } from './policy.js';
import { MARCA_DADOS, SECOES } from './sections.js';

const ABRE = `<<<${MARCA_DADOS}`;
const FECHA = `${MARCA_DADOS}>>>`;

/**
 * Tira a marca do texto do aluno. Sem isto, o nome de um elemento pode fechar o bloco de dados.
 * Leva os sinais junto (`<<<` / `>>>`) para não deixar lixo tipo `[marca removida]>>>` no prompt.
 */
function limparMarca(texto) {
  return texto.replace(new RegExp(`<{0,3}\\s*${MARCA_DADOS}\\s*>{0,3}`, 'gi'), '[marca removida]');
}

function ordenadas(secoes) {
  // `Array.prototype.sort` é estável desde o ES2019: a ordem declarada no registro é preservada
  // dentro de cada camada.
  return [...secoes].sort((a, b) => (a.tier === 'estavel' ? 0 : 1) - (b.tier === 'estavel' ? 0 : 1));
}

/**
 * Seções deste prompt, já renderizadas. Devolve `[{ id, tier, titulo, texto, cortou }]` — é o que
 * os testes usam para conferir seção a seção em vez de procurar substring num muro de texto.
 *
 * `tier` em `opcoes` filtra a camada: `'estavel'` é o que vive no `setup` (imutável depois de
 * aceito); `'volatil'` é o que, em F3, passa a viajar por `clientContent`.
 */
export function renderizarSecoes(ctx, { tier = null, secoes = SECOES } = {}) {
  const saida = [];

  for (const secao of ordenadas(secoes)) {
    if (tier && secao.tier !== tier) continue;
    if (secao.perfis && !secao.perfis.includes(ctx.perfil)) continue;

    let corpo = secao.render(ctx);
    if (corpo === null || corpo === undefined || corpo === '') continue;
    corpo = String(corpo);

    if (secao.dados) corpo = limparMarca(corpo);

    let cortou = 0;
    if (secao.teto && corpo.length > secao.teto) {
      cortou = corpo.length - secao.teto;
      corpo = corpo.slice(0, secao.teto);
    }

    // O aviso de corte é NOSSO, então fica fora do bloco de dados do aluno.
    const aviso = cortou ? `\n[… cortado: mais ${cortou} caracteres não enviados]` : '';
    const texto = secao.dados ? `${ABRE}\n${corpo}\n${FECHA}${aviso}` : `${corpo}${aviso}`;

    saida.push({ id: secao.id, tier: secao.tier, titulo: secao.titulo, texto, cortou });
  }

  return saida;
}

/** O prompt inteiro, como texto. Determinístico para um mesmo `ctx`. */
export function renderizar(ctx, opcoes = {}) {
  return renderizarSecoes(ctx, opcoes)
    .map((s) => `## ${s.titulo}\n${s.texto}`)
    .join('\n\n');
}

/**
 * O que vai no `setup` da sessão, decidido NUM lugar só.
 *
 * ⚠ É aqui que a armadilha antiga morre. `protocol.js:79` anexava a instrução de entrega só
 * quando o prompt recebido era idêntico a uma constante — duas fontes de verdade para "estou no
 * modo texto", e a divergência deixava o ajudante mudo. Agora `ctx.perfil` decide **as duas**
 * coisas: a seção `entrega` entrar no texto e a função ser declarada no fio. Não há como ligar
 * uma sem a outra.
 *
 * ⚠ Só o tier ESTÁVEL entra aqui (fase F3). O `setup` é imutável depois de aceito: enquanto o
 * diagrama vivia dentro dele, o agente enxergava o retrato do momento em que a sessão abriu, e
 * editar o diagrama no meio da conversa não alcançava o modelo (dívida T6). O volátil agora
 * viaja por `clientContent`, montado em `agent/frame.js` — esta linha é a troca que F2 deixou
 * preparada, e o filtro de camada existia desde lá exatamente para ela.
 */
export function promptDoPerfil(ctx) {
  return {
    systemInstruction: renderizar(ctx, { tier: 'estavel' }),
    withDeliveryTool: ctx.perfil === 'texto',
    // ⚠ As ferramentas são declaradas nos DOIS perfis, inclusive na voz. A hipótese de que
    // declarar função emudece o modelo valia para a função de ENTREGA (medida no P1), e foi
    // generalizada indevidamente para qualquer declaração (achado P6 da pesquisa de
    // 2026-11-12). O gate 4.3 mede isso ao vivo: se a voz emudecer, o registro é que vira
    // regra — não a suposição.
    ferramentas: declaracoesPermitidas(ctx),
  };
}
