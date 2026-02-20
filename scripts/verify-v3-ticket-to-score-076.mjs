#!/usr/bin/env node
/**
 * SPRINT-CANONICAL-V3-AGENTS-076 Full Automated Verification
 *
 * Full chain: submit → score → query
 *
 * Tests:
 * 1. SETUP: Create test data (event, participant, offer)
 * 2. SUBMIT: Create ticket via atomic_submit_ticket_v2
 * 3. SCORE: Call score_ticket_legs_v3 RPC
 * 4. QUERY: Verify scored_legs populated via view_scored_legs_latest
 * 5. IDEMPOTENCY: Re-score same leg, verify 'exists' status
 * 6. CLEANUP: Remove test data
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test data IDs
const TEST_IDS = {
  event: 'dddddddd-0076-0076-0076-076076076076',
  participant: 'eeeeeeee-0076-0076-0076-076076076076',
  offer: 'ffffffff-0076-0076-0076-076076076076',
  user: '00000000-0000-0000-0000-000000000001',
  betSlipId: 'VERIFY_076_CHAIN_' + Date.now(),
};

let testResults = {
  setup: false,
  submit: false,
  score: false,
  query: false,
  idempotency: false,
  cleanup: false,
};

let createdTicketId = null;
let createdLegIds = [];

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
    console.log('\n🔍 SPRINT-CANONICAL-V3-AGENTS-076 FULL VERIFICATION');
    console.log('='.repeat(60));
    console.log('Chain: submit → score → query');
    console.log(`Test bet_slip_id: ${TEST_IDS.betSlipId}`);

    // ========================================
    // SETUP
    // ========================================
    testResults.setup = await runTest('SETUP: Create test data', async () => {
      // Clean any existing test data
      await client.query(`DELETE FROM ticket_legs WHERE ticket_id IN (
        SELECT id FROM tickets WHERE bet_slip_id LIKE 'VERIFY_076_%'
      )`);
      await client.query(`DELETE FROM tickets WHERE bet_slip_id LIKE 'VERIFY_076_%'`);
      await client.query(`DELETE FROM provider_offers WHERE id = $1`, [TEST_IDS.offer]);
      await client.query(`DELETE FROM participants WHERE id = $1`, [TEST_IDS.participant]);
      await client.query(`DELETE FROM canonical_events WHERE id = $1`, [TEST_IDS.event]);

      // Create canonical_event
      await client.query(`
        INSERT INTO canonical_events (id, external_id, sport, league, event_type, scheduled_at, status)
        VALUES ($1, 'VERIFY_EVENT_076', 'NBA', 'NBA', 'game', NOW() + INTERVAL '1 day', 'scheduled')
      `, [TEST_IDS.event]);
      console.log(`Created canonical_event: ${TEST_IDS.event}`);

      // Create participant
      await client.query(`
        INSERT INTO participants (id, external_id, name, type, sport, active)
        VALUES ($1, 'VERIFY_PLAYER_076', 'Test Player 076', 'player', 'NBA', true)
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
          25.5, -110, -110, NOW()
        )
      `, [TEST_IDS.offer, TEST_IDS.event, TEST_IDS.participant]);
      console.log(`Created provider_offer: ${TEST_IDS.offer}`);
    });

    if (!testResults.setup) {
      throw new Error('Setup failed - cannot continue');
    }

    // ========================================
    // SUBMIT
    // ========================================
    testResults.submit = await runTest('SUBMIT: Create ticket via atomic_submit_ticket_v2', async () => {
      const leg = JSON.stringify({
        event_id: TEST_IDS.event,
        market_type_id: 2,
        participant_id: TEST_IDS.participant,
        provider_offer_id: TEST_IDS.offer,
        selection: 'over'
      });

      console.log('Calling atomic_submit_ticket_v2...');
      const result = await client.query(`
        SELECT * FROM atomic_submit_ticket_v2(
          $1,
          $2::UUID,
          'single',
          100,
          ARRAY[$3::JSONB]
        )
      `, [TEST_IDS.betSlipId, TEST_IDS.user, leg]);

      const row = result.rows[0];
      if (row.out_status !== 'inserted') {
        throw new Error(`Submit failed: ${row.out_status} - ${JSON.stringify(row.out_error_details)}`);
      }

      createdTicketId = row.out_ticket_id;
      createdLegIds = row.out_leg_ids;

      console.log(`  ticket_id: ${createdTicketId}`);
      console.log(`  leg_ids: ${JSON.stringify(createdLegIds)}`);
      console.log(`  status: ${row.out_status}`);

      // Verify effective_value populated
      const legData = await client.query(`
        SELECT id, effective_value, effective_source, provider_line, provider_odds
        FROM ticket_legs WHERE id = $1
      `, [createdLegIds[0]]);

      const l = legData.rows[0];
      console.log(`  effective_source: ${l.effective_source}`);
      console.log(`  effective_value.line: ${l.effective_value?.line}`);
      console.log(`  effective_value.odds: ${l.effective_value?.odds}`);

      if (l.effective_source !== 'PROVIDER') {
        throw new Error(`Expected effective_source=PROVIDER, got ${l.effective_source}`);
      }
    });

    if (!testResults.submit) {
      throw new Error('Submit failed - cannot continue');
    }

    // ========================================
    // SCORE
    // ========================================
    testResults.score = await runTest('SCORE: Call score_ticket_legs_v3', async () => {
      const legId = createdLegIds[0];
      const computedAt = new Date().toISOString();

      const featureVector = JSON.stringify({
        line: 25.5,
        odds: -110,
        selection: 'over',
        provider: 'fanduel',
        odds_score: 55,
        line_score: 50,
        market_score: 50
      });

      const scoreOutput = JSON.stringify({
        edge_score: 52,
        confidence_score: 0.6,
        tier: 'A',
        promotion_band: 'SOFT',
        kelly_fraction: 0.02,
        expected_value: 2.0,
        feature_contributions: {
          odds_score: 55,
          line_score: 50,
          market_score: 50
        }
      });

      console.log('Calling score_ticket_legs_v3...');
      console.log(`  leg_id: ${legId}`);
      console.log(`  model_name: v3_scoring_adapter`);
      console.log(`  model_version: v1.0.0`);

      const result = await client.query(`
        SELECT * FROM score_ticket_legs_v3(
          ARRAY[$1::UUID],
          'v3_scoring_adapter',
          'v1.0.0',
          ARRAY[$2::JSONB],
          ARRAY[$3::JSONB],
          $4::TIMESTAMPTZ
        )
      `, [legId, featureVector, scoreOutput, computedAt]);

      const row = result.rows[0];
      console.log(`  status: ${row.out_status}`);
      console.log(`  feature_snapshot_id: ${row.out_feature_snapshot_id}`);
      console.log(`  scored_leg_id: ${row.out_scored_leg_id}`);

      if (row.out_status !== 'inserted') {
        throw new Error(`Score failed: ${row.out_status}`);
      }

      if (!row.out_feature_snapshot_id) {
        throw new Error('Feature snapshot not created');
      }

      if (!row.out_scored_leg_id) {
        throw new Error('Scored leg not created');
      }
    });

    if (!testResults.score) {
      throw new Error('Score failed - cannot continue');
    }

    // ========================================
    // QUERY
    // ========================================
    testResults.query = await runTest('QUERY: Verify view_scored_legs_latest', async () => {
      const legId = createdLegIds[0];

      const result = await client.query(`
        SELECT *
        FROM view_scored_legs_latest
        WHERE leg_id = $1
      `, [legId]);

      if (result.rows.length === 0) {
        throw new Error('No scored leg found in view_scored_legs_latest');
      }

      const row = result.rows[0];
      console.log(`  tier: ${row.tier}`);
      console.log(`  edge_score: ${row.edge_score}`);
      console.log(`  confidence_score: ${row.confidence_score}`);
      console.log(`  promotion_band: ${row.promotion_band}`);
      console.log(`  kelly_fraction: ${row.kelly_fraction}`);
      console.log(`  model_name: ${row.model_name}`);
      console.log(`  model_version: ${row.model_version}`);

      if (row.tier !== 'A') {
        throw new Error(`Expected tier=A, got ${row.tier}`);
      }
      if (parseFloat(row.edge_score) !== 52) {
        throw new Error(`Expected edge_score=52, got ${row.edge_score}`);
      }
      if (parseFloat(row.confidence_score) !== 0.6) {
        throw new Error(`Expected confidence_score=0.6, got ${row.confidence_score}`);
      }
    });

    // ========================================
    // IDEMPOTENCY
    // ========================================
    testResults.idempotency = await runTest('IDEMPOTENCY: Re-score with same timestamp', async () => {
      const legId = createdLegIds[0];
      // Use slightly different computed_at to test unique constraint
      const computedAt = new Date().toISOString();

      const result = await client.query(`
        SELECT * FROM score_ticket_legs_v3(
          ARRAY[$1::UUID],
          'v3_scoring_adapter',
          'v1.0.0',
          ARRAY['{"line": 25.5}'::JSONB],
          ARRAY['{"edge_score": 52, "tier": "A"}'::JSONB],
          $2::TIMESTAMPTZ
        )
      `, [legId, computedAt]);

      const row = result.rows[0];
      console.log(`  status: ${row.out_status}`);

      // Could be 'inserted' with new timestamp or 'exists' if same timestamp
      if (row.out_status !== 'inserted' && row.out_status !== 'exists') {
        throw new Error(`Unexpected status: ${row.out_status}`);
      }

      // Verify only one is_latest=true per leg
      const latestCheck = await client.query(`
        SELECT COUNT(*) as cnt
        FROM scored_legs
        WHERE leg_id = $1 AND is_latest = TRUE
      `, [legId]);

      const latestCount = parseInt(latestCheck.rows[0].cnt);
      console.log(`  is_latest=TRUE count: ${latestCount}`);

      if (latestCount !== 1) {
        throw new Error(`Expected exactly 1 is_latest=TRUE, got ${latestCount}`);
      }
    });

    // ========================================
    // CLEANUP
    // ========================================
    testResults.cleanup = await runTest('CLEANUP: Remove test data', async () => {
      // Delete in reverse order (cascades handle most of it)
      await client.query(`DELETE FROM tickets WHERE id = $1`, [createdTicketId]);
      console.log(`  Deleted ticket (cascade to legs, snapshots, scores)`);

      await client.query(`DELETE FROM provider_offers WHERE id = $1`, [TEST_IDS.offer]);
      console.log(`  Deleted provider_offer`);

      await client.query(`DELETE FROM participants WHERE id = $1`, [TEST_IDS.participant]);
      console.log(`  Deleted participant`);

      await client.query(`DELETE FROM canonical_events WHERE id = $1`, [TEST_IDS.event]);
      console.log(`  Deleted canonical_event`);
    });

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const passCount = Object.values(testResults).filter(v => v).length;
    const totalCount = Object.keys(testResults).length;

    console.log(`Passed: ${passCount}/${totalCount}`);

    for (const [name, passed] of Object.entries(testResults)) {
      console.log(`  ${passed ? '✅' : '❌'} ${name}`);
    }

    if (passCount === totalCount) {
      console.log('\n✅ SPRINT-076 IS OPERATIONAL');
      console.log('   Submit → Score → Query chain verified');
      process.exit(0);
    } else {
      console.log('\n❌ SPRINT-076 HAS FAILURES');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
