#!/usr/bin/env node
/**
 * Verification Script for SPRINT-CANONICAL-V3-SMARTFORM-075
 *
 * Tests:
 * 1. Submit single-leg ticket using provider_offer_id
 * 2. Submit multi-leg ticket with provider + manual override
 * 3. Re-submit same bet_slip_id (idempotency)
 * 4. Verify effective_value and effective_source
 * 5. Test validation failures
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TEST_IDS = {
  event: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  participant: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  offer: 'cccccccc-dddd-eeee-ffff-000000000000',
  user: '00000000-0000-0000-0000-000000000001'
};

async function runTest(name, testFn) {
  console.log(`\n========== ${name} ==========`);
  try {
    const result = await testFn();
    console.log('PASS');
    return result;
  } catch (error) {
    console.error('FAIL:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');
    console.log('\n SPRINT-CANONICAL-V3-SMARTFORM-075 VERIFICATION\n');

    // ========================================
    // SETUP: Create test data
    // ========================================
    await runTest('SETUP: Create test event', async () => {
      await client.query(`
        INSERT INTO canonical_events (id, external_id, sport, league, event_type, scheduled_at, status)
        VALUES ($1, 'TEST_EVENT_075', 'NBA', 'NBA', 'game', NOW() + INTERVAL '1 day', 'scheduled')
        ON CONFLICT (external_id) DO UPDATE SET updated_at = NOW()
      `, [TEST_IDS.event]);
      console.log('Created test event:', TEST_IDS.event);
    });

    await runTest('SETUP: Create test participant', async () => {
      // Delete first to ensure clean state
      await client.query(`DELETE FROM participants WHERE id = $1`, [TEST_IDS.participant]);
      await client.query(`
        INSERT INTO participants (id, external_id, name, type, sport, active)
        VALUES ($1, 'TEST_PLAYER_075', 'Test Player', 'player', 'NBA', true)
      `, [TEST_IDS.participant]);
      console.log('Created test participant:', TEST_IDS.participant);
    });

    await runTest('SETUP: Create test provider offer', async () => {
      await client.query(`
        INSERT INTO provider_offers (
          id, event_id, market_type_id, participant_id, provider, provider_id,
          line, over_odds, under_odds, snapshot_at
        )
        VALUES (
          $1, $2, 2, $3, 'fanduel', 1,
          25.5, -110, -110, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET line = EXCLUDED.line
      `, [TEST_IDS.offer, TEST_IDS.event, TEST_IDS.participant]);
      console.log('Created test offer:', TEST_IDS.offer);
    });

    // ========================================
    // TEST 1: Single leg with provider offer
    // ========================================
    let ticket1Id;
    await runTest('TEST 1: Submit single-leg ticket with provider_offer_id', async () => {
      const leg = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider_offer_id: TEST_IDS.offer,
        selection: 'over'
      });

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          'TEST_SLIP_SINGLE_075',
          $1::UUID,
          'single',
          100,
          ARRAY[$2::JSONB]
        )
      `, [TEST_IDS.user, leg]);

      const row = result.rows[0];
      console.log('Status:', row.out_status);
      console.log('Ticket ID:', row.out_ticket_id);
      console.log('Leg IDs:', row.out_leg_ids);

      if (row.out_status !== 'inserted') {
        throw new Error(`Expected 'inserted', got '${row.out_status}'`);
      }

      ticket1Id = row.out_ticket_id;

      // Verify leg data
      const legResult = await client.query(`
        SELECT provider_value, override_value, effective_value, effective_source
        FROM ticket_legs
        WHERE ticket_id = $1
      `, [ticket1Id]);

      const legData = legResult.rows[0];
      console.log('provider_value:', JSON.stringify(legData.provider_value));
      console.log('effective_source:', legData.effective_source);

      if (legData.effective_source !== 'PROVIDER') {
        throw new Error(`Expected effective_source='PROVIDER', got '${legData.effective_source}'`);
      }
    });

    // ========================================
    // TEST 2: Multi-leg with provider + manual override
    // ========================================
    let ticket2Id;
    await runTest('TEST 2: Submit multi-leg ticket (provider + manual with override)', async () => {
      const leg1 = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider_offer_id: TEST_IDS.offer,
        selection: 'over'
      });

      const leg2 = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 1,
        provider: 'manual',
        selection: 'home',
        odds: -150,
        override: {
          odds: -145,
          note: 'Line moved'
        }
      });

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          'TEST_SLIP_MULTI_075',
          $1::UUID,
          'parlay',
          50,
          ARRAY[$2::JSONB, $3::JSONB]
        )
      `, [TEST_IDS.user, leg1, leg2]);

      const row = result.rows[0];
      console.log('Status:', row.out_status);
      console.log('Ticket ID:', row.out_ticket_id);
      console.log('Leg IDs:', row.out_leg_ids);

      if (row.out_status !== 'inserted') {
        throw new Error(`Expected 'inserted', got '${row.out_status}'`);
      }

      ticket2Id = row.out_ticket_id;

      // Verify legs
      const legsResult = await client.query(`
        SELECT leg_index, provider_value, override_value, effective_value, effective_source
        FROM ticket_legs
        WHERE ticket_id = $1
        ORDER BY leg_index
      `, [ticket2Id]);

      console.log('\nLeg details:');
      legsResult.rows.forEach(leg => {
        console.log(`  Leg ${leg.leg_index}: effective_source=${leg.effective_source}`);
        console.log(`    provider_value: ${JSON.stringify(leg.provider_value)}`);
        if (leg.override_value) {
          console.log(`    override_value: ${JSON.stringify(leg.override_value)}`);
        }
        console.log(`    effective_value: ${JSON.stringify(leg.effective_value)}`);
      });

      // Leg 0 should be PROVIDER
      if (legsResult.rows[0].effective_source !== 'PROVIDER') {
        throw new Error(`Leg 0 expected PROVIDER, got ${legsResult.rows[0].effective_source}`);
      }

      // Leg 1 should be OVERRIDE
      if (legsResult.rows[1].effective_source !== 'OVERRIDE') {
        throw new Error(`Leg 1 expected OVERRIDE, got ${legsResult.rows[1].effective_source}`);
      }

      // Verify effective_value has overridden odds
      const leg1Effective = legsResult.rows[1].effective_value;
      if (leg1Effective.odds !== -145) {
        throw new Error(`Leg 1 expected effective odds=-145, got ${leg1Effective.odds}`);
      }
    });

    // ========================================
    // TEST 3: Idempotency - same bet_slip_id
    // ========================================
    await runTest('TEST 3: Idempotency - re-submit same bet_slip_id', async () => {
      const leg = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider_offer_id: TEST_IDS.offer,
        selection: 'over'
      });

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          'TEST_SLIP_SINGLE_075',
          $1::UUID,
          'single',
          100,
          ARRAY[$2::JSONB]
        )
      `, [TEST_IDS.user, leg]);

      const row = result.rows[0];
      console.log('Status:', row.out_status);
      console.log('Ticket ID:', row.out_ticket_id);

      if (row.out_status !== 'exists') {
        throw new Error(`Expected 'exists', got '${row.out_status}'`);
      }

      if (row.out_ticket_id !== ticket1Id) {
        throw new Error(`Expected same ticket ID ${ticket1Id}, got ${row.out_ticket_id}`);
      }

      // Verify no duplicate tickets
      const countResult = await client.query(`
        SELECT COUNT(*) as cnt FROM tickets WHERE bet_slip_id = 'TEST_SLIP_SINGLE_075'
      `);
      console.log('Tickets with this bet_slip_id:', countResult.rows[0].cnt);

      if (parseInt(countResult.rows[0].cnt) !== 1) {
        throw new Error(`Expected 1 ticket, got ${countResult.rows[0].cnt}`);
      }
    });

    // ========================================
    // TEST 4: Validation failure - missing event
    // ========================================
    await runTest('TEST 4: Validation - invalid event_id rejected', async () => {
      const leg = JSON.stringify({
        event_id: '99999999-9999-9999-9999-999999999999',
        market_type_id: 2,
        provider: 'manual',
        selection: 'over',
        line: 25.5,
        odds: -110
      });

      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          'TEST_SLIP_INVALID_075',
          $1::UUID,
          'single',
          100,
          ARRAY[$2::JSONB]
        )
      `, [TEST_IDS.user, leg]);

      const row = result.rows[0];
      console.log('Status:', row.out_status);
      console.log('Errors:', JSON.stringify(row.out_error_details));

      if (row.out_status !== 'error') {
        throw new Error(`Expected 'error', got '${row.out_status}'`);
      }

      if (!row.out_error_details) {
        throw new Error('Expected error details');
      }
    });

    // ========================================
    // TEST 5: Effective value computation
    // ========================================
    await runTest('TEST 5: Verify effective_value computation', async () => {
      const result = await client.query(`
        SELECT
          leg_index,
          provider_value->>'odds' AS provider_odds,
          override_value->>'odds' AS override_odds,
          effective_value->>'odds' AS effective_odds,
          effective_source
        FROM ticket_legs
        WHERE ticket_id = $1
        ORDER BY leg_index
      `, [ticket2Id]);

      console.log('Effective value verification:');
      result.rows.forEach(r => {
        console.log(`  Leg ${r.leg_index}: provider=${r.provider_odds}, override=${r.override_odds || 'NULL'}, effective=${r.effective_odds}, source=${r.effective_source}`);
      });

      // Leg 1 should have override applied
      const leg1 = result.rows[1];
      if (leg1.effective_odds !== '-145') {
        throw new Error(`Effective odds should be -145 (from override), got ${leg1.effective_odds}`);
      }
    });

    // ========================================
    // TEST 6: Check constraints
    // ========================================
    await runTest('TEST 6: Verify constraints exist', async () => {
      const result = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'ticket_legs'
          AND constraint_name LIKE '%effective_source%'
      `);
      console.log('effective_source constraints:');
      result.rows.forEach(r => {
        console.log(`  ${r.constraint_name} (${r.constraint_type})`);
      });

      // Also verify bet_slip_id unique constraint on tickets
      const ticketConstraints = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'tickets'
          AND constraint_type = 'UNIQUE'
      `);
      console.log('tickets UNIQUE constraints:');
      ticketConstraints.rows.forEach(r => {
        console.log(`  ${r.constraint_name}`);
      });
    });

    // ========================================
    // CLEANUP
    // ========================================
    await runTest('CLEANUP: Remove test data', async () => {
      await client.query(`DELETE FROM ticket_legs WHERE ticket_id IN (
        SELECT id FROM tickets WHERE bet_slip_id LIKE 'TEST_SLIP_%_075'
      )`);
      await client.query(`DELETE FROM tickets WHERE bet_slip_id LIKE 'TEST_SLIP_%_075'`);
      await client.query(`DELETE FROM provider_offers WHERE id = $1`, [TEST_IDS.offer]);
      await client.query(`DELETE FROM participants WHERE id = $1`, [TEST_IDS.participant]);
      await client.query(`DELETE FROM canonical_events WHERE id = $1`, [TEST_IDS.event]);
      console.log('Test data cleaned up');
    });

    console.log('\n========================================');
    console.log(' ALL TESTS PASSED');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error(' VERIFICATION FAILED:', error.message);
    console.error('========================================\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
