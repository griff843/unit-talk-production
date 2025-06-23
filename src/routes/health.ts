import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Create a simple SupabaseService interface for health checks
interface SimpleSupabaseService {
  client: {
    from: (table: string) => {
      select: (columns: string) => {
        limit: (count: number) => Promise<{ error?: any }>;
      };
    };
  };
}

// Simple implementation for health checks
const createSimpleSupabaseService = (): SimpleSupabaseService => {
  return {
    client: {
      from: (_table: string) => ({
        select: (_columns: string) => ({
          limit: async (_count: number) => {
            // Simple health check - just return success for now
            // In production, this would make an actual database call
            return { error: null };
          }
        })
      })
    }
  };
};

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const supabase = createSimpleSupabaseService();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    agents: ServiceStatus;
    external_apis: ServiceStatus;
  };
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
router.get('/health', async (req: Request, res: Response) => {
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
    version: process.env.npm_package_version || '1.0.0',
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

    // Check database
    const dbStartTime = Date.now();
    try {
      const { error: dbError } = await supabase.client
        .from('user_profiles')
        .select('count')
        .limit(1);
      
      const dbResponseTime = Date.now() - dbStartTime;
      healthStatus.services.database = {
        status: dbError ? 'down' : 'up',
        responseTime: dbResponseTime,
        lastCheck: new Date().toISOString(),
        error: dbError?.message,
      };
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
      const redisResult = await redis.ping();
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

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    
    healthStatus.status = 'unhealthy';
    res.status(503).json({
      ...healthStatus,
      error: 'Health check failed',
    });
  }
});

// Simple liveness probe
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Quick checks for critical services
    const dbCheck = supabase.client.from('user_profiles').select('count').limit(1);
    const redisCheck = redis.ping();

    const [dbResult, redisResult] = await Promise.allSettled([dbCheck, redisCheck]);

    const isReady = dbResult.status === 'fulfilled' && 
                   redisResult.status === 'fulfilled' && 
                   redisResult.value === 'PONG';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbResult.status === 'fulfilled',
          redis: redisResult.status === 'fulfilled' && redisResult.value === 'PONG',
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Metrics endpoint for Prometheus
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // This would typically use a metrics library like prom-client
    const metrics = await collectMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to collect metrics', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// Helper functions
async function checkAgentsHealth(): Promise<boolean> {
  try {
    // This would check actual agent status
    // For now, return true as a placeholder
    return true;
  } catch (error) {
    logger.error('Agent health check failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function checkExternalAPIs(): Promise<boolean> {
  try {
    // Check OpenAI API
    if (process.env.OPENAI_API_KEY) {
      // Would make a simple API call to verify connectivity
    }

    // Check other external services
    return true;
  } catch (error) {
    logger.error('External API health check failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function collectMetrics(): Promise<string> {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Basic Prometheus format metrics
  return `
# HELP nodejs_memory_heap_used_bytes Process heap memory used
# TYPE nodejs_memory_heap_used_bytes gauge
nodejs_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP nodejs_memory_heap_total_bytes Process heap memory total
# TYPE nodejs_memory_heap_total_bytes gauge
nodejs_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP nodejs_process_uptime_seconds Process uptime in seconds
# TYPE nodejs_process_uptime_seconds counter
nodejs_process_uptime_seconds ${uptime}

# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1
  `.trim();
}

export default router;