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

function collectPassthroughArgs(argv) {
  const passthrough = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config' || arg === '--env') {
      const value = argv[i + 1];
      if (!value || value === '--config' || value === '--env') {
        throw new Error(`Missing value for ${arg}`);
      }
      passthrough.push(arg, value);
      i += 1;
    }
  }
  return passthrough;
}

const passthroughArgs = collectPassthroughArgs(process.argv);
const configArg = passthroughArgs.length
  ? passthroughArgs
  : ['--config', './demo/server-config.json'];

const procs = [
  spawn('node', ['demo/server-a.js'], { cwd: root, stdio: 'inherit' }),
  spawn('node', ['demo/server-b.js'], { cwd: root, stdio: 'inherit' }),
  spawn('node', ['server.js', ...configArg], { cwd: root, stdio: 'inherit' }),
];

function shutdown() {
  for (const p of procs) p.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const p of procs) p.on('error', (err) => console.error('[demo]', err.message));
