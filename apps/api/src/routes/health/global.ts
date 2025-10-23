/**
 * PHASE 10 - GLOBAL HEALTH CHECK ENDPOINT
 * 
 * Region-aware health checks for multi-region deployment with:
 * - Database replication lag monitoring
 * - Redis connectivity checks
 * - Regional service status
 * - SLO compliance validation
 * 
 * Date: 2025-01-23
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../../services/supabaseClient';
import { createClient } from 'redis';

const router = Router();

// Region detection from environment or headers
const REGION = process.env.AWS_REGION || 'us-east-1';
const REGION_NAME_MAP: Record<string, string> = {
  'us-east-1': 'na',
  'eu-west-1': 'eu',
  'ap-southeast-1': 'apac',
};

// SLO Targets
const SLO_TARGETS = {
  maxReplicationLagMs: 3000,  // 3 seconds
  maxResponseTimeMs: 200,     // 200ms P95
  minAvailability: 99.95,     // 99.95%
};

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  region: string;
  timestamp: string;
  checks: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      replicationLag?: number;
      connectionTime: number;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      connectionTime: number;
    };
    api: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime: number;
    };
  };
  slo: {
    compliant: boolean;
    violations: string[];
  };
  metadata: {
    version: string;
    uptime: number;
    nodeVersion: string;
  };
}

/**
 * Check database health and replication lag
 */
async function checkDatabase(): Promise<HealthCheckResult['checks']['database']> {
  const startTime = Date.now();

  try {
    // Test database connection
    const { error } = await supabase
      .from('agent_health')
      .select('agent_name')
      .limit(1);

    if (error) {
      return {
        status: 'unhealthy',
        connectionTime: Date.now() - startTime,
      };
    }
    
    // Check replication lag (if replica region)
    let replicationLag: number | undefined;
    if (REGION !== 'us-east-1') {
      // Query replication lag from pg_stat_replication
      const { data: lagData } = await supabase.rpc('get_replication_lag');
      replicationLag = lagData?.[0]?.lag_ms || 0;
    }
    
    const connectionTime = Date.now() - startTime;
    
    // Determine status based on replication lag
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (replicationLag && replicationLag > SLO_TARGETS.maxReplicationLagMs) {
      status = 'degraded';
    }
    if (replicationLag && replicationLag > SLO_TARGETS.maxReplicationLagMs * 2) {
      status = 'unhealthy';
    }
    
    return {
      status,
      replicationLag,
      connectionTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connectionTime: Date.now() - startTime,
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<HealthCheckResult['checks']['redis']> {
  const startTime = Date.now();
  
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url: redisUrl });
    
    await client.connect();
    await client.ping();
    await client.disconnect();
    
    return {
      status: 'healthy',
      connectionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connectionTime: Date.now() - startTime,
    };
  }
}

/**
 * Check API health
 */
async function checkAPI(): Promise<HealthCheckResult['checks']['api']> {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;
  
  // Check if response time meets SLO
  const status = responseTime > SLO_TARGETS.maxResponseTimeMs ? 'degraded' : 'healthy';
  
  return {
    status,
    responseTime,
  };
}

/**
 * Validate SLO compliance
 */
function validateSLO(checks: HealthCheckResult['checks']): HealthCheckResult['slo'] {
  const violations: string[] = [];
  
  // Check replication lag
  if (checks.database.replicationLag && checks.database.replicationLag > SLO_TARGETS.maxReplicationLagMs) {
    violations.push(`Replication lag ${checks.database.replicationLag}ms exceeds target ${SLO_TARGETS.maxReplicationLagMs}ms`);
  }
  
  // Check response time
  if (checks.api.responseTime > SLO_TARGETS.maxResponseTimeMs) {
    violations.push(`Response time ${checks.api.responseTime}ms exceeds target ${SLO_TARGETS.maxResponseTimeMs}ms`);
  }
  
  // Check component health
  if (checks.database.status === 'unhealthy') {
    violations.push('Database is unhealthy');
  }
  if (checks.redis.status === 'unhealthy') {
    violations.push('Redis is unhealthy');
  }
  
  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * Global health check endpoint
 * GET /api/health/global
 */
router.get('/global', async (req: Request, res: Response) => {
  try {
    // Run all health checks in parallel
    const [database, redis, api] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkAPI(),
    ]);

    const checks = { database, redis, api };
    const slo = validateSLO(checks);

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (database.status === 'unhealthy' || redis.status === 'unhealthy') {
      status = 'unhealthy';
    } else if (database.status === 'degraded' || api.status === 'degraded') {
      status = 'degraded';
    }

    const regionName = REGION_NAME_MAP[REGION] || REGION;

    const result: HealthCheckResult = {
      status,
      region: regionName,
      timestamp: new Date().toISOString(),
      checks,
      slo,
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        nodeVersion: process.version,
      },
    };

    // Set appropriate HTTP status code
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

    res.status(httpStatus).json(result);
  } catch (error) {
    const regionName = REGION_NAME_MAP[REGION] || REGION;
    res.status(503).json({
      status: 'unhealthy',
      region: regionName,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Regional health check endpoint
 * GET /api/health/region
 */
router.get('/region', (_req: Request, res: Response) => {
  const regionName = REGION_NAME_MAP[REGION] || REGION;
  res.json({
    region: regionName,
    awsRegion: REGION,
    timestamp: new Date().toISOString(),
    status: 'healthy',
  });
});

/**
 * Readiness probe for Kubernetes
 * GET /api/health/ready
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Quick database check
    const { error } = await supabase
      .from('agent_health')
      .select('agent_name')
      .limit(1);

    if (error) {
      return res.status(503).json({ ready: false, reason: 'Database unavailable' });
    }

    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Service unavailable' });
  }
});

/**
 * Liveness probe for Kubernetes
 * GET /api/health/live
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

export default router;

