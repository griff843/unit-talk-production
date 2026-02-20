#!/usr/bin/env node
/**
 * Verification Script for SPRINT-CANONICAL-V3-SCORING-074
 *
 * Tests:
 * 1. Create test ticket with 2 legs
 * 2. Write feature_snapshot for each leg
 * 3. Write scored_leg for each leg
 * 4. Re-run scoring with SAME computed_at → Expect idempotent (no dupes)
 * 5. Re-run scoring with NEW computed_at → Expect new rows
 * 6. Query latest views
 * 7. Query audit view
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTest(name, testFn) {
  console.log(`\n========== ${name} ==========`);
  try {
    const result = await testFn();
    console.log('✅ PASS');
    return result;
  } catch (error) {
    console.error('❌ FAIL:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');
    console.log('\n🔍 SPRINT-CANONICAL-V3-SCORING-074 VERIFICATION\n');

    let ticketId, leg1Id, leg2Id;
    const computedAt1 = new Date().toISOString();

    // SETUP: Create test event
    await runTest('SETUP: Create test event', async () => {
      await client.query(`
        INSERT INTO canonical_events (id, external_id, sport, league, event_type, scheduled_at, status)
        VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'TEST_EVENT_074', 'NBA', 'NBA', 'game', NOW() + INTERVAL '1 day', 'scheduled')
        ON CONFLICT (external_id) DO NOTHING
      `);
      console.log('Created test event');
    });

    // TEST 1: Create ticket with 2 legs
    await runTest('TEST 1: Create ticket with 2 legs', async () => {
      // Create ticket
      const ticketResult = await client.query(`
        INSERT INTO tickets (id, user_id, ticket_type, bet_slip_id, total_stake, status, source)
        VALUES (
          'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          '00000000-0000-0000-0000-000000000001',
          'parlay',
          'TEST_SLIP_074',
          100,
          'pending',
          'test'
        )
        ON CONFLICT (bet_slip_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `);
      ticketId = ticketResult.rows[0].id;
      console.log('Ticket ID:', ticketId);

      // Create leg 1
      const leg1Result = await client.query(`
        INSERT INTO ticket_legs (id, ticket_id, leg_index, event_id, selection, provider_line, provider_odds, provider)
        VALUES (
          'ffffffff-ffff-ffff-ffff-ffffffffffff',
          $1,
          0,
          'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'over',
          25.5,
          -110,
          'fanduel'
        )
        ON CONFLICT (ticket_id, leg_index) DO UPDATE SET provider_line = EXCLUDED.provider_line
        RETURNING id
      `, [ticketId]);
      leg1Id = leg1Result.rows[0].id;

      // Create leg 2
      const leg2Result = await client.query(`
        INSERT INTO ticket_legs (id, ticket_id, leg_index, event_id, selection, provider_line, provider_odds, provider)
        VALUES (
          '11111111-2222-3333-4444-555555555555',
          $1,
          1,
          'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'under',
          220.5,
          -105,
          'draftkings'
        )
        ON CONFLICT (ticket_id, leg_index) DO UPDATE SET provider_line = EXCLUDED.provider_line
        RETURNING id
      `, [ticketId]);
      leg2Id = leg2Result.rows[0].id;

      console.log('Leg 1 ID:', leg1Id);
      console.log('Leg 2 ID:', leg2Id);
    });

    // TEST 2: Score both legs using RPC
    await runTest('TEST 2: Score both legs using score_ticket_legs_v3', async () => {
      // Pass JSONB[] as array of stringified JSON objects
      const featureVectors = [
        JSON.stringify({ clv_at_bet: 0.02, historical_edge: 0.05, market_efficiency: 0.95 }),
        JSON.stringify({ clv_at_bet: -0.01, historical_edge: 0.03, market_efficiency: 0.92 })
      ];

      const scores = [
        JSON.stringify({ edge_score: 7.5, confidence_score: 0.82, tier: 'A', promotion_band: 'HARD', expected_value: 8.25 }),
        JSON.stringify({ edge_score: 5.2, confidence_score: 0.65, tier: 'B', promotion_band: 'SOFT', expected_value: 5.50 })
      ];

      const result = await client.query(`
        SELECT * FROM score_ticket_legs_v3(
          ARRAY[$1, $2]::UUID[],
          'edge_scorer_v3',
          'v3.2.1',
          ARRAY[$3::JSONB, $4::JSONB],
          ARRAY[$5::JSONB, $6::JSONB],
          $7::TIMESTAMPTZ
        )
      `, [leg1Id, leg2Id, featureVectors[0], featureVectors[1], scores[0], scores[1], computedAt1]);

      console.log('Scoring results:');
      result.rows.forEach(r => {
        console.log(`  Leg ${r.out_leg_id}: ${r.out_status} (fs=${r.out_feature_snapshot_id?.substring(0,8)}, sl=${r.out_scored_leg_id?.substring(0,8)})`);
      });

      const insertedCount = result.rows.filter(r => r.out_status === 'inserted').length;
      if (insertedCount !== 2) {
        throw new Error(`Expected 2 inserted, got ${insertedCount}`);
      }
    });

    // TEST 3: Verify view_scored_legs_latest
    await runTest('TEST 3: view_scored_legs_latest returns rows', async () => {
      const result = await client.query(`
        SELECT scored_leg_id, leg_id, model_name, model_version, edge_score, tier, bet_slip_id
        FROM view_scored_legs_latest
        WHERE bet_slip_id = 'TEST_SLIP_074'
        ORDER BY leg_id
      `);
      console.log(`Found ${result.rowCount} latest scores:`);
      result.rows.forEach(r => {
        console.log(`  - ${r.model_name} ${r.model_version}: edge=${r.edge_score}, tier=${r.tier}`);
      });

      if (result.rowCount !== 2) {
        throw new Error(`Expected 2 rows, got ${result.rowCount}`);
      }
    });

    // TEST 4: Idempotency - same timestamp should return 'exists'
    await runTest('TEST 4: Idempotency - same timestamp returns exists', async () => {
      const featureVectors = [
        JSON.stringify({ clv_at_bet: 0.02, historical_edge: 0.05, market_efficiency: 0.95 }),
        JSON.stringify({ clv_at_bet: -0.01, historical_edge: 0.03, market_efficiency: 0.92 })
      ];

      const scores = [
        JSON.stringify({ edge_score: 7.5, confidence_score: 0.82, tier: 'A', promotion_band: 'HARD' }),
        JSON.stringify({ edge_score: 5.2, confidence_score: 0.65, tier: 'B', promotion_band: 'SOFT' })
      ];

      const result = await client.query(`
        SELECT * FROM score_ticket_legs_v3(
          ARRAY[$1, $2]::UUID[],
          'edge_scorer_v3',
          'v3.2.1',
          ARRAY[$3::JSONB, $4::JSONB],
          ARRAY[$5::JSONB, $6::JSONB],
          $7::TIMESTAMPTZ
        )
      `, [leg1Id, leg2Id, featureVectors[0], featureVectors[1], scores[0], scores[1], computedAt1]);

      console.log('Idempotency check results:');
      result.rows.forEach(r => {
        console.log(`  Leg ${r.out_leg_id?.substring(0,8)}: ${r.out_status}`);
      });

      const existsCount = result.rows.filter(r => r.out_status === 'exists').length;
      if (existsCount !== 2) {
        throw new Error(`Expected 2 'exists', got ${existsCount}`);
      }

      // Verify no new rows created
      const countResult = await client.query(`
        SELECT COUNT(*) as cnt FROM scored_legs WHERE leg_id IN ($1, $2)
      `, [leg1Id, leg2Id]);
      console.log(`Total scored_legs rows: ${countResult.rows[0].cnt}`);

      if (parseInt(countResult.rows[0].cnt) !== 2) {
        throw new Error(`Expected 2 total rows (no dupes), got ${countResult.rows[0].cnt}`);
      }
    });

    // TEST 5: New timestamp creates new rows
    const computedAt2 = new Date(Date.now() + 60000).toISOString(); // +1 minute
    await runTest('TEST 5: New timestamp creates new rows', async () => {
      const featureVectors = [
        JSON.stringify({ clv_at_bet: 0.03, historical_edge: 0.06, market_efficiency: 0.96 }),
        JSON.stringify({ clv_at_bet: 0.00, historical_edge: 0.04, market_efficiency: 0.93 })
      ];

      const scores = [
        JSON.stringify({ edge_score: 8.0, confidence_score: 0.85, tier: 'A', promotion_band: 'HARD' }),
        JSON.stringify({ edge_score: 6.0, confidence_score: 0.70, tier: 'B', promotion_band: 'HARD' })
      ];

      const result = await client.query(`
        SELECT * FROM score_ticket_legs_v3(
          ARRAY[$1, $2]::UUID[],
          'edge_scorer_v3',
          'v3.2.1',
          ARRAY[$3::JSONB, $4::JSONB],
          ARRAY[$5::JSONB, $6::JSONB],
          $7::TIMESTAMPTZ
        )
      `, [leg1Id, leg2Id, featureVectors[0], featureVectors[1], scores[0], scores[1], computedAt2]);

      console.log('New timestamp results:');
      result.rows.forEach(r => {
        console.log(`  Leg ${r.out_leg_id?.substring(0,8)}: ${r.out_status}`);
      });

      const insertedCount = result.rows.filter(r => r.out_status === 'inserted').length;
      if (insertedCount !== 2) {
        throw new Error(`Expected 2 inserted, got ${insertedCount}`);
      }

      // Now should have 4 total rows
      const countResult = await client.query(`
        SELECT COUNT(*) as cnt FROM scored_legs WHERE leg_id IN ($1, $2)
      `, [leg1Id, leg2Id]);
      console.log(`Total scored_legs rows now: ${countResult.rows[0].cnt}`);

      if (parseInt(countResult.rows[0].cnt) !== 4) {
        throw new Error(`Expected 4 total rows, got ${countResult.rows[0].cnt}`);
      }
    });

    // TEST 6: is_latest flag updated correctly
    await runTest('TEST 6: is_latest flag updated correctly', async () => {
      const result = await client.query(`
        SELECT leg_id, computed_at, is_latest, edge_score
        FROM scored_legs
        WHERE leg_id IN ($1, $2)
        ORDER BY leg_id, computed_at DESC
      `, [leg1Id, leg2Id]);

      console.log('Scoring history:');
      result.rows.forEach(r => {
        console.log(`  ${r.leg_id.substring(0,8)}: edge=${r.edge_score}, is_latest=${r.is_latest}`);
      });

      // Only the most recent should be is_latest=true
      const latestCount = result.rows.filter(r => r.is_latest === true).length;
      if (latestCount !== 2) {
        throw new Error(`Expected 2 is_latest=true, got ${latestCount}`);
      }
    });

    // TEST 7: Verify view_scoring_audit
    await runTest('TEST 7: view_scoring_audit returns full trail', async () => {
      const result = await client.query(`
        SELECT leg_id, bet_slip_id, feature_snapshot_id, scored_leg_id, edge_score, tier, is_latest
        FROM view_scoring_audit
        WHERE bet_slip_id = 'TEST_SLIP_074'
        ORDER BY leg_id, scored_at DESC
      `);
      console.log(`Found ${result.rowCount} audit entries:`);
      result.rows.slice(0, 4).forEach(r => {
        console.log(`  - ${r.leg_id?.substring(0,8)}: edge=${r.edge_score}, tier=${r.tier}, latest=${r.is_latest}`);
      });

      if (result.rowCount < 4) {
        throw new Error(`Expected at least 4 audit rows, got ${result.rowCount}`);
      }
    });

    // TEST 8: Check indexes exist
    await runTest('TEST 8: Verify indexes exist', async () => {
      const result = await client.query(`
        SELECT tablename, indexname
        FROM pg_indexes
        WHERE tablename IN ('feature_snapshots', 'scored_legs')
        ORDER BY tablename, indexname
      `);
      console.log(`Found ${result.rowCount} indexes:`);
      result.rows.forEach(r => {
        console.log(`  ${r.tablename}.${r.indexname}`);
      });
    });

    // CLEANUP
    await runTest('CLEANUP: Remove test data', async () => {
      await client.query(`DELETE FROM scored_legs WHERE leg_id IN ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-2222-3333-4444-555555555555')`);
      await client.query(`DELETE FROM feature_snapshots WHERE leg_id IN ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-2222-3333-4444-555555555555')`);
      await client.query(`DELETE FROM ticket_legs WHERE ticket_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'`);
      await client.query(`DELETE FROM tickets WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'`);
      await client.query(`DELETE FROM canonical_events WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'`);
      console.log('Test data cleaned up');
    });

    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ VERIFICATION FAILED:', error.message);
    console.error('========================================\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
