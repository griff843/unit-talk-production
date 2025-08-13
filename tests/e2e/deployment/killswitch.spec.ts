/**
 * @fileoverview Kill Switch E2E Tests
 * 
 * Testing Kill Switch functionality including:
 * - Activation and deactivation workflows
 * - SYSTEM_FREEZE flag integration
 * - Audit logging and notifications
 * - UI state management and confirmations
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Kill Switch E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('http://localhost:3004/dashboard')
    
    // Wait for the page to load and find kill switch panel
    await page.waitForSelector('[data-testid="killswitch-button"]', { timeout: 10000 })
  })

  test.describe('Kill Switch Activation', () => {
    test('should activate kill switch with proper confirmation', async () => {
      await test.step('Start activation process', async () => {
        // Mock freeze status as inactive initially
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()
        
        // Click the kill switch button
        const killSwitchButton = page.locator('[data-testid="killswitch-button"]')
        await expect(killSwitchButton).toBeVisible()
        await expect(killSwitchButton).toContainText('ACTIVATE KILL SWITCH')
        
        await killSwitchButton.click()
      })

      await test.step('Fill confirmation dialog', async () => {
        // Dialog should appear
        await page.waitForSelector('[role="dialog"]')
        
        // Should show confirmation details
        await expect(page.locator('[role="dialog"]')).toContainText('Confirm Kill Switch Activation')
        await expect(page.locator('[role="dialog"]')).toContainText('Set SYSTEM_FREEZE = true')
        await expect(page.locator('[role="dialog"]')).toContainText('Block all deployments')
        await expect(page.locator('[role="dialog"]')).toContainText('Use only in emergencies!')

        // Fill reason
        const reasonTextarea = page.locator('[role="dialog"] textarea')
        await reasonTextarea.fill('Critical production issue detected - blocking all deployments for investigation')
        
        // Confirm button should be enabled now
        const confirmButton = page.locator('button:has-text("CONFIRM ACTIVATION")')
        await expect(confirmButton).toBeEnabled()
      })

      await test.step('Complete activation', async () => {
        // Mock the activation API
        let activationCalled = false
        let activationRequest: any = null
        
        await page.route('/api/ops/system/freeze', async route => {
          if (route.request().method() === 'POST') {
            activationCalled = true
            activationRequest = await route.request().postDataJSON()
            
            await route.fulfill({
              json: {
                success: true,
                action: 'activate',
                systemFreeze: true,
                timestamp: new Date().toISOString(),
                reason: activationRequest.reason,
                configsUpdated: ['SYSTEM_FREEZE', 'SAFE_MODE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'AUTO_SETTLEMENT'],
                auditLogged: true,
                message: 'Kill switch activated successfully'
              }
            })
          }
        })

        // Mock the updated freeze status
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: true,
              activatedAt: new Date().toISOString(),
              activatedBy: 'command-center-killswitch',
              reason: 'Critical production issue detected - blocking all deployments for investigation',
              lastChecked: new Date().toISOString()
            }
          })
        })

        // Click confirm
        const confirmButton = page.locator('button:has-text("CONFIRM ACTIVATION")')
        await confirmButton.click()

        // Wait for API call
        await page.waitForTimeout(2000)

        // Verify activation request
        expect(activationCalled).toBe(true)
        expect(activationRequest).toMatchObject({
          action: 'activate',
          reason: 'Critical production issue detected - blocking all deployments for investigation'
        })
      })

      await test.step('Verify activated state', async () => {
        // Should show success toast
        await expect(page.locator('.toast')).toContainText('Kill Switch Activated')

        // Should show system frozen banner
        await page.waitForSelector('.bg-red-500\\/10')
        await expect(page.locator('.bg-red-500\\/10')).toContainText('SYSTEM FROZEN')
        await expect(page.locator('.bg-red-500\\/10')).toContainText('All deployments and critical operations are blocked')

        // Kill switch panel should show active state
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('ACTIVE')
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('SYSTEM_FREEZE = true')

        // Should show deactivation button instead
        await expect(page.locator('button:has-text("DEACTIVATE KILL SWITCH")')).toBeVisible()
      })
    })

    test('should require reason for activation', async () => {
      await test.step('Try activation without reason', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()
        
        // Click kill switch
        await page.locator('[data-testid="killswitch-button"]').click()
        
        // Dialog appears
        await page.waitForSelector('[role="dialog"]')
        
        // Confirm button should be disabled
        const confirmButton = page.locator('button:has-text("CONFIRM ACTIVATION")')
        await expect(confirmButton).toBeDisabled()
      })

      await test.step('Try with empty reason', async () => {
        // Fill with whitespace only
        const reasonTextarea = page.locator('[role="dialog"] textarea')
        await reasonTextarea.fill('   ')
        
        // Confirm button should still be disabled
        const confirmButton = page.locator('button:has-text("CONFIRM ACTIVATION")')
        await expect(confirmButton).toBeDisabled()
      })

      await test.step('Cancel activation', async () => {
        const cancelButton = page.locator('button:has-text("Cancel")')
        await cancelButton.click()
        
        // Dialog should close
        await expect(page.locator('[role="dialog"]')).not.toBeVisible()
        
        // Should still show activate button
        await expect(page.locator('[data-testid="killswitch-button"]')).toContainText('ACTIVATE KILL SWITCH')
      })
    })
  })

  test.describe('Kill Switch Deactivation', () => {
    test('should deactivate kill switch when active', async () => {
      await test.step('Setup active kill switch state', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: true,
              activatedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
              activatedBy: 'command-center-killswitch',
              reason: 'Emergency production issue',
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify active state UI', async () => {
        // Should show frozen banner
        await expect(page.locator('.bg-red-500\\/10')).toContainText('SYSTEM FROZEN')
        
        // Should show ACTIVE badge
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('ACTIVE')
        
        // Should show deactivate button
        const deactivateButton = page.locator('button:has-text("DEACTIVATE KILL SWITCH")')
        await expect(deactivateButton).toBeVisible()
        
        // Should show quick unfreeze button in banner
        await expect(page.locator('[data-testid="quick-unfreeze-button"]')).toBeVisible()
      })

      await test.step('Start deactivation process', async () => {
        const deactivateButton = page.locator('button:has-text("DEACTIVATE KILL SWITCH")')
        await deactivateButton.click()

        // Dialog should appear
        await page.waitForSelector('[role="dialog"]')
        await expect(page.locator('[role="dialog"]')).toContainText('Confirm Kill Switch Deactivation')
        await expect(page.locator('[role="dialog"]')).toContainText('restore normal system operations')
      })

      await test.step('Complete deactivation', async () => {
        // Fill reason
        const reasonTextarea = page.locator('[role="dialog"] textarea')
        await reasonTextarea.fill('Issue resolved - safe to resume normal operations')

        // Mock deactivation API
        let deactivationCalled = false
        await page.route('/api/ops/system/freeze', async route => {
          if (route.request().method() === 'POST') {
            deactivationCalled = true
            await route.fulfill({
              json: {
                success: true,
                action: 'deactivate',
                systemFreeze: false,
                timestamp: new Date().toISOString(),
                reason: 'Issue resolved - safe to resume normal operations',
                configsUpdated: ['SYSTEM_FREEZE'],
                auditLogged: true,
                message: 'Kill switch deactivated successfully'
              }
            })
          }
        })

        // Mock updated inactive status
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        // Confirm deactivation
        const confirmButton = page.locator('button:has-text("CONFIRM DEACTIVATION")')
        await confirmButton.click()

        await page.waitForTimeout(2000)
        expect(deactivationCalled).toBe(true)
      })

      await test.step('Verify deactivated state', async () => {
        // Should show success toast
        await expect(page.locator('.toast')).toContainText('Kill Switch Deactivated')

        // Banner should be gone
        await expect(page.locator('.bg-red-500\\/10')).not.toBeVisible()

        // Should show STANDBY badge
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('STANDBY')
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('SYSTEM_FREEZE = false')

        // Should show activate button again
        await expect(page.locator('[data-testid="killswitch-button"]')).toContainText('ACTIVATE KILL SWITCH')
      })
    })

    test('should allow quick unfreeze from banner', async () => {
      await test.step('Setup active state with banner', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: true,
              activatedAt: new Date().toISOString(),
              activatedBy: 'test-user',
              reason: 'Test freeze',
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()
        await expect(page.locator('.bg-red-500\\/10')).toBeVisible()
      })

      await test.step('Use quick unfreeze button', async () => {
        const quickUnfreezeButton = page.locator('[data-testid="quick-unfreeze-button"]')
        await quickUnfreezeButton.click()

        // Should open deactivation dialog
        await page.waitForSelector('[role="dialog"]')
        await expect(page.locator('[role="dialog"]')).toContainText('Confirm Kill Switch Deactivation')
      })
    })
  })

  test.describe('System State Integration', () => {
    test('should block operations when kill switch is active', async () => {
      await test.step('Activate kill switch', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: true,
              activatedAt: new Date().toISOString(),
              activatedBy: 'admin',
              reason: 'System maintenance',
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()
      })

      await test.step('Verify operational restrictions', async () => {
        // System frozen banner should be visible
        await expect(page.locator('.bg-red-500\\/10')).toContainText('SYSTEM FROZEN')
        await expect(page.locator('.bg-red-500\\/10')).toContainText('All deployments and critical operations are blocked')

        // Check that dangerous operations are disabled (if visible)
        const dangerousOp = page.locator('[data-testid="dangerous-operation"]')
        if (await dangerousOp.isVisible()) {
          await expect(dangerousOp).toBeDisabled()
        }
      })
    })

    test('should show system configuration status', async () => {
      await test.step('Check inactive configuration display', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()

        // Should show current config status
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('SYSTEM_FREEZE = false')
      })

      await test.step('Check active configuration display', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: true,
              activatedAt: new Date().toISOString(),
              activatedBy: 'admin',
              reason: 'Emergency freeze',
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()

        // Should show active config status
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('SYSTEM_FREEZE = true')
        await expect(page.locator('[data-testid="killswitch-button"]').locator('..')).toContainText('admin')
        await expect(page.locator('.bg-red-500\\/10')).toContainText('Emergency freeze')
      })
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API failures gracefully', async () => {
      await test.step('Mock API error on activation', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()

        // Click kill switch
        await page.locator('[data-testid="killswitch-button"]').click()
        
        // Fill dialog
        await page.waitForSelector('[role="dialog"]')
        const reasonTextarea = page.locator('[role="dialog"] textarea')
        await reasonTextarea.fill('Test activation')

        // Mock API failure
        await page.route('/api/ops/system/freeze', async route => {
          await route.fulfill({
            status: 500,
            json: { error: 'Internal server error' }
          })
        })

        // Confirm activation
        const confirmButton = page.locator('button:has-text("CONFIRM ACTIVATION")')
        await confirmButton.click()
      })

      await test.step('Verify error handling', async () => {
        // Should show error toast
        await page.waitForTimeout(2000)
        await expect(page.locator('.toast')).toContainText('Activation Failed')

        // Dialog should close
        await expect(page.locator('[role="dialog"]')).not.toBeVisible()

        // Should remain in inactive state
        await expect(page.locator('[data-testid="killswitch-button"]')).toContainText('ACTIVATE KILL SWITCH')
      })
    })

    test('should handle status fetch failures', async () => {
      await test.step('Mock status API failure', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            status: 500,
            json: { error: 'Failed to fetch status' }
          })
        })

        await page.reload()
      })

      await test.step('Verify graceful degradation', async () => {
        // Kill switch panel should still be visible
        const panel = page.locator('[data-testid="killswitch-button"]').locator('..')
        await expect(panel).toBeVisible()

        // Should show last checked time even if fetch fails
        await expect(panel).toContainText('Last Checked')

        // Button should still be functional
        await expect(page.locator('[data-testid="killswitch-button"]')).toBeVisible()
      })
    })

    test('should handle network connectivity issues', async () => {
      await test.step('Simulate network issues', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.abort('failed')
        })

        await page.reload()
      })

      await test.step('Verify graceful handling', async () => {
        // Panel should not crash
        const panel = page.locator('[data-testid="killswitch-button"]').locator('..')
        await expect(panel).toBeVisible()

        // Should not show error state visually
        await expect(panel).not.toHaveClass(/error/)
      })
    })
  })

  test.describe('Accessibility and UX', () => {
    test('should be keyboard accessible', async () => {
      await test.step('Navigate with keyboard', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()

        // Tab to kill switch button
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')
        // Keep tabbing until we reach the kill switch button
        const killSwitchButton = page.locator('[data-testid="killswitch-button"]')
        await killSwitchButton.focus()

        // Should be focusable
        await expect(killSwitchButton).toBeFocused()

        // Enter should activate
        await page.keyboard.press('Enter')
        await page.waitForSelector('[role="dialog"]')
      })
    })

    test('should have proper ARIA attributes', async () => {
      await test.step('Check accessibility attributes', async () => {
        await page.route('/api/ops/system/freeze/status', async route => {
          await route.fulfill({
            json: {
              active: false,
              activatedAt: null,
              activatedBy: null,
              reason: null,
              lastChecked: new Date().toISOString()
            }
          })
        })

        await page.reload()

        // Kill switch button should have proper attributes
        const killSwitchButton = page.locator('[data-testid="killswitch-button"]')
        await expect(killSwitchButton).toHaveAttribute('type', 'button')
        
        // Should be properly labeled
        await expect(killSwitchButton).toContainText('ACTIVATE KILL SWITCH')
      })
    })
  })
})