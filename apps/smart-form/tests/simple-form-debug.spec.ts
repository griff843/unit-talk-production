import { test, expect } from '@playwright/test';

test.describe('Simple Form Debug', () => {
  test('Debug form elements and complete workflow', async ({ page }) => {
    console.log('🔍 Starting form debug test...');

    // Navigate to the smart form
    await page.goto('http://localhost:3001/submit-ticket');

    // Wait for any element to load - be more flexible
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('✅ Page loaded');

    // Take a screenshot to see what's available
    await page.screenshot({
      path: 'test-results/form-loaded-state.png',
      fullPage: true,
    });
    console.log('📸 Screenshot taken of loaded form');

    // Look for any step progress elements
    const stepElements = await page.locator('[class*="step"], [class*="progress"]').all();
    console.log(`Found ${stepElements.length} potential step elements`);

    // Look for form title or main heading
    const headings = await page.locator('h1, h2, h3').all();
    for (let i = 0; i < headings.length; i++) {
      const text = await headings[i].textContent();
      console.log(`Heading ${i + 1}: ${text}`);
    }

    // Look for any inputs or selects
    const inputs = await page.locator('input, select, button').count();
    console.log(`Found ${inputs} input/select/button elements`);

    // Try to find and interact with capper selector
    try {
      await page.waitForSelector('select', { timeout: 10000 });
      console.log('✅ Found select element');

      // Get all select options
      const selectElement = await page.locator('select').first();
      const options = await selectElement.locator('option').all();
      console.log(`Found ${options.length} options in first select`);

      if (options.length > 1) {
        await selectElement.selectOption({ index: 1 });
        console.log('✅ Selected option in first select');
      }
    } catch (error) {
      console.log('❌ No select element found within timeout');
    }

    // Look for sport buttons
    try {
      const sportButtons = await page
        .locator('button:has-text("MLB"), button:has-text("NFL"), button:has-text("NBA")')
        .all();
      console.log(`Found ${sportButtons.length} sport buttons`);

      if (sportButtons.length > 0) {
        await sportButtons[0].click();
        console.log('✅ Clicked first sport button');
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log('❌ Sport buttons not found or clickable');
    }

    // Look for ticket type buttons
    try {
      const ticketTypeButtons = await page
        .locator('button:has-text("Single"), button:has-text("Parlay")')
        .all();
      console.log(`Found ${ticketTypeButtons.length} ticket type buttons`);

      if (ticketTypeButtons.length > 0) {
        await ticketTypeButtons[0].click();
        console.log('✅ Clicked first ticket type button');
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log('❌ Ticket type buttons not found or clickable');
    }

    // Look for date input
    try {
      const dateInput = await page.locator('input[type="date"]').first();
      if (await dateInput.isVisible()) {
        const today = new Date().toISOString().split('T')[0];
        await dateInput.fill(today);
        console.log(`✅ Set date to ${today}`);
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log('❌ Date input not found or fillable');
    }

    // Look for continue button and check if it's enabled
    try {
      const continueButton = await page.locator('button:has-text("Continue")').first();
      if (await continueButton.isVisible()) {
        const isEnabled = await continueButton.isEnabled();
        console.log(`Continue button enabled: ${isEnabled}`);

        if (isEnabled) {
          await continueButton.click();
          console.log('✅ Clicked continue button');
          await page.waitForTimeout(3000);

          // Take screenshot of next step
          await page.screenshot({
            path: 'test-results/form-step-2.png',
            fullPage: true,
          });
          console.log('📸 Screenshot taken of step 2');
        } else {
          console.log("⚠️ Continue button is disabled - checking what's missing...");

          // Debug form validation
          const requiredInputs = await page.locator('input[required], select[required]').all();
          console.log(`Found ${requiredInputs.length} required inputs`);

          for (let i = 0; i < requiredInputs.length; i++) {
            const value = await requiredInputs[i].inputValue();
            const type = await requiredInputs[i].getAttribute('type');
            console.log(`Required input ${i + 1} (${type}): "${value}"`);
          }
        }
      }
    } catch (error) {
      console.log('❌ Continue button not found');
    }

    // Final screenshot
    await page.screenshot({
      path: 'test-results/form-final-debug-state.png',
      fullPage: true,
    });
    console.log('📸 Final debug screenshot taken');

    console.log('🎯 Debug test completed');
  });

  test('Test props loading specifically', async ({ page }) => {
    console.log('🎲 Testing props loading...');

    await page.goto('http://localhost:3001/submit-ticket');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Quick form fill to get to props
    try {
      // Fill essentials quickly
      await page.selectOption('select', { index: 1 });
      await page.click('button:has-text("Single")');
      await page.click('button:has-text("MLB")');

      const today = new Date().toISOString().split('T')[0];
      await page.fill('input[type="date"]', today);

      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(2000);

      // Step 2 - Configuration
      await page.fill('input[type="range"]', '2.0');
      await page.click('button:has-text("American")');

      // Click confidence level
      const confidenceButtons = await page
        .locator('.flex.items-center.justify-center.space-x-1 button')
        .all();
      if (confidenceButtons.length >= 7) {
        await confidenceButtons[6].click(); // 7th star
      }

      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(2000);

      // Step 3 - Bet Details
      await page.click('button:has-text("Player Props")');
      await page.click('button:has-text("Pre-Game")');
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(3000);

      // Step 4 - Check for games and props
      const gameCards = await page.locator('[class*="game"], [class*="card"]').count();
      console.log(`Found ${gameCards} potential game cards`);

      // Look for any clickable game elements
      const clickableGames = await page
        .locator('button:has-text("@"), button:has-text("vs"), div[role="button"]')
        .all();
      console.log(`Found ${clickableGames.length} clickable game elements`);

      if (clickableGames.length > 0) {
        await clickableGames[0].click();
        console.log('✅ Clicked first game');
        await page.waitForTimeout(3000);

        // Check for props section
        const propsElements = await page.locator('[class*="prop"], [class*="player"]').count();
        console.log(`Found ${propsElements} potential prop elements`);

        // Take screenshot to see props state
        await page.screenshot({
          path: 'test-results/props-loaded-state.png',
          fullPage: true,
        });
        console.log('📸 Props screenshot taken');
      }
    } catch (error) {
      console.log('❌ Error during props test:', error);

      await page.screenshot({
        path: 'test-results/props-error-state.png',
        fullPage: true,
      });
    }
  });
});
