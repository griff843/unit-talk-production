import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, this would:
    // 1. Query database for rehearsal execution history
    // 2. Include report metadata and file locations
    // 3. Support filtering by date range, environment, result
    // 4. Include artifact URLs (screenshots, logs, metrics)

    // Mock reports for demonstration
    const mockReports = [
      {
        id: 'rehearsal-2025-01-15-001',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
        environment: 'staging',
        result: 'passed',
        duration: 1847000, // ~30 minutes
        steps: 12,
        issues: 0,
        reportUrl: '/reports/rehearsal-2025-01-15-001.html',
        artifacts: {
          screenshots: 8,
          logs: '/logs/rehearsal-2025-01-15-001.log',
          metrics: '/metrics/rehearsal-2025-01-15-001.json'
        }
      },
      {
        id: 'rehearsal-2025-01-14-003',
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 48 hours ago
        environment: 'prod',
        result: 'failed',
        duration: 892000, // ~15 minutes (failed early)
        steps: 5,
        issues: 2,
        reportUrl: '/reports/rehearsal-2025-01-14-003.html',
        artifacts: {
          screenshots: 3,
          logs: '/logs/rehearsal-2025-01-14-003.log',
          metrics: '/metrics/rehearsal-2025-01-14-003.json'
        },
        failureReason: 'Health check failures in green environment'
      },
      {
        id: 'rehearsal-2025-01-14-002',
        timestamp: new Date(Date.now() - 259200000).toISOString(), // 72 hours ago
        environment: 'staging',
        result: 'passed',
        duration: 2156000, // ~36 minutes
        steps: 12,
        issues: 1,
        reportUrl: '/reports/rehearsal-2025-01-14-002.html',
        artifacts: {
          screenshots: 10,
          logs: '/logs/rehearsal-2025-01-14-002.log',
          metrics: '/metrics/rehearsal-2025-01-14-002.json'
        }
      },
      {
        id: 'rehearsal-2025-01-13-001',
        timestamp: new Date(Date.now() - 345600000).toISOString(), // 96 hours ago
        environment: 'staging',
        result: 'passed',
        duration: 1923000, // ~32 minutes
        steps: 12,
        issues: 0,
        reportUrl: '/reports/rehearsal-2025-01-13-001.html',
        artifacts: {
          screenshots: 9,
          logs: '/logs/rehearsal-2025-01-13-001.log',
          metrics: '/metrics/rehearsal-2025-01-13-001.json'
        }
      }
    ]

    // Filter by environment if provided
    const environment = request.nextUrl.searchParams.get('environment')
    const result = request.nextUrl.searchParams.get('result')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')

    let filteredReports = mockReports

    if (environment) {
      filteredReports = filteredReports.filter(report => report.environment === environment)
    }

    if (result) {
      filteredReports = filteredReports.filter(report => report.result === result)
    }

    // Sort by timestamp (newest first) and limit
    filteredReports = filteredReports
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    // Calculate summary statistics
    const totalRuns = mockReports.length
    const passedRuns = mockReports.filter(r => r.result === 'passed').length
    const failedRuns = mockReports.filter(r => r.result === 'failed').length
    const successRate = totalRuns > 0 ? (passedRuns / totalRuns * 100).toFixed(1) : '0'
    const avgDuration = totalRuns > 0 ? 
      Math.round(mockReports.reduce((sum, r) => sum + r.duration, 0) / totalRuns / 1000) : 0

    return NextResponse.json({
      success: true,
      reports: filteredReports,
      summary: {
        totalRuns,
        passedRuns,
        failedRuns,
        successRate: parseFloat(successRate),
        avgDurationSeconds: avgDuration
      },
      filters: {
        environment,
        result,
        limit
      }
    })

  } catch (error) {
    console.error('Error fetching rehearsal reports:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch rehearsal reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}