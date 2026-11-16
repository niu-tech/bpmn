// O que o aluno VÊ quando uma ferramenta roda (H3, colhido de `wiki-tool-activity.mjs`).
//
// Hoje ele vê a resposta e não vê o que foi consultado: a ferramenta roda invisível, e quando a
// resposta demora ele não sabe se o ajudante está pensando, travado, ou se a cota acabou.
//
// A separação é o ponto inteiro, e são três coisas distintas com três donos:
//
//   resultado  -> para o MODELO, completo e intocado. Ele continua recebendo cada fato.
//   detalhe    -> resumo TIPADO, só do lado do cliente. Não volta para o modelo.
//   linha      -> UMA linha curta para a tela.
//
// O defeito que isso mata está documentado na cápsula: a extensão devolvia `JSON.stringify(result)`
// como conteúdo da ferramenta e o renderizador imprimia — uma busca enterrava o terminal num muro
// de `{"results":[{"page":...}]}` antes de aparecer uma frase humana.
//
// ⚠ Este arquivo NÃO decide nada: não autoriza, não roteia, não escolhe ferramenta. Ele só
// apresenta o que já aconteceu. Quem decide o que pode rodar é a política; quem escolhe a
// ferramenta é o modelo.

/** Plural sem gambiarra: a conta é do chamador, a palavra é daqui. */
const QUOTE = '"';
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

/**
 * Uma linha por ferramenta. Cada entrada recebe `(entrada, resultado)` e devolve a linha da tela.
 *
 * Ferramenta sem entrada aqui cai no genérico — o que é melhor que um `JSON.stringify` e pior que
 * uma linha escrita à mão, e por isso é só a rede de segurança.
 */
const COMO_MOSTRAR = {
  /**
   * O ACERVO — e esta linha é a PROVENÂNCIA, não um enfeite de progresso.
   *
   * ⚠ Ela existia e **nunca apareceu**: o corpo estava colado dentro de `descrever_diagrama`,
   * referenciando um `nome` que não existe naquele escopo. O `ReferenceError` caía na rede de
   * segurança de `linhaDeFim` e as DUAS ferramentas viravam "usei <nome>" — a do acervo perdia
   * os trechos lidos, e a do diagrama perdia a contagem. Medido em 2026-11-16, quando o dono
   * perguntou se a voz usa o acervo: usa, e o aluno não via nem em texto o que foi lido.
   *
   * O título e o localizador vêm aqui porque a chave sozinha (`gateways:exclusivo`) é prova
   * para nós e nada para o aluno: o que ele confere é "Gateways, §10.5".
   */
  consultar_norma: (e, r) => {
    if (!r || r.ok === false) return 'consultei o acervo';
    const achados = Array.isArray(r.resultados) ? r.resultados : [];
    const termo = r.termo ?? e?.termo;
    const alvo = termo ? `"${termo}"` : 'o acervo';
    // ⚠ "não achei" tem de dizer o TAMANHO do acervo: sem isso o aluno (e o modelo) leem
    // "a notação não trata disso", que é outra afirmação e é falsa.
    if (!achados.length) {
      return `procurei ${alvo} no acervo de ${r.acervo?.verbetes ?? '?'} verbetes — nada`;
    }
    /**
     * O LOCALIZADOR, e não o título: ele é o ponteiro humano do acervo ("Gateways › exclusivo
     * (XOR)"), enquanto o título é a frase inteira do verbete ("Gateways — onde o caminho se
     * divide e volta a juntar"). Os dois juntos repetiam a palavra "Gateways" e faziam uma
     * linha de 90 caracteres para dizer onde está um trecho.
     */
    const onde = achados
      .map((x) => x.locator || x.title || x.citationKey)
      .join(' · ');
    return `li ${plural(achados.length, 'trecho', 'trechos')} do acervo — ${onde}`;
  },

  descrever_diagrama: (_e, r) => {
    if (!r || r.ok === false) return 'olhei o diagrama';
    const partes = [];
    if (r.total != null) partes.push(plural(r.total, 'elemento', 'elementos'));
    if (r.raias?.length) partes.push(plural(r.raias.length, 'raia', 'raias'));
    // Ponta solta é o defeito mais comum de aluno: se há, a linha diz quantas.
    if (r.semLigacao?.length) partes.push(plural(r.semLigacao.length, 'sem ligação', 'sem ligação'));
    if (r.selecionados?.length > 1) {
      partes.push(`selecionados: ${r.selecionados.map((e) => e.nome ?? e.id).join(', ')}`);
    } else if (r.selecionado?.nome) partes.push(`selecionado: ${r.selecionado.nome}`);
    return partes.length ? `olhei o diagrama — ${partes.join(' · ')}` : 'olhei o diagrama';
  },

  buscar_elemento: (e, r) => {
    const termo = r?.procurou?.termo ?? e?.termo;
    const alvo = termo ? `"${termo}"` : 'o diagrama';
    if (!r || r.ok === false) return `procurei ${alvo}`;
    const achou = r.total ?? r.elementos?.length ?? 0;
    // O "no diagrama INTEIRO" é a diferença que o aluno precisa entender: a amostra do contexto é
    // parcial, a busca não é. Sem isso, "não achei" soa como "não existe" (contrato H13).
    const onde = r.varreuODiagramaInteiro ? 'no diagrama inteiro' : 'na amostra';
    if (!achou) return `procurei ${alvo} ${onde} — nada`;
    // `cortou` é o que separa "achei 3" de "achei 3 destes 47": esconder isso faria o aluno ler a
    // amostra como se fosse o diagrama.
    const resto = r.cortou ? ` (mostrando ${r.elementos?.length ?? 0})` : '';
    return `procurei ${alvo} ${onde} — ${plural(achou, 'resultado', 'resultados')}${resto}`;
  },

  detalhar_elemento: (e, r) => {
    if (!r || r.ok === false) return 'abri um elemento';
    const nome = r.nome || e?.id || 'um elemento';
    const entra = r.entradas?.length ?? 0;
    const sai = r.saidas?.length ?? 0;
    return `abri "${nome}" — ${entra} de entrada, ${sai} de saída`;
  },

  resumir_simulacao: (_e, r) => {
    if (!r || r.ok === false) return 'li a última simulação';
    const partes = [];
    if (r.replicacoes != null) partes.push(plural(r.replicacoes, 'replicação', 'replicações'));
    if (r.gargalo?.nome) partes.push(`gargalo: ${r.gargalo.nome}`);
    // Avisar que o diagrama mudou DEPOIS da corrida é o que impede o aluno de ler número velho
    // como se fosse do desenho de agora.
    if (r.diagramaMudouDepoisDaCorrida) partes.push('⚠ o diagrama mudou depois da corrida');
    return partes.length ? `li a última simulação — ${partes.join(' · ')}` : 'li a última simulação';
  },

  // ---- escrita: a linha diz o que MUDOU no desenho, com o nome ou o id. O aluno precisa
  // poder conferir na tela — e precisa saber o que desfazer se não gostou.
  criar_elemento: (e, r) => {
    if (!r || r.ok === false || !r.criado) return 'tentei criar um elemento';
    const nome = r.criado.nome ? QUOTE + r.criado.nome + QUOTE : r.criado.id;
    const tipo = (r.criado.tipo ?? '').toLowerCase();
    const antes = r.ligadoA ? (r.ligadoA.nome ? QUOTE + r.ligadoA.nome + QUOTE : r.ligadoA.id) : null;
    const lado = (x) => (x?.nome ? QUOTE + x.nome + QUOTE : (x?.id ?? '?'));
    // Inserir no meio é outro desenho: o aluno tem de ver que a seta de antes foi partida.
    if (r.inseridoEntre) {
      return 'inseri ' + (tipo ? tipo + ' ' : '') + nome
        + ' entre ' + lado(r.inseridoEntre.de) + ' e ' + lado(r.inseridoEntre.para);
    }
    // ⚠ Ramo: a âncora já tinha saída, então isto NÃO entrou na linha — e o aluno precisa saber,
    // senão ele olha a tela e acha que o ajudante desenhou torto de graça. O fato vem de `fatos`,
    // que a leitura produz: o campo `ramo` de ocasião saiu na change close-the-loop-with-the-canvas.
    const ramo = r.fatos?.ramo ? ' (como ramo paralelo)' : '';
    return 'criei ' + (tipo ? tipo + ' ' : '') + nome + (antes ? ' depois de ' + antes : '') + ramo;
  },

  criar_pool: (e, r) => {
    if (!r || r.ok === false || !r.criado) return 'tentei criar um pool';
    const nome = r.criado.nome ? QUOTE + r.criado.nome + QUOTE : r.criado.id;
    // ⚠ A reestruturação entra na linha: o aluno vê o desenho inteiro mudar de lugar, e a linha
    // é o único lugar da tela que explica por quê.
    // O desenho inteiro pulando para dentro do pool é a maior surpresa visual que o agente
    // causa. A linha é o único lugar da tela que explica por quê.
    if (r.fatos?.adotou !== null && r.fatos?.adotou !== undefined) {
      const adotou = r.fatos.adotou ? ' e pôs ' + plural(r.fatos.adotou, 'elemento', 'elementos') + ' dentro' : '';
      return 'criei o pool ' + nome + adotou;
    }
    return 'criei o pool ' + nome;
  },

  criar_raia: (e, r) => {
    if (!r || r.ok === false || !r.criada) return 'tentei criar uma raia';
    const nome = r.criada.nome ? QUOTE + r.criada.nome + QUOTE : r.criada.id;
    const onde = r.em?.nome ? ' em ' + QUOTE + r.em.nome + QUOTE : '';
    // Duas faixas quando era a primeira: dizer isso evita o aluno achar que apareceu lixo.
    const par = r.fatos?.faixas?.length ? ' (e uma faixa para o que já estava lá)' : '';
    return 'criei a raia ' + nome + onde + par;
  },

  mover: (e, r) => {
    if (!r || r.ok === false || !r.movido) return 'tentei mover';
    const nome = r.movido.nome ? QUOTE + r.movido.nome + QUOTE : (r.movido.id ?? e?.id ?? 'o elemento');
    if (r.dentroDe) {
      const faixa = r.dentroDe.nome ? QUOTE + r.dentroDe.nome + QUOTE : r.dentroDe.id;
      return 'movi ' + nome + ' para ' + faixa;
    }
    const d = r.andou ?? {};
    const rumo = Math.abs(d.x ?? 0) >= Math.abs(d.y ?? 0)
      ? ((d.x ?? 0) >= 0 ? 'para a direita' : 'para a esquerda')
      : ((d.y ?? 0) >= 0 ? 'para baixo' : 'para cima');
    return 'movi ' + nome + ' ' + rumo;
  },

  alinhar: (e, r) => {
    if (!r || r.ok === false || !r.alinhados) return 'tentei alinhar';
    const quantos = r.alinhados.length;
    return 'alinhei ' + plural(quantos, 'elemento', 'elementos')
      + (r.eixo === 'coluna' ? ' na mesma coluna' : ' na mesma linha');
  },

  trocar_tipo: (e, r) => {
    if (!r || r.ok === false || !r.para) return 'tentei trocar o tipo';
    const nome = r.para.nome ? QUOTE + r.para.nome + QUOTE : r.para.id;
    const de = (r.de?.tipo ?? '').toLowerCase();
    const para = (r.para.tipo ?? '').toLowerCase();
    // As ligações preservadas são a parte que o aluno teme perder ao "mudar o símbolo".
    const ligacoes = r.ligacoesPreservadas
      ? ' (' + plural(r.ligacoesPreservadas, 'ligação mantida', 'ligações mantidas') + ')'
      : '';
    return 'troquei ' + nome + ': ' + de + ' -> ' + para + ligacoes;
  },

  conectar: (e, r) => {
    if (!r || r.ok === false || !r.ligou) return 'tentei ligar dois elementos';
    const lado = (x) => (x?.nome ? QUOTE + x.nome + QUOTE : (x?.id ?? '?'));
    // ⚠ O TIPO da ligação entra na linha: fluxo de mensagem e fluxo de sequência são coisas
    // diferentes em BPMN, e o aluno que pediu um e recebeu o outro tem de ver isso aqui.
    const tipo = r.tipoDaLigacao === 'MessageFlow' ? 'fluxo de mensagem' : 'fluxo de sequência';
    return 'liguei ' + lado(r.ligou.de) + ' -> ' + lado(r.ligou.para) + ' (' + tipo + ')';
  },

  renomear: (e, r) => {
    if (!r || r.ok === false || !r.para) return 'tentei renomear';
    const ate = QUOTE + r.para + QUOTE;
    return r.de ? 'renomeei ' + QUOTE + r.de + QUOTE + ' -> ' + ate : 'nomeei ' + ate;
  },

  remover: (e, r) => {
    if (!r || r.ok === false) return 'tentei remover';
    const alvo = r.alvo?.nome ? QUOTE + r.alvo.nome + QUOTE : (r.alvo?.id ?? e?.id ?? 'o elemento');
    // Recusa do aluno NÃO é falha: é a decisão dele, e a linha diz isso em vez de "não deu".
    if (r.recusadoPeloAluno) return 'não removi ' + alvo + ' — você não confirmou';
    return r.removido ? 'removi ' + alvo : 'não removi ' + alvo;
  },

  desfazer: (_e, r) => {
    if (!r || r.ok === false || !r.desfeito) return 'tentei desfazer';
    const sairam = r.sairamDoDiagrama?.length ?? 0;
    const voltaram = r.voltaramAoDiagrama?.length ?? 0;
    // Desfazer um nome ou um movimento não muda id nenhum: dizer "1 elemento saiu" ali seria
    // inventar. A linha só fala do que de fato entrou ou saiu.
    // Lote: o numero que o aluno le e o que VOLTOU, nunca o que foi pedido.
    const feitos = Number(r.desfeitos ?? 1);
    const quantas = feitos > 1 ? `desfiz as ${feitos} últimas mudanças` : 'desfiz a última mudança';
    if (!sairam && !voltaram) return quantas;
    const partes = [];
    if (sairam) partes.push('saiu ' + plural(sairam, 'elemento', 'elementos'));
    if (voltaram) partes.push('voltou ' + plural(voltaram, 'elemento', 'elementos'));
    return (feitos > 1 ? `desfiz ${feitos} — ` : 'desfiz — ') + partes.join(' · ');
  },

  destacar: (e, r) => {
    if (!r || r.ok === false || !r.destacados) return 'tentei destacar';
    const quantos = plural(r.destacados.length, 'elemento', 'elementos');
    if (r.cor === 'nenhuma') return 'limpei a cor de ' + quantos;
    return 'destaquei ' + quantos + ' em ' + r.cor;
  },

  lembrar: (e, r) => (r?.guardado
    ? `anotei${e?.categoria ? ` (${e.categoria})` : ''}`
    : 'tentei anotar'),
};

/** Quantos candidatos viram botão. Mais que isto é uma lista para ler, não uma escolha para fazer. */
const MAX_CANDIDATOS = 6;

/**
 * Os CANDIDATOS de um resultado de ferramenta — o que o aluno pode escolher com um clique.
 *
 * Por que existe (change `close-the-loop-with-the-canvas`, tarefa 4): `sem_lugar` já devolvia os
 * pools possíveis e `buscar_elemento` já devolvia os elementos que casam — e isso morria como
 * texto. O aluno lia os nomes e tinha de digitar a resposta, num produto em que ele está falando,
 * de mãos livres, olhando o desenho.
 *
 * ⚠ Esta função NÃO decide nada e não fala com o modelo: ela lê o resultado que já existe. Um
 * resultado sem ambiguidade devolve lista vazia — botão que aparece sem haver escolha é ruído.
 */
export function candidatosDoResultado(nome, resposta) {
  const envelope = resposta && typeof resposta === 'object' ? resposta : {};
  const resultado = 'resultado' in envelope ? envelope.resultado : envelope;

  // Recusa por ambiguidade: os candidatos vêm do erro nomeado, pelo despachante.
  const daRecusa = Array.isArray(envelope.candidatos) ? envelope.candidatos : null;
  // Busca que achou mais de um: a escolha é do aluno, e ele quer VER qual é qual no desenho.
  const daBusca = nome === 'buscar_elemento' && Array.isArray(resultado?.elementos) && resultado.elementos.length > 1
    ? resultado.elementos
    : null;

  const lista = daRecusa ?? daBusca ?? [];
  return lista
    .filter((c) => c && (c.id || c.nome))
    .slice(0, MAX_CANDIDATOS)
    .map((c) => ({
      id: c.id ?? null,
      nome: c.nome ?? null,
      tipo: c.tipo ?? null,
      // O rótulo é o que vai no botão E no que o aluno "diz" ao escolher: um texto só, para a
      // tela e a conversa não discordarem sobre o que foi escolhido.
      rotulo: c.nome ? `${c.nome}${c.tipo ? ` (${String(c.tipo).toLowerCase()})` : ''}` : (c.id ?? '?'),
    }));
}

/**
 * O que, no resultado da ferramenta, o aluno pode querer **VER no desenho** (cartão clicável).
 *
 * ⚠ NÃO é o mesmo que `candidatosDoResultado`, e a diferença é o que o clique FAZ. Candidato é
 * resposta a uma pergunta do agente (*"em qual pool?"*): clicar **diz** a escolha ao modelo e
 * gasta um turno. Aqui o aluno só quer saber **onde fica** o que a ferramenta achou — clicar
 * **seleciona** no diagrama, como o clique dele selecionaria, e não fala com o modelo nem gasta
 * cota. Vinha do vídeo do *appointment agent* (lá, médico e horário em cartões); aqui é o
 * elemento encontrado.
 *
 * Os dois nunca aparecem juntos: havendo candidato, a pergunta do agente está em pé e é ela que
 * manda — duas fileiras de botão para a mesma coisa é o aluno adivinhando qual clicar.
 */
export function mostraveisDoResultado(nome, resposta) {
  if (candidatosDoResultado(nome, resposta).length) return [];
  const envelope = resposta && typeof resposta === 'object' ? resposta : {};
  if (envelope.ok === false) return [];
  const resultado = 'resultado' in envelope ? envelope.resultado : envelope;
  if (!resultado || typeof resultado !== 'object') return [];

  // ⚠ MAPA de chaves, e não `nome === 'buscar_elemento'`: comparar texto com nome de ferramenta
  // é a forma proibida pelo §III do project.md (quem escolhe ação é o MODELO, nunca uma comparação
  // de string no nosso código), e a varredura dos guardrails reprova a build por isso. Aqui não
  // se decide ação nenhuma — só se sabe onde, em cada formato de resultado, mora o elemento —,
  // mas a regra vale pela FORMA: chave de objeto, como o `COMO_MOSTRAR` logo abaixo.
  const ONDE_ESTA_O_ELEMENTO = {
    buscar_elemento: (r) => (Array.isArray(r.elementos) ? r.elementos : []),
    detalhar_elemento: (r) => [r],
    criar_elemento: (r) => [r.criado],
  };
  const lista = ONDE_ESTA_O_ELEMENTO[nome]?.(resultado) ?? [];

  return lista
    .filter((c) => c && c.id)
    .slice(0, MAX_CANDIDATOS)
    .map((c) => ({
      id: c.id,
      nome: c.nome ?? null,
      tipo: c.tipo ?? null,
      rotulo: c.nome ? String(c.nome) : String(c.id),
      // A marca que o painel lê para saber que o clique MOSTRA, em vez de escolher.
      mostrar: true,
    }));
}

/** Enquanto roda: o aluno precisa saber que há algo acontecendo, antes de haver resultado. */
export function linhaDeInicio(nome) {
  return ({
    consultar_norma: 'consultando o acervo…',
    descrever_diagrama: 'olhando o diagrama…',
    buscar_elemento: 'procurando no diagrama…',
    detalhar_elemento: 'abrindo o elemento…',
    resumir_simulacao: 'lendo a simulação…',
    criar_elemento: 'criando no diagrama…',
    criar_pool: 'criando o pool…',
    criar_raia: 'criando a raia…',
    conectar: 'ligando os elementos…',
    renomear: 'renomeando…',
    mover: 'movendo no desenho…',
    alinhar: 'alinhando…',
    trocar_tipo: 'trocando o tipo…',
    desfazer: 'desfazendo…',
    destacar: 'destacando no diagrama…',
    // ⚠ "removendo…" mentiria: nesse instante ainda se espera o aluno confirmar.
    remover: 'esperando você confirmar a remoção…',
    lembrar: 'anotando…',
  })[nome] ?? `${nome}…`;
}

/**
 * A linha da tela para uma ferramenta que terminou.
 *
 * Falha vira frase, não código: `ferramenta_nao_roteada` não diz nada a um aluno de BPMN.
 */
/**
 * A ASSIMETRIA DA VOZ, dita na hora em que ela importa (K6, tarefa 3.5).
 *
 * ⚠ No modo texto o aplicativo confere cada marca `[fonte:*]` contra o que foi realmente
 * consultado. No modo voz o áudio vai do provedor ao alto-falante sem passar por nós — lá vale
 * a regra do prompt, e só ela. Prometer igual nos dois modos seria mentira; pôr um aviso
 * permanente na tela seria ruído. Então a linha aparece **na bolha da consulta**, que é o único
 * momento em que a diferença tem consequência.
 */
/**
 * ⚠ MAPA com chave não citada, e não `nome === 'consultar_norma'`: a varredura do guardrail
 * recusa dois nomes de ferramenta como STRING no mesmo arquivo — dois literais são uma tabela de
 * roteamento esperando para acontecer. Como chave de objeto, o nome é declaração, não despacho.
 */
const TEM_FONTE_CITAVEL = { consultar_norma: true };

/**
 * AS FONTES QUE A CONSULTA DE FATO SERVIU, em forma, para a tela mostrar.
 *
 * ⚠ Isto é o que torna a citação conferivel NA VOZ (K6, corrigido em 2026-11-16). No texto a
 * conferência pode ser feita na marca `[fonte:*]` que o modelo escreve; na voz o modelo não
 * escreve nada — ele fala, e ler "abre colchete fonte dois pontos" em voz alta seria pior que
 * não citar. Então a proveniência na voz não vem do que ele diz: vem do que NÓS servimos, que é
 * registro nosso e não depende da boa vontade do modelo.
 *
 * Mapa com chave não citada, como `mostraveisDoResultado`: nome de ferramenta como chave é
 * declaração, como string seria despacho (guardrail).
 */
const ONDE_ESTAO_AS_FONTES = {
  consultar_norma: (r) => (Array.isArray(r.resultados) ? r.resultados : []),
};

export function fontesDoResultado(nome, resposta) {
  const resultado = (resposta && typeof resposta === 'object' && 'resultado' in resposta)
    ? resposta.resultado
    : resposta;
  if (!resultado || resultado.ok === false) return [];
  const lista = ONDE_ESTAO_AS_FONTES[nome]?.(resultado) ?? [];
  return lista
    .filter(Boolean)
    .map((f) => ({
      chave: String(f.citationKey ?? ''),
      titulo: String(f.title ?? ''),
      localizador: String(f.locator ?? ''),
      // Só http(s): link vindo do índice é dado, e dado não escolhe esquema de URL.
      link: /^https?:\/\//.test(String(f.officialUrl ?? '')) ? String(f.officialUrl) : null,
      // Material NOSSO (`curated_card_only`) não pode ser citado como texto da norma da OMG.
      nosso: f.contentMode === 'curated_card_only',
    }))
    .filter((f) => f.chave);
}

/**
 * O QUE A VOZ NÃO ALCANÇA, dito onde tem consequência — e só isso.
 *
 * ⚠ Esta linha dizia *"na voz, a citação não é conferida pelo aplicativo"*, e isso virou falso
 * em 2026-11-16: a legenda na tela passou a ser conferida como o texto, e as fontes servidas
 * aparecem na bolha da consulta nos DOIS modos. O que continua fora do nosso alcance é o
 * ÁUDIO — ele vai do provedor ao alto-falante e não dá para reescrever o que já foi dito. A
 * frase mede esse limite, nem mais nem menos: prometer igual seria mentira, e manter a antiga
 * seria dizer ao aluno que não há conferência quando há.
 */
export function avisoDeCitacaoNaVoz(nome, modo) {
  return TEM_FONTE_CITAVEL[nome] && modo === 'voz'
    ? ' (o áudio já foi falado; a fonte vai na resposta)'
    : '';
}

export function linhaDeFim(nome, entrada, resposta) {
  if (resposta && resposta.ok === false) {
    const comeco = linhaDeInicio(nome).replace(/…$/, '');
    // ⚠ Recusa por AMBIGUIDADE não é falha: é uma pergunta. "não deu" em cima de dois botões de
    // escolha diz ao aluno que algo quebrou, quando o que falta é ele clicar — e os botões estão
    // logo ali, na mesma bolha.
    if (candidatosDoResultado(nome, resposta).length) return `${comeco} — em qual destes?`;
    return `${comeco} — não deu`;
  }
  // ⚠ O despachante entrega um ENVELOPE — `{ ok, resultado }` —, não o retorno cru da ferramenta.
  // Ler o envelope como se fosse o resultado fazia a busca dizer "na amostra" quando ela varre o
  // diagrama inteiro: o campo estava um nível abaixo. Visto ao vivo em 2026-11-13, com os testes
  // verdes — porque eles alimentavam a forma crua, que nunca chega aqui.
  const resultado = (resposta && typeof resposta === 'object' && 'resultado' in resposta)
    ? resposta.resultado
    : resposta;
  const como = COMO_MOSTRAR[nome];
  try {
    return como ? como(entrada ?? {}, resultado ?? {}) : `usei ${nome}`;
  } catch {
    // Apresentador NUNCA derruba a conversa: na dúvida, a linha genérica.
    return `usei ${nome}`;
  }
}
