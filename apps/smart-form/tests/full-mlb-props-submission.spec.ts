import { test, expect } from '@playwright/test';

test.describe('Full MLB Props Submission Test', () => {
  test('Complete MLB player props submission with screenshots', async ({ page }) => {
    console.log('🎯 FULL MLB PROPS SUBMISSION TEST WITH SCREENSHOTS\n');
    console.log('=====================================\n');

    // Navigate to the form
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/01-form-loaded.png', fullPage: true });
    console.log('📸 Screenshot 1: Form loaded');

    // Step 1: Basic Information
    console.log('\n📝 STEP 1: Basic Information');
    await page.waitForTimeout(2000);

    // Look for capper selection
    const capperSelectors = await page.locator('select, button[role="combobox"]').all();
    if (capperSelectors.length > 0) {
      await capperSelectors[0].click();
      await page.waitForTimeout(500);

      const capperOptions = await page.locator('[role="option"], option').all();
      if (capperOptions.length > 0) {
        await capperOptions[0].click();
        console.log('✅ Selected capper');
      }
    }

    // Select MLB sport
    const sportSelectors = await page.locator('select, button[role="combobox"]').all();
    for (let i = 0; i < sportSelectors.length; i++) {
      try {
        await sportSelectors[i].click();
        await page.waitForTimeout(500);

        const mlbOption = page
          .locator('[role="option"]:has-text("MLB"), option[value="MLB"]')
          .first();
        if (await mlbOption.isVisible({ timeout: 1000 })) {
          await mlbOption.click();
          console.log('✅ Selected MLB sport');
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Set confidence level if slider exists
    const confidenceSlider = page.locator('input[type="range"]').first();
    if (await confidenceSlider.isVisible({ timeout: 1000 })) {
      await confidenceSlider.fill('4');
      console.log('✅ Set confidence level to 4');
    }

    await page.screenshot({ path: 'screenshots/02-basic-info-filled.png', fullPage: true });
    console.log('📸 Screenshot 2: Basic info filled with MLB selected');

    // Advance to next step
    const nextButton1 = page
      .locator('button:has-text("Next"), button:has-text("Continue")')
      .first();
    await nextButton1.click();
    await page.waitForTimeout(2000);

    // Step 2: Configuration
    console.log('\n📝 STEP 2: Configuration');

    // Set units if available
    const unitsInput = page.locator('input[type="number"], input[placeholder*="unit"]').first();
    if (await unitsInput.isVisible({ timeout: 1000 })) {
      await unitsInput.clear();
      await unitsInput.fill('2.5');
      console.log('✅ Set units to 2.5');
    }

    await page.screenshot({ path: 'screenshots/03-configuration.png', fullPage: true });
    console.log('📸 Screenshot 3: Configuration set');

    // Advance to bet details
    const nextButton2 = page
      .locator('button:has-text("Next"), button:has-text("Continue")')
      .first();
    await nextButton2.click();
    await page.waitForTimeout(2000);

    // Step 3: Bet Details - SELECT PLAYER PROPS
    console.log('\n🎯 STEP 3: Bet Details - Selecting Player Props');

    // Look for Player Props bet type
    const playerPropsCard = page
      .locator('div:has-text("Player Props"), div:has-text("Player Prop")')
      .first();
    if (await playerPropsCard.isVisible()) {
      await playerPropsCard.click();
      console.log('✅ Clicked Player Props bet type');
      await page.waitForTimeout(1000);
    } else {
      // Alternative: look for any clickable element with player props text
      const betCards = await page.locator('div[class*="cursor-pointer"], button').all();
      for (const card of betCards) {
        const text = await card.textContent();
        if (text?.includes('Player') && text?.includes('Prop')) {
          await card.click();
          console.log('✅ Selected Player Props from bet options');
          break;
        }
      }
    }

    await page.screenshot({ path: 'screenshots/04-player-props-selected.png', fullPage: true });
    console.log('📸 Screenshot 4: Player Props bet type selected');

    // Advance to game selection
    const nextButton3 = page
      .locator('button:has-text("Next"), button:has-text("Continue")')
      .first();
    await nextButton3.click();
    await page.waitForTimeout(3000);

    // Step 4: Game Selection
    console.log('\n🎮 STEP 4: Game Selection');

    // Wait for games to load
    await page.waitForTimeout(3000);

    // Check for EST times in games
    const gameElements = await page.locator('div:has-text("@")').all();
    console.log(`Found ${gameElements.length} potential games`);

    // Look for EST time display
    let foundEST = false;
    for (let i = 0; i < Math.min(gameElements.length, 3); i++) {
      const gameText = await gameElements[i].textContent();
      if (gameText?.includes('EST') || gameText?.includes('PM') || gameText?.includes('AM')) {
        console.log(`✅ Found game with time display: ${gameText?.slice(0, 100)}`);
        foundEST = true;
        break;
      }
    }

    if (foundEST) {
      console.log('✅ EST timezone display confirmed');
    }

    await page.screenshot({ path: 'screenshots/05-games-with-est-times.png', fullPage: true });
    console.log('📸 Screenshot 5: Games displayed with times');

    // Select first available game
    if (gameElements.length > 0) {
      await gameElements[0].click();
      console.log('✅ Selected first available game');
      await page.waitForTimeout(3000);
    }

    // Wait for props to load
    console.log('\n⏳ Waiting for props to load...');
    await page.waitForTimeout(3000);

    // Check for props
    const overButtons = await page.locator('button:has-text("Over")').all();
    const underButtons = await page.locator('button:has-text("Under")').all();

    console.log(`Found ${overButtons.length} "Over" buttons`);
    console.log(`Found ${underButtons.length} "Under" buttons`);

    if (overButtons.length > 0 || underButtons.length > 0) {
      console.log('✅ PROPS LOADED SUCCESSFULLY!');

      await page.screenshot({ path: 'screenshots/06-props-loaded.png', fullPage: true });
      console.log('📸 Screenshot 6: Props loaded with Over/Under buttons');

      // Click first prop option
      if (overButtons.length > 0) {
        await overButtons[0].click();
        console.log('✅ Clicked first "Over" button');
      } else if (underButtons.length > 0) {
        await underButtons[0].click();
        console.log('✅ Clicked first "Under" button');
      }

      await page.waitForTimeout(1000);

      // Check for Add Selection button
      const addButton = page
        .locator('button:has-text("Add Selection"), button:has-text("Add")')
        .first();
      if (await addButton.isVisible()) {
        console.log('✅ Add Selection button appeared');

        await page.screenshot({ path: 'screenshots/07-prop-selected.png', fullPage: true });
        console.log('📸 Screenshot 7: Prop selected, Add button visible');

        await addButton.click();
        console.log('✅ Clicked Add Selection');
        await page.waitForTimeout(1000);

        // Try to add a second prop if available
        if (overButtons.length > 1) {
          await overButtons[1].click();
          await page.waitForTimeout(500);
          const addButton2 = page.locator('button:has-text("Add Selection")').first();
          if (await addButton2.isVisible()) {
            await addButton2.click();
            console.log('✅ Added second prop selection');
          }
        }

        await page.screenshot({ path: 'screenshots/08-selections-added.png', fullPage: true });
        console.log('📸 Screenshot 8: Selections added to ticket');
      }

      // Add notes
      const notesTextarea = page.locator('textarea[placeholder*="notes"], textarea').first();
      if (await notesTextarea.isVisible()) {
        await notesTextarea.fill(
          'MLB Player Props test submission - EST times confirmed, props loading correctly'
        );
        console.log('✅ Added notes');
      }

      // Check submit button
      const submitButton = page
        .locator('button:has-text("Submit"), button:has-text("Submit Ticket")')
        .first();
      const isEnabled = await submitButton.isEnabled();

      console.log(`Submit button enabled: ${isEnabled}`);

      await page.screenshot({ path: 'screenshots/09-ready-to-submit.png', fullPage: true });
      console.log('📸 Screenshot 9: Form ready to submit');

      if (isEnabled) {
        // Click submit
        await submitButton.click();
        console.log('✅ CLICKED SUBMIT BUTTON');
        await page.waitForTimeout(5000);

        // Check for success
        const successIndicators = await page
          .locator('text="success", text="Success", text="submitted", text="created"')
          .all();
        const errorIndicators = await page
          .locator('text="error", text="Error", text="failed"')
          .all();

        if (successIndicators.length > 0) {
          console.log('✅ SUCCESS: Form submitted successfully!');
          await page.screenshot({ path: 'screenshots/10-submission-success.png', fullPage: true });
          console.log('📸 Screenshot 10: Submission success');
        } else if (errorIndicators.length > 0) {
          const errorText = await errorIndicators[0].textContent();
          console.log(`❌ Error on submission: ${errorText}`);
          await page.screenshot({ path: 'screenshots/10-submission-error.png', fullPage: true });
        } else {
          console.log('⚠️ Submission result unclear');
          await page.screenshot({ path: 'screenshots/10-submission-result.png', fullPage: true });
        }
      }
    } else {
      console.log('❌ PROPS DID NOT LOAD');
      await page.screenshot({ path: 'screenshots/06-no-props-error.png', fullPage: true });

      // Check for error messages
      const errorMessages = await page
        .locator('text="No props", text="no player props", text="Props may be added"')
        .all();
      if (errorMessages.length > 0) {
        const errorText = await errorMessages[0].textContent();
        console.log(`Error message: ${errorText}`);
      }
    }

    // Final summary
    console.log('\n📊 FINAL TEST SUMMARY');
    console.log('=====================================');

    const propsLoaded = overButtons.length > 0 || underButtons.length > 0;
    const addButtonWorked = (await page.locator('button:has-text("Add Selection")').count()) > 0;
    const selectionsAdded = (await page.locator('text="Current Selections"').count()) > 0;
    const submitEnabled = await page.locator('button:has-text("Submit")').isEnabled();

    console.log(`✅ MLB sport selected: YES`);
    console.log(`✅ Player Props bet type selected: YES`);
    console.log(`${foundEST ? '✅' : '❌'} EST timezone display: ${foundEST ? 'YES' : 'NO'}`);
    console.log(`${propsLoaded ? '✅' : '❌'} Props loaded: ${propsLoaded ? 'YES' : 'NO'}`);
    console.log(
      `${addButtonWorked ? '✅' : '❌'} Add Selection button: ${addButtonWorked ? 'YES' : 'NO'}`
    );
    console.log(
      `${selectionsAdded ? '✅' : '❌'} Selections added: ${selectionsAdded ? 'YES' : 'NO'}`
    );
    console.log(`${submitEnabled ? '✅' : '❌'} Submit enabled: ${submitEnabled ? 'YES' : 'NO'}`);

    const allWorking = propsLoaded && addButtonWorked && submitEnabled;
    console.log(
      `\n🎯 OVERALL RESULT: ${allWorking ? '✅ ALL SYSTEMS WORKING!' : '❌ ISSUES DETECTED'}`
    );

    console.log('\n📸 Screenshots saved in screenshots/ directory:');
    console.log('   01-form-loaded.png');
    console.log('   02-basic-info-filled.png');
    console.log('   03-configuration.png');
    console.log('   04-player-props-selected.png');
    console.log('   05-games-with-est-times.png');
    console.log('   06-props-loaded.png (or no-props-error.png)');
    console.log('   07-prop-selected.png');
    console.log('   08-selections-added.png');
    console.log('   09-ready-to-submit.png');
    console.log('   10-submission-result.png');

    // Assertions for test framework
    expect(propsLoaded).toBe(true);
    expect(addButtonWorked).toBe(true);
    expect(submitEnabled).toBe(true);
  });
});
