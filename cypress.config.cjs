const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  e2e: {
    baseUrl: 'http://localhost:8080',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: true,
    // Allow visiting multiple origins (port 8080 and 8081 in the same test run)
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      on('task', {
        touchCgiFile() {
          const file = path.join(config.projectRoot, 'demo', 'cgi-bin', 'test-worker.js');
          fs.writeFileSync(file, fs.readFileSync(file));
          return null;
        },
      });
      return config;
    },
  },
};
