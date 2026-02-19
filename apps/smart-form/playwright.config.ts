import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * SPRINT-SMARTFORM-CONTRACT-EXECUTION-PROOF-060
 *
 * Playwright Configuration for Smart Form E2E Tests
 *
 * IMPORTANT: This config targets tests in ./tests/e2e/*.spec.ts
 * Run with: pnpm -C apps/smart-form test:e2e
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory - relative to this config file
  testDir: './tests/e2e',

  // Match .spec.ts files (not .e2e.spec.ts to avoid root config confusion)
  testMatch: '**/*.spec.ts',

  // Run tests sequentially for API contract tests
  fullyParallel: false,

  // Fail on CI if test.only is left in code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Single worker for contract tests (sequential)
  workers: 1,

  // Reporters
  reporter: [
    ['list'], // Console output
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Global settings
  use: {
    // Base URL for API tests
    baseURL: process.env.SMARTFORM_URL || 'http://localhost:3021',

    // Trace on retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Longer timeouts for API operations
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // Single project for contract tests (API tests don't need multiple browsers)
  projects: [
    {
      name: 'contracts',
      testMatch: '**/smartform-data-contracts.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'chromium',
      testMatch: '**/*.spec.ts',
      testIgnore: '**/smartform-data-contracts.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Test timeout: 60 seconds
  timeout: 60000,

  // Assertion timeout: 10 seconds
  expect: {
    timeout: 10000,
  },

  // Output directory
  outputDir: 'test-results/',
});
