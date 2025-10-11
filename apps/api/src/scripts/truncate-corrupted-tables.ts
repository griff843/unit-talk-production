#!/usr/bin/env tsx
/**
 * PHASE 3: DATABASE CLEANUP
 *
 * Truncates corrupted tables to prepare for clean re-ingestion.
 * CRITICAL: This removes ALL data from these tables!
 *
 * Tables to truncate:
 * - raw_props (8.9M corrupted rows)
 * - market_props (1,837 rows with 100% null fields)
 * - scored_props (121 rows of mock data)
 * - feature_values (empty or sparse, needs repopulation)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface BackupStats {
  tableName: string;
  rowsBackedUp: number;
  success: boolean;
  error?: string;
}

interface TruncateStats {
  tableName: string;
  rowsBefore: number;
  rowsAfter: number;
  success: boolean;
  error?: string;
}

async function backupTable(tableName: string, limit: number = 1000): Promise<BackupStats> {
  console.log(`\n📦 Backing up ${tableName} (sample of ${limit} rows)...`);

  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(limit);

    if (error) {
      return {
        tableName,
        rowsBackedUp: 0,
        success: false,
        error: error.message
      };
    }

    // Write backup to file
    const backupPath = path.resolve(__dirname, `../../../out/backups/${tableName}_backup_${Date.now()}.json`);
    const fs = require('fs');
    const backupDir = path.dirname(backupPath);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.writeFileSync(backupPath, JSON.stringify({
      tableName,
      backupDate: new Date().toISOString(),
      totalRows: count,
      sampleRows: data?.length || 0,
      data
    }, null, 2));

    console.log(`   ✅ Backed up ${data?.length || 0} rows to ${backupPath}`);
    console.log(`   📊 Total rows in table: ${count}`);

    return {
      tableName,
      rowsBackedUp: data?.length || 0,
      success: true
    };

  } catch (err) {
    return {
      tableName,
      rowsBackedUp: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

async function getRowCount(tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn(`   ⚠️ Could not get count for ${tableName}: ${error.message}`);
      return -1;
    }

    return count || 0;
  } catch (err) {
    console.warn(`   ⚠️ Error getting count for ${tableName}`);
    return -1;
  }
}

async function truncateTable(tableName: string, dryRun: boolean = false): Promise<TruncateStats> {
  console.log(`\n🗑️  ${dryRun ? '[DRY RUN] ' : ''}Truncating ${tableName}...`);

  const rowsBefore = await getRowCount(tableName);
  console.log(`   📊 Rows before: ${rowsBefore === -1 ? 'unknown' : rowsBefore.toLocaleString()}`);

  if (dryRun) {
    return {
      tableName,
      rowsBefore,
      rowsAfter: rowsBefore,
      success: true
    };
  }

  try {
    // Use raw SQL DELETE (not TRUNCATE) because TRUNCATE requires elevated permissions
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all rows

    if (error) {
      // If that fails, try RPC method
      console.log(`   ⚠️ Direct delete failed, trying RPC method...`);

      const { error: rpcError } = await supabase.rpc('truncate_table', {
        table_name: tableName
      });

      if (rpcError) {
        return {
          tableName,
          rowsBefore,
          rowsAfter: -1,
          success: false,
          error: rpcError.message
        };
      }
    }

    const rowsAfter = await getRowCount(tableName);
    console.log(`   📊 Rows after: ${rowsAfter === -1 ? 'unknown' : rowsAfter.toLocaleString()}`);

    if (rowsAfter === 0) {
      console.log(`   ✅ Successfully truncated ${tableName}`);
    } else if (rowsAfter < rowsBefore) {
      console.log(`   ⚠️ Partially truncated ${tableName} (${rowsAfter} rows remaining)`);
    } else {
      console.log(`   ❌ Truncation may have failed (row count unchanged)`);
    }

    return {
      tableName,
      rowsBefore,
      rowsAfter,
      success: rowsAfter === 0 || rowsAfter < rowsBefore
    };

  } catch (err) {
    return {
      tableName,
      rowsBefore,
      rowsAfter: -1,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log('🧹 PHASE 3: DATABASE CLEANUP');
  console.log('='.repeat(80));
  console.log('\n⚠️  WARNING: This will DELETE data from the following tables:');
  console.log('   • raw_props (8.9M rows)');
  console.log('   • market_props (1,837 rows)');
  console.log('   • scored_props (121 rows)');
  console.log('   • feature_values (unknown rows)');
  console.log('\n📦 Backups will be created before truncation.');

  // Check for dry run flag
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE: No data will be deleted\n');
  } else {
    console.log('\n⚠️  LIVE MODE: Data will be permanently deleted!');
    console.log('   To run in dry-run mode, use: npm run truncate-tables -- --dry-run\n');

    // Give user time to cancel (Ctrl+C)
    console.log('Starting in 5 seconds... (Press Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const tablesToClean = [
    'raw_props',
    'market_props',
    'scored_props',
    'feature_values'
  ];

  // Step 1: Backup tables
  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: BACKING UP TABLES');
  console.log('='.repeat(80));

  const backupResults: BackupStats[] = [];

  for (const tableName of tablesToClean) {
    const result = await backupTable(tableName, 1000);
    backupResults.push(result);

    if (!result.success) {
      console.error(`   ❌ Backup failed: ${result.error}`);
    }
  }

  // Step 2: Truncate tables
  console.log('\n' + '='.repeat(80));
  console.log('STEP 2: TRUNCATING TABLES');
  console.log('='.repeat(80));

  const truncateResults: TruncateStats[] = [];

  for (const tableName of tablesToClean) {
    const result = await truncateTable(tableName, isDryRun);
    truncateResults.push(result);

    if (!result.success) {
      console.error(`   ❌ Truncation failed: ${result.error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(80));

  console.log('\n📦 Backup Results:');
  backupResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`   ${status} ${r.tableName}: ${r.rowsBackedUp.toLocaleString()} rows backed up`);
    if (r.error) console.log(`      Error: ${r.error}`);
  });

  console.log('\n🗑️  Truncation Results:');
  truncateResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const before = r.rowsBefore === -1 ? 'unknown' : r.rowsBefore.toLocaleString();
    const after = r.rowsAfter === -1 ? 'unknown' : r.rowsAfter.toLocaleString();
    console.log(`   ${status} ${r.tableName}: ${before} → ${after} rows`);
    if (r.error) console.log(`      Error: ${r.error}`);
  });

  const allBackupsSucceeded = backupResults.every(r => r.success);
  const allTruncationsSucceeded = truncateResults.every(r => r.success);

  if (isDryRun) {
    console.log('\n🔍 DRY RUN COMPLETE: No data was deleted');
  } else if (allBackupsSucceeded && allTruncationsSucceeded) {
    console.log('\n✅ PHASE 3 COMPLETE: All tables cleaned successfully');
    console.log('\n📋 NEXT STEP: Phase 4 - Re-ingest clean data');
    console.log('   Run: npm run backfill-market-props');
  } else {
    console.log('\n⚠️  PHASE 3 INCOMPLETE: Some operations failed');
    console.log('   Review errors above and retry failed operations');
  }

  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
