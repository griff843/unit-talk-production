import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * SPRINT-SMARTFORM-CONTRACT-EXECUTION-PROOF-060
 * SPRINT-SMARTFORM-BETSLIP-SPORTSBOOK-MANUAL-061
 *
 * Playwright Configuration for Smart Form E2E Tests
 *
 * IMPORTANT: This config targets tests in ./tests/e2e/*.spec.ts
 * Run with: pnpm -C apps/smart-form test:e2e
 *
 * Features:
 * - Auto-starts dev server via webServer config
 * - Uses 127.0.0.1 to avoid Windows IPv6 issues
 * - Reuses existing server in dev, fresh server in CI
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// Use 127.0.0.1 to avoid Windows IPv6 resolution issues with localhost/::1
const BASE_URL = process.env.SMARTFORM_URL || 'http://127.0.0.1:3021';

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
    // Base URL for API tests - use 127.0.0.1 to avoid IPv6 issues
    baseURL: BASE_URL,

    // Trace on retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Longer timeouts for API operations
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // SPRINT-061: Auto-start dev server for E2E tests
  // Uses 127.0.0.1 binding to avoid Windows IPv6 ECONNREFUSED issues
  webServer: {
    // Start Next.js dev server bound to 127.0.0.1
    command: 'npx next dev -p 3021 -H 127.0.0.1',
    url: BASE_URL,
    // Reuse existing server in dev mode, fresh server in CI
    reuseExistingServer: !process.env.CI,
    // Allow up to 2 minutes for server startup (Next.js can be slow on first compile)
    timeout: 120000,
    // Show server output for debugging
    stdout: 'pipe',
    stderr: 'pipe',
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
