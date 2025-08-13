import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, this would fetch from:
    // - Redis cache for current rehearsal state
    // - Database for last run information
    // - Environment variables for active color
    // - Health check endpoints for system status
    
    // Mock implementation for now
    const status = {
      isRunning: false,
      activeColor: process.env.ACTIVE_COLOR || 'blue',
      currentStep: null,
      progress: 0,
      lastRun: process.env.LAST_REHEARSAL_RUN || null,
      lastResult: process.env.LAST_REHEARSAL_RESULT || null,
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'staging',
      uptime: Date.now() - (process.env.START_TIME ? parseInt(process.env.START_TIME) : Date.now())
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching rehearsal status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rehearsal status' },
      { status: 500 }
    )
  }
}