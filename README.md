# express-reverse-proxy

> Lightweight Node.js CLI tool to serve static front-end files and reverse-proxy API requests to a back-end server.
> Zero-config start, flexible JSON configuration, PM2 and Docker ready.

[![npm downloads](https://img.shields.io/npm/dt/@lopatnov/express-reverse-proxy)](https://www.npmjs.com/package/@lopatnov/express-reverse-proxy)
[![npm version](https://badge.fury.io/js/%40lopatnov%2Fexpress-reverse-proxy.svg)](https://www.npmjs.com/package/@lopatnov/express-reverse-proxy)
[![License](https://img.shields.io/github/license/lopatnov/express-reverse-proxy)](https://github.com/lopatnov/express-reverse-proxy/blob/master/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/lopatnov/express-reverse-proxy)](https://github.com/lopatnov/express-reverse-proxy/issues)
[![GitHub stars](https://img.shields.io/github/stars/lopatnov/express-reverse-proxy)](https://github.com/lopatnov/express-reverse-proxy/stargazers)

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Demo](#demo)
- [How It Works](#how-it-works)
- [CLI Options](#cli-options)
- [Configuration](#configuration)
  - [port](#port)
  - [headers](#headers)
  - [folders](#folders)
  - [proxy](#proxy)
  - [unhandled](#unhandled)
  - [host](#host)
- [Configuration Recipes](#configuration-recipes)
- [Docker & PM2](#docker--pm2)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Built With](#built-with)
- [License](#license)

---

## Installation

**Global install (recommended for CLI use):**

```shell
npm install -g @lopatnov/express-reverse-proxy
```

**Local dev dependency:**

```shell
npm install --save-dev @lopatnov/express-reverse-proxy
```

**Run without installing:**

```shell
npx @lopatnov/express-reverse-proxy
```

---

## Quick Start

1. Create a `server-config.json` in your project root:

```json
{
  "port": 8080,
  "folders": "www",
  "proxy": {
    "/api": "http://localhost:4000"
  }
}
```

2. Start the server:

```shell
express-reverse-proxy
```

Your front-end files from `./www` are now served at `http://localhost:8080`, and any request to `/api/*` is forwarded to your back-end at `http://localhost:4000`.

> **No config file?** If `server-config.json` is not found, the server starts with built-in defaults: port `8000`, serving files from the current directory (`.`). A warning is printed to the console.

See [server-config.json](./server-config.json) for a full configuration example.

---

## Demo

The repository includes a full working demo: two mock back-end APIs and two front-end clients, each served by a separate proxy instance.

```
demo/
  server-a.js       — Users API    (port 4001)
  server-b.js       — Products API (port 4002)
  client-a/         — Frontend A   (port 8080, proxies /api → :4001)
  client-b/         — Frontend B   (port 8081, proxies /api → :4002)
  server-config.json
```

**Start all demo processes at once:**

```shell
npm run demo
```

This command starts both mock back-ends and the proxy server (serving both clients) as a single Node.js-managed process group. Open the clients in your browser:

| URL                     | Description                  |
| ----------------------- | ---------------------------- |
| `http://localhost:8080` | Client A — Users API demo    |
| `http://localhost:8081` | Client B — Products API demo |

Click the **Send request** buttons to see live API responses flowing through the proxy. Press `Ctrl+C` to stop all processes.

**Demo architecture:**

```
Browser
  │
  ├─▶  localhost:8080  (express-reverse-proxy)
  │      ├─▶  GET /         → serves demo/client-a/index.html
  │      └─▶  GET /api/**   → proxied to demo/server-a.js :4001
  │
  └─▶  localhost:8081  (express-reverse-proxy)
         ├─▶  GET /         → serves demo/client-b/index.html
         └─▶  GET /api/**   → proxied to demo/server-b.js :4002
```

---

## How It Works

Every incoming request is processed in order:

```
Request
  │
  ├─▶  Custom headers applied (if configured)
  │
  ├─▶  Static files checked (folders, in order)
  │       └─▶  File found → serve it
  │
  ├─▶  Reverse proxy rules checked (proxy)
  │       └─▶  Path matches → forward to back-end → return response
  │
  └─▶  No match → unhandled handler (by Accept header)
            └─▶  Return status + body or redirect
```

Static files always take priority over proxy rules. Proxies are checked only when no file matches.

---

## CLI Options

| Option                    | Description                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `--help`                  | Print help and exit                                                                             |
| `--config <file>`         | Path to the JSON configuration file. Default: `server-config.json`                              |
| `--cluster [action]`      | Manage the PM2 cluster. Action defaults to `start` when omitted                                 |
| `--cluster-config <file>` | Path to a custom PM2 ecosystem config file. Default: `ecosystem.config.cjs` next to `server.js` |

### --cluster actions

| Action    | Description                                            |
| --------- | ------------------------------------------------------ |
| `start`   | Start the PM2 cluster (default when action is omitted) |
| `stop`    | Stop all cluster instances                             |
| `restart` | Restart all cluster instances                          |
| `status`  | Show PM2 process status table                          |
| `logs`    | Stream the last 200 log lines                          |
| `monitor` | Open the PM2 real-time monitor                         |

```shell
express-reverse-proxy --cluster
express-reverse-proxy --cluster start
express-reverse-proxy --cluster stop
express-reverse-proxy --cluster restart
express-reverse-proxy --cluster status
express-reverse-proxy --cluster logs
express-reverse-proxy --cluster monitor
```

Pass a custom config to cluster workers with `--config`:

```shell
express-reverse-proxy --cluster start --config ./configs/prod.json
```

Use a custom PM2 ecosystem file with `--cluster-config`:

```shell
express-reverse-proxy --cluster start --cluster-config ./my-ecosystem.config.cjs
express-reverse-proxy --cluster restart --cluster-config /etc/myapp/ecosystem.config.cjs
```

---

## Configuration

All configuration lives in a single JSON file (default `server-config.json`).

### port

The port the server listens on. Defaults to `8000`. Can also be set via the `PORT` environment variable.

```json
{
  "port": 8080
}
```

### headers

Add headers to every response — useful for CORS in development.

```json
{
  "headers": {
    "Access-Control-Allow-Origin": "*"
  }
}
```

### folders

Serve static files. Supports three forms:

**Single directory:**

```json
{
  "folders": "www"
}
```

**Multiple directories** (searched in order):

```json
{
  "folders": ["./www", "./mock-json", "../../images"]
}
```

**URL path mapping** (nested objects supported):

```json
{
  "folders": {
    "/": "dist",
    "/api": "./mock-json",
    "/assets": {
      "/images": "./images",
      "/css": "./scss/dist",
      "/script": "./scripts"
    }
  }
}
```

The above maps:

| URL path         | Local directory |
| ---------------- | --------------- |
| `/`              | `dist`          |
| `/api`           | `./mock-json`   |
| `/assets/images` | `./images`      |
| `/assets/css`    | `./scss/dist`   |
| `/assets/script` | `./scripts`     |

### proxy

Forward requests to a back-end server. Supports three forms:

**Proxy everything to one server:**

```json
{
  "proxy": "http://localhost:4000"
}
```

**Map a URL path prefix to a server:**

```json
{
  "proxy": {
    "/api": "http://localhost:4000"
  }
}
```

**Multiple proxy rules:**

```json
{
  "proxy": [
    { "/api": "http://localhost:4000" },
    { "/auth": "http://localhost:5000" }
  ]
}
```

### unhandled

Control responses when no static file or proxy rule matches. Rules are selected by the request's `Accept` header.

```json
{
  "unhandled": {
    "html": {
      "status": 307,
      "headers": { "Location": "/" }
    },
    "json": {
      "status": 404,
      "send": { "error": "Not Found" }
    },
    "xml": {
      "status": 404,
      "send": "<error>Not Found</error>"
    },
    "*": {
      "status": 404,
      "file": "./www/not-found.txt"
    }
  }
}
```

Each `Accept` key supports these response options:

| Option    | Type               | Description                                  |
| --------- | ------------------ | -------------------------------------------- |
| `status`  | `number`           | HTTP response status code                    |
| `headers` | `object`           | Additional response headers                  |
| `send`    | `string \| object` | Inline response body (text or JSON)          |
| `file`    | `string`           | Path to file whose contents are sent as body |

### host

Route requests to this configuration based on the HTTP `Host` header. Enables virtual hosting — multiple sites on one server process.

| Value             | Behavior                                                     |
| ----------------- | ------------------------------------------------------------ |
| `"app.localhost"` | Only handles requests whose `Host` header matches exactly    |
| `"*"` or omitted  | Catch-all — handles any request not matched by another entry |

To use multi-site mode, make the config file an **array** instead of an object. Specific hosts are always checked before the catch-all.

**Multiple sites on one port** — routing by `Host` header:

```json
[
  { "host": "app.localhost", "port": 8080, "folders": "www" },
  { "host": "admin.localhost", "port": 8080, "folders": "admin" },
  { "host": "*", "port": 8080, "folders": "fallback" }
]
```

**Multiple sites on different ports** — one server instance per port:

```json
[
  { "host": "app.localhost", "port": 8080, "folders": "www" },
  { "host": "admin.localhost", "port": 8080, "folders": "admin" },
  {
    "host": "api.localhost",
    "port": 9090,
    "proxy": { "/": "http://localhost:4000" }
  },
  { "host": "*", "port": 9090, "folders": "fallback" }
]
```

> Configs with the same `port` share one Express server; configs with different `port` values each start their own server.
>
> Two entries with the same `host` **and** `port` cause a startup error. The same `host` on different ports is allowed.

---

## Configuration Recipes

### Static files first, then fall back to back-end

All unmatched requests are forwarded to `localhost:4000`.

```json
{
  "port": 8080,
  "folders": "www",
  "proxy": "http://localhost:4000"
}
```

- `GET /index.html` → served from `./www/index.html`
- `GET /missing` → proxied to `http://localhost:4000/missing`

### Static files + API on a specific path

Only `/api/*` requests go to the back-end; everything else stays local.

```json
{
  "port": 8080,
  "folders": "www",
  "proxy": {
    "/api": "http://localhost:4000"
  }
}
```

- `GET /index.html` → served from `./www/index.html`
- `GET /api/users` → proxied to `http://localhost:4000/users`
- `GET /missing` → 404 Not Found

### CORS headers + rich error responses

```json
{
  "port": 8080,
  "headers": {
    "Access-Control-Allow-Origin": "*"
  },
  "folders": "www",
  "proxy": {
    "/api": "https://stat.ripe.net"
  },
  "unhandled": {
    "html": {
      "status": 307,
      "headers": { "Location": "/" }
    },
    "json": {
      "status": 404,
      "send": { "error": "JSON Not Found" }
    },
    "xml": {
      "status": 404,
      "send": "<error>Not Found</error>"
    }
  }
}
```

---

## Docker & PM2

### Docker

A `Dockerfile` is included. Build and run:

```shell
docker build -t express-reverse-proxy .
docker run -p 8080:8080 -v $(pwd)/server-config.json:/app/server-config.json express-reverse-proxy
```

### PM2

The package includes a default `ecosystem.config.cjs`, resolved automatically from the package directory. It runs the server in **cluster mode** — PM2 acts as a load balancer and all worker processes share a single port through the Node.js cluster module. Without cluster mode each instance would try to bind its own copy of the port and all but the first would fail.

<details>
<summary>Default ecosystem.config.cjs (for reference)</summary>

```javascript
// ecosystem.config.cjs
const path = require("path");
module.exports = {
  apps: [
    {
      name: "express-reverse-proxy", // process name in pm2 list
      script: path.join(__dirname, "server.js"), // absolute path — works after global install
      instances: "max", // one worker per CPU core
      exec_mode: "cluster", // required for port sharing
      wait_ready: true, // wait for process.send('ready') before marking healthy
      listen_timeout: 30000, // ms to wait for 'ready' signal
      kill_timeout: 5000, // ms to wait for graceful shutdown before SIGKILL
      shutdown_with_message: true, // send 'shutdown' message instead of SIGINT
      env: { NODE_ENV: "production" },
      env_development: { NODE_ENV: "development" },
    },
  ],
};
```

</details>

To customize PM2 behavior, provide your own file via `--cluster-config` (optional):

```shell
express-reverse-proxy --cluster start --cluster-config ./my-ecosystem.config.cjs
```

Run via npm scripts:

| Script                | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `npm run pm2-start`   | Start cluster (max CPU cores) via `ecosystem.config.cjs` |
| `npm run pm2-stop`    | Stop all instances                                       |
| `npm run pm2-status`  | Show process status                                      |
| `npm run pm2-logs`    | Show last 200 log lines                                  |
| `npm run pm2-monitor` | Open real-time monitor                                   |

Or use the CLI directly:

```shell
express-reverse-proxy --cluster start
express-reverse-proxy --cluster status
express-reverse-proxy --cluster stop
```

---

## Testing

The project uses [Cypress](https://www.cypress.io/) for E2E testing. Tests cover static file serving, reverse proxy routing, custom response headers, and unhandled route behaviour on both Client A (:8080) and Client B (:8081).

**Open Cypress interactively** (pick tests to run in the browser UI):

```shell
npm run cypress:open
```

**Run all tests headlessly** (requires demo servers to be running first):

```shell
# Terminal 1 — start demo servers
npm run demo

# Terminal 2 — run tests
npm run cypress:run
```

**Or start everything automatically:**

```shell
npm test
```

`npm test` uses [scripts/test.js](./scripts/test.js), which starts all demo servers, waits for all four ports (4001, 4002, 8080, 8081) to be ready, runs Cypress, then shuts everything down.

### Test coverage

| Suite          | What is tested                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `static.cy.js` | Both clients load, serve CSS, return custom headers, redirect unhandled HTML routes, return 404 for unhandled JSON                |
| `proxy.cy.js`  | `/api/users` proxied to Users API, `/api/products` proxied to Products API, 404 for non-existent resources, UI button interaction |

---

## Troubleshooting

**Server starts but static files are not served**

- Check that the path in `folders` is correct relative to where you run the command, not relative to `server-config.json`.
- Verify the directory exists: `ls ./www` (or the path you configured).

**Proxy requests return 502 or fail silently**

- Confirm the back-end is running and reachable: `curl http://localhost:4000/api/health`.
- The proxy address must include the protocol: `"http://localhost:4000"`.

**Port already in use**

```
Error: listen EADDRINUSE :::8080
```

Either change `port` in `server-config.json`, or set the environment variable:

```shell
PORT=9090 express-reverse-proxy
```

**CORS errors in the browser**

Add a `headers` block to your config:

```json
{
  "headers": {
    "Access-Control-Allow-Origin": "*"
  }
}
```

**`server-config.json` not found**

If no config file is found, the server starts with built-in defaults — port `8000`, serving files from `.` (the current directory) — and prints a yellow warning. This is useful for a quick local file preview.

To use your own config, either place `server-config.json` in the working directory or specify a path with `--config`:

```shell
express-reverse-proxy --config ./configs/dev.json
```

**Multiple configs with the same host + port**

```
Error: Duplicate host "app.localhost" on port 8080
```

Each `host` + `port` combination must be unique across all entries in an array config. The same host on different ports is allowed.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- Bug reports → [open an issue](https://github.com/lopatnov/express-reverse-proxy/issues)
- Security vulnerabilities → [GitHub Security Advisories](https://github.com/lopatnov/express-reverse-proxy/security/advisories/new) _(do not use public issues)_
- Questions → [Discussions](https://github.com/lopatnov/express-reverse-proxy/discussions)
- Found it useful? A [star on GitHub](https://github.com/lopatnov/express-reverse-proxy) helps others discover the project

---

## Built With

- [Node.js](https://nodejs.org/) — JavaScript runtime (ESM)
- [Express](https://expressjs.com/) — HTTP server framework
- [express-http-proxy](https://github.com/villadora/express-http-proxy) — reverse proxy middleware
- [Morgan](https://github.com/expressjs/morgan) — HTTP request logger
- [PM2](https://pm2.keymetrics.io/) — production process manager with clustering
- [Biome](https://biomejs.dev/) — fast linter and formatter (Rust-based)
- [Cypress](https://www.cypress.io/) — E2E testing framework
- [Docker](https://www.docker.com/) — containerization

---

## License

[Apache-2.0](LICENSE) © 2020–2026 [Oleksandr Lopatnov](https://github.com/lopatnov) · [LinkedIn](https://www.linkedin.com/in/lopatnov/)
