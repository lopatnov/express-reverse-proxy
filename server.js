#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import basicAuth from 'express-basic-auth';
import proxy from 'express-http-proxy';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import responseTime from 'response-time';
import favicon from 'serve-favicon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleServerArgs = [
  {
    name: '--help',
    description: 'shows command line help',
  },
  {
    name: '--config',
    subArgs: ['file name'],
    description:
      'sets server configuration file. Default value of file name is "server-config.json"',
    samples: ['--config ./server-config.json', '--config ./configs/express-reverse-proxy.json'],
  },
  {
    name: '--cluster',
    description: 'manage the PM2 cluster. Action defaults to "start" when omitted',
    samples: [
      '--cluster',
      '--cluster start',
      '--cluster stop',
      '--cluster restart',
      '--cluster status',
      '--cluster logs',
      '--cluster monitor',
      '--cluster start --config ./server-config.json',
    ],
  },
  {
    name: '--cluster-config',
    subArgs: ['file'],
    description:
      'path to a custom PM2 ecosystem config file (default: ecosystem.config.cjs next to server.js)',
    samples: [
      '--cluster start --cluster-config ./my-ecosystem.config.cjs',
      '--cluster restart --cluster-config /etc/myapp/ecosystem.config.cjs',
    ],
  },
];

function exitError(msg, code = -1) {
  console.error(`\x1b[31m${msg}\x1b[0m`);
  console.error(`\x1b[31mError code: ${code}\x1b[0m`);
  process.exit(code);
}

function parseArguments(args) {
  const argsNames = args.map((a) => a.name);
  return args.reduce((res, arg) => {
    const argIndex = process.argv.indexOf(arg.name);
    if (argIndex > -1) {
      res[arg.name] = { args: [] };
      if (arg.subArgs) {
        arg.subArgs.forEach((subArg, index) => {
          const subArgIndex = argIndex + index + 1;
          if (
            process.argv.length <= subArgIndex ||
            argsNames.indexOf(process.argv[subArgIndex]) > -1
          ) {
            exitError(`Invalid argument ${arg.name}. Missing <${subArg}>.`, 16);
          }
          res[arg.name].args.push(process.argv[subArgIndex]);
        });
      }
    }
    return res;
  }, {});
}

const serverArgs = parseArguments(possibleServerArgs);

function help(app, args) {
  console.log(`Usage: ${app} [options]\n`);
  console.log('Options:\n');

  args.forEach((arg) => {
    const tabIndentLength = 3;
    const tabIndent = Array(tabIndentLength).fill('\t').join('');
    const argTabIndent = Array(tabIndentLength - Math.trunc(arg.name.length / 4))
      .fill('\t')
      .join('');
    console.log(`\t\x1b[1m${arg.name}\x1b[0m${argTabIndent}${arg.description}`);
    if (arg.subArgs) {
      const subArgs = arg.subArgs.map((subArg) => `<${subArg}>`).join(' ');
      console.log(`\n${tabIndent}${app} ${arg.name} ${subArgs}\n`);
    }
    if (arg.samples) {
      console.log(`${tabIndent}Examples:`);
      arg.samples.forEach((sample) => {
        console.log(`\t${tabIndent}${sample}`);
      });
      console.log('');
    }
  });
}

if (serverArgs['--help']) {
  help('express-reverse-proxy', possibleServerArgs);
  process.exit();
}

if (serverArgs['--cluster']) {
  const clusterArgIndex = process.argv.indexOf('--cluster');
  const nextArg = process.argv[clusterArgIndex + 1];
  const validActions = ['start', 'stop', 'restart', 'status', 'logs', 'monitor'];
  const isAction = nextArg && !nextArg.startsWith('-') && validActions.includes(nextArg);

  if (nextArg && !nextArg.startsWith('-') && !isAction) {
    exitError(
      `Unknown --cluster action: "${nextArg}". Valid actions: ${validActions.join(', ')}.`,
      16,
    );
  }

  const action = isAction ? nextArg : 'start';
  const ecosystemConfig = serverArgs['--cluster-config']
    ? path.resolve(process.cwd(), serverArgs['--cluster-config'].args[0])
    : path.join(__dirname, 'ecosystem.config.cjs');
  const cwd = process.cwd();
  const configPassthrough = serverArgs['--config']
    ? ['--', '--config', serverArgs['--config'].args[0]]
    : [];

  const pm2Commands = {
    start: ['start', ecosystemConfig, '--no-daemon', `--cwd=${cwd}`, ...configPassthrough],
    stop: ['stop', 'express-reverse-proxy'],
    restart: ['restart', 'express-reverse-proxy', `--cwd=${cwd}`, ...configPassthrough],
    status: ['status'],
    logs: ['logs', 'express-reverse-proxy', '--lines', '200'],
    monitor: ['monit'],
  };

  const result = spawnSync('pm2', pm2Commands[action], { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 0);
}

let configFile = './server-config.json';
if (serverArgs['--config']) {
  [configFile] = serverArgs['--config'].args;
  if (fs.existsSync(configFile) && fs.lstatSync(configFile).isDirectory()) {
    configFile = path.join(configFile, './server-config.json');
  }
}
const configDir = path.dirname(path.resolve(configFile));

const DEFAULT_CONFIG = { port: 8000, folders: '.' };

let rawConfig;
if (!fs.existsSync(configFile)) {
  if (serverArgs['--config']) {
    exitError(`Configuration file not found: "${configFile}"`, 404);
  }
  console.warn(
    `\x1b[33m[config] "${configFile}" not found — using defaults (port: 8000, folders: ".")\x1b[0m`,
  );
  rawConfig = DEFAULT_CONFIG;
} else {
  console.log(`[config] ${configFile}`);
  try {
    rawConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (err) {
    exitError(`Failed to parse "${configFile}": ${err.message}`, 1);
  }
}

const configs = Array.isArray(rawConfig) ? rawConfig : [rawConfig];

// Validate: same host on same port is an error; same host on different ports is OK
const seen = new Set();
configs.forEach((c) => {
  const p = parseInt(c.port || process.env.PORT || 8000, 10);
  if (p < 1 || p > 65535) exitError(`Invalid port: ${p}`, 1);
  const key = `${p}:${c.host || '*'}`;
  if (seen.has(key)) {
    exitError(`Duplicate host "${c.host || '*'}" on port ${p}`, 1);
  }
  seen.add(key);
});

// Group configs by port
const configsByPort = new Map();
configs.forEach((c) => {
  const p = parseInt(c.port || process.env.PORT || 8000, 10);
  if (!configsByPort.has(p)) configsByPort.set(p, []);
  configsByPort.get(p).push(c);
});

// Validate: cannot mix SSL and non-SSL site configs on the same port
for (const [p, group] of configsByPort) {
  const sslCount = group.filter((c) => c.ssl).length;
  if (sslCount > 0 && sslCount < group.length) {
    exitError(`Port ${p}: cannot mix SSL and non-SSL site configs on the same port.`, 1);
  }
}

function collectFolderPaths(folders) {
  if (typeof folders === 'string') return [folders];
  if (Array.isArray(folders)) return folders.flatMap(collectFolderPaths);
  if (folders instanceof Object) return Object.values(folders).flatMap(collectFolderPaths);
  return [];
}

function addStaticFolderByName(router, port, urlPath, folder) {
  let folderPath = folder;
  if (!path.isAbsolute(folder)) {
    folderPath = path.join(process.cwd(), folder);
  }
  if (urlPath) {
    router.use(urlPath, express.static(folderPath));
  } else {
    router.use(express.static(folderPath));
  }
  console.log(`[folder] http://localhost:${port}${urlPath || ''} <===> ${folderPath}`);
}

function addMappedStaticFolders(router, port, rootPath, folders) {
  const pathStart = rootPath || '';
  const keys = Object.getOwnPropertyNames(folders);
  keys.forEach((key) => {
    const folderPath = pathStart + key;
    addStaticFolder(router, port, folderPath, folders[key]);
  });
}

function addStaticFolders(router, port, rootPath, folders) {
  folders.forEach((folder) => {
    addStaticFolder(router, port, rootPath, folder);
  });
}

function addStaticFolder(router, port, rootPath, folder) {
  if (typeof folder === 'string') {
    addStaticFolderByName(router, port, rootPath, folder);
  } else if (Array.isArray(folder)) {
    addStaticFolders(router, port, rootPath, folder);
  } else if (folder instanceof Object) {
    addMappedStaticFolders(router, port, rootPath, folder);
  }
}

function addRemoteProxy(router, port, urlPath, proxyServer) {
  if (urlPath) {
    router.use(urlPath, proxy(proxyServer));
  } else {
    router.use(proxy(proxyServer));
  }
  console.log(`[proxy] http://localhost:${port}${urlPath || ''} <===> ${proxyServer}`);
}

function addMappedProxy(router, port, localRootPath, pathPairs) {
  const localPaths = Object.getOwnPropertyNames(pathPairs);
  localPaths.forEach((localPath) => {
    const localFullPath = (localRootPath || '') + localPath;
    addRemoteProxy(router, port, localFullPath, pathPairs[localPath]);
  });
}

function addProxies(router, port, localRootPath, proxies) {
  proxies.forEach((proxyUrl) => {
    addRemoteProxy(router, port, localRootPath, proxyUrl);
  });
}

function addProxy(router, port, localRootPath, remoteProxy) {
  if (typeof remoteProxy === 'string') {
    addRemoteProxy(router, port, localRootPath, remoteProxy);
  } else if (Array.isArray(remoteProxy)) {
    addProxies(router, port, localRootPath, remoteProxy);
  } else if (remoteProxy instanceof Object) {
    addMappedProxy(router, port, localRootPath, remoteProxy);
  }
}

function unhandled(res, acceptConfig) {
  const headers = (acceptConfig.headers && Object.keys(acceptConfig.headers)) || [];
  for (const header of headers) res.setHeader(header, acceptConfig.headers[header]);

  let statusCode = Number.parseInt(acceptConfig.status, 10);
  if (!Number.isFinite(statusCode)) {
    statusCode = 404;
  }
  const status = res.status(statusCode);

  if (acceptConfig.send) {
    status.send(acceptConfig.send);
  } else if (acceptConfig.file) {
    status.sendFile(acceptConfig.file, {
      root: process.cwd(),
    });
  } else {
    status.send();
  }
}

const servers = [];

configsByPort.forEach((portConfigs, p) => {
  const app = express();
  const loggingEnabled = portConfigs.every((c) => c.logging !== false);
  if (loggingEnabled) {
    app.use(morgan('combined'));
  }

  // Hot reload via SSE
  const hotReloadEnabled = portConfigs.some((c) => c.hotReload === true);
  if (hotReloadEnabled) {
    const sseClients = new Set();
    let reloadTimer = null;

    app.get('/__hot-reload__', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
    });

    app.get('/__hot-reload__/client.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.sendFile(path.join(__dirname, 'hot-reload-client.js'));
    });

    const watchPaths = [
      ...new Set(portConfigs.flatMap((c) => collectFolderPaths(c.folders || []))),
    ];
    for (const folder of watchPaths) {
      const absPath = path.isAbsolute(folder) ? folder : path.join(process.cwd(), folder);
      if (fs.existsSync(absPath)) {
        fs.watch(absPath, { recursive: true }, () => {
          clearTimeout(reloadTimer);
          reloadTimer = setTimeout(() => {
            for (const client of sseClients) client.write('data: reload\n\n');
          }, 100);
        });
      }
    }
    console.log(`[hot-reload] watching ${watchPaths.length} folder(s) on port ${p}`);
  }

  // Specific hosts first, catch-all last
  const sorted = [
    ...portConfigs.filter((c) => c.host && c.host !== '*'),
    ...portConfigs.filter((c) => !c.host || c.host === '*'),
  ];

  sorted.forEach((siteConfig) => {
    const siteHost = siteConfig.host || '*';
    const router = express.Router();

    console.log(`[host] ${siteHost} → :${p}`);

    if (siteConfig.responseTime) {
      const opts = typeof siteConfig.responseTime === 'object' ? siteConfig.responseTime : {};
      router.use(responseTime(opts));
    }

    if (siteConfig.cors) {
      const opts = typeof siteConfig.cors === 'object' ? siteConfig.cors : {};
      router.use(cors(opts));
    }

    if (siteConfig.compression) {
      const opts = typeof siteConfig.compression === 'object' ? siteConfig.compression : {};
      router.use(compression(opts));
    }

    if (siteConfig.helmet) {
      const opts = typeof siteConfig.helmet === 'object' ? siteConfig.helmet : {};
      router.use(helmet(opts));
    }

    if (siteConfig.favicon) {
      router.use(favicon(path.resolve(configDir, siteConfig.favicon)));
    }

    if (siteConfig.rateLimit) {
      const opts = typeof siteConfig.rateLimit === 'object' ? siteConfig.rateLimit : {};
      router.use(rateLimit(opts));
    }

    if (siteConfig.basicAuth) {
      const opts = typeof siteConfig.basicAuth === 'object' ? siteConfig.basicAuth : {};
      router.use(basicAuth(opts));
    }

    if (siteConfig.headers) {
      router.use((_req, res, next) => {
        for (const h of Object.keys(siteConfig.headers)) res.setHeader(h, siteConfig.headers[h]);
        next();
      });
    }

    if (siteConfig.folders) {
      addStaticFolder(router, p, null, siteConfig.folders);
    }

    if (siteConfig.cgi) {
      const cgiRaw = siteConfig.cgi;
      const cgiConfig = typeof cgiRaw === 'string' ? { dir: cgiRaw } : cgiRaw;
      const cgiUrlPath = cgiConfig.path || '/cgi-bin';
      const cgiDirResolved = path.resolve(configDir, cgiConfig.dir || './cgi-bin');
      const cgiExts = new Set(cgiConfig.extensions || ['.cgi', '.pl', '.py', '.sh']);
      const interps = cgiConfig.interpreters || {};

      router.use(cgiUrlPath, (req, res, next) => {
        const scriptPath = path.resolve(path.join(cgiDirResolved, req.path));
        if (!scriptPath.startsWith(cgiDirResolved + path.sep)) return next();

        const ext = path.extname(scriptPath);
        if (!cgiExts.has(ext) || !fs.existsSync(scriptPath)) return next();

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const env = {
          ...process.env,
          GATEWAY_INTERFACE: 'CGI/1.1',
          SERVER_PROTOCOL: 'HTTP/1.1',
          SERVER_SOFTWARE: 'express-reverse-proxy',
          REQUEST_METHOD: req.method.toUpperCase(),
          SCRIPT_FILENAME: scriptPath,
          SCRIPT_NAME: cgiUrlPath + req.path,
          PATH_INFO: '',
          QUERY_STRING: url.search ? url.search.slice(1) : '',
          REMOTE_ADDR: req.ip || '127.0.0.1',
          CONTENT_TYPE: req.headers['content-type'] || '',
          CONTENT_LENGTH: req.headers['content-length'] || '0',
          SERVER_NAME: req.hostname || 'localhost',
          SERVER_PORT: String(p),
        };
        for (const [k, v] of Object.entries(req.headers)) {
          env[`HTTP_${k.toUpperCase().replace(/-/g, '_')}`] = Array.isArray(v) ? v.join(', ') : v;
        }

        const interpreter = interps[ext];
        const command = interpreter || scriptPath;
        const args = interpreter ? [scriptPath] : [];
        const child = spawn(command, args, { env, cwd: path.dirname(scriptPath) });

        child.stdin.on('error', (_err) => {});
        req.pipe(child.stdin);

        let headersParsed = false;
        let rawBuf = '';
        child.stdout.on('data', (chunk) => {
          if (!headersParsed) {
            rawBuf += chunk.toString('binary');
            const m = /\r?\n\r?\n/.exec(rawBuf);
            if (m) {
              const rawHeaders = rawBuf.substring(0, m.index);
              const bodyStart = Buffer.from(rawBuf.substring(m.index + m[0].length), 'binary');
              headersParsed = true;
              let statusCode = 200;
              for (const line of rawHeaders.split(/\r?\n/)) {
                const colon = line.indexOf(':');
                if (colon === -1) continue;
                const name = line.substring(0, colon).trim();
                const value = line.substring(colon + 1).trim();
                if (name.toLowerCase() === 'status') {
                  statusCode = Number.parseInt(value, 10) || 200;
                } else {
                  res.setHeader(name, value);
                }
              }
              res.status(statusCode);
              if (bodyStart.length) res.write(bodyStart);
            }
          } else {
            res.write(chunk);
          }
        });
        child.stdout.on('end', () => {
          if (!headersParsed) res.status(500).send('CGI script produced no output');
          else res.end();
        });
        child.stderr.on('data', (data) => console.error(`[cgi] ${scriptPath}: ${data}`));
        child.on('error', (err) => {
          console.error(`[cgi] spawn error for ${scriptPath}: ${err.message}`);
          if (!res.headersSent) res.status(500).send(`CGI error: ${err.message}`);
        });
        console.log(`[cgi] ${req.method} ${cgiUrlPath}${req.path} → ${scriptPath}`);
      });
    }

    if (siteConfig.proxy) {
      addProxy(router, p, null, siteConfig.proxy);
    }

    if (siteConfig.unhandled) {
      router.use((req, res, _next) => {
        Object.keys(siteConfig.unhandled).forEach((acceptName) => {
          if (!acceptName || acceptName === '*' || acceptName === '**') {
            unhandled(res, siteConfig.unhandled[acceptName]);
          } else if (req.accepts(acceptName)) {
            unhandled(res, siteConfig.unhandled[acceptName]);
          }
        });
      });
    }

    if (siteHost === '*') {
      app.use(router);
    } else {
      app.use((req, res, next) => {
        if (req.hostname === siteHost) router(req, res, next);
        else next();
      });
    }
  });

  const sslConfig = portConfigs.find((c) => c.ssl)?.ssl;
  let server;
  if (sslConfig) {
    let sslOptions;
    try {
      sslOptions = {
        key: fs.readFileSync(path.resolve(configDir, sslConfig.key)),
        cert: fs.readFileSync(path.resolve(configDir, sslConfig.cert)),
      };
      if (sslConfig.ca) {
        sslOptions.ca = fs.readFileSync(path.resolve(configDir, sslConfig.ca));
      }
    } catch (err) {
      exitError(`SSL cert/key error on port ${p}: ${err.message}`, 1);
    }
    server = https.createServer(sslOptions, app).listen(p, () => {
      console.log(`[listen] https://localhost:${p}`);
      if (process.send) process.send('ready');
    });
  } else {
    server = app.listen(p, () => {
      console.log(`[listen] http://localhost:${p}`);
      if (process.send) process.send('ready');
    });
  }
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      exitError(`Port ${p} is already in use`, 1);
    }
    throw err;
  });
  servers.push(server);
});

function shutdown() {
  console.log('Closing all connections...');
  const timer = setTimeout(() => {
    console.error('Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
  let remaining = servers.length;
  if (remaining === 0) {
    clearTimeout(timer);
    process.exit(0);
  }
  servers.forEach((s) => {
    s.close(() => {
      remaining -= 1;
      if (remaining === 0) {
        clearTimeout(timer);
        console.log('Finished closing connections');
        process.exit(0);
      }
    });
  });
}

process.on('message', (msg) => {
  if (typeof msg === 'string' && msg.toLowerCase() === 'shutdown') {
    shutdown();
  }
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
