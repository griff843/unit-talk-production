import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface SystemFreezeStatus {
  active: boolean
  activatedAt: string | null
  activatedBy: string | null
  reason: string | null
  lastChecked: string
}

export async function GET(request: NextRequest) {
  try {
    // Get current SYSTEM_FREEZE configuration
    const { data: freezeConfig, error: configError } = await supabase
      .from('app_system_config')
      .select('config_value, updated_at, updated_by')
      .eq('config_key', 'SYSTEM_FREEZE')
      .single()

    if (configError && configError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Failed to fetch freeze config:', configError)
      return NextResponse.json(
        { error: 'Failed to fetch freeze configuration' },
        { status: 500 }
      )
    }

    const isActive = freezeConfig?.config_value === 'true'
    let activatedAt: string | null = null
    let activatedBy: string | null = null
    let reason: string | null = null

    if (isActive) {
      // Get the most recent kill switch activation event for details
      const { data: activationEvent, error: eventError } = await supabase
        .from('system_events')
        .select('created_at, event_data')
        .eq('event_type', 'kill_switch_activated')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!eventError && activationEvent) {
        activatedAt = activationEvent.created_at
        activatedBy = activationEvent.event_data?.triggered_from || freezeConfig?.updated_by || 'unknown'
        reason = activationEvent.event_data?.reason || null
      } else {
        // Fallback to config metadata if event not found
        activatedAt = freezeConfig?.updated_at || null
        activatedBy = freezeConfig?.updated_by || 'unknown'
      }

      // If we still don't have a reason, try to get it from audit log
      if (!reason) {
        const { data: auditLog, error: auditError } = await supabase
          .from('system_audit_log')
          .select('details')
          .eq('action', 'kill_switch_activate')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!auditError && auditLog?.details?.reason) {
          reason = auditLog.details.reason
        }
      }
    }

    const status: SystemFreezeStatus = {
      active: isActive,
      activatedAt,
      activatedBy,
      reason,
      lastChecked: new Date().toISOString()
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Error fetching freeze status:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch freeze status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}