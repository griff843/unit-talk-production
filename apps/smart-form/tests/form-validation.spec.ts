import { test, expect } from '@playwright/test';

test.describe('Smart Form Validation and Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/submit-ticket');
  });

  test('should complete full form submission for all bet types', async ({ page }) => {
    // Step 1: Basic Information
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

    // Set tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="game_date"]', dateString);

    await page.click('button:has-text("Next")');

    // Step 2: Configuration
    await page.fill('input[name="unit_size"]', '2.5');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '8');
    await page.click('button:has-text("Next")');

    // Test all bet types
    const betTypes = [
      { type: 'spread', market: 'game', selection: 'home', line: '-1.5' },
      { type: 'moneyline', market: 'game', selection: 'home' },
      { type: 'total', market: 'game', selection: 'over', line: '8.5' },
      { type: 'team_total', market: 'game', selection: 'home_over', line: '4.5' },
    ];

    for (const bet of betTypes) {
      await page.selectOption('select[name="bet_type"]', bet.type);
      await page.selectOption('select[name="market_type"]', bet.market);
      await page.click('button:has-text("Next")');

      // Select game
      await page.click('[data-testid="game-card"]:first-child');

      // Make selection
      await page.selectOption('select[name="selection"]', bet.selection);
      if (bet.line) {
        await page.fill('input[name="line"]', bet.line);
      }
      await page.fill('input[name="odds"]', '-110');
      await page.click('button:has-text("Add Selection")');

      // Verify selection was added
      await expect(page.locator('text=Current Selections')).toBeVisible();

      // Go back to test next bet type
      if (bet !== betTypes[betTypes.length - 1]) {
        await page.click('button:has-text("Back")');
        await page.click('button:has-text("Back")');
      }
    }

    // Submit form
    await page.click('button:has-text("Submit Ticket")');

    // Verify success
    await expect(page.locator('text=Ticket submitted successfully')).toBeVisible();
  });

  test('should handle parlay with multiple selections', async ({ page }) => {
    // Step 1: Basic Information
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'parlay');
    await page.selectOption('select[name="sport"]', 'MLB');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="game_date"]', dateString);

    await page.click('button:has-text("Next")');

    // Step 2: Configuration
    await page.fill('input[name="unit_size"]', '1');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '7');
    await page.click('button:has-text("Next")');

    // Step 3: Bet Details
    await page.selectOption('select[name="bet_type"]', 'spread');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Add multiple selections
    const games = await page.locator('[data-testid="game-card"]').all();

    for (let i = 0; i < Math.min(games.length, 3); i++) {
      await games[i].click();
      await page.selectOption('select[name="selection"]', 'home');
      await page.fill('input[name="line"]', '-1.5');
      await page.fill('input[name="odds"]', '-110');
      await page.click('button:has-text("Add Selection")');
    }

    // Verify multiple selections
    const selections = page.locator('[data-testid="selection-added"]');
    await expect(selections).toHaveCount(Math.min(games.length, 3));

    // Submit
    await page.click('button:has-text("Submit Ticket")');
    await expect(page.locator('text=Ticket submitted successfully')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling required fields
    await page.click('button:has-text("Next")');

    // Should show validation errors
    await expect(page.locator('text=Capper selection is required')).toBeVisible();
    await expect(page.locator('text=Ticket type is required')).toBeVisible();
    await expect(page.locator('text=Sport selection is required')).toBeVisible();
    await expect(page.locator('text=Game date is required')).toBeVisible();
  });

  test('should validate date is not in the past', async ({ page }) => {
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

    // Set yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];
    await page.fill('input[name="game_date"]', dateString);

    await page.click('button:has-text("Next")');

    // Should show validation error
    await expect(page.locator('text=Cannot select past dates')).toBeVisible();
  });

  test('should handle empty game results gracefully', async ({ page }) => {
    // Select a sport with no games
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'NHL'); // Sport with no mock data

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="game_date"]', dateString);

    // Navigate to game selection
    await page.click('button:has-text("Next")');
    await page.fill('input[name="unit_size"]', '1');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '5');
    await page.click('button:has-text("Next")');

    await page.selectOption('select[name="bet_type"]', 'moneyline');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Should show empty state
    await expect(page.locator('text=No games found')).toBeVisible();
  });
});
