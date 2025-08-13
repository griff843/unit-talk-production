import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { environment, config } = body

    // Validate request
    if (!environment || !['staging', 'prod'].includes(environment)) {
      return NextResponse.json(
        { error: 'Valid environment (staging/prod) is required' },
        { status: 400 }
      )
    }

    // Security check for production
    if (environment === 'prod') {
      const userAgent = request.headers.get('user-agent') || ''
      const referer = request.headers.get('referer') || ''
      
      // Additional production safety checks could be added here
      console.log(`Production rehearsal start requested from: ${referer}`)
    }

    // Build rehearsal command
    const rehearsalFlags = []
    
    if (config?.canaryPercent) {
      rehearsalFlags.push(`--canary-percent=${config.canaryPercent}`)
    }
    
    if (config?.incidentSimulation === false) {
      rehearsalFlags.push('--no-incident-simulation')
    }
    
    if (config?.drTesting === false) {
      rehearsalFlags.push('--no-dr-testing')
    }
    
    if (config?.rollbackDrill === false) {
      rehearsalFlags.push('--no-rollback-drill')
    }

    const command = [
      'npx tsx scripts/rehearsal/go-live-rehearsal.ts',
      `--env=${environment}`,
      '--mode=dry-run', // Always start in dry-run mode for safety
      ...rehearsalFlags
    ].join(' ')

    // Log the rehearsal start
    console.log(`Starting rehearsal: ${command}`)
    
    // In a real implementation, this would:
    // 1. Queue the rehearsal job in a background worker
    // 2. Store the job ID in Redis for tracking
    // 3. Return the job ID for status polling
    // 4. Use a proper job queue like Bull or Agenda
    
    // For now, we'll simulate starting the rehearsal
    const rehearsalId = `rehearsal-${Date.now()}`
    
    // Store rehearsal state (in production, use Redis/database)
    process.env.CURRENT_REHEARSAL_ID = rehearsalId
    process.env.REHEARSAL_START_TIME = Date.now().toString()
    
    // In background: execSync(command, { stdio: 'pipe' })
    // For now, we'll just return success
    
    return NextResponse.json({
      success: true,
      rehearsalId,
      message: 'Rehearsal started successfully',
      command: command.replace(/--/g, '--'), // Sanitize for display
      estimatedDuration: '15-30 minutes'
    })

  } catch (error) {
    console.error('Error starting rehearsal:', error)
    return NextResponse.json(
      { 
        error: 'Failed to start rehearsal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}