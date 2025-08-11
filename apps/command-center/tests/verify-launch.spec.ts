import { test, expect } from '@playwright/test';

test('Command Center is running on port 3015', async ({ page }) => {
  console.log('🚀 Verifying Command Center is accessible...');

  // Navigate to Command Center
  const response = await page.goto('http://localhost:3015', {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
  });

  // Check if we got a successful response
  expect(response?.status()).toBeLessThan(400);
  console.log(`✅ Response status: ${response?.status()}`);

  // Take a screenshot as proof
  await page.screenshot({
    path: 'tests/screenshots/command-center-verified.png',
    fullPage: true,
  });

  // Check if Next.js app is rendering
  const title = await page.title();
  console.log(`📄 Page title: "${title}"`);

  // Check for React root element
  const reactRoot = await page.locator('#__next').count();
  expect(reactRoot).toBeGreaterThan(0);
  console.log('✅ React app detected');

  // Check if we're on the dashboard (after redirect)
  const url = page.url();
  console.log(`📍 Current URL: ${url}`);
  expect(url).toContain('localhost:3015');

  console.log('🎉 Command Center is running successfully!');
});
