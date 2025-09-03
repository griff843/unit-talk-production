import { EventEmitter } from 'events';

import { BaseAgent } from '../agents/BaseAgent';
import { redisCache } from '../cache/enhanced-cache';
import { Logger } from '../shared/logger/types';

import { AgentMetricsCollector } from './AgentMetricsCollector';
import { AgentMonitoringDashboard } from './AgentMonitoringDashboard';
import { AgentMonitoringIntegration } from './AgentMonitoringIntegration';


interface MonitoringConfig {
  enabled: boolean;
  metricsCollectionInterval: number;
  dashboardUpdateInterval: number;
  alertingEnabled: boolean;
  exportFormats: string[];
  retentionPeriod: number; // days
}

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  components: {
    metricsCollector: boolean;
    dashboard: boolean;
    integration: boolean;
    alerting: boolean;
  };
  uptime: number;
  lastUpdate: Date;
  version: string;
}

export class AgentMonitoringService extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: MonitoringConfig;
  private metricsCollector: AgentMetricsCollector;
  private dashboard: AgentMonitoringDashboard;
  private integration: AgentMonitoringIntegration;
  private isInitialized: boolean = false;
  private startTime: Date = new Date();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger, config: Partial<MonitoringConfig> = {}) {
    super();
    this.logger = logger;
    this.config = {
      enabled: true,
      metricsCollectionInterval: 60000, // 1 minute
      dashboardUpdateInterval: 30000,   // 30 seconds
      alertingEnabled: true,
      exportFormats: ['json', 'csv', 'prometheus'],
      retentionPeriod: 30, // 30 days
      ...config
    };

    // Initialize components
    this.metricsCollector = new AgentMetricsCollector(this.logger);
    this.dashboard = new AgentMonitoringDashboard(this.logger, this.metricsCollector);
    this.integration = new AgentMonitoringIntegration(this.logger, this.metricsCollector);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('AgentMonitoringService already initialized');
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('Agent monitoring disabled by configuration');
      return;
    }

    this.logger.info('🚀 Initializing AgentMonitoringService', {
      config: this.config
    });

    try {
      // Initialize components in order
      await this.metricsCollector.initialize();
      await this.dashboard.initialize();
      await this.integration.initialize();

      // Setup cross-component event handling
      this.setupEventHandlers();

      // Start health monitoring
      this.startHealthMonitoring();

      // Setup cleanup handlers
      this.setupCleanupHandlers();

      this.isInitialized = true;
      this.logger.info('✅ AgentMonitoringService initialized successfully');

      // Emit initialization event
      this.emit('service_initialized', {
        timestamp: new Date(),
        config: this.config
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize AgentMonitoringService', { error });
      throw error;
    }
  }

  async registerAgent(agent: BaseAgent): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    const agentName = agent.constructor.name;
    this.logger.info('Registering agent for monitoring', { agentName });

    try {
      // Register with integration layer
      this.integration.registerAgent(agent);

      // Create default alert rules for the agent
      await this.createDefaultAlertRules(agentName);

      this.logger.info('✅ Agent registered successfully', { agentName });

      this.emit('agent_registered', {
        agentName,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to register agent', { agentName, error });
      throw error;
    }
  }

  async unregisterAgent(agentName: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    this.logger.info('Unregistering agent from monitoring', { agentName });

    try {
      this.integration.unregisterAgent(agentName);

      this.logger.info('✅ Agent unregistered successfully', { agentName });

      this.emit('agent_unregistered', {
        agentName,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to unregister agent', { agentName, error });
      throw error;
    }
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    const uptime = Date.now() - this.startTime.getTime();

    const components = {
      metricsCollector: await this.checkComponentHealth('metricsCollector'),
      dashboard: await this.checkComponentHealth('dashboard'),
      integration: await this.checkComponentHealth('integration'),
      alerting: this.config.alertingEnabled
    };

    const healthyComponents = Object.values(components).filter(Boolean).length;
    const totalComponents = Object.keys(components).length;

    let status: ServiceStatus['status'];
    if (healthyComponents === totalComponents) {
      status = 'healthy';
    } else if (healthyComponents >= totalComponents * 0.7) {
      status = 'degraded';
    } else if (healthyComponents > 0) {
      status = 'critical';
    } else {
      status = 'down';
    }

    return {
      status,
      components,
      uptime: uptime / 1000, // Convert to seconds
      lastUpdate: new Date(),
      version: '1.0.0'
    };
  }

  async getSystemOverview(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.dashboard.getSystemOverview();
  }

  async getAgentMetrics(agentName: string, timeframe: 'last_hour' | 'last_day' | 'last_week' = 'last_hour'): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.dashboard.getAgentDetailedMetrics(agentName, timeframe);
  }

  async getAlertSummary(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.dashboard.getAlertSummary();
  }

  async createAlertRule(rule: any): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.metricsCollector.createAlertRule(rule);
  }

  async exportMetrics(agentName: string, format: 'json' | 'csv' | 'prometheus', timeframe: 'last_hour' | 'last_day' | 'last_week'): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    if (!this.config.exportFormats.includes(format)) {
      throw new Error(`Export format '${format}' not supported`);
    }

    return await this.metricsCollector.exportMetrics(agentName, format, timeframe);
  }

  async generatePerformanceReport(agentName?: string, days: number = 7): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.dashboard.getPerformanceReport(agentName, days);
  }

  async createDashboard(layout: any): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.dashboard.createDashboardLayout(layout);
  }

  async getDashboards(): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    return await this.dashboard.getDashboardLayouts();
  }

  // WebSocket/SSE support for real-time dashboard updates
  registerDashboardConnection(connectionId: string): void {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    this.dashboard.registerConnection(connectionId);
  }

  unregisterDashboardConnection(connectionId: string): void {
    if (this.isInitialized) {
      this.dashboard.unregisterConnection(connectionId);
    }
  }

  // Event subscription for external systems
  onMetricsUpdate(callback: (metrics: any) => void): void {
    this.on('metrics_update', callback);
  }

  onAlertTriggered(callback: (alert: any) => void): void {
    this.on('alert_triggered', callback);
  }

  onSystemHealthChange(callback: (health: any) => void): void {
    this.on('system_health_change', callback);
  }

  private async checkComponentHealth(component: string): Promise<boolean> {
    try {
      switch (component) {
        case 'metricsCollector':
          return await this.metricsCollector.isHealthy?.() || true;
        case 'dashboard':
          return true; // Dashboard doesn't have explicit health check
        case 'integration':
          const integrationStatus = await this.integration.getIntegrationStatus();
          return integrationStatus.monitoringActive;
        default:
          return false;
      }
    } catch (error) {
      this.logger.warn(`Health check failed for component: ${component}`, { error });
      return false;
    }
  }

  private setupEventHandlers(): void {
    // Metrics collector events
    this.metricsCollector.on('metrics_collected', (metrics) => {
      this.emit('metrics_update', metrics);
    });

    this.metricsCollector.on('alert_triggered', (alert) => {
      this.emit('alert_triggered', alert);
      this.logger.warn('Agent alert triggered', alert);
    });

    // Dashboard events
    this.dashboard.on('dashboard_update', (data) => {
      // Forward dashboard updates to external listeners
      this.emit('dashboard_update', data);
    });

    // System health monitoring
    this.on('metrics_update', async (_metrics) => {
      try {
        const systemStatus = await this.getServiceStatus();
        if (systemStatus.status !== 'healthy') {
          this.emit('system_health_change', {
            status: systemStatus.status,
            timestamp: new Date(),
            details: systemStatus.components
          });
        }
      } catch (error) {
        this.logger.error('Failed to check system health', { error });
      }
    });
  }

  private startHealthMonitoring(): void {
    // Check service health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        const status = await this.getServiceStatus();
        
        if (status.status !== 'healthy') {
          this.logger.warn('Service health degraded', { status });
          this.emit('service_health_change', status);
        }

        // Store health status in Redis for external monitoring
        await redisCache.set('monitoring_service_health', JSON.stringify(status), 300);

      } catch (error) {
        this.logger.error('Health monitoring check failed', { error });
      }
    }, 300000); // 5 minutes
  }

  private async createDefaultAlertRules(agentName: string): Promise<void> {
    const defaultRules = [
      {
        agentName,
        metricName: 'performance.errorRate',
        threshold: 0.05,
        operator: '>' as const,
        severity: 'high' as const,
        enabled: true,
        cooldownMinutes: 10
      },
      {
        agentName,
        metricName: 'performance.responseTime',
        threshold: 1000,
        operator: '>' as const,
        severity: 'medium' as const,
        enabled: true,
        cooldownMinutes: 15
      },
      {
        agentName,
        metricName: 'health.score',
        threshold: 70,
        operator: '<' as const,
        severity: 'high' as const,
        enabled: true,
        cooldownMinutes: 5
      }
    ];

    for (const rule of defaultRules) {
      try {
        await this.metricsCollector.createAlertRule(rule);
      } catch (error) {
        this.logger.error('Failed to create default alert rule', { agentName, rule, error });
      }
    }
  }

  private setupCleanupHandlers(): void {
    // Cleanup on process signals
    const cleanup = async () => {
      this.logger.info('🧹 Starting AgentMonitoringService cleanup...');
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception in monitoring service', { error });
      await this.cleanup();
      process.exit(1);
    });
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up AgentMonitoringService...');

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Cleanup components
      await Promise.allSettled([
        this.integration.cleanup(),
        this.dashboard.cleanup(),
        this.metricsCollector.cleanup()
      ]);

      // Remove all event listeners
      this.removeAllListeners();

      this.isInitialized = false;

      this.logger.info('✅ AgentMonitoringService cleanup completed');

    } catch (error) {
      this.logger.error('Error during cleanup', { error });
      throw error;
    }
  }

  // Static factory method for easy instantiation
  static async create(logger: Logger, config?: Partial<MonitoringConfig>): Promise<AgentMonitoringService> {
    const service = new AgentMonitoringService(logger, config);
    await service.initialize();
    return service;
  }

  // Getter methods for accessing components (for advanced use cases)
  get metrics(): AgentMetricsCollector {
    return this.metricsCollector;
  }

  get dashboardService(): AgentMonitoringDashboard {
    return this.dashboard;
  }

  get integrationService(): AgentMonitoringIntegration {
    return this.integration;
  }

  get configuration(): MonitoringConfig {
    return { ...this.config };
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}