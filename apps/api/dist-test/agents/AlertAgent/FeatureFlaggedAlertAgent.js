"use strict";
/**
 * Feature-Flagged Alert Agent
 *
 * Orchestrates between Event-Driven and Polling Alert modes
 * with comprehensive A/B testing, performance monitoring, and automatic rollback
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
exports.FeatureFlaggedAlertAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const EventDrivenProcessor_1 = require("./EventDrivenProcessor");
const FeatureFlagService_1 = require("../../services/feature-flags/FeatureFlagService");
const ABTestingEngine_1 = require("../../services/feature-flags/ABTestingEngine");
const logger_1 = require("../../utils/logger");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
class FeatureFlaggedAlertAgent extends BaseAgent_1.BaseAgent {
    constructor(supabase) {
        super(supabase, 'feature-flagged-alert-agent');
        this.logger = (0, logger_1.createLogger)('FeatureFlaggedAlertAgent');
        // Performance tracking
        this.performanceMetrics = {
            totalAlerts: 0,
            pollingAlerts: 0,
            eventDrivenAlerts: 0,
            avgPollingLatency: 0,
            avgEventDrivenLatency: 0,
            errorRate: 0,
            lastReset: Date.now()
        };
        // Processing state
        this.isProcessing = false;
        this.featureFlagService = new FeatureFlagService_1.FeatureFlagService(supabase);
        this.abTestingEngine = new ABTestingEngine_1.ABTestingEngine(supabase, this.featureFlagService);
        // Initialize processors
        this.initializeProcessors();
        // Start performance monitoring
        this.startPerformanceMonitoring();
    }
    /**
     * Process alerts using feature-flagged approach
     */
    async processAlerts(context = {}) {
        const startTime = Date.now();
        const alertId = `alert-${Date.now()}`;
        try {
            // Evaluate feature flag
            const flagEvaluation = await this.featureFlagService.evaluateFlag('event_driven_alert_agent', {
                userId: context.userId,
                userSegment: context.metadata?.userSegment,
                environment: process.env.NODE_ENV,
                metadata: context.metadata
            });
            this.logger.debug('Feature flag evaluated for alert processing', {
                alertId,
                enabled: flagEvaluation.enabled,
                variant: flagEvaluation.variant,
                abTestGroup: flagEvaluation.abTestGroup,
                userId: context.userId
            });
            // Always run polling mode for comparison baseline
            const pollingStartTime = Date.now();
            const pollingResult = await this.runPollingMode(context.batchSize);
            const pollingLatency = Date.now() - pollingStartTime;
            let eventDrivenResult;
            let eventDrivenLatency;
            let selectedResult;
            let selectionReason;
            let latencyDelta;
            // Run event-driven mode if flag is enabled
            if (flagEvaluation.enabled && this.eventDrivenProcessor) {
                const eventDrivenStartTime = Date.now();
                try {
                    eventDrivenResult = await this.runEventDrivenMode();
                    eventDrivenLatency = Date.now() - eventDrivenStartTime;
                    // Calculate performance delta
                    latencyDelta = eventDrivenLatency - pollingLatency;
                    // Determine which result to use
                    const selectionStrategy = await this.determineSelectionStrategy(flagEvaluation);
                    if (selectionStrategy === 'event_driven') {
                        selectedResult = eventDrivenResult;
                        selectionReason = 'Event-driven processor selected via feature flag';
                    }
                    else if (selectionStrategy === 'polling') {
                        selectedResult = pollingResult;
                        selectionReason = 'Polling processor selected for comparison baseline';
                    }
                    else {
                        // Performance-based selection
                        selectedResult = latencyDelta <= 500 ? eventDrivenResult : pollingResult; // 500ms threshold
                        selectionReason = `Performance-based selection: ${selectionStrategy}`;
                    }
                }
                catch (error) {
                    this.logger.error('Event-driven processing failed, falling back to polling', {
                        alertId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    selectedResult = pollingResult;
                    selectionReason = 'Event-driven system failed, polling fallback';
                    latencyDelta = 0;
                    // Track A/B test error event
                    await this.abTestingEngine.trackEvent({
                        flagName: 'event_driven_alert_agent',
                        variant: 'treatment',
                        userId: context.userId || 'anonymous',
                        eventType: 'error',
                        errorOccurred: true,
                        errorDetails: error instanceof Error ? error.message : String(error),
                        sessionId: context.sessionId,
                        latencyMs: Date.now() - eventDrivenStartTime
                    });
                }
            }
            else {
                // Flag disabled - use polling only
                selectedResult = pollingResult;
                selectionReason = 'Feature flag disabled - polling mode only';
                latencyDelta = 0;
            }
            // Create comparison result
            const comparisonResult = {
                alertId,
                userId: context.userId,
                // Flag evaluation
                flagEnabled: flagEvaluation.enabled,
                variant: flagEvaluation.variant || 'control',
                abTestGroup: flagEvaluation.abTestGroup,
                // Polling results
                pollingResult,
                pollingLatency,
                // Event-driven results
                eventDrivenResult,
                eventDrivenLatency,
                // Performance comparison
                latencyDelta,
                accuracyComparison: this.calculateAccuracyComparison(pollingResult, eventDrivenResult),
                // Final decision
                selectedResult,
                selectionReason,
                // Metadata
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development'
            };
            // Track A/B testing events
            await this.trackABTestingEvents(comparisonResult, context);
            // Update performance metrics
            this.updatePerformanceMetrics(comparisonResult);
            // Store comparison result for analysis
            await this.storeComparisonResult(comparisonResult);
            const totalProcessingTime = Date.now() - startTime;
            this.logger.info('Feature-flagged alert processing completed', {
                alertId,
                flagEnabled: flagEvaluation.enabled,
                variant: comparisonResult.variant,
                selectedMode: selectedResult === eventDrivenResult ? 'event_driven' : 'polling',
                totalProcessingTimeMs: totalProcessingTime,
                alertsGenerated: selectedResult.alertsGenerated,
                latencyDelta
            });
            return comparisonResult;
        }
        catch (error) {
            this.logger.error('Feature-flagged alert processing failed', {
                alertId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Emergency fallback to polling mode
            const pollingResult = await this.runPollingMode(context.batchSize);
            return {
                alertId,
                userId: context.userId,
                flagEnabled: false,
                variant: 'control',
                pollingResult,
                pollingLatency: Date.now() - startTime,
                latencyDelta: 0,
                selectedResult: pollingResult,
                selectionReason: 'Emergency fallback due to system error',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development'
            };
        }
    }
    /**
     * Run polling mode alert processing
     */
    async runPollingMode(batchSize = 50) {
        const startTime = Date.now();
        try {
            if (!this.pollingProcessor) {
                await this.initializePollingProcessor();
            }
            const result = await this.pollingProcessor.processAlerts(batchSize);
            this.logger.debug('Polling mode processing completed', {
                alertsProcessed: result.alertsProcessed,
                alertsGenerated: result.alertsGenerated,
                latency: result.averageLatency
            });
            return result;
        }
        catch (error) {
            this.logger.error('Polling mode processing failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Return empty result
            return {
                alertsProcessed: 0,
                alertsGenerated: 0,
                averageLatency: Date.now() - startTime,
                errorCount: 1,
                processingTimeMs: Date.now() - startTime,
                alerts: []
            };
        }
    }
    /**
     * Run event-driven mode alert processing
     */
    async runEventDrivenMode() {
        const startTime = Date.now();
        try {
            if (!this.eventDrivenProcessor) {
                throw new Error('Event-driven processor not initialized');
            }
            const metrics = this.eventDrivenProcessor.getMetrics();
            // Convert event-driven metrics to AlertProcessingResult format
            const result = {
                alertsProcessed: metrics.totalEventsProcessed,
                alertsGenerated: metrics.alertsGenerated,
                averageLatency: metrics.averageLatencyMs,
                errorCount: Math.round(metrics.errorRate * metrics.totalEventsProcessed),
                processingTimeMs: Date.now() - startTime,
                alerts: [] // Alerts are processed in real-time, not batched
            };
            this.logger.debug('Event-driven mode processing completed', {
                eventsProcessed: result.alertsProcessed,
                alertsGenerated: result.alertsGenerated,
                averageLatency: result.averageLatency
            });
            return result;
        }
        catch (error) {
            this.logger.error('Event-driven mode processing failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Return empty result
            return {
                alertsProcessed: 0,
                alertsGenerated: 0,
                averageLatency: Date.now() - startTime,
                errorCount: 1,
                processingTimeMs: Date.now() - startTime,
                alerts: []
            };
        }
    }
    /**
     * Determine which system to use based on A/B test assignment
     */
    async determineSelectionStrategy(flagEvaluation) {
        if (!flagEvaluation.abTestGroup) {
            return 'event_driven'; // Default to event-driven if no A/B test
        }
        // A/B test logic
        if (flagEvaluation.variant === 'control') {
            return 'polling';
        }
        else if (flagEvaluation.variant === 'treatment') {
            return 'event_driven';
        }
        return 'event_driven';
    }
    /**
     * Calculate accuracy comparison between systems
     */
    calculateAccuracyComparison(pollingResult, eventDrivenResult) {
        if (!eventDrivenResult)
            return undefined;
        // Compare alert generation rates as a proxy for accuracy
        const pollingRate = pollingResult.alertsGenerated / (pollingResult.alertsProcessed || 1);
        const eventDrivenRate = eventDrivenResult.alertsGenerated / (eventDrivenResult.alertsProcessed || 1);
        if (pollingRate === 0)
            return eventDrivenRate > 0 ? 100 : 0;
        return ((eventDrivenRate - pollingRate) / pollingRate) * 100;
    }
    /**
     * Track A/B testing events for both systems
     */
    async trackABTestingEvents(result, context) {
        try {
            // Track control group (polling) event
            await this.abTestingEngine.trackEvent({
                flagName: 'event_driven_alert_agent',
                variant: 'control',
                userId: context.userId || 'anonymous',
                eventType: 'performance',
                eventValue: result.pollingResult?.alertsGenerated || 0,
                latencyMs: result.pollingLatency,
                sessionId: context.sessionId,
                metadata: {
                    alertsProcessed: result.pollingResult?.alertsProcessed,
                    averageLatency: result.pollingResult?.averageLatency,
                    errorCount: result.pollingResult?.errorCount
                }
            });
            // Track treatment group (event-driven) event if available
            if (result.eventDrivenResult && result.eventDrivenLatency) {
                await this.abTestingEngine.trackEvent({
                    flagName: 'event_driven_alert_agent',
                    variant: 'treatment',
                    userId: context.userId || 'anonymous',
                    eventType: 'performance',
                    eventValue: result.eventDrivenResult.alertsGenerated,
                    latencyMs: result.eventDrivenLatency,
                    sessionId: context.sessionId,
                    metadata: {
                        alertsProcessed: result.eventDrivenResult.alertsProcessed,
                        averageLatency: result.eventDrivenResult.averageLatency,
                        errorCount: result.eventDrivenResult.errorCount
                    }
                });
            }
            // Track conversion event (successful alert processing)
            await this.abTestingEngine.trackEvent({
                flagName: 'event_driven_alert_agent',
                variant: result.variant,
                userId: context.userId || 'anonymous',
                eventType: 'conversion',
                eventValue: 1,
                sessionId: context.sessionId
            });
        }
        catch (error) {
            this.logger.error('Failed to track A/B testing events', {
                alertId: result.alertId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Update internal performance metrics
     */
    updatePerformanceMetrics(result) {
        this.performanceMetrics.totalAlerts++;
        this.performanceMetrics.pollingAlerts++;
        if (result.eventDrivenResult) {
            this.performanceMetrics.eventDrivenAlerts++;
        }
        // Update latency averages
        const total = this.performanceMetrics.totalAlerts;
        this.performanceMetrics.avgPollingLatency =
            (this.performanceMetrics.avgPollingLatency * (total - 1) + (result.pollingLatency || 0)) / total;
        if (result.eventDrivenLatency) {
            const eventDrivenTotal = this.performanceMetrics.eventDrivenAlerts;
            this.performanceMetrics.avgEventDrivenLatency =
                (this.performanceMetrics.avgEventDrivenLatency * (eventDrivenTotal - 1) + result.eventDrivenLatency) / eventDrivenTotal;
        }
    }
    /**
     * Store comparison result for analysis
     */
    async storeComparisonResult(result) {
        try {
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                await this.supabase
                    .from('alert_comparisons')
                    .insert({
                    alert_id: result.alertId,
                    user_id: result.userId,
                    flag_enabled: result.flagEnabled,
                    variant: result.variant,
                    ab_test_group: result.abTestGroup,
                    polling_result: result.pollingResult,
                    event_driven_result: result.eventDrivenResult,
                    polling_latency: result.pollingLatency,
                    event_driven_latency: result.eventDrivenLatency,
                    latency_delta: result.latencyDelta,
                    accuracy_comparison: result.accuracyComparison,
                    selected_mode: result.selectedResult === result.eventDrivenResult ? 'event_driven' : 'polling',
                    selection_reason: result.selectionReason,
                    environment: result.environment
                });
            }, async () => {
                this.logger.warn('Circuit breaker open, caching comparison result locally');
            });
        }
        catch (error) {
            this.logger.error('Failed to store comparison result', {
                alertId: result.alertId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Initialize processors based on feature flags
     */
    async initializeProcessors() {
        try {
            // Always initialize polling processor as baseline
            await this.initializePollingProcessor();
            // Initialize event-driven processor if dependencies are met
            const hotWarmColdFlag = await this.featureFlagService.evaluateFlag('hot_warm_cold_pipeline');
            if (hotWarmColdFlag.enabled) {
                await this.initializeEventDrivenProcessor();
                this.logger.info('✅ Event-driven processor initialized');
            }
            else {
                this.logger.info('ℹ️ Event-driven processor not initialized - dependencies not met');
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize processors', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Initialize polling processor
     */
    async initializePollingProcessor() {
        this.pollingProcessor = new (class {
            constructor(supabase, logger) {
                this.metrics = {
                    totalAlertsProcessed: 0,
                    averageLatencyMs: 0,
                    errorRate: 0,
                    throughputPerSecond: 0,
                    lastPollingTime: new Date().toISOString()
                };
                this.supabase = supabase;
                this.logger = logger;
            }
            async initialize() {
                this.logger.info('Polling processor initialized');
            }
            async processAlerts(batchSize = 50) {
                const startTime = Date.now();
                const alerts = [];
                try {
                    // Simulate polling-based alert processing
                    const { data: recentProps, error } = await this.supabase
                        .from('raw_props')
                        .select('*')
                        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
                        .limit(batchSize);
                    if (error || !recentProps) {
                        throw new Error(`Failed to fetch props: ${error?.message}`);
                    }
                    // Process each prop for alerts
                    for (const prop of recentProps) {
                        const alert = this.processIndividualProp(prop);
                        if (alert) {
                            alerts.push(alert);
                        }
                    }
                    const processingTime = Date.now() - startTime;
                    // Update metrics
                    this.metrics.totalAlertsProcessed += recentProps.length;
                    this.metrics.averageLatencyMs = (this.metrics.averageLatencyMs + processingTime) / 2;
                    this.metrics.lastPollingTime = new Date().toISOString();
                    return {
                        alertsProcessed: recentProps.length,
                        alertsGenerated: alerts.length,
                        averageLatency: processingTime,
                        errorCount: 0,
                        processingTimeMs: processingTime,
                        alerts
                    };
                }
                catch (error) {
                    const processingTime = Date.now() - startTime;
                    this.metrics.errorRate = (this.metrics.errorRate + 1) / 2;
                    return {
                        alertsProcessed: 0,
                        alertsGenerated: 0,
                        averageLatency: processingTime,
                        errorCount: 1,
                        processingTimeMs: processingTime,
                        alerts: []
                    };
                }
            }
            processIndividualProp(prop) {
                // Simple alert logic for demonstration
                if (Math.abs(prop.line_movement || 0) > 0.5) {
                    return {
                        type: 'line_movement',
                        priority: 'medium',
                        confidence: 0.7,
                        player_name: prop.player_name || 'Unknown',
                        stat_type: prop.stat_type || 'Unknown',
                        trigger_data: {
                            line_movement: prop.line_movement,
                            current_line: prop.line
                        },
                        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
                    };
                }
                return null;
            }
            getMetrics() {
                return { ...this.metrics };
            }
            async cleanup() {
                this.logger.info('Polling processor cleaned up');
            }
        })(this.supabase, this.logger);
        await this.pollingProcessor.initialize();
    }
    /**
     * Initialize event-driven processor
     */
    async initializeEventDrivenProcessor() {
        const { TicketStateManager } = await Promise.resolve().then(() => __importStar(require('./TicketStateManager')));
        const ticketStateManager = new TicketStateManager(this.supabase, this.logger);
        this.eventDrivenProcessor = new EventDrivenProcessor_1.EventDrivenProcessor(this.supabase, this.logger, ticketStateManager);
        await this.eventDrivenProcessor.initialize();
    }
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Emit performance metrics every 60 seconds
        setInterval(async () => {
            await this.emitPerformanceMetrics();
        }, 60000);
        // Reset metrics every hour
        setInterval(() => {
            this.resetPerformanceMetrics();
        }, 60 * 60 * 1000);
    }
    /**
     * Emit performance metrics for monitoring
     */
    async emitPerformanceMetrics() {
        try {
            const metrics = {
                ...this.performanceMetrics,
                eventDrivenAdoptionRate: this.performanceMetrics.eventDrivenAlerts / this.performanceMetrics.totalAlerts,
                performanceRatio: this.performanceMetrics.avgEventDrivenLatency / this.performanceMetrics.avgPollingLatency,
                timestamp: new Date().toISOString()
            };
            await this.supabase
                .from('events')
                .insert({
                event_type: 'alert.performance.metrics.v1',
                aggregate_id: 'feature-flagged-alert-agent',
                aggregate_type: 'alert_agent',
                event_data: metrics,
                idempotency_key: `alert-metrics-${Date.now()}`,
                metadata: {
                    source: 'FeatureFlaggedAlertAgent',
                    component: 'performance_monitoring'
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to emit performance metrics', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Reset performance metrics
     */
    resetPerformanceMetrics() {
        this.performanceMetrics = {
            totalAlerts: 0,
            pollingAlerts: 0,
            eventDrivenAlerts: 0,
            avgPollingLatency: 0,
            avgEventDrivenLatency: 0,
            errorRate: 0,
            lastReset: Date.now()
        };
    }
    /**
     * Start continuous alert processing
     */
    async startContinuousProcessing(intervalMs = 30000) {
        if (this.isProcessing) {
            this.logger.warn('Alert processing already running');
            return;
        }
        this.isProcessing = true;
        this.pollingInterval = setInterval(async () => {
            try {
                await this.processAlerts({
                    batchSize: 50,
                    metadata: { continuous: true }
                });
            }
            catch (error) {
                this.logger.error('Continuous alert processing failed', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }, intervalMs);
        this.logger.info('Continuous alert processing started', { intervalMs });
    }
    /**
     * Stop continuous alert processing
     */
    async stopContinuousProcessing() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
        this.isProcessing = false;
        this.logger.info('Continuous alert processing stopped');
    }
    /**
     * Get agent health status
     */
    getHealthStatus() {
        return {
            healthy: true,
            metrics: this.performanceMetrics,
            eventDrivenProcessorReady: !!this.eventDrivenProcessor,
            pollingProcessorReady: !!this.pollingProcessor,
            continuousProcessing: this.isProcessing
        };
    }
    /**
     * Get A/B test analysis for the alert system
     */
    async getABTestAnalysis() {
        return await this.abTestingEngine.analyzeTest('event_driven_alert_agent');
    }
    /**
     * Generate comprehensive alert system report
     */
    async generateSystemReport() {
        return await this.abTestingEngine.generateTestReport('event_driven_alert_agent');
    }
    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        await this.stopContinuousProcessing();
        if (this.eventDrivenProcessor) {
            await this.eventDrivenProcessor.cleanup();
        }
        if (this.pollingProcessor) {
            await this.pollingProcessor.cleanup();
        }
        this.logger.info('Feature-flagged alert agent cleaned up');
    }
}
exports.FeatureFlaggedAlertAgent = FeatureFlaggedAlertAgent;
