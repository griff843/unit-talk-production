import { test, expect } from '@playwright/test';

// RBAC-specific E2E tests for Command Center
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const COMMAND_CENTER_URL = `${BASE_URL}/command-center`;

test.describe('RBAC Enforcement E2E Tests', () => {
  
  test.describe('Admin Role Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Mock admin user authentication
      await page.addInitScript(() => {
        // Mock Supabase auth state for admin user
        window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
          user: {
            id: 'admin-user-123',
            email: 'admin@unittalk.com',
            role: 'authenticated',
            user_metadata: { role: 'admin' }
          }
        }));
      });

      // Mock RBAC API responses for admin
      await page.route('/api/ops/**', route => {
        const headers = route.request().headers();
        if (route.request().method() !== 'GET') {
          // Admin should have access to all operations
          route.continue();
        } else {
          route.continue();
        }
      });

      await page.goto(COMMAND_CENTER_URL);
      await page.waitForLoadState('networkidle');
    });

    test('admin can toggle all safety flags', async ({ page }) => {
      // Test Safe Mode toggle
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await expect(safeModeToggle).toBeVisible();
      await expect(safeModeToggle).toBeEnabled();
      
      // Mock successful toggle response
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'SAFE_MODE',
            value: true,
            message: 'Safe Mode updated successfully'
          })
        });
      });

      await safeModeToggle.click();
      await expect(page.locator('.toast')).toContainText('Safe Mode updated');

      // Test System Freeze toggle
      const systemFreezeToggle = page.locator('[data-testid="toggle-SYSTEM_FREEZE"]');
      await expect(systemFreezeToggle).toBeEnabled();

      // Test all publishing toggles
      const discordToggle = page.locator('[data-testid="toggle-PUBLISH_TO_DISCORD"]');
      await expect(discordToggle).toBeEnabled();

      const notionToggle = page.locator('[data-testid="toggle-PUBLISH_TO_NOTION"]');
      await expect(notionToggle).toBeEnabled();
    });

    test('admin can perform deployment rollback', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      
      const rollbackPanel = page.locator('[data-testid="deployment-rollback-panel"]');
      await expect(rollbackPanel).toBeVisible();

      // Fill rollback form
      const environmentSelect = page.locator('[data-testid="rollback-environment-select"]');
      await environmentSelect.selectOption('staging');

      const reasonField = page.locator('[data-testid="rollback-reason-input"]');
      await reasonField.fill('E2E test rollback - admin permissions');

      const confirmCheckbox = page.locator('[data-testid="rollback-confirmation"]');
      await confirmCheckbox.check();

      // Mock successful rollback response
      await page.route('/api/ops/rollback', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Rollback initiated successfully',
            jobId: 'rollback-job-123'
          })
        });
      });

      const rollbackButton = page.locator('[data-testid="rollback-submit"]');
      await expect(rollbackButton).toBeEnabled();
      await rollbackButton.click();

      await expect(page.locator('.toast')).toContainText('Rollback initiated');
    });

    test('admin can resolve incidents', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/incidents`);

      // Mock incidents data
      await page.route('/api/ops/incidents*', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              incidents: [{
                id: 1,
                title: 'Test Critical Alert',
                severity: 'critical',
                status: 'open',
                created_at: new Date().toISOString(),
                description: 'Test incident for RBAC testing'
              }]
            })
          });
        } else {
          route.continue();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const firstIncident = page.locator('[data-testid="incident-card"]').first();
      if (await firstIncident.isVisible()) {
        const resolveButton = firstIncident.locator('[data-testid="resolve-incident-btn"]');
        await expect(resolveButton).toBeEnabled();

        await resolveButton.click();

        const notesField = page.locator('[data-testid="resolution-notes"]');
        await notesField.fill('Admin resolved incident via E2E test');

        // Mock successful resolution
        await page.route('/api/ops/incidents', route => {
          if (route.request().method() === 'POST') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                message: 'Incident resolved successfully'
              })
            });
          }
        });

        const confirmButton = page.locator('[data-testid="confirm-resolution"]');
        await confirmButton.click();

        await expect(page.locator('.toast')).toContainText('resolved');
      }
    });

    test('admin can trigger test alerts', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/settings`);

      // Mock test alert configuration
      await page.route('/api/ops/test/safemode-from-alert', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              test_alerts_enabled: true,
              permissions: { can_trigger_test_alerts: true },
              available_alert_types: [
                { type: 'high_error_rate', description: 'High Error Rate Alert', triggers_safe_mode: true },
                { type: 'database_down', description: 'Database Down Alert', triggers_safe_mode: true }
              ]
            })
          });
        } else if (route.request().method() === 'POST') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Test alert triggered successfully'
            })
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const testAlertButton = page.locator('[data-testid="test-alert-high_error_rate"]');
      if (await testAlertButton.isVisible()) {
        await expect(testAlertButton).toBeEnabled();
        await testAlertButton.click();
        await expect(page.locator('.toast')).toContainText('Test alert triggered');
      }
    });
  });

  test.describe('Ops Role Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Mock ops user authentication
      await page.addInitScript(() => {
        window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
          user: {
            id: 'ops-user-123',
            email: 'ops@unittalk.com',
            role: 'authenticated',
            user_metadata: { role: 'ops' }
          }
        }));
      });

      // Mock RBAC responses for ops role
      await page.route('/api/ops/system-config', route => {
        // Ops can modify system config
        route.continue();
      });

      await page.route('/api/ops/rollback', route => {
        // Ops cannot perform rollbacks
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Insufficient permissions - Admin role required'
          })
        });
      });

      await page.goto(COMMAND_CENTER_URL);
      await page.waitForLoadState('networkidle');
    });

    test('ops can toggle safety flags but not perform rollbacks', async ({ page }) => {
      // Should be able to toggle safety flags
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await expect(safeModeToggle).toBeEnabled();

      // Mock successful toggle
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'SAFE_MODE',
            value: true
          })
        });
      });

      await safeModeToggle.click();
      await expect(page.locator('.toast')).toContainText('Safe Mode');

      // But rollback should be restricted
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      
      const rollbackPanel = page.locator('[data-testid="deployment-rollback-panel"]');
      if (await rollbackPanel.isVisible()) {
        const rollbackButton = page.locator('[data-testid="rollback-submit"]');
        
        // Try to perform rollback
        const environmentSelect = page.locator('[data-testid="rollback-environment-select"]');
        await environmentSelect.selectOption('staging');

        const reasonField = page.locator('[data-testid="rollback-reason-input"]');
        await reasonField.fill('Ops attempting rollback - should fail');

        const confirmCheckbox = page.locator('[data-testid="rollback-confirmation"]');
        await confirmCheckbox.check();

        await rollbackButton.click();

        // Should show permission error
        await expect(page.locator('.toast')).toContainText('Insufficient permissions');
      }
    });

    test('ops can handle incidents but with limited scope', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/incidents`);

      // Mock incidents - ops should see them
      await page.route('/api/ops/incidents*', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              incidents: [{
                id: 1,
                title: 'Medium Priority Alert',
                severity: 'medium',
                status: 'open',
                created_at: new Date().toISOString()
              }]
            })
          });
        } else {
          // Ops can resolve non-critical incidents
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Incident resolved by ops'
            })
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const firstIncident = page.locator('[data-testid="incident-card"]').first();
      if (await firstIncident.isVisible()) {
        const resolveButton = firstIncident.locator('[data-testid="resolve-incident-btn"]');
        await resolveButton.click();

        const notesField = page.locator('[data-testid="resolution-notes"]');
        await notesField.fill('Ops resolved incident');

        const confirmButton = page.locator('[data-testid="confirm-resolution"]');
        await confirmButton.click();

        await expect(page.locator('.toast')).toContainText('resolved');
      }
    });

    test('ops cannot trigger test alerts', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/settings`);

      // Mock restricted test alert access
      await page.route('/api/ops/test/safemode-from-alert', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              test_alerts_enabled: true,
              permissions: { can_trigger_test_alerts: false },
              available_alert_types: []
            })
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should show permission message instead of buttons
      const permissionMessage = page.locator('text=Admin permissions required to trigger test alerts');
      await expect(permissionMessage).toBeVisible();
    });
  });

  test.describe('Viewer Role Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Mock viewer user authentication
      await page.addInitScript(() => {
        window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
          user: {
            id: 'viewer-user-123',
            email: 'viewer@unittalk.com',
            role: 'authenticated',
            user_metadata: { role: 'viewer' }
          }
        }));
      });

      // Mock restrictive RBAC for viewer
      await page.route('/api/ops/system-config', route => {
        if (route.request().method() !== 'GET') {
          route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Insufficient permissions - Ops role required'
            })
          });
        } else {
          route.continue();
        }
      });

      await page.route('/api/ops/rollback', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Insufficient permissions - Admin role required'
          })
        });
      });

      await page.route('/api/ops/incidents', route => {
        if (route.request().method() !== 'GET') {
          route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Insufficient permissions - Ops role required'
            })
          });
        } else {
          route.continue();
        }
      });

      await page.goto(COMMAND_CENTER_URL);
      await page.waitForLoadState('networkidle');
    });

    test('viewer can only view data, not modify anything', async ({ page }) => {
      // Safety toggles should be disabled or not functional
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      
      if (await safeModeToggle.isVisible()) {
        // Either disabled or clicking should show permission error
        await safeModeToggle.click();
        
        // Should show permission error
        await expect(page.locator('.toast')).toContainText('Insufficient permissions');
      }

      // Health tiles should be visible (read-only)
      const feedFreshnessTile = page.locator('[data-testid="health-tile-feed-freshness"]');
      await expect(feedFreshnessTile).toBeVisible();

      // Data trust widgets should be visible but not interactive
      const immutabilityWidget = page.locator('[data-testid="immutability-check-widget"]');
      await expect(immutabilityWidget).toBeVisible();

      const runCheckButton = page.locator('[data-testid="run-immutability-check"]');
      if (await runCheckButton.isVisible()) {
        await expect(runCheckButton).toBeDisabled();
      }
    });

    test('viewer cannot access recovery operations', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);

      // Should see the page but all controls should be disabled
      const replayPanel = page.locator('[data-testid="workflow-replay-panel"]');
      if (await replayPanel.isVisible()) {
        const singleReplayButton = page.locator('[data-testid="single-replay-submit"]');
        if (await singleReplayButton.isVisible()) {
          await expect(singleReplayButton).toBeDisabled();
        }
      }

      const rollbackPanel = page.locator('[data-testid="deployment-rollback-panel"]');
      if (await rollbackPanel.isVisible()) {
        const rollbackButton = page.locator('[data-testid="rollback-submit"]');
        if (await rollbackButton.isVisible()) {
          await expect(rollbackButton).toBeDisabled();
        }
      }
    });

    test('viewer can view incidents but not resolve them', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/incidents`);

      // Mock incidents data for viewer (read-only)
      await page.route('/api/ops/incidents*', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              incidents: [{
                id: 1,
                title: 'Test Incident',
                severity: 'medium',
                status: 'open',
                created_at: new Date().toISOString()
              }]
            })
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const firstIncident = page.locator('[data-testid="incident-card"]').first();
      if (await firstIncident.isVisible()) {
        const resolveButton = firstIncident.locator('[data-testid="resolve-incident-btn"]');
        if (await resolveButton.isVisible()) {
          await expect(resolveButton).toBeDisabled();
        }
      }
    });

    test('viewer has read-only access to settings', async ({ page }) => {
      await page.goto(`${COMMAND_CENTER_URL}/settings`);

      // Should see environment config but not modify
      const envConfigCard = page.locator('[data-testid="environment-config-card"]');
      await expect(envConfigCard).toBeVisible();

      // Should see webhook status but not trigger tests
      const webhookStatusCard = page.locator('[data-testid="webhook-status-card"]');
      await expect(webhookStatusCard).toBeVisible();

      // Audit logs should be visible (read-only)
      const auditLogCard = page.locator('[data-testid="audit-log-card"]');
      await expect(auditLogCard).toBeVisible();

      // But no test alert buttons should be functional
      const testAlertButtons = page.locator('[data-testid^="test-alert-"]');
      const buttonCount = await testAlertButtons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = testAlertButtons.nth(i);
        if (await button.isVisible()) {
          await expect(button).toBeDisabled();
        }
      }
    });
  });

  test.describe('Cross-Role Permission Validation', () => {
    test('should maintain RBAC integrity across page navigation', async ({ page }) => {
      // Start as viewer
      await page.addInitScript(() => {
        window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
          user: {
            id: 'viewer-user-123',
            email: 'viewer@unittalk.com',
            role: 'authenticated',
            user_metadata: { role: 'viewer' }
          }
        }));
      });

      await page.goto(COMMAND_CENTER_URL);

      // Verify viewer restrictions
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      if (await safeModeToggle.isVisible()) {
        await safeModeToggle.click();
        await expect(page.locator('.toast')).toContainText('Insufficient permissions');
      }

      // Navigate to incidents
      await page.goto(`${COMMAND_CENTER_URL}/incidents`);
      
      // Should still be restricted
      const firstIncident = page.locator('[data-testid="incident-card"]').first();
      if (await firstIncident.isVisible()) {
        const resolveButton = firstIncident.locator('[data-testid="resolve-incident-btn"]');
        if (await resolveButton.isVisible()) {
          await expect(resolveButton).toBeDisabled();
        }
      }

      // Navigate to recovery
      await page.goto(`${COMMAND_CENTER_URL}/recovery`);
      
      // Should still be restricted
      const rollbackButton = page.locator('[data-testid="rollback-submit"]');
      if (await rollbackButton.isVisible()) {
        await expect(rollbackButton).toBeDisabled();
      }
    });

    test('should prevent privilege escalation attempts', async ({ page }) => {
      // Start as ops user
      await page.addInitScript(() => {
        window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
          user: {
            id: 'ops-user-123',
            email: 'ops@unittalk.com',
            role: 'authenticated',
            user_metadata: { role: 'ops' }
          }
        }));
      });

      await page.goto(COMMAND_CENTER_URL);

      // Try to directly call admin-only API
      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/ops/rollback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              environment: 'staging',
              reason: 'Privilege escalation attempt',
              confirm: true
            })
          });
          return { status: res.status, body: await res.json() };
        } catch (error) {
          return { error: error.message };
        }
      });

      // Should be blocked
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });
  });
});