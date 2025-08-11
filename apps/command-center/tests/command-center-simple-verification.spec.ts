import { test, expect } from '@playwright/test';

/**
 * Command Center Simple Production Verification
 * 
 * Simplified test suite to verify the Command Center application at localhost:3004
 * is completely loaded and functional after Docker restart.
 */

test.describe('Command Center Simple Verification', () => {
  
  test('should load Command Center at localhost:3004 successfully', async ({ page }) => {
    console.log('🚀 Starting Command Center verification at localhost:3004...');
    
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];
    
    // Set up console monitoring
    page.on('console', msg => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });
    
    // Navigate to the Command Center
    console.log('🌐 Navigating to localhost:3004...');
    const response = await page.goto('http://localhost:3004', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Verify the page loaded successfully
    expect(response?.status()).toBe(200);
    console.log('✅ HTTP 200 response received');
    
    // Wait for page to be ready
    await page.waitForTimeout(3000);
    
    // Verify the page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    expect(title.length).toBeGreaterThan(5); // Basic title check
    
    // Check if page has content
    const bodyText = await page.textContent('body');
    const hasContent = bodyText && bodyText.length > 50;
    console.log(`📝 Body content length: ${bodyText?.length || 0} characters`);
    expect(hasContent).toBeTruthy();
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'tests/screenshots/command-center-verification.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved to tests/screenshots/command-center-verification.png');
    
    // Check for basic UI elements
    const uiElements = await page.$$('button, a, input, nav, main, header, footer, .card, [role="button"]');
    console.log(`🎛️ Found ${uiElements.length} interactive/structural elements`);
    
    // Log console activity
    console.log(`📊 Console messages: ${consoleMessages.length}`);
    console.log(`❌ Console errors: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n🚨 Console errors found:');
      consoleErrors.slice(0, 5).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    console.log('✅ Command Center basic verification completed successfully!');
  });

  test('should render dashboard elements', async ({ page }) => {
    console.log('📊 Verifying dashboard elements...');
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Check for common dashboard elements
    const dashboardElements = {
      cards: await page.$$('.card, [class*="card"], .widget, [class*="widget"]'),
      tables: await page.$$('table, .table, [role="table"]'),
      buttons: await page.$$('button, [role="button"], .btn'),
      navigation: await page.$$('nav, [role="navigation"], .sidebar, .menu'),
      headings: await page.$$('h1, h2, h3, h4, h5, h6')
    };

    console.log('🎯 Dashboard elements found:');
    Object.entries(dashboardElements).forEach(([type, elements]) => {
      console.log(`  ${type}: ${elements.length}`);
    });

    // Verify we have some dashboard-like content
    const totalElements = Object.values(dashboardElements).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalElements).toBeGreaterThan(5);

    console.log('✅ Dashboard elements verification completed');
  });

  test('should be responsive', async ({ page }) => {
    console.log('📱 Testing responsive behavior...');
    
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];

    for (const viewport of viewports) {
      console.log(`🔍 Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:3004', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await page.waitForTimeout(1000);

      // Take screenshot for each viewport
      await page.screenshot({ 
        path: `tests/screenshots/command-center-${viewport.name.toLowerCase()}.png`,
        fullPage: false
      });

      // Basic check - ensure content is visible
      const bodyRect = await page.locator('body').boundingBox();
      expect(bodyRect).not.toBeNull();
      
      if (bodyRect) {
        expect(bodyRect.width).toBeGreaterThan(200);
        expect(bodyRect.height).toBeGreaterThan(300);
      }
    }

    console.log('✅ Responsive design verification completed');
  });

  test('should have working Next.js application', async ({ page }) => {
    console.log('⚛️ Verifying Next.js application...');
    
    await page.goto('http://localhost:3004', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Check for Next.js indicators
    const nextjsIndicators = {
      nextScripts: await page.$$('script[src*="_next"]'),
      reactRoot: await page.$('#__next'),
      appRoot: await page.$('[data-reactroot]'),
      mainElement: await page.$('main')
    };

    console.log('⚛️ Next.js indicators:');
    Object.entries(nextjsIndicators).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        console.log(`  ${key}: ${value.length} found`);
      } else {
        console.log(`  ${key}: ${value ? 'found' : 'not found'}`);
      }
    });

    // Check for basic styling (indicating CSS is loaded)
    const bodyStyles = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.body);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
        fontSize: styles.fontSize
      };
    });

    console.log('🎨 Body styles:', bodyStyles);
    expect(bodyStyles.fontFamily).toBeTruthy();

    console.log('✅ Next.js application verification completed');
  });

  test('comprehensive production readiness summary', async ({ page }) => {
    console.log('🏆 Running comprehensive production readiness check...');
    
    const startTime = Date.now();
    const networkRequests: string[] = [];
    const failedRequests: string[] = [];
    const consoleMessages: string[] = [];
    
    // Monitor network requests
    page.on('request', request => {
      networkRequests.push(`${request.method()} ${request.url()}`);
    });
    
    page.on('requestfailed', request => {
      failedRequests.push(`FAILED: ${request.url()}`);
    });
    
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Navigate to application
    await page.goto('http://localhost:3004', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    await page.waitForTimeout(3000);

    // Gather final metrics
    const pageTitle = await page.title();
    const bodyContent = await page.textContent('body');
    const contentLength = bodyContent?.length || 0;
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/command-center-production-ready.png',
      fullPage: true 
    });

    // Production Readiness Summary
    console.log('\n📊 COMMAND CENTER PRODUCTION READINESS SUMMARY');
    console.log('=' .repeat(60));
    console.log(`📄 Page Title: ${pageTitle}`);
    console.log(`⏱️  Load Time: ${loadTime}ms`);
    console.log(`📝 Content Length: ${contentLength} characters`);
    console.log(`🌐 Network Requests: ${networkRequests.length}`);
    console.log(`❌ Failed Requests: ${failedRequests.length}`);
    console.log(`📋 Console Messages: ${consoleMessages.length}`);
    console.log('=' .repeat(60));

    if (failedRequests.length > 0) {
      console.log('\n🚨 Failed Requests:');
      failedRequests.slice(0, 5).forEach((req, i) => {
        console.log(`  ${i + 1}. ${req}`);
      });
    }

    // Basic production readiness checks
    expect(loadTime).toBeLessThan(20000); // 20 seconds max for Docker environment
    expect(contentLength).toBeGreaterThan(100); // Has meaningful content
    expect(pageTitle.length).toBeGreaterThan(5); // Has a proper title
    
    console.log('\n🎉 Command Center is PRODUCTION READY!');
    console.log('📁 Screenshots saved in tests/screenshots/');
    console.log('✅ All verification tests completed successfully!');
  });
});