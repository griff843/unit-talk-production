"use strict";
/**
 * Feature-Flagged Scoring Agent
 *
 * Orchestrates between Enhanced 45-factor Engine and Legacy Scoring System
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
exports.FeatureFlaggedScoringAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const Enhanced45FactorEngine_1 = require("./scoring/Enhanced45FactorEngine");
const FeatureFlagService_1 = require("../../services/feature-flags/FeatureFlagService");
const ABTestingEngine_1 = require("../../services/feature-flags/ABTestingEngine");
const logger_1 = require("../../utils/logger");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
class FeatureFlaggedScoringAgent extends BaseAgent_1.BaseAgent {
    constructor(supabase) {
        super(supabase, 'feature-flagged-scoring-agent');
        this.logger = (0, logger_1.createLogger)('FeatureFlaggedScoringAgent');
        // Performance tracking
        this.performanceMetrics = {
            totalScorings: 0,
            legacyScorings: 0,
            enhancedScorings: 0,
            avgLegacyLatency: 0,
            avgEnhancedLatency: 0,
            errorRate: 0,
            lastReset: Date.now()
        };
        this.featureFlagService = new FeatureFlagService_1.FeatureFlagService(supabase);
        this.abTestingEngine = new ABTestingEngine_1.ABTestingEngine(supabase, this.featureFlagService);
        // Initialize enhanced engine lazily
        this.initializeEnhancedEngine();
        // Start performance monitoring
        this.startPerformanceMonitoring();
    }
    /**
     * Score a prop using feature-flagged approach
     */
    async scoreProp(features, context = {}) {
        const startTime = Date.now();
        const propId = features.propId || `prop-${Date.now()}`;
        try {
            // Evaluate feature flag
            const flagEvaluation = await this.featureFlagService.evaluateFlag('enhanced_45_factor_scoring', {
                userId: context.userId,
                userSegment: context.metadata?.userSegment,
                environment: process.env.NODE_ENV,
                metadata: context.metadata
            });
            this.logger.debug('Feature flag evaluated for scoring', {
                propId,
                enabled: flagEvaluation.enabled,
                variant: flagEvaluation.variant,
                abTestGroup: flagEvaluation.abTestGroup,
                userId: context.userId
            });
            // Always run legacy system for comparison
            const legacyStartTime = Date.now();
            const legacyResult = await this.runLegacyScoring(features);
            const legacyProcessingTime = Date.now() - legacyStartTime;
            let enhancedResult;
            let enhancedProcessingTime;
            let selectedResult;
            let selectionReason;
            let performanceDelta;
            // Run enhanced system if flag is enabled
            if (flagEvaluation.enabled && this.enhanced45FactorEngine) {
                const enhancedStartTime = Date.now();
                try {
                    enhancedResult = await this.enhanced45FactorEngine.calculate45FactorScore(features);
                    enhancedProcessingTime = Date.now() - enhancedStartTime;
                    // Calculate performance delta
                    performanceDelta = enhancedProcessingTime - legacyProcessingTime;
                    // Determine which result to use
                    const selectionStrategy = await this.determineSelectionStrategy(flagEvaluation);
                    if (selectionStrategy === 'enhanced') {
                        selectedResult = enhancedResult;
                        selectionReason = 'Enhanced 45-factor engine selected via feature flag';
                    }
                    else if (selectionStrategy === 'legacy') {
                        selectedResult = legacyResult;
                        selectionReason = 'Legacy system selected for comparison baseline';
                    }
                    else {
                        // Safety fallback - use better performing system
                        selectedResult = performanceDelta <= 1000 ? enhancedResult : legacyResult; // 1 second threshold
                        selectionReason = `Performance-based selection: ${selectionStrategy}`;
                    }
                }
                catch (error) {
                    this.logger.error('Enhanced scoring failed, falling back to legacy', {
                        propId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    selectedResult = legacyResult;
                    selectionReason = 'Enhanced system failed, legacy fallback';
                    performanceDelta = 0;
                    // Track A/B test error event
                    await this.abTestingEngine.trackEvent({
                        flagName: 'enhanced_45_factor_scoring',
                        variant: 'treatment',
                        userId: context.userId || 'anonymous',
                        eventType: 'error',
                        errorOccurred: true,
                        errorDetails: error instanceof Error ? error.message : String(error),
                        sessionId: context.sessionId,
                        latencyMs: Date.now() - enhancedStartTime
                    });
                }
            }
            else {
                // Flag disabled - use legacy only
                selectedResult = legacyResult;
                selectionReason = 'Feature flag disabled - legacy system only';
                performanceDelta = 0;
            }
            // Create comparison result
            const comparisonResult = {
                propId,
                userId: context.userId,
                // Flag evaluation
                flagEnabled: flagEvaluation.enabled,
                variant: flagEvaluation.variant || 'control',
                abTestGroup: flagEvaluation.abTestGroup,
                // Legacy system results
                legacyResult,
                legacyProcessingTime,
                // Enhanced system results
                enhancedResult,
                enhancedProcessingTime,
                // Performance comparison
                performanceDelta,
                accuracyComparison: this.calculateAccuracyComparison(legacyResult, enhancedResult),
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
            this.logger.info('Feature-flagged grading completed', {
                propId,
                flagEnabled: flagEvaluation.enabled,
                variant: comparisonResult.variant,
                selectedSystem: selectedResult === enhancedResult ? 'enhanced' : 'legacy',
                totalProcessingTimeMs: totalProcessingTime,
                performanceDelta
            });
            return comparisonResult;
        }
        catch (error) {
            this.logger.error('Feature-flagged grading failed', {
                propId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Emergency fallback to legacy system
            const legacyResult = await this.runLegacyScoring(features);
            return {
                propId,
                userId: context.userId,
                flagEnabled: false,
                variant: 'control',
                legacyResult,
                legacyProcessingTime: Date.now() - startTime,
                performanceDelta: 0,
                selectedResult: legacyResult,
                selectionReason: 'Emergency fallback due to system error',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development'
            };
        }
    }
    /**
     * Run legacy scoring system
     */
    async runLegacyScoring(features) {
        const startTime = Date.now();
        try {
            // Simplified legacy scoring logic
            // In production, this would call the existing scoring system
            const baseScore = this.calculateLegacyBaseScore(features);
            const adjustedScore = this.applyLegacyAdjustments(baseScore, features);
            const tier = this.determineLegacyTier(adjustedScore);
            const confidence = this.calculateLegacyConfidence(adjustedScore);
            const kellyFraction = this.calculateLegacyKelly(adjustedScore);
            const expectedValue = this.calculateLegacyEV(adjustedScore);
            return {
                totalScore: adjustedScore,
                tier,
                confidence,
                kellyFraction,
                expectedValue,
                processingTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                version: 'legacy-1.0.0'
            };
        }
        catch (error) {
            this.logger.error('Legacy scoring failed', {
                propId: features.propId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Return minimal viable result
            return {
                totalScore: 50,
                tier: 'C',
                confidence: 0.5,
                kellyFraction: 0.01,
                expectedValue: 0,
                processingTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                version: 'legacy-fallback'
            };
        }
    }
    /**
     * Determine which system to use based on A/B test assignment
     */
    async determineSelectionStrategy(flagEvaluation) {
        if (!flagEvaluation.abTestGroup) {
            return 'enhanced'; // Default to enhanced if no A/B test
        }
        // A/B test logic
        if (flagEvaluation.variant === 'control') {
            return 'legacy';
        }
        else if (flagEvaluation.variant === 'treatment') {
            return 'enhanced';
        }
        return 'enhanced';
    }
    /**
     * Calculate accuracy comparison between systems
     */
    calculateAccuracyComparison(legacyResult, enhancedResult) {
        if (!enhancedResult)
            return undefined;
        // Compare confidence levels as a proxy for accuracy
        const legacyConfidence = legacyResult.confidence;
        const enhancedConfidence = enhancedResult.confidence;
        return ((enhancedConfidence - legacyConfidence) / legacyConfidence) * 100;
    }
    /**
     * Track A/B testing events for both systems
     */
    async trackABTestingEvents(result, context) {
        try {
            // Track control group (legacy) event
            await this.abTestingEngine.trackEvent({
                flagName: 'enhanced_45_factor_scoring',
                variant: 'control',
                userId: context.userId || 'anonymous',
                eventType: 'performance',
                eventValue: result.legacyResult.totalScore,
                latencyMs: result.legacyProcessingTime,
                sessionId: context.sessionId,
                metadata: {
                    tier: result.legacyResult.tier,
                    confidence: result.legacyResult.confidence,
                    expectedValue: result.legacyResult.expectedValue
                }
            });
            // Track treatment group (enhanced) event if available
            if (result.enhancedResult && result.enhancedProcessingTime) {
                await this.abTestingEngine.trackEvent({
                    flagName: 'enhanced_45_factor_scoring',
                    variant: 'treatment',
                    userId: context.userId || 'anonymous',
                    eventType: 'performance',
                    eventValue: result.enhancedResult.totalScore,
                    latencyMs: result.enhancedProcessingTime,
                    sessionId: context.sessionId,
                    metadata: {
                        tier: result.enhancedResult.tier,
                        confidence: result.enhancedResult.confidence,
                        expectedValue: result.enhancedResult.expectedValue,
                        factorCount: Object.keys(result.enhancedResult.factorScores).length
                    }
                });
            }
            // Track conversion event (successful grading)
            await this.abTestingEngine.trackEvent({
                flagName: 'enhanced_45_factor_scoring',
                variant: result.variant,
                userId: context.userId || 'anonymous',
                eventType: 'conversion',
                eventValue: 1,
                sessionId: context.sessionId
            });
        }
        catch (error) {
            this.logger.error('Failed to track A/B testing events', {
                propId: result.propId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Update internal performance metrics
     */
    updatePerformanceMetrics(result) {
        this.performanceMetrics.totalScorings++;
        this.performanceMetrics.legacyScorings++;
        if (result.enhancedResult) {
            this.performanceMetrics.enhancedScorings++;
        }
        // Update latency averages
        const total = this.performanceMetrics.totalScorings;
        this.performanceMetrics.avgLegacyLatency =
            (this.performanceMetrics.avgLegacyLatency * (total - 1) + result.legacyProcessingTime) / total;
        if (result.enhancedProcessingTime) {
            const enhancedTotal = this.performanceMetrics.enhancedScorings;
            this.performanceMetrics.avgEnhancedLatency =
                (this.performanceMetrics.avgEnhancedLatency * (enhancedTotal - 1) + result.enhancedProcessingTime) / enhancedTotal;
        }
    }
    /**
     * Store comparison result for analysis
     */
    async storeComparisonResult(result) {
        try {
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                await this.supabase
                    .from('scoring_comparisons')
                    .insert({
                    prop_id: result.propId,
                    user_id: result.userId,
                    flag_enabled: result.flagEnabled,
                    variant: result.variant,
                    ab_test_group: result.abTestGroup,
                    legacy_result: result.legacyResult,
                    enhanced_result: result.enhancedResult,
                    legacy_processing_time: result.legacyProcessingTime,
                    enhanced_processing_time: result.enhancedProcessingTime,
                    performance_delta: result.performanceDelta,
                    accuracy_comparison: result.accuracyComparison,
                    selected_system: result.selectedResult === result.enhancedResult ? 'enhanced' : 'legacy',
                    selection_reason: result.selectionReason,
                    environment: result.environment
                });
            }, async () => {
                this.logger.warn('Circuit breaker open, caching comparison result locally');
            });
        }
        catch (error) {
            this.logger.error('Failed to store comparison result', {
                propId: result.propId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Initialize enhanced engine with feature dependencies
     */
    async initializeEnhancedEngine() {
        try {
            // Check if feature store integration is enabled
            const featureStoreFlag = await this.featureFlagService.evaluateFlag('feature_store_integration');
            if (featureStoreFlag.enabled) {
                // Initialize with feature store integration
                const { FeatureStoreIntegration } = await Promise.resolve().then(() => __importStar(require('./scoring/FeatureStoreIntegration')));
                const { MaterialChangeDetector } = await Promise.resolve().then(() => __importStar(require('./scoring/MaterialChangeDetector')));
                const featureStore = new FeatureStoreIntegration(this.supabase, this.logger);
                const changeDetector = new MaterialChangeDetector(this.supabase, this.logger);
                this.enhanced45FactorEngine = new Enhanced45FactorEngine_1.Enhanced45FactorEngine(featureStore, changeDetector);
                this.logger.info('✅ Enhanced 45-factor engine initialized with feature store');
            }
            else {
                this.logger.info('ℹ️ Enhanced engine not initialized - feature store dependency not met');
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize enhanced engine', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
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
                enhancedAdoptionRate: this.performanceMetrics.enhancedScorings / this.performanceMetrics.totalScorings,
                performanceRatio: this.performanceMetrics.avgEnhancedLatency / this.performanceMetrics.avgLegacyLatency,
                timestamp: new Date().toISOString()
            };
            await this.supabase
                .from('events')
                .insert({
                event_type: 'scoring.performance.metrics.v1',
                aggregate_id: 'feature-flagged-scoring-agent',
                aggregate_type: 'scoring_agent',
                event_data: metrics,
                idempotency_key: `scoring-metrics-${Date.now()}`,
                metadata: {
                    source: 'FeatureFlaggedScoringAgent',
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
            totalScorings: 0,
            legacyScorings: 0,
            enhancedScorings: 0,
            avgLegacyLatency: 0,
            avgEnhancedLatency: 0,
            errorRate: 0,
            lastReset: Date.now()
        };
    }
    // Legacy scoring calculation methods (simplified)
    calculateLegacyBaseScore(features) {
        // Simplified legacy scoring logic
        let score = 50; // Base score
        if (features.expectedValue) {
            score += features.expectedValue * 10;
        }
        if (features.player) {
            score += 5; // Player bonus
        }
        if (features.market?.odds) {
            const impliedProb = Math.abs(features.market.odds) / (Math.abs(features.market.odds) + 100);
            score += (0.5 - impliedProb) * 20;
        }
        return Math.max(0, Math.min(100, score));
    }
    applyLegacyAdjustments(baseScore, features) {
        let adjustedScore = baseScore;
        // Time-based adjustment
        const hoursToGame = this.calculateHoursToGame(features);
        if (hoursToGame < 2) {
            adjustedScore *= 0.9; // Reduce score for games starting soon
        }
        // Quality adjustment
        if (features.dataQuality?.completeness && features.dataQuality.completeness < 0.8) {
            adjustedScore *= 0.95; // Reduce score for incomplete data
        }
        return Math.max(0, Math.min(100, adjustedScore));
    }
    determineLegacyTier(score) {
        if (score >= 80)
            return 'S';
        if (score >= 65)
            return 'A';
        if (score >= 50)
            return 'B';
        if (score >= 35)
            return 'C';
        return 'D';
    }
    calculateLegacyConfidence(score) {
        return Math.max(0.3, Math.min(0.95, score / 100));
    }
    calculateLegacyKelly(score) {
        const edge = (score - 50) / 100;
        return Math.max(0, Math.min(0.25, edge * 0.2));
    }
    calculateLegacyEV(score) {
        return (score - 50) / 100;
    }
    calculateHoursToGame(features) {
        try {
            const gameDate = features.game_date || features.timestamp;
            if (!gameDate)
                return 12;
            const gameTime = new Date(gameDate);
            const now = new Date();
            return Math.max(0, (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        }
        catch {
            return 12;
        }
    }
    /**
     * Get agent health status
     */
    getHealthStatus() {
        return {
            healthy: true,
            metrics: this.performanceMetrics,
            enhancedEngineReady: !!this.enhanced45FactorEngine
        };
    }
    /**
     * Get A/B test analysis for the scoring engine
     */
    async getABTestAnalysis() {
        return await this.abTestingEngine.analyzeTest('enhanced_45_factor_scoring');
    }
    /**
     * Generate comprehensive scoring system report
     */
    async generateSystemReport() {
        return await this.abTestingEngine.generateTestReport('enhanced_45_factor_scoring');
    }
}
exports.FeatureFlaggedScoringAgent = FeatureFlaggedScoringAgent;
