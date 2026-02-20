#!/usr/bin/env node
/**
 * SPRINT-CANONICAL-V3-SMARTFORM-075 Full Automated Verification
 *
 * This script is FULLY AUTOMATED - no manual UUID copying required.
 *
 * Tests:
 * 1. Setup: Create test data (event, participant, provider_offer)
 * 2. Submit: Call atomic_submit_ticket_v2 with provider-first leg
 * 3. Verify: Check tickets + ticket_legs written correctly
 * 4. Idempotency: Re-submit same bet_slip_id, verify 'exists' status
 * 5. Fail-closed: Submit with missing required field, verify 0 writes
 * 6. Cleanup: Remove test data
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test data IDs - deterministic for cleanup
const TEST_IDS = {
  event: 'aaaaaaaa-1111-2222-3333-444444444444',
  participant: 'bbbbbbbb-1111-2222-3333-444444444444',
  offer: 'cccccccc-1111-2222-3333-444444444444',
  // User ID is unconstrained per FK discovery - use any valid UUID
  user: '00000000-0000-0000-0000-000000000001',
  betSlipProvider: 'VERIFY_075_PROVIDER_' + Date.now(),
  betSlipIdempotency: 'VERIFY_075_IDEMP_' + Date.now(),
  betSlipFailClosed: 'VERIFY_075_FAIL_' + Date.now()
};

let testResults = {
  setup: false,
  submitProvider: false,
  verifyWrites: false,
  idempotency: false,
  failClosed: false,
  cleanup: false
};

async function runTest(name, testFn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log('='.repeat(60));
  try {
    await testFn();
    console.log(`\n✅ ${name} - PASSED`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${name} - FAILED: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');
    console.log('\n🔍 SPRINT-CANONICAL-V3-SMARTFORM-075 FULL VERIFICATION');
    console.log('=' .repeat(60));
    console.log('Mode: FULLY AUTOMATED (no manual UUID editing required)');
    console.log('User ID constraint: NONE (unconstrained)');
    console.log(`Test User ID: ${TEST_IDS.user}`);

    // ========================================
    // SETUP: Create test data
    // ========================================
    testResults.setup = await runTest('SETUP: Create test data', async () => {
      // Clean any existing test data first
      await client.query(`DELETE FROM ticket_legs WHERE ticket_id IN (
        SELECT id FROM tickets WHERE bet_slip_id LIKE 'VERIFY_075_%'
      )`);
      await client.query(`DELETE FROM tickets WHERE bet_slip_id LIKE 'VERIFY_075_%'`);
      await client.query(`DELETE FROM provider_offers WHERE id = $1`, [TEST_IDS.offer]);
      await client.query(`DELETE FROM participants WHERE id = $1`, [TEST_IDS.participant]);
      await client.query(`DELETE FROM canonical_events WHERE id = $1`, [TEST_IDS.event]);

      // Create canonical_event
      await client.query(`
        INSERT INTO canonical_events (id, external_id, sport, league, event_type, scheduled_at, status)
        VALUES ($1, 'VERIFY_EVENT_075', 'NBA', 'NBA', 'game', NOW() + INTERVAL '1 day', 'scheduled')
      `, [TEST_IDS.event]);
      console.log(`Created canonical_event: ${TEST_IDS.event}`);

      // Create participant
      await client.query(`
        INSERT INTO participants (id, external_id, name, type, sport, active)
        VALUES ($1, 'VERIFY_PLAYER_075', 'Test Player 075', 'player', 'NBA', true)
      `, [TEST_IDS.participant]);
      console.log(`Created participant: ${TEST_IDS.participant}`);

      // Create provider_offer
      await client.query(`
        INSERT INTO provider_offers (
          id, event_id, market_type_id, participant_id, provider, provider_id,
          line, over_odds, under_odds, snapshot_at
        )
        VALUES (
          $1, $2, 2, $3, 'fanduel', 1,
          28.5, -115, -105, NOW()
        )
      `, [TEST_IDS.offer, TEST_IDS.event, TEST_IDS.participant]);
      console.log(`Created provider_offer: ${TEST_IDS.offer}`);
      console.log('  market_type_id: 2 (player_points_ou)');
      console.log('  line: 28.5');
      console.log('  over_odds: -115');
      console.log('  under_odds: -105');
    });

    if (!testResults.setup) {
      throw new Error('Setup failed - cannot continue');
    }

    // ========================================
    // TEST 1: Submit with provider_offer_id
    // ========================================
    let ticketId = null;
    let legIds = null;

    testResults.submitProvider = await runTest('SUBMIT: Provider-first single leg', async () => {
      const leg = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider_offer_id: TEST_IDS.offer,
        selection: 'over'
      });

      console.log('\nRPC Call: atomic_submit_ticket_v2');
      console.log(`  bet_slip_id: ${TEST_IDS.betSlipProvider}`);
      console.log(`  user_id: ${TEST_IDS.user}`);
      console.log(`  ticket_type: single`);
      console.log(`  total_stake: 100`);
      console.log(`  leg: ${leg}`);

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          $1,
          $2::UUID,
          'single',
          100,
          ARRAY[$3::JSONB]
        )
      `, [TEST_IDS.betSlipProvider, TEST_IDS.user, leg]);

      const row = result.rows[0];
      console.log('\nRPC Result:');
      console.log(`  out_ticket_id: ${row.out_ticket_id}`);
      console.log(`  out_leg_ids: ${JSON.stringify(row.out_leg_ids)}`);
      console.log(`  out_status: ${row.out_status}`);
      console.log(`  out_error_details: ${row.out_error_details || 'null'}`);

      if (row.out_status !== 'inserted') {
        throw new Error(`Expected status='inserted', got '${row.out_status}'. Errors: ${JSON.stringify(row.out_error_details)}`);
      }

      ticketId = row.out_ticket_id;
      legIds = row.out_leg_ids;
    });

    if (!testResults.submitProvider) {
      throw new Error('Submit failed - cannot continue');
    }

    // ========================================
    // TEST 2: Verify writes
    // ========================================
    testResults.verifyWrites = await runTest('VERIFY: Check ticket + leg writes', async () => {
      // Verify ticket
      const ticketResult = await client.query(`
        SELECT id, bet_slip_id, user_id, ticket_type, total_stake, status, source
        FROM tickets
        WHERE id = $1
      `, [ticketId]);

      if (ticketResult.rows.length === 0) {
        throw new Error('Ticket not found in database');
      }

      const ticket = ticketResult.rows[0];
      console.log('\nTicket row:');
      console.log(`  id: ${ticket.id}`);
      console.log(`  bet_slip_id: ${ticket.bet_slip_id}`);
      console.log(`  user_id: ${ticket.user_id}`);
      console.log(`  ticket_type: ${ticket.ticket_type}`);
      console.log(`  total_stake: ${ticket.total_stake}`);
      console.log(`  status: ${ticket.status}`);
      console.log(`  source: ${ticket.source}`);

      // Verify leg
      const legResult = await client.query(`
        SELECT
          id, ticket_id, leg_index, event_id, market_type_id, participant_id,
          selection, offer_id, provider, provider_line, provider_odds,
          provider_value, override_value, effective_value, effective_source, leg_status
        FROM ticket_legs
        WHERE ticket_id = $1
      `, [ticketId]);

      if (legResult.rows.length === 0) {
        throw new Error('Ticket leg not found in database');
      }

      const leg = legResult.rows[0];
      console.log('\nTicket leg row:');
      console.log(`  id: ${leg.id}`);
      console.log(`  leg_index: ${leg.leg_index}`);
      console.log(`  event_id: ${leg.event_id}`);
      console.log(`  market_type_id: ${leg.market_type_id}`);
      console.log(`  participant_id: ${leg.participant_id}`);
      console.log(`  selection: ${leg.selection}`);
      console.log(`  offer_id: ${leg.offer_id}`);
      console.log(`  provider: ${leg.provider}`);
      console.log(`  provider_line: ${leg.provider_line}`);
      console.log(`  provider_odds: ${leg.provider_odds}`);
      console.log(`  effective_source: ${leg.effective_source}`);
      console.log(`  leg_status: ${leg.leg_status}`);
      console.log(`  provider_value: ${JSON.stringify(leg.provider_value)}`);
      console.log(`  override_value: ${leg.override_value || 'null'}`);
      console.log(`  effective_value: ${JSON.stringify(leg.effective_value)}`);

      // Verify critical fields
      if (leg.offer_id !== TEST_IDS.offer) {
        throw new Error(`offer_id mismatch: expected ${TEST_IDS.offer}, got ${leg.offer_id}`);
      }
      console.log('\n✓ offer_id correctly populated');

      if (leg.effective_source !== 'PROVIDER') {
        throw new Error(`effective_source mismatch: expected 'PROVIDER', got '${leg.effective_source}'`);
      }
      console.log('✓ effective_source = PROVIDER');

      if (!leg.provider_value) {
        throw new Error('provider_value is NULL');
      }
      console.log('✓ provider_value populated');

      if (!leg.effective_value) {
        throw new Error('effective_value is NULL');
      }
      console.log('✓ effective_value populated');

      // Verify effective_value contains expected data
      if (leg.effective_value.line !== 28.5) {
        throw new Error(`effective_value.line mismatch: expected 28.5, got ${leg.effective_value.line}`);
      }
      console.log('✓ effective_value.line = 28.5 (from offer)');

      if (leg.effective_value.odds !== -115) {
        throw new Error(`effective_value.odds mismatch: expected -115, got ${leg.effective_value.odds}`);
      }
      console.log('✓ effective_value.odds = -115 (over_odds from offer)');
    });

    // ========================================
    // TEST 3: Idempotency
    // ========================================
    testResults.idempotency = await runTest('IDEMPOTENCY: Re-submit same bet_slip_id', async () => {
      const leg = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider_offer_id: TEST_IDS.offer,
        selection: 'over'
      });

      console.log(`\nRe-submitting bet_slip_id: ${TEST_IDS.betSlipProvider}`);

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          $1,
          $2::UUID,
          'single',
          100,
          ARRAY[$3::JSONB]
        )
      `, [TEST_IDS.betSlipProvider, TEST_IDS.user, leg]);

      const row = result.rows[0];
      console.log('\nRPC Result:');
      console.log(`  out_ticket_id: ${row.out_ticket_id}`);
      console.log(`  out_leg_ids: ${JSON.stringify(row.out_leg_ids)}`);
      console.log(`  out_status: ${row.out_status}`);

      if (row.out_status !== 'exists') {
        throw new Error(`Expected status='exists', got '${row.out_status}'`);
      }
      console.log('\n✓ out_status = exists');

      if (row.out_ticket_id !== ticketId) {
        throw new Error(`Ticket ID mismatch: expected ${ticketId}, got ${row.out_ticket_id}`);
      }
      console.log('✓ Returns same ticket_id');

      // Verify no duplicates
      const countResult = await client.query(`
        SELECT COUNT(*) as cnt FROM tickets WHERE bet_slip_id = $1
      `, [TEST_IDS.betSlipProvider]);

      const count = parseInt(countResult.rows[0].cnt);
      console.log(`\nTickets with this bet_slip_id: ${count}`);
      if (count !== 1) {
        throw new Error(`Expected 1 ticket, got ${count} - DUPLICATE DETECTED`);
      }
      console.log('✓ No duplicates created');
    });

    // ========================================
    // TEST 4: Fail-closed validation
    // ========================================
    testResults.failClosed = await runTest('FAIL-CLOSED: Submit with invalid event_id', async () => {
      const invalidLeg = JSON.stringify({
        event_id: '99999999-9999-9999-9999-999999999999',  // Does not exist
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider: 'manual',
        selection: 'over',
        line: 25.5,
        odds: -110
      });

      console.log('\nSubmitting with non-existent event_id...');
      console.log(`  bet_slip_id: ${TEST_IDS.betSlipFailClosed}`);

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          $1,
          $2::UUID,
          'single',
          100,
          ARRAY[$3::JSONB]
        )
      `, [TEST_IDS.betSlipFailClosed, TEST_IDS.user, invalidLeg]);

      const row = result.rows[0];
      console.log('\nRPC Result:');
      console.log(`  out_status: ${row.out_status}`);
      console.log(`  out_error_details: ${JSON.stringify(row.out_error_details)}`);

      if (row.out_status !== 'error') {
        throw new Error(`Expected status='error', got '${row.out_status}'`);
      }
      console.log('\n✓ out_status = error');

      // Verify no writes occurred
      const ticketCount = await client.query(`
        SELECT COUNT(*) as cnt FROM tickets WHERE bet_slip_id = $1
      `, [TEST_IDS.betSlipFailClosed]);

      const count = parseInt(ticketCount.rows[0].cnt);
      console.log(`\nTickets with failed bet_slip_id: ${count}`);
      if (count !== 0) {
        throw new Error(`Expected 0 tickets, got ${count} - WRITES OCCURRED ON FAILURE`);
      }
      console.log('✓ Zero writes on validation failure (fail-closed)');
    });

    // ========================================
    // CLEANUP
    // ========================================
    testResults.cleanup = await runTest('CLEANUP: Remove test data', async () => {
      await client.query(`DELETE FROM ticket_legs WHERE ticket_id IN (
        SELECT id FROM tickets WHERE bet_slip_id LIKE 'VERIFY_075_%'
      )`);
      await client.query(`DELETE FROM tickets WHERE bet_slip_id LIKE 'VERIFY_075_%'`);
      await client.query(`DELETE FROM provider_offers WHERE id = $1`, [TEST_IDS.offer]);
      await client.query(`DELETE FROM participants WHERE id = $1`, [TEST_IDS.participant]);
      await client.query(`DELETE FROM canonical_events WHERE id = $1`, [TEST_IDS.event]);
      console.log('Test data cleaned up');
    });

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Setup:           ${testResults.setup ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Submit Provider: ${testResults.submitProvider ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Verify Writes:   ${testResults.verifyWrites ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Idempotency:     ${testResults.idempotency ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Fail-Closed:     ${testResults.failClosed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Cleanup:         ${testResults.cleanup ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = Object.values(testResults).every(v => v);

    if (allPassed) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ ALL TESTS PASSED - SPRINT-075 IS OPERATIONAL');
      console.log('='.repeat(60));
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('❌ SOME TESTS FAILED - SPRINT-075 NEEDS ATTENTION');
      console.log('='.repeat(60));
      process.exit(1);
    }

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ VERIFICATION FAILED:', error.message);
    console.error('='.repeat(60));
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
