module.exports = {
  testDir: '.',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  use: {
    headless: false,
    baseURL: 'http://localhost:3002',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Don't start web server - use existing dev server
  // webServer: {
  //   command: 'npm run dev',
  //   port: 3002,
  //   reuseExistingServer: true,
  // },
};
