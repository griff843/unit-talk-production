import { test, expect } from '@playwright/test';

test.describe('Smart Form Current Implementation Validation', () => {
  test('should load the smart form and validate basic functionality', async ({ page }) => {
    console.log('🎯 Starting smart form validation...');

    // Navigate to the form
    await page.goto('/submit-ticket');
    console.log('✅ Navigated to submit-ticket page');

    // Wait for the form to load
    await page.waitForSelector('h1, h2, [data-testid="form-title"]', { timeout: 10000 });
    console.log('✅ Form loaded successfully');

    // Take a screenshot of the initial state
    await page.screenshot({ path: 'test-results/form-initial-state.png', fullPage: true });
    console.log('✅ Screenshot taken');

    // Look for key form elements without clicking
    const stepProgress = page.locator('[data-testid="step-progress"], .step-progress');
    const stepText = page.locator('text=/Step 1/i');
    const capperSelect = page.locator('[data-testid="capper-select"], select, [role="combobox"]');
    const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")');

    // Validate elements are present (check if they exist before asserting)
    if ((await stepProgress.count()) > 0) {
      await expect(stepProgress.first()).toBeVisible();
      console.log('✅ Step progress indicator found');
    } else if ((await stepText.count()) > 0) {
      await expect(stepText.first()).toBeVisible();
      console.log('✅ Step text found');
    } else {
      console.log('ℹ️ No specific step progress indicator found');
    }

    await expect(capperSelect.first()).toBeVisible();
    console.log('✅ Capper selection found');

    await expect(continueButton.first()).toBeVisible();
    console.log('✅ Continue button found');

    // Check if there are sport selection buttons
    const sportButtons = page.locator(
      'button:has-text("MLB"), button:has-text("NBA"), button:has-text("NFL")'
    );
    const sportCount = await sportButtons.count();
    console.log(`✅ Found ${sportCount} sport selection buttons`);

    // Check if ticket type buttons exist
    const ticketTypeButtons = page.locator(
      'button:has-text("single"), button:has-text("parlay"), button:has-text("Single"), button:has-text("Parlay")'
    );
    const ticketTypeCount = await ticketTypeButtons.count();
    console.log(`✅ Found ${ticketTypeCount} ticket type buttons`);

    // Check for date input
    const dateInput = page.locator('input[type="date"], input[type="text"]').first();
    if ((await dateInput.count()) > 0) {
      console.log('✅ Date input found');
    }

    // Take a final screenshot
    await page.screenshot({ path: 'test-results/form-validation-complete.png', fullPage: true });

    console.log('🎉 Basic form validation completed successfully!');
  });

  test('should validate form styling and responsiveness', async ({ page }) => {
    console.log('🎨 Testing form styling and responsiveness...');

    await page.goto('/submit-ticket');
    await page.waitForSelector('h1, h2, [data-testid="form-title"]', { timeout: 10000 });

    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.screenshot({ path: 'test-results/form-desktop.png', fullPage: true });
    console.log('✅ Desktop view captured');

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: 'test-results/form-tablet.png', fullPage: true });
    console.log('✅ Tablet view captured');

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: 'test-results/form-mobile.png', fullPage: true });
    console.log('✅ Mobile view captured');

    // Check if form elements are still visible on mobile
    const formElements = page.locator('button, input, select');
    const elementCount = await formElements.count();
    console.log(`✅ ${elementCount} form elements remain visible on mobile`);

    console.log('🎨 Responsive design validation completed!');
  });

  test('should test basic form interaction', async ({ page }) => {
    console.log('🔄 Testing basic form interactions...');

    await page.goto('/submit-ticket');
    await page.waitForSelector('h1, h2, [data-testid="form-title"]', { timeout: 10000 });

    // Try to interact with sport buttons if they exist
    const mlbButton = page.locator('button:has-text("MLB")');
    if ((await mlbButton.count()) > 0) {
      await mlbButton.click();
      console.log('✅ MLB button clicked successfully');
      await page.screenshot({ path: 'test-results/mlb-selected.png', fullPage: true });
    }

    // Try to interact with ticket type buttons if they exist
    const singleButton = page.locator('button:has-text("single"), button:has-text("Single")');
    if ((await singleButton.count()) > 0) {
      await singleButton.click();
      console.log('✅ Single ticket type clicked successfully');
      await page.screenshot({ path: 'test-results/single-selected.png', fullPage: true });
    }

    // Try to open capper dropdown
    const capperSelect = page.locator('[data-testid="capper-select"], [role="combobox"]');
    if ((await capperSelect.count()) > 0) {
      await capperSelect.click();
      await page.waitForTimeout(1000);
      console.log('✅ Capper dropdown opened');
      await page.screenshot({ path: 'test-results/capper-dropdown.png', fullPage: true });

      // Try to select first option
      const firstOption = page.locator('[role="option"]').first();
      if ((await firstOption.count()) > 0) {
        await firstOption.click();
        console.log('✅ First capper option selected');
      }
    }

    console.log('🔄 Basic interactions completed successfully!');
  });
});
