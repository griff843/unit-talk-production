import { Router, Request, Response } from 'express';
import { logger } from '../utils/enterpriseErrorHandling';
import { EnterpriseCache } from '../services/enterpriseCache';
// import { supabase } from '../config/supabase'; // Commented out until config is available

const router = Router();
const cache = new EnterpriseCache();

// Metrics endpoint for Prometheus
router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = {
      // Application metrics
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      
      // Custom business metrics
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // Cache metrics
      cache_stats: cache.getStats(),
    };

    // Format as Prometheus metrics
    const prometheusMetrics = [
      `# HELP nodejs_uptime_seconds Process uptime in seconds`,
      `# TYPE nodejs_uptime_seconds gauge`,
      `nodejs_uptime_seconds ${metrics.uptime}`,
      
      `# HELP nodejs_memory_usage_bytes Memory usage in bytes`,
      `# TYPE nodejs_memory_usage_bytes gauge`,
      `nodejs_memory_usage_bytes{type="rss"} ${metrics.memory.rss}`,
      `nodejs_memory_usage_bytes{type="heapTotal"} ${metrics.memory.heapTotal}`,
      `nodejs_memory_usage_bytes{type="heapUsed"} ${metrics.memory.heapUsed}`,
      `nodejs_memory_usage_bytes{type="external"} ${metrics.memory.external}`,
      
      `# HELP cache_operations_total Total cache operations`,
      `# TYPE cache_operations_total counter`,
      `cache_operations_total{operation="hits"} ${metrics.cache_stats.hits}`,
      `cache_operations_total{operation="misses"} ${metrics.cache_stats.misses}`,
      `cache_operations_total{operation="sets"} ${metrics.cache_stats.sets}`,
      `cache_operations_total{operation="deletes"} ${metrics.cache_stats.deletes}`,
      
      `# HELP cache_hit_ratio Cache hit ratio`,
      `# TYPE cache_hit_ratio gauge`,
      `cache_hit_ratio ${metrics.cache_stats.hitRate}`,
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Error generating metrics', { error });
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Health check endpoint
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: await cache.healthCheck(),
      // database: await checkDatabaseHealth(), // Commented out until supabase config is available
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

// Readiness probe
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const cacheReady = await cache.healthCheck();
    // const dbReady = await checkDatabaseHealth(); // Commented out until supabase config is available

    if (cacheReady.status === 'healthy') {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          cache: cacheReady.status,
          // database: dbReady ? 'ready' : 'not ready', // Commented out
        },
      });
    } else {
      throw new Error('Services not ready');
    }
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Services not ready',
    });
  }
});

// Liveness probe
router.get('/live', async (_req: Request, res: Response) => {
  try {
    // Basic liveness check
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Liveness check failed', { error });
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: 'Service not responding',
    });
  }
});

// Application info endpoint
router.get('/info', (_req: Request, res: Response) => {
  try {
    const info = {
      name: 'Unit Talk Discord Bot',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    res.json(info);
  } catch (error) {
    logger.error('Error getting application info', { error });
    res.status(500).json({ error: 'Failed to get application info' });
  }
});

// Database health check helper (commented out until supabase config is available)
/*
async function checkDatabaseHealth() {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    return !error;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}
*/

export default router;