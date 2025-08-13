/**
 * @fileoverview Incident Response E2E Tests
 * 
 * Testing incident simulation and automated response including:
 * - Alert detection and escalation
 * - Automatic safe mode activation
 * - Recovery procedures
 * - Communication workflows
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Incident Response Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('http://localhost:3004/dashboard/rehearsal')
  })

  test.describe('Alert Detection', () => {
    test('should detect and escalate CPU spike incidents', async () => {
      await test.step('Setup CPU monitoring', async () => {
        await page.check('[data-testid="enable-cpu-monitoring"]')
        await page.fill('[data-testid="cpu-threshold"]', '85')
        await page.click('[data-testid="start-monitoring"]')
      })

      await test.step('Trigger CPU spike incident', async () => {
        await page.click('[data-testid="trigger-cpu-spike"]')
        
        // Should detect spike immediately
        await page.waitForSelector('[data-testid="cpu-usage"]:has-text("95%")', { timeout: 10000 })
        await page.waitForSelector('[data-testid="alert-status"]:has-text("CRITICAL")')
      })

      await test.step('Verify alert escalation', async () => {
        await page.waitForSelector('[data-testid="alert-message"]:has-text("CPU spike detected")')
        await page.waitForSelector('[data-testid="alert-severity"]:has-text("CRITICAL")')
        await page.waitForSelector('[data-testid="escalation-level"]:has-text("IMMEDIATE")')
      })

      await test.step('Verify automatic safe mode activation', async () => {
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("ACTIVE")')
        await page.waitForSelector('[data-testid="safe-mode-reason"]:has-text("CPU spike threshold exceeded")')
        
        // Should log the automatic activation
        const logs = page.locator('[data-testid="incident-logs"]')
        await expect(logs).toContainText('SAFE_MODE activated automatically')
        await expect(logs).toContainText('Reason: CPU usage 95% > threshold 85%')
      })
    })

    test('should detect memory leak patterns', async () => {
      await test.step('Start memory monitoring', async () => {
        await page.check('[data-testid="enable-memory-monitoring"]')
        await page.fill('[data-testid="memory-threshold"]', '90')
        await page.click('[data-testid="start-monitoring"]')
      })

      await test.step('Simulate gradual memory leak', async () => {
        await page.click('[data-testid="simulate-memory-leak"]')
        
        // Should detect gradual increase
        await page.waitForSelector('[data-testid="memory-trend"]:has-text("Increasing")')
        await page.waitForSelector('[data-testid="leak-detection"]:has-text("DETECTED")')
      })

      await test.step('Verify memory leak alert', async () => {
        await page.waitForSelector('[data-testid="alert-type"]:has-text("MEMORY_LEAK")')
        await page.waitForSelector('[data-testid="alert-message"]:has-text("Memory leak pattern detected")')
        await page.waitForSelector('[data-testid="memory-growth-rate"]:has-text("MB/min")')
      })

      await test.step('Verify automated response', async () => {
        await page.waitForSelector('[data-testid="response-action"]:has-text("Container restart initiated")')
        await page.waitForSelector('[data-testid="memory-usage"]:has-text("< 50%")') // After restart
        await page.waitForSelector('[data-testid="leak-status"]:has-text("RESOLVED")')
      })
    })

    test('should detect database performance degradation', async () => {
      await test.step('Configure database monitoring', async () => {
        await page.check('[data-testid="enable-db-monitoring"]')
        await page.fill('[data-testid="query-timeout-threshold"]', '5000')
        await page.fill('[data-testid="connection-threshold"]', '80')
        await page.click('[data-testid="start-monitoring"]')
      })

      await test.step('Simulate database slowdown', async () => {
        await page.click('[data-testid="simulate-db-slowdown"]')
        
        // Should detect slow queries
        await page.waitForSelector('[data-testid="avg-query-time"]:has-text("> 5000ms")')
        await page.waitForSelector('[data-testid="slow-query-alert"]:has-text("ACTIVE")')
      })

      await test.step('Verify circuit breaker activation', async () => {
        await page.waitForSelector('[data-testid="circuit-breaker-status"]:has-text("OPEN")')
        await page.waitForSelector('[data-testid="fallback-status"]:has-text("Read replica active")')
        
        const logs = page.locator('[data-testid="incident-logs"]')
        await expect(logs).toContainText('Circuit breaker opened')
        await expect(logs).toContainText('Switched to read replica')
      })

      await test.step('Verify automatic recovery', async () => {
        // Database should recover automatically
        await page.waitForSelector('[data-testid="avg-query-time"]:has-text("< 1000ms")', { timeout: 60000 })
        await page.waitForSelector('[data-testid="circuit-breaker-status"]:has-text("CLOSED")')
        await page.waitForSelector('[data-testid="primary-db-status"]:has-text("ACTIVE")')
      })
    })
  })

  test.describe('Safe Mode Activation', () => {
    test('should activate safe mode with proper safeguards', async () => {
      await test.step('Trigger safe mode activation', async () => {
        await page.click('[data-testid="trigger-critical-alert"]')
        
        // Should activate safe mode immediately
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("ACTIVATING")')
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("ACTIVE")', { timeout: 10000 })
      })

      await test.step('Verify safe mode safeguards', async () => {
        // Should enable all safety flags
        await page.waitForSelector('[data-testid="safe-mode-flag"]:has-text("true")')
        await page.waitForSelector('[data-testid="shadow-mode-flag"]:has-text("true")')
        await page.waitForSelector('[data-testid="publish-discord-flag"]:has-text("false")')
        await page.waitForSelector('[data-testid="auto-settlement-flag"]:has-text("false")')
      })

      await test.step('Verify operational restrictions', async () => {
        // Should disable risky operations
        await expect(page.locator('[data-testid="dangerous-operation"]')).toBeDisabled()
        await expect(page.locator('[data-testid="auto-deployment"]')).toBeDisabled()
        await expect(page.locator('[data-testid="mass-operation"]')).toBeDisabled()
        
        // Should show warning banners
        await page.waitForSelector('[data-testid="safe-mode-warning"]:has-text("SAFE MODE ACTIVE")')
      })

      await test.step('Verify audit logging', async () => {
        const auditLogs = page.locator('[data-testid="audit-logs"]')
        await expect(auditLogs).toContainText('Safe mode activated')
        await expect(auditLogs).toContainText('Triggered by: Critical alert')
        await expect(auditLogs).toContainText('Safety flags updated')
        await expect(auditLogs).toContainText('Operations restricted')
      })
    })

    test('should handle manual safe mode override', async () => {
      await test.step('Manually activate safe mode', async () => {
        await page.click('[data-testid="manual-safe-mode"]')
        await page.fill('[data-testid="safe-mode-reason"]', 'Manual testing override')
        await page.click('[data-testid="confirm-safe-mode"]')
      })

      await test.step('Verify manual override logging', async () => {
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("ACTIVE")')
        await page.waitForSelector('[data-testid="activation-type"]:has-text("MANUAL")')
        
        const logs = page.locator('[data-testid="incident-logs"]')
        await expect(logs).toContainText('Safe mode manually activated')
        await expect(logs).toContainText('Reason: Manual testing override')
      })

      await test.step('Test manual deactivation', async () => {
        await page.click('[data-testid="deactivate-safe-mode"]')
        await page.fill('[data-testid="deactivation-reason"]', 'Testing complete')
        await page.click('[data-testid="confirm-deactivation"]')
        
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("INACTIVE")')
        await expect(page.locator('[data-testid="incident-logs"]')).toContainText('Safe mode deactivated manually')
      })
    })

    test('should escalate repeated incidents', async () => {
      await test.step('Trigger multiple incidents rapidly', async () => {
        for (let i = 0; i < 3; i++) {
          await page.click('[data-testid="trigger-cpu-spike"]')
          await page.waitForTimeout(5000) // Brief delay between incidents
        }
      })

      await test.step('Verify incident escalation', async () => {
        await page.waitForSelector('[data-testid="incident-count"]:has-text("3")')
        await page.waitForSelector('[data-testid="escalation-level"]:has-text("HIGH")')
        await page.waitForSelector('[data-testid="escalation-reason"]:has-text("Repeated incidents")')
      })

      await test.step('Verify enhanced safety measures', async () => {
        await page.waitForSelector('[data-testid="enhanced-safe-mode"]:has-text("ACTIVE")')
        await page.waitForSelector('[data-testid="lockdown-mode"]:has-text("ENABLED")')
        
        // Should require higher privilege to override
        await expect(page.locator('[data-testid="override-incident"]')).toBeDisabled()
        await page.waitForSelector('[data-testid="override-requirement"]:has-text("Admin approval required")')
      })
    })
  })

  test.describe('Communication Workflows', () => {
    test('should send notifications via all channels', async () => {
      await test.step('Configure notification channels', async () => {
        await page.check('[data-testid="enable-slack-notifications"]')
        await page.check('[data-testid="enable-discord-notifications"]')
        await page.check('[data-testid="enable-email-notifications"]')
        await page.check('[data-testid="enable-sms-notifications"]')
      })

      await test.step('Trigger critical incident', async () => {
        await page.click('[data-testid="trigger-critical-incident"]')
        
        // Should send notifications to all channels
        await page.waitForSelector('[data-testid="notification-status"]:has-text("Sending")')
      })

      await test.step('Verify notification delivery', async () => {
        await page.waitForSelector('[data-testid="slack-notification"]:has-text("SENT")')
        await page.waitForSelector('[data-testid="discord-notification"]:has-text("SENT")')
        await page.waitForSelector('[data-testid="email-notification"]:has-text("SENT")')
        await page.waitForSelector('[data-testid="sms-notification"]:has-text("SENT")')
        
        // Verify notification content
        const notificationContent = page.locator('[data-testid="notification-preview"]')
        await expect(notificationContent).toContainText('🚨 CRITICAL INCIDENT')
        await expect(notificationContent).toContainText('Go-Live Rehearsal')
        await expect(notificationContent).toContainText('Safe mode activated')
      })

      await test.step('Verify escalation notifications', async () => {
        // After initial notification, should send escalation updates
        await page.waitForTimeout(30000) // Wait for escalation window
        
        await page.waitForSelector('[data-testid="escalation-notification"]:has-text("SENT")')
        await expect(page.locator('[data-testid="escalation-message"]')).toContainText('Incident ongoing')
      })
    })

    test('should handle notification failures gracefully', async () => {
      await test.step('Simulate notification service failures', async () => {
        await page.check('[data-testid="simulate-slack-failure"]')
        await page.check('[data-testid="simulate-email-failure"]')
        
        await page.click('[data-testid="trigger-incident"]')
      })

      await test.step('Verify fallback notifications', async () => {
        await page.waitForSelector('[data-testid="slack-notification"]:has-text("FAILED")')
        await page.waitForSelector('[data-testid="email-notification"]:has-text("FAILED")')
        
        // Should fall back to working channels
        await page.waitForSelector('[data-testid="discord-notification"]:has-text("SENT")')
        await page.waitForSelector('[data-testid="sms-notification"]:has-text("SENT")')
        
        // Should log the failures
        const logs = page.locator('[data-testid="notification-logs"]')
        await expect(logs).toContainText('Slack notification failed')
        await expect(logs).toContainText('Email notification failed')
        await expect(logs).toContainText('Using fallback channels')
      })
    })

    test('should customize notifications by severity', async () => {
      const severityTests = [
        { level: 'LOW', channels: ['email'], escalation: false },
        { level: 'MEDIUM', channels: ['email', 'slack'], escalation: false },
        { level: 'HIGH', channels: ['email', 'slack', 'discord'], escalation: true },
        { level: 'CRITICAL', channels: ['email', 'slack', 'discord', 'sms'], escalation: true }
      ]

      for (const test_case of severityTests) {
        await test.step(`Test ${test_case.level} severity notifications`, async () => {
          await page.click(`[data-testid="trigger-${test_case.level.toLowerCase()}-incident"]`)
          
          // Verify correct channels are used
          for (const channel of ['email', 'slack', 'discord', 'sms']) {
            const expectedStatus = test_case.channels.includes(channel) ? 'SENT' : 'SKIPPED'
            await page.waitForSelector(`[data-testid="${channel}-notification"]:has-text("${expectedStatus}")`)
          }
          
          // Verify escalation behavior
          if (test_case.escalation) {
            await page.waitForSelector('[data-testid="escalation-timer"]:has-text("Started")')
          } else {
            await expect(page.locator('[data-testid="escalation-timer"]')).not.toBeVisible()
          }
          
          // Clear incident for next test
          await page.click('[data-testid="clear-incident"]')
          await page.waitForTimeout(2000)
        })
      }
    })
  })

  test.describe('Recovery Procedures', () => {
    test('should execute automated recovery workflows', async () => {
      await test.step('Setup recovery automation', async () => {
        await page.check('[data-testid="enable-auto-recovery"]')
        await page.fill('[data-testid="recovery-timeout"]', '300') // 5 minutes
        await page.click('[data-testid="save-recovery-config"]')
      })

      await test.step('Trigger recoverable incident', async () => {
        await page.click('[data-testid="trigger-recoverable-incident"]')
        
        // Should detect incident and start recovery
        await page.waitForSelector('[data-testid="incident-status"]:has-text("DETECTED")')
        await page.waitForSelector('[data-testid="recovery-status"]:has-text("STARTING")')
      })

      await test.step('Monitor recovery progress', async () => {
        await page.waitForSelector('[data-testid="recovery-step"]:has-text("Diagnosing issue")')
        await page.waitForSelector('[data-testid="recovery-step"]:has-text("Applying fix")')
        await page.waitForSelector('[data-testid="recovery-step"]:has-text("Verifying recovery")')
        
        // Should complete successfully
        await page.waitForSelector('[data-testid="recovery-status"]:has-text("COMPLETED")', { timeout: 60000 })
      })

      await test.step('Verify system restoration', async () => {
        await page.waitForSelector('[data-testid="system-health"]:has-text("HEALTHY")')
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("INACTIVE")')
        
        // Should log the successful recovery
        const logs = page.locator('[data-testid="recovery-logs"]')
        await expect(logs).toContainText('Automated recovery completed')
        await expect(logs).toContainText('System health restored')
        await expect(logs).toContainText('Safe mode deactivated')
      })
    })

    test('should handle recovery failures and escalate', async () => {
      await test.step('Trigger non-recoverable incident', async () => {
        await page.click('[data-testid="trigger-non-recoverable-incident"]')
        
        await page.waitForSelector('[data-testid="recovery-status"]:has-text("ATTEMPTING")')
      })

      await test.step('Simulate recovery failure', async () => {
        // Should attempt recovery multiple times
        await page.waitForSelector('[data-testid="recovery-attempts"]:has-text("1")')
        await page.waitForSelector('[data-testid="recovery-attempts"]:has-text("2")')
        await page.waitForSelector('[data-testid="recovery-attempts"]:has-text("3")')
        
        // Should fail after max attempts
        await page.waitForSelector('[data-testid="recovery-status"]:has-text("FAILED")')
      })

      await test.step('Verify manual escalation', async () => {
        await page.waitForSelector('[data-testid="escalation-status"]:has-text("MANUAL_REQUIRED")')
        await page.waitForSelector('[data-testid="escalation-message"]:has-text("Human intervention required")')
        
        // Should maintain safe mode
        await page.waitForSelector('[data-testid="safe-mode-status"]:has-text("ACTIVE")')
        await page.waitForSelector('[data-testid="safe-mode-reason"]:has-text("Recovery failed")')
      })
    })

    test('should provide manual recovery guidance', async () => {
      await test.step('Trigger incident requiring manual intervention', async () => {
        await page.click('[data-testid="trigger-manual-incident"]')
        
        await page.waitForSelector('[data-testid="manual-intervention-required"]:has-text("true")')
      })

      await test.step('Verify recovery guidance', async () => {
        await page.waitForSelector('[data-testid="recovery-guidance"]')
        
        const guidance = page.locator('[data-testid="recovery-steps"]')
        await expect(guidance).toContainText('1. Check system logs')
        await expect(guidance).toContainText('2. Verify database connectivity')
        await expect(guidance).toContainText('3. Restart affected services')
        await expect(guidance).toContainText('4. Validate system health')
        await expect(guidance).toContainText('5. Deactivate safe mode')
      })

      await test.step('Test manual recovery completion', async () => {
        // Simulate manual steps completion
        await page.check('[data-testid="step-1-completed"]')
        await page.check('[data-testid="step-2-completed"]')
        await page.check('[data-testid="step-3-completed"]')
        await page.check('[data-testid="step-4-completed"]')
        
        await page.click('[data-testid="mark-recovery-complete"]')
        
        await page.waitForSelector('[data-testid="recovery-status"]:has-text("MANUAL_COMPLETED")')
        await page.waitForSelector('[data-testid="system-health"]:has-text("HEALTHY")')
      })
    })
  })
})