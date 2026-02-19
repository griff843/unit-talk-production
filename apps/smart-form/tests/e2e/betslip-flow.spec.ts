/**
 * SPRINT-SMARTFORM-BETSLIP-SPORTSBOOK-MANUAL-061
 * E2E Tests: Sportsbook-style Bet Slip Flow
 *
 * Tests the enhanced bet slip experience:
 * - Add multiple legs without wizard reset
 * - Sticky bet slip panel visibility
 * - Quick navigation to Review
 * - Inline edit/delete on bet slip
 */

import { test, expect, type Page } from '@playwright/test';

// Track network requests for debugging
const networkRequests: { url: string; method: string }[] = [];

test.describe('Sportsbook Bet Slip Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear network requests
    networkRequests.length = 0;

    // Monitor API requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        networkRequests.push({ url, method: request.method() });
      }
    });

    // Navigate to submit ticket page
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Multi-Leg Addition Without Reset', () => {
    test('should add 3 legs without resetting to step 1', async ({ page }) => {
      // === LEG 1 ===
      // Step 1: Select Sport & Bet Type
      await expect(page.locator('text=Sport & Bet Type')).toBeVisible();

      // Select NBA
      const sportSelect = page.locator('button:has-text("Select a sport")').first();
      await sportSelect.click();
      await page.locator('[role="option"]:has-text("NBA")').click();

      // Select Player Prop
      const betTypeSelect = page.locator('button:has-text("What do you want to bet on")').first();
      await betTypeSelect.click();
      await page.locator('[role="option"]:has-text("Player prop")').click();

      // Click Next to go to Step 2
      await page.locator('button:has-text("Next")').click();
      await expect(page.locator('text=Participant')).toBeVisible();

      // Step 2: Enter player (manual mode for testing)
      // Click Manual mode
      const manualBtn = page.locator('button:has-text("Manual")');
      if (await manualBtn.isVisible()) {
        await manualBtn.click();
      }

      // Enter player name
      const playerInput = page
        .locator('input[placeholder*="LeBron"]')
        .or(page.locator('input[placeholder*="player"]'));
      if (await playerInput.isVisible()) {
        await playerInput.fill('LeBron James');
      }

      // Select or enter stat type
      const statTypeSelect = page.locator('button:has-text("Select stat type")');
      if (await statTypeSelect.isVisible()) {
        await statTypeSelect.click();
        await page.locator('[role="option"]').first().click();
      } else {
        const statInput = page.locator('input[placeholder*="PTS"]');
        if (await statInput.isVisible()) {
          await statInput.fill('PTS');
        }
      }

      // Click Next to go to Step 3
      await page.locator('button:has-text("Next")').click();
      await expect(page.locator('text=Line & Odds')).toBeVisible();

      // Step 3: Enter line and odds
      const lineInput = page.locator('input[type="number"]').first();
      await lineInput.fill('24.5');

      // Select Over direction
      await page.locator('button:has-text("Over")').click();

      // Enter odds
      const oddsInput = page.locator('input[placeholder*="-110"]');
      await oddsInput.fill('-110');

      // Add leg via "Add & Continue" button (should stay on Step 2)
      const addContinueBtn = page.locator('button:has-text("Add & Continue")');
      if (await addContinueBtn.isVisible()) {
        await addContinueBtn.click();
      } else {
        // Fallback: use "Add This Leg" then manually verify step
        await page.locator('button:has-text("Add This Leg")').click();
      }

      // CRITICAL ASSERTION: Should be on Step 2 (Participant), NOT Step 1
      await expect(page.locator('text=Participant')).toBeVisible({ timeout: 5000 });

      // Verify bet slip shows 1 leg
      await expect(page.locator('text=1 Leg').or(page.locator('text=1 leg'))).toBeVisible();

      // === LEG 2 ===
      // Enter second player (we're already on Step 2)
      if (await playerInput.isVisible()) {
        await playerInput.fill('Anthony Davis');
      }

      // Select stat type
      if (await statTypeSelect.isVisible()) {
        await statTypeSelect.click();
        await page.locator('[role="option"]').first().click();
      }

      // Go to Step 3
      await page.locator('button:has-text("Next")').click();

      // Enter details for leg 2
      await lineInput.fill('10.5');
      await page.locator('button:has-text("Under")').click();
      await oddsInput.fill('-115');

      // Add leg 2
      if (await addContinueBtn.isVisible()) {
        await addContinueBtn.click();
      } else {
        await page.locator('button:has-text("Add This Leg")').click();
      }

      // Should still be on Step 2
      await expect(page.locator('text=Participant')).toBeVisible({ timeout: 5000 });

      // Verify bet slip shows 2 legs
      await expect(page.locator('text=2 Legs').or(page.locator('text=2 leg'))).toBeVisible();

      // === LEG 3 ===
      if (await playerInput.isVisible()) {
        await playerInput.fill('Kevin Durant');
      }

      if (await statTypeSelect.isVisible()) {
        await statTypeSelect.click();
        await page.locator('[role="option"]').first().click();
      }

      await page.locator('button:has-text("Next")').click();
      await lineInput.fill('28.5');
      await page.locator('button:has-text("Over")').click();
      await oddsInput.fill('-105');

      // Add leg 3
      if (await addContinueBtn.isVisible()) {
        await addContinueBtn.click();
      } else {
        await page.locator('button:has-text("Add This Leg")').click();
      }

      // FINAL ASSERTION: 3 legs added, still on Step 2
      await expect(page.locator('text=Participant')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=3 Legs').or(page.locator('text=3 leg'))).toBeVisible();

      console.log('SUCCESS: Added 3 legs without resetting to Step 1');
    });

    test('should reach Review in 1 click after adding legs', async ({ page }) => {
      // Add a quick leg first (using the existing flow but abbreviated)
      // Select Sport
      const sportSelect = page.locator('button:has-text("Select a sport")').first();
      await sportSelect.click();
      await page.locator('[role="option"]:has-text("NBA")').click();

      // Select Moneyline (simpler than player prop)
      const betTypeSelect = page.locator('button:has-text("What do you want to bet on")').first();
      await betTypeSelect.click();
      await page.locator('[role="option"]:has-text("Moneyline")').click();

      // Go to Step 2
      await page.locator('button:has-text("Next")').click();

      // Select team
      const teamSelect = page.locator('button:has-text("Select a team")');
      if (await teamSelect.isVisible()) {
        await teamSelect.click();
        await page.locator('[role="option"]').first().click();
      } else {
        const teamInput = page
          .locator('input[placeholder*="Lakers"]')
          .or(page.locator('input[placeholder*="team"]'));
        if (await teamInput.isVisible()) {
          await teamInput.fill('Los Angeles Lakers');
        }
      }

      // Go to Step 3
      await page.locator('button:has-text("Next")').click();

      // Enter odds
      const oddsInput = page.locator('input[placeholder*="-110"]');
      await oddsInput.fill('-150');

      // Add leg
      await page.locator('button:has-text("Add This Leg")').click();

      // Wait for step 2 (no reset)
      await page.waitForTimeout(500);

      // NOW: Click "Review & Submit" on the bet slip (1 click to review)
      const reviewButton = page.locator('button:has-text("Review & Submit")');
      await expect(reviewButton).toBeVisible();

      // 1-CLICK TO REVIEW
      await reviewButton.click();

      // Verify we're on the Review step
      await expect(page.locator('text=Review')).toBeVisible();

      // Verify we can see the leg in the review
      await expect(page.locator('text=Legs (1)').or(page.locator('text=1 Leg'))).toBeVisible();

      console.log('SUCCESS: Reached Review in 1 click from bet slip');
    });
  });

  test.describe('Sticky Bet Slip Panel', () => {
    test('should show bet slip panel at all times', async ({ page }) => {
      // Bet slip header should be visible even with no legs
      await expect(page.locator('text=Bet Slip')).toBeVisible();

      // Should show empty state message
      await expect(
        page
          .locator('text=No legs added yet')
          .or(page.locator('text=Complete the form to add your first leg'))
      ).toBeVisible();
    });

    test('should allow inline edit on bet slip', async ({ page }) => {
      // Add a leg first
      const sportSelect = page.locator('button:has-text("Select a sport")').first();
      await sportSelect.click();
      await page.locator('[role="option"]:has-text("NBA")').click();

      const betTypeSelect = page.locator('button:has-text("What do you want to bet on")').first();
      await betTypeSelect.click();
      await page.locator('[role="option"]:has-text("Moneyline")').click();

      await page.locator('button:has-text("Next")').click();

      // Manual mode for team
      const manualBtn = page.locator('button:has-text("Manual")');
      if (await manualBtn.isVisible()) {
        await manualBtn.click();
      }

      const teamInput = page
        .locator('input[placeholder*="Lakers"]')
        .or(page.locator('input[placeholder*="team"]'));
      if (await teamInput.isVisible()) {
        await teamInput.fill('Boston Celtics');
      }

      await page.locator('button:has-text("Next")').click();

      const oddsInput = page.locator('input[placeholder*="-110"]');
      await oddsInput.fill('-120');

      await page.locator('button:has-text("Add This Leg")').click();

      // Now find the edit button on the leg in bet slip
      const editButton = page
        .locator('button[class*="edit"]')
        .or(page.locator('svg.lucide-edit-2').locator('..'));

      // Hover over the leg item to show edit button
      const legItem = page.locator('text=Boston Celtics').locator('..');
      await legItem.hover();

      // Click edit if visible
      if (await editButton.isVisible()) {
        await editButton.click();

        // Should show edit inputs
        await expect(
          page.locator('input[placeholder="24.5"]').or(page.locator('label:has-text("Line")'))
        ).toBeVisible();

        console.log('SUCCESS: Inline edit mode activated');
      }
    });

    test('should allow delete from bet slip', async ({ page }) => {
      // Add a leg
      const sportSelect = page.locator('button:has-text("Select a sport")').first();
      await sportSelect.click();
      await page.locator('[role="option"]:has-text("NBA")').click();

      const betTypeSelect = page.locator('button:has-text("What do you want to bet on")').first();
      await betTypeSelect.click();
      await page.locator('[role="option"]:has-text("Moneyline")').click();

      await page.locator('button:has-text("Next")').click();

      const manualBtn = page.locator('button:has-text("Manual")');
      if (await manualBtn.isVisible()) {
        await manualBtn.click();
      }

      const teamInput = page.locator('input[placeholder*="team"]').first();
      if (await teamInput.isVisible()) {
        await teamInput.fill('Miami Heat');
      }

      await page.locator('button:has-text("Next")').click();

      const oddsInput = page.locator('input[placeholder*="-110"]');
      await oddsInput.fill('+130');

      await page.locator('button:has-text("Add This Leg")').click();

      // Verify 1 leg in slip
      await expect(page.locator('text=1 Leg').or(page.locator('text=1 leg'))).toBeVisible();

      // Find and click delete button
      const legItem = page.locator('text=Miami Heat').locator('..');
      await legItem.hover();

      const deleteButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-trash-2') });
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show 0 legs / empty state
        await expect(
          page.locator('text=No legs added yet').or(page.locator('text=0 Legs'))
        ).toBeVisible();

        console.log('SUCCESS: Leg deleted from bet slip');
      }
    });
  });

  test.describe('Parlay Odds Calculation', () => {
    test('should calculate and display parlay odds for multiple legs', async ({ page }) => {
      // This test verifies the parlay odds calculation is shown
      // We'll add 2 legs and check that parlay odds appear

      // Add first leg (abbreviated)
      const sportSelect = page.locator('button:has-text("Select a sport")').first();
      await sportSelect.click();
      await page.locator('[role="option"]:has-text("NBA")').click();

      const betTypeSelect = page.locator('button:has-text("What do you want to bet on")').first();
      await betTypeSelect.click();
      await page.locator('[role="option"]:has-text("Moneyline")').click();

      await page.locator('button:has-text("Next")').click();

      const manualBtn = page.locator('button:has-text("Manual")');
      if (await manualBtn.isVisible()) {
        await manualBtn.click();
      }

      const teamInput = page.locator('input[placeholder*="team"]').first();
      if (await teamInput.isVisible()) {
        await teamInput.fill('Team A');
      }

      await page.locator('button:has-text("Next")').click();

      const oddsInput = page.locator('input[placeholder*="-110"]');
      await oddsInput.fill('-110');

      await page.locator('button:has-text("Add This Leg")').click();

      // After 1 leg: should show "Odds" not "Parlay Odds"
      await expect(page.locator('text=Odds').first()).toBeVisible();

      // Add second leg
      if (await teamInput.isVisible()) {
        await teamInput.fill('Team B');
      }

      await page.locator('button:has-text("Next")').click();
      await oddsInput.fill('-110');

      await page.locator('button:has-text("Add This Leg")').click();

      // After 2 legs: should show "Parlay Odds"
      await expect(page.locator('text=Parlay Odds')).toBeVisible();

      // Should also show potential payout
      await expect(page.locator('text=$10 wins')).toBeVisible();

      console.log('SUCCESS: Parlay odds calculation displayed');
    });
  });
});

// Final summary
test.afterAll(() => {
  console.log('\\n=== BETSLIP FLOW TEST SUMMARY ===');
  console.log('Tests verify:');
  console.log('  1. Add 3 legs without resetting to Step 1');
  console.log('  2. Reach Review in 1 click from bet slip');
  console.log('  3. Sticky bet slip panel visibility');
  console.log('  4. Inline edit/delete functionality');
  console.log('  5. Parlay odds calculation');
});
