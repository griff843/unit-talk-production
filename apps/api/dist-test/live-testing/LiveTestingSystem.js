"use strict";
/**
 * Phase 9: Live Testing System
 *
 * Real-world testing infrastructure for syndicate-level ML betting system.
 * Implements paper trading, A/B testing, and performance tracking.
 *
 * @version 1.0.0
 * @author Unit Talk Platform Engineering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveTestingSystem = exports.LiveTestingSystem = void 0;
const logger_1 = require("../utils/logger");
const supabaseClient_1 = require("../services/supabaseClient");
class LiveTestingSystem {
    constructor(config) {
        this.testResults = [];
        this.abTestGroup = 'control';
        this.config = {
            paperTradingEnabled: true,
            startingBankroll: 10000,
            maxBetSize: 100,
            confidenceThreshold: 0.6,
            abTestPercentage: 0.5,
            trackingEnabled: true,
            ...config
        };
        this.bankroll = this.config.startingBankroll;
    }
    /**
     * Run live test on a prediction
     */
    async runLiveTest(sport, prediction, confidence, betSize) {
        const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Determine A/B test group
        this.abTestGroup = Math.random() < this.config.abTestPercentage ? 'treatment' : 'control';
        // Apply different strategies based on test group
        if (this.abTestGroup === 'treatment') {
            confidence = this.applyTreatmentStrategy(confidence);
        }
        const result = {
            testId,
            timestamp: new Date(),
            sport,
            prediction,
            confidence
        };
        // Paper trading logic
        if (this.config.paperTradingEnabled && confidence >= this.config.confidenceThreshold) {
            const bet = Math.min(betSize || this.config.maxBetSize, this.bankroll * 0.05);
            logger_1.logger.info(`📝 Paper trade placed: ${sport} - $${bet} at ${confidence.toFixed(2)} confidence`);
            // Store for tracking
            this.testResults.push(result);
            // Track in database if enabled
            if (this.config.trackingEnabled) {
                await this.trackTestResult(result);
            }
        }
        return result;
    }
    /**
     * Apply treatment strategy for A/B testing
     */
    applyTreatmentStrategy(confidence) {
        // Treatment group uses more aggressive confidence scaling
        return Math.min(confidence * 1.1, 1.0);
    }
    /**
     * Track test result in database
     */
    async trackTestResult(result) {
        try {
            const { error } = await supabaseClient_1.supabase
                .from('live_test_results')
                .insert({
                test_id: result.testId,
                sport: result.sport,
                prediction: result.prediction,
                confidence: result.confidence,
                ab_group: this.abTestGroup,
                timestamp: result.timestamp.toISOString()
            });
            if (error) {
                logger_1.logger.error('Failed to track test result:', error);
            }
        }
        catch (error) {
            logger_1.logger.error('Error tracking test result:', error);
        }
    }
    /**
     * Update test with actual outcome
     */
    async updateOutcome(testId, actualOutcome) {
        const result = this.testResults.find(r => r.testId === testId);
        if (!result) {
            logger_1.logger.warn(`Test result not found: ${testId}`);
            return;
        }
        result.actualOutcome = actualOutcome;
        // Calculate profit/loss
        if (this.config.paperTradingEnabled) {
            const betSize = this.config.maxBetSize;
            result.profit = actualOutcome ? betSize : -betSize;
            this.bankroll += result.profit;
            result.roi = (result.profit / betSize) * 100;
            logger_1.logger.info(`📊 Test ${testId} outcome: ${actualOutcome ? 'WIN' : 'LOSS'} | Profit: $${result.profit} | ROI: ${result.roi}%`);
        }
        // Update in database
        if (this.config.trackingEnabled) {
            await supabaseClient_1.supabase
                .from('live_test_results')
                .update({
                actual_outcome: actualOutcome,
                profit: result.profit,
                roi: result.roi
            })
                .eq('test_id', testId);
        }
    }
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        const completedTests = this.testResults.filter(r => r.actualOutcome !== undefined);
        const wins = completedTests.filter(r => r.actualOutcome === true);
        const totalProfit = completedTests.reduce((sum, r) => sum + (r.profit || 0), 0);
        // A/B test comparison
        const controlResults = completedTests.filter(r => r.testId.includes('control'));
        const treatmentResults = completedTests.filter(r => r.testId.includes('treatment'));
        return {
            totalTests: completedTests.length,
            winRate: completedTests.length > 0 ? (wins.length / completedTests.length) * 100 : 0,
            totalProfit,
            roi: this.config.startingBankroll > 0
                ? ((this.bankroll - this.config.startingBankroll) / this.config.startingBankroll) * 100
                : 0,
            currentBankroll: this.bankroll,
            abTestComparison: {
                control: {
                    tests: controlResults.length,
                    winRate: controlResults.length > 0
                        ? (controlResults.filter(r => r.actualOutcome).length / controlResults.length) * 100
                        : 0
                },
                treatment: {
                    tests: treatmentResults.length,
                    winRate: treatmentResults.length > 0
                        ? (treatmentResults.filter(r => r.actualOutcome).length / treatmentResults.length) * 100
                        : 0
                }
            }
        };
    }
    /**
     * Reset testing system
     */
    reset() {
        this.bankroll = this.config.startingBankroll;
        this.testResults = [];
        logger_1.logger.info('🔄 Live testing system reset');
    }
    /**
     * Export test results for analysis
     */
    exportResults() {
        return [...this.testResults];
    }
}
exports.LiveTestingSystem = LiveTestingSystem;
// Export singleton instance
exports.liveTestingSystem = new LiveTestingSystem();
exports.default = LiveTestingSystem;
