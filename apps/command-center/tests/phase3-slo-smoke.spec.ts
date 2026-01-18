/**
 * Phase 3 SLO Dashboard - SMOKE TEST SUITE
 *
 * REQUIREMENTS:
 * - 100% passing - this is the proof gate
 * - Verifies both datasources connected (local_postgres=true AND supabase=true)
 * - Verifies 6 SLO rows render
 * - Verifies "Run Evaluation" triggers POST /api/alerts/run
 * - Verifies alerts are persisted and returned
 * - Captures screenshots on success
 *
 * EXECUTION TIME: <60s
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3015';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('Phase 3: SLO Dashboard - SMOKE SUITE', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to SLO dashboard
    await page.goto(`${BASE_URL}/dashboard/slo`);
  });

  test('SMOKE 1: GET /api/slo/status returns HTTP 200 with both datasources connected', async ({
    page,
    request,
  }) => {
    // Call the API endpoint directly
    const response = await request.get(`${BASE_URL}/api/slo/status`);

    // Verify HTTP 200
    expect(response.status()).toBe(200);

    // Parse response
    const data = await response.json();

    // Verify schema structure
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('overall_status');
    expect(data).toHaveProperty('slos');
    expect(data).toHaveProperty('data_sources');

    // CRITICAL: Both datasources must be connected
    expect(data.data_sources.local_postgres).toBe(true);
    expect(data.data_sources.supabase).toBe(true);

    // Verify 6 SLOs
    expect(data.slos.length).toBe(6);

    // Log proof
    console.log('✅ SMOKE 1 PASSED: Both datasources connected');
    console.log('  Local Postgres:', data.data_sources.local_postgres);
    console.log('  Supabase:', data.data_sources.supabase);
    console.log('  SLO Count:', data.slos.length);
  });

  test('SMOKE 2: /dashboard/slo page loads and renders correctly', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify page title
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('SLO & Alerts Dashboard');

    // Verify Run Evaluation button exists
    const runEvalButton = page.getByTestId('run-evaluation-button');
    await expect(runEvalButton).toBeVisible();
    await expect(runEvalButton).toBeEnabled();

    // Verify Refresh button exists
    const refreshButton = page.getByTestId('refresh-button');
    await expect(refreshButton).toBeVisible();

    // Capture screenshot on success
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'slo-dashboard-loaded.png'),
      fullPage: true,
    });

    console.log('✅ SMOKE 2 PASSED: Dashboard loaded successfully');
  });

  test('SMOKE 3: Data source badges show both connected', async ({ page }) => {
    // Wait for status card to load
    await page.waitForSelector('[data-testid="overall-status-card"]', { timeout: 10000 });

    // Verify Local Postgres badge shows "Connected"
    const localPostgresBadge = page.getByTestId('local-postgres-badge-connected');
    await expect(localPostgresBadge).toBeVisible();
    await expect(localPostgresBadge).toContainText('Connected');

    // Verify Supabase badge shows "Connected"
    const supabaseBadge = page.getByTestId('supabase-badge-connected');
    await expect(supabaseBadge).toBeVisible();
    await expect(supabaseBadge).toContainText('Connected');

    console.log('✅ SMOKE 3 PASSED: Both datasource badges show connected');
  });

  test('SMOKE 4: SLO table renders with 6 rows', async ({ page }) => {
    // Wait for SLO table to load
    await page.waitForSelector('[data-testid="slo-table"]', { timeout: 10000 });

    // Count SLO rows
    const sloRows = page.locator('[data-testid^="slo-row-"]');
    const rowCount = await sloRows.count();

    // Verify we have exactly 6 SLOs
    expect(rowCount).toBe(6);

    // Verify each expected SLO exists
    const expectedSLOs = [
      'ingestion_freshness',
      'publishing_latency',
      'publishing_failures',
      'stuck_pending',
      'retry_exhaustion',
      'grading_backlog',
    ];

    for (const sloName of expectedSLOs) {
      const sloRow = page.getByTestId(`slo-row-${sloName}`);
      await expect(sloRow).toBeVisible();
    }

    console.log('✅ SMOKE 4 PASSED: All 6 SLO rows rendered');
  });

  test('SMOKE 5: "Run Evaluation" button triggers POST /api/alerts/run', async ({ page }) => {
    // Set up network request listener BEFORE clicking button
    const runEvalPromise = page.waitForResponse(
      response =>
        response.url().includes('/api/alerts/run') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 15000 }
    );

    // Click "Run Evaluation" button
    const runEvalButton = page.getByTestId('run-evaluation-button');
    await runEvalButton.click();

    // Wait for API call to complete
    const response = await runEvalPromise;
    const responseData = await response.json();

    // Verify response structure
    expect(responseData).toHaveProperty('success');
    expect(responseData.success).toBe(true);
    expect(responseData).toHaveProperty('alerts_generated');

    console.log('✅ SMOKE 5 PASSED: POST /api/alerts/run triggered successfully');
    console.log('  Alerts Generated:', responseData.alerts_generated);

    // Capture screenshot after evaluation
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'slo-after-run-evaluation.png'),
      fullPage: true,
    });
  });

  test('SMOKE 6: After run evaluation, GET /api/alerts/recent returns >= 1 alert', async ({
    page,
    request,
  }) => {
    // First, trigger alert generation
    const runResponse = await request.post(`${BASE_URL}/api/alerts/run`);
    expect(runResponse.status()).toBe(200);

    const runData = await runResponse.json();
    console.log('  Manual evaluation generated:', runData.alerts_generated, 'alerts');

    // Now fetch recent alerts
    const alertsResponse = await request.get(`${BASE_URL}/api/alerts/recent?limit=20`);
    expect(alertsResponse.status()).toBe(200);

    const alertsData = await alertsResponse.json();

    // Verify we have at least 1 alert
    expect(alertsData).toHaveProperty('alerts');
    expect(Array.isArray(alertsData.alerts)).toBe(true);
    expect(alertsData.alerts.length).toBeGreaterThanOrEqual(1);

    console.log('✅ SMOKE 6 PASSED: Alerts persisted to database');
    console.log('  Recent Alerts Count:', alertsData.alerts.length);

    if (alertsData.alerts.length > 0) {
      const firstAlert = alertsData.alerts[0];
      console.log('  First Alert:');
      console.log('    - SLO:', firstAlert.slo_name);
      console.log('    - Severity:', firstAlert.severity);
      console.log('    - Title:', firstAlert.title);
    }
  });

  test('SMOKE 7: Recent alerts table updates after run evaluation', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="recent-alerts-card"]', { timeout: 10000 });

    // Click "Run Evaluation" button
    const runEvalButton = page.getByTestId('run-evaluation-button');

    // Wait for both the POST and subsequent GET requests
    const runEvalPromise = page.waitForResponse(
      response =>
        response.url().includes('/api/alerts/run') && response.status() === 200
    );

    const alertsRefreshPromise = page.waitForResponse(
      response =>
        response.url().includes('/api/alerts/recent') && response.status() === 200
    );

    await runEvalButton.click();

    // Wait for both requests to complete
    await runEvalPromise;
    await alertsRefreshPromise;

    // Wait a bit for UI to update
    await page.waitForTimeout(1000);

    // Check if alerts table has rows OR no-alerts message
    const alertRows = page.locator('[data-testid^="alert-row-"]');
    const noAlertsMessage = page.getByTestId('no-alerts-message');

    const alertRowCount = await alertRows.count();
    const hasNoAlertsMessage = await noAlertsMessage.isVisible();

    // Either we have alert rows OR the no-alerts message (both are valid)
    if (alertRowCount > 0) {
      console.log('✅ SMOKE 7 PASSED: Alert rows displayed in UI');
      console.log('  Alert Rows Count:', alertRowCount);
    } else if (hasNoAlertsMessage) {
      console.log('✅ SMOKE 7 PASSED: No alerts message displayed (valid state)');
    } else {
      throw new Error('Neither alert rows nor no-alerts message found');
    }
  });
});
