#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const express = require('express');
const morgan = require('morgan');
const proxy = require('express-http-proxy');

const possibleServerArgs = [
  {
    name: '--help',
    description: 'shows command line help',
  },
  {
    name: '--config',
    subArgs: ['file name'],
    description: 'sets server configuration file. Default value of file name is "server-config.json"',
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
      const changedResult = { ...res };
      changedResult[arg.name] = {
        args: [],
      };
      if (arg.subArgs) {
        arg.subArgs.forEach((subArg, index) => {
          const subArgIndex = argIndex + index + 1;
          if (process.argv.length <= subArgIndex
            || argsNames.indexOf(process.argv[subArgIndex]) > -1) {
            exitError(`Invalid argument ${arg.name}. Missing <${subArg}>.`, 16);
          }
          changedResult[arg.name].args.push(process.argv[subArgIndex]);
        });
      }
      return changedResult;
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
    const argTabIndent = Array(tabIndentLength - Math.trunc(arg.name.length / 4)).fill('\t').join('');
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
  const ecosystemConfig = path.join(__dirname, 'ecosystem.config.js');
  const cwd = process.cwd();
  const configPassthrough = serverArgs['--config']
    ? ['--', '--config', serverArgs['--config'].args[0]]
    : [];

  const pm2Commands = {
    start:   ['start',   ecosystemConfig, '--no-daemon', `--cwd=${cwd}`, ...configPassthrough],
    stop:    ['stop',    'express-reverse-proxy'],
    restart: ['restart', 'express-reverse-proxy', `--cwd=${cwd}`, ...configPassthrough],
    status:  ['status'],
    logs:    ['logs',    'express-reverse-proxy', '--lines', '200'],
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

const DEFAULT_CONFIG = { port: 8000, folders: '.' };

let rawConfig;
if (!fs.existsSync(configFile)) {
  if (serverArgs['--config']) {
    exitError(`Configuration file not found: "${configFile}"`, 404);
  }
  console.warn(`\x1b[33m[config] "${configFile}" not found — using defaults (port: 8000, folders: ".")\x1b[0m`);
  rawConfig = DEFAULT_CONFIG;
} else {
  console.log(`[config] ${configFile}`);
  rawConfig = JSON.parse(fs.readFileSync(configFile));
}

const configs = Array.isArray(rawConfig) ? rawConfig : [rawConfig];

// Validate duplicate hosts
const seen = new Set();
configs.forEach((c) => {
  const h = c.host || '*';
  if (seen.has(h)) {
    exitError(`Duplicate host in configuration: "${h}"`, 1);
  }
  seen.add(h);
});

// Specific hosts first, catch-all last
const sortedConfigs = [
  ...configs.filter((c) => c.host && c.host !== '*'),
  ...configs.filter((c) => !c.host || c.host === '*'),
];

const app = express();
const port = process.env.PORT
  || configs.reduce((p, c) => p || c.port, null)
  || 8000;

app.use(morgan('combined'));

function addStaticFolderByName(router, urlPath, folder) {
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

function addMappedStaticFolders(router, rootPath, folders) {
  const pathStart = rootPath || '';
  const keys = Object.getOwnPropertyNames(folders);
  keys.forEach((key) => {
    const folderPath = pathStart + key;
    addStaticFolder(router, folderPath, folders[key]);
  });
}

function addStaticFolders(router, rootPath, folders) {
  folders.forEach((folder) => {
    addStaticFolder(router, rootPath, folder);
  });
}

function addStaticFolder(router, rootPath, folder) {
  if (typeof (folder) === 'string') {
    addStaticFolderByName(router, rootPath, folder);
  } else if (Array.isArray(folder)) {
    addStaticFolders(router, rootPath, folder);
  } else if (folder instanceof Object) {
    addMappedStaticFolders(router, rootPath, folder);
  }
}

function addRemoteProxy(router, urlPath, proxyServer) {
  if (urlPath) {
    router.use(urlPath, proxy(proxyServer));
  } else {
    router.use(proxy(proxyServer));
  }
  console.log(`[proxy] http://localhost:${port}${urlPath || ''} <===> ${proxyServer}`);
}

function addMappedProxy(router, localRootPath, pathPairs) {
  const localPaths = Object.getOwnPropertyNames(pathPairs);
  localPaths.forEach((localPath) => {
    const localFullPath = (localRootPath || '') + localPath;
    addRemoteProxy(router, localFullPath, pathPairs[localPath]);
  });
}

function addProxies(router, localRootPath, proxies) {
  proxies.forEach((proxyUrl) => {
    addRemoteProxy(router, localRootPath, proxyUrl);
  });
}

function addProxy(router, localRootPath, remoteProxy) {
  if (typeof (remoteProxy) === 'string') {
    addRemoteProxy(router, localRootPath, remoteProxy);
  } else if (Array.isArray(remoteProxy)) {
    addProxies(router, localRootPath, remoteProxy);
  } else if (remoteProxy instanceof Object) {
    addMappedProxy(router, localRootPath, remoteProxy);
  }
}

function unhandled(res, acceptConfig) {
  const headers = (acceptConfig.headers && Object.keys(acceptConfig.headers)) || [];
  headers.forEach((header) => res.setHeader(header, acceptConfig.headers[header]));

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

sortedConfigs.forEach((siteConfig) => {
  const siteHost = siteConfig.host || '*';
  const router = express.Router();

  console.log(`[host] ${siteHost}`);

  if (siteConfig.headers) {
    router.use((_req, res, next) => {
      Object.keys(siteConfig.headers)
        .forEach((h) => res.setHeader(h, siteConfig.headers[h]));
      next();
    });
  }

  if (siteConfig.folders) {
    addStaticFolder(router, null, siteConfig.folders);
  }

  if (siteConfig.proxy) {
    addProxy(router, null, siteConfig.proxy);
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

const server = app.listen(port, () => {
  console.log(`[listen] http://localhost:${port}`);
  if (process.send) {
    process.send('ready');
  }
});

function shutdown() {
  console.log('Closing all connections...');
  server.close(() => {
    console.log('Finished closing connections');
    process.exit(0);
  });
}

process.on('message', (msg) => {
  if (msg.toLowerCase() === 'shutdown') {
    shutdown();
  }
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
