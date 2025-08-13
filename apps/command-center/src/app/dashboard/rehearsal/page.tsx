'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { RehearsalPanel } from '@/components/rehearsal/RehearsalPanel'
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Play,
  Square,
  RotateCcw,
  Eye,
  TrendingUp,
  Activity
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface RehearsalLog {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  step?: string
}

interface RehearsalReport {
  id: string
  timestamp: string
  environment: 'staging' | 'prod'
  result: 'passed' | 'failed'
  duration: number
  steps: number
  issues: number
  reportUrl: string
}

export default function RehearsalPage() {
  const [logs, setLogs] = useState<RehearsalLog[]>([])
  const [reports, setReports] = useState<RehearsalReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRehearsalData()
    
    // Set up polling for real-time logs
    const interval = setInterval(fetchLogs, 2000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchRehearsalData = async () => {
    try {
      await Promise.all([
        fetchLogs(),
        fetchReports()
      ])
    } catch (error) {
      console.error('Error fetching rehearsal data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/rehearsal/logs')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/rehearsal/reports')
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <Activity className="w-4 h-4 text-blue-500" />
    }
  }

  const getLogColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200'
    }
  }

  const downloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/rehearsal/reports/${reportId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rehearsal-report-${reportId}.md`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading report:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading rehearsal data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Go-Live Rehearsal Center</h1>
          <p className="text-muted-foreground">
            Comprehensive rehearsal management and monitoring
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchRehearsalData}>
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm" asChild>
            <a href="https://github.com/unit-talk/platform/actions/workflows/go-live-rehearsal.yml" target="_blank">
              <ExternalLink className="w-4 h-4 mr-2" />
              GitHub Actions
            </a>
          </Button>
        </div>
      </div>

      {/* Main Rehearsal Panel */}
      <RehearsalPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-Time Logs */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Real-Time Logs
            </CardTitle>
            <CardDescription>
              Live rehearsal execution logs and system events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No rehearsal logs available</p>
                  <p className="text-xs">Start a rehearsal to see live logs</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border ${getLogColor(log.level)}`}
                  >
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {log.step && (
                          <Badge variant="outline" className="text-xs">
                            {log.step}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1 break-words">{log.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rehearsal History */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Rehearsal History
            </CardTitle>
            <CardDescription>
              Previous rehearsal results and reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No rehearsal reports available</p>
                  <p className="text-xs">Complete a rehearsal to generate reports</p>
                </div>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={report.result === 'passed' ? 'default' : 'destructive'}
                          className="font-mono"
                        >
                          {report.result === 'passed' ? '✅ PASSED' : '❌ FAILED'}
                        </Badge>
                        
                        <Badge variant="outline" className="font-mono">
                          {report.environment.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-4">
                          <span>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {Math.round(report.duration / 1000)}s
                          </span>
                          <span>
                            <TrendingUp className="w-3 h-3 inline mr-1" />
                            {report.steps} steps
                          </span>
                          {report.issues > 0 && (
                            <span className="text-red-600">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              {report.issues} issues
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-1">
                          {new Date(report.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReport(report.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={report.reportUrl} target="_blank">
                          <Eye className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions & Documentation</CardTitle>
          <CardDescription>
            Common rehearsal operations and helpful resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
              <Play className="w-6 h-6" />
              <span>Start Staging Rehearsal</span>
            </Button>
            
            <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
              <RotateCcw className="w-6 h-6" />
              <span>Rollback to Blue</span>
            </Button>
            
            <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4" asChild>
              <a href="/docs/ops/GO_LIVE_REHEARSAL.md" target="_blank">
                <FileText className="w-6 h-6" />
                <span>Operations Guide</span>
              </a>
            </Button>
            
            <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4" asChild>
              <a href="https://github.com/unit-talk/platform/actions" target="_blank">
                <ExternalLink className="w-6 h-6" />
                <span>CI/CD Workflows</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>
                <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
                Rehearsal System: Operational
              </span>
              <span>
                <Activity className="w-4 h-4 inline mr-1 text-blue-500" />
                Blue/Green: Ready
              </span>
            </div>
            
            <div>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}