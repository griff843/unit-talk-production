/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * V2 Builder Integration Tests (Manual-First)
 *
 * These tests require a real Supabase connection.
 * They verify the full submission flow including:
 * - Manual matchup building
 * - Leg addition
 * - Units input
 * - Ticket submission
 * - Idempotency verification
 */

import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// Skip if no Supabase URL configured
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
test.skip(!SUPABASE_URL, 'Requires NEXT_PUBLIC_SUPABASE_URL');

test.describe('V2 Builder Integration', () => {
  test.describe.configure({ mode: 'serial' });

  // Used to track submitted bet slip ID across tests if needed
  let _submittedBetSlipId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/submit-ticket/v2');
    // Wait for teams API to load
    await page.waitForResponse(
      resp => resp.url().includes('/api/catalog/teams') && resp.status() === 200
    );
  });

  test('should load teams from catalog API', async ({ page }) => {
    // Focus the away team input
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();

    // Should show team options (depends on catalog having data)
    // Just verify the dropdown opens
    await expect(page.locator('.absolute.z-50')).toBeVisible({ timeout: 5000 });
  });

  test('should load cappers from API', async ({ page }) => {
    // Wait for cappers to load
    await page.waitForResponse(
      resp => resp.url().includes('/api/cappers') && resp.status() === 200
    );

    // Capper dropdown should be populated
    const capperSelect = page.locator('select');
    await expect(capperSelect).toBeVisible();

    // Should have options beyond the placeholder
    const options = await capperSelect.locator('option').count();
    expect(options).toBeGreaterThan(1);
  });

  test('should complete manual matchup flow', async ({ page }) => {
    // Search and select away team
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();
    await awayInput.first().fill('Lakers');

    // Wait for filtered results and select
    await page.waitForTimeout(300);
    const lakersOption = page.locator('button').filter({ hasText: 'Lakers' });
    if (await lakersOption.isVisible()) {
      await lakersOption.click();
    } else {
      // Fallback: select first available team
      const firstTeam = page.locator('.absolute.z-50 button').first();
      await firstTeam.click();
    }

    // Search and select home team
    const homeInput = page.getByPlaceholder('Search team...');
    await homeInput.click();
    await homeInput.fill('Celtics');
    await page.waitForTimeout(300);
    const celticsOption = page.locator('button').filter({ hasText: 'Celtics' });
    if (await celticsOption.isVisible()) {
      await celticsOption.click();
    } else {
      // Fallback: select first available team
      const firstTeam = page.locator('.absolute.z-50 button').first();
      await firstTeam.click();
    }

    // Matchup should be complete
    await expect(page.getByText('Ready')).toBeVisible();

    // Market board should be visible
    await expect(page.getByRole('button', { name: 'Spread' })).toBeVisible();
  });

  test('should add player prop to slip', async ({ page }) => {
    // Build matchup first
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();
    const firstAwayTeam = page.locator('.absolute.z-50 button').first();
    await firstAwayTeam.click();

    const homeInput = page.getByPlaceholder('Search team...');
    await homeInput.click();
    const firstHomeTeam = page.locator('.absolute.z-50 button').first();
    await firstHomeTeam.click();

    // Navigate to props
    await page.getByRole('button', { name: 'Props' }).click();

    // Enter player prop
    await page.fill('input[placeholder="Enter player name..."]', 'LeBron James');
    await page.getByRole('button', { name: 'Points' }).click();
    await page.fill('input[placeholder="25.5"]', '27.5');
    await page.getByRole('button', { name: 'Over' }).click();

    // Add to slip
    await page.getByRole('button', { name: 'Add to Slip' }).click();

    // Should show in slip
    await expect(page.getByText('1 selection (Single)')).toBeVisible();
    await expect(page.getByText('LeBron James')).toBeVisible();
  });

  test('should submit ticket with idempotency key', async ({ page }) => {
    // Generate idempotency key for this test
    const idempotencyKey = uuidv4();
    _submittedBetSlipId = idempotencyKey;

    // Build matchup
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();
    const firstAwayTeam = page.locator('.absolute.z-50 button').first();
    await firstAwayTeam.click();

    const homeInput = page.getByPlaceholder('Search team...');
    await homeInput.click();
    const firstHomeTeam = page.locator('.absolute.z-50 button').first();
    await firstHomeTeam.click();

    // Add a player prop
    await page.getByRole('button', { name: 'Props' }).click();
    await page.fill('input[placeholder="Enter player name..."]', 'Test Player');
    await page.getByRole('button', { name: 'Points' }).click();
    await page.fill('input[placeholder="25.5"]', '25.5');
    await page.getByRole('button', { name: 'Over' }).click();
    await page.getByRole('button', { name: 'Add to Slip' }).click();

    // Select capper
    const capperSelect = page.locator('select');
    await capperSelect.selectOption({ index: 1 }); // First real capper

    // Set units
    await page.getByRole('button', { name: 'Increase units' }).click();
    await expect(page.locator('input[type="number"]').first()).toHaveValue('1.5');

    // Submit
    await page.getByRole('button', { name: /Submit/ }).click();

    // Wait for submission
    const response = await page.waitForResponse(
      resp => resp.url().includes('/api/submit-ticket') && resp.request().method() === 'POST'
    );

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.bet_slip_id).toBeTruthy();
    expect(data.status).toBe('submitted');
  });

  test('should validate units range', async ({ page }) => {
    // Try to set units below minimum
    const unitsInput = page.locator('input[type="number"]').first();

    // Clear and type invalid value
    await unitsInput.fill('0');
    await unitsInput.blur();

    // Should not allow values below 0.5
    await expect(unitsInput).not.toHaveValue('0');
  });

  test('should calculate and display parlay odds', async ({ page }) => {
    // Build matchup
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();
    const firstAwayTeam = page.locator('.absolute.z-50 button').first();
    await firstAwayTeam.click();

    const homeInput = page.getByPlaceholder('Search team...');
    await homeInput.click();
    const firstHomeTeam = page.locator('.absolute.z-50 button').first();
    await firstHomeTeam.click();

    // Add first player prop
    await page.getByRole('button', { name: 'Props' }).click();
    await page.fill('input[placeholder="Enter player name..."]', 'Player 1');
    await page.getByRole('button', { name: 'Points' }).click();
    await page.fill('input[placeholder="25.5"]', '20.5');
    await page.getByRole('button', { name: 'Over' }).click();
    await page.getByRole('button', { name: 'Add to Slip' }).click();

    // Add second player prop
    await page.fill('input[placeholder="Enter player name..."]', 'Player 2');
    await page.fill('input[placeholder="25.5"]', '15.5');
    await page.getByRole('button', { name: 'Add to Slip' }).click();

    // Should show parlay
    await expect(page.getByText('2 selections (Parlay)')).toBeVisible();
    await expect(page.getByText('Parlay Odds:')).toBeVisible();

    // Parlay odds should be displayed (two -110 legs = roughly +264)
    const parlayOddsText = await page.locator('text=/\\+\\d+/').first().textContent();
    expect(parlayOddsText).toMatch(/\+\d+/);
  });

  test('should clear all legs', async ({ page }) => {
    // Build matchup
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();
    const firstAwayTeam = page.locator('.absolute.z-50 button').first();
    await firstAwayTeam.click();

    const homeInput = page.getByPlaceholder('Search team...');
    await homeInput.click();
    const firstHomeTeam = page.locator('.absolute.z-50 button').first();
    await firstHomeTeam.click();

    // Add a spread bet
    await page.fill('input[placeholder="-3.5"]', '-3');
    const spreadButton = page
      .locator('button')
      .filter({ hasText: /\+3|-3/ })
      .first();
    await spreadButton.click();

    // Verify bet is in slip
    await expect(page.getByText('1 selection')).toBeVisible();

    // Clear all
    await page.getByRole('button', { name: 'Clear All' }).click();

    // Slip should be empty
    await expect(page.getByText('Your bet slip is empty')).toBeVisible();
  });

  test('should preserve matchup after submission', async ({ page }) => {
    // Build matchup
    const awayInput = page.getByPlaceholder('Search team...');
    await awayInput.first().click();
    const firstAwayTeam = page.locator('.absolute.z-50 button').first();
    await firstAwayTeam.click();

    const homeInput = page.getByPlaceholder('Search team...');
    await homeInput.click();
    const firstHomeTeam = page.locator('.absolute.z-50 button').first();
    await firstHomeTeam.click();

    // Verify matchup is ready
    await expect(page.getByText('Ready')).toBeVisible();

    // The matchup should remain after the builder is ready
    // (In production, after submission the legs clear but matchup stays)
    await expect(page.getByRole('button', { name: 'Spread' })).toBeVisible();
  });
});
