#!/usr/bin/env tsx
/**
 * Verify Phase 2 Functions Exist
 * Date: 2025-10-20
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyFunctions() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }

  console.log('🔍 Verifying Phase 2 Functions...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const functions = ['admin_backfill_market_props', 'admin_score_batch', 'admin_refresh_views'];

  let allExist = true;

  for (const funcName of functions) {
    try {
      console.log(`Testing ${funcName}...`);

      // Try to call the function with minimal params
      let result;
      if (funcName === 'admin_backfill_market_props') {
        result = await supabase.rpc(funcName, { p_days: 0 });
      } else if (funcName === 'admin_score_batch') {
        result = await supabase.rpc(funcName, { p_limit: 1 });
      } else {
        result = await supabase.rpc(funcName);
      }

      if (result.error) {
        console.log(`  ❌ ${funcName}: ${result.error.message}`);
        allExist = false;
      } else {
        console.log(`  ✅ ${funcName}: EXISTS`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${funcName}: ${error.message}`);
      allExist = false;
    }
  }

  console.log('');

  if (!allExist) {
    console.log('❌ Some functions are missing!\n');
    console.log('📋 MANUAL MIGRATION REQUIRED:\n');
    console.log('1. Open Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql/new\n');
    console.log('2. Copy the contents of:');
    console.log('   supabase/migrations/20251020_phase2_core.sql\n');
    console.log('3. Paste into SQL Editor and click "Run"\n');
    console.log('4. Re-run this script to verify\n');
    process.exit(1);
  } else {
    console.log('✅ All Phase 2 functions exist!\n');
    console.log('Ready to proceed with admin RPCs.\n');
    process.exit(0);
  }
}

verifyFunctions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
