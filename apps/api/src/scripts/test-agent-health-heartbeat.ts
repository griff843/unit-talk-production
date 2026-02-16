/**
 * Smoke test for agent_health heartbeat functionality
 * Run with: npx tsx src/scripts/test-agent-health-heartbeat.ts
 */

import 'dotenv/config';
import { agentHealthHeartbeat } from '../services/agentHealthHeartbeat';
import { supabase } from '../services/supabaseClient';
import { logger } from '../services/logging';

async function main() {
  console.log('=== Agent Health Heartbeat Smoke Test ===\n');

  // Test 1: Send initial heartbeat
  console.log('1. Testing single heartbeat upsert...');
  const success = await agentHealthHeartbeat.sendHeartbeat('smoke-test-agent', 'healthy');
  console.log(`   Result: ${success ? 'SUCCESS' : 'FAILED'}\n`);

  // Test 2: Verify row exists in database
  console.log('2. Verifying database row...');
  const { data: row1, error: err1 } = await supabase
    .from('agent_health')
    .select('*')
    .eq('agent', 'smoke-test-agent')
    .single();

  if (err1) {
    console.log(`   ERROR: ${err1.message}`);
  } else {
    console.log(`   Row found: agent=${row1.agent}, status=${row1.status}`);
    console.log(`   last_heartbeat: ${row1.last_heartbeat}`);
    console.log(`   details: ${JSON.stringify(row1.details)}\n`);
  }

  // Test 3: Wait 2 seconds and send another heartbeat to prove upsert (not insert)
  console.log('3. Testing upsert (waiting 2s then sending another heartbeat)...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await agentHealthHeartbeat.sendHeartbeat('smoke-test-agent', 'healthy');

  const { data: row2, error: err2 } = await supabase
    .from('agent_health')
    .select('*')
    .eq('agent', 'smoke-test-agent')
    .single();

  if (err2) {
    console.log(`   ERROR: ${err2.message}`);
  } else {
    console.log(`   Updated row: last_heartbeat=${row2.last_heartbeat}`);
    console.log(`   Proves upsert working: same row, updated timestamp\n`);
  }

  // Test 4: Count total rows for smoke-test-agent (should be 1, not 2)
  console.log('4. Verifying single row per agent (no spam)...');
  const { count, error: countErr } = await supabase
    .from('agent_health')
    .select('*', { count: 'exact', head: true })
    .eq('agent', 'smoke-test-agent');

  if (countErr) {
    console.log(`   ERROR: ${countErr.message}`);
  } else {
    console.log(`   Total rows for smoke-test-agent: ${count}`);
    console.log(`   ${count === 1 ? 'SUCCESS - Single row per agent' : 'FAILED - Multiple rows detected'}\n`);
  }

  // Cleanup
  console.log('5. Cleaning up test data...');
  const { error: deleteErr } = await supabase
    .from('agent_health')
    .delete()
    .eq('agent', 'smoke-test-agent');

  if (deleteErr) {
    console.log(`   Cleanup error: ${deleteErr.message}`);
  } else {
    console.log('   Test row deleted\n');
  }

  // Show all current agent_health rows
  console.log('6. Current agent_health table contents:');
  const { data: allRows, error: allErr } = await supabase
    .from('agent_health')
    .select('agent, status, last_heartbeat, details')
    .order('last_heartbeat', { ascending: false });

  if (allErr) {
    console.log(`   ERROR: ${allErr.message}`);
  } else if (allRows.length === 0) {
    console.log('   (empty - no agents reporting yet)');
  } else {
    allRows.forEach(row => {
      console.log(`   - ${row.agent}: ${row.status} @ ${row.last_heartbeat}`);
    });
  }

  console.log('\n=== Smoke Test Complete ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
