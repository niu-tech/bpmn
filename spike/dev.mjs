// Sobe o dev server COM a entry do spike ligada. Existe porque `BPMN_SPIKE=1 webpack serve` não
// é portátil (o `cmd` do Windows não aceita a atribuição em linha) e porque pagar uma dependência
// como `cross-env` só para exportar uma variável é caro demais.
//
// Uso: npm run dev:spike   ->   http://localhost:8080/spike/
//      (o modelador segue em /, o viewer em /viewer.html)

import { spawn } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(npx, ['webpack', 'serve', '--config', 'webpack.config.js'], {
  stdio: 'inherit',
  env: { ...process.env, BPMN_SPIKE: '1' },
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
