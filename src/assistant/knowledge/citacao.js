/**
 * CONFERÊNCIA DE CITAÇÃO — prompt pede, código impede (decisão K6).
 *
 * O modelo escreve marcas `[fonte:verbete:trecho]` na resposta. Aqui, antes de o texto aparecer,
 * toda marca é conferida contra o conjunto de chaves que as consultas DESTA sessão realmente
 * serviram. Chave que nenhuma consulta devolveu vira `[fonte não conferida]`.
 *
 * ⚠ Duas coisas que esta função NÃO faz, de propósito:
 *
 *  - **não reescreve o texto do modelo.** Só a etiqueta errada é trocada; o que ele disse
 *    continua lá, para o aluno ler e julgar. Apagar a frase seria esconder o erro em vez de
 *    mostrá-lo;
 *  - **não alcança o ÁUDIO.** O áudio vai do provedor ao alto-falante e não dá para reescrever
 *    o que já foi dito. Esse limite é do transporte, e vai declarado.
 *
 * ⚠ CORREÇÃO DE REGISTRO (2026-11-16). Este cabeçalho dizia *"não vale para a voz"*, e isso
 * juntava duas coisas diferentes numa frase só — escondendo um defeito nosso atrás de um
 * limite de transporte. O áudio, de fato, não passa por nós; a **legenda** passa, e ela
 * aparecia CRUA: marca inventada era exibida como se tivesse sido conferida, o que é pior que
 * não conferir (a tela empresta credibilidade a uma fonte que nenhuma consulta devolveu).
 * Agora a legenda da voz passa por aqui como o texto, e a proveniência da resposta falada vem
 * do que o aplicativo SERVIU — não do que o modelo disse. Quem perguntou foi o dono: *"por
 * modo voz não usamos a nossa base de conhecimento? Ou só não referenciamos?"* — usa, e agora
 * referencia.
 */

/** A marca, como o prompt a ensina: `[fonte:<verbete>:<trecho>]`. */
const MARCA = /\[fonte:([\w-]+):([\w-]+)\]/g;

export const NAO_CONFERIDA = '[fonte não conferida]';

/**
 * Devolve o texto com as marcas conferidas e o que foi trocado.
 *
 * `servidas` é um `Set` (ou qualquer coisa com `.has`) das chaves `verbete:trecho` que as
 * consultas desta sessão devolveram.
 */
export function conferirCitacoes(texto, servidas) {
  const original = String(texto ?? '');
  if (!original.includes('[fonte:')) return { texto: original, trocadas: [], conferidas: [] };

  const trocadas = [];
  const conferidas = [];
  const limpo = original.replace(MARCA, (marca, verbete, trecho) => {
    const chave = `${verbete}:${trecho}`;
    if (servidas?.has?.(chave)) {
      conferidas.push(chave);
      return marca;
    }
    trocadas.push(chave);
    return NAO_CONFERIDA;
  });

  return { texto: limpo, trocadas, conferidas };
}
