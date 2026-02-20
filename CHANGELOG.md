# Changelog

## [2.0.0] — 2026-02-20

### Breaking changes

- **ESM**: project converted to ES Modules (`"type": "module"`). `require()` no longer works.
- **`ecosystem.config.js` → `ecosystem.config.cjs`**: PM2 ecosystem file renamed to `.cjs` (required when package is ESM).
- **Node.js ≥ 18** is now the minimum supported version.

### New features

- **Array config**: `server-config.json` can now be an array of site objects for multi-site hosting.
- **`host` routing**: each config entry accepts a `host` field to route by HTTP `Host` header; `"*"` or absent = catch-all.
- **Multi-port**: configs on different ports each get their own Express app and `server.listen()`.
- **`--cluster`** CLI option: manages the PM2 cluster (`start`, `stop`, `restart`, `status`, `logs`, `monitor`).
- **`--cluster-config`** CLI option: provide a custom PM2 ecosystem config file path.
- **Default config fallback**: missing `server-config.json` with no `--config` flag now shows a warning and uses `{ port: 8000, folders: "." }` instead of crashing.
- **Demo**: `demo/` folder with two mock API servers (`server-a.js`, `server-b.js`) and two front-end clients. Run with `npm run demo`.
- **Cypress E2E tests**: `cypress/e2e/` covers static serving and proxy routing on both demo ports.
- **Biome**: replaces ESLint + Prettier for linting and formatting.

### Improvements

- Graceful shutdown via `SIGINT`/`SIGTERM` with a 10-second force-exit timeout.
- `EADDRINUSE` error on `server.listen()` prints a clear message instead of crashing with a stack trace.
- JSON config parse errors include the file path and the underlying error message.
- Port validation: invalid range (< 1 or > 65535) exits with an error at startup.
- Docker image updated to `node:lts-alpine` with a non-root user and `HEALTHCHECK`.
- GitHub Actions CI runs Biome lint on Node.js 18 and 20.

---

## [1.x]

Initial releases. CommonJS, single-site config only, ESLint.
