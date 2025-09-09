/**
 * Real Agent Monitoring System
 * Connects to actual platform agents and monitors their health status
 */

import { Agent } from './supabase';

interface AgentHealthCheck {
  agentName: string;
  endpoint: string;
  timeout: number;
  expectedStatus: number[];
  healthIndicators: string[];
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  lastCheck: Date;
  responseTime: number;
  details: {
    uptime?: number;
    memory?: number;
    cpu?: number;
    operations?: number;
    errors?: string[];
    lastOperation?: Date;
  };
}

class AgentMonitoringService {
  private agents: AgentHealthCheck[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private statusCache: Map<string, AgentStatus> = new Map();
  private performanceMetrics: Map<
    string,
    Array<{ timestamp: number; responseTime: number; status: string }>
  > = new Map();
  private maxMetricsHistory = 100;

  constructor() {
    this.initializeAgentConfigs();
  }

  private initializeAgentConfigs() {
    // Configure health checks for platform agents
    // For development: Use fast timeout and expect 404s gracefully
    this.agents = [
      {
        agentName: 'AlertAgent',
        endpoint: `${process.env['NEXT_PUBLIC_PLATFORM_API_URL']}/api/agents/alert/health`,
        timeout: 1000, // Reduced timeout for development
        expectedStatus: [200, 404], // Accept 404s in development
        healthIndicators: ['uptime', 'lastAlert', 'alertsSent'],
      },
      {
        agentName: 'GradingAgent',
        endpoint: `${process.env['NEXT_PUBLIC_PLATFORM_API_URL']}/api/agents/grading/health`,
        timeout: 1000, // Reduced timeout for development
        expectedStatus: [200, 404], // Accept 404s in development
        healthIndicators: ['picksProcessed', 'accuracy', 'uptime'],
      },
      {
        agentName: 'RecapAgent',
        endpoint: `${process.env['NEXT_PUBLIC_PLATFORM_API_URL']}/api/agents/recap/health`,
        timeout: 1000, // Reduced timeout for development
        expectedStatus: [200, 404], // Accept 404s in development
        healthIndicators: ['recapsGenerated', 'uptime', 'lastRecap'],
      },
      {
        agentName: 'FeedAgent',
        endpoint: `${process.env['NEXT_PUBLIC_PLATFORM_API_URL']}/api/agents/feed/health`,
        timeout: 1000, // Reduced timeout for development
        expectedStatus: [200, 404], // Accept 404s in development
        healthIndicators: ['feedsProcessed', 'uptime', 'sources'],
      },
      {
        agentName: 'NotificationAgent',
        endpoint: `${process.env['NEXT_PUBLIC_PLATFORM_API_URL']}/api/agents/notification/health`,
        timeout: 1000, // Reduced timeout for development
        expectedStatus: [200, 404], // Accept 404s in development
        healthIndicators: ['notificationsSent', 'uptime', 'channels'],
      },
    ];
  }

  /**
   * Start continuous monitoring of all agents
   */
  startMonitoring(intervalMs: number = 30000) {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log(`🔍 Starting agent monitoring (interval: ${intervalMs}ms)`);

    // Initial check
    this.checkAllAgents();

    // Schedule regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkAllAgents();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval as any);
      this.monitoringInterval = null;
      console.log('🛑 Agent monitoring stopped');
    }
  }

  /**
   * Check health of all configured agents
   */
  async checkAllAgents(): Promise<AgentStatus[]> {
    console.log('🏥 Checking health of all agents...');

    const healthChecks = this.agents.map(agent =>
      this.checkAgentHealth(agent).catch(error => {
        console.error(`Health check failed for ${agent.agentName}:`, error);
        return this.createErrorStatus(agent.agentName, error);
      })
    );

    const results = await Promise.allSettled(healthChecks);
    const statuses: AgentStatus[] = [];

    results.forEach((result, index) => {
      const agentName = this.agents[index].agentName;

      if (result.status === 'fulfilled') {
        statuses.push(result.value);
        this.statusCache.set(agentName, result.value);
      } else {
        const errorStatus = this.createErrorStatus(agentName, result.reason);
        statuses.push(errorStatus);
        this.statusCache.set(agentName, errorStatus);
      }
    });

    console.log(`✅ Health check completed for ${statuses.length} agents`);
    return statuses;
  }

  /**
   * Check health of a specific agent
   */
  async checkAgentHealth(config: AgentHealthCheck): Promise<AgentStatus> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.endpoint, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Unit-Talk-Command-Center/1.0',
        },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!config.expectedStatus.includes(response.status)) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      const healthData = await response.json();
      const status = this.determineStatus(healthData, responseTime);

      // Track performance metrics
      this.trackPerformanceMetric(config.agentName, responseTime, status);

      return {
        id: this.generateAgentId(config.agentName),
        name: config.agentName,
        status,
        lastCheck: new Date(),
        responseTime,
        details: {
          uptime: healthData.uptime || 0,
          memory: healthData.memory || 0,
          cpu: healthData.cpu || 0,
          operations: healthData.operations || 0,
          errors: healthData.errors || [],
          lastOperation: healthData.lastOperation ? new Date(healthData.lastOperation) : undefined,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new AgentHealthError(config.agentName, error, responseTime);
    }
  }

  /**
   * Get cached status for all agents
   */
  getCachedStatuses(): AgentStatus[] {
    return Array.from(this.statusCache.values());
  }

  /**
   * Get status for a specific agent
   */
  getAgentStatus(agentName: string): AgentStatus | null {
    return this.statusCache.get(agentName) || null;
  }

  /**
   * Check a specific agent's health
   */
  async checkAgent(agentName: string): Promise<AgentStatus> {
    const config = this.agents.find(a => a.agentName === agentName);
    if (!config) {
      throw new Error(`Agent ${agentName} not configured for monitoring`);
    }

    try {
      const status = await this.checkAgentHealth(config);
      this.statusCache.set(agentName, status);
      return status;
    } catch (error) {
      const errorStatus = this.createErrorStatus(agentName, error);
      this.statusCache.set(agentName, errorStatus);
      return errorStatus;
    }
  }

  /**
   * Force refresh of a specific agent
   */
  async refreshAgent(agentName: string): Promise<AgentStatus> {
    const config = this.agents.find(a => a.agentName === agentName);
    if (!config) {
      throw new Error(`Agent ${agentName} not configured for monitoring`);
    }

    const status = await this.checkAgentHealth(config);
    this.statusCache.set(agentName, status);
    return status;
  }

  private determineStatus(
    healthData: any,
    responseTime: number
  ): 'healthy' | 'warning' | 'error' | 'inactive' {
    // Agent is inactive if it reports as such
    if (healthData.status === 'inactive' || healthData.enabled === false) {
      return 'inactive';
    }

    // Agent has errors
    if (healthData.errors && healthData.errors.length > 0) {
      return 'error';
    }

    // High response time is a warning
    if (responseTime > 5000) {
      return 'warning';
    }

    // Low uptime or high error rate is a warning
    if (healthData.uptime < 0.95 || (healthData.errorRate && healthData.errorRate > 0.05)) {
      return 'warning';
    }

    return 'healthy';
  }

  private createErrorStatus(agentName: string, error: any): AgentStatus {
    return {
      id: this.generateAgentId(agentName),
      name: agentName,
      status: 'error',
      lastCheck: new Date(),
      responseTime: 0,
      details: {
        errors: [error.message || 'Unknown error'],
        uptime: 0,
      },
    };
  }

  private generateAgentId(agentName: string): string {
    return `agent_${agentName.toLowerCase()}`;
  }

  /**
   * Track performance metrics for trending analysis
   */
  private trackPerformanceMetric(agentName: string, responseTime: number, status: string): void {
    if (!this.performanceMetrics.has(agentName)) {
      this.performanceMetrics.set(agentName, []);
    }

    const metrics = this.performanceMetrics.get(agentName)!;
    metrics.push({
      timestamp: Date.now(),
      responseTime,
      status,
    });

    // Keep only recent metrics
    if (metrics.length > this.maxMetricsHistory) {
      metrics.splice(0, metrics.length - this.maxMetricsHistory);
    }
  }

  /**
   * Get performance trends for an agent
   */
  getAgentPerformanceTrends(agentName: string): {
    avgResponseTime: number;
    healthyPercentage: number;
    trend: 'improving' | 'declining' | 'stable';
    recentMetrics: Array<{ timestamp: number; responseTime: number; status: string }>;
  } {
    const metrics = this.performanceMetrics.get(agentName) || [];

    if (metrics.length === 0) {
      return {
        avgResponseTime: 0,
        healthyPercentage: 0,
        trend: 'stable',
        recentMetrics: [],
      };
    }

    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const healthyCount = metrics.filter(m => m.status === 'healthy').length;
    const healthyPercentage = (healthyCount / metrics.length) * 100;

    // Calculate trend (compare first half vs second half)
    const halfPoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, halfPoint);
    const secondHalf = metrics.slice(halfPoint);

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.responseTime, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, m) => sum + m.responseTime, 0) / secondHalf.length;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    const diff = secondHalfAvg - firstHalfAvg;
    const threshold = firstHalfAvg * 0.1; // 10% threshold

    if (diff < -threshold) {
      trend = 'improving';
    } else if (diff > threshold) {
      trend = 'declining';
    }

    return {
      avgResponseTime,
      healthyPercentage,
      trend,
      recentMetrics: metrics.slice(-10), // Last 10 metrics
    };
  }

  /**
   * Get system-wide performance summary
   */
  getSystemPerformanceSummary(): {
    totalAgents: number;
    healthyAgents: number;
    avgSystemResponseTime: number;
    systemHealthScore: number;
    criticalAlerts: string[];
  } {
    const allStatuses = Array.from(this.statusCache.values());
    const healthyAgents = allStatuses.filter(s => s.status === 'healthy').length;
    const avgSystemResponseTime =
      allStatuses.reduce((sum, s) => sum + s.responseTime, 0) / allStatuses.length;

    // Calculate system health professional_score (0-100)
    const healthyPercentage = (healthyAgents / allStatuses.length) * 100;
    const responseTimeScore = Math.max(0, 100 - avgSystemResponseTime / 50); // Penalize slow responses
    const systemHealthScore = healthyPercentage * 0.7 + responseTimeScore * 0.3;

    // Identify critical alerts
    const criticalAlerts: string[] = [];
    allStatuses.forEach(status => {
      if (status.status === 'error') {
        criticalAlerts.push(`${status.name}: ${status.details.errors?.[0] || 'Unknown error'}`);
      }
      if (status.responseTime > 10000) {
        criticalAlerts.push(`${status.name}: Very slow response time (${status.responseTime}ms)`);
      }
    });

    return {
      totalAgents: allStatuses.length,
      healthyAgents,
      avgSystemResponseTime,
      systemHealthScore,
      criticalAlerts,
    };
  }
}

class AgentHealthError extends Error {
  constructor(
    public agentName: string,
    public originalError: any,
    public responseTime: number
  ) {
    super(`Health check failed for ${agentName}: ${originalError.message || originalError}`);
    this.name = 'AgentHealthError';
  }
}

// Export singleton instance
export const agentMonitor = new AgentMonitoringService();

// Note: React hook moved to separate client-side file to avoid SSR issues

export { AgentMonitoringService, AgentHealthError };
export type { AgentStatus, AgentHealthCheck };
