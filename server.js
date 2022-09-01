#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
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
  // {
  //   name: '--cluster',
  //   subArgs: ['command: start | stop'],
  //   description: 'starts or stops server cluster. By default server starts without cluster',
  //   samples: ['--cluster start', '--cluster stop'],
  // },
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

let configFile = './server-config.json';
if (serverArgs['--config']) {
  [configFile] = serverArgs['--config'].args;
  if (fs.existsSync(configFile) && fs.lstatSync(configFile).isDirectory()) {
    configFile = path.join(configFile, './server-config.json');
  }
}
if (!fs.existsSync(configFile)) {
  exitError(`Configuration file not found. Please add "${configFile}" file or provide a path through "--config <file name>" option`, 404);
}
console.log(`[config] ${configFile}`);

const config = JSON.parse(fs.readFileSync(configFile));
const app = express();
const host = 'localhost';
const port = (config && config.port) || process.env.PORT || 8080;

app.use(morgan('combined'));

if (config.headers) {
  app.use((req, res, next) => {
    const headers = Object.keys(config.headers);
    headers.forEach((header) => res.setHeader(header, config.headers[header]));
    next();
  });
}

function addStaticFolderByName(urlPath, folder) {
  let folderPath = folder;
  if (!path.isAbsolute(folder)) {
    folderPath = path.join(process.cwd(), folder);
  }
  if (urlPath) {
    app.use(urlPath, express.static(folderPath));
  } else {
    app.use(express.static(folderPath));
  }
  console.log(`[folder] http://localhost:${port}/${urlPath || ''} <===> ${folderPath}`);
}

function addMappedStaticFolders(rootPath, folders) {
  const pathStart = rootPath || '';
  const keys = Object.getOwnPropertyNames(folders);
  keys.forEach((key) => {
    const folderPath = pathStart + key;
    addStaticFolder(folderPath, folders[key]);
  });
}

function addStaticFolders(rootPath, folders) {
  folders.forEach((folder) => {
    addStaticFolder(rootPath, folder);
  });
}

function addStaticFolder(rootPath, folder) {
  if (typeof (folder) === 'string') {
    addStaticFolderByName(rootPath, folder);
  } else if (Array.isArray(folder)) {
    addStaticFolders(rootPath, folder);
  } else if (folder instanceof Object) {
    addMappedStaticFolders(rootPath, folder);
  }
}

if (config && config.folders) {
  addStaticFolder(null, config.folders);
}

function addRemoteProxy(urlPath, proxyServer) {
  if (urlPath) {
    app.use(urlPath, proxy(proxyServer));
  } else {
    app.use(proxy(proxyServer));
  }
  console.log(`[proxy] http://localhost:${port}/${urlPath || ''} <===> ${proxyServer}`);
}

function addMappedProxy(localRootPath, pathPairs) {
  const localPaths = Object.getOwnPropertyNames(pathPairs);
  localPaths.forEach((localPath) => {
    const localFullPath = (localRootPath || '') + localPath;
    addRemoteProxy(localFullPath, pathPairs[localPath]);
  });
}

function addProxies(localRootPath, proxies) {
  proxies.forEach((proxyUrl) => {
    addRemoteProxy(localRootPath, proxyUrl);
  });
}

function addProxy(localRootPath, remoteProxy) {
  if (typeof (remoteProxy) === 'string') {
    addRemoteProxy(localRootPath, remoteProxy);
  } else if (Array.isArray(remoteProxy)) {
    addProxies(localRootPath, remoteProxy);
  } else if (remoteProxy instanceof Object) {
    addMappedProxy(localRootPath, remoteProxy);
  }
}

if (config && config.proxy) {
  addProxy(null, config.proxy);
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

if (config && config.unhandled) {
  app.use((req, res, next) => {
    Object.keys(config.unhandled).forEach((acceptName) => {
      if (!acceptName || acceptName === '*' || acceptName === '**') {
        unhandled(res, config.unhandled[acceptName]);
      } else if (req.accepts(acceptName)) {
        unhandled(res, config.unhandled[acceptName]);
      }
    });
  });
}

const server = app.listen(port, () => {
  console.log(`[listen] http://${host}:${port}`);
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
