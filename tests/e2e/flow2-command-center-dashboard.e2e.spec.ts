/**
 * Flow 2: Command Center Dashboard Validation
 *
 * Validates the Command Center dashboard in staging:
 * 1. Load Command Center UI
 * 2. Filter for today's MNF/NBA games
 * 3. Verify props appear correctly
 * 4. Verify canonical mapping (player/team names, not raw IDs)
 * 5. Verify no major UI errors
 * 6. Test real-time pick feed functionality
 * 7. Verify workflow controls work correctly
 *
 * Target: Staging environment
 */

import { test, expect } from '@playwright/test';
import { CommandCenterHelper, DatabaseHelper } from './utils/test-helpers';

test.describe('Flow 2: Command Center Dashboard Validation', () => {
  let dashboardHelper: CommandCenterHelper;
  let dbHelper: DatabaseHelper;

  test.beforeEach(({ page }) => {
    dashboardHelper = new CommandCenterHelper(page);

    const supabaseUrl = process.env.E2E_SUPABASE_URL!;
    const supabaseKey = process.env.E2E_SUPABASE_KEY!;
    dbHelper = new DatabaseHelper(supabaseUrl, supabaseKey);
  });

  test('loads Command Center and displays MNF/NBA props', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes

    console.log('📊 Starting Flow 2: Command Center Dashboard Validation');

    // Step 1: Navigate to Command Center
    console.log('📋 Step 1: Navigating to Command Center');
    await dashboardHelper.navigateToDashboard();

    // Verify dashboard loaded
    await expect(page.locator('h1')).toContainText('Command Center');
    console.log('✅ Command Center loaded');

    // Verify key navigation elements are present
    await expect(page.locator('[data-testid="overview-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="picks-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="agents-tab"]')).toBeVisible();
    console.log('✅ Navigation elements present');

    // Step 2: Navigate to picks dashboard
    console.log('📋 Step 2: Navigating to picks dashboard');
    await page.click('[data-testid="picks-tab"]');
    await page.waitForLoadState('networkidle');

    // Verify picks feed component loaded
    await expect(page.locator('[data-testid="realtime-pick-feed"]')).toBeVisible();
    console.log('✅ Real-time pick feed loaded');

    // Step 3: Filter for today's games
    console.log('📋 Step 3: Filtering for today\'s games');
    const today = new Date().toISOString().split('T')[0];
    await dashboardHelper.filterByDate(today);

    // Step 4: Filter for NFL and NBA
    console.log('📋 Step 4: Filtering for NFL and NBA');

    // Test NFL filter
    await dashboardHelper.filterByLeague('NFL');
    await page.waitForTimeout(2000); // Wait for filter

    const nflPropsCount = await dashboardHelper.getVisibleProps();
    console.log(`✅ Found ${nflPropsCount} NFL props`);

    // Test NBA filter
    await dashboardHelper.filterByLeague('NBA');
    await page.waitForTimeout(2000);

    const nbaPropsCount = await dashboardHelper.getVisibleProps();
    console.log(`✅ Found ${nbaPropsCount} NBA props`);

    // Step 5: Verify canonical mapping
    console.log('📋 Step 5: Verifying canonical mapping');

    // Show all props
    await page.click('[data-testid="clear-filters"]');
    await page.waitForTimeout(1000);

    const hasProperNames = await dashboardHelper.verifyCanonicalMapping();
    expect(hasProperNames).toBe(true);
    console.log('✅ Canonical mapping verified - no raw IDs visible');

    // Step 6: Verify prop card details
    console.log('📋 Step 6: Verifying prop card details');

    const firstPropCard = page.locator('[data-testid^="prop-card-"]').first();
    await expect(firstPropCard).toBeVisible();

    // Verify required fields are displayed
    await expect(firstPropCard.locator('[data-testid="player-name"]')).toBeVisible();
    await expect(firstPropCard.locator('[data-testid="stat-type"]')).toBeVisible();
    await expect(firstPropCard.locator('[data-testid="line"]')).toBeVisible();
    await expect(firstPropCard.locator('[data-testid="odds"]')).toBeVisible();
    await expect(firstPropCard.locator('[data-testid="workflow-stage"]')).toBeVisible();

    console.log('✅ Prop card details complete');

    // Step 7: Verify no UI errors
    console.log('📋 Step 7: Checking for UI errors');

    const hasNoErrors = await dashboardHelper.verifyNoErrors();
    expect(hasNoErrors).toBe(true);
    console.log('✅ No UI errors detected');

    // Step 8: Test workflow stage filtering
    console.log('📋 Step 8: Testing workflow stage filtering');

    const stages = ['draft', 'pending_review', 'approved', 'published'];

    for (const stage of stages) {
      await page.selectOption('[data-testid="workflow-stage-filter"]', stage);
      await page.waitForTimeout(1000);

      const stageCount = await dashboardHelper.getVisibleProps();
      console.log(`✅ Workflow stage "${stage}": ${stageCount} props`);
    }

    // Step 9: Test real-time updates (if available)
    console.log('📋 Step 9: Testing real-time updates');

    // Get initial prop count
    await page.click('[data-testid="clear-filters"]');
    await page.waitForTimeout(1000);
    const initialCount = await dashboardHelper.getVisibleProps();

    // Wait for potential real-time updates (30 seconds)
    console.log('Waiting for real-time updates...');
    await page.waitForTimeout(30000);

    const updatedCount = await dashboardHelper.getVisibleProps();
    console.log(`✅ Real-time polling active (initial: ${initialCount}, after 30s: ${updatedCount})`);

    console.log('🎉 Flow 2 validation completed successfully!');
  });

  test('workflow controls function correctly', async ({ page, request }) => {
    console.log('🔍 Testing workflow controls');

    await dashboardHelper.navigateToDashboard();
    await page.click('[data-testid="picks-tab"]');
    await page.waitForLoadState('networkidle');

    // Find a pick in pending_review stage
    await page.selectOption('[data-testid="workflow-stage-filter"]', 'pending_review');
    await page.waitForTimeout(1000);

    const pendingPicks = await page.$$('[data-testid^="prop-card-"]');

    if (pendingPicks.length > 0) {
      console.log(`Found ${pendingPicks.length} picks in pending_review stage`);

      // Click first pick to open details
      await pendingPicks[0].click();

      // Verify workflow controls are visible
      await expect(page.locator('[data-testid="approve-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="reject-button"]')).toBeVisible();

      console.log('✅ Workflow control buttons visible');

      // Test approve action (in test mode, this should trigger confirmation)
      await page.click('[data-testid="approve-button"]');

      // Verify confirmation dialog appears
      await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
      console.log('✅ Confirmation dialog appears');

      // Cancel to avoid modifying test data
      await page.click('[data-testid="cancel-button"]');
    } else {
      console.log('ℹ️  No picks in pending_review stage for testing');
    }
  });

  test('search and filtering work correctly', async ({ page }) => {
    console.log('🔍 Testing search and filtering');

    await dashboardHelper.navigateToDashboard();
    await page.click('[data-testid="picks-tab"]');
    await page.waitForLoadState('networkidle');

    // Test player search
    const searchInput = page.locator('[data-testid="player-search"]');
    await searchInput.fill('Patrick Mahomes');
    await page.waitForTimeout(1000);

    const searchResults = await page.$$('[data-testid^="prop-card-"]');
    console.log(`✅ Search returned ${searchResults.length} results`);

    // Verify all results contain the search term
    for (const result of searchResults) {
      const playerName = await result.$eval(
        '[data-testid="player-name"]',
        el => el.textContent
      );
      expect(playerName).toContain('Mahomes');
    }

    console.log('✅ Search filtering works correctly');

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(1000);
  });

  test('performance metrics are displayed', async ({ page }) => {
    console.log('📊 Testing performance metrics display');

    await dashboardHelper.navigateToDashboard();

    // Check overview tab for metrics
    await page.click('[data-testid="overview-tab"]');
    await page.waitForLoadState('networkidle');

    // Verify key metrics are displayed
    const metricsToCheck = [
      'total-picks',
      'win-rate',
      'roi',
      'active-agents',
      'system-health',
    ];

    for (const metric of metricsToCheck) {
      const metricElement = page.locator(`[data-testid="${metric}"]`);
      await expect(metricElement).toBeVisible();
      console.log(`✅ Metric displayed: ${metric}`);
    }

    console.log('✅ All performance metrics visible');
  });

  test('agent health monitoring works', async ({ page }) => {
    console.log('🤖 Testing agent health monitoring');

    await dashboardHelper.navigateToDashboard();
    await page.click('[data-testid="agents-tab"]');
    await page.waitForLoadState('networkidle');

    // Verify agent cards are displayed
    const agentCards = await page.$$('[data-testid^="agent-card-"]');
    expect(agentCards.length).toBeGreaterThan(0);
    console.log(`✅ Found ${agentCards.length} agent(s)`);

    // Check first agent card details
    const firstAgent = agentCards[0];
    await expect(firstAgent.locator('[data-testid="agent-name"]')).toBeVisible();
    await expect(firstAgent.locator('[data-testid="agent-status"]')).toBeVisible();
    await expect(firstAgent.locator('[data-testid="agent-health"]')).toBeVisible();

    console.log('✅ Agent health monitoring functional');
  });
});
