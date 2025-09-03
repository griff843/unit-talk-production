import { test, expect } from '@playwright/test';

// Live data for testing - this matches our actual ingested data
const MLB_TEST_DATA = {
  sport: 'MLB',
  players: ['Aaron Judge', 'Mookie Betts', 'Juan Soto', 'Freddie Freeman', 'Ronald Acuna Jr.'],
  betTypes: ['Hits', 'Home Runs', 'RBIs'],
  teams: ['Detroit Tigers', 'Philadelphia Phillies', 'Pittsburgh Pirates', 'Colorado Rockies'],
  lines: {
    Hits: [0.5, 1.5, 2.5],
    'Home Runs': [0.5],
    RBIs: [0.5, 1.5, 2.5],
  },
};

test.describe('Smart Form E2E - Live Production Data', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the smart form
    await page.goto('/submit-ticket');

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
  });

  test('should complete full MLB ticket submission with live data', async ({ page }) => {
    // Test complete flow with real MLB data
    await test.step('Fill Step 1: Sport Selection', async () => {
      // Select MLB sport
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');

      // Verify sport selection
      const selectedSport = await page.locator('[data-testid="sport-selector"]').inputValue();
      expect(selectedSport).toBe('MLB');

      // Click next
      await page.click('[data-testid="next-button"]');
    });

    await test.step('Fill Step 2: Player Selection', async () => {
      // Wait for player search to be available
      await page.waitForSelector('[data-testid="player-search"]');

      // Search for Aaron Judge (from our live data)
      await page.fill('[data-testid="player-search"]', 'Aaron Judge');

      // Wait for search results
      await page.waitForSelector('[data-testid="player-suggestion"]', { timeout: 10000 });

      // Select first player suggestion
      await page.click('[data-testid="player-suggestion"]:first-child');

      // Verify player selection
      const selectedPlayer = await page.locator('[data-testid="selected-player"]').textContent();
      expect(selectedPlayer).toContain('Aaron Judge');

      await page.click('[data-testid="next-button"]');
    });

    await test.step('Fill Step 3: Bet Type Selection', async () => {
      // Wait for bet type selector
      await page.waitForSelector('[data-testid="bet-type-selector"]');

      // Select Hits (from our live data)
      await page.selectOption('[data-testid="bet-type-selector"]', 'Hits');

      // Verify bet type selection
      const selectedBetType = await page.locator('[data-testid="bet-type-selector"]').inputValue();
      expect(selectedBetType).toBe('Hits');

      await page.click('[data-testid="next-button"]');
    });

    await test.step('Fill Step 4: Line Selection', async () => {
      // Wait for line selector
      await page.waitForSelector('[data-testid="line-selector"]');

      // Select a line from our live data (1.5 hits)
      await page.selectOption('[data-testid="line-selector"]', '1.5');

      // Select Over
      await page.click('[data-testid="over-button"]');

      // Verify selections
      const selectedLine = await page.locator('[data-testid="line-selector"]').inputValue();
      expect(selectedLine).toBe('1.5');

      const overSelected = await page
        .locator('[data-testid="over-button"]')
        .getAttribute('aria-pressed');
      expect(overSelected).toBe('true');

      await page.click('[data-testid="next-button"]');
    });

    await test.step('Fill Step 5: Game Selection', async () => {
      // Wait for game selection
      await page.waitForSelector('[data-testid="game-selector"]');

      // Select first available game
      await page.click('[data-testid="game-option"]:first-child');

      // Verify game selection
      const selectedGame = await page.locator('[data-testid="selected-game"]').textContent();
      expect(selectedGame).toBeTruthy();

      await page.click('[data-testid="next-button"]');
    });

    await test.step('Fill Step 6: Final Details', async () => {
      // Set unit size
      await page.fill('[data-testid="unit-size"]', '2.5');

      // Set confidence
      await page.click('[data-testid="confidence-4"]'); // High confidence

      // Add reasoning
      await page.fill(
        '[data-testid="reasoning"]',
        'Strong hitting performance against this pitcher historically'
      );

      // Verify final details
      const unitSize = await page.locator('[data-testid="unit-size"]').inputValue();
      expect(unitSize).toBe('2.5');

      const reasoning = await page.locator('[data-testid="reasoning"]').inputValue();
      expect(reasoning).toContain('Strong hitting performance');
    });

    await test.step('Submit Ticket', async () => {
      // Submit the ticket
      await page.click('[data-testid="submit-button"]');

      // Wait for submission to complete
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 15000 });

      // Verify success
      const successMessage = await page.locator('[data-testid="success-message"]').textContent();
      expect(successMessage).toContain('successfully submitted');

      // Verify redirect to success page
      await expect(page).toHaveURL(/.*success/);
    });
  });

  test('should test different MLB bet types', async ({ page }) => {
    for (const betType of MLB_TEST_DATA.betTypes) {
      await test.step(`Test ${betType} bet type`, async () => {
        // Go back to start
        await page.goto('/submit-ticket');

        // Quick navigation to bet type selection
        await page.selectOption('[data-testid="sport-selector"]', 'MLB');
        await page.click('[data-testid="next-button"]');

        // Select first available player
        await page.waitForSelector('[data-testid="player-search"]');
        await page.fill('[data-testid="player-search"]', MLB_TEST_DATA.players[0]);
        await page.waitForSelector('[data-testid="player-suggestion"]');
        await page.click('[data-testid="player-suggestion"]:first-child');
        await page.click('[data-testid="next-button"]');

        // Test this specific bet type
        await page.waitForSelector('[data-testid="bet-type-selector"]');
        await page.selectOption('[data-testid="bet-type-selector"]', betType);

        const selectedBetType = await page
          .locator('[data-testid="bet-type-selector"]')
          .inputValue();
        expect(selectedBetType).toBe(betType);

        // Verify lines are available for this bet type
        await page.click('[data-testid="next-button"]');
        await page.waitForSelector('[data-testid="line-selector"]');

        const lineOptions = await page.locator('[data-testid="line-selector"] option').count();
        expect(lineOptions).toBeGreaterThan(1); // Should have multiple line options
      });
    }
  });

  test('should test different MLB players', async ({ page }) => {
    for (const player of MLB_TEST_DATA.players.slice(0, 3)) {
      // Test first 3 players
      await test.step(`Test player: ${player}`, async () => {
        await page.goto('/submit-ticket');

        // Navigate to player selection
        await page.selectOption('[data-testid="sport-selector"]', 'MLB');
        await page.click('[data-testid="next-button"]');

        // Test this specific player
        await page.waitForSelector('[data-testid="player-search"]');
        await page.fill('[data-testid="player-search"]', player);

        // Wait for and verify player appears in search
        await page.waitForSelector('[data-testid="player-suggestion"]', { timeout: 10000 });

        const suggestionText = await page
          .locator('[data-testid="player-suggestion"]:first-child')
          .textContent();
        expect(suggestionText).toContain(player);

        // Select the player
        await page.click('[data-testid="player-suggestion"]:first-child');

        // Verify player was selected
        const selectedPlayer = await page.locator('[data-testid="selected-player"]').textContent();
        expect(selectedPlayer).toContain(player);
      });
    }
  });

  test('should validate form data before submission', async ({ page }) => {
    await test.step('Test form validation', async () => {
      // Try to proceed without selecting sport
      await page.click('[data-testid="next-button"]');

      // Should show validation error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

      // Select sport and proceed
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      // Try to proceed without selecting player
      await page.click('[data-testid="next-button"]');

      // Should show validation error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await test.step('Test error handling', async () => {
      // Mock a network error
      await page.route('**/api/submit-ticket', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      // Complete form and submit
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="player-search"]', 'Aaron Judge');
      await page.waitForSelector('[data-testid="player-suggestion"]');
      await page.click('[data-testid="player-suggestion"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="bet-type-selector"]', 'Hits');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="line-selector"]', '1.5');
      await page.click('[data-testid="over-button"]');
      await page.click('[data-testid="next-button"]');

      await page.click('[data-testid="game-option"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="unit-size"]', '2.5');
      await page.click('[data-testid="confidence-4"]');
      await page.fill('[data-testid="reasoning"]', 'Test reasoning');

      // Submit and expect error handling
      await page.click('[data-testid="submit-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      const errorText = await page.locator('[data-testid="error-message"]').textContent();
      expect(errorText).toContain('error');
    });
  });

  test('should persist form data across page refreshes', async ({ page }) => {
    await test.step('Test form persistence', async () => {
      // Fill some form data
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="player-search"]', 'Aaron Judge');
      await page.waitForSelector('[data-testid="player-suggestion"]');
      await page.click('[data-testid="player-suggestion"]:first-child');

      // Refresh the page
      await page.reload();

      // Check if data is still there
      const selectedSport = await page.locator('[data-testid="sport-selector"]').inputValue();
      expect(selectedSport).toBe('MLB');

      // Player selection should persist too
      const selectedPlayer = await page.locator('[data-testid="selected-player"]').textContent();
      expect(selectedPlayer).toContain('Aaron Judge');
    });
  });
});
