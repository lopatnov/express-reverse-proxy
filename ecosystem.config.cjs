const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'express-reverse-proxy',
      script: path.join(__dirname, 'server.js'),
      instances: 'max',
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 5000,
      shutdown_with_message: true,
      vizion: false, // disable git metadata collection
      pmx: false, // disable PM2 metrics (avoids wmic ENOENT on Windows 11)
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};
