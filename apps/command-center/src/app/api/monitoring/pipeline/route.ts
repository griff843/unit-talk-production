export const dynamic = 'force-dynamic'
/**
 * @fileoverview Production Pipeline Monitoring API
 * Real-time metrics and status for the complete production pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTypedSupabaseClient } from '@/lib/supabase';
import { RBACService, Permission } from '@/lib/rbac';

const supabase = getTypedSupabaseClient()

interface PipelineMetrics {
  timestamp: string;
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    bridge_worker: ComponentMetrics;
    temporal_workflows: ComponentMetrics;
    alert_agent: ComponentMetrics;
    events_stream: ComponentMetrics;
    database: ComponentMetrics;
  };
  throughput: {
    events_per_minute: number;
    processing_rate: number;
    alert_generation_rate: number;
    workflow_completion_rate: number;
  };
  performance: {
    avg_processing_time_ms: number;
    p95_processing_time_ms: number;
    error_rate_percent: number;
    queue_depth: number;
  };
  business_metrics: {
    tickets_processed: number;
    alerts_generated: number;
    high_value_picks: number;
    system_uptime_percent: number;
  };
}

interface ComponentMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime_percent: number;
  throughput_per_hour: number;
  error_rate_percent: number;
  avg_response_time_ms: number;
  last_activity: string;
  version?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Check permissions for pipeline monitoring
    await RBACService.requirePermission(userId, Permission.VIEW_METRICS, {
      endpoint: '/api/monitoring/pipeline',
      method: 'GET',
    });

    const timeRange = request.nextUrl.searchParams.get('range') || '1h';
    const includeDetails = request.nextUrl.searchParams.get('details') === 'true';

    // Calculate time window
    const timeWindowMs = getTimeWindowMs(timeRange);
    const startTimeQuery = new Date(Date.now() - timeWindowMs).toISOString();

    // Collect metrics from all components
    const [
      bridgeWorkerMetrics,
      temporalMetrics,
      alertAgentMetrics,
      eventsStreamMetrics,
      databaseMetrics,
      throughputMetrics,
      performanceMetrics,
      businessMetrics
    ] = await Promise.allSettled([
      getBridgeWorkerMetrics(startTimeQuery),
      getTemporalWorkflowMetrics(startTimeQuery),
      getAlertAgentMetrics(startTimeQuery),
      getEventsStreamMetrics(startTimeQuery),
      getDatabaseMetrics(startTimeQuery),
      getThroughputMetrics(startTimeQuery),
      getPerformanceMetrics(startTimeQuery),
      getBusinessMetrics(startTimeQuery),
    ]);

    // Calculate overall status
    const componentStatuses = [
      bridgeWorkerMetrics.status === 'fulfilled' ? bridgeWorkerMetrics.value.status : 'unhealthy',
      temporalMetrics.status === 'fulfilled' ? temporalMetrics.value.status : 'unhealthy',
      alertAgentMetrics.status === 'fulfilled' ? alertAgentMetrics.value.status : 'unhealthy',
      eventsStreamMetrics.status === 'fulfilled' ? eventsStreamMetrics.value.status : 'unhealthy',
      databaseMetrics.status === 'fulfilled' ? databaseMetrics.value.status : 'unhealthy',
    ];

    const overallStatus = componentStatuses.some(s => s === 'unhealthy') ? 'unhealthy' :
                         componentStatuses.some(s => s === 'degraded') ? 'degraded' : 'healthy';

    const metrics: PipelineMetrics = {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      components: {
        bridge_worker: bridgeWorkerMetrics.status === 'fulfilled' ? bridgeWorkerMetrics.value : getErrorMetrics('bridge_worker'),
        temporal_workflows: temporalMetrics.status === 'fulfilled' ? temporalMetrics.value : getErrorMetrics('temporal'),
        alert_agent: alertAgentMetrics.status === 'fulfilled' ? alertAgentMetrics.value : getErrorMetrics('alert_agent'),
        events_stream: eventsStreamMetrics.status === 'fulfilled' ? eventsStreamMetrics.value : getErrorMetrics('events_stream'),
        database: databaseMetrics.status === 'fulfilled' ? databaseMetrics.value : getErrorMetrics('database'),
      },
      throughput: throughputMetrics.status === 'fulfilled' ? throughputMetrics.value : {
        events_per_minute: 0,
        processing_rate: 0,
        alert_generation_rate: 0,
        workflow_completion_rate: 0,
      },
      performance: performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : {
        avg_processing_time_ms: 0,
        p95_processing_time_ms: 0,
        error_rate_percent: 100,
        queue_depth: 0,
      },
      business_metrics: businessMetrics.status === 'fulfilled' ? businessMetrics.value : {
        tickets_processed: 0,
        alerts_generated: 0,
        high_value_picks: 0,
        system_uptime_percent: 0,
      },
    };

    const responseTime = Date.now() - startTime;

    // Log metrics access
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'VIEW_PIPELINE_METRICS',
      resource_type: 'monitoring',
      resource_id: 'pipeline',
      payload: {
        time_range: timeRange,
        overall_status: overallStatus,
        include_details: includeDetails,
      },
      status: 'success',
      duration_ms: responseTime,
    });

    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
        'X-Metrics-Range': timeRange,
      },
    });

  } catch (error) {
    console.error('Pipeline monitoring failed:', error);

    const errorResponse = {
      timestamp: new Date().toISOString(),
      overall_status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Pipeline monitoring failed',
      response_time_ms: Date.now() - startTime,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// =============================================================================
// METRICS COLLECTION FUNCTIONS
// =============================================================================

function getTimeWindowMs(range: string): number {
  switch (range) {
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000; // 1h default
  }
}

function getErrorMetrics(component: string): ComponentMetrics {
  return {
    status: 'unhealthy',
    uptime_percent: 0,
    throughput_per_hour: 0,
    error_rate_percent: 100,
    avg_response_time_ms: 0,
    last_activity: new Date(0).toISOString(),
    version: 'error',
  };
}

async function getBridgeWorkerMetrics(startTime: string): Promise<ComponentMetrics> {
  // Get bridge outbox processing stats
  const client = getTypedSupabaseClient()
  if (!client) return getErrorMetrics('bridge_worker')
  const { data: outboxEvents } = await client
    .from('bridge_outbox')
    .select('status, created_at, updated_at, attempts')
    .gte('created_at', startTime);

  if (!outboxEvents?.length) {
    return {
      status: 'healthy',
      uptime_percent: 100,
      throughput_per_hour: 0,
      error_rate_percent: 0,
      avg_response_time_ms: 0,
      last_activity: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  const totalEvents = outboxEvents.length;
  const successfulEvents = outboxEvents.filter(e => e.status === 'processed').length;
  const failedEvents = outboxEvents.filter(e => e.status === 'failed').length;

  const errorRate = totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0;
  const throughputPerHour = totalEvents; // Approximate based on time window

  // Calculate average processing time
  const processingTimes = outboxEvents
    .filter(e => e.status === 'processed' && e.updated_at)
    .map(e => new Date(String(e.updated_at || new Date().toISOString())).getTime() - new Date(String(e.created_at || new Date().toISOString())).getTime())
    .filter(time => time > 0);

  const avgProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    : 0;

  const status = errorRate > 50 ? 'unhealthy' : errorRate > 10 ? 'degraded' : 'healthy';
  const uptimePercent = Math.max(0, 100 - errorRate);

  return {
    status,
    uptime_percent: uptimePercent,
    throughput_per_hour: throughputPerHour,
    error_rate_percent: errorRate,
    avg_response_time_ms: avgProcessingTime,
    last_activity: String(outboxEvents[outboxEvents.length - 1]?.updated_at || new Date().toISOString()),
    version: '1.0.0',
  };
}

async function getTemporalWorkflowMetrics(startTime: string): Promise<ComponentMetrics> {
  // Get workflow execution stats
  const client = getTypedSupabaseClient()
  if (!client) return getErrorMetrics('temporal')
  const { data: workflows } = await client
    .from('workflow_executions')
    .select('status, created_at, updated_at, workflow_id')
    .gte('created_at', startTime);

  if (!workflows?.length) {
    return {
      status: 'healthy',
      uptime_percent: 100,
      throughput_per_hour: 0,
      error_rate_percent: 0,
      avg_response_time_ms: 0,
      last_activity: new Date().toISOString(),
      version: '1.24.0',
    };
  }

  const totalWorkflows = workflows.length;
  const completedWorkflows = workflows.filter(w => w.status === 'completed').length;
  const failedWorkflows = workflows.filter(w => w.status === 'failed').length;

  const successRate = totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) * 100 : 100;
  const errorRate = 100 - successRate;

  // Calculate average execution time
  const executionTimes = workflows
    .filter(w => w.status === 'completed' && w.updated_at)
    .map(w => new Date(String(w.updated_at || new Date().toISOString())).getTime() - new Date(String(w.created_at || new Date().toISOString())).getTime())
    .filter(time => time > 0);

  const avgExecutionTime = executionTimes.length > 0
    ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
    : 0;

  const status = errorRate > 30 ? 'unhealthy' : errorRate > 10 ? 'degraded' : 'healthy';

  return {
    status,
    uptime_percent: successRate,
    throughput_per_hour: totalWorkflows,
    error_rate_percent: errorRate,
    avg_response_time_ms: avgExecutionTime,
    last_activity: String(workflows[workflows.length - 1]?.updated_at || new Date().toISOString()),
    version: '1.24.0',
  };
}

async function getAlertAgentMetrics(startTime: string): Promise<ComponentMetrics> {
  const client = getTypedSupabaseClient()
  if (!client) return getErrorMetrics('alert_agent')
  // Check agent health
  const { data: agentHealth } = await client
    .from('agent_health')
    .select('status, last_heartbeat, created_at')
    .eq('agent_name', 'AlertAgent')
    .single();

  // Get alert generation stats
  const { data: alertEvents } = await client
    .from('events')
    .select('event_type, created_at')
    .in('event_type', [
      'alert.injury.detected.v1',
      'alert.high_tier.v1',
      'alert.hedge.opportunity.v1',
      'alert.middle.opportunity.v1'
    ])
    .gte('created_at', startTime);

  const isHealthy = agentHealth &&
                   agentHealth.status === 'active' &&
                   new Date(String(agentHealth.last_heartbeat || new Date().toISOString())) > new Date(Date.now() - 5 * 60 * 1000);

  const alertCount = alertEvents?.length || 0;
  const status = isHealthy ? 'healthy' : 'unhealthy';
  const uptimePercent = isHealthy ? 100 : 0;

  return {
    status,
    uptime_percent: uptimePercent,
    throughput_per_hour: alertCount,
    error_rate_percent: isHealthy ? 0 : 100,
    avg_response_time_ms: 0, // Alerts are async, no direct response time
    last_activity: String(agentHealth?.last_heartbeat || new Date(0).toISOString()),
    version: '1.0.0',
  };
}

async function getEventsStreamMetrics(startTime: string): Promise<ComponentMetrics> {
  // Check event ingestion across all sources
  const eventSources = await Promise.allSettled([
    supabase.from('events').select('count').gte('created_at', startTime),
    supabase.from('bridge_outbox').select('count').gte('created_at', startTime),
    supabase.from('workflow_executions').select('count').gte('created_at', startTime),
  ]);

  const healthySources = eventSources.filter(result => result.status === 'fulfilled').length;
  const totalSources = eventSources.length;

  const uptimePercent = (healthySources / totalSources) * 100;
  const status = uptimePercent >= 100 ? 'healthy' : uptimePercent >= 66 ? 'degraded' : 'unhealthy';

  // Estimate throughput from events table
  const { data: recentEvents } = await supabase
    .from('events')
    .select('created_at')
    .gte('created_at', startTime)
    .limit(1000);

  const eventCount = recentEvents?.length || 0;

  return {
    status,
    uptime_percent: uptimePercent,
    throughput_per_hour: eventCount,
    error_rate_percent: 100 - uptimePercent,
    avg_response_time_ms: 50, // Estimate for event streaming
    last_activity: new Date().toISOString(),
    version: '1.0.0',
  };
}

async function getDatabaseMetrics(startTime: string): Promise<ComponentMetrics> {
  const dbStart = Date.now();

  try {
    // Test core table access
    const tableTests = await Promise.allSettled([
      supabase.from('unified_picks').select('count').limit(1),
      supabase.from('users').select('count').limit(1),
      supabase.from('raw_props').select('count').limit(1),
      supabase.from('events').select('count').limit(1),
    ]);

    const healthyTables = tableTests.filter(result => result.status === 'fulfilled').length;
    const totalTables = tableTests.length;
    const uptimePercent = (healthyTables / totalTables) * 100;

    const responseTime = Date.now() - dbStart;
    const status = uptimePercent >= 100 && responseTime < 1000 ? 'healthy' :
                  uptimePercent >= 75 ? 'degraded' : 'unhealthy';

    return {
      status,
      uptime_percent: uptimePercent,
      throughput_per_hour: 0, // Not applicable for database
      error_rate_percent: 100 - uptimePercent,
      avg_response_time_ms: responseTime,
      last_activity: new Date().toISOString(),
      version: '3.0.0',
    };

  } catch (error) {
    return getErrorMetrics('database');
  }
}

async function getThroughputMetrics(startTime: string) {
  // Calculate events per minute
  const timeRangeMs = Date.now() - new Date(startTime).getTime();
  const timeRangeMinutes = Math.max(1, timeRangeMs / (1000 * 60));

  const client = getTypedSupabaseClient()
  if (!client) return { events_per_minute: 0, processing_rate: 0, alert_generation_rate: 0, workflow_completion_rate: 0 }
  const { data: events } = await client
    .from('events')
    .select('event_type, created_at')
    .gte('created_at', startTime);

  const { data: bridgeEvents } = await client
    .from('bridge_outbox')
    .select('status, created_at')
    .gte('created_at', startTime);

  const { data: workflows } = await client
    .from('workflow_executions')
    .select('status, created_at')
    .gte('created_at', startTime);

  const totalEvents = (events?.length || 0) + (bridgeEvents?.length || 0);
  const eventsPerMinute = totalEvents / timeRangeMinutes;

  const processedBridgeEvents = bridgeEvents?.filter(e => e.status === 'processed').length || 0;
  const processingRate = bridgeEvents?.length ? (processedBridgeEvents / bridgeEvents.length) * 100 : 100;

  const alertEvents = events?.filter(e =>
    String(e.event_type || '').startsWith('alert.')
  ).length || 0;
  const alertGenerationRate = alertEvents / timeRangeMinutes;

  const completedWorkflows = workflows?.filter(w => w.status === 'completed').length || 0;
  const workflowCompletionRate = workflows?.length ? (completedWorkflows / workflows.length) * 100 : 100;

  return {
    events_per_minute: Math.round(eventsPerMinute * 100) / 100,
    processing_rate: Math.round(processingRate * 100) / 100,
    alert_generation_rate: Math.round(alertGenerationRate * 100) / 100,
    workflow_completion_rate: Math.round(workflowCompletionRate * 100) / 100,
  };
}

async function getPerformanceMetrics(startTime: string) {
  // Get processing times from bridge outbox
  const client = getTypedSupabaseClient()
  if (!client) return { avg_processing_time_ms: 0, p95_processing_time_ms: 0, error_rate_percent: 100, queue_depth: 0 }
  const { data: processedEvents } = await client
    .from('bridge_outbox')
    .select('created_at, updated_at, status')
    .eq('status', 'processed')
    .gte('created_at', startTime)
    .limit(100);

  const processingTimes = processedEvents?.map(e =>
    new Date(String(e.updated_at || new Date().toISOString())).getTime() - new Date(String(e.created_at || new Date().toISOString())).getTime()
  ).filter(time => time > 0) || [];

  const avgProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    : 0;

  // Calculate P95
  const sortedTimes = processingTimes.sort((a, b) => a - b);
  const p95Index = Math.floor(sortedTimes.length * 0.95);
  const p95ProcessingTime = sortedTimes.length > 0 ? sortedTimes[p95Index] || 0 : 0;

  // Get error rate from recent events
  const { data: failedEvents } = await client
    .from('bridge_outbox')
    .select('status')
    .eq('status', 'failed')
    .gte('created_at', startTime);

  const { data: totalEvents } = await supabase
    .from('bridge_outbox')
    .select('count')
    .gte('created_at', startTime);

  const errorRate = totalEvents?.length ? ((failedEvents?.length || 0) / totalEvents.length) * 100 : 0;

  // Get current queue depth
  const { data: pendingEvents } = await supabase
    .from('bridge_outbox')
    .select('count')
    .in('status', ['pending', 'processing']);

  return {
    avg_processing_time_ms: Math.round(avgProcessingTime),
    p95_processing_time_ms: Math.round(p95ProcessingTime),
    error_rate_percent: Math.round(errorRate * 100) / 100,
    queue_depth: pendingEvents?.length || 0,
  };
}

async function getBusinessMetrics(startTime: string) {
  // Get tickets processed
  const { data: tickets } = await supabase
    .from('events')
    .select('event_type')
    .in('event_type', ['ticket.submitted.v1', 'ticket.processing.completed.v1'])
    .gte('created_at', startTime);

  const ticketsSubmitted = tickets?.filter(t => t.event_type === 'ticket.submitted.v1').length || 0;
  const ticketsProcessed = tickets?.filter(t => t.event_type === 'ticket.processing.completed.v1').length || 0;

  // Get alerts generated
  const { data: alerts } = await supabase
    .from('events')
    .select('event_type')
    .like('event_type', 'alert.%')
    .gte('created_at', startTime);

  // Get high value picks (S/A tier)
  const { data: highValueAlerts } = await supabase
    .from('events')
    .select('event_type')
    .eq('event_type', 'alert.high_tier.v1')
    .gte('created_at', startTime);

  // Calculate system uptime based on component health
  const systemUptimePercent = 99.5; // Placeholder - would be calculated from actual uptime data

  return {
    tickets_processed: ticketsProcessed,
    alerts_generated: alerts?.length || 0,
    high_value_picks: highValueAlerts?.length || 0,
    system_uptime_percent: systemUptimePercent,
  };
}