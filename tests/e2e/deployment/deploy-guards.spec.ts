/**
 * @fileoverview Deploy Guards E2E Tests
 * 
 * Testing progressive canary deployment with SLO guards including:
 * - 10% → 50% → 100% rollout progression
 * - SLO guard monitoring and thresholds
 * - Guard breach detection and auto-rollback
 * - Timeline widget functionality
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Deploy Guards E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('http://localhost:3004/dashboard')
    
    // Navigate to rollout timeline section
    await page.waitForSelector('[data-testid="rollout-timeline"]', { timeout: 10000 })
  })

  test.describe('Progressive Rollout Monitoring', () => {
    test('should display 10% canary phase with guard monitoring', async () => {
      await test.step('Mock 10% canary deployment status', async () => {
        // Intercept API calls and mock 10% canary status
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              targetSha: 'abc12345',
              triggeredBy: 'github-actions',
              canaryPercent: 10,
              duration: 300,
              nextPhase: 'canary50',
              nextPhaseEta: new Date(Date.now() + 600000).toISOString()
            }
          })
        })

        await page.reload()
        await page.waitForSelector('[data-testid="rollout-timeline"]')
      })

      await test.step('Verify 10% canary phase display', async () => {
        // Check phase badge
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('CANARY10')
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('10% traffic')

        // Check active step in timeline
        const activeStep = page.locator('.bg-blue-50.border-blue-200:has-text("10% Canary")')
        await expect(activeStep).toBeVisible()
        await expect(activeStep).toContainText('Running for 5:00')
      })

      await test.step('Verify SLO guards status', async () => {
        // Check feed freshness
        const feedFreshness = page.locator('[data-testid="rollout-timeline"] .text-green-600:has-text("150s")')
        await expect(feedFreshness).toBeVisible()

        // Check temporal backlog
        const temporalBacklog = page.locator('[data-testid="rollout-timeline"] .text-green-600:has-text("180s")')
        await expect(temporalBacklog).toBeVisible()

        // Check failure burn rate
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('GREEN')

        // Check overall guard status
        const overallStatus = page.locator('.bg-green-100.text-green-800:has-text("GREEN")')
        await expect(overallStatus).toBeVisible()
      })

      await test.step('Verify progress tracking', async () => {
        // Check progress bar shows appropriate completion
        const progressBar = page.locator('[data-testid="rollout-timeline"] .h-2')
        await expect(progressBar).toBeVisible()

        // Should show deployment info
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('deploy-20250812-123456-abc12345')
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('abc12345')
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('github-actions')
      })
    })

    test('should progress from 10% to 50% canary when guards pass', async () => {
      await test.step('Start with 10% canary', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
              guards: {
                feedFreshnessSeconds: 120,
                temporalBacklogAgeSeconds: 150,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 10,
              duration: 900,
              nextPhase: 'canary50'
            }
          })
        })

        await page.reload()
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('CANARY10')
      })

      await test.step('Simulate progression to 50% canary', async () => {
        // Change mock to 50% phase
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 140,
                temporalBacklogAgeSeconds: 160,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 50,
              duration: 60,
              nextPhase: 'full'
            }
          })
        })

        // Wait for polling interval to update
        await page.waitForTimeout(11000) // Slightly longer than 10s polling
      })

      await test.step('Verify 50% canary phase', async () => {
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('CANARY50')
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('50% traffic')

        // Check completed 10% step
        const completedStep = page.locator('.bg-green-50.border-green-200:has-text("10% Canary")')
        await expect(completedStep).toBeVisible()

        // Check active 50% step
        const activeStep = page.locator('.bg-blue-50.border-blue-200:has-text("50% Canary")')
        await expect(activeStep).toBeVisible()
      })
    })

    test('should complete full rollout when all phases pass', async () => {
      await test.step('Mock completed deployment', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'completed',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 100,
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 100,
              duration: 0
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify completed deployment', async () => {
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('COMPLETED')

        // All steps should be completed
        const completedSteps = page.locator('.bg-green-50.border-green-200')
        await expect(completedSteps).toHaveCount(4) // idle, 10%, 50%, full

        // Progress should be 100%
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('100%')

        // No abort button should be visible
        await expect(page.locator('button:has-text("Abort Deployment")')).not.toBeVisible()
      })
    })
  })

  test.describe('SLO Guard Violations', () => {
    test('should detect feed freshness violations', async () => {
      await test.step('Mock feed freshness violation', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 400, // Exceeds 300s threshold
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 10
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify violation detection', async () => {
        // Feed freshness should show as red
        const feedFreshness = page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("400s")')
        await expect(feedFreshness).toBeVisible()

        // Overall status should be red
        const overallStatus = page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )
        await expect(overallStatus).toBeVisible()

        // Should show warning about auto-rollback
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('Auto-rollback if red')
      })
    })

    test('should detect temporal backlog violations', async () => {
      await test.step('Mock temporal backlog violation', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 450, // Exceeds 300s threshold
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 50
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify temporal backlog violation', async () => {
        // Temporal backlog should show as red
        const temporalBacklog = page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("450s")')
        await expect(temporalBacklog).toBeVisible()

        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()
      })
    })

    test('should detect failure burn rate violations', async () => {
      await test.step('Mock failure burn rate violation', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'red', // Red burn rate
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 10
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify failure burn rate violation', async () => {
        // Failure burn rate should show as red
        const burnRate = page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("red")')
        await expect(burnRate).toBeVisible()

        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()
      })
    })

    test('should detect canary health violations', async () => {
      await test.step('Mock stale canary health', async () => {
        const staleTime = new Date(Date.now() - 120000).toISOString() // 2 minutes ago

        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary50',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: staleTime,
                overallStatus: 'red'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 50
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify canary health violation', async () => {
        // Canary health should show as red (>90s)
        const canaryHealth = page.locator('[data-testid="rollout-timeline"] .text-red-600:has-text("120s ago")')
        await expect(canaryHealth).toBeVisible()

        // Overall status should be red
        await expect(page.locator('.bg-red-100.text-red-800:has-text("RED")').or(
          page.locator('[data-variant="destructive"]:has-text("RED")')
        )).toBeVisible()
      })
    })
  })

  test.describe('Manual Deployment Control', () => {
    test('should allow manual deployment abort', async () => {
      await test.step('Setup active deployment', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'canary10',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 10
            }
          })
        })

        await page.reload()
      })

      await test.step('Click abort deployment button', async () => {
        const abortButton = page.locator('button:has-text("Abort Deployment")')
        await expect(abortButton).toBeVisible()
        await expect(abortButton).toBeEnabled()
        
        await abortButton.click()
      })

      await test.step('Verify abort request', async () => {
        // Mock the abort API call
        let abortCalled = false
        await page.route('/api/ops/deploy/abort', async route => {
          abortCalled = true
          await route.fulfill({
            json: {
              success: true,
              deploymentId: 'deploy-20250812-123456-abc12345',
              message: 'Deployment abort initiated successfully',
              rollbackTriggered: true,
              incidentCreated: true
            }
          })
        })

        // The abort should have been triggered
        await page.waitForTimeout(1000)
        expect(abortCalled).toBe(true)
      })
    })

    test('should disable abort button during rollback', async () => {
      await test.step('Mock rollback in progress', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'rolling_back',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 150,
                temporalBacklogAgeSeconds: 180,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: 0
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify disabled abort button', async () => {
        const abortButton = page.locator('button:has-text("Abort Deployment")')
        await expect(abortButton).toBeDisabled()
        
        // Should show rollback status
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('ROLLING_BACK')
      })
    })
  })

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      await test.step('Mock API error', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            status: 500,
            json: { error: 'Internal server error' }
          })
        })

        await page.reload()
      })

      await test.step('Verify graceful error handling', async () => {
        // Should show idle state when API fails
        const timeline = page.locator('[data-testid="rollout-timeline"]')
        await expect(timeline).toBeVisible()
        
        // Should not crash the UI
        await expect(page.locator('body')).not.toHaveClass(/error/)
      })
    })

    test('should handle missing deployment data', async () => {
      await test.step('Mock empty response', async () => {
        await page.route('/api/ops/deploy/status', async route => {
          await route.fulfill({
            json: {
              phase: 'idle',
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 0,
                temporalBacklogAgeSeconds: 0,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              canaryPercent: 0
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify idle state handling', async () => {
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('IDLE')
        
        // No deployment info should be shown
        await expect(page.locator('[data-testid="rollout-timeline"]')).not.toContainText('Deployment ID:')
        
        // No abort button should be visible
        await expect(page.locator('button:has-text("Abort Deployment")')).not.toBeVisible()
      })
    })

    test('should handle rapid status changes', async () => {
      await test.step('Simulate rapid status changes', async () => {
        let callCount = 0
        await page.route('/api/ops/deploy/status', async route => {
          callCount++
          
          const phases = ['canary10', 'canary50', 'full', 'completed']
          const currentPhase = phases[Math.min(callCount - 1, phases.length - 1)]
          
          await route.fulfill({
            json: {
              phase: currentPhase,
              since: new Date().toISOString(),
              guards: {
                feedFreshnessSeconds: 100,
                temporalBacklogAgeSeconds: 120,
                failureBurnRateLevel: 'green',
                canaryLastSeenAt: new Date().toISOString(),
                overallStatus: 'green'
              },
              deploymentId: 'deploy-20250812-123456-abc12345',
              canaryPercent: currentPhase === 'canary10' ? 10 : currentPhase === 'canary50' ? 50 : 100
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify UI handles rapid changes', async () => {
        // Wait for multiple polling cycles
        await page.waitForTimeout(35000)
        
        // Should eventually show completed state
        await expect(page.locator('[data-testid="rollout-timeline"]')).toContainText('COMPLETED')
        
        // UI should remain stable
        const timeline = page.locator('[data-testid="rollout-timeline"]')
        await expect(timeline).toBeVisible()
        await expect(timeline).not.toHaveClass(/error/)
      })
    })
  })
})