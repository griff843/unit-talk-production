"use strict";
/**
 * Structured debug logging for scoring system
 * Provides detailed scoring breakdown when SCORING_DEBUG=true
 * Keeps logs compact (<4KB) and redacts PII
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringLogger = exports.ScoringLogger = void 0;
const crypto_1 = require("crypto");
class ScoringLogger {
    constructor() {
        this.MAX_LOG_SIZE = 4000; // 4KB limit per log entry
        this.SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
    }
    static getInstance() {
        if (!ScoringLogger.instance) {
            ScoringLogger.instance = new ScoringLogger();
        }
        return ScoringLogger.instance;
    }
    /**
     * Check if debug logging is enabled
     */
    isEnabled() {
        return this.SCORING_DEBUG;
    }
    /**
     * Start a scoring trace
     */
    startTrace(propId, sport, market) {
        return {
            propId: this.redactPII(propId),
            sport,
            market: this.redactPII(market),
            startTime: Date.now(),
            traceId: (0, crypto_1.randomUUID)().substring(0, 8) // Short trace ID
        };
    }
    /**
     * Log scoring result with full breakdown
     */
    logScoringResult(context, result, weights = {}) {
        if (!this.SCORING_DEBUG) {
            return;
        }
        try {
            const processingTime = Date.now() - context.startTime;
            // Build feature contributions array
            const features = [];
            if (result.featureContributions) {
                for (const [name, contribution] of Object.entries(result.featureContributions)) {
                    const weight = weights[name] || 0;
                    features.push({
                        name: this.truncateString(name, 20),
                        value: this.roundToDecimal(contribution / (weight || 1), 2), // Back-calculate value
                        weight: this.roundToDecimal(weight, 4),
                        contribution: this.roundToDecimal(contribution, 2)
                    });
                }
            }
            // Sort by contribution (highest first) and limit to top 15 to stay under 4KB
            features.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
            const topFeatures = features.slice(0, 15);
            const logEntry = {
                trace_id: context.traceId,
                prop_id: context.propId,
                league: context.sport,
                market: context.market,
                devig_win_prob: this.roundToDecimal(result.deviggingResult?.trueProb || 0, 3),
                clv_pct: this.roundToDecimal(result.clvPct || 0, 2),
                features: topFeatures,
                composite: this.roundToDecimal(result.finalScore, 2),
                tier: result.tier,
                kelly_fraction: this.roundToDecimal(result.kellyFraction, 4),
                timestamp: new Date().toISOString(),
                processing_time_ms: processingTime,
                model_version: result.modelVersion?.substring(0, 20) || 'unknown',
                sport_config: result.sportConfig?.substring(0, 20) || context.sport
            };
            // Convert to compact JSON and check size
            const logJson = JSON.stringify(logEntry);
            if (logJson.length > this.MAX_LOG_SIZE) {
                // Truncate features if too large
                const truncatedEntry = {
                    ...logEntry,
                    features: topFeatures.slice(0, Math.floor(topFeatures.length * 0.7)),
                    _truncated: true
                };
                console.log('SCORING_DEBUG:', JSON.stringify(truncatedEntry));
            }
            else {
                console.log('SCORING_DEBUG:', logJson);
            }
        }
        catch (error) {
            console.warn('⚠️ Scoring logger error:', error);
            // Fallback minimal log
            console.log('SCORING_DEBUG:', JSON.stringify({
                trace_id: context.traceId,
                prop_id: context.propId,
                tier: result.tier,
                score: result.finalScore,
                error: 'logging_error',
                timestamp: new Date().toISOString()
            }));
        }
    }
    /**
     * Log feature engineering steps
     */
    logFeatureEngineering(context, originalFeatures, enrichedFeatures) {
        if (!this.SCORING_DEBUG) {
            return;
        }
        console.log('SCORING_DEBUG:', JSON.stringify({
            trace_id: context.traceId,
            step: 'feature_engineering',
            original_count: Object.keys(originalFeatures || {}).length,
            enriched_count: Object.keys(enrichedFeatures || {}).length,
            timestamp: new Date().toISOString()
        }));
    }
    /**
     * Log devigging results
     */
    logDevigging(context, originalOdds, deviggingResult) {
        if (!this.SCORING_DEBUG) {
            return;
        }
        console.log('SCORING_DEBUG:', JSON.stringify({
            trace_id: context.traceId,
            step: 'devigging',
            original_odds: originalOdds,
            fair_odds: this.roundToDecimal(deviggingResult?.fairOdds || 0, 0),
            vig_removed: this.roundToDecimal(deviggingResult?.totalVig || 0, 2),
            true_prob: this.roundToDecimal(deviggingResult?.trueProb || 0, 3),
            edge: this.roundToDecimal(deviggingResult?.deviggedEdge || 0, 3),
            timestamp: new Date().toISOString()
        }));
    }
    /**
     * Log CLV tracking initiation
     */
    logCLVTracking(context, clvTrackingId, initialLine) {
        if (!this.SCORING_DEBUG) {
            return;
        }
        console.log('SCORING_DEBUG:', JSON.stringify({
            trace_id: context.traceId,
            step: 'clv_tracking',
            clv_id: clvTrackingId.substring(0, 8), // Redact full ID
            initial_line: initialLine,
            timestamp: new Date().toISOString()
        }));
    }
    /**
     * Log professional path routing
     */
    logProfessionalRouting(context, pathUsed, processingTimeMs) {
        if (!this.SCORING_DEBUG) {
            return;
        }
        console.log('SCORING_DEBUG:', JSON.stringify({
            trace_id: context.traceId,
            step: 'routing',
            path: pathUsed,
            processing_ms: processingTimeMs,
            timestamp: new Date().toISOString()
        }));
    }
    /**
     * Redact personally identifiable information
     */
    redactPII(value) {
        if (!value)
            return 'unknown';
        // Keep first 3 and last 2 characters, mask the middle
        if (value.length > 8) {
            return value.substring(0, 3) + '***' + value.substring(value.length - 2);
        }
        return value.substring(0, 3) + '***';
    }
    /**
     * Truncate strings to prevent log bloat
     */
    truncateString(str, maxLength) {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength - 3) + '...';
    }
    /**
     * Round numbers to specified decimal places
     */
    roundToDecimal(num, decimals) {
        return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
}
exports.ScoringLogger = ScoringLogger;
// Export singleton instance
exports.scoringLogger = ScoringLogger.getInstance();
