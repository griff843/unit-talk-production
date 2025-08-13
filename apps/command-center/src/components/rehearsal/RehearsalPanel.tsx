'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Activity,
  Settings,
  ShieldCheck,
  Database,
  GitBranch,
  Monitor,
  TrendingUp,
  Eye,
  AlertCircle
} from 'lucide-react'

interface RehearsalStatus {
  isRunning: boolean
  activeColor: 'blue' | 'green'
  currentStep: string | null
  progress: number
  lastRun: string | null
  lastResult: 'passed' | 'failed' | null
  environment: 'staging' | 'prod'
  uptime: number
}

interface RehearsalConfig {
  canaryPercent: number
  incidentSimulation: boolean
  drTesting: boolean
  rollbackDrill: boolean
  autoSwitchTraffic: boolean
}

interface SystemHealth {
  database: 'healthy' | 'warning' | 'critical'
  services: 'healthy' | 'warning' | 'critical'
  monitoring: 'healthy' | 'warning' | 'critical'
  blueGreen: 'healthy' | 'warning' | 'critical'
}

export function RehearsalPanel() {
  const [status, setStatus] = useState<RehearsalStatus>({
    isRunning: false,
    activeColor: 'blue',
    currentStep: null,
    progress: 0,
    lastRun: null,
    lastResult: null,
    environment: 'staging',
    uptime: 0
  })

  const [config, setConfig] = useState<RehearsalConfig>({
    canaryPercent: 10,
    incidentSimulation: true,
    drTesting: true,
    rollbackDrill: true,
    autoSwitchTraffic: false
  })

  const [health, setHealth] = useState<SystemHealth>({
    database: 'healthy',
    services: 'healthy',
    monitoring: 'healthy',
    blueGreen: 'healthy'
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch rehearsal status on component mount
    fetchRehearsalStatus()
    
    // Set up polling for real-time updates every 5 seconds
    const interval = setInterval(fetchRehearsalStatus, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchRehearsalStatus = async () => {
    try {
      const response = await fetch('/api/rehearsal/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch rehearsal status:', error)
    }
  }

  const startRehearsal = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rehearsal/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: status.environment,
          config: config
        })
      })
      
      if (response.ok) {
        setStatus(prev => ({ ...prev, isRunning: true }))
      } else {
        console.error('Failed to start rehearsal')
      }
    } catch (error) {
      console.error('Error starting rehearsal:', error)
    } finally {
      setLoading(false)
    }
  }

  const stopRehearsal = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rehearsal/stop', {
        method: 'POST'
      })
      
      if (response.ok) {
        setStatus(prev => ({ ...prev, isRunning: false }))
      }
    } catch (error) {
      console.error('Error stopping rehearsal:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchActiveColor = async (color: 'blue' | 'green') => {
    setLoading(true)
    try {
      const response = await fetch('/api/rehearsal/switch-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeColor: color })
      })
      
      if (response.ok) {
        setStatus(prev => ({ ...prev, activeColor: color }))
      }
    } catch (error) {
      console.error('Error switching active color:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetToBlue = async () => {
    await switchActiveColor('blue')
  }

  const getHealthIcon = (healthStatus: 'healthy' | 'warning' | 'critical') => {
    switch (healthStatus) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getHealthColor = (healthStatus: 'healthy' | 'warning' | 'critical') => {
    switch (healthStatus) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <CardTitle>Go-Live Rehearsal Suite</CardTitle>
            </div>
            
            {/* Active Color Badge */}
            <div className="flex items-center space-x-2">
              <Label className="text-sm text-muted-foreground">Active:</Label>
              <Badge 
                variant={status.activeColor === 'blue' ? 'default' : 'secondary'}
                className={`font-mono ${
                  status.activeColor === 'blue' 
                    ? 'bg-blue-100 text-blue-800 border-blue-200' 
                    : 'bg-green-100 text-green-800 border-green-200'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  status.activeColor === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                }`} />
                {status.activeColor.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Environment Badge */}
          <Badge 
            variant={status.environment === 'prod' ? 'destructive' : 'secondary'}
            className="font-mono"
          >
            {status.environment.toUpperCase()}
          </Badge>
        </div>
        
        <CardDescription>
          Automated blue/green deployment rehearsal with incident simulation and rollback testing
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Rehearsal Status
            </h3>
            
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                status.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">
                {status.isRunning ? 'RUNNING' : 'IDLE'}
              </span>
            </div>
          </div>

          {status.isRunning && status.currentStep && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Step:</span>
                <span className="text-sm font-medium">{status.currentStep}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              
              <div className="text-xs text-muted-foreground text-right">
                {status.progress}% Complete
              </div>
            </div>
          )}

          {/* Last Run Info */}
          {status.lastRun && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Last Run:</span>
                <div className="font-mono text-xs">
                  {new Date(status.lastRun).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Result:</span>
                <Badge 
                  variant={status.lastResult === 'passed' ? 'default' : 'destructive'}
                  className="ml-2"
                >
                  {status.lastResult === 'passed' ? '✅ PASSED' : '❌ FAILED'}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* System Health */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Monitor className="w-4 h-4 mr-2" />
            System Health
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg border ${getHealthColor(health.database)}`}>
              <div className="flex items-center justify-between">
                <Database className="w-4 h-4" />
                {getHealthIcon(health.database)}
              </div>
              <div className="mt-2">
                <p className="text-xs font-medium">Database</p>
                <p className="text-xs capitalize">{health.database}</p>
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${getHealthColor(health.services)}`}>
              <div className="flex items-center justify-between">
                <Settings className="w-4 h-4" />
                {getHealthIcon(health.services)}
              </div>
              <div className="mt-2">
                <p className="text-xs font-medium">Services</p>
                <p className="text-xs capitalize">{health.services}</p>
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${getHealthColor(health.monitoring)}`}>
              <div className="flex items-center justify-between">
                <TrendingUp className="w-4 h-4" />
                {getHealthIcon(health.monitoring)}
              </div>
              <div className="mt-2">
                <p className="text-xs font-medium">Monitoring</p>
                <p className="text-xs capitalize">{health.monitoring}</p>
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${getHealthColor(health.blueGreen)}`}>
              <div className="flex items-center justify-between">
                <GitBranch className="w-4 h-4" />
                {getHealthIcon(health.blueGreen)}
              </div>
              <div className="mt-2">
                <p className="text-xs font-medium">Blue/Green</p>
                <p className="text-xs capitalize">{health.blueGreen}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Rehearsal Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="canary-percent" className="text-sm">
                  Canary Traffic %
                </Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {config.canaryPercent}%
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="incident-simulation"
                  checked={config.incidentSimulation}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, incidentSimulation: checked }))
                  }
                />
                <Label htmlFor="incident-simulation" className="text-sm">
                  Incident Simulation
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="dr-testing"
                  checked={config.drTesting}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, drTesting: checked }))
                  }
                />
                <Label htmlFor="dr-testing" className="text-sm">
                  Disaster Recovery Testing
                </Label>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="rollback-drill"
                  checked={config.rollbackDrill}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, rollbackDrill: checked }))
                  }
                />
                <Label htmlFor="rollback-drill" className="text-sm">
                  Rollback Procedure Drill
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-switch"
                  checked={config.autoSwitchTraffic}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, autoSwitchTraffic: checked }))
                  }
                />
                <Label htmlFor="auto-switch" className="text-sm">
                  Auto-switch Traffic
                </Label>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Control Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Rehearsal Controls</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={startRehearsal}
              disabled={status.isRunning || loading}
              className="flex items-center space-x-2"
              size="sm"
            >
              <Play className="w-4 h-4" />
              <span>Start Rehearsal</span>
            </Button>

            <Button
              onClick={stopRehearsal}
              disabled={!status.isRunning || loading}
              variant="destructive"
              className="flex items-center space-x-2"
              size="sm"
            >
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </Button>

            <Button
              onClick={() => switchActiveColor('green')}
              disabled={loading || status.activeColor === 'green'}
              variant="outline"
              className="flex items-center space-x-2"
              size="sm"
            >
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Switch to Green</span>
            </Button>

            <Button
              onClick={resetToBlue}
              disabled={loading || status.activeColor === 'blue'}
              variant="outline"
              className="flex items-center space-x-2"
              size="sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Blue</span>
            </Button>
          </div>
        </div>

        {/* Emergency Controls */}
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Emergency Controls</span>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="destructive" size="sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Emergency Stop
              </Button>
              
              <Button variant="outline" size="sm" className="border-red-300 text-red-700">
                <Eye className="w-4 h-4 mr-2" />
                View Logs
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}