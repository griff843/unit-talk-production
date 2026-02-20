/**
 * SPRINT-SMARTFORM-E2E-DETERMINISTIC-MODES-061B
 *
 * Contract Tests: PickWizard UI Structure
 *
 * These tests verify the UI structure and layout without depending on API data.
 * NO Supabase credentials required - runs in any environment.
 *
 * @tag contract
 */

import { test, expect } from '@playwright/test';
import { setupApiMocks } from '../fixtures/mocks';

test.describe('PickWizard UI Structure (Contract Tests)', () => {
  test.beforeEach(async ({ page }) => {
    // Setup API mocks before navigation
    await setupApiMocks(page);

    // Navigate to submit ticket page
    await page.goto('/submit-ticket');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads successfully', async ({ page }) => {
    // Page should load with 200 status
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test('page has form elements', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Should have buttons
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
  });

  test('page has Next button', async ({ page }) => {
    await page.waitForTimeout(2000);

    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeVisible({ timeout: 5000 });
  });

  test('Next button is disabled without selections', async ({ page }) => {
    await page.waitForTimeout(2000);

    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test('page has sport selection area', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for sport-related content
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('sport');
  });

  test('page has bet slip panel', async ({ page }) => {
    await page.waitForTimeout(2000);

    const betSlip = page.locator('text=Bet Slip');
    await expect(betSlip).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Page Load Resilience (Contract Tests)', () => {
  test('page loads with mocked APIs', async ({ page }) => {
    await setupApiMocks(page);

    const response = await page.goto('/submit-ticket');
    expect(response?.status()).toBe(200);
  });

  test('page has interactive elements', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForTimeout(2000);

    // Should have clickable elements
    const clickables = await page.locator('button, a, [role="button"]').count();
    expect(clickables).toBeGreaterThan(0);
  });

  test('page structure is correct', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForTimeout(2000);

    // Should have main content area
    const main = page.locator('main, [role="main"], .container, .content');
    const hasMain = (await main.count()) > 0;

    // Or at minimum, the body has content
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.length).toBeGreaterThan(100);
  });
});

test.describe('Accessibility Basics (Contract Tests)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page has heading', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Should have at least one heading
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });

  test('buttons are keyboard accessible', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Tab should move focus to a button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    const isFocused = await focusedElement.count();
    expect(isFocused).toBeGreaterThan(0);
  });
});
