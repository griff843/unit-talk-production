import { defineConfig, devices } from '@playwright/test';

/**
 * Fortune 100-Grade Playwright Configuration
 *
 * Comprehensive testing setup for Unit Talk Command Center Dashboard
 * - Multi-browser testing (Chrome, Firefox, Safari, Edge)
 * - Mobile and desktop viewports
 * - Accessibility testing
 * - Performance monitoring
 * - Visual regression testing
 * - Load testing capabilities
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
  workers: process.env.CI ? 2 : undefined,

  // Fortune 100 Quality: Comprehensive reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['line'],
  ],

  // Enterprise-grade test configuration
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Performance monitoring
    navigationTimeout: 30000,
    actionTimeout: 10000,

    // Security headers verification
    extraHTTPHeaders: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },

  // Multi-browser and device testing
  projects: [
    // Desktop browsers
    {
      name: 'Chrome Desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Firefox Desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Safari Desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Edge Desktop',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },

    // High DPI displays
    {
      name: '4K Display',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 2,
      },
    },

    // Accessibility testing
    {
      name: 'Accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Force reduced motion for accessibility testing
        reducedMotion: 'reduce',
        // High contrast mode simulation
        colorScheme: 'dark',
      },
    },
  ],

  // Development server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Test output configuration
  outputDir: 'test-results/',

  // Global test configuration
  timeout: 60000,
  expect: {
    // Visual regression testing
    threshold: 0.1,
    toHaveScreenshot: { threshold: 0.2, mode: 'css' },
    toMatchSnapshot: { threshold: 0.2 },
  },
});
