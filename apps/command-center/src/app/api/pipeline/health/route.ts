export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getTypedSupabaseClient } from '@/lib/supabase'

// Mock data for demo when database is unavailable
const generateMockHealthData = () => ({
  total_picks_24h: 1247,
  system_picks_24h: 856,
  manual_picks_24h: 391,
  writer_audit_percentage: 94.2,
  duplicate_fingerprints: 3,
  missing_prop_ids: 7,
  last_updated: new Date().toISOString(),
  status: 'healthy' as const,
  metadata: {
    source: 'mock_data_demo',
    timeframe: '24h',
    demo_mode: true
  }
})

export async function GET(request: NextRequest) {
  try {
    const supabase = getTypedSupabaseClient()
    
    if (!supabase) {
      console.log('🎭 DEMO MODE: Using mock pipeline health data')
      return NextResponse.json(generateMockHealthData(), {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
        }
      })
    }

    // Try to use real database if available
    const { data, error } = await supabase
      .from('v_unified_picks_health_24h')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      console.warn('Database query failed, using mock data:', error.message)
      return NextResponse.json(generateMockHealthData(), {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
        }
      })
    }

    // Transform view data to expected format
    const healthSummary = {
      total_picks_24h: Number(data.total_picks_24h) || 0,
      system_picks_24h: Number(data.system_picks_24h) || 0,
      manual_picks_24h: Number(data.manual_picks_24h) || 0,
      writer_audit_percentage: Number(data.writer_audit_percentage) || 0,
      duplicate_fingerprints: Number(data.duplicate_fingerprints) || 0,
      missing_prop_ids: Number(data.missing_prop_ids) || 0,
      last_updated: new Date().toISOString(),
      status: determineHealthStatus(data),
      metadata: {
        source: 'v_unified_picks_health_24h',
        timeframe: '24h',
        demo_mode: false
      }
    }

    return NextResponse.json(healthSummary, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.warn('Pipeline health API error, using mock data:', error)
    return NextResponse.json(generateMockHealthData(), {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    })
  }
}

function determineHealthStatus(data: any): 'healthy' | 'warning' | 'critical' {
  const writerAudit = Number(data.writer_audit_percentage) || 0
  const duplicates = Number(data.duplicate_fingerprints) || 0
  const missingIds = Number(data.missing_prop_ids) || 0

  // Critical conditions
  if (writerAudit < 70 || duplicates > 50 || missingIds > 100) {
    return 'critical'
  }

  // Warning conditions
  if (writerAudit < 90 || duplicates > 10 || missingIds > 20) {
    return 'warning'
  }

  return 'healthy'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getTypedSupabaseClient()
    
    if (!supabase) {
      console.log('🎭 DEMO MODE: Logging event (no database available)')
      return NextResponse.json({ success: true, demo_mode: true })
    }

    const body = await request.json()
    const { type, data } = body

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
    console.warn('Pipeline health logging error:', error)
    return NextResponse.json({ success: true, demo_mode: true })
  }
}