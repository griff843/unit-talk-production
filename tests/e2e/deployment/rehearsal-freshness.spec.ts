/**
 * @fileoverview Rehearsal Freshness E2E Tests
 * 
 * Testing the 7-day rehearsal recency requirement including:
 * - Deploy job precheck validation for rehearsal freshness
 * - Stale rehearsal detection and deployment blocking
 * - Fresh rehearsal validation and deployment approval
 * - Rehearsal completion tracking and timestamp management
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Rehearsal Freshness E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('http://localhost:3004/dashboard')
    
    // Wait for deployment controls to load
    await page.waitForSelector('[data-testid="deployment-controls"]', { timeout: 10000 })
  })

  test.describe('Fresh Rehearsal Validation', () => {
    test('should allow deployment with fresh rehearsal (within 7 days)', async () => {
      await test.step('Setup fresh rehearsal scenario', async () => {
        const freshRehearsalTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        
        // Mock API to return fresh rehearsal status
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: freshRehearsalTime,
              daysSinceLastRehearsal: 2,
              isStale: false,
              threshold: 7,
              status: 'fresh',
              rehearsalId: 'rehearsal-20250810-fresh-abc123',
              completionStatus: 'passed',
              testResults: {
                totalTests: 45,
                passed: 45,
                failed: 0,
                duration: 1847 // 30 minutes
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify fresh rehearsal status display', async () => {
        // Should show fresh status indicator
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        await expect(rehearsalStatus).toContainText('FRESH')
        await expect(rehearsalStatus).toContainText('2 days ago')
        
        // Should show green status badge
        await expect(page.locator('.bg-green-100.text-green-800:has-text("FRESH")').or(
          page.locator('[data-variant="default"]:has-text("FRESH")')
        )).toBeVisible()
      })

      await test.step('Verify deployment controls are enabled', async () => {
        // Deploy button should be enabled
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeEnabled()
        }
        
        // No blocking warnings should be visible
        await expect(page.locator('.text-red-600:has-text("stale rehearsal")')).not.toBeVisible()
      })

      await test.step('Simulate deployment trigger with fresh rehearsal', async () => {
        let deploymentTriggered = false
        
        // Mock deployment trigger API
        await page.route('/api/ops/deploy/trigger', async route => {
          const requestBody = await route.request().postDataJSON()
          
          // Should include rehearsal validation
          expect(requestBody.precheckResults).toBeDefined()
          expect(requestBody.precheckResults.rehearsalFreshness).toBe('passed')
          
          deploymentTriggered = true
          await route.fulfill({
            json: {
              success: true,
              deploymentId: 'deploy-20250812-fresh-rehearsal-xyz789',
              message: 'Deployment started successfully',
              prechecksPassed: true,
              rehearsalValidation: 'passed'
            }
          })
        })

        // Trigger deployment (if button is available)
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await deployButton.click()
          await page.waitForTimeout(2000)
          expect(deploymentTriggered).toBe(true)
        }
      })
    })

    test('should show detailed rehearsal information', async () => {
      await test.step('Setup detailed rehearsal data', async () => {
        const recentRehearsalTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() // 6 hours ago
        
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: recentRehearsalTime,
              daysSinceLastRehearsal: 0.25, // 6 hours = 0.25 days
              isStale: false,
              threshold: 7,
              status: 'fresh',
              rehearsalId: 'rehearsal-20250812-detailed-def456',
              completionStatus: 'passed',
              testResults: {
                totalTests: 52,
                passed: 50,
                failed: 2,
                warnings: 3,
                duration: 2145 // 35 minutes
              },
              environment: 'staging',
              triggeredBy: 'github-actions',
              gitSha: 'abc123def456',
              deploymentPhases: [
                { phase: 'infrastructure', status: 'passed', duration: 300 },
                { phase: 'application', status: 'passed', duration: 600 },
                { phase: 'integration', status: 'passed', duration: 1245 }
              ]
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify detailed rehearsal information', async () => {
        const rehearsalPanel = page.locator('[data-testid="rehearsal-status"]')
        
        // Should show detailed timing
        await expect(rehearsalPanel).toContainText('6 hours ago')
        
        // Should show test results summary
        await expect(rehearsalPanel).toContainText('52 tests')
        await expect(rehearsalPanel).toContainText('50 passed')
        
        // Should show rehearsal ID
        await expect(rehearsalPanel).toContainText('rehearsal-20250812-detailed-def456')
        
        // Should show duration
        await expect(rehearsalPanel).toContainText('35 minutes')
      })

      await test.step('Verify expandable details work', async () => {
        // If there's a details expansion button, test it
        const detailsButton = page.locator('button:has-text("View Details")')
        if (await detailsButton.isVisible()) {
          await detailsButton.click()
          
          // Should show expanded information
          await expect(page.locator('[data-testid="rehearsal-details"]')).toContainText('github-actions')
          await expect(page.locator('[data-testid="rehearsal-details"]')).toContainText('abc123def456')
        }
      })
    })
  })

  test.describe('Stale Rehearsal Detection', () => {
    test('should block deployment with stale rehearsal (> 7 days)', async () => {
      await test.step('Setup stale rehearsal scenario', async () => {
        const staleRehearsalTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
        
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: staleRehearsalTime,
              daysSinceLastRehearsal: 10,
              isStale: true,
              threshold: 7,
              status: 'stale',
              rehearsalId: 'rehearsal-20250802-stale-ghi789',
              completionStatus: 'passed',
              testResults: {
                totalTests: 48,
                passed: 48,
                failed: 0,
                duration: 1654
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify stale rehearsal warning display', async () => {
        // Should show stale status indicator
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        await expect(rehearsalStatus).toContainText('STALE')
        await expect(rehearsalStatus).toContainText('10 days ago')
        
        // Should show red/warning status badge
        await expect(page.locator('.bg-red-100.text-red-800:has-text("STALE")').or(
          page.locator('.bg-yellow-100.text-yellow-800:has-text("STALE")')
        )).toBeVisible()
        
        // Should show warning message
        await expect(page.locator('[data-testid="rehearsal-status"]')).toContainText('exceeds 7-day threshold')
      })

      await test.step('Verify deployment controls are disabled/blocked', async () => {
        // Deploy button should be disabled or show warning
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
        
        // Should show blocking message
        await expect(page.locator('.text-red-600:has-text("deployment blocked")').or(
          page.locator('.text-red-600:has-text("rehearsal required")')
        )).toBeVisible()
      })

      await test.step('Verify deployment trigger fails precheck', async () => {
        let precheckFailed = false
        
        // Mock deployment trigger API to return precheck failure
        await page.route('/api/ops/deploy/trigger', async route => {
          const requestBody = await route.request().postDataJSON()
          
          precheckFailed = true
          await route.fulfill({
            status: 400,
            json: {
              success: false,
              error: 'Deployment blocked by precheck failures',
              precheckResults: {
                rehearsalFreshness: 'failed',
                reason: 'Rehearsal is 10 days old, exceeds 7-day threshold'
              }
            }
          })
        })

        // Attempt to trigger deployment (if possible)
        const triggerDeploymentButton = page.locator('[data-testid="force-deploy-button"]')
        if (await triggerDeploymentButton.isVisible()) {
          await triggerDeploymentButton.click()
          await page.waitForTimeout(2000)
          expect(precheckFailed).toBe(true)
        }
      })
    })

    test('should show exactly at threshold (7 days)', async () => {
      await test.step('Setup threshold boundary scenario', async () => {
        const thresholdRehearsalTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Exactly 7 days ago
        
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: thresholdRehearsalTime,
              daysSinceLastRehearsal: 7,
              isStale: false, // Exactly at threshold should still be valid
              threshold: 7,
              status: 'fresh',
              rehearsalId: 'rehearsal-20250805-threshold-jkl012',
              completionStatus: 'passed',
              testResults: {
                totalTests: 47,
                passed: 47,
                failed: 0,
                duration: 1832
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify threshold boundary handling', async () => {
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        
        // Should show as fresh (at threshold is still valid)
        await expect(rehearsalStatus).toContainText('FRESH')
        await expect(rehearsalStatus).toContainText('7 days ago')
        
        // May show warning color but still allow deployment
        const statusBadge = page.locator('[data-testid="rehearsal-status"]')
        
        // Should not block deployment
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeEnabled()
        }
      })
    })

    test('should handle edge case of just over threshold (7.1 days)', async () => {
      await test.step('Setup just-over-threshold scenario', async () => {
        const overThresholdTime = new Date(Date.now() - (7.1 * 24 * 60 * 60 * 1000)).toISOString()
        
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: overThresholdTime,
              daysSinceLastRehearsal: 7.1,
              isStale: true,
              threshold: 7,
              status: 'stale',
              rehearsalId: 'rehearsal-20250804-over-threshold-mno345',
              completionStatus: 'passed'
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify just-over-threshold is blocked', async () => {
        // Should show as stale and block deployment
        await expect(page.locator('[data-testid="rehearsal-status"]')).toContainText('STALE')
        
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
      })
    })
  })

  test.describe('Rehearsal Completion Tracking', () => {
    test('should handle missing rehearsal data', async () => {
      await test.step('Setup no rehearsal scenario', async () => {
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: null,
              daysSinceLastRehearsal: null,
              isStale: true,
              threshold: 7,
              status: 'never_run',
              rehearsalId: null,
              completionStatus: null,
              message: 'No rehearsal found in system history'
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify no rehearsal handling', async () => {
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        
        // Should show never run status
        await expect(rehearsalStatus).toContainText('NEVER RUN')
        
        // Should block deployment
        await expect(page.locator('.text-red-600:has-text("rehearsal required")').or(
          page.locator('.text-red-600:has-text("No recent rehearsal")')
        )).toBeVisible()
        
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
      })
    })

    test('should handle failed rehearsal status', async () => {
      await test.step('Setup failed rehearsal scenario', async () => {
        const failedRehearsalTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: failedRehearsalTime,
              daysSinceLastRehearsal: 2,
              isStale: false, // Fresh timing but failed tests
              threshold: 7,
              status: 'failed',
              rehearsalId: 'rehearsal-20250810-failed-pqr678',
              completionStatus: 'failed',
              testResults: {
                totalTests: 50,
                passed: 35,
                failed: 15,
                duration: 1245
              },
              failureReasons: [
                'Integration test timeout in staging environment',
                'Database migration validation failed',
                'Performance threshold exceeded (> 2s response time)'
              ]
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify failed rehearsal blocking', async () => {
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        
        // Should show failed status
        await expect(rehearsalStatus).toContainText('FAILED')
        await expect(rehearsalStatus).toContainText('2 days ago')
        
        // Should show red status badge
        await expect(page.locator('.bg-red-100.text-red-800:has-text("FAILED")')).toBeVisible()
        
        // Should show failure summary
        await expect(rehearsalStatus).toContainText('15 failed')
        
        // Should block deployment despite fresh timing
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
        
        // Should show blocking message about failed tests
        await expect(page.locator('.text-red-600:has-text("rehearsal failed")').or(
          page.locator('.text-red-600:has-text("tests must pass")')
        )).toBeVisible()
      })
    })

    test('should show in-progress rehearsal status', async () => {
      await test.step('Setup in-progress rehearsal scenario', async () => {
        const inProgressStartTime = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
        
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            json: {
              lastRehearsalAt: null, // No completed rehearsal
              daysSinceLastRehearsal: null,
              isStale: true, // No completed rehearsal counts as stale
              threshold: 7,
              status: 'in_progress',
              rehearsalId: 'rehearsal-20250812-progress-stu901',
              completionStatus: 'running',
              currentPhase: 'integration_tests',
              progress: {
                totalPhases: 4,
                completedPhases: 2,
                currentPhase: 'integration_tests',
                startedAt: inProgressStartTime,
                estimatedCompletion: new Date(Date.now() + 15 * 60 * 1000).toISOString()
              },
              testResults: {
                totalTests: 50,
                completed: 32,
                passed: 30,
                failed: 2,
                running: 18
              }
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify in-progress rehearsal display', async () => {
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        
        // Should show running status
        await expect(rehearsalStatus).toContainText('RUNNING')
        
        // Should show progress information
        await expect(rehearsalStatus).toContainText('integration_tests')
        await expect(rehearsalStatus).toContainText('32/50')
        
        // Should show blue/info status badge
        await expect(page.locator('.bg-blue-100.text-blue-800:has-text("RUNNING")').or(
          page.locator('.bg-gray-100.text-gray-800:has-text("RUNNING")')
        )).toBeVisible()
        
        // Should block deployment while running
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
        
        // Should show waiting message
        await expect(page.locator('.text-blue-600:has-text("rehearsal in progress")').or(
          page.locator('.text-gray-600:has-text("wait for completion")')
        )).toBeVisible()
      })
    })
  })

  test.describe('API Error Handling', () => {
    test('should handle rehearsal status API errors gracefully', async () => {
      await test.step('Setup API error scenario', async () => {
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.fulfill({
            status: 500,
            json: { error: 'Internal server error fetching rehearsal status' }
          })
        })

        await page.reload()
      })

      await test.step('Verify graceful error handling', async () => {
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        
        // Should show error state but not crash
        await expect(rehearsalStatus).toBeVisible()
        
        // Should show error indicator
        await expect(rehearsalStatus).toContainText('ERROR')
        
        // Should block deployment on error (fail safe)
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
        
        // Should show error message
        await expect(page.locator('.text-red-600:has-text("Unable to verify rehearsal")').or(
          page.locator('.text-red-600:has-text("Status unavailable")')
        )).toBeVisible()
      })
    })

    test('should handle network connectivity issues', async () => {
      await test.step('Simulate network failure', async () => {
        await page.route('/api/ops/rehearsal/status', async route => {
          await route.abort('failed')
        })

        await page.reload()
      })

      await test.step('Verify network error handling', async () => {
        const rehearsalStatus = page.locator('[data-testid="rehearsal-status"]')
        
        // Should not crash on network failure
        await expect(rehearsalStatus).toBeVisible()
        
        // Should show offline/unavailable state
        await expect(rehearsalStatus).toContainText('UNAVAILABLE')
        
        // Should fail safe and block deployment
        const deployButton = page.locator('button:has-text("Start Deployment")')
        if (await deployButton.isVisible()) {
          await expect(deployButton).toBeDisabled()
        }
      })
    })
  })
})