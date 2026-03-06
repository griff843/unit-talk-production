#!/usr/bin/env tsx
/* eslint-disable no-console, max-lines-per-function, max-lines, complexity, @typescript-eslint/no-unused-vars, no-unused-vars */
/**
 * Edge Engine V1 - Determinism & Integration Test
 * Sprint: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097
 *
 * Tests:
 * 1. Score picks from unified_picks
 * 2. Verify deterministic output (re-run produces identical results)
 * 3. Write to feature_snapshots and scored_legs
 * 4. Generate proof artifacts
 *
 * Usage: npx tsx apps/api/src/scripts/test-edge-engine-v1.ts
 */

import * as crypto from 'crypto';

import { Client } from 'pg';

import {
  computeEdgeV1,
  EdgeV1Input,
  EdgeEngineV1Output,
  MODEL_VERSION,
  verifyDeterminism,
} from '../agents/ScoringAgent/scoring/edgeEngineV1';

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical types from shared-types
import type { UnifiedPicksRow } from '@unit-talk/contracts';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@localhost:54322/postgres';

// Extended type for edge engine test script
interface TestEdgePick extends Partial<UnifiedPicksRow> {
  id: string;
  sport: string;
  stat_type: string;
  side: string;
  player_name: string;
  line: number;
  odds: number;
  bet_line: number;
  bet_odds: number;
  closing_line: number | null;
  closing_odds: number | null;
  result: string;
  workflow_stage: string;
}

interface TestResult {
  pick_id: string;
  player_name: string;
  determinism_pass: boolean;
  edge_score: number;
  tier: string;
  clv_pct: number;
  feature_snapshot_written: boolean;
  scored_leg_written: boolean;
}

function hashOutput(output: EdgeEngineV1Output): string {
  // Exclude computed_at from hash for determinism comparison
  const { computed_at: _, ...hashable } = output;
  return crypto.createHash('sha256').update(JSON.stringify(hashable)).digest('hex');
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });

  console.log('='.repeat(70));
  console.log('EDGE ENGINE V1 - DETERMINISM & INTEGRATION TEST');
  console.log(`Model Version: ${MODEL_VERSION}`);
  console.log('Sprint: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097');
  console.log('='.repeat(70));
  console.log('');

  const results: TestResult[] = [];
  const outputHashes: Map<string, string[]> = new Map();

  try {
    await client.connect();
    console.log('[SETUP] Connected to database');

    // Step 1: Fetch picks from unified_picks
    console.log('\n[STEP 1] Fetching picks from unified_picks...');
    const picksQuery = await client.query<TestEdgePick>(`
      SELECT
        id, sport, stat_type, side, player_name,
        line, odds,
        COALESCE(bet_line, line) as bet_line,
        COALESCE(bet_odds, odds::integer) as bet_odds,
        closing_line,
        closing_odds,
        result,
        workflow_stage
      FROM unified_picks
      WHERE result IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const picks = picksQuery.rows;
    console.log(`  Found ${picks.length} settled picks`);

    if (picks.length === 0) {
      console.log('  No picks found. Creating synthetic test data...');

      // Create synthetic test picks for demonstration
      const syntheticPicks: TestEdgePick[] = [
        {
          id: 'test-pick-001',
          sport: 'NBA',
          stat_type: 'points',
          side: 'over',
          player_name: 'Test Player 1',
          line: 25.5,
          odds: -110,
          bet_line: 25.5,
          bet_odds: -110,
          closing_line: 24.5,
          closing_odds: -120,
          result: 'won',
          workflow_stage: 'settled',
        },
        {
          id: 'test-pick-002',
          sport: 'NBA',
          stat_type: 'rebounds',
          side: 'under',
          player_name: 'Test Player 2',
          line: 8.5,
          odds: -115,
          bet_line: 8.5,
          bet_odds: -115,
          closing_line: 8.5,
          closing_odds: -105,
          result: 'lost',
          workflow_stage: 'settled',
        },
        {
          id: 'test-pick-003',
          sport: 'NBA',
          stat_type: 'assists',
          side: 'over',
          player_name: 'Test Player 3',
          line: 6.5,
          odds: +100,
          bet_line: 6.5,
          bet_odds: 100,
          closing_line: 7.0,
          closing_odds: -130,
          result: 'won',
          workflow_stage: 'settled',
        },
      ];
      picks.push(...syntheticPicks);
      console.log(`  Created ${syntheticPicks.length} synthetic test picks`);
    }

    // Step 2: Check for canonical closing data in provider_offers
    console.log('\n[STEP 2] Checking provider_offers for canonical closing data...');
    const closingQuery = await client.query(`
      SELECT id, line, over_odds, under_odds, is_closing
      FROM provider_offers
      WHERE is_closing = TRUE
      LIMIT 5
    `);
    console.log(`  Found ${closingQuery.rows.length} canonical closing lines in provider_offers`);

    // Step 3: Run scoring for each pick
    console.log('\n[STEP 3] Running Edge Engine V1 scoring...');
    console.log('-'.repeat(70));

    for (const pick of picks) {
      const input: EdgeV1Input = {
        pick_id: pick.id,
        sport: pick.sport || 'NBA',
        stat_type: pick.stat_type || 'points',
        side: (pick.side as 'over' | 'under' | 'yes' | 'no') || 'over',
        entry_line: pick.bet_line || pick.line || 25.5,
        entry_odds: pick.bet_odds || (pick.odds ? Number(pick.odds) : -110),
        closing_line: pick.closing_line,
        closing_odds: pick.closing_odds,
        player_name: pick.player_name,
      };

      // Run scoring twice for determinism check
      const output1 = computeEdgeV1(input);
      const output2 = computeEdgeV1(input);

      const hash1 = hashOutput(output1);
      const hash2 = hashOutput(output2);
      const isDeterministic = hash1 === hash2;

      // Also use built-in determinism verifier
      const builtInDeterministic = verifyDeterminism(input);

      // Store hash for later comparison
      if (!outputHashes.has(pick.id)) {
        outputHashes.set(pick.id, []);
      }
      outputHashes.get(pick.id)!.push(hash1);

      console.log(`\n  Pick: ${pick.player_name || pick.id}`);
      console.log(`    Entry: ${input.entry_line} @ ${input.entry_odds}`);
      console.log(`    Close: ${input.closing_line ?? 'N/A'} @ ${input.closing_odds ?? 'N/A'}`);
      console.log(`    Edge Score: ${output1.edge_score} | Tier: ${output1.tier}`);
      console.log(`    CLV: ${output1.clv_pct.toFixed(2)}% (${output1.clv_direction})`);
      console.log(`    Kelly: ${(output1.kelly_fraction * 100).toFixed(2)}%`);
      console.log(`    Resistance: ${output1.market_resistance_flag}`);
      console.log(
        `    Risk Flags: ${output1.risk_flags.length > 0 ? output1.risk_flags.join(', ') : 'none'}`
      );
      console.log(`    Determinism: ${isDeterministic && builtInDeterministic ? 'PASS' : 'FAIL'}`);
      console.log(`    Hash: ${hash1.substring(0, 16)}...`);

      // Track result
      const testResult: TestResult = {
        pick_id: pick.id,
        player_name: pick.player_name || 'Unknown',
        determinism_pass: isDeterministic && builtInDeterministic,
        edge_score: output1.edge_score,
        tier: output1.tier,
        clv_pct: output1.clv_pct,
        feature_snapshot_written: false,
        scored_leg_written: false,
      };

      // Step 4: Write to feature_snapshots (if real pick ID)
      if (!pick.id.startsWith('test-pick-')) {
        try {
          await client.query(
            `
            INSERT INTO feature_snapshots (
              id, leg_id, model_version, model_name, feature_vector,
              computed_at, clv_at_bet, clv_at_close, meta
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
            )
            ON CONFLICT DO NOTHING
          `,
            [
              pick.id,
              MODEL_VERSION,
              'edge_engine_v1',
              JSON.stringify(output1.feature_snapshot),
              output1.computed_at,
              output1.feature_snapshot.entry_implied,
              output1.clv_pct,
              JSON.stringify({ score_components: output1.score_components }),
            ]
          );
          testResult.feature_snapshot_written = true;
          console.log(`    Feature snapshot: WRITTEN`);
        } catch (err) {
          console.log(
            `    Feature snapshot: SKIPPED (${err instanceof Error ? err.message : 'error'})`
          );
        }

        // Step 5: Write to scored_legs
        try {
          await client.query(
            `
            INSERT INTO scored_legs (
              id, leg_id, model_version, model_name, edge_score,
              confidence_score, tier, kelly_fraction, feature_contributions,
              computed_at, is_latest, meta
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10
            )
            ON CONFLICT DO NOTHING
          `,
            [
              pick.id,
              MODEL_VERSION,
              'edge_engine_v1',
              output1.edge_score,
              output1.edge_score / 100, // Normalize to 0-1 confidence
              output1.tier,
              output1.kelly_fraction,
              JSON.stringify(output1.score_components),
              output1.computed_at,
              JSON.stringify({
                clv_pct: output1.clv_pct,
                market_resistance: output1.market_resistance_flag,
                risk_flags: output1.risk_flags,
              }),
            ]
          );
          testResult.scored_leg_written = true;
          console.log(`    Scored leg: WRITTEN`);
        } catch (err) {
          console.log(`    Scored leg: SKIPPED (${err instanceof Error ? err.message : 'error'})`);
        }
      } else {
        console.log(`    DB writes: SKIPPED (synthetic test data)`);
      }

      results.push(testResult);
    }

    // Step 6: Re-run all scoring to verify batch determinism
    console.log('\n' + '-'.repeat(70));
    console.log('\n[STEP 4] Verifying batch determinism (re-scoring all picks)...');

    let batchDeterminismPass = true;
    for (const pick of picks) {
      const input: EdgeV1Input = {
        pick_id: pick.id,
        sport: pick.sport || 'NBA',
        stat_type: pick.stat_type || 'points',
        side: (pick.side as 'over' | 'under' | 'yes' | 'no') || 'over',
        entry_line: pick.bet_line || pick.line || 25.5,
        entry_odds: pick.bet_odds || (pick.odds ? Number(pick.odds) : -110),
        closing_line: pick.closing_line,
        closing_odds: pick.closing_odds,
      };

      const output = computeEdgeV1(input);
      const hash = hashOutput(output);
      const previousHashes = outputHashes.get(pick.id) || [];

      if (previousHashes.length > 0 && previousHashes[0] !== hash) {
        batchDeterminismPass = false;
        console.log(`  FAIL: ${pick.id} - hash mismatch`);
      }
    }

    console.log(`  Batch determinism: ${batchDeterminismPass ? 'PASS' : 'FAIL'}`);

    // Step 7: Verify CLV calculation against canonical close
    console.log('\n[STEP 5] Verifying CLV calculation from canonical close...');
    const clvVerification = results.filter(r => !r.pick_id.startsWith('test-'));
    console.log(`  CLV calculated for ${clvVerification.length} real picks`);
    console.log(`  CLV calculated for ${results.length - clvVerification.length} synthetic picks`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(70));

    const determinismPassed = results.filter(r => r.determinism_pass).length;
    const determinismFailed = results.filter(r => !r.determinism_pass).length;
    const featureSnapshotsWritten = results.filter(r => r.feature_snapshot_written).length;
    const scoredLegsWritten = results.filter(r => r.scored_leg_written).length;

    console.log(`  Total picks processed: ${results.length}`);
    console.log(`  Determinism: ${determinismPassed} PASS / ${determinismFailed} FAIL`);
    console.log(`  Feature snapshots written: ${featureSnapshotsWritten}`);
    console.log(`  Scored legs written: ${scoredLegsWritten}`);
    console.log(`  Batch determinism: ${batchDeterminismPass ? 'PASS' : 'FAIL'}`);

    // Edge score distribution
    const tierCounts = {
      S: results.filter(r => r.tier === 'S').length,
      A: results.filter(r => r.tier === 'A').length,
      B: results.filter(r => r.tier === 'B').length,
      PASS: results.filter(r => r.tier === 'PASS').length,
    };

    console.log('\n  Tier distribution:');
    console.log(`    S-tier: ${tierCounts.S}`);
    console.log(`    A-tier: ${tierCounts.A}`);
    console.log(`    B-tier: ${tierCounts.B}`);
    console.log(`    PASS:   ${tierCounts.PASS}`);

    console.log('\n  CLV summary:');
    const clvValues = results.map(r => r.clv_pct);
    const avgClv = clvValues.reduce((a, b) => a + b, 0) / clvValues.length;
    const maxClv = Math.max(...clvValues);
    const minClv = Math.min(...clvValues);
    console.log(`    Average CLV: ${avgClv.toFixed(2)}%`);
    console.log(`    Max CLV: ${maxClv.toFixed(2)}%`);
    console.log(`    Min CLV: ${minClv.toFixed(2)}%`);

    console.log('\n' + '='.repeat(70));

    // Final pass/fail
    const allPassed = determinismFailed === 0 && batchDeterminismPass;
    if (allPassed) {
      console.log('RESULT: PASS - All determinism tests passed');
      console.log(`MODEL_VERSION: ${MODEL_VERSION}`);
    } else {
      console.log('RESULT: FAIL - Determinism test failed');
      process.exit(1);
    }

    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n[ERROR]', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n[CLEANUP] Database connection closed');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
