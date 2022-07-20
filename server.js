#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const proxy = require('express-http-proxy');

let configFile;
const configArgumentName = '--config';
const configArgIndex = process.argv.indexOf(configArgumentName);
const serverConfigPath = './server-config.json';
const packageJsonPath = './package.json';
if (configArgIndex > -1) {
  if (process.argv.length > configArgIndex + 1) {
    configFile = process.argv[configArgIndex + 1];
    if (fs.lstatSync(configFile).isDirectory()) {
      configFile = path.join(configFile, serverConfigPath);
      if (!fs.existsSync(configFile)) {
        const packageJsonArg = path.join(configFile, packageJsonPath);
        if (fs.existsSync(packageJsonArg)) {
          configFile = packageJsonArg;
        }
      }
    }
    if (!fs.existsSync(configFile)) {
      throw new Error(`Configuration file "${configFile}" not found`);
    }
  } else {
    throw new Error('Please set configuration file name for --config argument');
  }
} else if (fs.existsSync(serverConfigPath)) {
  configFile = serverConfigPath;
} else if (fs.existsSync(packageJsonPath)) {
  configFile = packageJsonPath;
} else {
  throw new Error(`Configuration file not found. Please add ${serverConfigPath} file or configure it through "${configArgumentName} <file name>" or add configurations to ${packageJsonPath} file`);
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
