'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  Target,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  SkipForward,
  BarChart3,
  Users,
  Timer,
  Activity,
  Layers,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { usePicks } from '@/hooks/usePicks';
import { useAgentMonitoring } from '@/hooks/useAgentMonitoring';
import { toast } from 'sonner';

interface GradingQueueItem {
  id: string;
  pickId: string;
  capper: string;
  selection: string;
  odds: number;
  sport: string;
  tier?: string;
  submittedAt: string;
  priority: 'high' | 'medium' | 'low';
  estimatedProcessingTime: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  agentAssigned?: string;
  processingStartedAt?: string;
  confidence?: number;
}

interface GradingQueueProps {
  className?: string;
}

export function GradingQueue({ className }: GradingQueueProps) {
  const { picks, loading: picksLoading } = usePicks();
  const { agents, loading: agentsLoading } = useAgentMonitoring();
  const [queueItems, setQueueItems] = useState<GradingQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [processingSpeed, setProcessingSpeed] = useState<number | null>(null); // REAL: calculated from database

  // Transform picks into grading queue items and calculate real processing speed
  useEffect(() => {
    if (!picks) return;

    // Calculate real processing speed from completed picks
    const completedPicks = picks.filter(
      pick =>
        (pick.workflow_stage === 'approved' || pick.workflow_stage === 'published') &&
        pick.created_at &&
        pick.updated_at
    );

    if (completedPicks.length > 1) {
      // Calculate average processing time in minutes
      const processingTimes = completedPicks.map(pick => {
        const created = new Date(String(pick.created_at || 0)).getTime();
        const updated = new Date(String(pick.updated_at || 0)).getTime();
        return (updated - created) / (1000 * 60); // convert to minutes
      });

      const avgProcessingTimeMinutes =
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;

      // Processing speed is picks per minute (inverse of avg time)
      if (avgProcessingTimeMinutes > 0) {
        setProcessingSpeed(1 / avgProcessingTimeMinutes);
      }
    }

    const pendingPicks = picks
      .filter(pick => pick.status === 'pending' || pick.workflow_stage === 'pending_review')
      .map(pick => ({
        id: `queue-${pick.id}`,
        pickId: pick.id,
        capper: pick.capper || 'Unknown',
        selection: pick.selection || pick.player_name || pick.line || 'Unknown',
        odds: pick.odds || 0,
        sport: pick.sport || 'Unknown',
        tier: pick.tier,
        submittedAt: pick.submitted_at || pick.created_at || new Date().toISOString(),
        priority: determinePriority(pick),
        estimatedProcessingTime: 0, // NO ESTIMATE - real processing time varies
        status: determineStatus(pick),
        agentAssigned: 'GradingAgent-01',
        processingStartedAt:
          pick.workflow_stage === 'processing' ? new Date().toISOString() : undefined,
        confidence: pick.confidence,
      }))
      .sort((a, b) => {
        // Sort by priority, then by submission time
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });

    setQueueItems(pendingPicks);
  }, [picks]);

  function determinePriority(pick: any): 'high' | 'medium' | 'low' {
    if (pick.tier === 'S' || pick.tier === 'A') return 'high';
    if (pick.tier === 'B' || pick.confidence > 70) return 'medium';
    return 'low';
  }

  function determineStatus(pick: any): 'pending' | 'processing' | 'completed' | 'failed' {
    if (pick.workflow_stage === 'processing') return 'processing';
    if (pick.workflow_stage === 'approved' || pick.workflow_stage === 'published')
      return 'completed';
    if (pick.workflow_stage === 'rejected') return 'failed';
    return 'pending';
  }

  const queueMetrics = useMemo(() => {
    const pending = queueItems.filter(item => item.status === 'pending').length;
    const processing = queueItems.filter(item => item.status === 'processing').length;
    const totalItems = queueItems.length;
    const highPriority = queueItems.filter(item => item.priority === 'high').length;

    // Calculate estimated wait time only if we have real processing speed data
    let estimatedWaitTime: number | null = null;
    if (processingSpeed !== null && processingSpeed > 0 && pending > 0) {
      estimatedWaitTime = pending / processingSpeed; // in minutes
    }

    return {
      pending,
      processing,
      totalItems,
      highPriority,
      avgProcessingTime: null, // NO ESTIMATE - removed hardcoded values
      estimatedWaitTime: estimatedWaitTime !== null ? Math.round(estimatedWaitTime * 10) / 10 : null,
    };
  }, [queueItems, processingSpeed]);

  const handlePauseProcessing = () => {
    setIsProcessing(!isProcessing);
    toast.success(isProcessing ? 'Processing paused' : 'Processing resumed');
  };

  const handlePriorityBoost = (itemId: string) => {
    setQueueItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, priority: 'high' as const } : item))
    );
    toast.success('Pick moved to high priority');
  };

  const handleReprocess = (itemId: string) => {
    setQueueItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, status: 'pending' as const, processingStartedAt: undefined }
          : item
      )
    );
    toast.success('Pick queued for reprocessing');
  };

  if (picksLoading || agentsLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading grading queue...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Queue Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Real-Time Grading Queue
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                className={
                  isProcessing ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }
              >
                {isProcessing ? 'PROCESSING' : 'PAUSED'}
              </Badge>
              <Button variant="outline" size="sm" onClick={handlePauseProcessing}>
                {isProcessing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>Live monitoring of pick grading and approval workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">PENDING</span>
              </div>
              <div className="text-2xl font-bold mt-1">{queueMetrics.pending}</div>
              <div className="text-xs text-muted-foreground">
                {queueMetrics.estimatedWaitTime !== null
                  ? `Est. ${queueMetrics.estimatedWaitTime}min wait`
                  : 'Wait time: UNKNOWN'}
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Zap className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">PROCESSING</span>
              </div>
              <div className="text-2xl font-bold mt-1">{queueMetrics.processing}</div>
              <div className="text-xs text-muted-foreground">
                Processing time: UNKNOWN
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Target className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">HIGH PRIORITY</span>
              </div>
              <div className="text-2xl font-bold mt-1">{queueMetrics.highPriority}</div>
              <div className="text-xs text-muted-foreground">S & A tier picks</div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">THROUGHPUT</span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {processingSpeed !== null ? processingSpeed.toFixed(2) : '?'}
              </div>
              <div className="text-xs text-muted-foreground">
                {processingSpeed !== null ? 'picks/minute' : 'UNKNOWN'}
              </div>
            </div>
          </div>

          {/* Processing Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Queue Progress</span>
              <span className="text-sm text-muted-foreground">
                {queueMetrics.totalItems - queueMetrics.pending} / {queueMetrics.totalItems}{' '}
                processed
              </span>
            </div>
            <Progress
              value={
                queueMetrics.totalItems > 0
                  ? ((queueMetrics.totalItems - queueMetrics.pending) / queueMetrics.totalItems) *
                    100
                  : 0
              }
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Layers className="w-5 h-5 mr-2" />
            Queue Items ({queueItems.length})
          </CardTitle>
          <CardDescription>Real-time view of picks in the grading pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {queueItems.length > 0 ? (
              queueItems.slice(0, 10).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                >
                  <div className="flex items-center space-x-3">
                    <Badge
                      className={
                        item.priority === 'high'
                          ? 'bg-red-100 text-red-800'
                          : item.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                      }
                    >
                      {item.priority.toUpperCase()}
                    </Badge>

                    <div>
                      <p className="font-medium">{item.capper}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.selection} • {item.sport}
                        {item.odds && ` • ${item.odds > 0 ? '+' : ''}${item.odds}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          item.status === 'processing'
                            ? 'bg-orange-100 text-orange-800'
                            : item.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-1">
                      {item.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePriorityBoost(item.id)}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                      {item.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReprocess(item.id)}
                          className="h-6 w-6 p-0"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      {item.status === 'processing' && (
                        <div className="h-6 w-6 flex items-center justify-center">
                          <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No items in grading queue</p>
                <p className="text-xs">All picks have been processed</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Agent Assignment
          </CardTitle>
          <CardDescription>Grading agents and their current workload</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => {
              const agentId = `GradingAgent-0${i + 1}`;
              const assignedItems = queueItems.filter(
                item => item.agentAssigned === agentId
              ).length;
              const isActive = assignedItems > 0;

              return (
                <div key={agentId} className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{agentId}</span>
                    <Badge
                      className={
                        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {isActive ? 'ACTIVE' : 'IDLE'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {assignedItems} picks assigned
                  </div>
                  <Progress value={isActive ? (assignedItems / 5) * 100 : 0} className="h-1 mt-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
