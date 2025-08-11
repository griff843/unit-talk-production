'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Target, 
  Bot,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Settings,
  Shield,
  Eye
} from 'lucide-react'
import { useState, useEffect } from 'react'

type PipelineHealthData = {
  total_picks_24h: number;
  system_picks_24h: number;
  manual_picks_24h: number;
  writer_audit_percentage: number;
  status: string;
  last_updated: string;
}

export default function DashboardPage() {
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPipelineHealth = async () => {
      try {
        const response = await fetch('/api/pipeline/health')
        if (!response.ok) {
          throw new Error('Failed to fetch pipeline health')
        }
        const data = await response.json()
        setPipelineHealth(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchPipelineHealth()
    // Refresh every 30 seconds
    const interval = setInterval(fetchPipelineHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/pipeline/health')
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline health')
      }
      const data = await response.json()
      setPipelineHealth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !pipelineHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertCircle className="w-8 h-8 mr-2" />
        Error loading dashboard data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Command Center Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time pipeline monitoring and system health
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Pipeline Health Metrics */}
      {pipelineHealth && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Picks (24h)</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineHealth.total_picks_24h.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All picks processed in last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Picks</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineHealth.system_picks_24h.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Automated system picks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manual Picks</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineHealth.manual_picks_24h.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Manually submitted picks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="text-2xl font-bold">
                  <Badge variant={pipelineHealth.status === 'healthy' ? 'default' : 'destructive'}>
                    {pipelineHealth.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Overall pipeline status
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Endpoints Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            API Endpoints
          </CardTitle>
          <CardDescription>
            Available monitoring endpoints and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <p className="font-medium">Pipeline Health</p>
                <p className="text-sm text-muted-foreground">/api/pipeline/health</p>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <p className="font-medium">Pipeline Lag</p>
                <p className="text-sm text-muted-foreground">/api/pipeline/lag</p>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <p className="font-medium">Recent Promotions</p>
                <p className="text-sm text-muted-foreground">/api/pipeline/recent-promotions</p>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <p className="font-medium">Promo Backlog</p>
                <p className="text-sm text-muted-foreground">/api/pipeline/promo-backlog</p>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            System Information
          </CardTitle>
          <CardDescription>
            Command Center deployment and configuration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-medium text-blue-800">Next.js 14.0.4</p>
                  <p className="text-sm text-blue-600">Command Center running on port 3004</p>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Production Ready</Badge>
            </div>

            {pipelineHealth && (
              <div className="text-xs text-muted-foreground">
                <Clock className="w-4 h-4 inline mr-1" />
                Last updated: {new Date(pipelineHealth.last_updated).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}