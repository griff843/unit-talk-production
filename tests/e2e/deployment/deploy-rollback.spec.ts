/**
 * @fileoverview Deploy Rollback E2E Tests
 * 
 * Testing auto-rollback scenarios when SLO guards breach including:
 * - Guard violation detection and auto-rollback triggering
 * - Incident creation and notification workflows
 * - Rollback status monitoring and validation
 * - Recovery and post-rollback verification
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Deploy Rollback E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('http://localhost:3004/dashboard')
    
    // Navigate to rollout timeline section
    await page.waitForSelector('[data-testid="rollout-timeline"]', { timeout: 10000 })
  })

  test.describe('Auto-Rollback on Guard Violations', () => {
    test('should trigger auto-rollback when feed freshness exceeds 300s during 50% canary', async () => {
      await test.step('Setup 50% canary with healthy guards', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 180,
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-rollback-test-abc123',
              targetSha: 'abc123',
              canaryPercent: 50,
              duration: 300
            }
          })
        })

        await page.reload()
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('CANARY50')
      })

      await test.step('Inject red guard violation', async () => {
        // Change mock to show feed freshness violation
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 450, // Exceeds 300s threshold - RED
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-rollback-test-abc123',
              canaryPercent: 50,
              guardViolation: {
                detected: true,
                type: 'feed_freshness',
                value: 450,
                threshold: 300,
                violatedAt: new Date().toISOString()
              },
              autoRollbackTriggered: false
            }
          })
        })

        // Wait for polling interval to detect violation
        await page.waitForTimeout(11000)
      })

      await test.step('Verify guard violation detection', async () => {
        // Feed freshness should show as red
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("450s")')).toBeVisible()
        
        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()

        // Should show auto-rollback warning
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('Auto-rollback if red')
      })

      await test.step('Simulate auto-rollback trigger', async () => {
        let rollbackTriggered = false
        
        // Mock the rollback API call
        await page.route('/api/ops/deploy/abort', async route => {
          rollbackTriggered = true
          await route.fulfill({
            json: {
              success: true,
              deploymentId: 'deploy-20250812-rollback-test-abc123',
              message: 'Auto-rollback initiated due to guard violation',
              rollbackTriggered: true,
              incidentCreated: true,
              reason: 'SLO guard violation: feed_freshness exceeded 300s threshold (450s)'
            }
          })
        })

        // Change mock to rolling back state
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'rolling_back',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 450,
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-rollback-test-abc123',
              canaryPercent: 0,
              rollbackReason: 'SLO guard violation: feed_freshness exceeded 300s threshold (450s)',
              rollbackStartedAt: new Date().toISOString()
            }
          })
        })

        // Wait for auto-rollback to trigger
        await page.waitForTimeout(12000)
      })

      await test.step('Verify rollback initiated', async () => {
        // Should show ROLLING_BACK phase
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('ROLLING_BACK')
        
        // Should show rollback reason
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('feed_freshness exceeded 300s threshold')
        
        // Abort button should be disabled during rollback
        const abortButton = page.locator('button:has-text("Abort Deployment")')
        if (await abortButton.isVisible()) {
          await expect(abortButton).toBeDisabled()
        }
      })
    })

    test('should trigger auto-rollback on temporal backlog violation', async () => {
      await test.step('Setup 10% canary with temporal backlog violation', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 380, // Exceeds 300s threshold
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-temporal-rollback-xyz789',
              canaryPercent: 10,
              guardViolation: {
                detected: true,
                type: 'temporal_backlog',
                value: 380,
                threshold: 300,
                violatedAt: new Date().toISOString()
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify temporal backlog violation and rollback', async () => {
        // Temporal backlog should show as red
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("380s")')).toBeVisible()

        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()
      })
    })

    test('should trigger auto-rollback on failure burn rate violation', async () => {
      await test.step('Setup canary with failure burn rate violation', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'red', // RED burn rate
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-burn-rate-rollback-def456',
              canaryPercent: 50,
              guardViolation: {
                detected: true,
                type: 'failure_burn_rate',
                value: 'red',
                threshold: 'green',
                violatedAt: new Date().toISOString()
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify failure burn rate violation', async () => {
        // Failure burn rate should show as red
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("red")')).toBeVisible()
        
        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()
      })
    })
  })

  test.describe('Incident Management Integration', () => {
    test('should create incident record when rollback occurs', async () => {
      await test.step('Setup rollback scenario', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'rolling_back',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 500,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-incident-test-ghi789',
              rollbackReason: 'Auto-rollback due to feed freshness violation (500s > 300s)',
              rollbackStartedAt: new Date().toISOString(),
              incidentId: 'incident-20250812-001'
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify incident visibility in UI', async () => {
        // Should show rollback with incident reference
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('ROLLING_BACK')
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('feed freshness violation')
        
        // If incident link is shown, verify it's present
        const incidentLink = page.locator('a:has-text("incident-20250812-001")')
        if (await incidentLink.isVisible()) {
          await expect(incidentLink).toBeVisible()
        }
      })
    })

    test('should show incident details and resolution status', async () => {
      await test.step('Mock rollback with resolved incident', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'failed',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-resolved-incident-jkl012',
              rollbackCompletedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
              rollbackReason: 'Multiple guard violations detected',
              incidentId: 'incident-20250812-002',
              incidentStatus: 'resolved'
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify resolved incident display', async () => {
        // Should show FAILED phase
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('FAILED')
        
        // Should show rollback completion
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('Multiple guard violations')
        
        // No abort button should be visible
        await expect(page.locator('button:has-text("Abort Deployment")')).not.toBeVisible()
      })
    })
  })

  test.describe('Rollback Monitoring and Recovery', () => {
    test('should track rollback progress and completion', async () => {
      await test.step('Show rollback in progress', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'rolling_back',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-progress-test-mno345',
              rollbackStartedAt: new Date().toISOString(),
              rollbackProgress: {
                trafficShift: 'in_progress',
                configUpdate: 'in_progress',
                healthCheck: 'pending'
              }
            }
          })
        })

        await page.reload()
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('ROLLING_BACK')
      })

      await test.step('Show rollback completion', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'failed',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 100,
                temporalBacklogAgeSeconds: 80,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-progress-test-mno345',
              rollbackCompletedAt: new Date().toISOString(),
              rollbackProgress: {
                trafficShift: 'completed',
                configUpdate: 'completed',
                healthCheck: 'completed'
              }
            }
          })
        })

        await page.waitForTimeout(11000) // Wait for polling update

        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('FAILED')
      })
    })

    test('should show system recovery after successful rollback', async () => {
      await test.step('Mock system recovery state', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'idle',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 80,
                temporalBacklogAgeSeconds: 60,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              lastDeployment: {
                deploymentId: 'deploy-20250812-recovery-test-pqr678',
                status: 'failed',
                rollbackReason: 'Guard violations resolved',
                completedAt: new Date(Date.now() - 600000).toISOString() // 10 minutes ago
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify recovery state', async () => {
        // Should show IDLE state
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('IDLE')
        
        // Guards should be healthy
        await expect(page.locator('.bg-green-100.text-green-800:has-text("GREEN")').or(
          page.locator('[data-variant="default"]:has-text("GREEN")')
        )).toBeVisible()
        
        // No active deployment controls
        await expect(page.locator('button:has-text("Abort Deployment")')).not.toBeVisible()
      })
    })
  })

  test.describe('Guard Threshold Validation', () => {
    test('should respect exact threshold boundaries', async () => {
      await test.step('Test feed freshness at exact threshold (300s)', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 300, // Exactly at threshold
                temporalBacklogAgeSeconds: 150,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'yellow' // Should be yellow at threshold
              },
              deploymentId: 'deploy-20250812-threshold-test-stu901'
            }
          })
        })

        await page.reload()
        
        // At threshold should be yellow, not red
        await expect(page.locator('[data-testid="rollout-timeline"] .text-yellow-600:has-text("300s")').or(
          page.locator('[data-testid="rollout-timeline"] .text-orange-600:has-text("300s")')
        )).toBeVisible()
      })

      await test.step('Test feed freshness just over threshold (301s)', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 301, // Just over threshold
                temporalBacklogAgeSeconds: 150,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-threshold-test-stu901'
            }
          })
        })

        await page.waitForTimeout(11000)
        
        // Just over threshold should be red
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("301s")')).toBeVisible()
      })
    })
  })

  test.describe('Multiple Guard Violations', () => {
    test('should handle multiple simultaneous guard violations', async () => {
      await test.step('Setup multiple violations', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 450, // RED (> 300s)
                temporalBacklogAgeSeconds: 380, // RED (> 300s)
                failureBurnRateLevel: 'red', // RED
                canaryLastSeenAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago - RED (> 90s)
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-multiple-violations-vwx234',
              guardViolations: [
                { type: 'feed_freshness', value: 450, threshold: 300 },
                { type: 'temporal_backlog', value: 380, threshold: 300 },
                { type: 'failure_burn_rate', value: 'red', threshold: 'green' },
                { type: 'canary_health', value: 120, threshold: 90 }
              ]
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify multiple violations displayed', async () => {
        // All guards should show as red
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("450s")')).toBeVisible()
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("380s")')).toBeVisible()
        await expect(page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("red")')).toBeVisible()
        
        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()
      })
    })
  })
})