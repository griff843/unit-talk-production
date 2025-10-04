#!/usr/bin/env tsx
/**
 * Database Health Check
 * Tests Supabase Cloud connectivity with read/write/delete operations
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dbHealth() {
  const start = Date.now();

  console.log('='.repeat(80));
  console.log('DATABASE HEALTH CHECK - Supabase Cloud');
  console.log('='.repeat(80));
  console.log(`URL: ${SUPABASE_URL}`);
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Test READ
  console.log('📖 Testing READ...');
  const readStart = Date.now();
  const { data: readData, error: readError } = await supabase
    .from('unified_picks')
    .select('count')
    .limit(1);

  if (readError) {
    console.error('❌ READ FAILED:', readError.message);
    process.exit(1);
  }
  console.log(`✅ READ OK (${Date.now() - readStart}ms)`);

  // Test WRITE
  console.log('✍️  Testing WRITE...');
  const writeStart = Date.now();
  const testId = `health_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { error: writeError } = await supabase
    .from('agent_health')
    .upsert({
      agent_name: 'health_check',
      status: 'healthy',
      last_run: new Date().toISOString(),
      metadata: { test_id: testId }
    });

  if (writeError) {
    console.error('❌ WRITE FAILED:', writeError.message);
    process.exit(1);
  }
  console.log(`✅ WRITE OK (${Date.now() - writeStart}ms)`);

  // Test DELETE
  console.log('🗑️  Testing DELETE...');
  const deleteStart = Date.now();
  const { error: deleteError } = await supabase
    .from('agent_health')
    .delete()
    .eq('agent_name', 'health_check')
    .eq('metadata->>test_id', testId);

  if (deleteError) {
    console.error('❌ DELETE FAILED:', deleteError.message);
    process.exit(1);
  }
  console.log(`✅ DELETE OK (${Date.now() - deleteStart}ms)`);

  const totalTime = Date.now() - start;
  console.log('');
  console.log('='.repeat(80));
  console.log(`✅ ALL CHECKS PASSED - Total latency: ${totalTime}ms`);
  console.log('='.repeat(80));
}

dbHealth().catch(err => {
  console.error('❌ Health check failed:', err);
  process.exit(1);
});
