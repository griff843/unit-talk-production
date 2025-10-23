require('dotenv/config');
const axios = require('axios');

console.log('🔍 Direct API Connectivity Test');
console.log('='.repeat(50));
console.log('Date:', new Date().toLocaleString());

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('OPTIMAL_API_KEY:', process.env.OPTIMAL_API_KEY ? `Set (${process.env.OPTIMAL_API_KEY.substring(0, 15)}...)` : 'NOT SET');
console.log('ODDS_API_KEY:', process.env.ODDS_API_KEY ? `Set (${process.env.ODDS_API_KEY.substring(0, 15)}...)` : 'NOT SET');

async function testApiConnectivity() {
  console.log('\n🌐 API Connectivity Tests:');
  
  // Test 1: Odds API - Get available sports
  console.log('\n1. Testing Odds API...');
  try {
    const sportsResponse = await axios.get('https://api.the-odds-api.com/v4/sports', {
      params: { 
        apiKey: process.env.ODDS_API_KEY
      },
      timeout: 15000
    });
    
    console.log('✅ Odds API Connected');
    console.log(`   Available sports: ${sportsResponse.data.length}`);
    console.log('   Sample sports:', sportsResponse.data.slice(0, 3).map(s => s.key).join(', '));
    
    // Check for today's games
    const today = new Date().toISOString().split('T')[0];
    console.log('\\n   Checking for NFL games today...');
    
    try {
      const nflResponse = await axios.get('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds', {
        params: { 
          apiKey: process.env.ODDS_API_KEY,
          regions: 'us',
          markets: 'h2h,spreads',
          oddsFormat: 'american',
          dateFormat: 'iso'
        },
        timeout: 15000
      });
      
      console.log(`   NFL games available: ${nflResponse.data.length}`);
      if (nflResponse.data.length > 0) {
        const sampleGame = nflResponse.data[0];
        console.log(`   Sample: ${sampleGame.home_team} vs ${sampleGame.away_team} at ${sampleGame.commence_time}`);
      }
    } catch (nflError) {
      console.log('   ⚠️ NFL games check failed:', nflError.response?.status, nflError.response?.data?.message || nflError.message);
    }
    
    // Check for MLB games
    console.log('\\n   Checking for MLB games today...');
    try {
      const mlbResponse = await axios.get('https://api.the-odds-api.com/v4/sports/baseball_mlb/odds', {
        params: { 
          apiKey: process.env.ODDS_API_KEY,
          regions: 'us',
          markets: 'h2h',
          oddsFormat: 'american',
          dateFormat: 'iso'
        },
        timeout: 15000
      });
      
      console.log(`   MLB games available: ${mlbResponse.data.length}`);
      if (mlbResponse.data.length > 0) {
        const sampleGame = mlbResponse.data[0];
        console.log(`   Sample: ${sampleGame.home_team} vs ${sampleGame.away_team} at ${sampleGame.commence_time}`);
      }
    } catch (mlbError) {
      console.log('   ⚠️ MLB games check failed:', mlbError.response?.status, mlbError.response?.data?.message || mlbError.message);
    }
    
    // Check for NCAAF games  
    console.log('\\n   Checking for NCAAF games today...');
    try {
      const ncaafResponse = await axios.get('https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds', {
        params: { 
          apiKey: process.env.ODDS_API_KEY,
          regions: 'us',
          markets: 'h2h,spreads',
          oddsFormat: 'american',
          dateFormat: 'iso'
        },
        timeout: 15000
      });
      
      console.log(`   NCAAF games available: ${ncaafResponse.data.length}`);
      if (ncaafResponse.data.length > 0) {
        const sampleGame = ncaafResponse.data[0];
        console.log(`   Sample: ${sampleGame.home_team} vs ${sampleGame.away_team} at ${sampleGame.commence_time}`);
      }
    } catch (ncaafError) {
      console.log('   ⚠️ NCAAF games check failed:', ncaafError.response?.status, ncaafError.response?.data?.message || ncaafError.message);
    }
    
  } catch (error) {
    console.log('❌ Odds API Failed:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('   Error details:', error.response.data);
    }
  }

  // Test 2: Optimal API - Get events
  console.log('\\n2. Testing Optimal API...');
  try {
    const optimalResponse = await axios.get('https://api.optimal-bet.com/v1/events', {
      headers: { 
        'X-API-Key': process.env.OPTIMAL_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Optimal API Connected');
    console.log(`   Available events: ${optimalResponse.data?.length || 'Unknown'}`);
    
    // Test player props endpoint
    console.log('\\n   Testing Optimal player props for NFL...');
    try {
      const nflPropsResponse = await axios.get('https://api.optimal-bet.com/v1/playerProps/NFL', {
        headers: { 
          'X-API-Key': process.env.OPTIMAL_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 15000
      });
      
      console.log(`   NFL player props available: ${nflPropsResponse.data?.length || 0}`);
      if (nflPropsResponse.data?.length > 0) {
        const sampleProp = nflPropsResponse.data[0];
        console.log(`   Sample: ${sampleProp.player_name} - ${sampleProp.market}`);
      }
    } catch (nflPropsError) {
      console.log('   ⚠️ NFL props failed:', nflPropsError.response?.status, nflPropsError.response?.data?.message || nflPropsError.message);
    }
    
  } catch (error) {
    console.log('❌ Optimal API Failed:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('   Error details:', error.response.data);
    }
  }

  // Summary
  console.log('\\n📊 API Test Summary:');
  console.log('=' .repeat(30));
  console.log('Both APIs appear to be configured with keys.');
  console.log('If FeedAgent is not fetching data, check:');
  console.log('1. FeedAgent execution/scheduling');
  console.log('2. Error handling in data processing');  
  console.log('3. Database insertion issues');
  console.log('4. Rate limiting or API quotas');
}

testApiConnectivity().catch(console.error);