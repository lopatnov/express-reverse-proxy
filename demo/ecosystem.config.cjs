const path = require('node:path');
const root = path.join(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'server-a',
      script: path.join(__dirname, 'server-a.js'),
      instances: 1,
      exec_mode: 'fork',
      vizion: false,
      pmx: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'server-b',
      script: path.join(__dirname, 'server-b.js'),
      instances: 1,
      exec_mode: 'fork',
      vizion: false,
      pmx: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'express-reverse-proxy',
      script: path.join(root, 'server.js'),
      args: '--config demo/server-config.json',
      instances: 'max',
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 5000,
      shutdown_with_message: true,
      vizion: false,
      pmx: false,
      env: { NODE_ENV: 'production' },
    },
  ],
};
