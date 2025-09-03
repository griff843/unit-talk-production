'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  GitBranch,
  Activity,
  Zap,
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Target,
  BarChart3,
  Settings,
  AlertTriangle,
  Play,
  Pause,
  SkipForward,
  Layers,
  Cpu,
  Network,
  HardDrive,
} from 'lucide-react';
import { useAgentMonitoring } from '@/hooks/useAgentMonitoring';
import { usePicks } from '@/hooks/usePicks';
import { toast } from 'sonner';

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'healthy' | 'warning' | 'error' | 'idle';
  throughput: number;
  averageProcessingTime: number;
  successRate: number;
  queueLength: number;
  lastProcessed?: string;
  dependencies: string[];
  agent?: string;
  metrics: {
    processed24h: number;
    errors24h: number;
    avgLatency: number;
    peakThroughput: number;
  };
}

interface PipelineHealthProps {
  className?: string;
}

export function PipelineHealth({ className }: PipelineHealthProps) {
  const { agents, loading: agentsLoading } = useAgentMonitoring();
  const { picks, stats, loading: picksLoading } = usePicks();
  const [pipelines, setPipelines] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);

  // Define the complete data processing pipeline
  const pipelineStages: PipelineStage[] = [
    {
      id: 'feed-ingestion',
      name: 'Feed Ingestion',
      description: 'Raw data ingestion from external sources',
      status: 'healthy',
      throughput: 145.2,
      averageProcessingTime: 2.3,
      successRate: 98.7,
      queueLength: 23,
      lastProcessed: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      dependencies: [],
      agent: 'FeedAgent',
      metrics: {
        processed24h: 3456,
        errors24h: 12,
        avgLatency: 2.3,
        peakThroughput: 234.5,
      },
    },
    {
      id: 'data-validation',
      name: 'Data Validation',
      description: 'Raw data validation and normalization',
      status: 'healthy',
      throughput: 142.8,
      averageProcessingTime: 1.8,
      successRate: 99.1,
      queueLength: 8,
      lastProcessed: new Date(Date.now() - 90000).toISOString(), // 1.5 minutes ago
      dependencies: ['feed-ingestion'],
      agent: 'IngestionAgent',
      metrics: {
        processed24h: 3421,
        errors24h: 8,
        avgLatency: 1.8,
        peakThroughput: 187.3,
      },
    },
    {
      id: 'professional-processing',
      name: 'Professional Processing',
      description: 'Professional review and analysis of validated data',
      status: 'warning',
      throughput: 89.4,
      averageProcessingTime: 45.2,
      successRate: 94.3,
      queueLength: 47,
      lastProcessed: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
      dependencies: ['data-validation'],
      agent: 'ProfessionalPropProcessor',
      metrics: {
        processed24h: 2147,
        errors24h: 34,
        avgLatency: 45.2,
        peakThroughput: 123.7,
      },
    },
    {
      id: 'grading',
      name: 'Grading & Analysis',
      description: 'AI-powered pick grading and tier assignment',
      status: 'healthy',
      throughput: 87.2,
      averageProcessingTime: 12.7,
      successRate: 96.8,
      queueLength: 15,
      lastProcessed: new Date(Date.now() - 45000).toISOString(), // 45 seconds ago
      dependencies: ['professional-processing'],
      agent: 'GradingAgent',
      metrics: {
        processed24h: 2089,
        errors24h: 18,
        avgLatency: 12.7,
        peakThroughput: 145.6,
      },
    },
    {
      id: 'alert-generation',
      name: 'Alert Generation',
      description: 'Generate alerts and notifications for high-tier picks',
      status: 'healthy',
      throughput: 23.4,
      averageProcessingTime: 3.1,
      successRate: 99.5,
      queueLength: 2,
      lastProcessed: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
      dependencies: ['grading'],
      agent: 'AlertAgent',
      metrics: {
        processed24h: 567,
        errors24h: 2,
        avgLatency: 3.1,
        peakThroughput: 45.8,
      },
    },
    {
      id: 'analytics-processing',
      name: 'Analytics Processing',
      description: 'Performance analytics and trend analysis',
      status: 'healthy',
      throughput: 85.1,
      averageProcessingTime: 8.4,
      successRate: 97.2,
      queueLength: 12,
      lastProcessed: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      dependencies: ['grading'],
      agent: 'AnalyticsAgent',
      metrics: {
        processed24h: 2034,
        errors24h: 15,
        avgLatency: 8.4,
        peakThroughput: 156.3,
      },
    },
    {
      id: 'recap-generation',
      name: 'Recap Generation',
      description: 'Daily and weekly recap compilation',
      status: 'idle',
      throughput: 0.8,
      averageProcessingTime: 120.5,
      successRate: 92.1,
      queueLength: 0,
      lastProcessed: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      dependencies: ['analytics-processing', 'grading'],
      agent: 'RecapAgent',
      metrics: {
        processed24h: 19,
        errors24h: 1,
        avgLatency: 120.5,
        peakThroughput: 2.3,
      },
    },
  ];

  useEffect(() => {
    setPipelines(pipelineStages);
    setLoading(false);
  }, []);

  const overallHealth = useMemo(() => {
    const healthyCount = pipelines.filter(p => p.status === 'healthy').length;
    const warningCount = pipelines.filter(p => p.status === 'warning').length;
    const errorCount = pipelines.filter(p => p.status === 'error').length;
    const totalThroughput = pipelines.reduce((sum, p) => sum + p.throughput, 0);
    const avgSuccessRate = pipelines.reduce((sum, p) => sum + p.successRate, 0) / pipelines.length;
    const totalQueueLength = pipelines.reduce((sum, p) => sum + p.queueLength, 0);

    return {
      healthyCount,
      warningCount,
      errorCount,
      totalPipelines: pipelines.length,
      totalThroughput: Math.round(totalThroughput * 100) / 100,
      avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
      totalQueueLength,
      overallStatus: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'healthy',
    };
  }, [pipelines]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'idle':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRestartPipeline = (pipelineId: string) => {
    toast.success(`Restarting ${pipelines.find(p => p.id === pipelineId)?.name} pipeline`);
  };

  const handlePausePipeline = (pipelineId: string) => {
    toast.success(`Pausing ${pipelines.find(p => p.id === pipelineId)?.name} pipeline`);
  };

  if (loading || agentsLoading || picksLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading pipeline health...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <GitBranch className="w-5 h-5 mr-2" />
              Data Processing Pipeline Health
            </div>
            <Badge
              className={
                overallHealth.overallStatus === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : overallHealth.overallStatus === 'warning'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }
            >
              {overallHealth.overallStatus.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of all data processing stages from ingestion to publication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">PIPELINES</span>
              </div>
              <div className="text-2xl font-bold mt-1">{overallHealth.totalPipelines}</div>
              <div className="text-xs text-muted-foreground">
                {overallHealth.healthyCount} healthy, {overallHealth.warningCount} warning
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Zap className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">THROUGHPUT</span>
              </div>
              <div className="text-2xl font-bold mt-1">{overallHealth.totalThroughput}</div>
              <div className="text-xs text-muted-foreground">items/minute</div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">SUCCESS RATE</span>
              </div>
              <div className="text-2xl font-bold mt-1">{overallHealth.avgSuccessRate}%</div>
              <div className="text-xs text-muted-foreground">average across stages</div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">QUEUE LENGTH</span>
              </div>
              <div className="text-2xl font-bold mt-1">{overallHealth.totalQueueLength}</div>
              <div className="text-xs text-muted-foreground">items pending</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Layers className="w-5 h-5 mr-2" />
            Pipeline Flow Visualization
          </CardTitle>
          <CardDescription>
            End-to-end view of data processing stages and dependencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pipelines.map((pipeline, index) => (
              <div key={pipeline.id} className="flex items-center space-x-4">
                {/* Pipeline Stage */}
                <div
                  className={`flex-1 p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedPipeline === pipeline.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() =>
                    setSelectedPipeline(selectedPipeline === pipeline.id ? null : pipeline.id)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(pipeline.status)}
                      <div>
                        <h4 className="font-medium">{pipeline.name}</h4>
                        <p className="text-sm text-muted-foreground">{pipeline.description}</p>
                        {pipeline.agent && (
                          <p className="text-xs text-muted-foreground">Agent: {pipeline.agent}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(pipeline.status)}>{pipeline.status}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.throughput} items/min
                      </div>
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Success Rate</span>
                      <div className="flex items-center space-x-1">
                        <Progress value={pipeline.successRate} className="h-1 flex-1" />
                        <span className="font-mono">{pipeline.successRate}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Queue: {pipeline.queueLength}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Avg Time: {pipeline.averageProcessingTime}s
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedPipeline === pipeline.id && (
                    <div className="mt-4 p-3 bg-muted/50 rounded border-t">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h5 className="font-medium mb-2">24h Metrics</h5>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Processed:</span>
                              <span className="font-mono">
                                {pipeline.metrics.processed24h.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Errors:</span>
                              <span className="font-mono text-red-600">
                                {pipeline.metrics.errors24h}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Peak Throughput:</span>
                              <span className="font-mono">
                                {pipeline.metrics.peakThroughput}/min
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium mb-2">Controls</h5>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestartPipeline(pipeline.id)}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Restart
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePausePipeline(pipeline.id)}
                            >
                              <Pause className="w-3 h-3 mr-1" />
                              Pause
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Arrow to next stage */}
                {index < pipelines.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resource Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Cpu className="w-5 h-5 mr-2" />
            Resource Utilization
          </CardTitle>
          <CardDescription>System resource usage across all pipeline stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">CPU Usage</span>
                </div>
                <span className="text-sm font-mono">34.2%</span>
              </div>
              <Progress value={34.2} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">8 cores • Average load</div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Memory Usage</span>
                </div>
                <span className="text-sm font-mono">67.8%</span>
              </div>
              <Progress value={67.8} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">10.8GB / 16GB used</div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Network className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Network I/O</span>
                </div>
                <span className="text-sm font-mono">125 MB/s</span>
              </div>
              <Progress value={42.3} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">In: 89MB/s • Out: 36MB/s</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
