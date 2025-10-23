import { chromium, Browser, Page } from 'playwright';

async function debugValidation() {
  console.log('🔍 FORM VALIDATION DEBUG');
  console.log('========================');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // Listen to console logs for validation debug info
    page.on('console', msg => {
      if (msg.text().includes('Step1 Validation Debug') || msg.text().includes('🐛')) {
        console.log('🐛 VALIDATION LOG:', msg.text());
      }
    });

    console.log('\n📋 Loading Smart Form...');
    await page.goto('http://localhost:3002/submit-ticket', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for initial load
    await page.waitForTimeout(3000);

    console.log('\n⏳ Waiting for cappers to load...');
    await page.waitForFunction(() => {
      const combobox = document.querySelector('[role="combobox"]');
      return combobox && !combobox.textContent?.includes('Loading cappers');
    }, { timeout: 60000 });

    console.log('\n👤 Selecting capper...');
    await page.click('[role="combobox"]');
    await page.waitForTimeout(1000);

    // Select first available capper
    const firstOption = await page.$('[role="option"]');
    if (firstOption) {
      const text = await firstOption.textContent();
      await firstOption.click();
      console.log(`✅ Selected capper: ${text}`);
    }

    await page.waitForTimeout(1000);

    console.log('\n🎯 Selecting ticket type...');
    const singleButton = await page.$('button:has-text("single")');
    if (singleButton) {
      await singleButton.click();
      console.log('✅ Selected ticket type: single');
    }

    await page.waitForTimeout(1000);

    console.log('\n🔍 Checking form state before sport selection...');

    // Check what buttons are available and their states
    const allButtons = await page.$$('button');
    console.log(`\nFound ${allButtons.length} buttons:`);

    for (let i = 0; i < Math.min(allButtons.length, 15); i++) {
      const button = allButtons[i];
      const text = await button.textContent();
      const disabled = await button.getAttribute('disabled');
      const classList = await button.getAttribute('class');

      // Check if this looks like a sport button
      const isSportButton = text && (
        text.includes('🏀') || text.includes('🏈') || text.includes('⚾') ||
        text.includes('🏒') || text.includes('NBA') || text.includes('NFL') ||
        text.includes('MLB') || text.includes('NHL') || text.includes('NCAAF')
      );

      console.log(`  ${i + 1}. "${text?.trim().substring(0, 30)}" ${disabled ? '(disabled)' : '(enabled)'} ${isSportButton ? '🏈 SPORT' : ''}`);

      if (isSportButton) {
        console.log(`      Classes: ${classList}`);
      }
    }

    // Try to click on enabled sport buttons
    console.log('\n🏈 Attempting to select sport...');

    const sportButtons = await page.$$('button');
    let sportSelected = false;

    for (const button of sportButtons) {
      const text = await button.textContent();
      const disabled = await button.getAttribute('disabled');

      if (text && !disabled && (
        text.includes('🏀') || text.includes('🏈') || text.includes('⚾') ||
        text.includes('🏒') || text.includes('NBA') || text.includes('NFL')
      )) {
        try {
          console.log(`  Trying to click sport button: "${text.trim()}"`);
          await button.click();
          console.log(`  ✅ Successfully clicked: "${text.trim()}"`);
          sportSelected = true;
          break;
        } catch (error) {
          console.log(`  ❌ Failed to click: "${text.trim()}" - ${error}`);
        }
      }
    }

    if (!sportSelected) {
      console.log('❌ Could not select any sport button');

      // Try any available button that might be a sport
      console.log('\n🔄 Trying alternative sport selection...');

      // Look for any button that's not obviously something else
      for (const button of sportButtons) {
        const text = await button.textContent();
        const disabled = await button.getAttribute('disabled');

        if (!disabled && text && text.length < 20 && !text.includes('Loading') &&
            !text.includes('Continue') && !text.includes('single') && !text.includes('parlay')) {
          try {
            console.log(`  Trying button: "${text.trim()}"`);
            await button.click();
            console.log(`  ✅ Clicked: "${text.trim()}"`);
            sportSelected = true;
            break;
          } catch (error) {
            console.log(`  ❌ Failed: "${text.trim()}"`);
          }
        }
      }
    }

    await page.waitForTimeout(2000);

    console.log('\n🔍 Checking continue button state...');

    const continueButtons = await page.$$('button:has-text("Continue"), button:has-text("Next")');
    console.log(`Found ${continueButtons.length} continue/next buttons:`);

    for (let i = 0; i < continueButtons.length; i++) {
      const button = continueButtons[i];
      const text = await button.textContent();
      const disabled = await button.getAttribute('disabled');
      console.log(`  ${i + 1}. "${text?.trim()}" ${disabled ? '(disabled)' : '(enabled)'}`);
    }

    await page.screenshot({ path: 'test-screenshots/validation-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved: validation-debug.png');

  } catch (error) {
    console.error('\n❌ Debug failed:', error);
    if (page) {
      await page.screenshot({ path: 'test-screenshots/debug-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugValidation().catch(console.error);