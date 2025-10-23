"use strict";
/**
 * Agent Monitoring System
 *
 * Comprehensive monitoring solution for Unit Talk's intelligent agent platform.
 * Provides real-time metrics collection, alerting, and dashboard capabilities.
 *
 * @version 1.0.0
 * @author Unit Talk Engineering Team
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MONITORING_CONFIG = exports.AgentMonitoringService = exports.AgentMonitoringIntegration = exports.AgentMonitoringDashboard = exports.AgentMetricsCollector = void 0;
exports.createMonitoringService = createMonitoringService;
// Core monitoring components
var AgentMetricsCollector_1 = require("./AgentMetricsCollector");
Object.defineProperty(exports, "AgentMetricsCollector", { enumerable: true, get: function () { return AgentMetricsCollector_1.AgentMetricsCollector; } });
var AgentMonitoringDashboard_1 = require("./AgentMonitoringDashboard");
Object.defineProperty(exports, "AgentMonitoringDashboard", { enumerable: true, get: function () { return AgentMonitoringDashboard_1.AgentMonitoringDashboard; } });
var AgentMonitoringIntegration_1 = require("./AgentMonitoringIntegration");
Object.defineProperty(exports, "AgentMonitoringIntegration", { enumerable: true, get: function () { return AgentMonitoringIntegration_1.AgentMonitoringIntegration; } });
var AgentMonitoringService_1 = require("./AgentMonitoringService");
Object.defineProperty(exports, "AgentMonitoringService", { enumerable: true, get: function () { return AgentMonitoringService_1.AgentMonitoringService; } });
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
// Default configuration
exports.DEFAULT_MONITORING_CONFIG = {
    enabled: true,
    metricsCollectionInterval: 60000, // 1 minute
    dashboardUpdateInterval: 30000, // 30 seconds
    alertingEnabled: true,
    exportFormats: ['json', 'csv', 'prometheus'],
    retentionPeriod: 30 // 30 days
};
// Helper function for quick setup
async function createMonitoringService(logger, config) {
    const { AgentMonitoringService } = await Promise.resolve().then(() => __importStar(require('./AgentMonitoringService')));
    const finalConfig = { ...exports.DEFAULT_MONITORING_CONFIG, ...config };
    return new AgentMonitoringService(logger, finalConfig); // Using constructor instead of create method
}
