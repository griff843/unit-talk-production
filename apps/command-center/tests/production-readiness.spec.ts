import { test, expect } from '@playwright/test';

test.describe('Production Readiness Verification', () => {
  
  test('server is running and responding', async ({ page }) => {
    console.log('🏥 Testing server health...');
    
    // Test health endpoint
    const healthResponse = await page.request.get('/api/health');
    expect(healthResponse.status()).toBe(200);
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBeTruthy();
    console.log('✅ Health endpoint responding:', healthData.status);
  });

  test('dashboard loads successfully', async ({ page }) => {
    console.log('📊 Testing dashboard loading...');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check if page loads without errors
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    
    // Check for key navigation elements
    await expect(page.locator('text=Command Center')).toBeVisible();
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Agent Control')).toBeVisible();
    
    console.log('✅ Dashboard loaded successfully');
  });

  test('API endpoints are responding', async ({ page }) => {
    console.log('🔌 Testing API endpoints...');
    
    const endpoints = [
      '/api/health',
      '/api/analytics',
      '/api/users',
      '/api/agents',
      '/api/security',
      '/api/system'
    ];
    
    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      expect(response.status()).toBeLessThan(500);
      console.log(`✅ ${endpoint}: ${response.status()}`);
    }
  });

  test('navigation works correctly', async ({ page }) => {
    console.log('🧭 Testing navigation...');
    
    await page.goto('/dashboard');
    
    // Test navigation to different pages
    await page.locator('a[href="/dashboard/users"]').click();
    await expect(page).toHaveURL('/dashboard/users');
    
    await page.locator('a[href="/dashboard/agents"]').click();
    await expect(page).toHaveURL('/dashboard/agents');
    
    await page.locator('a[href="/dashboard/analytics"]').click();
    await expect(page).toHaveURL('/dashboard/analytics');
    
    console.log('✅ Navigation working correctly');
  });

  test('no console errors on main pages', async ({ page }) => {
    console.log('🚫 Testing for console errors...');
    
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    const pages = ['/dashboard', '/dashboard/users', '/dashboard/agents', '/dashboard/analytics'];
    
    for (const testPage of pages) {
      await page.goto(testPage);
      await page.waitForLoadState('networkidle');
    }
    
    // Allow some React hydration warnings but no critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('hydration') &&
      !error.includes('useEffect')
    );
    
    expect(criticalErrors.length).toBe(0);
    console.log('✅ No critical console errors found');
  });

});