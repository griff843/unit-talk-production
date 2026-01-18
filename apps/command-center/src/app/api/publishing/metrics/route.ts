/**
 * Publishing Metrics API Endpoint
 * Phase 2: Canonical pick_publish monitoring from Supabase (authoritative source)
 *
 * NO MOCK DATA - all metrics from real pick_publish table in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use Supabase client for canonical publishing data (cloud authoritative source)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PublishingMetrics {
  timestamp: string;
  counts_24h: {
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  oldest_pending: {
    age_minutes: number | null;
    id: string | null;
    pick_id: string | null;
    attempts: number | null;
    max_attempts: number | null;
    last_error: string | null;
    discord_channel_id: string | null;
    updated_at: string | null;
  };
  recent_attempts: Array<{
    id: string;
    pick_id: string;
    channel: string | null;
    status: string;
    attempts: number;
    max_attempts: number;
    external_message_id: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
    discord_channel_id: string | null;
  }>;
  publish_lag_ms: {
    p50: number | null;
    p95: number | null;
    sample_size: number;
  };
  stuck_pending_count: number;
  retry_exhaustion_count: number;
  data_source: 'real' | 'error';
  error_message?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: 'Supabase configuration missing',
          data_source: 'error',
        } as Partial<PublishingMetrics>,
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRangeHours = parseInt(searchParams.get('hours') || '24', 10);
    const stuckThresholdMinutes = parseInt(searchParams.get('stuck_threshold') || '10', 10);

    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();
    const stuckCutoffTime = new Date(
      Date.now() - stuckThresholdMinutes * 60 * 1000
    ).toISOString();

    // Fetch counts by status (last 24h by default)
    const { data: allRows, error: countError } = await supabase
      .from('pick_publish')
      .select('status')
      .gte('created_at', cutoffTime);

    if (countError) {
      console.error('Error fetching pick_publish counts:', countError);
      throw new Error(`Database query failed: ${countError.message}`);
    }

    const counts = {
      pending: allRows?.filter(r => r.status === 'pending').length || 0,
      sent: allRows?.filter(r => r.status === 'sent').length || 0,
      failed: allRows?.filter(r => r.status === 'failed').length || 0,
      cancelled: allRows?.filter(r => r.status === 'cancelled').length || 0,
      total: allRows?.length || 0,
    };

    // Fetch oldest pending row
    const { data: oldestPending, error: oldestError } = await supabase
      .from('pick_publish')
      .select('id, pick_id, attempts, max_attempts, last_error, discord_channel_id, updated_at, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (oldestError) {
      console.error('Error fetching oldest pending:', oldestError);
    }

    const oldestPendingAge = oldestPending
      ? Math.floor((Date.now() - new Date(String(oldestPending.created_at || 0)).getTime()) / (1000 * 60))
      : null;

    // Fetch recent publish attempts (last 50)
    const { data: recentAttempts, error: attemptsError } = await supabase
      .from('pick_publish')
      .select(
        'id, pick_id, status, attempts, max_attempts, external_message_id, last_error, created_at, updated_at, discord_channel_id'
      )
      .order('updated_at', { ascending: false })
      .limit(50);

    if (attemptsError) {
      console.error('Error fetching recent attempts:', attemptsError);
    }

    // Calculate publish lag (p50/p95) for sent rows
    const { data: sentRows, error: sentError } = await supabase
      .from('pick_publish')
      .select('created_at, updated_at')
      .eq('status', 'sent')
      .gte('created_at', cutoffTime)
      .not('updated_at', 'is', null);

    if (sentError) {
      console.error('Error fetching sent rows for lag calculation:', sentError);
    }

    let publishLag = { p50: null, p95: null, sample_size: 0 };
    if (sentRows && sentRows.length > 0) {
      const lagTimes = sentRows
        .map(row => {
          const created = new Date(String(row.created_at || 0)).getTime();
          const updated = new Date(String(row.updated_at || 0)).getTime();
          return updated - created;
        })
        .filter(lag => lag > 0)
        .sort((a, b) => a - b);

      if (lagTimes.length > 0) {
        const p50Index = Math.floor(lagTimes.length * 0.5);
        const p95Index = Math.floor(lagTimes.length * 0.95);
        publishLag = {
          p50: lagTimes[p50Index] || null,
          p95: lagTimes[p95Index] || null,
          sample_size: lagTimes.length,
        };
      }
    }

    // Count stuck pending (pending rows not updated in threshold minutes)
    const { data: stuckRows, error: stuckError } = await supabase
      .from('pick_publish')
      .select('id')
      .eq('status', 'pending')
      .lt('updated_at', stuckCutoffTime);

    if (stuckError) {
      console.error('Error fetching stuck pending count:', stuckError);
    }

    const stuckPendingCount = stuckRows?.length || 0;

    // Count retry exhaustion (attempts >= max_attempts OR failed/cancelled with error)
    const { data: exhaustedRows, error: exhaustedError } = await supabase
      .from('pick_publish')
      .select('id, attempts, max_attempts, status, last_error')
      .or('status.eq.failed,status.eq.cancelled')
      .not('last_error', 'is', null);

    if (exhaustedError) {
      console.error('Error fetching retry exhaustion count:', exhaustedError);
    }

    const retryExhaustionCount =
      exhaustedRows?.filter(
        row =>
          Number(row.attempts || 0) >= Number(row.max_attempts || 3) ||
          (row.status === 'failed' && row.last_error)
      ).length || 0;

    const metrics: PublishingMetrics = {
      timestamp: new Date().toISOString(),
      counts_24h: counts,
      oldest_pending: {
        age_minutes: oldestPendingAge,
        id: oldestPending?.id ? String(oldestPending.id) : null,
        pick_id: oldestPending?.pick_id ? String(oldestPending.pick_id) : null,
        attempts: oldestPending?.attempts ? Number(oldestPending.attempts) : null,
        max_attempts: oldestPending?.max_attempts ? Number(oldestPending.max_attempts) : null,
        last_error: oldestPending?.last_error ? String(oldestPending.last_error) : null,
        discord_channel_id: oldestPending?.discord_channel_id
          ? String(oldestPending.discord_channel_id)
          : null,
        updated_at: oldestPending?.updated_at ? String(oldestPending.updated_at) : null,
      },
      recent_attempts: (recentAttempts || []).map(row => ({
        id: String(row.id || ''),
        pick_id: String(row.pick_id || ''),
        channel: row.discord_channel_id ? String(row.discord_channel_id) : null,
        status: String(row.status || 'unknown'),
        attempts: Number(row.attempts || 0),
        max_attempts: Number(row.max_attempts || 3),
        external_message_id: row.external_message_id ? String(row.external_message_id) : null,
        last_error: row.last_error ? String(row.last_error) : null,
        created_at: String(row.created_at || ''),
        updated_at: String(row.updated_at || ''),
        discord_channel_id: row.discord_channel_id ? String(row.discord_channel_id) : null,
      })),
      publish_lag_ms: publishLag,
      stuck_pending_count: stuckPendingCount,
      retry_exhaustion_count: retryExhaustionCount,
      data_source: 'real',
    };

    const responseTime = Date.now() - startTime;

    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
        'X-Data-Source': 'supabase-pick_publish',
      },
    });
  } catch (error) {
    console.error('Publishing metrics API error:', error);

    const errorResponse: Partial<PublishingMetrics> = {
      timestamp: new Date().toISOString(),
      data_source: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error fetching publishing metrics',
      counts_24h: {
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      stuck_pending_count: 0,
      retry_exhaustion_count: 0,
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Error': 'true',
      },
    });
  }
}
