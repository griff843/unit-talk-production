/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * V2 Builder UI Contract Tests (Manual-First)
 *
 * These tests verify UI behavior WITHOUT requiring Supabase connection.
 * They use mocked API responses to test component interactions.
 */

import { test, expect } from '@playwright/test';

test.describe('V2 Builder UI Contract', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the teams API
    await page.route('**/api/catalog/teams*', async route => {
      const url = new URL(route.request().url());
      const sport = url.searchParams.get('sport') || 'NBA';

      const teamsBySport: Record<string, any[]> = {
        NBA: [
          { id: 'lal-001', name: 'Los Angeles Lakers', abbr: 'LAL', sport: 'NBA' },
          { id: 'bos-001', name: 'Boston Celtics', abbr: 'BOS', sport: 'NBA' },
          { id: 'gsw-001', name: 'Golden State Warriors', abbr: 'GSW', sport: 'NBA' },
          { id: 'phx-001', name: 'Phoenix Suns', abbr: 'PHX', sport: 'NBA' },
        ],
        NFL: [
          { id: 'kc-001', name: 'Kansas City Chiefs', abbr: 'KC', sport: 'NFL' },
          { id: 'sf-001', name: 'San Francisco 49ers', abbr: 'SF', sport: 'NFL' },
        ],
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          teams: teamsBySport[sport] || [],
          meta: { total: (teamsBySport[sport] || []).length, sport },
        }),
      });
    });

    // Mock the cappers API
    await page.route('**/api/cappers*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cappers: [
            { id: 'capper-1', name: 'Test Capper', username: 'test_capper', active: true },
            { id: 'capper-2', name: 'Elite Picks', username: 'elite_picks', active: true },
          ],
        }),
      });
    });

    await page.goto('/submit-ticket/v2');
    // Wait for V2Builder to fully load
    await expect(page.getByTestId('v2-builder')).toBeVisible({ timeout: 10000 });
  });

  test('should display sport pills with NBA selected by default', async ({ page }) => {
    // Sport pills should exist
    await expect(page.getByTestId('sport-pills')).toBeVisible();
    // NBA should be selected by default
    const nbaButton = page.getByTestId('sport-pill-nba');
    await expect(nbaButton).toBeVisible();
    // Check it has the selected styling (bg-blue-600)
    await expect(nbaButton).toHaveClass(/bg-blue-600/);
  });

  test('should show matchup builder on page load', async ({ page }) => {
    // Should show the matchup builder section
    await expect(page.getByTestId('matchup-builder')).toBeVisible();
    await expect(page.getByTestId('away-team-select')).toBeVisible();
    await expect(page.getByTestId('home-team-select')).toBeVisible();
    await expect(page.getByTestId('game-date-input')).toBeVisible();
  });

  test('should show empty bet slip on load', async ({ page }) => {
    // Bet slip should be visible
    await expect(page.getByTestId('bet-slip')).toBeVisible();
    // Bet slip should be empty
    await expect(page.getByTestId('slip-empty')).toBeVisible();
    await expect(page.getByText('Your bet slip is empty')).toBeVisible();
    await expect(page.getByText('Build a matchup first, then add picks')).toBeVisible();
  });

  test('should NOT show market board without matchup', async ({ page }) => {
    // Wait for matchup builder to be visible (indicates page is loaded)
    await expect(page.getByTestId('matchup-builder')).toBeVisible();
    // Placeholder should be visible (market board is locked until matchup complete)
    await expect(page.getByTestId('market-board-placeholder')).toBeVisible();
    // Use heading role to get specific element
    await expect(page.getByRole('heading', { name: 'Build a Matchup' })).toBeVisible();
    // Market board should not be visible
    await expect(page.getByTestId('market-board')).not.toBeVisible();
  });

  test('should load teams when focusing team selector', async ({ page }) => {
    // Wait for matchup builder to be ready
    await expect(page.getByTestId('matchup-builder')).toBeVisible();

    // Focus the away team input
    const awayInput = page.getByTestId('away-team-select-input');
    await awayInput.click();

    // Wait for teams API to respond and dropdown to appear
    await expect(page.getByTestId('away-team-select-dropdown')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('away-team-select-option-lal-001')).toBeVisible();
    await expect(page.getByTestId('away-team-select-option-bos-001')).toBeVisible();
  });

  test('should select away team from dropdown', async ({ page }) => {
    // Focus and search
    const awayInput = page.getByTestId('away-team-select-input');
    await awayInput.click();

    // Wait for teams to load and click Lakers
    await page.getByTestId('away-team-select-option-lal-001').click();

    // Should show selected team
    await expect(page.getByTestId('away-team-select-value')).toHaveText('LAL');
  });

  test('should show market board after building matchup', async ({ page }) => {
    // Select away team
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    // Select home team
    await page.getByTestId('home-team-select-input').click();
    await page.getByTestId('home-team-select-option-bos-001').click();

    // Market board should appear
    const marketBoard = page.getByTestId('market-board');
    await expect(marketBoard).toBeVisible();
    // Market category buttons should be visible (scope to market board to avoid MLB conflict)
    await expect(marketBoard.getByRole('button', { name: 'Spread' })).toBeVisible();
    await expect(marketBoard.getByRole('button', { name: 'ML' })).toBeVisible();
    await expect(marketBoard.getByRole('button', { name: 'O/U' })).toBeVisible();
  });

  test('should show matchup preview when complete', async ({ page }) => {
    // Build matchup
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    await page.getByTestId('home-team-select-input').click();
    await page.getByTestId('home-team-select-option-bos-001').click();

    // Should show matchup preview and ready indicator
    await expect(page.getByTestId('matchup-preview')).toBeVisible();
    await expect(page.getByTestId('matchup-ready')).toBeVisible();
  });

  test('should require capper selection before submit', async ({ page }) => {
    // Build matchup first
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    await page.getByTestId('home-team-select-input').click();
    await page.getByTestId('home-team-select-option-bos-001').click();

    // Wait for market board to appear
    await expect(page.getByTestId('market-board')).toBeVisible({ timeout: 5000 });

    // Add a bet - enter spread
    await page.fill('input[placeholder="-3.5"]', '-3.5');
    await page.getByRole('button', { name: /LAL/ }).first().click();

    // Submit button should be disabled without capper
    await expect(page.getByTestId('submit-btn')).toBeDisabled();
  });

  test('should show units input in bet slip', async ({ page }) => {
    await expect(page.getByTestId('units-input')).toBeVisible();
    // Default value should be 1
    const unitsInput = page.getByTestId('units-value');
    await expect(unitsInput).toHaveValue('1');
  });

  test('should allow incrementing/decrementing units', async ({ page }) => {
    // Find the units increment button
    const incrementButton = page.getByTestId('units-increase');
    await incrementButton.click();

    // Units should now be 1.5
    const unitsInput = page.getByTestId('units-value');
    await expect(unitsInput).toHaveValue('1.5');
  });

  test('should allow changing sport filter', async ({ page }) => {
    // Click NFL
    await page.getByTestId('sport-pill-nfl').click();

    // NFL button should be selected
    const nflButton = page.getByTestId('sport-pill-nfl');
    await expect(nflButton).toHaveClass(/bg-blue-600/);

    // Team selector should load NFL teams
    const awayInput = page.getByTestId('away-team-select-input');
    await awayInput.click();
    await expect(page.getByTestId('away-team-select-option-kc-001')).toBeVisible({ timeout: 5000 });
  });

  test('should clear teams when sport changes', async ({ page }) => {
    // Select a team
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    // Verify team is selected
    await expect(page.getByTestId('away-team-select-value')).toBeVisible();

    // Change sport
    await page.getByTestId('sport-pill-nfl').click();

    // Team should be cleared (input should be back to placeholder)
    await expect(page.getByTestId('away-team-select-input')).toBeVisible();
  });

  test('should show parlay odds when 2+ legs added', async ({ page }) => {
    // Build matchup
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    await page.getByTestId('home-team-select-input').click();
    await page.getByTestId('home-team-select-option-bos-001').click();

    // Wait for market board to appear
    await expect(page.getByTestId('market-board')).toBeVisible({ timeout: 5000 });

    // Add first bet (spread)
    await page.fill('input[placeholder="-3.5"]', '-3.5');
    await page.getByRole('button', { name: /LAL/ }).first().click();

    // Add second bet (total)
    await page.fill('input[placeholder="225.5"]', '220.5');
    await page.getByRole('button', { name: /Over 220.5/ }).click();

    // Should show parlay info
    await expect(page.getByTestId('slip-summary')).toContainText('2 selections (Parlay)');
    await expect(page.getByTestId('parlay-odds')).toBeVisible();
  });

  test('should allow removing legs from slip', async ({ page }) => {
    // Build matchup
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    await page.getByTestId('home-team-select-input').click();
    await page.getByTestId('home-team-select-option-bos-001').click();

    // Wait for market board to appear
    await expect(page.getByTestId('market-board')).toBeVisible({ timeout: 5000 });

    // Add a bet
    await page.fill('input[placeholder="-3.5"]', '-3.5');
    await page.getByRole('button', { name: /LAL/ }).first().click();

    // Verify bet is in slip
    await expect(page.getByTestId('slip-summary')).toContainText('1 selection');

    // Remove the bet
    await page.getByTestId('remove-leg-btn').click();

    // Slip should be empty again
    await expect(page.getByTestId('slip-empty')).toBeVisible();
  });

  test('should have date picker defaulted to today', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = page.getByTestId('game-date-input');
    await expect(dateInput).toHaveValue(today);
  });

  test('should exclude selected team from opposite selector', async ({ page }) => {
    // Select Lakers as away team
    await page.getByTestId('away-team-select-input').click();
    await page.getByTestId('away-team-select-option-lal-001').click();

    // Open home team selector
    await page.getByTestId('home-team-select-input').click();

    // Lakers should not appear in home team options (check that BOS exists but LAL does not)
    await expect(page.getByTestId('home-team-select-option-bos-001')).toBeVisible();
    await expect(page.getByTestId('home-team-select-option-lal-001')).not.toBeVisible();
  });
});
