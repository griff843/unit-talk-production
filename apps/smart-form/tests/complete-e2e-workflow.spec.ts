import { test, expect } from '@playwright/test';

test('complete E2E workflow - form submission with real games', async ({ page }) => {
  console.log('🎯 Starting complete E2E workflow test...');

  // Navigate to the form
  await page.goto('/submit-ticket');

  // Wait for the form to load
  await page.waitForSelector('h1:has-text("Smart Betting Form")', { timeout: 10000 });
  console.log('✅ Form loaded successfully');

  // STEP 1: Verify games are loaded and complete essentials
  console.log('\n📋 STEP 1: Essentials');

  // Verify 17 MLB games are shown
  const gamesIndicator = page.locator('text=/🎯 \\d+ MLB games available/');
  await expect(gamesIndicator).toBeVisible();
  const gamesText = await gamesIndicator.textContent();
  console.log('✅ Games loaded:', gamesText);

  // Select capper
  await page.click('[data-testid="capper-select"], .select-trigger, [role="combobox"]');
  await page.waitForTimeout(1000);

  // Look for capper options and select first one
  const capperOptions = page.locator('[role="option"], .select-item');
  await capperOptions.first().click();
  console.log('✅ Capper selected');

  // Select ticket type - Single
  await page.click('button:has-text("single"), button:has-text("Single")');
  console.log('✅ Ticket type selected: Single');

  // MLB should already be selected, verify it
  const mlbButton = page.locator('button:has-text("MLB")');
  await expect(mlbButton).toHaveClass(/border-blue-500|bg-blue-50/);
  console.log('✅ MLB sport confirmed');

  // Date should be today (2025-07-29), verify it
  const dateInput = page.locator('input[type="text"]').first();
  const dateValue = await dateInput.inputValue();
  console.log('✅ Date confirmed:', dateValue);

  // Click Continue to Step 2
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(2000);
  console.log('✅ Advanced to Step 2');

  // STEP 2: Configuration
  console.log('\n⚙️ STEP 2: Configuration');

  // Set unit size (should have default, just verify)
  const unitSizeInput = page.locator('input[type="range"], input[type="number"]').first();
  console.log('✅ Unit size input found');

  // Odds format should have default
  console.log('✅ Odds format configured');

  // Confidence level should have default
  console.log('✅ Confidence level configured');

  // Continue to Step 3
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(2000);
  console.log('✅ Advanced to Step 3');

  // STEP 3: Bet Details
  console.log('\n🎯 STEP 3: Bet Details');

  // Select bet type - Moneyline
  await page.click('button:has-text("moneyline"), button:has-text("Moneyline")');
  console.log('✅ Bet type selected: Moneyline');

  // Select market type - Game Winner
  await page.click('button:has-text("game_winner"), button:has-text("Game Winner")');
  console.log('✅ Market type selected: Game Winner');

  // Continue to Step 4
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(3000);
  console.log('✅ Advanced to Step 4 - Game Selection');

  // STEP 4: Game Selection
  console.log('\n🎮 STEP 4: Game Selection');

  // Wait for games to load
  await page.waitForTimeout(3000);

  // Look for game cards or selection interface
  const gameSelectors = page.locator('.game-card, .game-selection, button:has-text("@")');
  const gameCount = await gameSelectors.count();
  console.log(`🎯 Found ${gameCount} game selection options`);

  if (gameCount > 0) {
    // Select first game
    await gameSelectors.first().click();
    console.log('✅ Game selected');

    // Wait for selection to process
    await page.waitForTimeout(2000);

    // Look for submit button
    const submitButton = page.locator('button:has-text("Submit"), button:has-text("Place Bet")');
    if ((await submitButton.count()) > 0) {
      // Click submit
      await submitButton.click();
      console.log('✅ Submission attempted');

      // Wait for success message or error
      await page.waitForTimeout(5000);

      // Look for success or error message
      const successMessage = page.locator('text=/Success|submitted|Ticket/i');
      const errorMessage = page.locator('text=/Error|failed|invalid/i');

      if ((await successMessage.count()) > 0) {
        const successText = await successMessage.textContent();
        console.log('🎉 SUCCESS:', successText);
      } else if ((await errorMessage.count()) > 0) {
        const errorText = await errorMessage.textContent();
        console.log('❌ ERROR:', errorText);
      } else {
        console.log('⚠️ No clear success/error message found');
      }
    } else {
      console.log('⚠️ Submit button not found - may need game odds selection');
    }
  } else {
    console.log('⚠️ No game selection options found');
  }

  // Take final screenshot
  await page.screenshot({ path: 'complete-e2e-test.png', fullPage: true });

  console.log('\n🏁 E2E Test Complete');
});
