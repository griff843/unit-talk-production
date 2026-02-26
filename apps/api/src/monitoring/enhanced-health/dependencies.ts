/**
 * Health Check Dependency Configurations
 * PHASE1-ENFORCEMENT-LOCK-001: Split from enhanced-health-checks.ts for lint compliance
 */

import { redisCache } from '../../cache/enhanced-cache';
import { circuitBreaker } from '../../services/enhanced-circuit-breaker';

import { DependencyConfig } from './types';

/** Supabase database health check */
export function createSupabaseDependency(): DependencyConfig {
  return {
    name: 'supabase',
    critical: true,
    timeout: 5000,
    checkInterval: 30000,
    healthCheckFn: async () => {
      const startTime = Date.now();
      try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          throw new Error('Missing Supabase configuration');
        }
        await circuitBreaker.executeCall('supabase-health', async () => {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
          const { error } = await supabase.from('unified_picks').select('count').limit(1);
          if (error) throw new Error(`Supabase query failed: ${error.message}`);
          return { success: true };
        });
        return {
          healthy: true,
          responseTime: Date.now() - startTime,
          metadata: {
            url: process.env.SUPABASE_URL,
            circuit_state: circuitBreaker.getServiceStatus('supabase')?.state,
          },
        };
      } catch (error) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };
}

/** Redis cache health check */
export function createRedisDependency(): DependencyConfig {
  return {
    name: 'redis',
    critical: false,
    timeout: 3000,
    checkInterval: 20000,
    healthCheckFn: async () => {
      const startTime = Date.now();
      try {
        const result = await redisCache.healthCheck();
        return {
          healthy: result,
          responseTime: Date.now() - startTime,
          error: result ? undefined : 'Redis health check failed',
          metadata: await redisCache.getStats(),
        };
      } catch (error) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Redis check failed',
        };
      }
    },
  };
}

/** OpenAI API health check */
export function createOpenAIDependency(): DependencyConfig {
  return {
    name: 'openai',
    critical: false,
    timeout: 10000,
    checkInterval: 60000,
    healthCheckFn: async () => {
      const startTime = Date.now();
      try {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('Missing OpenAI API key');
        }
        const serviceStatus = circuitBreaker.getServiceStatus('openai');
        const isHealthy = serviceStatus?.state !== 'OPEN';
        return {
          healthy: isHealthy,
          responseTime: Date.now() - startTime,
          metadata: {
            circuit_state: serviceStatus?.state,
            recent_failures: serviceStatus?.metrics.recentErrors.length,
            api_key_configured: !!process.env.OPENAI_API_KEY,
          },
        };
      } catch (error) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'OpenAI check failed',
        };
      }
    },
  };
}

/** Discord API health check */
export function createDiscordDependency(): DependencyConfig {
  return {
    name: 'discord',
    critical: true,
    timeout: 8000,
    checkInterval: 45000,
    healthCheckFn: async () => {
      const startTime = Date.now();
      try {
        if (!process.env.DISCORD_TOKEN) {
          throw new Error('Missing Discord bot token');
        }
        const serviceStatus = circuitBreaker.getServiceStatus('discord');
        const isHealthy = serviceStatus?.state !== 'OPEN';
        return {
          healthy: isHealthy,
          responseTime: Date.now() - startTime,
          metadata: {
            circuit_state: serviceStatus?.state,
            recent_failures: serviceStatus?.metrics.recentErrors.length,
            token_configured: !!process.env.DISCORD_TOKEN,
          },
        };
      } catch (error) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Discord check failed',
        };
      }
    },
  };
}

/** System resources health check */
export function createSystemResourcesDependency(): DependencyConfig {
  return {
    name: 'system_resources',
    critical: true,
    timeout: 1000,
    checkInterval: 15000,
    healthCheckFn: async () => {
      const startTime = Date.now();
      try {
        const memUsage = process.memoryUsage();
        const memUsageMB = memUsage.heapUsed / 1024 / 1024;
        const maxMemoryMB = 1024;
        const isHealthy = memUsageMB < maxMemoryMB;
        return {
          healthy: isHealthy,
          responseTime: Date.now() - startTime,
          metadata: {
            memory_usage_mb: Math.round(memUsageMB * 100) / 100,
            memory_limit_mb: maxMemoryMB,
            heap_total_mb: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
            external_mb: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
            uptime_seconds: Math.round(process.uptime()),
          },
          error: isHealthy
            ? undefined
            : `Memory usage ${memUsageMB}MB exceeds limit ${maxMemoryMB}MB`,
        };
      } catch (error) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'System resource check failed',
        };
      }
    },
  };
}

/** Get all core dependencies */
export function getCoreDependencies(): DependencyConfig[] {
  return [
    createSupabaseDependency(),
    createRedisDependency(),
    createOpenAIDependency(),
    createDiscordDependency(),
    createSystemResourcesDependency(),
  ];
}
