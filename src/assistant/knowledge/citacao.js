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
 *  - **não vale para a voz.** O áudio vai do provedor ao alto-falante sem passar por nós. A
 *    assimetria é do transporte, e vai declarada na interface e nas limitações do TCC — nunca
 *    prometida como se fosse igual nos dois modos.
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
