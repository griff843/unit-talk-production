import { test, expect } from '@playwright/test';

test.describe('Backend Integration - Live Data Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');
  });

  test('should verify props are loaded from live data', async ({ page }) => {
    await test.step('Check that live MLB props are available', async () => {
      // Navigate to sport selection
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      // Start typing a player name from our live data
      await page.waitForSelector('[data-testid="player-search"]');
      await page.fill('[data-testid="player-search"]', 'Aaron');

      // Should get suggestions from our live data
      await page.waitForSelector('[data-testid="player-suggestion"]', { timeout: 10000 });

      const suggestions = await page.locator('[data-testid="player-suggestion"]').allTextContents();
      expect(suggestions).toEqual(expect.arrayContaining([expect.stringContaining('Aaron Judge')]));
    });
  });

  test('should submit ticket and trigger grading workflow', async ({ page }) => {
    await test.step('Complete full submission flow', async () => {
      // Complete the form with live data
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
      await page.fill('[data-testid="reasoning"]', 'E2E test submission with live data');

      // Intercept the submission request to verify data
      let submissionData: any = null;
      await page.route('**/api/submit-ticket', async route => {
        const request = route.request();
        submissionData = JSON.parse(request.postData() || '{}');

        // Continue with the actual request
        await route.continue();
      });

      await page.click('[data-testid="submit-button"]');

      // Wait for submission to complete
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 15000 });

      // Verify the submission data contains our live data
      expect(submissionData).toBeTruthy();
      expect(submissionData.sport).toBe('MLB');
      expect(submissionData.playerName).toContain('Aaron Judge');
      expect(submissionData.betType).toBe('Hits');
      expect(submissionData.line).toBe('1.5');
      expect(submissionData.direction).toBe('over');
      expect(submissionData.units).toBe('2.5');
      expect(submissionData.confidence).toBe(4);
    });
  });

  test('should verify ticket appears in database', async ({ page, request }) => {
    await test.step('Submit ticket and verify database entry', async () => {
      // Complete form submission
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="player-search"]', 'Mookie Betts');
      await page.waitForSelector('[data-testid="player-suggestion"]');
      await page.click('[data-testid="player-suggestion"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="bet-type-selector"]', 'Home Runs');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="line-selector"]', '0.5');
      await page.click('[data-testid="over-button"]');
      await page.click('[data-testid="next-button"]');

      await page.click('[data-testid="game-option"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="unit-size"]', '1.5');
      await page.click('[data-testid="confidence-3"]');
      await page.fill('[data-testid="reasoning"]', 'Mookie Betts home run test for E2E');

      // Submit ticket
      await page.click('[data-testid="submit-button"]');
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 15000 });

      // Get the ticket ID from the success page
      const ticketId = await page.locator('[data-testid="ticket-id"]').textContent();
      expect(ticketId).toBeTruthy();

      // Verify ticket was created by checking the API
      const ticketResponse = await request.get(`/api/tickets/${ticketId}`);
      expect(ticketResponse.status()).toBe(200);

      const ticketData = await ticketResponse.json();
      expect(ticketData.playerName).toContain('Mookie Betts');
      expect(ticketData.betType).toBe('Home Runs');
      expect(ticketData.status).toBe('pending'); // Should be pending grading
    });
  });

  test('should verify Discord notification is triggered', async ({ page }) => {
    await test.step('Submit ticket and check Discord integration', async () => {
      let discordNotificationSent = false;

      // Intercept Discord webhook calls
      await page.route('**/discord.com/api/webhooks/**', async route => {
        discordNotificationSent = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      // Complete form submission
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="player-search"]', 'Juan Soto');
      await page.waitForSelector('[data-testid="player-suggestion"]');
      await page.click('[data-testid="player-suggestion"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="bet-type-selector"]', 'RBIs');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="line-selector"]', '1.5');
      await page.click('[data-testid="over-button"]');
      await page.click('[data-testid="next-button"]');

      await page.click('[data-testid="game-option"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="unit-size"]', '3.0');
      await page.click('[data-testid="confidence-5"]'); // Max confidence
      await page.fill('[data-testid="reasoning"]', 'High confidence RBI opportunity');

      await page.click('[data-testid="submit-button"]');
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 15000 });

      // Verify Discord notification was triggered
      expect(discordNotificationSent).toBe(true);
    });
  });

  test('should handle grading workflow integration', async ({ page, request }) => {
    await test.step('Submit ticket and verify grading process starts', async () => {
      // Complete form submission with high confidence
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="player-search"]', 'Freddie Freeman');
      await page.waitForSelector('[data-testid="player-suggestion"]');
      await page.click('[data-testid="player-suggestion"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="bet-type-selector"]', 'Hits');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="line-selector"]', '2.5');
      await page.click('[data-testid="over-button"]');
      await page.click('[data-testid="next-button"]');

      await page.click('[data-testid="game-option"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="unit-size"]', '5.0'); // Max units for auto-approval
      await page.click('[data-testid="confidence-5"]'); // Max confidence
      await page.fill('[data-testid="reasoning"]', 'Premium pick with highest confidence');

      await page.click('[data-testid="submit-button"]');
      await page.waitForSelector('[data-testid="success-message"]', { timeout: 15000 });

      // Get ticket ID and check if it gets auto-promoted due to high confidence
      const ticketId = await page.locator('[data-testid="ticket-id"]').textContent();

      // Wait a moment for processing
      await page.waitForTimeout(3000);

      // Check if ticket was promoted to daily picks
      const promotionResponse = await request.get(`/api/daily-picks?ticketId=${ticketId}`);
      const promotionData = await promotionResponse.json();

      // High confidence + max units should trigger auto-promotion
      expect(promotionData.promoted).toBeTruthy();
    });
  });

  test('should verify real game data is used', async ({ page, request }) => {
    await test.step('Check game selection uses live game data', async () => {
      await page.selectOption('[data-testid="sport-selector"]', 'MLB');
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="player-search"]', 'Ronald Acuna Jr.');
      await page.waitForSelector('[data-testid="player-suggestion"]');
      await page.click('[data-testid="player-suggestion"]:first-child');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="bet-type-selector"]', 'Hits');
      await page.click('[data-testid="next-button"]');

      await page.selectOption('[data-testid="line-selector"]', '1.5');
      await page.click('[data-testid="over-button"]');
      await page.click('[data-testid="next-button"]');

      // Verify that the game options shown are from our live data
      await page.waitForSelector('[data-testid="game-option"]');

      const gameOptions = await page.locator('[data-testid="game-option"]').allTextContents();
      expect(gameOptions.length).toBeGreaterThan(0);

      // Games should have real team names and upcoming times
      const firstGame = gameOptions[0];
      expect(firstGame).toMatch(/\w+\s+@\s+\w+/); // Team @ Team format

      // Select first game and verify it has a real game ID
      await page.click('[data-testid="game-option"]:first-child');

      const selectedGameId = await page
        .locator('[data-testid="selected-game"]')
        .getAttribute('data-game-id');
      expect(selectedGameId).toMatch(/^[a-f0-9]+$/); // Should be a hex ID from our live data
    });
  });
});
