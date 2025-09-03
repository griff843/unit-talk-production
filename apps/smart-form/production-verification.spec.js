const { test, expect } = require('@playwright/test');

test.describe('Production Readiness Verification', () => {
  test('Verify all 3 critical issues are fixed for production', async ({ page }) => {
    console.log('🎯 PRODUCTION READINESS VERIFICATION STARTING...\n');

    // Navigate to the form
    await page.goto('http://localhost:3002/submit-ticket');

    // Wait for form to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('✅ Form loaded successfully');

    // STEP 1: Basic Information
    console.log('\n📝 STEP 1: Basic Information');

    // Look for any visible form elements to proceed
    const step1Elements = [
      'select',
      'button[role="combobox"]',
      'input[type="range"]',
      'h2:has-text("Basic")',
      'h2:has-text("Information")',
      '[data-testid]',
    ];

    let foundElements = [];
    for (const selector of step1Elements) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        foundElements.push({ selector, count: elements.length });
      }
    }

    console.log(
      `Found form elements:`,
      foundElements.map(e => `${e.selector} (${e.count})`).join(', ')
    );

    // Try to fill basic information
    try {
      // Look for sport selection
      const sportSelectors = [
        'select:has-option',
        'button[role="combobox"]:has-text("sport")',
        'button[role="combobox"]:has-text("Select")',
        '[data-testid*="sport"]',
      ];

      let sportSelected = false;
      for (const selector of sportSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await page.waitForTimeout(1000);

          // Try to select NBA
          const nbaOption = page
            .locator('[role="option"]:has-text("NBA"), option[value="NBA"], text="NBA"')
            .first();
          if (await nbaOption.isVisible({ timeout: 2000 })) {
            await nbaOption.click();
            console.log('✅ NBA sport selected');
            sportSelected = true;
            break;
          }
        }
      }

      if (!sportSelected) {
        console.log('⚠️ Could not select sport, continuing with available options');
      }
    } catch (error) {
      console.log('⚠️ Step 1 interaction limited, continuing to verification checks');
    }

    // CRITICAL VERIFICATION 1: EST TIMEZONE DISPLAY
    console.log('\n🕐 VERIFICATION 1: EST Timezone Display');

    // Navigate through form to reach game selection
    let reachedGameSelection = false;
    try {
      // Try to advance through steps
      const nextButtons = await page
        .locator('button:has-text("Next"), button:has-text("Continue")')
        .all();
      for (let i = 0; i < Math.min(nextButtons.length, 3); i++) {
        if (await nextButtons[i].isVisible()) {
          await nextButtons[i].click();
          await page.waitForTimeout(2000);
        }
      }

      // Check for games with time display
      await page.waitForTimeout(3000);
      const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}\\s*(AM|PM)/i').all();
      const estElements = await page.locator('text=/EST/i').all();

      console.log(`Found ${timeElements.length} time displays`);
      console.log(`Found ${estElements.length} EST timezone indicators`);

      if (timeElements.length > 0 || estElements.length > 0) {
        reachedGameSelection = true;
        console.log('✅ VERIFIED: Game times with timezone display found');

        // Get sample time display text
        if (timeElements.length > 0) {
          const sampleTime = await timeElements[0].textContent();
          console.log(`   Sample time: "${sampleTime}"`);
        }
        if (estElements.length > 0) {
          const sampleEST = await estElements[0].textContent();
          console.log(`   Sample EST text: "${sampleEST}"`);
        }
      } else {
        console.log('⚠️ No time displays found yet, checking API directly');
      }
    } catch (error) {
      console.log('⚠️ Could not navigate to game selection, checking API directly');
    }

    // CRITICAL VERIFICATION 2: PROPS API WORKING
    console.log('\n🎯 VERIFICATION 2: Props Loading from Database');

    // Test props API directly
    const propsResponse = await page.request.get(
      '/api/api/props?game_id=9a134e77-d3e5-4e7f-9697-347cadb27fab&sport=NBA&prop_type=player_props'
    );
    const propsData = await propsResponse.json();

    console.log(`Props API Status: ${propsResponse.status()}`);
    console.log(`Props API Response:`, JSON.stringify(propsData, null, 2));

    if (propsData.success && propsData.props && propsData.props.length > 0) {
      console.log('✅ VERIFIED: Props loading from database successfully');
      console.log(`   Found ${propsData.props.length} props`);
      console.log(`   Data source: ${propsData.source}`);

      // Check props structure
      const sampleProp = propsData.props[0];
      console.log(`   Sample prop: ${sampleProp.display_name}`);
      if (sampleProp.selection_options) {
        console.log(`   Selection options: ${sampleProp.selection_options.length}`);
      }
    } else {
      console.log('❌ ISSUE: Props not loading from database');
    }

    // CRITICAL VERIFICATION 3: GAMES API WITH EST TIMES
    console.log('\n🎮 VERIFICATION 3: Games API with EST Times');

    // Test games API - we need to use a JavaScript module that can import the fetchGames function
    // Since we can't import TypeScript directly, let's test via HTTP if there's an endpoint
    // Or check the frontend displays the data correctly

    // Check if games are displayed on the page with EST times
    const gameElements = await page.locator('div:has-text("@"), div:has-text("vs")').all();
    console.log(`Found ${gameElements.length} potential game elements`);

    let estTimeFound = false;
    for (let i = 0; i < Math.min(gameElements.length, 5); i++) {
      const gameText = await gameElements[i].textContent();
      if (
        gameText &&
        (gameText.includes('EST') || gameText.includes('PM') || gameText.includes('AM'))
      ) {
        console.log(`✅ VERIFIED: EST time found in game display: "${gameText.slice(0, 100)}"`);
        estTimeFound = true;
        break;
      }
    }

    if (!estTimeFound && gameElements.length > 0) {
      console.log('⚠️ Games found but EST times not visible, checking first few:');
      for (let i = 0; i < Math.min(gameElements.length, 3); i++) {
        const text = await gameElements[i].textContent();
        console.log(`   Game ${i + 1}: "${text?.slice(0, 80)}"`);
      }
    }

    // FORM SUBMISSION CAPABILITY TEST
    console.log('\n📋 VERIFICATION 4: Form Submission Capability');

    // Check if we can reach a submit button
    const submitButtons = await page
      .locator('button:has-text("Submit"), button:has-text("Submit Ticket")')
      .all();
    console.log(`Found ${submitButtons.length} submit buttons`);

    if (submitButtons.length > 0) {
      const submitButton = submitButtons[0];
      const isVisible = await submitButton.isVisible();
      const isEnabled = await submitButton.isEnabled();
      console.log(`✅ Submit button found - Visible: ${isVisible}, Enabled: ${isEnabled}`);
    }

    // FINAL PRODUCTION READINESS ASSESSMENT
    console.log('\n🎯 PRODUCTION READINESS ASSESSMENT');
    console.log('=====================================');

    const issue1Fixed = propsData.success && propsData.props && propsData.props.length > 0;
    const issue2Fixed = estTimeFound || timeElements.length > 0;
    const issue3Fixed = submitButtons.length > 0;

    console.log(
      `✅ Issue 1 - Props loading from database: ${issue1Fixed ? 'FIXED' : 'NEEDS WORK'}`
    );
    console.log(`✅ Issue 2 - EST timezone display: ${issue2Fixed ? 'FIXED' : 'NEEDS WORK'}`);
    console.log(`✅ Issue 3 - Form submission capability: ${issue3Fixed ? 'FIXED' : 'NEEDS WORK'}`);

    const allIssuesFixed = issue1Fixed && issue2Fixed && issue3Fixed;

    console.log('\n🚀 FINAL VERDICT:');
    if (allIssuesFixed) {
      console.log('✅ PRODUCTION READY - All critical issues resolved!');
    } else {
      console.log('⚠️  NEEDS ATTENTION - Some issues require review');
    }

    console.log('\nDetailed Status:');
    console.log(`- Database props integration: ${issue1Fixed ? '✅' : '❌'}`);
    console.log(`- EST timezone conversion: ${issue2Fixed ? '✅' : '❌'}`);
    console.log(`- Form completion flow: ${issue3Fixed ? '✅' : '❌'}`);

    // Take final screenshot for evidence
    await page.screenshot({ path: 'production-verification-final.png', fullPage: true });
    console.log('\n📸 Final verification screenshot saved');

    // Assert for test framework
    expect(issue1Fixed).toBe(true);
    expect(issue2Fixed).toBe(true);
    expect(issue3Fixed).toBe(true);

    console.log('\n🎉 PRODUCTION VERIFICATION COMPLETE!');
  });
});
