# Changelog

## [5.0.0] — 2026-02-20

### New features

- **`rateLimit`**: set `"rateLimit": { "windowMs": 60000, "limit": 100 }` to limit requests per client per time window via `express-rate-limit`. Responds with `429` when exceeded.
- **`basicAuth`**: set `"basicAuth": { "users": { "admin": "secret" } }` to protect a site with HTTP Basic Authentication via `express-basic-auth`.
- **`cgi`**: execute server-side scripts (Python, Perl, shell, or any `.cgi`) via the CGI protocol. Set `"cgi": "./cgi-bin"` for a quick start, or use the full object form to configure the URL path, extensions, and per-extension interpreters. HTTP headers are mapped to `CGI/1.1` environment variables; the request body is piped to stdin and the script's stdout is streamed back as the response. No external dependency — uses Node.js `child_process.spawn`.

---

## [4.0.0] — 2026-02-20

### New features

- **`compression`**: set `"compression": true` (or an options object) to enable gzip/deflate response compression via the `compression` middleware.
- **`helmet`**: set `"helmet": true` (or an options object) to apply security HTTP headers (CSP, HSTS, X-Frame-Options, and more) via the `helmet` middleware.
- **`cors`**: set `"cors": true` (or an options object) to enable CORS headers and automatic handling of preflight `OPTIONS` requests via the `cors` middleware.
- **`favicon`**: set `"favicon": "./path/to/favicon.ico"` to serve a favicon from memory (path resolved relative to the config file).
- **`responseTime`**: set `"responseTime": true` (or an options object) to add an `X-Response-Time` header to every response.

---

## [3.0.0] — 2026-02-20

### New features

- **HTTPS support**: add an `ssl` object to any site config (`key`, `cert`, optional `ca`) to serve the port over TLS. Paths are resolved relative to the config file. Mixing SSL and non-SSL configs on the same port is a startup error.
- **`logging` option**: set `"logging": false` in a site config to disable Morgan HTTP request logging for that port. Logging is enabled by default.
- **Hot reload**: set `"hotReload": true` to watch `folders` for file changes and push a reload signal to browsers via SSE. Add `<script src="/__hot-reload__/client.js"></script>` or `import '@lopatnov/express-reverse-proxy/hot-reload-client'` to your HTML.

### Improvements

- E2E tests (Cypress) now run in CI (GitHub Actions) as a separate job after linting.

---

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
