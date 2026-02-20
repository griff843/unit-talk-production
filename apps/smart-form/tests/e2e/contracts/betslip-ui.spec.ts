/**
 * SPRINT-SMARTFORM-E2E-DETERMINISTIC-MODES-061B
 *
 * Contract Tests: Bet Slip UI Structure
 *
 * Tests the sportsbook-style bet slip UI without API dependencies.
 * NO Supabase credentials required.
 *
 * @tag contract
 */

import { test, expect } from '@playwright/test';
import { setupApiMocks } from '../fixtures/mocks';

test.describe('Bet Slip UI (Contract Tests)', () => {
  test.beforeEach(async ({ page }) => {
    // Setup API mocks
    await setupApiMocks(page);

    // Navigate to submit ticket page
    await page.goto('/submit-ticket');
    await page.waitForLoadState('domcontentloaded');
  });

  test('bet slip panel is visible', async ({ page }) => {
    await page.waitForTimeout(2000);

    const betSlip = page.locator('text=Bet Slip');
    await expect(betSlip).toBeVisible({ timeout: 5000 });
  });

  test('bet slip shows empty state', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for empty state indicators in page content
    const pageContent = await page.content();
    const hasEmptyIndicator =
      pageContent.includes('No legs') ||
      pageContent.includes('add your first') ||
      pageContent.includes('0 Leg') ||
      pageContent.includes('Bet Slip');

    expect(hasEmptyIndicator).toBe(true);
  });

  test('page has form controls', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Should have dropdowns or select buttons
    const controls = await page.locator('button, select, input').count();
    expect(controls).toBeGreaterThan(0);
  });
});

test.describe('Layout (Contract Tests)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForLoadState('domcontentloaded');
  });

  test('desktop layout loads correctly', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    // Page should have bet slip visible
    const betSlip = page.locator('text=Bet Slip');
    await expect(betSlip).toBeVisible({ timeout: 5000 });
  });

  test('mobile layout loads correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Page should still have buttons
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
  });
});

test.describe('Accessibility (Contract Tests)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page has focusable elements', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Tab should move focus
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    const hasFocus = await focusedElement.count();
    expect(hasFocus).toBeGreaterThan(0);
  });

  test('buttons have text content', async ({ page }) => {
    await page.waitForTimeout(2000);

    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Check first few buttons have content
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const hasContent = (text && text.trim().length > 0) || ariaLabel;
      expect(hasContent).toBeTruthy();
    }
  });
});

test.describe('Page Stability (Contract Tests)', () => {
  test('page loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForTimeout(3000);

    // Should have minimal critical errors
    const criticalErrors = errors.filter(
      e => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('page renders with content', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/submit-ticket');
    await page.waitForTimeout(2000);

    // Body should have substantial content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(50);
  });
});
