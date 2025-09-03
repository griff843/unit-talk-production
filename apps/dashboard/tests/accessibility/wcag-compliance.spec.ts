import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Fortune 100-Grade Accessibility Tests: WCAG 2.1 AA Compliance
 *
 * Tests comprehensive accessibility compliance:
 * - WCAG 2.1 AA standards
 * - Screen reader compatibility
 * - Keyboard navigation
 * - Color contrast ratios
 * - Focus management
 * - Semantic markup
 */

test.describe('WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
  });

  test('should pass axe accessibility audit', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

    // Verify h1 exists and is unique
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Verify heading hierarchy is logical
    let previousLevel = 0;
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const currentLevel = parseInt(tagName.charAt(1));

      if (previousLevel > 0) {
        // Next heading should not skip more than one level
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }

      previousLevel = currentLevel;
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Start with first focusable element
    await page.keyboard.press('Tab');

    const focusableElements = await page
      .locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .all();

    // Test tabbing through interactive elements
    for (let i = 0; i < Math.min(focusableElements.length, 20); i++) {
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Verify focus indicator is visible
      const focusStyles = await focusedElement.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
        };
      });

      // Should have visible focus indicator (outline or box-shadow)
      const hasFocusIndicator =
        focusStyles.outline !== 'none' ||
        focusStyles.outlineWidth !== '0px' ||
        focusStyles.boxShadow !== 'none';

      expect(hasFocusIndicator).toBe(true);

      await page.keyboard.press('Tab');
    }
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    // Check for interactive elements without accessible names
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('[role="button"], button, [role="link"], a, input, select, textarea')
      .analyze();

    const nameViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'button-name' || violation.id === 'link-name'
    );

    expect(nameViolations).toEqual([]);
  });

  test('should support screen readers', async ({ page }) => {
    // Check for landmarks
    const landmarks = await page
      .locator(
        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
      )
      .count();
    expect(landmarks).toBeGreaterThan(0);

    // Check for skip links
    const skipLinks = await page.locator('a[href^="#"]').first();
    if (await skipLinks.isVisible()) {
      const skipText = await skipLinks.textContent();
      expect(skipText?.toLowerCase()).toContain('skip');
    }

    // Verify live regions for dynamic content
    const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').count();
    expect(liveRegions).toBeGreaterThan(0);
  });

  test('should handle reduced motion preferences', async ({ page }) => {
    // Test with reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Verify animations are reduced or disabled
    const animatedElements = await page
      .locator('.animate-spin, .animate-pulse, .animate-bounce')
      .all();

    for (const element of animatedElements) {
      const animationDuration = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.animationDuration;
      });

      // Animation should be very fast or disabled for reduced motion
      expect(animationDuration === '0s' || animationDuration === '0.01s').toBe(true);
    }
  });

  test('should have proper form labels and validation', async ({ page }) => {
    const forms = await page.locator('form').all();

    for (const form of forms) {
      // Check that all inputs have labels
      const inputs = await form.locator('input, select, textarea').all();

      for (const input of inputs) {
        const inputId = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        if (inputId) {
          const associatedLabel = await page.locator(`label[for="${inputId}"]`).count();
          const hasLabel = associatedLabel > 0 || ariaLabel || ariaLabelledBy;
          expect(hasLabel).toBe(true);
        }
      }
    }
  });

  test('should provide clear error messages', async ({ page }) => {
    // Simulate network error to test error handling
    await page.route('**/api/**', route => route.abort('failed'));

    const refreshButton = page.getByTestId('refresh-dashboard');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for error message
      const errorMessage = page.locator('[role="alert"], .error-message, [aria-live="assertive"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      // Verify error message is descriptive
      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/error|failed|problem|unable/i);
      expect(errorText!.length).toBeGreaterThan(10); // Should be descriptive
    }
  });

  test('should support high contrast mode', async ({ page }) => {
    // Test with forced colors (high contrast mode)
    await page.emulateMedia({ forcedColors: 'active' });
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Verify essential content is still visible
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
    await expect(page.getByTestId('performance-metrics')).toBeVisible();

    // Check that focus indicators work in high contrast
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
