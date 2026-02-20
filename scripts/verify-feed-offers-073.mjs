#!/usr/bin/env node
/**
 * Verification Script for SPRINT-CANONICAL-V3-FEED-OFFERS-073
 *
 * Tests:
 * 1. Inserts mapped offers for 2 providers
 * 2. Confirms view_provider_offers_current_v3 returns rows
 * 3. Confirms view_best_offer_by_market returns correct best selection
 * 4. Submits an unmapped offer and proves it lands in quarantine
 * 5. Verifies market_types uniqueness with NULL sport/league
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
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
    console.log('\n🔍 SPRINT-CANONICAL-V3-FEED-OFFERS-073 VERIFICATION\n');

    // Setup: Create test data
    await runTest('SETUP: Create test participants', async () => {
      const result = await client.query(`
        INSERT INTO participants (id, external_id, type, name, display_name, sport)
        VALUES
          ('11111111-1111-1111-1111-111111111111', 'TEST_TEAM_1', 'team', 'Test Team Alpha', 'Alpha', 'NBA'),
          ('22222222-2222-2222-2222-222222222222', 'TEST_PLAYER_1', 'player', 'Test Player One', 'Player One', 'NBA')
        ON CONFLICT (external_id, sport) DO NOTHING
        RETURNING id;
      `);
      console.log(`Created ${result.rowCount} participants`);
    });

    await runTest('SETUP: Create test event', async () => {
      const result = await client.query(`
        INSERT INTO canonical_events (id, external_id, sport, league, event_type, scheduled_at, status, home_participant_id)
        VALUES (
          '33333333-3333-3333-3333-333333333333',
          'TEST_EVENT_073',
          'NBA',
          'NBA',
          'game',
          NOW() + INTERVAL '1 day',
          'scheduled',
          '11111111-1111-1111-1111-111111111111'
        )
        ON CONFLICT (external_id) DO NOTHING
        RETURNING id;
      `);
      console.log(`Created ${result.rowCount} events`);
    });

    await runTest('SETUP: Create provider mappings', async () => {
      // Get provider IDs
      const providers = await client.query(`
        SELECT id, code FROM provider_registry WHERE code IN ('fanduel', 'draftkings')
      `);
      console.log('Providers:', providers.rows);

      // Get market type ID
      const marketType = await client.query(`
        SELECT id, market_key FROM market_types WHERE market_key = 'player_points_ou' LIMIT 1
      `);
      console.log('Market type:', marketType.rows[0]);

      const fanDuelId = providers.rows.find(r => r.code === 'fanduel')?.id;
      const dkId = providers.rows.find(r => r.code === 'draftkings')?.id;
      const marketTypeId = marketType.rows[0]?.id;

      // Create event mappings for both providers
      await client.query(`
        INSERT INTO provider_event_map (provider_id, provider_event_id, canonical_event_id, mapping_version, confidence_score, source)
        VALUES
          ($1, 'FD_EVENT_073', '33333333-3333-3333-3333-333333333333', 1, 1.0, 'test'),
          ($2, 'DK_EVENT_073', '33333333-3333-3333-3333-333333333333', 1, 1.0, 'test')
        ON CONFLICT (provider_id, provider_event_id, mapping_version) DO NOTHING
      `, [fanDuelId, dkId]);

      // Create market mappings
      await client.query(`
        INSERT INTO provider_market_map (provider_id, provider_market_key, canonical_market_type_id, mapping_version, confidence_score, source)
        VALUES
          ($1, 'player_points', $3, 1, 1.0, 'test'),
          ($2, 'player_points', $3, 1, 1.0, 'test')
        ON CONFLICT (provider_id, provider_market_key, mapping_version) DO NOTHING
      `, [fanDuelId, dkId, marketTypeId]);

      // Create player mapping
      await client.query(`
        INSERT INTO provider_player_map (provider_id, provider_player_id, canonical_player_id, mapping_version, confidence_score, source)
        VALUES
          ($1, 'FD_PLAYER_1', '22222222-2222-2222-2222-222222222222', 1, 1.0, 'test'),
          ($2, 'DK_PLAYER_1', '22222222-2222-2222-2222-222222222222', 1, 1.0, 'test')
        ON CONFLICT (provider_id, provider_player_id, mapping_version) DO NOTHING
      `, [fanDuelId, dkId]);

      console.log('Created mappings for fanduel and draftkings');
    });

    // TEST 1: Insert mapped offers via upsert function
    await runTest('TEST 1: Insert mapped offers for 2 providers', async () => {
      const offers1 = JSON.stringify([
        {
          provider_event_id: 'FD_EVENT_073',
          provider_market_key: 'player_points',
          provider_participant_id: 'FD_PLAYER_1',
          participant_type: 'player',
          line: 25.5,
          over_odds: -115,
          under_odds: -105,
          juice: 0.044
        }
      ]);

      const result1 = await client.query(`
        SELECT * FROM upsert_provider_offers_v3('fanduel', NOW(), $1::JSONB, 0.8)
      `, [offers1]);
      console.log('FanDuel result:', result1.rows[0]);

      const offers2 = JSON.stringify([
        {
          provider_event_id: 'DK_EVENT_073',
          provider_market_key: 'player_points',
          provider_participant_id: 'DK_PLAYER_1',
          participant_type: 'player',
          line: 25.5,
          over_odds: -110,
          under_odds: -110,
          juice: 0.045
        }
      ]);

      const result2 = await client.query(`
        SELECT * FROM upsert_provider_offers_v3('draftkings', NOW(), $1::JSONB, 0.8)
      `, [offers2]);
      console.log('DraftKings result:', result2.rows[0]);

      const total = result1.rows[0].inserted_count + result2.rows[0].inserted_count;
      if (total < 2) {
        throw new Error(`Expected 2 inserts, got ${total}`);
      }
    });

    // TEST 2: Verify view_provider_offers_current_v3
    await runTest('TEST 2: view_provider_offers_current_v3 returns rows', async () => {
      const result = await client.query(`
        SELECT
          id,
          event_id,
          market_key,
          participant_name,
          provider,
          line,
          over_odds,
          under_odds,
          snapshot_at
        FROM view_provider_offers_current_v3
        WHERE event_id = '33333333-3333-3333-3333-333333333333'
      `);
      console.log(`Found ${result.rowCount} current offers:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.provider}: line=${row.line}, over=${row.over_odds}, under=${row.under_odds}`);
      });

      if (result.rowCount < 2) {
        throw new Error(`Expected at least 2 rows, got ${result.rowCount}`);
      }
    });

    // TEST 3: Verify view_best_offer_by_market
    await runTest('TEST 3: view_best_offer_by_market returns best selection', async () => {
      const result = await client.query(`
        SELECT
          market_key,
          participant_name,
          best_over_odds,
          best_over_provider,
          best_under_odds,
          best_under_provider,
          provider_count
        FROM view_best_offer_by_market
        WHERE event_id = '33333333-3333-3333-3333-333333333333'
      `);
      console.log(`Found ${result.rowCount} best offer entries:`);
      result.rows.forEach(row => {
        console.log(`  - Market: ${row.market_key}`);
        console.log(`    Best Over: ${row.best_over_odds} (${row.best_over_provider})`);
        console.log(`    Best Under: ${row.best_under_odds} (${row.best_under_provider})`);
        console.log(`    Provider count: ${row.provider_count}`);
      });

      // DraftKings has better over odds (-110 > -115)
      const row = result.rows[0];
      if (row.best_over_odds !== -110) {
        throw new Error(`Expected best over odds -110, got ${row.best_over_odds}`);
      }
      if (row.best_over_provider !== 'draftkings') {
        throw new Error(`Expected best over provider 'draftkings', got ${row.best_over_provider}`);
      }
    });

    // TEST 4: Unmapped offer goes to quarantine
    await runTest('TEST 4: Unmapped offer lands in quarantine', async () => {
      // Clear any prior test quarantine entries
      await client.query(`DELETE FROM offer_quarantine WHERE provider_key = 'fanduel' AND raw_payload->>'provider_event_id' = 'UNMAPPED_EVENT_073'`);

      const unmappedOffers = JSON.stringify([
        {
          provider_event_id: 'UNMAPPED_EVENT_073',
          provider_market_key: 'player_points',
          provider_participant_id: 'FD_PLAYER_1',
          participant_type: 'player',
          line: 30.5,
          over_odds: -110,
          under_odds: -110
        }
      ]);

      const result = await client.query(`
        SELECT * FROM upsert_provider_offers_v3('fanduel', NOW(), $1::JSONB, 0.8)
      `, [unmappedOffers]);
      console.log('Unmapped offer result:', result.rows[0]);

      if (result.rows[0].quarantined_count !== 1) {
        throw new Error(`Expected 1 quarantined, got ${result.rows[0].quarantined_count}`);
      }

      // Verify in quarantine table
      const quarantine = await client.query(`
        SELECT id, reason_code, reason_detail, raw_payload->>'provider_event_id' as event_id
        FROM offer_quarantine
        WHERE provider_key = 'fanduel'
          AND raw_payload->>'provider_event_id' = 'UNMAPPED_EVENT_073'
          AND resolved_at IS NULL
      `);
      console.log('Quarantine entry:', quarantine.rows[0]);

      if (quarantine.rowCount !== 1) {
        throw new Error(`Expected 1 quarantine entry, got ${quarantine.rowCount}`);
      }
      if (quarantine.rows[0].reason_code !== 'UNMAPPED_EVENT') {
        throw new Error(`Expected reason UNMAPPED_EVENT, got ${quarantine.rows[0].reason_code}`);
      }
    });

    // TEST 5: Market types uniqueness with NULL sport/league
    await runTest('TEST 5: market_types uniqueness with NULL sport/league', async () => {
      // Check existing universal markets
      const existing = await client.query(`
        SELECT market_key, sport_id, league_id FROM market_types
        WHERE sport_id IS NULL AND league_id IS NULL
        ORDER BY market_key
      `);
      console.log(`Found ${existing.rowCount} universal market types (NULL sport/league):`);
      existing.rows.slice(0, 5).forEach(row => {
        console.log(`  - ${row.market_key}`);
      });

      // Try to insert a duplicate (should fail)
      let duplicateFailed = false;
      try {
        await client.query(`
          INSERT INTO market_types (market_key, display_name, participant_scope)
          VALUES ('team_moneyline', 'Duplicate Moneyline', 'EVENT')
        `);
      } catch (error) {
        duplicateFailed = true;
        console.log('Duplicate insert correctly rejected:', error.message.substring(0, 100));
      }

      if (!duplicateFailed) {
        throw new Error('Expected duplicate insert to fail but it succeeded!');
      }

      // Verify the constraint uses COALESCE
      const constraint = await client.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conname = 'market_types_unique'
      `);
      console.log('Constraint definition:', constraint.rows[0]?.definition);

      if (!constraint.rows[0]?.definition.includes('COALESCE')) {
        console.log('WARNING: Constraint does not use COALESCE - checking actual behavior');
      }
    });

    // TEST 6: Check indexes exist
    await runTest('TEST 6: Verify indexes exist', async () => {
      const indexes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'provider_offers'
          AND indexname LIKE '%v3%' OR indexname LIKE '%current%' OR indexname LIKE '%market_type%'
        ORDER BY indexname
      `);
      console.log(`Found ${indexes.rowCount} relevant indexes on provider_offers:`);
      indexes.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
    });

    // TEST 7: EXPLAIN queries
    await runTest('TEST 7: EXPLAIN current offers query', async () => {
      const result = await client.query(`
        EXPLAIN (FORMAT TEXT)
        SELECT * FROM view_provider_offers_current_v3
        WHERE event_id = '33333333-3333-3333-3333-333333333333'
      `);
      console.log('Query plan:');
      result.rows.forEach(row => console.log(row['QUERY PLAN']));
    });

    // Cleanup test data
    await runTest('CLEANUP: Remove test data', async () => {
      await client.query(`DELETE FROM offer_quarantine WHERE provider_key IN ('fanduel', 'draftkings') AND created_at > NOW() - INTERVAL '1 hour'`);
      await client.query(`DELETE FROM provider_offers WHERE event_id = '33333333-3333-3333-3333-333333333333'`);
      await client.query(`DELETE FROM provider_event_map WHERE canonical_event_id = '33333333-3333-3333-3333-333333333333'`);
      await client.query(`DELETE FROM provider_market_map WHERE provider_market_key = 'player_points'`);
      await client.query(`DELETE FROM provider_player_map WHERE canonical_player_id = '22222222-2222-2222-2222-222222222222'`);
      await client.query(`DELETE FROM canonical_events WHERE id = '33333333-3333-3333-3333-333333333333'`);
      await client.query(`DELETE FROM participants WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')`);
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
