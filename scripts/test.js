/**
 * E2E test runner:
 *   1. Starts demo/server-a.js, demo/server-b.js, and the proxy (server.js)
 *   2. Waits for all required ports to respond (4001, 4002, 8080, 8081)
 *   3. Runs `cypress run`
 *   4. Kills all spawned processes and exits with Cypress exit code
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function waitForUrl(url, { timeout = 30_000, interval = 300 } = {}) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;

    function probe() {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() > deadline) {
            reject(new Error(`Timed out waiting for ${url}`));
          } else {
            setTimeout(probe, interval);
          }
        });
    }

    probe();
  });
}

function spawnProc(cmd, args, label, opts = {}) {
  const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts });
  p.on('error', (err) => console.error(`[${label}]`, err.message));
  return p;
}

// ── start servers ─────────────────────────────────────────────────────────────

console.log('[test] Starting demo servers…');

const procs = [
  spawnProc('node', ['demo/server-a.js'], 'server-a'),
  spawnProc('node', ['demo/server-b.js'], 'server-b'),
  spawnProc('node', ['server.js', '--config', './demo/server-config.json'], 'proxy'),
];

function killAll(code = 0) {
  for (const p of procs) p.kill();
  process.exit(code);
}

process.on('SIGINT', () => killAll(0));
process.on('SIGTERM', () => killAll(0));

// ── wait for all ports ────────────────────────────────────────────────────────

const urls = [
  'http://localhost:4001/users',
  'http://localhost:4002/products',
  'http://localhost:8080',
  'http://localhost:8081',
];

try {
  console.log('[test] Waiting for servers to be ready…');
  await Promise.all(urls.map((u) => waitForUrl(u)));
  console.log('[test] All servers ready. Running Cypress…\n');
} catch (err) {
  console.error('[test] Error:', err.message);
  killAll(1);
}

// ── run cypress ───────────────────────────────────────────────────────────────

// ELECTRON_RUN_AS_NODE (set by bash/git-bash) causes Cypress.exe to crash;
// unset it so Electron starts as a normal GUI/headless app.
const { ELECTRON_RUN_AS_NODE: _removed, ...cleanEnv } = process.env;
const cypress = spawnProc('cypress', ['run'], 'cypress', { env: cleanEnv });

cypress.on('close', (code) => {
  console.log(`\n[test] Cypress exited with code ${code}`);
  killAll(code ?? 1);
});
