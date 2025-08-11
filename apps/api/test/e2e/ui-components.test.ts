/**
 * UI Components E2E Tests
 * Comprehensive testing of Unit Talk UI components using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Unit Talk Smart Form - Step1Essentials Component', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API endpoints
    await page.route('**/api/cappers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { 
            id: '1', 
            name: 'Griff', 
            active: true,
            stats: { winRate: 73, roi: 15.2, lastPick: 'NBA Lakers -3.5 (Won)', isLive: true }
          },
          { 
            id: '2', 
            name: 'Mike Johnson', 
            active: true,
            stats: { winRate: 68, roi: 12.3, lastPick: 'NFL Chiefs -7 (Won)', isLive: false }
          }
        ])
      });
    });

    await page.route('**/api/games**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', home_team: 'Lakers', away_team: 'Warriors', game_date: '2025-01-26' },
          { id: '2', home_team: 'Celtics', away_team: 'Heat', game_date: '2025-01-26' }
        ])
      });
    });

    // Navigate to the smart form
    await page.goto('http://localhost:3006/submit-ticket');
  });

  test('should display all essential form elements', async ({ page }) => {
    // Check for main heading
    await expect(page.getByText('🎯 Ticket Essentials')).toBeVisible();
    
    // Check for capper selection
    await expect(page.getByText('👤 Select Capper')).toBeVisible();
    
    // Check for ticket type section
    await expect(page.getByText('🎯 Ticket Type')).toBeVisible();
    
    // Check for sport selection
    await expect(page.getByText('🏀 Sport Selection')).toBeVisible();
    
    // Check for game date
    await expect(page.getByText('📅 Game Date')).toBeVisible();
    
    // Check for user tier
    await expect(page.getByText('👑 User Tier')).toBeVisible();
  });

  test('should display sport logos and handle selection', async ({ page }) => {
    // Check that sport options are visible with proper logos
    const sportButtons = page.locator('[data-testid="sport-button"]');
    
    // Verify major sports are present
    await expect(page.getByText('NBA')).toBeVisible();
    await expect(page.getByText('NFL')).toBeVisible();
    await expect(page.getByText('MLB')).toBeVisible();
    await expect(page.getByText('NHL')).toBeVisible();
    
    // Test sport selection
    const nbaButton = page.locator('button:has-text("NBA")');
    await nbaButton.click();
    
    // Verify selection styling
    await expect(nbaButton).toHaveClass(/border-blue-500/);
  });

  test('should handle capper selection with stats display', async ({ page }) => {
    // Open capper dropdown
    const capperSelect = page.locator('[data-testid="capper-select"]');
    await capperSelect.click();
    
    // Select a capper
    await page.getByText('Griff').click();
    
    // Verify stats are displayed
    await expect(page.getByText('73% Win Rate')).toBeVisible();
    await expect(page.getByText('+15.2% ROI')).toBeVisible();
    await expect(page.getByText('LIVE')).toBeVisible();
  });

  test('should handle ticket type selection', async ({ page }) => {
    const ticketTypes = ['single', 'parlay', 'teaser', 'round-robin'];
    
    for (const type of ticketTypes) {
      const button = page.locator(`button:has-text("${type}")`);
      await button.click();
      
      // Verify selection styling
      await expect(button).toHaveClass(/border-blue-500/);
    }
  });

  test('should handle date selection and show available games', async ({ page }) => {
    // Select sport first
    await page.locator('button:has-text("NBA")').click();
    
    // Open date picker
    const datePicker = page.locator('input[type="text"]').first();
    await datePicker.click();
    
    // Select today's date (should be pre-selected)
    // Verify games count is displayed
    await expect(page.getByText(/\d+ NBA games available/)).toBeVisible();
  });

  test('should show VIP tier badge and features', async ({ page }) => {
    // Verify VIP tier display
    await expect(page.getByText('VIP+ 🔥')).toBeVisible();
    await expect(page.getByText('Premium features active')).toBeVisible();
    await expect(page.getByText('Advanced analytics')).toBeVisible();
    await expect(page.getByText('Priority support')).toBeVisible();
  });

  test('should enable continue button when all fields are filled', async ({ page }) => {
    const continueButton = page.locator('button:has-text("Continue")');
    
    // Initially should be disabled
    await expect(continueButton).toBeDisabled();
    
    // Fill required fields
    // 1. Select capper
    await page.locator('[data-testid="capper-select"]').click();
    await page.getByText('Griff').click();
    
    // 2. Select ticket type
    await page.locator('button:has-text("single")').click();
    
    // 3. Select sport
    await page.locator('button:has-text("NBA")').click();
    
    // 4. Date should be pre-selected to today
    
    // Now continue button should be enabled
    await expect(continueButton).toBeEnabled();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify elements are still visible and properly arranged
    await expect(page.getByText('🎯 Ticket Essentials')).toBeVisible();
    
    // Sports should be in mobile grid layout
    const sportButtons = page.locator('button').filter({ hasText: 'NBA' });
    await expect(sportButtons).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('🎯 Ticket Essentials')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByText('🎯 Ticket Essentials')).toBeVisible();
  });

  test('should show loading states appropriately', async ({ page }) => {
    // Check for loading spinner while cappers are loading
    await expect(page.locator('.animate-spin')).toBeVisible();
    
    // Wait for cappers to load
    await page.waitForSelector('[data-testid="capper-select"]');
    
    // Loading spinner should be gone
    await expect(page.locator('.animate-spin')).toBeHidden();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock API error for cappers
    await page.route('**/api/cappers', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.reload();
    
    // Should fall back to mock data
    await expect(page.getByText('Griff')).toBeVisible();
  });
});

test.describe('Unit Talk Smart Form - Accessibility', () => {
  test('should be accessible with keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:3006/submit-ticket');
    
    // Test tab navigation through form elements
    await page.keyboard.press('Tab'); // Capper select
    await page.keyboard.press('Tab'); // First ticket type
    await page.keyboard.press('Tab'); // Second ticket type
    
    // Verify focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('http://localhost:3006/submit-ticket');
    
    // Check for proper ARIA attributes
    const capperSelect = page.locator('[role="combobox"]');
    await expect(capperSelect).toBeVisible();
    
    // Check for proper labels
    await expect(page.locator('label, [aria-label]')).toHaveCount({ min: 4 });
  });

  test('should support screen readers', async ({ page }) => {
    await page.goto('http://localhost:3006/submit-ticket');
    
    // Check for semantic HTML elements
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('button')).toHaveCount({ min: 10 });
  });
});

test.describe('Unit Talk Smart Form - Performance', () => {
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:3006/submit-ticket');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    // Mock large capper dataset
    const largeCapperList = Array.from({ length: 100 }, (_, i) => ({
      id: i.toString(),
      name: `Capper ${i}`,
      active: true,
      stats: { winRate: 60 + Math.random() * 20, roi: Math.random() * 15, lastPick: 'Test pick', isLive: false }
    }));
    
    await page.route('**/api/cappers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeCapperList)
      });
    });
    
    await page.goto('http://localhost:3006/submit-ticket');
    
    // Should still load within reasonable time
    await page.waitForSelector('[data-testid="capper-select"]', { timeout: 5000 });
  });
});

export {};