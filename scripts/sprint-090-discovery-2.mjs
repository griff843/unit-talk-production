/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090 - Phase 0 Discovery Part 2
 * Analyze backfill potential from team_abbr
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
    console.log('SPRINT-090 PHASE 0 DISCOVERY PART 2 - BACKFILL POTENTIAL');
    console.log('='.repeat(80));

    // 1) Count players with team_abbr but no team_id (potential backfill targets)
    console.log('\n--- PLAYERS WITH team_abbr BUT NO team_id ---');
    const backfillTargets = await client.query(`
      SELECT COUNT(*) as cnt FROM players
      WHERE team_abbr IS NOT NULL AND team_id IS NULL
    `);
    console.log(`Potential backfill targets: ${backfillTargets.rows[0].cnt}`);

    // 2) For each sport, check if team_abbr is unique in teams table
    console.log('\n--- TEAM ABBR UNIQUENESS BY SPORT ---');
    const abbrUniqueness = await client.query(`
      SELECT sport, abbr, COUNT(*) as cnt
      FROM teams
      GROUP BY sport, abbr
      HAVING COUNT(*) > 1
      ORDER BY sport, cnt DESC
    `);
    console.log(`Non-unique sport+abbr combinations: ${abbrUniqueness.rowCount}`);
    abbrUniqueness.rows.forEach(r => {
      console.log(`  ${r.sport} ${r.abbr}: ${r.cnt} teams`);
    });

    // 3) Check how many players could be backfilled with unique sport+abbr
    console.log('\n--- BACKFILL SIMULATION (unique sport+abbr only) ---');
    const backfillSim = await client.query(`
      WITH unique_teams AS (
        SELECT sport, abbr, MIN(id) as team_id
        FROM teams
        GROUP BY sport, abbr
        HAVING COUNT(*) = 1
      )
      SELECT
        p.sport,
        COUNT(*) as total_without_team_id,
        COUNT(ut.team_id) as can_backfill
      FROM players p
      LEFT JOIN unique_teams ut ON p.sport = ut.sport AND p.team_abbr = ut.abbr
      WHERE p.team_id IS NULL AND p.team_abbr IS NOT NULL
      GROUP BY p.sport
      ORDER BY total_without_team_id DESC
    `);
    backfillSim.rows.forEach(r => {
      const pct = ((r.can_backfill / r.total_without_team_id) * 100).toFixed(1);
      console.log(`  ${r.sport}: ${r.can_backfill}/${r.total_without_team_id} backfillable (${pct}%)`);
    });

    // 4) Identify the "true duplicates" in NFL (same team, different ID formats)
    console.log('\n--- NFL TRUE DUPLICATES ---');
    const nflDupes = await client.query(`
      SELECT id, name, abbr FROM teams
      WHERE sport = 'NFL' AND abbr IN ('BUF', 'MIA')
      ORDER BY abbr, id
    `);
    nflDupes.rows.forEach(r => {
      console.log(`  ${r.abbr}: ${r.id} -> ${r.name}`);
    });

    // 5) Check which IDs are currently in use in players table
    console.log('\n--- TEAM IDs IN USE (players table) ---');
    const usedIds = await client.query(`
      SELECT team_id, COUNT(*) as player_count
      FROM players
      WHERE team_id IS NOT NULL
      GROUP BY team_id
      ORDER BY player_count DESC
    `);
    usedIds.rows.forEach(r => {
      console.log(`  ${r.team_id}: ${r.player_count} players`);
    });

    // 6) Check NCAAF abbreviation collisions - are these really different teams?
    console.log('\n--- NCAAF ABBREVIATION COLLISIONS (different teams, same abbr) ---');
    const ncaafCollisions = await client.query(`
      SELECT abbr, ARRAY_AGG(name ORDER BY name) as team_names, ARRAY_AGG(id ORDER BY name) as team_ids
      FROM teams
      WHERE sport = 'NCAAF'
      GROUP BY abbr
      HAVING COUNT(*) > 1
    `);
    ncaafCollisions.rows.forEach(r => {
      console.log(`  ${r.abbr}:`);
      for (let i = 0; i < r.team_names.length; i++) {
        console.log(`    - ${r.team_names[i]} (${r.team_ids[i]})`);
      }
    });

    // 7) Check players without BOTH team_id AND team_abbr
    console.log('\n--- PLAYERS WITH NO TEAM INFO AT ALL ---');
    const noTeamInfo = await client.query(`
      SELECT sport, COUNT(*) as cnt
      FROM players
      WHERE team_id IS NULL AND team_abbr IS NULL
      GROUP BY sport
      ORDER BY cnt DESC
    `);
    noTeamInfo.rows.forEach(r => {
      console.log(`  ${r.sport}: ${r.cnt} players with no team info`);
    });

    // 8) Total backfill potential summary
    console.log('\n--- BACKFILL POTENTIAL SUMMARY ---');
    const summary = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE team_id IS NOT NULL) as has_team_id,
        COUNT(*) FILTER (WHERE team_id IS NULL AND team_abbr IS NOT NULL) as has_abbr_only,
        COUNT(*) FILTER (WHERE team_id IS NULL AND team_abbr IS NULL) as has_nothing
      FROM players
    `);
    const s = summary.rows[0];
    console.log(`  Already mapped (team_id): ${s.has_team_id}`);
    console.log(`  Backfill candidates (abbr only): ${s.has_abbr_only}`);
    console.log(`  Cannot map (no abbr): ${s.has_nothing}`);

    // 9) What about Bo Nix - can we find his team?
    console.log('\n--- BO NIX ANALYSIS ---');
    const boNix = await client.query(`
      SELECT id, full_name, sport, team_id, team_abbr, meta
      FROM players
      WHERE LOWER(full_name) LIKE '%bo nix%'
    `);
    if (boNix.rowCount > 0) {
      const row = boNix.rows[0];
      console.log(`  Name: ${row.full_name}`);
      console.log(`  Sport: ${row.sport}`);
      console.log(`  team_id: ${row.team_id}`);
      console.log(`  team_abbr: ${row.team_abbr}`);
      console.log(`  meta: ${JSON.stringify(row.meta)}`);

      // Bo Nix plays for Denver Broncos (DEN)
      const denverTeam = await client.query(`
        SELECT id, name, abbr FROM teams WHERE sport = 'NFL' AND abbr = 'DEN'
      `);
      if (denverTeam.rowCount > 0) {
        console.log(`  Denver team exists: ${denverTeam.rows[0].id}`);
      }
    }

    // 10) Check if there's any provider_player_id that could help
    console.log('\n--- PROVIDER_PLAYER_ID POPULATION ---');
    const providerIds = await client.query(`
      SELECT sport,
        COUNT(*) as total,
        COUNT(provider_player_id) as has_provider_id
      FROM players
      GROUP BY sport
      ORDER BY total DESC
    `);
    providerIds.rows.forEach(r => {
      const pct = ((r.has_provider_id / r.total) * 100).toFixed(1);
      console.log(`  ${r.sport}: ${r.has_provider_id}/${r.total} have provider_player_id (${pct}%)`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('DISCOVERY PART 2 COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
