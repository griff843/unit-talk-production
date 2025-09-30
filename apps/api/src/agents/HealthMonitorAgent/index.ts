import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';
import { requireSupabase } from '../../utils/supabaseUtils';

export interface HealthMonitorMetrics extends BaseMetrics {
  totalHealthChecks: number;
  healthyChecks: number;
  degradedChecks: number;
  unhealthyChecks: number;
  circuitBreakerTrips: number;
  alertsSent: number;
  averageResponseTimeMs: number;
  lastHealthCheck: string;
  monitoredServices: number;
  criticalFailures: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: string | null;
  nextAttemptTime: string | null;
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTimeMs: number;
  consecutiveFailures: number;
  circuitBreaker: CircuitBreakerState;
  metadata?: any;
}

/**
 * Health Monitor Agent
 *
 * Responsibilities:
 * - Track pipeline health across all agents
 * - Implement circuit breaker patterns for resilience
 * - Send alerts for critical failures
 * - Manage retry and recovery strategies
 * - Collect and aggregate health metrics
 */
export class HealthMonitorAgent extends BaseAgent {
  protected metrics: HealthMonitorMetrics;
  private serviceHealthMap: Map<string, ServiceHealth> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL_MS: number;
  private readonly CIRCUIT_BREAKER_THRESHOLD: number;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS: number;
  private readonly CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: number;
  private readonly ALERT_THRESHOLD: number;

  // Timers
  private healthCheckTimer?: NodeJS.Timeout;
  private alertTimer?: NodeJS.Timeout;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.HEALTH_CHECK_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000'); // 30 seconds
    this.CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5');
    this.CIRCUIT_BREAKER_TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '60000'); // 1 minute
    this.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS || '300000'); // 5 minutes
    this.ALERT_THRESHOLD = parseInt(process.env.HEALTH_ALERT_THRESHOLD || '3');

    this.metrics = {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      totalHealthChecks: 0,
      healthyChecks: 0,
      degradedChecks: 0,
      unhealthyChecks: 0,
      circuitBreakerTrips: 0,
      alertsSent: 0,
      averageResponseTimeMs: 0,
      lastHealthCheck: new Date().toISOString(),
      monitoredServices: 0,
      criticalFailures: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('🏥 Initializing Health Monitor Agent', {
      healthCheckIntervalMs: this.HEALTH_CHECK_INTERVAL_MS,
      circuitBreakerThreshold: this.CIRCUIT_BREAKER_THRESHOLD,
      circuitBreakerTimeoutMs: this.CIRCUIT_BREAKER_TIMEOUT_MS
    });

    // Verify database access for health tracking
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available - health data will be memory-only');
    } else {
      try {
        const { error } = await this.requireSupabase()
          .from('agent_health')
          .select('count')
          .limit(1);

        if (error) {
          this.logger.warn(`⚠️ agent_health table access issue: ${error.message}`);
        } else {
          this.logger.info('✅ agent_health table accessible');
        }
      } catch (err) {
        this.logger.error('❌ Failed to access agent_health table', {
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Initialize core services to monitor
    await this.initializeServiceMonitoring();

    // Start health check timer
    this.startHealthChecking();

    this.logger.info('✅ Health Monitor Agent initialized successfully');
  }

  async process(): Promise<void> {
    // Perform comprehensive health checks
    await this.performHealthChecks();

    // Update circuit breaker states
    await this.updateCircuitBreakers();

    // Check for critical failures and send alerts
    await this.checkForCriticalFailures();
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Health Monitor Agent');

    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
    }

    // Save final health state
    await this.saveHealthState();

    this.logger.info('✅ Health Monitor Agent cleanup completed');
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<{ service: string; status: string; error?: string; details?: any }> = [];

    // Self-health check
    checks.push({
      service: 'healthMonitor',
      status: 'healthy',
      details: {
        monitoredServices: this.serviceHealthMap.size,
        totalHealthChecks: this.metrics.totalHealthChecks,
        circuitBreakers: this.circuitBreakers.size
      }
    });

    // Aggregate service health
    const serviceStatuses = Array.from(this.serviceHealthMap.values());
    const healthyServices = serviceStatuses.filter(s => s.status === 'healthy').length;
    const degradedServices = serviceStatuses.filter(s => s.status === 'degraded').length;
    const unhealthyServices = serviceStatuses.filter(s => s.status === 'unhealthy').length;

    checks.push({
      service: 'aggregateHealth',
      status: unhealthyServices === 0 ? (degradedServices === 0 ? 'healthy' : 'degraded') : 'unhealthy',
      details: {
        healthy: healthyServices,
        degraded: degradedServices,
        unhealthy: unhealthyServices,
        total: serviceStatuses.length
      }
    });

    // Circuit breaker status
    const openCircuitBreakers = Array.from(this.circuitBreakers.values()).filter(cb => cb.isOpen).length;
    checks.push({
      service: 'circuitBreakers',
      status: openCircuitBreakers === 0 ? 'healthy' : 'degraded',
      details: {
        openBreakers: openCircuitBreakers,
        totalBreakers: this.circuitBreakers.size
      }
    });

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.metrics }
    };
  }

  /**
   * Collect metrics for this agent
   */
  protected async collectMetrics(): Promise<HealthMonitorMetrics> {
    return {
      ...this.metrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Record health for BaseAgent compatibility
   */
  async recordHealth(healthResult: HealthCheckResult): Promise<void> {
    await this.recordServiceHealth(this.config.name, healthResult);
  }

  /**
   * Record health status for a service
   */
  async recordServiceHealth(serviceName: string, healthResult: HealthCheckResult): Promise<void> {
    const startTime = Date.now();

    try {
      const responseTime = Date.now() - startTime;
      const currentTime = new Date().toISOString();

      // Get or create service health record
      let serviceHealth = this.serviceHealthMap.get(serviceName);
      if (!serviceHealth) {
        serviceHealth = {
          serviceName,
          status: 'healthy',
          lastCheck: currentTime,
          responseTimeMs: 0,
          consecutiveFailures: 0,
          circuitBreaker: {
            isOpen: false,
            failureCount: 0,
            lastFailureTime: null,
            nextAttemptTime: null
          }
        };
        this.serviceHealthMap.set(serviceName, serviceHealth);
        this.metrics.monitoredServices++;
      }

      // Update service health
      serviceHealth.status = healthResult.status;
      serviceHealth.lastCheck = currentTime;
      serviceHealth.responseTimeMs = responseTime;
      serviceHealth.metadata = healthResult.details;

      // Update failure tracking
      if (healthResult.status === 'unhealthy') {
        serviceHealth.consecutiveFailures++;
        this.metrics.unhealthyChecks++;

        // Check circuit breaker
        await this.evaluateCircuitBreaker(serviceName, serviceHealth);
      } else {
        serviceHealth.consecutiveFailures = 0;
        if (healthResult.status === 'healthy') {
          this.metrics.healthyChecks++;
        } else {
          this.metrics.degradedChecks++;
        }

        // Close circuit breaker if it was open
        await this.closeCircuitBreaker(serviceName);
      }

      // Update metrics
      this.metrics.totalHealthChecks++;
      this.metrics.lastHealthCheck = currentTime;
      this.updateAverageResponseTime(responseTime);

      // Persist to database if available
      await this.persistHealthRecord(serviceName, serviceHealth, healthResult);

      this.logger.debug(`🏥 Health recorded for ${serviceName}`, {
        status: healthResult.status,
        responseTimeMs: responseTime,
        consecutiveFailures: serviceHealth.consecutiveFailures
      });

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error(`❌ Failed to record health for ${serviceName}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get health status for a specific service
   */
  getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.serviceHealthMap.get(serviceName) || null;
  }

  /**
   * Get all monitored services health
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealthMap.values());
  }

  /**
   * Check if a service's circuit breaker is open
   */
  isCircuitBreakerOpen(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    return circuitBreaker?.isOpen || false;
  }

  // Private implementation methods

  private async initializeServiceMonitoring(): Promise<void> {
    // Initialize monitoring for core pipeline services
    const coreServices = [
      'pipeline-orchestrator',
      'scoring-coordinator',
      'promotion-agent',
      'database',
      'enhanced45factor'
    ];

    for (const service of coreServices) {
      this.serviceHealthMap.set(service, {
        serviceName: service,
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTimeMs: 0,
        consecutiveFailures: 0,
        circuitBreaker: {
          isOpen: false,
          failureCount: 0,
          lastFailureTime: null,
          nextAttemptTime: null
        }
      });

      this.circuitBreakers.set(service, {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      });
    }

    this.metrics.monitoredServices = coreServices.length;
    this.logger.info(`📊 Initialized monitoring for ${coreServices.length} core services`);
  }

  private async performHealthChecks(): Promise<void> {
    this.logger.debug('🔍 Performing health checks on all monitored services');

    const healthCheckPromises = Array.from(this.serviceHealthMap.keys()).map(async (serviceName) => {
      try {
        // Skip if circuit breaker is open
        if (this.isCircuitBreakerOpen(serviceName)) {
          this.logger.debug(`⚡ Skipping health check for ${serviceName} - circuit breaker open`);
          return;
        }

        // Perform service-specific health check
        const healthResult = await this.performServiceHealthCheck(serviceName);
        await this.recordServiceHealth(serviceName, healthResult);
      } catch (error) {
        this.logger.error(`❌ Health check failed for ${serviceName}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Record the failure
        await this.recordServiceHealth(serviceName, {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  private async performServiceHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    // Service-specific health check logic
    switch (serviceName) {
      case 'database':
        return await this.checkDatabaseHealth();
      case 'enhanced45factor':
        return await this.checkEnhanced45FactorHealth();
      default:
        // Generic health check
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          details: { serviceName }
        };
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    if (!this.hasSupabase()) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { error: 'Supabase client not available' }
      };
    }

    try {
      const startTime = Date.now();

      // Test basic connectivity
      const { count, error } = await this.requireSupabase()
        .from('sports_game_odds')
        .select('count')
        .single();

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: { error: error.message, responseTimeMs: responseTime }
        };
      }

      // Check response time thresholds
      const status = responseTime > 5000 ? 'degraded' : 'healthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          responseTimeMs: responseTime,
          rawPropsCount: count,
          connectionHealthy: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async checkEnhanced45FactorHealth(): Promise<HealthCheckResult> {
    try {
      // Check if Enhanced45Factor is enabled and functioning
      const enhanced45Enabled = process.env.USE_ENHANCED_45_FACTOR === 'true';

      if (!enhanced45Enabled) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          details: { message: 'Enhanced45Factor system disabled' }
        };
      }

      // Additional checks would go here for Enhanced45Factor system
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: { enhanced45FactorEnabled: true }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async evaluateCircuitBreaker(serviceName: string, serviceHealth: ServiceHealth): Promise<void> {
    let circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) {
      circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      };
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date().toISOString();

    if (circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD && !circuitBreaker.isOpen) {
      // Open circuit breaker
      circuitBreaker.isOpen = true;
      const nextAttempt = new Date(Date.now() + this.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS);
      circuitBreaker.nextAttemptTime = nextAttempt.toISOString();

      this.metrics.circuitBreakerTrips++;

      this.logger.warn(`⚡ Circuit breaker opened for ${serviceName}`, {
        failureCount: circuitBreaker.failureCount,
        nextAttemptTime: circuitBreaker.nextAttemptTime
      });

      // Send alert
      await this.sendAlert('circuit_breaker_opened', {
        serviceName,
        failureCount: circuitBreaker.failureCount,
        nextAttemptTime: circuitBreaker.nextAttemptTime
      });
    }

    // Update service health with circuit breaker state
    serviceHealth.circuitBreaker = { ...circuitBreaker };
  }

  private async closeCircuitBreaker(serviceName: string): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker && circuitBreaker.isOpen) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      circuitBreaker.lastFailureTime = null;
      circuitBreaker.nextAttemptTime = null;

      this.logger.info(`⚡ Circuit breaker closed for ${serviceName} - service recovered`);

      // Send recovery alert
      await this.sendAlert('circuit_breaker_closed', { serviceName });
    }
  }

  private async updateCircuitBreakers(): Promise<void> {
    const now = Date.now();

    for (const [serviceName, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.isOpen && circuitBreaker.nextAttemptTime) {
        const nextAttemptTime = new Date(circuitBreaker.nextAttemptTime).getTime();
        if (now >= nextAttemptTime) {
          this.logger.info(`⚡ Circuit breaker recovery window opened for ${serviceName}`);
          // The circuit breaker will be tested on the next health check
        }
      }
    }
  }

  private async checkForCriticalFailures(): Promise<void> {
    const criticalServices = ['database', 'pipeline-orchestrator'];
    let criticalFailureDetected = false;

    for (const serviceName of criticalServices) {
      const serviceHealth = this.serviceHealthMap.get(serviceName);
      if (serviceHealth && serviceHealth.status === 'unhealthy' && serviceHealth.consecutiveFailures >= this.ALERT_THRESHOLD) {
        criticalFailureDetected = true;
        this.metrics.criticalFailures++;

        await this.sendAlert('critical_failure', {
          serviceName,
          consecutiveFailures: serviceHealth.consecutiveFailures,
          lastCheck: serviceHealth.lastCheck
        });
      }
    }

    if (criticalFailureDetected) {
      this.logger.error('🚨 Critical pipeline failures detected');
    }
  }

  private async sendAlert(alertType: string, data: any): Promise<void> {
    try {
      this.metrics.alertsSent++;

      this.logger.warn(`🚨 Alert: ${alertType}`, data);

      // In a production system, this would integrate with:
      // - Slack/Discord notifications
      // - PagerDuty
      // - Email alerts
      // - Webhook notifications

      // For now, we log the alert
      console.warn(`[ALERT] ${alertType}:`, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('❌ Failed to send alert', {
        alertType,
        data,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.totalHealthChecks === 1) {
      this.metrics.averageResponseTimeMs = responseTime;
    } else {
      this.metrics.averageResponseTimeMs = 
        (this.metrics.averageResponseTimeMs * (this.metrics.totalHealthChecks - 1) + responseTime) / this.metrics.totalHealthChecks;
    }
  }

  private async persistHealthRecord(serviceName: string, serviceHealth: ServiceHealth, healthResult: HealthCheckResult): Promise<void> {
    if (!this.hasSupabase()) {
      return;
    }

    try {
      const { error } = await this.requireSupabase()
        .from('agent_health')
        .insert({
          agent_name: serviceName,
          status: healthResult.status,
          last_heartbeat: healthResult.timestamp,
          metadata: {
            responseTimeMs: serviceHealth.responseTimeMs,
            consecutiveFailures: serviceHealth.consecutiveFailures,
            circuitBreakerOpen: serviceHealth.circuitBreaker.isOpen,
            details: healthResult.details
          },
          created_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('❌ Failed to persist health record', {
          serviceName,
          error: error.message
        });
      }
    } catch (error) {
      this.logger.error('❌ Error persisting health record', {
        serviceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.process();
      } catch (error) {
        this.logger.error('❌ Health check cycle error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);

    this.logger.info(`🏥 Health checking started - interval: ${this.HEALTH_CHECK_INTERVAL_MS}ms`);
  }

  private async saveHealthState(): Promise<void> {
    this.logger.info('💾 Saving health monitor state', {
      monitoredServices: this.serviceHealthMap.size,
      circuitBreakers: this.circuitBreakers.size,
      totalHealthChecks: this.metrics.totalHealthChecks
    });

    // In a production system, you might persist the state to Redis or database
  }

  // Public interface methods

  public getHealthMetrics(): HealthMonitorMetrics {
    return { ...this.metrics };
  }

  public getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.circuitBreakers);
  }

  public async forceCircuitBreakerOpen(serviceName: string): Promise<void> {
    this.logger.warn(`⚡ Manually opening circuit breaker for ${serviceName}`);

    const circuitBreaker = this.circuitBreakers.get(serviceName) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    };

    circuitBreaker.isOpen = true;
    circuitBreaker.failureCount = this.CIRCUIT_BREAKER_THRESHOLD;
    circuitBreaker.lastFailureTime = new Date().toISOString();
    const nextAttempt = new Date(Date.now() + this.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS);
    circuitBreaker.nextAttemptTime = nextAttempt.toISOString();

    this.circuitBreakers.set(serviceName, circuitBreaker);
    this.metrics.circuitBreakerTrips++;
  }

  public async forceCircuitBreakerClose(serviceName: string): Promise<void> {
    this.logger.info(`⚡ Manually closing circuit breaker for ${serviceName}`);
    await this.closeCircuitBreaker(serviceName);
  }
}