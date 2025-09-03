import { test, expect } from '@playwright/test';

test.describe('Bet Types End-to-End Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the smart form and wait for it to load
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Verify the form loaded correctly
    const title = page.locator('h1').filter({ hasText: 'Smart Betting Form' });
    await expect(title).toBeVisible();
  });

  test('Test SPREAD bet type submission end-to-end', async ({ page }) => {
    console.log('🎯 Testing SPREAD bet type submission...');

    // Step 1: Fill out essentials
    // Select a capper
    const capperDropdown = page
      .locator('button')
      .filter({ hasText: /Choose your capper|Select your capper/i })
      .first();
    await capperDropdown.click();
    await page.waitForTimeout(1000);

    // Select first available capper
    const firstCapper = page.locator('[role="option"]').first();
    if ((await firstCapper.count()) > 0) {
      await firstCapper.click();
    }

    // Select ticket type - Single
    await page.locator('button').filter({ hasText: 'single' }).click();

    // Select sport - MLB
    await page.locator('button').filter({ hasText: 'MLB' }).click();

    // Continue to step 2
    await page
      .locator('button')
      .filter({ hasText: /Continue|Next/i })
      .click();
    await page.waitForTimeout(1000);

    // Step 2: Configuration
    // American odds should be default - verify it's selected
    const americanOdds = page.locator('button').filter({ hasText: 'American' });
    await expect(americanOdds).toBeVisible();

    // Continue to step 3
    await page
      .locator('button')
      .filter({ hasText: /Continue|Next/i })
      .click();
    await page.waitForTimeout(1000);

    // Step 3: Bet Details
    // Select SPREAD bet type
    await page
      .locator('button')
      .filter({ hasText: /spread|point spread/i })
      .click();

    // Select pre_game market
    await page
      .locator('button')
      .filter({ hasText: /pre.game|pregame/i })
      .click();

    // Continue to step 4
    await page
      .locator('button')
      .filter({ hasText: /Continue|Next/i })
      .click();
    await page.waitForTimeout(1000);

    // Step 4: Game Selection
    // Select first available game
    const gameCards = page.locator('div').filter({ hasText: /Giants|Dodgers|Yankees|Red Sox/i });
    if ((await gameCards.count()) > 0) {
      await gameCards.first().click();

      // Fill in spread selection
      const spreadSelection = page
        .locator('select, button, input')
        .filter({ hasText: /spread|line/i });
      if ((await spreadSelection.count()) > 0) {
        await spreadSelection.first().click();
      }

      // Enter odds
      const oddsInput = page.locator('input[placeholder*="odds"], input[type="text"]').last();
      await oddsInput.fill('-110');

      // Add selection
      const addButton = page
        .locator('button')
        .filter({ hasText: /Add|Select/i })
        .first();
      await addButton.click();
    }

    // Submit the bet
    const submitButton = page
      .locator('button')
      .filter({ hasText: /Submit|Complete/i })
      .last();
    await submitButton.click();

    // Wait for success message
    await page.waitForTimeout(3000);

    // Verify success (look for success toast or confirmation)
    const successMessage = page.locator('div').filter({ hasText: /success|submitted|complete/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    console.log('✅ SPREAD bet submission test completed');
  });

  test('Test TOTAL (Over/Under) bet type submission end-to-end', async ({ page }) => {
    console.log('🎯 Testing TOTAL bet type submission...');

    // Similar flow but select TOTAL bet type in step 3
    // Navigate through steps 1-2 (same as spread)
    await fillEssentialsAndConfiguration(page);

    // Step 3: Select TOTAL bet type
    await page
      .locator('button')
      .filter({ hasText: /total|over.under/i })
      .click();
    await page
      .locator('button')
      .filter({ hasText: /pre.game/i })
      .click();
    await page
      .locator('button')
      .filter({ hasText: /Continue/i })
      .click();

    // Step 4: Select over/under
    const gameCards = page.locator('div').filter({ hasText: /Giants|Dodgers/i });
    if ((await gameCards.count()) > 0) {
      await gameCards.first().click();

      // Select Over
      const overButton = page.locator('button').filter({ hasText: /over/i }).first();
      await overButton.click();

      await page.locator('input').last().fill('-105');
      await page.locator('button').filter({ hasText: /Add/i }).first().click();
    }

    await page
      .locator('button')
      .filter({ hasText: /Submit/i })
      .last()
      .click();
    await page.waitForTimeout(3000);

    const successMessage = page.locator('div').filter({ hasText: /success/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    console.log('✅ TOTAL bet submission test completed');
  });

  test('Test MONEYLINE bet type submission end-to-end', async ({ page }) => {
    console.log('🎯 Testing MONEYLINE bet type submission...');

    await fillEssentialsAndConfiguration(page);

    // Step 3: Select MONEYLINE
    await page
      .locator('button')
      .filter({ hasText: /moneyline|money.line/i })
      .click();
    await page
      .locator('button')
      .filter({ hasText: /pre.game/i })
      .click();
    await page
      .locator('button')
      .filter({ hasText: /Continue/i })
      .click();

    // Step 4: Select team
    const gameCards = page.locator('div').filter({ hasText: /Giants|Dodgers/i });
    if ((await gameCards.count()) > 0) {
      await gameCards.first().click();

      // Select home team
      const homeTeamButton = page
        .locator('button')
        .filter({ hasText: /Giants|home/i })
        .first();
      await homeTeamButton.click();

      await page.locator('input').last().fill('-140');
      await page.locator('button').filter({ hasText: /Add/i }).first().click();
    }

    await page
      .locator('button')
      .filter({ hasText: /Submit/i })
      .last()
      .click();
    await page.waitForTimeout(3000);

    const successMessage = page.locator('div').filter({ hasText: /success/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    console.log('✅ MONEYLINE bet submission test completed');
  });

  test('Test PLAYER PROP bet type submission end-to-end', async ({ page }) => {
    console.log('🎯 Testing PLAYER PROP bet type submission...');

    await fillEssentialsAndConfiguration(page);

    // Step 3: Select PLAYER PROP
    await page
      .locator('button')
      .filter({ hasText: /player.prop|player prop/i })
      .click();
    await page
      .locator('button')
      .filter({ hasText: /player.prop/i })
      .click();
    await page
      .locator('button')
      .filter({ hasText: /Continue/i })
      .click();

    // Step 4: Select player prop
    const gameCards = page.locator('div').filter({ hasText: /Giants|Dodgers/i });
    if ((await gameCards.count()) > 0) {
      await gameCards.first().click();

      // Enter player prop details
      await page
        .locator('input[placeholder*="selection"], select')
        .first()
        .fill('Player Points Over 25.5');
      await page.locator('input').last().fill('+110');
      await page.locator('button').filter({ hasText: /Add/i }).first().click();
    }

    await page
      .locator('button')
      .filter({ hasText: /Submit/i })
      .last()
      .click();
    await page.waitForTimeout(3000);

    const successMessage = page.locator('div').filter({ hasText: /success/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    console.log('✅ PLAYER PROP bet submission test completed');
  });

  test('Test comprehensive form functionality', async ({ page }) => {
    console.log('🎯 Testing comprehensive form functionality...');

    // Test that all sports are available
    const sportButtons = page.locator('button').filter({ hasText: /NFL|NBA|MLB|WNBA|NHL/i });
    await expect(sportButtons.first()).toBeVisible();

    // Test that VIP+ tier is displayed
    const vipTier = page.locator('div').filter({ hasText: /VIP\+/i });
    await expect(vipTier).toBeVisible();

    // Test that premium styling is working
    const premiumBackground = page.locator('div.min-h-screen.bg-gradient-to-br');
    await expect(premiumBackground).toBeVisible();

    console.log('✅ Comprehensive form functionality test completed');
  });
});

// Helper function to fill out steps 1 and 2
async function fillEssentialsAndConfiguration(page: any) {
  // Step 1: Essentials
  const capperDropdown = page
    .locator('button')
    .filter({ hasText: /Choose your capper/i })
    .first();
  await capperDropdown.click();
  await page.waitForTimeout(1000);

  const firstCapper = page.locator('[role="option"]').first();
  if ((await firstCapper.count()) > 0) {
    await firstCapper.click();
  }

  await page.locator('button').filter({ hasText: 'single' }).click();
  await page.locator('button').filter({ hasText: 'MLB' }).click();
  await page
    .locator('button')
    .filter({ hasText: /Continue/i })
    .click();
  await page.waitForTimeout(1000);

  // Step 2: Configuration (American odds is default)
  await page
    .locator('button')
    .filter({ hasText: /Continue/i })
    .click();
  await page.waitForTimeout(1000);
}
