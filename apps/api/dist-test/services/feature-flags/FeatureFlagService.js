"use strict";
/**
 * Feature Flag Service for Syndicate-Grade Unit Talk System Upgrade
 *
 * Comprehensive feature flag system with:
 * - Environment-based configuration
 * - Gradual rollout percentages (5% → 25% → 50% → 75% → 100%)
 * - A/B testing capabilities
 * - Emergency rollback switches
 * - Real-time performance monitoring
 * - Zero-downtime deployment support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
const logger_1 = require("../../utils/logger");
const enhanced_circuit_breaker_1 = require("../enhanced-circuit-breaker");
class FeatureFlagService {
    constructor(supabase) {
        this.logger = (0, logger_1.createLogger)('FeatureFlagService');
        this.flagConfigs = new Map();
        this.metricsBuffer = new Map();
        // Performance monitoring
        this.evaluationCache = new Map();
        this.cacheHitRate = 0;
        this.totalEvaluations = 0;
        this.cacheHits = 0;
        this.supabase = supabase;
        this.initializeDefaultFlags();
        this.startMetricsCollection();
    }
    /**
     * Initialize default feature flags for syndicate-grade upgrade
     */
    initializeDefaultFlags() {
        const defaultFlags = [
            {
                flagName: 'enhanced_45_factor_grading',
                enabled: false,
                rolloutPercentage: 0,
                environment: process.env.NODE_ENV || 'development',
                emergencyKillSwitch: false,
                validationGates: [
                    { metric: 'processing_latency_p99', threshold: 50, operator: 'lt', required: true },
                    { metric: 'accuracy_rate', threshold: 0.95, operator: 'gte', required: true },
                    { metric: 'error_rate', threshold: 0.01, operator: 'lt', required: true }
                ],
                dependencies: ['feature_store_integration'],
                abTestGroups: [
                    { name: 'legacy_grading', percentage: 50, variant: 'control', config: { engine: 'legacy' } },
                    { name: 'enhanced_45_factor', percentage: 50, variant: 'treatment', config: { engine: 'enhanced_45_factor' } }
                ],
                metadata: {
                    description: 'Enhanced 45-factor scoring engine vs legacy system',
                    owner: 'grading-team',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            },
            {
                flagName: 'event_driven_alert_agent',
                enabled: false,
                rolloutPercentage: 0,
                environment: process.env.NODE_ENV || 'development',
                emergencyKillSwitch: false,
                validationGates: [
                    { metric: 'alert_latency_p99', threshold: 1000, operator: 'lt', required: true },
                    { metric: 'alert_accuracy', threshold: 0.98, operator: 'gte', required: true },
                    { metric: 'false_positive_rate', threshold: 0.05, operator: 'lt', required: true }
                ],
                dependencies: ['hot_warm_cold_pipeline'],
                abTestGroups: [
                    { name: 'polling_mode', percentage: 50, variant: 'control', config: { mode: 'polling' } },
                    { name: 'event_driven', percentage: 50, variant: 'treatment', config: { mode: 'event_driven' } }
                ],
                metadata: {
                    description: 'Event-driven AlertAgent vs polling mode',
                    owner: 'alert-team',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            },
            {
                flagName: 'hot_warm_cold_pipeline',
                enabled: false,
                rolloutPercentage: 0,
                environment: process.env.NODE_ENV || 'development',
                emergencyKillSwitch: false,
                validationGates: [
                    { metric: 'data_ingestion_latency', threshold: 100, operator: 'lt', required: true },
                    { metric: 'data_consistency_rate', threshold: 0.999, operator: 'gte', required: true },
                    { metric: 'storage_efficiency', threshold: 0.8, operator: 'gte', required: true }
                ],
                dependencies: [],
                metadata: {
                    description: 'HOT/WARM/COLD data architecture vs raw_props only',
                    owner: 'data-team',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            },
            {
                flagName: 'feature_store_integration',
                enabled: false,
                rolloutPercentage: 0,
                environment: process.env.NODE_ENV || 'development',
                emergencyKillSwitch: false,
                validationGates: [
                    { metric: 'feature_retrieval_latency', threshold: 50, operator: 'lt', required: true },
                    { metric: 'feature_freshness', threshold: 0.95, operator: 'gte', required: true },
                    { metric: 'cache_hit_rate', threshold: 0.9, operator: 'gte', required: true }
                ],
                dependencies: ['hot_warm_cold_pipeline'],
                abTestGroups: [
                    { name: 'realtime_computation', percentage: 50, variant: 'control', config: { mode: 'realtime' } },
                    { name: 'feature_store', percentage: 50, variant: 'treatment', config: { mode: 'feature_store' } }
                ],
                metadata: {
                    description: 'Feature store integration vs real-time computation',
                    owner: 'ml-team',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            },
            {
                flagName: 'slo_monitoring_system',
                enabled: false,
                rolloutPercentage: 0,
                environment: process.env.NODE_ENV || 'development',
                emergencyKillSwitch: false,
                validationGates: [
                    { metric: 'monitoring_latency', threshold: 500, operator: 'lt', required: true },
                    { metric: 'alert_delivery_rate', threshold: 0.99, operator: 'gte', required: true },
                    { metric: 'false_alert_rate', threshold: 0.02, operator: 'lt', required: true }
                ],
                dependencies: [],
                metadata: {
                    description: 'Advanced SLO monitoring and alerting system',
                    owner: 'infrastructure-team',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            }
        ];
        for (const flag of defaultFlags) {
            this.flagConfigs.set(flag.flagName, flag);
        }
        this.logger.info('✅ Default feature flags initialized', {
            totalFlags: defaultFlags.length,
            environment: process.env.NODE_ENV
        });
    }
    /**
     * Evaluate feature flag for a given context
     */
    async evaluateFlag(flagName, context = {}) {
        const startTime = Date.now();
        this.totalEvaluations++;
        try {
            // Check cache first
            const cacheKey = this.getCacheKey(flagName, context);
            const cached = this.evaluationCache.get(cacheKey);
            if (cached && cached.expiry > Date.now()) {
                this.cacheHits++;
                this.cacheHitRate = this.cacheHits / this.totalEvaluations;
                return cached.result;
            }
            // Get flag configuration
            const flagConfig = await this.getFlagConfig(flagName);
            if (!flagConfig) {
                return this.createDefaultEvaluation(flagName, false);
            }
            // Check emergency kill switch
            if (flagConfig.emergencyKillSwitch) {
                this.logger.warn('⚠️ Emergency kill switch activated', { flagName });
                return this.createDefaultEvaluation(flagName, false);
            }
            // Check environment
            const environment = context.environment || process.env.NODE_ENV || 'development';
            if (flagConfig.environment !== environment) {
                return this.createDefaultEvaluation(flagName, false);
            }
            // Check dependencies
            if (flagConfig.dependencies && flagConfig.dependencies.length > 0) {
                const dependencyResults = await Promise.all(flagConfig.dependencies.map(dep => this.evaluateFlag(dep, context)));
                if (dependencyResults.some(result => !result.enabled)) {
                    this.logger.debug('❌ Flag disabled due to dependency', {
                        flagName,
                        dependencies: flagConfig.dependencies
                    });
                    return this.createDefaultEvaluation(flagName, false);
                }
            }
            // Evaluate rollout percentage
            const rolloutBucket = this.calculateRolloutBucket(context.userId || 'anonymous', flagName);
            const inRollout = rolloutBucket < flagConfig.rolloutPercentage;
            if (!inRollout) {
                return this.createDefaultEvaluation(flagName, false, rolloutBucket);
            }
            // Check user segments
            const segmentMatch = this.checkSegmentMatch(flagConfig, context.userSegment);
            if (!segmentMatch) {
                return this.createDefaultEvaluation(flagName, false, rolloutBucket);
            }
            // A/B test assignment
            let abTestGroup;
            let variant;
            if (flagConfig.abTestGroups && flagConfig.abTestGroups.length > 0) {
                const assignment = this.assignABTestGroup(flagConfig.abTestGroups, context.userId || 'anonymous', flagName);
                abTestGroup = assignment.name;
                variant = assignment.variant;
            }
            const evaluation = {
                flagName,
                enabled: flagConfig.enabled && inRollout,
                variant,
                userId: context.userId,
                segmentMatch,
                rolloutBucket,
                evaluationTime: new Date().toISOString(),
                abTestGroup
            };
            // Cache the result
            this.evaluationCache.set(cacheKey, {
                result: evaluation,
                expiry: Date.now() + (5 * 60 * 1000) // 5 minutes
            });
            // Log evaluation metrics
            const evaluationTime = Date.now() - startTime;
            this.logger.debug('🎯 Feature flag evaluated', {
                flagName,
                enabled: evaluation.enabled,
                rolloutBucket,
                abTestGroup,
                evaluationTimeMs: evaluationTime
            });
            return evaluation;
        }
        catch (error) {
            this.logger.error('❌ Feature flag evaluation failed', {
                flagName,
                error: error instanceof Error ? error.message : String(error)
            });
            return this.createDefaultEvaluation(flagName, false);
        }
    }
    /**
     * Update feature flag configuration
     */
    async updateFlag(flagName, updates) {
        try {
            const existingFlag = await this.getFlagConfig(flagName);
            if (!existingFlag) {
                throw new Error(`Feature flag ${flagName} not found`);
            }
            const updatedFlag = {
                ...existingFlag,
                ...updates,
                metadata: {
                    ...existingFlag.metadata,
                    ...updates.metadata,
                    updatedAt: new Date().toISOString()
                }
            };
            // Validate the update
            await this.validateFlagUpdate(updatedFlag);
            // Store updated configuration
            await this.storeFlagConfig(updatedFlag);
            this.flagConfigs.set(flagName, updatedFlag);
            // Clear cache for this flag
            this.clearFlagCache(flagName);
            this.logger.info('✅ Feature flag updated', {
                flagName,
                rolloutPercentage: updatedFlag.rolloutPercentage,
                enabled: updatedFlag.enabled
            });
            // Emit configuration change event
            await this.emitFlagChangeEvent(flagName, existingFlag, updatedFlag);
        }
        catch (error) {
            this.logger.error('❌ Failed to update feature flag', {
                flagName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Gradual rollout management
     */
    async graduateRollout(flagName, targetPercentage, options = {}) {
        const { incrementStep = 5, validateAfterEachStep = true, rollbackOnFailure = true } = options;
        try {
            const flagConfig = await this.getFlagConfig(flagName);
            if (!flagConfig) {
                throw new Error(`Feature flag ${flagName} not found`);
            }
            const currentPercentage = flagConfig.rolloutPercentage;
            const steps = this.calculateRolloutSteps(currentPercentage, targetPercentage, incrementStep);
            this.logger.info('🚀 Starting gradual rollout', {
                flagName,
                currentPercentage,
                targetPercentage,
                steps: steps.length
            });
            for (const [index, stepPercentage] of steps.entries()) {
                // Update rollout percentage
                await this.updateFlag(flagName, { rolloutPercentage: stepPercentage });
                // Wait for metrics to stabilize
                await this.waitForStabilization(30000); // 30 seconds
                // Validate metrics if required
                if (validateAfterEachStep) {
                    const validationPassed = await this.validateRolloutMetrics(flagName);
                    if (!validationPassed && rollbackOnFailure) {
                        this.logger.error('❌ Validation failed, rolling back', {
                            flagName,
                            failedAtPercentage: stepPercentage
                        });
                        await this.rollbackToPercentage(flagName, currentPercentage);
                        throw new Error(`Rollout validation failed at ${stepPercentage}%`);
                    }
                }
                this.logger.info('✅ Rollout step completed', {
                    flagName,
                    percentage: stepPercentage,
                    step: index + 1,
                    totalSteps: steps.length
                });
            }
            this.logger.info('🎉 Gradual rollout completed successfully', {
                flagName,
                finalPercentage: targetPercentage
            });
        }
        catch (error) {
            this.logger.error('❌ Gradual rollout failed', {
                flagName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Emergency rollback functionality
     */
    async emergencyRollback(flagName, reason) {
        try {
            this.logger.warn('🚨 EMERGENCY ROLLBACK INITIATED', {
                flagName,
                reason,
                timestamp: new Date().toISOString()
            });
            // Activate kill switch
            await this.updateFlag(flagName, {
                emergencyKillSwitch: true,
                rolloutPercentage: 0,
                enabled: false
            });
            // Emit emergency event
            await this.emitEmergencyEvent(flagName, reason);
            // Clear all caches
            this.clearAllCaches();
            this.logger.warn('⚠️ Emergency rollback completed', { flagName });
        }
        catch (error) {
            this.logger.error('❌ Emergency rollback failed', {
                flagName,
                reason,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Get rollout metrics for monitoring
     */
    async getRolloutMetrics(flagName) {
        try {
            const { data, error } = await this.supabase
                .from('feature_flag_metrics')
                .select('*')
                .eq('flag_name', flagName)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (error || !data) {
                return null;
            }
            return data;
        }
        catch (error) {
            this.logger.error('❌ Failed to get rollout metrics', {
                flagName,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    // Helper Methods
    async getFlagConfig(flagName) {
        // Check in-memory cache first
        if (this.flagConfigs.has(flagName)) {
            return this.flagConfigs.get(flagName);
        }
        // Fetch from database
        try {
            const { data, error } = await this.supabase
                .from('feature_flags')
                .select('*')
                .eq('flag_name', flagName)
                .single();
            if (error || !data) {
                return null;
            }
            const config = data;
            this.flagConfigs.set(flagName, config);
            return config;
        }
        catch (error) {
            this.logger.error('❌ Failed to fetch flag config', {
                flagName,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    async storeFlagConfig(config) {
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            await this.supabase
                .from('feature_flags')
                .upsert(config, { onConflict: 'flag_name' });
        }, async () => {
            this.logger.warn('Circuit breaker open, caching flag config locally', {
                flagName: config.flagName
            });
        });
    }
    calculateRolloutBucket(userId, flagName) {
        // Consistent hash-based bucketing
        const hash = this.simpleHash(`${userId}-${flagName}`);
        return hash % 100;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    checkSegmentMatch(config, userSegment) {
        if (!config.userSegments || config.userSegments.length === 0) {
            return true; // No segment restrictions
        }
        if (!userSegment) {
            return false; // User has no segment but flag requires one
        }
        return config.userSegments.includes(userSegment);
    }
    assignABTestGroup(groups, userId, flagName) {
        const hash = this.simpleHash(`${userId}-${flagName}-ab`);
        const bucket = hash % 100;
        let cumulativePercentage = 0;
        for (const group of groups) {
            cumulativePercentage += group.percentage;
            if (bucket < cumulativePercentage) {
                return group;
            }
        }
        return groups[0]; // Fallback to first group
    }
    createDefaultEvaluation(flagName, enabled, rolloutBucket) {
        return {
            flagName,
            enabled,
            segmentMatch: true,
            rolloutBucket: rolloutBucket ?? 0,
            evaluationTime: new Date().toISOString()
        };
    }
    getCacheKey(flagName, context) {
        return `${flagName}-${JSON.stringify(context)}`;
    }
    clearFlagCache(flagName) {
        for (const [key] of this.evaluationCache) {
            if (key.startsWith(flagName)) {
                this.evaluationCache.delete(key);
            }
        }
    }
    clearAllCaches() {
        this.evaluationCache.clear();
        this.flagConfigs.clear();
    }
    calculateRolloutSteps(current, target, step) {
        const steps = [];
        if (target > current) {
            for (let percentage = current + step; percentage <= target; percentage += step) {
                steps.push(Math.min(percentage, target));
            }
            if (steps[steps.length - 1] !== target) {
                steps.push(target);
            }
        }
        else {
            for (let percentage = current - step; percentage >= target; percentage -= step) {
                steps.push(Math.max(percentage, target));
            }
            if (steps[steps.length - 1] !== target) {
                steps.push(target);
            }
        }
        return steps;
    }
    async waitForStabilization(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async validateRolloutMetrics(flagName) {
        const config = await this.getFlagConfig(flagName);
        if (!config)
            return false;
        const metrics = await this.getRolloutMetrics(flagName);
        if (!metrics)
            return false;
        for (const gate of config.validationGates) {
            const metricValue = metrics[gate.metric];
            if (metricValue === undefined) {
                if (gate.required)
                    return false;
                continue;
            }
            const passed = this.evaluateValidationGate(metricValue, gate);
            if (!passed && gate.required) {
                this.logger.error('❌ Validation gate failed', {
                    flagName,
                    metric: gate.metric,
                    value: metricValue,
                    threshold: gate.threshold,
                    operator: gate.operator
                });
                return false;
            }
        }
        return true;
    }
    evaluateValidationGate(value, gate) {
        switch (gate.operator) {
            case 'gt': return value > gate.threshold;
            case 'lt': return value < gate.threshold;
            case 'gte': return value >= gate.threshold;
            case 'lte': return value <= gate.threshold;
            case 'eq': return value === gate.threshold;
            default: return false;
        }
    }
    async rollbackToPercentage(flagName, percentage) {
        await this.updateFlag(flagName, { rolloutPercentage: percentage });
    }
    async validateFlagUpdate(config) {
        // Validate rollout percentage
        if (config.rolloutPercentage < 0 || config.rolloutPercentage > 100) {
            throw new Error('Rollout percentage must be between 0 and 100');
        }
        // Validate A/B test groups
        if (config.abTestGroups) {
            const totalPercentage = config.abTestGroups.reduce((sum, group) => sum + group.percentage, 0);
            if (totalPercentage !== 100) {
                throw new Error('A/B test group percentages must sum to 100');
            }
        }
        // Additional validation logic...
    }
    async emitFlagChangeEvent(flagName, oldConfig, newConfig) {
        try {
            await this.supabase
                .from('events')
                .insert({
                event_type: 'feature_flag.configuration.changed.v1',
                aggregate_id: flagName,
                aggregate_type: 'feature_flag',
                event_data: {
                    flagName,
                    oldConfig,
                    newConfig,
                    changes: this.calculateConfigChanges(oldConfig, newConfig)
                },
                idempotency_key: `flag-change-${flagName}-${Date.now()}`,
                metadata: {
                    source: 'FeatureFlagService',
                    component: 'configuration_management'
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to emit flag change event', {
                flagName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async emitEmergencyEvent(flagName, reason) {
        try {
            await this.supabase
                .from('events')
                .insert({
                event_type: 'feature_flag.emergency.rollback.v1',
                aggregate_id: flagName,
                aggregate_type: 'feature_flag',
                event_data: {
                    flagName,
                    reason,
                    timestamp: new Date().toISOString()
                },
                idempotency_key: `emergency-${flagName}-${Date.now()}`,
                metadata: {
                    source: 'FeatureFlagService',
                    component: 'emergency_management'
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to emit emergency event', {
                flagName,
                reason,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    calculateConfigChanges(oldConfig, newConfig) {
        const changes = {};
        if (oldConfig.enabled !== newConfig.enabled) {
            changes.enabled = { from: oldConfig.enabled, to: newConfig.enabled };
        }
        if (oldConfig.rolloutPercentage !== newConfig.rolloutPercentage) {
            changes.rolloutPercentage = { from: oldConfig.rolloutPercentage, to: newConfig.rolloutPercentage };
        }
        if (oldConfig.emergencyKillSwitch !== newConfig.emergencyKillSwitch) {
            changes.emergencyKillSwitch = { from: oldConfig.emergencyKillSwitch, to: newConfig.emergencyKillSwitch };
        }
        return changes;
    }
    startMetricsCollection() {
        // Collect and emit metrics every 30 seconds
        setInterval(async () => {
            await this.collectAndEmitMetrics();
        }, 30000);
        // Clean cache every 5 minutes
        setInterval(() => {
            this.cleanExpiredCache();
        }, 5 * 60 * 1000);
    }
    async collectAndEmitMetrics() {
        try {
            const metrics = {
                totalEvaluations: this.totalEvaluations,
                cacheHitRate: this.cacheHitRate,
                cacheSize: this.evaluationCache.size,
                flagsInMemory: this.flagConfigs.size,
                timestamp: new Date().toISOString()
            };
            await this.supabase
                .from('events')
                .insert({
                event_type: 'feature_flag.service.metrics.v1',
                aggregate_id: 'feature-flag-service',
                aggregate_type: 'system',
                event_data: metrics,
                idempotency_key: `metrics-${Date.now()}`,
                metadata: {
                    source: 'FeatureFlagService',
                    component: 'metrics_collection'
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to emit service metrics', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, cached] of this.evaluationCache) {
            if (cached.expiry <= now) {
                this.evaluationCache.delete(key);
            }
        }
    }
    /**
     * Get service health status
     */
    getHealthStatus() {
        return {
            healthy: true,
            metrics: {
                totalEvaluations: this.totalEvaluations,
                cacheHitRate: this.cacheHitRate,
                cacheSize: this.evaluationCache.size,
                flagsInMemory: this.flagConfigs.size
            }
        };
    }
}
exports.FeatureFlagService = FeatureFlagService;
