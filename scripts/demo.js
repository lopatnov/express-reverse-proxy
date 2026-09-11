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

const configIndex = process.argv.indexOf('--config');
const envIndex = process.argv.indexOf('--env');
const rawConfig = configIndex === -1 ? undefined : process.argv[configIndex + 1];
const rawEnv = envIndex === -1 ? undefined : process.argv[envIndex + 1];

if (configIndex !== -1 && (!rawConfig || !SAFE_VALUE.test(rawConfig))) {
  throw new Error('Missing or invalid value for --config');
}
if (envIndex !== -1 && (!rawEnv || !SAFE_VALUE.test(rawEnv))) {
  throw new Error('Missing or invalid value for --env');
}

const configValue = rawConfig ?? './demo/server-config.json';
const serverArgs =
  envIndex === -1 ? ['--config', configValue] : ['--config', configValue, '--env', rawEnv];

const procs = [
  spawn(process.execPath, ['demo/server-a.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['demo/server-b.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['server.js', ...serverArgs], { cwd: root, stdio: 'inherit' }),
];

function shutdown() {
  for (const p of procs) p.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const p of procs) p.on('error', (err) => console.error('[demo]', err.message));
