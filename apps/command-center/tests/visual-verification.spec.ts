import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Visual Verification with Screenshots', () => {
  test('capture and verify all page states', async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
    const screenshotDir = 'tests/screenshots/verification';

    // Create screenshot directory if it doesn't exist
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log(`Starting visual verification at ${timestamp}`);

    // Step 1: Navigate to home page
    console.log('1. Navigating to home page...');
    await page.goto('', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Extra wait for any animations

    await page.screenshot({
      path: `${screenshotDir}/${timestamp}-1-homepage.png`,
      fullPage: true,
    });
    console.log('   ✓ Homepage screenshot captured');

    // Check what's on the page
    const pageUrl = page.url();
    console.log(`   Current URL: ${pageUrl}`);

    // Step 2: Check if we were redirected to dashboard
    if (pageUrl.includes('/dashboard')) {
      console.log('2. Redirected to dashboard - capturing dashboard state...');
    } else {
      console.log('2. No redirect - navigating to dashboard manually...');
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: `${screenshotDir}/${timestamp}-2-dashboard-initial.png`,
      fullPage: true,
    });
    console.log('   ✓ Dashboard screenshot captured');

    // Step 3: Check what elements are visible
    console.log('3. Checking visible elements...');

    // Get the page HTML to see what's actually there
    const htmlContent = await page.content();
    fs.writeFileSync(`${screenshotDir}/${timestamp}-page-content.html`, htmlContent);
    console.log('   ✓ Page HTML captured');

    // Check for specific elements
    const checks = [
      { selector: 'h1', name: 'Any H1 headers' },
      { selector: 'nav', name: 'Navigation' },
      { selector: '.metric-card', name: 'Metric cards' },
      { selector: '[class*="card"]', name: 'Any cards' },
      { selector: 'button', name: 'Buttons' },
      { selector: 'div', name: 'Div elements' },
    ];

    for (const check of checks) {
      const count = await page.locator(check.selector).count();
      console.log(`   - ${check.name}: ${count} found`);

      if (count > 0) {
        // Highlight the first element of this type
        await page
          .locator(check.selector)
          .first()
          .evaluate(el => {
            el.style.border = '3px solid red';
          });
      }
    }

    // Take screenshot with highlights
    await page.screenshot({
      path: `${screenshotDir}/${timestamp}-3-dashboard-highlighted.png`,
      fullPage: true,
    });
    console.log('   ✓ Highlighted elements screenshot captured');

    // Step 4: Check computed styles
    console.log('4. Checking if styles are loaded...');
    const bodyBgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    console.log(`   Body background color: ${bodyBgColor}`);

    // Step 5: Check for any error messages
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('Error') || bodyText.includes('error')) {
      console.log('   ⚠️  Error text found on page');
      console.log(`   Text preview: ${bodyText.substring(0, 200)}...`);
    } else if (bodyText.trim().length < 50) {
      console.log('   ⚠️  Very little text content found');
      console.log(`   Total text length: ${bodyText.length} characters`);
      console.log(`   Text content: "${bodyText.trim()}"`);
    } else {
      console.log('   ✓ Page has content');
      console.log(`   Text preview: ${bodyText.substring(0, 200)}...`);
    }

    // Step 6: Wait and take a final screenshot
    console.log('5. Waiting 5 seconds for any lazy loading...');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: `${screenshotDir}/${timestamp}-4-dashboard-final.png`,
      fullPage: true,
    });
    console.log('   ✓ Final screenshot captured');

    // Step 7: Try different viewport sizes
    console.log('6. Testing different viewport sizes...');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: `${screenshotDir}/${timestamp}-5-desktop-1920.png`,
      fullPage: true,
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: `${screenshotDir}/${timestamp}-6-desktop-1366.png`,
      fullPage: true,
    });

    console.log('   ✓ Multiple viewport screenshots captured');

    console.log(`\n✅ All screenshots saved in: ${screenshotDir}`);
    console.log(`   Look for files starting with: ${timestamp}`);
  });
});
