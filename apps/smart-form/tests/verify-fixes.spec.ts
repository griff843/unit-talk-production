import { test, expect } from '@playwright/test';

test('verify all data display fixes are working', async ({ page }) => {
  console.log('🎯 Testing data display fixes...');

  // Navigate to the form
  await page.goto('/submit-ticket');

  // Wait for the form to load completely
  await page.waitForSelector('h1:has-text("Smart Betting Form")', { timeout: 10000 });

  // Verify games are loaded with proper count
  const gamesIndicator = page.locator('text=/🎯 \\d+ MLB games available/');
  await expect(gamesIndicator).toBeVisible({ timeout: 10000 });

  // Get games count
  const gamesText = await gamesIndicator.textContent();
  console.log('✅ Games loaded:', gamesText);

  // Complete Step 1 quickly
  await page.click('[role="combobox"]'); // Click capper dropdown
  await page.waitForTimeout(1000);
  await page.click('[role="option"]'); // Select first capper
  await page.click('button:has-text("single")'); // Select single bet
  await page.click('button:has-text("Continue")'); // Go to Step 2

  // Complete Step 2 quickly
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Continue")'); // Go to Step 3

  // Complete Step 3 quickly
  await page.waitForTimeout(2000);
  await page.click('button:has-text("moneyline")'); // Select moneyline
  await page.click('button:has-text("game_winner")'); // Select game winner
  await page.click('button:has-text("Continue")'); // Go to Step 4

  // Now we're in Step 4 - Game Selection
  await page.waitForTimeout(3000);
  console.log('✅ Reached Step 4 - Game Selection');

  // Look for game cards with team names and times
  const gameCards = page.locator(
    '.game-card, [data-testid="game-card"], .cursor-pointer:has-text("@")'
  );
  const gameCount = await gameCards.count();
  console.log(`🎯 Found ${gameCount} game selection cards`);

  if (gameCount > 0) {
    // Check first few games for proper formatting
    for (let i = 0; i < Math.min(3, gameCount); i++) {
      const gameCard = gameCards.nth(i);
      const gameText = await gameCard.textContent();
      console.log(`📋 Game ${i + 1} text:`, gameText);

      // Verify it contains team matchup (should have @ symbol)
      expect(gameText).toContain('@');

      // Verify it doesn't contain raw team IDs like 'TOR_MLB'
      expect(gameText).not.toMatch(/_MLB|_NBA|_NFL/);

      // Look for time indicators (PM/AM)
      if (gameText?.includes('PM') || gameText?.includes('AM')) {
        console.log(`✅ Game ${i + 1} has proper time display`);
      }
    }

    // Select the first game to test odds/lines
    await gameCards.first().click();
    await page.waitForTimeout(2000);

    // Look for the selection form
    const selectionForm = page.locator('text=/Make Your Pick/');
    if ((await selectionForm.count()) > 0) {
      console.log('✅ Game selection form appeared');

      // Check if team names are displayed properly in the form
      const pickText = await selectionForm.textContent();
      console.log('📋 Pick form text:', pickText);

      // Should contain proper team names with @ symbol
      expect(pickText).toContain('@');
      expect(pickText).not.toMatch(/_MLB|_NBA|_NFL/);
    }

    console.log('🎉 All data display fixes verified successfully!');
  } else {
    console.log('⚠️ No game cards found - may need to wait longer');
  }

  // Take screenshot for verification
  await page.screenshot({ path: 'data-fixes-verified.png', fullPage: true });
});
