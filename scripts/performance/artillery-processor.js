/**
 * Artillery Processor Functions
 * Custom logic for load testing scenarios
 */

const crypto = require('crypto');

module.exports = {
  generateVIPUser,
  generateProUser,
  generatePremiumPick,
  generateRushPick,
  beforeScenario,
  afterScenario,
  beforeRequest,
  afterResponse
};

// User generation functions
function generateVIPUser(userContext, events, done) {
  userContext.vars.vipEmail = `vip_${crypto.randomBytes(4).toString('hex')}@test.com`;
  userContext.vars.vipPassword = 'VipPass123!';
  return done();
}

function generateProUser(userContext, events, done) {
  userContext.vars.proEmail = `pro_${crypto.randomBytes(4).toString('hex')}@test.com`;
  userContext.vars.proPassword = 'ProPass123!';
  return done();
}

// Pick generation functions
function generatePremiumPick(userContext, events, done) {
  const players = [
    'LeBron James', 'Kevin Durant', 'Stephen Curry', 
    'Giannis Antetokounmpo', 'Joel Embiid', 'Nikola Jokic'
  ];
  
  const statTypes = [
    'Points', 'Rebounds', 'Assists', 
    'Points + Rebounds', 'Points + Assists + Rebounds'
  ];
  
  const picks = [];
  for (let i = 0; i < 5; i++) {
    picks.push({
      player_name: players[Math.floor(Math.random() * players.length)],
      stat_type: statTypes[Math.floor(Math.random() * statTypes.length)],
      line: Math.floor(Math.random() * 30) + 15,
      pick: Math.random() > 0.5 ? 'over' : 'under',
      confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
      sport: 'NBA',
      game_time: new Date(Date.now() + Math.random() * 86400000).toISOString()
    });
  }
  
  userContext.vars.premiumPicks = picks;
  return done();
}

function generateRushPick(userContext, events, done) {
  const rushPick = {
    player_name: `Player_${Math.floor(Math.random() * 100)}`,
    stat_type: 'Points',
    line: Math.floor(Math.random() * 20) + 20,
    pick: Math.random() > 0.5 ? 'over' : 'under',
    confidence: 0.75,
    sport: 'NBA',
    game_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    rush_mode: true
  };
  
  userContext.vars.rushPick = rushPick;
  return done();
}

// Lifecycle hooks
function beforeScenario(scenarioContext, ee, done) {
  // Track scenario start time
  scenarioContext.vars.scenarioStartTime = Date.now();
  
  // Set up custom headers based on scenario
  if (scenarioContext.scenario.name.includes('VIP')) {
    scenarioContext.vars.userTier = 'vip';
  } else if (scenarioContext.scenario.name.includes('Professional')) {
    scenarioContext.vars.userTier = 'professional';
  } else {
    scenarioContext.vars.userTier = 'free';
  }
  
  return done();
}

function afterScenario(scenarioContext, ee, done) {
  // Calculate scenario duration
  const duration = Date.now() - scenarioContext.vars.scenarioStartTime;
  
  // Log performance metrics
  console.log(`Scenario: ${scenarioContext.scenario.name}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`User Tier: ${scenarioContext.vars.userTier}`);
  
  // Could send metrics to monitoring system
  if (process.env.METRICS_WEBHOOK) {
    const metrics = {
      scenario: scenarioContext.scenario.name,
      duration: duration,
      tier: scenarioContext.vars.userTier,
      timestamp: new Date().toISOString()
    };
    
    // Fire and forget metrics submission
    sendMetrics(metrics).catch(err => 
      console.error('Failed to send metrics:', err)
    );
  }
  
  return done();
}

function beforeRequest(requestParams, context, ee, next) {
  // Add correlation ID to all requests
  if (!requestParams.headers) {
    requestParams.headers = {};
  }
  requestParams.headers['X-Correlation-Id'] = crypto.randomUUID();
  
  // Add user tier header if available
  if (context.vars.userTier) {
    requestParams.headers['X-User-Tier'] = context.vars.userTier;
  }
  
  // Add load test identifier
  requestParams.headers['X-Load-Test'] = 'artillery';
  
  // Track request start time
  context.vars.requestStartTime = Date.now();
  
  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Calculate request duration
  const duration = Date.now() - context.vars.requestStartTime;
  
  // Extract custom metrics from response headers
  if (response.headers) {
    if (response.headers['x-db-query-time']) {
      ee.emit('customStat', 'db_query_time', 
        parseInt(response.headers['x-db-query-time']));
    }
    
    if (response.headers['x-cache-hit']) {
      ee.emit('customStat', 'cache_hits', 1);
    }
    
    if (response.headers['x-rate-limit-remaining']) {
      const remaining = parseInt(response.headers['x-rate-limit-remaining']);
      if (remaining < 10) {
        console.warn(`Rate limit warning: ${remaining} requests remaining`);
      }
    }
  }
  
  // Track errors by endpoint
  if (response.statusCode >= 400) {
    const endpoint = requestParams.url || 'unknown';
    ee.emit('customStat', `errors_${endpoint}`, 1);
    
    // Log error details for debugging
    if (response.statusCode >= 500) {
      console.error(`Server error on ${endpoint}:`, {
        status: response.statusCode,
        body: response.body ? response.body.substring(0, 200) : 'No body',
        correlationId: requestParams.headers['X-Correlation-Id']
      });
    }
  }
  
  // Track response time by tier
  if (context.vars.userTier) {
    ee.emit('customStat', `response_time_${context.vars.userTier}`, duration);
  }
  
  return next();
}

// Helper functions
async function sendMetrics(metrics) {
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch(process.env.METRICS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    // Silently fail - don't interrupt load test
    console.debug('Metrics submission failed:', error.message);
  }
}

// Custom expectations
module.exports.expectations = {
  hasValidGrade: (response) => {
    try {
      const body = JSON.parse(response.body);
      return body.grade && 
             ['A+', 'A', 'B', 'C', 'D', 'F'].includes(body.grade.letter);
    } catch {
      return false;
    }
  },
  
  hasValidTimestamp: (response) => {
    try {
      const body = JSON.parse(response.body);
      const timestamp = new Date(body.timestamp || body.created_at);
      return !isNaN(timestamp.getTime());
    } catch {
      return false;
    }
  },
  
  isWithinSLA: (response, maxTime) => {
    const responseTime = response.timings.phases.firstByte;
    return responseTime <= maxTime;
  }
};

// Custom reporters
module.exports.reporters = {
  logSlowRequests: (stats) => {
    const slowRequests = [];
    
    Object.keys(stats.latencies).forEach(endpoint => {
      const p95 = stats.latencies[endpoint].p95;
      if (p95 > 1000) {
        slowRequests.push({
          endpoint,
          p95,
          p99: stats.latencies[endpoint].p99
        });
      }
    });
    
    if (slowRequests.length > 0) {
      console.log('\n⚠️  Slow Endpoints Detected:');
      slowRequests.forEach(req => {
        console.log(`  ${req.endpoint}: p95=${req.p95}ms, p99=${req.p99}ms`);
      });
    }
  },
  
  generateHTMLReport: (stats) => {
    const fs = require('fs');
    const path = require('path');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report - ${new Date().toISOString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; }
    .success { color: green; }
    .warning { color: orange; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>Load Test Report</h1>
  <div class="metric">
    <h2>Summary</h2>
    <p>Total Requests: ${stats.requestsCompleted}</p>
    <p>Duration: ${stats.duration}s</p>
    <p>RPS: ${stats.rps.mean}</p>
  </div>
  <div class="metric">
    <h2>Response Times</h2>
    <p>Min: ${stats.latencies.min}ms</p>
    <p>Max: ${stats.latencies.max}ms</p>
    <p>Median: ${stats.latencies.median}ms</p>
    <p>P95: ${stats.latencies.p95}ms</p>
    <p>P99: ${stats.latencies.p99}ms</p>
  </div>
  <div class="metric">
    <h2>Status Codes</h2>
    ${Object.entries(stats.codes).map(([code, count]) => 
      `<p class="${code < 400 ? 'success' : code < 500 ? 'warning' : 'error'}">
        ${code}: ${count}
      </p>`
    ).join('')}
  </div>
</body>
</html>
    `;
    
    const reportPath = path.join(__dirname, `report-${Date.now()}.html`);
    fs.writeFileSync(reportPath, html);
    console.log(`\n📊 HTML report generated: ${reportPath}`);
  }
};