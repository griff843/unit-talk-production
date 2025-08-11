const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });

async function analyzeDataStructure() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Analyzing current data structure issues...\n');

  // Check what's in raw_props
  const { data: rawProps, error: propsError } = await supabase
    .from('raw_props')
    .select('stat_type, market_type, player_name, team, source, sport, line, odds')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!propsError && rawProps) {
    console.log('📊 Current raw_props contents (should be ONLY player props):');
    console.log('================================================================');

    const gameLines = [];
    const playerProps = [];

    rawProps.forEach(prop => {
      const statType = prop.stat_type || prop.market_type;
      if (['Moneyline', 'Spread', 'Total', 'Over/Under'].includes(statType)) {
        gameLines.push(prop);
      } else if (prop.player_name) {
        playerProps.push(prop);
      } else {
        gameLines.push(prop); // Assume non-player data is game line
      }
    });

    console.log(`\n❌ PROBLEM IDENTIFIED:`);
    console.log(`   Game Lines in raw_props: ${gameLines.length} (SHOULD BE 0)`);
    console.log(`   Player Props in raw_props: ${playerProps.length} (CORRECT)`);

    if (gameLines.length > 0) {
      console.log('\n🚨 Game lines found in raw_props (WRONG LOCATION):');
      gameLines.forEach((line, i) => {
        console.log(
          `   ${i + 1}. ${line.stat_type || line.market_type} - ${line.team || 'No team'} (${line.odds})`
        );
      });
    }

    if (playerProps.length > 0) {
      console.log('\n✅ Player props found in raw_props (CORRECT LOCATION):');
      playerProps.slice(0, 5).forEach((prop, i) => {
        console.log(
          `   ${i + 1}. ${prop.player_name} - ${prop.stat_type || prop.market_type} ${prop.line} (${prop.odds})`
        );
      });
    }
  }

  // Check what's in games table
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select(
      'sport, home_team, away_team, spread, total, moneyline_home, moneyline_away, home_odds, away_odds, source'
    )
    .order('created_at', { ascending: false })
    .limit(10);

  if (!gamesError && games) {
    console.log('\n📊 Current games table contents (should have game lines):');
    console.log('===========================================================');

    const gamesWithLines = games.filter(
      g => g.spread || g.total || g.moneyline_home || g.home_odds
    );
    const gamesWithoutLines = games.filter(
      g => !g.spread && !g.total && !g.moneyline_home && !g.home_odds
    );

    console.log(`\n📈 Games Analysis:`);
    console.log(`   Games WITH lines: ${gamesWithLines.length}`);
    console.log(`   Games WITHOUT lines: ${gamesWithoutLines.length}`);

    if (gamesWithLines.length > 0) {
      console.log('\n✅ Sample games WITH betting lines:');
      gamesWithLines.slice(0, 3).forEach((game, i) => {
        console.log(`   ${i + 1}. ${game.home_team} vs ${game.away_team}`);
        console.log(
          `      Spread: ${game.spread || 'N/A'} | Total: ${game.total || 'N/A'} | ML: ${game.moneyline_home || 'N/A'}`
        );
      });
    }

    if (gamesWithoutLines.length > 0) {
      console.log('\n⚠️ Sample games WITHOUT betting lines:');
      gamesWithoutLines.slice(0, 3).forEach((game, i) => {
        console.log(`   ${i + 1}. ${game.home_team} vs ${game.away_team} (Source: ${game.source})`);
      });
    }
  }

  // Get data source breakdown
  const { data: sourceBreakdown } = await supabase
    .from('raw_props')
    .select('source, stat_type, count(*)', { count: 'exact' });

  if (sourceBreakdown) {
    console.log('\n📋 Data Source Breakdown in raw_props:');

    // Group by source and type
    const summary = {};
    const { data: allProps } = await supabase
      .from('raw_props')
      .select('source, stat_type, market_type, player_name');

    if (allProps) {
      allProps.forEach(prop => {
        const source = prop.source;
        const statType = prop.stat_type || prop.market_type || 'Unknown';
        const isPlayerProp = !!prop.player_name;

        if (!summary[source]) summary[source] = { playerProps: 0, gameLines: 0, types: new Set() };

        if (isPlayerProp) {
          summary[source].playerProps++;
        } else {
          summary[source].gameLines++;
        }
        summary[source].types.add(statType);
      });

      Object.keys(summary).forEach(source => {
        const stats = summary[source];
        console.log(`\n   ${source}:`);
        console.log(`     Player Props: ${stats.playerProps} ✅`);
        console.log(
          `     Game Lines: ${stats.gameLines} ${stats.gameLines > 0 ? '❌ (should be in games table)' : '✅'}`
        );
        console.log(`     Types: ${Array.from(stats.types).join(', ')}`);
      });
    }
  }

  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('1. Move Moneyline/Spread/Total data FROM raw_props TO games table');
  console.log('2. Keep ONLY player props (with player_name) in raw_props table');
  console.log('3. Update ingestion to separate game lines from player props');
  console.log('4. Add proper game line fields to games table structure');
}

analyzeDataStructure().catch(console.error);
