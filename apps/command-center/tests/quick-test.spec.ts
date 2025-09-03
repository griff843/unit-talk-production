import { test, expect } from '@playwright/test'

test('quick verification', async ({ page }) => {
  try {
    console.log('🔍 Navigating to homepage...')
    await page.goto('http://localhost:3020', { timeout: 10000 })
    
    console.log('📸 Taking screenshot...')
    await page.screenshot({ path: 'tests/screenshots/quick-test.png', fullPage: true })
    
    console.log('🎯 Looking for content...')
    const title = await page.title()
    console.log(`   Page title: "${title}"`)
    
    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => 'Not found')
    console.log(`   H1 content: "${h1}"`)
    
    const hasCommandCenter = await page.getByText('Command Center').first().isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`   Command Center visible: ${hasCommandCenter}`)
    
    console.log('✅ Quick test completed successfully')
  } catch (error) {
    console.error('❌ Quick test failed:', error)
    await page.screenshot({ path: 'tests/screenshots/quick-test-error.png', fullPage: true })
    throw error
  }
})