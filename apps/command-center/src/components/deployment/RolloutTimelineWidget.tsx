'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle, AlertCircle, XCircle, Play, Pause, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface GuardStatus {
  feedFreshnessSeconds: number
  temporalBacklogAgeSeconds: number
  failureBurnRateLevel: string
  canaryLastSeenAt: string
  overallStatus: 'green' | 'yellow' | 'red'
}

interface DeploymentStatus {
  phase: 'idle' | 'canary10' | 'canary50' | 'full' | 'rolling_back' | 'completed' | 'failed'
  since: string
  guards: GuardStatus
  deploymentId?: string
  targetSha?: string
  triggeredBy?: string
  canaryPercent: number
  duration?: number
  nextPhase?: string
  nextPhaseEta?: string
}

interface RolloutStep {
  id: string
  name: string
  phase: string
  percentage: number
  status: 'pending' | 'active' | 'completed' | 'failed'
  startTime?: string
  endTime?: string
  duration?: number
}

interface RolloutTimelineWidgetProps {
  className?: string
}

export function RolloutTimelineWidget({ className }: RolloutTimelineWidgetProps) {
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({
    phase: 'idle',
    since: new Date().toISOString(),
    guards: {
      feedFreshnessSeconds: 0,
      temporalBacklogAgeSeconds: 0,
      failureBurnRateLevel: 'green',
      canaryLastSeenAt: new Date().toISOString(),
      overallStatus: 'green'
    },
    canaryPercent: 0
  })
  
  const [rolloutSteps, setRolloutSteps] = useState<RolloutStep[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Define rollout steps template
  const ROLLOUT_STEPS: Omit<RolloutStep, 'status' | 'startTime' | 'endTime' | 'duration'>[] = [
    { id: 'idle', name: 'Ready', phase: 'idle', percentage: 0 },
    { id: 'canary10', name: '10% Canary', phase: 'canary10', percentage: 10 },
    { id: 'canary50', name: '50% Canary', phase: 'canary50', percentage: 50 },
    { id: 'full', name: 'Full Rollout', phase: 'full', percentage: 100 }
  ]

  useEffect(() => {
    fetchDeploymentStatus()
    
    // Poll every 10 seconds for status updates
    const interval = setInterval(fetchDeploymentStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    updateRolloutSteps()
  }, [deploymentStatus])

  const fetchDeploymentStatus = async () => {
    try {
      const response = await fetch('/api/ops/deploy/status')
      if (response.ok) {
        const status = await response.json()
        setDeploymentStatus(status)
      }
    } catch (error) {
      console.error('Failed to fetch deployment status:', error)
    }
  }

  const updateRolloutSteps = () => {
    const steps = ROLLOUT_STEPS.map(step => {
      const currentPhase = deploymentStatus.phase
      
      let status: RolloutStep['status'] = 'pending'
      
      if (step.phase === currentPhase) {
        status = deploymentStatus.phase === 'failed' ? 'failed' : 'active'
      } else if (shouldStepBeCompleted(step.phase, currentPhase)) {
        status = 'completed'
      } else if (deploymentStatus.phase === 'failed' && shouldStepBeCompleted(step.phase, currentPhase)) {
        status = 'failed'
      }

      return {
        ...step,
        status,
        startTime: status === 'active' ? deploymentStatus.since : undefined,
        endTime: status === 'completed' ? deploymentStatus.since : undefined,
        duration: calculateStepDuration(step.phase, deploymentStatus)
      }
    })

    setRolloutSteps(steps)
  }

  const shouldStepBeCompleted = (stepPhase: string, currentPhase: string): boolean => {
    const phaseOrder = ['idle', 'canary10', 'canary50', 'full', 'completed']
    const stepIndex = phaseOrder.indexOf(stepPhase)
    const currentIndex = phaseOrder.indexOf(currentPhase)
    return stepIndex < currentIndex
  }

  const calculateStepDuration = (stepPhase: string, status: DeploymentStatus): number | undefined => {
    if (stepPhase === status.phase && status.duration) {
      return status.duration
    }
    return undefined
  }

  const abortDeployment = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/ops/deploy/abort', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Manual abort from Command Center',
          deploymentId: deploymentStatus.deploymentId
        })
      })

      if (response.ok) {
        toast({
          title: 'Deployment Aborted',
          description: 'Rollback has been initiated. Please monitor the rollback progress.',
          variant: 'destructive'
        })
        
        // Refresh status immediately
        await fetchDeploymentStatus()
      } else {
        throw new Error(`Failed to abort deployment: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Abort deployment failed:', error)
      toast({
        title: 'Abort Failed',
        description: error instanceof Error ? error.message : 'Failed to abort deployment',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getGuardStatusColor = (status: string): string => {
    switch (status) {
      case 'green': return 'text-green-600'
      case 'yellow': return 'text-yellow-600'
      case 'red': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getPhaseIcon = (status: RolloutStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'active':
        return <Play className="h-4 w-4 text-blue-600 animate-pulse" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const calculateProgress = (): number => {
    const activeStep = rolloutSteps.find(step => step.status === 'active')
    if (!activeStep) {
      const completedSteps = rolloutSteps.filter(step => step.status === 'completed').length
      return (completedSteps / rolloutSteps.length) * 100
    }
    
    const completedSteps = rolloutSteps.filter(step => step.status === 'completed').length
    const activeStepProgress = activeStep.duration ? Math.min((activeStep.duration / 900) * 100, 100) : 0 // 15min = 900s
    
    return ((completedSteps + (activeStepProgress / 100)) / rolloutSteps.length) * 100
  }

  return (
    <Card className={cn('', className)} data-testid="rollout-timeline">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Rollout Timeline
            </CardTitle>
            <CardDescription>
              Progressive deployment monitoring with SLO guards
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={
                deploymentStatus.phase === 'idle' ? 'secondary' :
                deploymentStatus.phase === 'failed' ? 'destructive' :
                deploymentStatus.phase === 'completed' ? 'default' : 'outline'
              }
            >
              {deploymentStatus.phase.toUpperCase()}
            </Badge>
            {deploymentStatus.canaryPercent > 0 && (
              <Badge variant="outline">
                {deploymentStatus.canaryPercent}% traffic
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(calculateProgress())}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
        </div>

        {/* Timeline Steps */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Deployment Phases</h4>
          <div className="space-y-2">
            {rolloutSteps.map((step, index) => (
              <div 
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  step.status === 'active' && 'bg-blue-50 border-blue-200',
                  step.status === 'completed' && 'bg-green-50 border-green-200',
                  step.status === 'failed' && 'bg-red-50 border-red-200',
                  step.status === 'pending' && 'bg-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getPhaseIcon(step.status)}
                  <div>
                    <div className="font-medium text-sm">{step.name}</div>
                    {step.status === 'active' && step.duration && (
                      <div className="text-xs text-gray-600">
                        Running for {formatDuration(step.duration)}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-mono">{step.percentage}%</div>
                  {step.endTime && (
                    <div className="text-xs text-gray-500">
                      {new Date(step.endTime).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLO Guards Status */}
        {deploymentStatus.phase !== 'idle' && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">SLO Guards Status</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="text-xs font-medium text-gray-600 mb-1">Feed Freshness</div>
                <div className={cn(
                  'font-mono text-sm',
                  deploymentStatus.guards.feedFreshnessSeconds > 300 ? 'text-red-600' : 'text-green-600'
                )}>
                  {deploymentStatus.guards.feedFreshnessSeconds}s
                </div>
                <div className="text-xs text-gray-500">max: 300s</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="text-xs font-medium text-gray-600 mb-1">Temporal Backlog</div>
                <div className={cn(
                  'font-mono text-sm',
                  deploymentStatus.guards.temporalBacklogAgeSeconds > 300 ? 'text-red-600' : 'text-green-600'
                )}>
                  {deploymentStatus.guards.temporalBacklogAgeSeconds}s
                </div>
                <div className="text-xs text-gray-500">max: 300s</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="text-xs font-medium text-gray-600 mb-1">Failure Burn Rate</div>
                <div className={cn('font-mono text-sm capitalize', getGuardStatusColor(deploymentStatus.guards.failureBurnRateLevel))}>
                  {deploymentStatus.guards.failureBurnRateLevel}
                </div>
                <div className="text-xs text-gray-500">must not be red</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="text-xs font-medium text-gray-600 mb-1">Canary Health</div>
                <div className={cn(
                  'font-mono text-sm',
                  new Date().getTime() - new Date(deploymentStatus.guards.canaryLastSeenAt).getTime() > 90000 
                    ? 'text-red-600' : 'text-green-600'
                )}>
                  {Math.round((new Date().getTime() - new Date(deploymentStatus.guards.canaryLastSeenAt).getTime()) / 1000)}s ago
                </div>
                <div className="text-xs text-gray-500">max: 90s</div>
              </div>
            </div>
            
            {/* Overall Guard Status */}
            <div className="p-3 rounded-lg border-2 bg-white">
              <div className="flex items-center justify-between">
                <span className="font-medium">Overall Guard Status</span>
                <Badge 
                  variant={
                    deploymentStatus.guards.overallStatus === 'green' ? 'default' :
                    deploymentStatus.guards.overallStatus === 'yellow' ? 'outline' : 'destructive'
                  }
                  className={cn(
                    'font-mono',
                    deploymentStatus.guards.overallStatus === 'green' && 'bg-green-100 text-green-800 border-green-200',
                    deploymentStatus.guards.overallStatus === 'yellow' && 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  )}
                >
                  {deploymentStatus.guards.overallStatus.toUpperCase()}
                </Badge>
              </div>
              {deploymentStatus.guards.overallStatus !== 'green' && (
                <div className="text-sm text-yellow-600 mt-2">
                  ⚠️ Auto-rollback if red guard status detected
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deployment Info */}
        {deploymentStatus.deploymentId && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Deployment ID:</span>
              <span className="font-mono">{deploymentStatus.deploymentId}</span>
            </div>
            {deploymentStatus.targetSha && (
              <div className="flex justify-between">
                <span className="text-gray-600">Target SHA:</span>
                <span className="font-mono">{deploymentStatus.targetSha.slice(0, 8)}</span>
              </div>
            )}
            {deploymentStatus.triggeredBy && (
              <div className="flex justify-between">
                <span className="text-gray-600">Triggered By:</span>
                <span>{deploymentStatus.triggeredBy}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Started:</span>
              <span>{new Date(deploymentStatus.since).toLocaleString()}</span>
            </div>
            {deploymentStatus.nextPhaseEta && (
              <div className="flex justify-between">
                <span className="text-gray-600">Next Phase ETA:</span>
                <span>{new Date(deploymentStatus.nextPhaseEta).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {deploymentStatus.phase !== 'idle' && deploymentStatus.phase !== 'completed' && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={abortDeployment}
              disabled={isLoading || deploymentStatus.phase === 'rolling_back'}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Pause className="h-4 w-4 mr-2 animate-spin" />
                  Initiating Rollback...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Abort Deployment & Rollback
                </>
              )}
            </Button>
            
            <div className="text-center text-xs text-gray-500 mt-2">
              This will trigger immediate rollback to the last stable deployment
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}