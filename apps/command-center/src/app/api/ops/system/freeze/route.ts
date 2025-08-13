import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface FreezeRequest {
  action: 'activate' | 'deactivate'
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const body: FreezeRequest = await request.json()
    const { action, reason } = body

    if (!action || !['activate', 'deactivate'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "activate" or "deactivate"' },
        { status: 400 }
      )
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reason is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const isActivating = action === 'activate'
    const timestamp = new Date().toISOString()
    
    // Update system configuration
    const configUpdates = [
      {
        config_key: 'SYSTEM_FREEZE',
        config_value: isActivating.toString(),
        updated_at: timestamp,
        updated_by: 'command-center-killswitch'
      }
    ]

    if (isActivating) {
      // When activating, also set other safety flags
      configUpdates.push(
        {
          config_key: 'SAFE_MODE',
          config_value: 'true',
          updated_at: timestamp,
          updated_by: 'command-center-killswitch'
        },
        {
          config_key: 'SHADOW_MODE', 
          config_value: 'true',
          updated_at: timestamp,
          updated_by: 'command-center-killswitch'
        },
        {
          config_key: 'PUBLISH_TO_DISCORD',
          config_value: 'false',
          updated_at: timestamp,
          updated_by: 'command-center-killswitch'
        },
        {
          config_key: 'AUTO_SETTLEMENT',
          config_value: 'false',
          updated_at: timestamp,
          updated_by: 'command-center-killswitch'
        }
      )
    }

    // Apply all configuration updates
    for (const config of configUpdates) {
      const { error: configError } = await supabase
        .from('app_system_config')
        .upsert(config)

      if (configError) {
        console.error(`Failed to update config ${config.config_key}:`, configError)
        return NextResponse.json(
          { error: `Failed to update system configuration: ${config.config_key}` },
          { status: 500 }
        )
      }
    }

    // Create audit log entry
    const { error: auditError } = await supabase
      .from('system_audit_log')
      .insert({
        action: `kill_switch_${action}`,
        resource: 'system_freeze',
        details: {
          reason: reason.trim(),
          timestamp: timestamp,
          config_changes: configUpdates.map(c => ({ key: c.config_key, value: c.config_value }))
        },
        severity: isActivating ? 'critical' : 'info',
        source: 'command-center',
        created_at: timestamp
      })

    if (auditError) {
      console.error('Failed to create audit log:', auditError)
      // Don't fail the request for audit logging issues
    }

    // Create system event record
    const { error: eventError } = await supabase
      .from('system_events')
      .insert({
        event_type: isActivating ? 'kill_switch_activated' : 'kill_switch_deactivated',
        event_data: {
          reason: reason.trim(),
          action: action,
          configs_updated: configUpdates.map(c => c.config_key),
          triggered_from: 'command-center'
        },
        severity: isActivating ? 'critical' : 'info',
        created_at: timestamp
      })

    if (eventError) {
      console.error('Failed to create system event:', eventError)
    }

    // Send alert to monitoring systems
    try {
      if (process.env.ALERTMANAGER_URL) {
        await fetch(`${process.env.ALERTMANAGER_URL}/api/v1/alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            labels: {
              alertname: isActivating ? 'KillSwitchActivated' : 'KillSwitchDeactivated',
              severity: isActivating ? 'critical' : 'warning',
              source: 'command-center'
            },
            annotations: {
              summary: `Kill switch ${action}d from Command Center`,
              description: `System freeze has been ${action}d. Reason: ${reason.trim()}`,
              runbook_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/blob/main/docs/ops/RUNBOOK.md#kill-switch`
            }
          }])
        })
      }
    } catch (alertError) {
      console.error('Failed to send alert:', alertError)
    }

    // Send notifications
    try {
      const notificationMessage = isActivating 
        ? `🚨 **KILL SWITCH ACTIVATED**\n\nReason: ${reason.trim()}\nAll deployments and critical operations are now blocked.`
        : `✅ **KILL SWITCH DEACTIVATED**\n\nReason: ${reason.trim()}\nNormal operations can now resume.`

      const notifications = []

      // Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        notifications.push(
          fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: notificationMessage,
              channel: isActivating ? '#ops-critical' : '#ops-alerts'
            })
          })
        )
      }

      // Discord notification
      if (process.env.DISCORD_WEBHOOK_URL) {
        notifications.push(
          fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: notificationMessage
            })
          })
        )
      }

      await Promise.allSettled(notifications)

    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError)
    }

    return NextResponse.json({
      success: true,
      action: action,
      systemFreeze: isActivating,
      timestamp: timestamp,
      reason: reason.trim(),
      configsUpdated: configUpdates.map(c => c.config_key),
      auditLogged: !auditError,
      message: `Kill switch ${action}d successfully`
    })

  } catch (error) {
    console.error('Error processing kill switch request:', error)
    return NextResponse.json(
      {
        error: 'Failed to process kill switch request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}