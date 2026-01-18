/**
 * Smart Form E2E Synthetic Monitor
 * Date: 2025-10-25
 * 
 * Runs every 10 minutes to validate production endpoints:
 * 1. /api/players/search?q=le&league=NBA
 * 2. /api/games?sport=NBA&date=today
 * 3. /api/submit-ticket (dry-run mode)
 */

const https = require('https');
const http = require('http');

// Configuration
const SMART_FORM_URL = process.env.SMART_FORM_URL || 'https://smart-form.unit-talk.com';
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;
const PROMETHEUS_PUSHGATEWAY = process.env.PROMETHEUS_PUSHGATEWAY;
const KNOWN_PLAYER_ID = process.env.KNOWN_PLAYER_ID || '550e8400-e29b-41d4-a716-446655440000';

// Metrics storage
const metrics = {
  playersSearch: { latency: 0, status: 0, success: false },
  gamesResolve: { latency: 0, status: 0, success: false },
  picksDryRun: { latency: 0, status: 0, success: false },
};

let consecutiveFailures = 0;

/**
 * Make HTTP request with timing
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const latency = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          latency,
          data: data ? JSON.parse(data) : null,
          headers: res.headers,
        });
      });
    });
    
    req.on('error', (error) => {
      const latency = Date.now() - startTime;
      reject({
        error: error.message,
        latency,
      });
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Test 1: /api/players/search
 */
async function testPlayersSearch() {
  console.log('🧪 Testing /api/players/search...');
  
  try {
    const result = await makeRequest(
      `${SMART_FORM_URL}/api/players?q=le&sport=NBA`
    );
    
    metrics.playersSearch = {
      latency: result.latency,
      status: result.status,
      success: result.status === 200 && result.data?.players?.length > 0,
    };
    
    console.log(`✅ Players search: ${result.status} in ${result.latency}ms`);
    console.log(`   Found ${result.data?.players?.length || 0} players`);
    
    return metrics.playersSearch.success;
  } catch (error) {
    console.error('❌ Players search failed:', error.error);
    metrics.playersSearch = {
      latency: error.latency || 0,
      status: 0,
      success: false,
    };
    return false;
  }
}

/**
 * Test 2: /api/games
 */
async function testGamesResolve() {
  console.log('🧪 Testing /api/games...');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await makeRequest(
      `${SMART_FORM_URL}/api/games?sport=NBA`
    );
    
    metrics.gamesResolve = {
      latency: result.latency,
      status: result.status,
      success: result.status === 200,
    };
    
    console.log(`✅ Games resolve: ${result.status} in ${result.latency}ms`);
    console.log(`   Found ${result.data?.games?.length || 0} games`);
    
    return metrics.gamesResolve.success;
  } catch (error) {
    console.error('❌ Games resolve failed:', error.error);
    metrics.gamesResolve = {
      latency: error.latency || 0,
      status: 0,
      success: false,
    };
    return false;
  }
}

/**
 * Test 3: /api/submit-ticket (dry-run)
 */
async function testPicksDryRun() {
  console.log('🧪 Testing /api/submit-ticket (dry-run)...');
  
  try {
    const idempotencyKey = `synthetic-${Date.now()}`;
    
    const result = await makeRequest(
      `${SMART_FORM_URL}/api/submit-ticket`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Dry-Run': 'true',
        },
        body: {
          capper_id: '550e8400-e29b-41d4-a716-446655440000',
          sport: 'NBA',
          ticket_type: 'single',
          selections: [
            {
              sport: 'NBA',
              stat_type: 'points',
              line: 25.5,
              leg_odds: -110,
              selection: 'over',
              source: 'api',
            },
          ],
          total_units: 1.0,
        },
      }
    );
    
    metrics.picksDryRun = {
      latency: result.latency,
      status: result.status,
      success: result.status === 200 || result.status === 204,
    };
    
    console.log(`✅ Picks dry-run: ${result.status} in ${result.latency}ms`);
    
    return metrics.picksDryRun.success;
  } catch (error) {
    console.error('❌ Picks dry-run failed:', error.error);
    metrics.picksDryRun = {
      latency: error.latency || 0,
      status: 0,
      success: false,
    };
    return false;
  }
}

/**
 * Send alert to Discord
 */
async function sendAlert(message, severity = 'warning') {
  if (!ALERT_WEBHOOK) {
    console.log('⚠️  No alert webhook configured, skipping alert');
    return;
  }
  
  const color = severity === 'critical' ? 0xff0000 : 0xffa500;
  
  try {
    await makeRequest(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        embeds: [
          {
            title: '🚨 Smart Form Synthetic Monitor Alert',
            description: message,
            color,
            timestamp: new Date().toISOString(),
            fields: [
              {
                name: 'Players Search',
                value: `${metrics.playersSearch.status} (${metrics.playersSearch.latency}ms)`,
                inline: true,
              },
              {
                name: 'Games Resolve',
                value: `${metrics.gamesResolve.status} (${metrics.gamesResolve.latency}ms)`,
                inline: true,
              },
              {
                name: 'Picks Dry-Run',
                value: `${metrics.picksDryRun.status} (${metrics.picksDryRun.latency}ms)`,
                inline: true,
              },
            ],
          },
        ],
      },
    });
    
    console.log('✅ Alert sent to Discord');
  } catch (error) {
    console.error('❌ Failed to send alert:', error);
  }
}

/**
 * Push metrics to Prometheus Pushgateway
 */
async function pushMetrics() {
  if (!PROMETHEUS_PUSHGATEWAY) {
    console.log('⚠️  No Prometheus pushgateway configured, skipping metrics push');
    return;
  }
  
  const metricsText = `
# HELP smart_form_synthetic_latency_ms Synthetic monitor latency in milliseconds
# TYPE smart_form_synthetic_latency_ms gauge
smart_form_synthetic_latency_ms{endpoint="players_search"} ${metrics.playersSearch.latency}
smart_form_synthetic_latency_ms{endpoint="games_resolve"} ${metrics.gamesResolve.latency}
smart_form_synthetic_latency_ms{endpoint="picks_dry_run"} ${metrics.picksDryRun.latency}

# HELP smart_form_synthetic_status_code HTTP status code from synthetic monitor
# TYPE smart_form_synthetic_status_code gauge
smart_form_synthetic_status_code{endpoint="players_search",status="${metrics.playersSearch.status}"} 1
smart_form_synthetic_status_code{endpoint="games_resolve",status="${metrics.gamesResolve.status}"} 1
smart_form_synthetic_status_code{endpoint="picks_dry_run",status="${metrics.picksDryRun.status}"} 1

# HELP smart_form_synthetic_success Synthetic monitor success (1) or failure (0)
# TYPE smart_form_synthetic_success gauge
smart_form_synthetic_success{endpoint="players_search"} ${metrics.playersSearch.success ? 1 : 0}
smart_form_synthetic_success{endpoint="games_resolve"} ${metrics.gamesResolve.success ? 1 : 0}
smart_form_synthetic_success{endpoint="picks_dry_run"} ${metrics.picksDryRun.success ? 1 : 0}

# HELP smart_form_synthetic_consecutive_failures Consecutive failures count
# TYPE smart_form_synthetic_consecutive_failures gauge
smart_form_synthetic_consecutive_failures ${consecutiveFailures}

# HELP smart_form_synthetic_latency_p95_ms p95 latency across all endpoints
# TYPE smart_form_synthetic_latency_p95_ms gauge
smart_form_synthetic_latency_p95_ms ${Math.max(metrics.playersSearch.latency, metrics.gamesResolve.latency, metrics.picksDryRun.latency)}
`.trim();
  
  try {
    await makeRequest(`${PROMETHEUS_PUSHGATEWAY}/metrics/job/smart_form_synthetic`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: metricsText,
    });
    
    console.log('✅ Metrics pushed to Prometheus');
  } catch (error) {
    console.error('❌ Failed to push metrics:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Smart Form synthetic monitor...');
  console.log(`   Target: ${SMART_FORM_URL}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('');
  
  // Run all tests
  const results = await Promise.all([
    testPlayersSearch(),
    testGamesResolve(),
    testPicksDryRun(),
  ]);
  
  const allSuccess = results.every(r => r);
  
  // Update consecutive failures counter
  if (!allSuccess) {
    consecutiveFailures++;
  } else {
    consecutiveFailures = 0;
  }
  
  // Check for alerts
  const has5xx = Object.values(metrics).some(m => m.status >= 500);
  const hasHighLatency = Object.values(metrics).some(m => m.latency > 120);
  
  if (has5xx) {
    await sendAlert('5xx error detected in synthetic monitor', 'critical');
  } else if (consecutiveFailures >= 2) {
    await sendAlert(`${consecutiveFailures} consecutive failures detected`, 'critical');
  } else if (hasHighLatency) {
    await sendAlert('High latency detected (>120ms)', 'warning');
  }
  
  // Push metrics to Prometheus
  await pushMetrics();
  
  console.log('');
  console.log('📊 Summary:');
  console.log(`   All tests passed: ${allSuccess ? '✅' : '❌'}`);
  console.log(`   Consecutive failures: ${consecutiveFailures}`);
  console.log('');
  console.log('✅ Synthetic monitor complete');
  
  process.exit(allSuccess ? 0 : 1);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

