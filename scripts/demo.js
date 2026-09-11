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

// First character excludes "-" so a value can never be mistaken for another flag.
const SAFE_VALUE = /^[A-Za-z0-9_./+][A-Za-z0-9_./+-]*$/;
const KNOWN_FLAGS = new Set(['--config', '--env']);

function collectPassthroughArgs(argv) {
  const passthrough = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (KNOWN_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (!value || !SAFE_VALUE.test(value)) {
        throw new Error(`Missing or invalid value for ${arg}`);
      }
      passthrough.push(arg, value);
      i += 1;
    }
  }
  return passthrough;
}

// Re-validated immediately at the spawn call site (not just in collectPassthroughArgs)
// so no unsanitized value can reach the child process's argv, however configArg was built.
function assertSafePassthrough(args) {
  for (let i = 0; i < args.length; i += 2) {
    if (!KNOWN_FLAGS.has(args[i]) || !SAFE_VALUE.test(args[i + 1] ?? '')) {
      throw new Error(`Unsafe argument: ${args[i]} ${args[i + 1]}`);
    }
  }
  return args;
}

const passthroughArgs = collectPassthroughArgs(process.argv);
const configArg = passthroughArgs.length
  ? passthroughArgs
  : ['--config', './demo/server-config.json'];

const procs = [
  spawn('node', ['demo/server-a.js'], { cwd: root, stdio: 'inherit' }),
  spawn('node', ['demo/server-b.js'], { cwd: root, stdio: 'inherit' }),
  spawn('node', ['server.js', ...assertSafePassthrough(configArg)], {
    cwd: root,
    stdio: 'inherit',
  }),
];

function shutdown() {
  for (const p of procs) p.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const p of procs) p.on('error', (err) => console.error('[demo]', err.message));
