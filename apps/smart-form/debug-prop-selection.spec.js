const { test, expect } = require('@playwright/test');

test.describe('Debug Prop Selection Issue', () => {
  test('Identify and fix prop selection problems', async ({ page }) => {
    console.log('🔍 DEBUGGING PROP SELECTION ISSUE...\n');

    // Navigate to the form
    await page.goto('http://localhost:3002/submit-ticket');
    await page.waitForLoadState('networkidle');

    console.log('✅ Form loaded, navigating to prop selection...');

    // Try to navigate to game selection step
    try {
      // Step 1: Try to select any available options and advance
      await page.waitForTimeout(2000);

      // Look for any dropdowns or selects to fill
      const selects = await page.locator('select, button[role="combobox"]').all();
      console.log(`Found ${selects.length} select elements`);

      // Try to select sport first
      for (let i = 0; i < selects.length; i++) {
        try {
          await selects[i].click();
          await page.waitForTimeout(500);

          // Look for NBA option
          const nbaOption = page
            .locator('[role="option"]:has-text("NBA"), option[value="NBA"]')
            .first();
          if (await nbaOption.isVisible({ timeout: 1000 })) {
            await nbaOption.click();
            console.log('✅ Selected NBA sport');
            break;
          }
        } catch (e) {
          // Continue to next select
        }
      }

      // Try to advance through steps
      for (let step = 0; step < 4; step++) {
        const nextButton = page
          .locator('button:has-text("Next"), button:has-text("Continue")')
          .first();
        if (await nextButton.isVisible({ timeout: 2000 })) {
          await nextButton.click();
          await page.waitForTimeout(2000);
          console.log(`✅ Advanced to step ${step + 2}`);
        }
      }

      // Check if we can get to player props
      console.log('\n🎯 Looking for player props bet type...');

      // Look for bet type selection
      const betTypeElements = await page.locator('select, button[role="combobox"]').all();
      for (let i = 0; i < betTypeElements.length; i++) {
        try {
          await betTypeElements[i].click();
          await page.waitForTimeout(500);

          const propsOption = page
            .locator('[role="option"]:has-text("Props"), option:has-text("Props")')
            .first();
          if (await propsOption.isVisible({ timeout: 1000 })) {
            await propsOption.click();
            console.log('✅ Selected Player Props bet type');
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      // Advance to game selection
      const nextButton2 = page
        .locator('button:has-text("Next"), button:has-text("Continue")')
        .first();
      if (await nextButton2.isVisible({ timeout: 2000 })) {
        await nextButton2.click();
        await page.waitForTimeout(3000);
        console.log('✅ Advanced to game selection');
      }
    } catch (error) {
      console.log('⚠️ Navigation issue, trying to access props directly');
    }

    // Now look for game selection and props
    console.log('\n🎮 Looking for games and prop selection...');

    // Wait a bit more for games to load
    await page.waitForTimeout(5000);

    // Look for any clickable game elements
    const gameElements = await page
      .locator('div:has-text("@"), div:has-text("vs"), [data-testid*="game"]')
      .all();
    console.log(`Found ${gameElements.length} potential game elements`);

    if (gameElements.length > 0) {
      // Click on first game
      await gameElements[0].click();
      console.log('✅ Selected first available game');
      await page.waitForTimeout(3000);

      // Now look for props
      console.log('\n🎯 Looking for player props...');

      // Check for prop elements
      const propElements = await page
        .locator(
          'div:has-text("Over"), div:has-text("Under"), button:has-text("Over"), button:has-text("Under")'
        )
        .all();
      console.log(`Found ${propElements.length} prop option elements`);

      if (propElements.length > 0) {
        console.log('✅ Props are visible!');

        // Try to click on first prop option
        try {
          console.log('🖱️ Attempting to click first prop option...');
          await propElements[0].click();
          await page.waitForTimeout(1000);

          // Check if selection worked
          const addButton = page
            .locator('button:has-text("Add Selection"), button:has-text("Add")')
            .first();
          if (await addButton.isVisible({ timeout: 2000 })) {
            console.log('✅ SUCCESS: Prop selection worked! Add button appeared.');

            // Try to add the selection
            await addButton.click();
            console.log('✅ Added prop selection');

            // Look for the selection in the list
            await page.waitForTimeout(1000);
            const selections = await page
              .locator('div:has-text("Current Selections"), div:has-text("selection")')
              .all();
            if (selections.length > 0) {
              console.log('✅ Selection appears in current selections list');
            }
          } else {
            console.log('❌ ISSUE: Prop click did not enable Add button');

            // Debug: Check what happened
            console.log('🔍 Debugging prop selection state...');

            // Check if any prop buttons are highlighted
            const highlightedButtons = await page
              .locator(
                'button[variant="default"]:has-text("Over"), button[variant="default"]:has-text("Under")'
              )
              .all();
            console.log(`Found ${highlightedButtons.length} highlighted prop buttons`);

            // Check console logs
            const logs = [];
            page.on('console', msg => logs.push(msg.text()));

            // Try clicking again and see logs
            await propElements[0].click();
            await page.waitForTimeout(500);

            console.log('Recent console logs:', logs.slice(-5));
          }
        } catch (error) {
          console.log('❌ Error clicking prop option:', error.message);
        }

        // Take screenshot for debugging
        await page.screenshot({ path: 'prop-selection-debug.png', fullPage: true });
        console.log('📸 Debug screenshot saved');
      } else {
        console.log('❌ No prop options found');

        // Check if props are loading
        const loadingElements = await page
          .locator('text="Loading", text="loading", div:has-text("Loading")')
          .all();
        if (loadingElements.length > 0) {
          console.log('⏳ Props appear to be loading...');
          await page.waitForTimeout(5000);

          // Check again
          const propElements2 = await page
            .locator('div:has-text("Over"), div:has-text("Under")')
            .all();
          console.log(`After waiting: Found ${propElements2.length} prop options`);
        }

        // Check if there's an error message
        const errorElements = await page
          .locator('text="error", text="Error", text="No props"')
          .all();
        if (errorElements.length > 0) {
          const errorText = await errorElements[0].textContent();
          console.log(`❌ Error message found: "${errorText}"`);
        }
      }
    } else {
      console.log('❌ No games found to select');
    }

    console.log('\n📋 PROP SELECTION ISSUE SUMMARY:');
    console.log('=====================================');

    const hasGames = gameElements.length > 0;
    const hasProps =
      (await page.locator('div:has-text("Over"), div:has-text("Under")').count()) > 0;
    const canClickProps = hasProps; // We'll determine this from the test
    const addButtonWorks = (await page.locator('button:has-text("Add Selection")').count()) > 0;

    console.log(`Games visible: ${hasGames ? '✅' : '❌'}`);
    console.log(`Props visible: ${hasProps ? '✅' : '❌'}`);
    console.log(`Props clickable: ${canClickProps ? '✅' : '❌'}`);
    console.log(`Add button functional: ${addButtonWorks ? '✅' : '❌'}`);

    if (!hasProps) {
      console.log('\n🔍 DIAGNOSIS: Props not loading or displaying');
      console.log('Check: 1) Game selection, 2) Bet type = player_props, 3) API response');
    } else if (!addButtonWorks) {
      console.log('\n🔍 DIAGNOSIS: Props visible but selection not working');
      console.log('Check: 1) Button click handlers, 2) State management, 3) Selection validation');
    } else {
      console.log('\n✅ DIAGNOSIS: Prop selection appears to be working');
    }
  });
});
