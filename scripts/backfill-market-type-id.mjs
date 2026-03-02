#!/usr/bin/env node
/**
 * MARKET-TYPE-BACKFILL-005
 * One-shot backfill: populate ticket_legs.market_type_id where NULL
 *
 * Actual schema: NULL legs have no offer_id/event_id/participant_id FK columns.
 * They DO have effective_value JSONB with bet_type + prop_type.
 *
 * Mapping strategy (deterministic, from effective_value JSONB):
 *   bet_type=moneyline                  → team_moneyline      (id=1)
 *   bet_type=player_prop, prop_type=PTS → player_points_ou    (id=2)
 *   bet_type=player_prop, other         → player_prop_generic (id=9)
 *   bet_type=nrfi                       → nrfi                (id=5)
 *   bet_type=puck_line                  → puck_line           (id=7)
 *   bet_type=spread                     → team_spread         (id=13)
 *   bet_type=total                      → game_total          (id=14)
 *   bet_type=team_total                 → team_total          (id=15)
 *
 * Idempotent: only updates rows WHERE market_type_id IS NULL
 * Non-destructive: never overwrites existing market_type_id values
 */

import pg from 'pg';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

config();

const PROOF_DIR = 'out/sprints/MARKET-TYPE-BACKFILL-005/2026-03-02/proofs';
mkdirSync(PROOF_DIR, { recursive: true });

function writeProof(filename, content) {
  const path = join(PROOF_DIR, filename);
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log(`  Written: ${path}`);
}

// ─── Deterministic bet_type → market_type_id mapping ─────────────────────────
// Built from market_types table inspection on 2026-03-02
const BET_TYPE_MAP = {
  moneyline: 1,     // team_moneyline
  nrfi: 5,          // nrfi
  puck_line: 7,     // puck_line
  run_line: 8,      // run_line
  spread: 13,       // team_spread
  total: 14,        // game_total
  team_total: 15,   // team_total
};

// player_prop requires prop_type distinction
const PLAYER_PROP_MAP = {
  PTS: 2,           // player_points_ou
  // All others → player_prop_generic (id=9)
};
const PLAYER_PROP_GENERIC_ID = 9;

// ─── Connect ─────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('FATAL: Missing SUPABASE_DB_URL_POOLER or DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MARKET-TYPE-BACKFILL-005');
  console.log('  Backfill ticket_legs.market_type_id via effective_value JSONB');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Started:', new Date().toISOString());
  console.log('');

  // ─── Step 0: Count NULL legs before ──────────────────────────────────────
  const { rows: [{ count: totalLegCount }] } = await client.query(
    `SELECT COUNT(*)::int AS count FROM ticket_legs`
  );
  const { rows: [{ count: nullBefore }] } = await client.query(
    `SELECT COUNT(*)::int AS count FROM ticket_legs WHERE market_type_id IS NULL`
  );
  const { rows: [{ count: nonNullBefore }] } = await client.query(
    `SELECT COUNT(*)::int AS count FROM ticket_legs WHERE market_type_id IS NOT NULL`
  );

  console.log(`Total ticket_legs:       ${totalLegCount}`);
  console.log(`market_type_id NULL:     ${nullBefore}`);
  console.log(`market_type_id non-NULL: ${nonNullBefore}`);
  console.log('');

  if (nullBefore === 0) {
    console.log('No NULL market_type_id legs found. Nothing to backfill.');
    writeProof('proof_null_before_after.txt', [
      `MARKET-TYPE-BACKFILL-005`,
      `Timestamp: ${new Date().toISOString()}`,
      ``,
      `Total legs:     ${totalLegCount}`,
      `NULL before:    ${nullBefore}`,
      `Non-NULL before: ${nonNullBefore}`,
      ``,
      `Result: No backfill needed — all legs already have market_type_id`,
    ].join('\n'));
    await client.end();
    process.exit(0);
  }

  // ─── Step 1: Inspect bet_type distribution on NULL legs ──────────────────
  console.log('--- NULL legs bet_type distribution ---');
  const { rows: betTypeDist } = await client.query(`
    SELECT
      effective_value->>'bet_type' AS bet_type,
      effective_value->>'prop_type' AS prop_type,
      effective_value->>'sport' AS sport,
      COUNT(*)::int AS cnt
    FROM ticket_legs
    WHERE market_type_id IS NULL
    GROUP BY 1, 2, 3
    ORDER BY cnt DESC
  `);
  for (const row of betTypeDist) {
    console.log(`  bet_type=${row.bet_type} prop_type=${row.prop_type} sport=${row.sport} count=${row.cnt}`);
  }
  console.log('');

  // ─── Step 2: Apply JSONB-based mapping ───────────────────────────────────
  console.log('--- Applying bet_type → market_type_id mapping ---');

  // Path A: Direct bet_type mapping (non-player_prop types)
  const pathAResult = await client.query(`
    UPDATE ticket_legs
    SET market_type_id = CASE effective_value->>'bet_type'
      WHEN 'moneyline'   THEN 1
      WHEN 'nrfi'        THEN 5
      WHEN 'puck_line'   THEN 7
      WHEN 'run_line'    THEN 8
      WHEN 'spread'      THEN 13
      WHEN 'total'       THEN 14
      WHEN 'team_total'  THEN 15
    END
    WHERE market_type_id IS NULL
      AND effective_value->>'bet_type' IN ('moneyline','nrfi','puck_line','run_line','spread','total','team_total')
  `);
  const pathACount = pathAResult.rowCount;
  console.log(`  Path A (direct bet_type): ${pathACount} legs mapped`);

  // Path B: player_prop with PTS → player_points_ou (id=2)
  const pathB1Result = await client.query(`
    UPDATE ticket_legs
    SET market_type_id = 2
    WHERE market_type_id IS NULL
      AND effective_value->>'bet_type' = 'player_prop'
      AND effective_value->>'prop_type' = 'PTS'
  `);
  const pathB1Count = pathB1Result.rowCount;
  console.log(`  Path B1 (player_prop PTS → player_points_ou): ${pathB1Count} legs mapped`);

  // Path B2: player_prop with any other prop_type → player_prop_generic (id=9)
  const pathB2Result = await client.query(`
    UPDATE ticket_legs
    SET market_type_id = 9
    WHERE market_type_id IS NULL
      AND effective_value->>'bet_type' = 'player_prop'
  `);
  const pathB2Count = pathB2Result.rowCount;
  console.log(`  Path B2 (player_prop other → player_prop_generic): ${pathB2Count} legs mapped`);

  const totalMapped = pathACount + pathB1Count + pathB2Count;
  console.log(`  Total mapped: ${totalMapped}`);
  console.log('');

  // ─── Step 3: Count remaining NULLs ──────────────────────────────────────
  const { rows: [{ count: nullAfter }] } = await client.query(
    `SELECT COUNT(*)::int AS count FROM ticket_legs WHERE market_type_id IS NULL`
  );
  const { rows: [{ count: nonNullAfter }] } = await client.query(
    `SELECT COUNT(*)::int AS count FROM ticket_legs WHERE market_type_id IS NOT NULL`
  );

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  NULL before:        ${nullBefore}`);
  console.log(`  Path A (bet_type):  ${pathACount}`);
  console.log(`  Path B1 (PTS):      ${pathB1Count}`);
  console.log(`  Path B2 (prop):     ${pathB2Count}`);
  console.log(`  Total mapped:       ${totalMapped}`);
  console.log(`  NULL after:         ${nullAfter}`);
  console.log(`  Non-NULL after:     ${nonNullAfter}`);
  console.log(`  Coverage:           ${((nonNullAfter / totalLegCount) * 100).toFixed(1)}%`);
  console.log('');

  // ─── Step 4: Log unmapped legs ──────────────────────────────────────────
  const unmapped = [];
  if (nullAfter > 0) {
    console.log('--- Unmapped legs (remaining NULLs) ---');
    const { rows: unmappedLegs } = await client.query(`
      SELECT
        id,
        effective_value->>'bet_type' AS bet_type,
        effective_value->>'prop_type' AS prop_type,
        effective_value->>'sport' AS sport
      FROM ticket_legs
      WHERE market_type_id IS NULL
      LIMIT 50
    `);
    for (const leg of unmappedLegs) {
      const reason = !leg.bet_type
        ? 'NO_BET_TYPE_IN_EFFECTIVE_VALUE'
        : `UNMAPPED_BET_TYPE:${leg.bet_type}`;
      unmapped.push({ leg_id: leg.id, bet_type: leg.bet_type, prop_type: leg.prop_type, sport: leg.sport, reason });
      console.log(`  ${leg.id.substring(0, 8)}... bet_type=${leg.bet_type} reason=${reason}`);
    }
  }
  console.log('');

  // ─── Step 5: Verify mapping correctness ─────────────────────────────────
  console.log('--- Verification: market_type_id distribution after backfill ---');
  const { rows: postDist } = await client.query(`
    SELECT
      market_type_id,
      mt.market_key,
      COUNT(*)::int AS cnt
    FROM ticket_legs tl
    LEFT JOIN market_types mt ON tl.market_type_id = mt.id
    GROUP BY 1, 2
    ORDER BY cnt DESC
  `);
  for (const row of postDist) {
    console.log(`  market_type_id=${row.market_type_id} (${row.market_key ?? 'NULL'}) count=${row.cnt}`);
  }
  console.log('');

  // ─── Step 6: Write proofs ───────────────────────────────────────────────
  console.log('--- Writing proof artifacts ---');

  writeProof('proof_null_before_after.txt', [
    `MARKET-TYPE-BACKFILL-005`,
    `Timestamp: ${new Date().toISOString()}`,
    ``,
    `Total legs:          ${totalLegCount}`,
    `NULL before:         ${nullBefore}`,
    `Non-NULL before:     ${nonNullBefore}`,
    ``,
    `Mapping strategy: effective_value JSONB bet_type → market_types.id`,
    `Path A (bet_type):   ${pathACount}  (moneyline,nrfi,puck_line,spread,total,team_total)`,
    `Path B1 (PTS):       ${pathB1Count}  (player_prop + PTS → player_points_ou)`,
    `Path B2 (prop):      ${pathB2Count}  (player_prop + other → player_prop_generic)`,
    `Total mapped:        ${totalMapped}`,
    ``,
    `NULL after:          ${nullAfter}`,
    `Non-NULL after:      ${nonNullAfter}`,
    `Coverage after:      ${((nonNullAfter / totalLegCount) * 100).toFixed(1)}%`,
  ].join('\n'));

  writeProof('proof_mapping_coverage.json', {
    sprint: 'MARKET-TYPE-BACKFILL-005',
    timestamp: new Date().toISOString(),
    total_legs: totalLegCount,
    null_before: nullBefore,
    non_null_before: nonNullBefore,
    path_a_mapped: pathACount,
    path_b1_mapped: pathB1Count,
    path_b2_mapped: pathB2Count,
    total_mapped: totalMapped,
    null_after: nullAfter,
    non_null_after: nonNullAfter,
    coverage_pct: parseFloat(((nonNullAfter / totalLegCount) * 100).toFixed(1)),
    bet_type_distribution_before: betTypeDist,
    market_type_distribution_after: postDist,
  });

  writeProof('proof_unmapped_market_ids.json', {
    sprint: 'MARKET-TYPE-BACKFILL-005',
    timestamp: new Date().toISOString(),
    remaining_null_count: nullAfter,
    unmapped_legs: unmapped,
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BACKFILL COMPLETE');
  console.log(`  ${totalMapped} legs mapped, ${nullAfter} remaining NULL`);
  console.log('═══════════════════════════════════════════════════════════════');

} catch (err) {
  console.error('FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await client.end();
}
