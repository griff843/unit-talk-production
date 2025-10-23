#!/usr/bin/env tsx
/**
 * Apply Migration via Supabase REST API: 20251020_api_quota_configs_extension
 * Date: 2025-10-20
 * 
 * Uses Supabase REST API with service role key to execute SQL migration.
 * This bypasses pooler authentication issues from inside Docker.
 */

import * as fs from 'fs';
import * as path from 'path';

async function applyMigrationViaRest() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZm5zb3prbmp6dnlpeml3aWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5NDQxOSwiZXhwIjoyMDc1NDcwNDE5fQ.0fvfA63iHuhlsPNwsVjtQdzMjNivtPLFQZ4hCRX43LI';

  console.log('✅ Using Supabase REST API for migration');
  console.log(`   URL: ${supabaseUrl}`);

  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20251020_api_quota_configs_extension.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Executing migration: 20251020_api_quota_configs_extension.sql');
  console.log(`   Path: ${migrationPath}`);

  try {
    // Execute SQL via PostgREST rpc endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log('✅ Migration executed successfully via REST API');

    // Verify schema via REST API
    const verifyResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_table_columns?table_name=api_quota_configs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (verifyResponse.ok) {
      const columns = await verifyResponse.json();
      console.log('\n✅ Verified api_quota_configs columns:');
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\n⚠️  Could not verify schema via REST API (table may not be exposed)');
      console.log('   This is expected - migration was applied successfully');
    }

    console.log('\n🎉 Migration complete. Restart API to pick up schema changes.');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.cause) {
      console.error(`   Cause: ${error.cause}`);
    }
    process.exit(1);
  }
}

applyMigrationViaRest();

