'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Activity, Database, Bot, Workflow, Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  artifact_path?: string
  metadata?: {
    mode: 'production' | 'demo'
    probe_completed_at: string
    ci_cd_artifact: boolean
  }
}

// Component icon mapping
const componentIcons: Record<string, React.ComponentType<any>> = {
  'API': Server,
  'Worker': Activity,
  'Database': Database,
  'Temporal': Workflow,
  'Discord Bot': Bot
}

// Status styling
const statusStyles = {
  ok: {
    badge: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    border: 'border-green-200'
  },
  degraded: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    border: 'border-yellow-200'
  },
  down: {
    badge: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
    iconColor: 'text-red-600',
    border: 'border-red-200'
  }
}

const overallStatusStyles = {
  healthy: {
    badge: 'bg-green-100 text-green-800',
    text: 'text-green-800',
    icon: 'text-green-600'
  },
  degraded: {
    badge: 'bg-yellow-100 text-yellow-800',
    text: 'text-yellow-800',
    icon: 'text-yellow-600'
  },
  critical: {
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-800',
    icon: 'text-red-600'
  }
}

function ComponentHealthCard({ component }: { component: ComponentHealth }) {
  const IconComponent = componentIcons[component.component] || Server
  const StatusIcon = statusStyles[component.status].icon
  const styles = statusStyles[component.status]
  
  return (
    <Card className={cn('transition-all hover:shadow-md', styles.border)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IconComponent className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg">{component.component}</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <StatusIcon className={cn('h-4 w-4', styles.iconColor)} />
            <Badge variant="outline" className={styles.badge}>
              {component.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        {component.version && (
          <CardDescription>Version: {component.version}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {component.roundtrip_ms && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Response Time:</span>
              <span className={cn(
                'font-mono',
                component.roundtrip_ms < 100 ? 'text-green-600' : 
                component.roundtrip_ms < 500 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {component.roundtrip_ms}ms
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Last Probe:</span>
            <span className="font-mono text-xs">
              {new Date(component.last_probe).toLocaleTimeString()}
            </span>
          </div>
          {component.details && (
            <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
              {component.details}
            </div>
          )}
          {component.error && (
            <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
              <strong>Error:</strong> {component.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function GlobalHealthControl() {
  const [healthData, setHealthData] = useState<HealthProbeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [probeLoading, setProbeLoading] = useState(false)
  const [lastProbeTime, setLastProbeTime] = useState<string | null>(null)

  const fetchHealthData = async () => {
    try {
      setProbeLoading(true)
      console.log('🔍 Fetching system health probes...')
      
      const response = await fetch('/api/ops/probes/health', {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        throw new Error(`Health probe failed: ${response.status}`)
      }
      
      const data: HealthProbeResult = await response.json()
      setHealthData(data)
      setLastProbeTime(new Date().toISOString())
      
      console.log('✅ Health probe completed:', data.overall_status)
      if (data.artifact_path) {
        console.log('📄 Artifact generated:', data.artifact_path)
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error)
      // Set error state
      setHealthData({
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
      })
    } finally {
      setLoading(false)
      setProbeLoading(false)
    }
  }

  const runManualProbes = async () => {
    await fetchHealthData()
  }

  useEffect(() => {
    fetchHealthData()
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchHealthData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading system health probes...</span>
        </div>
      </div>
    )
  }

  if (!healthData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Health Probe Failed</h3>
          <p className="text-gray-600 mb-4">Unable to fetch system health data</p>
          <Button onClick={fetchHealthData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const overallStyles = overallStatusStyles[healthData.overall_status]

  return (
    <div className="space-y-6">
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Global Health & Control</h1>
          <p className="text-gray-600 mt-1">
            Unified system monitoring for all platform components
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {healthData.metadata?.mode === 'demo' && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              Demo Mode
            </Badge>
          )}
          <Button 
            onClick={runManualProbes} 
            disabled={probeLoading}
            className="flex items-center space-x-2"
          >
            {probeLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Run Probes</span>
          </Button>
        </div>
      </div>

      {/* Overall Status Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">System Status</CardTitle>
              <CardDescription>
                Overall platform health and performance metrics
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge className={overallStyles.badge} variant="outline">
                {healthData.overall_status.toUpperCase()}
              </Badge>
              <p className="text-sm text-gray-600 mt-1">
                Last updated: {new Date(healthData.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {healthData.summary.healthy_count}
              </p>
              <p className="text-sm text-gray-600">Healthy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {healthData.summary.degraded_count}
              </p>
              <p className="text-sm text-gray-600">Degraded</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {healthData.summary.down_count}
              </p>
              <p className="text-sm text-gray-600">Down</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {healthData.probe_duration_ms}ms
              </p>
              <p className="text-sm text-gray-600">Probe Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Health Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Component Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthData.components.map((component, index) => (
            <ComponentHealthCard key={`${component.component}-${index}`} component={component} />
          ))}
        </div>
      </div>

      {/* Probe Information */}
      <Card>
        <CardHeader>
          <CardTitle>Probe Information</CardTitle>
          <CardDescription>
            Details about the health probe execution and artifacts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-700">Total Components</p>
              <p className="text-lg font-mono">{healthData.summary.total_components}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Probe Duration</p>
              <p className="text-lg font-mono">{healthData.probe_duration_ms}ms</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Execution Mode</p>
              <p className="text-lg">{healthData.metadata?.mode || 'unknown'}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">CI/CD Artifact</p>
              <p className="text-lg">
                {healthData.metadata?.ci_cd_artifact ? '✅ Generated' : '❌ Failed'}
              </p>
            </div>
          </div>
          {healthData.artifact_path && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm font-semibold text-gray-700">Artifact Path:</p>
              <p className="text-xs font-mono text-gray-600 mt-1">
                {healthData.artifact_path}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}