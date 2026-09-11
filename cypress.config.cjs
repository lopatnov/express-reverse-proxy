const fs = require('node:fs');
const http = require('node:http');
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
        isPortListening(url) {
          return new Promise((resolve) => {
            const req = http.get(url, (res) => {
              res.resume();
              resolve(true);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => {
              req.destroy();
              resolve(false);
            });
          });
        },
      });
      return config;
    },
  },
};
