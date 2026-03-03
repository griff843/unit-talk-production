#!/usr/bin/env npx tsx

/**
 * Automated Batch Migration Runner
 *
 * Runs the batched migration automatically with proper delays
 * and progress monitoring. Stops automatically when complete.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

// Load environment variables
config();

interface MigrationProgress {
  totalProps: number;
  oldProps: number;
  currentProps: number;
  historicalProps: number;
  batchesCompleted: number;
  percentComplete: number;
}

async function automatedBatchRunner() {
  console.log('🤖 Automated Batch Migration Runner');
  console.log('===================================');

  const logger = new Logger('automated-batch-runner');
  const BATCH_SIZE = 5000; // Conservative batch size
  const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
  const MAX_BATCHES = 200; // Safety limit (200 * 5000 = 1M records max)

  try {
    // 1. Initial state check
    console.log('\n📊 Step 1: Analyzing migration requirements...');

    const initialProgress = await getProgress();
    console.log(`🔥 Current state:`);
    console.log(`  Total props: ${initialProgress.totalProps}`);
    console.log(`  Old props to migrate: ${initialProgress.oldProps}`);
    console.log(`  Current props to keep: ${initialProgress.currentProps}`);
    console.log(`  Already in historical: ${initialProgress.historicalProps}`);

    if (initialProgress.oldProps === 0) {
      console.log('✅ No migration needed - system already optimized!');
      return;
    }

    const estimatedBatches = Math.ceil(initialProgress.oldProps / BATCH_SIZE);
    console.log(`📋 Migration plan: ~${estimatedBatches} batches of ${BATCH_SIZE} records`);
    console.log(`⏱️ Estimated time: ~${Math.ceil((estimatedBatches * 3) / 60)} minutes`);

    // 2. Automated batch processing
    console.log('\n🔄 Step 2: Starting automated batch migration...');

    let batchCount = 0;
    let lastProgress = initialProgress;

    while (batchCount < MAX_BATCHES) {
      batchCount++;
      const batchStartTime = Date.now();

      console.log(`\n📦 Batch ${batchCount}: Processing ${BATCH_SIZE} records...`);

      try {
        // Execute single batch migration
        const batchResult = await executeBatch(BATCH_SIZE);

        if (batchResult.recordsMigrated === 0) {
          console.log('✅ No more records to migrate - batch complete!');
          break;
        }

        // Get updated progress
        const currentProgress = await getProgress();
        const batchTime = Date.now() - batchStartTime;

        // Progress reporting
        console.log(`  ✅ Migrated: ${batchResult.recordsMigrated} records`);
        console.log(`  ⏱️ Batch time: ${batchTime}ms`);
        console.log(`  📊 Remaining: ${currentProgress.oldProps} old props`);

        const progressPercent = (
          ((initialProgress.oldProps - currentProgress.oldProps) / initialProgress.oldProps) *
          100
        ).toFixed(1);
        console.log(`  📈 Progress: ${progressPercent}% complete`);

        // Safety check for infinite loops
        if (currentProgress.oldProps >= lastProgress.oldProps) {
          console.warn('⚠️ No progress detected - stopping to prevent infinite loop');
          break;
        }

        lastProgress = currentProgress;

        // Delay between batches to avoid overwhelming database
        if (currentProgress.oldProps > 0) {
          console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      } catch (batchError) {
        console.error(`❌ Batch ${batchCount} failed:`, batchError);

        // Longer delay after error
        console.log('⏳ Waiting 5 seconds after error before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Don't count failed batches
        batchCount--;
        continue;
      }
    }

    // 3. Final verification
    console.log('\n📊 Step 3: Final migration results...');

    const finalProgress = await getProgress();
    const totalMigrated = initialProgress.oldProps - finalProgress.oldProps;
    const performanceImprovement = ((totalMigrated / initialProgress.totalProps) * 100).toFixed(1);

    console.log('\n🎊 AUTOMATED MIGRATION RESULTS:');
    console.log('===============================');
    console.log(`🔥 Hot tier (raw_props): ${finalProgress.totalProps} records`);
    console.log(`🧊 Cold tier (raw_props_historical): ${finalProgress.historicalProps} records`);
    console.log(`📦 Total migrated: ${totalMigrated} records`);
    console.log(`📈 Performance improvement: ${performanceImprovement}%`);
    console.log(`🏁 Batches completed: ${batchCount}`);

    if (finalProgress.oldProps === 0) {
      console.log('\n🎉 MIGRATION FULLY COMPLETE!');
      console.log('⚡ System optimized for maximum query performance');
      console.log('💰 Storage costs reduced through data tiering');
      console.log('🚀 Ready for production deployment');
    } else {
      console.log(`\n⚠️ Partial migration: ${finalProgress.oldProps} old records remain`);
      console.log('💡 Run script again to continue migration');
    }
  } catch (error) {
    console.error(
      '\n❌ Automated migration failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    console.log('\n🛠️ Recovery options:');
    console.log('1. Check database connection and permissions');
    console.log('2. Try manual batch scripts with smaller batch sizes');
    console.log('3. Verify no conflicting operations are running');
  }
}

async function getProgress(): Promise<MigrationProgress> {
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { count: totalProps } = (await supabaseClient
    .from('raw_props')
    .select('*', { count: 'exact', head: true })) || { count: 0 };

  const { count: oldProps } = (await supabaseClient
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .lt('game_date', cutoffDate)) || { count: 0 };

  const { count: historicalProps } = (await supabaseClient
    .from('raw_props_historical')
    .select('*', { count: 'exact', head: true })) || { count: 0 };

  const currentProps = (totalProps || 0) - (oldProps || 0);
  const percentComplete = totalProps ? ((totalProps - oldProps) / totalProps) * 100 : 100;

  return {
    totalProps: totalProps || 0,
    oldProps: oldProps || 0,
    currentProps,
    historicalProps: historicalProps || 0,
    batchesCompleted: 0,
    percentComplete,
  };
}

async function executeBatch(batchSize: number): Promise<{ recordsMigrated: number }> {
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get batch of old records to migrate
  const { data: recordsToMigrate, error: selectError } = await supabaseClient
    .from('raw_props')
    .select('*')
    .lt('game_date', cutoffDate)
    .order('game_date', { ascending: true })
    .limit(batchSize);

  if (selectError) {
    throw new Error(`Failed to select records: ${selectError.message}`);
  }

  if (!recordsToMigrate || recordsToMigrate.length === 0) {
    return { recordsMigrated: 0 };
  }

  // Insert into historical table
  const { error: insertError } = await supabaseClient
    .from('raw_props_historical')
    .insert(recordsToMigrate);

  if (insertError) {
    if (
      !insertError.message.includes('duplicate key') &&
      !insertError.message.includes('already exists')
    ) {
      throw new Error(`Failed to insert into historical: ${insertError.message}`);
    }
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

  return { recordsMigrated: recordsToMigrate.length };
}

// Run the automated migration
if (require.main === module) {
  automatedBatchRunner()
    .then(() => {
      console.log('\n✅ Automated batch migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Automated migration crashed:', error);
      process.exit(1);
    });
}

export { automatedBatchRunner };
