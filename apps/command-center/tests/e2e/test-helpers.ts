import { Page, expect } from '@playwright/test';

/**
 * Test helpers for Command Center E2E tests
 */

export interface TestUser {
  id: string;
  email: string;
  role: 'admin' | 'ops' | 'viewer';
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    id: 'admin-user-123',
    email: 'admin@unittalk.com',
    role: 'admin'
  },
  ops: {
    id: 'ops-user-123',
    email: 'ops@unittalk.com',
    role: 'ops'
  },
  viewer: {
    id: 'viewer-user-123',
    email: 'viewer@unittalk.com',
    role: 'viewer'
  }
};

/**
 * Authenticate as a specific user role
 */
export async function authenticateAs(page: Page, role: 'admin' | 'ops' | 'viewer') {
  const user = TEST_USERS[role];
  
  await page.addInitScript((userData) => {
    // Mock Supabase auth state
    window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
      user: {
        id: userData.id,
        email: userData.email,
        role: 'authenticated',
        user_metadata: { role: userData.role }
      },
      session: {
        access_token: `mock-${userData.role}-token`,
        refresh_token: `mock-${userData.role}-refresh`,
        expires_at: Date.now() + 3600000
      }
    }));
  }, user);
}

/**
 * Setup mock API responses for system configuration
 */
export async function mockSystemConfigAPI(page: Page, flags: Record<string, boolean> = {}) {
  const defaultFlags = {
    SAFE_MODE: false,
    SYSTEM_FREEZE: false,
    SHADOW_MODE: false,
    PUBLISH_TO_DISCORD: true,
    PUBLISH_TO_NOTION: true,
    ...flags
  };

  await page.route('/api/ops/system-config', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(defaultFlags)
      });
    } else if (route.request().method() === 'POST') {
      const requestBody = route.request().postDataJSON();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          key: requestBody.key,
          value: requestBody.value,
          message: `${requestBody.key} updated successfully`
        })
      });
    }
  });
}

/**
 * Setup mock API responses for RBAC permissions
 */
export async function mockRBACAPI(page: Page, userRole: 'admin' | 'ops' | 'viewer') {
  const permissions = {
    admin: ['view', 'toggle', 'resolve', 'rollback', 'test'],
    ops: ['view', 'toggle', 'resolve'],
    viewer: ['view']
  };

  const userPermissions = permissions[userRole];

  await page.route('/api/ops/**', route => {
    const method = route.request().method();
    const url = route.request().url();
    
    // Allow GET requests for all users
    if (method === 'GET') {
      route.continue();
      return;
    }

    // Check specific endpoints
    if (url.includes('/rollback') && !userPermissions.includes('rollback')) {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient permissions - Admin role required'
        })
      });
      return;
    }

    if (url.includes('/system-config') && !userPermissions.includes('toggle')) {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient permissions - Ops role required'
        })
      });
      return;
    }

    if (url.includes('/incidents') && method === 'POST' && !userPermissions.includes('resolve')) {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient permissions - Ops role required'
        })
      });
      return;
    }

    if (url.includes('/test/') && !userPermissions.includes('test')) {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient permissions - Admin role required'
        })
      });
      return;
    }

    // Allow the request to continue
    route.continue();
  });
}

/**
 * Setup mock health monitoring data
 */
export async function mockHealthMonitoringAPI(page: Page, healthData = {}) {
  const defaultHealthData = {
    feedFreshnessSeconds: 45,
    temporalBacklogAgeSeconds: 120,
    canaryLastSeenAt: new Date().toISOString(),
    failureBurnRateLevel: 'green' as const,
    providerCreditsPerMin: 2.5,
    percentOfDailyBudget: 15.7,
    dlqCount: 3,
    ...healthData
  };

  await page.route('/api/ops/health/tiles', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(defaultHealthData)
    });
  });
}

/**
 * Setup mock incidents data
 */
export async function mockIncidentsAPI(page: Page, incidents = []) {
  const defaultIncidents = incidents.length > 0 ? incidents : [
    {
      id: 1,
      title: 'High Error Rate Alert',
      severity: 'critical',
      status: 'open',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      description: 'Error rate exceeded 5% threshold'
    },
    {
      id: 2,
      title: 'Database Connection Warning',
      severity: 'medium',
      status: 'open',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      description: 'Database connection pool utilization at 85%'
    }
  ];

  await page.route('/api/ops/incidents*', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          incidents: defaultIncidents,
          total: defaultIncidents.length
        })
      });
    } else if (route.request().method() === 'POST') {
      const requestBody = route.request().postDataJSON();
      
      if (requestBody.id) {
        // Resolving incident
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Incident resolved successfully',
            incident_id: requestBody.id
          })
        });
      } else {
        // Creating incident
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Incident created successfully',
            incident_id: defaultIncidents.length + 1
          })
        });
      }
    }
  });
}

/**
 * Setup mock system flags enforcement
 */
export async function mockSystemFlagsEnforcement(page: Page, flags: Record<string, boolean>) {
  await page.route('/api/ops/enforcement-example', route => {
    if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON();
      const { action } = postData;

      // System Freeze blocks everything
      if (flags.SYSTEM_FREEZE) {
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
        return;
      }

      // Safe Mode blocks promotions and publishing
      if (flags.SAFE_MODE && (action === 'promote_pick' || action.includes('publish_'))) {
        if (action === 'promote_pick') {
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
        } else {
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
        return;
      }

      // Shadow Mode affects publishing
      if (flags.SHADOW_MODE && action.includes('publish_')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            published: false,
            reason: 'Shadow Mode active',
            message: 'Publishing blocked: Shadow Mode active'
          })
        });
        return;
      }

      // Publishing flags
      if (action === 'publish_to_discord' && !flags.PUBLISH_TO_DISCORD) {
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
        return;
      }

      if (action === 'publish_to_notion' && !flags.PUBLISH_TO_NOTION) {
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
        return;
      }

      // Default success response
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: `${action} completed successfully`
        })
      });
    } else if (route.request().method() === 'GET') {
      // System status endpoint
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          system_flags: flags,
          operational_status: {
            promotions_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE,
            ingestion_allowed: !flags.SYSTEM_FREEZE,
            discord_publishing_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_DISCORD,
            notion_publishing_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_NOTION,
            shadow_mode_active: flags.SHADOW_MODE
          }
        })
      });
    }
  });
}

/**
 * Wait for toast message to appear
 */
export async function waitForToast(page: Page, expectedText: string, timeout = 5000) {
  const toast = page.locator('.toast');
  await expect(toast).toContainText(expectedText, { timeout });
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(page: Page) {
  await page.waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden', timeout: 10000 });
}

/**
 * Assert toggle state
 */
export async function assertToggleState(page: Page, toggleTestId: string, expectedState: boolean) {
  const toggle = page.locator(`[data-testid="${toggleTestId}"]`);
  await expect(toggle).toHaveAttribute('aria-checked', expectedState.toString());
}

/**
 * Click toggle and wait for completion
 */
export async function clickToggleAndWait(page: Page, toggleTestId: string) {
  const toggle = page.locator(`[data-testid="${toggleTestId}"]`);
  await toggle.click();
  await waitForLoadingComplete(page);
}

/**
 * Navigate to Command Center page
 */
export async function navigateToCommandCenter(page: Page) {
  await page.goto('/command-center');
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to specific Command Center sub-page
 */
export async function navigateToSubPage(page: Page, subPage: 'incidents' | 'recovery' | 'settings') {
  await page.goto(`/command-center/${subPage}`);
  await page.waitForLoadState('networkidle');
}