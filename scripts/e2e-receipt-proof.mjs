#!/usr/bin/env node
/**
 * E2E Receipt Proof Script
 *
 * SPRINT-FOUNDATION-TRUTH-LOCK-094A
 *
 * Produces a correlated receipt proving the full pipeline:
 * ticket_id → outbox_id → claimed_at → discord_message_id
 *
 * Usage:
 *   node scripts/e2e-receipt-proof.mjs
 *   node scripts/e2e-receipt-proof.mjs --ticket-id <uuid>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment
config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Output directory
const SPRINT_ID = 'FOUNDATION-TRUTH-LOCK-094A';
const DATE = new Date().toISOString().split('T')[0];
const PROOF_DIR = join('out', 'audits', SPRINT_ID, DATE);

// Ensure directory exists
if (!existsSync(PROOF_DIR)) {
  mkdirSync(PROOF_DIR, { recursive: true });
}

function writeProof(filename, content) {
  const path = join(PROOF_DIR, filename);
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log(`  ✓ ${filename}`);
}

/**
 * Get the most recent posted ticket from outbox
 */
async function getRecentPostedTicket() {
  // Select only columns that exist in all schema versions
  const { data, error } = await supabase
    .from('ticket_discord_outbox')
    .select(`
      id,
      ticket_id,
      bet_slip_id,
      status,
      discord_message_id,
      discord_channel_id,
      posted_at,
      created_at
    `)
    .eq('status', 'posted')
    .not('discord_message_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Failed to find posted ticket:', error.message);
    return null;
  }

  return data;
}

/**
 * Get ticket details
 */
async function getTicketDetails(ticketId) {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (error) {
    console.error('Failed to get ticket:', error.message);
    return null;
  }

  return data;
}

/**
 * Get ticket legs
 */
async function getTicketLegs(ticketId) {
  const { data, error } = await supabase
    .from('ticket_legs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('leg_index', { ascending: true });

  if (error) {
    console.error('Failed to get legs:', error.message);
    return [];
  }

  return data;
}

/**
 * Check idempotency (no duplicate outbox entries)
 */
async function checkIdempotency(ticketId) {
  const { data, error } = await supabase
    .from('ticket_discord_outbox')
    .select('id')
    .eq('ticket_id', ticketId);

  if (error) {
    return { pass: false, error: error.message };
  }

  const count = data?.length || 0;
  return {
    pass: count <= 1,
    count,
    message: count <= 1 ? 'PASS: Single outbox entry' : `FAIL: ${count} duplicate entries`,
  };
}

/**
 * Build the E2E receipt
 */
async function buildReceipt(outboxEntry, ticket, legs) {
  return {
    ticket_id: outboxEntry.ticket_id,
    bet_slip_id: outboxEntry.bet_slip_id,
    outbox_id: outboxEntry.id,
    created_at: outboxEntry.created_at,
    claimed_at: outboxEntry.claimed_at || null, // May not exist in older schema
    posted_at: outboxEntry.posted_at,
    discord_message_id: outboxEntry.discord_message_id,
    discord_channel_id: outboxEntry.discord_channel_id,
    ticket_type: ticket?.ticket_type,
    total_stake: ticket?.total_stake,
    leg_count: legs.length,
    overall_pass: !!(outboxEntry.discord_message_id && outboxEntry.posted_at),
    captured_at: new Date().toISOString(),
  };
}

async function main() {
  console.log('=========================================');
  console.log('  E2E RECEIPT PROOF');
  console.log('  SPRINT-FOUNDATION-TRUTH-LOCK-094A');
  console.log('=========================================\n');

  // Get specific ticket from args or find most recent
  const ticketIdArg = process.argv.find((arg, i) => process.argv[i - 1] === '--ticket-id');

  let outboxEntry;

  if (ticketIdArg) {
    const { data, error } = await supabase
      .from('ticket_discord_outbox')
      .select('*')
      .eq('ticket_id', ticketIdArg)
      .single();

    if (error) {
      console.error('Ticket not found in outbox:', error.message);
      process.exit(1);
    }
    outboxEntry = data;
  } else {
    console.log('Finding most recent posted ticket...\n');
    outboxEntry = await getRecentPostedTicket();
  }

  if (!outboxEntry) {
    console.error('No posted tickets found in outbox');
    writeProof('proof_e2e_receipt.json', {
      success: false,
      error: 'No posted tickets found',
      captured_at: new Date().toISOString(),
    });
    process.exit(1);
  }

  console.log(`Found: ${outboxEntry.ticket_id}\n`);

  // Get ticket and legs
  const ticket = await getTicketDetails(outboxEntry.ticket_id);
  const legs = await getTicketLegs(outboxEntry.ticket_id);

  // Build receipt
  const receipt = await buildReceipt(outboxEntry, ticket, legs);

  // Save receipt proof
  writeProof('proof_e2e_receipt.json', receipt);

  // Check idempotency
  const idempotency = await checkIdempotency(outboxEntry.ticket_id);
  writeProof('proof_idempotency.txt', [
    '=== IDEMPOTENCY CHECK ===',
    `Ticket ID: ${outboxEntry.ticket_id}`,
    `Outbox Entries: ${idempotency.count}`,
    `Result: ${idempotency.message}`,
    '',
    `Captured: ${new Date().toISOString()}`,
  ].join('\n'));

  // Discord message proof
  writeProof('proof_discord_message_id_present.txt', [
    '=== DISCORD MESSAGE ID PROOF ===',
    `Ticket ID: ${outboxEntry.ticket_id}`,
    `Outbox ID: ${outboxEntry.id}`,
    `Discord Message ID: ${outboxEntry.discord_message_id || 'NOT SET'}`,
    `Discord Channel ID: ${outboxEntry.discord_channel_id || 'NOT SET'}`,
    `Posted At: ${outboxEntry.posted_at || 'NOT SET'}`,
    '',
    `Result: ${outboxEntry.discord_message_id ? 'PASS' : 'FAIL'}`,
    '',
    `Captured: ${new Date().toISOString()}`,
  ].join('\n'));

  // Summary
  console.log('\n=========================================');
  console.log('  RECEIPT SUMMARY');
  console.log('=========================================');
  console.log(`  Ticket ID: ${receipt.ticket_id}`);
  console.log(`  Outbox ID: ${receipt.outbox_id}`);
  console.log(`  Discord Message: ${receipt.discord_message_id || 'N/A'}`);
  console.log(`  Idempotency: ${idempotency.pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Overall: ${receipt.overall_pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log('=========================================\n');

  process.exit(receipt.overall_pass && idempotency.pass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
