module.exports = {
  apps: [
    {
      name: 'server',
      script: './server.js',
      kill_timeout: 3000,
      shutdown_with_message: true,
    },
  ],
};
