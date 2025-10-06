/**
 * Check Today's Game Settlements - Tier 1 Validation
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTodaysSettlements() {
  console.log('🔍 Checking today\'s games (October 5, 2025)...\n');

  // Check outcomes from today
  const { data: todayGames, error } = await supabase
    .from('settled_outcomes')
    .select('sport, game_date, player_name, market_type, line, actual_value, outcome')
    .eq('game_date', '2025-10-05')
    .limit(50);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!todayGames || todayGames.length === 0) {
    console.log('⚠️  No games found for 2025-10-05');
    console.log('Checking recent games instead...\n');

    // Check last 7 days
    const { data: recentGames } = await supabase
      .from('settled_outcomes')
      .select('game_date')
      .gte('game_date', '2025-09-28')
      .order('game_date', { ascending: false })
      .limit(100);

    if (recentGames && recentGames.length > 0) {
      const dates = [...new Set(recentGames.map((g: any) => g.game_date))].sort().reverse();
      console.log('📅 Recent game dates:', dates.slice(0, 7).join(', '));

      // Get count for most recent date
      const mostRecent = dates[0];
      const { count } = await supabase
        .from('settled_outcomes')
        .select('*', { count: 'exact', head: true })
        .eq('game_date', mostRecent);

      console.log(`\n✅ Most recent: ${mostRecent} with ${count} settled outcomes`);
    }

    process.exit(0);
  }

  console.log(`✅ Found ${todayGames.length} settled outcomes for 2025-10-05\n`);

  // Show sample
  console.log('📊 Sample outcomes:');
  todayGames.slice(0, 10).forEach((game: any) => {
    console.log(`  ${game.sport} | ${game.player_name}`);
    console.log(`    ${game.market_type}: Line ${game.line}, Actual ${game.actual_value}, ${game.outcome}`);
  });

  // Count by sport
  const sportCounts = todayGames.reduce((acc: any, g: any) => {
    acc[g.sport] = (acc[g.sport] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Sport breakdown:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} outcomes`);
  });

  // Check settlement completeness
  const withActual = todayGames.filter((g: any) => g.actual_value !== null).length;
  const settlementRate = ((withActual / todayGames.length) * 100).toFixed(1);

  console.log(`\n✅ Settlement rate: ${settlementRate}% (${withActual}/${todayGames.length})`);

  if (parseFloat(settlementRate) >= 95) {
    console.log('🎉 Settlement system working perfectly!\n');
  } else {
    console.log('⚠️  Settlement rate below 95% - needs investigation\n');
  }

  process.exit(0);
}

checkTodaysSettlements();
