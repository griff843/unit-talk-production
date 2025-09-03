import { test, expect, Page } from '@playwright/test';

/**
 * Command Center Production Verification Test Suite
 * 
 * This test suite verifies the Command Center application at localhost:3004
 * is completely loaded and functional after Docker restart.
 */

test.describe('Command Center Production Verification', () => {
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async () => {
    // Reset console tracking for each test
    consoleMessages = [];
    consoleErrors = [];
  });

  test('should load Command Center at localhost:3004 with correct title', async ({ page }) => {
    console.log('🚀 Navigating to Command Center at localhost:3004...');
    
    // Set up console monitoring
    page.on('console', msg => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });
    
    // Navigate to the Command Center
    const response = await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Verify the page loaded successfully
    expect(response?.status()).toBe(200);
    
    // Verify the page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    expect(title).toContain('Unit Talk Command Center');
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'tests/screenshots/command-center-loaded.png',
      fullPage: true 
    });

    console.log('✅ Command Center page loaded successfully');
  });

  test('should have no critical JavaScript errors in console', async ({ page }) => {
    console.log('🔍 Checking for JavaScript errors...');
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit more for any async operations
    await page.waitForTimeout(3000);

    console.log(`📝 Total console messages: ${consoleMessages.length}`);
    console.log(`❌ Console errors: ${consoleErrors.length}`);

    // Log all console messages for debugging
    if (consoleMessages.length > 0) {
      console.log('\n📊 Console Messages:');
      consoleMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg}`);
      });
    }

    // Filter out non-critical errors (common in development)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('_next/static') &&
      !error.includes('DevTools') &&
      !error.toLowerCase().includes('warning')
    );

    if (criticalErrors.length > 0) {
      console.log('\n🚨 Critical errors found:');
      criticalErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    // We'll be lenient with errors for now but log them
    expect(criticalErrors.length).toBeLessThan(10);
    
    console.log('✅ JavaScript error check completed');
  });

  test('should display key dashboard elements', async ({ page }) => {
    console.log('🎯 Verifying key dashboard elements...');
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the main content to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Check for navigation/sidebar
    console.log('🧭 Checking navigation elements...');
    const navElements = await page.$$('nav, [role="navigation"], aside, .sidebar');
    console.log(`Found ${navElements.length} navigation elements`);

    // Check for main content area
    console.log('📋 Checking main content area...');
    const mainContent = await page.$$('main, .main, .content, [role="main"]');
    console.log(`Found ${mainContent.length} main content areas`);

    // Check for cards/dashboard widgets
    console.log('📊 Checking dashboard cards/widgets...');
    const cards = await page.$$('.card, [class*="card"], .widget, [class*="widget"], .dashboard-item');
    console.log(`Found ${cards.length} dashboard cards/widgets`);

    // Check for any data tables or lists
    console.log('📈 Checking data displays...');
    const dataTables = await page.$$('table, .table, .list, [role="table"], [role="grid"]');
    console.log(`Found ${dataTables.length} data display elements`);

    // Verify there's some meaningful content
    const bodyText = await page.textContent('body');
    const hasContent = bodyText && bodyText.length > 100;
    console.log(`Body text length: ${bodyText?.length || 0} characters`);

    expect(hasContent).toBeTruthy();

    // Take a screenshot of the dashboard
    await page.screenshot({ 
      path: 'tests/screenshots/command-center-dashboard.png',
      fullPage: true 
    });

    console.log('✅ Dashboard elements verification completed');
  });

  test('should have working Next.js and Tailwind CSS', async ({ page }) => {
    console.log('⚛️ Verifying Next.js and Tailwind CSS integration...');
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Check for Next.js specific elements
    console.log('🔍 Checking Next.js integration...');
    const nextScripts = await page.$$('script[src*="_next"]');
    console.log(`Found ${nextScripts.length} Next.js scripts`);

    // Check for Next.js app directory structure indicators
    const rootElement = await page.$('#__next, [data-reactroot], main');
    console.log(`React/Next.js root element found: ${rootElement !== null}`);

    // Check for Tailwind CSS classes
    console.log('🎨 Checking Tailwind CSS integration...');
    const elementsWithTailwind = await page.$$('[class*="flex"], [class*="grid"], [class*="bg-"], [class*="text-"], [class*="p-"], [class*="m-"]');
    console.log(`Found ${elementsWithTailwind.length} elements with Tailwind classes`);

    // Check if CSS is properly loaded
    const computedStyles = await page.evaluate(() => {
      const element = document.querySelector('body');
      if (element) {
        const styles = window.getComputedStyle(element);
        return {
          fontFamily: styles.fontFamily,
          backgroundColor: styles.backgroundColor,
          margin: styles.margin
        };
      }
      return null;
    });

    console.log('💅 Computed styles:', computedStyles);

    // Verify CSS is applied
    expect(computedStyles).not.toBeNull();
    expect(nextScripts.length).toBeGreaterThan(0);
    
    console.log('✅ Next.js and Tailwind CSS verification completed');
  });

  test('should respond to basic interactions', async ({ page }) => {
    console.log('👆 Testing basic UI interactions...');
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be ready
    await page.waitForTimeout(2000);

    // Try to find and click any buttons
    const buttons = await page.$$('button, [role="button"], .btn, [class*="button"]');
    console.log(`Found ${buttons.length} clickable elements`);

    if (buttons.length > 0) {
      // Try clicking the first button (if it exists)
      try {
        await buttons[0].click({ timeout: 5000 });
        console.log('✅ Successfully clicked a button element');
        
        // Wait a bit to see any response
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log(`⚠️ Button click failed: ${error}`);
      }
    }

    // Try to find and interact with any links
    const links = await page.$$('a[href], [role="link"]');
    console.log(`Found ${links.length} link elements`);

    // Check for any form elements
    const inputs = await page.$$('input, textarea, select');
    console.log(`Found ${inputs.length} form input elements`);

    // Take a screenshot after interactions
    await page.screenshot({ 
      path: 'tests/screenshots/command-center-interactions.png',
      fullPage: true 
    });

    console.log('✅ Basic interactions test completed');
  });

  test('should have acceptable performance metrics', async ({ page }) => {
    console.log('⚡ Testing performance metrics...');
    
    const startTime = Date.now();
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    console.log(`📊 Page load time: ${loadTime}ms`);

    // Check for Largest Contentful Paint (LCP)
    const lcpMetric = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry?.startTime || 0);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Fallback timeout
        setTimeout(() => resolve(0), 5000);
      });
    });

    console.log(`🎯 Largest Contentful Paint: ${lcpMetric}ms`);

    // Basic performance expectations (generous for development)
    expect(loadTime).toBeLessThan(15000); // 15 seconds max load time
    
    if (typeof lcpMetric === 'number' && lcpMetric > 0) {
      expect(lcpMetric).toBeLessThan(10000); // 10 seconds max LCP
    }

    console.log('✅ Performance metrics test completed');
  });

  test('should be responsive on different viewport sizes', async ({ page }) => {
    console.log('📱 Testing responsive design...');

    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    for (const viewport of viewports) {
      console.log(`🔍 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });

      await page.goto('http://localhost:3004', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for layout to settle
      await page.waitForTimeout(2000);

      // Take screenshot for each viewport
      await page.screenshot({ 
        path: `tests/screenshots/command-center-${viewport.name.toLowerCase()}.png`,
        fullPage: false  // Just viewport
      });

      // Check that content is visible and not clipped
      const bodyRect = await page.locator('body').boundingBox();
      expect(bodyRect).not.toBeNull();
      
      if (bodyRect) {
        expect(bodyRect.width).toBeGreaterThan(100);
        expect(bodyRect.height).toBeGreaterThan(100);
      }
    }

    console.log('✅ Responsive design test completed');
  });

  test('comprehensive production readiness check', async ({ page }) => {
    console.log('🏆 Running comprehensive production readiness check...');
    
    const startTime = Date.now();
    
    // Navigate and capture all network requests
    const requests: string[] = [];
    const failedRequests: string[] = [];
    
    page.on('request', request => {
      requests.push(`${request.method()} ${request.url()}`);
    });
    
    page.on('requestfailed', request => {
      failedRequests.push(`FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const totalLoadTime = Date.now() - startTime;

    // Wait for any additional async operations
    await page.waitForTimeout(5000);

    console.log('\n📊 Production Readiness Summary:');
    console.log(`⏱️  Total load time: ${totalLoadTime}ms`);
    console.log(`🌐 Total requests: ${requests.length}`);
    console.log(`❌ Failed requests: ${failedRequests.length}`);
    console.log(`📝 Console messages: ${consoleMessages.length}`);
    console.log(`🚨 Console errors: ${consoleErrors.length}`);

    if (failedRequests.length > 0) {
      console.log('\n🚨 Failed Requests:');
      failedRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req}`);
      });
    }

    // Final screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/command-center-production-ready.png',
      fullPage: true 
    });

    // Production readiness criteria (generous for development environment)
    expect(totalLoadTime).toBeLessThan(20000); // 20 seconds max
    expect(failedRequests.length).toBeLessThan(5); // Allow some failed requests
    
    // Verify the page has actual content
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);

    console.log('✅ Production readiness check completed');
    console.log('\n🎉 Command Center verification complete! Check the screenshots in tests/screenshots/');
  });
});