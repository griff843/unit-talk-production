#!/usr/bin/env npx tsx

/**
 * Run Data Lifecycle Setup Directly
 *
 * Attempts to run the table setup and data migration directly via Supabase client
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

// Load environment variables
config();

async function runLifecycleSetup() {
  console.log('🚀 Running Data Lifecycle Setup Directly');
  console.log('========================================');

  const logger = new Logger('run-lifecycle-setup');

  try {
    // 1. Check current state
    console.log('\n📊 Step 1: Current state analysis...');
    const { count: currentTotal } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    const { count: oldProps } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])) || {
      count: 0,
    };

    console.log(`Current total props: ${currentTotal}`);
    console.log(`Old props to archive: ${oldProps}`);

    if ((oldProps || 0) === 0) {
      console.log('✅ No old props to archive - system is already optimized!');
      return;
    }

    // 2. Try to create tables via direct insert approach
    console.log('\n🏗️ Step 2: Creating historical tables...');

    // Test if historical table exists by trying to select from it
    try {
      await supabaseClient.from('raw_props_historical').select('id').limit(1);
      console.log('✅ raw_props_historical already exists');
    } catch (error) {
      console.log('📋 raw_props_historical does not exist - needs manual creation');
    }

    try {
      await supabaseClient.from('raw_props_recent').select('id').limit(1);
      console.log('✅ raw_props_recent already exists');
    } catch (error) {
      console.log('📋 raw_props_recent does not exist - needs manual creation');
    }

    // 3. If tables exist, proceed with data migration
    console.log('\n📦 Step 3: Attempting data migration...');

    // Try to migrate in small batches to avoid timeouts
    const BATCH_SIZE = 1000;
    let migratedCount = 0;
    const targetMigrations = Math.min(oldProps || 0, 10000); // Limit first migration

    console.log(`Attempting to migrate ${targetMigrations} records in batches of ${BATCH_SIZE}...`);

    while (migratedCount < targetMigrations) {
      const remainingToMigrate = targetMigrations - migratedCount;
      const currentBatchSize = Math.min(BATCH_SIZE, remainingToMigrate);

      try {
        // Get old records to migrate
        const { data: recordsToMigrate, error: selectError } = await supabaseClient
          .from('raw_props')
          .select('*')
          .lt('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(currentBatchSize);

        if (selectError) {
          throw new Error(`Failed to select records: ${selectError.message}`);
        }

        if (!recordsToMigrate || recordsToMigrate.length === 0) {
          console.log('✅ No more records to migrate');
          break;
        }

        // Try to insert into historical table
        const { error: insertError } = await supabaseClient
          .from('raw_props_historical')
          .insert(recordsToMigrate);

        if (insertError) {
          if (insertError.message.includes('does not exist')) {
            console.log('⚠️ Historical table does not exist - manual setup required');
            break;
          }
          throw new Error(`Failed to insert into historical: ${insertError.message}`);
        }

        // Delete from main table
        const recordIds = recordsToMigrate.map(record => record.id);
        const { error: deleteError } = await supabaseClient
          .from('raw_props')
          .delete()
          .in('id', recordIds);

        if (deleteError) {
          throw new Error(`Failed to delete from raw_props: ${deleteError.message}`);
        }

        migratedCount += recordsToMigrate.length;
        console.log(
          `✅ Migrated batch: ${recordsToMigrate.length} records (total: ${migratedCount})`
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Batch migration failed:`, error);
        break;
      }
    }

    // 4. Final state check
    console.log('\n📈 Step 4: Final state analysis...');
    const { count: finalTotal } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    const { count: finalOld } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])) || {
      count: 0,
    };

    console.log(`Final total props: ${finalTotal}`);
    console.log(`Remaining old props: ${finalOld}`);
    console.log(`Records migrated: ${(currentTotal || 0) - (finalTotal || 0)}`);

    if (migratedCount > 0) {
      console.log(`\n🎉 SUCCESS: Migrated ${migratedCount} records!`);
      console.log(
        `📈 Performance improvement: ${((migratedCount / (currentTotal || 1)) * 100).toFixed(1)}%`
      );
    } else {
      console.log('\n⚠️ No records migrated - manual table setup required');
      console.log('📋 Please run the SQL from manual-table-setup.sql in Supabase dashboard');
    }
  } catch (error) {
    console.error('\n❌ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    console.log('\n📋 MANUAL SETUP REQUIRED:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run the SQL from apps/api/src/scripts/manual-table-setup.sql');
    console.log('3. This will create tables and migrate data automatically');
  }
}

// Run the setup
if (require.main === module) {
  runLifecycleSetup()
    .then(() => {
      console.log('\n✅ Lifecycle setup completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Setup crashed:', error);
      process.exit(1);
    });
}

export { runLifecycleSetup };
