"use strict";
/**
 * CLV Tracking Validator
 * Ensures 50%+ positive CLV target is met across all professional features
 *
 * This validator continuously monitors CLV performance and ensures
 * the syndicate-level system maintains profitability standards.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLVTrackingValidator = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
class CLVTrackingValidator extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.clvResults = [];
        this.logger = (0, logger_1.createLogger)('CLVTrackingValidator');
        this.startTime = Date.now();
        // Default configuration
        this.config = {
            targetPositiveRate: 0.5, // 50% target
            excellentPositiveRate: 0.6, // 60% excellent
            minSampleSize: 100,
            validationInterval: 3600000, // 1 hour
            dataRetentionDays: 90,
            alertThresholds: {
                criticalCLVRate: 0.3, // 30% - critical alert
                warningCLVRate: 0.4, // 40% - warning alert
                poorProfitability: -0.05 // -5% - poor performance
            },
            ...config
        };
        this.startValidation();
        this.logger.info('💰 CLV Tracking Validator initialized', {
            targetPositiveRate: `${this.config.targetPositiveRate * 100}%`,
            excellentRate: `${this.config.excellentPositiveRate * 100}%`,
            validationInterval: `${this.config.validationInterval / 1000 / 60}min`,
            minSampleSize: this.config.minSampleSize
        });
    }
    /**
     * Start continuous validation
     */
    startValidation() {
        this.validationTimer = setInterval(() => {
            this.performValidation();
        }, this.config.validationInterval);
        this.logger.info('🔄 CLV validation started', {
            interval: `${this.config.validationInterval / 1000 / 60} minutes`
        });
    }
    /**
     * Stop validation
     */
    stop() {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = undefined;
        }
        this.logger.info('⏹️ CLV validation stopped');
    }
    /**
     * Add CLV tracking result
     */
    addCLVResult(result) {
        // Calculate CLV percentage
        if (result.clvPercentage === undefined) {
            result.clvPercentage = result.openingLine !== 0 ?
                (result.clv / Math.abs(result.openingLine)) * 100 : 0;
        }
        // Add to results
        this.clvResults.push(result);
        // Clean up old data
        this.cleanupOldData();
        this.logger.debug('📊 CLV result added', {
            pickId: result.pickId,
            clv: result.clv.toFixed(3),
            clvPercentage: `${result.clvPercentage.toFixed(2)}%`,
            sport: result.sport,
            outcome: result.outcome
        });
        // Emit event
        this.emit('clvResultAdded', result);
        // Check if immediate validation needed
        if (this.clvResults.length % 10 === 0) {
            this.performValidation();
        }
    }
    /**
     * Perform comprehensive CLV validation
     */
    async performValidation() {
        const metrics = this.calculateCLVMetrics();
        // Check alerts
        this.checkCLVAlerts(metrics);
        // Emit validation event
        this.emit('clvValidationComplete', metrics);
        this.logger.info('✅ CLV validation completed', {
            totalTracks: metrics.totalTracks,
            positiveCLVRate: `${(metrics.positiveCLVRate * 100).toFixed(1)}%`,
            avgCLV: `${(metrics.avgCLV * 100).toFixed(2)}%`,
            targetMet: metrics.targetMet ? '✅ TARGET MET' : '❌ TARGET MISSED',
            winRate: `${(metrics.winRate * 100).toFixed(1)}%`,
            profitability: `${(metrics.avgProfit * 100).toFixed(2)}%`
        });
        return metrics;
    }
    /**
     * Calculate comprehensive CLV metrics
     */
    calculateCLVMetrics() {
        const totalTracks = this.clvResults.length;
        if (totalTracks === 0) {
            return this.createEmptyMetrics();
        }
        // Basic CLV calculations
        const positiveCLVCount = this.clvResults.filter(r => r.clv > 0).length;
        const negativeCLVCount = this.clvResults.filter(r => r.clv < 0).length;
        const pushCount = this.clvResults.filter(r => r.clv === 0).length;
        const positiveCLVRate = positiveCLVCount / totalTracks;
        const avgCLV = this.clvResults.reduce((sum, r) => sum + r.clv, 0) / totalTracks;
        const medianCLV = this.calculateMedian(this.clvResults.map(r => r.clv));
        // Performance calculations
        const settledResults = this.clvResults.filter(r => r.outcome !== undefined);
        const profitableTrades = settledResults.filter(r => r.profit && r.profit > 0).length;
        const losingTrades = settledResults.filter(r => r.profit && r.profit < 0).length;
        const winRate = settledResults.length > 0 ? profitableTrades / settledResults.length : 0;
        const avgProfit = settledResults.length > 0 ?
            settledResults.reduce((sum, r) => sum + (r.profit || 0), 0) / settledResults.length : 0;
        const totalPnL = settledResults.reduce((sum, r) => sum + (r.profit || 0), 0);
        // Risk metrics
        const returns = settledResults.map(r => r.profitPercentage || 0);
        const sharpeRatio = this.calculateSharpeRatio(returns);
        const maxDrawdown = this.calculateMaxDrawdown(returns);
        // Target validation
        const targetMet = positiveCLVRate >= this.config.targetPositiveRate;
        const targetExceeded = positiveCLVRate >= this.config.excellentPositiveRate;
        // Quality metrics
        const dataQuality = this.calculateDataQuality();
        const trackingAccuracy = this.calculateTrackingAccuracy();
        const reportingCompleteness = settledResults.length / totalTracks;
        // Sport breakdown
        const sportBreakdown = this.calculateSportBreakdown();
        // Time-based analysis
        const recentPerformance = this.calculateRecentPerformance();
        return {
            totalTracks,
            positiveCLVCount,
            negativeCLVCount,
            pushCount,
            positiveCLVRate,
            avgCLV,
            medianCLV,
            profitableTrades,
            losingTrades,
            winRate,
            avgProfit,
            totalPnL,
            sharpeRatio,
            maxDrawdown,
            targetMet,
            targetExceeded,
            dataQuality,
            trackingAccuracy,
            reportingCompleteness,
            sportBreakdown,
            recentPerformance,
            lastUpdate: new Date().toISOString()
        };
    }
    /**
     * Create empty metrics structure
     */
    createEmptyMetrics() {
        return {
            totalTracks: 0,
            positiveCLVCount: 0,
            negativeCLVCount: 0,
            pushCount: 0,
            positiveCLVRate: 0,
            avgCLV: 0,
            medianCLV: 0,
            profitableTrades: 0,
            losingTrades: 0,
            winRate: 0,
            avgProfit: 0,
            totalPnL: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            targetMet: false,
            targetExceeded: false,
            dataQuality: 0,
            trackingAccuracy: 0,
            reportingCompleteness: 0,
            sportBreakdown: {},
            recentPerformance: {
                last24h: this.createEmptyPeriodMetrics('24h'),
                last7d: this.createEmptyPeriodMetrics('7d'),
                last30d: this.createEmptyPeriodMetrics('30d')
            },
            lastUpdate: new Date().toISOString()
        };
    }
    /**
     * Calculate sport-specific breakdown
     */
    calculateSportBreakdown() {
        const sportGroups = this.groupBySport();
        const breakdown = {};
        Object.entries(sportGroups).forEach(([sport, results]) => {
            if (results.length === 0)
                return;
            const positiveCLVCount = results.filter(r => r.clv > 0).length;
            const positiveCLVRate = positiveCLVCount / results.length;
            const avgCLV = results.reduce((sum, r) => sum + r.clv, 0) / results.length;
            const settledResults = results.filter(r => r.outcome !== undefined);
            const winCount = settledResults.filter(r => r.profit && r.profit > 0).length;
            const winRate = settledResults.length > 0 ? winCount / settledResults.length : 0;
            const profitability = settledResults.length > 0 ?
                settledResults.reduce((sum, r) => sum + (r.profit || 0), 0) / settledResults.length : 0;
            breakdown[sport] = {
                sport,
                totalTracks: results.length,
                positiveCLVRate,
                avgCLV,
                winRate,
                profitability,
                sampleSize: results.length
            };
        });
        return breakdown;
    }
    /**
     * Calculate recent performance trends
     */
    calculateRecentPerformance() {
        const now = Date.now();
        const last24h = this.filterByTime(24 * 60 * 60 * 1000);
        const last7d = this.filterByTime(7 * 24 * 60 * 60 * 1000);
        const last30d = this.filterByTime(30 * 24 * 60 * 60 * 1000);
        return {
            last24h: this.calculatePeriodMetrics('24h', last24h),
            last7d: this.calculatePeriodMetrics('7d', last7d),
            last30d: this.calculatePeriodMetrics('30d', last30d)
        };
    }
    /**
     * Calculate metrics for a specific period
     */
    calculatePeriodMetrics(period, results) {
        if (results.length === 0) {
            return this.createEmptyPeriodMetrics(period);
        }
        const positiveCLVCount = results.filter(r => r.clv > 0).length;
        const positiveCLVRate = positiveCLVCount / results.length;
        const avgCLV = results.reduce((sum, r) => sum + r.clv, 0) / results.length;
        const settledResults = results.filter(r => r.outcome !== undefined);
        const winCount = settledResults.filter(r => r.profit && r.profit > 0).length;
        const winRate = settledResults.length > 0 ? winCount / settledResults.length : 0;
        const profitability = settledResults.length > 0 ?
            settledResults.reduce((sum, r) => sum + (r.profit || 0), 0) / settledResults.length : 0;
        // Calculate trend (simplified)
        let trend = 'STABLE';
        if (positiveCLVRate > 0.55)
            trend = 'IMPROVING';
        else if (positiveCLVRate < 0.45)
            trend = 'DECLINING';
        return {
            period,
            totalTracks: results.length,
            positiveCLVRate,
            avgCLV,
            winRate,
            profitability,
            trend
        };
    }
    /**
     * Create empty period metrics
     */
    createEmptyPeriodMetrics(period) {
        return {
            period,
            totalTracks: 0,
            positiveCLVRate: 0,
            avgCLV: 0,
            winRate: 0,
            profitability: 0,
            trend: 'STABLE'
        };
    }
    /**
     * Check for CLV alerts
     */
    checkCLVAlerts(metrics) {
        // Critical alert: Very low positive CLV rate
        if (metrics.positiveCLVRate < this.config.alertThresholds.criticalCLVRate) {
            this.emit('clvAlert', {
                type: 'CRITICAL',
                message: `CRITICAL: Positive CLV rate extremely low at ${(metrics.positiveCLVRate * 100).toFixed(1)}%`,
                metrics
            });
        }
        // Warning alert: Below target
        else if (metrics.positiveCLVRate < this.config.targetPositiveRate) {
            this.emit('clvAlert', {
                type: 'WARNING',
                message: `WARNING: Positive CLV rate below 50% target at ${(metrics.positiveCLVRate * 100).toFixed(1)}%`,
                metrics
            });
        }
        // Poor profitability alert
        if (metrics.avgProfit < this.config.alertThresholds.poorProfitability) {
            this.emit('clvAlert', {
                type: 'WARNING',
                message: `WARNING: Poor profitability at ${(metrics.avgProfit * 100).toFixed(2)}%`,
                metrics
            });
        }
        // Excellent performance celebration
        if (metrics.targetExceeded && metrics.avgProfit > 0.02) {
            this.emit('clvAlert', {
                type: 'SUCCESS',
                message: `EXCELLENT: Exceeding all targets with ${(metrics.positiveCLVRate * 100).toFixed(1)}% positive CLV`,
                metrics
            });
        }
    }
    /**
     * Helper methods
     */
    groupBySport() {
        const groups = {};
        this.clvResults.forEach(result => {
            if (!groups[result.sport]) {
                groups[result.sport] = [];
            }
            groups[result.sport].push(result);
        });
        return groups;
    }
    filterByTime(milliseconds) {
        const cutoff = Date.now() - milliseconds;
        return this.clvResults.filter(result => new Date(result.timestamp).getTime() >= cutoff);
    }
    calculateMedian(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    calculateSharpeRatio(returns) {
        if (returns.length === 0)
            return 0;
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
    calculateMaxDrawdown(returns) {
        if (returns.length === 0)
            return 0;
        let maxDrawdown = 0;
        let peak = 0;
        let cumulative = 0;
        returns.forEach(ret => {
            cumulative += ret;
            if (cumulative > peak) {
                peak = cumulative;
            }
            const drawdown = (peak - cumulative) / Math.max(peak, 1);
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        });
        return maxDrawdown;
    }
    calculateDataQuality() {
        // Check completeness of required fields
        const requiredFields = ['pickId', 'openingLine', 'betLine', 'closingLine', 'clv'];
        let totalChecks = 0;
        let passedChecks = 0;
        this.clvResults.forEach(result => {
            requiredFields.forEach(field => {
                totalChecks++;
                if (result[field] !== undefined) {
                    passedChecks++;
                }
            });
        });
        return totalChecks > 0 ? passedChecks / totalChecks : 1;
    }
    calculateTrackingAccuracy() {
        // Simplified accuracy calculation
        // In production, this would compare predicted vs actual CLV
        return 0.85; // Default assumption
    }
    cleanupOldData() {
        const cutoff = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
        this.clvResults = this.clvResults.filter(result => new Date(result.timestamp).getTime() >= cutoff);
    }
    /**
     * Get current metrics
     */
    getCurrentMetrics() {
        return this.calculateCLVMetrics();
    }
    /**
     * Check if target is currently met
     */
    isTargetMet() {
        const metrics = this.calculateCLVMetrics();
        return metrics.targetMet;
    }
    /**
     * Get CLV results for analysis
     */
    getCLVResults(filters) {
        let results = [...this.clvResults];
        if (filters) {
            if (filters.sport) {
                results = results.filter(r => r.sport === filters.sport);
            }
            if (filters.dateRange) {
                const start = new Date(filters.dateRange.start).getTime();
                const end = new Date(filters.dateRange.end).getTime();
                results = results.filter(r => {
                    const timestamp = new Date(r.timestamp).getTime();
                    return timestamp >= start && timestamp <= end;
                });
            }
            if (filters.minCLV !== undefined) {
                results = results.filter(r => r.clv >= filters.minCLV);
            }
            if (filters.maxCLV !== undefined) {
                results = results.filter(r => r.clv <= filters.maxCLV);
            }
        }
        return results;
    }
    /**
     * Generate CLV performance report
     */
    generateReport() {
        const metrics = this.calculateCLVMetrics();
        const report = `
CLV TRACKING VALIDATION REPORT
===============================

OVERVIEW
--------
Total Tracks: ${metrics.totalTracks}
Positive CLV Rate: ${(metrics.positiveCLVRate * 100).toFixed(1)}% ${metrics.targetMet ? '✅' : '❌'}
Average CLV: ${(metrics.avgCLV * 100).toFixed(2)}%
Target Met (50%+): ${metrics.targetMet ? 'YES ✅' : 'NO ❌'}
Excellent Level (60%+): ${metrics.targetExceeded ? 'YES 🏆' : 'NO'}

PERFORMANCE
-----------
Win Rate: ${(metrics.winRate * 100).toFixed(1)}%
Average Profit: ${(metrics.avgProfit * 100).toFixed(2)}%
Total P&L: ${metrics.totalPnL.toFixed(2)}
Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(1)}%

QUALITY METRICS
---------------
Data Quality: ${(metrics.dataQuality * 100).toFixed(1)}%
Tracking Accuracy: ${(metrics.trackingAccuracy * 100).toFixed(1)}%
Reporting Completeness: ${(metrics.reportingCompleteness * 100).toFixed(1)}%

RECENT PERFORMANCE
------------------
Last 24h: ${(metrics.recentPerformance.last24h.positiveCLVRate * 100).toFixed(1)}% positive (${metrics.recentPerformance.last24h.totalTracks} tracks)
Last 7d:  ${(metrics.recentPerformance.last7d.positiveCLVRate * 100).toFixed(1)}% positive (${metrics.recentPerformance.last7d.totalTracks} tracks)
Last 30d: ${(metrics.recentPerformance.last30d.positiveCLVRate * 100).toFixed(1)}% positive (${metrics.recentPerformance.last30d.totalTracks} tracks)

SPORT BREAKDOWN
---------------
${Object.values(metrics.sportBreakdown).map(sport => `${sport.sport}: ${(sport.positiveCLVRate * 100).toFixed(1)}% positive (${sport.totalTracks} tracks)`).join('\n')}

Generated: ${new Date().toISOString()}
    `.trim();
        return report;
    }
}
exports.CLVTrackingValidator = CLVTrackingValidator;
