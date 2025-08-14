import { NextRequest, NextResponse } from 'next/server'
import { getCanonicalHealthTiles, convertToLegacyFormat } from '@/server/health'
import { getAdminClient } from '@/server/db'

/**
 * LEGACY ENDPOINT - Use /api/ops/health/tiles instead
 * This adapter provides backward compatibility for existing clients
 * Will be removed on 2025-09-30
 */
export async function GET(request: NextRequest) {
  try {
    // Get canonical health tiles data
    const canonicalData = await getCanonicalHealthTiles();

    // Convert to legacy format for backward compatibility
    const legacyFormat = {
      feedFreshnessSeconds: canonicalData.feedFreshnessSeconds,
      temporalBacklogAgeSeconds: canonicalData.temporalBacklogAgeSeconds,
      canaryLastSeenAt: canonicalData.canaryLastSeenAt,
      failureBurnRateLevel: canonicalData.failureBurnRateLevel,
      providerCreditsPerMin: canonicalData.providerCreditsPerMin,
      percentOfDailyBudget: canonicalData.providerPctDailyBudget, // Note: field name changed
      dlqCount: canonicalData.dlqCount,
      source: canonicalData.source,
      timestamp: canonicalData.timestamp,
      // Add additional legacy fields if needed
      last_updated: canonicalData.timestamp,
      status: canonicalData.source === 'live' ? 'healthy' : 'warning',
    };

    return NextResponse.json(legacyFormat, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
        'X-Deprecation': 'This endpoint is deprecated. Use /api/ops/health/tiles by 2025-09-30.',
        'X-Legacy-Adapter': 'true',
      }
    });
  } catch (error) {
    console.error('Legacy pipeline health API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline health metrics' },
      { status: 500 }
    )
  }
}

function determineHealthStatus(data: any): 'healthy' | 'warning' | 'critical' {
  const writerAudit = Number(data.writer_audit_percentage) || 0;
  const duplicates = Number(data.duplicate_fingerprints) || 0;
  const missingIds = Number(data.missing_prop_ids) || 0;

  // Critical conditions
  if (writerAudit < 70 || duplicates > 50 || missingIds > 100) {
    return 'critical';
  }

  // Warning conditions
  if (writerAudit < 90 || duplicates > 10 || missingIds > 20) {
    return 'warning';
  }

  return 'healthy';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body
    const supabase = getAdminClient()

    // Log conflict skip events from GradingAgent
    if (type === 'conflict_skip') {
      const { raw_prop_id, reason, timestamp } = data
      
      await supabase
        .from('conflict_events')
        .insert({
          event_type: 'conflict_skip',
          raw_prop_id,
          reason,
          occurred_at: timestamp || new Date().toISOString(),
          metadata: data
        })

      return NextResponse.json({ success: true })
    }

    // Log promotion attempts and outcomes
    if (type === 'promotion_attempt') {
      const { raw_prop_id, success, reason, processing_time } = data

      await supabase
        .from('promotion_events')
        .insert({
          raw_prop_id,
          success,
          reason,
          processing_time_ms: processing_time,
          occurred_at: new Date().toISOString(),
          metadata: data
        })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Unknown event type' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Pipeline health logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log pipeline event' },
      { status: 500 }
    )
  }
}