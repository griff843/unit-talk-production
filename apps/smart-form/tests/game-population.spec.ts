import { test, expect } from '@playwright/test';

interface GameData {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_time: string;
  status: string;
}

const mockGames: GameData[] = [
  {
    id: 'game-mlb-2025-01-28-001',
    sport: 'MLB',
    home_team: 'NYY',
    away_team: 'TB',
    game_date: '2025-01-28',
    game_time: '19:05:00',
    status: 'scheduled',
  },
  {
    id: 'game-mlb-2025-01-28-002',
    sport: 'MLB',
    home_team: 'LAD',
    away_team: 'SF',
    game_date: '2025-01-28',
    game_time: '20:10:00',
    status: 'scheduled',
  },
  {
    id: 'game-nba-2025-01-28-001',
    sport: 'NBA',
    home_team: 'LAL',
    away_team: 'GSW',
    game_date: '2025-01-28',
    game_time: '19:30:00',
    status: 'scheduled',
  },
];

test.describe('Game Population and Date Association Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase responses
    await page.route('**/rest/v1/**', async route => {
      const url = route.request().url();

      if (url.includes('cappers')) {
        await route.fulfill({
          json: [
            { id: '1', name: 'Griff', status: 'Active' },
            { id: '2', name: 'Mike Johnson', status: 'Active' },
          ],
        });
      } else if (url.includes('games')) {
        const sport = new URL(url).searchParams.get('league');
        const gameDate = new URL(url).searchParams.get('game_date');

        const filteredGames = mockGames.filter(
          game => game.sport === sport && game.game_date === gameDate
        );

        await route.fulfill({
          json: filteredGames,
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/submit-ticket');
  });

  test('should populate games based on selected sport and date', async ({ page }) => {
    // Step 1: Fill basic form data
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

    // Set game date to tomorrow to ensure we get games
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];

    await page.fill('input[name="game_date"]', dateString);

    // Continue to next steps
    await page.click('button:has-text("Next")');

    // Step 2: Configuration
    await page.fill('input[name="unit_size"]', '2');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '8');
    await page.click('button:has-text("Next")');

    // Step 3: Bet Details
    await page.selectOption('select[name="bet_type"]', 'spread');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Step 4: Game Selection - verify games are populated
    await expect(page.locator('text=Loading games...')).toBeVisible();

    // Wait for games to load
    await expect(page.locator('text=TB @ NYY')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=LAD @ SF')).toBeVisible();

    // Verify game details are correct
    const gameCards = page.locator('[data-testid="game-card"]');
    await expect(gameCards).toHaveCount(2);
  });

  test('should handle date changes and update games accordingly', async ({ page }) => {
    // Fill initial data
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'NBA');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];

    await page.fill('input[name="game_date"]', dateString);

    // Navigate through steps
    await page.click('button:has-text("Next")');
    await page.fill('input[name="unit_size"]', '1.5');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '7');
    await page.click('button:has-text("Next")');

    await page.selectOption('select[name="bet_type"]', 'moneyline');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Verify NBA games are loaded
    await expect(page.locator('text=LAL @ GSW')).toBeVisible();

    // Go back to change date
    await page.click('button:has-text("Back")');
    await page.click('button:has-text("Back")');
    await page.click('button:has-text("Back")');

    // Change date to different day
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const newDateString = nextWeek.toISOString().split('T')[0];

    await page.fill('input[name="game_date"]', newDateString);

    // Navigate forward again
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Verify games are updated for new date
    await expect(page.locator('text=LAL @ GSW')).toBeVisible();
  });

  test('should handle empty game results gracefully', async ({ page }) => {
    // Mock empty game response
    await page.route('**/rest/v1/games**', async route => {
      await route.fulfill({
        json: [],
      });
    });

    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'NFL');

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

    await page.selectOption('select[name="bet_type"]', 'total');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Verify empty state is handled
    await expect(page.locator('text=No games found')).toBeVisible();
    await expect(page.locator('text=Try selecting a different date or sport')).toBeVisible();
  });

  test('should allow adding selections for all bet types', async ({ page }) => {
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'parlay');
    await page.selectOption('select[name="sport"]', 'MLB');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];

    await page.fill('input[name="game_date"]', dateString);

    // Navigate through steps
    await page.click('button:has-text("Next")');
    await page.fill('input[name="unit_size"]', '3');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '9');
    await page.click('button:has-text("Next")');

    // Test different bet types
    const betTypes = ['spread', 'moneyline', 'total', 'team_total', 'player_prop'];

    for (const betType of betTypes) {
      await page.selectOption('select[name="bet_type"]', betType);
      await page.selectOption(
        'select[name="market_type"]',
        betType === 'player_prop' ? 'player' : 'game'
      );
      await page.click('button:has-text("Next")');

      // Add selection
      await page.click('[data-testid="game-card"]:first-child');

      if (betType === 'spread') {
        await page.selectOption('select[name="selection"]', 'home');
        await page.fill('input[name="line"]', '-1.5');
      } else if (betType === 'total') {
        await page.selectOption('select[name="selection"]', 'over');
        await page.fill('input[name="line"]', '8.5');
      } else if (betType === 'moneyline') {
        await page.selectOption('select[name="selection"]', 'home');
      } else if (betType === 'player_prop') {
        await page.fill('input[placeholder*="Player name"]', 'Mike Trout');
        await page.selectOption('select[name="prop_type"]', 'totalBases');
        await page.selectOption('select[name="selection"]', 'over');
        await page.fill('input[name="line"]', '2.5');
      }

      await page.fill('input[name="odds"]', '-110');
      await page.click('button:has-text("Add Selection")');

      // Verify selection was added
      await expect(page.locator('[data-testid="selection-added"]')).toBeVisible();

      // Go back to change bet type
      if (betType !== betTypes[betTypes.length - 1]) {
        await page.click('button:has-text("Back")');
      }
    }

    // Submit the form
    await page.click('button:has-text("Submit Ticket")');
    await expect(page.locator('text=Ticket submitted successfully')).toBeVisible();
  });

  test('should validate game date is not in the past', async ({ page }) => {
    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

    // Set past date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDateString = yesterday.toISOString().split('T')[0];

    await page.fill('input[name="game_date"]', pastDateString);

    // Try to proceed
    await page.click('button:has-text("Next")');

    // Should show validation error
    await expect(page.locator('text=Cannot select past dates')).toBeVisible();
  });

  test('should handle database connection errors gracefully', async ({ page }) => {
    // Mock database error
    await page.route('**/rest/v1/games**', async route => {
      await route.fulfill({
        status: 500,
        json: { error: 'Database connection failed' },
      });
    });

    await page.selectOption('select[name="capper"]', 'Griff');
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

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

    await page.selectOption('select[name="bet_type"]', 'spread');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Should show error message
    await expect(page.locator('text=Error loading games')).toBeVisible();
  });
});
