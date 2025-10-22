import { EventEmitter } from 'events';

import { redisCache } from '../cache/enhanced-cache';
import { Logger } from '../shared/logger/types';
import { professionalScoreOf } from '../types/compat';

interface AgentMetrics {
  agentName: string;
  timestamp: Date;
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  };
  business: {
    operationsCompleted: number;
    predictionsGenerated?: number;
    usersProcessed?: number;
    optimizationsApplied?: number;
    alertsTriggered?: number;
    behaviorEventsTracked?: number;
    conversationsGenerated?: number;
    churnPredictionsGenerated?: number;
    segmentationUpdates?: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'critical' | 'down';
    score: number;
    dependencies: Record<string, 'healthy' | 'degraded' | 'critical'>;
    lastHealthCheck: Date;
  };
  cache: {
    hitRate: number;
    missRate: number;
    operations: number;
    averageLatency: number;
  };
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    successes: number;
    lastFailure?: Date;
  };
}

interface MetricsAggregation {
  agentName: string;
  timeframe: string;
  avgResponseTime: number;
  totalOperations: number;
  errorRate: number;
  availabilityPercentage: number;
  throughputTrend: number[];
  memoryTrend: number[];
  performanceScore: number;
}

interface AlertRule {
  id: string;
  agentName: string;
  metricName: string;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
}

export class AgentMetricsCollector extends EventEmitter {
  private readonly logger: Logger;
  private metricsBuffer: Map<string, AgentMetrics[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private aggregationInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('📊 Initializing AgentMetricsCollector');
    
    await this.loadAlertRules();
    await this.setupDefaultAlertRules();
    
    // Start collection and aggregation intervals
    this.startMetricsCollection();
    this.startMetricsAggregation();
    
    this.logger.info('✅ AgentMetricsCollector initialized');
  }

  async collectMetrics(agentName: string, metrics: Partial<AgentMetrics>): Promise<void> {
    const fullMetrics: AgentMetrics = {
      agentName,
      timestamp: new Date(),
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        successRate: 1,
        ...metrics.performance
      },
      business: {
        operationsCompleted: 0,
        ...metrics.business
      },
      health: {
        status: 'healthy',
        score: 100,
        dependencies: {},
        lastHealthCheck: new Date(),
        ...metrics.health
      },
      cache: {
        hitRate: 0.8,
        missRate: 0.2,
        operations: 0,
        averageLatency: 5,
        ...metrics.cache
      },
      circuitBreaker: {
        state: 'closed',
        failures: 0,
        successes: 0,
        ...metrics.circuitBreaker
      }
    };

    // Add to buffer
    if (!this.metricsBuffer.has(agentName)) {
      this.metricsBuffer.set(agentName, []);
    }
    
    const buffer = this.metricsBuffer.get(agentName)!;
    buffer.push(fullMetrics);
    
    // Keep only last 1000 metrics per agent
    if (buffer.length > 1000) {
      buffer.shift();
    }

    // Store in Redis for real-time access
    await this.storeMetricsInCache(fullMetrics);

    // Check alert rules
    await this.checkAlertRules(fullMetrics);

    // Emit metrics event
    this.emit('metrics_collected', fullMetrics);
  }

  async getAgentMetrics(agentName: string, timeframe: 'last_hour' | 'last_day' | 'last_week' = 'last_hour'): Promise<AgentMetrics[]> {
    const buffer = this.metricsBuffer.get(agentName) || [];
    const now = Date.now();
    
    const timeframes = {
      last_hour: 60 * 60 * 1000,
      last_day: 24 * 60 * 60 * 1000,
      last_week: 7 * 24 * 60 * 60 * 1000
    };
    
    const cutoff = now - timeframes[timeframe];
    
    return buffer.filter(metric => metric.timestamp.getTime() >= cutoff);
  }

  async getAggregatedMetrics(agentName: string, timeframe: string): Promise<MetricsAggregation | null> {
    try {
      const cacheKey = `agent_metrics_agg:${agentName}:${timeframe}`;
      const cached = await redisCache.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Calculate aggregation from buffer
      const metrics = await this.getAgentMetrics(agentName, timeframe as any);
      if (metrics.length === 0) return null;
      
      const aggregation = this.calculateAggregation(agentName, timeframe, metrics);
      
      // Cache for 5 minutes
      await redisCache.set(cacheKey, JSON.stringify(aggregation), 300);
      
      return aggregation;
    } catch (error) {
      this.logger.error('Failed to get aggregated metrics', { agentName, timeframe, error });
      return null;
    }
  }

  async getAllAgentsStatus(): Promise<Record<string, { status: string; score: number; lastUpdate: Date }>> {
    const status: Record<string, { status: string; score: number; lastUpdate: Date }> = {};
    
    for (const [agentName, buffer] of this.metricsBuffer) {
      if (buffer.length > 0) {
        const latest = buffer[buffer.length - 1];
        status[agentName] = {
          status: latest.health.status,
          score: professionalScoreOf(latest.health),
          lastUpdate: latest.timestamp
        };
      }
    }
    
    return status;
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alertRule: AlertRule = { ...rule, id };
    
    this.alertRules.set(id, alertRule);
    await this.saveAlertRules();
    
    this.logger.info('Alert rule created', { id, agentName: rule.agentName, metricName: rule.metricName });
    return id;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<boolean> {
    const rule = this.alertRules.get(id);
    if (!rule) return false;
    
    Object.assign(rule, updates);
    await this.saveAlertRules();
    
    this.logger.info('Alert rule updated', { id, updates });
    return true;
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      await this.saveAlertRules();
      this.logger.info('Alert rule deleted', { id });
    }
    return deleted;
  }

  async getAlertRules(agentName?: string): Promise<AlertRule[]> {
    const rules = Array.from(this.alertRules.values());
    return agentName ? rules.filter(rule => rule.agentName === agentName) : rules;
  }

  async exportMetrics(agentName: string, format: 'json' | 'csv' | 'prometheus', timeframe: 'last_hour' | 'last_day' | 'last_week'): Promise<string> {
    const metrics = await this.getAgentMetrics(agentName, timeframe);
    
    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      
      case 'csv':
        return this.convertToCSV(metrics);
      
      case 'prometheus':
        return this.convertToPrometheus(metrics);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async storeMetricsInCache(metrics: AgentMetrics): Promise<void> {
    try {
      const key = `agent_metrics:${metrics.agentName}:latest`;
      await redisCache.set(key, JSON.stringify(metrics), 3600); // 1 hour TTL
      
      // Store in time-series format for Prometheus
      const tsKey = `agent_metrics_ts:${metrics.agentName}:${Date.now()}`;
      await redisCache.set(tsKey, JSON.stringify(metrics), 86400); // 24 hours TTL
    } catch (error) {
      this.logger.warn('Failed to store metrics in cache', { agentName: metrics.agentName, error });
    }
  }

  private async checkAlertRules(metrics: AgentMetrics): Promise<void> {
    const relevantRules = Array.from(this.alertRules.values())
      .filter(rule => rule.enabled && rule.agentName === metrics.agentName);
    
    for (const rule of relevantRules) {
      const shouldTrigger = await this.evaluateAlertRule(rule, metrics);
      
      if (shouldTrigger) {
        const now = new Date();
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        
        // Check cooldown period
        if (rule.lastTriggered && (now.getTime() - rule.lastTriggered.getTime()) < cooldownMs) {
          continue;
        }
        
        rule.lastTriggered = now;
        await this.triggerAlert(rule, metrics);
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule, metrics: AgentMetrics): Promise<boolean> {
    const value = this.getMetricValue(metrics, rule.metricName);
    if (value === undefined) return false;
    
    switch (rule.operator) {
      case '>': return value > rule.threshold;
      case '<': return value < rule.threshold;
      case '=': return value === rule.threshold;
      case '>=': return value >= rule.threshold;
      case '<=': return value <= rule.threshold;
      default: return false;
    }
  }

  private getMetricValue(metrics: AgentMetrics, metricName: string): number | undefined {
    const paths = metricName.split('.');
    let value: any = metrics;
    
    for (const path of paths) {
      value = value?.[path];
    }
    
    return typeof value === 'number' ? value : undefined;
  }

  private async triggerAlert(rule: AlertRule, metrics: AgentMetrics): Promise<void> {
    const alert = {
      id: `alert_${Date.now()}`,
      ruleId: rule.id,
      agentName: rule.agentName,
      metricName: rule.metricName,
      currentValue: this.getMetricValue(metrics, rule.metricName),
      threshold: rule.threshold,
      severity: rule.severity,
      timestamp: new Date(),
      message: `Alert: ${rule.agentName} ${rule.metricName} ${rule.operator} ${rule.threshold}`
    };
    
    this.emit('alert_triggered', alert);
    this.logger.warn('Agent alert triggered', alert);
    
    // Store alert in Redis
    await redisCache.set(`agent_alert:${alert.id}`, JSON.stringify(alert), 86400);
  }

  private calculateAggregation(agentName: string, timeframe: string, metrics: AgentMetrics[]): MetricsAggregation {
    if (metrics.length === 0) {
      return {
        agentName,
        timeframe,
        avgResponseTime: 0,
        totalOperations: 0,
        errorRate: 0,
        availabilityPercentage: 0,
        throughputTrend: [],
        memoryTrend: [],
        performanceScore: 0
      };
    }
    
    const totalResponseTime = metrics.reduce((sum, m) => sum + m.performance.responseTime, 0);
    const totalOperations = metrics.reduce((sum, m) => sum + m.business.operationsCompleted, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + (m.performance.errorRate * m.business.operationsCompleted), 0);
    const healthyCount = metrics.filter(m => m.health.status === 'healthy').length;
    
    const throughputTrend = metrics.slice(-24).map(m => m.performance.throughput); // Last 24 data points
    const memoryTrend = metrics.slice(-24).map(m => m.performance.memoryUsage);
    
    // Calculate performance professional_score (0-100)
    const avgResponseTime = totalResponseTime / metrics.length;
    const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;
    const availabilityPercentage = (healthyCount / metrics.length) * 100;
    
    const performanceScore = Math.max(0, Math.min(100, 
      (100 - (avgResponseTime / 10)) * 0.3 +  // Response time factor
      (100 - (errorRate * 100)) * 0.4 +       // Error rate factor
      availabilityPercentage * 0.3             // Availability factor
    ));
    
    return {
      agentName,
      timeframe,
      avgResponseTime,
      totalOperations,
      errorRate,
      availabilityPercentage,
      throughputTrend,
      memoryTrend,
      performanceScore
    };
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        this.logger.error('Failed to collect system metrics', { error });
      }
    }, 30000);
  }

  private startMetricsAggregation(): void {
    // Aggregate metrics every 5 minutes
    this.aggregationInterval = setInterval(async () => {
      try {
        await this.performMetricsAggregation();
      } catch (error) {
        this.logger.error('Failed to perform metrics aggregation', { error });
      }
    }, 300000);
  }

  private async collectSystemMetrics(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemMetrics = {
      timestamp: new Date(),
      system: {
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      }
    };
    
    await redisCache.set('system_metrics:latest', JSON.stringify(systemMetrics), 300);
  }

  private async performMetricsAggregation(): Promise<void> {
    const agentNames = Array.from(this.metricsBuffer.keys());
    
    for (const agentName of agentNames) {
      const timeframes = ['last_hour', 'last_day', 'last_week'];
      
      for (const timeframe of timeframes) {
        try {
          const metrics = await this.getAgentMetrics(agentName, timeframe as any);
          const aggregation = this.calculateAggregation(agentName, timeframe, metrics);
          
          const cacheKey = `agent_metrics_agg:${agentName}:${timeframe}`;
          await redisCache.set(cacheKey, JSON.stringify(aggregation), 3600);
        } catch (error) {
          this.logger.error('Failed to aggregate metrics', { agentName, timeframe, error });
        }
      }
    }
  }

  private convertToCSV(metrics: AgentMetrics[]): string {
    if (metrics.length === 0) return '';
    
    const headers = [
      'timestamp', 'agentName', 'cpuUsage', 'memoryUsage', 'responseTime',
      'throughput', 'errorRate', 'successRate', 'operationsCompleted',
      'healthStatus', 'healthScore', 'cacheHitRate'
    ];
    
    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.agentName,
      m.performance.cpuUsage,
      m.performance.memoryUsage,
      m.performance.responseTime,
      m.performance.throughput,
      m.performance.errorRate,
      m.performance.successRate,
      m.business.operationsCompleted,
      m.health.status,
      professionalScoreOf(m.health),
      m.cache.hitRate
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private convertToPrometheus(metrics: AgentMetrics[]): string {
    if (metrics.length === 0) return '';
    
    const latest = metrics[metrics.length - 1];
    const labels = `{agent="${latest.agentName}"}`;
    
    return [
      `# HELP agent_cpu_usage CPU usage percentage`,
      `# TYPE agent_cpu_usage gauge`,
      `agent_cpu_usage${labels} ${latest.performance.cpuUsage}`,
      '',
      `# HELP agent_memory_usage Memory usage in bytes`,
      `# TYPE agent_memory_usage gauge`,
      `agent_memory_usage${labels} ${latest.performance.memoryUsage}`,
      '',
      `# HELP agent_response_time Response time in milliseconds`,
      `# TYPE agent_response_time gauge`,
      `agent_response_time${labels} ${latest.performance.responseTime}`,
      '',
      `# HELP agent_operations_total Total operations completed`,
      `# TYPE agent_operations_total counter`,
      `agent_operations_total${labels} ${latest.business.operationsCompleted}`,
      ''
    ].join('\n');
  }

  private async setupDefaultAlertRules(): Promise<void> {
    const defaultRules = [
      {
        agentName: '*', // Apply to all agents
        metricName: 'performance.errorRate',
        threshold: 0.05,
        operator: '>' as const,
        severity: 'high' as const,
        enabled: true,
        cooldownMinutes: 15
      },
      {
        agentName: '*',
        metricName: 'performance.responseTime',
        threshold: 1000,
        operator: '>' as const,
        severity: 'medium' as const,
        enabled: true,
        cooldownMinutes: 10
      },
      {
        agentName: '*',
        metricName: 'health.score',
        threshold: 70,
        operator: '<' as const,
        severity: 'high' as const,
        enabled: true,
        cooldownMinutes: 5
      }
    ];
    
    for (const rule of defaultRules) {
      await this.createAlertRule(rule);
    }
  }

  private async loadAlertRules(): Promise<void> {
    try {
      const cached = await redisCache.get('agent_alert_rules');
      if (cached) {
        const rules: AlertRule[] = JSON.parse(cached);
        for (const rule of rules) {
          this.alertRules.set(rule.id, rule);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load alert rules', { error });
    }
  }

  private async saveAlertRules(): Promise<void> {
    try {
      const rules = Array.from(this.alertRules.values());
      await redisCache.set('agent_alert_rules', JSON.stringify(rules), 86400);
    } catch (error) {
      this.logger.error('Failed to save alert rules', { error });
    }
  }

  async cleanup(): Promise<void> {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    
    await this.saveAlertRules();
    this.removeAllListeners();
    
    this.logger.info('🧹 AgentMetricsCollector cleanup completed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check if cache is accessible
      await redisCache.healthCheck();
      // Check if we can store and retrieve metrics
      const testKey = 'health_check_test';
      await redisCache.set(testKey, 'test', 10);
      const retrieved = await redisCache.get(testKey);
      await redisCache.del(testKey);
      return retrieved === 'test';
    } catch (error) {
      return false;
    }
  }
}