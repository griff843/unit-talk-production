/* eslint-disable max-lines, max-lines-per-function */
// Pre-existing file structure exceeds line limits - refactor deferred
import os from 'os';
import { performance } from 'perf_hooks';

import express, { Request, Response, Router } from 'express';
import Redis from 'ioredis';

import { SupabaseService } from '../services/supabase';
import { toISOString } from '../utils/dateUtils';
import { HealthChecker, PerformanceMonitor, logger } from '../utils/enterpriseErrorHandling';
import { getGatewayStatus, isGatewayConnected } from '../utils/gatewayStatus';

const router: Router = express.Router();
const healthChecker = new HealthChecker();
const performanceMonitor = PerformanceMonitor.getInstance();

// Initialize health checks
initializeHealthChecks();

// Basic health check endpoint
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await healthChecker.getOverallHealth();
    // PHASE1-ENFORCEMENT-LOCK-001: Binary health (200 only if fully healthy)
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
      checks: health.checks,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: toISOString(new Date()),
      error: 'Health check system failure',
    });
  }
});

// Detailed health check with system metrics
router.get('/health/detailed', async (_req: Request, res: Response) => {
  try {
    const health = await healthChecker.getOverallHealth();
    const systemMetrics = getSystemMetrics();
    const performanceMetrics = performanceMonitor.getAllMetrics();

    // PHASE1-ENFORCEMENT-LOCK-001: Binary health (200 only if fully healthy)
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
      checks: health.checks,
      system: systemMetrics,
      performance: performanceMetrics,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: toISOString(new Date()),
      error: 'Health check system failure',
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check critical dependencies
    // discord_api: REST reachability; discord_gateway: WebSocket connection
    const criticalChecks = ['database', 'discord_api', 'discord_gateway', 'redis'];
    const health = await healthChecker.getOverallHealth();

    const criticalStatus = criticalChecks.every(
      check => health.checks[check]?.status === 'healthy'
    );

    if (criticalStatus) {
      res.status(200).json({
        status: 'ready',
        timestamp: toISOString(new Date()),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: toISOString(new Date()),
        failedChecks: criticalChecks.filter(check => health.checks[check]?.status !== 'healthy'),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: toISOString(new Date()),
      error: 'Readiness check failed',
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: toISOString(new Date()),
    pid: process.pid,
    uptime: process.uptime(),
  });
});

// Metrics endpoint (Prometheus format)
router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = generatePrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).send('# Metrics generation failed\n');
  }
});

// Performance metrics endpoint
router.get('/performance', (_req: Request, res: Response) => {
  try {
    const metrics = performanceMonitor.getAllMetrics();
    const systemMetrics = getSystemMetrics();

    res.json({
      timestamp: toISOString(new Date()),
      performance: metrics,
      system: systemMetrics,
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Performance metrics failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Performance metrics generation failed',
      timestamp: toISOString(new Date()),
    });
  }
});

// Initialize health checks
function initializeHealthChecks(): void {
  // Database health check
  healthChecker.addCheck('database', async () => {
    const startTime = performance.now();
    try {
      const supabaseService = new SupabaseService();
      const { data: _data, error } = await supabaseService.client
        .from('user_profiles')
        .select('count')
        .limit(1);

      const duration = performance.now() - startTime;

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: toISOString(new Date()),
          duration,
          details: { error: error.message },
        };
      }

      return {
        status: duration < 1000 ? 'healthy' : 'degraded',
        timestamp: toISOString(new Date()),
        duration,
        details: { responseTime: `${Math.round(duration)}ms` },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: toISOString(new Date()),
        duration: performance.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  });

  // Redis health check
  healthChecker.addCheck('redis', async () => {
    const startTime = performance.now();
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      await redis.ping();
      const duration = performance.now() - startTime;
      await redis.disconnect();

      return {
        status: duration < 500 ? 'healthy' : 'degraded',
        timestamp: toISOString(new Date()),
        duration,
        details: { responseTime: `${Math.round(duration)}ms` },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: toISOString(new Date()),
        duration: performance.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Redis connection failed' },
      };
    }
  });

  // Discord REST API health check (does NOT reflect gateway/WebSocket connection)
  healthChecker.addCheck('discord_api', async () => {
    const startTime = performance.now();
    try {
      const response = await fetch('https://discord.com/api/v10/gateway', {
        method: 'GET',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'User-Agent': 'UnitTalk/1.0.0',
        },
      });

      const duration = performance.now() - startTime;

      if (!response.ok) {
        return {
          status: 'unhealthy',
          timestamp: toISOString(new Date()),
          duration,
          details: {
            error: `Discord API returned ${response.status}`,
            status: response.status,
            note: 'REST API reachability only — see discord_gateway for WebSocket connection',
          },
        };
      }

      return {
        status: duration < 2000 ? 'healthy' : 'degraded',
        timestamp: toISOString(new Date()),
        duration,
        details: {
          responseTime: `${Math.round(duration)}ms`,
          status: response.status,
          note: 'REST API reachability only — see discord_gateway for WebSocket connection',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: toISOString(new Date()),
        duration: performance.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Discord API check failed' },
      };
    }
  });

  // Discord WebSocket gateway connectivity check (bot is CONNECTED to Discord gateway)
  // This is separate from webhook posting (DiscordPromotionAgent uses standalone webhook URL).
  healthChecker.addCheck('discord_gateway', async () => {
    const snapshot = getGatewayStatus();
    const connected = isGatewayConnected();

    return {
      status: connected ? 'healthy' : snapshot.state === 'connecting' ? 'degraded' : 'unhealthy',
      timestamp: toISOString(new Date()),
      duration: 0,
      details: {
        state: snapshot.state,
        connectedAt: snapshot.connectedAt,
        lastError: snapshot.lastError,
        lastErrorAt: snapshot.lastErrorAt,
        note: 'WebSocket gateway connection — required for slash commands, member events, message events. Webhook posting (pick delivery) does NOT depend on this.',
      },
    };
  });

  // Memory health check
  healthChecker.addCheck('memory', async () => {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 80) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: toISOString(new Date()),
      duration: 0,
      details: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        systemMemoryUsage: `${memoryUsagePercent.toFixed(1)}%`,
        freeMemory: `${Math.round(freeMem / 1024 / 1024)}MB`,
      },
    };
  });

  // CPU health check
  healthChecker.addCheck('cpu', async () => {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;

    // Calculate CPU usage over 1 second
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const endUsage = process.cpuUsage(startUsage);

    const userCpuPercent = (endUsage.user / 1000000) * 100;
    const systemCpuPercent = (endUsage.system / 1000000) * 100;
    const totalCpuPercent = userCpuPercent + systemCpuPercent;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (totalCpuPercent > 90 || loadAvg[0] > cpuCount * 2) {
      status = 'unhealthy';
    } else if (totalCpuPercent > 70 || loadAvg[0] > cpuCount * 1.5) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: toISOString(new Date()),
      duration: 1000,
      details: {
        cpuUsage: `${totalCpuPercent.toFixed(1)}%`,
        userCpu: `${userCpuPercent.toFixed(1)}%`,
        systemCpu: `${systemCpuPercent.toFixed(1)}%`,
        loadAverage: loadAvg.map(avg => avg.toFixed(2)),
        cpuCount,
      },
    };
  });
}

// Get system metrics
function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
    },
    cpu: {
      count: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAverage: loadAvg,
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      hostname: os.hostname(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      versions: process.versions,
      env: process.env.NODE_ENV || 'development',
    },
  };
}

// Generate Prometheus metrics
function generatePrometheusMetrics(): string {
  const metrics: string[] = [];
  const timestamp = Date.now();

  // Add custom application metrics
  const performanceMetrics = performanceMonitor.getAllMetrics();

  for (const [name, data] of Object.entries(performanceMetrics)) {
    if (data) {
      metrics.push(`# HELP ${name}_count Total number of operations`);
      metrics.push(`# TYPE ${name}_count counter`);
      metrics.push(`${name}_count ${data.count} ${timestamp}`);

      metrics.push(`# HELP ${name}_duration_avg Average operation duration in milliseconds`);
      metrics.push(`# TYPE ${name}_duration_avg gauge`);
      metrics.push(`${name}_duration_avg ${data.avg.toFixed(2)} ${timestamp}`);

      metrics.push(
        `# HELP ${name}_duration_p95 95th percentile operation duration in milliseconds`
      );
      metrics.push(`# TYPE ${name}_duration_p95 gauge`);
      metrics.push(`${name}_duration_p95 ${data.p95.toFixed(2)} ${timestamp}`);
    }
  }

  // Add system metrics
  const memUsage = process.memoryUsage();
  metrics.push(`# HELP nodejs_heap_used_bytes Node.js heap used in bytes`);
  metrics.push(`# TYPE nodejs_heap_used_bytes gauge`);
  metrics.push(`nodejs_heap_used_bytes ${memUsage.heapUsed} ${timestamp}`);

  metrics.push(`# HELP nodejs_heap_total_bytes Node.js heap total in bytes`);
  metrics.push(`# TYPE nodejs_heap_total_bytes gauge`);
  metrics.push(`nodejs_heap_total_bytes ${memUsage.heapTotal} ${timestamp}`);

  metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
  metrics.push(`# TYPE process_uptime_seconds gauge`);
  metrics.push(`process_uptime_seconds ${process.uptime()} ${timestamp}`);

  const loadAvg = os.loadavg();
  metrics.push(`# HELP system_load_average_1m System load average over 1 minute`);
  metrics.push(`# TYPE system_load_average_1m gauge`);
  metrics.push(`system_load_average_1m ${loadAvg[0]} ${timestamp}`);

  return metrics.join('\n') + '\n';
}

export default router;
