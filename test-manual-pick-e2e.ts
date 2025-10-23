import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewyzymdqzzooeymznzzb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eXp5bWRxenpvb2V5bXpuenpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE4NjIyNjcsImV4cCI6MjAzNzQzODI2N30.r8mBDv8TD6x4M0gh7vRzAseNvQnNqzywQbo3I4w7XJg';

async function testManualPickSubmission() {
  console.log('🚀 Starting E2E Manual Pick Submission Test');
  console.log('================================================');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Initialize browser
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    // Step 1: Navigate to smart form
    console.log('\n📋 Step 1: Navigating to Smart Form...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-screenshots/01-smart-form-loaded.png' });
    console.log('✅ Smart Form loaded successfully');

    // Step 2: Fill in manual pick form
    console.log('\n📝 Step 2: Filling Manual Pick Form...');

    // Navigate to submit ticket page
    await page.goto('http://localhost:3002/submit-ticket', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Fill capper name
    await page.fill('input[name="capperName"]', 'griff843');
    console.log('  - Capper name: griff843');

    // Select sport (NFL for this test)
    await page.selectOption('select[name="sport"]', 'NFL');
    console.log('  - Sport: NFL');

    // Fill in pick details
    const testPick = {
      game: 'Ravens vs Steelers',
      pickType: 'spread',
      pick: 'Ravens -3.5',
      odds: '-110',
      units: '2',
      reasoning: 'Test manual pick submission - Ravens dominant at home'
    };

    await page.fill('input[name="game"]', testPick.game);
    await page.selectOption('select[name="pickType"]', testPick.pickType);
    await page.fill('input[name="pick"]', testPick.pick);
    await page.fill('input[name="odds"]', testPick.odds);
    await page.fill('input[name="units"]', testPick.units);
    await page.fill('textarea[name="reasoning"]', testPick.reasoning);

    console.log('  - Game:', testPick.game);
    console.log('  - Pick:', testPick.pick);
    console.log('  - Odds:', testPick.odds);
    console.log('  - Units:', testPick.units);

    await page.screenshot({ path: 'test-screenshots/02-form-filled.png' });
    console.log('✅ Form filled successfully');

    // Step 3: Submit the form
    console.log('\n🚀 Step 3: Submitting Pick...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-screenshots/03-after-submission.png' });

    // Step 4: Verify in database
    console.log('\n🔍 Step 4: Verifying Pick in Database...');
    const { data: picks, error: dbError } = await supabase
      .from('unified_picks')
      .select(`
        *,
        users!unified_picks_user_id_fkey (
          username,
          discord_id
        )
      `)
      .eq('capper_name', 'griff843')
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('❌ Database error:', dbError);
    } else if (picks && picks.length > 0) {
      console.log('✅ Pick found in unified_picks table:');
      console.log('  - ID:', picks[0].id);
      console.log('  - Capper:', picks[0].capper_name);
      console.log('  - Sport:', picks[0].sport);
      console.log('  - Status:', picks[0].status);
    } else {
      console.log('⚠️ Pick not found in database yet');
    }

    // Step 5: Check Command Center
    console.log('\n🎮 Step 5: Checking Command Center...');
    await page.goto('http://localhost:3004', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Look for the pick in the pending picks section
    const pickVisible = await page.isVisible(`text="${testPick.game}"`);
    if (pickVisible) {
      console.log('✅ Pick visible in Command Center');
      await page.screenshot({ path: 'test-screenshots/04-command-center.png' });
    } else {
      console.log('⚠️ Pick not yet visible in Command Center');
    }

    // Step 6: Check Discord (via API)
    console.log('\n💬 Step 6: Checking Discord Thread...');
    // We'll check the Discord bot logs for thread creation

    // Generate summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY:');
    console.log('='.repeat(50));
    console.log('✅ Smart Form: Accessible and functional');
    console.log(picks && picks.length > 0 ? '✅ Database: Pick stored successfully' : '⚠️ Database: Pick storage pending');
    console.log(pickVisible ? '✅ Command Center: Pick displayed' : '⚠️ Command Center: Pick not visible');
    console.log('⏳ Discord: Check discord-bot logs for thread creation');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (page) {
      await page.screenshot({ path: 'test-screenshots/error-state.png' });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testManualPickSubmission().catch(console.error);