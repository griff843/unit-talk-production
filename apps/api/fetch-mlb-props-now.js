const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchMLBPropsNow() {
  console.log('🚀 FETCHING REAL MLB PROPS FROM ODDS API');
  console.log('========================================\n');
  
  try {
    // Import the Odds API functions
    const { fetchOddsApiProps } = await import('./src/agents/FeedAgent/oddsApi.js');
    
    console.log('📡 Fetching MLB data from Odds API...');
    
    // Fetch MLB props (player props, spreads, totals, moneylines)
    const mlbData = await fetchOddsApiProps('baseball_mlb', ['h2h', 'spreads', 'totals']);
    
    console.log(`✅ Fetched ${mlbData.length} MLB betting lines`);
    
    if (mlbData.length === 0) {
      console.log('⚠️  No MLB data available - may be off-season or no games today');
      return;
    }
    
    // Show sample data
    console.log('\n📊 Sample MLB data:');
    mlbData.slice(0, 3).forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.player_name || 'Team'} - ${prop.stat_type} ${prop.line} (${prop.odds})`);
      console.log(`   Game: ${prop.matchup}`);
      console.log(`   Time: ${prop.game_date}`);
    });
    
    // Transform data for database insertion
    console.log('\n💾 Inserting props into database...');
    
    const propsToInsert = mlbData.map(prop => ({
      external_id: prop.id,
      external_game_id: prop.game_id,
      player_name: prop.player_name || 'Team',
      team: prop.team,
      opponent: prop.opponent,
      sport: 'MLB',
      league: 'MLB',
      stat_type: prop.stat_type,
      market_type: prop.market_type || 'team_props',
      line: prop.line,
      over_odds: prop.odds,
      under_odds: prop.odds,
      odds: prop.odds,
      game_time: prop.game_date,
      game_date: prop.game_date?.split('T')[0],
      provider: 'odds-api',
      source: 'odds-api',
      scraped_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    // Insert in batches to avoid overwhelming the database
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < propsToInsert.length; i += batchSize) {
      const batch = propsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('raw_props')
        .insert(batch)
        .select('id');
        
      if (error) {
        console.log(`⚠️  Batch ${Math.floor(i/batchSize) + 1} error:`, error.message);
      } else {
        insertedCount += data?.length || 0;
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${data?.length || 0} props`);
      }
    }
    
    console.log(`\n🎉 Successfully inserted ${insertedCount} MLB props!`);
    
    // Now link the props to games
    console.log('\n🔗 Linking props to games...');
    
    // Get unique game identifiers from the props
    const gameIds = [...new Set(mlbData.map(prop => prop.game_id).filter(Boolean))];
    console.log(`Found ${gameIds.length} unique games in props data`);
    
    // Try to match with existing games
    let linkedCount = 0;
    
    for (const gameId of gameIds) {
      // Find matching game in database
      const { data: matchingGame } = await supabase
        .from('games')
        .select('id')
        .eq('external_game_id', gameId)
        .single();
        
      if (matchingGame) {
        // Update props with this game_id
        const { error } = await supabase
          .from('raw_props')
          .update({ game_id: matchingGame.id })
          .eq('external_game_id', gameId)
          .is('game_id', null);
          
        if (!error) {
          linkedCount++;
        }
      }
    }
    
    console.log(`✅ Linked props for ${linkedCount} games`);
    
    // Final verification
    console.log('\n📊 Final verification...');
    
    const { data: totalMLBProps } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' })
      .eq('sport', 'MLB');
      
    const { data: linkedMLBProps } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' })
      .eq('sport', 'MLB')
      .not('game_id', 'is', null);
      
    console.log(`📊 Total MLB props in database: ${totalMLBProps?.length || 0}`);
    console.log(`🔗 Linked MLB props: ${linkedMLBProps?.length || 0}`);
    
    const linkPercentage = totalMLBProps?.length > 0 ? 
      Math.round((linkedMLBProps?.length || 0) / totalMLBProps.length * 100) : 0;
    console.log(`📈 Link percentage: ${linkPercentage}%`);
    
    console.log('\n🎯 REAL MLB PROPS ARE NOW AVAILABLE!');
    console.log('Your submit form will now show real props for MLB games.');
    
  } catch (error) {
    console.error('💥 Error fetching MLB props:', error);
  }
}

fetchMLBPropsNow();
