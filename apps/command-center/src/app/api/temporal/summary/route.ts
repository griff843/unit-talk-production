/**
 * @fileoverview Temporal workflow health summary API
 * Provides comprehensive Temporal workflow monitoring and health metrics
 *
 * NOTE: temporal_* tables may not exist in production.
 * Using 'any' casts to avoid type errors with merged database types.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOperatorIdentity } from '@/lib/auth';
import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbClient = supabase as any;

// =============================================================================
// TEMPORAL HEALTH INTERFACES
// =============================================================================

interface WorkflowSummary {
  workflow_type: string;
  task_queue: string;
  running: number;
  succeeded: number;
  failed: number;
  terminated: number;
  canceled: number;
  total_executions: number;
  avg_duration_ms: number;
  success_rate: number;
  failure_rate: number;
  retry_rate: number;
  last_success_at?: Date;
  last_failure_at?: Date;
  backlog_depth: number;
  oldest_backlog_age_minutes?: number;
}

interface TemporalSummary {
  overall: {
    total_workflows: number;
    healthy_workflows: number;
    unhealthy_workflows: number;
    system_health_score: number;
    uptime_percentage: number;
  };
  by_workflow: WorkflowSummary[];
  by_queue: {
    task_queue: string;
    depth: number;
    oldest_age_minutes: number;
    processing_rate: number;
    workflow_types: string[];
  }[];
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
// TEMPORAL MONITORING SERVICE
// =============================================================================

class TemporalMonitoringService {
  /**
   * Get comprehensive Temporal summary
   */
  static async getTemporalSummary(timeWindow: string = '24h'): Promise<TemporalSummary> {
    const windowHours = this.parseTimeWindow(timeWindow);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [workflowSummaries, queueSummaries, alerts, performance] = await Promise.all([
      this.getWorkflowSummaries(since),
      this.getQueueSummaries(),
      this.getAlerts(since),
      this.getPerformanceMetrics(since),
    ]);

    // Calculate overall health metrics
    const totalWorkflows = workflowSummaries.reduce(
      (sum, w) => sum + ((w as any).total_executions as number),
      0
    );
    const healthyWorkflows = workflowSummaries.filter(
      w =>
        w.success_rate > 0.95 &&
        (w.last_success_at ? Date.now() - w.last_success_at.getTime() < 60 * 60 * 1000 : false)
    ).length;

    const systemHealthScore =
      totalWorkflows > 0
        ? (workflowSummaries.reduce((sum, w) => sum + w.success_rate * w.total_executions, 0) /
            totalWorkflows) *
          100
        : 100;

    return {
      overall: {
        total_workflows: workflowSummaries.length,
        healthy_workflows: healthyWorkflows,
        unhealthy_workflows: workflowSummaries.length - healthyWorkflows,
        system_health_score: Math.round(systemHealthScore * 100) / 100,
        uptime_percentage: Math.min(systemHealthScore, 100),
      },
      by_workflow: workflowSummaries,
      by_queue: queueSummaries,
      alerts,
      performance,
    };
  }

  /**
   * Get workflow summaries grouped by type
   */
  private static async getWorkflowSummaries(since: Date): Promise<WorkflowSummary[]> {
    const { data, error } = await dbClient
      .from('temporal_workflow_health')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflow summaries:', error);
      return [];
    }

    // Group by workflow type and calculate metrics
    const grouped = new Map<string, any[]>();
    (data || []).forEach(row => {
      const key = `${row.workflow_type}:${row.task_queue || 'default'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    });

    const summaries: WorkflowSummary[] = [];
    grouped.forEach((workflows, key) => {
      const [workflow_type, task_queue] = key.split(':');

      const running = workflows.filter(w => w.status === 'running').length;
      const succeeded = workflows.filter(w => w.status === 'completed').length;
      const failed = workflows.filter(w => w.status === 'failed').length;
      const terminated = workflows.filter(w => w.status === 'terminated').length;
      const canceled = workflows.filter(w => w.status === 'canceled').length;
      const total = workflows.length;

      const durations = workflows.filter(w => w.duration_ms).map(w => w.duration_ms);
      const avgDuration =
        durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

      const successRate = total > 0 ? succeeded / total : 1;
      const failureRate = total > 0 ? failed / total : 0;
      const retryRate = workflows.filter(w => w.retry_count > 0).length / Math.max(total, 1);

      const lastSuccess = workflows
        .filter(w => w.status === 'completed')
        .sort(
          (a, b) =>
            new Date(b.completed_at || b.created_at).getTime() -
            new Date(a.completed_at || a.created_at).getTime()
        )[0];

      const lastFailure = workflows
        .filter(w => w.status === 'failed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      summaries.push({
        workflow_type,
        task_queue,
        running,
        succeeded,
        failed,
        terminated,
        canceled,
        total_executions: total,
        avg_duration_ms: Math.round(avgDuration),
        success_rate: Math.round(successRate * 10000) / 10000,
        failure_rate: Math.round(failureRate * 10000) / 10000,
        retry_rate: Math.round(retryRate * 10000) / 10000,
        last_success_at: lastSuccess
          ? new Date(lastSuccess.completed_at || lastSuccess.created_at)
          : undefined,
        last_failure_at: lastFailure ? new Date(lastFailure.created_at) : undefined,
        backlog_depth: running,
        oldest_backlog_age_minutes:
          running > 0
            ? Math.round(
                (Date.now() -
                  new Date(
                    workflows.filter(w => w.status === 'running')[0]?.started_at || Date.now()
                  ).getTime()) /
                  60000
              )
            : undefined,
      });
    });

    return summaries.sort((a, b) => b.total_executions - a.total_executions);
  }

  /**
   * Get queue depth and metrics
   */
  private static async getQueueSummaries(): Promise<TemporalSummary['by_queue']> {
    // Query current running workflows to estimate queue depth
    const { data, error } = await dbClient
      .from('temporal_workflow_health')
      .select('task_queue, workflow_type, started_at')
      .eq('status', 'running')
      .order('started_at', { ascending: true });

    if (error) {
      console.error('Error fetching queue summaries:', error);
      return [];
    }

    const queueMap = new Map<string, any>();
    (data || []).forEach(row => {
      const queue = (row as any).task_queue || 'default';
      if (!queueMap.has(queue)) {
        queueMap.set(queue, {
          workflows: [],
          workflow_types: new Set(),
        });
      }
      queueMap.get(queue)!.workflows.push(row as any);
      queueMap.get(queue)!.workflow_types.add((row as any).workflow_type);
    });

    const summaries: TemporalSummary['by_queue'] = [];
    queueMap.forEach((info, task_queue) => {
      const oldestWorkflow = info.workflows[0];
      const oldestAge = oldestWorkflow
        ? Math.round((Date.now() - new Date((oldestWorkflow as any).started_at).getTime()) / 60000)
        : 0;

      summaries.push({
        task_queue,
        depth: info.workflows.length,
        oldest_age_minutes: oldestAge,
        processing_rate: 0, // Would need historical data to calculate
        workflow_types: Array.from(info.workflow_types),
      });
    });

    return summaries.sort((a, b) => b.depth - a.depth);
  }

  /**
   * Get alerts and critical issues
   */
  private static async getAlerts(since: Date): Promise<TemporalSummary['alerts']> {
    const [missedSchedules, stuckWorkflows, recentFailures, highRetryWorkflows] = await Promise.all(
      [
        this.getMissedScheduleCount(),
        this.getStuckWorkflowCount(since),
        this.getRecentFailureCount(since),
        this.getHighRetryWorkflowCount(since),
      ]
    );

    return {
      missed_schedules: missedSchedules,
      stuck_workflows: stuckWorkflows,
      failed_workflows_1h: recentFailures,
      high_retry_workflows: highRetryWorkflows,
    };
  }

  /**
   * Get performance metrics
   */
  private static async getPerformanceMetrics(since: Date): Promise<TemporalSummary['performance']> {
    const { data, error } = await dbClient
      .from('temporal_workflow_health')
      .select('duration_ms, created_at')
      .gte('created_at', since.toISOString())
      .not('duration_ms', 'is', null)
      .order('duration_ms', { ascending: true });

    if (error || !data || data.length === 0) {
      return {
        avg_start_to_finish_ms: 0,
        p95_execution_time_ms: 0,
        p99_execution_time_ms: 0,
        throughput_per_minute: 0,
      };
    }

    const durations = data.map(d => (d as any).duration_ms as number).sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    const windowMinutes = (Date.now() - since.getTime()) / (1000 * 60);
    const throughput = data.length / windowMinutes;

    return {
      avg_start_to_finish_ms: Math.round(avg),
      p95_execution_time_ms: (durations[p95Index] as number) || 0,
      p99_execution_time_ms: (durations[p99Index] as number) || 0,
      throughput_per_minute: Math.round(throughput * 100) / 100,
    };
  }

  /**
   * Get missed schedule count
   */
  private static async getMissedScheduleCount(): Promise<number> {
    const { count, error } = await dbClient
      .from('temporal_schedule_health')
      .select('*', { count: 'exact', head: true })
      .eq('is_missing', true);

    return error ? 0 : count || 0;
  }

  /**
   * Get stuck workflow count (running > threshold)
   */
  private static async getStuckWorkflowCount(since: Date): Promise<number> {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    const { count, error } = await dbClient
      .from('temporal_workflow_health')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running')
      .lt('started_at', stuckThreshold.toISOString());

    return error ? 0 : count || 0;
  }

  /**
   * Get recent failure count
   */
  private static async getRecentFailureCount(since: Date): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { count, error } = await dbClient
      .from('temporal_workflow_health')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo.toISOString());

    return error ? 0 : count || 0;
  }

  /**
   * Get high retry workflow count
   */
  private static async getHighRetryWorkflowCount(since: Date): Promise<number> {
    const { count, error } = await dbClient
      .from('temporal_workflow_health')
      .select('*', { count: 'exact', head: true })
      .gte('retry_count', 3)
      .gte('created_at', since.toISOString());

    return error ? 0 : count || 0;
  }

  /**
   * Parse time window string to hours
   */
  private static parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([hmd])$/);
    if (!match) return 24; // default to 24 hours

    const [, num, unit] = match;
    const value = parseInt(num);

    switch (unit) {
      case 'm':
        return value / 60;
      case 'h':
        return value;
      case 'd':
        return value * 24;
      default:
        return 24;
    }
  }

  /**
   * Get recent failures for detailed analysis
   */
  static async getRecentFailures(limit: number = 10): Promise<any[]> {
    const { data, error } = await dbClient
      .from('temporal_workflow_health')
      .select('workflow_id, workflow_type, error_message, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit);

    return error ? [] : data || [];
  }

  /**
   * Get stuck workflows for detailed analysis
   */
  static async getStuckWorkflows(limit: number = 10): Promise<any[]> {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);

    const { data, error } = await dbClient
      .from('temporal_workflow_health')
      .select('workflow_id, workflow_type, started_at, last_heartbeat')
      .eq('status', 'running')
      .lt('started_at', stuckThreshold.toISOString())
      .order('started_at', { ascending: true })
      .limit(limit);

    return error ? [] : data || [];
  }
}

// =============================================================================
// API ENDPOINT
// =============================================================================

/**
 * GET /api/temporal/summary
 * Get comprehensive Temporal health summary
 */
export async function GET(request: NextRequest) {
  const span = UnitTalkTracing.startTemporalSpan('TemporalMonitoring', 'get_summary');

  try {
    const { userId } = getOperatorIdentity(request);

    // Check permissions - viewers can see temporal health
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeWindow = searchParams.get('window') || '24h';
    const includeDetails = searchParams.get('details') === 'true';

    // Get temporal summary
    const summary = await TemporalMonitoringService.getTemporalSummary(timeWindow);

    // Add detailed workflow information if requested
    let detailedData = {};
    if (includeDetails && (await RBACService.hasPermission(userId, Permission.VIEW_TRACES))) {
      // Add more detailed information for ops/admin users
      detailedData = {
        recent_failures: await TemporalMonitoringService.getRecentFailures(),
        stuck_workflows: await TemporalMonitoringService.getStuckWorkflows(),
      };
    }

    UnitTalkTracing.recordSuccess(span, {
      itemsProcessed: summary.by_workflow.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        ...detailedData,
        metadata: {
          time_window: timeWindow,
          generated_at: new Date().toISOString(),
          includes_details: includeDetails,
        },
      },
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    const errorMessage = error.message || 'Unknown error';
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'TEMPORAL_SUMMARY_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
