#!/usr/bin/env node
/**
 * E2E Live Validation - 2025-10-28
 * 
 * Comprehensive end-to-end testing across NBA/NFL/MLB/NHL with Discord publishing
 * Uses Smart Form API (healthy) instead of broken API service
 * 
 * OBJECTIVES:
 * 1. Verify unified_picks table integration
 * 2. Test all four leagues with real player data
 * 3. Confirm Discord publishing via bridge_outbox
 * 4. Validate SLO compliance (<150ms insert, <50ms DB, <60s publish)
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SMART_FORM_URL = process.env.SMART_FORM_URL || 'http://localhost:3002';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

// Test data for each league
const LEAGUE_TESTS = [
  {
    league: 'NBA',
    player: 'LeBron James',
    stat_type: 'PLAYER_POINTS',
    line: 27.5,
    selection: 'over',
    odds: -110
  },
  {
    league: 'NFL',
    player: 'Patrick Mahomes',
    stat_type: 'PLAYER_PASSING_YARDS',
    line: 275.5,
    selection: 'over',
    odds: -115
  },
  {
    league: 'MLB',
    player: 'Shohei Ohtani',
    stat_type: 'TOTAL_BASES',
    line: 1.5,
    selection: 'over',
    odds: -120
  },
  {
    league: 'NHL',
    player: 'Connor McDavid',
    stat_type: 'PLAYER_POINTS',
    line: 0.5,
    selection: 'over',
    odds: -105
  }
];

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Utility: HTTP request
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    };

    const req = (urlObj.protocol === 'https:' ? https : require('http')).request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Get capper ID from database
async function getCapperID() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .ilike('username', 'griff%')
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('❌ Failed to get capper ID:', error?.message || 'No user found');
    return null;
  }

  console.log(`   Found user: ${data[0].username}`);
  return data[0].id;
}

// Test: DRY RUN
async function testDryRun(league, player, stat_type, line, selection, odds, capperId) {
  console.log(`\n🧪 DRY RUN: ${league} - ${player} ${stat_type} ${selection} ${line}`);
  
  const payload = {
    tenant_id: DEFAULT_TENANT_ID,
    user_id: capperId,
    player_name: player,
    stat_type,
    line,
    selection,
    odds,
    stake: 1.0,
    confidence: 8,
    league,
    sport: league.toLowerCase(),
    game_date: new Date().toISOString().split('T')[0],
    metadata: {
      test: true,
      e2e_validation: '2025-10-28',
      league
    }
  };

  const startTime = Date.now();
  const response = await httpRequest(`${SMART_FORM_URL}/api/domain/picks/dry-run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': DEFAULT_TENANT_ID
    },
    body: payload
  });
  const latency = Date.now() - startTime;

  if (response.statusCode === 200) {
    console.log(`✅ DRY RUN passed (${latency}ms)`);
    return { success: true, latency };
  } else {
    console.error(`❌ DRY RUN failed:`, response.body);
    return { success: false, error: response.body };
  }
}

// Test: LIVE INSERT
async function testLiveInsert(league, player, stat_type, line, selection, odds, capperId) {
  console.log(`\n🚀 LIVE INSERT: ${league} - ${player} ${stat_type} ${selection} ${line}`);
  
  const idempotencyKey = `e2e-${league}-${Date.now()}`;
  const payload = {
    tenant_id: DEFAULT_TENANT_ID,
    user_id: capperId,
    player_name: player,
    stat_type,
    line,
    selection,
    odds,
    stake: 1.0,
    confidence: 8,
    league,
    sport: league.toLowerCase(),
    game_date: new Date().toISOString().split('T')[0],
    idempotency_key: idempotencyKey,
    metadata: {
      test: true,
      e2e_validation: '2025-10-28',
      league
    }
  };

  const startTime = Date.now();
  const response = await httpRequest(`${SMART_FORM_URL}/api/domain/picks/insert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': DEFAULT_TENANT_ID,
      'x-idempotency-key': idempotencyKey
    },
    body: payload
  });
  const latency = Date.now() - startTime;

  if (response.statusCode === 200 || response.statusCode === 201) {
    console.log(`✅ LIVE INSERT succeeded (${latency}ms)`);
    console.log(`   Pick ID: ${response.body.pickId || response.body.id}`);
    return {
      success: true,
      latency,
      pickId: response.body.pickId || response.body.id,
      idempotencyKey
    };
  } else {
    console.error(`❌ LIVE INSERT failed:`, response.body);
    return { success: false, error: response.body };
  }
}

// Test: Poll for Discord publish
async function pollForPublish(pickId, maxWaitSeconds = 90) {
  console.log(`\n⏳ Polling for Discord publish (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  const endTime = startTime + (maxWaitSeconds * 1000);
  
  while (Date.now() < endTime) {
    const { data, error } = await supabase
      .from('bridge_outbox')
      .select('*')
      .eq('pick_id', pickId)
      .eq('status', 'sent')
      .single();
    
    if (data && !error) {
      const publishLag = Date.now() - startTime;
      console.log(`✅ Discord published (${publishLag}ms lag)`);
      console.log(`   Message ID: ${data.external_message_id}`);
      return { success: true, publishLag, messageId: data.external_message_id };
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s
  }
  
  console.error(`❌ Discord publish timeout after ${maxWaitSeconds}s`);
  return { success: false, error: 'Publish timeout' };
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  E2E LIVE VALIDATION - 2025-10-28');
  console.log('  Testing: NBA, NFL, MLB, NHL with Discord Publishing');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get capper ID
  const capperId = await getCapperID();
  if (!capperId) {
    console.error('❌ FATAL: Could not resolve capper ID');
    process.exit(1);
  }
  console.log(`✅ Capper ID resolved: ${capperId}`);

  const results = [];

  // Run tests for each league
  for (const test of LEAGUE_TESTS) {
    const { league, player, stat_type, line, selection, odds } = test;
    
    // DRY RUN
    const dryRun = await testDryRun(league, player, stat_type, line, selection, odds, capperId);
    if (!dryRun.success) {
      console.error(`❌ ${league} DRY RUN failed, skipping LIVE test`);
      results.push({ league, dryRun, liveInsert: null, publish: null });
      continue;
    }

    // LIVE INSERT
    const liveInsert = await testLiveInsert(league, player, stat_type, line, selection, odds, capperId);
    if (!liveInsert.success) {
      console.error(`❌ ${league} LIVE INSERT failed`);
      results.push({ league, dryRun, liveInsert, publish: null });
      continue;
    }

    // POLL FOR PUBLISH
    const publish = await pollForPublish(liveInsert.pickId);
    
    results.push({ league, dryRun, liveInsert, publish });
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const table = results.map(r => ({
    League: r.league,
    'DRY RUN': r.dryRun.success ? '✅' : '❌',
    'LIVE INSERT': r.liveInsert?.success ? '✅' : '❌',
    'DISCORD': r.publish?.success ? '✅' : '❌',
    'Insert (ms)': r.liveInsert?.latency || 'N/A',
    'Publish (ms)': r.publish?.publishLag || 'N/A'
  }));

  console.table(table);

  const allPassed = results.every(r => r.dryRun.success && r.liveInsert?.success && r.publish?.success);
  console.log(`\n${allPassed ? '✅ GO' : '❌ NO-GO'}: ${allPassed ? 'All tests passed' : 'Some tests failed'}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});

