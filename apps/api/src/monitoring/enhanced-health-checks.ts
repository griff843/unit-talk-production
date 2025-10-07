import { redisCache } from '../cache/enhanced-cache';
import { circuitBreaker } from '../services/enhanced-circuit-breaker';
import { logger } from '../shared/logger';
import { requireSupabase } from '../utils/supabaseUtils';
// import { redis } from '../services/redis'; // Unused import

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
  critical: boolean;
  lastCheck: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_failures: number;
  };
  performance: {
    memory_usage_mb: number;
    cpu_usage_percent?: number;
    response_time_avg_ms: number;
  };
}

export interface DependencyConfig {
  name: string;
  critical: boolean;
  timeout: number;
  checkInterval: number;
  healthCheckFn: () => Promise<{
    healthy: boolean;
    responseTime?: number;
    error?: string;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Enhanced health check system with dependency validation,
 * circuit breaker integration, and comprehensive monitoring
 */
export class EnhancedHealthChecker {
  private dependencies: Map<string, DependencyConfig> = new Map();
  private lastResults: Map<string, HealthCheck> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private systemStartTime: number = Date.now();

  constructor() {
    this.registerCoreDependencies();
    this.startPeriodicChecks();
  }

  /**
   * Register core system dependencies
   */
  private registerCoreDependencies(): void {
    // Database dependencies
    this.registerDependency({
      name: 'supabase',
      critical: true,
      timeout: 5000,
      checkInterval: 30000, // 30 seconds
      healthCheckFn: async () => {
        const startTime = Date.now();
        
        try {
          // Check if we have env vars
          if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing Supabase configuration');
          }

          // Use circuit breaker for Supabase check
          const _result = await circuitBreaker.executeCall( // Circuit breaker test
            'supabase-health',
            async () => {
              const { createClient } = await import('@supabase/supabase-js');
              const supabase = createClient(
                process.env.SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
              
              // Simple connectivity test

      const { error } = await supabase
                .from('unified_picks')
                .select('count')
                .limit(1);
              
              if (error) {
                throw new Error(`Supabase query failed: ${error.message}`);
              }
              
              return { success: true };
            }
          );

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: { 
              url: process.env.SUPABASE_URL,
              circuit_state: circuitBreaker.getServiceStatus('supabase')?.state
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Redis cache dependency
    this.registerDependency({
      name: 'redis',
      critical: false, // Not critical - system can work without cache
      timeout: 3000,
      checkInterval: 20000, // 20 seconds
      healthCheckFn: async () => {
        const startTime = Date.now();
        
        try {
          const result = await redisCache.healthCheck();
          
          return {
            healthy: result,
            responseTime: Date.now() - startTime,
            error: result ? undefined : 'Redis health check failed',
            metadata: await redisCache.getStats()
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Redis check failed'
          };
        }
      }
    });

    // OpenAI API dependency
    this.registerDependency({
      name: 'openai',
      critical: false, // Can fallback to simpler advice
      timeout: 10000,
      checkInterval: 60000, // 1 minute
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
              api_key_configured: !!process.env.OPENAI_API_KEY
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'OpenAI check failed'
          };
        }
      }
    });

    // Discord API dependency
    this.registerDependency({
      name: 'discord',
      critical: true, // Critical for alerts
      timeout: 8000,
      checkInterval: 45000, // 45 seconds
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
              token_configured: !!process.env.DISCORD_TOKEN
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Discord check failed'
          };
        }
      }
    });

    // Memory and system resources
    this.registerDependency({
      name: 'system_resources',
      critical: true,
      timeout: 1000,
      checkInterval: 15000, // 15 seconds
      healthCheckFn: async () => {
        const startTime = Date.now();
        
        try {
          const memUsage = process.memoryUsage();
          const memUsageMB = memUsage.heapUsed / 1024 / 1024;
          const maxMemoryMB = 1024; // 1GB threshold
          
          const isHealthy = memUsageMB < maxMemoryMB;
          
          return {
            healthy: isHealthy,
            responseTime: Date.now() - startTime,
            metadata: {
              memory_usage_mb: Math.round(memUsageMB * 100) / 100,
              memory_limit_mb: maxMemoryMB,
              heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
              external_mb: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
              uptime_seconds: Math.round(process.uptime())
            },
            error: isHealthy ? undefined : `Memory usage ${memUsageMB}MB exceeds limit ${maxMemoryMB}MB`
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'System resource check failed'
          };
        }
      }
    });

    // Register advanced features health checks
    this.registerAdvancedFeaturesDependencies();

    logger.info('🏥 Enhanced health checker initialized with dependencies', {
      dependencies: Array.from(this.dependencies.keys()),
      critical: Array.from(this.dependencies.values()).filter(d => d.critical).map(d => d.name)
    });
  }

  /**
   * Register health checks for advanced features
   */
  private registerAdvancedFeaturesDependencies(): void {
    // Steam Detection Engine health check
    this.registerDependency({
      name: 'steam_detection_engine',
      critical: false, // Non-critical - system can work without steam detection
      timeout: 5000,
      checkInterval: 45000, // 45 seconds
      healthCheckFn: async () => {
        const startTime = Date.now();

        try {
          // Check if steam_moves table is accessible and recent data exists
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );


      const { data, error } = await supabase
            .from('steam_moves')
            .select('id, created_at')
            .order('created_at', { ascending: false })
            .limit(1);

          if (error) {
            throw new Error(`Steam moves table query failed: ${error.message}`);
          }

          const recentData = data && data.length > 0 &&
            new Date(data[0].created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000; // Within 24 hours

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: {
              table_accessible: true,
              recent_steam_moves: data?.length || 0,
              has_recent_data: recentData,
              latest_detection: data?.[0]?.created_at
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Steam detection engine check failed'
          };
        }
      }
    });

    // Line Shopping Engine health check
    this.registerDependency({
      name: 'line_shopping_engine',
      critical: false, // Non-critical - system can work without line shopping
      timeout: 8000,
      checkInterval: 60000, // 1 minute
      healthCheckFn: async () => {
        const startTime = Date.now();

        try {
          // Check if best_odds table is accessible and recent data exists
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );


      const { data, error } = await supabase
            .from('best_odds')
            .select('id, created_at, provider')
            .order('created_at', { ascending: false })
            .limit(5);

          if (error) {
            throw new Error(`Best odds table query failed: ${error.message}`);
          }

          const recentData = data && data.length > 0 &&
            new Date(data[0].created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000; // Within 2 hours

          const uniqueProviders = new Set(data?.map(d => d.provider) || []);

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: {
              table_accessible: true,
              recent_odds_comparisons: data?.length || 0,
              has_recent_data: recentData,
              unique_providers: uniqueProviders.size,
              providers: Array.from(uniqueProviders),
              latest_comparison: data?.[0]?.created_at
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Line shopping engine check failed'
          };
        }
      }
    });

    // Enhanced Injury Analysis health check
    this.registerDependency({
      name: 'injury_analysis_engine',
      critical: false, // Non-critical - system can work without injury analysis
      timeout: 5000,
      checkInterval: 30000, // 30 seconds
      healthCheckFn: async () => {
        const startTime = Date.now();

        try {
          // Check if injury_impacts table is accessible
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );


      const { data, error } = await supabase
            .from('injury_impacts')
            .select('id, created_at, impact_score, injury_type')
            .order('created_at', { ascending: false })
            .limit(3);

          if (error) {
            throw new Error(`Injury impacts table query failed: ${error.message}`);
          }

          const recentData = data && data.length > 0 &&
            new Date(data[0].created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000; // Within 7 days

          const avgImpactScore = data && data.length > 0 ?
            data.reduce((sum, d) => sum + (d.impact_score || 0), 0) / data.length : 0;

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: {
              table_accessible: true,
              recent_injury_analyses: data?.length || 0,
              has_recent_data: recentData,
              average_impact_score: Math.round(avgImpactScore * 100) / 100,
              latest_analysis: data?.[0]?.created_at
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Injury analysis engine check failed'
          };
        }
      }
    });

    // API Quota Coordinator health check
    this.registerDependency({
      name: 'api_quota_coordinator',
      critical: true, // Critical - prevents API quota exhaustion
      timeout: 5000,
      checkInterval: 30000, // 30 seconds
      healthCheckFn: async () => {
        const startTime = Date.now();

        try {
          // Check if API quota management tables are accessible
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Check quota configs table (tolerant to missing enabled column)
          let configs: any[] = [];
          let configError: any = null;

          try {
            // Try with enabled column first
            const result = await supabase
              .from('api_quota_configs')
              .select('provider, enabled, daily_limit, used_today')
              .eq('enabled', true);

            configs = result.data || [];
            configError = result.error;
          } catch (enabledError) {
            // Fallback: query without enabled filter (feature-flag style graceful degradation)
            console.warn('api_quota_configs.enabled column missing, using fallback query');

            const result = await supabase
              .from('api_quota_configs')
              .select('provider, daily_limit, used_today');

            configs = result.data || [];
            configError = result.error;
          }

          if (configError) {
            throw new Error(`API quota configs query failed: ${configError.message}`);
          }

          // Check recent usage (optional table)
          let usage: any[] = [];
          let usageError: any = null;

          try {
            const result = await supabase
              .from('api_quota_usage')
              .select('provider, timestamp')
              .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .order('timestamp', { ascending: false })
              .limit(10);

            usage = result.data || [];
            usageError = result.error;
          } catch (tableError) {
            // api_quota_usage table might not exist - this is non-critical
            console.warn('api_quota_usage table not found, skipping usage check');
            usage = [];
            usageError = null;
          }

          // Don't fail if usage table doesn't exist - it's optional for health check
          if (usageError && !usageError.message.includes('does not exist')) {
            throw new Error(`API quota usage query failed: ${usageError.message}`);
          }

          const enabledProviders = configs?.length || 0;
          const recentUsage = usage?.length || 0;
          const uniqueProvidersUsed = new Set(usage?.map(u => u.provider) || []).size;

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: {
              quota_system_accessible: true,
              enabled_providers: enabledProviders,
              recent_api_calls_24h: recentUsage,
              unique_providers_used: uniqueProvidersUsed,
              providers: configs?.map(c => c.provider) || []
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'API quota coordinator check failed'
          };
        }
      }
    });

    // Settlement Automation health check
    this.registerDependency({
      name: 'settlement_automation',
      critical: false, // Non-critical - can fallback to manual settlement
      timeout: 10000,
      checkInterval: 120000, // 2 minutes
      healthCheckFn: async () => {
        const startTime = Date.now();

        try {
          // Check Temporal workflow status and settlement activity
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Check recent settlement activity

      const { data: settlements, error: settlementsError } = await supabase
            .from('unified_picks')
            .select('id, created_at, result, settlement_status, settlement_method')
            .not('result', 'is', null)
            .not('settlement_status', 'is', null)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(20);

          if (settlementsError) {
            throw new Error(`Settlements query failed: ${settlementsError.message}`);
          }

          const totalSettlements = settlements?.length || 0;
          const autoSettlements = settlements?.filter(s => s.settlement_method === 'auto').length || 0;
          const autoSettlementRate = totalSettlements > 0 ? (autoSettlements / totalSettlements) * 100 : 0;
          const recentActivity = settlements && settlements.length > 0 &&
            new Date(settlements[0].created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: {
              settlement_system_accessible: true,
              total_settlements_7d: totalSettlements,
              auto_settlements_7d: autoSettlements,
              auto_settlement_rate_pct: Math.round(autoSettlementRate * 100) / 100,
              has_recent_activity: recentActivity,
              latest_settlement: settlements?.[0]?.created_at
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Settlement automation check failed'
          };
        }
      }
    });

    // Arbitrage Detection health check
    this.registerDependency({
      name: 'arbitrage_detection',
      critical: false, // Non-critical - bonus feature
      timeout: 5000,
      checkInterval: 60000, // 1 minute
      healthCheckFn: async () => {
        const startTime = Date.now();

        try {
          // Check if arbitrage_opportunities table is accessible
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );


      const { data, error } = await supabase
            .from('arbitrage_opportunities')
            .select('id, created_at, profit_margin, status')
            .order('created_at', { ascending: false })
            .limit(5);

          if (error) {
            throw new Error(`Arbitrage opportunities table query failed: ${error.message}`);
          }

          const recentOpportunities = data && data.length > 0 &&
            new Date(data[0].created_at).getTime() > Date.now() - 6 * 60 * 60 * 1000; // Within 6 hours

          const avgProfitMargin = data && data.length > 0 ?
            data.reduce((sum, d) => sum + (d.profit_margin || 0), 0) / data.length : 0;

          const activeOpportunities = data?.filter(d => d.status === 'active').length || 0;

          return {
            healthy: true,
            responseTime: Date.now() - startTime,
            metadata: {
              table_accessible: true,
              recent_opportunities: data?.length || 0,
              has_recent_opportunities: recentOpportunities,
              active_opportunities: activeOpportunities,
              average_profit_margin_pct: Math.round(avgProfitMargin * 100) / 100,
              latest_opportunity: data?.[0]?.created_at
            }
          };
        } catch (error) {
          return {
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Arbitrage detection check failed'
          };
        }
      }
    });

    logger.info('🚀 Advanced features health checks registered', {
      newFeatures: ['steam_detection_engine', 'line_shopping_engine', 'injury_analysis_engine',
                   'api_quota_coordinator', 'settlement_automation', 'arbitrage_detection']
    });
  }

  /**
   * Register a new dependency for health checking
   */
  public registerDependency(config: DependencyConfig): void {
    this.dependencies.set(config.name, config);
    
    // Start periodic checking for this dependency
    if (this.checkIntervals.has(config.name)) {
      clearInterval(this.checkIntervals.get(config.name)!);
    }
    
    const interval = setInterval(async () => {
      await this.checkDependency(config.name);
    }, config.checkInterval);
    
    this.checkIntervals.set(config.name, interval);
    
    logger.info('📋 Dependency registered for health checking', {
      name: config.name,
      critical: config.critical,
      checkInterval: config.checkInterval
    });
  }

  /**
   * Check health of a specific dependency
   */
  public async checkDependency(name: string): Promise<HealthCheck | null> {
    const config = this.dependencies.get(name);
    if (!config) {
      return null;
    }

    try {
      const result = await Promise.race([
        config.healthCheckFn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), config.timeout)
        )
      ]);

      const healthCheck: HealthCheck = {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        responseTime: result.responseTime,
        error: result.error,
        metadata: result.metadata,
        critical: config.critical,
        lastCheck: new Date().toISOString()
      };

      this.lastResults.set(name, healthCheck);
      
      // Log unhealthy critical dependencies
      if (!result.healthy && config.critical) {
        logger.error('🚨 Critical dependency unhealthy', {
          dependency: name,
          error: result.error,
          responseTime: result.responseTime
        });
      }

      return healthCheck;
    } catch (error) {
      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        critical: config.critical,
        lastCheck: new Date().toISOString()
      };

      this.lastResults.set(name, healthCheck);
      
      if (config.critical) {
        logger.error('🚨 Critical dependency check failed', {
          dependency: name,
          error: healthCheck.error
        });
      }

      return healthCheck;
    }
  }

  /**
   * Get comprehensive system health status
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    // Check all dependencies in parallel
    const checkPromises = Array.from(this.dependencies.keys()).map(
      name => this.checkDependency(name)
    );
    
    const results = await Promise.all(checkPromises);
    const checks = results.filter((check): check is HealthCheck => check !== null);

    // Calculate summary statistics
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      critical_failures: checks.filter(c => c.status === 'unhealthy' && c.critical).length
    };

    // Determine overall system status
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.critical_failures > 0) {
      systemStatus = 'unhealthy';
    } else if (summary.unhealthy > 0 || summary.degraded > 0) {
      systemStatus = 'degraded';
    } else {
      systemStatus = 'healthy';
    }

    // Calculate performance metrics
    const memUsage = process.memoryUsage();
    const avgResponseTime = checks
      .filter(c => c.responseTime !== undefined)
      .reduce((sum, c) => sum + (c.responseTime || 0), 0) / 
      Math.max(1, checks.filter(c => c.responseTime !== undefined).length);

    const health: SystemHealth = {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - this.systemStartTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
      performance: {
        memory_usage_mb: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        response_time_avg_ms: Math.round(avgResponseTime * 100) / 100
      }
    };

    return health;
  }

  /**
   * Get health status for a specific dependency
   */
  public getDependencyHealth(name: string): HealthCheck | null {
    return this.lastResults.get(name) || null;
  }

  /**
   * Start periodic health checks for all dependencies
   */
  private startPeriodicChecks(): void {
    // Initial check for all dependencies
    setTimeout(async () => {
      for (const name of Array.from(this.dependencies.keys())) {
        await this.checkDependency(name);
      }
    }, 1000); // Wait 1 second after initialization

    logger.info('🔄 Periodic health checks started');
  }

  /**
   * Stop all periodic health checks
   */
  public stopPeriodicChecks(): void {
    for (const interval of Array.from(this.checkIntervals.values())) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    
    logger.info('⏹️ Periodic health checks stopped');
  }

  /**
   * Get health check summary for logging/monitoring
   */
  public getHealthSummary(): {
    status: string;
    healthy_dependencies: string[];
    unhealthy_dependencies: string[];
    critical_issues: string[];
  } {
    const checks = Array.from(this.lastResults.values());
    
    return {
      status: checks.every(c => c.status === 'healthy') ? 'healthy' : 
              checks.some(c => c.status === 'unhealthy' && c.critical) ? 'unhealthy' : 'degraded',
      healthy_dependencies: checks.filter(c => c.status === 'healthy').map(c => c.name),
      unhealthy_dependencies: checks.filter(c => c.status === 'unhealthy').map(c => c.name),
      critical_issues: checks
        .filter(c => c.status === 'unhealthy' && c.critical)
        .map(c => `${c.name}: ${c.error}`)
    };
  }

  /**
   * Reset health status for a specific dependency
   */
  public resetDependency(name: string): void {
    this.lastResults.delete(name);
    logger.info('🔄 Dependency health status reset', { dependency: name });
  }

  /**
   * Get health status specifically for advanced features
   */
  public async getAdvancedFeaturesHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    features: {
      steam_detection: HealthCheck | null;
      line_shopping: HealthCheck | null;
      injury_analysis: HealthCheck | null;
      api_quota_coordinator: HealthCheck | null;
      settlement_automation: HealthCheck | null;
      arbitrage_detection: HealthCheck | null;
    };
    summary: {
      total_features: number;
      healthy_features: number;
      critical_failures: number;
    };
  }> {
    const advancedFeatureNames = [
      'steam_detection_engine',
      'line_shopping_engine',
      'injury_analysis_engine',
      'api_quota_coordinator',
      'settlement_automation',
      'arbitrage_detection'
    ];

    // Check all advanced features in parallel
    const checkPromises = advancedFeatureNames.map(name => this.checkDependency(name));
    const results = await Promise.all(checkPromises);
    const checks = results.filter((check): check is HealthCheck => check !== null);

    // Map results to feature-specific names
    const features = {
      steam_detection: checks.find(c => c.name === 'steam_detection_engine') || null,
      line_shopping: checks.find(c => c.name === 'line_shopping_engine') || null,
      injury_analysis: checks.find(c => c.name === 'injury_analysis_engine') || null,
      api_quota_coordinator: checks.find(c => c.name === 'api_quota_coordinator') || null,
      settlement_automation: checks.find(c => c.name === 'settlement_automation') || null,
      arbitrage_detection: checks.find(c => c.name === 'arbitrage_detection') || null
    };

    // Calculate summary
    const totalFeatures = checks.length;
    const healthyFeatures = checks.filter(c => c.status === 'healthy').length;
    const criticalFailures = checks.filter(c => c.status === 'unhealthy' && c.critical).length;

    // Determine overall advanced features status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (criticalFailures > 0) {
      status = 'unhealthy';
    } else if (healthyFeatures < totalFeatures) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      features,
      summary: {
        total_features: totalFeatures,
        healthy_features: healthyFeatures,
        critical_failures: criticalFailures
      }
    };
  }

  /**
   * Update dependency configuration
   */
  public updateDependencyConfig(name: string, updates: Partial<DependencyConfig>): void {
    const current = this.dependencies.get(name);
    if (!current) {
      throw new Error(`Dependency ${name} not found`);
    }

    const updated = { ...current, ...updates };
    this.dependencies.set(name, updated);
    
    // Restart periodic checking with new interval if changed
    if (updates.checkInterval && updates.checkInterval !== current.checkInterval) {
      if (this.checkIntervals.has(name)) {
        clearInterval(this.checkIntervals.get(name)!);
      }
      
      const interval = setInterval(async () => {
        await this.checkDependency(name);
      }, updated.checkInterval);
      
      this.checkIntervals.set(name, interval);
    }
    
    logger.info('⚙️ Dependency configuration updated', { 
      dependency: name, 
      updates: Object.keys(updates) 
    });
  }
}

// Global health checker instance
export const healthChecker = new EnhancedHealthChecker();

// Health check middleware for Express routes
export const healthCheckMiddleware = async (req: any, res: any, next: any) => {
  try {
    const health = await healthChecker.getSystemHealth();
    
    // Add health info to request for logging
    req.systemHealth = health;
    
    // Set appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode);
    next();
  } catch (error) {
    logger.error('Health check middleware error', error);
    res.status(503);
    next();
  }
};

// Health check route handler
export const handleHealthCheck = async (_req: any, res: any) => { // Request unused
  try {
    const health = await healthChecker.getSystemHealth();
    
    // Set cache headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check handler error', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check system failure',
      timestamp: new Date().toISOString()
    });
  }
};