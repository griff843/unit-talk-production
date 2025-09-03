import { test, expect } from '@playwright/test'

test('verify server is actually running', async ({ page }) => {
  console.log('🔍 Testing server connection...')
  
  try {
    // Try to connect with a longer timeout
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 })
    console.log('✅ Successfully connected to server')
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/actual-verification.png', fullPage: true })
    
    // Check for basic elements
    const title = await page.title()
    console.log(`📄 Page title: "${title}"`)
    
    // Check if React has rendered
    const bodyContent = await page.textContent('body')
    console.log(`📝 Body has content: ${bodyContent ? bodyContent.length > 100 : false}`)
    
    // Check for specific Unit Talk elements
    const hasUnitTalk = await page.getByText('Unit Talk').isVisible().catch(() => false)
    const hasCommandCenter = await page.getByText('Command Center').isVisible().catch(() => false)
    const hasDashboard = await page.getByText('Dashboard').isVisible().catch(() => false)
    
    console.log(`🎯 Unit Talk found: ${hasUnitTalk}`)
    console.log(`🎯 Command Center found: ${hasCommandCenter}`)  
    console.log(`🎯 Dashboard found: ${hasDashboard}`)
    
    if (hasCommandCenter || hasDashboard) {
      console.log('✅ APPLICATION IS ACTUALLY WORKING!')
    } else {
      console.log('⚠️  Server responds but content may not be rendering correctly')
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    throw error
  }
})