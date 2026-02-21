/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090 - Phase 2b
 * Second pass: Match players by team NAME (for those with full name in team_abbr)
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
    console.log('SPRINT-090 PHASE 2B: NAME-BASED MATCHING');
    console.log('='.repeat(80));

    // Pre-check coverage
    console.log('\n--- PRE-PHASE-2B COVERAGE ---');
    const preCoverage = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(team_id) as with_team_id,
        COUNT(*) - COUNT(team_id) as without_team_id
      FROM players
    `);
    console.log(`  With team_id: ${preCoverage.rows[0].with_team_id}`);
    console.log(`  Without team_id: ${preCoverage.rows[0].without_team_id}`);

    // Step 1: Match players where team_abbr contains full team name
    console.log('\n--- STEP 1: MATCH BY TEAM NAME ---');

    const nameMatchQuery = `
      WITH unique_teams AS (
        SELECT sport, name, abbr, MIN(id) as team_id
        FROM teams
        WHERE (meta->>'deprecated') IS DISTINCT FROM 'true'
        GROUP BY sport, name, abbr
        HAVING COUNT(*) = 1
      )
      UPDATE players p
      SET
        team_id = ut.team_id,
        team_abbr = ut.abbr,  -- Also fix the abbr
        updated_at = NOW()
      FROM unique_teams ut
      WHERE p.team_id IS NULL
        AND p.team_abbr IS NOT NULL
        AND p.sport = ut.sport
        AND LOWER(p.team_abbr) = LOWER(ut.name)
      RETURNING p.id, p.full_name, p.sport, p.team_abbr, p.team_id
    `;

    const nameMatchResult = await client.query(nameMatchQuery);
    console.log(`  Matched by team name: ${nameMatchResult.rowCount} players`);

    if (nameMatchResult.rowCount > 0) {
      console.log('\n  Sample matched players:');
      nameMatchResult.rows.slice(0, 10).forEach(r => {
        console.log(`    ${r.full_name} (${r.sport}): ${r.team_abbr} -> ${r.team_id}`);
      });
    }

    // Step 2: Try fuzzy matching (partial name match) for remaining
    console.log('\n--- STEP 2: PARTIAL NAME MATCHING ---');

    // For remaining unmapped, try matching the team_abbr as a LIKE pattern
    const partialMatchQuery = `
      WITH unique_teams AS (
        SELECT sport, name, abbr, MIN(id) as team_id
        FROM teams
        WHERE (meta->>'deprecated') IS DISTINCT FROM 'true'
        GROUP BY sport, name, abbr
        HAVING COUNT(*) = 1
      ),
      potential_matches AS (
        SELECT
          p.id as player_id,
          p.full_name,
          p.sport,
          p.team_abbr as player_team_value,
          ut.team_id,
          ut.abbr,
          ut.name as team_name
        FROM players p
        JOIN unique_teams ut ON p.sport = ut.sport
        WHERE p.team_id IS NULL
          AND p.team_abbr IS NOT NULL
          AND (
            -- Try matching: player's "team_abbr" contains the team name OR vice versa
            LOWER(ut.name) LIKE '%' || LOWER(REPLACE(p.team_abbr, ' ', '%')) || '%'
            OR LOWER(p.team_abbr) LIKE '%' || LOWER(REPLACE(ut.name, ' ', '%')) || '%'
          )
      ),
      -- Only update if exactly one match
      unambiguous_matches AS (
        SELECT player_id, MIN(team_id) as team_id, MIN(abbr) as abbr
        FROM potential_matches
        GROUP BY player_id
        HAVING COUNT(*) = 1
      )
      UPDATE players p
      SET
        team_id = um.team_id,
        team_abbr = um.abbr,
        updated_at = NOW()
      FROM unambiguous_matches um
      WHERE p.id = um.player_id
      RETURNING p.id, p.full_name, p.sport, p.team_abbr, p.team_id
    `;

    const partialMatchResult = await client.query(partialMatchQuery);
    console.log(`  Matched by partial name: ${partialMatchResult.rowCount} players`);

    if (partialMatchResult.rowCount > 0) {
      console.log('\n  Sample partial matches:');
      partialMatchResult.rows.slice(0, 10).forEach(r => {
        console.log(`    ${r.full_name} (${r.sport}): ${r.team_abbr} -> ${r.team_id}`);
      });
    }

    // Post-check coverage
    console.log('\n--- POST-PHASE-2B COVERAGE ---');
    const postCoverage = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(team_id) as with_team_id,
        COUNT(*) - COUNT(team_id) as without_team_id
      FROM players
    `);
    console.log(`  With team_id: ${postCoverage.rows[0].with_team_id}`);
    console.log(`  Without team_id: ${postCoverage.rows[0].without_team_id}`);

    const improvement = parseInt(postCoverage.rows[0].with_team_id) - parseInt(preCoverage.rows[0].with_team_id);
    console.log(`  IMPROVEMENT: +${improvement} players mapped`);

    // Coverage by sport
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

    // Show remaining unmapped sample
    console.log('\n--- REMAINING UNMAPPED SAMPLE ---');
    const remaining = await client.query(`
      SELECT sport, team_abbr, full_name
      FROM players
      WHERE team_id IS NULL AND team_abbr IS NOT NULL
      LIMIT 10
    `);
    remaining.rows.forEach(r => {
      console.log(`  ${r.full_name} (${r.sport}): team_abbr="${r.team_abbr}"`);
    });

    // Check Bo Nix
    console.log('\n--- BO NIX STATUS ---');
    const boNix = await client.query(`
      SELECT id, full_name, sport, team_id, team_abbr FROM players WHERE LOWER(full_name) LIKE '%bo nix%'
    `);
    if (boNix.rowCount > 0) {
      console.log(`  ${boNix.rows[0].full_name}: team_id=${boNix.rows[0].team_id}, abbr=${boNix.rows[0].team_abbr}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2B COMPLETE');
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
