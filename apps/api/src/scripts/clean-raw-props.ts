#!/usr/bin/env tsx
/**
 * Clean raw_props table using service role permissions
 * This handles the 8.9M corrupted rows that can't be deleted via standard methods
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function cleanRawProps() {
  console.log('🗑️  Cleaning raw_props table...');
  console.log('   This may take a while for 8.9M rows...\n');

  try {
    // First, try to get current count
    console.log('   📊 Checking current row count...');
    const { count: beforeCount, error: countError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`   ⚠️ Could not get count: ${countError.message}`);
    } else {
      console.log(`   📊 Rows before: ${beforeCount?.toLocaleString() || 'unknown'}`);
    }

    // Try batch deletion (delete in chunks to avoid timeout)
    console.log('\n   🔄 Starting batch deletion...');

    let totalDeleted = 0;
    const batchSize = 1000;
    let hasMore = true;
    let batchNum = 0;

    while (hasMore && batchNum < 100) { // Limit to 100 batches (100K rows) for safety
      batchNum++;

      // Delete oldest rows first
      const { data, error: deleteError, count } = await supabase
        .from('raw_props')
        .delete({ count: 'exact' })
        .lt('game_date', new Date().toISOString()) // Delete all past games
        .limit(batchSize);

      if (deleteError) {
        console.log(`\n   ❌ Batch ${batchNum} failed: ${deleteError.message}`);

        // If batch delete fails, try deleting all at once
        console.log('   🔄 Trying full delete...');
        const { error: fullDeleteError } = await supabase
          .from('raw_props')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all

        if (fullDeleteError) {
          console.error(`   ❌ Full delete also failed: ${fullDeleteError.message}`);
        } else {
          console.log('   ✅ Full delete succeeded');
        }

        hasMore = false;
      } else {
        totalDeleted += (count || 0);

        if (batchNum % 10 === 0) {
          console.log(`   📊 Batch ${batchNum}: Deleted ${totalDeleted.toLocaleString()} rows so far...`);
        }

        // Check if there are more rows
        if ((count || 0) < batchSize) {
          hasMore = false;
          console.log(`\n   ✅ Deletion complete: ${totalDeleted.toLocaleString()} rows deleted`);
        }
      }
    }

    if (batchNum >= 100) {
      console.log('\n   ⚠️ Reached batch limit (100K rows). Run again to delete more.');
    }

    // Final count check
    console.log('\n   📊 Checking final row count...');
    const { count: afterCount, error: finalCountError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (!finalCountError) {
      console.log(`   📊 Rows after: ${afterCount?.toLocaleString() || 'unknown'}`);

      if (afterCount === 0) {
        console.log('   ✅ raw_props table is now empty!');
      } else if (afterCount && beforeCount && afterCount < beforeCount) {
        console.log(`   ✅ Successfully deleted ${(beforeCount - afterCount).toLocaleString()} rows`);
      }
    }

  } catch (err) {
    console.error('\n   ❌ Cleanup failed:', err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }
}

cleanRawProps()
  .then(() => {
    console.log('\n✅ raw_props cleanup complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
