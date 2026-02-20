/**
 * Starts all demo processes:
 *   - demo/server-a.js  (Users API  → :4001)
 *   - demo/server-b.js  (Products API → :4002)
 *   - server.js         (Proxy → :8080, :8081)
 *
 * Usage: node scripts/demo.js [--config <path>]
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const configArg = process.argv.includes('--config')
  ? process.argv.slice(process.argv.indexOf('--config'))
  : ['--config', './demo/server-config.json'];

const procs = [
  spawn('node', ['demo/server-a.js'], { cwd: root, stdio: 'inherit', shell: true }),
  spawn('node', ['demo/server-b.js'], { cwd: root, stdio: 'inherit', shell: true }),
  spawn('node', ['server.js', ...configArg], { cwd: root, stdio: 'inherit', shell: true }),
];

function shutdown() {
  for (const p of procs) p.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const p of procs) p.on('error', (err) => console.error('[demo]', err.message));
