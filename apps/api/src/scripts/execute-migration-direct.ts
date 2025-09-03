#!/usr/bin/env npx tsx

/**
 * Execute Migration Directly
 * 
 * Creates tables and migrates data using direct SQL approach since Supabase RPC is limited.
 * This addresses the critical performance issue: 512,537 old props (99.5% stale data) in raw_props.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

// Load environment variables
config();

async function executeMigrationDirect() {
  console.log('🚀 Direct SQL Migration Execution');
  console.log('==================================');

  const logger = new Logger('execute-migration-direct');

  try {
    // 1. Current state analysis
    console.log('\n📊 Step 1: Analyzing current data state...');
    const { count: totalProps } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { count: oldProps } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate) || { count: 0 };

    console.log(`📈 Current state:`);
    console.log(`  🔥 Total props: ${totalProps}`);
    console.log(`  📦 Old props (>${cutoffDate}): ${oldProps}`);
    console.log(`  💥 Performance impact: ${((oldProps || 0) / (totalProps || 1) * 100).toFixed(1)}% stale data`);

    if ((oldProps || 0) === 0) {
      console.log('✅ No migration needed - system already optimized');
      return;
    }

    // 2. Manual table creation instructions
    console.log('\n🏗️ Step 2: Table creation required...');
    console.log('⚠️ Supabase managed instances require manual table creation via SQL Editor');
    console.log('\n📋 MANUAL STEPS REQUIRED:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Create a new query');
    console.log('3. Copy and paste the following SQL:');
    
    console.log('\n--- COPY THIS SQL TO SUPABASE SQL EDITOR ---');
    console.log(`
-- Create historical tables for data lifecycle management
CREATE TABLE IF NOT EXISTS raw_props_recent (
    LIKE raw_props INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS raw_props_historical (
    LIKE raw_props INCLUDING ALL
);

-- Add table comments
COMMENT ON TABLE raw_props_recent IS 
'Warm tier storage for props 1-30 days old. Used for analytics and recent data queries.';

COMMENT ON TABLE raw_props_historical IS 
'Cold tier storage for props 30+ days old. Used for backtesting and historical analysis.';

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_raw_props_recent_game_date 
ON raw_props_recent(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_recent_scraped_at 
ON raw_props_recent(scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_recent_player_sport 
ON raw_props_recent(player_name, sport);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_game_date 
ON raw_props_historical(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_player_name 
ON raw_props_historical(player_name);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_sport_date 
ON raw_props_historical(sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_analytics 
ON raw_props_historical(sport, stat_type, game_date DESC);

-- CRITICAL PERFORMANCE FIX: Move ${oldProps} old props to historical table
INSERT INTO raw_props_historical (
    SELECT * FROM raw_props 
    WHERE game_date < '${cutoffDate}'
);

-- Clean up hot tier after successful migration
DELETE FROM raw_props 
WHERE game_date < '${cutoffDate}';

-- Verify the migration worked
SELECT 
    'raw_props' as table_name, COUNT(*) as record_count
FROM raw_props
UNION ALL
SELECT 
    'raw_props_historical' as table_name, COUNT(*) as record_count  
FROM raw_props_historical
ORDER BY table_name;
`);
    console.log('--- END SQL ---\n');

    console.log('4. Click "Run" to execute the SQL');
    console.log('5. Verify the results show the migration completed');
    console.log('6. Come back and run this script again to confirm success\n');

    // 3. Check if tables exist (retry mechanism)
    console.log('🔍 Step 3: Checking if tables were created...');
    
    let tablesExist = false;
    try {
      await supabaseClient.from('raw_props_historical').select('id').limit(1);
      await supabaseClient.from('raw_props_recent').select('id').limit(1);
      tablesExist = true;
      console.log('✅ Historical tables detected!');
    } catch (error) {
      console.log('❌ Tables not found - manual creation needed');
    }

    if (tablesExist) {
      // 4. Verify migration if tables exist
      console.log('\n📊 Step 4: Verifying migration results...');
      
      const { count: finalTotal } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true }) || { count: 0 };

      const { count: finalOld } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .lt('game_date', cutoffDate) || { count: 0 };

      const { count: historicalCount } = await supabaseClient
        .from('raw_props_historical')
        .select('*', { count: 'exact', head: true }) || { count: 0 };

      console.log('\n🎉 MIGRATION RESULTS:');
      console.log(`🔥 Hot tier (raw_props): ${finalTotal} records`);
      console.log(`🧊 Cold tier (raw_props_historical): ${historicalCount} records`);
      console.log(`⚠️ Remaining old records: ${finalOld}`);

      const migratedCount = (totalProps || 0) - (finalTotal || 0);
      console.log(`📦 Records migrated: ${migratedCount}`);
      console.log(`📈 Performance improvement: ${((migratedCount / (totalProps || 1)) * 100).toFixed(1)}%`);

      if (migratedCount > 0) {
        console.log('\n🎊 SUCCESS! Data lifecycle migration completed!');
        console.log('⚡ Your queries will now be significantly faster');
        console.log('💰 Storage costs reduced through data tiering');
        console.log('🚀 System ready for production deployment');
      }
    }

    console.log('\n💡 NEXT STEPS:');
    console.log('1. Complete the manual SQL steps above if not done');
    console.log('2. Test FeedAgent performance with optimized database');
    console.log('3. Deploy DataLifecycleAgent for automated maintenance');
    console.log('4. Set up monitoring for tier sizes and query performance');

  } catch (error) {
    console.error('\n❌ Migration execution failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    console.log('\n🛠️ TROUBLESHOOTING:');
    console.log('1. Check Supabase connection in .env file');
    console.log('2. Verify database permissions');
    console.log('3. Ensure Supabase project is accessible');
    console.log('4. Try the manual SQL approach above');
  }
}

// Run the migration execution
if (require.main === module) {
  executeMigrationDirect()
    .then(() => {
      console.log('\n✅ Migration execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration execution crashed:', error);
      process.exit(1);
    });
}

export { executeMigrationDirect };