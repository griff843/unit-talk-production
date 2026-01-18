/**
 * Warm Popular Players Cache
 * Date: 2025-10-25
 * 
 * Fetches top N players from Command Center and warms Smart Form cache
 * Runs every 30 minutes via CronJob
 */

const https = require('https');
const http = require('http');

// Configuration
const COMMAND_CENTER_URL = process.env.COMMAND_CENTER_URL || 'http://command-center:3000';
const SMART_FORM_URL = process.env.SMART_FORM_URL || 'http://smart-form:3021';
const TOP_N_PLAYERS = parseInt(process.env.TOP_N_PLAYERS || '50');

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data ? JSON.parse(data) : null,
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Fetch top players from Command Center
 */
async function fetchTopPlayers() {
  console.log(`🔍 Fetching top ${TOP_N_PLAYERS} players from Command Center...`);
  
  try {
    const result = await makeRequest(
      `${COMMAND_CENTER_URL}/api/analytics/top-players?limit=${TOP_N_PLAYERS}`
    );
    
    if (result.status !== 200) {
      throw new Error(`Command Center returned ${result.status}`);
    }
    
    const players = result.data?.players || [];
    console.log(`✅ Found ${players.length} top players`);
    
    return players;
  } catch (error) {
    console.error('❌ Failed to fetch top players:', error.message);
    
    // Fallback to hardcoded popular players
    console.log('⚠️  Using fallback popular players list');
    return [
      { name: 'LeBron James', sport: 'NBA' },
      { name: 'Stephen Curry', sport: 'NBA' },
      { name: 'Kevin Durant', sport: 'NBA' },
      { name: 'Giannis Antetokounmpo', sport: 'NBA' },
      { name: 'Luka Doncic', sport: 'NBA' },
      { name: 'Patrick Mahomes', sport: 'NFL' },
      { name: 'Josh Allen', sport: 'NFL' },
      { name: 'Lamar Jackson', sport: 'NFL' },
      { name: 'Travis Kelce', sport: 'NFL' },
      { name: 'Tyreek Hill', sport: 'NFL' },
      { name: 'Shohei Ohtani', sport: 'MLB' },
      { name: 'Aaron Judge', sport: 'MLB' },
      { name: 'Mookie Betts', sport: 'MLB' },
      { name: 'Ronald Acuna Jr', sport: 'MLB' },
      { name: 'Mike Trout', sport: 'MLB' },
    ];
  }
}

/**
 * Warm cache for a single player
 */
async function warmPlayerCache(player) {
  try {
    // Extract first name for search query
    const searchQuery = player.name.split(' ')[0].toLowerCase();
    
    const result = await makeRequest(
      `${SMART_FORM_URL}/api/players?q=${searchQuery}&sport=${player.sport}`,
      {
        headers: {
          'X-Cache-Warmer': 'true',
        },
      }
    );
    
    if (result.status === 200) {
      console.log(`  ✅ ${player.name} (${player.sport})`);
      return true;
    } else {
      console.log(`  ⚠️  ${player.name} (${player.sport}) - ${result.status}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ${player.name} (${player.sport}) - ${error.message}`);
    return false;
  }
}

/**
 * Warm cache for all players
 */
async function warmAllPlayers(players) {
  console.log(`\n🔥 Warming cache for ${players.length} players...`);
  
  let successCount = 0;
  let failureCount = 0;
  
  // Process in batches of 5 to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(player => warmPlayerCache(player))
    );
    
    successCount += results.filter(r => r).length;
    failureCount += results.filter(r => !r).length;
    
    // Small delay between batches
    if (i + batchSize < players.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n📊 Cache warming complete:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failure: ${failureCount}`);
  console.log(`   📈 Success rate: ${((successCount / players.length) * 100).toFixed(1)}%`);
  
  return { successCount, failureCount };
}

/**
 * Push metrics to Prometheus Pushgateway
 */
async function pushMetrics(stats) {
  const pushgateway = process.env.PROMETHEUS_PUSHGATEWAY;
  if (!pushgateway) {
    console.log('⚠️  No Prometheus pushgateway configured, skipping metrics push');
    return;
  }
  
  const metricsText = `
# HELP smart_form_cache_warmer_success_total Total successful cache warming operations
# TYPE smart_form_cache_warmer_success_total counter
smart_form_cache_warmer_success_total{type="popular_players"} ${stats.successCount}

# HELP smart_form_cache_warmer_failure_total Total failed cache warming operations
# TYPE smart_form_cache_warmer_failure_total counter
smart_form_cache_warmer_failure_total{type="popular_players"} ${stats.failureCount}

# HELP smart_form_cache_warmer_last_run_timestamp_seconds Timestamp of last cache warming run
# TYPE smart_form_cache_warmer_last_run_timestamp_seconds gauge
smart_form_cache_warmer_last_run_timestamp_seconds{type="popular_players"} ${Date.now() / 1000}
`.trim();
  
  try {
    await makeRequest(`${pushgateway}/metrics/job/smart_form_cache_warmer`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: metricsText,
    });
    
    console.log('✅ Metrics pushed to Prometheus');
  } catch (error) {
    console.error('❌ Failed to push metrics:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting popular players cache warmer');
  console.log(`   Command Center: ${COMMAND_CENTER_URL}`);
  console.log(`   Smart Form: ${SMART_FORM_URL}`);
  console.log(`   Top N: ${TOP_N_PLAYERS}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('');
  
  try {
    // Fetch top players
    const players = await fetchTopPlayers();
    
    // Warm cache
    const stats = await warmAllPlayers(players);
    
    // Push metrics
    await pushMetrics(stats);
    
    console.log('\n✅ Cache warming complete');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

main();

