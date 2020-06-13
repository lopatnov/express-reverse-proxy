const path = require('path');
const express = require('express');
const morgan = require('morgan');
const config = require('./config.json');

const app = express();
const host = 'localhost';
const port = (config && config.port) || 8080;

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
  console.log(`[static] ${urlPath || '/'} = ${folderPath}`);
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

app.use(morgan('combined'));

if (config && config.folders) {
  addStaticFolder(null, config.folders);
}

const server = app.listen(port, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

process.on('message', (msg) => {
  if (msg.toLowerCase() === 'shutdown') {
    console.log('Closing all connections...');
    server.close(() => {
      console.log('Finished closing connections');
      process.exit(0);
    });
  }
});
