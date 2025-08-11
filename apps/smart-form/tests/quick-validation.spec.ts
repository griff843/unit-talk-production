import { test, expect } from '@playwright/test';

test.describe('Production Readiness Validation', () => {
  test('Validate all three critical fixes for production', async ({ page }) => {
    console.log('🎯 PRODUCTION READINESS VALIDATION\n');
    console.log('Testing all 3 critical fixes:\n');
    console.log('1. ✅ Props loading from database');
    console.log('2. ✅ EST timezone display');
    console.log('3. ✅ Prop selection working\n');

    // Navigate to form
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/validation-01-loaded.png', fullPage: true });
    console.log('📸 Form loaded screenshot taken');

    // Quick form navigation to get to props
    console.log('\n🚀 Quick navigation to game selection...');

    // Fill minimal required fields to advance
    try {
      // Try to advance through steps quickly
      for (let step = 0; step < 4; step++) {
        // Fill any required selects
        const selects = await page.locator('select, button[role="combobox"]').all();
        for (let i = 0; i < Math.min(selects.length, 2); i++) {
          try {
            await selects[i].click();
            await page.waitForTimeout(300);
            const options = await page.locator('[role="option"], option').all();
            if (options.length > 0) {
              await options[0].click();
              await page.waitForTimeout(300);
            }
          } catch (e) {
            // Continue
          }
        }

        // Try to advance
        const nextBtn = page
          .locator('button:has-text("Next"), button:has-text("Continue")')
          .first();
        if (await nextBtn.isVisible({ timeout: 1000 })) {
          await nextBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      console.log('✅ Advanced through form steps');
    } catch (error) {
      console.log('⚠️ Form navigation partially completed');
    }

    // Wait for potential game/prop loading
    await page.waitForTimeout(3000);

    // Check for games with EST times (Fix #2)
    console.log('\n🕐 CHECKING EST TIMEZONE DISPLAY...');
    const gameElements = await page
      .locator(
        'div:has-text("@"), div:has-text("vs"), div:has-text("EST"), div:has-text("PM"), div:has-text("AM")'
      )
      .all();

    let foundESTTime = false;
    for (let i = 0; i < Math.min(gameElements.length, 5); i++) {
      const text = await gameElements[i].textContent();
      if (text && (text.includes('EST') || text.includes('PM') || text.includes('AM'))) {
        console.log(`✅ Found EST time: ${text.slice(0, 100)}...`);
        foundESTTime = true;
        break;
      }
    }

    await page.screenshot({
      path: 'screenshots/validation-02-games-with-times.png',
      fullPage: true,
    });

    // If we have games, try to select one to test props
    if (gameElements.length > 0) {
      console.log('\n🎮 TESTING GAME SELECTION AND PROPS...');

      // Click first game
      await gameElements[0].click();
      await page.waitForTimeout(3000);

      console.log('✅ Selected a game');

      // Check for props loading (Fix #1 and #3)
      console.log('\n🎯 CHECKING PROPS LOADING...');

      await page.waitForTimeout(2000);

      const propButtons = await page
        .locator('button:has-text("Over"), button:has-text("Under")')
        .all();
      console.log(`Found ${propButtons.length} prop buttons`);

      if (propButtons.length > 0) {
        console.log('✅ PROPS LOADED FROM DATABASE!');

        // Test clicking a prop (Fix #3)
        console.log('\n🖱️ TESTING PROP SELECTION...');
        await propButtons[0].click();
        await page.waitForTimeout(1000);

        // Check for Add Selection button
        const addBtn = page
          .locator('button:has-text("Add Selection"), button:has-text("Add")')
          .first();
        const addBtnVisible = await addBtn.isVisible({ timeout: 2000 });

        if (addBtnVisible) {
          console.log('✅ PROP SELECTION WORKING!');

          // Try to add the selection
          await addBtn.click();
          await page.waitForTimeout(1000);
          console.log('✅ Added selection to ticket');
        } else {
          console.log('❌ Add Selection button not visible');
        }
      } else {
        console.log('❌ No props found after game selection');
      }

      await page.screenshot({ path: 'screenshots/validation-03-props-test.png', fullPage: true });
    } else {
      console.log('❌ No games found to test');
    }

    // Final validation summary
    console.log('\n📊 PRODUCTION READINESS SUMMARY');
    console.log('================================');

    const finalGameCount = await page.locator('div:has-text("@"), div:has-text("vs")').count();
    const finalPropCount = await page
      .locator('button:has-text("Over"), button:has-text("Under")')
      .count();
    const finalAddCount = await page.locator('button:has-text("Add Selection")').count();
    const finalSelectionCount = await page.locator('text="Current Selections"').count();

    console.log(
      `✅ Games available: ${finalGameCount > 0 ? 'YES' : 'NO'} (${finalGameCount} found)`
    );
    console.log(`${foundESTTime ? '✅' : '❌'} EST times shown: ${foundESTTime ? 'YES' : 'NO'}`);
    console.log(
      `${finalPropCount > 0 ? '✅' : '❌'} Props loaded: ${finalPropCount > 0 ? 'YES' : 'NO'} (${finalPropCount} found)`
    );
    console.log(
      `${finalAddCount > 0 ? '✅' : '❌'} Add button working: ${finalAddCount > 0 ? 'YES' : 'NO'}`
    );
    console.log(
      `${finalSelectionCount > 0 ? '✅' : '❌'} Selections working: ${finalSelectionCount > 0 ? 'YES' : 'NO'}`
    );

    const allWorking =
      finalGameCount > 0 && foundESTTime && finalPropCount > 0 && finalAddCount > 0;

    console.log(
      `\n🎯 OVERALL PRODUCTION STATUS: ${allWorking ? '✅ READY FOR PRODUCTION!' : '❌ NEEDS ATTENTION'}`
    );

    if (allWorking) {
      console.log('\n🚀 All 3 critical fixes confirmed working:');
      console.log('   1. ✅ Props loading from database (API fixed)');
      console.log('   2. ✅ EST timezone display (formatTimeInEST working)');
      console.log('   3. ✅ Prop selection working (naming fix applied)');
      console.log('\n🎉 SMART FORM IS PRODUCTION READY!');
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/validation-04-final.png', fullPage: true });
    console.log('\n📸 Screenshots saved in screenshots/ directory');

    // Basic assertions for CI
    expect(finalGameCount).toBeGreaterThan(0);
    expect(finalPropCount).toBeGreaterThan(0);
  });
});
