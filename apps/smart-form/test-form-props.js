const { chromium } = require('playwright');

async function testFormProps() {
  console.log('🚀 Testing form props functionality...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the form
    console.log('📱 Navigating to form...');
    await page.goto('http://localhost:3002/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Step 1: Fill out essentials
    console.log('📝 Step 1: Filling out essentials...');

    // Wait for form to load
    await page.waitForTimeout(2000);

    // Try to select a capper
    try {
      const capperSelect = page.locator('select').first();
      if (await capperSelect.isVisible({ timeout: 5000 })) {
        await capperSelect.selectOption({ index: 1 });
        console.log('✅ Selected capper');
      }
    } catch (e) {
      console.log('⚠️ Could not select capper, continuing...');
    }

    // Try to select sport (NBA for testing props)
    try {
      const sportButtons = page.locator('button:has-text("NBA")');
      if (await sportButtons.first().isVisible({ timeout: 3000 })) {
        await sportButtons.first().click();
        console.log('✅ Selected NBA sport');
      }
    } catch (e) {
      console.log('⚠️ Could not select NBA sport');
    }

    // Try to select ticket type
    try {
      const ticketButtons = page.locator('button:has-text("Single")');
      if (await ticketButtons.first().isVisible({ timeout: 3000 })) {
        await ticketButtons.first().click();
        console.log('✅ Selected Single ticket type');
      }
    } catch (e) {
      console.log('⚠️ Could not select ticket type');
    }

    // Try to select a date (today)
    try {
      const dateInput = page.locator('input[type="text"]').first();
      if (await dateInput.isVisible({ timeout: 3000 })) {
        const today = new Date().toLocaleDateString('en-US');
        await dateInput.fill(today);
        console.log('✅ Selected date');
      }
    } catch (e) {
      console.log('⚠️ Could not select date');
    }

    // Click Next
    const nextButton = page.locator('button:has-text("Next")');
    if (await nextButton.isVisible({ timeout: 3000 })) {
      await nextButton.click();
      console.log('✅ Advanced to Step 2');
      await page.waitForTimeout(2000);
    }

    // Step 2: Configuration
    console.log('⚙️ Step 2: Configuration...');

    // Click Next again
    const nextButton2 = page.locator('button:has-text("Next")');
    if (await nextButton2.isVisible({ timeout: 3000 })) {
      await nextButton2.click();
      console.log('✅ Advanced to Step 3');
      await page.waitForTimeout(2000);
    }

    // Step 3: Bet Details - Select Player Props
    console.log('🎯 Step 3: Selecting Player Props...');

    // Look for player props button
    const playerPropsButton = page.locator('button:has-text("Player Props")');
    if (await playerPropsButton.isVisible({ timeout: 5000 })) {
      await playerPropsButton.click();
      console.log('✅ Selected Player Props bet type');
      await page.waitForTimeout(1000);
    } else {
      console.log('❌ Player Props button not found');
    }

    // Click Next to go to game selection
    const nextButton3 = page.locator('button:has-text("Next")');
    if (await nextButton3.isVisible({ timeout: 3000 })) {
      await nextButton3.click();
      console.log('✅ Advanced to Step 4 (Game Selection)');
      await page.waitForTimeout(3000);
    }

    // Step 4: Game Selection and Props
    console.log('🎮 Step 4: Testing game selection and props...');

    // Wait for games to load
    await page.waitForTimeout(5000);

    // Look for game cards
    const gameCards = page.locator('div:has-text("@")');
    const gameCount = await gameCards.count();
    console.log(`🎯 Found ${gameCount} games`);

    if (gameCount > 0) {
      // Click on first game
      await gameCards.first().click();
      console.log('✅ Selected first game');
      await page.waitForTimeout(3000);

      // Look for props loading
      const loadingText = page.locator('text="Loading player props"');
      if (await loadingText.isVisible({ timeout: 2000 })) {
        console.log('⏳ Props are loading...');
        await page.waitForTimeout(5000);
      }

      // Check for props
      const propButtons = page.locator('button:has-text("Over"), button:has-text("Under")');
      const propCount = await propButtons.count();
      console.log(`🎲 Found ${propCount} prop options`);

      if (propCount > 0) {
        console.log('✅ SUCCESS: Props are visible and clickable!');

        // Try to click on a prop
        await propButtons.first().click();
        console.log('🖱️ Clicked on first prop option');
        await page.waitForTimeout(1000);

        // Check if Add Selection button appears
        const addButton = page.locator('button:has-text("Add Selection")');
        if (await addButton.isVisible({ timeout: 3000 })) {
          console.log('✅ SUCCESS: Add Selection button appeared!');

          // Try to add the selection
          await addButton.click();
          console.log('✅ Added prop selection');

          // Check if it appears in current selections
          await page.waitForTimeout(1000);
          const currentSelections = page.locator('text="Current Selections"');
          if (await currentSelections.isVisible({ timeout: 3000 })) {
            console.log('✅ SUCCESS: Selection appears in current selections!');
          }
        } else {
          console.log('❌ ISSUE: Add Selection button did not appear');
        }
      } else {
        console.log('❌ ISSUE: No prop options found');

        // Check for error messages
        const errorText = page.locator('text="No player props available"');
        if (await errorText.isVisible({ timeout: 2000 })) {
          console.log('ℹ️ No props available for this game');
        }
      }
    } else {
      console.log('❌ ISSUE: No games found');
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'form-props-test.png', fullPage: true });
    console.log('📸 Screenshot saved as form-props-test.png');
  } catch (error) {
    console.error('💥 Error during test:', error);
  } finally {
    await browser.close();
  }

  console.log('\n🏁 Form props test completed!');
}

testFormProps();
