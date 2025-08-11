import { test, expect } from '@playwright/test';

test.describe('Comprehensive Smart Form Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the smart form
    await page.goto('/submit-ticket');

    // Wait for form to load
    await page.waitForSelector('[data-testid="step-progress"]', { timeout: 10000 });
    console.log('✅ Form loaded successfully');
  });

  test('Complete form workflow with prop bet selection', async ({ page }) => {
    console.log('🎯 Starting comprehensive form test...');

    // STEP 1: Essentials
    console.log('\n📋 STEP 1: Essentials');

    // Wait for cappers to load
    await page.waitForSelector('select[data-testid="capper-select"]', { timeout: 15000 });

    // Select capper
    await page.selectOption('select[data-testid="capper-select"]', { index: 1 });
    console.log('✅ Capper selected');

    // Select ticket type
    await page.click('button[data-testid="ticket-type-single"]');
    console.log('✅ Ticket type selected: Single');

    // Select sport (MLB since we know we have games)
    await page.click('button[data-testid="sport-MLB"]');
    console.log('✅ MLB sport selected');

    // Wait for games to load and verify
    await page.waitForTimeout(3000);
    const gamesText = await page.textContent('[data-testid="games-status"]');
    console.log(`✅ Games status: ${gamesText}`);

    // Select game date - use today's date
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[type="date"]', today);
    console.log(`✅ Date set to: ${today}`);

    // Wait for continue button to be enabled
    await page.waitForFunction(
      () => {
        const button = document.querySelector('button:has-text("Continue")') as HTMLButtonElement;
        return button && !button.disabled;
      },
      { timeout: 15000 }
    );

    await page.click('button:has-text("Continue")');
    console.log('✅ Advanced to Step 2');

    // STEP 2: Configuration
    console.log('\n⚙️ STEP 2: Configuration');

    // Wait for step 2 to load
    await page.waitForSelector('text=Betting Configuration', { timeout: 10000 });

    // Set unit size
    await page.fill('input[type="range"]', '2.5');
    console.log('✅ Unit size set to 2.5');

    // Select odds format
    await page.click('button:has-text("American")');
    console.log('✅ American odds format selected');

    // Set confidence level (click on star 8)
    await page.click('.flex.items-center.justify-center.space-x-1 button:nth-child(8)');
    console.log('✅ Confidence level set to 8');

    // Continue to Step 3
    await page.waitForFunction(
      () => {
        const button = document.querySelector('button:has-text("Continue")') as HTMLButtonElement;
        return button && !button.disabled;
      },
      { timeout: 10000 }
    );

    await page.click('button:has-text("Continue")');
    console.log('✅ Advanced to Step 3');

    // STEP 3: Bet Details
    console.log('\n🎯 STEP 3: Bet Details');

    // Wait for step 3 to load
    await page.waitForSelector('text=Bet Selection', { timeout: 10000 });

    // Select Player Props bet type to test prop loading
    await page.click('button[data-testid="bet-type-player_prop"]');
    console.log('✅ Player Props bet type selected');

    // Select market type
    await page.click('button[data-testid="market-type-pre_game"]');
    console.log('✅ Pre-game market type selected');

    // Continue to Step 4
    await page.waitForFunction(
      () => {
        const button = document.querySelector('button:has-text("Continue")') as HTMLButtonElement;
        return button && !button.disabled;
      },
      { timeout: 10000 }
    );

    await page.click('button:has-text("Continue")');
    console.log('✅ Advanced to Step 4');

    // STEP 4: Game Selection and Props
    console.log('\n🎮 STEP 4: Game Selection and Props');

    // Wait for games to load
    await page.waitForSelector('[data-testid="games-list"]', { timeout: 15000 });

    // Check if games are loaded
    const gameCards = await page.locator('[data-testid*="game-card"]').count();
    console.log(`✅ Found ${gameCards} game cards`);

    if (gameCards > 0) {
      // Select the first game
      await page.click('[data-testid*="game-card"]:first-child');
      console.log('✅ First game selected');

      // Wait for props to load
      await page.waitForTimeout(3000);

      // Check if props loaded
      const propsSection = await page.locator('[data-testid="props-section"]');
      if (await propsSection.isVisible()) {
        console.log('✅ Props section is visible');

        // Count available props
        const propCount = await page.locator('[data-testid*="prop-option"]').count();
        console.log(`✅ Found ${propCount} prop options`);

        if (propCount > 0) {
          // Select first prop
          await page.click('[data-testid*="prop-option"]:first-child');
          console.log('✅ First prop selected');

          // Select over/under
          const overButton = await page.locator('button:has-text("Over")');
          if (await overButton.isVisible()) {
            await overButton.click();
            console.log('✅ Over selection made');
          }
        } else {
          console.log('⚠️ No props available - this might be the issue you mentioned');
        }
      } else {
        console.log('❌ Props section not visible');
      }

      // Add some notes
      await page.fill(
        'textarea[placeholder*="notes"]',
        'Test submission from comprehensive E2E test'
      );
      console.log('✅ Notes added');

      // Check submit button state
      const submitButton = await page.locator('button:has-text("Submit")');
      const isSubmitEnabled = await submitButton.isEnabled();
      console.log(`🎯 Submit button enabled: ${isSubmitEnabled}`);

      if (isSubmitEnabled) {
        console.log('✅ Form is ready for submission');
        // Uncomment the next line to actually submit
        // await submitButton.click();
        // console.log('✅ Form submitted successfully');
      } else {
        console.log('⚠️ Submit button is disabled - checking required fields...');

        // Debug what's missing
        const selectionInput = await page.locator('input[placeholder*="selection"]');
        const oddsInput = await page.locator('input[placeholder*="odds"]');

        console.log('📊 Debugging form state:');
        console.log(`  - Selection filled: ${await selectionInput.inputValue()}`);
        console.log(`  - Odds filled: ${await oddsInput.inputValue()}`);
      }
    } else {
      console.log('❌ No games found - this could be a timezone or date filtering issue');
    }

    // Take a screenshot for verification
    await page.screenshot({
      path: 'test-results/comprehensive-form-final-state.png',
      fullPage: true,
    });
    console.log('📸 Screenshot saved');
  });

  test('Test timezone and game time display', async ({ page }) => {
    console.log('🕐 Testing timezone handling...');

    // Navigate and load form
    await page.waitForSelector('[data-testid="step-progress"]', { timeout: 10000 });

    // Get to step 4 quickly (minimal path)
    await page.selectOption('select[data-testid="capper-select"]', { index: 1 });
    await page.click('button[data-testid="ticket-type-single"]');
    await page.click('button[data-testid="sport-MLB"]');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[type="date"]', today);

    // Continue through steps
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    await page.fill('input[type="range"]', '2.0');
    await page.click('button:has-text("American")');
    await page.click('.flex.items-center.justify-center.space-x-1 button:nth-child(7)');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    await page.click('button[data-testid="bet-type-spread"]');
    await page.click('button[data-testid="market-type-pre_game"]');
    await page.click('button:has-text("Continue")');

    // Check game times in Step 4
    await page.waitForSelector('[data-testid="games-list"]', { timeout: 15000 });

    const gameTimeElements = await page.locator('[data-testid*="game-time"]').all();
    console.log(`✅ Found ${gameTimeElements.length} games with time data`);

    for (let i = 0; i < Math.min(gameTimeElements.length, 3); i++) {
      const timeText = await gameTimeElements[i].textContent();
      console.log(`  Game ${i + 1} time: ${timeText}`);

      // Check if time looks like EST format
      if (timeText?.includes('PM') || timeText?.includes('AM') || timeText?.includes(':')) {
        console.log(`✅ Game ${i + 1} shows time in user-friendly format`);
      } else {
        console.log(`⚠️ Game ${i + 1} time format might need improvement: ${timeText}`);
      }
    }
  });

  test('Test prop loading for different bet types', async ({ page }) => {
    console.log('🎲 Testing prop loading for different bet types...');

    // Navigate to form and get to step 3
    await page.waitForSelector('[data-testid="step-progress"]', { timeout: 10000 });

    // Quick navigation to step 3
    await page.selectOption('select[data-testid="capper-select"]', { index: 1 });
    await page.click('button[data-testid="ticket-type-single"]');
    await page.click('button[data-testid="sport-MLB"]');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[type="date"]', today);
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    await page.fill('input[type="range"]', '2.0');
    await page.click('button:has-text("American")');
    await page.click('.flex.items-center.justify-center.space-x-1 button:nth-child(7)');
    await page.click('button:has-text("Continue")');

    // Test different bet types
    const betTypes = ['spread', 'total', 'moneyline', 'player_prop'];

    for (const betType of betTypes) {
      console.log(`\n🎯 Testing ${betType} bet type...`);

      // Select bet type
      await page.click(`button[data-testid="bet-type-${betType}"]`);
      await page.click('button[data-testid="market-type-pre_game"]');
      await page.click('button:has-text("Continue")');

      // Wait for step 4 to load
      await page.waitForTimeout(3000);

      if (betType === 'player_prop') {
        // For player props, check if props section appears
        const propsVisible = await page.locator('[data-testid="props-section"]').isVisible();
        console.log(`  Props section visible: ${propsVisible}`);

        if (propsVisible) {
          const propCount = await page.locator('[data-testid*="prop-option"]').count();
          console.log(`  Available props: ${propCount}`);
        }
      } else {
        // For other bet types, check if standard game options appear
        const gameCards = await page.locator('[data-testid*="game-card"]').count();
        console.log(`  Available games: ${gameCards}`);
      }

      // Go back to step 3 for next test
      await page.click('button:has-text("Back")');
      await page.waitForTimeout(1000);
    }
  });
});
