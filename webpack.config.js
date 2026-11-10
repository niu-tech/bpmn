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
    clean: true
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
      // Só no dev server: /spike/ serve a página do spike. A imagem Docker não copia nada daqui.
      ...(process.env.BPMN_SPIKE === '1'
        ? [{ directory: path.resolve(__dirname, 'spike'), publicPath: '/spike' }]
        : [])
    ],
    port: 8080,
    open: true
  }
};
