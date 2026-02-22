/* eslint-disable no-console, max-lines-per-function, complexity, security/detect-object-injection */
/**
 * Sync Teams from SportsGameOdds API
 * Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A
 *
 * Fetches teams from SGO and upserts into participants table.
 * Idempotent: safe to re-run multiple times.
 *
 * Usage:
 *   npx tsx src/scripts/sgo/sync-teams.ts --sport=NBA
 *   npx tsx src/scripts/sgo/sync-teams.ts --sport=MLB
 *   npx tsx src/scripts/sgo/sync-teams.ts --sport=NBA,MLB,NFL,NHL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { getSGOClient, SGOTeam, SGOAuthError } from '../../services/sgo/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const SUPPORTED_SPORTS = ['NBA', 'MLB', 'NFL', 'NHL'];

// SGO league IDs map to our sport codes
const SPORT_TO_LEAGUE_ID: Record<string, string> = {
  NBA: 'NBA',
  MLB: 'MLB',
  NFL: 'NFL',
  NHL: 'NHL',
};

// ============================================================================
// HELPERS
// ============================================================================

function parseArgs(): { sports: string[] } {
  const args = process.argv.slice(2);
  let sports: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--sport=')) {
      const value = arg.replace('--sport=', '');
      sports = value.split(',').map(s => s.trim().toUpperCase());
    }
  }

  // Validate sports
  for (const sport of sports) {
    if (!SUPPORTED_SPORTS.includes(sport)) {
      console.error(`Invalid sport: ${sport}. Supported: ${SUPPORTED_SPORTS.join(', ')}`);
      process.exit(1);
    }
  }

  if (sports.length === 0) {
    console.error('Usage: npx tsx src/scripts/sgo/sync-teams.ts --sport=NBA,MLB');
    console.error('Supported sports:', SUPPORTED_SPORTS.join(', '));
    process.exit(1);
  }

  return { sports };
}

// ============================================================================
// UPSERT LOGIC
// ============================================================================

interface UpsertResult {
  inserted: number;
  updated: number;
  errors: number;
  total: number;
}

async function upsertTeams(
  supabase: SupabaseClient,
  teams: SGOTeam[],
  sport: string
): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    errors: 0,
    total: teams.length,
  };

  for (const team of teams) {
    try {
      // Check if team already exists
      const { data: existing } = await supabase
        .from('participants')
        .select('id, updated_at')
        .eq('external_id', team.teamID)
        .eq('sport', sport)
        .eq('type', 'team')
        .single();

      const participantData = {
        external_id: team.teamID,
        type: 'team',
        name: team.names.long || team.names.medium || team.names.short,
        display_name: team.names.short || team.names.medium,
        sport: sport,
        league: team.leagueID,
        meta: {
          names: team.names,
          colors: team.colors,
          sgo_sport_id: team.sportID,
          sgo_league_id: team.leagueID,
        },
        active: true,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('participants')
          .update(participantData)
          .eq('id', existing.id);

        if (updateError) {
          console.error(`Error updating team ${team.teamID}: ${updateError.message}`);
          result.errors++;
        } else {
          result.updated++;
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase.from('participants').insert(participantData);

        if (insertError) {
          console.error(`Error inserting team ${team.teamID}: ${insertError.message}`);
          result.errors++;
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      console.error(`Error processing team ${team.teamID}:`, err);
      result.errors++;
    }
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('SYNC TEAMS FROM SPORTSGAMEODDS');
  console.log('Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A');
  console.log('='.repeat(60));
  console.log();

  const { sports } = parseArgs();

  // Validate env
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create clients
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let sgoClient;
  try {
    sgoClient = getSGOClient();
  } catch (err) {
    if (err instanceof SGOAuthError) {
      console.error(`SGO Auth Error: ${err.message}`);
      console.error('Set SGO_API_KEY or SPORTSGAMEODDS_API_KEY environment variable');
      process.exit(1);
    }
    throw err;
  }

  console.log(`Sports to sync: ${sports.join(', ')}`);
  console.log();

  const overallResults: Record<string, UpsertResult> = {};
  const sampleRows: Array<{ sport: string; teamID: string; name: string }> = [];

  for (const sport of sports) {
    console.log(`--- Syncing ${sport} teams ---`);

    const leagueID = SPORT_TO_LEAGUE_ID[sport];
    if (!leagueID) {
      console.error(`No league ID mapping for sport: ${sport}`);
      continue;
    }

    try {
      // Fetch teams from SGO
      const teams = await sgoClient.fetchAllTeams(leagueID);

      if (teams.length === 0) {
        console.log(`No teams found for ${sport}`);
        overallResults[sport] = { inserted: 0, updated: 0, errors: 0, total: 0 };
        continue;
      }

      console.log(`Fetched ${teams.length} teams from SGO`);

      // Upsert into Supabase
      const result = await upsertTeams(supabase, teams, sport);
      overallResults[sport] = result;

      console.log(
        `${sport}: inserted=${result.inserted}, updated=${result.updated}, errors=${result.errors}`
      );

      // Collect sample rows for proof
      for (const team of teams.slice(0, 3)) {
        sampleRows.push({
          sport,
          teamID: team.teamID,
          name: team.names.long || team.names.medium,
        });
      }
    } catch (err) {
      console.error(`Error syncing ${sport}:`, err);
      overallResults[sport] = { inserted: 0, updated: 0, errors: 1, total: 0 };
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let totalTeams = 0;

  for (const [sport, result] of Object.entries(overallResults)) {
    console.log(
      `${sport}: inserted=${result.inserted}, updated=${result.updated}, errors=${result.errors}, total=${result.total}`
    );
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalErrors += result.errors;
    totalTeams += result.total;
  }

  console.log();
  console.log(
    `TOTAL: inserted=${totalInserted}, updated=${totalUpdated}, errors=${totalErrors}, total=${totalTeams}`
  );
  console.log();

  // Sample rows
  if (sampleRows.length > 0) {
    console.log('SAMPLE ROWS:');
    for (const row of sampleRows) {
      console.log(`  ${row.sport}: ${row.teamID} -> ${row.name}`);
    }
  }

  console.log();
  console.log('='.repeat(60));

  if (totalErrors > 0) {
    console.log('COMPLETED WITH ERRORS');
    process.exit(1);
  } else {
    console.log('COMPLETED SUCCESSFULLY');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
