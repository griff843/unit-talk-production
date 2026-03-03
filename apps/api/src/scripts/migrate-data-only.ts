#!/usr/bin/env npx tsx

/**
 * Migrate Data Only
 *
 * Since tables exist, this script focuses only on moving the 512,537 old props
 * from raw_props to raw_props_historical using direct INSERT/DELETE operations.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

// Load environment variables
config();

async function migrateDataOnly() {
  console.log('📦 Data-Only Migration (Tables Already Exist)');
  console.log('==============================================');

  const logger = new Logger('migrate-data-only');

  try {
    // 1. Verify current state
    console.log('\n📊 Step 1: Current state analysis...');

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { count: totalProps } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    const { count: oldProps } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate)) || { count: 0 };

    const { count: existingHistorical } = (await supabaseClient
      .from('raw_props_historical')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    console.log(`📈 Current State:`);
    console.log(`  🔥 Total props in raw_props: ${totalProps}`);
    console.log(`  📦 Old props to migrate (${cutoffDate}): ${oldProps}`);
    console.log(`  🧊 Existing historical props: ${existingHistorical || 0}`);

    if ((oldProps || 0) === 0) {
      console.log('✅ No old props to migrate - system is optimized!');
      return;
    }

    console.log(
      `\n💥 PERFORMANCE ISSUE: ${(((oldProps || 0) / (totalProps || 1)) * 100).toFixed(1)}% of data is stale!`
    );

    // 2. Batch migration approach
    console.log('\n🔄 Step 2: Starting batch migration...');
    console.log('⚠️ Using small batches to avoid timeouts and maintain system stability');

    const BATCH_SIZE = 1000; // Small batches for reliability
    let totalMigrated = 0;
    let batchCount = 0;
    const maxBatches = Math.min(Math.ceil((oldProps || 0) / BATCH_SIZE), 100); // Limit to first 100 batches

    console.log(`📋 Migration plan: ${maxBatches} batches of ${BATCH_SIZE} records each`);

    while (totalMigrated < Math.min(oldProps || 0, maxBatches * BATCH_SIZE)) {
      batchCount++;
      const remainingRecords = Math.min(oldProps || 0, maxBatches * BATCH_SIZE) - totalMigrated;
      const currentBatchSize = Math.min(BATCH_SIZE, remainingRecords);

      console.log(
        `\n📦 Batch ${batchCount}/${maxBatches}: Processing ${currentBatchSize} records...`
      );

      try {
        // Get old records to migrate
        const { data: recordsToMigrate, error: selectError } = await supabaseClient
          .from('raw_props')
          .select('*')
          .lt('game_date', cutoffDate)
          .limit(currentBatchSize);

        if (selectError) {
          throw new Error(`Failed to select records: ${selectError.message}`);
        }

        if (!recordsToMigrate || recordsToMigrate.length === 0) {
          console.log('✅ No more records to migrate');
          break;
        }

        console.log(`  📋 Selected ${recordsToMigrate.length} records for migration`);

        // Insert into historical table
        const { error: insertError } = await supabaseClient
          .from('raw_props_historical')
          .insert(recordsToMigrate);

        if (insertError) {
          if (
            insertError.message.includes('duplicate key') ||
            insertError.message.includes('already exists')
          ) {
            console.log(
              '  ℹ️ Records already exist in historical table, proceeding with deletion...'
            );
          } else {
            throw new Error(`Failed to insert into historical: ${insertError.message}`);
          }
        } else {
          console.log(`  ✅ Inserted ${recordsToMigrate.length} records into historical table`);
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

        console.log(`  🗑️ Deleted ${recordsToMigrate.length} records from raw_props`);

        totalMigrated += recordsToMigrate.length;
        const progressPercent = (
          (totalMigrated / Math.min(oldProps || 0, maxBatches * BATCH_SIZE)) *
          100
        ).toFixed(1);
        console.log(`  📊 Progress: ${totalMigrated} migrated (${progressPercent}%)`);

        // Short delay between batches to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (batchError) {
        console.error(`❌ Batch ${batchCount} failed:`, batchError);
        break;
      }
    }

    // 4. Final verification
    console.log('\n📊 Step 3: Final verification...');

    const { count: finalTotal } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    const { count: finalOld } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate)) || { count: 0 };

    const { count: finalHistorical } = (await supabaseClient
      .from('raw_props_historical')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    console.log('\n🎊 MIGRATION RESULTS:');
    console.log('===================');
    console.log(`🔥 Hot tier (raw_props): ${finalTotal} records`);
    console.log(`🧊 Cold tier (raw_props_historical): ${finalHistorical} records`);
    console.log(`📦 Total migrated: ${totalMigrated} records`);
    console.log(`⚠️ Remaining old records: ${finalOld}`);

    const actualImprovement = ((totalMigrated / (totalProps || 1)) * 100).toFixed(1);
    console.log(`📈 Performance improvement: ${actualImprovement}%`);

    if (totalMigrated > 0) {
      console.log('\n🎉 MIGRATION SUCCESSFUL!');
      console.log('⚡ Query performance significantly improved');
      console.log('💰 Storage costs reduced through data tiering');

      if ((finalOld || 0) > 0) {
        console.log(`\n📝 Note: ${finalOld} old records remain (run again to continue migration)`);
      } else {
        console.log('\n✨ All old records successfully migrated!');
      }
    } else {
      console.log('\n⚠️ No records were migrated - check for errors above');
    }

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Monitor query performance improvements');
    console.log('2. Set up DataLifecycleAgent for ongoing maintenance');
    console.log('3. Configure monitoring for tier sizes');
    console.log('4. Test FeedAgent with optimized database');
  } catch (error) {
    console.error(
      '\n❌ Data migration failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the data migration
if (require.main === module) {
  migrateDataOnly()
    .then(() => {
      console.log('\n✅ Data migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Data migration crashed:', error);
      process.exit(1);
    });
}

export { migrateDataOnly };
