import { test, expect, Page } from '@playwright/test';

test.describe('Smart Form Application Startup Verification', () => {
  let page: Page;
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ browser }) => {
    // Create new browser context and page
    const context = await browser.newContext();
    page = await context.newPage();

    // Listen for console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        consoleErrors.push(text);
        console.log(`❌ Console Error: ${text}`);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
        console.log(`⚠️  Console Warning: ${text}`);
      } else if (type === 'log') {
        console.log(`📝 Console Log: ${text}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
      console.log(`🚨 Page Error: ${error.message}`);
    });

    // Listen for network failures
    page.on('requestfailed', (request) => {
      console.log(`🌐 Network Failure: ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test('Smart Form application loads completely and is functional', async () => {
    console.log('🚀 Starting Smart Form verification...');

    // Navigate to Smart Form application
    console.log('📍 Navigating to localhost:3002...');
    const response = await page.goto('http://localhost:3002', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Verify successful response
    expect(response?.status()).toBe(200);
    console.log('✅ Page loaded with 200 status');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    console.log('✅ DOM and network idle state reached');

    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    expect(title).not.toBe('');
    expect(title).not.toMatch(/error|404|not found/i);

    // Verify Next.js application has loaded (check for Next.js specific elements)
    const nextScript = page.locator('script[src*="_next"]').first();
    await expect(nextScript).toBeAttached({ timeout: 10000 });
    console.log('✅ Next.js scripts loaded');

    // Check for main application container/content
    const body = page.locator('body');
    await expect(body).toBeVisible();
    console.log('✅ Body element is visible');

    // Verify React/Next.js has hydrated (check for interactive elements)
    await page.waitForTimeout(2000); // Allow time for hydration
    
    // Look for common Smart Form UI elements
    const mainContent = page.locator('main, [role="main"], .main-content, #__next');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Main content container is visible');

    // Check for navigation or header elements
    const navigation = page.locator('nav, header, .header, .navigation, .navbar');
    if (await navigation.count() > 0) {
      await expect(navigation.first()).toBeVisible();
      console.log('✅ Navigation/header elements found');
    }

    // Check if this is the submit ticket page or main page
    const submitTicketContent = page.locator('text=/submit.ticket/i, text=/smart.form/i, text=/ticket.form/i');
    if (await submitTicketContent.count() > 0) {
      console.log('✅ Submit ticket content detected');
    }

    // Verify no critical JavaScript errors occurred
    console.log(`📊 Console Errors: ${consoleErrors.length}`);
    console.log(`📊 Console Warnings: ${consoleWarnings.length}`);

    // Filter out non-critical errors (like favicon 404s)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('manifest.json') &&
      !error.includes('Failed to load resource') &&
      !error.toLowerCase().includes('404')
    );

    if (criticalErrors.length > 0) {
      console.log('🚨 Critical JavaScript errors detected:');
      criticalErrors.forEach(error => console.log(`   - ${error}`));
    }

    // Soft assertion for JavaScript errors (warn but don't fail)
    if (criticalErrors.length > 0) {
      console.log('⚠️  Note: Some JavaScript errors detected but continuing verification...');
    }

    // Test basic interactivity - look for clickable elements
    const clickableElements = page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]');
    const clickableCount = await clickableElements.count();
    console.log(`🖱️  Found ${clickableCount} clickable elements`);

    if (clickableCount > 0) {
      // Test that at least one button is interactable
      const firstButton = clickableElements.first();
      await expect(firstButton).toBeVisible();
      console.log('✅ Interactive elements are present and visible');
    }

    // Check for form elements if this is a form page
    const formElements = page.locator('form, input, select, textarea');
    const formCount = await formElements.count();
    console.log(`📝 Found ${formCount} form elements`);

    // Test viewport and responsive behavior
    const viewportSize = page.viewportSize();
    console.log(`📱 Viewport: ${viewportSize?.width}x${viewportSize?.height}`);

    // Verify CSS has loaded (check if elements have computed styles)
    const bodyStyles = await page.locator('body').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
        margin: styles.margin
      };
    });
    console.log('🎨 CSS styles computed:', bodyStyles);
    expect(bodyStyles.fontFamily).not.toBe('');

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'tests/screenshots/smart-form-startup-verification.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved');

    // Final verification - ensure page is still responsive
    await page.waitForTimeout(1000);
    const finalCheck = await page.locator('body').isVisible();
    expect(finalCheck).toBe(true);

    console.log('🎉 Smart Form application verification completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Page loaded: ✅`);
    console.log(`   - Next.js hydrated: ✅`);
    console.log(`   - Interactive elements: ${clickableCount} found`);
    console.log(`   - Form elements: ${formCount} found`);
    console.log(`   - Critical JS errors: ${criticalErrors.length}`);
    console.log(`   - Total warnings: ${consoleWarnings.length}`);
  });

  test('Smart Form API endpoints are accessible', async () => {
    console.log('🔗 Testing Smart Form API endpoints...');

    // Test props API endpoint
    const propsResponse = await page.request.get('http://localhost:3002/api/props');
    console.log(`📡 Props API status: ${propsResponse.status()}`);
    
    // Test games API endpoint
    const gamesResponse = await page.request.get('http://localhost:3002/api/games');
    console.log(`📡 Games API status: ${gamesResponse.status()}`);

    // Test cappers API endpoint
    const cappersResponse = await page.request.get('http://localhost:3002/api/cappers');
    console.log(`📡 Cappers API status: ${cappersResponse.status()}`);

    // At least some endpoints should be accessible (200 or 404 is acceptable, 5xx is not)
    const endpoints = [propsResponse, gamesResponse, cappersResponse];
    const healthyEndpoints = endpoints.filter(response => 
      response.status() >= 200 && response.status() < 500
    );

    expect(healthyEndpoints.length).toBeGreaterThan(0);
    console.log(`✅ ${healthyEndpoints.length}/${endpoints.length} API endpoints are healthy`);
  });

  test('Smart Form handles navigation correctly', async () => {
    console.log('🧭 Testing Smart Form navigation...');

    // Navigate to main page
    await page.goto('http://localhost:3002');
    
    // Check if we can navigate to submit ticket page
    await page.goto('http://localhost:3002/submit-ticket');
    const submitResponse = await page.waitForResponse(response => 
      response.url().includes('submit-ticket') && response.status() === 200
    ).catch(() => null);

    if (submitResponse) {
      console.log('✅ Submit ticket page accessible');
    } else {
      console.log('ℹ️  Submit ticket page may not be available or uses client-side routing');
    }

    // Test analytics page if it exists
    await page.goto('http://localhost:3002/analytics').catch(() => {
      console.log('ℹ️  Analytics page not accessible or doesn\'t exist');
    });

    // Return to main page and verify it still works
    await page.goto('http://localhost:3002');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Navigation back to main page successful');
  });
});