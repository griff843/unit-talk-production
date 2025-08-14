import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, createNotConfiguredResponse, env } from '@/server/env'

export async function GET(request: NextRequest) {
  try {
    // Check if system is properly configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    // Check if GitHub workflow token is available for rehearsal functionality
    if (!env?.GITHUB_WORKFLOW_TOKEN) {
      return NextResponse.json(
        {
          error: 'Rehearsal Service Not Available',
          message: 'GitHub workflow token not configured. Rehearsal functionality requires GITHUB_WORKFLOW_TOKEN environment variable.',
          code: 'GITHUB_TOKEN_MISSING',
          guidance: 'Contact your administrator to configure the GitHub workflow token for rehearsal operations.',
        },
        { status: 501 }
      );
    }

    // In a real implementation, this would fetch from:
    // - GitHub Actions API for workflow status
    // - Database for last run information
    // - Environment variables for active color
    // - Health check endpoints for system status
    
    const status = {
      isRunning: false,
      activeColor: process.env.ACTIVE_COLOR || 'blue',
      currentStep: null,
      progress: 0,
      lastRun: process.env.LAST_REHEARSAL_RUN || null,
      lastResult: process.env.LAST_REHEARSAL_RESULT || null,
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'staging',
      uptime: Date.now() - (process.env.START_TIME ? parseInt(process.env.START_TIME) : Date.now()),
      github_integration: 'configured',
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