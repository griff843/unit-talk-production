import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const season = new Date().getFullYear();

const leagueAverages = [
  { sport: 'NBA', season, market_type: 'player_points', stat_name: 'points', average_value: 15.5, median_value: 14.0, std_deviation: 8.2, sample_size: 500, percentile_25: 8.0, percentile_50: 14.0, percentile_75: 21.0, percentile_90: 28.0 },
  { sport: 'NBA', season, market_type: 'player_rebounds', stat_name: 'rebounds', average_value: 5.8, median_value: 5.0, std_deviation: 3.2, sample_size: 500, percentile_25: 3.0, percentile_50: 5.0, percentile_75: 8.0, percentile_90: 11.0 },
  { sport: 'NBA', season, market_type: 'player_assists', stat_name: 'assists', average_value: 3.5, median_value: 2.5, std_deviation: 2.8, sample_size: 500, percentile_25: 1.0, percentile_50: 2.5, percentile_75: 5.0, percentile_90: 8.0 },
  { sport: 'NBA', season, market_type: 'player_threes', stat_name: 'three_pointers_made', average_value: 1.8, median_value: 1.5, std_deviation: 1.5, sample_size: 500, percentile_25: 0.5, percentile_50: 1.5, percentile_75: 2.5, percentile_90: 4.0 },
  { sport: 'NFL', season, market_type: 'player_pass_yds', stat_name: 'passing_yards', average_value: 245.0, median_value: 240.0, std_deviation: 75.0, sample_size: 200, percentile_25: 180.0, percentile_50: 240.0, percentile_75: 295.0, percentile_90: 350.0 },
  { sport: 'NFL', season, market_type: 'player_pass_tds', stat_name: 'passing_touchdowns', average_value: 1.8, median_value: 2.0, std_deviation: 1.2, sample_size: 200, percentile_25: 1.0, percentile_50: 2.0, percentile_75: 2.5, percentile_90: 3.5 },
  { sport: 'NFL', season, market_type: 'player_rush_yds', stat_name: 'rushing_yards', average_value: 75.0, median_value: 65.0, std_deviation: 45.0, sample_size: 300, percentile_25: 35.0, percentile_50: 65.0, percentile_75: 105.0, percentile_90: 145.0 },
  { sport: 'NFL', season, market_type: 'player_receptions', stat_name: 'receptions', average_value: 5.2, median_value: 5.0, std_deviation: 2.8, sample_size: 300, percentile_25: 3.0, percentile_50: 5.0, percentile_75: 7.0, percentile_90: 9.0 },
  { sport: 'NFL', season, market_type: 'player_reception_yds', stat_name: 'receiving_yards', average_value: 62.0, median_value: 55.0, std_deviation: 38.0, sample_size: 300, percentile_25: 30.0, percentile_50: 55.0, percentile_75: 85.0, percentile_90: 120.0 },
  { sport: 'MLB', season, market_type: 'batter_total_bases', stat_name: 'total_bases', average_value: 1.8, median_value: 1.5, std_deviation: 1.5, sample_size: 600, percentile_25: 0.5, percentile_50: 1.5, percentile_75: 2.5, percentile_90: 4.0 },
  { sport: 'MLB', season, market_type: 'batter_hits', stat_name: 'hits', average_value: 1.0, median_value: 1.0, std_deviation: 0.9, sample_size: 600, percentile_25: 0.0, percentile_50: 1.0, percentile_75: 1.5, percentile_90: 2.5 },
  { sport: 'MLB', season, market_type: 'pitcher_strikeouts', stat_name: 'strikeouts', average_value: 5.5, median_value: 5.0, std_deviation: 2.2, sample_size: 400, percentile_25: 4.0, percentile_50: 5.0, percentile_75: 7.0, percentile_90: 9.0 },
  { sport: 'NHL', season, market_type: 'player_points', stat_name: 'points', average_value: 0.9, median_value: 0.5, std_deviation: 0.8, sample_size: 400, percentile_25: 0.0, percentile_50: 0.5, percentile_75: 1.5, percentile_90: 2.5 },
  { sport: 'NHL', season, market_type: 'player_shots_on_goal', stat_name: 'shots_on_goal', average_value: 2.8, median_value: 2.5, std_deviation: 1.5, sample_size: 400, percentile_25: 1.5, percentile_50: 2.5, percentile_75: 4.0, percentile_90: 5.5 },
  { sport: 'NCAAF', season, market_type: 'player_pass_yds', stat_name: 'passing_yards', average_value: 225.0, median_value: 215.0, std_deviation: 85.0, sample_size: 150, percentile_25: 160.0, percentile_50: 215.0, percentile_75: 280.0, percentile_90: 340.0 },
  { sport: 'NCAAB', season, market_type: 'player_points', stat_name: 'points', average_value: 14.2, median_value: 13.0, std_deviation: 7.5, sample_size: 350, percentile_25: 8.0, percentile_50: 13.0, percentile_75: 19.0, percentile_90: 25.0 },
];

async function insertLeagueAverages() {
  console.log('📊 Inserting league averages...\n');

  const { data, error } = await supabase
    .from('league_averages')
    .upsert(leagueAverages, {
      onConflict: 'sport,season,market_type,stat_name',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${leagueAverages.length} league averages`);

  leagueAverages.forEach(avg => {
    console.log(`   - ${avg.sport} ${avg.market_type}: avg=${avg.average_value}`);
  });
}

insertLeagueAverages();
