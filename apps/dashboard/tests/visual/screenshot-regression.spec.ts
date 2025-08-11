import { test, expect } from '@playwright/test';

/**
 * Fortune 100-Grade Visual Regression Tests: Screenshot Comparison
 *
 * Tests visual consistency and regression detection:
 * - Cross-browser visual consistency
 * - Responsive design validation
 * - Component visual integrity
 * - Theme and state variations
 * - Loading state appearances
 * - Error state presentations
 */

test.describe('Visual Regression Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });

    // Wait for animations to settle
    await page.waitForTimeout(1000);
  });

  test('should maintain visual consistency - full dashboard', async ({ page }) => {
    // Wait for all content to load
    await page.waitForLoadState('networkidle');

    // Hide dynamic elements that change frequently
    await page.addStyleTag({
      content: `
        [data-testid="last-updated"],
        .timestamp,
        .live-indicator {
          visibility: hidden !important;
        }
      `,
    });

    await expect(page).toHaveScreenshot('dashboard-full-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should maintain performance metrics section visuals', async ({ page }) => {
    const metricsSection = page.getByTestId('performance-metrics');
    await expect(metricsSection).toBeVisible();

    await expect(metricsSection).toHaveScreenshot('performance-metrics-section.png', {
      threshold: 0.1,
    });
  });

  test('should maintain real-time analytics section visuals', async ({ page }) => {
    const analyticsSection = page.getByTestId('real-time-analytics');
    await expect(analyticsSection).toBeVisible();

    // Hide live data that changes
    await page.addStyleTag({
      content: `
        .live-data-value,
        .real-time-counter {
          visibility: hidden !important;
        }
      `,
    });

    await expect(analyticsSection).toHaveScreenshot('real-time-analytics-section.png', {
      threshold: 0.1,
    });
  });

  test('should maintain system health section visuals', async ({ page }) => {
    const healthSection = page.getByTestId('system-health');
    if (await healthSection.isVisible()) {
      await expect(healthSection).toHaveScreenshot('system-health-section.png', {
        threshold: 0.1,
      });
    }
  });

  test('should maintain responsive design - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-mobile-375w.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should maintain responsive design - tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-tablet-768w.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should maintain responsive design - desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-desktop-1920w.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should maintain loading state visuals', async ({ page }) => {
    // Slow down network to capture loading state
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });

    await page.goto('/dashboard');

    // Capture loading state
    const loadingIndicator = page.getByTestId('loading-indicator');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toHaveScreenshot('loading-state.png', {
        threshold: 0.1,
      });
    } else {
      // Check for loading spinner in main content
      const spinner = page.locator('.animate-spin');
      if (await spinner.first().isVisible()) {
        await expect(page).toHaveScreenshot('dashboard-loading-state.png', {
          threshold: 0.2,
        });
      }
    }
  });

  test('should maintain error state visuals', async ({ page }) => {
    // Simulate network errors
    await page.route('**/api/**', route => route.abort('failed'));

    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Try to trigger refresh to show error state
    const refreshButton = page.getByTestId('refresh-dashboard');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for error message to appear
      await page.waitForSelector('[role="alert"], .error-message', { timeout: 5000 });

      await expect(page).toHaveScreenshot('dashboard-error-state.png', {
        threshold: 0.2,
      });
    }
  });

  test('should maintain dark theme visuals', async ({ page }) => {
    // Force dark theme
    await page.addStyleTag({
      content: `
        :root {
          color-scheme: dark;
        }
        body {
          background: #0f0f23;
          color: #ffffff;
        }
      `,
    });

    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-dark-theme.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should maintain high contrast mode visuals', async ({ page }) => {
    // Simulate high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-high-contrast.png', {
      fullPage: true,
      threshold: 0.3, // Higher threshold for high contrast mode
    });
  });

  test('should maintain focus state visuals', async ({ page }) => {
    // Navigate to first focusable element
    await page.keyboard.press('Tab');

    // Capture focus state
    await expect(page.locator(':focus')).toHaveScreenshot('focus-state-first-element.png', {
      threshold: 0.1,
    });

    // Navigate to a few more elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await expect(page.locator(':focus')).toHaveScreenshot('focus-state-third-element.png', {
      threshold: 0.1,
    });
  });

  test('should maintain hover state visuals', async ({ page }) => {
    // Find first interactive element
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await button.hover();

      await expect(button).toHaveScreenshot('button-hover-state.png', {
        threshold: 0.1,
      });
    }
  });

  test('should maintain modal dialog visuals', async ({ page }) => {
    // Look for modal trigger button
    const modalTrigger = page.locator('[data-testid*="modal"], [data-testid*="dialog"]').first();

    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], .modal').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      await expect(modal).toHaveScreenshot('modal-dialog.png', {
        threshold: 0.2,
      });
    }
  });

  test('should maintain tooltip visuals', async ({ page }) => {
    // Find element with tooltip
    const tooltipTrigger = page.locator('[data-tooltip], [title]').first();

    if (await tooltipTrigger.isVisible()) {
      await tooltipTrigger.hover();

      // Wait for tooltip to appear
      await page.waitForTimeout(500);

      const tooltip = page.locator('[role="tooltip"], .tooltip').first();
      if (await tooltip.isVisible()) {
        await expect(tooltip).toHaveScreenshot('tooltip.png', {
          threshold: 0.1,
        });
      }
    }
  });

  test('should maintain chart and graph visuals', async ({ page }) => {
    // Look for chart containers
    const charts = page.locator('[data-testid*="chart"], .recharts-wrapper, canvas').all();

    for (let i = 0; i < Math.min(3, (await charts).length); i++) {
      const chart = (await charts)[i];
      if (await chart.isVisible()) {
        await expect(chart).toHaveScreenshot(`chart-${i + 1}.png`, {
          threshold: 0.2, // Charts can have minor rendering differences
        });
      }
    }
  });

  test('should maintain notification visuals', async ({ page }) => {
    const notificationCenter = page.getByTestId('notification-center');
    if (await notificationCenter.isVisible()) {
      await expect(notificationCenter).toHaveScreenshot('notification-center.png', {
        threshold: 0.1,
      });
    }
  });
});
