const fs = require('fs');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const proxy = require('express-http-proxy');

const configFile = fs.existsSync('./server-config.json') ? './server-config.json' : './package.json';

console.log(`[config] ${configFile}`);

const config = JSON.parse(fs.readFileSync(configFile));
const app = express();
const host = 'localhost';
const port = (config && config.port) || 8080;

app.use(morgan('combined'));

function addStaticFolderByName(urlPath, folder) {
  let folderPath = folder;
  if (!path.isAbsolute(folder)) {
    folderPath = path.join(__dirname, folder);
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
