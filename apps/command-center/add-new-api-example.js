// Example: How to add any new API to the monitoring system
// Just add to the apiConfigs array in apiHealthMonitoring.ts

const newApiExamples = [
  // Example 1: SportsData.io API
  {
    name: 'SportsData.io API',
    endpoint: 'https://api.sportsdata.io/v3/nfl/scores/json/Games/2023',
    quotaEndpoint: 'https://api.sportsdata.io/v3/usage',
    timeout: 10000,
    quotaLimit: 1000,
    description: 'Live NFL scores and statistics',
    authMethod: 'query' as const,  // ?key=API_KEY
    envKey: 'SPORTSDATA_API_KEY'
  },

  // Example 2: ESPN API (if they had one)
  {
    name: 'ESPN Stats API',
    endpoint: 'https://api.espn.com/v1/sports/football/nfl/teams',
    quotaEndpoint: 'https://api.espn.com/v1/usage',
    timeout: 10000,
    quotaLimit: 500,
    description: 'ESPN team and player statistics',
    authMethod: 'header' as const,  // X-API-Key: API_KEY
    envKey: 'ESPN_API_KEY'
  },

  // Example 3: Custom betting API
  {
    name: 'PinnSolutions API',
    endpoint: 'https://api.pinnsolutions.com/v2/odds',
    quotaEndpoint: 'https://api.pinnsolutions.com/v2/account/usage',
    timeout: 15000,
    quotaLimit: 2000,
    description: 'Premium sharp betting data',
    authMethod: 'bearer' as const,  // Authorization: Bearer TOKEN
    envKey: 'PINNSOLUTIONS_API_KEY'
  },

  // Example 4: FanDuel API (if available)
  {
    name: 'FanDuel Odds API',
    endpoint: 'https://api.fanduel.com/odds/v1/markets',
    timeout: 10000,
    quotaLimit: 800,
    description: 'FanDuel sportsbook odds feed',
    authMethod: 'bearer' as const,
    envKey: 'FANDUEL_API_KEY'
  }
];

// The monitoring system automatically handles ALL authentication methods:
const authMethodsSupported = {
  'bearer': 'Authorization: Bearer API_KEY',
  'query': 'endpoint?apiKey=API_KEY', 
  'header': 'X-API-Key: API_KEY',
  'basic': 'Authorization: Basic base64(username:password)'
};

// For each API, the system automatically:
// 1. Detects missing API keys (env var not found)
// 2. Tests actual authentication (makes real API call)
// 3. Detects specific errors:
//    - 401 = API Key Expired 
//    - 403 = API Key Invalid
//    - 429 = Quota Exceeded
//    - 500+ = Provider Server Error
// 4. Monitors response times and quota usage
// 5. Triggers Command Center alerts immediately
// 6. Stores alerts in database with severity levels

console.log('📋 To add any new API:');
console.log('1. Add API config to apiConfigs array');
console.log('2. Set environment variable (e.g., SPORTSDATA_API_KEY)');
console.log('3. System automatically monitors and alerts');
console.log('4. No code changes needed - completely extensible!');

console.log('\n🚨 Current APIs being monitored:');
console.log('- Optimal API (OPTIMAL_API_KEY)');
console.log('- Odds API (ODDS_API_KEY)');
console.log('\nTo verify Command Center dashboard:');
console.log('🌐 http://localhost:3015 (currently showing CRITICAL status)');