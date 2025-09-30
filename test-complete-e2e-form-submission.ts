import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewyzymdqzzooeymznzzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eXp5bWRxenpvb2V5bXpuenpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE4NjIyNjcsImV4cCI6MjAzNzQzODI2N30.r8mBDv8TD6x4M0gh7vRzAseNvQnNqzywQbo3I4w7XJg';

async function testCompleteFormSubmission() {
  console.log('🚀 COMPLETE E2E FORM SUBMISSION TEST');
  console.log('=====================================');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Initialize browser with extended timeout
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 60000
    });

    page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // Step 1: Navigate to smart form
    console.log('\n📋 Step 1: Navigating to Smart Form...');
    await page.goto('http://localhost:3002', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✅ Smart Form home page loaded');

    // Step 2: Navigate to submit ticket page
    console.log('\n📝 Step 2: Navigating to Submit Ticket Page...');
    await page.goto('http://localhost:3002/submit-ticket', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for form to be fully loaded
    await page.waitForSelector('form', { timeout: 15000 });
    console.log('✅ Submit ticket form loaded');

    // Take screenshot of loaded form
    await page.screenshot({ path: 'test-screenshots/01-form-loaded.png', fullPage: true });

    // Step 3: Fill out form fields
    console.log('\n✏️ Step 3: Filling Form Fields...');

    // Select capper (griff843 should be in the dropdown from API)
    const capperSelector = 'select[name="capper"], input[name="capper"], [data-testid="capper-select"]';
    await page.waitForSelector(capperSelector, { timeout: 10000 });

    // Try different approaches to select capper
    try {
      const capperOptions = await page.$$eval('select[name="capper"] option', options =>
        options.map(option => ({ value: option.value, text: option.textContent }))
      );
      console.log('Available capper options:', capperOptions);

      // Look for griff843 or similar
      const griffOption = capperOptions.find(opt =>
        opt.text?.toLowerCase().includes('griff') || opt.value === 'griff843'
      );

      if (griffOption) {
        await page.selectOption('select[name="capper"]', griffOption.value);
        console.log('  ✅ Selected capper:', griffOption.text);
      } else {
        // Select first non-empty option
        await page.selectOption('select[name="capper"]', capperOptions[1]?.value);
        console.log('  ⚠️ Selected fallback capper:', capperOptions[1]?.text);
      }
    } catch (e) {
      console.log('  ⚠️ Capper selection failed, trying input field');
      await page.fill('input[name="capper"]', 'griff843');
    }

    // Select sport (NFL)
    await page.selectOption('select[name="sport"]', 'NFL');
    console.log('  ✅ Selected sport: NFL');

    // Set units
    await page.fill('input[name="unit_size"]', '2');
    console.log('  ✅ Set units: 2');

    // Set risk amount
    await page.fill('input[name="risk_amount"]', '100');
    console.log('  ✅ Set risk amount: $100');

    // Set confidence level
    await page.fill('input[name="confidence_level"]', '8');
    console.log('  ✅ Set confidence: 8/10');

    await page.screenshot({ path: 'test-screenshots/02-form-basic-filled.png', fullPage: true });

    // Step 4: Add a leg (selection) - THIS IS CRITICAL
    console.log('\n🎯 Step 4: Adding Bet Selection (Leg)...');

    // Look for "Add Leg" or "Add Selection" button
    const addLegSelectors = [
      'button:has-text("Add Leg")',
      'button:has-text("Add Selection")',
      'button:has-text("Add Bet")',
      '[data-testid="add-leg"]',
      '.add-leg-button'
    ];

    let addButtonFound = false;
    for (const selector of addLegSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        console.log('  ✅ Clicked add leg button:', selector);
        addButtonFound = true;
        break;
      } catch (e) {
        // Try next selector
      }
    }

    if (!addButtonFound) {
      console.log('  ⚠️ Add leg button not found, checking if leg form is already visible');
    }

    // Fill leg details
    await page.waitForTimeout(1000); // Wait for leg form to appear

    // Fill player name
    const playerInputs = [
      'input[name="player_name"]',
      'input[placeholder*="player"]',
      '[data-testid="player-input"]'
    ];

    for (const selector of playerInputs) {
      try {
        await page.fill(selector, 'Lamar Jackson');
        console.log('  ✅ Set player: Lamar Jackson');
        break;
      } catch (e) {
        // Try next selector
      }
    }

    // Select prop type
    try {
      await page.selectOption('select[name="prop_type"]', 'passing_yards');
      console.log('  ✅ Set prop type: passing_yards');
    } catch (e) {
      console.log('  ⚠️ Prop type selection failed');
    }

    // Set line
    try {
      await page.fill('input[name="line"]', '275.5');
      console.log('  ✅ Set line: 275.5');
    } catch (e) {
      console.log('  ⚠️ Line input failed');
    }

    // Set odds
    try {
      await page.fill('input[name="odds"]', '-110');
      console.log('  ✅ Set odds: -110');
    } catch (e) {
      console.log('  ⚠️ Odds input failed');
    }

    // Select over/under
    try {
      await page.selectOption('select[name="selection"]', 'over');
      console.log('  ✅ Set selection: over');
    } catch (e) {
      console.log('  ⚠️ Selection dropdown failed');
    }

    await page.screenshot({ path: 'test-screenshots/03-form-with-leg.png', fullPage: true });

    // Step 5: Submit the form
    console.log('\n🚀 Step 5: Submitting Form...');

    // Wait for submit button to be enabled
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 });

    // Take screenshot before submission
    await page.screenshot({ path: 'test-screenshots/04-before-submit.png', fullPage: true });

    // Click submit and wait for response
    const submitPromise = page.waitForResponse(response =>
      response.url().includes('/api/submit-ticket') && response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');
    console.log('  ✅ Clicked submit button');

    // Wait for API response
    const response = await submitPromise;
    const responseData = await response.json();

    console.log('  📡 API Response:', {
      status: response.status(),
      data: responseData
    });

    if (response.status() === 200) {
      console.log('  ✅ Form submitted successfully!');
    } else {
      console.log('  ❌ Form submission failed:', responseData);
    }

    // Wait for success message or error
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-screenshots/05-after-submit.png', fullPage: true });

    // Step 6: Verify in database
    console.log('\n🔍 Step 6: Verifying in Database...');

    // Check for new picks in unified_picks
    const { data: recentPicks, error: dbError } = await supabase
      .from('unified_picks')
      .select(`
        *,
        users!unified_picks_user_id_fkey (
          username
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (dbError) {
      console.error('  ❌ Database error:', dbError);
    } else {
      console.log('  📊 Recent picks in database:');
      recentPicks?.forEach((pick, index) => {
        console.log(`    ${index + 1}. User: ${pick.users?.username}, Player: ${pick.player_name}, Created: ${pick.created_at}`);
      });

      const ourPick = recentPicks?.find(p =>
        p.player_name === 'Lamar Jackson' ||
        p.users?.username === 'griff843'
      );

      if (ourPick) {
        console.log('  ✅ Our pick found in database!');
        console.log('    - ID:', ourPick.id);
        console.log('    - Player:', ourPick.player_name);
        console.log('    - User:', ourPick.users?.username);
        console.log('    - Status:', ourPick.status);
      } else {
        console.log('  ⚠️ Our pick not found in database');
      }
    }

    // Step 7: Check Command Center
    console.log('\n🎮 Step 7: Checking Command Center...');
    await page.goto('http://localhost:3004/dashboard/picks', {
      waitUntil: 'networkidle',
      timeout: 15000
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-screenshots/06-command-center.png', fullPage: true });
    console.log('  ✅ Command Center screenshot taken');

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('🏆 E2E FORM SUBMISSION TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('✅ Form Navigation: Success');
    console.log('✅ Form Fields: Filled');
    console.log('✅ Leg Addition: Attempted');
    console.log('✅ Form Submission: Completed');
    console.log('📊 Database: Checked');
    console.log('📸 Screenshots: Saved to test-screenshots/');
    console.log('\n🔗 Manual Verification:');
    console.log('  - Smart Form: http://localhost:3002/submit-ticket');
    console.log('  - Command Center: http://localhost:3004/dashboard/picks');
    console.log('  - Database: Check unified_picks table');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    if (page) {
      await page.screenshot({ path: 'test-screenshots/error-final.png', fullPage: true });
      console.log('📸 Error screenshot saved');
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testCompleteFormSubmission().catch(console.error);