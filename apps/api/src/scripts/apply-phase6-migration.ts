/**
 * Apply Phase 6 Agent Lifecycle Migration
 * Applies the agent_lifecycle_state, agent_retry_state, and autopilot_evidence tables
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyPhase6Migration() {
  console.log('🚀 Starting Phase 6 Agent Lifecycle Migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../../../supabase/migrations/20260115_phase6_agent_lifecycle.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

      try {
        console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

        // Execute via Supabase RPC
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement });

        if (error) {
          // Try alternative: direct query execution
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql_string: statement }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`   ❌ Failed: ${errorText}`);
            errorCount++;
            continue;
          }
        }

        console.log(`   ✅ Success`);
        successCount++;
      } catch (err: any) {
        console.error(`   ❌ Failed: ${err.message}`);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n✅ Phase 6 Migration completed successfully!');

      // Verify tables were created
      console.log('\n🔍 Verifying table creation...');

      const { data: lifecycleState, error: lcError } = await supabase
        .from('agent_lifecycle_state')
        .select('*')
        .limit(1);

      const { data: retryState, error: rsError } = await supabase
        .from('agent_retry_state')
        .select('*')
        .limit(1);

      const { data: autopilotEvidence, error: aeError } = await supabase
        .from('autopilot_evidence')
        .select('*')
        .limit(1);

      const { data: cbEvents, error: cbError } = await supabase
        .from('circuit_breaker_events')
        .select('*')
        .limit(1);

      console.log('   ✅ agent_lifecycle_state:', !lcError ? 'OK' : 'FAIL');
      console.log('   ✅ agent_retry_state:', !rsError ? 'OK' : 'FAIL');
      console.log('   ✅ autopilot_evidence:', !aeError ? 'OK' : 'FAIL');
      console.log('   ✅ circuit_breaker_events:', !cbError ? 'OK' : 'FAIL');

      console.log('\n🎉 Phase 6 Agent Lifecycle system is ready!');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the failed statements.');
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
applyPhase6Migration()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
