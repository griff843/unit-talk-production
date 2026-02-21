/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090 - Phase 1
 * Canonicalize team IDs
 *
 * Strategy:
 * 1. NFL true duplicates (BUF, MIA): Keep full name version, deprecate short alias
 * 2. NCAAF abbreviation collisions: Fix abbrs to be unique (NOT merging - different teams!)
 */
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

// NFL duplicate resolution: prefer full name IDs
const NFL_CANONICAL_MAPPING = {
  'team_nfl_buf': 'team_nfl_buffalo_bills',
  'team_nfl_mia': 'team_nfl_miami_dolphins',
};

// NCAAF abbreviation fixes (make unique, don't merge)
const NCAAF_ABBR_FIXES = {
  'team_ncaaf_missouri_tigers': 'MIZ',       // was MT
  'team_ncaaf_maryland_terrapins': 'UMD',    // was MT
  'team_ncaaf_cincinnati_bearcats': 'CIN',   // was CB
  'team_ncaaf_colorado_buffaloes': 'CU',     // was CB
  'team_ncaaf_indiana_hoosiers': 'IU',       // was IH
  'team_ncaaf_iowa_hawkeyes': 'IOWA',        // was IH
  'team_ncaaf_ohio_state_buckeyes': 'OSU',   // was OSB
  'team_ncaaf_oregon_state_beavers': 'ORST', // was OSB
};

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL_POOLER,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('SPRINT-090 PHASE 1: TEAM CANONICALIZATION');
    console.log('='.repeat(80));

    // Step 1: Fix NCAAF abbreviation collisions FIRST (make them unique)
    console.log('\n--- STEP 1: FIX NCAAF ABBREVIATION COLLISIONS ---');
    for (const [teamId, newAbbr] of Object.entries(NCAAF_ABBR_FIXES)) {
      const result = await client.query(`
        UPDATE teams SET abbr = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, abbr
      `, [newAbbr, teamId]);

      if (result.rowCount > 0) {
        console.log(`  Updated: ${result.rows[0].name} -> abbr=${result.rows[0].abbr}`);
      } else {
        console.log(`  WARNING: Team ${teamId} not found`);
      }
    }

    // Step 2: Verify no more NCAAF collisions
    console.log('\n--- STEP 2: VERIFY NCAAF COLLISIONS RESOLVED ---');
    const ncaafCheck = await client.query(`
      SELECT abbr, COUNT(*) as cnt, ARRAY_AGG(name) as names
      FROM teams WHERE sport = 'NCAAF'
      GROUP BY abbr HAVING COUNT(*) > 1
    `);
    if (ncaafCheck.rowCount === 0) {
      console.log('  ✅ All NCAAF abbreviations are now unique');
    } else {
      console.log('  ⚠️ Still have collisions:');
      ncaafCheck.rows.forEach(r => console.log(`    ${r.abbr}: ${r.names.join(', ')}`));
    }

    // Step 3: Handle NFL duplicates
    console.log('\n--- STEP 3: NFL DUPLICATE RESOLUTION ---');

    // First, check what's referencing the short aliases
    for (const [oldId, canonicalId] of Object.entries(NFL_CANONICAL_MAPPING)) {
      console.log(`\n  Processing: ${oldId} -> ${canonicalId}`);

      // Check players table
      const playersCount = await client.query(`
        SELECT COUNT(*) as cnt FROM players WHERE team_id = $1
      `, [oldId]);
      console.log(`    Players referencing ${oldId}: ${playersCount.rows[0].cnt}`);

      if (parseInt(playersCount.rows[0].cnt) > 0) {
        // Update players to use canonical ID
        const updatePlayers = await client.query(`
          UPDATE players SET team_id = $1, updated_at = NOW()
          WHERE team_id = $2
          RETURNING id
        `, [canonicalId, oldId]);
        console.log(`    Migrated ${updatePlayers.rowCount} players to ${canonicalId}`);
      }

      // Mark the duplicate as deprecated (don't delete - safer)
      const deprecate = await client.query(`
        UPDATE teams
        SET meta = COALESCE(meta, '{}'::jsonb) || '{"deprecated": true, "canonical_id": "${canonicalId}"}'::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, meta
      `, [oldId]);

      if (deprecate.rowCount > 0) {
        console.log(`    Marked ${oldId} as deprecated`);
      }
    }

    // Step 4: Verify NFL duplicates resolved
    console.log('\n--- STEP 4: VERIFY NFL DUPLICATES HANDLED ---');
    const nflCheck = await client.query(`
      SELECT id, name, abbr, meta->>'deprecated' as deprecated
      FROM teams
      WHERE sport = 'NFL' AND abbr IN ('BUF', 'MIA')
      ORDER BY abbr, id
    `);
    nflCheck.rows.forEach(r => {
      const status = r.deprecated === 'true' ? '[DEPRECATED]' : '[CANONICAL]';
      console.log(`  ${r.abbr}: ${r.id} ${status}`);
    });

    // Step 5: Summary
    console.log('\n--- FINAL COLLISION CHECK ---');
    const finalCheck = await client.query(`
      SELECT sport, abbr, COUNT(*) as cnt, ARRAY_AGG(id) as ids
      FROM teams
      WHERE (meta->>'deprecated') IS DISTINCT FROM 'true'
      GROUP BY sport, abbr
      HAVING COUNT(*) > 1
      ORDER BY sport, abbr
    `);
    if (finalCheck.rowCount === 0) {
      console.log('  ✅ No more active duplicate sport+abbr combinations!');
    } else {
      console.log('  ⚠️ Remaining active duplicates:');
      finalCheck.rows.forEach(r => console.log(`    ${r.sport} ${r.abbr}: ${r.ids.join(', ')}`));
    }

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1 COMPLETE');
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
