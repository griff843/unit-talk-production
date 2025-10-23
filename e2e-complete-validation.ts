import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface TestPick {
  player: string;
  market: string;
  line: number;
  odds: number;
  selection: 'over' | 'under';
}

const TEST_PICKS: TestPick[] = [
  { player: 'Patrick Mahomes', market: 'Passing Yards', line: 275.5, odds: -110, selection: 'over' },
  { player: 'Travis Kelce', market: 'Receiving Yards', line: 65.5, odds: -115, selection: 'over' },
  { player: 'Isiah Pacheco', market: 'Rushing Yards', line: 55.5, odds: -110, selection: 'under' }
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findGriff843UserId(): Promise<string | null> {
  console.log('🔍 Looking up Griff843 user ID...');

  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .ilike('username', 'griff843')
    .single();

  if (error || !data) {
    console.error('❌ Could not find Griff843:', error?.message);
    return null;
  }

  console.log(`✅ Found user: ${data.username} (ID: ${data.id})`);
  return data.id;
}

async function submitPickViaSmartForm(
  page: Page,
  capperId: string,
  pick: TestPick,
  pickNumber: number
): Promise<string | null> {
  console.log(`\n🎯 Submitting Pick ${pickNumber}: ${pick.player} ${pick.market} ${pick.selection} ${pick.line}`);

  try {
    // Navigate to Smart Form
    await page.goto('http://localhost:3021/submit-ticket', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Smart Form loaded');

    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-step0-loaded.png` });

    // Step 1: Ticket Essentials
    console.log('📝 Step 1: Filling ticket essentials...');

    // Select capper (may be dropdown or input)
    try {
      await page.fill('[name="capper"]', capperId, { timeout: 5000 });
    } catch {
      await page.selectOption('[name="capper"]', capperId);
    }

    await page.selectOption('[name="ticket_type"]', 'single');
    await page.selectOption('[name="sport"]', 'NFL');
    await page.fill('[name="game_date"]', '2025-10-07');

    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-step1-essentials.png` });
    await page.click('button:has-text("Next")');
    await delay(1000);

    // Step 2: Betting Configuration
    console.log('📝 Step 2: Setting betting configuration...');
    await page.fill('[name="total_units"]', '2.0');
    await page.fill('[name="confidence"]', '7');

    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-step2-config.png` });
    await page.click('button:has-text("Next")');
    await delay(1000);

    // Step 3: Bet Type & Market
    console.log('📝 Step 3: Selecting bet type and market...');
    await page.click('text=Player Props');
    await page.click('text=Pre-Game');

    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-step3-type.png` });
    await page.click('button:has-text("Next")');
    await delay(1000);

    // Step 4: Game & Pick Details
    console.log('📝 Step 4: Creating manual prop...');
    await page.click('button:has-text("Create Manual Prop")');
    await delay(500);

    // Fill player name
    await page.fill('input[placeholder*="player" i]', pick.player);
    await delay(500);

    // Select market
    await page.selectOption('select:near(:text("Market"))', pick.market);

    // Fill line
    await page.fill('input[name="line"]', pick.line.toString());

    // Fill odds
    await page.fill('input[name="odds"]', pick.odds.toString());

    // Select over/under
    await page.click(`text=${pick.selection.charAt(0).toUpperCase() + pick.selection.slice(1)}`);

    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-step4-details.png` });

    // Submit
    console.log('🚀 Submitting pick...');
    await page.click('button:has-text("Submit")');

    // Wait for success message
    await page.waitForSelector('text=/submitted successfully/i', { timeout: 10000 });

    // Extract bet_slip_id from response or success message
    const successText = await page.textContent('body');
    const betSlipIdMatch = successText?.match(/bet[_-]?slip[_-]?id[:\s]+([a-f0-9-]+)/i);
    const betSlipId = betSlipIdMatch ? betSlipIdMatch[1] : null;

    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-success.png` });

    console.log(`✅ Pick ${pickNumber} submitted successfully!`);
    if (betSlipId) console.log(`   Bet Slip ID: ${betSlipId}`);

    return betSlipId;

  } catch (error) {
    console.error(`❌ Failed to submit pick ${pickNumber}:`, error);
    await page.screenshot({ path: `.playwright-mcp/e2e-pick${pickNumber}-error.png` });
    return null;
  }
}

async function verifyDatabaseWrite(betSlipId: string): Promise<boolean> {
  console.log(`\n🔍 Verifying database write for ${betSlipId}...`);

  // Check bridge_outbox
  const { data: outboxData, error: outboxError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('bet_slip_id', betSlipId)
    .single();

  if (outboxError || !outboxData) {
    console.error('❌ bridge_outbox entry not found:', outboxError?.message);
    return false;
  }

  console.log(`✅ bridge_outbox entry found (ID: ${outboxData.id}, Status: ${outboxData.status})`);

  // Check unified_picks
  const { data: pickData, error: pickError } = await supabase
    .from('unified_picks')
    .select('*')
    .contains('metadata', { bet_slip_id: betSlipId })
    .maybeSingle();

  if (pickData) {
    console.log(`✅ unified_picks entry found (ID: ${pickData.id}, Status: ${pickData.status})`);
  } else {
    console.log(`⏳ unified_picks entry not yet created (BridgeWorker may be processing...)`);
  }

  return true;
}

async function approvePickInCommandCenter(page: Page, betSlipId: string): Promise<boolean> {
  console.log(`\n✅ Approving pick ${betSlipId} in Command Center...`);

  try {
    await page.goto('http://localhost:3015', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Command Center loaded');

    await page.screenshot({ path: `.playwright-mcp/command-center-loaded.png` });

    // Navigate to picks approval section
    await page.click('text=/picks|review|approve/i', { timeout: 5000 });
    await delay(2000);

    await page.screenshot({ path: `.playwright-mcp/command-center-picks-view.png` });

    // Find the pick by bet_slip_id and approve it
    const pickRow = page.locator(`tr:has-text("${betSlipId}")`).first();

    if (await pickRow.count() === 0) {
      console.warn(`⚠️ Pick ${betSlipId} not visible in Command Center yet`);
      return false;
    }

    // Click approve button
    await pickRow.locator('button:has-text("Approve")').click();
    await delay(1000);

    // Confirm approval if modal appears
    try {
      await page.click('button:has-text("Confirm")', { timeout: 2000 });
    } catch {
      // No confirmation modal
    }

    await page.screenshot({ path: `.playwright-mcp/command-center-approved.png` });

    console.log(`✅ Pick ${betSlipId} approved in Command Center`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to approve pick in Command Center:`, error);
    await page.screenshot({ path: `.playwright-mcp/command-center-error.png` });
    return false;
  }
}

async function verifyDiscordPosting(betSlipId: string): Promise<boolean> {
  console.log(`\n📬 Verifying Discord posting for ${betSlipId}...`);

  // Check if pick has discord_message_id
  const { data: pickData, error } = await supabase
    .from('unified_picks')
    .select('discord_message_id, posted_to_discord')
    .contains('metadata', { bet_slip_id: betSlipId })
    .single();

  if (error || !pickData) {
    console.warn(`⏳ Pick not yet posted to Discord`);
    return false;
  }

  if (pickData.posted_to_discord && pickData.discord_message_id) {
    console.log(`✅ Pick posted to Discord (Message ID: ${pickData.discord_message_id})`);
    return true;
  }

  console.warn(`⏳ Discord posting pending...`);
  return false;
}

async function runCompleteE2ETest() {
  console.log('🚀 Starting Complete E2E Validation Test\n');
  console.log('=' .repeat(80));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Step 1: Get Griff843 user ID
    const capperId = await findGriff843UserId();
    if (!capperId) {
      throw new Error('Failed to find Griff843 user ID');
    }

    const submittedPicks: Array<{ betSlipId: string | null; pick: TestPick }> = [];

    // Step 2: Submit 3 picks via Smart Form
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: SUBMITTING 3 PICKS VIA SMART FORM');
    console.log('='.repeat(80));

    for (let i = 0; i < TEST_PICKS.length; i++) {
      const betSlipId = await submitPickViaSmartForm(page, capperId, TEST_PICKS[i], i + 1);
      submittedPicks.push({ betSlipId, pick: TEST_PICKS[i] });
      await delay(2000); // Brief delay between submissions
    }

    // Step 3: Verify database writes
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: VERIFYING DATABASE WRITES');
    console.log('='.repeat(80));

    let dbVerifyCount = 0;
    for (const { betSlipId } of submittedPicks) {
      if (betSlipId && await verifyDatabaseWrite(betSlipId)) {
        dbVerifyCount++;
      }
    }

    // Step 4: Approve picks in Command Center
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: APPROVING PICKS IN COMMAND CENTER');
    console.log('='.repeat(80));

    // Wait a moment for BridgeWorker to process
    console.log('⏳ Waiting 10 seconds for BridgeWorker processing...');
    await delay(10000);

    let approvalCount = 0;
    for (const { betSlipId } of submittedPicks) {
      if (betSlipId && await approvePickInCommandCenter(page, betSlipId)) {
        approvalCount++;
      }
    }

    // Step 5: Verify Discord posting
    console.log('\n' + '='.repeat(80));
    console.log('STEP 5: VERIFYING DISCORD POSTING');
    console.log('='.repeat(80));

    // Wait for Discord posting
    console.log('⏳ Waiting 5 seconds for Discord posting...');
    await delay(5000);

    let discordCount = 0;
    for (const { betSlipId } of submittedPicks) {
      if (betSlipId && await verifyDiscordPosting(betSlipId)) {
        discordCount++;
      }
    }

    // Final Summary
    console.log('\n' + '='.repeat(80));
    console.log('E2E TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`\n✅ Picks Submitted:        ${submittedPicks.filter(p => p.betSlipId).length}/${TEST_PICKS.length}`);
    console.log(`✅ Database Verified:      ${dbVerifyCount}/${TEST_PICKS.length}`);
    console.log(`✅ Command Center Approved: ${approvalCount}/${TEST_PICKS.length}`);
    console.log(`✅ Discord Posted:         ${discordCount}/${TEST_PICKS.length}`);

    const allGreen = dbVerifyCount === TEST_PICKS.length &&
                     approvalCount === TEST_PICKS.length &&
                     discordCount === TEST_PICKS.length;

    if (allGreen) {
      console.log('\n🎉 ALL GREEN - E2E TEST PASSED!');
    } else {
      console.log('\n⚠️ SOME STEPS INCOMPLETE - Check logs above');
    }

    await page.screenshot({ path: `.playwright-mcp/e2e-final-summary.png` });

  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error);
    await page.screenshot({ path: `.playwright-mcp/e2e-test-error.png` });
  } finally {
    await browser.close();
  }
}

runCompleteE2ETest().catch(console.error);
