#!/usr/bin/env tsx
/**
 * Apply Migration: 20251020_api_quota_configs_extension
 * Date: 2025-10-20
 * 
 * Simple approach: Execute SQL statements one by one using existing app infrastructure.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZm5zb3prbmp6dnlpeml3aWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5NDQxOSwiZXhwIjoyMDc1NDcwNDE5fQ.0fvfA63iHuhlsPNwsVjtQdzMjNivtPLFQZ4hCRX43LI';

  console.log('✅ Using Supabase client for migration');
  console.log(`   URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Check if table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('api_quota_configs')
      .select('provider')
      .limit(1);

    if (checkError && checkError.code !== 'PGRST116') {
      console.log('⚠️  Table check failed:', checkError.message);
    } else if (existingTable) {
      console.log('✅ Table api_quota_configs exists');
    }

    // Check if new columns exist
    const { data: testRow } = await supabase
      .from('api_quota_configs')
      .select('provider, monthly_limit, emergency_freeze, rpm')
      .limit(1);

    if (testRow && testRow.length > 0 && 'monthly_limit' in testRow[0]) {
      console.log('✅ Migration already applied - columns exist');
      console.log(`   Sample row: ${JSON.stringify(testRow[0])}`);
      return;
    }

    console.log('⚠️  New columns not found - migration needs to be applied');
    console.log('');
    console.log('📋 MANUAL MIGRATION REQUIRED');
    console.log('');
    console.log('The migration cannot be applied automatically from inside Docker due to');
    console.log('pooler authentication limitations. Please apply manually using one of:');
    console.log('');
    console.log('Option 1: Supabase Dashboard SQL Editor');
    console.log('  1. Go to: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql');
    console.log('  2. Paste contents of: supabase/migrations/20251020_api_quota_configs_extension.sql');
    console.log('  3. Click "Run"');
    console.log('');
    console.log('Option 2: Local psql (if you have direct database access)');
    console.log('  psql "postgresql://postgres:PASSWORD@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres?sslmode=require" \\');
    console.log('    < supabase/migrations/20251020_api_quota_configs_extension.sql');
    console.log('');
    console.log('After applying, restart the API container:');
    console.log('  ./dev.sh restart api');
    console.log('');

    process.exit(1);

  } catch (error: any) {
    console.error('❌ Migration check failed:', error.message);
    process.exit(1);
  }
}

applyMigration();

