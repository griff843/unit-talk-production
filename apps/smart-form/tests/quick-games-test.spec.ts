import { test, expect } from '@playwright/test';

test('verify games are now loading correctly', async ({ page }) => {
  console.log('🎯 Testing games loading after fix...');

  // Navigate to the form
  await page.goto('/submit-ticket');

  // Wait for the form to load
  await page.waitForSelector('h1:has-text("Smart Betting Form")', { timeout: 10000 });

  // Check if MLB is selected by default and games are loading
  await page.waitForTimeout(3000); // Give time for games to load

  // Look for the games count indicator
  const gamesIndicator = page.locator('text=/🎯 \\d+ MLB games available/');
  await expect(gamesIndicator).toBeVisible({ timeout: 10000 });

  // Get the actual text to see the count
  const gamesText = await gamesIndicator.textContent();
  console.log('✅ Games indicator text:', gamesText);

  // Verify it shows more than 0 games
  const match = gamesText?.match(/🎯 (\d+) MLB games available/);
  if (match) {
    const gamesCount = parseInt(match[1]);
    console.log('✅ Found', gamesCount, 'games');
    expect(gamesCount).toBeGreaterThan(0);
    expect(gamesCount).toBe(17); // Should be exactly 17 games
  }

  // Take a screenshot for verification
  await page.screenshot({ path: 'games-loaded-successfully.png', fullPage: true });

  console.log('🎉 SUCCESS: Games are now loading correctly!');
});
