const { chromium } = require('playwright');

async function testPropsSimple() {
  console.log('🔍 Simple props test - checking if props load correctly...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the form
    console.log('📱 Navigating to form...');
    await page.goto('http://localhost:3002/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Wait for form to load
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: 'step1-initial.png', fullPage: true });
    console.log('📸 Step 1 screenshot saved');

    // Check what's visible on the page
    const pageContent = await page.textContent('body');
    console.log('📄 Page contains:', pageContent.substring(0, 200) + '...');

    // Look for any buttons or selects
    const buttons = await page.locator('button').count();
    const selects = await page.locator('select').count();
    console.log(`🔘 Found ${buttons} buttons and ${selects} select elements`);

    // Try to find and click MLB sport button
    console.log('\n⚾ Looking for MLB sport selection...');
    const mlbButton = page.locator('button:has-text("MLB")');
    if (await mlbButton.isVisible({ timeout: 5000 })) {
      await mlbButton.click();
      console.log('✅ Clicked MLB button');
      await page.waitForTimeout(1000);
    } else {
      console.log('❌ MLB button not found');
    }

    // Try to find and click Single ticket type
    console.log('🎫 Looking for Single ticket type...');
    const singleButton = page.locator('button:has-text("Single")');
    if (await singleButton.isVisible({ timeout: 3000 })) {
      await singleButton.click();
      console.log('✅ Clicked Single button');
      await page.waitForTimeout(1000);
    } else {
      console.log('❌ Single button not found');
    }

    // Try to advance through steps by clicking Next buttons
    for (let step = 1; step <= 4; step++) {
      console.log(`\n⏭️ Trying to advance to step ${step + 1}...`);

      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isVisible({ timeout: 3000 })) {
        await nextButton.click();
        console.log(`✅ Advanced to step ${step + 1}`);
        await page.waitForTimeout(2000);

        // Take screenshot of each step
        await page.screenshot({ path: `step${step + 1}.png`, fullPage: true });
        console.log(`📸 Step ${step + 1} screenshot saved`);

        // If we're on step 3, look for Player Props
        if (step === 3) {
          console.log('🎯 Looking for Player Props on step 3...');
          const playerPropsButton = page.locator('button:has-text("Player Props")');
          if (await playerPropsButton.isVisible({ timeout: 3000 })) {
            await playerPropsButton.click();
            console.log('✅ Selected Player Props');
            await page.waitForTimeout(1000);
          } else {
            console.log('❌ Player Props button not found');
            // List all visible buttons
            const allButtons = await page.locator('button').allTextContents();
            console.log('Available buttons:', allButtons);
          }
        }

        // If we're on step 4, look for games and props
        if (step === 4) {
          console.log('🎮 On step 4 - looking for games...');
          await page.waitForTimeout(5000); // Wait for games to load

          const gameElements = page.locator('div:has-text("@"), div:has-text("vs")');
          const gameCount = await gameElements.count();
          console.log(`🎯 Found ${gameCount} games`);

          if (gameCount > 0) {
            // Click first game
            await gameElements.first().click();
            console.log('✅ Selected first game');
            await page.waitForTimeout(3000);

            // Look for props
            const propButtons = page.locator('button:has-text("Over"), button:has-text("Under")');
            const propCount = await propButtons.count();
            console.log(`🎲 Found ${propCount} prop buttons`);

            if (propCount > 0) {
              console.log('✅ SUCCESS: Props are visible!');

              // Try clicking a prop
              await propButtons.first().click();
              console.log('🖱️ Clicked first prop');
              await page.waitForTimeout(1000);

              // Check for Add Selection button
              const addButton = page.locator('button:has-text("Add Selection")');
              if (await addButton.isVisible({ timeout: 3000 })) {
                console.log('✅ SUCCESS: Add Selection button appeared!');
                await addButton.click();
                console.log('✅ Added selection');
              } else {
                console.log('❌ Add Selection button not found');
              }
            } else {
              console.log('❌ No prop buttons found');

              // Check for loading or error messages
              const loadingText = await page.locator('text="Loading"').count();
              const errorText = await page.locator('text="No props"').count();
              console.log(`Loading indicators: ${loadingText}, Error messages: ${errorText}`);
            }
          } else {
            console.log('❌ No games found');
          }

          // Take final screenshot
          await page.screenshot({ path: 'final-props-test.png', fullPage: true });
          console.log('📸 Final screenshot saved');
        }
      } else {
        console.log(`❌ Next button not found on step ${step}`);
        break;
      }
    }
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await browser.close();
  }

  console.log('\n🏁 Simple props test completed!');
}

testPropsSimple();
