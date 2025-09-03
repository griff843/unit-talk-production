export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getTypedSupabaseClient } from '@/lib/supabase'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// System component health probe types
interface ComponentHealth {
  component: string
  status: 'ok' | 'degraded' | 'down'
  version?: string
  roundtrip_ms?: number
  last_probe: string
  details?: string
  error?: string
}

interface HealthProbeResult {
  timestamp: string
  overall_status: 'healthy' | 'degraded' | 'critical'
  components: ComponentHealth[]
  summary: {
    total_components: number
    healthy_count: number
    degraded_count: number
    down_count: number
  }
  probe_duration_ms: number
}

// Mock health data for demo mode
const generateMockHealthData = (): HealthProbeResult => {
  const timestamp = new Date().toISOString()
  
  const components: ComponentHealth[] = [
    {
      component: 'API',
      status: 'ok',
      version: 'v3.0.0',
      roundtrip_ms: 45,
      last_probe: timestamp,
      details: 'All endpoints responding normally'
    },
    {
      component: 'Worker',
      status: 'ok',
      version: 'v2.1.0',
      roundtrip_ms: 23,
      last_probe: timestamp,
      details: 'Processing queue: 12 items, avg time: 150ms'
    },
    {
      component: 'Database',
      status: 'ok',
      version: 'PostgreSQL 15.3',
      roundtrip_ms: 8,
      last_probe: timestamp,
      details: 'Connection pool: 8/20 active, query avg: 12ms'
    },
    {
      component: 'Temporal',
      status: 'degraded',
      version: 'v1.22.0',
      roundtrip_ms: 234,
      last_probe: timestamp,
      details: 'High workflow latency detected, auto-scaling triggered'
    },
    {
      component: 'Discord Bot',
      status: 'ok',
      version: 'v1.8.2',
      roundtrip_ms: 156,
      last_probe: timestamp,
      details: 'Connected to 3 guilds, 847 users online'
    }
  ]

  const healthy_count = components.filter(c => c.status === 'ok').length
  const degraded_count = components.filter(c => c.status === 'degraded').length
  const down_count = components.filter(c => c.status === 'down').length

  let overall_status: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (down_count > 0) {
    overall_status = 'critical'
  } else if (degraded_count > 0) {
    overall_status = 'degraded'
  }

  return {
    timestamp,
    overall_status,
    components,
    summary: {
      total_components: components.length,
      healthy_count,
      degraded_count,
      down_count
    },
    probe_duration_ms: 1247
  }
}

// Production health probe implementation
async function performHealthProbes(): Promise<HealthProbeResult> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  const components: ComponentHealth[] = []

  // Probe API health
  try {
    const apiStart = Date.now()
    const response = await fetch('http://localhost:3000/api/pipeline/health', {
      method: 'GET',
      timeout: 5000
    } as any)
    const apiTime = Date.now() - apiStart
    
    if (response.ok) {
      components.push({
        component: 'API',
        status: 'ok',
        version: 'v3.0.0',
        roundtrip_ms: apiTime,
        last_probe: timestamp,
        details: 'All endpoints responding normally'
      })
    } else {
      components.push({
        component: 'API',
        status: 'degraded',
        roundtrip_ms: apiTime,
        last_probe: timestamp,
        details: `HTTP ${response.status}: ${response.statusText}`,
        error: `API returned status ${response.status}`
      })
    }
  } catch (error) {
    components.push({
      component: 'API',
      status: 'down',
      last_probe: timestamp,
      error: error instanceof Error ? error.message : 'Unknown API error',
      details: 'Failed to connect to API endpoints'
    })
  }

  // Probe Database health
  try {
    const supabase = getTypedSupabaseClient()
    if (supabase) {
      const dbStart = Date.now()
      const { data, error } = await supabase
        .from('agent_health')
        .select('count(*)')
        .limit(1)
        .single()
      
      const dbTime = Date.now() - dbStart
      
      if (!error) {
        components.push({
          component: 'Database',
          status: 'ok',
          version: 'PostgreSQL 15.3',
          roundtrip_ms: dbTime,
          last_probe: timestamp,
          details: 'v3.0.0 unified schema operational'
        })
      } else {
        components.push({
          component: 'Database',
          status: 'degraded',
          roundtrip_ms: dbTime,
          last_probe: timestamp,
          error: error.message,
          details: 'Database query failed'
        })
      }
    } else {
      components.push({
        component: 'Database',
        status: 'down',
        last_probe: timestamp,
        error: 'Supabase client unavailable',
        details: 'Missing environment variables'
      })
    }
  } catch (error) {
    components.push({
      component: 'Database',
      status: 'down',
      last_probe: timestamp,
      error: error instanceof Error ? error.message : 'Unknown database error',
      details: 'Failed to connect to database'
    })
  }

  // Probe Worker health (mock for now - would connect to actual worker service)
  components.push({
    component: 'Worker',
    status: 'ok',
    version: 'v2.1.0',
    roundtrip_ms: 23,
    last_probe: timestamp,
    details: 'Mock worker probe - would connect to actual service'
  })

  // Probe Temporal health (mock for now - would connect to actual Temporal service)
  components.push({
    component: 'Temporal',
    status: 'ok',
    version: 'v1.22.0',
    roundtrip_ms: 89,
    last_probe: timestamp,
    details: 'Mock Temporal probe - would connect to actual service'
  })

  // Probe Discord Bot health (mock for now - would connect to actual bot)
  components.push({
    component: 'Discord Bot',
    status: 'ok',
    version: 'v1.8.2',
    roundtrip_ms: 156,
    last_probe: timestamp,
    details: 'Mock Discord probe - would connect to actual bot'
  })

  const healthy_count = components.filter(c => c.status === 'ok').length
  const degraded_count = components.filter(c => c.status === 'degraded').length
  const down_count = components.filter(c => c.status === 'down').length

  let overall_status: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (down_count > 0) {
    overall_status = 'critical'
  } else if (degraded_count > 0) {
    overall_status = 'degraded'
  }

  const probe_duration_ms = Date.now() - startTime

  return {
    timestamp,
    overall_status,
    components,
    summary: {
      total_components: components.length,
      healthy_count,
      degraded_count,
      down_count
    },
    probe_duration_ms
  }
}

// Write artifact to out/ops/ directory
function writeHealthArtifact(healthData: HealthProbeResult) {
  try {
    const outDir = join(process.cwd(), 'out', 'ops')
    mkdirSync(outDir, { recursive: true })
    
    const artifactPath = join(outDir, `health-probe-${Date.now()}.json`)
    writeFileSync(artifactPath, JSON.stringify(healthData, null, 2))
    
    // Also write latest health status
    const latestPath = join(outDir, 'latest-health.json')
    writeFileSync(latestPath, JSON.stringify(healthData, null, 2))
    
    console.log(`✅ Health probe artifact written to: ${artifactPath}`)
    return artifactPath
  } catch (error) {
    console.error('Failed to write health artifact:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Running system health probes...')

    const supabase = getTypedSupabaseClient()
    let healthData: HealthProbeResult
    
    if (!supabase) {
      console.log('🎭 DEMO MODE: Using mock health probe data')
      healthData = generateMockHealthData()
    } else {
      console.log('🚀 PRODUCTION MODE: Running actual health probes')
      healthData = await performHealthProbes()
    }
    
    // Write artifact for CI/CD validation
    const artifactPath = writeHealthArtifact(healthData)
    
    return NextResponse.json({
      ...healthData,
      artifact_path: artifactPath,
      metadata: {
        mode: supabase ? 'production' : 'demo',
        probe_completed_at: new Date().toISOString(),
        ci_cd_artifact: artifactPath ? true : false
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Health probe error:', error)
    
    const errorData: HealthProbeResult = {
      timestamp: new Date().toISOString(),
      overall_status: 'critical',
      components: [{
        component: 'Health Probe System',
        status: 'down',
        last_probe: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to execute health probes'
      }],
      summary: {
        total_components: 1,
        healthy_count: 0,
        degraded_count: 0,
        down_count: 1
      },
      probe_duration_ms: 0
    }
    
    // Still write error artifact
    writeHealthArtifact(errorData)
    
    return NextResponse.json(errorData, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Manual probe trigger endpoint
export async function POST(request: NextRequest) {
  return GET(request)
}