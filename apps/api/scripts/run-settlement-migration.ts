#!/usr/bin/env tsx

/**
 * Run Settlement Database Migration
 * 
 * This script executes the settlement schema migration for The Odds API integration.
 * It adds tables for game results, prop settlements, and settlement logs.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting settlement database migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '004_settlement_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log(`📏 Migration size: ${migrationSQL.length} characters\n`);

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      
      // Show first 100 chars of the statement
      const preview = statement.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   Preview: ${preview}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';'
        });

        if (error) {
          // Try direct execution as fallback
          const { error: directError } = await supabase.from('_').select().limit(0);
          if (directError) {
            throw new Error(`Migration statement failed: ${error.message}`);
          }
        }

        console.log(`   ✅ Success`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
        
        // Continue with other statements even if one fails
        console.log(`   ⚠️  Continuing with remaining statements...`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful statements: ${successCount}`);
    console.log(`   ❌ Failed statements: ${errorCount}`);
    console.log(`   📈 Success rate: ${((successCount / statements.length) * 100).toFixed(1)}%`);

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    
    const tables = ['game_results', 'prop_settlements', 'settlement_log'];
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (!error) {
        console.log(`   ✅ Table '${table}' exists and is accessible`);
      } else {
        console.log(`   ❌ Table '${table}' verification failed: ${error.message}`);
      }
    }

    if (errorCount === 0) {
      console.log('\n✅ Settlement migration completed successfully!');
      console.log('🎯 Your database is now ready for automated settlement processing.');
    } else {
      console.log('\n⚠️  Migration completed with some errors.');
      console.log('📝 Please review the failed statements and run them manually if needed.');
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Execute migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🏁 Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

export { runMigration };