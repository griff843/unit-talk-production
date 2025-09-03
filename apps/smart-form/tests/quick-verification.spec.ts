import { test, expect } from '@playwright/test';

test('Quick elite styling verification', async ({ page }) => {
  // Navigate to the smart form
  await page.goto('/submit-ticket');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Verify the premium gradient background exists
  const backgroundDiv = page.locator('div.min-h-screen.bg-gradient-to-br');
  await expect(backgroundDiv).toBeVisible();

  // Check for the premium brand logo
  const brandLogo = page.locator('div.w-20.h-20.bg-gradient-to-br');
  await expect(brandLogo).toBeVisible();

  // Verify the title is visible
  const title = page.locator('h1').filter({ hasText: 'Smart Betting Form' });
  await expect(title).toBeVisible();

  // Take a screenshot for validation
  await expect(page).toHaveScreenshot('elite-styling-verification.png', {
    fullPage: true,
    threshold: 0.3,
  });

  console.log('✅ Elite styling verification passed - premium UI is working correctly!');
});
