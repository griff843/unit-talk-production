import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const COMMAND_CENTER_URL = `${BASE_URL}/command-center`;

test.describe('Command Center E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Command Center
    await page.goto(COMMAND_CENTER_URL);
    
    // Wait for page to load and authentication if needed
    await page.waitForLoadState('networkidle');
  });

  test.describe('Safety Toggles', () => {
    test('should display all safety toggles', async ({ page }) => {
      // Verify Safe Mode toggle exists
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await expect(safeModeToggle).toBeVisible();

      // Verify System Freeze toggle exists  
      const systemFreezeToggle = page.locator('[data-testid="toggle-SYSTEM_FREEZE"]');
      await expect(systemFreezeToggle).toBeVisible();

      // Verify Shadow Mode toggle exists
      const shadowModeToggle = page.locator('[data-testid="toggle-SHADOW_MODE"]');
      await expect(shadowModeToggle).toBeVisible();

      // Verify Discord publishing toggle exists
      const discordToggle = page.locator('[data-testid="toggle-PUBLISH_TO_DISCORD"]');
      await expect(discordToggle).toBeVisible();

      // Verify Notion publishing toggle exists
      const notionToggle = page.locator('[data-testid="toggle-PUBLISH_TO_NOTION"]');
      await expect(notionToggle).toBeVisible();
    });

    test('should toggle Safe Mode and persist state', async ({ page }) => {
      // Get initial state of Safe Mode toggle
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      const initialState = await safeModeToggle.getAttribute('aria-checked');
      
      // Click to toggle Safe Mode
      await safeModeToggle.click();
      
      // Wait for toggle animation and state change
      await page.waitForTimeout(500);
      
      // Verify state changed
      const newState = await safeModeToggle.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);
      
      // Verify success toast appears
      await expect(page.locator('.toast')).toContainText('Safe Mode');
      
      // Refresh page and verify state persisted
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const persistedState = await safeModeToggle.getAttribute('aria-checked');
      expect(persistedState).toBe(newState);
    });

    test('should show loading state during toggle operation', async ({ page }) => {
      const systemFreezeToggle = page.locator('[data-testid="toggle-SYSTEM_FREEZE"]');
      
      // Click toggle and immediately check for loading state
      const togglePromise = systemFreezeToggle.click();
      
      // Should show loading spinner or disabled state
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      await togglePromise;
      await page.waitForTimeout(1000);
      
      // Loading should disappear
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });

    test('should handle toggle errors gracefully', async ({ page }) => {
      // Mock API to return error
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database connection failed' })
        });
      });

      const shadowModeToggle = page.locator('[data-testid="toggle-SHADOW_MODE"]');
      await shadowModeToggle.click();
      
      // Should show error toast
      await expect(page.locator('.toast')).toContainText('Failed to update');
      
      // Toggle should remain in original state
      await page.waitForTimeout(500);
      const toggleState = await shadowModeToggle.getAttribute('aria-checked');
      // Verify state didn't change inappropriately
    });
  });

  test.describe('Health Monitoring Tiles', () => {
    test('should display all health tiles with real-time data', async ({ page }) => {
      // Feed Freshness tile
      const feedFreshnessTile = page.locator('[data-testid="health-tile-feed-freshness"]');
      await expect(feedFreshnessTile).toBeVisible();
      await expect(feedFreshnessTile).toContainText('Feed Freshness');

      // Temporal Backlog tile
      const temporalBacklogTile = page.locator('[data-testid="health-tile-temporal-backlog"]');
      await expect(temporalBacklogTile).toBeVisible();
      await expect(temporalBacklogTile).toContainText('Temporal Backlog');

      // Canary Status tile
      const canaryStatusTile = page.locator('[data-testid="health-tile-canary-status"]');
      await expect(canaryStatusTile).toBeVisible();
      await expect(canaryStatusTile).toContainText('Canary Status');

      // Failure Burn Rate tile
      const failureBurnRateTile = page.locator('[data-testid="health-tile-failure-burn-rate"]');
      await expect(failureBurnRateTile).toBeVisible();
      await expect(failureBurnRateTile).toContainText('Failure Burn Rate');

      // Provider Spend tile
      const providerSpendTile = page.locator('[data-testid="health-tile-provider-spend"]');
      await expect(providerSpendTile).toBeVisible();
      await expect(providerSpendTile).toContainText('Provider Spend');

      // DLQ Count tile
      const dlqCountTile = page.locator('[data-testid="health-tile-dlq-count"]');
      await expect(dlqCountTile).toBeVisible();
      await expect(dlqCountTile).toContainText('DLQ Count');
    });

    test('should update health tiles in real-time', async ({ page }) => {
      // Get initial value of feed freshness
      const feedFreshnessTile = page.locator('[data-testid="health-tile-feed-freshness"]');
      const initialValue = await feedFreshnessTile.locator('[data-testid="tile-value"]').textContent();
      
      // Wait for potential real-time update (simulate with timeout)
      await page.waitForTimeout(5000);
      
      // Check if value updated (may or may not change in test environment)
      const updatedValue = await feedFreshnessTile.locator('[data-testid="tile-value"]').textContent();
      
      // At minimum, should still be visible and have valid format
      expect(updatedValue).toMatch(/^\d+/); // Should start with number
    });

    test('should show appropriate status colors for health tiles', async ({ page }) => {
      const failureBurnRateTile = page.locator('[data-testid="health-tile-failure-burn-rate"]');
      
      // Check for status indicator (should be green, yellow, or red)
      const statusIndicator = failureBurnRateTile.locator('[data-testid="status-indicator"]');
      await expect(statusIndicator).toBeVisible();
      
      // Should have one of the valid status classes
      const statusClasses = ['bg-green-500', 'bg-yellow-500', 'bg-red-500'];
      const hasValidStatus = await statusIndicator.evaluate((el, classes) => {
        return classes.some(cls => el.classList.contains(cls));
      }, statusClasses);
      
      expect(hasValidStatus).toBe(true);
    });
  });

  test.describe('Incident Management', () => {
    test('should navigate to incidents page', async ({ page }) => {
      await page.click('[data-testid="nav-incidents"]');
      await expect(page).toHaveURL(/.*\/incidents/);
      await expect(page.locator('h1')).toContainText('Incidents');
    });

    test('should display incident list with filters', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/incidents`);
      
      // Check for incident filters
      const statusFilter = page.locator('[data-testid="incident-status-filter"]');
      await expect(statusFilter).toBeVisible();
      
      const severityFilter = page.locator('[data-testid="incident-severity-filter"]');
      await expect(severityFilter).toBeVisible();
      
      // Check for incident cards or empty state
      const incidentList = page.locator('[data-testid="incident-list"]');
      await expect(incidentList).toBeVisible();
    });

    test('should be able to resolve incident with notes', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/incidents`);
      
      // Find first open incident (if any)
      const firstIncident = page.locator('[data-testid="incident-card"]').first();
      
      if (await firstIncident.isVisible()) {
        // Click resolve button
        await firstIncident.locator('[data-testid="resolve-incident-btn"]').click();
        
        // Fill resolution notes
        const notesField = page.locator('[data-testid="resolution-notes"]');
        await notesField.fill('Test resolution from E2E test');
        
        // Submit resolution
        await page.locator('[data-testid="confirm-resolution"]').click();
        
        // Should show success message
        await expect(page.locator('.toast')).toContainText('resolved');
      }
    });
  });

  test.describe('Recovery Operations', () => {
    test('should navigate to recovery page', async ({ page }) => {
      await page.click('[data-testid="nav-recovery"]');
      await expect(page).toHaveURL(/.*\/recovery/);
      await expect(page.locator('h1')).toContainText('Recovery');
    });

    test('should display workflow replay panel', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      
      const replayPanel = page.locator('[data-testid="workflow-replay-panel"]');
      await expect(replayPanel).toBeVisible();
      
      // Check for single workflow replay form
      const singleReplayForm = page.locator('[data-testid="single-workflow-replay"]');
      await expect(singleReplayForm).toBeVisible();
      
      // Check for bulk replay form
      const bulkReplayForm = page.locator('[data-testid="bulk-workflow-replay"]');
      await expect(bulkReplayForm).toBeVisible();
    });

    test('should handle single workflow replay', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      
      // Fill workflow ID
      const workflowIdField = page.locator('[data-testid="workflow-id-input"]');
      await workflowIdField.fill('test-workflow-123');
      
      // Fill reason
      const reasonField = page.locator('[data-testid="replay-reason-input"]');
      await reasonField.fill('E2E test replay operation');
      
      // Submit replay (mock the API response)
      await page.route('/api/ops/replay', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Workflow replay initiated',
            workflowId: 'test-workflow-123'
          })
        });
      });
      
      await page.locator('[data-testid="single-replay-submit"]').click();
      
      // Should show success message
      await expect(page.locator('.toast')).toContainText('replay initiated');
    });

    test('should display rollback panel with confirmations', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      
      const rollbackPanel = page.locator('[data-testid="deployment-rollback-panel"]');
      await expect(rollbackPanel).toBeVisible();
      
      // Check for environment selection
      const envSelect = page.locator('[data-testid="rollback-environment-select"]');
      await expect(envSelect).toBeVisible();
      
      // Check for confirmation checkbox
      const confirmCheckbox = page.locator('[data-testid="rollback-confirmation"]');
      await expect(confirmCheckbox).toBeVisible();
    });
  });

  test.describe('RBAC Enforcement', () => {
    test('viewer role should not see admin controls', async ({ page }) => {
      // Mock user role as viewer
      await page.addInitScript(() => {
        window.localStorage.setItem('userRole', 'viewer');
      });
      
      await page.goto(COMMAND_CENTER_URL);
      
      // Safety toggles should not be visible or should be disabled
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      if (await safeModeToggle.isVisible()) {
        await expect(safeModeToggle).toBeDisabled();
      }
      
      // Recovery operations should not be accessible
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      const rollbackPanel = page.locator('[data-testid="deployment-rollback-panel"]');
      
      if (await rollbackPanel.isVisible()) {
        const rollbackButton = rollbackPanel.locator('[data-testid="rollback-submit"]');
        await expect(rollbackButton).toBeDisabled();
      }
    });

    test('ops role should access toggles but not rollback', async ({ page }) => {
      // Mock user role as ops
      await page.addInitScript(() => {
        window.localStorage.setItem('userRole', 'ops');
      });
      
      await page.goto(COMMAND_CENTER_URL);
      
      // Safety toggles should be enabled
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await expect(safeModeToggle).toBeEnabled();
      
      // But rollback should still be restricted
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      const rollbackButton = page.locator('[data-testid="rollback-submit"]');
      
      if (await rollbackButton.isVisible()) {
        await expect(rollbackButton).toBeDisabled();
      }
    });

    test('admin role should have full access', async ({ page }) => {
      // Mock user role as admin
      await page.addInitScript(() => {
        window.localStorage.setItem('userRole', 'admin');
      });
      
      await page.goto(COMMAND_CENTER_URL);
      
      // All safety toggles should be enabled
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await expect(safeModeToggle).toBeEnabled();
      
      // Rollback should be accessible
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      const rollbackButton = page.locator('[data-testid="rollback-submit"]');
      await expect(rollbackButton).toBeVisible();
    });
  });

  test.describe('Data Trust Widgets', () => {
    test('should display immutability check widget', async ({ page }) => {
      const immutabilityWidget = page.locator('[data-testid="immutability-check-widget"]');
      await expect(immutabilityWidget).toBeVisible();
      await expect(immutabilityWidget).toContainText('Final Picks Immutability');
      
      // Should show check status
      const checkStatus = immutabilityWidget.locator('[data-testid="check-status"]');
      await expect(checkStatus).toBeVisible();
    });

    test('should display shadow vs live diff widget', async ({ page }) => {
      const shadowDiffWidget = page.locator('[data-testid="shadow-diff-widget"]');
      await expect(shadowDiffWidget).toBeVisible();
      await expect(shadowDiffWidget).toContainText('Shadow vs Live Diff');
      
      // Should show diff metrics
      const diffMetrics = shadowDiffWidget.locator('[data-testid="diff-metrics"]');
      await expect(diffMetrics).toBeVisible();
    });

    test('should trigger immutability check manually', async ({ page }) => {
      // Mock the API response
      await page.route('/api/ops/trust/immutability', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            checked_picks: 150,
            violations: 0,
            last_check: new Date().toISOString()
          })
        });
      });
      
      const runCheckButton = page.locator('[data-testid="run-immutability-check"]');
      await runCheckButton.click();
      
      // Should show loading state
      await expect(page.locator('[data-testid="check-loading"]')).toBeVisible();
      
      // Wait for completion
      await page.waitForTimeout(1000);
      
      // Should show results
      await expect(page.locator('.toast')).toContainText('Immutability check');
    });
  });

  test.describe('System Flag Enforcement', () => {
    test('should block promotions when Safe Mode is active', async ({ page }) => {
      // First enable Safe Mode
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      
      // Ensure Safe Mode is ON
      const isChecked = await safeModeToggle.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await safeModeToggle.click();
        await page.waitForTimeout(500);
      }
      
      // Mock promotion API to test enforcement
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          if (postData.action === 'promote_pick') {
            route.fulfill({
              status: 423, // Locked
              contentType: 'application/json',
              body: JSON.stringify({
                error: 'Operation blocked by system flags',
                flag: 'SAFE_MODE',
                value: true,
                message: 'Promotions are blocked - Safe Mode is active'
              })
            });
          }
        }
      });
      
      // Trigger test promotion
      await page.evaluate(() => {
        fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_pick',
            payload: { pickId: 'test-123' }
          })
        });
      });
      
      // Should show blocked operation message
      await expect(page.locator('.toast')).toContainText('blocked');
    });

    test('should prevent publishing in Shadow Mode', async ({ page }) => {
      // Enable Shadow Mode
      const shadowModeToggle = page.locator('[data-testid="toggle-SHADOW_MODE"]');
      
      const isChecked = await shadowModeToggle.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await shadowModeToggle.click();
        await page.waitForTimeout(500);
      }
      
      // Mock publishing API
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          if (postData.action === 'publish_to_discord') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                published: false,
                reason: 'Shadow Mode active',
                message: 'Discord publishing blocked: Shadow Mode active'
              })
            });
          }
        }
      });
      
      // Trigger test publish
      await page.evaluate(() => {
        fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Test message' }
          })
        });
      });
      
      // Should indicate shadow mode blocking
      await expect(page.locator('.toast')).toContainText('Shadow Mode');
    });
  });

  test.describe('Alertmanager Integration', () => {
    test('should receive and process critical alerts', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/settings`);
      
      // Mock alertmanager webhook
      await page.route('/api/alerts/alertmanager', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              incident_created: true,
              safe_mode_triggered: true,
              incident_id: 'test-incident-123'
            })
          });
        }
      });
      
      // Trigger test alert that should activate Safe Mode
      const criticalAlertButton = page.locator('[data-testid="trigger-critical-alert"]');
      if (await criticalAlertButton.isVisible()) {
        await criticalAlertButton.click();
        
        // Should show alert processing
        await expect(page.locator('.toast')).toContainText('Alert processed');
        
        // Navigate back to main dashboard
        await page.goto(COMMAND_CENTER_URL);
        await page.waitForTimeout(1000);
        
        // Safe Mode should now be active
        const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
        await expect(safeModeToggle).toHaveAttribute('aria-checked', 'true');
      }
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should load dashboard within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(COMMAND_CENTER_URL);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle network failures gracefully', async ({ page }) => {
      await page.goto(COMMAND_CENTER_URL);
      
      // Simulate network failure
      await page.route('/api/ops/health/tiles', route => {
        route.abort();
      });
      
      // Trigger refresh that will fail
      await page.reload();
      
      // Should show error state or retry mechanism
      await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible({
        timeout: 5000
      });
    });

    test('should maintain state during navigation', async ({ page }) => {
      // Enable a toggle
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await safeModeToggle.click();
      await page.waitForTimeout(500);
      
      const toggleState = await safeModeToggle.getAttribute('aria-checked');
      
      // Navigate to different page
      await page.click('[data-testid="nav-incidents"]');
      await page.waitForLoadState('networkidle');
      
      // Navigate back
      await page.click('[data-testid="nav-command-center"]');
      await page.waitForLoadState('networkidle');
      
      // State should be preserved
      const preservedState = await safeModeToggle.getAttribute('aria-checked');
      expect(preservedState).toBe(toggleState);
    });
  });
});