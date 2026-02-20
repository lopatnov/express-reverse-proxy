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
  - [logging](#logging)
  - [hotReload](#hotreload)
  - [compression](#compression)
  - [helmet](#helmet)
  - [cors](#cors)
  - [favicon](#favicon)
  - [responseTime](#responsetime)
  - [rateLimit](#ratelimit)
  - [basicAuth](#basicauth)
  - [cgi](#cgi)
  - [upload](#upload)
  - [headers](#headers)
  - [folders](#folders)
  - [proxy](#proxy)
  - [unhandled](#unhandled)
  - [host](#host)
  - [ssl](#ssl)
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
  ├─▶  CGI scripts checked (cgi)
  │       └─▶  Path + extension matches → execute script → stream response
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

The package installs two equivalent commands — use whichever you prefer:

```shell
express-reverse-proxy [options]
lerp [options]
```

`lerp` is a short alias for **L**opatnov **E**xpress **R**everse **P**roxy.

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

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Overrides the port when it is not set in the config file |
| `NODE_ENV` | — | Passed through to PM2 env profiles (`env` / `env_development`) |

### port

The port the server listens on. Defaults to `8000`. Can also be set via the `PORT` environment variable.

```json
{
  "port": 8080
}
```

### logging

Controls HTTP request logging (Morgan). Enabled by default. Set to `false` to silence per-request log lines — useful in production behind another proxy, or to keep console output clean.

```json
{
  "port": 8080,
  "logging": false,
  "folders": "www"
}
```

### hotReload

Watches the `folders` directories for file changes and automatically reloads connected browser tabs. Uses Server-Sent Events (SSE). Intended for local development only.

```json
{
  "port": 8080,
  "hotReload": true,
  "folders": "www"
}
```

The server exposes two endpoints when hot reload is enabled:

| Endpoint | Description |
| --------------------------------- | ------------------------------------------ |
| `GET /__hot-reload__` | SSE stream — browsers subscribe here |
| `GET /__hot-reload__/client.js` | Ready-to-use client script |

#### Connecting the client

**Option A — plain HTML project**: add a script tag to your page. The file is served directly by the dev server, no installation needed:

```html
<script src="/__hot-reload__/client.js"></script>
```

**Option B — bundled project** (Vite, webpack, etc.): import the client module. The bundler resolves it through the package `exports` field:

```js
import '@lopatnov/express-reverse-proxy/hot-reload-client';
```

Both options connect to `/__hot-reload__` and call `location.reload()` when a file change is detected. The connection is re-established automatically after 3 seconds if the server restarts.

> **PM2 note:** hot reload works best with a single process (`node server.js`). If using PM2, set `instances: 1` in your ecosystem config — each worker maintains its own file watcher and SSE client list independently.

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

### ssl

Enable HTTPS on a port by adding an `ssl` object to any site config for that port. All sites sharing the same port use the same certificate.

| Field  | Type     | Description                                              |
| ------ | -------- | -------------------------------------------------------- |
| `key`  | `string` | Path to the private key file (PEM format)                |
| `cert` | `string` | Path to the certificate file (PEM format)                |
| `ca`   | `string` | *(optional)* Path to the CA bundle for client validation |

Paths are resolved **relative to the config file**, not the current working directory.

```json
{
  "port": 443,
  "ssl": {
    "key": "./certs/key.pem",
    "cert": "./certs/cert.pem"
  },
  "folders": "./public",
  "proxy": {
    "/api": "http://localhost:4000"
  }
}
```

> All site configs on the same port must either all have `ssl` or none — mixing is a startup error.

### compression

Enable gzip/deflate response compression. Reduces the size of HTML, CSS, JS, and JSON responses sent to the browser. Set to `true` for defaults, or pass an options object.

```json
{
  "port": 8080,
  "compression": true,
  "folders": "www"
}
```

With custom options (see [compression docs](https://github.com/expressjs/compression#options)):

```json
{
  "compression": { "level": 6, "threshold": 1024 }
}
```

> Compression is applied per-site. Assets that are already compressed (images, fonts, video) are not affected — the browser signals it accepts compressed responses via the `Accept-Encoding` header.

### helmet

Set security-related HTTP response headers. Protects against common web vulnerabilities by configuring headers such as `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, and others.

```json
{
  "port": 8080,
  "helmet": true,
  "folders": "www"
}
```

Disable a specific header (see [helmet docs](https://helmetjs.github.io/) for all options):

```json
{
  "helmet": { "contentSecurityPolicy": false }
}
```

> When `helmet: true` is set, the default helmet configuration is applied. This may block inline scripts and cross-origin resources. Adjust `contentSecurityPolicy` or other options as needed for your project.

### cors

Enable CORS (Cross-Origin Resource Sharing) headers and handle preflight `OPTIONS` requests automatically. Useful when your front-end on one origin calls an API on a different origin.

```json
{
  "port": 8080,
  "cors": true,
  "proxy": { "/api": "http://localhost:4000" }
}
```

Restrict to a specific origin (see [cors docs](https://github.com/expressjs/cors#configuration-options)):

```json
{
  "cors": { "origin": "https://app.example.com" }
}
```

> The `cors` middleware handles `OPTIONS` preflight requests that the `headers` option cannot respond to. Use `cors` when you need to allow requests from JavaScript on a different domain — for example a React app calling this proxy's API routes.

### favicon

Serve a favicon file efficiently. The file is read into memory at startup and served from there on every `/favicon.ico` request — before static folder scanning or proxy rules run.

```json
{
  "port": 8080,
  "favicon": "./public/favicon.ico",
  "folders": "www"
}
```

The path is resolved **relative to the config file**, consistent with the `ssl` option. Absolute paths are also accepted.

> If your favicon already lives inside a directory listed in `folders`, this option is not needed — `express.static` will serve it automatically.

### responseTime

Add an `X-Response-Time` header to every response, recording how long the server took to handle the request. Useful for performance monitoring and debugging.

```json
{
  "port": 8080,
  "responseTime": true,
  "folders": "www"
}
```

With custom precision (see [response-time docs](https://github.com/expressjs/response-time#options)):

```json
{
  "responseTime": { "digits": 0, "suffix": false }
}
```

### rateLimit

Limit the number of requests a client can make in a time window. Responds with `429 Too Many Requests` when the limit is exceeded. Useful when running without a dedicated reverse proxy.

```json
{
  "port": 8080,
  "rateLimit": { "windowMs": 60000, "limit": 100 },
  "folders": "www"
}
```

| Option      | Default  | Description                                      |
| ----------- | -------- | ------------------------------------------------ |
| `windowMs`  | `60000`  | Time window in milliseconds                      |
| `limit`     | `5`      | Maximum requests per client per window           |
| `message`   | built-in | Response body when limit is exceeded             |

See [express-rate-limit docs](https://express-rate-limit.mintlify.app/reference/configuration) for all options.

> Rate limiting is applied per-site and per IP address. In production behind Nginx or Caddy, configure rate limiting there instead — it runs before Node.js and is more efficient.

### basicAuth

Protect the site with HTTP Basic Authentication. All requests must include valid credentials or the server responds with `401 Unauthorized`.

```json
{
  "port": 8080,
  "basicAuth": {
    "users": { "admin": "s3cr3t" },
    "challenge": true
  },
  "folders": "www"
}
```

| Option      | Default | Description                                                  |
| ----------- | ------- | ------------------------------------------------------------ |
| `users`     | —       | Object mapping username → password *(required)*              |
| `challenge` | `false` | Send `WWW-Authenticate` header to trigger browser login dialog |
| `realm`     | —       | Realm string shown in the browser login dialog               |

See [express-basic-auth docs](https://github.com/LionC/express-basic-auth#options) for all options.

> Passwords are compared in plain text. Do not use Basic Auth over plain HTTP in production — always combine with `ssl` or put behind a TLS-terminating proxy.

### cgi

Execute server-side scripts using the CGI (Common Gateway Interface) protocol. When a request matches the configured URL prefix and file extension, the script is spawned as a child process — HTTP headers become environment variables, the request body is piped to stdin, and the script's stdout is streamed back as the HTTP response.

```json
{
  "port": 8080,
  "cgi": {
    "path": "/cgi-bin",
    "dir": "./cgi-bin",
    "extensions": [".cgi", ".pl", ".py", ".sh"],
    "interpreters": {
      ".py": "python3",
      ".sh": "sh",
      ".pl": "perl"
    }
  }
}
```

| Option         | Default                               | Description                                                          |
| -------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `path`         | `"/cgi-bin"`                          | URL prefix that triggers CGI dispatch                                |
| `dir`          | `"./cgi-bin"`                         | Local directory containing scripts (resolved relative to config file)|
| `extensions`   | `[".cgi", ".pl", ".py", ".sh"]`       | File extensions treated as executable CGI scripts                    |
| `interpreters` | `{}`                                  | Map of file extension → interpreter command                          |

Shorthand — point directly to the script directory (all defaults apply):

```json
{
  "cgi": "./cgi-bin"
}
```

CGI environment variables set for every request:

| Variable          | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| `REQUEST_METHOD`  | HTTP method (`GET`, `POST`, …)                           |
| `QUERY_STRING`    | URL query string (without `?`)                           |
| `CONTENT_TYPE`    | `Content-Type` request header                            |
| `CONTENT_LENGTH`  | `Content-Length` request header                          |
| `SCRIPT_FILENAME` | Absolute path to the script file                         |
| `SCRIPT_NAME`     | URL path to the script (e.g. `/cgi-bin/hello.py`)        |
| `SERVER_NAME`     | Requested hostname                                       |
| `SERVER_PORT`     | Server listen port                                       |
| `REMOTE_ADDR`     | Client IP address                                        |
| `HTTP_*`          | All request headers (e.g. `HTTP_ACCEPT`, `HTTP_HOST`)    |

A minimal Python example (`cgi-bin/hello.py`):

```python
#!/usr/bin/env python3
print("Content-Type: text/plain")
print("Status: 200 OK")
print()
print("Hello from CGI!")
```

> **Unix/macOS note:** Scripts must be executable: `chmod +x cgi-bin/hello.py`. Alternatively, configure an `interpreters` entry for the extension — no executable bit required when an interpreter is specified.

> **Windows note:** Scripts are not directly executable on Windows. You must configure `interpreters` for every extension you use; otherwise the request returns a `500` spawn error.

**Array form** — multiple independent CGI directories on the same site:

```json
{
  "cgi": [
    {
      "path": "/py-scripts",
      "dir": "./py-scripts",
      "extensions": [".py"],
      "interpreters": { ".py": "python3" }
    },
    {
      "path": "/node-scripts",
      "dir": "./node-scripts",
      "extensions": [".js"],
      "interpreters": { ".js": "node" }
    }
  ]
}
```

Each entry in the array sets up an independent CGI mount point with its own directory, URL prefix, extensions, and interpreters.

### upload

Accept file uploads via `multipart/form-data` and save them to a local directory. Uploaded files can be retrieved immediately via `GET`.

```json
{
  "port": 8080,
  "upload": {
    "path": "/upload",
    "dir": "./uploads",
    "maxFileSize": 10485760,
    "maxFiles": 10,
    "allowedTypes": ["image/jpeg", "image/png", "application/pdf"],
    "fieldName": "file"
  }
}
```

Shorthand — directory only (all defaults apply):

```json
{
  "upload": "./uploads"
}
```

| Option          | Default        | Description                                                              |
| --------------- | -------------- | ------------------------------------------------------------------------ |
| `path`          | `"/upload"`    | URL prefix for the upload endpoint                                       |
| `dir`           | `"./uploads"`  | Save directory (resolved relative to the config file)                    |
| `maxFileSize`   | none           | Maximum file size in bytes; responds with `413` when exceeded            |
| `maxFiles`      | none           | Maximum number of files per request; responds with `400` when exceeded   |
| `allowedTypes`  | none           | MIME type whitelist; responds with `400` when the type is not in the list|
| `fieldName`     | any field      | Accept only files uploaded in this specific form field                   |

**Array form** — multiple upload endpoints on the same site:

```json
{
  "upload": [
    { "path": "/photos", "dir": "./photos", "allowedTypes": ["image/jpeg", "image/png"] },
    { "path": "/docs",   "dir": "./documents", "allowedTypes": ["application/pdf"], "maxFileSize": 5242880 }
  ]
}
```

**HTTP interface:**

| Method | URL              | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| `POST` | `<path>`         | Upload files via `multipart/form-data`   |
| `GET`  | `<path>/<name>`  | Retrieve a previously uploaded file      |

`POST` success response (`200`):

```json
{
  "files": [
    { "file": "photo-1700000000000-123456789.jpg", "size": 45678, "originalName": "photo.jpg" }
  ]
}
```

Upload with curl:

```shell
curl -F "file=@photo.jpg" http://localhost:8080/upload
```

> The upload directory is created automatically at startup if it does not exist. Saved filenames include a timestamp and random suffix to avoid collisions.

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

### HTTPS with a self-signed certificate (local dev)

```shell
mkdir certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

```json
{
  "port": 8443,
  "ssl": {
    "key": "./certs/key.pem",
    "cert": "./certs/cert.pem"
  },
  "folders": "www",
  "proxy": {
    "/api": "http://localhost:4000"
  }
}
```

Start and open in browser (accept the self-signed cert warning):

```shell
express-reverse-proxy --config server-config.json
# [listen] https://localhost:8443
```

---

### Production hardening (helmet + cors + compression)

Enable security headers, CORS, and response compression in one config:

```json
{
  "port": 8080,
  "compression": true,
  "helmet": true,
  "cors": { "origin": "https://app.example.com" },
  "responseTime": true,
  "folders": "www",
  "proxy": {
    "/api": "http://localhost:4000"
  }
}
```

---

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

| Script                  | Description                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `npm run pm2-start`     | Start cluster (max CPU cores); reads `server-config.json` from cwd |
| `npm run pm2-restart`   | Restart all instances                                              |
| `npm run pm2-stop`      | Stop all instances                                                 |
| `npm run pm2-status`    | Show process status                                                |
| `npm run pm2-logs`      | Show last 200 log lines                                            |
| `npm run pm2-monitor`   | Open real-time monitor                                             |

Or use the CLI directly:

```shell
express-reverse-proxy --cluster start
express-reverse-proxy --cluster status
express-reverse-proxy --cluster stop
```

### Behind a reverse proxy

For production deployments it is common to place a dedicated reverse proxy in front of `express-reverse-proxy` to handle TLS termination, HTTP/2, gzip compression, and rate limiting. In this setup the Node.js server listens on a local port over plain HTTP, while the outer proxy terminates HTTPS connections from the internet:

```
Internet (HTTPS / HTTP/2)
        ↓
  Nginx or Caddy          — TLS, HTTP/2, gzip, rate limiting
        ↓ HTTP/1.1 (localhost)
  express-reverse-proxy   — PM2 cluster, routing, static files, API proxy
        ↓
  Backend API servers
```

**No `ssl` config needed** in `server-config.json` when the outer proxy handles TLS.

#### Nginx

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Free certificates can be obtained with [Certbot](https://certbot.eff.org/): `certbot --nginx -d example.com`.

#### Caddy

[Caddy](https://caddyserver.com/) provisions and renews Let's Encrypt certificates automatically — no extra tooling needed:

```
example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Start with `caddy run --config Caddyfile`.

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

**PM2 shows `Error: spawn wmic ENOENT` on Windows 11**

```
PM2 error: Error caught while calling pidusage
PM2 error: Error: Error: spawn wmic ENOENT
```

`wmic` was removed in newer Windows 11 builds. PM2 uses it internally to collect CPU/memory metrics, but this does not affect the server — all instances start and serve requests normally. The metrics columns in `pm2 status` will show `0%` / `0b`.

To suppress the errors, `ecosystem.config.cjs` already includes `pmx: false` which disables the metrics module. If the errors still appear after restarting, delete the PM2 daemon state and start fresh:

```shell
pm2 kill
npm run pm2-start
```

---

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
- [compression](https://github.com/expressjs/compression) — gzip/deflate response compression
- [helmet](https://helmetjs.github.io/) — security HTTP headers
- [cors](https://github.com/expressjs/cors) — CORS headers and preflight handling
- [serve-favicon](https://github.com/expressjs/serve-favicon) — efficient favicon serving
- [response-time](https://github.com/expressjs/response-time) — X-Response-Time header
- [express-rate-limit](https://express-rate-limit.mintlify.app/) — request rate limiting
- [express-basic-auth](https://github.com/LionC/express-basic-auth) — HTTP Basic Authentication
- CGI support — built on Node.js `child_process.spawn` (no external dependency)
- [multer](https://github.com/expressjs/multer) — multipart/form-data file upload handling
- [PM2](https://pm2.keymetrics.io/) — production process manager with clustering
- [Biome](https://biomejs.dev/) — fast linter and formatter (Rust-based)
- [Cypress](https://www.cypress.io/) — E2E testing framework
- [Docker](https://www.docker.com/) — containerization

---

## License

[Apache-2.0](LICENSE) © 2020–2026 [Oleksandr Lopatnov](https://github.com/lopatnov) · [LinkedIn](https://www.linkedin.com/in/lopatnov/)
