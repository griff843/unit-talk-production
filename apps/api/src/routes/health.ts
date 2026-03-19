/* eslint-disable complexity, no-console, no-unused-vars, no-unreachable, max-lines-per-function, @typescript-eslint/no-unused-vars */
// Pre-existing ESLint complexity issues - documented for SPRINT-058A
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Router, Request, Response } from 'express';
import Redis from 'ioredis';

import { autopilotGuard } from '../lib/AutopilotGuard';
import { detectOrphanedPicks } from '../monitoring/OrphanedStateDetector';
import { evaluatePlatformThresholds } from '../services/PlatformThresholdEvaluator';
import { getOutboxDepthMetrics } from '../services/publishOutbox';
import { getEnv } from '../utils/getEnv';
import { createLogger } from '../utils/logger';

import {
  computeLifecycleCompletionSlo,
  computeDiscordPostingSlo,
  computeGradingLatencySlo,
  computeSettlementAccuracySlo,
} from './slo';
// SPRINT-OPERATIONAL-OBSERVABILITY

const env = getEnv();
const logger = createLogger('Health');

// SPRINT-SYNDICATE-FOUNDATION-REALIGN-114A: Real Supabase client for health checks
// NO MOCK DATA - Health must reflect actual database connectivity

// SPRINT-SCHEMA-ENV-GATES-002: Lazy Supabase initialization
let _supabaseClient: SupabaseClient | null = null;
let _supabaseInitError: string | null = null;
let _supabaseInitialized = false;

function getHealthSupabase(): { client: SupabaseClient | null; error: string | null } {
  if (_supabaseInitialized) {
    return { client: _supabaseClient, error: _supabaseInitError };
  }
  _supabaseInitialized = true;
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      _supabaseClient = createClient(supabaseUrl, supabaseKey);
    } else {
      _supabaseInitError = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured';
    }
  } catch (err) {
    _supabaseInitError =
      err instanceof Error ? err.message : 'Failed to initialize Supabase client';
  }
  return { client: _supabaseClient, error: _supabaseInitError };
}

// Interface for health check results
interface SupabaseHealthResult {
  connected: boolean;
  error?: string;
  responseTime?: number;
}

const router: Router = Router();

// SPRINT-SCHEMA-ENV-GATES-002: Lazy Redis initialization
let _redis: Redis | null = null;
function getHealthRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      host: process.env.REDIS_HOST || 'unit-talk-redis',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return _redis;
}

// SPRINT-OPERATIONAL-OBSERVABILITY: Outbox depth advisory
interface OutboxHealth {
  pendingCount: number;
  failedCount: number;
  oldestPendingAgeMinutes: number | null;
  staleAlert: boolean;
}

// SPRINT-OPERATIONAL-OBSERVABILITY: Orphaned pick advisory (FM-5)
interface OrphanedPicksAdvisory {
  stuckInApproved: number;
  stuckInPosted: number;
}

// SPRINT-OPERATIONAL-OBSERVABILITY: Worker heartbeat (FM-9)
interface WorkerHeartbeatStatus {
  workerName: string;
  lastHeartbeatAt: string | null;
  ageMinutes: number | null;
  status: 'healthy' | 'stale' | 'missing';
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    agents: ServiceStatus;
    external_apis: ServiceStatus;
  };
  // SPRINT-OPERATIONAL-OBSERVABILITY advisories (non-blocking)
  outbox?: OutboxHealth;
  orphanedPicks?: OrphanedPicksAdvisory;
  workerHeartbeats?: WorkerHeartbeatStatus[];
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  system: {
    loadAverage: number[];
    cpuUsage: number;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

// Detailed health check endpoint
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'down', lastCheck: new Date().toISOString() },
      redis: { status: 'down', lastCheck: new Date().toISOString() },
      agents: { status: 'down', lastCheck: new Date().toISOString() },
      external_apis: { status: 'down', lastCheck: new Date().toISOString() },
    },
    version: process.env['npm_package_version'] || 'unknown',
    uptime: process.uptime(),
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
    },
    system: {
      loadAverage: [],
      cpuUsage: 0,
    },
  };

  try {
    // Get system metrics
    const memUsage = process.memoryUsage();
    healthStatus.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };

    healthStatus.system = {
      loadAverage: require('os').loadavg(),
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
    };

    // Check database - SPRINT-114A: Real connectivity check, no mocks
    const dbStartTime = Date.now();
    const { client: supabaseClient, error: supabaseInitError } = getHealthSupabase();
    try {
      if (!supabaseClient) {
        // Supabase not configured - report honestly
        healthStatus.services.database = {
          status: 'down',
          lastCheck: new Date().toISOString(),
          error: supabaseInitError || 'Supabase client not initialized',
        };
      } else {
        // Real database query - use agent_health table (exists in schema)
        const { data, error: dbError } = await supabaseClient
          .from('agent_health')
          .select('id')
          .limit(1);

        const dbResponseTime = Date.now() - dbStartTime;
        healthStatus.services.database = {
          status: dbError ? 'down' : 'up',
          responseTime: dbResponseTime,
          lastCheck: new Date().toISOString(),
          error: dbError?.message,
        };
      }
    } catch (error) {
      healthStatus.services.database = {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }

    // Check Redis
    const redisStartTime = Date.now();
    try {
      const redisResult = await getHealthRedis().ping();
      const redisResponseTime = Date.now() - redisStartTime;

      healthStatus.services.redis = {
        status: redisResult === 'PONG' ? 'up' : 'down',
        responseTime: redisResponseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      healthStatus.services.redis = {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }

    // Check agents health (simplified - would check actual agent status)
    try {
      // This would typically check agent heartbeats or status endpoints
      const agentHealthy = await checkAgentsHealth();
      healthStatus.services.agents = {
        status: agentHealthy ? 'up' : 'degraded',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      healthStatus.services.agents = {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown agent error',
      };
    }

    // Check external APIs
    try {
      const externalApisHealthy = await checkExternalAPIs();
      healthStatus.services.external_apis = {
        status: externalApisHealthy ? 'up' : 'degraded',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      healthStatus.services.external_apis = {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown external API error',
      };
    }

    // SPRINT-OPERATIONAL-OBSERVABILITY: Advisory checks (non-blocking — never flip healthy→unhealthy)
    if (supabaseClient) {
      // FM-2: Outbox depth monitor
      try {
        const outboxMetrics = await getOutboxDepthMetrics(supabaseClient);
        healthStatus.outbox = {
          pendingCount: outboxMetrics.pendingCount,
          failedCount: outboxMetrics.failedCount,
          oldestPendingAgeMinutes: outboxMetrics.oldestPendingAgeMinutes,
          staleAlert: outboxMetrics.staleAlert,
        };
        if (outboxMetrics.staleAlert) {
          logger.warn('FM-2: Outbox stale alert', {
            pendingCount: outboxMetrics.pendingCount,
            oldestPendingAgeMinutes: outboxMetrics.oldestPendingAgeMinutes,
          });
        }
      } catch (_outboxErr) {
        // Advisory only — do not fail health check
      }

      // FM-5: Orphaned pick advisory
      try {
        const orphaned = await detectOrphanedPicks(supabaseClient);
        healthStatus.orphanedPicks = {
          stuckInApproved: orphaned.stuckInApproved,
          stuckInPosted: orphaned.stuckInPosted,
        };
      } catch (_orphanErr) {
        // Advisory only — do not fail health check
      }

      // FM-9: Worker heartbeat check — REM-005: all 3 covered workers, no silent omission
      try {
        const staleThresholdMinutes = 5;
        const EXPECTED_WORKERS = ['temporal-worker', 'bridge-worker', 'discord-ticket-worker'];

        const { data: heartbeats } = await supabaseClient
          .from('ops_worker_heartbeats')
          .select('worker_name, last_heartbeat_at, status')
          .in('worker_name', EXPECTED_WORKERS)
          .order('last_heartbeat_at', { ascending: false });

        const heartbeatMap = new Map<string, { last_heartbeat_at: string; status: string }>();
        for (const h of heartbeats ?? []) {
          // Keep only the most recent row per worker (ordered desc)
          if (!heartbeatMap.has(h.worker_name)) {
            heartbeatMap.set(h.worker_name, h);
          }
        }

        // Build entries for ALL expected workers — missing workers are explicit, never omitted
        healthStatus.workerHeartbeats = EXPECTED_WORKERS.map(workerName => {
          const h = heartbeatMap.get(workerName);
          if (!h) {
            return {
              workerName,
              lastHeartbeatAt: null,
              ageMinutes: null,
              status: 'missing' as const,
            };
          }
          const ageMs = h.last_heartbeat_at
            ? Date.now() - new Date(h.last_heartbeat_at).getTime()
            : null;
          const ageMinutes = ageMs !== null ? Math.floor(ageMs / 60000) : null;
          const heartbeatStatus: 'healthy' | 'stale' | 'missing' =
            ageMinutes === null
              ? 'missing'
              : ageMinutes > staleThresholdMinutes
                ? 'stale'
                : 'healthy';
          return {
            workerName,
            lastHeartbeatAt: h.last_heartbeat_at ?? null,
            ageMinutes,
            status: heartbeatStatus,
          };
        });
      } catch (_workerErr) {
        // Advisory only — do not fail health check
      }
    }

    // Determine overall status
    const serviceStatuses = Object.values(healthStatus.services).map(s => s.status);
    const downServices = serviceStatuses.filter(s => s === 'down').length;
    const degradedServices = serviceStatuses.filter(s => s === 'degraded').length;

    if (downServices > 0) {
      healthStatus.status = 'unhealthy';
    } else if (degradedServices > 0) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'healthy';
    }

    // Log health check
    logger.info('Health check completed', {
      status: healthStatus.status,
      responseTime: Date.now() - startTime,
      services: healthStatus.services,
    });

    // PHASE1-ENFORCEMENT-LOCK-001: Binary health (200 only if fully healthy)
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', {
      err: error instanceof Error ? error.message : String(error),
    });

    healthStatus.status = 'unhealthy';
    res.status(503).json({
      ...healthStatus,
      error: 'Health check failed',
    });
  }
});

// Simple liveness probe
router.get('/health/live', (req: Request, res: Response) => {
  console.log(`Health live request from ${req.ip || 'unknown IP'}`);
  res.status(200).json({ status: 'live' });
});

// Readiness probe
router.get('/health/ready', async (req: Request, res: Response) => {
  console.log(`Health ready request from ${req.ip || 'unknown IP'}`);
  res.status(200).json({ status: 'ready' });
});

/*
// Metrics endpoint for Prometheus
router.get('/metrics', async (req: Request, res: Response) => {
  console.log(`Metrics request from ${req.ip || 'unknown IP'}`);
  res.status(200).json({ metrics: 'available' });
});
*/

// Helper functions
async function checkAgentsHealth(): Promise<boolean> {
  try {
    // This would check actual agent status
    // For now, return true as a placeholder
    return true;
  } catch (error) {
    logger.error('Agent health check failed', {
      err: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function checkExternalAPIs(): Promise<boolean> {
  try {
    // Check OpenAI API
    if (process.env['OPENAI_API_KEY']) {
      // Would make a simple API call to verify connectivity
    }

    // Check other external services
    return true;
  } catch (error) {
    logger.error('External API health check failed', {
      err: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/*
async function collectMetrics(): Promise<string> {
  console.log('Collecting metrics');
  return 'metrics collected';
}
*/

// ─── SPRINT-043: Platform Health Summary ──────────────────────────────────────

type SubsystemStatus = 'UP' | 'DEGRADED' | 'DOWN';
type PlatformStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

interface SubsystemEntry {
  name: string;
  status: SubsystemStatus;
  notes?: string;
}

interface HealthSummaryResponse {
  platform_status: PlatformStatus;
  computed_at: string;
  subsystems: SubsystemEntry[];
  slo_breaches: number;
  slo_warns: number;
  alert_count: number;
  high_alert_count: number;
  autopilot_mode: string;
}

/**
 * GET /api/health/summary
 * Unified platform health: subsystems + SLO attainment + threshold alerts + autopilot mode.
 * No auth required — designed for monitoring dashboards and ops checks.
 */
router.get('/summary', async (_req: Request, res: Response) => {
  const { client: db } = getHealthSupabase();

  if (!db) {
    return res.status(503).json({
      platform_status: 'CRITICAL',
      computed_at: new Date().toISOString(),
      subsystems: [{ name: 'database', status: 'DOWN', notes: 'Supabase not configured' }],
      slo_breaches: 0,
      slo_warns: 0,
      alert_count: 0,
      high_alert_count: 0,
      autopilot_mode: autopilotGuard.getMode(),
    });
  }

  // Compute SLOs and thresholds in parallel
  const [sloResults, thresholdResults] = await Promise.allSettled([
    Promise.allSettled([
      computeLifecycleCompletionSlo(db),
      computeDiscordPostingSlo(db),
      computeGradingLatencySlo(db),
      computeSettlementAccuracySlo(db),
    ]),
    // Threshold evaluation runs after SLOs (needs them for SLO breach alerts);
    // we'll pass slos once computed
    Promise.resolve(null), // placeholder — evaluated below
  ]);

  const slos =
    sloResults.status === 'fulfilled'
      ? (sloResults.value
          .map(r => (r.status === 'fulfilled' ? r.value : null))
          .filter(Boolean) as import('./slo').SloEntry[])
      : [];

  // Now evaluate thresholds with computed SLOs
  const thresholds = await evaluatePlatformThresholds(db, slos).catch(() => ({
    alerts: [],
    evaluated_at: new Date().toISOString(),
  }));

  // SLO summary counts
  const sloBreaches = slos.filter(s => s.status === 'BREACH').length;
  const sloWarns = slos.filter(s => s.status === 'WARN').length;
  const highAlerts = thresholds.alerts.filter(a => a.severity === 'HIGH').length;

  // Build subsystem statuses
  const subsystems: SubsystemEntry[] = [
    {
      name: 'lifecycle_completion_slo',
      status:
        slos.find(s => s.id === 'lifecycle_completion')?.status === 'BREACH'
          ? 'DOWN'
          : slos.find(s => s.id === 'lifecycle_completion')?.status === 'WARN'
            ? 'DEGRADED'
            : 'UP',
    },
    {
      name: 'discord_posting_slo',
      status:
        slos.find(s => s.id === 'discord_posting')?.status === 'BREACH'
          ? 'DOWN'
          : slos.find(s => s.id === 'discord_posting')?.status === 'WARN'
            ? 'DEGRADED'
            : 'UP',
    },
    {
      name: 'grading_latency_slo',
      status:
        slos.find(s => s.id === 'grading_latency_p50')?.status === 'BREACH'
          ? 'DOWN'
          : slos.find(s => s.id === 'grading_latency_p50')?.status === 'WARN'
            ? 'DEGRADED'
            : 'UP',
    },
    {
      name: 'settlement_accuracy_slo',
      status:
        slos.find(s => s.id === 'settlement_accuracy')?.status === 'BREACH'
          ? 'DOWN'
          : slos.find(s => s.id === 'settlement_accuracy')?.status === 'WARN'
            ? 'DEGRADED'
            : 'UP',
    },
    {
      name: 'risk_engine',
      status: (thresholds.alerts.some(a => a.source === 'drawdown' && a.severity === 'HIGH')
        ? 'DEGRADED'
        : 'UP') as SubsystemStatus,
      notes: thresholds.alerts.find(a => a.source === 'drawdown')?.message,
    },
    {
      name: 'outbox',
      status: thresholds.alerts.some(a => a.source === 'outbox') ? 'DEGRADED' : 'UP',
      notes: thresholds.alerts.find(a => a.source === 'outbox')?.message,
    },
    {
      name: 'workers',
      status: thresholds.alerts.some(a => a.source === 'heartbeat' && a.severity === 'HIGH')
        ? 'DEGRADED'
        : 'UP',
      notes: thresholds.alerts.find(a => a.source === 'heartbeat')?.message,
    },
  ];

  // Derive platform status
  const hasDown = subsystems.some(s => s.status === 'DOWN');
  const hasHighAlert = highAlerts > 0;
  const hasDegraded = subsystems.some(s => s.status === 'DEGRADED');

  const platform_status: PlatformStatus =
    hasDown || hasHighAlert ? 'CRITICAL' : hasDegraded || sloWarns > 0 ? 'DEGRADED' : 'HEALTHY';

  const response: HealthSummaryResponse = {
    platform_status,
    computed_at: new Date().toISOString(),
    subsystems,
    slo_breaches: sloBreaches,
    slo_warns: sloWarns,
    alert_count: thresholds.alerts.length,
    high_alert_count: highAlerts,
    autopilot_mode: autopilotGuard.getMode(),
  };

  const statusCode =
    platform_status === 'HEALTHY' ? 200 : platform_status === 'DEGRADED' ? 200 : 503;
  res.status(statusCode).json(response);
});

export default router;
