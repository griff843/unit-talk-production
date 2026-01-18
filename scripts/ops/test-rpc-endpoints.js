#!/usr/bin/env node
/**
 * Test RPC Endpoints - Validation Script
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';
const userId = '00000000-0000-0000-0000-000000000001';

const results = [];

function logResult(endpoint, status, duration, data, error = null) {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    endpoint,
    status,
    durationMs: duration,
    success: status >= 200 && status < 300,
    data,
    error,
  };
  results.push(result);

  const statusIcon = result.success ? '✅' : '❌';
  console.log(`${statusIcon} [${endpoint}] ${status} (${duration}ms)`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function testRPCs() {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n=== RPC Endpoint Testing ===\n');

  // Test 1: pgrst_reload (already tested, but let's confirm)
  try {
    const start = Date.now();
    const { data, error } = await supabase.rpc('pgrst_reload');
    const duration = Date.now() - start;

    if (error) throw error;

    logResult('pgrst_reload', 200, duration, data);
  } catch (error) {
    logResult('pgrst_reload', 500, 0, null, error.message);
  }

  // Test 2: Check if props exist
  try {
    const { data: props, error } = await supabase
      .from('props')
      .select('id, player_name, stat_type, line, sport')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (error) throw error;

    console.log(`\nFound ${props.length} props in database`);

    if (props.length > 0) {
      console.log('Sample prop:', props[0]);

      // Test 3: create_pick_with_event
      const propId = props[0].id;
      const pickData = {
        prop_id: propId,
        selection: 'over',
        odds: -110,
        stake: 10.0,
        confidence: 75,
        workflow_stage: 'draft',
        idempotency_key: `test_rpc_${Date.now()}`,
        metadata: { source: 'rpc_validation_test' },
      };

      try {
        const start = Date.now();
        const { data, error } = await supabase.rpc('create_pick_with_event', {
          p_tenant_id: tenantId,
          p_user_id: userId,
          p_pick_data: pickData,
          p_correlation_id: `test_correlation_${Date.now()}`,
        });
        const duration = Date.now() - start;

        if (error) throw error;

        logResult('create_pick_with_event', 201, duration, { pick_id: data });
      } catch (error) {
        logResult('create_pick_with_event', 500, 0, null, error.message);
      }
    } else {
      console.log('⚠️  No props found - skipping create_pick_with_event test');
      logResult('create_pick_with_event', 0, 0, null, 'No props available for testing');
    }
  } catch (error) {
    console.error('Error checking props:', error.message);
  }

  // Test 4: Check for picks_publish RPC (may not exist)
  try {
    const start = Date.now();
    const { data, error } = await supabase.rpc('picks_publish', {});
    const duration = Date.now() - start;

    if (error && error.code === '42883') {
      // Function does not exist
      console.log('\nℹ️  picks_publish RPC not found (function does not exist)');
      logResult('picks_publish', 404, 0, null, 'Function does not exist');
    } else if (error) {
      throw error;
    } else {
      logResult('picks_publish', 200, duration, data);
    }
  } catch (error) {
    logResult('picks_publish', 500, 0, null, error.message);
  }

  return results;
}

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const results = await testRPCs();

  console.log('\n=== Test Summary ===');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  // Write results to log file
  const fs = require('fs');
  const logContent = results.map(r => {
    return `[${r.timestamp}] ${r.endpoint} - Status: ${r.status} (${r.durationMs}ms)${
      r.error ? ` - Error: ${r.error}` : ''
    }`;
  }).join('\n');

  fs.writeFileSync('rpc_calls.log', logContent);
  console.log('\n✅ Results written to rpc_calls.log');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
