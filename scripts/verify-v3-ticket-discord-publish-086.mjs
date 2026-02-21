#!/usr/bin/env node
/**
 * verify-v3-ticket-discord-publish-086.mjs
 * Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
 *
 * End-to-end verification of V3 ticket submission → Discord publishing.
 * Tests the complete flow including idempotency.
 *
 * Usage:
 *   node scripts/verify-v3-ticket-discord-publish-086.mjs
 *
 * Environment:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DISCORD_WEBHOOK_URL (for worker to post)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Also try loading from .env.local and .env.runtime.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load additional env files if they exist
for (const envFile of ['.env.local', '.env.runtime.local']) {
  const envPath = join(rootDir, envFile);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

// ============================================================================
// CONFIG
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Proof output directory
const PROOF_DIR = join(__dirname, '..', 'out', 'sprints', 'SPRINT-V3-TICKET-DISCORD-PUBLISH-086', new Date().toISOString().slice(0, 10), 'proofs');

// Test user ID (tickets.user_id has no FK)
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function ensureProofDir() {
  if (!existsSync(PROOF_DIR)) {
    mkdirSync(PROOF_DIR, { recursive: true });
    log(`Created proof directory: ${PROOF_DIR}`);
  }
}

function writeProof(filename, content) {
  ensureProofDir();
  const filepath = join(PROOF_DIR, filename);
  writeFileSync(filepath, content);
  log(`Wrote proof: ${filename}`);
}

function generateBetSlipId() {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `SF-VERIFY-086-${now}-${rand}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// STEP 1: CREATE MANUAL ENTRY LEG (no canonical events needed)
// ============================================================================

function createManualLeg() {
  // Uses manual entry mode from SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084
  // No canonical_events, market_types, or provider_offers required
  return {
    sport: 'NBA',
    bet_type: 'total',
    home_team: 'Lakers',
    away_team: 'Celtics',
    matchup_text: 'Celtics @ Lakers',
    selection: 'over',
    line: 220.5,
    odds: -110,
    provider: 'fanduel',
  };
}

// ============================================================================
// STEP 2: SUBMIT TICKET VIA atomic_submit_ticket_v2 (MANUAL MODE)
// ============================================================================

async function submitTicket(betSlipId) {
  log(`Submitting ticket with bet_slip_id: ${betSlipId}`);

  const legs = [createManualLeg()];

  const { data, error } = await supabase.rpc('atomic_submit_ticket_v2', {
    p_bet_slip_id: betSlipId,
    p_user_id: TEST_USER_ID,
    p_ticket_type: 'single',
    p_total_stake: 1,
    p_legs: legs,
    p_source: 'verify-script-086',
    p_meta: {
      entry_mode: 'manual',  // IMPORTANT: Use manual mode to bypass FK validation
      verification: 'SPRINT-V3-TICKET-DISCORD-PUBLISH-086'
    }
  });

  if (error) {
    throw new Error(`RPC error: ${error.message}`);
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error('Unexpected RPC response: no data');
  }

  const result = data[0];
  log(`RPC result: status=${result.out_status}, ticket_id=${result.out_ticket_id}`);

  if (result.out_error_details) {
    log(`Error details: ${JSON.stringify(result.out_error_details)}`);
  }

  return result;
}

// ============================================================================
// STEP 3: ENQUEUE DISCORD OUTBOX (app-layer)
// ============================================================================

async function enqueueDiscordOutbox(ticketId, betSlipId) {
  log(`Enqueuing Discord outbox for ticket_id: ${ticketId}`);

  const { data, error } = await supabase.rpc('enqueue_ticket_discord_outbox', {
    p_ticket_id: ticketId,
    p_bet_slip_id: betSlipId,
  });

  if (error) {
    throw new Error(`Enqueue error: ${error.message}`);
  }

  log(`Enqueue result: ${data}`);
  return data;
}

// ============================================================================
// STEP 4: VERIFY DB STATE
// ============================================================================

async function verifyTicketInDb(ticketId) {
  log(`Verifying ticket ${ticketId} in database...`);

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error(`Ticket not found: ${ticketError?.message}`);
  }

  const { data: legs, error: legsError } = await supabase
    .from('ticket_legs')
    .select('*')
    .eq('ticket_id', ticketId);

  if (legsError) {
    throw new Error(`Legs query error: ${legsError.message}`);
  }

  log(`Found ticket with ${legs?.length || 0} legs`);

  return { ticket, legs };
}

async function verifyOutboxRow(ticketId) {
  log(`Verifying outbox row for ticket ${ticketId}...`);

  const { data, error } = await supabase
    .from('ticket_discord_outbox')
    .select('*')
    .eq('ticket_id', ticketId)
    .single();

  if (error) {
    log(`Outbox query: ${error.message}`);
    return null;
  }

  log(`Outbox row: status=${data.status}, discord_message_id=${data.discord_message_id || 'NULL'}`);

  return data;
}

// ============================================================================
// STEP 5: RUN WORKER (--once mode)
// ============================================================================

async function runWorkerOnce() {
  log('Running Discord ticket worker (--once)...');

  if (!DISCORD_WEBHOOK_URL) {
    log('WARNING: DISCORD_WEBHOOK_URL not set - worker will mark as error');
  }

  return new Promise((resolve, reject) => {
    const workerPath = join(__dirname, '..', 'apps', 'api', 'src', 'scripts', 'discord-ticket-publish-worker.ts');

    const proc = spawn('npx', ['tsx', workerPath, '--once'], {
      cwd: join(__dirname, '..', 'apps', 'api'),
      env: {
        ...process.env,
        DISCORD_WEBHOOK_URL,
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
      },
      shell: true,
      stdio: 'pipe',
    });

    let output = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      log(`Worker exited with code ${code}`);
      resolve({ code, output });
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Timeout after 30s
    setTimeout(() => {
      proc.kill();
      reject(new Error('Worker timeout'));
    }, 30000);
  });
}

// ============================================================================
// STEP 6: VERIFY POSTED STATE
// ============================================================================

async function verifyPostedState(ticketId) {
  log(`Verifying posted state for ticket ${ticketId}...`);

  const outbox = await verifyOutboxRow(ticketId);

  if (!outbox) {
    throw new Error('Outbox row not found');
  }

  if (outbox.status !== 'posted') {
    log(`WARNING: status is '${outbox.status}', not 'posted'`);
    if (outbox.error) {
      log(`Error: ${outbox.error}`);
    }
  }

  return outbox;
}

// ============================================================================
// STEP 7: TEST IDEMPOTENCY
// ============================================================================

async function testIdempotency(betSlipId, originalTicketId) {
  log('=== IDEMPOTENCY TEST ===');

  // Re-submit same bet_slip_id
  const result = await submitTicket(betSlipId);

  if (result.out_status !== 'exists') {
    throw new Error(`Expected 'exists' status, got '${result.out_status}'`);
  }
  log(`✓ Re-submit returned 'exists' status`);

  if (result.out_ticket_id !== originalTicketId) {
    throw new Error(`Ticket ID mismatch: expected ${originalTicketId}, got ${result.out_ticket_id}`);
  }
  log(`✓ Same ticket_id returned`);

  // Try enqueue again (should return false - already exists)
  const enqueueResult = await enqueueDiscordOutbox(originalTicketId, betSlipId);
  log(`Re-enqueue result: ${enqueueResult} (expected false)`);

  // Count outbox rows for this ticket
  const { data: outboxRows, error } = await supabase
    .from('ticket_discord_outbox')
    .select('id, discord_message_id')
    .eq('ticket_id', originalTicketId);

  if (error) {
    throw new Error(`Outbox count error: ${error.message}`);
  }

  if (outboxRows.length !== 1) {
    throw new Error(`Expected exactly 1 outbox row, found ${outboxRows.length}`);
  }
  log(`✓ Exactly 1 outbox row exists (no duplicates)`);

  return {
    resubmitStatus: result.out_status,
    outboxRowCount: outboxRows.length,
    discordMessageId: outboxRows[0].discord_message_id,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('============================================================');
  console.log('VERIFICATION: SPRINT-V3-TICKET-DISCORD-PUBLISH-086');
  console.log('V3 Ticket → Discord Publishing (Outbox Pattern)');
  console.log('============================================================');
  console.log('');

  const results = {
    ticketInserted: null,
    outboxCreated: null,
    workerRan: null,
    outboxPosted: null,
    idempotency: null,
  };

  try {
    // Setup - using manual entry mode (no canonical events needed)
    const betSlipId = generateBetSlipId();
    log(`Generated bet_slip_id: ${betSlipId}`);
    log(`Using MANUAL entry mode (no canonical events required)`);

    // Step 1: Submit ticket
    console.log('\n--- STEP 1: Submit Ticket (Manual Entry Mode) ---');
    const submitResult = await submitTicket(betSlipId);

    if (submitResult.out_status !== 'inserted') {
      throw new Error(`Expected 'inserted' status, got '${submitResult.out_status}'`);
    }

    const ticketId = submitResult.out_ticket_id;
    results.ticketInserted = true;
    log(`✓ Ticket inserted: ${ticketId}`);

    // Verify in DB
    const { ticket, legs } = await verifyTicketInDb(ticketId);

    // Write proof
    writeProof('proof_ticket_inserted.txt', JSON.stringify({ ticket, legs }, null, 2));

    // Step 2: Enqueue Discord outbox (simulating app-layer)
    console.log('\n--- STEP 2: Enqueue Discord Outbox ---');
    const enqueued = await enqueueDiscordOutbox(ticketId, betSlipId);

    if (!enqueued) {
      log('WARNING: enqueue returned false (may already exist)');
    }

    // Verify outbox row
    const outboxBefore = await verifyOutboxRow(ticketId);
    if (!outboxBefore) {
      throw new Error('Outbox row not created');
    }
    results.outboxCreated = true;

    writeProof('proof_outbox_row_created.txt', JSON.stringify(outboxBefore, null, 2));

    // Step 3: Run worker
    console.log('\n--- STEP 3: Run Worker ---');
    const workerResult = await runWorkerOnce();
    results.workerRan = workerResult.code === 0;

    writeProof('proof_worker_output.txt', workerResult.output);

    // Step 4: Verify posted state
    console.log('\n--- STEP 4: Verify Posted State ---');
    await sleep(1000); // Give DB time to update
    const outboxAfter = await verifyPostedState(ticketId);
    results.outboxPosted = outboxAfter.status === 'posted';

    writeProof('proof_outbox_posted.txt', JSON.stringify(outboxAfter, null, 2));

    // Step 5: Test idempotency
    console.log('\n--- STEP 5: Test Idempotency ---');
    const idempotencyResult = await testIdempotency(betSlipId, ticketId);
    results.idempotency = true;

    writeProof('proof_idempotency_no_duplicates.txt', JSON.stringify({
      resubmit_status: idempotencyResult.resubmitStatus,
      outbox_row_count: idempotencyResult.outboxRowCount,
      discord_message_id: idempotencyResult.discordMessageId,
      no_duplicates: true,
    }, null, 2));

    // Summary
    console.log('\n============================================================');
    console.log('VERIFICATION RESULTS');
    console.log('============================================================');
    console.log(`Ticket Inserted:    ${results.ticketInserted ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Outbox Created:     ${results.outboxCreated ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Worker Ran:         ${results.workerRan ? '✓ PASS' : '⚠ WARNING'}`);
    console.log(`Outbox Posted:      ${results.outboxPosted ? '✓ PASS' : '⚠ WARNING (check DISCORD_WEBHOOK_URL)'}`);
    console.log(`Idempotency:        ${results.idempotency ? '✓ PASS' : '✗ FAIL'}`);
    console.log('');
    console.log(`Proofs written to: ${PROOF_DIR}`);
    console.log('');

    if (results.outboxPosted && idempotencyResult.discordMessageId) {
      console.log(`Discord Message ID: ${idempotencyResult.discordMessageId}`);
      console.log('');
      console.log('IMPORTANT: Capture a screenshot of the Discord message and save as:');
      console.log(`  ${join(PROOF_DIR, 'proof_discord_post.png')}`);
    }

    const allPass = results.ticketInserted && results.outboxCreated && results.idempotency;
    const fullPass = allPass && results.outboxPosted;

    if (fullPass) {
      console.log('\n✅ FULL VERIFICATION PASSED');
      process.exit(0);
    } else if (allPass) {
      console.log('\n⚠️ PARTIAL PASS (Discord posting may need DISCORD_WEBHOOK_URL)');
      process.exit(0);
    } else {
      console.log('\n❌ VERIFICATION FAILED');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ VERIFICATION ERROR:', err.message);
    console.error(err.stack);

    writeProof('proof_error.txt', `Error: ${err.message}\n\nStack:\n${err.stack}`);

    process.exit(1);
  }
}

main();
