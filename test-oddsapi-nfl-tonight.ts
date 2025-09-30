import { fetchOddsApiProps, testOddsApiConnection } from './apps/api/src/agents/FeedAgent/oddsApi.js';

async function testNFLTonight() {
  try {
    // Test connection first
    console.log('🚀 Testing OddsAPI connection...');
    const connection = await testOddsApiConnection();
    console.log('Connection result:', JSON.stringify(connection, null, 2));

    if (!connection.connected) {
      console.error('❌ OddsAPI connection failed:', connection.error);
      return;
    }

    // Fetch NFL props for tonight
    console.log('🏈 Fetching NFL props for tonight...');
    const nflProps = await fetchOddsApiProps('americanfootball_nfl', ['h2h', 'spreads', 'totals']);
    console.log(`✅ Found ${nflProps.length} NFL props`);

    if (nflProps.length === 0) {
      console.log('⚠️ No NFL props found - may be off-season or no games tonight');
      return;
    }

    // Show first few props for verification
    console.log('📊 Sample props:');
    nflProps.slice(0, 5).forEach((prop, i) => {
      console.log(`${i+1}. ${prop.home_team} vs ${prop.away_team} - ${prop.stat_type} - Line: ${prop.line} - Odds: ${prop.odds}`);
    });

    // Group by games for better view
    const gameGroups = nflProps.reduce((acc, prop) => {
      const gameKey = `${prop.away_team} @ ${prop.home_team}`;
      if (!acc[gameKey]) {
        acc[gameKey] = [];
      }
      acc[gameKey].push(prop);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('🎯 Tonight\'s NFL Games:');
    Object.entries(gameGroups).forEach(([game, props]) => {
      console.log(`  ${game} - ${props.length} betting options`);
      console.log(`    Game Time: ${props[0]?.game_time}`);
    });

    return nflProps;

  } catch (error) {
    console.error('❌ Error testing NFL props:', error);
    throw error;
  }
}

testNFLTonight().catch(console.error);