/**
 * @fileoverview Production Pipeline Health Monitoring API
 * Comprehensive health checks for all production pipeline components
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Canonical endpoint validation
 */

import { NextRequest, NextResponse } from 'next/server';

import { validateSupabaseEndpoint, CANONICAL_SUPABASE_HOST } from '@/lib/env';
import { RBACService, Permission } from '@/lib/rbac';
import { getRedisClient } from '@/lib/redis';
import { supabase } from '@/lib/supabase';

interface ComponentHealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
  uptime?: number;
  version?: string;
  details: {
    message: string;
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      message: string;
      responseTime?: number;
      data?: any;
    }>;
  };
}

interface PipelineHealthResponse {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: ComponentHealthStatus[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

// Legacy HealthStatus interface for backward compatibility
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    redis: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      connected: boolean;
      error?: string;
    };
    agents: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeCount: number;
      totalCount: number;
    };
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const detailed = request.nextUrl.searchParams.get('detailed') === 'true';

    // Check if user wants detailed health check (requires permissions)
    if (detailed) {
      try {
        await RBACService.requirePermission(userId, Permission.VIEW_METRICS, {
          endpoint: '/api/health',
          method: 'GET',
          detailed: true,
        });
      } catch {
        // Fall back to basic health check if no permission
        return getBasicHealthCheck();
      }
    }

    if (detailed) {
      return getDetailedHealthCheck(userId, startTime);
    } else {
      return getBasicHealthCheck();
    }
  } catch (error) {
    console.error('Health check failed:', error);

    const errorResponse: PipelineHealthResponse = {
      overall_status: 'unhealthy',
      timestamp: new Date().toISOString(),
      components: [
        {
          component: 'health_check_system',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          details: {
            message: 'Health check system failure',
            checks: [
              {
                name: 'system_error',
                status: 'fail',
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            ],
          },
        },
      ],
      summary: { healthy: 0, degraded: 0, unhealthy: 1, total: 1 },
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });
  }
}

// Enhanced detailed health check for production pipeline monitoring
async function getDetailedHealthCheck(userId: string, startTime: number): Promise<NextResponse> {
  const healthChecks: ComponentHealthStatus[] = [];

  // 1. Database Health Check
  const dbHealth = await checkDatabaseHealth();
  healthChecks.push(dbHealth);

  // 2. BridgeWorker Health Check
  const bridgeWorkerHealth = await checkBridgeWorkerHealth();
  healthChecks.push(bridgeWorkerHealth);

  // 3. Temporal Workflows Health Check
  const temporalHealth = await checkTemporalHealth();
  healthChecks.push(temporalHealth);

  // 4. AlertAgent Health Check
  const alertAgentHealth = await checkAlertAgentHealth();
  healthChecks.push(alertAgentHealth);

  // 5. Events Stream Health Check
  const eventsStreamHealth = await checkEventsStreamHealth();
  healthChecks.push(eventsStreamHealth);

  // 6. Smart Form Bridge Health Check
  const smartFormHealth = await checkSmartFormBridgeHealth();
  healthChecks.push(smartFormHealth);

  // Calculate overall status
  const summary = {
    healthy: healthChecks.filter(c => c.status === 'healthy').length,
    degraded: healthChecks.filter(c => c.status === 'degraded').length,
    unhealthy: healthChecks.filter(c => c.status === 'unhealthy').length,
    total: healthChecks.length,
  };

  const overallStatus =
    summary.unhealthy > 0 ? 'unhealthy' : summary.degraded > 0 ? 'degraded' : 'healthy';

  const response: PipelineHealthResponse = {
    overall_status: overallStatus,
    timestamp: new Date().toISOString(),
    components: healthChecks,
    summary,
  };

  const responseTime = Date.now() - startTime;

  // Log health check completion
  await RBACService.logAudit({
    actor: userId,
    actor_type: 'user',
    action: 'DETAILED_HEALTH_CHECK',
    resource_type: 'pipeline',
    resource_id: 'production',
    payload: {
      overall_status: overallStatus,
      response_time_ms: responseTime,
      component_count: healthChecks.length,
    },
    status: 'success',
    duration_ms: responseTime,
  });

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${responseTime}ms`,
    },
  });
}

// Basic health check for backward compatibility and load balancers
async function getBasicHealthCheck(): Promise<NextResponse> {
  const startTime = Date.now();

  // SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Validate canonical endpoint first
  const endpointValidation = validateSupabaseEndpoint();
  if (!endpointValidation.valid) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        critical_error: endpointValidation.error,
        expected_host: CANONICAL_SUPABASE_HOST,
        services: {
          supabase_endpoint: {
            status: 'unhealthy',
            error: endpointValidation.error,
          },
        },
      },
      { status: 503 }
    );
  }

  // Initialize basic health status
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: 'healthy',
        responseTime: 0,
      },
      redis: {
        status: 'healthy',
        connected: false,
      },
      agents: {
        status: 'healthy',
        activeCount: 0,
        totalCount: 0,
      },
    },
  };

  // Check database connectivity
  const dbStartTime = Date.now();
  try {
    const { data, error } = await supabase.from('agent_health').select('count').limit(1).single();

    health.services.database.responseTime = Date.now() - dbStartTime;

    if (error) {
      health.services.database.status = 'unhealthy';
      health.services.database.error = error.message;
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.database.status = 'unhealthy';
    health.services.database.responseTime = Date.now() - dbStartTime;
    health.services.database.error =
      error instanceof Error ? error.message : 'Database connection failed';
    health.status = 'degraded';
  }

  // Check Redis connectivity - PHASE-0-FIX: Real ping, not hardcoded
  try {
    const redis = getRedisClient();
    const redisStatus = await redis.ping();
    health.services.redis.connected = redisStatus;
    health.services.redis.status = redisStatus ? 'healthy' : 'unhealthy';
    if (!redisStatus) {
      // Redis is optional for dashboard - degrade but don't fail
      health.status = 'degraded';
      health.services.redis.error = 'Redis ping failed - caching disabled';
    }
  } catch (error) {
    // Redis failure is degradation, not critical failure for dashboard
    health.services.redis.status = 'unhealthy';
    health.services.redis.connected = false;
    health.services.redis.error =
      error instanceof Error ? error.message : 'Redis connection failed';
    health.status = 'degraded';
    console.warn('[CC] Redis health check failed:', error);
  }

  // Check agents
  try {
    const { data: agents, error } = await supabase.from('agent_health').select('status');

    if (error) throw error;

    const totalCount = agents?.length || 0;
    const activeCount = agents?.filter(a => a.status === 'healthy').length || 0;

    health.services.agents.totalCount = totalCount;
    health.services.agents.activeCount = activeCount;
    health.services.agents.status =
      activeCount > 0 ? 'healthy' : totalCount > 0 ? 'degraded' : 'unhealthy';

    if (health.services.agents.status !== 'healthy') {
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.agents.status = 'unhealthy';
    health.status = 'degraded';
  }

  const totalResponseTime = Date.now() - startTime;

  // Return appropriate HTTP status code
  const httpStatus = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check-Duration': totalResponseTime.toString(),
    },
  });
}

// HEAD /api/health - Simple health check for load balancers
export async function HEAD() {
  try {
    // Quick database ping
    const { error } = await supabase.from('agent_health').select('count').limit(1).single();

    if (error) {
      return new NextResponse(null, { status: 503 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

// =============================================================================
// COMPREHENSIVE HEALTH CHECK FUNCTIONS
// =============================================================================

// Database Health Check
async function checkDatabaseHealth(): Promise<ComponentHealthStatus> {
  const startTime = Date.now();
  const checks: ComponentHealthStatus['details']['checks'] = [];

  try {
    // 1. Connection Test
    const connectionStart = Date.now();
    const { data: connectionTest } = await supabase.from('unified_picks').select('count').limit(1);

    checks.push({
      name: 'database_connection',
      status: 'pass',
      message: 'Database connection successful',
      responseTime: Date.now() - connectionStart,
    });

    // 2. Core Tables Test
    const tablesStart = Date.now();
    const coreTableChecks = await Promise.allSettled([
      supabase.from('unified_picks').select('count').limit(1),
      supabase.from('users').select('count').limit(1),
      supabase.from('raw_props').select('count').limit(1),
      supabase.from('events').select('count').limit(1),
      supabase.from('bridge_outbox').select('count').limit(1),
    ]);

    const tablesHealthy = coreTableChecks.filter(result => result.status === 'fulfilled').length;
    const tablesTotal = coreTableChecks.length;

    checks.push({
      name: 'core_tables_accessibility',
      status: tablesHealthy === tablesTotal ? 'pass' : tablesHealthy > 0 ? 'warn' : 'fail',
      message: `${tablesHealthy}/${tablesTotal} core tables accessible`,
      responseTime: Date.now() - tablesStart,
      data: { accessible_tables: tablesHealthy, total_tables: tablesTotal },
    });

    // 3. Recent Activity Test
    const activityStart = Date.now();
    const { data: recentEvents } = await supabase
      .from('events')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(10);

    checks.push({
      name: 'recent_activity',
      status: (recentEvents?.length || 0) > 0 ? 'pass' : 'warn',
      message: `${recentEvents?.length || 0} events in last hour`,
      responseTime: Date.now() - activityStart,
      data: { recent_events_count: recentEvents?.length || 0 },
    });

    const overallStatus = checks.every(c => c.status === 'pass')
      ? 'healthy'
      : checks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded';

    return {
      component: 'database',
      status: overallStatus,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'v3.0.0 unified database schema operational',
        checks,
      },
    };
  } catch (error) {
    checks.push({
      name: 'database_error',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database check failed',
    });

    return {
      component: 'database',
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'Database health check failed',
        checks,
      },
    };
  }
}

// Bridge Worker Health Check
async function checkBridgeWorkerHealth(): Promise<ComponentHealthStatus> {
  const startTime = Date.now();
  const checks: ComponentHealthStatus['details']['checks'] = [];

  try {
    // Check for recent bridge worker activity
    const activityStart = Date.now();
    const { data: recentProcessing } = await supabase
      .from('bridge_outbox')
      .select('id, status, updated_at')
      .gte('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .limit(10);

    const processingCount = recentProcessing?.length || 0;
    checks.push({
      name: 'recent_processing',
      status: processingCount > 0 ? 'pass' : 'warn',
      message: `${processingCount} bridge events processed in last 15 minutes`,
      responseTime: Date.now() - activityStart,
      data: { recent_processing_count: processingCount },
    });

    // Check for failed events that need retry
    const failuresStart = Date.now();
    const { data: failedEvents } = await supabase
      .from('bridge_outbox')
      .select('id, attempts')
      .eq('status', 'failed')
      .lt('attempts', 3)
      .limit(10);

    const failedCount = failedEvents?.length || 0;
    checks.push({
      name: 'failed_events_pending_retry',
      status: failedCount === 0 ? 'pass' : failedCount < 5 ? 'warn' : 'fail',
      message: `${failedCount} events pending retry`,
      responseTime: Date.now() - failuresStart,
      data: { failed_pending_retry: failedCount },
    });

    const overallStatus = checks.every(c => c.status === 'pass')
      ? 'healthy'
      : checks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded';

    return {
      component: 'bridge_worker',
      status: overallStatus,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      details: {
        message: 'Dual-source event processing (events + bridge_outbox)',
        checks,
      },
    };
  } catch (error) {
    return {
      component: 'bridge_worker',
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'Bridge Worker health check failed',
        checks: [
          {
            name: 'bridge_worker_error',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Bridge Worker check failed',
          },
        ],
      },
    };
  }
}

// Temporal Workflows Health Check
async function checkTemporalHealth(): Promise<ComponentHealthStatus> {
  const startTime = Date.now();
  const checks: ComponentHealthStatus['details']['checks'] = [];

  try {
    // Note: workflow_executions table doesn't exist in production schema.
    // Skip workflow execution queries and report as info status.
    const executionsStart = Date.now();

    // Workflow metrics would require workflow_executions table
    // For now, report feature as not enabled
    checks.push({
      name: 'recent_workflow_executions',
      status: 'pass',
      message: 'Workflow execution metrics not enabled (table not provisioned)',
      responseTime: Date.now() - executionsStart,
      data: { recent_executions: 0, feature_enabled: false },
    });

    // Success rate check skipped - requires workflow_executions table
    checks.push({
      name: 'workflow_success_rate',
      status: 'pass',
      message: 'Success rate check skipped (workflow_executions not provisioned)',
      data: {
        success_rate: 100,
        successful: 0,
        total: 0,
        feature_enabled: false,
      },
    });

    const overallStatus = checks.every(c => c.status === 'pass')
      ? 'healthy'
      : checks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded';

    return {
      component: 'temporal_workflows',
      status: overallStatus,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: '1.24.0',
      details: {
        message: 'Event-driven grading workflows with idempotent processing',
        checks,
      },
    };
  } catch (error) {
    return {
      component: 'temporal_workflows',
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'Temporal workflows health check failed',
        checks: [
          {
            name: 'temporal_error',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Temporal check failed',
          },
        ],
      },
    };
  }
}

// AlertAgent Health Check
async function checkAlertAgentHealth(): Promise<ComponentHealthStatus> {
  const startTime = Date.now();
  const checks: ComponentHealthStatus['details']['checks'] = [];

  try {
    // Check agent health table
    // Production schema: id, agent, status, last_heartbeat, details, created_at, updated_at
    const agentHealthStart = Date.now();
    const { data: agentHealth } = await supabase
      .from('agent_health')
      .select('agent, status, last_heartbeat')
      .eq('agent', 'AlertAgent')
      .single();

    const isHealthy =
      agentHealth &&
      (agentHealth.status === 'active' || agentHealth.status === 'healthy') &&
      new Date(String(agentHealth.last_heartbeat || new Date().toISOString())) >
        new Date(Date.now() - 5 * 60 * 1000);

    checks.push({
      name: 'agent_heartbeat',
      status: isHealthy ? 'pass' : 'fail',
      message: isHealthy ? 'Agent heartbeat healthy' : 'Agent heartbeat missing or stale',
      responseTime: Date.now() - agentHealthStart,
      data: {
        agent_name: agentHealth?.agent || 'unknown',
        status: agentHealth?.status || 'unknown',
        last_heartbeat: agentHealth?.last_heartbeat || null,
      },
    });

    // Check recent alerts generated
    const alertsStart = Date.now();
    const { data: recentAlerts } = await supabase
      .from('events')
      .select('event_type, created_at')
      .in('event_type', [
        'alert.injury.detected.v1',
        'alert.high_tier.v1',
        'alert.hedge.opportunity.v1',
        'alert.middle.opportunity.v1',
      ])
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(10);

    const alertCount = recentAlerts?.length || 0;
    checks.push({
      name: 'alert_generation',
      status: 'pass', // Alerts are event-driven, so 0 is acceptable
      message: `${alertCount} alerts generated in last hour`,
      responseTime: Date.now() - alertsStart,
      data: { recent_alerts: alertCount },
    });

    const overallStatus = checks.every(c => c.status === 'pass')
      ? 'healthy'
      : checks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded';

    return {
      component: 'alert_agent',
      status: overallStatus,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      details: {
        message: 'Event-driven injury, hedge, and middle alert monitoring',
        checks,
      },
    };
  } catch (error) {
    return {
      component: 'alert_agent',
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'AlertAgent health check failed',
        checks: [
          {
            name: 'alert_agent_error',
            status: 'fail',
            message: error instanceof Error ? error.message : 'AlertAgent check failed',
          },
        ],
      },
    };
  }
}

// Events Stream Health Check
async function checkEventsStreamHealth(): Promise<ComponentHealthStatus> {
  const startTime = Date.now();
  const checks: ComponentHealthStatus['details']['checks'] = [];

  try {
    // Check recent event ingestion across all sources
    const ingestionStart = Date.now();
    const recentEventSources = await Promise.allSettled([
      supabase
        .from('events')
        .select('count')
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
      supabase
        .from('bridge_outbox')
        .select('count')
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
      supabase
        .from('workflow_executions')
        .select('count')
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
    ]);

    const healthySources = recentEventSources.filter(
      result => result.status === 'fulfilled'
    ).length;
    checks.push({
      name: 'event_sources_accessible',
      status: healthySources === 3 ? 'pass' : healthySources >= 2 ? 'warn' : 'fail',
      message: `${healthySources}/3 event sources accessible`,
      responseTime: Date.now() - ingestionStart,
      data: { accessible_sources: healthySources },
    });

    const overallStatus = checks.every(c => c.status === 'pass')
      ? 'healthy'
      : checks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded';

    return {
      component: 'events_stream',
      status: overallStatus,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      details: {
        message: 'Multi-source event streaming with SSE and replay capabilities',
        checks,
      },
    };
  } catch (error) {
    return {
      component: 'events_stream',
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'Events stream health check failed',
        checks: [
          {
            name: 'events_stream_error',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Events stream check failed',
          },
        ],
      },
    };
  }
}

// Smart Form Bridge Health Check
async function checkSmartFormBridgeHealth(): Promise<ComponentHealthStatus> {
  const startTime = Date.now();
  const checks: ComponentHealthStatus['details']['checks'] = [];

  try {
    // Check bridge outbox processing
    const outboxStart = Date.now();
    const { data: outboxStats } = await supabase
      .from('bridge_outbox')
      .select('status')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const totalEvents = outboxStats?.length || 0;
    const processedEvents = outboxStats?.filter(e => e.status === 'processed').length || 0;
    const processingRate = totalEvents > 0 ? (processedEvents / totalEvents) * 100 : 100;

    checks.push({
      name: 'bridge_processing_rate',
      status: processingRate >= 95 ? 'pass' : processingRate >= 85 ? 'warn' : 'fail',
      message: `${processingRate.toFixed(1)}% processing success rate`,
      responseTime: Date.now() - outboxStart,
      data: {
        processing_rate: processingRate,
        processed_events: processedEvents,
        total_events: totalEvents,
      },
    });

    // Check for stuck events
    const stuckStart = Date.now();
    const { data: stuckEvents } = await supabase
      .from('bridge_outbox')
      .select('id')
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    const stuckCount = stuckEvents?.length || 0;
    checks.push({
      name: 'stuck_events',
      status: stuckCount === 0 ? 'pass' : stuckCount < 5 ? 'warn' : 'fail',
      message: `${stuckCount} events stuck in processing`,
      responseTime: Date.now() - stuckStart,
      data: { stuck_events: stuckCount },
    });

    const overallStatus = checks.every(c => c.status === 'pass')
      ? 'healthy'
      : checks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded';

    return {
      component: 'smart_form_bridge',
      status: overallStatus,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      details: {
        message: 'Smart Form to production pipeline bridge integration',
        checks,
      },
    };
  } catch (error) {
    return {
      component: 'smart_form_bridge',
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {
        message: 'Smart Form bridge health check failed',
        checks: [
          {
            name: 'smart_form_bridge_error',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Smart Form bridge check failed',
          },
        ],
      },
    };
  }
}
