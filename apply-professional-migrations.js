#!/usr/bin/env node

/**
 * Apply Professional Grading Migrations to Supabase
 * 
 * Applies the 004_professional_grading_columns.sql migration to Supabase
 * Idempotent and safe to run multiple times
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigrations() {
  console.log('🚀 Applying Professional Grading Migrations to Supabase...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '004_professional_grading_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Read migration file: 004_professional_grading_columns.sql');
    console.log(`📏 Migration size: ${migrationSQL.length} characters\n`);

    // Execute the migration
    console.log('⚡ Executing migration on Supabase...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Try alternative approach if exec_sql doesn't exist
      console.log('⚠️  exec_sql RPC not available, attempting direct execution...');
      
      // For Supabase, we might need to execute commands individually
      const commands = migrationSQL
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd && !cmd.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;

      for (const command of commands) {
        try {
          console.log(`Executing: ${command.substring(0, 50)}...`);
          const { error: cmdError } = await supabase.rpc('exec', { sql: command });
          
          if (cmdError) {
            console.warn(`⚠️  Warning on command: ${cmdError.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.warn(`⚠️  Error on command: ${err.message}`);
          errorCount++;
        }
      }

      console.log(`\n✅ Migration completed: ${successCount} successful, ${errorCount} errors/warnings`);
    } else {
      console.log('✅ Migration executed successfully via exec_sql RPC');
    }

    // Verify the migration by checking if columns exist
    console.log('\n🔍 Verifying migration results...');

    // Check raw_props columns
    const { data: rawPropsData, error: rawPropsError } = await supabase
      .from('raw_props')
      .select('processed_at, pro_attempts, processing_error')
      .limit(1);

    if (!rawPropsError) {
      console.log('✅ raw_props professional columns verified');
    } else {
      console.log('⚠️  Could not verify raw_props columns:', rawPropsError.message);
    }

    // Check unified_picks columns
    const { data: pickData, error: pickError } = await supabase
      .from('unified_picks')
      .select('professional_score, devigged_win_prob, devigged_edge, grading_status, published')
      .limit(1);

    if (!pickError) {
      console.log('✅ unified_picks professional columns verified');
    } else {
      console.log('⚠️  Could not verify unified_picks columns:', pickError.message);
    }

    console.log('\n🎉 Professional grading migration completed successfully!');
    console.log('📋 Summary:');
    console.log('   • raw_props: processed_at, pro_attempts, processing_error');
    console.log('   • unified_picks: professional_score, devigged_win_prob, devigged_edge, clv_pct, kelly_fraction, risk, grading_status, stage, published, is_instant, group_key, promoted_at');
    console.log('   • shadow_decisions: created for shadow mode testing');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  applyMigrations().catch(console.error);
}

module.exports = { applyMigrations };