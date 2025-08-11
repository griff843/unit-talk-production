import { test, expect } from '@playwright/test';

test.describe('Confirm Game Props Working', () => {
  test('Verify prop selection works end-to-end', async ({ page }) => {
    console.log('🧪 CONFIRMING GAME PROPS FUNCTIONALITY...\n');

    // Navigate to the form
    await page.goto('http://localhost:3002/submit-ticket');
    await page.waitForLoadState('networkidle');

    console.log('✅ Form loaded');

    // Step 1: Fill out basic information
    console.log('\n📝 Step 1: Basic Information');

    // Wait for form elements to load
    await page.waitForTimeout(2000);

    // Look for and fill sport selection
    const sportSelector = page.locator('select, button[role="combobox"]').first();
    if (await sportSelector.isVisible()) {
      await sportSelector.click();
      await page.waitForTimeout(500);

      // Try to select NBA
      const nbaOption = page
        .locator('[role="option"]:has-text("NBA"), option[value="NBA"]')
        .first();
      if (await nbaOption.isVisible()) {
        await nbaOption.click();
        console.log('✅ Selected NBA');
      }
    }

    // Try to advance
    const nextButton1 = page
      .locator('button:has-text("Next"), button:has-text("Continue")')
      .first();
    if (await nextButton1.isVisible()) {
      await nextButton1.click();
      await page.waitForTimeout(2000);
      console.log('✅ Advanced to step 2');
    }

    // Step 2: Configuration
    console.log('\n📝 Step 2: Configuration');

    const nextButton2 = page
      .locator('button:has-text("Next"), button:has-text("Continue")')
      .first();
    if (await nextButton2.isVisible()) {
      await nextButton2.click();
      await page.waitForTimeout(2000);
      console.log('✅ Advanced to step 3');
    }

    // Step 3: Bet Details - CRITICAL: Select Player Props
    console.log('\n🎯 Step 3: Selecting Player Props bet type');

    // Look for bet type selection
    const betTypeElements = await page.locator('div').filter({ hasText: 'Player Props' }).all();
    console.log(`Found ${betTypeElements.length} elements containing "Player Props"`);

    if (betTypeElements.length > 0) {
      // Click on Player Props option
      await betTypeElements[0].click();
      console.log('✅ Clicked Player Props option');
      await page.waitForTimeout(1000);
    } else {
      // Alternative: look for clickable bet type cards
      const betCards = await page
        .locator('div[class*="cursor-pointer"], button[class*="cursor-pointer"]')
        .all();
      console.log(`Found ${betCards.length} clickable bet elements`);

      for (let i = 0; i < betCards.length; i++) {
        const cardText = await betCards[i].textContent();
        if (cardText?.includes('Player') || cardText?.includes('Props')) {
          await betCards[i].click();
          console.log(`✅ Clicked bet card containing: ${cardText?.slice(0, 50)}`);
          break;
        }
      }
    }

    // Advance to game selection
    const nextButton3 = page
      .locator('button:has-text("Next"), button:has-text("Continue")')
      .first();
    if (await nextButton3.isVisible()) {
      await nextButton3.click();
      await page.waitForTimeout(3000);
      console.log('✅ Advanced to game selection');
    }

    // Step 4: Game Selection and Props
    console.log('\n🎮 Step 4: Game Selection');

    // Wait for games to load
    await page.waitForTimeout(3000);

    // Look for game elements
    const gameElements = await page.locator('div:has-text("@"), div:has-text("vs")').all();
    console.log(`Found ${gameElements.length} game elements`);

    if (gameElements.length > 0) {
      // Click first game
      await gameElements[0].click();
      console.log('✅ Selected first game');
      await page.waitForTimeout(3000);

      // Check for props loading
      console.log('\n🔍 Checking for props...');

      // Wait for props to potentially load
      await page.waitForTimeout(3000);

      // Look for prop elements
      const overButtons = page.locator('button:has-text("Over")');
      const underButtons = page.locator('button:has-text("Under")');
      const propElements = page.locator('div:has-text("Over"), div:has-text("Under")');

      const overCount = await overButtons.count();
      const underCount = await underButtons.count();
      const propCount = await propElements.count();

      console.log(`Found ${overCount} "Over" buttons`);
      console.log(`Found ${underCount} "Under" buttons`);
      console.log(`Found ${propCount} prop elements`);

      const propsVisible = overCount > 0 || underCount > 0 || propCount > 0;

      if (propsVisible) {
        console.log('✅ SUCCESS: Props are visible!');

        // Test clicking a prop
        console.log('\n🖱️ Testing prop selection...');

        if (overCount > 0) {
          await overButtons.first().click();
          console.log('✅ Clicked "Over" button');
        } else if (underCount > 0) {
          await underButtons.first().click();
          console.log('✅ Clicked "Under" button');
        }

        await page.waitForTimeout(1000);

        // Check for Add Selection button
        const addButton = page.locator('button:has-text("Add Selection"), button:has-text("Add")');
        const addButtonVisible = await addButton.isVisible();

        console.log(`Add Selection button visible: ${addButtonVisible}`);

        if (addButtonVisible) {
          console.log('✅ SUCCESS: Add Selection button appeared!');

          // Click Add Selection
          await addButton.click();
          console.log('✅ Clicked Add Selection');
          await page.waitForTimeout(1000);

          // Check for current selections
          const selections = page.locator('text="Current Selections"');
          const hasSelections = await selections.isVisible();

          console.log(`Current Selections visible: ${hasSelections}`);

          if (hasSelections) {
            console.log('✅ SUCCESS: Selection added to list!');
          }

          // Check submit button
          const submitButton = page.locator(
            'button:has-text("Submit"), button:has-text("Submit Ticket")'
          );
          const submitEnabled = await submitButton.isEnabled();

          console.log(`Submit button enabled: ${submitEnabled}`);
        } else {
          console.log('❌ ISSUE: Add Selection button not visible');
        }
      } else {
        console.log('❌ ISSUE: No props visible after game selection');

        // Check for loading or error messages
        const loadingText = page.locator('text="Loading", text="loading"');
        const errorText = page.locator('text="No props", text="error", text="Error"');

        const isLoading = await loadingText.isVisible();
        const hasError = await errorText.isVisible();

        console.log(`Loading indicator: ${isLoading}`);
        console.log(`Error message: ${hasError}`);

        if (hasError) {
          const errorMessage = await errorText.first().textContent();
          console.log(`Error details: ${errorMessage}`);
        }
      }
    } else {
      console.log('❌ No games found');
    }

    // Take final screenshot
    await page.screenshot({ path: 'props-test-final.png', fullPage: true });
    console.log('\n📸 Final screenshot saved');

    // FINAL ASSESSMENT
    console.log('\n🎯 FINAL PROP SELECTION ASSESSMENT:');
    console.log('=====================================');

    const finalPropCheck = await page
      .locator('button:has-text("Over"), button:has-text("Under")')
      .count();
    const finalAddCheck = await page.locator('button:has-text("Add Selection")').count();
    const finalSelectionCheck = await page.locator('text="Current Selections"').count();

    console.log(`Props visible: ${finalPropCheck > 0 ? '✅' : '❌'} (${finalPropCheck} found)`);
    console.log(`Add button: ${finalAddCheck > 0 ? '✅' : '❌'} (${finalAddCheck} found)`);
    console.log(
      `Selections list: ${finalSelectionCheck > 0 ? '✅' : '❌'} (${finalSelectionCheck} found)`
    );

    const propsWorking = finalPropCheck > 0 && finalAddCheck > 0;

    console.log(`\n🚀 RESULT: ${propsWorking ? '✅ PROPS WORKING!' : '❌ PROPS NOT WORKING'}`);

    // Assert for test framework
    expect(finalPropCheck).toBeGreaterThan(0);
    expect(finalAddCheck).toBeGreaterThan(0);
  });
});
