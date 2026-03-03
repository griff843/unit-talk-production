#!/usr/bin/env tsx
/**
 * Apply Migration via Supabase Management API
 * Date: 2025-10-20
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function applyMigration() {
  const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_PAT || process.env.SUPABASE_ACCESS_TOKEN;
  const PROJECT_REF = 'cqfnsozknjzvyiziwicl';

  if (!SUPABASE_ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN or SUPABASE_PAT not set');
  }

  console.log('🔧 Applying Phase 2 Migration via Management API...\n');

  // Read migration file
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20251020_phase2_core.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📄 Migration file: ${migrationPath}`);
  console.log(`📏 Size: ${migrationSQL.length} bytes\n`);

  try {
    console.log('⏳ Executing SQL via Management API...');

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: migrationSQL,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}): ${errorText}`);
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Migration applied successfully!\n');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }

  console.log('\n✅ Phase 2 migration complete!\n');
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
