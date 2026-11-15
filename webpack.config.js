const path = require('path');

module.exports = {
  mode: 'development',

  // ✅ mantém o modelador intacto em /index.html (bundle.js)
  // ✅ adiciona um segundo entry para o viewer + batch-sim em /viewer.html (viewer.js)
  //
  // O spike de voz/Live (openspec add-bpmn-public-live-assistant-mvp, design D6) entra SÓ com
  // BPMN_SPIKE=1. Sem a variável — e o Dockerfile não a define — o grafo de módulos de produção
  // é exatamente o de antes dele existir, e nenhum byte do spike entra em bundle.js/viewer.js.
  entry: {
    bundle: './src/app.js',
    viewer: './src/viewer.js',
    ...(process.env.BPMN_SPIKE === '1' ? { spike: './spike/main.js' } : {})
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    /**
     * Limpa o `dist/` — MENOS o acervo.
     *
     * ⚠ `clean: true` apagava `dist/knowledge/index.json`, que não é saída do webpack: quem o
     * gera é `tools/build-knowledge.mjs`, o segundo passo do `npm run build`. Então qualquer
     * `npx webpack` solto (um build de depuração, por exemplo) deixava o site servindo um acervo
     * que não existe — e o sintoma aponta para o lugar errado: a bateria reprova "o acervo
     * responde pelo caminho do modelo" com `acervo: null`, como se o defeito fosse da busca, e
     * de carona reprova "candidato clicavel" com a sessão `desligado`. Custou 20 minutos de
     * caça na outra conversa, em 2026-11-15.
     *
     * `keep` é do próprio webpack: o passo do acervo continua sendo o dono daquele arquivo, e
     * ninguém mais precisa lembrar da ordem dos dois comandos.
     */
    clean: { keep: /^knowledge[\\/]/ }
  },

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },

  devServer: {
    static: [
      { directory: path.resolve(__dirname, 'src') },
      { directory: path.resolve(__dirname, 'diagrams') },
      // O ÍNDICE DO ACERVO, gerado por `node tools/build-knowledge.mjs` (K1). Servido em
      // /knowledge/index.json, que é onde `criarAcervo` procura.
      { directory: path.resolve(__dirname, 'dist/knowledge'), publicPath: '/knowledge' },
      // Só no dev server: /spike/ serve a página do spike. A imagem Docker não copia nada daqui.
      ...(process.env.BPMN_SPIKE === '1'
        ? [{ directory: path.resolve(__dirname, 'spike'), publicPath: '/spike' }]
        : [])
    ],
    port: 8080,
    open: true
  }
};
