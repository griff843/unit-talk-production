/**
 * Agent Monitoring System
 *
 * Comprehensive monitoring solution for Unit Talk's intelligent agent platform.
 * Provides real-time metrics collection, alerting, and dashboard capabilities.
 *
 * @version 1.0.0
 * @author Unit Talk Engineering Team
 */
export { AgentMetricsCollector } from './AgentMetricsCollector';
export { AgentMonitoringDashboard } from './AgentMonitoringDashboard';
export { AgentMonitoringIntegration } from './AgentMonitoringIntegration';
export { AgentMonitoringService } from './AgentMonitoringService';
export interface MonitoringConfig {
    enabled: boolean;
    metricsCollectionInterval: number;
    dashboardUpdateInterval: number;
    alertingEnabled: boolean;
    exportFormats: string[];
    retentionPeriod: number;
}
export interface AgentMetrics {
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
export interface AlertRule {
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
export interface DashboardWidget {
    id: string;
    type: 'chart' | 'gauge' | 'table' | 'alert' | 'status';
    title: string;
    agentName?: string;
    metricName?: string;
    config: Record<string, any>;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/**
 * Quick Setup Guide
 * ================
 *
 * 1. Basic Setup:
 * ```typescript
 * import { AgentMonitoringService } from './src/monitoring';
 * import { logger } from './src/shared/logger';
 *
 * const monitoringService = await AgentMonitoringService.create(logger, {
 *   enabled: true,
 *   metricsCollectionInterval: 60000,
 *   alertingEnabled: true
 * });
 * ```
 *
 * 2. Register Agents:
 * ```typescript
 * const onboardingAgent = new AutomatedOnboardingAgent(config, deps);
 * await onboardingAgent.initialize();
 * await monitoringService.registerAgent(onboardingAgent);
 * ```
 *
 * 3. Access Metrics:
 * ```typescript
 * // Get system overview
 * const overview = await monitoringService.getSystemOverview();
 *
 * // Get agent-specific metrics
 * const metrics = await monitoringService.getAgentMetrics('AutomatedOnboardingAgent', 'last_hour');
 *
 * // Get alert summary
 * const alerts = await monitoringService.getAlertSummary();
 * ```
 *
 * 4. Create Custom Alerts:
 * ```typescript
 * await monitoringService.createAlertRule({
 *   agentName: 'UserRetentionAgent',
 *   metricName: 'performance.responseTime',
 *   threshold: 500,
 *   operator: '>',
 *   severity: 'medium',
 *   enabled: true,
 *   cooldownMinutes: 10
 * });
 * ```
 *
 * 5. Export Metrics:
 * ```typescript
 * // Export as JSON
 * const jsonData = await monitoringService.exportMetrics('RiskManagementAgent', 'json', 'last_day');
 *
 * // Export as Prometheus format
 * const prometheusData = await monitoringService.exportMetrics('PredictiveAnalyticsAgent', 'prometheus', 'last_hour');
 * ```
 *
 * 6. Real-time Updates:
 * ```typescript
 * // Listen for metrics updates
 * monitoringService.onMetricsUpdate((metrics) => {
 *   console.log('New metrics:', metrics);
 * });
 *
 * // Listen for alerts
 * monitoringService.onAlertTriggered((alert) => {
 *   console.log('Alert triggered:', alert);
 * });
 * ```
 *
 * Features:
 * ========
 *
 * ✅ Real-time metrics collection for all 5 intelligent agents
 * ✅ Comprehensive dashboard with customizable widgets
 * ✅ Intelligent alerting with configurable thresholds
 * ✅ Performance benchmarking and trend analysis
 * ✅ Multi-format data export (JSON, CSV, Prometheus)
 * ✅ Circuit breaker pattern monitoring
 * ✅ Cache performance tracking
 * ✅ Business metrics and KPI monitoring
 * ✅ Health check automation with dependency tracking
 * ✅ Cross-agent integration and correlation analysis
 *
 * Supported Agents:
 * ================
 *
 * 1. AutomatedOnboardingAgent - User behavior tracking and conversation generation
 * 2. UserRetentionAgent - Churn prediction and retention strategy optimization
 * 3. RiskManagementAgent - Portfolio optimization and risk assessment
 * 4. PredictiveAnalyticsAgent - Market forecasting and ML model management
 * 5. PerformanceOptimizationAgent - System monitoring and bottleneck detection
 *
 * Metrics Categories:
 * ==================
 *
 * Performance Metrics:
 * - CPU and memory usage
 * - Response time and throughput
 * - Error rate and success rate
 *
 * Business Metrics:
 * - Operations completed
 * - Users processed
 * - Predictions generated
 * - Optimizations applied
 *
 * Health Metrics:
 * - Agent status and health professional_score
 * - Dependency health tracking
 * - Last health check timestamp
 *
 * Cache Metrics:
 * - Hit rate and miss rate
 * - Operation count
 * - Average latency
 *
 * Circuit Breaker Metrics:
 * - State (closed/open/half-open)
 * - Failure and success counts
 * - Last failure timestamp
 *
 * Integration:
 * ===========
 *
 * The monitoring system integrates seamlessly with:
 * - Unit Talk's BaseAgent framework
 * - Redis caching layer
 * - Temporal.io workflows
 * - Prometheus/Grafana stack
 * - Discord notification system
 * - Supabase database
 *
 * For advanced configuration and custom implementations,
 * refer to the individual component documentation.
 */
export declare const DEFAULT_MONITORING_CONFIG: MonitoringConfig;
export declare function createMonitoringService(logger: any, config?: Partial<MonitoringConfig>): Promise<import("./AgentMonitoringService").AgentMonitoringService>;
//# sourceMappingURL=index.d.ts.map