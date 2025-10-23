"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMonitoringService = void 0;
const events_1 = require("events");
const enhanced_cache_1 = require("../cache/enhanced-cache");
const AgentMetricsCollector_1 = require("./AgentMetricsCollector");
const AgentMonitoringDashboard_1 = require("./AgentMonitoringDashboard");
const AgentMonitoringIntegration_1 = require("./AgentMonitoringIntegration");
class AgentMonitoringService extends events_1.EventEmitter {
    constructor(logger, config = {}) {
        super();
        this.isInitialized = false;
        this.startTime = new Date();
        this.healthCheckInterval = null;
        this.logger = logger;
        this.config = {
            enabled: true,
            metricsCollectionInterval: 60000, // 1 minute
            dashboardUpdateInterval: 30000, // 30 seconds
            alertingEnabled: true,
            exportFormats: ['json', 'csv', 'prometheus'],
            retentionPeriod: 30, // 30 days
            ...config
        };
        // Initialize components
        this.metricsCollector = new AgentMetricsCollector_1.AgentMetricsCollector(this.logger);
        this.dashboard = new AgentMonitoringDashboard_1.AgentMonitoringDashboard(this.logger, this.metricsCollector);
        this.integration = new AgentMonitoringIntegration_1.AgentMonitoringIntegration(this.logger, this.metricsCollector);
    }
    async initialize() {
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
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize AgentMonitoringService', { error });
            throw error;
        }
    }
    async registerAgent(agent) {
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
        }
        catch (error) {
            this.logger.error('Failed to register agent', { agentName, error });
            throw error;
        }
    }
    async unregisterAgent(agentName) {
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
        }
        catch (error) {
            this.logger.error('Failed to unregister agent', { agentName, error });
            throw error;
        }
    }
    async getServiceStatus() {
        const uptime = Date.now() - this.startTime.getTime();
        const components = {
            metricsCollector: await this.checkComponentHealth('metricsCollector'),
            dashboard: await this.checkComponentHealth('dashboard'),
            integration: await this.checkComponentHealth('integration'),
            alerting: this.config.alertingEnabled
        };
        const healthyComponents = Object.values(components).filter(Boolean).length;
        const totalComponents = Object.keys(components).length;
        let status;
        if (healthyComponents === totalComponents) {
            status = 'healthy';
        }
        else if (healthyComponents >= totalComponents * 0.7) {
            status = 'degraded';
        }
        else if (healthyComponents > 0) {
            status = 'critical';
        }
        else {
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
    async getSystemOverview() {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.dashboard.getSystemOverview();
    }
    async getAgentMetrics(agentName, timeframe = 'last_hour') {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.dashboard.getAgentDetailedMetrics(agentName, timeframe);
    }
    async getAlertSummary() {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.dashboard.getAlertSummary();
    }
    async createAlertRule(rule) {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.metricsCollector.createAlertRule(rule);
    }
    async exportMetrics(agentName, format, timeframe) {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        if (!this.config.exportFormats.includes(format)) {
            throw new Error(`Export format '${format}' not supported`);
        }
        return await this.metricsCollector.exportMetrics(agentName, format, timeframe);
    }
    async generatePerformanceReport(agentName, days = 7) {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.dashboard.getPerformanceReport(agentName, days);
    }
    async createDashboard(layout) {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.dashboard.createDashboardLayout(layout);
    }
    async getDashboards() {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        return await this.dashboard.getDashboardLayouts();
    }
    // WebSocket/SSE support for real-time dashboard updates
    registerDashboardConnection(connectionId) {
        if (!this.isInitialized) {
            throw new Error('Monitoring service not initialized');
        }
        this.dashboard.registerConnection(connectionId);
    }
    unregisterDashboardConnection(connectionId) {
        if (this.isInitialized) {
            this.dashboard.unregisterConnection(connectionId);
        }
    }
    // Event subscription for external systems
    onMetricsUpdate(callback) {
        this.on('metrics_update', callback);
    }
    onAlertTriggered(callback) {
        this.on('alert_triggered', callback);
    }
    onSystemHealthChange(callback) {
        this.on('system_health_change', callback);
    }
    async checkComponentHealth(component) {
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
        }
        catch (error) {
            this.logger.warn(`Health check failed for component: ${component}`, { error });
            return false;
        }
    }
    setupEventHandlers() {
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
            }
            catch (error) {
                this.logger.error('Failed to check system health', { error });
            }
        });
    }
    startHealthMonitoring() {
        // Check service health every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            try {
                const status = await this.getServiceStatus();
                if (status.status !== 'healthy') {
                    this.logger.warn('Service health degraded', { status });
                    this.emit('service_health_change', status);
                }
                // Store health status in Redis for external monitoring
                await enhanced_cache_1.redisCache.set('monitoring_service_health', JSON.stringify(status), 300);
            }
            catch (error) {
                this.logger.error('Health monitoring check failed', { error });
            }
        }, 300000); // 5 minutes
    }
    async createDefaultAlertRules(agentName) {
        const defaultRules = [
            {
                agentName,
                metricName: 'performance.errorRate',
                threshold: 0.05,
                operator: '>',
                severity: 'high',
                enabled: true,
                cooldownMinutes: 10
            },
            {
                agentName,
                metricName: 'performance.responseTime',
                threshold: 1000,
                operator: '>',
                severity: 'medium',
                enabled: true,
                cooldownMinutes: 15
            },
            {
                agentName,
                metricName: 'health.score',
                threshold: 70,
                operator: '<',
                severity: 'high',
                enabled: true,
                cooldownMinutes: 5
            }
        ];
        for (const rule of defaultRules) {
            try {
                await this.metricsCollector.createAlertRule(rule);
            }
            catch (error) {
                this.logger.error('Failed to create default alert rule', { agentName, rule, error });
            }
        }
    }
    setupCleanupHandlers() {
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
    async cleanup() {
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
        }
        catch (error) {
            this.logger.error('Error during cleanup', { error });
            throw error;
        }
    }
    // Static factory method for easy instantiation
    static async create(logger, config) {
        const service = new AgentMonitoringService(logger, config);
        await service.initialize();
        return service;
    }
    // Getter methods for accessing components (for advanced use cases)
    get metrics() {
        return this.metricsCollector;
    }
    get dashboardService() {
        return this.dashboard;
    }
    get integrationService() {
        return this.integration;
    }
    get configuration() {
        return { ...this.config };
    }
    get initialized() {
        return this.isInitialized;
    }
}
exports.AgentMonitoringService = AgentMonitoringService;
