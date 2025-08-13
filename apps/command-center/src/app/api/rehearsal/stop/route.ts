import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    const currentRehearsalId = process.env.CURRENT_REHEARSAL_ID

    if (!currentRehearsalId) {
      return NextResponse.json(
        { error: 'No active rehearsal found' },
        { status: 404 }
      )
    }

    console.log(`Stopping rehearsal: ${currentRehearsalId}`)

    // In a real implementation, this would:
    // 1. Find the running rehearsal process by ID
    // 2. Send a graceful shutdown signal
    // 3. Wait for cleanup to complete
    // 4. Force kill if necessary after timeout
    // 5. Clean up any temporary resources

    try {
      // Try to find and kill any running rehearsal processes
      const killCommand = `pkill -f "go-live-rehearsal.ts" || true`
      execSync(killCommand, { stdio: 'pipe', timeout: 5000 })
      
      console.log('Rehearsal process terminated')
    } catch (error) {
      console.warn('No rehearsal process found or failed to terminate:', error)
    }

    // Clean up environment variables
    delete process.env.CURRENT_REHEARSAL_ID
    delete process.env.REHEARSAL_START_TIME

    // In production, also clean up:
    // - Redis keys for rehearsal state
    // - Any temporary Docker containers
    // - Temporary databases or snapshots
    // - Background jobs or workers

    return NextResponse.json({
      success: true,
      message: 'Rehearsal stopped successfully',
      rehearsalId: currentRehearsalId,
      stoppedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error stopping rehearsal:', error)
    return NextResponse.json(
      { 
        error: 'Failed to stop rehearsal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}