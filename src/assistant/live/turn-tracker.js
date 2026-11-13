// Fronteira lógica do turno de voz: quem é o dono de cada evento que chega.
//
// ⚠ ORIGEM: portado de `capsules/WikiAgentCapsule/agent/voice/turn-tracker.mjs`, do repositório do
// CopilotSpeaker — código do próprio autor, provado lá nos checkpoints CP6/CP7.6. A tradução é de
// comentário e nome; o comportamento e os testes vieram junto. (Ver K-F em `open-items.md`: o TCC
// precisa declarar isto no texto.)
//
// O defeito que ele existe para matar: a transcrição de entrada chega em **fragmentos**, e tratar
// cada fragmento como frase pronta produz, no log real que originou o módulo, *"Consegue me dizer
// sobre"* virando pergunta completa — com chamada de ferramenta prematura, resposta duplicada e um
// laço de "termo não completado". **Uma pausa não é o fim de uma frase.**
//
// Aqui isto ainda não tinha aparecido porque as fixtures são frases curtas e limpas, e o
// `session-manager` empurra uma bolha nova a cada fragmento: com fala de verdade, o aluno veria a
// pergunta dele picada em várias bolhas.
//
// Três trabalhos, todos movidos por sinal REAL do servidor — nunca por relógio:
//   1. JUNTAR os fragmentos numa fala só, fechada pelo sinal de fim do próprio servidor;
//   2. PRENDER cada evento ao turno a que ele pertence, para que um pedaço que chega depois de um
//      turno novo seja descartado em vez de virar resposta da pergunta seguinte (foi exatamente a
//      dívida do portão F5, consertada aqui com heurística em 2026-11-13);
//   3. garantir UMA execução por par `{turno, chamada}`, para que uma chamada repetida reaproveite
//      o primeiro resultado em vez de bater na ferramenta de novo.

export const EventoDeFala = Object.freeze({
  Provisorio: 'provisorio',   // a UI ATUALIZA a mesma bolha
  Final: 'final',             // a UI FECHA uma entrada
});

export class RastreadorDeTurnos {
  constructor({ onFala = () => {} } = {}) {
    this._onFala = onFala;
    this._seq = 0;
    this._turno = null;
    this._buffer = '';
    this._fechou = false;
    this._chamadas = new Map();   // `${turno}::${idDaChamada}` -> { estado, resultado }
    this.abrirTurno();
  }

  get turno() { return this._turno; }

  /** Abre um turno lógico novo. Tudo preso ao anterior passa a ser velho. */
  abrirTurno() {
    this._turno = `t${++this._seq}`;
    this._buffer = '';
    this._fechou = false;
    return this._turno;
  }

  /** O evento pertence a um turno que já foi substituído? */
  eVelho(turno) {
    return turno != null && turno !== this._turno;
  }

  // ---- lado da ENTRADA (o aluno falando) --------------------------------------------------------

  /**
   * Um fragmento de transcrição. Emite SEMPRE `provisorio` — nunca `final`, porque só um sinal do
   * servidor sabe dizer que a pessoa de fato parou de falar.
   */
  fragmentoDeEntrada(texto) {
    if (typeof texto !== 'string' || texto.length === 0) return null;

    // ⚠ O Live manda tanto o DELTA quanto a fala INTEIRA até aqui, e com a mesma frequência. Sem
    // distinguir os dois, "Consegue me dizer sobre" + "Consegue me dizer sobre o ecossistema" vira
    // os dois colados — a frase do aluno duplicada dentro de si mesma.
    if (texto.startsWith(this._buffer) && texto.length >= this._buffer.length) {
      this._buffer = texto;                 // instantâneo cumulativo
    } else if (this._buffer.endsWith(texto)) {
      /* já aplicado: repetição da cauda */
    } else {
      this._buffer += texto;                // delta de verdade
    }

    const fala = { turno: this._turno, tipo: EventoDeFala.Provisorio, texto: this._buffer.trim() };
    this._onFala(fala);
    return fala;
  }

  /**
   * Fecha a fala, e só por sinal REAL do servidor (`activityEnd` · `turnComplete` ·
   * `generationComplete`). Idempotente: um segundo sinal do mesmo turno não emite um segundo final.
   */
  fecharFala(motivo = 'sinal-do-servidor') {
    if (this._fechou) return null;
    const texto = this._buffer.trim();
    if (!texto) return null;
    this._fechou = true;
    const fala = { turno: this._turno, tipo: EventoDeFala.Final, texto, motivo };
    this._onFala(fala);
    return fala;
  }

  /** Enquanto for verdade, o aluno ainda está formando a frase — ninguém pode agir nem perguntar. */
  get estaFalando() { return this._buffer.trim().length > 0 && !this._fechou; }

  get falaAtual() { return this._buffer.trim(); }

  // ---- lado da FERRAMENTA (uma execução por `{turno, chamada}`) ---------------------------------

  /**
   * O que fazer com uma chamada de função.
   * @returns {{acao:'executar'|'repetir'|'velho', chave?:string, resultado?:any}}
   */
  classificarChamada(turno, idDaChamada) {
    if (this.eVelho(turno)) return { acao: 'velho' };
    const chave = `${turno}::${idDaChamada}`;
    const antes = this._chamadas.get(chave);
    if (antes?.estado === 'pronta') return { acao: 'repetir', chave, resultado: antes.resultado };
    if (antes?.estado === 'rodando') return { acao: 'repetir', chave, resultado: undefined };
    this._chamadas.set(chave, { estado: 'rodando', resultado: undefined });
    return { acao: 'executar', chave };
  }

  /** Memoriza o resultado: uma repetição do mesmo id nunca mais chega à ferramenta. */
  concluirChamada(chave, resultado) {
    this._chamadas.set(chave, { estado: 'pronta', resultado });
    return resultado;
  }

  /** Pares `{turno, chamada}` distintos de fato executados — é a asserção anti-duplicação. */
  get chamadasExecutadas() {
    return [...this._chamadas.values()].filter((c) => c.estado === 'pronta').length;
  }
}
