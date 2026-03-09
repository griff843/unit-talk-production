/**
 * Backfill Activities for FeedAgentBackfillWorkflow
 *
 * Provides activities for date range backfilling with safety controls,
 * idempotency checks, and downstream workflow triggering.
 */

import crypto from 'crypto';

import { fetchUnifiedData } from '../agents/FeedAgent/dataSourceRouter';
// SPRINT-044Q: compatInsertRawProp removed — raw_props writes were orphaned (no production reader)
import { supabaseClient } from '../services/supabaseClient';
// Note: Using console.log instead of Logger to avoid import issues

export interface BackfillHourRequest {
  date: string; // ISO date string for the hour
  sport?: string;
  dryRun: boolean;
  batchSize: number;
}

export interface BackfillHourResult {
  processedCount: number;
  duplicateCount: number;
  totalCount: number;
  hour: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface IdempotencyResult {
  exists: boolean;
  completedAt?: string;
}

/**
 * Validate backfill request parameters
 */
export async function validateBackfillRequest(request: any): Promise<ValidationResult> {
  try {
    const { startDate, endDate, maxCalls, batchSize } = request;

    // Validate date format
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }

    // Validate date range
    if (start >= end) {
      return { valid: false, error: 'Start date must be before end date' };
    }

    // Validate date range isn't too large
    const diffHours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diffHours > 168) {
      // 7 days
      return { valid: false, error: 'Date range cannot exceed 7 days' };
    }

    // Validate maxCalls safety limit
    if (maxCalls && maxCalls < diffHours) {
      return {
        valid: false,
        error: `maxCalls (${maxCalls}) is less than required hours (${diffHours})`,
      };
    }

    // Validate batchSize
    if (batchSize && (batchSize < 1 || batchSize > 1000)) {
      return { valid: false, error: 'batchSize must be between 1 and 1000' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Backfill validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Check if backfill already exists for this date range (idempotency)
 */
export async function checkIdempotency(request: any): Promise<IdempotencyResult> {
  try {
    const { startDate, endDate, sport } = request;

    // Check if backfill record exists
    const { data, error } = await supabaseClient
      .from('backfill_history')
      .select('id, completed_at, status')
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .eq('sport', sport || 'all')
      .eq('status', 'completed')
      .limit(1);

    if (error) {
      console.error('Idempotency check error:', error);
      return { exists: false };
    }

    if (data && data.length > 0) {
      return {
        exists: true,
        completedAt: data[0].completed_at,
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('Idempotency check error:', error);
    return { exists: false };
  }
}

/**
 * Backfill props for a specific hour
 */
export async function backfillPropsForHour(
  request: BackfillHourRequest
): Promise<BackfillHourResult> {
  const { date, sport, dryRun, batchSize: _batchSize } = request;
  console.log(`[Backfill] Processing hour: ${date}, sport: ${sport || 'all'}, dryRun: ${dryRun}`);

  try {
    // Fetch data from unified data source
    const response = await fetchUnifiedData({
      sport: sport || 'all',
      marketType: 'player-props',
    });

    const props = response.data;
    console.log(`[Backfill] Fetched ${props.length} props for ${date}`);

    if (dryRun) {
      console.log(`[Backfill] DRY RUN: Would process ${props.length} props for ${date}`);
      return {
        processedCount: props.length,
        duplicateCount: 0,
        totalCount: props.length,
        hour: date,
      };
    }

    let processedCount = 0;
    const duplicateCount = 0;

    // Process props in batches
    const batchId = crypto.randomUUID();
    const timestamp = new Date();

    for (let i = 0; i < props.length; i += 50) {
      const batch = props.slice(i, i + 50);

      // Prepare props for insertion
      const propsForDB = batch.map(prop => ({
        id: crypto.randomUUID(),
        external_prop_id: prop.id || crypto.randomUUID(),
        sport: sport || prop.sport,
        stat_type: prop.stat_type || (prop as any).prop_type,
        player_name: prop.player_name || (prop as any).name,
        team: prop.team,
        opponent: prop.opponent,
        line: prop.line,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        book: prop.book || response.source,
        game_time: prop.game_time || timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        batch_id: batchId,
        source: 'backfill',
        backfill_date: date,
      }));

      // SPRINT-044Q: raw_props dedup + insert removed — orphaned after GRADING_DATA_SOURCE flip (044P)
      // Backfill to provider_offers is a future sprint concern
      processedCount += propsForDB.length;
    }

    console.log(
      `[Backfill] Completed hour ${date}: ${processedCount} new props, ${duplicateCount} duplicates`
    );

    return {
      processedCount,
      duplicateCount,
      totalCount: props.length,
      hour: date,
    };
  } catch (error) {
    console.error(`[Backfill] Error processing hour ${date}:`, error);
    return {
      processedCount: 0,
      duplicateCount: 0,
      totalCount: 0,
      hour: date,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Record backfill progress in database
 */
export async function recordBackfillProgress(params: {
  workflowId: string;
  hourChunk: string;
  result: BackfillHourResult;
  progress: any;
}): Promise<void> {
  try {
    const { workflowId, hourChunk, result, progress } = params;

    // Insert or update backfill progress record
    const { error } = await supabaseClient.from('backfill_progress').upsert(
      {
        workflow_id: workflowId,
        hour_chunk: hourChunk,
        completed_hours: progress.completedHours,
        failed_hours: progress.failedHours,
        total_props: progress.totalProps,
        processed_props: progress.processedProps,
        duplicate_props: progress.duplicateProps,
        api_call_count: progress.apiCallCount,
        status: progress.status,
        error: progress.error,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'workflow_id',
      }
    );

    if (error) {
      console.error('[Backfill] Error recording progress:', error);
    }
  } catch (error) {
    console.error('[Backfill] Error recording progress:', error);
  }
}

/**
 * Trigger Processor workflow after successful backfill
 */
export async function triggerProcessor(params: {
  dateRange: { start: string; end: string };
  propCount: number;
  source: string;
}): Promise<void> {
  try {
    console.log('[Backfill] Triggering Processor workflow...', params);

    // TODO: Implement actual Temporal workflow client to trigger processor
    // For now, log the trigger request
    console.log('[Backfill] Processor workflow trigger requested:', params);
  } catch (error) {
    console.error('[Backfill] Error triggering processor:', error);
    throw error;
  }
}

/**
 * Trigger Promoter workflow after successful backfill
 */
export async function triggerPromoter(params: {
  dateRange: { start: string; end: string };
  propCount: number;
  source: string;
}): Promise<void> {
  try {
    console.log('[Backfill] Triggering Promoter workflow...', params);

    // TODO: Implement actual Temporal workflow client to trigger promoter
    // For now, log the trigger request
    console.log('[Backfill] Promoter workflow trigger requested:', params);
  } catch (error) {
    console.error('[Backfill] Error triggering promoter:', error);
    throw error;
  }
}
