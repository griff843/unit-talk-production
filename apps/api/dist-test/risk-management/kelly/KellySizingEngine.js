"use strict";
/**
 * Kelly Criterion Sizing Engine
 *
 * Professional-grade Kelly sizing implementation for optimal bet sizing and risk management.
 * Implements fractional Kelly (25%) with confidence adjustments, correlation penalties,
 * and portfolio context optimization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KellySizingEngine = void 0;
const logger_1 = require("../../utils/logger");
class KellySizingEngine {
    constructor(config, riskProfile) {
        this.logger = (0, logger_1.createLogger)('KellySizingEngine');
        // Kelly calculation statistics
        this.calculationHistory = [];
        this.performanceMetrics = {
            totalCalculations: 0,
            averageKelly: 0,
            maxKellyUsed: 0,
            rejectionRate: 0,
            adjustmentRate: 0
        };
        this.config = config;
        this.riskProfile = riskProfile;
        this.logger.info('Kelly Sizing Engine initialized', {
            kellyMultiplier: config.defaultMultiplier,
            maxKellyFraction: config.maxKellyFraction,
            minEdgeThreshold: config.minEdgeThreshold
        });
    }
    /**
     * Calculate optimal Kelly position size with all adjustments
     */
    async calculateOptimalSize(input) {
        const startTime = Date.now();
        try {
            // Step 1: Input validation
            const validation = this.validateInput(input);
            if (!validation.isValid) {
                return this.createRejectedResult(input, validation.violations);
            }
            // Step 2: Calculate base Kelly fraction
            const baseKelly = this.calculateBaseKelly(input.odds, input.winProbability, input.expectedValue);
            // Step 3: Apply fractional Kelly multiplier
            const fractionalKelly = baseKelly * this.config.defaultMultiplier;
            // Step 4: Apply risk adjustments
            const adjustments = await this.calculateRiskAdjustments(input);
            const adjustedKelly = this.applyAdjustments(fractionalKelly, adjustments);
            // Step 5: Apply portfolio constraints
            const portfolioAdjustedKelly = await this.applyPortfolioConstraints(adjustedKelly, input);
            // Step 6: Calculate final stake and validate limits
            const finalKelly = Math.min(portfolioAdjustedKelly, this.config.maxKellyFraction);
            const recommendedStake = finalKelly * input.bankroll;
            const maxStake = this.riskProfile.maxBetPercentage * input.bankroll;
            // Step 7: Final validation and recommendation
            const finalValidation = this.validateFinalResult(finalKelly, recommendedStake, input);
            const result = {
                positionId: `kelly-${input.propId}-${Date.now()}`,
                propId: input.propId,
                optimalFraction: baseKelly,
                fractionalKelly: finalKelly,
                recommendedStake: Math.min(recommendedStake, maxStake),
                maxStake,
                winProbability: input.winProbability,
                odds: input.odds,
                expectedValue: input.expectedValue,
                edge: input.expectedValue / 100,
                confidenceAdjustment: adjustments.confidenceAdjustment,
                correlationAdjustment: adjustments.correlationAdjustment,
                portfolioAdjustment: adjustments.portfolioAdjustment,
                riskScore: this.calculateRiskScore(input, adjustments),
                recommendation: finalValidation.isValid ? 'APPROVE' : 'REJECT',
                warnings: finalValidation.violations,
                calculatedAt: new Date().toISOString(),
                modelVersion: '1.0.0',
                bankrollAtCalculation: input.bankroll
            };
            // Update statistics
            this.updateStatistics(result);
            this.logger.info('Kelly calculation completed', {
                propId: input.propId,
                baseKelly: baseKelly.toFixed(4),
                finalKelly: finalKelly.toFixed(4),
                recommendedStake: result.recommendedStake.toFixed(2),
                recommendation: result.recommendation,
                processingTime: Date.now() - startTime
            });
            return result;
        }
        catch (error) {
            this.logger.error('Kelly calculation failed', {
                propId: input.propId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return this.createErrorResult(input, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    /**
     * Calculate Kelly for multiple positions simultaneously
     */
    async batchCalculateKelly(inputs) {
        const batchStartTime = Date.now();
        // Process in parallel with controlled concurrency
        const batchSize = 50;
        const results = [];
        for (let i = 0; i < inputs.length; i += batchSize) {
            const batch = inputs.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(input => this.calculateOptimalSize(input)));
            results.push(...batchResults);
        }
        this.logger.info('Batch Kelly calculation completed', {
            totalPositions: inputs.length,
            batches: Math.ceil(inputs.length / batchSize),
            avgKelly: results.reduce((sum, r) => sum + r.fractionalKelly, 0) / results.length,
            approvalRate: results.filter(r => r.recommendation === 'APPROVE').length / results.length,
            processingTime: Date.now() - batchStartTime
        });
        return results;
    }
    /**
     * Validate Kelly calculation input
     */
    validateInput(input) {
        const violations = [];
        // Validate odds
        if (!input.odds || input.odds === 0) {
            violations.push('Invalid odds: odds cannot be zero');
        }
        // Validate win probability
        if (input.winProbability <= 0 || input.winProbability >= 1) {
            violations.push(`Invalid win probability: ${input.winProbability} (must be between 0 and 1)`);
        }
        // Validate expected value threshold
        if (input.expectedValue < this.config.minEdgeThreshold) {
            violations.push(`Expected value ${input.expectedValue}% below minimum threshold ${this.config.minEdgeThreshold}%`);
        }
        // Validate confidence
        if (input.confidence < 0 || input.confidence > 100) {
            violations.push(`Invalid confidence: ${input.confidence} (must be between 0 and 100)`);
        }
        // Validate bankroll
        if (input.bankroll <= 0) {
            violations.push('Invalid bankroll: must be positive');
        }
        // Check for arbitrage opportunities (too good to be true)
        const impliedProb = this.oddsToImpliedProbability(input.odds);
        if (input.winProbability > impliedProb + 0.3) {
            violations.push('Extremely high edge detected - verify probability estimates');
        }
        return {
            isValid: violations.length === 0,
            violations,
            adjustedFraction: 0,
            reasoning: violations
        };
    }
    /**
     * Calculate base Kelly fraction using the Kelly formula
     */
    calculateBaseKelly(odds, winProbability, expectedValue) {
        // Convert American odds to decimal
        const decimalOdds = this.americanToDecimal(odds);
        const b = decimalOdds - 1; // Net odds
        // Kelly formula: f = (bp - q) / b
        // Where: b = net odds, p = win probability, q = lose probability
        const p = winProbability;
        const q = 1 - p;
        const kellyFraction = (b * p - q) / b;
        // Ensure Kelly fraction is non-negative
        return Math.max(0, kellyFraction);
    }
    /**
     * Calculate all risk adjustments to apply to Kelly fraction
     */
    async calculateRiskAdjustments(input) {
        // Confidence adjustment (reduce size for lower confidence)
        const confidenceAdjustment = this.config.confidenceAdjustment
            ? Math.max(0.2, input.confidence / 100)
            : 1.0;
        // Correlation adjustment (reduce size for high correlation)
        const correlationAdjustment = this.config.correlationAdjustment && input.correlatedExposure
            ? Math.max(0.5, 1 - (input.correlatedExposure / input.bankroll))
            : 1.0;
        // Portfolio context adjustment
        const portfolioAdjustment = input.portfolioContext
            ? this.calculatePortfolioAdjustment(input.portfolioContext)
            : 1.0;
        // Variance adjustment (for Kelly optimization)
        const varianceAdjustment = input.variance
            ? Math.max(0.7, 1 - Math.min(0.3, input.variance))
            : 1.0;
        // Combined adjustment (multiplicative)
        const overallAdjustment = confidenceAdjustment * correlationAdjustment * portfolioAdjustment * varianceAdjustment;
        return {
            confidenceAdjustment,
            correlationAdjustment,
            portfolioAdjustment,
            varianceAdjustment,
            overallAdjustment
        };
    }
    /**
     * Apply calculated adjustments to Kelly fraction
     */
    applyAdjustments(baseFraction, adjustments) {
        return baseFraction * adjustments.overallAdjustment;
    }
    /**
     * Apply portfolio-level constraints to Kelly sizing
     */
    async applyPortfolioConstraints(kellyFraction, input) {
        let constrainedFraction = kellyFraction;
        // Maximum position size constraint
        const maxPositionSize = this.riskProfile.maxBetPercentage;
        constrainedFraction = Math.min(constrainedFraction, maxPositionSize);
        // Portfolio exposure constraint
        if (input.portfolioContext) {
            const currentExposureRatio = input.portfolioContext.currentExposure / input.bankroll;
            // Reduce Kelly if portfolio is highly exposed
            if (currentExposureRatio > 0.7) {
                constrainedFraction *= 0.5; // 50% reduction for high exposure
            }
            else if (currentExposureRatio > 0.5) {
                constrainedFraction *= 0.75; // 25% reduction for medium exposure
            }
            // Available capital constraint
            const maxStakeFromCapital = input.portfolioContext.availableCapital / input.bankroll;
            constrainedFraction = Math.min(constrainedFraction, maxStakeFromCapital);
        }
        // Risk budget constraint
        if (input.portfolioContext?.riskBudget) {
            const riskBudgetFraction = input.portfolioContext.riskBudget / input.bankroll;
            constrainedFraction = Math.min(constrainedFraction, riskBudgetFraction);
        }
        return constrainedFraction;
    }
    /**
     * Calculate portfolio context adjustment factor
     */
    calculatePortfolioAdjustment(context) {
        let adjustment = 1.0;
        // Exposure adjustment
        const exposureRatio = context.currentExposure / context.availableCapital;
        if (exposureRatio > 0.8) {
            adjustment *= 0.6; // 40% reduction for very high exposure
        }
        else if (exposureRatio > 0.6) {
            adjustment *= 0.8; // 20% reduction for high exposure
        }
        // Correlated positions adjustment
        if (context.correlatedPositions && context.correlatedPositions.length > 0) {
            const correlationPenalty = Math.min(0.5, context.correlatedPositions.length * 0.1);
            adjustment *= (1 - correlationPenalty);
        }
        return Math.max(0.1, adjustment); // Minimum 10% of original size
    }
    /**
     * Final validation of Kelly result
     */
    validateFinalResult(kellyFraction, recommendedStake, input) {
        const violations = [];
        // Check maximum Kelly limit
        if (kellyFraction > this.config.maxKellyFraction) {
            violations.push(`Kelly fraction ${kellyFraction.toFixed(4)} exceeds maximum ${this.config.maxKellyFraction}`);
        }
        // Check maximum position size
        const positionSizeRatio = recommendedStake / input.bankroll;
        if (positionSizeRatio > this.riskProfile.maxBetPercentage) {
            violations.push(`Position size ${(positionSizeRatio * 100).toFixed(2)}% exceeds maximum ${(this.riskProfile.maxBetPercentage * 100).toFixed(2)}%`);
        }
        // Check minimum stake threshold
        const minStake = input.bankroll * 0.001; // 0.1% minimum
        if (recommendedStake > 0 && recommendedStake < minStake) {
            violations.push(`Stake ${recommendedStake.toFixed(2)} below minimum threshold ${minStake.toFixed(2)}`);
        }
        // Check for negative Kelly (shouldn't happen but safety check)
        if (kellyFraction < 0) {
            violations.push('Negative Kelly fraction indicates negative expected value');
        }
        return {
            isValid: violations.length === 0,
            violations,
            adjustedFraction: kellyFraction,
            reasoning: violations
        };
    }
    /**
     * Calculate overall risk score for the position
     */
    calculateRiskScore(input, adjustments) {
        let riskScore = 0;
        // Base risk from Kelly fraction
        if (adjustments.overallAdjustment < 0.5)
            riskScore += 3;
        else if (adjustments.overallAdjustment < 0.8)
            riskScore += 2;
        else if (adjustments.overallAdjustment < 0.9)
            riskScore += 1;
        // Confidence risk
        if (input.confidence < 60)
            riskScore += 3;
        else if (input.confidence < 75)
            riskScore += 2;
        else if (input.confidence < 85)
            riskScore += 1;
        // Expected value risk
        if (input.expectedValue < 3)
            riskScore += 2;
        else if (input.expectedValue < 5)
            riskScore += 1;
        // Odds risk (extreme odds = higher risk)
        const absOdds = Math.abs(input.odds);
        if (absOdds > 300)
            riskScore += 2;
        else if (absOdds > 200)
            riskScore += 1;
        return Math.min(10, riskScore);
    }
    /**
     * Convert American odds to decimal odds
     */
    americanToDecimal(americanOdds) {
        if (americanOdds > 0) {
            return (americanOdds / 100) + 1;
        }
        else {
            return (100 / Math.abs(americanOdds)) + 1;
        }
    }
    /**
     * Convert odds to implied probability
     */
    oddsToImpliedProbability(americanOdds) {
        if (americanOdds > 0) {
            return 100 / (americanOdds + 100);
        }
        else {
            return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
        }
    }
    /**
     * Create rejected result
     */
    createRejectedResult(input, violations) {
        return {
            positionId: `kelly-${input.propId}-rejected-${Date.now()}`,
            propId: input.propId,
            optimalFraction: 0,
            fractionalKelly: 0,
            recommendedStake: 0,
            maxStake: this.riskProfile.maxBetPercentage * input.bankroll,
            winProbability: input.winProbability,
            odds: input.odds,
            expectedValue: input.expectedValue,
            edge: input.expectedValue / 100,
            confidenceAdjustment: 0,
            correlationAdjustment: 0,
            portfolioAdjustment: 0,
            riskScore: 10,
            recommendation: 'REJECT',
            warnings: violations,
            calculatedAt: new Date().toISOString(),
            modelVersion: '1.0.0',
            bankrollAtCalculation: input.bankroll
        };
    }
    /**
     * Create error result
     */
    createErrorResult(input, errorMessage) {
        return {
            positionId: `kelly-${input.propId}-error-${Date.now()}`,
            propId: input.propId,
            optimalFraction: 0,
            fractionalKelly: 0,
            recommendedStake: 0,
            maxStake: 0,
            winProbability: input.winProbability,
            odds: input.odds,
            expectedValue: input.expectedValue,
            edge: 0,
            confidenceAdjustment: 0,
            correlationAdjustment: 0,
            portfolioAdjustment: 0,
            riskScore: 10,
            recommendation: 'REJECT',
            warnings: [`Calculation error: ${errorMessage}`],
            calculatedAt: new Date().toISOString(),
            modelVersion: '1.0.0-error',
            bankrollAtCalculation: input.bankroll
        };
    }
    /**
     * Update calculation statistics
     */
    updateStatistics(result) {
        this.performanceMetrics.totalCalculations++;
        // Update running averages
        const count = this.performanceMetrics.totalCalculations;
        this.performanceMetrics.averageKelly =
            ((this.performanceMetrics.averageKelly * (count - 1)) + result.fractionalKelly) / count;
        this.performanceMetrics.maxKellyUsed = Math.max(this.performanceMetrics.maxKellyUsed, result.fractionalKelly);
        // Update rates
        const recentResults = this.calculationHistory.slice(-100); // Last 100 results
        this.performanceMetrics.rejectionRate =
            recentResults.filter(r => r.recommendation === 'REJECT').length / recentResults.length;
        this.performanceMetrics.adjustmentRate =
            recentResults.filter(r => r.fractionalKelly < r.optimalFraction * 0.9).length / recentResults.length;
        // Store result in history (keep last 1000 results)
        this.calculationHistory.push(result);
        if (this.calculationHistory.length > 1000) {
            this.calculationHistory = this.calculationHistory.slice(-1000);
        }
    }
    /**
     * Get Kelly engine performance statistics
     */
    getPerformanceStatistics() {
        return {
            ...this.performanceMetrics,
            recentCalculations: this.calculationHistory.slice(-10).map(r => ({
                propId: r.propId,
                fractionalKelly: r.fractionalKelly,
                recommendedStake: r.recommendedStake,
                recommendation: r.recommendation,
                calculatedAt: r.calculatedAt
            }))
        };
    }
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile) {
        this.riskProfile = newProfile;
        this.logger.info('Risk profile updated for Kelly engine', {
            profileId: newProfile.id,
            maxBetPercentage: newProfile.maxBetPercentage
        });
    }
    /**
     * Update Kelly configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Kelly configuration updated', {
            changes: Object.keys(newConfig)
        });
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Calculate Kelly efficiency for a completed bet
     */
    calculateKellyEfficiency(actualStake, recommendedStake, outcome, actualOdds) {
        // Kelly efficiency measures how close the actual bet was to optimal
        const stakeRatio = recommendedStake > 0 ? actualStake / recommendedStake : 0;
        const efficiency = stakeRatio > 1 ? 1 / stakeRatio : stakeRatio; // Penalize both over and under betting
        // Utility calculation (logarithmic utility function)
        const decimalOdds = this.americanToDecimal(actualOdds);
        const optimalUtility = outcome === 'WIN'
            ? Math.log(1 + recommendedStake * (decimalOdds - 1))
            : Math.log(1 - recommendedStake);
        const actualUtility = outcome === 'WIN'
            ? Math.log(1 + actualStake * (decimalOdds - 1))
            : Math.log(1 - actualStake);
        return {
            efficiency,
            utilityGained: actualUtility > 0 ? actualUtility : 0,
            utilityLost: actualUtility < optimalUtility ? optimalUtility - actualUtility : 0,
            optimalUtility,
            actualUtility
        };
    }
}
exports.KellySizingEngine = KellySizingEngine;
