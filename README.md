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
- [How It Works](#how-it-works)
- [CLI Options](#cli-options)
- [Configuration](#configuration)
  - [port](#port)
  - [headers](#headers)
  - [folders](#folders)
  - [proxy](#proxy)
  - [unhandled](#unhandled)
- [Configuration Recipes](#configuration-recipes)
- [Docker & PM2](#docker--pm2)
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
    "/api": "localhost:4000"
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

| Option | Description |
|--------|-------------|
| `--help` | Print help and exit |
| `--config <file>` | Path to the JSON configuration file. Default: `server-config.json` |

```shell
express-reverse-proxy --config ./configs/dev.json
```

---

## Configuration

All configuration lives in a single JSON file (default `server-config.json`).

### port

The port the server listens on. Defaults to `8080`. Can also be set via the `PORT` environment variable.

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

| URL path | Local directory |
|----------|----------------|
| `/` | `dist` |
| `/api` | `./mock-json` |
| `/assets/images` | `./images` |
| `/assets/css` | `./scss/dist` |
| `/assets/script` | `./scripts` |

### proxy

Forward requests to a back-end server. Supports three forms:

**Proxy everything to one server:**

```json
{
  "proxy": "localhost:4000"
}
```

**Map a URL path prefix to a server:**

```json
{
  "proxy": {
    "/api": "localhost:4000"
  }
}
```

**Multiple proxy rules:**

```json
{
  "proxy": [
    { "/api": "localhost:4000" },
    { "/auth": "localhost:5000" }
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

| Option | Type | Description |
|--------|------|-------------|
| `status` | `number` | HTTP response status code |
| `headers` | `object` | Additional response headers |
| `send` | `string \| object` | Inline response body (text or JSON) |
| `file` | `string` | Path to file whose contents are sent as body |

### host

Route requests to this configuration based on the HTTP `Host` header. Enables serving multiple sites on a single port.

| Value | Behavior |
|-------|-----------|
| `"app.localhost"` | Only handles requests whose `Host` header matches exactly |
| `"*"` or omitted | Catch-all — handles any request not matched by another entry |

To use multi-site mode, make the config file an **array** instead of an object. Specific hosts are always checked before the catch-all:

```json
[
  {
    "host": "app.localhost",
    "port": 8080,
    "folders": "www",
    "proxy": { "/api": "localhost:4000" }
  },
  {
    "host": "admin.localhost",
    "folders": "admin",
    "proxy": { "/api": "localhost:5000" }
  },
  {
    "host": "*",
    "folders": "fallback"
  }
]
```

> Two entries with the same `host` value cause a startup error.
>
> `port` is global — the server listens on one port. Use the first entry's `port` (or `PORT` env var) to set it.

---

## Configuration Recipes

### Static files first, then fall back to back-end

All unmatched requests are forwarded to `localhost:4000`.

```json
{
  "port": 8080,
  "folders": "www",
  "proxy": "localhost:4000"
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
    "/api": "localhost:4000"
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
    },
    "*": {
      "status": 404,
      "file": "./www/not-found.txt"
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

The included `ecosystem.config.js` runs the server in **cluster mode** — PM2 acts as a load balancer and all worker processes share a single port through the Node.js cluster module. Without cluster mode each instance would try to bind its own copy of the port and all but the first would fail.

```javascript
// ecosystem.config.js
{
  instances: 'max',   // one worker per CPU core
  exec_mode: 'cluster'
}
```

Run via npm scripts:

| Script | Description |
|--------|-------------|
| `npm run pm2-start` | Start cluster (max CPU cores) via `ecosystem.config.js` |
| `npm run pm2-stop` | Stop all instances |
| `npm run pm2-status` | Show process status |
| `npm run pm2-logs` | Show last 200 log lines |
| `npm run pm2-monitor` | Open real-time monitor |

```shell
npm run pm2-start
```

---

## Troubleshooting

**Server starts but static files are not served**

- Check that the path in `folders` is correct relative to where you run the command, not relative to `server-config.json`.
- Verify the directory exists: `ls ./www` (or the path you configured).

**Proxy requests return 502 or fail silently**

- Confirm the back-end is running and reachable: `curl http://localhost:4000/api/health`.
- Make sure the proxy address does **not** include a protocol prefix — use `localhost:4000`, not `http://localhost:4000`.

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

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- Bug reports → [open an issue](https://github.com/lopatnov/express-reverse-proxy/issues)
- Security vulnerabilities → [GitHub Security Advisories](https://github.com/lopatnov/express-reverse-proxy/security/advisories/new) _(do not use public issues)_
- Questions → [Discussions](https://github.com/lopatnov/express-reverse-proxy/discussions)
- Found it useful? A [star on GitHub](https://github.com/lopatnov/express-reverse-proxy) helps others discover the project

---

## Built With

- [Node.js](https://nodejs.org/) — JavaScript runtime
- [Express](https://expressjs.com/) — HTTP server framework
- [express-http-proxy](https://github.com/villadora/express-http-proxy) — reverse proxy middleware
- [Morgan](https://github.com/expressjs/morgan) — HTTP request logger
- [PM2](https://pm2.keymetrics.io/) — production process manager with clustering
- [ESLint](https://eslint.org/) + [Airbnb style guide](https://github.com/airbnb/javascript) — code linting
- [Docker](https://www.docker.com/) — containerization

---

## License

[Apache-2.0](LICENSE) © 2020–2026 [Oleksandr Lopatnov](https://github.com/lopatnov) · [LinkedIn](https://www.linkedin.com/in/lopatnov/)
