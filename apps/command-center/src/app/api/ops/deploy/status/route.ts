import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface GuardStatus {
  feedFreshnessSeconds: number
  temporalBacklogAgeSeconds: number
  failureBurnRateLevel: string
  canaryLastSeenAt: string
  overallStatus: 'green' | 'yellow' | 'red'
}

interface DeploymentStatus {
  phase: 'idle' | 'canary10' | 'canary50' | 'full' | 'rolling_back' | 'completed' | 'failed'
  since: string
  guards: GuardStatus
  deploymentId?: string
  targetSha?: string
  triggeredBy?: string
  canaryPercent: number
  duration?: number
  nextPhase?: string
  nextPhaseEta?: string
}

export async function GET(request: NextRequest) {
  try {
    // Get active deployment from database
    const { data: activeDeployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*')
      .in('status', ['canary_10_active', 'canary_50_active', 'green_deployed'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    let deploymentStatus: DeploymentStatus = {
      phase: 'idle',
      since: new Date().toISOString(),
      guards: await getCurrentGuardStatus(),
      canaryPercent: 0
    }

    if (activeDeployment && !deploymentError) {
      // Map database status to phase
      const phaseMapping: Record<string, DeploymentStatus['phase']> = {
        'prechecks_passed': 'idle',
        'green_deployed': 'idle',
        'canary_10_active': 'canary10',
        'canary_50_active': 'canary50',
        'completed': 'full',
        'failed': 'failed',
        'rolling_back': 'rolling_back'
      }

      const phase = phaseMapping[activeDeployment.status] || 'idle'
      
      // Calculate duration since phase started
      let phaseSince = activeDeployment.started_at
      if (activeDeployment.canary_10_started_at && phase === 'canary10') {
        phaseSince = activeDeployment.canary_10_started_at
      } else if (activeDeployment.canary_50_started_at && phase === 'canary50') {
        phaseSince = activeDeployment.canary_50_started_at
      }

      const duration = Math.floor((new Date().getTime() - new Date(phaseSince).getTime()) / 1000)

      // Determine canary percentage
      let canaryPercent = 0
      if (phase === 'canary10') canaryPercent = 10
      else if (phase === 'canary50') canaryPercent = 50
      else if (phase === 'full') canaryPercent = 100

      // Calculate next phase ETA (15 minutes per phase by default)
      let nextPhaseEta: string | undefined
      const PHASE_DURATION_MS = 15 * 60 * 1000 // 15 minutes
      
      if (phase === 'canary10' || phase === 'canary50') {
        const phaseStartTime = new Date(phaseSince).getTime()
        nextPhaseEta = new Date(phaseStartTime + PHASE_DURATION_MS).toISOString()
      }

      deploymentStatus = {
        phase,
        since: phaseSince,
        guards: await getCurrentGuardStatus(),
        deploymentId: activeDeployment.deployment_id,
        targetSha: activeDeployment.target_sha,
        triggeredBy: activeDeployment.triggered_by,
        canaryPercent,
        duration,
        nextPhase: getNextPhase(phase),
        nextPhaseEta
      }
    }

    return NextResponse.json(deploymentStatus)

  } catch (error) {
    console.error('Error fetching deployment status:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch deployment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function getCurrentGuardStatus(): Promise<GuardStatus> {
  try {
    // Fetch health tiles data
    const healthResponse = await fetch('http://api.unit-talk.com/api/ops/health/tiles', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!healthResponse.ok) {
      console.warn('Failed to fetch health tiles, using defaults')
      return getDefaultGuardStatus()
    }

    const healthData = await healthResponse.json()

    // Extract guard metrics
    const feedFreshnessSeconds = healthData.feedFreshnessSeconds || 0
    const temporalBacklogAgeSeconds = healthData.temporalBacklogAgeSeconds || 0
    const failureBurnRateLevel = healthData.failureBurnRateLevel || 'green'
    const canaryLastSeenAt = healthData.canaryLastSeenAt || new Date().toISOString()

    // Determine overall status
    let overallStatus: 'green' | 'yellow' | 'red' = 'green'

    // Check for red conditions (should trigger rollback)
    if (
      feedFreshnessSeconds > 300 ||
      temporalBacklogAgeSeconds > 300 ||
      failureBurnRateLevel === 'red' ||
      (new Date().getTime() - new Date(canaryLastSeenAt).getTime()) > 90000
    ) {
      overallStatus = 'red'
    }
    // Check for yellow conditions (warning)
    else if (
      feedFreshnessSeconds > 240 ||
      temporalBacklogAgeSeconds > 240 ||
      failureBurnRateLevel === 'yellow' ||
      (new Date().getTime() - new Date(canaryLastSeenAt).getTime()) > 60000
    ) {
      overallStatus = 'yellow'
    }

    return {
      feedFreshnessSeconds,
      temporalBacklogAgeSeconds,
      failureBurnRateLevel,
      canaryLastSeenAt,
      overallStatus
    }

  } catch (error) {
    console.error('Error fetching guard status:', error)
    return getDefaultGuardStatus()
  }
}

function getDefaultGuardStatus(): GuardStatus {
  return {
    feedFreshnessSeconds: 0,
    temporalBacklogAgeSeconds: 0,
    failureBurnRateLevel: 'green',
    canaryLastSeenAt: new Date().toISOString(),
    overallStatus: 'green'
  }
}

function getNextPhase(currentPhase: DeploymentStatus['phase']): string | undefined {
  const phaseSequence: Record<string, string> = {
    'idle': 'canary10',
    'canary10': 'canary50', 
    'canary50': 'full',
    'full': 'completed'
  }
  
  return phaseSequence[currentPhase]
}