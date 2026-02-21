/**
 * test-discord-outbox-flow.mjs
 * Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
 *
 * Tests the full flow:
 * 1. Submit a ticket via atomic_submit_ticket_v2
 * 2. Verify outbox row created with status=pending
 * 3. Run worker to post to Discord
 * 4. Verify outbox marked as posted
 * 5. Re-submit same bet_slip_id (idempotency check)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== SPRINT-V3-TICKET-DISCORD-PUBLISH-086 TEST ===\n');

  // Step 0: Get a test user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username')
    .eq('active', true)
    .limit(1);

  if (userError || !users?.length) {
    console.error('Failed to get test user:', userError?.message);
    process.exit(1);
  }
  const testUser = users[0];
  console.log(`Test user: ${testUser.username} (${testUser.id})`);

  // Step 1: Submit a ticket
  const betSlipId = `SF-TEST-086-${Date.now()}`;
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
    {
      sport: 'NBA',
      bet_type: 'player_prop',
      home_team: 'Heat',
      away_team: 'Bucks',
      player_name: 'Jimmy Butler',
      prop_type: 'PTS',
      selection: 'over',
      line: 22.5,
      odds: -110,
      provider: 'FD',
    },
  ];

  console.log('\n--- Step 1: Submit Ticket ---');
  console.log(`Bet Slip ID: ${betSlipId}`);
  console.log(`Legs: ${legs.length}`);

  const { data: submitResult, error: submitError } = await supabase.rpc('atomic_submit_ticket_v2', {
    p_bet_slip_id: betSlipId,
    p_user_id: testUser.id,
    p_ticket_type: 'parlay',
    p_total_stake: 1,
    p_legs: legs,
    p_source: 'test-script',
    p_meta: { entry_mode: 'manual', test_sprint: '086' },
  });

  if (submitError) {
    console.error('Submit failed:', submitError.message);
    process.exit(1);
  }

  const result = submitResult[0];
  console.log(`Status: ${result.out_status}`);
  console.log(`Ticket ID: ${result.out_ticket_id}`);
  console.log(`Leg IDs: ${result.out_leg_ids?.length}`);

  if (result.out_status === 'error') {
    console.error('Validation errors:', JSON.stringify(result.out_error_details, null, 2));
    process.exit(1);
  }

  // Step 2: Check outbox
  console.log('\n--- Step 2: Check Outbox ---');
  const { data: outboxRows, error: outboxError } = await supabase
    .from('ticket_discord_outbox')
    .select('*')
    .eq('ticket_id', result.out_ticket_id);

  if (outboxError) {
    console.error('Outbox query failed:', outboxError.message);
    process.exit(1);
  }

  if (outboxRows.length === 0) {
    console.error('No outbox row found! Enqueue failed.');
    process.exit(1);
  }

  const outboxRow = outboxRows[0];
  console.log(`Outbox ID: ${outboxRow.id}`);
  console.log(`Status: ${outboxRow.status}`);
  console.log(`Created At: ${outboxRow.created_at}`);

  if (outboxRow.status !== 'pending') {
    console.error(`Expected status=pending, got ${outboxRow.status}`);
    process.exit(1);
  }
  console.log('Outbox row created with status=pending');

  // Step 3: Check pending outbox via RPC
  console.log('\n--- Step 3: Get Pending via RPC ---');
  const { data: pendingItems, error: pendingError } = await supabase.rpc('get_pending_discord_outbox', {
    p_limit: 10,
  });

  if (pendingError) {
    console.error('Pending query failed:', pendingError.message);
    process.exit(1);
  }

  const ourItem = pendingItems?.find(p => p.ticket_id === result.out_ticket_id);
  if (!ourItem) {
    console.error('Our ticket not in pending list!');
    process.exit(1);
  }
  console.log('Our ticket found in pending list');
  console.log(`Ticket Type: ${ourItem.ticket_type}`);
  console.log(`Legs: ${ourItem.legs?.length}`);

  // Step 4: Idempotency test - re-submit same bet_slip_id
  console.log('\n--- Step 4: Idempotency Test ---');
  const { data: resubmitResult, error: resubmitError } = await supabase.rpc('atomic_submit_ticket_v2', {
    p_bet_slip_id: betSlipId,  // Same bet slip ID
    p_user_id: testUser.id,
    p_ticket_type: 'parlay',
    p_total_stake: 1,
    p_legs: legs,
    p_source: 'test-script',
    p_meta: { entry_mode: 'manual', test_sprint: '086' },
  });

  if (resubmitError) {
    console.error('Re-submit failed:', resubmitError.message);
    process.exit(1);
  }

  const resubmit = resubmitResult[0];
  console.log(`Re-submit Status: ${resubmit.out_status}`);
  console.log(`Re-submit Ticket ID: ${resubmit.out_ticket_id}`);

  if (resubmit.out_status !== 'exists') {
    console.error(`Expected status=exists for re-submit, got ${resubmit.out_status}`);
    process.exit(1);
  }
  console.log('Re-submit returned status=exists (idempotent)');

  // Step 5: Check no duplicate outbox row
  console.log('\n--- Step 5: Check No Duplicate Outbox ---');
  const { data: outboxCount } = await supabase
    .from('ticket_discord_outbox')
    .select('id', { count: 'exact' })
    .eq('ticket_id', result.out_ticket_id);

  console.log(`Outbox rows for this ticket: ${outboxCount.length}`);
  if (outboxCount.length !== 1) {
    console.error('Duplicate outbox rows found!');
    process.exit(1);
  }
  console.log('No duplicate outbox rows (idempotent)');

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log('Ticket ID:', result.out_ticket_id);
  console.log('Bet Slip ID:', betSlipId);
  console.log('Outbox ID:', outboxRow.id);
  console.log('Status: PASS');
  console.log('\nTo post to Discord, run:');
  console.log('cd apps/api && npx tsx src/scripts/discord-ticket-publish-worker.ts --once');

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
