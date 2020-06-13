/* jslint es6:true */

import path from 'path';
import express from 'express';
import config from './config.json';
import morgan from 'morgan';

const app = express();
const host = 'localhost';
const port = (config && config.port) || 8080;

function addStaticFolderByName(urlPath, folder) {
    "use strict";
    let folderPath = folder;
    if (!path.isAbsolute(folder)){
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
    "use strict";
    rootPath = rootPath || '';
    const keys = Object.getOwnPropertyNames(folders);
    keys.forEach((key) => {
        const folderPath = rootPath + key;
        addStaticFolder(folderPath, folders[key]);
    });
}

function addStaticFolders(path, folders) {
    "use strict";    
    folders.forEach(function (folder) {
        addStaticFolder(path, folder);
    });
}

function addStaticFolder(path, folder) {
    "use strict";
    if ('string' === typeof(folder)) {
        addStaticFolderByName(path, folder);
    } else if (Array.isArray(folder)) {
        addStaticFolders(path, folder);
    } else if (folder instanceof Object) {
        addMappedStaticFolders(path, folder);
    }
}

app.use(morgan('combined'));

if (config && config.folders) {
    addStaticFolder(null, config.folders);
}

app.listen(port, function () {
    console.log(`Server listening on http://${host}:${port}`);
});

process.on('message', (msg) => {
    if (msg == 'shutdown') {
        console.log('Closing all connections...');
        server.close(() => {
            console.log('Finished closing connections');
            process.exit(0);
        });
    }
});
