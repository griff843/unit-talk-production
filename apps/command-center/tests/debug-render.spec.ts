import { test, expect } from '@playwright/test';

test.describe('Debug Rendering Issues', () => {
  test('debug why page looks terrible', async ({ page }) => {
    // Increase timeout for debugging
    test.setTimeout(120000);

    console.log('\n=== STARTING DEBUG SESSION ===\n');

    // Navigate to the page
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait a bit for initial render
    await page.waitForTimeout(2000);

    // Check if CSS is loading
    console.log('1. Checking CSS files...');
    const styleSheets = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.map(sheet => ({
        href: sheet.href,
        disabled: sheet.disabled,
        rules: sheet.cssRules ? sheet.cssRules.length : 0,
      }));
    });
    console.log('Stylesheets found:', styleSheets);

    // Check for CSS load failures
    const cssErrors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => ({
        href: (link as HTMLLinkElement).href,
        loaded: (link as HTMLLinkElement).sheet !== null,
      }));
    });
    console.log('CSS load status:', cssErrors);

    // Check Tailwind classes
    console.log('\n2. Checking if Tailwind CSS is working...');
    const tailwindCheck = await page.evaluate(() => {
      const testDiv = document.createElement('div');
      testDiv.className = 'bg-red-500';
      document.body.appendChild(testDiv);
      const computed = window.getComputedStyle(testDiv);
      const bgColor = computed.backgroundColor;
      document.body.removeChild(testDiv);
      return bgColor;
    });
    console.log('Tailwind test (should be red):', tailwindCheck);

    // Check actual styles on key elements
    console.log('\n3. Checking actual styles on elements...');
    const elementStyles = await page.evaluate(() => {
      const results: any = {};

      // Check body
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);
      results.body = {
        backgroundColor: bodyStyles.backgroundColor,
        color: bodyStyles.color,
        fontFamily: bodyStyles.fontFamily,
      };

      // Check main heading
      const h1 = document.querySelector('h1');
      if (h1) {
        const h1Styles = window.getComputedStyle(h1);
        results.h1 = {
          fontSize: h1Styles.fontSize,
          color: h1Styles.color,
          display: h1Styles.display,
        };
      }

      // Check cards
      const card = document.querySelector('[class*="card"]');
      if (card) {
        const cardStyles = window.getComputedStyle(card);
        results.card = {
          backgroundColor: cardStyles.backgroundColor,
          border: cardStyles.border,
          padding: cardStyles.padding,
        };
      }

      return results;
    });
    console.log('Element styles:', JSON.stringify(elementStyles, null, 2));

    // Check for hydration errors
    console.log('\n4. Checking for React hydration errors...');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Reload to catch errors
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    } else {
      console.log('No console errors detected');
    }

    // Check network requests
    console.log('\n5. Checking failed network requests...');
    const failedRequests = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests);
    }

    // Take screenshots at different stages
    console.log('\n6. Taking debug screenshots...');

    // Screenshot 1: Current state
    await page.screenshot({
      path: 'tests/screenshots/debug-1-current-state.png',
      fullPage: true,
    });

    // Screenshot 2: With styles disabled
    await page.evaluate(() => {
      document
        .querySelectorAll('link[rel="stylesheet"]')
        .forEach(link => ((link as HTMLLinkElement).disabled = true));
    });
    await page.screenshot({
      path: 'tests/screenshots/debug-2-no-styles.png',
      fullPage: true,
    });

    // Screenshot 3: Re-enable styles
    await page.evaluate(() => {
      document
        .querySelectorAll('link[rel="stylesheet"]')
        .forEach(link => ((link as HTMLLinkElement).disabled = false));
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'tests/screenshots/debug-3-styles-reenabled.png',
      fullPage: true,
    });

    // Check if dark mode is applied
    console.log('\n7. Checking theme/dark mode...');
    const htmlClasses = await page.evaluate(() => document.documentElement.className);
    console.log('HTML classes:', htmlClasses);

    // Get computed background colors
    const backgrounds = await page.evaluate(() => {
      return {
        html: window.getComputedStyle(document.documentElement).backgroundColor,
        body: window.getComputedStyle(document.body).backgroundColor,
        main: document.querySelector('main')
          ? window.getComputedStyle(document.querySelector('main')).backgroundColor
          : 'no main element',
      };
    });
    console.log('Background colors:', backgrounds);

    console.log('\n=== DEBUG SESSION COMPLETE ===');
    console.log('Check the following screenshots:');
    console.log('- tests/screenshots/debug-1-current-state.png');
    console.log('- tests/screenshots/debug-2-no-styles.png');
    console.log('- tests/screenshots/debug-3-styles-reenabled.png');
  });
});
