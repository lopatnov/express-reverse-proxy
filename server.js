#!/usr/bin/env node

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
    name: '--env',
    subArgs: ['names'],
    description:
      'start only site configs tagged with the given environment name(s). Use "+" to combine multiple names (OR). Omit to start all configs.',
    samples: ['--env dev', '--env featureA+featureB'],
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
  {
    name: '--init',
    description: 'interactively creates a server-config.json in the current directory',
  },
];

function exitError(msg, code = -1) {
  console.error(`\x1b[31m${msg}\x1b[0m`);
  console.error(`\x1b[31mError code: ${code}\x1b[0m`);
  process.exit(code);
}

function parseArguments(args) {
  const argsNames = new Set(args.map((a) => a.name));
  return args.reduce((res, arg) => {
    const argIndex = process.argv.indexOf(arg.name);
    if (argIndex > -1) {
      res[arg.name] = { args: [] };
      if (arg.subArgs) {
        arg.subArgs.forEach((subArg, index) => {
          const subArgIndex = argIndex + index + 1;
          if (process.argv.length <= subArgIndex || argsNames.has(process.argv[subArgIndex])) {
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
    const tabIndent = '\t'.repeat(tabIndentLength);
    const argTabIndent = '\t'.repeat(
      Math.max(1, tabIndentLength - Math.trunc(arg.name.length / 4)),
    );
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
  const [{ spawnSync }, { default: path }, { fileURLToPath }] = await Promise.all([
    import('node:child_process'),
    import('node:path'),
    import('node:url'),
  ]);
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
    : fileURLToPath(new URL('ecosystem.config.cjs', import.meta.url));
  const cwd = process.cwd();
  const configPassthrough = [];
  if (serverArgs['--config'] || serverArgs['--env']) configPassthrough.push('--');
  if (serverArgs['--config']) configPassthrough.push('--config', serverArgs['--config'].args[0]);
  if (serverArgs['--env']) configPassthrough.push('--env', serverArgs['--env'].args[0]);

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

if (serverArgs['--init']) {
  const [{ default: fs }, { default: path }, { default: readline }] = await Promise.all([
    import('node:fs'),
    import('node:path'),
    import('node:readline/promises'),
  ]);
  const configOut = path.resolve(process.cwd(), 'server-config.json');
  if (fs.existsSync(configOut)) {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl2.question(`${configOut} already exists. Overwrite? [y/N]: `);
    rl2.close();
    if (ans.trim().toLowerCase() !== 'y') process.exit(0);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const port = (await rl.question('Port [8000]: ')).trim() || '8000';
  const folder = (await rl.question('Static folder [.]: ')).trim() || '.';
  const proxyPath = (await rl.question('Proxy path (e.g. /api) [skip]: ')).trim();
  let proxyTarget = '';
  if (proxyPath) proxyTarget = (await rl.question(`Proxy target for ${proxyPath}: `)).trim();
  const hotReload = (await rl.question('Hot reload? [y/N]: ')).trim().toLowerCase() === 'y';
  rl.close();
  const cfg = { port: Number.parseInt(port, 10), folders: folder };
  if (proxyPath && proxyTarget) cfg.proxy = { [proxyPath]: proxyTarget };
  if (hotReload) cfg.hotReload = true;
  fs.writeFileSync(configOut, `${JSON.stringify(cfg, null, 2)}\n`);
  console.log(`[init] Created ${configOut}`);
  process.exit(0);
}

const [{ default: fs }, { default: path }] = await Promise.all([
  import('node:fs'),
  import('node:path'),
]);

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
if (fs.existsSync(configFile)) {
  console.log(`[config] ${configFile}`);
  try {
    rawConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (err) {
    exitError(`Failed to parse "${configFile}": ${err.message}`, 1);
  }
} else {
  if (serverArgs['--config']) {
    exitError(`Configuration file not found: "${configFile}"`, 404);
  }
  console.warn(
    `\x1b[33m[config] "${configFile}" not found — using defaults (port: 8000, folders: ".")\x1b[0m`,
  );
  rawConfig = DEFAULT_CONFIG;
}

let configs = (Array.isArray(rawConfig) ? rawConfig : [rawConfig]).map((config) => ({
  ...config,
  env: normalizeConfigEnvs(config.env),
}));

function normalizeConfigEnvs(envValue) {
  if (envValue === undefined) return null;
  if (typeof envValue === 'string') return [envValue];
  if (Array.isArray(envValue) && envValue.every((item) => typeof item === 'string')) {
    return envValue;
  }
  exitError('Invalid "env" in configuration: expected a string or array of strings.', 1);
}

function parseEnvFilter(envArg) {
  return envArg
    .split('+')
    .map((name) => name.trim())
    .filter(Boolean);
}

function configMatchesEnvFilter(config, envFilter) {
  if (config.env === null) return true;
  return envFilter.some((filterEnv) => config.env.includes(filterEnv));
}

if (serverArgs['--env']) {
  const envFilter = parseEnvFilter(serverArgs['--env'].args[0]);
  if (envFilter.length === 0) {
    exitError('Invalid --env value: expected one or more environment names.', 16);
  }
  const filtered = configs.filter((config) => configMatchesEnvFilter(config, envFilter));
  if (filtered.length === 0) {
    exitError(`No configurations match env filter: ${envFilter.join('+')}`, 1);
  }
  console.log(
    `[env] starting ${filtered.length} of ${configs.length} configuration(s) for: ${envFilter.join('+')}`,
  );
  configs = filtered;
}

// Validate: same host on same port is an error; same host on different ports is OK
const seen = new Set();
configs.forEach((c) => {
  const p = Number.parseInt(c.port || process.env.PORT || 8000, 10);
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
  const p = Number.parseInt(c.port || process.env.PORT || 8000, 10);
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

// Validate: trustProxy applies to the whole port (one Express app), so site
// configs sharing a port cannot declare conflicting values.
for (const [p, group] of configsByPort) {
  const trustProxyValues = new Set(
    group.map((c) => JSON.stringify(c.trustProxy === undefined ? false : c.trustProxy)),
  );
  if (trustProxyValues.size > 1) {
    exitError(`Port ${p}: conflicting trustProxy values across site configs on the same port.`, 1);
  }
}

// Load optional dependencies only for features enabled in the server configuration.
// Express itself is the runtime's only unconditional external dependency.
const { default: express } = await import('express');
let basicAuth;
let compression;
let cors;
let favicon;
let helmet;
let https;
let morgan;
let multer;
let proxy;
let randomInt;
let rateLimit;
let responseTime;
let spawn;
let Worker;

const hasEnabledConfig = (property) => configs.some((config) => Boolean(config[property]));

if (hasEnabledConfig('proxy')) ({ default: proxy } = await import('express-http-proxy'));
if (configs.some((config) => config.logging !== false))
  ({ default: morgan } = await import('morgan'));
if (hasEnabledConfig('responseTime')) ({ default: responseTime } = await import('response-time'));
if (hasEnabledConfig('cors')) ({ default: cors } = await import('cors'));
if (hasEnabledConfig('compression')) ({ default: compression } = await import('compression'));
if (hasEnabledConfig('helmet')) ({ default: helmet } = await import('helmet'));
if (hasEnabledConfig('favicon')) ({ default: favicon } = await import('serve-favicon'));
if (hasEnabledConfig('rateLimit')) ({ default: rateLimit } = await import('express-rate-limit'));
if (hasEnabledConfig('basicAuth')) ({ default: basicAuth } = await import('express-basic-auth'));
if (hasEnabledConfig('upload')) {
  [{ default: multer }, { randomInt }] = await Promise.all([
    import('multer'),
    import('node:crypto'),
  ]);
}
if (hasEnabledConfig('cgi')) {
  ({ spawn } = await import('node:child_process'));
  const usesCgiWorker = configs.some((config) => {
    const cgiConfigs = Array.isArray(config.cgi) ? config.cgi : [config.cgi];
    return cgiConfigs.some((cgiConfig) =>
      Object.values(cgiConfig?.interpreters || {}).some(
        (interpreter) => interpreter?.type === 'worker',
      ),
    );
  });
  if (usesCgiWorker) ({ Worker } = await import('node:worker_threads'));
}
if (hasEnabledConfig('ssl')) ({ default: https } = await import('node:https'));

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

// Never relay a client's own X-Forwarded-* claims verbatim (X-Forwarded-Host
// spoofing enables password-reset-link poisoning and similar attacks on the
// backend). Rebuild these headers from values this proxy itself vouches for.
function forwardedForChain(req) {
  return [...req.ips, req.socket.remoteAddress].filter(Boolean).join(', ');
}

// req.hostname is trust-proxy-aware and, with trustProxy enabled, honors an
// inbound X-Forwarded-Host — usable to pick the wrong site's router or spoof
// a CGI script's SERVER_NAME. Mirrors Express's own Host-header parsing
// (including the IPv6 literal bracket form) without ever consulting
// X-Forwarded-Host, so it's safe for those internal decisions regardless of
// trustProxy.
function literalHostname(req) {
  const host = req.headers.host || '';
  const offset = host[0] === '[' ? host.indexOf(']') + 1 : 0;
  const index = host.indexOf(':', offset);
  return index !== -1 ? host.substring(0, index) : host;
}

function sanitizedForwardedHeaders(req, configuredHost) {
  // Host is intentionally never taken from req.hostname: with trustProxy
  // enabled that would honor an inbound X-Forwarded-Host, which is only as
  // trustworthy as the upstream proxy's own config. The literal Host header
  // this proxy itself received has no such caveat — every well-behaved
  // upstream (nginx, Caddy, ...) regenerates it per hop regardless of
  // whether it also remembers to set X-Forwarded-Host.
  return {
    'x-forwarded-proto': req.protocol,
    'x-forwarded-host': configuredHost || req.headers.host,
    'x-forwarded-for': forwardedForChain(req),
  };
}

function forwardedHeadersDecorator(configuredHost) {
  return (proxyReqOpts, srcReq) => {
    Object.assign(proxyReqOpts.headers, sanitizedForwardedHeaders(srcReq, configuredHost));
    return proxyReqOpts;
  };
}

function addRemoteProxy(router, port, urlPath, proxyServer, configuredHost) {
  const proxyOptions = { proxyReqOptDecorator: forwardedHeadersDecorator(configuredHost) };
  if (Array.isArray(proxyServer)) {
    let i = 0;
    const targets = proxyServer;
    const balancedProxy = proxy((_req) => targets[i++ % targets.length], proxyOptions);
    if (urlPath) {
      router.use(urlPath, balancedProxy);
    } else {
      router.use(balancedProxy);
    }
    console.log(
      `[proxy] http://localhost:${port}${urlPath || ''} <===> [${targets.join(', ')}] (round-robin)`,
    );
  } else {
    if (urlPath) {
      router.use(urlPath, proxy(proxyServer, proxyOptions));
    } else {
      router.use(proxy(proxyServer, proxyOptions));
    }
    console.log(`[proxy] http://localhost:${port}${urlPath || ''} <===> ${proxyServer}`);
  }
}

function addMappedProxy(router, port, localRootPath, pathPairs, configuredHost) {
  const localPaths = Object.getOwnPropertyNames(pathPairs);
  localPaths.forEach((localPath) => {
    const localFullPath = (localRootPath || '') + localPath;
    addRemoteProxy(router, port, localFullPath, pathPairs[localPath], configuredHost);
  });
}

function addProxies(router, port, localRootPath, proxies, configuredHost) {
  proxies.forEach((proxyUrl) => {
    if (
      Array.isArray(proxyUrl) &&
      proxyUrl.length > 0 &&
      proxyUrl.every((i) => typeof i === 'string')
    ) {
      addRemoteProxy(router, port, localRootPath, proxyUrl, configuredHost);
    } else {
      addProxy(router, port, localRootPath, proxyUrl, configuredHost);
    }
  });
}

function addProxy(router, port, localRootPath, remoteProxy, configuredHost) {
  if (typeof remoteProxy === 'string') {
    addRemoteProxy(router, port, localRootPath, remoteProxy, configuredHost);
  } else if (Array.isArray(remoteProxy)) {
    addProxies(router, port, localRootPath, remoteProxy, configuredHost);
  } else if (remoteProxy instanceof Object) {
    addMappedProxy(router, port, localRootPath, remoteProxy, configuredHost);
  }
}

function configureLogging(router, siteConfig, configDir) {
  if (siteConfig.logging === false) return;
  const lc = siteConfig.logging;
  if (typeof lc === 'object' && lc.file) {
    const stream = fs.createWriteStream(path.resolve(configDir, lc.file), { flags: 'a' });
    router.use(morgan(lc.format || 'combined', { stream }));
  } else {
    router.use(morgan((typeof lc === 'object' ? lc.format : null) || 'dev'));
  }
}

function toOpts(val) {
  return typeof val === 'object' ? val : {};
}

function configureMiddleware(router, siteConfig) {
  if (siteConfig.responseTime) router.use(responseTime(toOpts(siteConfig.responseTime)));
  if (siteConfig.cors) router.use(cors(toOpts(siteConfig.cors)));
  if (siteConfig.compression) router.use(compression(toOpts(siteConfig.compression)));
  if (siteConfig.helmet) router.use(helmet(toOpts(siteConfig.helmet)));
  if (siteConfig.favicon) router.use(favicon(path.resolve(configDir, siteConfig.favicon)));
  if (siteConfig.healthCheck) {
    const hcPath =
      (typeof siteConfig.healthCheck === 'object' && siteConfig.healthCheck.path) || '/__health__';
    router.get(hcPath, (_req, res) => {
      res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
    });
  }
  if (siteConfig.rateLimit) router.use(rateLimit(toOpts(siteConfig.rateLimit)));
  if (siteConfig.basicAuth) router.use(basicAuth(toOpts(siteConfig.basicAuth)));
  if (siteConfig.headers) {
    router.use((_req, res, next) => {
      for (const h of Object.keys(siteConfig.headers)) res.setHeader(h, siteConfig.headers[h]);
      next();
    });
  }
}

function setupRedirects(router, redirects) {
  if (Array.isArray(redirects)) {
    for (const r of redirects) {
      router.all(r.from, (_req, res) => res.redirect(r.status || 301, r.to));
    }
  } else {
    for (const [from, to] of Object.entries(redirects)) {
      const dest = typeof to === 'string' ? to : to.to;
      const status = typeof to === 'object' ? to.status || 301 : 301;
      router.all(from, (_req, res) => res.redirect(status, dest));
    }
  }
}

function buildCgiEnv(req, scriptPath, cgiUrlPath, p, configuredHost) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const env = {
    ...process.env,
    GATEWAY_INTERFACE: 'CGI/1.1',
    SERVER_PROTOCOL: 'HTTP/1.1',
    SERVER_SOFTWARE: 'express-reverse-proxy',
    REQUEST_METHOD: req.method.toUpperCase(),
    SCRIPT_FILENAME: scriptPath,
    SCRIPT_NAME: cgiUrlPath + req.path,
    SERVER_NAME: configuredHost || literalHostname(req) || '',
  };
  if (url.search) {
    env.QUERY_STRING = url.search.slice(1);
  }
  if (req.ip) {
    env.REMOTE_ADDR = req.ip;
  }
  if (req.headers['content-type']) {
    env.CONTENT_TYPE = req.headers['content-type'];
  }
  if (req.headers['content-length']) {
    env.CONTENT_LENGTH = req.headers['content-length'];
  }
  if (p) {
    env.SERVER_PORT = String(p);
  }
  for (const [k, v] of Object.entries(req.headers)) {
    env[`HTTP_${k.toUpperCase().replaceAll('-', '_')}`] = Array.isArray(v) ? v.join(', ') : v;
  }
  // Overwrite whatever the client claimed — see sanitizedForwardedHeaders.
  const forwarded = sanitizedForwardedHeaders(req, configuredHost);
  env.HTTP_X_FORWARDED_PROTO = forwarded['x-forwarded-proto'];
  env.HTTP_X_FORWARDED_HOST = forwarded['x-forwarded-host'];
  env.HTTP_X_FORWARDED_FOR = forwarded['x-forwarded-for'];
  return env;
}

function applyCgiHeaders(rawHeaders, res) {
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
  return statusCode;
}

function normalizeCgiConfigs(cgiRaw) {
  if (Array.isArray(cgiRaw)) return cgiRaw;
  return [typeof cgiRaw === 'string' ? { dir: cgiRaw } : cgiRaw];
}

function collectCgiPaths(cgiRaw) {
  if (!cgiRaw) return [];
  return normalizeCgiConfigs(cgiRaw).map((cgiConfig) => cgiConfig.dir || './cgi-bin');
}

function createCgiRouteOptions(cgiConfig, configDir) {
  const cgiDir = path.resolve(configDir, cgiConfig.dir || './cgi-bin');
  const interpreters = cgiConfig.interpreters || {};
  const configuredExtensions = cgiConfig.extensions || Object.keys(interpreters);
  return {
    cgiDir,
    cgiUrlPath: cgiConfig.path || `/${path.basename(cgiDir)}`,
    timeoutMs: cgiConfig.timeoutMs || cgiConfig.timeout,
    interpreters,
    extensions: new Set(
      configuredExtensions.length ? configuredExtensions : ['.pl', '.py', '.js', '.sh'],
    ),
  };
}

function findCgiScript(cgiDir, extensions, requestPath) {
  const scriptPath = path.resolve(cgiDir, `.${requestPath}`);
  if (!scriptPath.startsWith(cgiDir + path.sep) || !extensions.has(path.extname(scriptPath))) {
    return null;
  }
  try {
    const stats = fs.lstatSync(scriptPath);
    return stats.isFile() && !stats.isSymbolicLink() ? scriptPath : null;
  } catch {
    return null;
  }
}

function getCgiInterpreterConfig(interpreters, extension) {
  const config = interpreters[extension];
  if (typeof config === 'string') return { interpreter: config, type: 'process' };
  return config || { type: 'process' };
}

function createCgiRunner(scriptPath, env, interpreterConfig) {
  if (interpreterConfig.type === 'worker') {
    const worker = new Worker(scriptPath, {
      env,
      workerData: env,
      stdin: true,
      stdout: true,
      stderr: true,
    });
    return {
      process: worker,
      stdin: worker.stdin,
      stdout: worker.stdout,
      stderr: worker.stderr,
      name: 'cgi-worker',
      isWorker: true,
      completionEvent: 'exit',
      kill: () => worker.terminate().catch(() => {}),
    };
  }

  const child = spawn(interpreterConfig.interpreter || process.execPath, [scriptPath], {
    env,
    cwd: path.dirname(scriptPath),
    shell: false,
  });
  return {
    process: child,
    stdin: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr,
    name: 'cgi',
    isWorker: false,
    completionEvent: 'close',
    kill: () => {
      try {
        child.kill();
      } catch {}
    },
  };
}

function createCgiRequestState(res, timeoutMs) {
  let finished = false;
  let timer = null;
  let kill = () => {};
  const finish = () => {
    if (finished) return false;
    finished = true;
    if (timer) clearTimeout(timer);
    timer = null;
    return true;
  };

  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => {
      if (!finish()) return;
      kill();
      if (res.headersSent) res.end();
      else res.status(504).send('CGI Timeout');
    }, timeoutMs);
  }

  return { finish, isFinished: () => finished, setKill: (runnerKill) => (kill = runnerKill) };
}

function finishCgiWithError(state, res, message) {
  if (res.headersSent || !state.finish()) return false;
  res.status(500).send(message);
  return true;
}

function monitorCgiRunner(runner, scriptPath, state, res) {
  runner.process.on('error', (err) => {
    const message = runner.isWorker
      ? `CGI Worker error: ${err.message}`
      : `CGI error: ${err.message}`;
    const action = runner.isWorker ? 'error in' : 'spawn error for';
    console.error(`[${runner.name}] ${action} ${scriptPath}: ${err.message}`);
    if (finishCgiWithError(state, res, message) && runner.isWorker) runner.kill();
  });

  runner.process.on(runner.completionEvent, (code) => {
    if (code === 0 || state.isFinished() || res.headersSent) return;
    console.error(`[${runner.name}] ${scriptPath} exited with code ${code}`);
    const message = runner.isWorker
      ? `CGI Worker crashed with code ${code}`
      : `CGI process exited with code ${code}`;
    finishCgiWithError(state, res, message);
  });
}

function pipeCgiOutput(runner, state, res) {
  let headersParsed = false;
  let rawBuffer = '';
  const write = (data) => {
    if (!res.write(data)) runner.stdout.pause();
  };

  runner.stdout.on('data', (chunk) => {
    if (state.isFinished()) return;
    if (headersParsed) return write(chunk);

    rawBuffer += chunk.toString('binary');
    if (rawBuffer.length > 65536) {
      runner.stdout.destroy();
      runner.kill();
      finishCgiWithError(state, res, 'CGI headers too large');
      return;
    }

    const separator = /\r?\n\r?\n/.exec(rawBuffer);
    if (!separator) return;

    const rawHeaders = rawBuffer.substring(0, separator.index);
    const body = Buffer.from(rawBuffer.substring(separator.index + separator[0].length), 'binary');
    headersParsed = true;
    res.status(applyCgiHeaders(rawHeaders, res));
    if (body.length) write(body);
  });

  runner.stdout.on('end', () => {
    if (!state.finish()) return;
    runner.kill();
    if (headersParsed) res.end();
    else if (!res.headersSent) res.status(500).send('CGI script produced no output');
  });
}

function createCgiRequestHandler(options, p, configuredHost) {
  return (req, res, next) => {
    const scriptPath = findCgiScript(options.cgiDir, options.extensions, req.path);
    if (!scriptPath) return next();

    const interpreterConfig = getCgiInterpreterConfig(
      options.interpreters,
      path.extname(scriptPath),
    );
    const env = buildCgiEnv(req, scriptPath, options.cgiUrlPath, p, configuredHost);
    const runner = createCgiRunner(scriptPath, env, interpreterConfig);
    const state = createCgiRequestState(res, options.timeoutMs);
    state.setKill(runner.kill);
    monitorCgiRunner(runner, scriptPath, state, res);

    if (runner.stderr) {
      runner.stderr.on('data', (data) => console.error(`[${runner.name}] ${scriptPath}: ${data}`));
    }
    runner.stdin.on('error', () => {});
    req.pipe(runner.stdin);
    res.on('drain', () => runner.stdout.resume());
    pipeCgiOutput(runner, state, res);

    console.log(
      `[${runner.name}] ${req.method} ${options.cgiUrlPath}${req.path} → ${scriptPath}${runner.isWorker ? ' (Thread)' : ''}`,
    );
  };
}

function setupCgi(router, siteConfig, p, configDir, configuredHost) {
  if (!siteConfig.cgi) return;
  for (const cgiConfig of normalizeCgiConfigs(siteConfig.cgi)) {
    const options = createCgiRouteOptions(cgiConfig, configDir);
    router.use(options.cgiUrlPath, createCgiRequestHandler(options, p, configuredHost));
  }
}

function buildFileFilter(allowedTypes) {
  if (!allowedTypes) return undefined;
  return (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { status: 400 }));
  };
}

function handleUploadResponse(req, res) {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  res.json({
    files: req.files.map((f) => ({ file: f.filename, size: f.size, originalName: f.originalname })),
  });
}

function setupUpload(router, siteConfig, configDir) {
  if (!siteConfig.upload) return;
  const uploadRaw = siteConfig.upload;
  const uploadConfigs = Array.isArray(uploadRaw)
    ? uploadRaw
    : [typeof uploadRaw === 'string' ? { dir: uploadRaw } : uploadRaw];

  for (const uploadConfig of uploadConfigs) {
    const uploadUrlPath = uploadConfig.path || '/upload';
    const uploadDir = path.resolve(configDir, uploadConfig.dir || './uploads');
    const allowedTypes = uploadConfig.allowedTypes ? new Set(uploadConfig.allowedTypes) : null;

    fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base =
          path.basename(file.originalname, ext).replaceAll(/[^a-zA-Z0-9_.-]/g, '_') || 'file';
        cb(null, `${base}-${Date.now()}-${randomInt(0, 1_000_000_000)}${ext}`);
      },
    });

    const limits = {};
    if (uploadConfig.maxFileSize) limits.fileSize = uploadConfig.maxFileSize;
    if (uploadConfig.maxFiles) limits.files = uploadConfig.maxFiles;

    const uploader = multer({ storage, limits, fileFilter: buildFileFilter(allowedTypes) });
    const multerMiddleware = uploadConfig.fieldName
      ? uploader.array(uploadConfig.fieldName)
      : uploader.any();

    router.post(uploadUrlPath, (req, res, next) => {
      multerMiddleware(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
          return res.status(status).json({ error: err.message });
        }
        if (err?.status || err?.statusCode) {
          return res.status(err.statusCode || err.status).json({ error: err.message });
        }
        if (err) return next(err);
        return handleUploadResponse(req, res);
      });
    });
    router.use(uploadUrlPath, express.static(uploadDir));
    console.log(`[upload] POST ${uploadUrlPath} → ${uploadDir}`);
  }
}

function setupHotReload(app, portConfigs, p) {
  const hotReloadEnabled = portConfigs.some((c) => c.hotReload === true);
  if (!hotReloadEnabled) return;

  const hotReloadClientJs = fs.readFileSync(
    new URL('hot-reload-client.js', import.meta.url),
    'utf8',
  );
  const sseClients = new Set();
  let reloadTimer = null;

  app.get('/__hot-reload__', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  app.get('/__hot-reload__/client.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(hotReloadClientJs);
  });

  const staticWatchPaths = portConfigs
    .flatMap((config) => collectFolderPaths(config.folders || []))
    .map((folder) => (path.isAbsolute(folder) ? folder : path.join(process.cwd(), folder)));
  const cgiWatchPaths = portConfigs
    .flatMap((config) => collectCgiPaths(config.cgi))
    .map((cgiDir) => path.resolve(configDir, cgiDir));
  const watchPaths = [...new Set([...staticWatchPaths, ...cgiWatchPaths])];

  for (const watchPath of watchPaths) {
    if (fs.existsSync(watchPath)) {
      const onChange = () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          for (const client of sseClients) client.write('data: reload\n\n');
        }, 100);
      };
      let watcher;
      try {
        watcher = fs.watch(watchPath, { recursive: true }, onChange);
      } catch {
        console.warn(
          `[hot-reload] recursive watch not supported on this platform, falling back for ${watchPath}`,
        );
        watcher = fs.watch(watchPath, onChange);
      }
      watcher.on('error', (err) => {
        console.warn(`[hot-reload] watch error for ${watchPath}: ${err.message}`);
        watcher.close();
      });
    }
  }
  const directoryLabel = watchPaths.length === 1 ? 'directory' : 'directories';
  console.log(`[hot-reload] watching ${watchPaths.length} ${directoryLabel} on port ${p}`);
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

  // Off by default: nothing beyond the direct socket is trusted, so
  // req.hostname/protocol/ip (and the forwarded headers derived from them)
  // ignore any X-Forwarded-* a client sends. Set trustProxy only when this
  // instance genuinely sits behind another trusted proxy/load balancer.
  const trustProxyConfig = portConfigs.find((c) => c.trustProxy !== undefined)?.trustProxy;
  if (trustProxyConfig !== undefined) app.set('trust proxy', trustProxyConfig);

  setupHotReload(app, portConfigs, p);

  // Specific hosts first, catch-all last
  const sorted = [
    ...portConfigs.filter((c) => c.host && c.host !== '*'),
    ...portConfigs.filter((c) => !c.host || c.host === '*'),
  ];

  sorted.forEach((siteConfig) => {
    const siteHost = siteConfig.host || '*';
    const configuredHost = siteHost === '*' ? undefined : siteHost;
    const router = express.Router();
    console.log(`[host] ${siteHost} → :${p}`);
    configureLogging(router, siteConfig, configDir);
    configureMiddleware(router, siteConfig);
    if (siteConfig.redirects) setupRedirects(router, siteConfig.redirects);
    if (siteConfig.folders) addStaticFolder(router, p, null, siteConfig.folders);
    setupCgi(router, siteConfig, p, configDir, configuredHost);
    setupUpload(router, siteConfig, configDir);
    if (siteConfig.proxy) addProxy(router, p, null, siteConfig.proxy, configuredHost);
    if (siteConfig.unhandled) {
      router.use((req, res, next) => {
        const entries = Object.entries(siteConfig.unhandled);
        for (const [acceptName, acceptConfig] of entries) {
          if (acceptName && acceptName !== '*' && acceptName !== '**' && req.accepts(acceptName)) {
            unhandled(res, acceptConfig);
            return;
          }
        }
        for (const [acceptName, acceptConfig] of entries) {
          if (!acceptName || acceptName === '*' || acceptName === '**') {
            unhandled(res, acceptConfig);
            return;
          }
        }
        next();
      });
    }
    if (siteHost === '*') {
      app.use(router);
    } else {
      app.use((req, res, next) => {
        if (literalHostname(req) === siteHost) router(req, res, next);
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
    if (sslConfig.redirect) {
      const redirectPort = sslConfig.redirect;
      const redirectApp = express();
      redirectApp.use((req, res) => {
        res.redirect(301, `https://${req.hostname}:${p}${req.url}`);
      });
      redirectApp.listen(redirectPort, () => {
        console.log(`[listen] http redirect :${redirectPort} → https :${p}`);
      });
    }
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
