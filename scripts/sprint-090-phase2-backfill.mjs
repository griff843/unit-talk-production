/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090 - Phase 2
 * Backfill players.team_id from team_abbr + sport
 *
 * Strategy:
 * 1. For each player with team_abbr but no team_id, find matching team by sport+abbr
 * 2. Only assign if exactly ONE non-deprecated team matches (fail-closed)
 * 3. Also populate team_abbr from team_id where missing
 */
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL_POOLER,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('SPRINT-090 PHASE 2: PLAYER-TEAM BACKFILL');
    console.log('='.repeat(80));

    // Step 0: Pre-backfill coverage
    console.log('\n--- PRE-BACKFILL COVERAGE ---');
    const preCoverage = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(team_id) as with_team_id,
        COUNT(*) - COUNT(team_id) as without_team_id
      FROM players
    `);
    console.log(`  Total: ${preCoverage.rows[0].total}`);
    console.log(`  With team_id: ${preCoverage.rows[0].with_team_id}`);
    console.log(`  Without team_id: ${preCoverage.rows[0].without_team_id}`);

    // Step 1: Backfill team_id from team_abbr + sport (unique matches only)
    console.log('\n--- STEP 1: BACKFILL team_id FROM team_abbr ---');

    const backfillQuery = `
      WITH unique_teams AS (
        -- Only use non-deprecated teams with unique sport+abbr
        SELECT sport, abbr, MIN(id) as team_id
        FROM teams
        WHERE (meta->>'deprecated') IS DISTINCT FROM 'true'
        GROUP BY sport, abbr
        HAVING COUNT(*) = 1
      )
      UPDATE players p
      SET
        team_id = ut.team_id,
        updated_at = NOW()
      FROM unique_teams ut
      WHERE p.team_id IS NULL
        AND p.team_abbr IS NOT NULL
        AND p.sport = ut.sport
        AND UPPER(p.team_abbr) = UPPER(ut.abbr)
      RETURNING p.id, p.full_name, p.sport, p.team_abbr, p.team_id
    `;

    const backfillResult = await client.query(backfillQuery);
    console.log(`  Backfilled team_id for ${backfillResult.rowCount} players`);

    // Show sample of backfilled
    if (backfillResult.rowCount > 0) {
      console.log('\n  Sample backfilled players:');
      backfillResult.rows.slice(0, 10).forEach(r => {
        console.log(`    ${r.full_name} (${r.sport}): ${r.team_abbr} -> ${r.team_id}`);
      });
    }

    // Step 2: Backfill team_abbr where team_id exists but abbr is null
    console.log('\n--- STEP 2: BACKFILL team_abbr FROM team_id ---');
    const abbrBackfill = await client.query(`
      UPDATE players p
      SET
        team_abbr = t.abbr,
        updated_at = NOW()
      FROM teams t
      WHERE p.team_id = t.id
        AND p.team_abbr IS NULL
        AND (t.meta->>'deprecated') IS DISTINCT FROM 'true'
      RETURNING p.id, p.full_name, p.team_id, p.team_abbr
    `);
    console.log(`  Backfilled team_abbr for ${abbrBackfill.rowCount} players`);

    // Step 3: Post-backfill coverage
    console.log('\n--- POST-BACKFILL COVERAGE ---');
    const postCoverage = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(team_id) as with_team_id,
        COUNT(*) - COUNT(team_id) as without_team_id
      FROM players
    `);
    console.log(`  Total: ${postCoverage.rows[0].total}`);
    console.log(`  With team_id: ${postCoverage.rows[0].with_team_id}`);
    console.log(`  Without team_id: ${postCoverage.rows[0].without_team_id}`);

    const improvement = parseInt(postCoverage.rows[0].with_team_id) - parseInt(preCoverage.rows[0].with_team_id);
    console.log(`  IMPROVEMENT: +${improvement} players mapped`);

    // Step 4: Coverage by sport
    console.log('\n--- COVERAGE BY SPORT ---');
    const bySport = await client.query(`
      SELECT
        sport,
        COUNT(*) as total,
        COUNT(team_id) as mapped,
        ROUND(100.0 * COUNT(team_id) / COUNT(*), 1) as pct
      FROM players
      GROUP BY sport
      ORDER BY total DESC
    `);
    bySport.rows.forEach(r => {
      console.log(`  ${r.sport}: ${r.mapped}/${r.total} (${r.pct}%)`);
    });

    // Step 5: Check unmapped players - what's missing?
    console.log('\n--- UNMAPPED ANALYSIS ---');
    const unmappedAnalysis = await client.query(`
      SELECT
        sport,
        COUNT(*) FILTER (WHERE team_abbr IS NOT NULL) as has_abbr_no_match,
        COUNT(*) FILTER (WHERE team_abbr IS NULL) as no_abbr_at_all
      FROM players
      WHERE team_id IS NULL
      GROUP BY sport
      ORDER BY (COUNT(*)) DESC
    `);
    console.log('  Unmapped breakdown:');
    unmappedAnalysis.rows.forEach(r => {
      console.log(`    ${r.sport}: ${r.has_abbr_no_match} have abbr but no match, ${r.no_abbr_at_all} have no abbr`);
    });

    // Step 6: Sample of unmapped with abbr (to diagnose)
    console.log('\n--- SAMPLE UNMAPPED WITH ABBR ---');
    const unmappedWithAbbr = await client.query(`
      SELECT p.sport, p.team_abbr, p.full_name,
             (SELECT COUNT(*) FROM teams t WHERE t.sport = p.sport AND UPPER(t.abbr) = UPPER(p.team_abbr)
               AND (t.meta->>'deprecated') IS DISTINCT FROM 'true') as matching_teams
      FROM players p
      WHERE p.team_id IS NULL AND p.team_abbr IS NOT NULL
      LIMIT 20
    `);
    unmappedWithAbbr.rows.forEach(r => {
      console.log(`    ${r.full_name} (${r.sport}, abbr=${r.team_abbr}): ${r.matching_teams} team matches`);
    });

    // Step 7: Check Bo Nix
    console.log('\n--- BO NIX STATUS ---');
    const boNix = await client.query(`
      SELECT id, full_name, sport, team_id, team_abbr
      FROM players WHERE LOWER(full_name) LIKE '%bo nix%'
    `);
    if (boNix.rowCount > 0) {
      const r = boNix.rows[0];
      console.log(`  ${r.full_name}: team_id=${r.team_id}, team_abbr=${r.team_abbr}`);
      if (!r.team_id) {
        console.log('  Bo Nix still unmapped - needs manual intervention or roster data');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2 COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
