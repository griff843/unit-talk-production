/**
 * test-app-layer-enqueue.mjs
 * Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
 *
 * Tests the app-layer enqueue flow:
 * 1. Submit ticket via atomic_submit_ticket_v2 (does NOT enqueue)
 * 2. On status='inserted', call enqueue_ticket_discord_outbox
 * 3. Verify outbox row created
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== APP-LAYER ENQUEUE TEST ===');
  console.log('Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086');
  console.log('');

  // Get test user
  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .eq('active', true)
    .limit(1);

  if (!users?.length) {
    console.error('No test user found');
    process.exit(1);
  }
  const testUser = users[0];
  console.log(`Test user: ${testUser.username}`);

  // Submit ticket
  const betSlipId = `SF-COMPLIANT-086-${Date.now()}`;
  const legs = [
    {
      sport: 'NBA',
      bet_type: 'moneyline',
      home_team: 'Celtics',
      away_team: 'Lakers',
      selection: 'home',
      odds: -140,
      provider: 'FD',
    },
  ];

  console.log('\n--- Step 1: Submit Ticket ---');
  console.log(`Bet Slip ID: ${betSlipId}`);

  const { data: submitResult, error: submitError } = await supabase.rpc('atomic_submit_ticket_v2', {
    p_bet_slip_id: betSlipId,
    p_user_id: testUser.id,
    p_ticket_type: 'single',
    p_total_stake: 1,
    p_legs: legs,
    p_source: 'test-script',
    p_meta: { entry_mode: 'manual', test_sprint: '086-compliant' },
  });

  if (submitError) {
    console.error('Submit failed:', submitError.message);
    process.exit(1);
  }

  const result = submitResult[0];
  console.log(`Status: ${result.out_status}`);
  console.log(`Ticket ID: ${result.out_ticket_id}`);

  if (result.out_status !== 'inserted') {
    console.error('Expected status=inserted');
    process.exit(1);
  }

  // Check outbox BEFORE app-layer enqueue (should be empty)
  console.log('\n--- Step 2: Check Outbox BEFORE Enqueue ---');
  const { data: outboxBefore } = await supabase
    .from('ticket_discord_outbox')
    .select('*')
    .eq('ticket_id', result.out_ticket_id);

  console.log(`Outbox rows before enqueue: ${outboxBefore.length}`);
  if (outboxBefore.length > 0) {
    console.error('ERROR: Outbox row exists before app-layer enqueue!');
    console.error('This means atomic_submit_ticket_v2 is still enqueuing (NON-COMPLIANT)');
    process.exit(1);
  }
  console.log('PASS: No outbox row before app-layer enqueue (RPC does not enqueue)');

  // App-layer enqueue
  console.log('\n--- Step 3: App-Layer Enqueue ---');
  const { data: enqueueResult, error: enqueueError } = await supabase.rpc('enqueue_ticket_discord_outbox', {
    p_ticket_id: result.out_ticket_id,
    p_bet_slip_id: betSlipId,
  });

  if (enqueueError) {
    console.error('Enqueue failed:', enqueueError.message);
    process.exit(1);
  }
  console.log(`Enqueue result: ${enqueueResult}`);

  // Check outbox AFTER enqueue
  console.log('\n--- Step 4: Check Outbox AFTER Enqueue ---');
  const { data: outboxAfter } = await supabase
    .from('ticket_discord_outbox')
    .select('*')
    .eq('ticket_id', result.out_ticket_id);

  if (outboxAfter.length === 0) {
    console.error('ERROR: No outbox row after enqueue');
    process.exit(1);
  }

  const outboxRow = outboxAfter[0];
  console.log(`Outbox ID: ${outboxRow.id}`);
  console.log(`Status: ${outboxRow.status}`);
  console.log(`Created At: ${outboxRow.created_at}`);
  console.log('PASS: Outbox row created by app-layer enqueue');

  // Idempotency test
  console.log('\n--- Step 5: Idempotency Test ---');
  const { data: enqueue2 } = await supabase.rpc('enqueue_ticket_discord_outbox', {
    p_ticket_id: result.out_ticket_id,
    p_bet_slip_id: betSlipId,
  });
  console.log(`Second enqueue result: ${enqueue2} (should be false - already exists)`);

  const { data: outboxCount } = await supabase
    .from('ticket_discord_outbox')
    .select('id')
    .eq('ticket_id', result.out_ticket_id);

  console.log(`Outbox rows after second enqueue: ${outboxCount.length}`);
  if (outboxCount.length !== 1) {
    console.error('ERROR: Duplicate outbox rows!');
    process.exit(1);
  }
  console.log('PASS: No duplicate outbox rows (idempotent)');

  console.log('\n=== TEST SUMMARY ===');
  console.log('Ticket ID:', result.out_ticket_id);
  console.log('Bet Slip ID:', betSlipId);
  console.log('Outbox ID:', outboxRow.id);
  console.log('Status: COMPLIANT PASS');
  console.log('- RPC does NOT enqueue');
  console.log('- App-layer enqueue works');
  console.log('- Idempotency verified');

  return {
    ticketId: result.out_ticket_id,
    betSlipId,
    outboxId: outboxRow.id,
  };
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
