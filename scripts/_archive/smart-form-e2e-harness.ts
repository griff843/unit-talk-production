#!/usr/bin/env npx tsx
/**
 * Smart Form E2E Harness - Real UI Submission Test
 *
 * This script performs a REAL end-to-end test of the Smart Form submission flow:
 * 1. Navigate to Smart Form UI
 * 2. Fill in all form fields through each step
 * 3. Capture network request payload (HAR/JSON)
 * 4. Submit form and wait for response
 * 5. Query unified_picks and validate mandatory fields
 * 6. Verify pick_publish record exists
 * 7. Generate evidence bundle with SMART_FORM_E2E_TRACE.md
 *
 * Usage:
 *   npx tsx scripts/smart-form-e2e-harness.ts
 *
 * Environment Variables:
 *   SMART_FORM_URL - URL of the smart form (default: http://localhost:3002)
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   E2E_HEADLESS - Run in headless mode (default: true)
 */

import { chromium, Browser, Page, BrowserContext, Request, Response } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  smartFormUrl: process.env.SMART_FORM_URL || 'http://localhost:3002',
  submitTicketPath: '/submit-ticket',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  headless: process.env.E2E_HEADLESS !== 'false',
  timeout: parseInt(process.env.E2E_TIMEOUT || '60000', 10),
  slowMo: parseInt(process.env.E2E_SLOW_MO || '100', 10),
};

// Test data for Smart Form submission
const TEST_DATA = {
  capper: 'Griff843', // Must match a real user in the database
  sport: 'NBA',
  ticketType: 'single',
  gameDate: new Date().toISOString().split('T')[0], // Today
  unitSize: 2.0,
  confidenceLevel: 7,
  betType: 'spread',
  marketType: 'pre_game',
  selection: {
    game_id: 'test-game-' + Date.now(),
    selection: 'over',
    odds: '-110',
    line: '225.5',
  },
};

// Evidence tracking
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  timestamp: string;
}

interface CapturedResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: string;
}

interface StepResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  screenshot?: string;
  evidence?: any;
}

interface E2EEvidence {
  timestamp: string;
  config: typeof CONFIG;
  testData: typeof TEST_DATA;
  capturedRequests: CapturedRequest[];
  capturedResponses: CapturedResponse[];
  steps: StepResult[];
  databaseRecords: {
    unified_picks?: any;
    pick_publish?: any;
    smart_tickets?: any;
  };
  verification: {
    form_source_present: boolean;
    unified_picks_created: boolean;
    pick_publish_created: boolean;
    mandatory_fields_present: boolean;
    bet_slip_id?: string;
    // GAP-002: trace_id verification
    trace_id?: string;
    trace_id_in_unified_picks: boolean;
    trace_id_in_pick_publish: boolean;
    // GAP-001: pick_publish lifecycle verification
    pick_publish_status_pending: boolean;
    pick_publish_status_sent: boolean;
    pick_publish_discord_channel_correct: boolean;
    pick_publish_external_message_id_present: boolean;
    // Discord verification
    discord_message_url?: string;
  };
  // Invariant compliance summary
  invariant_compliance: {
    I2_form_source: 'PASS' | 'FAIL';
    I3_outbox_lifecycle: 'PASS' | 'FAIL' | 'PENDING';
    I5_trace_id: 'PASS' | 'FAIL';
  };
}

const evidence: E2EEvidence = {
  timestamp: new Date().toISOString(),
  config: CONFIG,
  testData: TEST_DATA,
  capturedRequests: [],
  capturedResponses: [],
  steps: [],
  databaseRecords: {},
  verification: {
    form_source_present: false,
    unified_picks_created: false,
    pick_publish_created: false,
    mandatory_fields_present: false,
    // GAP-002: trace_id
    trace_id_in_unified_picks: false,
    trace_id_in_pick_publish: false,
    // GAP-001: pick_publish lifecycle
    pick_publish_status_pending: false,
    pick_publish_status_sent: false,
    pick_publish_discord_channel_correct: false,
    pick_publish_external_message_id_present: false,
  },
  invariant_compliance: {
    I2_form_source: 'FAIL',
    I3_outbox_lifecycle: 'PENDING',
    I5_trace_id: 'FAIL',
  },
};

// Output directory
const OUTPUT_DIR = path.join(
  process.cwd(),
  'out',
  'manual-pick-e2e',
  `${new Date().toISOString().split('T')[0]}_smartform_${Date.now()}`
);

// Initialize output directory
function initOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(path.join(OUTPUT_DIR, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'network'), { recursive: true });
}

// Run a test step with error handling
async function runStep(
  name: string,
  fn: () => Promise<any>,
  page?: Page
): Promise<{ success: boolean; result?: any }> {
  const start = Date.now();
  console.log(`\n[STEP] ${name}...`);

  try {
    const result = await fn();
    evidence.steps.push({
      step: name,
      status: 'PASS',
      duration: Date.now() - start,
      evidence: result,
    });
    console.log(`[PASS] ${name} (${Date.now() - start}ms)`);
    return { success: true, result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    let screenshotPath: string | undefined;

    if (page) {
      try {
        const screenshotName = `failure-${name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.png`;
        screenshotPath = path.join(OUTPUT_DIR, 'screenshots', screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        // Screenshot failed, continue
      }
    }

    evidence.steps.push({
      step: name,
      status: 'FAIL',
      duration: Date.now() - start,
      error: errorMsg,
      screenshot: screenshotPath,
    });
    console.error(`[FAIL] ${name}: ${errorMsg}`);
    return { success: false };
  }
}

// Initialize Supabase client
function initSupabase(): SupabaseClient | null {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    console.warn('Supabase credentials not configured - database verification will be skipped');
    return null;
  }
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
}

// Setup network interception
function setupNetworkCapture(context: BrowserContext) {
  context.on('request', (request: Request) => {
    if (request.url().includes('/api/submit-ticket')) {
      const capturedRequest: CapturedRequest = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        payload: null,
        timestamp: new Date().toISOString(),
      };

      try {
        const postData = request.postData();
        if (postData) {
          capturedRequest.payload = JSON.parse(postData);
        }
      } catch {
        capturedRequest.payload = request.postData();
      }

      evidence.capturedRequests.push(capturedRequest);
      console.log(`[NETWORK] Captured request to ${request.url()}`);
    }
  });

  context.on('response', async (response: Response) => {
    if (response.url().includes('/api/submit-ticket')) {
      const capturedResponse: CapturedResponse = {
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        body: null,
        timestamp: new Date().toISOString(),
      };

      try {
        capturedResponse.body = await response.json();
      } catch {
        try {
          capturedResponse.body = await response.text();
        } catch {
          capturedResponse.body = null;
        }
      }

      evidence.capturedResponses.push(capturedResponse);
      console.log(`[NETWORK] Captured response: ${response.status()}`);
    }
  });
}

// Navigate through Smart Form steps
async function navigateSmartForm(page: Page): Promise<string | null> {
  // Step 1: Navigate to form
  await page.goto(`${CONFIG.smartFormUrl}${CONFIG.submitTicketPath}`, {
    waitUntil: 'networkidle',
    timeout: CONFIG.timeout,
  });

  // Wait for form to load
  await page.waitForSelector('text=Ticket Essentials', { timeout: CONFIG.timeout });

  // Take initial screenshot
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'screenshots', 'step1-initial.png'),
    fullPage: true,
  });

  // STEP 1: Essentials
  console.log('[FORM] Filling Step 1: Essentials');

  // Select Capper
  const capperSelector = await page.waitForSelector('[role="combobox"]', { timeout: CONFIG.timeout });
  if (capperSelector) {
    await capperSelector.click();
    await page.waitForTimeout(500);
    // Try to find and click the capper option
    const capperOption = await page.$(`text=${TEST_DATA.capper}`);
    if (capperOption) {
      await capperOption.click();
    } else {
      // Try selecting first available option
      const firstOption = await page.$('[role="option"]');
      if (firstOption) {
        await firstOption.click();
      }
    }
  }

  // Select Ticket Type
  await page.waitForTimeout(300);
  const ticketTypeButton = await page.$(`button:has-text("${TEST_DATA.ticketType}")`);
  if (ticketTypeButton) {
    await ticketTypeButton.click();
  } else {
    // Try finding by text content
    const singleButton = await page.$('text=single');
    if (singleButton) await singleButton.click();
  }

  // Select Sport
  await page.waitForTimeout(300);
  const sportButton = await page.$(`button:has-text("${TEST_DATA.sport}")`);
  if (sportButton) {
    await sportButton.click();
  } else {
    const nbaButton = await page.$('text=NBA');
    if (nbaButton) await nbaButton.click();
  }

  // Date should be pre-filled to today
  await page.waitForTimeout(300);

  // Take screenshot after Step 1
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'screenshots', 'step1-filled.png'),
    fullPage: true,
  });

  // Click Next
  const nextButton1 = await page.$('button:has-text("Continue")');
  if (nextButton1) {
    await nextButton1.click();
    await page.waitForTimeout(500);
  }

  // STEP 2: Configuration
  console.log('[FORM] Filling Step 2: Configuration');
  await page.waitForSelector('text=Betting Configuration', { timeout: 10000 }).catch(() => {
    console.log('[FORM] Step 2 header not found, continuing...');
  });

  // Unit Size input
  const unitInput = await page.$('input[type="number"]');
  if (unitInput) {
    await unitInput.fill(String(TEST_DATA.unitSize));
  }

  // Confidence Level (slider or input)
  const confidenceInput = await page.$('input[name="confidence"]');
  if (confidenceInput) {
    await confidenceInput.fill(String(TEST_DATA.confidenceLevel));
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'screenshots', 'step2-filled.png'),
    fullPage: true,
  });

  // Click Next
  const nextButton2 = await page.$('button:has-text("Continue")');
  if (nextButton2) {
    await nextButton2.click();
    await page.waitForTimeout(500);
  }

  // STEP 3: Bet Details
  console.log('[FORM] Filling Step 3: Bet Details');
  await page.waitForSelector('text=Bet Type', { timeout: 10000 }).catch(() => {
    console.log('[FORM] Step 3 header not found, continuing...');
  });

  // Select bet type
  const betTypeButton = await page.$(`button:has-text("${TEST_DATA.betType}")`);
  if (betTypeButton) {
    await betTypeButton.click();
  }

  // Select market type
  const marketTypeButton = await page.$(`button:has-text("pre_game"), button:has-text("Pre-Game")`);
  if (marketTypeButton) {
    await marketTypeButton.click();
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'screenshots', 'step3-filled.png'),
    fullPage: true,
  });

  // Click Next
  const nextButton3 = await page.$('button:has-text("Continue")');
  if (nextButton3) {
    await nextButton3.click();
    await page.waitForTimeout(500);
  }

  // STEP 4: Game Selection
  console.log('[FORM] Filling Step 4: Game Selection');
  await page.waitForSelector('text=Game', { timeout: 10000 }).catch(() => {
    console.log('[FORM] Step 4 header not found, continuing...');
  });

  // Select a game if available
  const gameCard = await page.$('[data-testid="game-card"], .game-card, [class*="game"]');
  if (gameCard) {
    await gameCard.click();
    await page.waitForTimeout(300);
  }

  // Fill odds
  const oddsInput = await page.$('input[name="odds"], input[placeholder*="odds"]');
  if (oddsInput) {
    await oddsInput.fill(TEST_DATA.selection.odds);
  }

  // Fill line
  const lineInput = await page.$('input[name="line"], input[placeholder*="line"]');
  if (lineInput) {
    await lineInput.fill(TEST_DATA.selection.line);
  }

  // Select over/under
  const overButton = await page.$('button:has-text("Over"), button:has-text("over")');
  if (overButton) {
    await overButton.click();
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'screenshots', 'step4-filled.png'),
    fullPage: true,
  });

  // Submit the form
  console.log('[FORM] Submitting form...');
  const submitButton = await page.$('button:has-text("Submit"), button[type="submit"]');
  if (submitButton) {
    // Wait for response after clicking submit
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/submit-ticket'),
      { timeout: CONFIG.timeout }
    );

    await submitButton.click();

    try {
      const response = await responsePromise;
      const responseBody = await response.json().catch(() => null);

      if (response.status() === 201 && responseBody?.bet_slip_id) {
        console.log(`[SUCCESS] Form submitted! bet_slip_id: ${responseBody.bet_slip_id}`);
        evidence.verification.bet_slip_id = responseBody.bet_slip_id;

        // GAP-002: Capture trace_id from response
        if (responseBody.trace_id) {
          evidence.verification.trace_id = responseBody.trace_id;
          console.log(`[SUCCESS] trace_id captured: ${responseBody.trace_id}`);
        } else {
          console.error('[FAIL] GAP-002: trace_id MISSING from response!');
        }

        return responseBody.bet_slip_id;
      } else {
        console.log(`[WARN] Unexpected response: ${response.status()}`);
        console.log(JSON.stringify(responseBody, null, 2));
      }
    } catch (error) {
      console.error('[ERROR] Failed to capture response:', error);
    }
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'screenshots', 'final-state.png'),
    fullPage: true,
  });

  return null;
}

// Expected Discord channel ID for CANARY
const CANARY_CHANNEL_ID = '1296531122234327100';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1234567890123456789';

// Verify database records with GAP-001 and GAP-002 assertions
async function verifyDatabaseRecords(supabase: SupabaseClient, betSlipId: string) {
  console.log(`\n[DB] Verifying database records for bet_slip_id: ${betSlipId}`);

  // Query unified_picks
  const { data: picks, error: picksError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('bet_slip_id', betSlipId);

  if (picksError) {
    throw new Error(`Failed to query unified_picks: ${picksError.message}`);
  }

  if (!picks || picks.length === 0) {
    throw new Error(`No picks found in unified_picks for bet_slip_id: ${betSlipId}`);
  }

  evidence.databaseRecords.unified_picks = picks;
  evidence.verification.unified_picks_created = true;

  // Verify form_source (I2: Smart Form Origin Proof)
  const hasFormSource = picks.every(p => p.form_source === 'smart_form');
  evidence.verification.form_source_present = hasFormSource;
  evidence.invariant_compliance.I2_form_source = hasFormSource ? 'PASS' : 'FAIL';

  if (!hasFormSource) {
    throw new Error('form_source is not "smart_form" in unified_picks');
  }

  // GAP-002: Verify trace_id in unified_picks
  const hasTraceId = picks.every(p => p.trace_id);
  evidence.verification.trace_id_in_unified_picks = hasTraceId;

  if (hasTraceId) {
    console.log(`[DB] GAP-002 PASS: trace_id found in unified_picks: ${picks[0].trace_id}`);
    // Verify trace_id matches response
    if (evidence.verification.trace_id && picks[0].trace_id !== evidence.verification.trace_id) {
      console.warn(`[DB] trace_id mismatch! Response: ${evidence.verification.trace_id}, DB: ${picks[0].trace_id}`);
    }
  } else {
    console.error('[DB] GAP-002 FAIL: trace_id MISSING in unified_picks');
  }

  // Verify mandatory fields
  const mandatoryFields = ['bet_slip_id', 'user_id', 'sport', 'form_source', 'status', 'workflow_stage', 'selection', 'odds'];
  const missingFields = mandatoryFields.filter(field => picks[0][field] === undefined || picks[0][field] === null);

  if (missingFields.length > 0) {
    console.warn(`[DB] Missing fields in unified_picks: ${missingFields.join(', ')}`);
  }
  evidence.verification.mandatory_fields_present = missingFields.length === 0;

  console.log(`[DB] unified_picks: ${picks.length} record(s) found`);
  console.log(`[DB] form_source: ${picks[0].form_source}`);
  console.log(`[DB] workflow_stage: ${picks[0].workflow_stage}`);
  console.log(`[DB] trace_id: ${picks[0].trace_id || 'MISSING'}`);

  // Query pick_publish
  const pickIds = picks.map(p => p.id);
  const { data: publishRecords, error: publishError } = await supabase
    .from('pick_publish')
    .select('*')
    .in('pick_id', pickIds);

  if (publishError) {
    console.warn(`[DB] pick_publish query failed: ${publishError.message}`);
    evidence.invariant_compliance.I3_outbox_lifecycle = 'FAIL';
  } else if (publishRecords && publishRecords.length > 0) {
    evidence.databaseRecords.pick_publish = publishRecords;
    evidence.verification.pick_publish_created = true;

    const pubRecord = publishRecords[0];
    console.log(`[DB] pick_publish: ${publishRecords.length} record(s) found`);
    console.log(`[DB] pick_publish.id: ${pubRecord.id}`);
    console.log(`[DB] pick_publish.status: ${pubRecord.status}`);
    console.log(`[DB] pick_publish.discord_channel_id: ${pubRecord.discord_channel_id}`);
    console.log(`[DB] pick_publish.external_message_id: ${pubRecord.external_message_id || 'PENDING'}`);

    // GAP-001: Verify pick_publish status lifecycle
    const statusValid = ['pending', 'processing', 'sent', 'failed'].includes(pubRecord.status);
    evidence.verification.pick_publish_status_pending = pubRecord.status === 'pending' || pubRecord.status === 'processing';
    evidence.verification.pick_publish_status_sent = pubRecord.status === 'sent';

    // Verify Discord channel ID matches CANARY
    const channelCorrect = pubRecord.discord_channel_id === CANARY_CHANNEL_ID;
    evidence.verification.pick_publish_discord_channel_correct = channelCorrect;
    if (channelCorrect) {
      console.log(`[DB] GAP-001 PASS: discord_channel_id matches CANARY (${CANARY_CHANNEL_ID})`);
    } else {
      console.warn(`[DB] GAP-001: discord_channel_id is ${pubRecord.discord_channel_id}, expected ${CANARY_CHANNEL_ID}`);
    }

    // Verify external_message_id (only if status is 'sent')
    if (pubRecord.status === 'sent') {
      evidence.verification.pick_publish_external_message_id_present = !!pubRecord.external_message_id;
      if (pubRecord.external_message_id) {
        console.log(`[DB] GAP-001 PASS: external_message_id present: ${pubRecord.external_message_id}`);
        // Generate Discord message URL
        const channelId = pubRecord.discord_channel_id || CANARY_CHANNEL_ID;
        evidence.verification.discord_message_url =
          `https://discord.com/channels/${DISCORD_GUILD_ID}/${channelId}/${pubRecord.external_message_id}`;
        console.log(`[DB] Discord URL: ${evidence.verification.discord_message_url}`);
      } else {
        console.error('[DB] GAP-001 FAIL: status=sent but external_message_id MISSING');
      }
      evidence.invariant_compliance.I3_outbox_lifecycle = 'PASS';
    } else if (pubRecord.status === 'pending' || pubRecord.status === 'processing') {
      console.log(`[DB] GAP-001: pick_publish status is '${pubRecord.status}' - waiting for DiscordPromotionAgent`);
      evidence.invariant_compliance.I3_outbox_lifecycle = 'PENDING';
    } else if (pubRecord.status === 'failed') {
      console.error(`[DB] GAP-001 FAIL: pick_publish status is 'failed'. Error: ${pubRecord.error}`);
      evidence.invariant_compliance.I3_outbox_lifecycle = 'FAIL';
    }

    // GAP-002: Verify trace_id in pick_publish metadata
    const metadataTraceId = pubRecord.metadata?.trace_id;
    evidence.verification.trace_id_in_pick_publish = !!metadataTraceId;
    if (metadataTraceId) {
      console.log(`[DB] GAP-002 PASS: trace_id found in pick_publish.metadata: ${metadataTraceId}`);
    } else {
      console.error('[DB] GAP-002 FAIL: trace_id MISSING in pick_publish.metadata');
    }

  } else {
    console.error('[DB] GAP-001 FAIL: No pick_publish records found!');
    evidence.invariant_compliance.I3_outbox_lifecycle = 'FAIL';
  }

  // Update I5 trace_id compliance
  evidence.invariant_compliance.I5_trace_id =
    evidence.verification.trace_id_in_unified_picks && evidence.verification.trace_id_in_pick_publish
      ? 'PASS' : 'FAIL';

  // Query smart_tickets
  const { data: tickets, error: ticketsError } = await supabase
    .from('smart_tickets')
    .select('*')
    .eq('bet_slip_id', betSlipId);

  if (!ticketsError && tickets && tickets.length > 0) {
    evidence.databaseRecords.smart_tickets = tickets;
    console.log(`[DB] smart_tickets: ${tickets.length} record(s) found`);
  }

  return picks;
}

// Generate SMART_FORM_E2E_TRACE.md
function generateTraceDoc() {
  const doc = `# Smart Form E2E Trace

**Generated**: ${evidence.timestamp}
**bet_slip_id**: ${evidence.verification.bet_slip_id || 'N/A'}
**trace_id**: ${evidence.verification.trace_id || 'N/A'}

---

## Invariant Compliance Summary (I2/I3/I5)

| Invariant | Description | Status |
|-----------|-------------|--------|
| **I2** | Smart Form Origin Proof (form_source='smart_form') | ${evidence.invariant_compliance.I2_form_source === 'PASS' ? '✅ PASS' : '❌ FAIL'} |
| **I3** | Outbox Lifecycle (pick_publish status transitions) | ${evidence.invariant_compliance.I3_outbox_lifecycle === 'PASS' ? '✅ PASS' : evidence.invariant_compliance.I3_outbox_lifecycle === 'PENDING' ? '⏳ PENDING' : '❌ FAIL'} |
| **I5** | Observability (trace_id propagation) | ${evidence.invariant_compliance.I5_trace_id === 'PASS' ? '✅ PASS' : '❌ FAIL'} |

---

## Test Configuration

| Setting | Value |
|---------|-------|
| Smart Form URL | ${CONFIG.smartFormUrl} |
| Supabase Configured | ${!!CONFIG.supabaseKey} |
| Headless Mode | ${CONFIG.headless} |
| CANARY Channel ID | ${CANARY_CHANNEL_ID} |

## Test Data Used

| Field | Value |
|-------|-------|
| Capper | ${TEST_DATA.capper} |
| Sport | ${TEST_DATA.sport} |
| Ticket Type | ${TEST_DATA.ticketType} |
| Unit Size | ${TEST_DATA.unitSize} |
| Confidence | ${TEST_DATA.confidenceLevel} |
| Bet Type | ${TEST_DATA.betType} |
| Market Type | ${TEST_DATA.marketType} |

---

## GAP-001: pick_publish Outbox Lifecycle

| Check | Result |
|-------|--------|
| pick_publish created | ${evidence.verification.pick_publish_created ? '✅ PASS' : '❌ FAIL'} |
| pick_publish.status (pending/processing) | ${evidence.verification.pick_publish_status_pending ? '✅ PASS' : '❌ FAIL'} |
| pick_publish.status = 'sent' | ${evidence.verification.pick_publish_status_sent ? '✅ PASS' : '⏳ PENDING'} |
| discord_channel_id = CANARY | ${evidence.verification.pick_publish_discord_channel_correct ? '✅ PASS' : '❌ FAIL'} |
| external_message_id present | ${evidence.verification.pick_publish_external_message_id_present ? '✅ PASS' : '⏳ PENDING'} |

${evidence.verification.discord_message_url ? `**Discord Message URL**: ${evidence.verification.discord_message_url}` : '**Discord Message URL**: Pending (run DiscordPromotionAgent)'}

---

## GAP-002: trace_id Propagation

| Check | Result |
|-------|--------|
| trace_id in API response | ${evidence.verification.trace_id ? '✅ PASS' : '❌ FAIL'} |
| trace_id in unified_picks | ${evidence.verification.trace_id_in_unified_picks ? '✅ PASS' : '❌ FAIL'} |
| trace_id in pick_publish.metadata | ${evidence.verification.trace_id_in_pick_publish ? '✅ PASS' : '❌ FAIL'} |

---

## Core Verification Results

| Check | Result |
|-------|--------|
| unified_picks created | ${evidence.verification.unified_picks_created ? '✅ PASS' : '❌ FAIL'} |
| form_source = 'smart_form' | ${evidence.verification.form_source_present ? '✅ PASS' : '❌ FAIL'} |
| pick_publish created | ${evidence.verification.pick_publish_created ? '✅ PASS' : '❌ FAIL'} |
| Mandatory fields present | ${evidence.verification.mandatory_fields_present ? '✅ PASS' : '❌ FAIL'} |

---

## Step Results

${evidence.steps.map(step => `
### ${step.step}
- **Status**: ${step.status}
- **Duration**: ${step.duration}ms
${step.error ? `- **Error**: ${step.error}` : ''}
${step.screenshot ? `- **Screenshot**: ${step.screenshot}` : ''}
`).join('\n')}

---

## Network Requests Captured

${evidence.capturedRequests.length > 0 ? evidence.capturedRequests.map((req, i) => `
### Request ${i + 1}
- **URL**: ${req.url}
- **Method**: ${req.method}
- **Timestamp**: ${req.timestamp}
- **Payload**:
\`\`\`json
${JSON.stringify(req.payload, null, 2)}
\`\`\`
`).join('\n') : 'No requests captured'}

---

## Network Responses Captured

${evidence.capturedResponses.length > 0 ? evidence.capturedResponses.map((res, i) => `
### Response ${i + 1}
- **URL**: ${res.url}
- **Status**: ${res.status}
- **Timestamp**: ${res.timestamp}
- **Body**:
\`\`\`json
${JSON.stringify(res.body, null, 2)}
\`\`\`
`).join('\n') : 'No responses captured'}

---

## Database Records

### unified_picks
\`\`\`json
${JSON.stringify(evidence.databaseRecords.unified_picks, null, 2)}
\`\`\`

### pick_publish
\`\`\`json
${JSON.stringify(evidence.databaseRecords.pick_publish, null, 2)}
\`\`\`

### smart_tickets
\`\`\`json
${JSON.stringify(evidence.databaseRecords.smart_tickets, null, 2)}
\`\`\`

---

## Evidence Bundle Location

All evidence files are stored at:
\`${OUTPUT_DIR}\`

Files included:
- \`SMART_FORM_E2E_TRACE.md\` - This document
- \`evidence.json\` - Complete JSON evidence bundle
- \`screenshots/\` - Step-by-step screenshots
- \`network/\` - Network request/response captures

---

*Generated by Smart Form E2E Harness*
`;

  return doc;
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('Smart Form E2E Harness - Real UI Submission Test');
  console.log('='.repeat(60));
  console.log(`Smart Form URL: ${CONFIG.smartFormUrl}${CONFIG.submitTicketPath}`);
  console.log(`Supabase Configured: ${!!CONFIG.supabaseKey}`);
  console.log(`Headless: ${CONFIG.headless}`);
  console.log(`Output Directory: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Initialize
  initOutputDir();
  const supabase = initSupabase();

  let browser: Browser | null = null;
  let betSlipId: string | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo,
    });

    const context = await browser.newContext({
      recordHar: { path: path.join(OUTPUT_DIR, 'network', 'trace.har') },
      recordVideo: { dir: path.join(OUTPUT_DIR, 'screenshots') },
    });

    // Setup network capture
    setupNetworkCapture(context);

    const page = await context.newPage();

    // Run form navigation
    const navResult = await runStep(
      'Navigate and Submit Smart Form',
      async () => {
        betSlipId = await navigateSmartForm(page);
        return { bet_slip_id: betSlipId };
      },
      page
    );

    if (navResult.success && betSlipId && supabase) {
      // Verify database records
      await runStep('Verify unified_picks', async () => {
        return verifyDatabaseRecords(supabase, betSlipId!);
      });

      await runStep('Verify pick_publish', async () => {
        if (!evidence.verification.pick_publish_created) {
          console.warn('[WARN] pick_publish not created - Discord publishing pending');
        }
        return evidence.databaseRecords.pick_publish;
      });
    }

    // Close browser
    await context.close();

  } catch (error) {
    console.error('Fatal error:', error);
    evidence.steps.push({
      step: 'Fatal Error',
      status: 'FAIL',
      duration: 0,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Save evidence
  console.log('\n[OUTPUT] Saving evidence bundle...');

  // Save network captures
  if (evidence.capturedRequests.length > 0) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'network', 'request.json'),
      JSON.stringify(evidence.capturedRequests, null, 2)
    );
  }

  if (evidence.capturedResponses.length > 0) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'network', 'response.json'),
      JSON.stringify(evidence.capturedResponses, null, 2)
    );
  }

  // Save full evidence bundle
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'evidence.json'),
    JSON.stringify(evidence, null, 2)
  );

  // Generate and save trace document
  const traceDoc = generateTraceDoc();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'SMART_FORM_E2E_TRACE.md'), traceDoc);

  // Also save to docs directory
  const docsTraceDir = path.join(process.cwd(), 'docs');
  if (fs.existsSync(docsTraceDir)) {
    fs.writeFileSync(path.join(docsTraceDir, 'SMART_FORM_E2E_TRACE.md'), traceDoc);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const passCount = evidence.steps.filter(s => s.status === 'PASS').length;
  const failCount = evidence.steps.filter(s => s.status === 'FAIL').length;

  console.log(`Total Steps: ${evidence.steps.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`bet_slip_id: ${evidence.verification.bet_slip_id || 'N/A'}`);
  console.log(`trace_id: ${evidence.verification.trace_id || 'N/A'}`);

  console.log(`\n--- Invariant Compliance ---`);
  console.log(`  I2 (form_source): ${evidence.invariant_compliance.I2_form_source}`);
  console.log(`  I3 (outbox lifecycle): ${evidence.invariant_compliance.I3_outbox_lifecycle}`);
  console.log(`  I5 (trace_id): ${evidence.invariant_compliance.I5_trace_id}`);

  console.log(`\n--- GAP-001: pick_publish Outbox ---`);
  console.log(`  pick_publish created: ${evidence.verification.pick_publish_created}`);
  console.log(`  discord_channel_id correct: ${evidence.verification.pick_publish_discord_channel_correct}`);
  console.log(`  external_message_id present: ${evidence.verification.pick_publish_external_message_id_present}`);
  if (evidence.verification.discord_message_url) {
    console.log(`  Discord URL: ${evidence.verification.discord_message_url}`);
  }

  console.log(`\n--- GAP-002: trace_id ---`);
  console.log(`  trace_id in response: ${!!evidence.verification.trace_id}`);
  console.log(`  trace_id in unified_picks: ${evidence.verification.trace_id_in_unified_picks}`);
  console.log(`  trace_id in pick_publish: ${evidence.verification.trace_id_in_pick_publish}`);

  console.log(`\n--- Core Verification ---`);
  console.log(`  unified_picks created: ${evidence.verification.unified_picks_created}`);
  console.log(`  form_source present: ${evidence.verification.form_source_present}`);
  console.log(`  mandatory fields: ${evidence.verification.mandatory_fields_present}`);
  console.log(`\nEvidence saved to: ${OUTPUT_DIR}`);

  // Determine overall status
  const gapFailures = [
    !evidence.verification.trace_id, // trace_id missing from response
    !evidence.verification.pick_publish_created, // pick_publish not created
    evidence.invariant_compliance.I2_form_source === 'FAIL',
    evidence.invariant_compliance.I5_trace_id === 'FAIL',
    // I3 'PENDING' is acceptable - DiscordPromotionAgent hasn't run yet
  ].filter(Boolean).length;

  // Exit with appropriate code
  if (failCount === 0 && passCount > 0 && evidence.verification.unified_picks_created && gapFailures === 0) {
    console.log('\nStatus: PASS');
    process.exit(0);
  } else {
    console.log('\nStatus: FAIL');
    if (gapFailures > 0) {
      console.log(`GAP verification failures: ${gapFailures}`);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
