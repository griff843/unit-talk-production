import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Command Center verification tests
 * Targets localhost:3004 (the exposed Docker port)
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/command-center-production-verification.spec.ts', '**/command-center-simple-verification.spec.ts'],
  fullyParallel: false, // Run tests sequentially for better debugging
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-verification-report' }],
    ['line']
  ],
  
  use: {
    // Target the exposed Docker port
    baseURL: 'http://localhost:3004',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Increase timeouts for Docker environment
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Configure browser
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start a web server - we expect it to be running via Docker
  // webServer: undefined,

  // Global setup/teardown
  globalTimeout: 5 * 60 * 1000, // 5 minutes total
  timeout: 2 * 60 * 1000, // 2 minutes per test
});