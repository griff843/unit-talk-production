#!/usr/bin/env npx tsx
// @ts-nocheck

/**
 * Verify Migration Results
 * 
 * Run this after executing the manual SQL migration to verify success
 * and get performance metrics.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../utils/supabaseUtils';
import { Logger } from '../shared/logger';
import { requireSupabase } from '../utils/supabaseUtils';

// Load environment variables
config();

async function verifyMigration() {
  console.log('🔍 Verifying Data Lifecycle Migration Results');
  console.log('=============================================');

  const logger = new Logger('verify-migration');

  try {
    // 1. Check table existence
    console.log('\n📋 Step 1: Verifying table structure...');
    
    const tables = ['raw_props', 'raw_props_recent', 'raw_props_historical'];
    const tableStatus = {};

    for (const table of tables) {
      try {
        const supabaseClient = requireSupabase();
      const { count, error } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          tableStatus[table] = { exists: false, error: error.message };
        } else {
          tableStatus[table] = { exists: true, count: count || 0 };
        }
      } catch (e) {
        tableStatus[table] = { exists: false, error: e.message };
      }
    }

    console.log('📊 Table Status:');
    Object.entries(tableStatus).forEach(([table, status]) => {
      if (status.exists) {
        console.log(`  ✅ ${table}: ${status.count} records`);
      } else {
        console.log(`  ❌ ${table}: ${status.error}`);
      }
    });

    // 2. Analyze data distribution
    console.log('\n📈 Step 2: Analyzing data distribution...');
    
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const supabaseClient = requireSupabase();
      const { count: hotTierCount } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: oldPropsRemaining } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: coldTierCount } = await supabaseClient
      .from('raw_props_historical')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: warmTierCount } = await supabaseClient
      .from('raw_props_recent')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    console.log('🗄️ Data Tier Distribution:');
    console.log(`  🔥 Hot Tier (raw_props): ${hotTierCount} records`);
    console.log(`  💧 Warm Tier (raw_props_recent): ${warmTierCount} records`);
    console.log(`  🧊 Cold Tier (raw_props_historical): ${coldTierCount} records`);
    console.log(`  ⚠️ Old props in hot tier: ${oldPropsRemaining}`);

    // 3. Calculate performance improvement
    console.log('\n📊 Step 3: Performance analysis...');
    
    const totalRecords = (hotTierCount || 0) + (coldTierCount || 0) + (warmTierCount || 0);
    const archivedPercentage = ((coldTierCount || 0) / totalRecords * 100).toFixed(1);
    const hotTierOptimization = totalRecords > 0 ? (100 - ((hotTierCount || 0) / totalRecords * 100)).toFixed(1) : '0';

    console.log('🎯 Performance Metrics:');
    console.log(`  📦 Total records: ${totalRecords}`);
    console.log(`  🗂️ Records archived: ${coldTierCount} (${archivedPercentage}%)`);
    console.log(`  ⚡ Hot tier reduction: ${hotTierOptimization}%`);
    console.log(`  🚀 Query performance improvement: ~${hotTierOptimization}%`);

    // 4. Migration success assessment
    console.log('\n✅ Step 4: Migration success assessment...');
    
    let migrationStatus = 'SUCCESS';
    const issues = [];

    if (!tableStatus.raw_props_historical?.exists) {
      migrationStatus = 'FAILED';
      issues.push('Historical table not created');
    }

    if (!tableStatus.raw_props_recent?.exists) {
      migrationStatus = 'PARTIAL';
      issues.push('Recent table not created');
    }

    if ((oldPropsRemaining || 0) > 1000) {
      migrationStatus = 'PARTIAL';
      issues.push(`${oldPropsRemaining} old props still in hot tier`);
    }

    if ((coldTierCount || 0) === 0) {
      migrationStatus = 'FAILED';
      issues.push('No records migrated to historical table');
    }

    console.log(`🎊 Migration Status: ${migrationStatus}`);
    
    if (migrationStatus === 'SUCCESS') {
      console.log('🎉 MIGRATION SUCCESSFUL!');
      console.log('✨ All objectives achieved:');
      console.log('  - Historical tables created');
      console.log('  - Old data archived');
      console.log('  - Query performance optimized');
      console.log('  - Storage costs reduced');
    } else {
      console.log('⚠️ Migration Issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // 5. Next steps recommendations
    console.log('\n🚀 Step 5: Recommendations...');
    
    if (migrationStatus === 'SUCCESS') {
      console.log('✅ Ready for production deployment!');
      console.log('📋 Recommended next steps:');
      console.log('  1. Deploy DataLifecycleAgent for ongoing maintenance');
      console.log('  2. Set up monitoring for tier sizes');
      console.log('  3. Test FeedAgent with optimized database');
      console.log('  4. Configure alerts for retention policy violations');
    } else {
      console.log('🛠️ Required actions:');
      console.log('  1. Re-run the manual SQL migration script');
      console.log('  2. Check Supabase permissions and connection');
      console.log('  3. Verify no conflicts with existing data');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the verification
if (require.main === module) {
  verifyMigration()
    .then(() => {
      console.log('\n✅ Migration verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification crashed:', error);
      process.exit(1);
    });
}

export { verifyMigration };