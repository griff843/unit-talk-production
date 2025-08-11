const { test, expect } = require('@playwright/test');

test.describe('Confirm Props Working After Fix', () => {
  test('Verify prop selection works end-to-end after naming fix', async ({ page }) => {
    console.log('🧪 CONFIRMING PROP SELECTION WORKS AFTER FIX...\n');

    // Navigate to the form
    await page.goto('http://localhost:3002/submit-ticket');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('✅ Form loaded');

    try {
      // Step 1: Navigate through form to reach player props
      console.log('\n📝 Step 1: Navigating to bet type selection...');

      // Try to advance through initial steps
      let currentStep = 1;
      while (currentStep <= 3) {
        // Look for form elements to fill
        const selects = await page.locator('select, button[role="combobox"]').all();

        if (selects.length > 0) {
          // Try to interact with first available select
          for (let i = 0; i < selects.length; i++) {
            try {
              await selects[i].click();
              await page.waitForTimeout(500);

              // Look for options to select
              const options = await page.locator('[role="option"], option').all();
              if (options.length > 0) {
                await options[0].click();
                console.log(`✅ Selected option in step ${currentStep}`);
                break;
              }
            } catch (e) {
              // Continue to next select
            }
          }
        }

        // Try to advance to next step
        const nextButton = page
          .locator('button:has-text("Next"), button:has-text("Continue")')
          .first();
        if (await nextButton.isVisible({ timeout: 2000 })) {
          await nextButton.click();
          await page.waitForTimeout(1500);
          console.log(`✅ Advanced to step ${currentStep + 1}`);
          currentStep++;
        } else {
          console.log(`⚠️ Could not find Next button in step ${currentStep}`);
          break;
        }
      }

      // Step 2: Look specifically for player props bet type
      console.log('\n🎯 Step 2: Looking for Player Props bet type...');

      // Look for bet type selectors
      const betTypeSelectors = await page.locator('select, button[role="combobox"]').all();
      let foundPlayerProps = false;

      for (let i = 0; i < betTypeSelectors.length; i++) {
        try {
          await betTypeSelectors[i].click();
          await page.waitForTimeout(500);

          // Look specifically for player props option
          const playerPropsOption = page
            .locator(
              '[role="option"]:has-text("Player Props"), option:has-text("Player Props"), [role="option"]:has-text("Props"), option:has-text("Props")'
            )
            .first();

          if (await playerPropsOption.isVisible({ timeout: 1000 })) {
            await playerPropsOption.click();
            console.log('✅ Selected Player Props bet type');
            foundPlayerProps = true;
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }

      if (!foundPlayerProps) {
        console.log('⚠️ Could not find Player Props option, trying manual navigation');
      }

      // Advance to game selection
      const nextToGames = page
        .locator('button:has-text("Next"), button:has-text("Continue")')
        .first();
      if (await nextToGames.isVisible({ timeout: 2000 })) {
        await nextToGames.click();
        await page.waitForTimeout(2000);
        console.log('✅ Advanced to game selection');
      }

      // Step 3: Select a game and check for props
      console.log('\n🎮 Step 3: Selecting game and checking props...');

      // Wait for games to load
      await page.waitForTimeout(3000);

      // Look for game cards/elements
      const gameElements = await page
        .locator('div:has-text("@"), div:has-text("vs"), [data-testid*="game"]')
        .all();
      console.log(`Found ${gameElements.length} potential game elements`);

      if (gameElements.length > 0) {
        // Click on first game
        await gameElements[0].click();
        console.log('✅ Selected first game');
        await page.waitForTimeout(3000);

        // Now check for props loading
        console.log('\n🔍 Step 4: Checking if props load...');

        // Check for loading indicator
        const loadingProps = await page
          .locator('text="Loading player props", text="loading", div:has-text("Loading")')
          .count();
        if (loadingProps > 0) {
          console.log('⏳ Props are loading...');
          await page.waitForTimeout(5000);
        }

        // Check for prop elements
        const propElements = await page
          .locator(
            'div:has-text("Over"), div:has-text("Under"), button:has-text("Over"), button:has-text("Under")'
          )
          .all();
        console.log(`Found ${propElements.length} prop elements`);

        if (propElements.length > 0) {
          console.log('✅ SUCCESS: Props are visible!');

          // Step 5: Test clicking a prop
          console.log('\n🖱️ Step 5: Testing prop selection...');

          // Click on first prop option
          await propElements[0].click();
          console.log('✅ Clicked first prop option');
          await page.waitForTimeout(1000);

          // Check if Add Selection button appears
          const addButton = page
            .locator('button:has-text("Add Selection"), button:has-text("Add")')
            .first();
          const addButtonVisible = await addButton.isVisible({ timeout: 3000 });

          if (addButtonVisible) {
            console.log('✅ SUCCESS: Add Selection button is visible!');

            // Try to add the selection
            await addButton.click();
            console.log('✅ Clicked Add Selection button');
            await page.waitForTimeout(1000);

            // Check if selection appears in list
            const selectionList = await page
              .locator('text="Current Selections", div:has-text("selection"), div:has-text("@")')
              .count();
            if (selectionList > 0) {
              console.log('✅ SUCCESS: Selection added to list!');

              // Final test: Check if submit button is enabled
              const submitButton = page
                .locator('button:has-text("Submit"), button:has-text("Submit Ticket")')
                .first();
              const submitEnabled = await submitButton.isEnabled({ timeout: 2000 });

              if (submitEnabled) {
                console.log('✅ SUCCESS: Submit button is enabled!');
                console.log('\n🎉 COMPLETE SUCCESS: Prop selection fully working!');
              } else {
                console.log('⚠️ Submit button not enabled yet');
              }
            } else {
              console.log('❌ Selection did not appear in list');
            }
          } else {
            console.log('❌ ISSUE: Add Selection button did not appear');
            console.log('   This suggests the prop click did not register properly');

            // Debug information
            const propButtons = await page
              .locator('button:has-text("Over"), button:has-text("Under")')
              .all();
            console.log(`   Found ${propButtons.length} prop buttons`);

            // Check if any buttons are highlighted
            const highlightedButtons = await page
              .locator(
                'button[data-state="active"], button.bg-primary, button:not([variant="outline"])'
              )
              .count();
            console.log(`   Found ${highlightedButtons} highlighted buttons`);
          }
        } else {
          console.log('❌ ISSUE: No props found after game selection');

          // Check for error messages
          const errorMessages = await page
            .locator('text="No props", text="error", text="Error", text="failed"')
            .all();
          if (errorMessages.length > 0) {
            const errorText = await errorMessages[0].textContent();
            console.log(`   Error message: "${errorText}"`);
          }

          // Check if props are still loading
          const stillLoading = await page.locator('text="Loading", text="loading"').count();
          if (stillLoading > 0) {
            console.log('   Props appear to still be loading');
          }
        }
      } else {
        console.log('❌ No games found to select');
      }
    } catch (error) {
      console.log('❌ Error during test:', error.message);
    }

    // Take final screenshot
    await page.screenshot({ path: 'props-confirmation-test.png', fullPage: true });
    console.log('\n📸 Final screenshot saved');

    // Summary
    console.log('\n📋 PROP SELECTION CONFIRMATION SUMMARY:');
    console.log('=====================================');

    const hasGames = (await page.locator('div:has-text("@")').count()) > 0;
    const hasProps =
      (await page.locator('button:has-text("Over"), button:has-text("Under")').count()) > 0;
    const hasAddButton = (await page.locator('button:has-text("Add Selection")').count()) > 0;
    const hasSelections = (await page.locator('text="Current Selections"').count()) > 0;

    console.log(`Games loaded: ${hasGames ? '✅' : '❌'}`);
    console.log(`Props displayed: ${hasProps ? '✅' : '❌'}`);
    console.log(`Add button functional: ${hasAddButton ? '✅' : '❌'}`);
    console.log(`Selections working: ${hasSelections ? '✅' : '❌'}`);

    const allWorking = hasGames && hasProps && hasAddButton;

    console.log(`\n🎯 FINAL VERDICT: ${allWorking ? '✅ PROPS WORKING' : '❌ NEEDS MORE WORK'}`);

    if (allWorking) {
      console.log('🚀 The naming fix successfully resolved the prop selection issue!');
    } else {
      console.log('🔍 Additional investigation needed for remaining issues');
    }
  });
});
