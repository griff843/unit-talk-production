/**
 * @fileoverview Pipeline Lag (24h) API - Read-only endpoint
 * Fetches lag metrics from the Postgres materialized view mv_pipeline_lag_24h
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOperatorIdentity } from '@/lib/auth';
import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';

export type LagRow = {
  minute_bucket: string; // ISO datetime string
  sport: string | null;
  promoted_ct: number;
  promotion_lag_avg: string; // PostgreSQL interval as string
  promotion_lag_p50: string; // PostgreSQL interval as string
  promotion_lag_p95: string; // PostgreSQL interval as string
  promotion_lag_avg_seconds: number; // Converted to seconds
  promotion_lag_p50_seconds: number; // Converted to seconds
  promotion_lag_p95_seconds: number; // Converted to seconds
};

/**
 * GET /api/pipeline/lag
 * Read-only endpoint to fetch pipeline lag metrics from materialized view
 * Accessible by anon client, uses service-role internally for database access
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Get user context for audit logging (optional for read endpoint)
    const { userId } = getOperatorIdentity(request);

    // Check permissions for pipeline metrics (relaxed for read-only)
    await RBACService.requirePermission(userId, Permission.VIEW_METRICS, {
      endpoint: '/api/pipeline/lag',
      method: 'GET',
    });

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '600'), 1000);
    const sport = request.nextUrl.searchParams.get('sport');

    console.log('🔍 Fetching pipeline lag metrics from mv_pipeline_lag_24h...');

    // Note: mv_pipeline_lag_24h materialized view may not exist in production.
    // This is an optional feature that requires the MV to be created via migration.
    // If the MV doesn't exist, return empty array with feature_note.
    let data: Array<{
      minute_bucket: string;
      sport: string | null;
      promoted_ct: number;
      promotion_lag_avg: string;
      promotion_lag_p50: string;
      promotion_lag_p95: string;
    }> | null = null;
    let error: { message: string } | null = null;

    try {
      // Build query for materialized view
      // MV may not exist - use dynamic query to avoid type system issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      let result;

      if (sport && sport !== 'all') {
        result = await client
          .from('mv_pipeline_lag_24h')
          .select(
            'minute_bucket, sport, promoted_ct, promotion_lag_avg, promotion_lag_p50, promotion_lag_p95'
          )
          .eq('sport', sport)
          .order('minute_bucket', { ascending: false })
          .limit(limit);
      } else {
        result = await client
          .from('mv_pipeline_lag_24h')
          .select(
            'minute_bucket, sport, promoted_ct, promotion_lag_avg, promotion_lag_p50, promotion_lag_p95'
          )
          .order('minute_bucket', { ascending: false })
          .limit(limit);
      }
      data = result.data as typeof data;
      error = result.error;
    } catch (queryError) {
      // If the MV doesn't exist, this will throw
      console.warn('⚠️ mv_pipeline_lag_24h MV not available:', queryError);
      error = { message: 'Materialized view not provisioned' };
    }

    if (error) {
      // For MV not existing, return empty array instead of failing
      if (error.message.includes('does not exist') || error.message.includes('not provisioned')) {
        console.log('📊 mv_pipeline_lag_24h not provisioned, returning empty data');
        return NextResponse.json([], {
          status: 200,
          headers: {
            'X-Feature-Note': 'mv_pipeline_lag_24h not provisioned',
            'X-Data-Points': '0',
          },
        });
      }
      console.error('❌ Error fetching pipeline lag metrics:', error);
      throw new Error(`Failed to fetch pipeline lag metrics: ${error.message}`);
    }

    console.log(`✅ Successfully fetched ${data?.length || 0} pipeline lag data points`);

    // Convert PostgreSQL intervals to seconds alongside raw strings
    const enrichedData: LagRow[] = (data || []).map(row => ({
      minute_bucket: String(row.minute_bucket || ''),
      sport: row.sport as string | null,
      promoted_ct: Number(row.promoted_ct) || 0,
      promotion_lag_avg: String(row.promotion_lag_avg || '00:00:00'),
      promotion_lag_p50: String(row.promotion_lag_p50 || '00:00:00'),
      promotion_lag_p95: String(row.promotion_lag_p95 || '00:00:00'),
      promotion_lag_avg_seconds: parsePostgreSQLInterval(String(row.promotion_lag_avg)),
      promotion_lag_p50_seconds: parsePostgreSQLInterval(String(row.promotion_lag_p50)),
      promotion_lag_p95_seconds: parsePostgreSQLInterval(String(row.promotion_lag_p95)),
    }));

    const responseTime = Date.now() - startTime;

    // Log metrics access (audit trail)
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'VIEW_PIPELINE_LAG',
      resource_type: 'metrics',
      resource_id: 'pipeline_lag_24h',
      payload: {
        sport: sport || 'all',
        limit,
        data_points: enrichedData.length,
      },
      status: 'success',
      duration_ms: responseTime,
    });

    return NextResponse.json(enrichedData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60', // 30s cache for read-only data
        'X-Response-Time': `${responseTime}ms`,
        'X-Data-Points': enrichedData.length.toString(),
        'X-Sport-Filter': sport || 'all',
      },
    });
  } catch (error) {
    console.error('Pipeline lag metrics failed:', error);

    const responseTime = Date.now() - startTime;
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Pipeline lag metrics failed',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Parse PostgreSQL interval string to seconds
 * Examples:
 * - "00:02:30" -> 150 seconds
 * - "00:00:45.123" -> 45.123 seconds
 * - "01:15:30" -> 4530 seconds
 */
function parsePostgreSQLInterval(interval: string | null): number {
  if (!interval || typeof interval !== 'string') {
    return 0;
  }

  try {
    // Handle formats like "00:02:30" or "00:02:30.123"
    const parts = interval.split(':');
    if (parts.length >= 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;

      return hours * 3600 + minutes * 60 + seconds;
    }

    // Handle direct seconds format
    const numericValue = parseFloat(interval);
    if (!isNaN(numericValue)) {
      return numericValue;
    }

    return 0;
  } catch (error) {
    console.warn('Failed to parse interval:', interval, error);
    return 0;
  }
}
