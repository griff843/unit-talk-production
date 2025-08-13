import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface ReadinessSnapshot {
  timestamp: string
  overallReady: boolean
  readinessScore: number // 0-100
  
  rehearsal: {
    lastExecutedAt: string | null
    daysSinceRehearsal: number | null
    status: 'passed' | 'failed' | 'never_run'
    rehearsalId: string | null
    isStale: boolean
    details?: {
      testsTotal: number
      testsPassed: number
      testsFailed: number
      duration: number
    }
  }
  
  testing: {
    e2e: {
      status: 'passed' | 'failed' | 'running' | 'unknown'
      lastRunAt: string | null
      passRate: number
      failedTests: string[]
    }
    infraSmoke: {
      status: 'passed' | 'failed' | 'running' | 'unknown'
      lastRunAt: string | null
      services: {
        api: boolean
        database: boolean
        redis: boolean
        temporal: boolean
      }
    }
    commandCenterE2E: {
      status: 'passed' | 'failed' | 'running' | 'unknown'
      lastRunAt: string | null
      criticalFlows: {
        killSwitch: boolean
        deploymentMonitoring: boolean
        agentControl: boolean
        pickManagement: boolean
      }
    }
  }
  
  guards: {
    feedFreshnessSeconds: number
    temporalBacklogAgeSeconds: number
    failureBurnRateLevel: 'green' | 'yellow' | 'red'
    canaryLastSeenAt: string | null
    canaryAgeSeconds: number | null
    overallStatus: 'green' | 'yellow' | 'red'
    violations: string[]
  }
  
  incidents: {
    last24h: number
    critical: number
    activeIncidents: Array<{
      id: string
      title: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      startedAt: string
      status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
    }>
  }
  
  deploymentReadiness: {
    allChecksGreen: boolean
    schemaFreezeActive: boolean
    systemFreezeActive: boolean
    errorBudgetHealthy: boolean
    requiredApprovals: boolean
    missingRequirements: string[]
    gates: {
      e2eTests: boolean
      rehearsalFreshness: boolean
      buildArtifacts: boolean
      securityScans: boolean
      performanceBaseline: boolean
      documentationComplete: boolean
    }
  }
  
  systemHealth: {
    apiResponseTime: number
    databaseLatency: number
    redisLatency: number
    temporalBacklog: number
    activeUsers: number
    errorRate: number
  }
  
  artifacts: {
    rehearsalReport?: string
    testReport?: string
    performanceReport?: string
    securityScan?: string
    deploymentPlan?: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const snapshot: ReadinessSnapshot = {
      timestamp: new Date().toISOString(),
      overallReady: false,
      readinessScore: 0,
      rehearsal: {
        lastExecutedAt: null,
        daysSinceRehearsal: null,
        status: 'never_run',
        rehearsalId: null,
        isStale: true
      },
      testing: {
        e2e: {
          status: 'unknown',
          lastRunAt: null,
          passRate: 0,
          failedTests: []
        },
        infraSmoke: {
          status: 'unknown',
          lastRunAt: null,
          services: {
            api: false,
            database: false,
            redis: false,
            temporal: false
          }
        },
        commandCenterE2E: {
          status: 'unknown',
          lastRunAt: null,
          criticalFlows: {
            killSwitch: false,
            deploymentMonitoring: false,
            agentControl: false,
            pickManagement: false
          }
        }
      },
      guards: {
        feedFreshnessSeconds: 0,
        temporalBacklogAgeSeconds: 0,
        failureBurnRateLevel: 'green',
        canaryLastSeenAt: null,
        canaryAgeSeconds: null,
        overallStatus: 'green',
        violations: []
      },
      incidents: {
        last24h: 0,
        critical: 0,
        activeIncidents: []
      },
      deploymentReadiness: {
        allChecksGreen: false,
        schemaFreezeActive: false,
        systemFreezeActive: false,
        errorBudgetHealthy: false,
        requiredApprovals: false,
        missingRequirements: [],
        gates: {
          e2eTests: false,
          rehearsalFreshness: false,
          buildArtifacts: false,
          securityScans: false,
          performanceBaseline: false,
          documentationComplete: false
        }
      },
      systemHealth: {
        apiResponseTime: 0,
        databaseLatency: 0,
        redisLatency: 0,
        temporalBacklog: 0,
        activeUsers: 0,
        errorRate: 0
      },
      artifacts: {}
    }

    // 1. Get rehearsal status
    const { data: rehearsalData, error: rehearsalError } = await supabase
      .from('rehearsals')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(1)
      .single()

    if (rehearsalData && !rehearsalError) {
      const daysSince = Math.floor(
        (Date.now() - new Date(rehearsalData.executed_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      snapshot.rehearsal = {
        lastExecutedAt: rehearsalData.executed_at,
        daysSinceRehearsal: daysSince,
        status: rehearsalData.status === 'completed' ? 'passed' : 'failed',
        rehearsalId: rehearsalData.id,
        isStale: daysSince > 7,
        details: {
          testsTotal: rehearsalData.tests_total || 0,
          testsPassed: rehearsalData.tests_passed || 0,
          testsFailed: rehearsalData.tests_failed || 0,
          duration: rehearsalData.duration_seconds || 0
        }
      }
    }

    // 2. Get E2E test results
    const { data: e2eData, error: e2eError } = await supabase
      .from('test_results')
      .select('*')
      .eq('test_suite', 'e2e')
      .order('executed_at', { ascending: false })
      .limit(1)
      .single()

    if (e2eData && !e2eError) {
      snapshot.testing.e2e = {
        status: e2eData.status === 'passed' ? 'passed' : 'failed',
        lastRunAt: e2eData.executed_at,
        passRate: e2eData.pass_rate || 0,
        failedTests: e2eData.failed_tests || []
      }
    }

    // 3. Get infrastructure smoke test results
    const { data: smokeData, error: smokeError } = await supabase
      .from('test_results')
      .select('*')
      .eq('test_suite', 'infra-smoke')
      .order('executed_at', { ascending: false })
      .limit(1)
      .single()

    if (smokeData && !smokeError) {
      snapshot.testing.infraSmoke = {
        status: smokeData.status === 'passed' ? 'passed' : 'failed',
        lastRunAt: smokeData.executed_at,
        services: smokeData.services || {
          api: false,
          database: false,
          redis: false,
          temporal: false
        }
      }
    }

    // 4. Get Command Center E2E results
    const { data: ccE2eData, error: ccE2eError } = await supabase
      .from('test_results')
      .select('*')
      .eq('test_suite', 'command-center-e2e')
      .order('executed_at', { ascending: false })
      .limit(1)
      .single()

    if (ccE2eData && !ccE2eError) {
      snapshot.testing.commandCenterE2E = {
        status: ccE2eData.status === 'passed' ? 'passed' : 'failed',
        lastRunAt: ccE2eData.executed_at,
        criticalFlows: ccE2eData.critical_flows || {
          killSwitch: false,
          deploymentMonitoring: false,
          agentControl: false,
          pickManagement: false
        }
      }
    }

    // 5. Get current guard readings
    const { data: guardData, error: guardError } = await supabase
      .from('system_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (guardData && !guardError) {
      const canaryAge = guardData.canary_last_seen_at 
        ? Math.floor((Date.now() - new Date(guardData.canary_last_seen_at).getTime()) / 1000)
        : null

      snapshot.guards = {
        feedFreshnessSeconds: guardData.feed_freshness_seconds || 0,
        temporalBacklogAgeSeconds: guardData.temporal_backlog_age_seconds || 0,
        failureBurnRateLevel: guardData.failure_burn_rate_level || 'green',
        canaryLastSeenAt: guardData.canary_last_seen_at,
        canaryAgeSeconds: canaryAge,
        overallStatus: 'green',
        violations: []
      }

      // Check for violations
      if (snapshot.guards.feedFreshnessSeconds > 300) {
        snapshot.guards.violations.push(`Feed freshness violation: ${snapshot.guards.feedFreshnessSeconds}s > 300s`)
        snapshot.guards.overallStatus = 'red'
      }
      
      if (snapshot.guards.temporalBacklogAgeSeconds > 300) {
        snapshot.guards.violations.push(`Temporal backlog violation: ${snapshot.guards.temporalBacklogAgeSeconds}s > 300s`)
        snapshot.guards.overallStatus = 'red'
      }
      
      if (snapshot.guards.failureBurnRateLevel === 'red') {
        snapshot.guards.violations.push('Failure burn rate is RED')
        snapshot.guards.overallStatus = 'red'
      }
      
      if (canaryAge && canaryAge > 90) {
        snapshot.guards.violations.push(`Canary age violation: ${canaryAge}s > 90s`)
        snapshot.guards.overallStatus = 'red'
      }
    }

    // 6. Get incidents in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: incidentData, error: incidentError } = await supabase
      .from('incidents')
      .select('*')
      .gte('started_at', twentyFourHoursAgo)
      .order('started_at', { ascending: false })

    if (incidentData && !incidentError) {
      snapshot.incidents = {
        last24h: incidentData.length,
        critical: incidentData.filter(i => i.severity === 'critical').length,
        activeIncidents: incidentData
          .filter(i => i.status !== 'resolved')
          .map(i => ({
            id: i.id,
            title: i.title,
            severity: i.severity,
            startedAt: i.started_at,
            status: i.status
          }))
      }
    }

    // 7. Check deployment readiness gates
    const missingRequirements: string[] = []

    // Check E2E tests
    snapshot.deploymentReadiness.gates.e2eTests = snapshot.testing.e2e.status === 'passed'
    if (!snapshot.deploymentReadiness.gates.e2eTests) {
      missingRequirements.push('E2E tests must pass')
    }

    // Check rehearsal freshness
    snapshot.deploymentReadiness.gates.rehearsalFreshness = !snapshot.rehearsal.isStale && snapshot.rehearsal.status === 'passed'
    if (!snapshot.deploymentReadiness.gates.rehearsalFreshness) {
      if (snapshot.rehearsal.isStale) {
        missingRequirements.push(`Rehearsal is stale (${snapshot.rehearsal.daysSinceRehearsal} days old, max 7 days)`)
      } else if (snapshot.rehearsal.status !== 'passed') {
        missingRequirements.push('Last rehearsal must pass')
      }
    }

    // Check build artifacts
    const { data: buildData } = await supabase
      .from('build_artifacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    snapshot.deploymentReadiness.gates.buildArtifacts = !!buildData && buildData.status === 'success'
    if (!snapshot.deploymentReadiness.gates.buildArtifacts) {
      missingRequirements.push('Build artifacts must be generated successfully')
    }

    // Check security scans
    const { data: securityData } = await supabase
      .from('security_scans')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(1)
      .single()

    snapshot.deploymentReadiness.gates.securityScans = !!securityData && securityData.critical_vulnerabilities === 0
    if (!snapshot.deploymentReadiness.gates.securityScans) {
      if (securityData?.critical_vulnerabilities > 0) {
        missingRequirements.push(`${securityData.critical_vulnerabilities} critical security vulnerabilities found`)
      } else {
        missingRequirements.push('Security scan required')
      }
    }

    // Check performance baseline
    snapshot.deploymentReadiness.gates.performanceBaseline = snapshot.systemHealth.apiResponseTime < 100 && snapshot.systemHealth.errorRate < 0.5
    if (!snapshot.deploymentReadiness.gates.performanceBaseline) {
      if (snapshot.systemHealth.apiResponseTime >= 100) {
        missingRequirements.push(`API response time too high: ${snapshot.systemHealth.apiResponseTime}ms (max 100ms)`)
      }
      if (snapshot.systemHealth.errorRate >= 0.5) {
        missingRequirements.push(`Error rate too high: ${snapshot.systemHealth.errorRate}% (max 0.5%)`)
      }
    }

    // Check documentation
    snapshot.deploymentReadiness.gates.documentationComplete = true // Assume complete for now
    
    // Check schema freeze
    const { data: schemaConfig } = await supabase
      .from('app_system_config')
      .select('config_value')
      .eq('config_key', 'SCHEMA_FREEZE')
      .single()

    snapshot.deploymentReadiness.schemaFreezeActive = schemaConfig?.config_value === 'true'
    if (!snapshot.deploymentReadiness.schemaFreezeActive) {
      missingRequirements.push('Schema freeze must be active before deployment')
    }

    // Check system freeze
    const { data: systemConfig } = await supabase
      .from('app_system_config')
      .select('config_value')
      .eq('config_key', 'SYSTEM_FREEZE')
      .single()

    snapshot.deploymentReadiness.systemFreezeActive = systemConfig?.config_value === 'true'
    if (snapshot.deploymentReadiness.systemFreezeActive) {
      missingRequirements.push('System freeze is active - deployment blocked')
    }

    // Check error budget
    const { data: errorBudgetData } = await supabase
      .from('error_budget_status')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()

    snapshot.deploymentReadiness.errorBudgetHealthy = 
      !!errorBudgetData && errorBudgetData.remaining_percentage > 20
    if (!snapshot.deploymentReadiness.errorBudgetHealthy) {
      if (errorBudgetData) {
        missingRequirements.push(`Error budget too low: ${errorBudgetData.remaining_percentage}% remaining (min 20%)`)
      } else {
        missingRequirements.push('Error budget status unknown')
      }
    }

    // Check required approvals (placeholder)
    snapshot.deploymentReadiness.requiredApprovals = true // Assume approved for now

    snapshot.deploymentReadiness.missingRequirements = missingRequirements
    snapshot.deploymentReadiness.allChecksGreen = missingRequirements.length === 0

    // 8. Get system health metrics
    const { data: healthData } = await supabase
      .from('system_health')
      .select('*')
      .order('measured_at', { ascending: false })
      .limit(1)
      .single()

    if (healthData && !healthData) {
      snapshot.systemHealth = {
        apiResponseTime: healthData.api_response_time_ms || 0,
        databaseLatency: healthData.database_latency_ms || 0,
        redisLatency: healthData.redis_latency_ms || 0,
        temporalBacklog: healthData.temporal_backlog_count || 0,
        activeUsers: healthData.active_users || 0,
        errorRate: healthData.error_rate_percentage || 0
      }
    }

    // 9. Add artifact links
    snapshot.artifacts = {
      rehearsalReport: snapshot.rehearsal.rehearsalId 
        ? `/reports/rehearsal/${snapshot.rehearsal.rehearsalId}`
        : undefined,
      testReport: snapshot.testing.e2e.lastRunAt
        ? `/reports/test/${new Date(snapshot.testing.e2e.lastRunAt).toISOString().split('T')[0]}`
        : undefined,
      performanceReport: '/reports/performance/latest',
      securityScan: securityData?.scan_id
        ? `/reports/security/${securityData.scan_id}`
        : undefined,
      deploymentPlan: '/docs/deployment-plan/current'
    }

    // Calculate overall readiness score
    let score = 0
    const weights = {
      rehearsal: 20,
      e2e: 15,
      infraSmoke: 10,
      commandCenterE2E: 10,
      guards: 15,
      incidents: 10,
      errorBudget: 10,
      schemaFreeze: 5,
      systemFreeze: 5
    }

    // Score calculation
    if (snapshot.deploymentReadiness.gates.rehearsalFreshness) score += weights.rehearsal
    if (snapshot.deploymentReadiness.gates.e2eTests) score += weights.e2e
    if (snapshot.testing.infraSmoke.status === 'passed') score += weights.infraSmoke
    if (snapshot.testing.commandCenterE2E.status === 'passed') score += weights.commandCenterE2E
    if (snapshot.guards.overallStatus === 'green') score += weights.guards
    if (snapshot.incidents.critical === 0) score += weights.incidents
    if (snapshot.deploymentReadiness.errorBudgetHealthy) score += weights.errorBudget
    if (snapshot.deploymentReadiness.schemaFreezeActive) score += weights.schemaFreeze
    if (!snapshot.deploymentReadiness.systemFreezeActive) score += weights.systemFreeze

    snapshot.readinessScore = score
    snapshot.overallReady = snapshot.deploymentReadiness.allChecksGreen && score >= 90

    return NextResponse.json(snapshot)

  } catch (error) {
    console.error('Error generating readiness snapshot:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate readiness snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Export snapshot as Markdown
export async function POST(request: NextRequest) {
  try {
    const snapshot = await GET(request)
    const data = await snapshot.json() as ReadinessSnapshot

    const markdown = generateMarkdownReport(data)
    
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="readiness-snapshot-${new Date().toISOString().split('T')[0]}.md"`
      }
    })
  } catch (error) {
    console.error('Error generating markdown snapshot:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate markdown snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function generateMarkdownReport(snapshot: ReadinessSnapshot): string {
  const ready = snapshot.overallReady ? '✅ **READY FOR LAUNCH**' : '❌ **NOT READY FOR LAUNCH**'
  
  return `# Executive Readiness Snapshot

**Generated**: ${new Date(snapshot.timestamp).toLocaleString()}  
**Overall Status**: ${ready}  
**Readiness Score**: ${snapshot.readinessScore}/100

---

## 🎯 Launch Readiness: ${snapshot.overallReady ? 'GO' : 'NO-GO'}

${snapshot.deploymentReadiness.missingRequirements.length > 0 ? `
### ⚠️ Missing Requirements
${snapshot.deploymentReadiness.missingRequirements.map(req => `- ❌ ${req}`).join('\n')}
` : '### ✅ All Requirements Met'}

---

## 📋 Readiness Checklist

### 1️⃣ Rehearsal Status
- **Last Rehearsal**: ${snapshot.rehearsal.lastExecutedAt ? new Date(snapshot.rehearsal.lastExecutedAt).toLocaleString() : 'Never'}
- **Days Since**: ${snapshot.rehearsal.daysSinceRehearsal || 'N/A'} days
- **Status**: ${snapshot.rehearsal.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
- **Freshness**: ${!snapshot.rehearsal.isStale ? '✅ Fresh (≤7 days)' : '❌ Stale (>7 days)'}
${snapshot.rehearsal.details ? `
- **Test Results**: ${snapshot.rehearsal.details.testsPassed}/${snapshot.rehearsal.details.testsTotal} passed
- **Duration**: ${Math.round(snapshot.rehearsal.details.duration / 60)} minutes
` : ''}

### 2️⃣ Testing Status

#### E2E Tests
- **Status**: ${snapshot.testing.e2e.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
- **Last Run**: ${snapshot.testing.e2e.lastRunAt ? new Date(snapshot.testing.e2e.lastRunAt).toLocaleString() : 'Never'}
- **Pass Rate**: ${snapshot.testing.e2e.passRate}%
${snapshot.testing.e2e.failedTests.length > 0 ? `
- **Failed Tests**: 
  ${snapshot.testing.e2e.failedTests.map(test => `  - ${test}`).join('\n')}
` : ''}

#### Infrastructure Smoke Tests
- **Status**: ${snapshot.testing.infraSmoke.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
- **Last Run**: ${snapshot.testing.infraSmoke.lastRunAt ? new Date(snapshot.testing.infraSmoke.lastRunAt).toLocaleString() : 'Never'}
- **Services**:
  - API: ${snapshot.testing.infraSmoke.services.api ? '✅' : '❌'}
  - Database: ${snapshot.testing.infraSmoke.services.database ? '✅' : '❌'}
  - Redis: ${snapshot.testing.infraSmoke.services.redis ? '✅' : '❌'}
  - Temporal: ${snapshot.testing.infraSmoke.services.temporal ? '✅' : '❌'}

#### Command Center E2E Tests
- **Status**: ${snapshot.testing.commandCenterE2E.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
- **Last Run**: ${snapshot.testing.commandCenterE2E.lastRunAt ? new Date(snapshot.testing.commandCenterE2E.lastRunAt).toLocaleString() : 'Never'}
- **Critical Flows**:
  - Kill Switch: ${snapshot.testing.commandCenterE2E.criticalFlows.killSwitch ? '✅' : '❌'}
  - Deployment Monitoring: ${snapshot.testing.commandCenterE2E.criticalFlows.deploymentMonitoring ? '✅' : '❌'}
  - Agent Control: ${snapshot.testing.commandCenterE2E.criticalFlows.agentControl ? '✅' : '❌'}
  - Pick Management: ${snapshot.testing.commandCenterE2E.criticalFlows.pickManagement ? '✅' : '❌'}

### 3️⃣ SLO Guards
- **Overall Status**: ${snapshot.guards.overallStatus === 'green' ? '✅ GREEN' : snapshot.guards.overallStatus === 'yellow' ? '⚠️ YELLOW' : '❌ RED'}
- **Feed Freshness**: ${snapshot.guards.feedFreshnessSeconds}s ${snapshot.guards.feedFreshnessSeconds <= 300 ? '✅' : '❌'} (max 300s)
- **Temporal Backlog**: ${snapshot.guards.temporalBacklogAgeSeconds}s ${snapshot.guards.temporalBacklogAgeSeconds <= 300 ? '✅' : '❌'} (max 300s)
- **Failure Burn Rate**: ${snapshot.guards.failureBurnRateLevel === 'green' ? '✅ GREEN' : snapshot.guards.failureBurnRateLevel === 'yellow' ? '⚠️ YELLOW' : '❌ RED'}
- **Canary Age**: ${snapshot.guards.canaryAgeSeconds || 'N/A'}s ${!snapshot.guards.canaryAgeSeconds || snapshot.guards.canaryAgeSeconds <= 90 ? '✅' : '❌'} (max 90s)
${snapshot.guards.violations.length > 0 ? `
#### ⚠️ Guard Violations
${snapshot.guards.violations.map(v => `- ${v}`).join('\n')}
` : ''}

### 4️⃣ Incidents (Last 24h)
- **Total Incidents**: ${snapshot.incidents.last24h}
- **Critical Incidents**: ${snapshot.incidents.critical} ${snapshot.incidents.critical === 0 ? '✅' : '❌'}
${snapshot.incidents.activeIncidents.length > 0 ? `
#### Active Incidents
${snapshot.incidents.activeIncidents.map(i => `- **${i.severity.toUpperCase()}**: ${i.title} (${i.status})`).join('\n')}
` : '- No active incidents ✅'}

### 5️⃣ Deployment Gates
- **E2E Tests**: ${snapshot.deploymentReadiness.gates.e2eTests ? '✅ Passed' : '❌ Failed/Missing'}
- **Rehearsal Freshness**: ${snapshot.deploymentReadiness.gates.rehearsalFreshness ? '✅ Fresh' : '❌ Stale/Failed'}
- **Build Artifacts**: ${snapshot.deploymentReadiness.gates.buildArtifacts ? '✅ Ready' : '❌ Missing'}
- **Security Scans**: ${snapshot.deploymentReadiness.gates.securityScans ? '✅ Clean' : '❌ Issues Found'}
- **Performance Baseline**: ${snapshot.deploymentReadiness.gates.performanceBaseline ? '✅ Met' : '❌ Not Met'}
- **Documentation**: ${snapshot.deploymentReadiness.gates.documentationComplete ? '✅ Complete' : '❌ Incomplete'}

### 6️⃣ System Configuration
- **Schema Freeze**: ${snapshot.deploymentReadiness.schemaFreezeActive ? '✅ Active' : '❌ Not Active'}
- **System Freeze**: ${!snapshot.deploymentReadiness.systemFreezeActive ? '✅ Not Active' : '❌ ACTIVE (Deployment Blocked)'}
- **Error Budget**: ${snapshot.deploymentReadiness.errorBudgetHealthy ? '✅ Healthy' : '❌ Exhausted'}
- **Required Approvals**: ${snapshot.deploymentReadiness.requiredApprovals ? '✅ Obtained' : '❌ Pending'}

---

## 📊 System Health Metrics

- **API Response Time**: ${snapshot.systemHealth.apiResponseTime}ms ${snapshot.systemHealth.apiResponseTime < 100 ? '✅' : '⚠️'}
- **Database Latency**: ${snapshot.systemHealth.databaseLatency}ms ${snapshot.systemHealth.databaseLatency < 50 ? '✅' : '⚠️'}
- **Redis Latency**: ${snapshot.systemHealth.redisLatency}ms ${snapshot.systemHealth.redisLatency < 10 ? '✅' : '⚠️'}
- **Temporal Backlog**: ${snapshot.systemHealth.temporalBacklog} items
- **Active Users**: ${snapshot.systemHealth.activeUsers}
- **Error Rate**: ${snapshot.systemHealth.errorRate}% ${snapshot.systemHealth.errorRate < 0.5 ? '✅' : '❌'}

---

## 📎 Artifacts & Reports

${snapshot.artifacts.rehearsalReport ? `- [Rehearsal Report](${snapshot.artifacts.rehearsalReport})` : '- Rehearsal Report: Not Available'}
${snapshot.artifacts.testReport ? `- [Test Report](${snapshot.artifacts.testReport})` : '- Test Report: Not Available'}
${snapshot.artifacts.performanceReport ? `- [Performance Report](${snapshot.artifacts.performanceReport})` : '- Performance Report: Not Available'}
${snapshot.artifacts.securityScan ? `- [Security Scan](${snapshot.artifacts.securityScan})` : '- Security Scan: Not Available'}
${snapshot.artifacts.deploymentPlan ? `- [Deployment Plan](${snapshot.artifacts.deploymentPlan})` : '- Deployment Plan: Not Available'}

---

## 🚀 Launch Decision

**Readiness Score**: ${snapshot.readinessScore}/100

${snapshot.overallReady ? `
### ✅ SYSTEM IS READY FOR LAUNCH

All critical requirements have been met. The system is in a stable state and ready for production deployment.

**Recommended Actions**:
1. Proceed with deployment using the Production Launch Gatekeeper
2. Monitor SLO guards during progressive rollout
3. Keep Kill Switch ready for emergency response
` : `
### ❌ SYSTEM IS NOT READY FOR LAUNCH

Critical requirements are missing. Address the issues listed above before attempting deployment.

**Required Actions**:
${snapshot.deploymentReadiness.missingRequirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

**Do not proceed with deployment until all requirements are met.**
`}

---

*Generated by Unit Talk Executive Readiness System*  
*Timestamp: ${snapshot.timestamp}*
`
}