/**
 * Flow 3: Daily Recap Workflow Validation
 *
 * Validates the Daily Recap workflow in staging:
 * 1. Verify DailyRecapWorkflow has run for test date
 * 2. Check recap_date is correct
 * 3. Verify total_picks > 0
 * 4. Verify CLV buckets are populated
 * 5. Test API endpoint for recap data
 * 6. Verify UI displays recap correctly
 *
 * Target: Staging environment with seeded test data
 */

import { test, expect } from '@playwright/test';
import { DatabaseHelper, TemporalHelper } from './utils/test-helpers';

test.describe('Flow 3: Daily Recap Workflow Validation', () => {
  let dbHelper: DatabaseHelper;
  let temporalHelper: TemporalHelper;
  const testRecapDate = new Date().toISOString().split('T')[0]; // Today

  test.beforeAll(() => {
    const supabaseUrl = process.env.E2E_SUPABASE_URL!;
    const supabaseKey = process.env.E2E_SUPABASE_KEY!;
    const temporalUrl = process.env.E2E_TEMPORAL_URL || 'http://localhost:7233';

    dbHelper = new DatabaseHelper(supabaseUrl, supabaseKey);
    temporalHelper = new TemporalHelper(temporalUrl);
  });

  test('validates daily recap workflow execution', async ({ request }) => {
    test.setTimeout(180000); // 3 minutes

    console.log('📊 Starting Flow 3: Daily Recap Workflow Validation');
    console.log(`Testing for recap date: ${testRecapDate}`);

    // Step 1: Check if DailyRecapWorkflow has run
    console.log('📋 Step 1: Checking DailyRecapWorkflow execution');

    const workflowId = `daily-recap-${testRecapDate}`;
    const workflowStatus = await temporalHelper.getWorkflowStatus(workflowId);

    if (!workflowStatus) {
      console.log('ℹ️  No workflow found - may need to trigger manually for test date');
      console.log('Attempting to trigger workflow via API...');

      // Trigger workflow for test date
      const triggerResponse = await request.post('/api/workflows/daily-recap/trigger', {
        data: {
          recap_date: testRecapDate,
        },
      });

      expect(triggerResponse.ok()).toBe(true);
      console.log('✅ Workflow triggered');

      // Wait for workflow to complete
      const completed = await temporalHelper.waitForWorkflowCompletion(
        workflowId,
        120000
      );
      expect(completed).toBe(true);
      console.log('✅ Workflow completed');
    } else {
      console.log(`✅ Workflow found with status: ${workflowStatus.status}`);
      expect(workflowStatus.status).toBe('COMPLETED');
    }

    // Step 2: Retrieve recap from database
    console.log('📋 Step 2: Retrieving recap from database');

    const recap = await dbHelper.getDailyRecap(testRecapDate);
    expect(recap).toBeTruthy();
    console.log('✅ Recap record found in database');

    // Step 3: Verify recap_date is correct
    console.log('📋 Step 3: Verifying recap_date');
    expect(recap.recap_date).toBe(testRecapDate);
    console.log(`✅ Recap date correct: ${recap.recap_date}`);

    // Step 4: Verify total_picks > 0
    console.log('📋 Step 4: Verifying total_picks count');
    expect(recap.total_picks).toBeGreaterThan(0);
    console.log(`✅ Total picks: ${recap.total_picks}`);

    // Step 5: Verify wins and losses are populated
    console.log('📋 Step 5: Verifying win/loss counts');
    expect(recap.total_wins).toBeGreaterThanOrEqual(0);
    expect(recap.total_losses).toBeGreaterThanOrEqual(0);
    expect(recap.total_pushes).toBeGreaterThanOrEqual(0);
    console.log(`✅ W/L/P: ${recap.total_wins}/${recap.total_losses}/${recap.total_pushes}`);

    // Step 6: Verify CLV buckets are populated
    console.log('📋 Step 6: Verifying CLV buckets');
    expect(recap.clv_buckets).toBeTruthy();
    expect(typeof recap.clv_buckets).toBe('object');

    const clvBuckets = recap.clv_buckets;
    const expectedBuckets = ['negative', 'small_positive', 'medium_positive', 'large_positive'];

    for (const bucket of expectedBuckets) {
      expect(clvBuckets).toHaveProperty(bucket);
      expect(typeof clvBuckets[bucket]).toBe('number');
    }

    console.log('✅ CLV buckets populated:', JSON.stringify(clvBuckets, null, 2));

    // Step 7: Verify tier breakdown
    console.log('📋 Step 7: Verifying tier breakdown');
    expect(recap.tier_breakdown).toBeTruthy();
    expect(typeof recap.tier_breakdown).toBe('object');

    const tierBreakdown = recap.tier_breakdown;
    console.log('✅ Tier breakdown:', JSON.stringify(tierBreakdown, null, 2));

    // Step 8: Verify ROI calculation
    console.log('📋 Step 8: Verifying ROI calculation');
    expect(recap.roi).toBeDefined();
    expect(typeof recap.roi).toBe('number');
    console.log(`✅ ROI: ${(recap.roi * 100).toFixed(2)}%`);

    // Step 9: Test API endpoint
    console.log('📋 Step 9: Testing API endpoint');

    const apiResponse = await request.get(`/api/recaps/${testRecapDate}`);
    expect(apiResponse.ok()).toBe(true);

    const apiRecap = await apiResponse.json();
    expect(apiRecap.recap_date).toBe(testRecapDate);
    expect(apiRecap.total_picks).toBe(recap.total_picks);
    console.log('✅ API endpoint returns correct data');

    // Step 10: Verify professional features in recap
    console.log('📋 Step 10: Verifying professional feature metrics');

    if (recap.professional_metrics) {
      expect(recap.professional_metrics).toHaveProperty('steam_moves_detected');
      expect(recap.professional_metrics).toHaveProperty('clv_positive_rate');
      expect(recap.professional_metrics).toHaveProperty('optimal_timing_rate');
      console.log('✅ Professional metrics present:', JSON.stringify(recap.professional_metrics, null, 2));
    } else {
      console.log('ℹ️  Professional metrics not available for this recap');
    }

    console.log('🎉 Flow 3 validation completed successfully!');
  });

  test('recap UI displays correctly', async ({ page }) => {
    console.log('🖼️  Testing recap UI display');

    // Navigate to recaps page
    await page.goto(`/recaps/${testRecapDate}`);
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Daily Recap');
    console.log('✅ Recap page loaded');

    // Verify date is displayed
    await expect(page.locator('[data-testid="recap-date"]')).toContainText(testRecapDate);
    console.log('✅ Recap date displayed');

    // Verify summary stats are visible
    const statsToCheck = [
      'total-picks',
      'total-wins',
      'total-losses',
      'win-rate',
      'roi',
    ];

    for (const stat of statsToCheck) {
      const statElement = page.locator(`[data-testid="${stat}"]`);
      await expect(statElement).toBeVisible();
      console.log(`✅ Stat displayed: ${stat}`);
    }

    // Verify CLV distribution chart is present
    await expect(page.locator('[data-testid="clv-distribution-chart"]')).toBeVisible();
    console.log('✅ CLV distribution chart visible');

    // Verify tier breakdown chart is present
    await expect(page.locator('[data-testid="tier-breakdown-chart"]')).toBeVisible();
    console.log('✅ Tier breakdown chart visible');

    // Verify picks table is present
    await expect(page.locator('[data-testid="recap-picks-table"]')).toBeVisible();
    console.log('✅ Recap picks table visible');

    console.log('✅ Recap UI validation complete');
  });

  test('historical recaps can be navigated', async ({ page }) => {
    console.log('📅 Testing historical recap navigation');

    await page.goto('/recaps');
    await page.waitForLoadState('networkidle');

    // Verify recaps list is displayed
    await expect(page.locator('[data-testid="recaps-list"]')).toBeVisible();
    console.log('✅ Recaps list displayed');

    // Check for date picker
    await expect(page.locator('[data-testid="date-picker"]')).toBeVisible();
    console.log('✅ Date picker available');

    // Try navigating to previous day
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    await page.fill('[data-testid="date-picker"]', yesterdayStr);
    await page.click('[data-testid="load-recap-button"]');
    await page.waitForLoadState('networkidle');

    // Should either show recap or "no data" message
    const noDataMessage = page.locator('[data-testid="no-data-message"]');
    const recapContent = page.locator('[data-testid="recap-content"]');

    const hasNoData = await noDataMessage.isVisible().catch(() => false);
    const hasRecap = await recapContent.isVisible().catch(() => false);

    expect(hasNoData || hasRecap).toBe(true);
    console.log('✅ Historical navigation works');
  });

  test('recap export functionality works', async ({ page, request }) => {
    console.log('💾 Testing recap export');

    await page.goto(`/recaps/${testRecapDate}`);
    await page.waitForLoadState('networkidle');

    // Check for export button
    const exportButton = page.locator('[data-testid="export-recap-button"]');
    await expect(exportButton).toBeVisible();

    // Test API export endpoint
    const exportResponse = await request.get(
      `/api/recaps/${testRecapDate}/export?format=json`
    );
    expect(exportResponse.ok()).toBe(true);

    const exportData = await exportResponse.json();
    expect(exportData.recap_date).toBe(testRecapDate);
    expect(exportData.picks).toBeDefined();
    expect(Array.isArray(exportData.picks)).toBe(true);

    console.log(`✅ Export contains ${exportData.picks.length} picks`);
    console.log('✅ Recap export functional');
  });

  test('recap workflow can be manually triggered', async ({ request }) => {
    console.log('🔄 Testing manual recap workflow trigger');

    // Trigger workflow for a specific date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 2); // 2 days ago
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const triggerResponse = await request.post('/api/workflows/daily-recap/trigger', {
      data: {
        recap_date: targetDateStr,
        force_regenerate: true,
      },
    });

    expect(triggerResponse.ok()).toBe(true);

    const triggerResult = await triggerResponse.json();
    expect(triggerResult.workflow_id).toBeTruthy();
    expect(triggerResult.status).toMatch(/triggered|running/);

    console.log(`✅ Workflow triggered: ${triggerResult.workflow_id}`);

    // Wait for completion
    const completed = await temporalHelper.waitForWorkflowCompletion(
      triggerResult.workflow_id,
      120000
    );

    expect(completed).toBe(true);
    console.log('✅ Manual trigger successful');
  });
});
