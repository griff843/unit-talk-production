/**
 * Data Source Clients - Phase 3
 *
 * Handles connections to:
 * - Local Postgres (raw_props) at postgres:5432/unit_talk_dev
 * - Supabase Cloud (picks, pick_publish) at cqfnsozknjzvyiziwicl.supabase.co
 *
 * NO MOCK DATA - fail gracefully with UNKNOWN status if data unavailable.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient } from 'pg';
import type { IngestionMetrics, PublishingMetrics, GradingMetrics } from './types';

// =============================================================================
// Local Postgres Client (for raw_props)
// =============================================================================

let localPgPool: Pool | null = null;

function getLocalPgPool(): Pool | null {
  if (localPgPool) return localPgPool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[SLO] DATABASE_URL not configured - local postgres metrics unavailable');
    return null;
  }

  try {
    localPgPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    console.log('[SLO] Local Postgres pool initialized');
    return localPgPool;
  } catch (error) {
    console.error('[SLO] Failed to initialize local Postgres pool:', error);
    return null;
  }
}

export async function getIngestionMetrics(): Promise<IngestionMetrics> {
  const pool = getLocalPgPool();

  if (!pool) {
    return {
      last_ingestion_at: null,
      minutes_since_last: null,
      count_last_15m: 0,
      count_last_2h: 0,
      rate_trend_percentage: 0,
      data_source: 'local_postgres',
    };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    // Get last ingestion timestamp
    const lastIngestionQuery = `
      SELECT created_at
      FROM raw_props
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const lastResult = await client.query(lastIngestionQuery);
    const lastIngestion = lastResult.rows[0]?.created_at || null;

    let minutesSinceLast: number | null = null;
    if (lastIngestion) {
      minutesSinceLast = Math.floor(
        (Date.now() - new Date(lastIngestion).getTime()) / (1000 * 60)
      );
    }

    // Get count for last 15 minutes
    const count15mQuery = `
      SELECT COUNT(*) as count
      FROM raw_props
      WHERE created_at > NOW() - INTERVAL '15 minutes'
    `;

    const count15mResult = await client.query(count15mQuery);
    const countLast15m = parseInt(count15mResult.rows[0]?.count || '0', 10);

    // Get count for last 2 hours
    const count2hQuery = `
      SELECT COUNT(*) as count
      FROM raw_props
      WHERE created_at > NOW() - INTERVAL '2 hours'
    `;

    const count2hResult = await client.query(count2hQuery);
    const countLast2h = parseInt(count2hResult.rows[0]?.count || '0', 10);

    // Calculate rate trend (15m rate vs 2h average rate)
    const rate15m = countLast15m / 15; // per minute
    const rate2h = countLast2h / 120; // per minute

    let rateTrendPercentage = 0;
    if (rate2h > 0) {
      rateTrendPercentage = ((rate15m - rate2h) / rate2h) * 100;
    }

    return {
      last_ingestion_at: lastIngestion,
      minutes_since_last: minutesSinceLast,
      count_last_15m: countLast15m,
      count_last_2h: countLast2h,
      rate_trend_percentage: rateTrendPercentage,
      data_source: 'local_postgres',
    };
  } catch (error) {
    console.error('[SLO] Failed to query ingestion metrics from local Postgres:', error);
    return {
      last_ingestion_at: null,
      minutes_since_last: null,
      count_last_15m: 0,
      count_last_2h: 0,
      rate_trend_percentage: 0,
      data_source: 'local_postgres',
    };
  } finally {
    if (client) client.release();
  }
}

// =============================================================================
// Supabase Client (for picks, pick_publish)
// =============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[SLO] Supabase credentials not configured - supabase metrics unavailable');
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseKey);
}

export async function getPublishingMetrics(): Promise<PublishingMetrics> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      p50_seconds: null,
      p95_seconds: null,
      p99_seconds: null,
      failed_count_24h: 0,
      stuck_pending_count: 0,
      retry_exhaustion_count: 0,
      sample_size: 0,
      data_source: 'supabase',
    };
  }

  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Get sent picks for lag calculation
    const { data: sentRows, error: sentError } = await supabase
      .from('pick_publish')
      .select('created_at, updated_at')
      .eq('status', 'sent')
      .gte('created_at', cutoff24h)
      .not('updated_at', 'is', null);

    if (sentError) {
      console.error('[SLO] Failed to query pick_publish for lag metrics:', sentError);
    }

    // Calculate percentiles
    let p50: number | null = null;
    let p95: number | null = null;
    let p99: number | null = null;
    let sampleSize = 0;

    if (sentRows && sentRows.length > 0) {
      const lagTimes = sentRows
        .map(row => {
          const created = new Date(row.created_at).getTime();
          const updated = new Date(row.updated_at!).getTime();
          return (updated - created) / 1000; // convert to seconds
        })
        .filter(lag => lag > 0)
        .sort((a, b) => a - b);

      sampleSize = lagTimes.length;

      if (sampleSize > 0) {
        p50 = lagTimes[Math.floor(sampleSize * 0.5)] || null;
        p95 = lagTimes[Math.floor(sampleSize * 0.95)] || null;
        p99 = lagTimes[Math.floor(sampleSize * 0.99)] || null;
      }
    }

    // Get failed count
    const { data: failedRows, error: failedError } = await supabase
      .from('pick_publish')
      .select('id')
      .eq('status', 'failed')
      .gte('created_at', cutoff24h);

    const failedCount = failedRows?.length || 0;

    // Get stuck pending count
    const { data: stuckRows, error: stuckError } = await supabase
      .from('pick_publish')
      .select('id')
      .eq('status', 'pending')
      .lt('updated_at', stuckCutoff);

    const stuckCount = stuckRows?.length || 0;

    // Get retry exhaustion count
    const { data: exhaustedRows, error: exhaustedError } = await supabase
      .from('pick_publish')
      .select('id, attempts, max_attempts')
      .or('status.eq.failed,status.eq.cancelled')
      .gte('created_at', cutoff24h);

    const retryExhaustion =
      exhaustedRows?.filter(row => row.attempts >= row.max_attempts).length || 0;

    return {
      p50_seconds: p50,
      p95_seconds: p95,
      p99_seconds: p99,
      failed_count_24h: failedCount,
      stuck_pending_count: stuckCount,
      retry_exhaustion_count: retryExhaustion,
      sample_size: sampleSize,
      data_source: 'supabase',
    };
  } catch (error) {
    console.error('[SLO] Failed to query publishing metrics from Supabase:', error);
    return {
      p50_seconds: null,
      p95_seconds: null,
      p99_seconds: null,
      failed_count_24h: 0,
      stuck_pending_count: 0,
      retry_exhaustion_count: 0,
      sample_size: 0,
      data_source: 'supabase',
    };
  }
}

export async function getGradingMetrics(): Promise<GradingMetrics> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      pending_review_count: 0,
      oldest_pending_minutes: null,
      data_source: 'supabase',
    };
  }

  try {
    // Get pending review count (using picks table with workflow_stage)
    const { data: pendingRows, error: pendingError } = await supabase
      .from('picks')
      .select('id, created_at')
      .eq('workflow_stage', 'pending_review')
      .order('created_at', { ascending: true });

    if (pendingError) {
      console.warn('[SLO] Failed to query pending review picks:', pendingError);
      return {
        pending_review_count: 0,
        oldest_pending_minutes: null,
        data_source: 'supabase',
      };
    }

    const pendingCount = pendingRows?.length || 0;

    let oldestMinutes: number | null = null;
    if (pendingRows && pendingRows.length > 0) {
      const oldestCreated = new Date(pendingRows[0].created_at).getTime();
      oldestMinutes = Math.floor((Date.now() - oldestCreated) / (1000 * 60));
    }

    return {
      pending_review_count: pendingCount,
      oldest_pending_minutes: oldestMinutes,
      data_source: 'supabase',
    };
  } catch (error) {
    console.error('[SLO] Failed to query grading metrics from Supabase:', error);
    return {
      pending_review_count: 0,
      oldest_pending_minutes: null,
      data_source: 'supabase',
    };
  }
}

// =============================================================================
// Cleanup
// =============================================================================

export async function closeConnections() {
  if (localPgPool) {
    await localPgPool.end();
    localPgPool = null;
    console.log('[SLO] Local Postgres pool closed');
  }
}
