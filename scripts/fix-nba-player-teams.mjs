/**
 * SPRINT-SMARTFORM-PLAYER-DROPDOWN-FIX
 *
 * ⚠️  DEPRECATED: This script writes to the legacy `players` table.
 * The canonical source is now `participants` + `participant_memberships`.
 * See: SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091
 *
 * Fix NBA player team assignments in the players table.
 * Uses ESPN API to get correct team associations.
 *
 * Problem: Feb 13 import assigned players to wrong teams.
 * Solution: Query ESPN roster API for each team, match players, update.
 */

// ============================================================
// LEGACY WRITE GUARD - Requires explicit opt-in
// ============================================================
if (process.env.LEGACY_PLAYERS_WRITE !== 'true') {
  console.error(`
╔═══════════════════════════════════════════════════════════════════════════╗
║  ⚠️  DEPRECATED SCRIPT - LEGACY PLAYERS TABLE                              ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  This script writes to the DEPRECATED 'players' table.                    ║
║  The canonical source is now 'participants' + 'participant_memberships'.  ║
║                                                                           ║
║  To run anyway (NOT RECOMMENDED), set:                                    ║
║    LEGACY_PLAYERS_WRITE=true node scripts/fix-nba-player-teams.mjs        ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

console.warn('\n⚠️  WARNING: Writing to DEPRECATED players table. Use participants instead.\n');

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ESPN team IDs mapped to our team_ids
const ESPN_TEAMS = [
  { espnId: 1, teamId: 'team_nba_atlanta_hawks', name: 'Atlanta Hawks' },
  { espnId: 2, teamId: 'team_nba_boston_celtics', name: 'Boston Celtics' },
  { espnId: 17, teamId: 'team_nba_brooklyn_nets', name: 'Brooklyn Nets' },
  { espnId: 30, teamId: 'team_nba_charlotte_hornets', name: 'Charlotte Hornets' },
  { espnId: 4, teamId: 'team_nba_chicago_bulls', name: 'Chicago Bulls' },
  { espnId: 5, teamId: 'team_nba_cleveland_cavaliers', name: 'Cleveland Cavaliers' },
  { espnId: 6, teamId: 'team_nba_dallas_mavericks', name: 'Dallas Mavericks' },
  { espnId: 7, teamId: 'team_nba_denver_nuggets', name: 'Denver Nuggets' },
  { espnId: 8, teamId: 'team_nba_detroit_pistons', name: 'Detroit Pistons' },
  { espnId: 9, teamId: 'team_nba_golden_state_warrior', name: 'Golden State Warriors' },
  { espnId: 10, teamId: 'team_nba_houston_rockets', name: 'Houston Rockets' },
  { espnId: 11, teamId: 'team_nba_indiana_pacers', name: 'Indiana Pacers' },
  { espnId: 12, teamId: 'team_nba_los_angeles_clippers', name: 'Los Angeles Clippers' },
  { espnId: 13, teamId: 'team_nba_los_angeles_lakers', name: 'Los Angeles Lakers' },
  { espnId: 29, teamId: 'team_nba_memphis_grizzlies', name: 'Memphis Grizzlies' },
  { espnId: 14, teamId: 'team_nba_miami_heat', name: 'Miami Heat' },
  { espnId: 15, teamId: 'team_nba_milwaukee_bucks', name: 'Milwaukee Bucks' },
  { espnId: 16, teamId: 'team_nba_minnesota_timberwolv', name: 'Minnesota Timberwolves' },
  { espnId: 3, teamId: 'team_nba_new_orleans_pelicans', name: 'New Orleans Pelicans' },
  { espnId: 18, teamId: 'team_nba_new_york_knicks', name: 'New York Knicks' },
  { espnId: 25, teamId: 'team_nba_oklahoma_city_thunde', name: 'Oklahoma City Thunder' },
  { espnId: 19, teamId: 'team_nba_orlando_magic', name: 'Orlando Magic' },
  { espnId: 20, teamId: 'team_nba_philadelphia_76ers', name: 'Philadelphia 76ers' },
  { espnId: 21, teamId: 'team_nba_phoenix_suns', name: 'Phoenix Suns' },
  { espnId: 22, teamId: 'team_nba_portland_trail_blaze', name: 'Portland Trail Blazers' },
  { espnId: 23, teamId: 'team_nba_sacramento_kings', name: 'Sacramento Kings' },
  { espnId: 24, teamId: 'team_nba_san_antonio_spurs', name: 'San Antonio Spurs' },
  { espnId: 28, teamId: 'team_nba_toronto_raptors', name: 'Toronto Raptors' },
  { espnId: 26, teamId: 'team_nba_utah_jazz', name: 'Utah Jazz' },
  { espnId: 27, teamId: 'team_nba_washington_wizards', name: 'Washington Wizards' },
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch roster from ESPN API
 */
async function fetchEspnRoster(espnTeamId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}/roster`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`  ESPN API error for team ${espnTeamId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.athletes || []).map(a => ({
      displayName: a.displayName,
      firstName: a.firstName,
      lastName: a.lastName,
    }));
  } catch (error) {
    console.log(`  ESPN fetch error for team ${espnTeamId}: ${error.message}`);
    return [];
  }
}

/**
 * Normalize player name for matching
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Main fix function
 */
async function fixNbaPlayerTeams() {
  console.log('=== NBA PLAYER TEAM FIX (ESPN) ===\n');
  console.log('Fetching current rosters from ESPN...\n');

  // Build roster map: normalized_name -> team_id
  const rosterMap = new Map();

  for (const team of ESPN_TEAMS) {
    console.log(`Fetching ${team.name}...`);
    const roster = await fetchEspnRoster(team.espnId);

    for (const player of roster) {
      const normalizedName = normalizeName(player.displayName);
      rosterMap.set(normalizedName, {
        teamId: team.teamId,
        teamName: team.name,
        playerName: player.displayName
      });
    }

    console.log(`  Found ${roster.length} players`);
    await sleep(200); // Rate limit
  }

  console.log(`\nTotal players in roster map: ${rosterMap.size}\n`);

  // Get all NBA players from database
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('id, full_name, team_id, sport')
    .eq('sport', 'NBA')
    .order('full_name');

  if (playersErr) {
    console.error('Failed to fetch players:', playersErr.message);
    return;
  }

  console.log(`Found ${players.length} NBA players in database\n`);

  const fixes = [];
  let matched = 0;
  let alreadyCorrect = 0;
  let notFound = 0;

  for (const player of players) {
    const normalizedName = normalizeName(player.full_name);
    const rosterEntry = rosterMap.get(normalizedName);

    if (!rosterEntry) {
      // Try partial match (first + last name separately)
      const nameParts = normalizedName.split(' ');
      if (nameParts.length >= 2) {
        // Try just first and last
        const simpleName = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
        const simpleMatch = rosterMap.get(simpleName);
        if (simpleMatch) {
          if (player.team_id === simpleMatch.teamId) {
            alreadyCorrect++;
          } else {
            fixes.push({
              id: player.id,
              full_name: player.full_name,
              old_team_id: player.team_id,
              new_team_id: simpleMatch.teamId,
              new_team_name: simpleMatch.teamName
            });
          }
          matched++;
          continue;
        }
      }
      notFound++;
      continue;
    }

    matched++;
    if (player.team_id === rosterEntry.teamId) {
      alreadyCorrect++;
    } else {
      fixes.push({
        id: player.id,
        full_name: player.full_name,
        old_team_id: player.team_id,
        new_team_id: rosterEntry.teamId,
        new_team_name: rosterEntry.teamName
      });
    }
  }

  console.log('=== MATCH RESULTS ===');
  console.log(`Matched: ${matched}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Needs fix: ${fixes.length}`);
  console.log(`Not found in rosters: ${notFound}`);

  if (fixes.length > 0) {
    console.log('\n=== FIXES TO APPLY ===');
    fixes.slice(0, 20).forEach(f => {
      console.log(`  ${f.full_name}: ${f.old_team_id} -> ${f.new_team_id} (${f.new_team_name})`);
    });
    if (fixes.length > 20) {
      console.log(`  ... and ${fixes.length - 20} more`);
    }

    console.log('\n=== APPLYING FIXES ===');
    let success = 0;
    let failed = 0;

    for (const fix of fixes) {
      const { error } = await supabase
        .from('players')
        .update({ team_id: fix.new_team_id, updated_at: new Date().toISOString() })
        .eq('id', fix.id);

      if (error) {
        console.log(`  FAIL: ${fix.full_name} - ${error.message}`);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`\nApplied: ${success} successful, ${failed} failed`);
  }

  // Generate proof
  const proof = {
    timestamp: new Date().toISOString(),
    source: 'ESPN API',
    total_db_players: players.length,
    total_roster_players: rosterMap.size,
    matched: matched,
    already_correct: alreadyCorrect,
    fixes_applied: fixes.length,
    not_found: notFound,
    sample_fixes: fixes.slice(0, 30)
  };

  console.log('\n=== PROOF ===');
  console.log(JSON.stringify(proof, null, 2));
}

// Run
fixNbaPlayerTeams().catch(console.error);
