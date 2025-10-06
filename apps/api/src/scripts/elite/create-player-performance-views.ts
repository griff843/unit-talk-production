/**
 * Week 1, Day 1: Create Player Performance Aggregations
 * Part of Elite Status Roadmap - Part 2
 *
 * Creates materialized views from 2.3M settled outcomes to power:
 * - recent_games
 * - role_stability
 * - performance_trends
 * - prop_history
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function createPlayerPerformanceViews() {
  console.log('\n🚀 WEEK 1, DAY 1 - PART 2: Player Performance Aggregations\n');
  console.log('='.repeat(60));

  // Analyze current data distribution
  console.log('\n📊 Analyzing settled_outcomes data...\n');

  // Get sport distribution
  const { data: sportData } = await supabase
    .from('settled_outcomes')
    .select('sport')
    .limit(10000);

  if (sportData) {
    const sportCounts = sportData.reduce((acc: any, row: any) => {
      acc[row.sport] = (acc[row.sport] || 0) + 1;
      return acc;
    }, {});

    console.log('Sport Distribution (10K sample):');
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`   ${sport}: ${count} outcomes`);
    });
  }

  // Get date range
  const { data: dateRange } = await supabase
    .from('settled_outcomes')
    .select('game_date')
    .order('game_date', { ascending: false })
    .limit(1);

  if (dateRange && dateRange.length > 0) {
    console.log(`\n📅 Most recent game date: ${dateRange[0].game_date}`);
  }

  // Get unique players count
  const { data: players } = await supabase
    .from('settled_outcomes')
    .select('player_name')
    .limit(10000);

  if (players) {
    const uniquePlayers = new Set(players.map((p: any) => p.player_name)).size;
    console.log(`👥 Unique players (10K sample): ${uniquePlayers}`);
  }

  // Generate SQL for materialized view
  console.log('\n' + '='.repeat(60));
  console.log('📝 Materialized View SQL (run in Supabase SQL Editor):\n');

  const sql = `
-- Player Recent Performance (Last 30 Days)
CREATE MATERIALIZED VIEW IF NOT EXISTS player_recent_performance AS
SELECT
  player_name,
  sport,
  market_type,

  -- Performance metrics
  COUNT(*) as games_played,
  AVG(actual_value) as avg_performance,
  STDDEV(actual_value) as performance_volatility,
  MAX(actual_value) as max_performance,
  MIN(actual_value) as min_performance,

  -- Trend indicators
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '7 days' THEN actual_value END) as avg_last_7_days,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '14 days' AND game_date < CURRENT_DATE - INTERVAL '7 days' THEN actual_value END) as avg_prev_7_days,

  -- Hit rate on props
  AVG(CASE WHEN outcome = 'over' THEN 1.0 ELSE 0.0 END) as over_rate,

  -- Last updated
  MAX(game_date) as last_game_date,
  NOW() as refreshed_at

FROM settled_outcomes
WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
  AND actual_value IS NOT NULL
GROUP BY player_name, sport, market_type;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_recent_perf_player
  ON player_recent_performance(player_name, sport, market_type);

-- Prop History by Player and Market
CREATE MATERIALIZED VIEW IF NOT EXISTS player_prop_history AS
SELECT
  player_name,
  sport,
  market_type,
  line,

  -- Aggregated outcomes
  COUNT(*) as times_seen,
  AVG(actual_value) as avg_actual,
  AVG(CASE WHEN outcome = 'over' THEN 1.0 ELSE 0.0 END) as over_percentage,

  -- Recent performance on this specific line
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '14 days' THEN actual_value END) as recent_avg,

  MAX(game_date) as last_seen,
  NOW() as refreshed_at

FROM settled_outcomes
WHERE game_date >= CURRENT_DATE - INTERVAL '90 days'
  AND actual_value IS NOT NULL
GROUP BY player_name, sport, market_type, line
HAVING COUNT(*) >= 3;

-- Index
CREATE INDEX IF NOT EXISTS idx_player_prop_hist_lookup
  ON player_prop_history(player_name, sport, market_type, line);

-- Refresh schedule (add to cron):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY player_recent_performance;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY player_prop_history;
`;

  console.log(sql);
  console.log('='.repeat(60));

  console.log('\n✅ Generated SQL for materialized views');
  console.log('\n📊 Features This Will Unlock:');
  console.log('   ✅ recent_games - Last 30 days performance');
  console.log('   ✅ role_stability - Volatility and consistency metrics');
  console.log('   ✅ performance_trends - 7-day vs 14-day momentum');
  console.log('   ✅ prop_history - Line-specific historical performance');

  console.log('\n🎯 Estimated Impact: +1-2% WR');
  console.log('\n💡 Next: Create these views in Supabase SQL Editor, then build TypeScript wrapper\n');

  process.exit(0);
}

createPlayerPerformanceViews();
