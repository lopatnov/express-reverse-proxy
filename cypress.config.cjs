module.exports = {
  e2e: {
    baseUrl: 'http://localhost:8080',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: true,
    // Allow visiting multiple origins (port 8080 and 8081 in the same test run)
    chromeWebSecurity: false,
  },
};
