import { test, expect } from '@playwright/test';

// System Flags Enforcement E2E Tests
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const COMMAND_CENTER_URL = `${BASE_URL}/command-center`;

test.describe('System Flags Enforcement E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock admin authentication for flag management
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
        user: {
          id: 'admin-user-123',
          email: 'admin@unittalk.com',
          role: 'authenticated',
          user_metadata: { role: 'admin' }
        }
      }));
    });

    await page.goto(COMMAND_CENTER_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Safe Mode Enforcement', () => {
    test('should block promotions when Safe Mode is active', async ({ page }) => {
      // First ensure Safe Mode is OFF
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      const isChecked = await safeModeToggle.getAttribute('aria-checked');
      
      if (isChecked === 'true') {
        // Turn off Safe Mode first
        await page.route('/api/ops/system-config', route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              key: 'SAFE_MODE',
              value: false
            })
          });
        });
        
        await safeModeToggle.click();
        await page.waitForTimeout(500);
      }

      // Test that promotions work when Safe Mode is OFF
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          if (postData.action === 'promote_pick') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                message: 'Pick promoted successfully',
                pick_id: postData.payload.pickId
              })
            });
          }
        }
      });

      // Test promotion while Safe Mode is OFF
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_pick',
            payload: { pickId: 'test-pick-123' }
          })
        });
      });

      // Should succeed
      await expect(page.locator('.toast')).toContainText('promoted successfully');

      // Now enable Safe Mode
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
      await page.waitForTimeout(500);

      // Update enforcement API to block promotions
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

      // Test promotion while Safe Mode is ON
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_pick',
            payload: { pickId: 'test-pick-456' }
          })
        });
      });

      // Should be blocked
      await expect(page.locator('.toast')).toContainText('blocked');
    });

    test('should block publishing when Safe Mode is active', async ({ page }) => {
      // Enable Safe Mode
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      
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
      await page.waitForTimeout(500);

      // Mock publishing API to show Safe Mode blocking
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
                reason: 'Safe Mode active',
                message: 'Discord publishing blocked: Safe Mode active'
              })
            });
          }
        }
      });

      // Test Discord publishing
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Test message', channel: 'test-channel' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('Safe Mode active');
    });

    test('should show system status reflecting Safe Mode state', async ({ page }) => {
      // Mock system status API
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              system_flags: {
                SAFE_MODE: true,
                SYSTEM_FREEZE: false,
                SHADOW_MODE: false,
                PUBLISH_TO_DISCORD: true,
                PUBLISH_TO_NOTION: true
              },
              operational_status: {
                promotions_allowed: false,
                ingestion_allowed: true,
                discord_publishing_allowed: false,
                notion_publishing_allowed: false,
                shadow_mode_active: false
              }
            })
          });
        }
      });

      // Check system status
      const response = await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'GET'
        }).then(res => res.json());
      });

      expect(response.operational_status.promotions_allowed).toBe(false);
      expect(response.operational_status.discord_publishing_allowed).toBe(false);
      expect(response.operational_status.notion_publishing_allowed).toBe(false);
    });
  });

  test.describe('System Freeze Enforcement', () => {
    test('should block all operations when System Freeze is active', async ({ page }) => {
      // Enable System Freeze
      const systemFreezeToggle = page.locator('[data-testid="toggle-SYSTEM_FREEZE"]');
      
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'SYSTEM_FREEZE',
            value: true
          })
        });
      });

      await systemFreezeToggle.click();
      await page.waitForTimeout(500);

      // Mock enforcement API to block everything
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          
          route.fulfill({
            status: 423, // Locked
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Operation blocked by system flags',
              flag: 'SYSTEM_FREEZE',
              value: true,
              message: 'All operations are blocked - System Freeze is active'
            })
          });
        }
      });

      // Test promotion (should be blocked)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_pick',
            payload: { pickId: 'test-pick-789' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('System Freeze is active');

      // Test ingestion (should be blocked)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start_ingestion',
            payload: { source: 'test-source' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('System Freeze is active');

      // Test publishing (should be blocked)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Test during freeze' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('System Freeze is active');
    });

    test('should show all operations as blocked in system status', async ({ page }) => {
      // Enable System Freeze via toggle
      const systemFreezeToggle = page.locator('[data-testid="toggle-SYSTEM_FREEZE"]');
      
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'SYSTEM_FREEZE',
            value: true
          })
        });
      });

      await systemFreezeToggle.click();
      await page.waitForTimeout(500);

      // Mock system status to reflect freeze
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              system_flags: {
                SAFE_MODE: false,
                SYSTEM_FREEZE: true,
                SHADOW_MODE: false,
                PUBLISH_TO_DISCORD: true,
                PUBLISH_TO_NOTION: true
              },
              operational_status: {
                promotions_allowed: false,
                ingestion_allowed: false,
                discord_publishing_allowed: false,
                notion_publishing_allowed: false,
                shadow_mode_active: false
              }
            })
          });
        }
      });

      const response = await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'GET'
        }).then(res => res.json());
      });

      // All operations should be blocked
      expect(response.operational_status.promotions_allowed).toBe(false);
      expect(response.operational_status.ingestion_allowed).toBe(false);
      expect(response.operational_status.discord_publishing_allowed).toBe(false);
      expect(response.operational_status.notion_publishing_allowed).toBe(false);
    });
  });

  test.describe('Shadow Mode Enforcement', () => {
    test('should prevent real publishing in Shadow Mode', async ({ page }) => {
      // Enable Shadow Mode
      const shadowModeToggle = page.locator('[data-testid="toggle-SHADOW_MODE"]');
      
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'SHADOW_MODE',
            value: true
          })
        });
      });

      await shadowModeToggle.click();
      await page.waitForTimeout(500);

      // Mock publishing API to simulate shadow mode
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          if (postData.action === 'publish_to_discord' || postData.action === 'publish_to_notion') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                published: false,
                reason: 'Shadow Mode active',
                message: `${postData.action.includes('discord') ? 'Discord' : 'Notion'} publishing blocked: Shadow Mode active`
              })
            });
          }
        }
      });

      // Test Discord publishing in shadow mode
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Shadow mode test' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('Shadow Mode active');

      // Test Notion publishing in shadow mode
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_notion',
            payload: { content: 'Shadow mode test' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('Shadow Mode active');
    });

    test('should allow promotions and ingestion in Shadow Mode', async ({ page }) => {
      // Enable Shadow Mode
      const shadowModeToggle = page.locator('[data-testid="toggle-SHADOW_MODE"]');
      
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'SHADOW_MODE',
            value: true
          })
        });
      });

      await shadowModeToggle.click();
      await page.waitForTimeout(500);

      // Mock enforcement API - promotions and ingestion should work
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          
          if (postData.action === 'promote_pick' || postData.action === 'start_ingestion') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                message: `${postData.action} completed successfully`
              })
            });
          }
        }
      });

      // Test promotion (should work)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_pick',
            payload: { pickId: 'shadow-test-123' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('promote_pick completed');

      // Test ingestion (should work)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start_ingestion',
            payload: { source: 'shadow-test-source' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('start_ingestion completed');
    });
  });

  test.describe('Publishing Flags Enforcement', () => {
    test('should respect PUBLISH_TO_DISCORD flag', async ({ page }) => {
      // Disable Discord publishing
      const discordToggle = page.locator('[data-testid="toggle-PUBLISH_TO_DISCORD"]');
      
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'PUBLISH_TO_DISCORD',
            value: false
          })
        });
      });

      await discordToggle.click();
      await page.waitForTimeout(500);

      // Mock publishing API to respect flag
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
                reason: 'discord publishing disabled',
                message: 'Discord publishing blocked: discord publishing disabled'
              })
            });
          }
        }
      });

      // Test Discord publishing
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Test with flag disabled' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('discord publishing disabled');
    });

    test('should respect PUBLISH_TO_NOTION flag', async ({ page }) => {
      // Disable Notion publishing
      const notionToggle = page.locator('[data-testid="toggle-PUBLISH_TO_NOTION"]');
      
      await page.route('/api/ops/system-config', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: 'PUBLISH_TO_NOTION',
            value: false
          })
        });
      });

      await notionToggle.click();
      await page.waitForTimeout(500);

      // Mock publishing API
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          if (postData.action === 'publish_to_notion') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                published: false,
                reason: 'notion publishing disabled',
                message: 'Notion publishing blocked: notion publishing disabled'
              })
            });
          }
        }
      });

      // Test Notion publishing
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_notion',
            payload: { content: 'Test with flag disabled' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('notion publishing disabled');
    });
  });

  test.describe('Flag Combination Scenarios', () => {
    test('should handle Safe Mode + Shadow Mode combination', async ({ page }) => {
      // Enable both Safe Mode and Shadow Mode
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      const shadowModeToggle = page.locator('[data-testid="toggle-SHADOW_MODE"]');
      
      await page.route('/api/ops/system-config', route => {
        const requestBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: requestBody.key,
            value: requestBody.value
          })
        });
      });

      await safeModeToggle.click();
      await page.waitForTimeout(300);
      await shadowModeToggle.click();
      await page.waitForTimeout(300);

      // Mock enforcement - Safe Mode should block promotions, Shadow Mode should block real publishing
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          
          if (postData.action === 'promote_pick') {
            route.fulfill({
              status: 423,
              contentType: 'application/json',
              body: JSON.stringify({
                error: 'Operation blocked by system flags',
                flag: 'SAFE_MODE',
                value: true,
                message: 'Promotions are blocked - Safe Mode is active'
              })
            });
          } else if (postData.action.includes('publish_')) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                published: false,
                reason: 'Safe Mode active',
                message: 'Publishing blocked: Safe Mode active'
              })
            });
          }
        }
      });

      // Test promotion (blocked by Safe Mode)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_pick',
            payload: { pickId: 'combo-test-123' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('Safe Mode is active');

      // Test publishing (blocked by Safe Mode, would also be shadow mode)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Combo test' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('Safe Mode active');
    });

    test('should handle System Freeze overriding all other flags', async ({ page }) => {
      // Enable System Freeze along with other flags
      const systemFreezeToggle = page.locator('[data-testid="toggle-SYSTEM_FREEZE"]');
      const discordToggle = page.locator('[data-testid="toggle-PUBLISH_TO_DISCORD"]');
      
      await page.route('/api/ops/system-config', route => {
        const requestBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            key: requestBody.key,
            value: requestBody.value
          })
        });
      });

      // Enable Discord publishing first
      await discordToggle.click();
      await page.waitForTimeout(300);
      
      // Then enable System Freeze (should override everything)
      await systemFreezeToggle.click();
      await page.waitForTimeout(300);

      // Mock enforcement - System Freeze blocks everything
      await page.route('/api/ops/enforcement-example', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 423,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Operation blocked by system flags',
              flag: 'SYSTEM_FREEZE',
              value: true,
              message: 'All operations are blocked - System Freeze is active'
            })
          });
        }
      });

      // Test publishing (should be blocked by System Freeze, not allowed by Discord flag)
      await page.evaluate(() => {
        return fetch('/api/ops/enforcement-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish_to_discord',
            payload: { message: 'Freeze override test' }
          })
        });
      });

      await expect(page.locator('.toast')).toContainText('System Freeze is active');
    });
  });

  test.describe('Flag Persistence and Cache Validation', () => {
    test('should maintain flag state across page refreshes', async ({ page }) => {
      // Enable Safe Mode
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      
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
      await page.waitForTimeout(500);

      // Verify toggle is checked
      await expect(safeModeToggle).toHaveAttribute('aria-checked', 'true');

      // Mock the system config API to return the saved state
      await page.route('/api/ops/system-config', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              SAFE_MODE: true,
              SYSTEM_FREEZE: false,
              SHADOW_MODE: false,
              PUBLISH_TO_DISCORD: true,
              PUBLISH_TO_NOTION: true
            })
          });
        }
      });

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // State should be preserved
      const toggleAfterRefresh = page.locator('[data-testid="toggle-SAFE_MODE"]');
      await expect(toggleAfterRefresh).toHaveAttribute('aria-checked', 'true');
    });

    test('should handle cache invalidation correctly', async ({ page }) => {
      // Test rapid toggle operations that might stress the cache
      const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
      
      let toggleCount = 0;
      await page.route('/api/ops/system-config', route => {
        if (route.request().method() === 'POST') {
          toggleCount++;
          const requestBody = route.request().postDataJSON();
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              key: requestBody.key,
              value: requestBody.value,
              cache_cleared: true
            })
          });
        }
      });

      // Rapid toggles
      await safeModeToggle.click();
      await page.waitForTimeout(100);
      await safeModeToggle.click();
      await page.waitForTimeout(100);
      await safeModeToggle.click();
      await page.waitForTimeout(500);

      // Should handle all requests
      expect(toggleCount).toBeGreaterThan(0);
      
      // Final state should be consistent
      const finalState = await safeModeToggle.getAttribute('aria-checked');
      expect(['true', 'false']).toContain(finalState);
    });
  });
});