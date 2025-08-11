/**
 * Apply Professional Prop Processing Migration
 *
 * Applies the professional grading columns to unified_picks table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string // Use service role for schema changes
);

async function applyMigration() {
  console.log('📦 Applying Professional Prop Processing Migration...\n');

  try {
    // Read the migration file
    const migrationPath = 'apps/api/database/migrations/002_professional_prop_processing.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log(`📏 Migration size: ${migrationSQL.length} characters\n`);

    // Split into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`🔧 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;

      console.log(`${i + 1}. Executing: ${statement.substring(0, 60)}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';',
        });

        if (error) {
          console.log(`   ❌ Error: ${error.message}`);
        } else {
          console.log(`   ✅ Success`);
        }
      } catch (err) {
        console.log(`   ⚠️ Warning: ${err}`);
      }
    }

    console.log('\n🧪 Testing professional columns...');

    // Test that the columns were added
    const { data, error: testError } = await supabase
      .from('unified_picks')
      .select('professional_score, devigged_edge, kelly_fraction')
      .limit(1);

    if (testError) {
      console.log(`❌ Professional columns test failed: ${testError.message}`);
    } else {
      console.log('✅ Professional columns accessible');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

applyMigration()
  .then(() => {
    console.log('\n🏁 Migration application complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
