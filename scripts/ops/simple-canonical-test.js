#!/usr/bin/env node

/**
 * Simple Canonical Pick Test
 * Tests insertion into picks and pick_publish tables
 * Date: 2025-10-30
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testCanonicalPick(league) {
  console.log(`\n📊 Testing ${league} canonical pick insertion...`);

  // First, get or create a test user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error(`❌ ${league} test failed: No users found in database`);
    return { league, success: false, error: 'No users found' };
  }

  const testUserId = users[0].id;

  const testPick = {
    tenant_id: DEFAULT_TENANT_ID,
    user_id: testUserId,
    selection: 'over',
    odds: -110,
    stake: 1.0,
    confidence: 8,
    workflow_stage: 'draft',
    status: 'pending',
    metadata: {
      test: true,
      timestamp: new Date().toISOString(),
      league: league,
      player_name: 'Test Player',
      stat_type: 'points',
      line: 25.5
    }
  };

  try {
    // Insert into picks table
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .insert(testPick)
      .select()
      .single();

    if (pickError) {
      console.error(`❌ ${league} pick insertion failed:`, pickError.message);
      return { league, success: false, error: pickError.message };
    }

    console.log(`✅ ${league} pick inserted:`, pick.id);

    // Insert into pick_publish table
    const publishData = {
      pick_id: pick.id,
      tenant_id: DEFAULT_TENANT_ID,
      channel: 'DISCORD',
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      metadata: {
        test: true,
        league: league
      }
    };

    const { data: publish, error: publishError } = await supabase
      .from('pick_publish')
      .insert(publishData)
      .select()
      .single();

    if (publishError) {
      console.error(`❌ ${league} pick_publish insertion failed:`, publishError.message);
      return { league, success: false, error: publishError.message };
    }

    console.log(`✅ ${league} pick_publish inserted:`, publish.id);

    // Clean up test data
    await supabase.from('pick_publish').delete().eq('id', publish.id);
    await supabase.from('picks').delete().eq('id', pick.id);
    console.log(`🧹 ${league} test data cleaned up`);

    return { league, success: true, pickId: pick.id, publishId: publish.id };
  } catch (error) {
    console.error(`❌ ${league} test failed:`, error.message);
    return { league, success: false, error: error.message };
  }
}

async function main() {
  console.log('================================================================================');
  console.log('CANONICAL PICK E2E VALIDATION');
  console.log('================================================================================');
  console.log('Date:', new Date().toISOString());
  console.log('Tenant ID:', DEFAULT_TENANT_ID);
  console.log('================================================================================\n');

  const leagues = ['NBA', 'NFL', 'MLB', 'NHL'];
  const results = [];

  for (const league of leagues) {
    const result = await testCanonicalPick(league);
    results.push(result);
  }

  console.log('\n================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.league.padEnd(4)} - ${result.success ? 'PASS' : 'FAIL'}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n================================================================================');
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error('❌ E2E VALIDATION FAILED');
    process.exit(1);
  } else {
    console.log('✅ E2E VALIDATION PASSED');
    console.log('\nNext Steps:');
    console.log('  1. Review artifacts in out/ops/cutover/metrics/100/');
    console.log('  2. Generate GO/NO-GO decision package');
    console.log('  3. Deploy to production');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

