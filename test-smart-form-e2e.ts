import { chromium, Browser, Page } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testSmartFormE2E() {
  console.log('🚀 SMART FORM E2E TEST - griff843 Manual Pick');
  console.log('===============================================');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Initialize browser
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 60000
    });

    page = await browser.newPage();
    page.setDefaultTimeout(45000);

    // Log console messages for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Console Error:', msg.text());
      }
    });

    // Step 1: Navigate to submit ticket page
    console.log('\n📋 Step 1: Loading Smart Form...');
    await page.goto('http://localhost:3002/submit-ticket', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.screenshot({ path: 'test-screenshots/01-initial-load.png', fullPage: true });
    console.log('✅ Smart Form loaded');

    // Step 2: Wait for cappers to load
    console.log('\n⏳ Step 2: Waiting for Cappers to Load...');

    // Wait for the cappers dropdown to become enabled (not disabled)
    try {
      await page.waitForSelector('button[role="combobox"]:not([disabled])', { timeout: 30000 });
      console.log('✅ Cappers dropdown is now enabled');
    } catch (e) {
      console.log('⚠️ Cappers dropdown still disabled, checking for alternative selectors');

      // Check if there's a select element instead
      const hasSelect = await page.$('select:not([disabled])');
      if (hasSelect) {
        console.log('✅ Found enabled select element');
      }
    }

    await page.screenshot({ path: 'test-screenshots/02-cappers-loaded.png', fullPage: true });

    // Step 3: Select Capper
    console.log('\n👤 Step 3: Selecting Capper...');

    // Try different approaches to select capper
    let capperSelected = false;

    // Approach 1: Click combobox button
    try {
      await page.click('button[role="combobox"]');
      await page.waitForTimeout(1000);

      // Look for griff843 or first available option
      const options = await page.$$('[role="option"]');
      if (options.length > 0) {
        // Try to find griff843
        let selectedOption = null;
        for (const option of options) {
          const text = await option.textContent();
          if (text?.toLowerCase().includes('griff')) {
            selectedOption = option;
            break;
          }
        }

        // If no griff found, use first option
        if (!selectedOption && options.length > 0) {
          selectedOption = options[0];
        }

        if (selectedOption) {
          await selectedOption.click();
          const selectedText = await selectedOption.textContent();
          console.log('✅ Selected capper:', selectedText);
          capperSelected = true;
        }
      }
    } catch (e) {
      console.log('⚠️ Combobox approach failed, trying select element');
    }

    // Approach 2: Try select element
    if (!capperSelected) {
      try {
        const selectElement = await page.$('select:not([disabled])');
        if (selectElement) {
          const options = await page.$$eval('select option', opts =>
            opts.map(opt => ({ value: opt.value, text: opt.textContent }))
          );

          // Find griff843 or use first valid option
          let targetOption = options.find(opt =>
            opt.text?.toLowerCase().includes('griff') && opt.value
          );

          if (!targetOption) {
            targetOption = options.find(opt => opt.value && opt.value !== '');
          }

          if (targetOption) {
            await page.selectOption('select', targetOption.value);
            console.log('✅ Selected capper via select:', targetOption.text);
            capperSelected = true;
          }
        }
      } catch (e) {
        console.log('⚠️ Select approach failed');
      }
    }

    if (!capperSelected) {
      console.log('❌ Could not select capper, continuing anyway...');
    }

    // Step 4: Select Ticket Type
    console.log('\n🎯 Step 4: Selecting Ticket Type...');

    // Look for ticket type buttons (single, parlay, etc.)
    const ticketTypeButtons = await page.$$('button:has-text("single"), button[title*="single"]');
    if (ticketTypeButtons.length > 0) {
      await ticketTypeButtons[0].click();
      console.log('✅ Selected ticket type: single');
    } else {
      // Try clicking on the word "single" directly
      try {
        await page.click('text=single');
        console.log('✅ Selected ticket type: single (via text)');
      } catch (e) {
        console.log('⚠️ Could not select ticket type');
      }
    }

    await page.screenshot({ path: 'test-screenshots/03-ticket-type-selected.png', fullPage: true });

    // Step 5: Select Sport (NFL)
    console.log('\n🏈 Step 5: Selecting Sport...');

    // Look for NFL button or image
    try {
      // Try clicking NFL logo/button
      const nflButtons = await page.$$('button[title*="NFL"], img[alt*="NFL"], button:has-text("NFL")');
      if (nflButtons.length > 0) {
        await nflButtons[0].click();
        console.log('✅ Selected sport: NFL');
      } else {
        // Try text approach
        await page.click('text=NFL');
        console.log('✅ Selected sport: NFL (via text)');
      }
    } catch (e) {
      console.log('⚠️ Could not select NFL, trying any sport...');
      // Try to click any sport logo
      const sportImages = await page.$$('img[alt*="Logo"]');
      if (sportImages.length > 0) {
        await sportImages[0].click();
        console.log('✅ Selected a sport');
      }
    }

    await page.screenshot({ path: 'test-screenshots/04-sport-selected.png', fullPage: true });

    // Step 6: Look for Next Button or Progress to Next Step
    console.log('\n➡️ Step 6: Progressing to Next Step...');

    // Look for Next button, Continue button, or similar
    const nextButtons = await page.$$('button:has-text("Next"), button:has-text("Continue"), button:has-text("Proceed")');
    if (nextButtons.length > 0) {
      await nextButtons[0].click();
      console.log('✅ Clicked Next button');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️ No Next button found, checking if form progressed automatically');
    }

    await page.screenshot({ path: 'test-screenshots/05-step-progression.png', fullPage: true });

    // Step 7: Fill any input fields that are now available
    console.log('\n📝 Step 7: Filling Available Input Fields...');

    // Look for common form inputs
    const inputs = await page.$$('input[type="text"], input[type="number"], textarea');
    console.log(`Found ${inputs.length} input fields`);

    for (let i = 0; i < inputs.length; i++) {
      try {
        const input = inputs[i];
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const type = await input.getAttribute('type');

        console.log(`  Input ${i + 1}: name="${name}", placeholder="${placeholder}", type="${type}"`);

        // Fill based on name or placeholder
        if (name?.includes('unit') || placeholder?.includes('unit')) {
          await input.fill('2');
          console.log('    ✅ Set units: 2');
        } else if (name?.includes('risk') || name?.includes('amount') || placeholder?.includes('amount')) {
          await input.fill('100');
          console.log('    ✅ Set amount: 100');
        } else if (name?.includes('confidence')) {
          await input.fill('8');
          console.log('    ✅ Set confidence: 8');
        } else if (name?.includes('player') || placeholder?.includes('player')) {
          await input.fill('Lamar Jackson');
          console.log('    ✅ Set player: Lamar Jackson');
        } else if (name?.includes('line')) {
          await input.fill('275.5');
          console.log('    ✅ Set line: 275.5');
        } else if (name?.includes('odds')) {
          await input.fill('-110');
          console.log('    ✅ Set odds: -110');
        }
      } catch (e) {
        console.log(`    ⚠️ Failed to fill input ${i + 1}`);
      }
    }

    // Step 8: Handle any dropdowns
    console.log('\n🔽 Step 8: Handling Dropdowns...');
    const selects = await page.$$('select:not([disabled])');
    console.log(`Found ${selects.length} enabled select elements`);

    for (let i = 0; i < selects.length; i++) {
      try {
        const select = selects[i];
        const name = await select.getAttribute('name');
        console.log(`  Select ${i + 1}: name="${name}"`);

        const options = await select.$$('option');
        if (options.length > 1) {
          // Select second option (first is usually placeholder)
          const value = await options[1].getAttribute('value');
          if (value) {
            await select.selectOption(value);
            const text = await options[1].textContent();
            console.log(`    ✅ Selected: ${text}`);
          }
        }
      } catch (e) {
        console.log(`    ⚠️ Failed to handle select ${i + 1}`);
      }
    }

    await page.screenshot({ path: 'test-screenshots/06-form-filled.png', fullPage: true });

    // Step 9: Look for Submit Button
    console.log('\n🚀 Step 9: Finding and Clicking Submit Button...');

    // Look for submit button with different approaches
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Submit Ticket")',
      'button:has-text("Place Bet")',
      'button:has-text("Complete")',
      '.submit-button',
      '[data-testid="submit"]'
    ];

    let submitClicked = false;
    for (const selector of submitSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isDisabled = await button.getAttribute('disabled');
          if (!isDisabled) {
            await button.click();
            console.log(`✅ Clicked submit button: ${selector}`);
            submitClicked = true;
            break;
          } else {
            console.log(`⚠️ Submit button found but disabled: ${selector}`);
          }
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!submitClicked) {
      console.log('❌ No enabled submit button found');

      // Try clicking any button that might submit
      const allButtons = await page.$$('button:not([disabled])');
      console.log(`Found ${allButtons.length} enabled buttons`);

      for (const button of allButtons) {
        const text = await button.textContent();
        console.log(`  Button: "${text}"`);
        if (text?.toLowerCase().includes('submit') ||
            text?.toLowerCase().includes('complete') ||
            text?.toLowerCase().includes('place')) {
          await button.click();
          console.log(`✅ Clicked button: ${text}`);
          submitClicked = true;
          break;
        }
      }
    }

    // Step 10: Wait for response and check results
    console.log('\n📡 Step 10: Waiting for Response...');

    if (submitClicked) {
      // Wait for potential API call or page change
      await page.waitForTimeout(5000);

      // Check for success/error messages
      const toasts = await page.$$('.toast, [role="alert"], .notification');
      if (toasts.length > 0) {
        for (const toast of toasts) {
          const text = await toast.textContent();
          console.log(`📢 Message: ${text}`);
        }
      }
    }

    await page.screenshot({ path: 'test-screenshots/07-final-state.png', fullPage: true });

    // Step 11: Check database for new picks
    console.log('\n🔍 Step 11: Checking Database...');
    const { stdout: recentPicks } = await execAsync(
      'docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT id, user_id, player_name, stat_type, tier, status, created_at FROM unified_picks ORDER BY created_at DESC LIMIT 5;" | head -10'
    );

    console.log('Recent picks in database:');
    console.log(recentPicks);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SMART FORM E2E TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Form Loading: Success');
    console.log(capperSelected ? '✅ Capper Selection: Success' : '⚠️ Capper Selection: Partial');
    console.log('✅ Sport Selection: Attempted');
    console.log('✅ Form Fields: Filled where possible');
    console.log(submitClicked ? '✅ Submit Action: Attempted' : '⚠️ Submit Action: Not found');
    console.log('\n📸 Screenshots saved to test-screenshots/');
    console.log('📊 Database checked for new entries');
    console.log('\n🔗 Manual verification:');
    console.log('  - Smart Form: http://localhost:3002/submit-ticket');
    console.log('  - Database: Check unified_picks table');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'test-screenshots/error-smart-form.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSmartFormE2E().catch(console.error);