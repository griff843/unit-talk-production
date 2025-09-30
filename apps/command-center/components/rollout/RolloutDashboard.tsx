'use client';

/**
 * Rollout Dashboard - Command Center Integration
 *
 * Comprehensive dashboard for monitoring and controlling the shadow→canary→full
 * rollout system with real-time metrics, kill switches, and emergency controls
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Pause,
  Square,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Activity,
  BarChart3,
  Shield,
  Zap,
  RefreshCw,
  Settings,
  Eye,
  Target,
  Rocket,
  AlertOctagon
} from 'lucide-react';

interface RolloutStatus {
  rolloutId: string;
  phase: 'shadow' | 'canary' | 'full';
  status: 'planning' | 'in_progress' | 'completed' | 'paused' | 'failed' | 'rolled_back';
  startTime: string;
  endTime?: string;
  currentPhase: RolloutPhase;
  phaseProgress: number;
  metrics: RolloutMetrics;
  segments?: SegmentStatus;
  killSwitchStatus: KillSwitchStatus[];
  validationResults: ValidationGateResult[];
  lastCheckpoint: string;
}

interface RolloutPhase {
  name: 'shadow' | 'canary' | 'full';
  description: string;
  requirements: string[];
  duration: {
    min: number;
    max: number;
    stabilization: number;
  };
}

interface RolloutMetrics {
  cacheHitRate: number;
  averageLatency: number;
  errorRate: number;
  alertPrecision: number;
  dataConsistencyRate: number;
  creditUsage: {
    current: number;
    baseline: number;
    efficiency: number;
  };
  usersAffected: number;
  performanceScore: number;
}

interface SegmentStatus {
  activeSegments: number;
  totalUsers: number;
  segmentPerformance: Record<string, number>;
  segmentHealth: Record<string, 'healthy' | 'warning' | 'critical'>;
}

interface KillSwitchStatus {
  name: string;
  armed: boolean;
  triggered: boolean;
  lastCheck: string;
  currentValue: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
}

interface ValidationGateResult {
  gateName: string;
  type: string;
  passed: boolean;
  actualValue: number;
  threshold: number;
  weight: number;
  timestamp: string;
  retryCount: number;
  error?: string;
}

export function RolloutDashboard() {
  const [rolloutStatus, setRolloutStatus] = useState<RolloutStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchRolloutStatus();
    const interval = setInterval(fetchRolloutStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRolloutStatus = async () => {
    try {
      const response = await fetch('/api/rollout/status');
      if (response.ok) {
        const data = await response.json();
        setRolloutStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch rollout status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRollout = async () => {
    try {
      const response = await fetch('/api/rollout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unified_picks_migration: true,
          cache_first_architecture: true,
          shadow_mode_enabled: true,
          alert_system_changes: true,
          retention_sweeps_enabled: true,
          clv_tracking_enabled: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Rollout started:', result.rolloutId);
        fetchRolloutStatus();
      }
    } catch (error) {
      console.error('Failed to start rollout:', error);
    }
  };

  const handlePauseRollout = async () => {
    if (!rolloutStatus?.rolloutId) return;

    try {
      await fetch(`/api/rollout/${rolloutStatus.rolloutId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual pause from Command Center' })
      });
      fetchRolloutStatus();
    } catch (error) {
      console.error('Failed to pause rollout:', error);
    }
  };

  const handleResumeRollout = async () => {
    if (!rolloutStatus?.rolloutId) return;

    try {
      await fetch(`/api/rollout/${rolloutStatus.rolloutId}/resume`, {
        method: 'POST'
      });
      fetchRolloutStatus();
    } catch (error) {
      console.error('Failed to resume rollout:', error);
    }
  };

  const handleEmergencyRollback = async () => {
    if (!rolloutStatus?.rolloutId) return;

    const confirmed = confirm(
      'EMERGENCY ROLLBACK: This will immediately revert all rollout changes. This action cannot be undone. Continue?'
    );

    if (confirmed) {
      try {
        await fetch(`/api/rollout/${rolloutStatus.rolloutId}/emergency-rollback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Emergency rollback from Command Center' })
        });
        fetchRolloutStatus();
      } catch (error) {
        console.error('Failed to trigger emergency rollback:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading rollout status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rollout Management</h1>
          <p className="text-muted-foreground">
            Shadow → Canary → Full deployment orchestration for unified_picks architecture
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {!rolloutStatus ? (
            <Button onClick={handleStartRollout} className="bg-green-600 hover:bg-green-700">
              <Rocket className="w-4 h-4 mr-2" />
              Start Rollout
            </Button>
          ) : (
            <>
              {rolloutStatus.status === 'in_progress' ? (
                <Button onClick={handlePauseRollout} variant="outline">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              ) : rolloutStatus.status === 'paused' ? (
                <Button onClick={handleResumeRollout} className="bg-blue-600 hover:bg-blue-700">
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              ) : null}

              <Button
                onClick={handleEmergencyRollback}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                <AlertOctagon className="w-4 h-4 mr-2" />
                Emergency Rollback
              </Button>
            </>
          )}
          <Button onClick={fetchRolloutStatus} variant="ghost" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {rolloutStatus ? (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="phases">Phases</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="killswitches">Kill Switches</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <RolloutOverview rolloutStatus={rolloutStatus} />
          </TabsContent>

          {/* Phases Tab */}
          <TabsContent value="phases" className="space-y-6">
            <RolloutPhases rolloutStatus={rolloutStatus} />
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-6">
            <RolloutMetricsView metrics={rolloutStatus.metrics} />
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments" className="space-y-6">
            {rolloutStatus.segments ? (
              <SegmentView segments={rolloutStatus.segments} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No segment data available for current phase
              </div>
            )}
          </TabsContent>

          {/* Kill Switches Tab */}
          <TabsContent value="killswitches" className="space-y-6">
            <KillSwitchView killSwitches={rolloutStatus.killSwitchStatus} />
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validation" className="space-y-6">
            <ValidationView validationResults={rolloutStatus.validationResults} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <Eye className="w-16 h-16 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-semibold">No Active Rollout</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Start a new rollout to begin the shadow→canary→full deployment process
                for the unified_picks + cache-first architecture migration.
              </p>
              <Button onClick={handleStartRollout} className="bg-green-600 hover:bg-green-700">
                <Rocket className="w-4 h-4 mr-2" />
                Start New Rollout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RolloutOverview({ rolloutStatus }: { rolloutStatus: RolloutStatus }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'rolled_back': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'shadow': return <Shield className="w-4 h-4" />;
      case 'canary': return <Target className="w-4 h-4" />;
      case 'full': return <Rocket className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Rollout Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Phase:</span>
            <Badge variant="secondary" className="flex items-center space-x-1">
              {getPhaseIcon(rolloutStatus.phase)}
              <span className="capitalize">{rolloutStatus.phase}</span>
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge className={`${getStatusColor(rolloutStatus.status)} text-white`}>
              {rolloutStatus.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress:</span>
              <span>{rolloutStatus.phaseProgress}%</span>
            </div>
            <Progress value={rolloutStatus.phaseProgress} className="h-2" />
          </div>
          <div className="flex items-center justify-between">
            <span>Started:</span>
            <span className="text-sm text-muted-foreground">
              {new Date(rolloutStatus.startTime).toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Key Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Cache Hit Rate:</span>
            <Badge variant={rolloutStatus.metrics.cacheHitRate >= 80 ? 'default' : 'destructive'}>
              {rolloutStatus.metrics.cacheHitRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Error Rate:</span>
            <Badge variant={rolloutStatus.metrics.errorRate <= 0.02 ? 'default' : 'destructive'}>
              {(rolloutStatus.metrics.errorRate * 100).toFixed(2)}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Alert Precision:</span>
            <Badge variant={rolloutStatus.metrics.alertPrecision >= 95 ? 'default' : 'destructive'}>
              {rolloutStatus.metrics.alertPrecision.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Performance Score:</span>
            <Badge variant={rolloutStatus.metrics.performanceScore >= 90 ? 'default' : 'destructive'}>
              {rolloutStatus.metrics.performanceScore.toFixed(0)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Users Affected */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Impact</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {rolloutStatus.metrics.usersAffected.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Users Affected</div>
          </div>
          {rolloutStatus.segments && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span>Active Segments:</span>
                <Badge>{rolloutStatus.segments.activeSegments}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Users:</span>
                <Badge>{rolloutStatus.segments.totalUsers.toLocaleString()}</Badge>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span>Credit Efficiency:</span>
            <Badge variant={rolloutStatus.metrics.creditUsage.efficiency >= 100 ? 'default' : 'destructive'}>
              {rolloutStatus.metrics.creditUsage.efficiency.toFixed(1)}%
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RolloutPhases({ rolloutStatus }: { rolloutStatus: RolloutStatus }) {
  const phases = [
    {
      id: 'shadow',
      name: 'Shadow Mode',
      description: 'Dual writes with cache validation, no Discord alerts',
      icon: <Shield className="w-5 h-5" />,
      requirements: ['Cache infrastructure ready', 'Unified_picks schema deployed', 'Monitoring active']
    },
    {
      id: 'canary',
      name: 'Canary Deployment',
      description: 'Segment-based rollout with Discord alerts enabled',
      icon: <Target className="w-5 h-5" />,
      requirements: ['Shadow phase validated', 'Segment allocation ready', 'Alert precision validated']
    },
    {
      id: 'full',
      name: 'Full Rollout',
      description: 'Complete migration with unified_picks and cleanup',
      icon: <Rocket className="w-5 h-5" />,
      requirements: ['Canary phase successful', 'Performance targets met', 'CLV tracking ready']
    }
  ];

  const getCurrentPhaseStatus = (phaseId: string) => {
    if (rolloutStatus.phase === phaseId) {
      return rolloutStatus.status === 'completed' ? 'completed' : 'in_progress';
    } else {
      // Check if this phase comes before current phase
      const phaseOrder = ['shadow', 'canary', 'full'];
      const currentIndex = phaseOrder.indexOf(rolloutStatus.phase);
      const phaseIndex = phaseOrder.indexOf(phaseId);
      return phaseIndex < currentIndex ? 'completed' : 'pending';
    }
  };

  return (
    <div className="space-y-4">
      {phases.map((phase, index) => {
        const status = getCurrentPhaseStatus(phase.id);
        const isActive = rolloutStatus.phase === phase.id;

        return (
          <Card key={phase.id} className={isActive ? 'border-blue-500 bg-blue-50' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className={`rounded-full p-2 ${
                  status === 'completed' ? 'bg-green-100 text-green-600' :
                  status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {status === 'completed' ? <CheckCircle className="w-5 h-5" /> : phase.icon}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{phase.name}</h3>
                      <p className="text-muted-foreground">{phase.description}</p>
                    </div>
                    <Badge variant={
                      status === 'completed' ? 'default' :
                      status === 'in_progress' ? 'secondary' :
                      'outline'
                    }>
                      {status === 'in_progress' ? `${rolloutStatus.phaseProgress}%` : status}
                    </Badge>
                  </div>

                  {isActive && status === 'in_progress' && (
                    <Progress value={rolloutStatus.phaseProgress} className="h-2" />
                  )}

                  <div className="space-y-1">
                    <div className="text-sm font-medium">Requirements:</div>
                    <div className="flex flex-wrap gap-1">
                      {phase.requirements.map((req, reqIndex) => (
                        <Badge key={reqIndex} variant="outline" className="text-xs">
                          {req}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RolloutMetricsView({ metrics }: { metrics: RolloutMetrics }) {
  const metricsConfig = [
    {
      name: 'Cache Hit Rate',
      value: metrics.cacheHitRate,
      unit: '%',
      threshold: 80,
      type: 'higher_is_better',
      icon: <Zap className="w-4 h-4" />
    },
    {
      name: 'Average Latency',
      value: metrics.averageLatency,
      unit: 'ms',
      threshold: 2000,
      type: 'lower_is_better',
      icon: <Activity className="w-4 h-4" />
    },
    {
      name: 'Error Rate',
      value: metrics.errorRate * 100,
      unit: '%',
      threshold: 2,
      type: 'lower_is_better',
      icon: <AlertTriangle className="w-4 h-4" />
    },
    {
      name: 'Alert Precision',
      value: metrics.alertPrecision,
      unit: '%',
      threshold: 95,
      type: 'higher_is_better',
      icon: <Target className="w-4 h-4" />
    },
    {
      name: 'Data Consistency',
      value: metrics.dataConsistencyRate,
      unit: '%',
      threshold: 99.9,
      type: 'higher_is_better',
      icon: <Shield className="w-4 h-4" />
    },
    {
      name: 'Credit Efficiency',
      value: metrics.creditUsage.efficiency,
      unit: '%',
      threshold: 100,
      type: 'higher_is_better',
      icon: <BarChart3 className="w-4 h-4" />
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metricsConfig.map((metric) => {
        const isHealthy = metric.type === 'higher_is_better'
          ? metric.value >= metric.threshold
          : metric.value <= metric.threshold;

        return (
          <Card key={metric.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {metric.icon}
                  <span className="font-medium">{metric.name}</span>
                </div>
                <Badge variant={isHealthy ? 'default' : 'destructive'}>
                  {metric.value.toFixed(metric.name === 'Average Latency' ? 0 : 1)}{metric.unit}
                </Badge>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Threshold: {metric.type === 'higher_is_better' ? '≥' : '≤'} {metric.threshold}{metric.unit}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SegmentView({ segments }: { segments: SegmentStatus }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Segment Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Active Segments:</span>
            <Badge>{segments.activeSegments}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Total Users:</span>
            <Badge>{segments.totalUsers.toLocaleString()}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segment Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(segments.segmentHealth).map(([segment, health]) => (
              <div key={segment} className="flex items-center justify-between">
                <span className="capitalize">{segment.replace('_', ' ')}</span>
                <Badge variant={
                  health === 'healthy' ? 'default' :
                  health === 'warning' ? 'secondary' : 'destructive'
                }>
                  {health}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KillSwitchView({ killSwitches }: { killSwitches: KillSwitchStatus[] }) {
  return (
    <div className="space-y-4">
      {killSwitches.map((killSwitch) => (
        <Card key={killSwitch.name}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{killSwitch.name.replace('_', ' ').toUpperCase()}</h3>
                <p className="text-sm text-muted-foreground">
                  Current: {killSwitch.currentValue.toFixed(2)} / Threshold: {killSwitch.threshold}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last checked: {new Date(killSwitch.lastCheck).toLocaleTimeString()}
                </p>
              </div>
              <div className="text-right space-y-2">
                <Badge variant={
                  killSwitch.status === 'normal' ? 'default' :
                  killSwitch.status === 'warning' ? 'secondary' : 'destructive'
                }>
                  {killSwitch.status}
                </Badge>
                {killSwitch.triggered && (
                  <div className="text-xs text-red-600 font-semibold">TRIGGERED</div>
                )}
                {killSwitch.armed && (
                  <div className="text-xs text-green-600">ARMED</div>
                )}
              </div>
            </div>
            {killSwitch.status === 'critical' && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Critical Threshold Exceeded</AlertTitle>
                <AlertDescription>
                  This kill switch is in critical state and may trigger automatic rollback.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ValidationView({ validationResults }: { validationResults: ValidationGateResult[] }) {
  return (
    <div className="space-y-4">
      {validationResults.map((result, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{result.gateName}</h3>
                <p className="text-sm text-muted-foreground capitalize">{result.type.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="text-right space-y-2">
                <Badge variant={result.passed ? 'default' : 'destructive'}>
                  {result.passed ? 'PASSED' : 'FAILED'}
                </Badge>
                <div className="text-sm">
                  <div>Value: {result.actualValue.toFixed(2)}</div>
                  <div>Threshold: {result.threshold}</div>
                  {result.retryCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Retries: {result.retryCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {result.error && (
              <Alert className="mt-4" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Error</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}