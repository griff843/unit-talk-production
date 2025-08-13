'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  Download,
  RefreshCw,
  ExternalLink,
  Shield,
  TestTube,
  Activity,
  AlertOctagon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface ReadinessSnapshot {
  timestamp: string
  overallReady: boolean
  readinessScore: number
  
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
      status: string
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
  
  artifacts?: {
    rehearsalReport?: string
    testReport?: string
    performanceReport?: string
    securityScan?: string
    deploymentPlan?: string
  }
}

const ExecutiveReadinessCard = () => {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchSnapshot = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/ops/readiness/snapshot')
      if (!response.ok) {
        throw new Error(`Failed to fetch readiness snapshot: ${response.statusText}`)
      }
      
      const data = await response.json()
      setSnapshot(data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching readiness snapshot:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
      toast({
        title: "Failed to Load Readiness Snapshot",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadSnapshot = async (format: 'markdown' | 'json' | 'html' = 'markdown') => {
    try {
      let endpoint = '/api/ops/readiness/download'
      let queryParam = ''
      let method = 'GET'
      
      switch (format) {
        case 'markdown':
          queryParam = '?format=markdown'
          break
        case 'json':
          queryParam = '?format=json'
          break
        case 'html':
          queryParam = '?format=pdf-html'
          break
        default:
          // Fallback to POST method for backwards compatibility
          endpoint = '/api/ops/readiness/snapshot'
          method = 'POST'
      }
      
      const response = await fetch(endpoint + queryParam, {
        method: method
      })
      
      if (!response.ok) {
        throw new Error(`Failed to download snapshot: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const timestamp = new Date().toISOString().split('T')[0]
      const extensions = {
        markdown: 'md',
        json: 'json',
        html: 'html'
      }
      
      link.download = `readiness-snapshot-${timestamp}.${extensions[format] || 'md'}`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Snapshot Downloaded",
        description: `Executive readiness snapshot downloaded as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error('Error downloading snapshot:', error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    fetchSnapshot()
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchSnapshot, 2 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading && !snapshot) {
    return (
      <Card className="w-full" data-testid="readiness-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Executive Readiness Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading readiness data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !snapshot) {
    return (
      <Card className="w-full border-red-200" data-testid="readiness-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Executive Readiness Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 mb-4">
            Failed to load readiness data: {error}
          </div>
          <Button onClick={fetchSnapshot} variant="outline" data-testid="retry-button">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!snapshot) return null

  const getReadinessColor = () => {
    if (snapshot.overallReady) return 'bg-green-500'
    if (snapshot.readinessScore >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'green':
      case true:
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
      case 'red':
      case false:
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'running':
      case 'yellow':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 ? `${minutes}m` : `${seconds}s`
  }

  return (
    <Card 
      className={cn(
        "w-full",
        snapshot.overallReady 
          ? "border-green-200 bg-green-50/50" 
          : "border-red-200 bg-red-50/50"
      )}
      data-testid="executive-readiness-card"
      data-loading={loading}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", getReadinessColor())} />
            Executive Readiness Snapshot
            <Badge 
              variant={snapshot.overallReady ? "default" : "destructive"}
              data-testid="readiness-badge"
            >
              {snapshot.overallReady ? 'READY' : 'NOT READY'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchSnapshot}
              disabled={loading}
              data-testid="refresh-button"
            >
              <RefreshCw 
                className={cn("h-4 w-4 mr-2", loading && "animate-spin")} 
                data-testid="refresh-icon"
              />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadSnapshot('markdown')}
              data-testid="download-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span data-testid="readiness-score">Readiness Score: {snapshot.readinessScore}/100</span>
          <span data-testid="last-updated">
            Updated: {lastRefresh?.toLocaleTimeString() || 'Never'}
          </span>
        </div>
        
        <Progress 
          value={snapshot.readinessScore} 
          className="h-2" 
          data-testid="readiness-progress"
        />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Missing Requirements Alert */}
        {snapshot.deploymentReadiness.missingRequirements.length > 0 && (
          <div 
            className="bg-red-50 border border-red-200 rounded-lg p-4"
            data-testid="missing-requirements"
          >
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertOctagon className="h-5 w-5" />
              Missing Requirements ({snapshot.deploymentReadiness.missingRequirements.length})
            </div>
            <ul 
              className="text-sm text-red-700 space-y-1"
              data-testid="requirements-list"
            >
              {snapshot.deploymentReadiness.missingRequirements.map((req, index) => (
                <li key={index} className="flex items-start gap-2">
                  <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Rehearsal Status */}
          <div className="space-y-2" data-testid="rehearsal-status">
            <div className="flex items-center gap-2 font-medium">
              <TestTube className="h-4 w-4" />
              Rehearsal
              {getStatusIcon(snapshot.rehearsal.status)}
            </div>
            <div className="text-sm space-y-1">
              <div>
                Last: {snapshot.rehearsal.lastExecutedAt 
                  ? new Date(snapshot.rehearsal.lastExecutedAt).toLocaleDateString()
                  : 'Never'
                }
              </div>
              <div>
                Age: {snapshot.rehearsal.daysSinceRehearsal || 'N/A'} days
                {snapshot.rehearsal.isStale && (
                  <Badge variant="destructive" className="ml-2 text-xs">Stale</Badge>
                )}
              </div>
              {snapshot.rehearsal.details && (
                <div>
                  Tests: {snapshot.rehearsal.details.testsPassed}/{snapshot.rehearsal.details.testsTotal}
                  ({formatDuration(snapshot.rehearsal.details.duration)})
                </div>
              )}
            </div>
          </div>

          {/* E2E Testing */}
          <div className="space-y-2" data-testid="e2e-status">
            <div className="flex items-center gap-2 font-medium">
              <TestTube className="h-4 w-4" />
              E2E Tests
              {getStatusIcon(snapshot.testing.e2e.status)}
            </div>
            <div className="text-sm space-y-1">
              <div>Pass Rate: {snapshot.testing.e2e.passRate}%</div>
              <div>
                Last: {snapshot.testing.e2e.lastRunAt 
                  ? new Date(snapshot.testing.e2e.lastRunAt).toLocaleDateString()
                  : 'Never'
                }
              </div>
              {snapshot.testing.e2e.failedTests.length > 0 && (
                <div className="text-red-600">
                  {snapshot.testing.e2e.failedTests.length} failed
                </div>
              )}
            </div>
          </div>

          {/* Infrastructure Smoke */}
          <div className="space-y-2" data-testid="infrastructure-status">
            <div className="flex items-center gap-2 font-medium">
              <Activity className="h-4 w-4" />
              Infrastructure
              {getStatusIcon(snapshot.testing.infraSmoke.status)}
            </div>
            <div className="text-sm space-y-1">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex items-center gap-1">
                  {getStatusIcon(snapshot.testing.infraSmoke.services.api)}
                  API
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(snapshot.testing.infraSmoke.services.database)}
                  DB
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(snapshot.testing.infraSmoke.services.redis)}
                  Redis
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(snapshot.testing.infraSmoke.services.temporal)}
                  Temporal
                </div>
              </div>
            </div>
          </div>

          {/* SLO Guards */}
          <div className="space-y-2" data-testid="slo-guards-status">
            <div className="flex items-center gap-2 font-medium">
              <Shield className="h-4 w-4" />
              SLO Guards
              <div className={cn(
                "w-2 h-2 rounded-full",
                snapshot.guards.overallStatus === 'green' ? 'bg-green-500' :
                snapshot.guards.overallStatus === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              )} />
            </div>
            <div className="text-sm space-y-1">
              <div>Feed: {snapshot.guards.feedFreshnessSeconds}s</div>
              <div>Backlog: {snapshot.guards.temporalBacklogAgeSeconds}s</div>
              <div>Burn Rate: {snapshot.guards.failureBurnRateLevel}</div>
              <div>Canary: {snapshot.guards.canaryAgeSeconds || 'N/A'}s</div>
              {snapshot.guards.violations.length > 0 && (
                <div className="text-red-600 text-xs">
                  {snapshot.guards.violations.length} violation(s)
                </div>
              )}
            </div>
          </div>

          {/* Incidents */}
          <div className="space-y-2" data-testid="incidents-status">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Incidents (24h)
              {getStatusIcon(snapshot.incidents.critical === 0)}
            </div>
            <div className="text-sm space-y-1">
              <div>Total: {snapshot.incidents.last24h}</div>
              <div>Critical: {snapshot.incidents.critical}</div>
              <div>Active: {snapshot.incidents.activeIncidents.length}</div>
              {snapshot.incidents.activeIncidents.length > 0 && (
                <div className="text-red-600 text-xs">
                  {snapshot.incidents.activeIncidents[0].title}
                </div>
              )}
            </div>
          </div>

          {/* System Health */}
          <div className="space-y-2" data-testid="system-health-status">
            <div className="flex items-center gap-2 font-medium">
              <Activity className="h-4 w-4" />
              System Health
              {getStatusIcon(
                snapshot.systemHealth.apiResponseTime < 100 && 
                snapshot.systemHealth.errorRate < 0.5
              )}
            </div>
            <div className="text-sm space-y-1">
              <div>API: {snapshot.systemHealth.apiResponseTime}ms</div>
              <div>DB: {snapshot.systemHealth.databaseLatency}ms</div>
              <div>Error Rate: {snapshot.systemHealth.errorRate}%</div>
              <div>Users: {snapshot.systemHealth.activeUsers}</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Deployment Gates Summary */}
        <div className="space-y-3" data-testid="deployment-gates">
          <h3 className="font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Deployment Gates
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-2" data-testid="gate-e2e-tests">
              {getStatusIcon(snapshot.deploymentReadiness.gates.e2eTests)}
              E2E Tests
            </div>
            <div className="flex items-center gap-2" data-testid="gate-rehearsal">
              {getStatusIcon(snapshot.deploymentReadiness.gates.rehearsalFreshness)}
              Rehearsal
            </div>
            <div className="flex items-center gap-2" data-testid="gate-build">
              {getStatusIcon(snapshot.deploymentReadiness.gates.buildArtifacts)}
              Build
            </div>
            <div className="flex items-center gap-2" data-testid="gate-security">
              {getStatusIcon(snapshot.deploymentReadiness.gates.securityScans)}
              Security
            </div>
            <div className="flex items-center gap-2" data-testid="gate-performance">
              {getStatusIcon(snapshot.deploymentReadiness.gates.performanceBaseline)}
              Performance
            </div>
            <div className="flex items-center gap-2" data-testid="gate-schema-freeze">
              {getStatusIcon(snapshot.deploymentReadiness.schemaFreezeActive)}
              Schema Freeze
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-muted-foreground">
            Generated: {new Date(snapshot.timestamp).toLocaleString()}
          </div>
          
          <div className="flex gap-2">
            {snapshot.artifacts?.deploymentPlan && (
              <Button size="sm" variant="outline" asChild>
                <a href={snapshot.artifacts.deploymentPlan} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Plan
                </a>
              </Button>
            )}
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => downloadSnapshot('json')}
              data-testid="download-json-button"
            >
              <Download className="h-3 w-3 mr-1" />
              JSON
            </Button>
            
            <Button
              size="sm"
              variant={snapshot.overallReady ? "default" : "destructive"}
              disabled={!snapshot.overallReady}
              data-testid="deploy-readiness-button"
            >
              {snapshot.overallReady ? "Ready to Deploy" : "Blocked"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ExecutiveReadinessCard