/**
 * @fileoverview Go-Live Rehearsal E2E Tests
 * 
 * Comprehensive end-to-end testing for the go-live rehearsal suite including:
 * - Canary cutover procedures
 * - Incident auto-safe mechanisms
 * - Rollback procedures
 * - Disaster recovery restore
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Test configuration
const TEST_CONFIG = {
  rehearsalTimeout: 300000, // 5 minutes
  healthCheckTimeout: 30000, // 30 seconds
  canaryTrafficPercent: 10,
  maxRetries: 3,
  environments: ['staging', 'prod'],
  baseUrl: process.env.COMMAND_CENTER_URL || 'http://localhost:3004'
}

// Test data and utilities
class RehearsalTestHelper {
  private page: Page
  private context: BrowserContext

  constructor(page: Page, context: BrowserContext) {
    this.page = page
    this.context = context
  }

  async navigateToRehearsalPanel() {
    await this.page.goto(`${TEST_CONFIG.baseUrl}/dashboard`)
    await this.page.waitForSelector('[data-testid="rehearsal-panel"]', { timeout: 10000 })
  }

  async navigateToRehearsalPage() {
    await this.page.goto(`${TEST_CONFIG.baseUrl}/dashboard/rehearsal`)
    await this.page.waitForLoadState('networkidle')
  }

  async waitForRehearsalStatus(expectedStatus: 'running' | 'idle', timeout = 30000) {
    await this.page.waitForFunction(
      (status) => {
        const statusElement = document.querySelector('[data-testid="rehearsal-status"]')
        return statusElement?.textContent?.toLowerCase().includes(status)
      },
      expectedStatus,
      { timeout }
    )
  }

  async getActiveColor(): Promise<'blue' | 'green'> {
    const badge = await this.page.locator('[data-testid="active-color-badge"]')
    const text = await badge.textContent()
    return text?.toLowerCase().includes('green') ? 'green' : 'blue'
  }

  async switchActiveColor(color: 'blue' | 'green') {
    const switchButton = this.page.locator(`[data-testid="switch-to-${color}"]`)
    await switchButton.click()
    
    // Wait for confirmation dialog if it appears
    const confirmButton = this.page.locator('button:has-text("Confirm")')
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
    
    // Wait for the switch to complete
    await this.page.waitForSelector(`[data-testid="active-color-badge"]:has-text("${color.toUpperCase()}")`)
  }

  async startRehearsal(environment: 'staging' | 'prod' = 'staging') {
    // Set environment if needed
    if (environment === 'prod') {
      await this.page.selectOption('[data-testid="environment-select"]', 'prod')
    }

    const startButton = this.page.locator('[data-testid="start-rehearsal"]')
    await startButton.click()
    
    // Wait for rehearsal to start
    await this.waitForRehearsalStatus('running')
  }

  async stopRehearsal() {
    const stopButton = this.page.locator('[data-testid="stop-rehearsal"]')
    await stopButton.click()
    
    // Wait for rehearsal to stop
    await this.waitForRehearsalStatus('idle')
  }

  async emergencyStop() {
    const emergencyButton = this.page.locator('[data-testid="emergency-stop"]')
    await emergencyButton.click()
    
    // Confirm the emergency stop
    const confirmButton = this.page.locator('button:has-text("EMERGENCY STOP")')
    await confirmButton.click()
    
    // Wait for system to stabilize
    await this.page.waitForTimeout(5000)
  }

  async waitForHealthStatus(component: string, status: 'healthy' | 'warning' | 'critical', timeout = 30000) {
    await this.page.waitForSelector(
      `[data-testid="health-${component}"][data-status="${status}"]`,
      { timeout }
    )
  }

  async verifyCanaryTraffic(expectedPercent: number) {
    const trafficDisplay = this.page.locator('[data-testid="canary-traffic-percent"]')
    await expect(trafficDisplay).toContainText(`${expectedPercent}%`)
  }

  async triggerIncident(type: 'cpu-spike' | 'memory-leak' | 'database-timeout') {
    const incidentButton = this.page.locator(`[data-testid="trigger-${type}"]`)
    await incidentButton.click()
    
    // Wait for incident to be triggered
    await this.page.waitForSelector('[data-testid="incident-active"]')
  }

  async verifyLogs(expectedMessages: string[]) {
    for (const message of expectedMessages) {
      await expect(this.page.locator('[data-testid="rehearsal-logs"]')).toContainText(message)
    }
  }

  async downloadReport(): Promise<string> {
    const downloadPromise = this.page.waitForEvent('download')
    await this.page.click('[data-testid="download-report"]')
    const download = await downloadPromise
    return await download.path()
  }
}

test.describe('Go-Live Rehearsal E2E Tests', () => {
  let helper: RehearsalTestHelper

  test.beforeEach(async ({ page, context }) => {
    helper = new RehearsalTestHelper(page, context)
    
    // Ensure clean state before each test
    await helper.navigateToRehearsalPanel()
    
    // Reset to blue if needed
    const currentColor = await helper.getActiveColor()
    if (currentColor === 'green') {
      await helper.switchActiveColor('blue')
    }
  })

  test.describe('Canary Cutover Procedures', () => {
    test('should successfully execute blue-green canary deployment', async () => {
      await test.step('Navigate to rehearsal page', async () => {
        await helper.navigateToRehearsalPage()
      })

      await test.step('Verify initial blue state', async () => {
        const activeColor = await helper.getActiveColor()
        expect(activeColor).toBe('blue')
      })

      await test.step('Start staging rehearsal', async () => {
        await helper.startRehearsal('staging')
      })

      await test.step('Wait for green environment build', async () => {
        await helper.verifyLogs(['Building green deployment images'])
        await helper.waitForHealthStatus('blueGreen', 'healthy')
      })

      await test.step('Verify canary traffic routing', async () => {
        await helper.verifyLogs(['Routing 10% traffic to green environment'])
        await helper.verifyCanaryTraffic(TEST_CONFIG.canaryTrafficPercent)
      })

      await test.step('Validate health gates', async () => {
        await helper.verifyLogs(['Health gates passing'])
        await helper.waitForHealthStatus('services', 'healthy')
        await helper.waitForHealthStatus('database', 'healthy')
      })

      await test.step('Complete canary promotion', async () => {
        await helper.verifyLogs(['Canary validation successful'])
        
        // In a real rehearsal, this would promote to 100% traffic
        // For testing, we verify the capability exists
        await expect(helper.page.locator('[data-testid="promote-canary"]')).toBeEnabled()
      })

      await test.step('Stop rehearsal and verify cleanup', async () => {
        await helper.stopRehearsal()
        await helper.verifyLogs(['Rehearsal completed successfully'])
      })
    })

    test('should handle canary deployment failures gracefully', async () => {
      await test.step('Start rehearsal with simulated failures', async () => {
        await helper.navigateToRehearsalPage()
        
        // Enable failure simulation
        await helper.page.check('[data-testid="simulate-failures"]')
        await helper.startRehearsal('staging')
      })

      await test.step('Verify automatic rollback on health check failure', async () => {
        await helper.verifyLogs(['Health check failed', 'Initiating automatic rollback'])
        
        // Should automatically return to blue
        const finalColor = await helper.getActiveColor()
        expect(finalColor).toBe('blue')
      })

      await test.step('Verify safe mode activation', async () => {
        await helper.waitForHealthStatus('services', 'warning')
        await helper.verifyLogs(['SAFE_MODE activated'])
      })
    })

    test('should validate traffic splitting accuracy', async () => {
      await test.step('Start rehearsal with custom canary percentage', async () => {
        await helper.navigateToRehearsalPage()
        
        // Set canary to 25%
        await helper.page.fill('[data-testid="canary-percent-input"]', '25')
        await helper.startRehearsal('staging')
      })

      await test.step('Verify traffic distribution', async () => {
        await helper.verifyCanaryTraffic(25)
        await helper.verifyLogs(['Traffic split: 75% blue, 25% green'])
      })

      await test.step('Monitor traffic metrics', async () => {
        // Verify that traffic is actually being routed correctly
        const metrics = await helper.page.locator('[data-testid="traffic-metrics"]')
        await expect(metrics).toContainText('Green: 25%')
        await expect(metrics).toContainText('Blue: 75%')
      })
    })
  })

  test.describe('Incident Auto-Safe Mechanisms', () => {
    test('should automatically activate safe mode on CPU spike', async () => {
      await test.step('Start rehearsal and trigger CPU incident', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        // Wait for canary phase
        await helper.verifyLogs(['Canary warmup complete'])
        
        // Trigger CPU spike incident
        await helper.triggerIncident('cpu-spike')
      })

      await test.step('Verify automatic safe mode activation', async () => {
        await helper.verifyLogs([
          'CPU spike detected: 95%',
          'Critical alert triggered',
          'Activating SAFE_MODE automatically'
        ])
        
        await helper.waitForHealthStatus('services', 'critical')
      })

      await test.step('Verify traffic rollback to blue', async () => {
        await helper.verifyLogs(['Rolling back to blue environment'])
        
        const activeColor = await helper.getActiveColor()
        expect(activeColor).toBe('blue')
      })

      await test.step('Verify alert notifications', async () => {
        await helper.verifyLogs(['Alert sent to Slack channel'])
        await helper.verifyLogs(['Discord notification delivered'])
      })
    })

    test('should handle memory leak incidents', async () => {
      await test.step('Start rehearsal and trigger memory incident', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        await helper.triggerIncident('memory-leak')
      })

      await test.step('Verify memory monitoring and response', async () => {
        await helper.verifyLogs([
          'Memory usage critical: >90%',
          'Memory leak pattern detected',
          'Initiating emergency procedures'
        ])
      })

      await test.step('Verify container restart and recovery', async () => {
        await helper.verifyLogs([
          'Restarting affected containers',
          'Memory usage normalized',
          'System recovery successful'
        ])
      })
    })

    test('should handle database timeout incidents', async () => {
      await test.step('Trigger database timeout scenario', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        await helper.triggerIncident('database-timeout')
      })

      await test.step('Verify database circuit breaker activation', async () => {
        await helper.verifyLogs([
          'Database query timeout: >5000ms',
          'Circuit breaker OPEN',
          'Fallback to read replica'
        ])
        
        await helper.waitForHealthStatus('database', 'warning')
      })

      await test.step('Verify automatic recovery', async () => {
        await helper.verifyLogs([
          'Database connectivity restored',
          'Circuit breaker CLOSED',
          'Primary database operational'
        ])
        
        await helper.waitForHealthStatus('database', 'healthy')
      })
    })
  })

  test.describe('Rollback Procedures', () => {
    test('should execute one-click rollback successfully', async () => {
      await test.step('Setup green deployment state', async () => {
        await helper.navigateToRehearsalPage()
        await helper.switchActiveColor('green')
        
        const activeColor = await helper.getActiveColor()
        expect(activeColor).toBe('green')
      })

      await test.step('Execute emergency rollback', async () => {
        const rollbackButton = helper.page.locator('[data-testid="rollback-to-blue"]')
        await rollbackButton.click()
        
        // Confirm rollback
        await helper.page.click('button:has-text("Confirm Rollback")')
      })

      await test.step('Verify rapid traffic switch', async () => {
        await helper.verifyLogs([
          'Initiating emergency rollback',
          'Switching traffic to blue environment',
          'Traffic rollback completed'
        ])
        
        // Should be back to blue within 30 seconds
        const finalColor = await helper.getActiveColor()
        expect(finalColor).toBe('blue')
      })

      await test.step('Verify system stability post-rollback', async () => {
        await helper.waitForHealthStatus('services', 'healthy')
        await helper.waitForHealthStatus('database', 'healthy')
        await helper.waitForHealthStatus('blueGreen', 'healthy')
      })

      await test.step('Verify rollback audit trail', async () => {
        await helper.verifyLogs([
          'Rollback reason: Emergency user action',
          'Previous state: green',
          'Current state: blue',
          'Rollback duration: <30s'
        ])
      })
    })

    test('should validate rollback speed requirements', async () => {
      await test.step('Measure rollback performance', async () => {
        await helper.navigateToRehearsalPage()
        await helper.switchActiveColor('green')
        
        const startTime = Date.now()
        
        // Execute rollback
        await helper.page.click('[data-testid="rollback-to-blue"]')
        await helper.page.click('button:has-text("Confirm Rollback")')
        
        // Wait for completion
        await helper.waitForRehearsalStatus('idle')
        
        const rollbackDuration = Date.now() - startTime
        
        // Rollback should complete within 30 seconds
        expect(rollbackDuration).toBeLessThan(30000)
      })
    })

    test('should preserve data integrity during rollback', async () => {
      await test.step('Create test data before rollback', async () => {
        await helper.navigateToRehearsalPage()
        
        // Create some test data (simulated)
        await helper.verifyLogs(['Test data created: 100 records'])
      })

      await test.step('Execute rollback and verify data preservation', async () => {
        await helper.switchActiveColor('green')
        await helper.page.click('[data-testid="rollback-to-blue"]')
        await helper.page.click('button:has-text("Confirm Rollback")')
        
        await helper.verifyLogs(['Data integrity verified: 100 records intact'])
      })
    })
  })

  test.describe('Disaster Recovery Restore', () => {
    test('should create and restore database snapshots', async () => {
      await test.step('Create database snapshot', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        await helper.verifyLogs([
          'Creating database snapshot',
          'Snapshot created: rehearsal-snapshot-'
        ])
      })

      await test.step('Verify snapshot integrity', async () => {
        await helper.verifyLogs([
          'Snapshot size: ~150MB',
          'Checksum validation: PASSED',
          'Upload to backup storage: SUCCESS'
        ])
      })

      await test.step('Restore to throwaway environment', async () => {
        await helper.verifyLogs([
          'Creating throwaway database',
          'Restoring from snapshot',
          'Throwaway environment ready'
        ])
      })

      await test.step('Run smoke tests on restored environment', async () => {
        await helper.verifyLogs([
          'Smoke test: Database connectivity - PASSED',
          'Smoke test: Schema validation - PASSED',
          'Smoke test: Data integrity - PASSED',
          'Smoke test: Critical queries - PASSED',
          'Smoke test: End-to-end processing - PASSED'
        ])
      })

      await test.step('Cleanup throwaway environment', async () => {
        await helper.verifyLogs([
          'Dropping throwaway database',
          'Cleaning up temporary files',
          'DR test completed successfully'
        ])
      })
    })

    test('should validate DR restore performance', async () => {
      await test.step('Measure DR restore time', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        // Monitor DR restore timing
        await helper.verifyLogs(['DR restore started'])
        
        const restoreStart = Date.now()
        await helper.verifyLogs(['DR restore completed'])
        const restoreTime = Date.now() - restoreStart
        
        // DR restore should complete within 10 minutes
        expect(restoreTime).toBeLessThan(600000)
      })
    })

    test('should verify data consistency after restore', async () => {
      await test.step('Validate restored data integrity', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        await helper.verifyLogs([
          'Data consistency check: unified_picks table',
          'Data consistency check: users table',
          'Data consistency check: raw_props table',
          'All data consistency checks: PASSED'
        ])
      })
    })
  })

  test.describe('Complete End-to-End Rehearsal', () => {
    test('should execute full production rehearsal workflow', async () => {
      await test.step('Start comprehensive production rehearsal', async () => {
        await helper.navigateToRehearsalPage()
        
        // Enable all features for production rehearsal
        await helper.page.check('[data-testid="incident-simulation"]')
        await helper.page.check('[data-testid="dr-testing"]')
        await helper.page.check('[data-testid="rollback-drill"]')
        
        await helper.startRehearsal('prod')
      })

      await test.step('Execute complete workflow', async () => {
        // This would run the full 12-step rehearsal process
        const expectedSteps = [
          'Preflight Checks',
          'Safety Defaults',
          'Build & Tag Green Images',
          'Canary Warmup',
          'Traffic Switch',
          'Health Gate Validation',
          'Incident Simulation',
          'Alert Validation',
          'Rollback Drill',
          'DR Snapshot',
          'DR Restore Test',
          'Cleanup & Reporting'
        ]

        for (const step of expectedSteps) {
          await helper.verifyLogs([`${step}: Starting`])
          await helper.verifyLogs([`${step}: SUCCESS`])
        }
      })

      await test.step('Verify comprehensive report generation', async () => {
        await helper.verifyLogs(['Generating comprehensive report'])
        
        const reportPath = await helper.downloadReport()
        expect(existsSync(reportPath)).toBeTruthy()
        
        const reportContent = readFileSync(reportPath, 'utf8')
        expect(reportContent).toContain('# Go-Live Rehearsal Report')
        expect(reportContent).toContain('REHEARSAL PASSED')
        expect(reportContent).toContain('GO-LIVE APPROVED')
      })

      await test.step('Verify final system state', async () => {
        // Should be back to blue after rehearsal
        const finalColor = await helper.getActiveColor()
        expect(finalColor).toBe('blue')
        
        // All systems should be healthy
        await helper.waitForHealthStatus('database', 'healthy')
        await helper.waitForHealthStatus('services', 'healthy')
        await helper.waitForHealthStatus('monitoring', 'healthy')
        await helper.waitForHealthStatus('blueGreen', 'healthy')
      })
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network failures gracefully', async () => {
      await test.step('Simulate network issues during rehearsal', async () => {
        await helper.navigateToRehearsalPage()
        
        // Simulate network failure
        await helper.context.setOffline(true)
        await helper.startRehearsal('staging')
        
        await helper.verifyLogs(['Network connectivity lost'])
      })

      await test.step('Verify graceful degradation', async () => {
        await helper.context.setOffline(false)
        
        await helper.verifyLogs([
          'Network connectivity restored',
          'Resuming rehearsal operations',
          'State recovery successful'
        ])
      })
    })

    test('should validate concurrent rehearsal prevention', async () => {
      await test.step('Attempt to start multiple rehearsals', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        // Second start should be disabled
        const startButton = helper.page.locator('[data-testid="start-rehearsal"]')
        await expect(startButton).toBeDisabled()
      })
    })

    test('should handle emergency stop scenarios', async () => {
      await test.step('Execute emergency stop during active rehearsal', async () => {
        await helper.navigateToRehearsalPage()
        await helper.startRehearsal('staging')
        
        // Wait for rehearsal to be active
        await helper.verifyLogs(['Canary warmup starting'])
        
        // Execute emergency stop
        await helper.emergencyStop()
      })

      await test.step('Verify immediate cleanup', async () => {
        await helper.verifyLogs([
          'Emergency stop initiated',
          'Stopping all rehearsal processes',
          'Rolling back to safe state',
          'Emergency stop completed'
        ])
        
        await helper.waitForRehearsalStatus('idle')
      })
    })
  })
})

// Utility functions for test data and cleanup
test.afterEach(async ({ page }) => {
  // Ensure clean state after each test
  try {
    await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`)
    
    // Stop any running rehearsals
    const stopButton = page.locator('[data-testid="stop-rehearsal"]')
    if (await stopButton.isEnabled()) {
      await stopButton.click()
    }
    
    // Reset to blue environment
    const resetButton = page.locator('[data-testid="reset-to-blue"]')
    if (await resetButton.isEnabled()) {
      await resetButton.click()
    }
  } catch (error) {
    console.warn('Cleanup warning:', error)
  }
})

test.afterAll(async () => {
  // Final cleanup - ensure no rehearsal processes are running
  try {
    execSync('pkill -f "go-live-rehearsal.ts" || true', { stdio: 'ignore' })
  } catch (error) {
    // Ignore cleanup errors
  }
})