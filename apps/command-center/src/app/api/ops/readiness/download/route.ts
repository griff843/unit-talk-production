import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Enhanced PDF-style HTML generator for readiness snapshot
function generatePDFHTML(snapshot: any): string {
  const ready = snapshot.overallReady ? '✅ **READY FOR LAUNCH**' : '❌ **NOT READY FOR LAUNCH**'
  const scoreColor = snapshot.overallReady ? '#22c55e' : snapshot.readinessScore >= 70 ? '#f59e0b' : '#ef4444'
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Executive Readiness Snapshot</title>
    <style>
        @page {
            size: A4;
            margin: 1in;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #e2e8f0;
            padding-bottom: 20px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 18px;
            margin: 10px 0;
        }
        
        .ready {
            background-color: #dcfce7;
            color: #166534;
            border: 2px solid #22c55e;
        }
        
        .not-ready {
            background-color: #fef2f2;
            color: #991b1b;
            border: 2px solid #ef4444;
        }
        
        .score {
            font-size: 24px;
            font-weight: bold;
            color: ${scoreColor};
        }
        
        .section {
            margin: 25px 0;
            padding: 15px;
            border-left: 4px solid #e2e8f0;
            background-color: #f8fafc;
        }
        
        .section h2 {
            margin-top: 0;
            color: #1e293b;
            font-size: 20px;
        }
        
        .section h3 {
            color: #475569;
            font-size: 16px;
            margin: 15px 0 8px 0;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }
        
        .metric {
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            background-color: white;
        }
        
        .metric-title {
            font-weight: 600;
            color: #374151;
            margin-bottom: 4px;
        }
        
        .metric-value {
            font-size: 14px;
            color: #6b7280;
        }
        
        .status-green { color: #22c55e; }
        .status-yellow { color: #f59e0b; }
        .status-red { color: #ef4444; }
        
        .requirements-alert {
            background-color: #fef2f2;
            border: 2px solid #ef4444;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        
        .requirements-alert h3 {
            color: #991b1b;
            margin-top: 0;
        }
        
        .requirements-list {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .requirements-list li {
            color: #b91c1c;
            margin: 5px 0;
        }
        
        .gate-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin: 10px 0;
        }
        
        .gate-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 4px;
            background-color: white;
            border: 1px solid #e2e8f0;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
        
        @media print {
            body { margin: 0; padding: 20px; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Executive Readiness Snapshot</h1>
        <p><strong>Generated:</strong> ${new Date(snapshot.timestamp).toLocaleString()}</p>
        <div class="status-badge ${snapshot.overallReady ? 'ready' : 'not-ready'}">
            ${ready.replace('**', '').replace('**', '')}
        </div>
        <div class="score">Readiness Score: ${snapshot.readinessScore}/100</div>
    </div>

    ${snapshot.deploymentReadiness.missingRequirements.length > 0 ? `
    <div class="requirements-alert">
        <h3>⚠️ Missing Requirements (${snapshot.deploymentReadiness.missingRequirements.length})</h3>
        <ul class="requirements-list">
            ${snapshot.deploymentReadiness.missingRequirements.map(req => `<li>${req}</li>`).join('')}
        </ul>
    </div>
    ` : '<div class="section" style="background-color: #dcfce7;"><h3 style="color: #166534;">✅ All Requirements Met</h3></div>'}

    <div class="section">
        <h2>📋 Readiness Checklist</h2>
        
        <h3>1️⃣ Rehearsal Status</h3>
        <div class="grid">
            <div class="metric">
                <div class="metric-title">Last Rehearsal</div>
                <div class="metric-value">${snapshot.rehearsal.lastExecutedAt ? new Date(snapshot.rehearsal.lastExecutedAt).toLocaleString() : 'Never'}</div>
            </div>
            <div class="metric">
                <div class="metric-title">Days Since</div>
                <div class="metric-value">${snapshot.rehearsal.daysSinceRehearsal || 'N/A'} days</div>
            </div>
            <div class="metric">
                <div class="metric-title">Status</div>
                <div class="metric-value status-${snapshot.rehearsal.status === 'passed' ? 'green' : 'red'}">
                    ${snapshot.rehearsal.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Freshness</div>
                <div class="metric-value status-${!snapshot.rehearsal.isStale ? 'green' : 'red'}">
                    ${!snapshot.rehearsal.isStale ? '✅ Fresh (≤7 days)' : '❌ Stale (>7 days)'}
                </div>
            </div>
        </div>
        ${snapshot.rehearsal.details ? `
        <div class="grid">
            <div class="metric">
                <div class="metric-title">Test Results</div>
                <div class="metric-value">${snapshot.rehearsal.details.testsPassed}/${snapshot.rehearsal.details.testsTotal} passed</div>
            </div>
            <div class="metric">
                <div class="metric-title">Duration</div>
                <div class="metric-value">${Math.round(snapshot.rehearsal.details.duration / 60)} minutes</div>
            </div>
        </div>
        ` : ''}
        
        <h3>2️⃣ Testing Status</h3>
        <div class="grid">
            <div class="metric">
                <div class="metric-title">E2E Tests</div>
                <div class="metric-value status-${snapshot.testing.e2e.status === 'passed' ? 'green' : 'red'}">
                    ${snapshot.testing.e2e.status === 'passed' ? '✅ PASSED' : '❌ FAILED'} (${snapshot.testing.e2e.passRate}%)
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Infrastructure</div>
                <div class="metric-value status-${snapshot.testing.infraSmoke.status === 'passed' ? 'green' : 'red'}">
                    ${snapshot.testing.infraSmoke.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Command Center E2E</div>
                <div class="metric-value status-${snapshot.testing.commandCenterE2E.status === 'passed' ? 'green' : 'red'}">
                    ${snapshot.testing.commandCenterE2E.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
                </div>
            </div>
        </div>
        
        <h3>3️⃣ SLO Guards</h3>
        <div class="grid">
            <div class="metric">
                <div class="metric-title">Overall Status</div>
                <div class="metric-value status-${snapshot.guards.overallStatus}">
                    ${snapshot.guards.overallStatus === 'green' ? '✅ GREEN' : snapshot.guards.overallStatus === 'yellow' ? '⚠️ YELLOW' : '❌ RED'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Feed Freshness</div>
                <div class="metric-value status-${snapshot.guards.feedFreshnessSeconds <= 300 ? 'green' : 'red'}">
                    ${snapshot.guards.feedFreshnessSeconds}s ${snapshot.guards.feedFreshnessSeconds <= 300 ? '✅' : '❌'} (max 300s)
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Temporal Backlog</div>
                <div class="metric-value status-${snapshot.guards.temporalBacklogAgeSeconds <= 300 ? 'green' : 'red'}">
                    ${snapshot.guards.temporalBacklogAgeSeconds}s ${snapshot.guards.temporalBacklogAgeSeconds <= 300 ? '✅' : '❌'} (max 300s)
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Failure Burn Rate</div>
                <div class="metric-value status-${snapshot.guards.failureBurnRateLevel === 'green' ? 'green' : snapshot.guards.failureBurnRateLevel === 'yellow' ? 'yellow' : 'red'}">
                    ${snapshot.guards.failureBurnRateLevel === 'green' ? '✅ GREEN' : snapshot.guards.failureBurnRateLevel === 'yellow' ? '⚠️ YELLOW' : '❌ RED'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Canary Age</div>
                <div class="metric-value status-${!snapshot.guards.canaryAgeSeconds || snapshot.guards.canaryAgeSeconds <= 90 ? 'green' : 'red'}">
                    ${snapshot.guards.canaryAgeSeconds || 'N/A'}s ${!snapshot.guards.canaryAgeSeconds || snapshot.guards.canaryAgeSeconds <= 90 ? '✅' : '❌'} (max 90s)
                </div>
            </div>
        </div>
        
        <h3>4️⃣ Incidents (Last 24h)</h3>
        <div class="grid">
            <div class="metric">
                <div class="metric-title">Total Incidents</div>
                <div class="metric-value">${snapshot.incidents.last24h}</div>
            </div>
            <div class="metric">
                <div class="metric-title">Critical Incidents</div>
                <div class="metric-value status-${snapshot.incidents.critical === 0 ? 'green' : 'red'}">
                    ${snapshot.incidents.critical} ${snapshot.incidents.critical === 0 ? '✅' : '❌'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Active Incidents</div>
                <div class="metric-value">${snapshot.incidents.activeIncidents.length}</div>
            </div>
        </div>
        
        <h3>5️⃣ Deployment Gates</h3>
        <div class="gate-grid">
            <div class="gate-item">
                <span class="status-${snapshot.deploymentReadiness.gates.e2eTests ? 'green' : 'red'}">
                    ${snapshot.deploymentReadiness.gates.e2eTests ? '✅' : '❌'}
                </span>
                E2E Tests
            </div>
            <div class="gate-item">
                <span class="status-${snapshot.deploymentReadiness.gates.rehearsalFreshness ? 'green' : 'red'}">
                    ${snapshot.deploymentReadiness.gates.rehearsalFreshness ? '✅' : '❌'}
                </span>
                Rehearsal
            </div>
            <div class="gate-item">
                <span class="status-${snapshot.deploymentReadiness.gates.buildArtifacts ? 'green' : 'red'}">
                    ${snapshot.deploymentReadiness.gates.buildArtifacts ? '✅' : '❌'}
                </span>
                Build
            </div>
            <div class="gate-item">
                <span class="status-${snapshot.deploymentReadiness.gates.securityScans ? 'green' : 'red'}">
                    ${snapshot.deploymentReadiness.gates.securityScans ? '✅' : '❌'}
                </span>
                Security
            </div>
            <div class="gate-item">
                <span class="status-${snapshot.deploymentReadiness.gates.performanceBaseline ? 'green' : 'red'}">
                    ${snapshot.deploymentReadiness.gates.performanceBaseline ? '✅' : '❌'}
                </span>
                Performance
            </div>
            <div class="gate-item">
                <span class="status-${snapshot.deploymentReadiness.schemaFreezeActive ? 'green' : 'red'}">
                    ${snapshot.deploymentReadiness.schemaFreezeActive ? '✅' : '❌'}
                </span>
                Schema Freeze
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📊 System Health Metrics</h2>
        <div class="grid">
            <div class="metric">
                <div class="metric-title">API Response Time</div>
                <div class="metric-value status-${snapshot.systemHealth.apiResponseTime < 100 ? 'green' : 'yellow'}">
                    ${snapshot.systemHealth.apiResponseTime}ms ${snapshot.systemHealth.apiResponseTime < 100 ? '✅' : '⚠️'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Database Latency</div>
                <div class="metric-value status-${snapshot.systemHealth.databaseLatency < 50 ? 'green' : 'yellow'}">
                    ${snapshot.systemHealth.databaseLatency}ms ${snapshot.systemHealth.databaseLatency < 50 ? '✅' : '⚠️'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Error Rate</div>
                <div class="metric-value status-${snapshot.systemHealth.errorRate < 0.5 ? 'green' : 'red'}">
                    ${snapshot.systemHealth.errorRate}% ${snapshot.systemHealth.errorRate < 0.5 ? '✅' : '❌'}
                </div>
            </div>
            <div class="metric">
                <div class="metric-title">Active Users</div>
                <div class="metric-value">${snapshot.systemHealth.activeUsers}</div>
            </div>
            <div class="metric">
                <div class="metric-title">Temporal Backlog</div>
                <div class="metric-value">${snapshot.systemHealth.temporalBacklog} items</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🚀 Launch Decision</h2>
        ${snapshot.overallReady ? `
        <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; border: 2px solid #22c55e;">
            <h3 style="color: #166534; margin-top: 0;">✅ SYSTEM IS READY FOR LAUNCH</h3>
            <p style="color: #166534;">All critical requirements have been met. The system is in a stable state and ready for production deployment.</p>
            <h4 style="color: #166534;">Recommended Actions:</h4>
            <ol style="color: #166534;">
                <li>Proceed with deployment using the Production Launch Gatekeeper</li>
                <li>Monitor SLO guards during progressive rollout</li>
                <li>Keep Kill Switch ready for emergency response</li>
            </ol>
        </div>
        ` : `
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 2px solid #ef4444;">
            <h3 style="color: #991b1b; margin-top: 0;">❌ SYSTEM IS NOT READY FOR LAUNCH</h3>
            <p style="color: #991b1b;">Critical requirements are missing. Address the issues listed above before attempting deployment.</p>
            <h4 style="color: #991b1b;">Required Actions:</h4>
            <ol style="color: #991b1b;">
                ${snapshot.deploymentReadiness.missingRequirements.map((req, i) => `<li>${req}</li>`).join('')}
            </ol>
            <p style="color: #991b1b;"><strong>Do not proceed with deployment until all requirements are met.</strong></p>
        </div>
        `}
    </div>

    <div class="footer">
        <p><em>Generated by Unit Talk Executive Readiness System</em></p>
        <p>Timestamp: ${snapshot.timestamp}</p>
    </div>
</body>
</html>
  `
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'markdown'
    
    // Get the snapshot data
    const snapshotResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ops/readiness/snapshot`, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || ''
      }
    })
    
    if (!snapshotResponse.ok) {
      throw new Error('Failed to fetch snapshot data')
    }
    
    const snapshot = await snapshotResponse.json()
    const timestamp = new Date().toISOString().split('T')[0]
    
    if (format === 'pdf-html') {
      const html = generatePDFHTML(snapshot)
      
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="readiness-snapshot-${timestamp}.html"`
        }
      })
    }
    
    if (format === 'json') {
      return new NextResponse(JSON.stringify(snapshot, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="readiness-snapshot-${timestamp}.json"`
        }
      })
    }
    
    // Default to markdown (handled by original endpoint POST method)
    const markdownResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ops/readiness/snapshot`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || ''
      }
    })
    
    if (!markdownResponse.ok) {
      throw new Error('Failed to generate markdown')
    }
    
    const markdown = await markdownResponse.text()
    
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="readiness-snapshot-${timestamp}.md"`
      }
    })
    
  } catch (error) {
    console.error('Error generating download:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}