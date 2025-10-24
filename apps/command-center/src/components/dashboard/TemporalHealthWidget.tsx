/**
 * @fileoverview Temporal Health Widget - Deep workflow monitoring
 * Comprehensive Temporal cluster health with missed schedules and stuck workflows
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Calendar,
  Zap,
  TrendingUp,
  Database,
} from 'lucide-react';

// =============================================================================
// INTERFACES
// =============================================================================

interface WorkflowSummary {
  workflow_type: string;
  task_queue: string;
  running: number;
  succeeded: number;
  failed: number;
  total_executions: number;
  avg_duration_ms: number;
  success_rate: number;
  failure_rate: number;
  last_success_at?: string;
  last_failure_at?: string;
  backlog_depth: number;
  oldest_backlog_age_minutes?: number;
}

interface TemporalData {
  overall: {
    total_workflows: number;
    healthy_workflows: number;
    unhealthy_workflows: number;
    system_health_score: number;
    uptime_percentage: number;
  };
  by_workflow: WorkflowSummary[];
  by_queue: Array<{
    task_queue: string;
    depth: number;
    oldest_age_minutes: number;
    processing_rate: number;
    workflow_types: string[];
  }>;
  alerts: {
    missed_schedules: number;
    stuck_workflows: number;
    failed_workflows_1h: number;
    high_retry_workflows: number;
  };
  performance: {
    avg_start_to_finish_ms: number;
    p95_execution_time_ms: number;
    p99_execution_time_ms: number;
    throughput_per_minute: number;
  };
}

// =============================================================================
// TEMPORAL HEALTH WIDGET
// =============================================================================

export function TemporalHealthWidget() {
  const [data, setData] = useState<TemporalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedTab, setSelectedTab] = useState<'overview' | 'workflows' | 'queues'>('overview');

  /**
   * Fetch Temporal health data
   */
  const fetchTemporalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/temporal/summary?details=true');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Temporal data');
      }

      setData(result.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching Temporal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemporalData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTemporalData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Format duration
   */
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  /**
   * Format throughput
   */
  const formatThroughput = (rate: number) => {
    if (rate < 1) return `${(rate * 60).toFixed(1)}/h`;
    return `${rate.toFixed(1)}/min`;
  };

  /**
   * Get health score color
   */
  const getHealthScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-500';
    if (score >= 85) return 'text-yellow-500';
    if (score >= 70) return 'text-orange-500';
    return 'text-red-500';
  };

  /**
   * Get workflow status color
   */
  const getWorkflowStatusColor = (workflow: WorkflowSummary) => {
    if (workflow.success_rate >= 0.95 && workflow.failed === 0) return 'text-green-500';
    if (workflow.success_rate >= 0.85 && workflow.failed <= 2) return 'text-yellow-500';
    if (workflow.success_rate >= 0.7) return 'text-orange-500';
    return 'text-red-500';
  };

  /**
   * Get backlog urgency color
   */
  const getBacklogUrgencyColor = (ageMinutes: number) => {
    if (ageMinutes > 60) return 'text-red-500';
    if (ageMinutes > 30) return 'text-orange-500';
    if (ageMinutes > 10) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Temporal Health
          </CardTitle>
          <CardDescription>Workflow execution monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading Temporal data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-500">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Temporal Health - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchTemporalData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Temporal Health
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={data?.overall.system_health_score >= 90 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {data ? `${data.overall.system_health_score.toFixed(1)}%` : 'N/A'} Health
            </Badge>
            <Button variant="ghost" size="sm" onClick={fetchTemporalData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Comprehensive workflow execution monitoring
          {data && (
            <span className="block text-xs text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data && (
          <div className="space-y-6">
            {/* Overall Health Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div
                  className={`text-2xl font-bold ${getHealthScoreColor(data.overall.system_health_score)}`}
                >
                  {data.overall.system_health_score.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">System Health</div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div
                  className={`text-2xl font-bold ${data.overall.healthy_workflows > data.overall.unhealthy_workflows ? 'text-green-500' : 'text-red-500'}`}
                >
                  {data.overall.healthy_workflows}
                </div>
                <div className="text-xs text-muted-foreground">Healthy Workflows</div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div
                  className={`text-2xl font-bold ${data.overall.uptime_percentage >= 99 ? 'text-green-500' : 'text-red-500'}`}
                >
                  {data.overall.uptime_percentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div className="text-2xl font-bold text-blue-500">
                  {formatThroughput(data.performance.throughput_per_minute)}
                </div>
                <div className="text-xs text-muted-foreground">Throughput</div>
              </div>
            </div>

            {/* Critical Alerts */}
            {(data.alerts.missed_schedules > 0 ||
              data.alerts.stuck_workflows > 0 ||
              data.alerts.failed_workflows_1h > 5) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Critical Alerts
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.alerts.missed_schedules > 0 && (
                    <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
                      <Calendar className="h-4 w-4 text-red-500" />
                      <AlertDescription>
                        <div className="font-semibold">Missed Schedules</div>
                        <div className="text-sm">
                          {data.alerts.missed_schedules} schedules not executed
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {data.alerts.stuck_workflows > 0 && (
                    <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-900/20">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <AlertDescription>
                        <div className="font-semibold">Stuck Workflows</div>
                        <div className="text-sm">
                          {data.alerts.stuck_workflows} workflows running &gt;30min
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {data.alerts.failed_workflows_1h > 5 && (
                    <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <AlertDescription>
                        <div className="font-semibold">High Failure Rate</div>
                        <div className="text-sm">
                          {data.alerts.failed_workflows_1h} failures in last hour
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Performance Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg border bg-card">
                  <div className="text-lg font-bold">
                    {formatDuration(data.performance.avg_start_to_finish_ms)}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Duration</div>
                </div>
                <div className="text-center p-3 rounded-lg border bg-card">
                  <div className="text-lg font-bold">
                    {formatDuration(data.performance.p95_execution_time_ms)}
                  </div>
                  <div className="text-xs text-muted-foreground">P95 Duration</div>
                </div>
                <div className="text-center p-3 rounded-lg border bg-card">
                  <div className="text-lg font-bold">
                    {formatDuration(data.performance.p99_execution_time_ms)}
                  </div>
                  <div className="text-xs text-muted-foreground">P99 Duration</div>
                </div>
                <div className="text-center p-3 rounded-lg border bg-card">
                  <div className="text-lg font-bold">
                    {formatThroughput(data.performance.throughput_per_minute)}
                  </div>
                  <div className="text-xs text-muted-foreground">Throughput</div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-4 border-b">
              {(['overview', 'workflows', 'queues'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`pb-2 px-1 text-sm font-medium capitalize ${
                    selectedTab === tab
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {selectedTab === 'workflows' && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Workflow Status</h4>
                <div className="space-y-2">
                  {data.by_workflow.map((workflow, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">{workflow.workflow_type}</span>
                          <Badge variant="outline" className="text-xs">
                            {workflow.task_queue}
                          </Badge>
                          {workflow.success_rate >= 0.95 ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>

                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <span>Running: {workflow.running}</span>
                          <span>Success: {(workflow.success_rate * 100).toFixed(1)}%</span>
                          <span>Failed: {workflow.failed}</span>
                          {workflow.backlog_depth > 0 && (
                            <span
                              className={getBacklogUrgencyColor(
                                workflow.oldest_backlog_age_minutes || 0
                              )}
                            >
                              Backlog: {workflow.backlog_depth}
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <Progress value={workflow.success_rate * 100} className="h-2" />
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div className="text-lg font-bold">{workflow.total_executions}</div>
                        <div className="text-xs text-muted-foreground">Total Executions</div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {formatDuration(workflow.avg_duration_ms)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === 'queues' && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Task Queue Status</h4>
                <div className="space-y-2">
                  {data.by_queue.map((queue, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm">{queue.task_queue}</span>
                          <Badge variant="outline" className="text-xs">
                            {queue.workflow_types.length} workflow type
                            {queue.workflow_types.length > 1 ? 's' : ''}
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <span>Depth: {queue.depth}</span>
                          {queue.oldest_age_minutes > 0 && (
                            <span className={getBacklogUrgencyColor(queue.oldest_age_minutes)}>
                              Oldest: {queue.oldest_age_minutes}m
                            </span>
                          )}
                          <span>Rate: {formatThroughput(queue.processing_rate)}</span>
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">
                          Types: {queue.workflow_types.join(', ')}
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div
                          className={`text-lg font-bold ${queue.depth > 10 ? 'text-red-500' : queue.depth > 5 ? 'text-yellow-500' : 'text-green-500'}`}
                        >
                          {queue.depth}
                        </div>
                        <div className="text-xs text-muted-foreground">Queue Depth</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === 'overview' && (
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Resume Failed
                  </Button>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Replay Workflows
                  </Button>
                  <Button variant="outline" size="sm">
                    <PauseCircle className="w-4 h-4 mr-2" />
                    Pause Queue
                  </Button>
                </div>

                {/* Recent Activity Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium">Successful Executions</span>
                    </div>
                    <div className="text-2xl font-bold text-green-500">
                      {data.by_workflow.reduce((sum, w) => sum + w.succeeded, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Last 24 hours</div>
                  </div>

                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center space-x-2 mb-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium">Failed Executions</span>
                    </div>
                    <div className="text-2xl font-bold text-red-500">
                      {data.by_workflow.reduce((sum, w) => sum + w.failed, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Last 24 hours</div>
                  </div>

                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Currently Running</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-500">
                      {data.by_workflow.reduce((sum, w) => sum + w.running, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Active workflows</div>
                  </div>
                </div>
              </div>
            )}

            {/* No Data State */}
            {data.by_workflow.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No workflow data available</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
