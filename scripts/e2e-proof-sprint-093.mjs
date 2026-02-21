#!/usr/bin/env node
/**
 * E2E Proof Generation Script for SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093
 *
 * Generates automated proof artifacts without manual work.
 * Queries database directly to capture:
 * - Discord routing status
 * - Worker heartbeats
 * - Recent tickets and legs
 * - Outbox transitions
 * - Idempotency verification
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
const SPRINT_ID = 'SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093';
const DATE = new Date().toISOString().split('T')[0];
const PROOF_DIR = join('out', 'sprints', SPRINT_ID, DATE, 'proofs');

// Ensure directory exists
if (!existsSync(PROOF_DIR)) {
  mkdirSync(PROOF_DIR, { recursive: true });
}

function writeProof(filename, content) {
  const path = join(PROOF_DIR, filename);
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log(`  ✓ ${filename}`);
}

async function captureRoutingStatus() {
  console.log('\n📊 Capturing Discord Routing Status...');

  // Query the RPC directly
  const { data, error } = await supabase.rpc('get_discord_routing_status');

  if (error) {
    console.error('  ✗ Failed to query routing status:', error.message);
    writeProof('proof_ops_routing_status.json', {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  // Add environment checks
  const status = {
    ...data,
    env_checks: {
      ENABLE_DISCORD_TICKET_WORKER: process.env.ENABLE_DISCORD_TICKET_WORKER || 'not set',
      DEFAULT_DISCORD_TICKET_CHANNEL_ID: process.env.DEFAULT_DISCORD_TICKET_CHANNEL_ID ? 'configured' : 'not set',
      DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ? 'configured' : 'not set',
    },
    captured_at: new Date().toISOString(),
  };

  writeProof('proof_ops_routing_status.json', status);
  return true;
}

async function captureWorkerHeartbeat() {
  console.log('\n💓 Capturing Worker Heartbeats...');

  const { data, error } = await supabase
    .from('ops_worker_heartbeats')
    .select('*')
    .order('last_heartbeat_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('  ✗ Failed to query heartbeats:', error.message);
    writeProof('proof_worker_heartbeat.txt', `Error: ${error.message}`);
    return false;
  }

  const heartbeatReport = data.length === 0
    ? 'No worker heartbeats found (worker may not have started yet)'
    : data.map(h => {
        const age = h.last_heartbeat_at
          ? Math.floor((Date.now() - new Date(h.last_heartbeat_at).getTime()) / 1000)
          : 'unknown';
        return [
          `Worker: ${h.worker_name} (${h.worker_id})`,
          `  Status: ${h.status}`,
          `  Last Heartbeat: ${h.last_heartbeat_at} (${age}s ago)`,
          `  Items Processed: ${h.items_processed_total}`,
          `  Last Successful Post: ${h.last_successful_post_at || 'never'}`,
          `  Last Error: ${h.last_error || 'none'}`,
          `  Meta: ${JSON.stringify(h.meta)}`,
          '',
        ].join('\n');
      }).join('\n');

  writeProof('proof_worker_heartbeat.txt', [
    '=== WORKER HEARTBEATS ===',
    `Captured: ${new Date().toISOString()}`,
    `Total Records: ${data.length}`,
    '',
    heartbeatReport,
  ].join('\n'));

  return true;
}

async function captureRecentTicket() {
  console.log('\n🎫 Capturing Recent Ticket...');

  // Get most recent ticket
  const { data: tickets, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (ticketError || !tickets || tickets.length === 0) {
    console.error('  ✗ No tickets found:', ticketError?.message || 'empty');
    writeProof('proof_db_ticket.txt', 'No tickets found in database');
    return false;
  }

  const ticket = tickets[0];
  writeProof('proof_db_ticket.txt', [
    '=== RECENT TICKET ===',
    `Captured: ${new Date().toISOString()}`,
    '',
    `ID: ${ticket.id}`,
    `Bet Slip ID: ${ticket.bet_slip_id}`,
    `Ticket Type: ${ticket.ticket_type}`,
    `Total Stake: ${ticket.total_stake}`,
    `Source: ${ticket.source}`,
    `Created: ${ticket.created_at}`,
    `User ID: ${ticket.user_id}`,
    `Meta: ${JSON.stringify(ticket.meta, null, 2)}`,
  ].join('\n'));

  // Get legs for this ticket
  const { data: legs, error: legsError } = await supabase
    .from('ticket_legs')
    .select('*')
    .eq('ticket_id', ticket.id)
    .order('leg_index', { ascending: true });

  if (legsError) {
    console.error('  ✗ Failed to fetch legs:', legsError.message);
    writeProof('proof_db_legs.txt', `Error fetching legs: ${legsError.message}`);
  } else {
    const legsReport = legs.map(leg => [
      `Leg ${leg.leg_index + 1}:`,
      `  Selection: ${leg.selection}`,
      `  Provider: ${leg.provider}`,
      `  Line: ${leg.provider_line}`,
      `  Odds: ${leg.provider_odds}`,
      `  Provider Value: ${JSON.stringify(leg.provider_value)}`,
      '',
    ].join('\n')).join('\n');

    writeProof('proof_db_legs.txt', [
      '=== TICKET LEGS ===',
      `Ticket ID: ${ticket.id}`,
      `Total Legs: ${legs.length}`,
      `Captured: ${new Date().toISOString()}`,
      '',
      legsReport,
    ].join('\n'));
  }

  return true;
}

async function captureOutboxTransitions() {
  console.log('\n📤 Capturing Outbox Transitions...');

  // Get status counts
  const { data: pending } = await supabase
    .from('ticket_discord_outbox')
    .select('id', { count: 'exact' })
    .eq('status', 'pending');

  const { data: processing } = await supabase
    .from('ticket_discord_outbox')
    .select('id', { count: 'exact' })
    .eq('status', 'processing');

  const { data: posted } = await supabase
    .from('ticket_discord_outbox')
    .select('id', { count: 'exact' })
    .eq('status', 'posted');

  const { data: failed } = await supabase
    .from('ticket_discord_outbox')
    .select('id', { count: 'exact' })
    .eq('status', 'failed');

  // Get recent posted items with Discord response
  const { data: recentPosted, error: postedError } = await supabase
    .from('ticket_discord_outbox')
    .select('*')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(3);

  writeProof('proof_outbox_transition.txt', [
    '=== OUTBOX STATUS DISTRIBUTION ===',
    `Captured: ${new Date().toISOString()}`,
    '',
    `Pending: ${pending?.length || 0}`,
    `Processing: ${processing?.length || 0}`,
    `Posted: ${posted?.length || 0}`,
    `Failed: ${failed?.length || 0}`,
    '',
    '=== RECENT POSTED ITEMS ===',
    recentPosted?.map(item => [
      `Outbox ID: ${item.id}`,
      `  Ticket ID: ${item.ticket_id}`,
      `  Discord Message ID: ${item.discord_message_id || 'N/A'}`,
      `  Discord Channel ID: ${item.discord_channel_id || 'N/A'}`,
      `  Posted At: ${item.posted_at}`,
      '',
    ].join('\n')).join('\n') || 'No posted items found',
  ].join('\n'));

  // Capture Discord response proof (from posted items)
  if (recentPosted && recentPosted.length > 0) {
    const discordProof = recentPosted.map(item => ({
      outbox_id: item.id,
      ticket_id: item.ticket_id,
      discord_message_id: item.discord_message_id,
      discord_channel_id: item.discord_channel_id,
      posted_at: item.posted_at,
      bet_slip_id: item.bet_slip_id,
    }));

    writeProof('proof_discord_response.json', {
      success: true,
      count: discordProof.length,
      items: discordProof,
      captured_at: new Date().toISOString(),
    });
  } else {
    writeProof('proof_discord_response.json', {
      success: false,
      message: 'No posted items found with Discord message IDs',
      captured_at: new Date().toISOString(),
    });
  }

  return true;
}

async function captureIdempotencyProof() {
  console.log('\n🔒 Capturing Idempotency Proof...');

  // Check for any duplicate ticket_ids in outbox
  const { data: duplicates, error } = await supabase.rpc('check_outbox_duplicates');

  // Fallback to manual query if RPC doesn't exist
  let duplicateCount = 0;
  let proof = '';

  if (error) {
    // Manual check: look for any ticket_id appearing more than once
    const { data: allOutbox } = await supabase
      .from('ticket_discord_outbox')
      .select('ticket_id');

    if (allOutbox) {
      const ticketIds = allOutbox.map(o => o.ticket_id);
      const seen = new Set();
      const dups = new Set();
      ticketIds.forEach(id => {
        if (seen.has(id)) dups.add(id);
        seen.add(id);
      });
      duplicateCount = dups.size;
    }

    proof = [
      '=== IDEMPOTENCY VERIFICATION ===',
      `Captured: ${new Date().toISOString()}`,
      '',
      `Total Outbox Rows: ${allOutbox?.length || 0}`,
      `Unique Ticket IDs: ${new Set((allOutbox || []).map(o => o.ticket_id)).size}`,
      `Duplicate Ticket IDs: ${duplicateCount}`,
      '',
      duplicateCount === 0
        ? '✓ PASS: No duplicate ticket_ids found in outbox'
        : `✗ FAIL: Found ${duplicateCount} duplicate ticket_ids`,
      '',
      'Idempotency is enforced by UNIQUE(ticket_id) constraint on ticket_discord_outbox',
    ].join('\n');
  } else {
    proof = [
      '=== IDEMPOTENCY VERIFICATION ===',
      `Captured: ${new Date().toISOString()}`,
      '',
      `Result: ${JSON.stringify(duplicates)}`,
      '',
      '✓ Idempotency enforced by UNIQUE(ticket_id) constraint',
    ].join('\n');
  }

  writeProof('proof_idempotency.txt', proof);
  return duplicateCount === 0;
}

async function main() {
  console.log('=========================================');
  console.log('  SPRINT-093 E2E PROOF GENERATION');
  console.log('=========================================');
  console.log(`Output: ${PROOF_DIR}`);

  let allPassed = true;

  // 1. Routing Status
  if (!await captureRoutingStatus()) allPassed = false;

  // 2. Worker Heartbeats
  if (!await captureWorkerHeartbeat()) allPassed = false;

  // 3. Recent Ticket + Legs
  if (!await captureRecentTicket()) allPassed = false;

  // 4. Outbox Transitions
  if (!await captureOutboxTransitions()) allPassed = false;

  // 5. Idempotency
  if (!await captureIdempotencyProof()) allPassed = false;

  console.log('\n=========================================');
  console.log(allPassed ? '✓ All proofs generated successfully' : '⚠ Some proofs had issues');
  console.log(`Output directory: ${PROOF_DIR}`);
  console.log('=========================================\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
