/* eslint-disable no-console, max-lines-per-function, complexity, max-depth, security/detect-object-injection */
/**
 * Sync Players from SportsGameOdds API
 * Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A
 *
 * Fetches players from SGO and upserts into participants table.
 * Links players to teams via participant_memberships.
 * Idempotent: safe to re-run multiple times.
 *
 * Usage:
 *   npx tsx src/scripts/sgo/sync-players.ts --sport=NBA
 *   npx tsx src/scripts/sgo/sync-players.ts --sport=MLB --date=2026-02-22
 *   npx tsx src/scripts/sgo/sync-players.ts --sport=NBA,MLB
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { getSGOClient, SGOPlayer, SGOAuthError } from '../../services/sgo/client';

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

function parseArgs(): { sports: string[]; date?: string } {
  const args = process.argv.slice(2);
  let sports: string[] = [];
  let date: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--sport=')) {
      const value = arg.replace('--sport=', '');
      sports = value.split(',').map(s => s.trim().toUpperCase());
    }
    if (arg.startsWith('--date=')) {
      date = arg.replace('--date=', '');
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
    console.error(
      'Usage: npx tsx src/scripts/sgo/sync-players.ts --sport=NBA,MLB [--date=YYYY-MM-DD]'
    );
    console.error('Supported sports:', SUPPORTED_SPORTS.join(', '));
    process.exit(1);
  }

  return { sports, date };
}

// ============================================================================
// TEAM LOOKUP CACHE
// ============================================================================

type TeamCache = Map<string, string>; // teamID (external) -> participant id (UUID)

async function buildTeamCache(supabase: SupabaseClient, sport: string): Promise<TeamCache> {
  const cache: TeamCache = new Map();

  const { data: teams, error } = await supabase
    .from('participants')
    .select('id, external_id')
    .eq('type', 'team')
    .eq('sport', sport);

  if (error) {
    console.error(`Error fetching team cache for ${sport}: ${error.message}`);
    return cache;
  }

  for (const team of teams || []) {
    if (team.external_id) {
      cache.set(team.external_id, team.id);
    }
  }

  console.log(`Team cache for ${sport}: ${cache.size} teams`);
  return cache;
}

// ============================================================================
// UPSERT LOGIC
// ============================================================================

interface UpsertResult {
  inserted: number;
  updated: number;
  errors: number;
  total: number;
  withTeam: number;
}

async function upsertPlayers(
  supabase: SupabaseClient,
  players: SGOPlayer[],
  sport: string,
  teamCache: TeamCache
): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    errors: 0,
    total: players.length,
    withTeam: 0,
  };

  const today = new Date().toISOString().split('T')[0];

  for (const player of players) {
    try {
      // Check if player already exists
      const { data: existing } = await supabase
        .from('participants')
        .select('id, updated_at')
        .eq('external_id', player.playerID)
        .eq('sport', sport)
        .eq('type', 'player')
        .single();

      const playerName =
        player.names.long ||
        (player.names.first && player.names.last
          ? `${player.names.first} ${player.names.last}`
          : player.names.short) ||
        player.playerID;

      const displayName = player.names.short || player.names.last || playerName;

      const participantData = {
        external_id: player.playerID,
        type: 'player',
        name: playerName,
        display_name: displayName,
        sport: sport,
        league: player.leagueID,
        meta: {
          names: player.names,
          position: player.position,
          jersey: player.jersey,
          height: player.height,
          weight: player.weight,
          age: player.age,
          salary: player.salary,
          photoURL: player.photoURL,
          sgo_team_id: player.teamID,
          sgo_sport_id: player.sportID,
          sgo_league_id: player.leagueID,
        },
        active: true,
        updated_at: new Date().toISOString(),
      };

      let participantId: string;

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('participants')
          .update(participantData)
          .eq('id', existing.id);

        if (updateError) {
          console.error(`Error updating player ${player.playerID}: ${updateError.message}`);
          result.errors++;
          continue;
        }

        participantId = existing.id;
        result.updated++;
      } else {
        // Insert new
        const { data: insertedPlayer, error: insertError } = await supabase
          .from('participants')
          .insert(participantData)
          .select('id')
          .single();

        if (insertError || !insertedPlayer) {
          console.error(`Error inserting player ${player.playerID}: ${insertError?.message}`);
          result.errors++;
          continue;
        }

        participantId = insertedPlayer.id;
        result.inserted++;
      }

      // Link to team if available
      if (player.teamID) {
        const teamId = teamCache.get(player.teamID);
        if (teamId) {
          result.withTeam++;

          // Upsert membership (check if current membership exists)
          const { data: existingMembership } = await supabase
            .from('participant_memberships')
            .select('id')
            .eq('participant_id', participantId)
            .eq('team_id', teamId)
            .is('valid_to', null)
            .single();

          if (!existingMembership) {
            // Close any existing memberships for this player
            await supabase
              .from('participant_memberships')
              .update({ valid_to: today })
              .eq('participant_id', participantId)
              .is('valid_to', null);

            // Create new membership
            const { error: membershipError } = await supabase
              .from('participant_memberships')
              .insert({
                participant_id: participantId,
                team_id: teamId,
                role: player.position ? 'starter' : 'member',
                valid_from: today,
                valid_to: null,
                meta: {
                  position: player.position,
                  jersey: player.jersey,
                },
              });

            if (membershipError) {
              console.warn(
                `Warning: Could not create membership for ${player.playerID}: ${membershipError.message}`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error processing player ${player.playerID}:`, err);
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
  console.log('SYNC PLAYERS FROM SPORTSGAMEODDS');
  console.log('Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A');
  console.log('='.repeat(60));
  console.log();

  const { sports, date } = parseArgs();

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
  if (date) {
    console.log(`Date filter: ${date}`);
  }
  console.log();

  const overallResults: Record<string, UpsertResult> = {};
  const sampleRows: Array<{ sport: string; playerID: string; name: string; teamID?: string }> = [];

  for (const sport of sports) {
    console.log(`--- Syncing ${sport} players ---`);

    const leagueID = SPORT_TO_LEAGUE_ID[sport];
    if (!leagueID) {
      console.error(`No league ID mapping for sport: ${sport}`);
      continue;
    }

    try {
      // Build team cache for linking
      const teamCache = await buildTeamCache(supabase, sport);

      // Fetch players from SGO
      const players = await sgoClient.fetchAllPlayers(leagueID);

      if (players.length === 0) {
        console.log(`No players found for ${sport}`);
        overallResults[sport] = { inserted: 0, updated: 0, errors: 0, total: 0, withTeam: 0 };
        continue;
      }

      console.log(`Fetched ${players.length} players from SGO`);

      // Upsert into Supabase
      const result = await upsertPlayers(supabase, players, sport, teamCache);
      overallResults[sport] = result;

      const teamLinkPct =
        result.total > 0 ? ((result.withTeam / result.total) * 100).toFixed(1) : '0.0';
      console.log(
        `${sport}: inserted=${result.inserted}, updated=${result.updated}, errors=${result.errors}, team_linked=${teamLinkPct}%`
      );

      // Collect sample rows for proof
      for (const player of players.slice(0, 5)) {
        sampleRows.push({
          sport,
          playerID: player.playerID,
          name: player.names.long || player.names.short || player.playerID,
          teamID: player.teamID,
        });
      }
    } catch (err) {
      console.error(`Error syncing ${sport}:`, err);
      overallResults[sport] = { inserted: 0, updated: 0, errors: 1, total: 0, withTeam: 0 };
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
  let totalPlayers = 0;
  let totalWithTeam = 0;

  for (const [sport, result] of Object.entries(overallResults)) {
    const teamLinkPct =
      result.total > 0 ? ((result.withTeam / result.total) * 100).toFixed(1) : '0.0';
    console.log(
      `${sport}: inserted=${result.inserted}, updated=${result.updated}, errors=${result.errors}, total=${result.total}, team_linked=${teamLinkPct}%`
    );
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalErrors += result.errors;
    totalPlayers += result.total;
    totalWithTeam += result.withTeam;
  }

  console.log();
  const overallTeamLinkPct =
    totalPlayers > 0 ? ((totalWithTeam / totalPlayers) * 100).toFixed(1) : '0.0';
  console.log(
    `TOTAL: inserted=${totalInserted}, updated=${totalUpdated}, errors=${totalErrors}, total=${totalPlayers}, team_linked=${overallTeamLinkPct}%`
  );
  console.log();

  // Sample rows
  if (sampleRows.length > 0) {
    console.log('SAMPLE ROWS:');
    for (const row of sampleRows) {
      console.log(`  ${row.sport}: ${row.playerID} -> ${row.name} (team: ${row.teamID || 'N/A'})`);
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
