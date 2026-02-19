module.exports = {
  apps: [
    {
      name: 'express-reverse-proxy',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 3000,
      shutdown_with_message: true,
    },
  ],
};
