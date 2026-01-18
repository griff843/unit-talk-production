/**
 * Historical Backfill Script: unified_picks → picks (Canonical)
 *
 * Purpose: Batch migration with progress tracking, metrics, and resume capability
 * Charter Compliance: v3.0 - Canonical-first architecture
 *
 * Usage:
 *   npm run backfill -- --batch-size=5000 --dry-run
 *   npm run backfill -- --batch-size=5000 --resume
 *
 * Safety:
 *   - Idempotent: ON CONFLICT DO NOTHING on (id)
 *   - Resumable: Tracks progress in backfill_progress table
 *   - Metrics: Writes detailed metrics to out/ops/cutover/metrics/100/
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

interface BackfillOptions {
  batchSize: number;
  dryRun: boolean;
  resume: boolean;
}

interface BackfillMetrics {
  startTime: Date;
  endTime?: Date;
  totalSourceRows: number;
  rowsMigrated: number;
  rowsSkipped: number;
  batchesProcessed: number;
  errors: Array<{ batch: number; error: string }>;
  durationSeconds?: number;
}

// ============================================================================
// Initialize Supabase Client
// ============================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// Progress Tracking
// ============================================================================
async function initProgressTable() {
  // Note: backfill_progress table should be created via migration
  // For now, we'll skip table creation and rely on upsert handling
  console.log('Progress tracking: Using existing backfill_progress table (if available)');
}

async function getProgress(): Promise<{ lastProcessedId: string | null; rowsProcessed: number } | null> {
  const { data, error } = await supabase
    .from('backfill_progress')
    .select('last_processed_id, rows_processed')
    .eq('migration_name', '20251030_backfill_unified_to_canonical')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get progress: ${error.message}`);
  }

  return data ? { lastProcessedId: data.last_processed_id, rowsProcessed: data.rows_processed } : null;
}

async function updateProgress(lastProcessedId: string, rowsProcessed: number, status: string = 'in_progress') {
  const { error } = await supabase
    .from('backfill_progress')
    .upsert({
      migration_name: '20251030_backfill_unified_to_canonical',
      last_processed_id: lastProcessedId,
      rows_processed: rowsProcessed,
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
    });

  if (error) {
    throw new Error(`Failed to update progress: ${error.message}`);
  }
}

// ============================================================================
// Backfill Logic
// ============================================================================
async function checkTablesExist(): Promise<{ unifiedPicksExists: boolean; picksExists: boolean }> {
  // Check if unified_picks exists by trying to query it
  const { error: unifiedError } = await supabase
    .from('unified_picks')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  // Check if picks exists by trying to query it
  const { error: picksError } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  return {
    unifiedPicksExists: !unifiedError || unifiedError.code !== 'PGRST204',
    picksExists: !picksError || picksError.code !== 'PGRST204',
  };
}

async function getTotalSourceRows(): Promise<number> {
  const { count, error } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count source rows: ${error.message}`);
  }

  return count || 0;
}

async function backfillBatch(
  offset: number,
  batchSize: number,
  lastProcessedId: string | null,
  dryRun: boolean
): Promise<{ rowsMigrated: number; lastId: string | null }> {
  console.log(`Processing batch: offset=${offset}, size=${batchSize}`);

  // Fetch batch from unified_picks
  const query = supabase
    .from('unified_picks')
    .select('*')
    .order('id', { ascending: true })
    .limit(batchSize);

  if (lastProcessedId) {
    query.gt('id', lastProcessedId);
  } else {
    query.range(offset, offset + batchSize - 1);
  }

  const { data: unifiedPicks, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch batch: ${fetchError.message}`);
  }

  if (!unifiedPicks || unifiedPicks.length === 0) {
    return { rowsMigrated: 0, lastId: null };
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would migrate ${unifiedPicks.length} rows`);
    return { rowsMigrated: unifiedPicks.length, lastId: unifiedPicks[unifiedPicks.length - 1].id };
  }

  // Transform and insert into picks
  const picksData = unifiedPicks.map(up => ({
    id: up.id,
    tenant_id: up.tenant_id || DEFAULT_TENANT_ID,
    user_id: up.user_id,
    prop_id: up.prop_id,
    selection: up.prediction || up.direction || up.selection || 'over',
    odds: up.odds || -110,
    stake: up.stake || up.units || 1.0,
    confidence: up.confidence_score || up.confidence || 5,
    workflow_stage: up.published_at ? 'published' : (up.approved_at ? 'approved' : 'draft'),
    status: up.result || up.status || 'pending',
    result: up.result,
    actual_value: up.actual_value,
    profit_loss: up.profit_loss,
    settled_at: up.settled_at,
    professional_score: up.professional_score,
    grading_status: up.grading_status || 'pending',
    graded_at: up.graded_at,
    idempotency_key: up.idempotency_key || `backfill-${up.id}`,
    bet_slip_id: up.bet_slip_id,
    metadata: up.metadata || {},
    created_at: up.created_at,
    updated_at: up.updated_at,
    published_at: up.published_at,
  }));

  const { error: insertError } = await supabase
    .from('picks')
    .upsert(picksData, { onConflict: 'id', ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`Failed to insert batch: ${insertError.message}`);
  }

  const lastId = unifiedPicks[unifiedPicks.length - 1].id;
  console.log(`✓ Migrated ${unifiedPicks.length} rows. Last ID: ${lastId}`);

  return { rowsMigrated: unifiedPicks.length, lastId };
}

// ============================================================================
// Metrics Export
// ============================================================================
function exportMetrics(metrics: BackfillMetrics, options: BackfillOptions) {
  const metricsDir = path.join(process.cwd(), 'out', 'ops', 'cutover', 'metrics', '101');
  fs.mkdirSync(metricsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonFile = path.join(metricsDir, `BACKFILL_METRICS_${timestamp}.json`);
  const mdFile = path.join(metricsDir, `BACKFILL_REPORT_${timestamp}.md`);

  // JSON metrics
  fs.writeFileSync(jsonFile, JSON.stringify(metrics, null, 2));

  // Markdown report
  const report = `# Historical Backfill Report
## Migration: unified_picks → picks (Canonical)

**Date**: ${new Date().toISOString()}
**Charter Version**: v3.0
**Migration Script**: 20251030_backfill_unified_to_canonical

### Configuration
- **Batch Size**: ${options.batchSize}
- **Dry Run**: ${options.dryRun}
- **Resume**: ${options.resume}

### Results
- **Total Source Rows**: ${metrics.totalSourceRows}
- **Rows Migrated**: ${metrics.rowsMigrated}
- **Rows Skipped**: ${metrics.rowsSkipped}
- **Batches Processed**: ${metrics.batchesProcessed}
- **Duration**: ${metrics.durationSeconds?.toFixed(2)}s
- **Throughput**: ${(metrics.rowsMigrated / (metrics.durationSeconds || 1)).toFixed(2)} rows/sec

### Status
${metrics.errors.length === 0 ? '✅ **SUCCESS**: All batches processed without errors' : `⚠️ **PARTIAL SUCCESS**: ${metrics.errors.length} batch(es) failed`}

${metrics.errors.length > 0 ? `### Errors\n${metrics.errors.map(e => `- Batch ${e.batch}: ${e.error}`).join('\n')}` : ''}

### Next Steps
1. Verify data integrity: Compare row counts between unified_picks and picks
2. Run validation query: \`SELECT * FROM vw_unified_picks_readonly_status;\`
3. Test application with canonical driver: \`PICK_DRIVER=canonical\`
4. Monitor SLO metrics for 24-48 hours
5. Update Charter compliance checklist

---
**Generated by**: apps/api/src/scripts/backfill.ts
`;

  fs.writeFileSync(mdFile, report);

  console.log(`\n📊 Metrics exported:`);
  console.log(`   JSON: ${jsonFile}`);
  console.log(`   Markdown: ${mdFile}`);
}

// ============================================================================
// Main Execution
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    batchSize: parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || String(DEFAULT_BATCH_SIZE)),
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
  };

  console.log('🚀 Starting Historical Backfill: unified_picks → picks');
  console.log(`   Batch Size: ${options.batchSize}`);
  console.log(`   Dry Run: ${options.dryRun}`);
  console.log(`   Resume: ${options.resume}\n`);

  const metrics: BackfillMetrics = {
    startTime: new Date(),
    totalSourceRows: 0,
    rowsMigrated: 0,
    rowsSkipped: 0,
    batchesProcessed: 0,
    errors: [],
  };

  try {
    // 1. Check tables exist
    const { unifiedPicksExists, picksExists } = await checkTablesExist();

    if (!picksExists) {
      throw new Error('Canonical "picks" table does not exist. Run canonical schema migration first.');
    }

    if (!unifiedPicksExists) {
      console.log('⚠️ unified_picks table does not exist. Nothing to backfill.');
      return;
    }

    // 2. Initialize progress tracking
    await initProgressTable();

    // 3. Get total source rows
    metrics.totalSourceRows = await getTotalSourceRows();
    console.log(`📊 Total source rows: ${metrics.totalSourceRows}\n`);

    // 4. Resume from last checkpoint if requested
    let lastProcessedId: string | null = null;
    let offset = 0;

    if (options.resume) {
      const progress = await getProgress();
      if (progress) {
        lastProcessedId = progress.lastProcessedId;
        metrics.rowsMigrated = progress.rowsProcessed;
        console.log(`🔄 Resuming from last checkpoint: ${metrics.rowsMigrated} rows already processed\n`);
      }
    }

    // 5. Process batches
    let hasMore = true;
    while (hasMore) {
      try {
        const { rowsMigrated, lastId } = await backfillBatch(offset, options.batchSize, lastProcessedId, options.dryRun);

        if (rowsMigrated === 0) {
          hasMore = false;
        } else {
          metrics.rowsMigrated += rowsMigrated;
          metrics.batchesProcessed++;
          lastProcessedId = lastId;

          if (!options.dryRun && lastId) {
            await updateProgress(lastId, metrics.rowsMigrated);
          }

          offset += options.batchSize;
        }
      } catch (error: any) {
        metrics.errors.push({
          batch: metrics.batchesProcessed + 1,
          error: error.message,
        });
        console.error(`❌ Batch ${metrics.batchesProcessed + 1} failed: ${error.message}`);
        break;
      }
    }

    // 6. Finalize
    metrics.endTime = new Date();
    metrics.durationSeconds = (metrics.endTime.getTime() - metrics.startTime.getTime()) / 1000;
    metrics.rowsSkipped = metrics.totalSourceRows - metrics.rowsMigrated;

    if (!options.dryRun && metrics.errors.length === 0) {
      await updateProgress(lastProcessedId!, metrics.rowsMigrated, 'completed');
    }

    // 7. Export metrics
    exportMetrics(metrics, options);

    console.log(`\n✅ Backfill completed:`);
    console.log(`   Rows migrated: ${metrics.rowsMigrated} / ${metrics.totalSourceRows}`);
    console.log(`   Duration: ${metrics.durationSeconds.toFixed(2)}s`);
    console.log(`   Throughput: ${(metrics.rowsMigrated / metrics.durationSeconds).toFixed(2)} rows/sec\n`);

  } catch (error: any) {
    console.error(`\n❌ Backfill failed: ${error.message}`);
    metrics.endTime = new Date();
    metrics.durationSeconds = (metrics.endTime.getTime() - metrics.startTime.getTime()) / 1000;
    exportMetrics(metrics, options);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main, BackfillOptions, BackfillMetrics };
