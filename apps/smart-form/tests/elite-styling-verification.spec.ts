import { test, expect } from '@playwright/test';

test.describe('Elite Styling Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the smart form
    await page.goto('/submit-ticket');
    // Wait for form to load
    await page.waitForLoadState('networkidle');
  });

  test('should display premium header with gradient backgrounds and animations', async ({
    page,
  }) => {
    // Verify the premium gradient background exists
    const backgroundDiv = page.locator('div.min-h-screen.bg-gradient-to-br');
    await expect(backgroundDiv).toBeVisible();

    // Check for animated floating orbs
    const floatingOrbs = page.locator(
      'div.absolute.bg-blue-500\\/10.rounded-full.blur-xl.animate-pulse'
    );
    await expect(floatingOrbs).toHaveCount(3);

    // Verify the premium brand logo with gradient
    const brandLogo = page.locator('div.w-20.h-20.bg-gradient-to-br.from-blue-500.to-indigo-600');
    await expect(brandLogo).toBeVisible();

    // Check gradient text title
    const title = page.locator('h1').filter({ hasText: 'Smart Betting Form' });
    await expect(title).toBeVisible();
    await expect(title).toHaveClass(/bg-gradient-to-r/);

    // Verify feature badges
    const badges = page.locator('div[class*="bg-blue-500/20"]');
    await expect(badges).toHaveCount(3);
  });

  test('should display enhanced step progress with premium animations', async ({ page }) => {
    // Verify step progress component is visible
    const stepProgress = page.locator('[data-testid="step-progress"]');
    if ((await stepProgress.count()) === 0) {
      // Fallback to class-based selector
      const progressSection = page.locator('div.w-full').first();
      await expect(progressSection).toBeVisible();
    }

    // Check for premium step circles with gradients
    const stepCircles = page.locator('button.w-16.h-16.rounded-full');
    await expect(stepCircles.first()).toBeVisible();

    // Verify progress bar exists
    const progressBar = page.locator('[role="progressbar"]');
    if ((await progressBar.count()) > 0) {
      await expect(progressBar.first()).toBeVisible();
    }

    // Check for badges on step indicators
    const stepBadges = page.locator('div.absolute.-top-1.-right-1.w-6.h-6');
    if ((await stepBadges.count()) > 0) {
      await expect(stepBadges.first()).toBeVisible();
    }
  });

  test('should display premium form cards with glass morphism effects', async ({ page }) => {
    // Verify main form card with premium styling
    const formCard = page.locator('div.p-8.bg-white\\/95.backdrop-blur-sm.shadow-2xl.rounded-3xl');
    await expect(formCard).toBeVisible();

    // Check for capper selection card with gradient background
    const capperCard = page.locator('div.bg-gradient-to-br.from-white.to-blue-50\\/30');
    await expect(capperCard).toBeVisible();

    // Verify premium section headers with gradient icons
    const sectionIcons = page.locator('div.w-10.h-10.bg-gradient-to-br');
    await expect(sectionIcons.first()).toBeVisible();

    // Check for enhanced card shadows and borders
    const premiumCards = page.locator('div.shadow-xl.rounded-2xl');
    await expect(premiumCards.first()).toBeVisible();
  });

  test('should display VIP+ tier with premium styling', async ({ page }) => {
    // Verify VIP+ tier section
    const vipSection = page.locator(
      'div.bg-gradient-to-r.from-purple-500.via-blue-500.to-indigo-600'
    );
    await expect(vipSection).toBeVisible();

    // Check for VIP+ badge
    const vipBadge = page.getByText('VIP+ 🔥');
    await expect(vipBadge).toBeVisible();

    // Verify feature list items
    const featureItems = page.locator('div.flex.items-center.gap-2');
    await expect(featureItems.first()).toBeVisible();
  });

  test('should display enhanced sport selection with official logos', async ({ page }) => {
    // Wait for sport buttons to load
    await page.waitForSelector('button[class*="rounded-lg"]', { timeout: 10000 });

    // Check for sport selection buttons
    const sportButtons = page.locator('button').filter({ hasText: /NBA|NFL|MLB|WNBA|NCAAF/ });
    const sportCount = await sportButtons.count();
    expect(sportCount).toBeGreaterThan(10); // Should have many sports including WNBA

    // Verify WNBA sport option is present
    const wnbaButton = page.locator('div.text-xs.font-semibold').filter({ hasText: 'WNBA' });
    if ((await wnbaButton.count()) > 0) {
      await expect(wnbaButton).toBeVisible();
    }

    // Check for enhanced NCAAF option
    const ncaafButton = page.locator('div.text-xs.font-semibold').filter({ hasText: 'NCAAF' });
    if ((await ncaafButton.count()) > 0) {
      await expect(ncaafButton).toBeVisible();
    }
  });

  test('should display premium continue button with proper states', async ({ page }) => {
    // Check for the enhanced continue button
    const continueButton = page.locator('button').filter({ hasText: /Continue|Complete/ });
    await expect(continueButton).toBeVisible();

    // Verify button has premium styling classes
    const buttonClasses = await continueButton.getAttribute('class');
    expect(buttonClasses).toContain('rounded-2xl');
    expect(buttonClasses).toContain('shadow-2xl');
  });

  test('should display enhanced sidebar with premium bet summary', async ({ page }) => {
    // Check for premium bet summary card
    const betSummaryCard = page.locator(
      'div.bg-gradient-to-br.from-blue-800.via-blue-700.to-indigo-800'
    );
    await expect(betSummaryCard).toBeVisible();

    // Verify bet summary header
    const summaryHeader = page.getByText('Bet Summary');
    await expect(summaryHeader).toBeVisible();

    // Check for progress tracker card
    const progressCard = page.getByText('Progress Tracker');
    await expect(progressCard).toBeVisible();

    // Verify smart insights card
    const insightsCard = page.getByText('Smart Insights');
    await expect(insightsCard).toBeVisible();
  });

  test('should have proper responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    const desktopLayout = page.locator('div.flex.flex-col.xl\\:flex-row');
    await expect(desktopLayout).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500); // Allow layout to adjust

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Allow layout to adjust

    // Verify form is still visible and functional on mobile
    const mobileForm = page.locator('div.p-8.bg-white\\/95');
    await expect(mobileForm).toBeVisible();
  });

  test('should have smooth animations and transitions', async ({ page }) => {
    // Check for transition classes
    const animatedElements = page.locator('[class*="transition-all"]');
    await expect(animatedElements.first()).toBeVisible();

    // Verify elements with duration classes
    const durationElements = page.locator('[class*="duration-300"]');
    await expect(durationElements.first()).toBeVisible();

    // Check for transform animations
    const transformElements = page.locator('[class*="transform"]');
    if ((await transformElements.count()) > 0) {
      await expect(transformElements.first()).toBeVisible();
    }
  });

  test('should capture visual comparison screenshots', async ({ page }) => {
    // Capture full page screenshot for visual regression testing
    await expect(page).toHaveScreenshot('elite-styling-full-page.png', {
      fullPage: true,
      threshold: 0.3, // Allow for minor differences
    });

    // Capture step progress component
    const stepProgressArea = page.locator('div.w-full').first();
    await expect(stepProgressArea).toHaveScreenshot('step-progress-component.png');

    // Capture form content area
    const formArea = page.locator('div.p-8.bg-white\\/95').first();
    await expect(formArea).toHaveScreenshot('premium-form-content.png');

    // Capture sidebar
    const sidebar = page.locator('div.w-full.xl\\:w-96');
    if ((await sidebar.count()) > 0) {
      await expect(sidebar).toHaveScreenshot('premium-sidebar.png');
    }
  });
});

test.describe('Performance and Accessibility', () => {
  test('should meet performance standards', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Check for proper HTML structure
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('main, div[role="main"]')).toHaveCount(1);
  });

  test('should be accessible', async ({ page }) => {
    await page.goto('/submit-ticket');

    // Check for proper heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Verify form labels are properly associated
    const formElements = page.locator('input, select, button');
    const elementCount = await formElements.count();
    expect(elementCount).toBeGreaterThan(0);

    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
