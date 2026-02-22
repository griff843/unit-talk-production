/**
 * Cypress Configuration
 *
 * SPRINT-SMARTFORM-CYPRESS-BUILD-SURFACE-ISOLATION-103A:
 * Using .cjs extension to isolate from Next.js/TypeScript production build.
 * This prevents "Cannot find module 'cypress'" errors during Docker build
 * when cypress is not installed (devDependency only).
 */

const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        },
      });
    },
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
});
