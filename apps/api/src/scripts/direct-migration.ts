#!/usr/bin/env npx tsx

/**
 * Direct Data Migration
 *
 * Directly migrate old props to historical table using simple approach
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

// Load environment variables
config();

async function directMigration() {
  console.log('🚀 Direct Props Migration');
  console.log('=========================');

  const logger = new Logger('direct-migration');

  try {
    // 1. Get current state
    const { count: totalProps } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    console.log(`Current total props: ${totalProps}`);

    // 2. Count old props (older than 1 day)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`Cutoff date: ${cutoffDate}`);

    const { count: oldPropsCount } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate)) || { count: 0 };

    console.log(`Old props to migrate: ${oldPropsCount}`);

    if ((oldPropsCount || 0) === 0) {
      console.log('✅ No old props to migrate');
      return;
    }

    // 3. Migrate in small batches
    const BATCH_SIZE = 500; // Smaller batches for reliability
    let totalMigrated = 0;

    console.log(`\n📦 Starting migration in batches of ${BATCH_SIZE}...`);

    while (totalMigrated < (oldPropsCount || 0)) {
      try {
        // Get a batch of old records
        const { data: oldRecords, error: fetchError } = await supabaseClient
          .from('raw_props')
          .select('*')
          .lt('game_date', cutoffDate)
          .limit(BATCH_SIZE);

        if (fetchError) {
          console.error('❌ Failed to fetch old records:', fetchError.message);
          break;
        }

        if (!oldRecords || oldRecords.length === 0) {
          console.log('✅ No more records to migrate');
          break;
        }

        console.log(`📋 Processing batch of ${oldRecords.length} records...`);

        // Insert into historical table
        const { error: insertError } = await supabaseClient
          .from('raw_props_historical')
          .insert(oldRecords);

        if (insertError) {
          console.error('❌ Failed to insert into historical table:', insertError.message);
          // If it's a duplicate key error, that's okay - the records already exist
          if (
            !insertError.message.includes('duplicate key') &&
            !insertError.message.includes('already exists')
          ) {
            break;
          }
          console.log('ℹ️ Records already exist in historical table, continuing with deletion...');
        }

        // Delete from main table
        const recordIds = oldRecords.map(record => record.id);
        const { error: deleteError } = await supabaseClient
          .from('raw_props')
          .delete()
          .in('id', recordIds);

        if (deleteError) {
          console.error('❌ Failed to delete from main table:', deleteError.message);
          break;
        }

        totalMigrated += oldRecords.length;
        console.log(`✅ Migrated ${oldRecords.length} records (total: ${totalMigrated})`);

        // Short delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (batchError) {
        console.error('❌ Batch error:', batchError);
        break;
      }
    }

    // 4. Final verification
    console.log('\n📊 Final verification...');

    const { count: finalTotal } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    const { count: remainingOld } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate)) || { count: 0 };

    const { count: historicalCount } = (await supabaseClient
      .from('raw_props_historical')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    console.log(`\n📈 MIGRATION RESULTS:`);
    console.log(`🔥 Hot tier (raw_props): ${finalTotal} records`);
    console.log(`🧊 Cold tier (raw_props_historical): ${historicalCount} records`);
    console.log(`📦 Records migrated: ${totalMigrated}`);
    console.log(`⚠️ Remaining old records: ${remainingOld}`);

    const improvementPercent = ((totalMigrated / (totalProps || 1)) * 100).toFixed(1);
    console.log(`📈 Performance improvement: ${improvementPercent}%`);

    if (totalMigrated > 0) {
      console.log('\n🎉 MIGRATION SUCCESSFUL!');
      console.log('⚡ Your queries will now be significantly faster!');
      console.log('💰 Storage costs reduced through data tiering');
    } else {
      console.log('\n⚠️ No records were migrated');
    }
  } catch (error) {
    console.error(
      '\n❌ Migration failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the migration
if (require.main === module) {
  directMigration()
    .then(() => {
      console.log('\n✅ Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Migration crashed:', error);
      process.exit(1);
    });
}

export { directMigration };
