import { test, expect } from '@playwright/test'

test.describe('Comprehensive E2E Testing - All Pages & Components', () => {
  
  test('Full Dashboard Page Testing', async ({ page }) => {
    console.log('🏠 Testing Main Dashboard...')
    
    await page.goto('/dashboard')
    await page.screenshot({ path: 'tests/screenshots/dashboard-full.png', fullPage: true })
    
    // Test header elements
    console.log('📊 Testing Dashboard Header...')
    const headerTitle = await page.locator('h1').textContent()
    console.log(`   Header title: "${headerTitle}"`)
    
    // Test metrics cards
    console.log('📈 Testing Metrics Cards...')
    const metricsCards = await page.locator('[class*="metric-card"], .metric-card').count()
    console.log(`   Metrics cards found: ${metricsCards}`)
    
    // Test each metric card for content
    for (let i = 0; i < Math.min(metricsCards, 4); i++) {
      const cardTitle = await page.locator('[class*="metric-card"], .metric-card').nth(i).locator('h3, [class*="CardTitle"]').textContent().catch(() => 'No title')
      const cardValue = await page.locator('[class*="metric-card"], .metric-card').nth(i).locator('.text-2xl, [class*="font-bold"]').textContent().catch(() => 'No value')
      console.log(`   Card ${i+1}: "${cardTitle}" = "${cardValue}"`)
    }
    
    // Test agent status section
    console.log('🤖 Testing Agent Status Section...')
    const agentSection = await page.getByText('Agent Status').isVisible()
    console.log(`   Agent section visible: ${agentSection}`)
    
    if (agentSection) {
      const agentItems = await page.locator('[class*="agent"], [data-testid*="agent"]').count()
      console.log(`   Agent items found: ${agentItems}`)
    }
    
    // Test recent activity section
    console.log('⏰ Testing Recent Activity Section...')
    const activitySection = await page.getByText('Recent Activity').isVisible()
    console.log(`   Activity section visible: ${activitySection}`)
    
    // Test quick actions
    console.log('⚡ Testing Quick Actions...')
    const quickActions = await page.getByText('Quick Actions').isVisible()
    console.log(`   Quick actions visible: ${quickActions}`)
    
    // Check for loading states or errors
    const loadingSpinners = await page.locator('[class*="animate-spin"]').count()
    const errorMessages = await page.locator('[class*="error"], .text-red').count()
    console.log(`   Loading spinners: ${loadingSpinners}`)
    console.log(`   Error messages: ${errorMessages}`)
  })

  test('User Management Page Testing', async ({ page }) => {
    console.log('👥 Testing User Management Page...')
    
    await page.goto('/dashboard/users')
    await page.screenshot({ path: 'tests/screenshots/users-full.png', fullPage: true })
    
    // Check if page loads
    const pageTitle = await page.locator('h1, h2').first().textContent().catch(() => 'No title')
    console.log(`   Page title: "${pageTitle}"`)
    
    // Test user table/list
    const userRows = await page.locator('tr, [class*="user-row"], [data-testid*="user"]').count()
    console.log(`   User rows found: ${userRows}`)
    
    // Test filters/controls
    const filterInputs = await page.locator('input[type="text"], select').count()
    console.log(`   Filter inputs: ${filterInputs}`)
    
    // Test action buttons
    const actionButtons = await page.locator('button').count()
    console.log(`   Action buttons: ${actionButtons}`)
    
    // Check for data loading
    const hasUserData = await page.getByText(/VIP|Premium|Free/).isVisible().catch(() => false)
    console.log(`   User tier data visible: ${hasUserData}`)
    
    // Check for errors
    const errorStates = await page.locator('[class*="error"]').count()
    console.log(`   Error states: ${errorStates}`)
  })

  test('Security Page Testing', async ({ page }) => {
    console.log('🔒 Testing Security Page...')
    
    await page.goto('/dashboard/security')
    await page.screenshot({ path: 'tests/screenshots/security-full.png', fullPage: true })
    
    const pageTitle = await page.locator('h1, h2').first().textContent().catch(() => 'No title')
    console.log(`   Page title: "${pageTitle}"`)
    
    // Test security events
    const securityEvents = await page.locator('[class*="security"], [class*="event"]').count()
    console.log(`   Security events found: ${securityEvents}`)
    
    // Test severity indicators
    const severityBadges = await page.locator('[class*="badge"], [class*="severity"]').count()
    console.log(`   Severity badges: ${severityBadges}`)
    
    // Test real-time indicators
    const realtimeData = await page.getByText(/ago|minutes|hours/).isVisible().catch(() => false)
    console.log(`   Real-time data visible: ${realtimeData}`)
    
    const errorStates = await page.locator('[class*="error"]').count()
    console.log(`   Error states: ${errorStates}`)
  })

  test('Phase D Analytics Page Testing', async ({ page }) => {
    console.log('📊 Testing Phase D Analytics Page...')
    
    await page.goto('/dashboard/phase-d')
    await page.screenshot({ path: 'tests/screenshots/phase-d-full.png', fullPage: true })
    
    const pageTitle = await page.locator('h1, h2').first().textContent().catch(() => 'No title')
    console.log(`   Page title: "${pageTitle}"`)
    
    // Test charts/visualizations
    const charts = await page.locator('canvas, svg, [class*="chart"]').count()
    console.log(`   Charts/visualizations: ${charts}`)
    
    // Test analytics cards
    const analyticsCards = await page.locator('[class*="card"], [class*="metric"]').count()
    console.log(`   Analytics cards: ${analyticsCards}`)
    
    const errorStates = await page.locator('[class*="error"]').count()
    console.log(`   Error states: ${errorStates}`)
  })

  test('Navigation Testing', async ({ page }) => {
    console.log('🧭 Testing Navigation...')
    
    await page.goto('/dashboard')
    
    // Test sidebar navigation
    const sidebarLinks = await page.locator('nav a, [role="navigation"] a').count()
    console.log(`   Sidebar links found: ${sidebarLinks}`)
    
    // Test each navigation link
    const navItems = ['Users', 'Security', 'Phase D', 'Analytics']
    
    for (const item of navItems) {
      console.log(`   Testing navigation to ${item}...`)
      const linkExists = await page.getByText(item).isVisible().catch(() => false)
      console.log(`     ${item} link visible: ${linkExists}`)
      
      if (linkExists) {
        try {
          await page.getByText(item).click({ timeout: 5000 })
          await page.waitForLoadState('networkidle', { timeout: 10000 })
          const currentUrl = page.url()
          console.log(`     Navigated to: ${currentUrl}`)
          
          // Check if page loaded correctly
          const hasContent = await page.locator('h1, h2').isVisible({ timeout: 5000 })
          console.log(`     Page has content: ${hasContent}`)
        } catch (error) {
          console.log(`     Navigation failed: ${error.message}`)
        }
      }
    }
  })

  test('API Endpoints Testing', async ({ page }) => {
    console.log('🔌 Testing API Endpoints...')
    
    // Test sync endpoint
    console.log('   Testing /api/sync endpoint...')
    const syncResponse = await page.request.get('/api/sync?source=agents')
    console.log(`   Sync API status: ${syncResponse.status()}`)
    
    if (syncResponse.ok()) {
      const syncData = await syncResponse.json()
      console.log(`   Sync response success: ${syncData.success}`)
      console.log(`   Using mock data: ${syncData.usingMockData}`)
    }
    
    // Test other potential API endpoints
    const endpoints = ['/api/users', '/api/agents', '/api/security', '/api/analytics']
    
    for (const endpoint of endpoints) {
      try {
        const response = await page.request.get(endpoint)
        console.log(`   ${endpoint}: ${response.status()}`)
      } catch (error) {
        console.log(`   ${endpoint}: Not implemented or error`)
      }
    }
  })

  test('Component Functionality Testing', async ({ page }) => {
    console.log('🧩 Testing Component Functionality...')
    
    await page.goto('/dashboard')
    
    // Test refresh buttons
    console.log('   Testing refresh functionality...')
    const refreshButtons = await page.locator('button:has-text("Refresh"), [data-testid*="refresh"]').count()
    console.log(`   Refresh buttons found: ${refreshButtons}`)
    
    if (refreshButtons > 0) {
      try {
        await page.locator('button:has-text("Refresh")').first().click()
        console.log('   Refresh button clicked successfully')
      } catch (error) {
        console.log(`   Refresh button click failed: ${error.message}`)
      }
    }
    
    // Test sync status component
    console.log('   Testing sync status...')
    const syncStatus = await page.locator('[class*="sync"], [data-testid*="sync"]').count()
    console.log(`   Sync status components: ${syncStatus}`)
    
    // Test connection indicators
    const connectionIndicators = await page.locator('[class*="connection"], [class*="indicator"]').count()
    console.log(`   Connection indicators: ${connectionIndicators}`)
    
    // Test modal/dialog functionality
    console.log('   Testing modals/dialogs...')
    const modalTriggers = await page.locator('button:has-text("Edit"), button:has-text("Add"), button:has-text("Delete")').count()
    console.log(`   Modal trigger buttons: ${modalTriggers}`)
  })

  test('Error Handling & Edge Cases', async ({ page }) => {
    console.log('⚠️  Testing Error Handling...')
    
    // Test non-existent routes
    const badRoutes = ['/dashboard/nonexistent', '/api/nonexistent']
    
    for (const route of badRoutes) {
      console.log(`   Testing ${route}...`)
      const response = await page.goto(route, { waitUntil: 'networkidle' })
      console.log(`   Status: ${response?.status()}`)
    }
    
    // Test empty states
    await page.goto('/dashboard')
    
    const emptyStates = await page.locator('[class*="empty"], [class*="no-data"]').count()
    console.log(`   Empty state components: ${emptyStates}`)
    
    // Test loading states
    const loadingStates = await page.locator('[class*="loading"], [class*="skeleton"]').count()
    console.log(`   Loading state components: ${loadingStates}`)
  })

  test('Console Errors & Network Issues', async ({ page }) => {
    console.log('🔍 Testing Console Errors & Network Issues...')
    
    const errors: string[] = []
    const networkErrors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        networkErrors.push(`${response.status()} - ${response.url()}`)
      }
    })
    
    // Navigate through all pages
    const pages = ['/dashboard', '/dashboard/users', '/dashboard/security', '/dashboard/phase-d']
    
    for (const pagePath of pages) {
      await page.goto(pagePath, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000) // Wait for any async operations
    }
    
    console.log(`   Console errors found: ${errors.length}`)
    errors.forEach(error => console.log(`     - ${error}`))
    
    console.log(`   Network errors found: ${networkErrors.length}`)
    networkErrors.forEach(error => console.log(`     - ${error}`))
    
    // Summary
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('_next/static') &&
      !e.includes('404')
    )
    
    console.log(`   Critical errors: ${criticalErrors.length}`)
    criticalErrors.forEach(error => console.log(`     CRITICAL: ${error}`))
  })
})