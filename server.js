import path from 'path';
import express from 'express';
import pkg from './package.json';

const app = express();
const host = 'localhost';
const port = 8080;

pkg.folders.forEach((folderName) => {
    const folder = path.join(__dirname, folderName);
    console.info(`Folder: ${folder}`);
    app.use(express.static(folder));
});

app.listen(port, function () {
    console.log(`Server listening on ${host}:${port}`);
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
