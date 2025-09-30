/**
 * Command Center Production Deployment - Phase 8
 *
 * Live operational control center for Unit Talk syndicate-level ML betting system
 * Features:
 * - Real-time scoring pipeline monitoring
 * - Agent orchestration control
 * - Performance metrics dashboards
 * - Alert management and incident response
 * - System controls (emergency stop, rollback, scaling)
 */

// import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - ioredis types might not be installed
import Redis from 'ioredis';

interface CommandCenterConfig {
  monitoring: {
    refreshInterval: number;
    alertThresholds: {
      latencyMs: number;
      throughputPerHour: number;
      errorRate: number;
      memoryUsage: number;
    };
  };

  agentControl: {
    enabledControls: string[];
    emergencyStopEnabled: boolean;
    scalingEnabled: boolean;
  };

  performance: {
    metricsRetention: number;
    realTimeUpdates: boolean;
    dashboardRefreshRate: number;
  };

  operations: {
    incidentManagement: boolean;
    maintenanceMode: boolean;
    systemControls: boolean;
  };
}

interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'maintenance';
  components: {
    scoringPipeline: ComponentStatus;
    agentOrchestration: ComponentStatus;
    database: ComponentStatus;
    cache: ComponentStatus;
    externalAPIs: ComponentStatus;
    monitoring: ComponentStatus;
  };
  metrics: {
    totalThroughput: number;
    averageLatency: number;
    errorRate: number;
    systemLoad: number;
  };
  lastUpdated: string;
}

interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  uptime: number;
  errorCount: number;
  lastError?: string;
  metrics?: Record<string, number>;
}

interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  recent: Alert[];
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  component: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

interface AgentStatus {
  id: string;
  type: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
  processedCount: number;
  errorCount: number;
  averageProcessingTime: number;
  lastActivity: string;
  memoryUsage: number;
  controls: {
    canStart: boolean;
    canStop: boolean;
    canRestart: boolean;
    canScale: boolean;
  };
}

export class CommandCenterProduction {
  private config: CommandCenterConfig;
  private supabase: any;
  private redis!: Redis; // Initialized in initializeConnections

  constructor(config: CommandCenterConfig) {
    this.config = config;
    this.initializeConnections();
  }

  /**
   * Initialize database and cache connections
   */
  private initializeConnections(): void {
    // Initialize Supabase connection
    this.supabase = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!
    );

    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] || 'redis-primary',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      lazyConnect: true,
      enableReadyCheck: false
    });
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      // Collect status from all components
      const [
        scoringStatus,
        agentStatus,
        databaseStatus,
        cacheStatus,
        externalAPIStatus,
        monitoringStatus
      ] = await Promise.allSettled([
        this.getScoringPipelineStatus(),
        this.getAgentOrchestrationStatus(),
        this.getDatabaseStatus(),
        this.getCacheStatus(),
        this.getExternalAPIStatus(),
        this.getMonitoringStatus()
      ]);

      // Aggregate system metrics
      const systemMetrics = await this.getSystemMetrics();

      // Determine overall system status
      const overallStatus = this.calculateOverallStatus([
        this.getSettledValue(scoringStatus),
        this.getSettledValue(agentStatus),
        this.getSettledValue(databaseStatus),
        this.getSettledValue(cacheStatus),
        this.getSettledValue(externalAPIStatus),
        this.getSettledValue(monitoringStatus)
      ]);

      return {
        overall: overallStatus,
        components: {
          scoringPipeline: this.getSettledValue(scoringStatus) || { status: 'unknown', uptime: 0, errorCount: 0 },
          agentOrchestration: this.getSettledValue(agentStatus) || { status: 'unknown', uptime: 0, errorCount: 0 },
          database: this.getSettledValue(databaseStatus) || { status: 'unknown', uptime: 0, errorCount: 0 },
          cache: this.getSettledValue(cacheStatus) || { status: 'unknown', uptime: 0, errorCount: 0 },
          externalAPIs: this.getSettledValue(externalAPIStatus) || { status: 'unknown', uptime: 0, errorCount: 0 },
          monitoring: this.getSettledValue(monitoringStatus) || { status: 'unknown', uptime: 0, errorCount: 0 }
        },
        metrics: systemMetrics,
        lastUpdated: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('Failed to get system status:', error);
      throw new Error('Unable to retrieve system status');
    }
  }

  /**
   * Get scoring pipeline status
   */
  private async getScoringPipelineStatus(): Promise<ComponentStatus> {
    try {
      // Check scoring pipeline health with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const pipelineHealth = await fetch('http://api:3000/api/scoring/health', {
        signal: controller.signal
      }).then(res => res.json()).finally(() => clearTimeout(timeoutId));

      // Get scoring metrics from Redis
      const metrics = await this.redis.hgetall('scoring:metrics');

      return {
        status: pipelineHealth.status === 'healthy' ? 'healthy' : 'degraded',
        uptime: pipelineHealth.uptime || 0,
        errorCount: parseInt(metrics['errorCount'] || '0'),
        metrics: {
          latencyMs: parseFloat(metrics['averageLatencyMs'] || '0'),
          throughputPerHour: parseInt(metrics['throughputPerHour'] || '0'),
          cacheHitRate: parseFloat(metrics['cacheHitRate'] || '0'),
          enhanced45FactorEnabled: parseInt(metrics['enhanced45FactorEnabled'] || '0')
        }
      };

    } catch (error: any) {
      return {
        status: 'critical',
        uptime: 0,
        errorCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get agent orchestration status
   */
  private async getAgentOrchestrationStatus(): Promise<ComponentStatus> {
    try {
      // Check agent orchestration health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const orchestrationHealth = await fetch('http://api:3000/api/agents/health', {
        signal: controller.signal
      }).then(res => res.json()).finally(() => clearTimeout(timeoutId));

      return {
        status: orchestrationHealth.overall === 'healthy' ? 'healthy' : 'degraded',
        uptime: orchestrationHealth.uptime || 0,
        errorCount: orchestrationHealth.totalErrors || 0,
        metrics: {
          totalAgents: orchestrationHealth.totalAgents || 0,
          healthyAgents: orchestrationHealth.healthyAgents || 0,
          totalThroughput: orchestrationHealth.totalThroughput || 0,
          systemLoad: orchestrationHealth.systemLoad || 0
        }
      };

    } catch (error: any) {
      return {
        status: 'critical',
        uptime: 0,
        errorCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get database status
   */
  private async getDatabaseStatus(): Promise<ComponentStatus> {
    try {
      // Test database connection
      const { error } = await this.supabase
        .from('raw_props')
        .select('count(*)')
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      // Get database metrics from monitoring
      const dbMetrics = await this.redis.hgetall('db:metrics');

      return {
        status: 'healthy',
        uptime: parseFloat(dbMetrics['uptime'] || '0'),
        errorCount: parseInt(dbMetrics['errorCount'] || '0'),
        metrics: {
          activeConnections: parseInt(dbMetrics['activeConnections'] || '0'),
          queryLatencyMs: parseFloat(dbMetrics['queryLatencyMs'] || '0'),
          cacheHitRate: parseFloat(dbMetrics['cacheHitRate'] || '0'),
          replicationLag: parseFloat(dbMetrics['replicationLag'] || '0')
        }
      };

    } catch (error: any) {
      return {
        status: 'critical',
        uptime: 0,
        errorCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get cache status
   */
  private async getCacheStatus(): Promise<ComponentStatus> {
    try {
      // Test Redis connection
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Get cache metrics
      const info = await this.redis.info('memory');
      const stats = await this.redis.info('stats');

      const memoryUsed = this.parseInfoValue(info, 'used_memory');
      const memoryMax = this.parseInfoValue(info, 'maxmemory');
      const cacheHits = this.parseInfoValue(stats, 'keyspace_hits');
      const cacheMisses = this.parseInfoValue(stats, 'keyspace_misses');

      const cacheHitRate = cacheHits + cacheMisses > 0
        ? cacheHits / (cacheHits + cacheMisses)
        : 0;

      return {
        status: 'healthy',
        uptime: this.parseInfoValue(info, 'uptime_in_seconds'),
        errorCount: 0,
        metrics: {
          memoryUsed,
          memoryMax,
          memoryUtilization: memoryMax > 0 ? (memoryUsed / memoryMax) * 100 : 0,
          cacheHitRate: cacheHitRate * 100,
          connectedClients: this.parseInfoValue(stats, 'connected_clients')
        }
      };

    } catch (error: any) {
      return {
        status: 'critical',
        uptime: 0,
        errorCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get external API status
   */
  private async getExternalAPIStatus(): Promise<ComponentStatus> {
    try {
      // Check API health from cached metrics
      const apiMetrics = await this.redis.hgetall('external_apis:metrics');

      const optimalStatus = apiMetrics['optimal_status'] || 'unknown';
      const oddsAPIStatus = apiMetrics['odds_api_status'] || 'unknown';

      const status = (optimalStatus === 'healthy' && oddsAPIStatus === 'healthy')
        ? 'healthy'
        : 'degraded';

      return {
        status,
        uptime: parseInt(apiMetrics['uptime'] || '0'),
        errorCount: parseInt(apiMetrics['errorCount'] || '0'),
        metrics: {
          optimalAPILatency: parseFloat(apiMetrics['optimal_latency'] || '0'),
          oddsAPILatency: parseFloat(apiMetrics['odds_api_latency'] || '0'),
          rateLimitRemaining: parseInt(apiMetrics['rate_limit_remaining'] || '0'),
          requestsPerMinute: parseInt(apiMetrics['requests_per_minute'] || '0')
        }
      };

    } catch (error: any) {
      return {
        status: 'critical',
        uptime: 0,
        errorCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get monitoring status
   */
  private async getMonitoringStatus(): Promise<ComponentStatus> {
    try {
      // Check Prometheus health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const prometheusHealth = await fetch('http://prometheus:9090/-/healthy', {
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!prometheusHealth.ok) {
        throw new Error('Prometheus health check failed');
      }

      return {
        status: 'healthy',
        uptime: 0, // Would be retrieved from Prometheus metrics
        errorCount: 0,
        metrics: {
          prometheusTargets: 0, // Would be retrieved from Prometheus
          grafanaDashboards: 0, // Would be retrieved from Grafana API
          activeAlerts: 0        // Would be retrieved from Alertmanager
        }
      };

    } catch (error: any) {
      return {
        status: 'degraded',
        uptime: 0,
        errorCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get system-wide metrics
   */
  private async getSystemMetrics(): Promise<{
    totalThroughput: number;
    averageLatency: number;
    errorRate: number;
    systemLoad: number;
  }> {
    try {
      const metrics = await this.redis.hgetall('system:metrics');

      return {
        totalThroughput: parseInt(metrics['totalThroughput'] || '0'),
        averageLatency: parseFloat(metrics['averageLatency'] || '0'),
        errorRate: parseFloat(metrics['errorRate'] || '0'),
        systemLoad: parseFloat(metrics['systemLoad'] || '0')
      };

    } catch (error: any) {
      return {
        totalThroughput: 0,
        averageLatency: 0,
        errorRate: 0,
        systemLoad: 0
      };
    }
  }

  /**
   * Get active alerts summary
   */
  async getAlertSummary(): Promise<AlertSummary> {
    try {
      // Get alerts from Alertmanager API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const alertsResponse = await fetch('http://alertmanager:9093/api/v1/alerts', {
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!alertsResponse.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const alertsData = await alertsResponse.json();
      const alerts = alertsData.data || [];

      // Process and categorize alerts
      const summary: { critical: number; warning: number; info: number; recent: Alert[] } = {
        critical: 0,
        warning: 0,
        info: 0,
        recent: []
      };

      const processedAlerts: Alert[] = alerts.map((alert: any) => ({
        id: alert.fingerprint || Math.random().toString(36),
        severity: alert.labels?.severity || 'info',
        component: alert.labels?.component || 'unknown',
        message: alert.annotations?.summary || alert.annotations?.['description'] || 'No description',
        timestamp: alert.startsAt,
        acknowledged: alert.status?.state === 'suppressed',
        resolvedAt: alert.endsAt && alert.endsAt !== '0001-01-01T00:00:00Z' ? alert.endsAt : undefined
      }));

      // Count by severity
      processedAlerts.forEach(alert => {
        if (!alert.resolvedAt) {
          summary[alert.severity as keyof typeof summary]++;
        }
      });

      // Get recent alerts (last 24 hours)
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      summary.recent = processedAlerts
        .filter(alert => new Date(alert.timestamp) >= oneDayAgo)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      return summary;

    } catch (error: any) {
      console.error('Failed to get alert summary:', error);
      return {
        critical: 0,
        warning: 0,
        info: 0,
        recent: []
      };
    }
  }

  /**
   * Get agent statuses
   */
  async getAgentStatuses(): Promise<AgentStatus[]> {
    try {
      const agentData = await this.redis.hgetall('agents:status');
      const agents: AgentStatus[] = [];

      for (const [agentId, statusJson] of Object.entries(agentData)) {
        try {
          const status = JSON.parse(statusJson);
          agents.push({
            id: agentId,
            type: status.type || 'Unknown',
            status: status.status || 'unknown',
            processedCount: status.processedCount || 0,
            errorCount: status.errorCount || 0,
            averageProcessingTime: status.averageProcessingTime || 0,
            lastActivity: status.lastActivity || new Date().toISOString(),
            memoryUsage: status.memoryUsage || 0,
            controls: {
              canStart: this.config.agentControl.enabledControls.includes('start'),
              canStop: this.config.agentControl.enabledControls.includes('stop'),
              canRestart: this.config.agentControl.enabledControls.includes('restart'),
              canScale: this.config.agentControl.scalingEnabled
            }
          });
        } catch (parseError: any) {
          console.error(`Failed to parse agent status for ${agentId}:`, parseError);
        }
      }

      return agents;

    } catch (error: any) {
      console.error('Failed to get agent statuses:', error);
      return [];
    }
  }

  /**
   * Execute agent control action
   */
  async executeAgentControl(agentId: string, action: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.config.agentControl.enabledControls.includes(action)) {
        return {
          success: false,
          message: `Action '${action}' is not enabled in production`
        };
      }

      // Execute control action via API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`http://api:3000/api/agents/${agentId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`Control action failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message || `Agent ${action} executed successfully`
      };

    } catch (error: any) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Emergency stop system
   */
  async emergencyStop(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.config.agentControl.emergencyStopEnabled) {
        return {
          success: false,
          message: 'Emergency stop is not enabled in production'
        };
      }

      // Execute emergency stop
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('http://api:3000/api/system/emergency-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`Emergency stop failed: ${response.statusText}`);
      }

      // Log emergency stop action
      await this.redis.lpush('system:emergency_log', JSON.stringify({
        action: 'emergency_stop',
        timestamp: new Date().toISOString(),
        executor: 'command_center'
      }));

      return {
        success: true,
        message: 'Emergency stop executed successfully'
      };

    } catch (error: any) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Emergency stop failed'
      };
    }
  }

  // Helper methods

  private getSettledValue<T>(settledResult: PromiseSettledResult<T>): T | null {
    return settledResult.status === 'fulfilled' ? settledResult.value : null;
  }

  private calculateOverallStatus(componentStatuses: (ComponentStatus | null)[]): 'healthy' | 'degraded' | 'critical' | 'maintenance' {
    const validStatuses = componentStatuses.filter(Boolean) as ComponentStatus[];

    if ((validStatuses?.length ?? 0) === 0) {
      return 'critical';
    }

    const criticalCount = validStatuses.filter(s => s.status === 'critical').length;
    const degradedCount = validStatuses.filter(s => s.status === 'degraded').length;

    if (criticalCount > 0) {
      return 'critical';
    }

    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private parseInfoValue(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:([0-9.]+)`));
    return match ? parseFloat(match[1]) : 0;
  }
}

// Production configuration
export const createProductionCommandCenterConfig = (): CommandCenterConfig => ({
  monitoring: {
    refreshInterval: 30000, // 30 seconds
    alertThresholds: {
      latencyMs: 2000,
      throughputPerHour: 1000,
      errorRate: 5.0,
      memoryUsage: 85.0
    }
  },
  agentControl: {
    enabledControls: ['restart', 'scale'],
    emergencyStopEnabled: true,
    scalingEnabled: true
  },
  performance: {
    metricsRetention: 86400000, // 24 hours
    realTimeUpdates: true,
    dashboardRefreshRate: 5000 // 5 seconds
  },
  operations: {
    incidentManagement: true,
    maintenanceMode: true,
    systemControls: true
  }
});