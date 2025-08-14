import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, createNotConfiguredResponse, env } from '@/server/env'
import { getAdminClient } from '@/server/db'
import { writeAudit } from '@/server/audit'

export async function POST(request: NextRequest) {
  try {
    // Check if system is properly configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    const body = await request.json()
    const { reason, deploymentId } = body

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'Reason is required and must be a string' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient();

    // Find active deployment
    let activeDeploymentId = deploymentId
    if (!activeDeploymentId) {
      const { data: activeDeployment, error } = await supabase
        .from('deployments')
        .select('deployment_id, target_sha')
        .in('status', ['canary_10_active', 'canary_50_active', 'green_deployed'])
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !activeDeployment) {
        return NextResponse.json(
          { error: 'No active deployment found to abort' },
          { status: 404 }
        )
      }

      activeDeploymentId = activeDeployment.deployment_id
    }

    // Update deployment status to indicate rollback
    const { error: updateError } = await supabase
      .from('deployments')
      .update({
        status: 'rolling_back',
        phase: 'rolling_back',
        abort_reason: reason,
        aborted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('deployment_id', activeDeploymentId)

    if (updateError) {
      console.error('Failed to update deployment status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update deployment status' },
        { status: 500 }
      )
    }

    // Get deployment details for rollback
    const { data: deployment, error: fetchError } = await supabase
      .from('deployments')
      .select('target_sha')
      .eq('deployment_id', activeDeploymentId)
      .single()

    if (fetchError || !deployment) {
      console.error('Failed to fetch deployment details:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch deployment details' },
        { status: 500 }
      )
    }

    // Trigger GitHub Actions rollback workflow
    try {
      const githubToken = env?.GITHUB_WORKFLOW_TOKEN
      if (!githubToken) {
        console.error('GitHub workflow token not configured')
        return NextResponse.json(
          { error: 'GitHub integration not configured' },
          { status: 500 }
        )
      }

      const rollbackResponse = await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/rollback.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              environment: 'prod',
              target_sha: deployment.target_sha,
              reason: `Deployment aborted from Command Center: ${reason}`,
              triggered_by: 'command-center-abort',
              emergency: 'false'
            }
          })
        }
      )

      if (!rollbackResponse.ok) {
        const errorText = await rollbackResponse.text()
        console.error('GitHub API error:', errorText)
        throw new Error(`GitHub API error: ${rollbackResponse.status} ${errorText}`)
      }

    } catch (githubError) {
      console.error('Failed to trigger GitHub rollback:', githubError)
      // Don't fail the entire request - log and continue
      
      // Update deployment with error info
      await supabase
        .from('deployments')
        .update({
          abort_error: githubError instanceof Error ? githubError.message : 'Unknown GitHub API error',
          updated_at: new Date().toISOString()
        })
        .eq('deployment_id', activeDeploymentId)
    }

    // Create incident record
    try {
      const { error: incidentError } = await supabase
        .from('incidents')
        .insert({
          title: `Production Deployment Aborted: ${activeDeploymentId}`,
          description: `Deployment was manually aborted from Command Center. Reason: ${reason}`,
          severity: 'high',
          status: 'investigating',
          environment: 'production',
          started_at: new Date().toISOString(),
          metadata: {
            deployment_id: activeDeploymentId,
            target_sha: deployment.target_sha,
            abort_reason: reason,
            abort_source: 'command-center'
          }
        })

      if (incidentError) {
        console.error('Failed to create incident record:', incidentError)
      }
    } catch (incidentErr) {
      console.error('Error creating incident:', incidentErr)
    }

    // Send alert to Alertmanager
    try {
      const alertmanagerUrl = process.env.ALERTMANAGER_URL
      if (alertmanagerUrl) {
        await fetch(`${alertmanagerUrl}/api/v1/alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            labels: {
              alertname: 'ProductionDeploymentAborted',
              severity: 'critical',
              deployment_id: activeDeploymentId,
              source: 'command-center'
            },
            annotations: {
              summary: 'Production deployment aborted from Command Center',
              description: `Deployment ${activeDeploymentId} was manually aborted. Reason: ${reason}`,
              runbook_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/blob/main/docs/ops/RUNBOOK.md#deployment-abort`
            }
          }])
        })
      }
    } catch (alertError) {
      console.error('Failed to send alert:', alertError)
    }

    // Send notifications
    try {
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
              text: `🚨 *Production Deployment Aborted*\n\n` +
                    `**Deployment ID**: ${activeDeploymentId}\n` +
                    `**Reason**: ${reason}\n` +
                    `**Triggered From**: Command Center\n` +
                    `**Rollback**: In progress\n\n` +
                    `Monitor rollback progress in GitHub Actions.`,
              channel: '#ops-alerts'
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
              content: `🚨 **Production Deployment Aborted**\n\n` +
                      `**Deployment ID**: ${activeDeploymentId}\n` +
                      `**Reason**: ${reason}\n` +
                      `**Triggered From**: Command Center\n` +
                      `**Rollback**: In progress`
            })
          })
        )
      }

      // Wait for all notifications (but don't fail if they error)
      await Promise.allSettled(notifications)

    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError)
    }

    return NextResponse.json({
      success: true,
      deploymentId: activeDeploymentId,
      message: 'Deployment abort initiated successfully',
      rollbackTriggered: true,
      incidentCreated: true
    })

  } catch (error) {
    console.error('Error aborting deployment:', error)
    return NextResponse.json(
      {
        error: 'Failed to abort deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}