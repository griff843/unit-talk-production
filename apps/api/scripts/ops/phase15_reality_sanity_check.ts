/**
 * Phase 15 Reality Sanity Check
 *
 * CRITICAL VALIDATION: Ensure ingested data matches real-world sports calendar
 *
 * HARD CONSTRAINTS (2025-11-27 - Thanksgiving):
 * - MLB props MUST be 0 (MLB season over, no games on Thanksgiving)
 * - NFL props SHOULD be > 0 (NFL has games on Thanksgiving)
 *
 * Exit Codes:
 * - 0: PASS - MLB=0 AND NFL>0 for today
 * - 2: FAIL - MLB>0 for today (wrong data)
 * - 3: FAIL - NFL=0 for today (missing expected data)
 * - 4: FAIL - Both MLB>0 OR NFL=0 (critical misalignment)
 * - 5: UNKNOWN - Cannot determine (missing event_time or other error)
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/unit_talk_dev',
});

interface LeagueCount {
  league: string;
  props_today: number;
  props_yesterday: number;
  props_tomorrow: number;
}

async function main() {
  console.log('=== PHASE 15 REALITY SANITY CHECK ===\n');
  console.log('Date: 2025-11-27 (Thanksgiving)');
  console.log('Expected: NFL > 0, MLB = 0\n');

  try {
    const client = await pool.connect();

    // Get DB date
    const dateResult = await client.query(`SELECT CURRENT_DATE AS db_today`);
    const dbToday = dateResult.rows[0].db_today;
    console.log(`DB Today: ${dbToday}\n`);

    // Check if event_time column exists
    const columnCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'raw_props' AND column_name = 'event_time'
    `);

    if (columnCheck.rows[0].count === 0) {
      console.error('❌ UNKNOWN - event_time column missing on raw_props');
      console.error('Run migration: 20251127_phase15_raw_props_event_time_and_game_link.sql');
      client.release();
      process.exit(5);
    }

    // Get props by league for today, yesterday, tomorrow
    const leagueCountsResult = await client.query(`
      SELECT
        league,
        SUM(CASE WHEN DATE(event_time) = CURRENT_DATE THEN 1 ELSE 0 END) as props_today,
        SUM(CASE WHEN DATE(event_time) = CURRENT_DATE - INTERVAL '1 day' THEN 1 ELSE 0 END) as props_yesterday,
        SUM(CASE WHEN DATE(event_time) = CURRENT_DATE + INTERVAL '1 day' THEN 1 ELSE 0 END) as props_tomorrow
      FROM raw_props
      WHERE event_time IS NOT NULL
      GROUP BY league
      ORDER BY league
    `);

    if (leagueCountsResult.rows.length === 0) {
      console.error('❌ UNKNOWN - No props with event_time found');
      console.error('Re-run ingestion with updated script: local-db-multi-league-ingestion-v2.ts');
      client.release();
      process.exit(5);
    }

    console.log('Props by League (Yesterday | Today | Tomorrow):');
    console.log('| League  | Yesterday | Today | Tomorrow |');
    console.log('|---------|-----------|-------|----------|');

    const leagueCounts: Record<string, LeagueCount> = {};

    leagueCountsResult.rows.forEach((row: any) => {
      leagueCounts[row.league] = {
        league: row.league,
        props_today: parseInt(row.props_today),
        props_yesterday: parseInt(row.props_yesterday),
        props_tomorrow: parseInt(row.props_tomorrow)
      };

      console.log(`| ${row.league.padEnd(7)} | ${String(row.props_yesterday).padStart(9)} | ${String(row.props_today).padStart(5)} | ${String(row.props_tomorrow).padStart(8)} |`);
    });

    console.log('\n');

    // Extract MLB and NFL counts for today
    const mlbToday = leagueCounts['MLB']?.props_today || 0;
    const nflToday = leagueCounts['NFL']?.props_today || 0;

    console.log(`MLB props today: ${mlbToday}`);
    console.log(`NFL props today: ${nflToday}\n`);

    // Apply hard constraints
    let exitCode = 0;
    let verdict = '✅ PASS';
    let reason = 'MLB=0 AND NFL>0 for today (aligned with reality)';

    if (mlbToday > 0 && nflToday === 0) {
      exitCode = 4;
      verdict = '❌ FAIL (CRITICAL)';
      reason = `MLB has ${mlbToday} props AND NFL has 0 props (both wrong)`;
    } else if (mlbToday > 0) {
      exitCode = 2;
      verdict = '❌ FAIL';
      reason = `MLB has ${mlbToday} props on Thanksgiving (should be 0 - MLB season is over)`;
    } else if (nflToday === 0) {
      exitCode = 3;
      verdict = '❌ FAIL';
      reason = `NFL has 0 props on Thanksgiving (should be > 0 - NFL plays on Thanksgiving)`;
    } else if (mlbToday === 0 && nflToday > 0) {
      exitCode = 0;
      verdict = '✅ PASS';
      reason = 'MLB=0 AND NFL>0 for today (aligned with real-world sports calendar)';
    }

    console.log(`Verdict: ${verdict}`);
    console.log(`Reason: ${reason}\n`);

    // Output JSON for automation
    const output = {
      db_today: dbToday,
      mlb_props_today: mlbToday,
      nfl_props_today: nflToday,
      verdict,
      reason,
      exit_code: exitCode,
      league_counts: leagueCounts
    };

    console.log('JSON Output:');
    console.log(JSON.stringify(output, null, 2));

    client.release();
    process.exit(exitCode);

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(5);
  } finally {
    await pool.end();
  }
}

main();
