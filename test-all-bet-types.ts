import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findGriff843UserId(): Promise<string | null> {
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

interface BetTest {
  name: string;
  type: string;
  setup: (page: Page) => Promise<void>;
}

const BET_TESTS: BetTest[] = [
  {
    name: 'Player Prop (Single)',
    type: 'single',
    setup: async (page) => {
      // Already tested - Patrick Mahomes passing yards
      await page.selectOption('[name="ticket_type"]', 'single');
      await page.selectOption('[name="sport"]', 'NFL');
      await page.fill('[name="game_date"]', '2025-10-07');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.fill('[name="total_units"]', '1.0');
      await page.fill('[name="confidence"]', '5');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('text=Player Props');
      await page.click('text=Pre-Game');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('button:has-text("Create Manual Prop")');
      await page.fill('input[placeholder*="player" i]', 'Patrick Mahomes');
      await page.selectOption('select:near(:text("Market"))', 'Passing Yards');
      await page.fill('input[name="line"]', '275.5');
      await page.fill('input[name="odds"]', '-110');
      await page.click('text=Over');
    }
  },
  {
    name: 'Parlay (2-leg)',
    type: 'parlay',
    setup: async (page) => {
      await page.selectOption('[name="ticket_type"]', 'parlay');
      await page.selectOption('[name="sport"]', 'NFL');
      await page.fill('[name="game_date"]', '2025-10-07');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.fill('[name="total_units"]', '2.0');
      await page.fill('[name="confidence"]', '6');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('text=Player Props');
      await page.click('text=Pre-Game');
      await page.click('button:has-text("Next")');
      await delay(1000);

      // Leg 1: Travis Kelce receiving yards
      await page.click('button:has-text("Create Manual Prop")');
      await page.fill('input[placeholder*="player" i]', 'Travis Kelce');
      await page.selectOption('select:near(:text("Market"))', 'Receiving Yards');
      await page.fill('input[name="line"]', '65.5');
      await page.fill('input[name="odds"]', '-115');
      await page.click('text=Over');
      await page.click('button:has-text("Add to Parlay")');
      await delay(1000);

      // Leg 2: Tyreek Hill receiving yards
      await page.click('button:has-text("Add Another Leg")');
      await page.fill('input[placeholder*="player" i]', 'Tyreek Hill');
      await page.selectOption('select:near(:text("Market"))', 'Receiving Yards');
      await page.fill('input[name="line"]', '75.5');
      await page.fill('input[name="odds"]', '-110');
      await page.click('text=Over');
    }
  },
  {
    name: 'Moneyline',
    type: 'single',
    setup: async (page) => {
      await page.selectOption('[name="ticket_type"]', 'single');
      await page.selectOption('[name="sport"]', 'NFL');
      await page.fill('[name="game_date"]', '2025-10-07');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.fill('[name="total_units"]', '1.5');
      await page.fill('[name="confidence"]', '7');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('text=Game Lines');
      await page.click('text=Moneyline');
      await page.click('button:has-text("Next")');
      await delay(1000);

      // Select a game and team
      await page.click('[data-testid="game-card-0"]'); // First available game
      await page.click('text=Home'); // Pick home team
      await page.fill('input[name="odds"]', '-150');
    }
  },
  {
    name: 'Team Total',
    type: 'single',
    setup: async (page) => {
      await page.selectOption('[name="ticket_type"]', 'single');
      await page.selectOption('[name="sport"]', 'NFL');
      await page.fill('[name="game_date"]', '2025-10-07');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.fill('[name="total_units"]', '1.0');
      await page.fill('[name="confidence"]', '6');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('text=Game Lines');
      await page.click('text=Team Total');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('[data-testid="game-card-0"]');
      await page.click('text=Home');
      await page.fill('input[name="line"]', '24.5');
      await page.fill('input[name="odds"]', '-110');
      await page.click('text=Over');
    }
  },
  {
    name: 'Teaser (6-point)',
    type: 'round_robin',
    setup: async (page) => {
      await page.selectOption('[name="ticket_type"]', 'round_robin');
      await page.selectOption('[name="teaser_points"]', '6');
      await page.selectOption('[name="sport"]', 'NFL');
      await page.fill('[name="game_date"]', '2025-10-07');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.fill('[name="total_units"]', '2.0');
      await page.fill('[name="confidence"]', '7');
      await page.click('button:has-text("Next")');
      await delay(1000);

      await page.click('text=Game Lines');
      await page.click('text=Spread');
      await page.click('button:has-text("Next")');
      await delay(1000);

      // Leg 1
      await page.click('[data-testid="game-card-0"]');
      await page.click('text=Home');
      await page.fill('input[name="line"]', '-3.5');
      await page.fill('input[name="odds"]', '-110');
      await page.click('button:has-text("Add to Teaser")');
      await delay(1000);

      // Leg 2
      await page.click('button:has-text("Add Another Leg")');
      await page.click('[data-testid="game-card-1"]');
      await page.click('text=Away');
      await page.fill('input[name="line"]', '+7.5');
      await page.fill('input[name="odds"]', '-110');
    }
  }
];

async function submitBetTest(
  page: Page,
  capperId: string,
  test: BetTest,
  testNumber: number
): Promise<string | null> {
  console.log(`\\n🎯 Test ${testNumber}: ${test.name}`);

  try {
    // Navigate to Smart Form
    await page.goto('http://localhost:3021/submit-ticket', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `.playwright-mcp/test${testNumber}-step0-loaded.png` });

    // Step 1: Essentials (capper)
    try {
      await page.fill('[name="capper"]', capperId, { timeout: 5000 });
    } catch {
      await page.selectOption('[name="capper"]', capperId);
    }

    // Execute test-specific setup
    await test.setup(page);

    await page.screenshot({ path: `.playwright-mcp/test${testNumber}-before-submit.png` });

    // Submit
    console.log('🚀 Submitting bet...');
    await page.click('button:has-text("Submit")');

    // Wait for success
    await page.waitForSelector('text=/submitted successfully/i', { timeout: 10000 });

    // Extract bet_slip_id
    const successText = await page.textContent('body');
    const betSlipIdMatch = successText?.match(/bet[_-]?slip[_-]?id[:\\s]+([a-f0-9-]+)/i);
    const betSlipId = betSlipIdMatch ? betSlipIdMatch[1] : null;

    await page.screenshot({ path: `.playwright-mcp/test${testNumber}-success.png` });

    console.log(`✅ ${test.name} submitted successfully!`);
    if (betSlipId) console.log(`   Bet Slip ID: ${betSlipId}`);

    return betSlipId;

  } catch (error) {
    console.error(`❌ Failed to submit ${test.name}:`, error);
    await page.screenshot({ path: `.playwright-mcp/test${testNumber}-error.png` });
    return null;
  }
}

async function verifyInCommandCenter(page: Page, betSlipIds: string[]): Promise<boolean> {
  console.log(`\\n🔍 Verifying ${betSlipIds.length} bets in Command Center...`);

  try {
    await page.goto('http://localhost:3015', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `.playwright-mcp/command-center-final.png` });

    let foundCount = 0;
    for (const betSlipId of betSlipIds) {
      const visible = await page.locator(`text=${betSlipId}`).count() > 0;
      if (visible) {
        console.log(`✅ Found: ${betSlipId}`);
        foundCount++;
      } else {
        console.log(`❌ Not found: ${betSlipId}`);
      }
    }

    console.log(`\\n📊 Command Center: ${foundCount}/${betSlipIds.length} bets visible`);
    return foundCount === betSlipIds.length;

  } catch (error) {
    console.error('❌ Command Center verification failed:', error);
    return false;
  }
}

async function verifyDiscordPosting(betSlipIds: string[]): Promise<number> {
  console.log(`\\n📬 Verifying Discord posting for ${betSlipIds.length} bets...`);

  let postedCount = 0;
  for (const betSlipId of betSlipIds) {
    const { data: pick, error } = await supabase
      .from('unified_picks')
      .select('posted_at, discord_message_id')
      .contains('metadata', { bet_slip_id: betSlipId })
      .single();

    if (!error && pick && pick.posted_at && pick.discord_message_id) {
      console.log(`✅ Posted to Discord: ${betSlipId} (Message ID: ${pick.discord_message_id})`);
      postedCount++;
    } else {
      console.log(`⏳ Not yet posted: ${betSlipId}`);
    }
  }

  console.log(`\\n📊 Discord: ${postedCount}/${betSlipIds.length} bets posted`);
  return postedCount;
}

async function runAllBetTypeTests() {
  console.log('🚀 Testing All Bet Types via Smart Form\\n');
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Get Griff843 user ID
    const capperId = await findGriff843UserId();
    if (!capperId) {
      throw new Error('Failed to find Griff843 user ID');
    }

    const submittedBets: Array<{ betSlipId: string | null; test: BetTest }> = [];

    // Submit all bet types
    console.log('\\n' + '='.repeat(80));
    console.log('SUBMITTING ALL BET TYPES');
    console.log('='.repeat(80));

    for (let i = 0; i < BET_TESTS.length; i++) {
      const betSlipId = await submitBetTest(page, capperId, BET_TESTS[i], i + 1);
      submittedBets.push({ betSlipId, test: BET_TESTS[i] });
      await delay(2000);
    }

    // Filter successful submissions
    const successfulBetSlipIds = submittedBets
      .filter(b => b.betSlipId)
      .map(b => b.betSlipId!);

    // Verify in Command Center
    console.log('\\n' + '='.repeat(80));
    console.log('VERIFYING IN COMMAND CENTER');
    console.log('='.repeat(80));

    const commandCenterSuccess = await verifyInCommandCenter(page, successfulBetSlipIds);

    // Verify Discord posting (wait a bit for processing)
    console.log('\\n⏳ Waiting 10 seconds for Discord posting...');
    await delay(10000);

    console.log('\\n' + '='.repeat(80));
    console.log('VERIFYING DISCORD POSTING');
    console.log('='.repeat(80));

    const discordCount = await verifyDiscordPosting(successfulBetSlipIds);

    // Final Summary
    console.log('\\n' + '='.repeat(80));
    console.log('TEST RESULTS');
    console.log('='.repeat(80));

    console.log(`\\n📋 Bet Types Tested:`);
    BET_TESTS.forEach((test, i) => {
      const submitted = submittedBets[i].betSlipId ? '✅' : '❌';
      console.log(`   ${submitted} ${test.name}`);
    });

    console.log(`\\n✅ Bets Submitted:        ${successfulBetSlipIds.length}/${BET_TESTS.length}`);
    console.log(`✅ Command Center Visible: ${commandCenterSuccess ? 'YES' : 'NO'}`);
    console.log(`✅ Discord Posted:         ${discordCount}/${successfulBetSlipIds.length}`);

    const allGreen = successfulBetSlipIds.length === BET_TESTS.length &&
                     commandCenterSuccess &&
                     discordCount === successfulBetSlipIds.length;

    if (allGreen) {
      console.log('\\n🎉 ALL GREEN - ALL BET TYPES WORKING!');
    } else {
      console.log('\\n⚠️ SOME TESTS INCOMPLETE - Check logs above');
    }

    await page.screenshot({ path: `.playwright-mcp/final-summary.png` });

  } catch (error) {
    console.error('\\n❌ TEST SUITE FAILED:', error);
    await page.screenshot({ path: `.playwright-mcp/test-suite-error.png` });
  } finally {
    await browser.close();
  }
}

runAllBetTypeTests().catch(console.error);
