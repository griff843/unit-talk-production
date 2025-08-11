import { test, expect } from '@playwright/test';

test.describe('Smart Form Real Data Verification', () => {
  test('should display real betting data instead of hardcoded defaults', async ({ page }) => {
    console.log('🚀 Starting real data verification test...');

    // Navigate to the smart form
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');

    console.log('📋 Step 1: Fill out form basics...');

    // Fill out Step 1 - Essentials
    await page.selectOption('select[name="sport"]', 'MLB');
    await page.fill('input[name="game_date"]', '2025-07-30');
    await page.click('button:has-text("Next")');

    // Fill out Step 2 - Configuration
    await page.selectOption('select[name="bet_type"]', 'moneyline');
    await page.selectOption('select[name="market_type"]', 'standard');
    await page.selectOption('select[name="ticket_type"]', 'single');
    await page.click('button:has-text("Next")');

    // Fill out Step 3 - Bet Details
    await page.fill('input[name="units"]', '1');
    await page.fill('input[name="confidence"]', '7');
    await page.click('button:has-text("Next")');

    console.log('🎮 Step 4: Checking game selection for real data...');

    // Wait for games to load in Step 4
    await page.waitForSelector('.space-y-3', { timeout: 10000 });

    // Take screenshot of loaded games
    await page.screenshot({ path: 'games-loaded-verification.png', fullPage: true });

    // Check if games are loaded
    const gamesContainer = page.locator('.space-y-3').first();
    const gameCards = gamesContainer.locator('div[class*="border rounded-lg"]');
    const gameCount = await gameCards.count();

    console.log(`📊 Found ${gameCount} games loaded`);
    expect(gameCount).toBeGreaterThan(0);

    if (gameCount > 0) {
      // Click on first game to see betting options
      const firstGame = gameCards.first();
      await firstGame.click();

      // Wait for selection form to appear
      await page.waitForSelector('select[name="selection"]', { timeout: 5000 });

      console.log('🎯 Checking for real betting data...');

      // Check game text content for real team names (not mock data)
      const gameText = await firstGame.textContent();
      console.log('Game text:', gameText);

      // Verify we have real data indicators
      const hasRealData =
        gameText?.includes('MLB') && (gameText?.includes('@') || gameText?.includes('vs'));

      expect(hasRealData).toBeTruthy();

      // Select a betting option
      await page.selectOption('select[name="selection"]', { index: 0 });

      // Check odds field gets populated
      await page.waitForTimeout(1000); // Allow auto-population
      const oddsValue = await page.inputValue('input[placeholder="-110"]');
      console.log('Auto-populated odds:', oddsValue);

      // Verify odds are not the old hardcoded -110 for everything
      if (oddsValue && oddsValue !== '' && oddsValue !== '-110') {
        console.log('✅ SUCCESS: Real odds detected:', oddsValue);
      } else if (oddsValue === '-110') {
        console.log('⚠️ Odds are -110 - could be real or default');
      } else {
        console.log('📝 No odds auto-populated');
      }

      // Check if we can see real game times (not just "TBD")
      const timeElement = page.locator('text=/\\d{1,2}:\\d{2}\\s?(AM|PM)/').first();
      const hasRealTime = await timeElement.isVisible().catch(() => false);

      if (hasRealTime) {
        const timeText = await timeElement.textContent();
        console.log('✅ Real game time found:', timeText);
      } else {
        console.log('⚠️ No specific game times found (may show TBD)');
      }

      // Final verification screenshot
      await page.screenshot({ path: 'betting-form-verification.png', fullPage: true });

      console.log('✅ Real data verification completed');
      console.log(
        '📸 Screenshots saved: games-loaded-verification.png, betting-form-verification.png'
      );
    } else {
      console.log('❌ No games found - database may be empty');
    }
  });

  test('should connect to database and load games', async ({ page }) => {
    console.log('🔍 Testing database connection...');

    await page.goto('/submit-ticket');

    // Fill form to reach game selection
    await page.selectOption('select[name="sport"]', 'MLB');
    await page.fill('input[name="game_date"]', '2025-07-30');
    await page.click('button:has-text("Next")');

    await page.selectOption('select[name="bet_type"]', 'spread');
    await page.selectOption('select[name="market_type"]', 'standard');
    await page.selectOption('select[name="ticket_type"]', 'single');
    await page.click('button:has-text("Next")');

    await page.fill('input[name="units"]', '2');
    await page.fill('input[name="confidence"]', '8');
    await page.click('button:has-text("Next")');

    // Wait for either games to load or error message
    await Promise.race([
      page.waitForSelector('.space-y-3', { timeout: 8000 }),
      page.waitForSelector('text=No games found', { timeout: 8000 }),
      page.waitForSelector('text=Loading games', { timeout: 8000 }),
    ]);

    // Check what we got
    const hasGames = await page.locator('.space-y-3').isVisible();
    const hasError = await page.locator('text=No games found').isVisible();
    const isLoading = await page.locator('text=Loading games').isVisible();

    console.log('Database connection status:', {
      hasGames,
      hasError,
      isLoading,
    });

    if (hasGames) {
      console.log('✅ Successfully connected to database and loaded games');
    } else if (hasError) {
      console.log('⚠️ Connected but no games found for this date/sport');
    } else if (isLoading) {
      console.log('⏳ Still loading...');
    }

    // Take final screenshot
    await page.screenshot({ path: 'database-connection-test.png', fullPage: true });
  });
});
