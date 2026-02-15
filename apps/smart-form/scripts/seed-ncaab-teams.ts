/**
 * NCAAB-TEAMS-SEED-001: Seed NCAAB teams into cloud Supabase
 *
 * Run via: docker-compose exec smart-form npx tsx scripts/seed-ncaab-teams.ts
 *
 * Idempotent: Uses upsert with ON CONFLICT DO UPDATE
 */

import { createClient } from '@supabase/supabase-js';

const NCAAB_TEAMS = [
  // ACC
  { id: 'team_ncaab_duke_blue_devils', name: 'Duke Blue Devils', abbr: 'DUKE' },
  { id: 'team_ncaab_north_carolina_tar_heels', name: 'North Carolina Tar Heels', abbr: 'UNC' },
  { id: 'team_ncaab_virginia_cavaliers', name: 'Virginia Cavaliers', abbr: 'UVA' },
  { id: 'team_ncaab_louisville_cardinals', name: 'Louisville Cardinals', abbr: 'LOU' },
  { id: 'team_ncaab_florida_state_seminoles', name: 'Florida State Seminoles', abbr: 'FSU' },
  { id: 'team_ncaab_syracuse_orange', name: 'Syracuse Orange', abbr: 'SYR' },
  { id: 'team_ncaab_clemson_tigers', name: 'Clemson Tigers', abbr: 'CLEM' },
  { id: 'team_ncaab_nc_state_wolfpack', name: 'NC State Wolfpack', abbr: 'NCST' },
  { id: 'team_ncaab_wake_forest_demon_deacons', name: 'Wake Forest Demon Deacons', abbr: 'WAKE' },
  { id: 'team_ncaab_virginia_tech_hokies', name: 'Virginia Tech Hokies', abbr: 'VT' },
  { id: 'team_ncaab_miami_hurricanes', name: 'Miami Hurricanes', abbr: 'MIA' },
  { id: 'team_ncaab_pittsburgh_panthers', name: 'Pittsburgh Panthers', abbr: 'PITT' },
  { id: 'team_ncaab_boston_college_eagles', name: 'Boston College Eagles', abbr: 'BC' },
  { id: 'team_ncaab_georgia_tech_yellow_jackets', name: 'Georgia Tech Yellow Jackets', abbr: 'GT' },
  { id: 'team_ncaab_notre_dame_fighting_irish', name: 'Notre Dame Fighting Irish', abbr: 'ND' },

  // Big Ten
  { id: 'team_ncaab_michigan_wolverines', name: 'Michigan Wolverines', abbr: 'MICH' },
  { id: 'team_ncaab_michigan_state_spartans', name: 'Michigan State Spartans', abbr: 'MSU' },
  { id: 'team_ncaab_ohio_state_buckeyes', name: 'Ohio State Buckeyes', abbr: 'OSU' },
  { id: 'team_ncaab_indiana_hoosiers', name: 'Indiana Hoosiers', abbr: 'IND' },
  { id: 'team_ncaab_purdue_boilermakers', name: 'Purdue Boilermakers', abbr: 'PUR' },
  { id: 'team_ncaab_illinois_fighting_illini', name: 'Illinois Fighting Illini', abbr: 'ILL' },
  { id: 'team_ncaab_wisconsin_badgers', name: 'Wisconsin Badgers', abbr: 'WIS' },
  { id: 'team_ncaab_iowa_hawkeyes', name: 'Iowa Hawkeyes', abbr: 'IOWA' },
  { id: 'team_ncaab_penn_state_nittany_lions', name: 'Penn State Nittany Lions', abbr: 'PSU' },
  { id: 'team_ncaab_maryland_terrapins', name: 'Maryland Terrapins', abbr: 'MD' },
  { id: 'team_ncaab_rutgers_scarlet_knights', name: 'Rutgers Scarlet Knights', abbr: 'RUT' },
  { id: 'team_ncaab_minnesota_golden_gophers', name: 'Minnesota Golden Gophers', abbr: 'MINN' },
  { id: 'team_ncaab_northwestern_wildcats', name: 'Northwestern Wildcats', abbr: 'NW' },
  { id: 'team_ncaab_nebraska_cornhuskers', name: 'Nebraska Cornhuskers', abbr: 'NEB' },

  // Big 12
  { id: 'team_ncaab_kansas_jayhawks', name: 'Kansas Jayhawks', abbr: 'KU' },
  { id: 'team_ncaab_baylor_bears', name: 'Baylor Bears', abbr: 'BAY' },
  { id: 'team_ncaab_texas_longhorns', name: 'Texas Longhorns', abbr: 'TEX' },
  { id: 'team_ncaab_texas_tech_red_raiders', name: 'Texas Tech Red Raiders', abbr: 'TTU' },
  { id: 'team_ncaab_west_virginia_mountaineers', name: 'West Virginia Mountaineers', abbr: 'WVU' },
  { id: 'team_ncaab_oklahoma_sooners', name: 'Oklahoma Sooners', abbr: 'OU' },
  { id: 'team_ncaab_oklahoma_state_cowboys', name: 'Oklahoma State Cowboys', abbr: 'OKST' },
  { id: 'team_ncaab_kansas_state_wildcats', name: 'Kansas State Wildcats', abbr: 'KSU' },
  { id: 'team_ncaab_iowa_state_cyclones', name: 'Iowa State Cyclones', abbr: 'ISU' },
  { id: 'team_ncaab_tcu_horned_frogs', name: 'TCU Horned Frogs', abbr: 'TCU' },
  { id: 'team_ncaab_ucf_knights', name: 'UCF Knights', abbr: 'UCF' },
  { id: 'team_ncaab_cincinnati_bearcats', name: 'Cincinnati Bearcats', abbr: 'CIN' },
  { id: 'team_ncaab_houston_cougars', name: 'Houston Cougars', abbr: 'HOU' },
  { id: 'team_ncaab_byu_cougars', name: 'BYU Cougars', abbr: 'BYU' },

  // SEC
  { id: 'team_ncaab_kentucky_wildcats', name: 'Kentucky Wildcats', abbr: 'UK' },
  { id: 'team_ncaab_tennessee_volunteers', name: 'Tennessee Volunteers', abbr: 'TENN' },
  { id: 'team_ncaab_auburn_tigers', name: 'Auburn Tigers', abbr: 'AUB' },
  { id: 'team_ncaab_alabama_crimson_tide', name: 'Alabama Crimson Tide', abbr: 'BAMA' },
  { id: 'team_ncaab_arkansas_razorbacks', name: 'Arkansas Razorbacks', abbr: 'ARK' },
  { id: 'team_ncaab_lsu_tigers', name: 'LSU Tigers', abbr: 'LSU' },
  { id: 'team_ncaab_florida_gators', name: 'Florida Gators', abbr: 'FLA' },
  { id: 'team_ncaab_georgia_bulldogs', name: 'Georgia Bulldogs', abbr: 'UGA' },
  { id: 'team_ncaab_ole_miss_rebels', name: 'Ole Miss Rebels', abbr: 'MISS' },
  { id: 'team_ncaab_mississippi_state_bulldogs', name: 'Mississippi State Bulldogs', abbr: 'MSST' },
  { id: 'team_ncaab_south_carolina_gamecocks', name: 'South Carolina Gamecocks', abbr: 'SC' },
  { id: 'team_ncaab_texas_a_and_m_aggies', name: 'Texas A&M Aggies', abbr: 'TAMU' },
  { id: 'team_ncaab_missouri_tigers', name: 'Missouri Tigers', abbr: 'MIZ' },
  { id: 'team_ncaab_vanderbilt_commodores', name: 'Vanderbilt Commodores', abbr: 'VAN' },

  // Pac-12
  { id: 'team_ncaab_ucla_bruins', name: 'UCLA Bruins', abbr: 'UCLA' },
  { id: 'team_ncaab_usc_trojans', name: 'USC Trojans', abbr: 'USC' },
  { id: 'team_ncaab_arizona_wildcats', name: 'Arizona Wildcats', abbr: 'ARIZ' },
  { id: 'team_ncaab_arizona_state_sun_devils', name: 'Arizona State Sun Devils', abbr: 'ASU' },
  { id: 'team_ncaab_oregon_ducks', name: 'Oregon Ducks', abbr: 'ORE' },
  { id: 'team_ncaab_colorado_buffaloes', name: 'Colorado Buffaloes', abbr: 'COLO' },
  { id: 'team_ncaab_utah_utes', name: 'Utah Utes', abbr: 'UTAH' },
  { id: 'team_ncaab_washington_huskies', name: 'Washington Huskies', abbr: 'WASH' },

  // Big East
  { id: 'team_ncaab_villanova_wildcats', name: 'Villanova Wildcats', abbr: 'NOVA' },
  { id: 'team_ncaab_connecticut_huskies', name: 'Connecticut Huskies', abbr: 'UCONN' },
  { id: 'team_ncaab_creighton_bluejays', name: 'Creighton Bluejays', abbr: 'CREI' },
  { id: 'team_ncaab_marquette_golden_eagles', name: 'Marquette Golden Eagles', abbr: 'MARQ' },
  { id: 'team_ncaab_xavier_musketeers', name: 'Xavier Musketeers', abbr: 'XAV' },
  { id: 'team_ncaab_providence_friars', name: 'Providence Friars', abbr: 'PROV' },
  { id: 'team_ncaab_seton_hall_pirates', name: 'Seton Hall Pirates', abbr: 'SH' },
  { id: 'team_ncaab_butler_bulldogs', name: 'Butler Bulldogs', abbr: 'BUT' },
  { id: 'team_ncaab_st_johns_red_storm', name: 'St. Johns Red Storm', abbr: 'STJ' },
  { id: 'team_ncaab_georgetown_hoyas', name: 'Georgetown Hoyas', abbr: 'GTWN' },
  { id: 'team_ncaab_depaul_blue_demons', name: 'DePaul Blue Demons', abbr: 'DEP' },

  // Notable Mid-Majors
  { id: 'team_ncaab_gonzaga_bulldogs', name: 'Gonzaga Bulldogs', abbr: 'GONZ' },
  { id: 'team_ncaab_memphis_tigers', name: 'Memphis Tigers', abbr: 'MEM' },
  { id: 'team_ncaab_san_diego_state_aztecs', name: 'San Diego State Aztecs', abbr: 'SDSU' },
  { id: 'team_ncaab_dayton_flyers', name: 'Dayton Flyers', abbr: 'DAY' },
  { id: 'team_ncaab_saint_marys_gaels', name: 'Saint Marys Gaels', abbr: 'SMC' },
  { id: 'team_ncaab_vcu_rams', name: 'VCU Rams', abbr: 'VCU' },
  { id: 'team_ncaab_nevada_wolf_pack', name: 'Nevada Wolf Pack', abbr: 'NEV' },
  { id: 'team_ncaab_wichita_state_shockers', name: 'Wichita State Shockers', abbr: 'WICH' },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing SUPABASE_URL or SUPABASE_KEY environment variables');
    process.exit(1);
  }

  console.log(`[NCAAB-TEAMS-SEED] Connecting to: ${supabaseUrl}`);
  console.log(`[NCAAB-TEAMS-SEED] Teams to seed: ${NCAAB_TEAMS.length}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check current NCAAB count (before)
  const { count: beforeCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAAB');

  console.log(`[NCAAB-TEAMS-SEED] NCAAB teams before: ${beforeCount || 0}`);

  // Prepare data for upsert
  const teamsData = NCAAB_TEAMS.map(t => ({
    id: t.id,
    name: t.name,
    abbr: t.abbr,
    sport: 'NCAAB',
  }));

  // Upsert (idempotent)
  const { data, error } = await supabase
    .from('teams')
    .upsert(teamsData, {
      onConflict: 'id',
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    console.error('[NCAAB-TEAMS-SEED] ERROR:', error.message);
    console.error('[NCAAB-TEAMS-SEED] Details:', error.details);
    process.exit(1);
  }

  console.log(`[NCAAB-TEAMS-SEED] Upserted: ${data?.length || 0} teams`);

  // Check current NCAAB count (after)
  const { count: afterCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAAB');

  console.log(`[NCAAB-TEAMS-SEED] NCAAB teams after: ${afterCount || 0}`);

  // Get NBA count for comparison
  const { count: nbaCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');

  console.log(`[NCAAB-TEAMS-SEED] NBA teams (comparison): ${nbaCount || 0}`);

  // Output JSON summary
  const summary = {
    timestamp: new Date().toISOString(),
    operation: 'upsert',
    ncaab_before: beforeCount || 0,
    ncaab_after: afterCount || 0,
    ncaab_seeded: NCAAB_TEAMS.length,
    nba_count: nbaCount || 0,
    status: 'SUCCESS',
  };

  console.log('\n[NCAAB-TEAMS-SEED] Summary:');
  console.log(JSON.stringify(summary, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('[NCAAB-TEAMS-SEED] Fatal error:', err);
  process.exit(1);
});
