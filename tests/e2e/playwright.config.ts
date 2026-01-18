import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Playwright Configuration for Real-World E2E Validation
 *
 * Supports both staging and production environments for:
 * - Smart Form submission flows
 * - Command Center dashboard validation
 * - Daily recap workflow testing
 * - Full TicketLifecycleWorkflow integration
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  testMatch: '**/*.e2e.spec.ts',

  /* Run tests in files in parallel */
  fullyParallel: false, // Sequential for E2E flows

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI for E2E stability */
  workers: process.env.CI ? 1 : 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['list'], // Console reporter for real-time feedback
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL - defaults to staging, override with env var */
    baseURL: process.env.E2E_BASE_URL || 'https://staging.unit-talk.com',

    /* Collect trace on retry for debugging */
    trace: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Longer timeouts for E2E operations */
    actionTimeout: 60000, // 60 seconds
    navigationTimeout: 60000, // 60 seconds

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
      'X-Test-Environment': process.env.E2E_ENVIRONMENT || 'staging',
    },
  },

  /* Configure projects for different environments */
  projects: [
    {
      name: 'local-chrome',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_LOCAL_URL || 'http://localhost:3002',
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
          'X-Test-Environment': 'local',
        },
      },
    },
    {
      name: 'local-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: process.env.E2E_LOCAL_URL || 'http://localhost:3002',
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
          'X-Test-Environment': 'local',
        },
      },
    },
    {
      name: 'staging-chrome',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_STAGING_URL || 'https://staging.unit-talk.com',
      },
    },
    {
      name: 'staging-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: process.env.E2E_STAGING_URL || 'https://staging.unit-talk.com',
      },
    },
    {
      name: 'production-read-only',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_PRODUCTION_URL || 'https://app.unit-talk.com',
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
          'X-Read-Only': 'true', // Signal read-only mode
        },
      },
    },
  ],

  /* Global test timeout: 5 minutes per test */
  timeout: 300000,

  /* Expect timeout: 30 seconds for assertions */
  expect: {
    timeout: 30000,
  },

  /* Test output directory */
  outputDir: 'test-results/artifacts',

  /* Global setup/teardown */
  globalSetup: require.resolve('./utils/global-setup'),
  globalTeardown: require.resolve('./utils/global-teardown'),
});
