"use strict";
/**
 * Risk Management Engine
 *
 * Central orchestrator for all risk management functions in the Unit Talk platform.
 * Integrates Kelly sizing, correlation analysis, portfolio optimization, and automated controls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManagementEngine = void 0;
const logger_1 = require("../../utils/logger");
const KellySizingEngine_1 = require("../kelly/KellySizingEngine");
const CorrelationManager_1 = require("../correlation/CorrelationManager");
const PortfolioOptimizer_1 = require("../portfolio/PortfolioOptimizer");
const AutomatedRiskControls_1 = require("../controls/AutomatedRiskControls");
const RiskMetricsCalculator_1 = require("../metrics/RiskMetricsCalculator");
class RiskManagementEngine {
    constructor(config, riskProfile) {
        this.logger = (0, logger_1.createLogger)('RiskManagementEngine');
        this.positions = new Map();
        this.activeAlerts = new Map();
        this.riskProfile = riskProfile;
        // Initialize risk management components
        this.kellySizing = new KellySizingEngine_1.KellySizingEngine(config.kelly, riskProfile);
        this.correlationManager = new CorrelationManager_1.CorrelationManager(config.correlation);
        this.portfolioOptimizer = new PortfolioOptimizer_1.PortfolioOptimizer(config.portfolio, riskProfile);
        this.automatedControls = new AutomatedRiskControls_1.AutomatedRiskControls(config.alerts, this);
        this.metricsCalculator = new RiskMetricsCalculator_1.RiskMetricsCalculator(riskProfile);
        this.logger.info('Risk Management Engine initialized', {
            riskProfile: riskProfile.id,
            bankroll: riskProfile.bankroll,
            riskTolerance: riskProfile.riskTolerance
        });
    }
    /**
     * Comprehensive risk assessment for a single prop
     */
    async assessPropRisk(prop) {
        const startTime = Date.now();
        try {
            // Step 1: Calculate Kelly sizing
            const kellyResult = await this.kellySizing.calculateOptimalSize({
                propId: prop.propId,
                odds: prop.odds,
                winProbability: prop.winProbability,
                expectedValue: prop.expectedValue,
                confidence: prop.confidence,
                bankroll: this.riskProfile.bankroll
            });
            // Step 2: Analyze correlations with existing positions
            const correlationRisk = await this.correlationManager.assessCorrelationRisk({
                propId: prop.propId,
                sport: prop.sport,
                player: prop.player,
                gameId: prop.gameId,
                marketType: prop.marketType
            }, Array.from(this.positions.values()));
            // Step 3: Calculate position-specific risk metrics
            const positionRisk = await this.calculatePositionRisk(prop, kellyResult, correlationRisk);
            // Step 4: Assess portfolio impact
            const portfolioImpact = await this.assessPortfolioImpact(prop, kellyResult.recommendedStake);
            // Step 5: Apply risk limits and generate recommendation
            const { recommendation, warnings, suggestedStake, maxStake } = this.applyRiskLimits(prop, kellyResult, positionRisk, correlationRisk, portfolioImpact);
            // Step 6: Identify risk factors
            const riskFactors = this.identifyRiskFactors(positionRisk, correlationRisk, portfolioImpact);
            const assessment = {
                propId: prop.propId,
                overallRisk: this.calculateOverallRisk(positionRisk, correlationRisk, portfolioImpact),
                riskBreakdown: positionRisk,
                riskFactors,
                kellyResult,
                recommendation,
                suggestedStake,
                maxStake,
                warnings,
                correlationRisk: correlationRisk.overallRisk,
                portfolioImpact
            };
            this.logger.info('Prop risk assessment completed', {
                propId: prop.propId,
                recommendation: assessment.recommendation,
                overallRisk: assessment.overallRisk,
                processingTime: Date.now() - startTime
            });
            return assessment;
        }
        catch (error) {
            this.logger.error('Risk assessment failed', {
                propId: prop.propId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Return conservative fallback assessment
            return this.createFallbackAssessment(prop);
        }
    }
    /**
     * Add position to portfolio and update risk metrics
     */
    async addPosition(position) {
        this.positions.set(position.id, position);
        // Update correlations
        await this.correlationManager.addPosition(position);
        // Check for new risk alerts
        const newAlerts = await this.checkRiskAlerts();
        for (const alert of newAlerts) {
            this.activeAlerts.set(alert.id, alert);
        }
        // Trigger automated controls if needed
        await this.automatedControls.evaluatePosition(position);
        this.logger.info('Position added to portfolio', {
            positionId: position.id,
            propId: position.propId,
            stake: position.stake,
            totalPositions: this.positions.size
        });
    }
    /**
     * Remove position from portfolio
     */
    async removePosition(positionId) {
        const position = this.positions.get(positionId);
        if (!position) {
            throw new Error(`Position not found: ${positionId}`);
        }
        this.positions.delete(positionId);
        // Update correlations
        await this.correlationManager.removePosition(position);
        this.logger.info('Position removed from portfolio', {
            positionId,
            totalPositions: this.positions.size
        });
    }
    /**
     * Get comprehensive portfolio risk analysis
     */
    async getPortfolioRisk() {
        const positions = Array.from(this.positions.values());
        if (positions.length === 0) {
            return this.createEmptyPortfolioRisk();
        }
        const [totalExposure, totalRisk, sharpeRatio, maxDrawdown, currentDrawdown, varResults, correlationMatrix, exposureBreakdown, concentrationRisk, performanceMetrics] = await Promise.all([
            this.calculateTotalExposure(positions),
            this.calculateTotalRisk(positions),
            this.metricsCalculator.calculateSharpeRatio(positions),
            this.metricsCalculator.calculateMaxDrawdown(positions),
            this.metricsCalculator.calculateCurrentDrawdown(positions),
            this.metricsCalculator.calculateVaR(positions),
            this.correlationManager.getCorrelationMatrix(),
            this.calculateExposureBreakdown(positions),
            this.calculateConcentrationRisk(positions),
            this.calculatePerformanceMetrics(positions)
        ]);
        return {
            totalExposure,
            availableCapital: this.riskProfile.bankroll - totalExposure,
            totalRisk,
            sharpeRatio,
            maxDrawdown,
            currentDrawdown,
            valueAtRisk95: varResults.var95.value,
            valueAtRisk99: varResults.var99.value,
            expectedShortfall: varResults.expectedShortfall95.value,
            volatility: performanceMetrics.volatility,
            beta: performanceMetrics.beta,
            correlationMatrix,
            maxPositionCorrelation: correlationMatrix.stats.maxCorrelation,
            diversificationRatio: this.calculateDiversificationRatio(positions),
            exposureByCategory: exposureBreakdown,
            concentrationRisk,
            currentPnL: performanceMetrics.currentPnL,
            realizedPnL: performanceMetrics.realizedPnL,
            unrealizedPnL: performanceMetrics.unrealizedPnL,
            averageHoldTime: performanceMetrics.averageHoldTime,
            winRate: performanceMetrics.winRate,
            lastUpdated: new Date().toISOString(),
            calculationTime: Date.now() - Date.now()
        };
    }
    /**
     * Get all active risk alerts
     */
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values())
            .sort((a, b) => {
            // Sort by severity then by priority
            const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
            if (severityDiff !== 0)
                return severityDiff;
            return b.priority - a.priority;
        });
    }
    /**
     * Optimize portfolio for better risk-adjusted returns
     */
    async optimizePortfolio(objective = 'SHARPE') {
        const positions = Array.from(this.positions.values());
        return await this.portfolioOptimizer.optimize(positions, objective);
    }
    /**
     * Execute risk control action
     */
    async executeRiskControl(action) {
        await this.automatedControls.executeAction(action);
        this.logger.info('Risk control action executed', {
            actionId: action.id,
            type: action.type,
            affectedPositions: action.targetPositions.length
        });
    }
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile) {
        this.riskProfile = { ...this.riskProfile, ...newProfile, updated: new Date().toISOString() };
        // Update components with new profile
        this.kellySizing.updateRiskProfile(this.riskProfile);
        this.portfolioOptimizer.updateRiskProfile(this.riskProfile);
        this.metricsCalculator.updateRiskProfile(this.riskProfile);
        this.logger.info('Risk profile updated', {
            profileId: this.riskProfile.id,
            changes: Object.keys(newProfile)
        });
    }
    /**
     * Get current risk profile
     */
    getRiskProfile() {
        return { ...this.riskProfile };
    }
    /**
     * Get all positions
     */
    getPositions() {
        return Array.from(this.positions.values());
    }
    /**
     * Get risk metrics for portfolio
     */
    async getRiskMetrics() {
        const positions = Array.from(this.positions.values());
        return await this.metricsCalculator.calculateComprehensiveMetrics(positions);
    }
    // ========================================
    // Private Helper Methods
    // ========================================
    async calculatePositionRisk(prop, kellyResult, correlationRisk) {
        const individualRisk = this.calculateIndividualRisk(prop, kellyResult);
        const liquidityRisk = this.assessLiquidityRisk(prop);
        const timingRisk = this.assessTimingRisk(prop);
        return {
            individualRisk,
            correlationRisk: correlationRisk.overallRisk,
            concentrationRisk: await this.calculatePositionConcentrationRisk(prop),
            liquidityRisk,
            timingRisk,
            portfolioContribution: 0, // Will be calculated after position is added
            valueAtRisk: kellyResult.recommendedStake * 0.05, // 5% VaR estimate
            expectedShortfall: kellyResult.recommendedStake * 0.08, // 8% ES estimate
            maxDrawdownContribution: kellyResult.recommendedStake * 0.03 // 3% DD contribution
        };
    }
    calculateIndividualRisk(prop, kellyResult) {
        let risk = 0;
        // Odds risk - higher odds = higher risk
        if (Math.abs(prop.odds) > 300)
            risk += 3;
        else if (Math.abs(prop.odds) > 200)
            risk += 2;
        else if (Math.abs(prop.odds) > 150)
            risk += 1;
        // Confidence risk
        if (prop.confidence < 60)
            risk += 3;
        else if (prop.confidence < 75)
            risk += 2;
        else if (prop.confidence < 85)
            risk += 1;
        // Kelly fraction risk
        if (kellyResult.optimalFraction > 0.15)
            risk += 2;
        else if (kellyResult.optimalFraction > 0.10)
            risk += 1;
        // Expected value risk
        if (prop.expectedValue < 2)
            risk += 2;
        else if (prop.expectedValue < 5)
            risk += 1;
        return Math.min(10, risk);
    }
    assessLiquidityRisk(prop) {
        let risk = 0;
        // Sport liquidity
        const liquidSports = ['NFL', 'NBA', 'MLB', 'NHL'];
        if (!liquidSports.includes(prop.sport))
            risk += 2;
        // Market type liquidity
        if (prop.marketType.includes('player'))
            risk += 1;
        if (prop.marketType.includes('team'))
            risk -= 1;
        // Odds liquidity (extreme odds = less liquid)
        if (Math.abs(prop.odds) > 400)
            risk += 3;
        else if (Math.abs(prop.odds) > 300)
            risk += 2;
        return Math.min(10, Math.max(0, risk));
    }
    assessTimingRisk(prop) {
        const hoursToGame = this.calculateHoursToGame(prop.gameTime);
        if (hoursToGame < 1)
            return 8; // Very high risk
        if (hoursToGame < 2)
            return 6; // High risk
        if (hoursToGame < 6)
            return 4; // Medium risk
        if (hoursToGame > 48)
            return 3; // Early betting risk
        return 2; // Low risk for optimal timing window
    }
    async calculatePositionConcentrationRisk(prop) {
        let risk = 0;
        // Sport concentration
        const sportExposure = this.getSportExposure(prop.sport);
        if (sportExposure > this.riskProfile.maxSportExposure * 0.8)
            risk += 3;
        else if (sportExposure > this.riskProfile.maxSportExposure * 0.6)
            risk += 2;
        // Player concentration
        const playerExposure = this.getPlayerExposure(prop.player);
        if (playerExposure > this.riskProfile.maxPlayerExposure * 0.8)
            risk += 3;
        else if (playerExposure > this.riskProfile.maxPlayerExposure * 0.6)
            risk += 2;
        // Game concentration
        if (prop.gameId) {
            const gameExposure = this.getGameExposure(prop.gameId);
            if (gameExposure > this.riskProfile.maxGameExposure * 0.8)
                risk += 4;
            else if (gameExposure > this.riskProfile.maxGameExposure * 0.6)
                risk += 2;
        }
        return Math.min(10, risk);
    }
    async assessPortfolioImpact(prop, stake) {
        const currentExposure = await this.calculateTotalExposure(Array.from(this.positions.values()));
        const newExposure = currentExposure + stake;
        const exposureRatio = newExposure / this.riskProfile.bankroll;
        // Impact based on how much this position affects total exposure
        if (exposureRatio > 0.8)
            return 8; // High impact
        if (exposureRatio > 0.6)
            return 6; // Medium-high impact
        if (exposureRatio > 0.4)
            return 4; // Medium impact
        if (exposureRatio > 0.2)
            return 2; // Low-medium impact
        return 1; // Low impact
    }
    applyRiskLimits(prop, kellyResult, positionRisk, correlationRisk, portfolioImpact) {
        const warnings = [];
        let suggestedStake = kellyResult.recommendedStake;
        const maxStake = this.riskProfile.bankroll * this.riskProfile.maxBetPercentage;
        // Apply maximum bet size limit
        if (suggestedStake > maxStake) {
            suggestedStake = maxStake;
            warnings.push(`Stake reduced to maximum allowed: ${maxStake}`);
        }
        // Check individual risk
        if (positionRisk.individualRisk > 8) {
            suggestedStake *= 0.5;
            warnings.push('High individual risk - stake reduced by 50%');
        }
        // Check correlation risk
        if (correlationRisk.overallRisk > 7) {
            suggestedStake *= 0.7;
            warnings.push('High correlation risk - stake reduced by 30%');
        }
        // Check portfolio impact
        if (portfolioImpact > 6) {
            suggestedStake *= 0.8;
            warnings.push('High portfolio impact - stake reduced by 20%');
        }
        // Determine recommendation
        let recommendation;
        const overallRisk = this.calculateOverallRisk(positionRisk, correlationRisk, portfolioImpact);
        if (overallRisk <= 4 && prop.confidence >= 75) {
            recommendation = 'APPROVE';
        }
        else if (overallRisk <= 7 && prop.confidence >= 60) {
            recommendation = 'REDUCE';
            suggestedStake *= 0.6;
            warnings.push('Medium risk - stake reduced for safety');
        }
        else {
            recommendation = 'REJECT';
            suggestedStake = 0;
            warnings.push('Risk too high - position rejected');
        }
        return { recommendation, warnings, suggestedStake, maxStake };
    }
    identifyRiskFactors(positionRisk, correlationRisk, portfolioImpact) {
        const factors = [];
        if (positionRisk.individualRisk > 6)
            factors.push('High individual position risk');
        if (positionRisk.correlationRisk > 6)
            factors.push('High correlation with existing positions');
        if (positionRisk.concentrationRisk > 6)
            factors.push('Portfolio concentration concerns');
        if (positionRisk.liquidityRisk > 6)
            factors.push('Liquidity constraints');
        if (positionRisk.timingRisk > 6)
            factors.push('Poor timing for position entry');
        if (portfolioImpact > 6)
            factors.push('Significant portfolio impact');
        return factors;
    }
    calculateOverallRisk(positionRisk, correlationRisk, portfolioImpact) {
        const weightedRisk = positionRisk.individualRisk * 0.25 +
            positionRisk.correlationRisk * 0.20 +
            positionRisk.concentrationRisk * 0.20 +
            positionRisk.liquidityRisk * 0.15 +
            positionRisk.timingRisk * 0.10 +
            portfolioImpact * 0.10;
        return Math.min(10, Math.max(0, weightedRisk));
    }
    createFallbackAssessment(prop) {
        return {
            propId: prop.propId,
            overallRisk: 8,
            riskBreakdown: {
                individualRisk: 8,
                correlationRisk: 5,
                concentrationRisk: 5,
                liquidityRisk: 5,
                timingRisk: 5,
                portfolioContribution: 0,
                valueAtRisk: 0,
                expectedShortfall: 0,
                maxDrawdownContribution: 0
            },
            riskFactors: ['Assessment failed - high risk assumed'],
            kellyResult: {
                positionId: prop.propId,
                propId: prop.propId,
                optimalFraction: 0,
                fractionalKelly: 0,
                recommendedStake: 0,
                maxStake: 0,
                winProbability: 0.5,
                odds: prop.odds,
                expectedValue: 0,
                edge: 0,
                confidenceAdjustment: 0,
                correlationAdjustment: 0,
                portfolioAdjustment: 0,
                riskScore: 10,
                recommendation: 'REJECT',
                warnings: ['Risk assessment failed'],
                calculatedAt: new Date().toISOString(),
                modelVersion: '1.0.0-fallback',
                bankrollAtCalculation: this.riskProfile.bankroll
            },
            recommendation: 'REJECT',
            suggestedStake: 0,
            maxStake: 0,
            warnings: ['Risk assessment failed - position rejected for safety'],
            correlationRisk: 5,
            portfolioImpact: 5
        };
    }
    async checkRiskAlerts() {
        const alerts = [];
        const portfolioRisk = await this.getPortfolioRisk();
        // Check exposure limits
        if (portfolioRisk.totalExposure > this.riskProfile.bankroll * 0.8) {
            alerts.push({
                id: `exposure-${Date.now()}`,
                type: 'EXPOSURE',
                severity: 'HIGH',
                title: 'High Portfolio Exposure',
                message: `Portfolio exposure at ${(portfolioRisk.totalExposure / this.riskProfile.bankroll * 100).toFixed(1)}%`,
                threshold: 0.8,
                currentValue: portfolioRisk.totalExposure / this.riskProfile.bankroll,
                breachPercentage: ((portfolioRisk.totalExposure / this.riskProfile.bankroll) - 0.8) * 100,
                recommendation: 'Consider reducing position sizes',
                suggestedActions: [],
                affectedPositions: [],
                estimatedImpact: portfolioRisk.totalExposure * 0.1,
                timeToResolve: 2,
                status: 'ACTIVE',
                priority: 7,
                triggeredAt: new Date().toISOString(),
                category: 'exposure',
                tags: ['portfolio', 'exposure'],
                relatedAlerts: []
            });
        }
        // Check drawdown
        if (portfolioRisk.currentDrawdown > this.riskProfile.drawdownTriggers.alertDrawdown) {
            alerts.push({
                id: `drawdown-${Date.now()}`,
                type: 'DRAWDOWN',
                severity: portfolioRisk.currentDrawdown > this.riskProfile.drawdownTriggers.maxDrawdown ? 'CRITICAL' : 'HIGH',
                title: 'Portfolio Drawdown Alert',
                message: `Current drawdown: ${(portfolioRisk.currentDrawdown * 100).toFixed(2)}%`,
                threshold: this.riskProfile.drawdownTriggers.alertDrawdown,
                currentValue: portfolioRisk.currentDrawdown,
                breachPercentage: (portfolioRisk.currentDrawdown - this.riskProfile.drawdownTriggers.alertDrawdown) * 100,
                recommendation: 'Review portfolio and consider risk reduction',
                suggestedActions: [],
                affectedPositions: [],
                estimatedImpact: portfolioRisk.totalExposure * portfolioRisk.currentDrawdown,
                timeToResolve: 4,
                status: 'ACTIVE',
                priority: portfolioRisk.currentDrawdown > this.riskProfile.drawdownTriggers.maxDrawdown ? 10 : 8,
                triggeredAt: new Date().toISOString(),
                category: 'drawdown',
                tags: ['portfolio', 'drawdown'],
                relatedAlerts: []
            });
        }
        return alerts;
    }
    // Helper methods for exposure calculations
    getSportExposure(sport) {
        return Array.from(this.positions.values())
            .filter(p => p.sport === sport)
            .reduce((sum, p) => sum + p.stake, 0);
    }
    getPlayerExposure(player) {
        return Array.from(this.positions.values())
            .filter(p => p.player === player)
            .reduce((sum, p) => sum + p.stake, 0);
    }
    getGameExposure(gameId) {
        return Array.from(this.positions.values())
            .filter(p => p.gameId === gameId)
            .reduce((sum, p) => sum + p.stake, 0);
    }
    calculateHoursToGame(gameTime) {
        try {
            const game = new Date(gameTime);
            const now = new Date();
            return Math.max(0, (game.getTime() - now.getTime()) / (1000 * 60 * 60));
        }
        catch {
            return 12; // Default assumption
        }
    }
    async calculateTotalExposure(positions) {
        return positions.reduce((sum, p) => sum + p.stake, 0);
    }
    async calculateTotalRisk(positions) {
        if (positions.length === 0)
            return 0;
        const avgRisk = positions.reduce((sum, p) => {
            return sum + (p.riskMetrics?.individualRisk || 5);
        }, 0) / positions.length;
        return avgRisk;
    }
    calculateDiversificationRatio(positions) {
        if (positions.length <= 1)
            return 0;
        // Simplified diversification ratio - would be more complex in production
        const sports = new Set(positions.map(p => p.sport));
        const players = new Set(positions.map(p => p.player));
        return Math.min(1, (sports.size * players.size) / (positions.length * 2));
    }
    async calculateExposureBreakdown(positions) {
        const breakdown = {
            bySport: {},
            byPlayer: {},
            byMarketType: {},
            byGame: {},
            byTier: {},
            byTimeToGame: {}
        };
        for (const position of positions) {
            // By sport
            breakdown.bySport[position.sport] = (breakdown.bySport[position.sport] || 0) + position.stake;
            // By player
            breakdown.byPlayer[position.player] = (breakdown.byPlayer[position.player] || 0) + position.stake;
            // By market type
            breakdown.byMarketType[position.marketType] = (breakdown.byMarketType[position.marketType] || 0) + position.stake;
            // By game
            if (position.gameId) {
                breakdown.byGame[position.gameId] = (breakdown.byGame[position.gameId] || 0) + position.stake;
            }
            // By tier
            breakdown.byTier[position.tier] = (breakdown.byTier[position.tier] || 0) + position.stake;
            // By time to game
            const timeCategory = position.hoursToGame > 24 ? '24h+' :
                position.hoursToGame > 12 ? '12-24h' :
                    position.hoursToGame > 6 ? '6-12h' :
                        position.hoursToGame > 2 ? '2-6h' : '<2h';
            breakdown.byTimeToGame[timeCategory] = (breakdown.byTimeToGame[timeCategory] || 0) + position.stake;
        }
        return breakdown;
    }
    async calculateConcentrationRisk(positions) {
        if (positions.length === 0) {
            return {
                topGameExposure: 0,
                topPlayerExposure: 0,
                topSportExposure: 0,
                herfindahlIndex: 0,
                effectivePositions: 0
            };
        }
        const exposureBreakdown = await this.calculateExposureBreakdown(positions);
        const totalExposure = positions.reduce((sum, p) => sum + p.stake, 0);
        return {
            topGameExposure: Math.max(...Object.values(exposureBreakdown.byGame)) / totalExposure,
            topPlayerExposure: Math.max(...Object.values(exposureBreakdown.byPlayer)) / totalExposure,
            topSportExposure: Math.max(...Object.values(exposureBreakdown.bySport)) / totalExposure,
            herfindahlIndex: this.calculateHerfindahlIndex(positions),
            effectivePositions: positions.length / this.calculateConcentrationFactor(positions)
        };
    }
    calculateHerfindahlIndex(positions) {
        const totalExposure = positions.reduce((sum, p) => sum + p.stake, 0);
        if (totalExposure === 0)
            return 0;
        return positions.reduce((sum, p) => {
            const weight = p.stake / totalExposure;
            return sum + (weight * weight);
        }, 0);
    }
    calculateConcentrationFactor(positions) {
        // Simplified concentration factor
        return Math.min(5, Math.max(1, positions.length / 10));
    }
    async calculatePerformanceMetrics(positions) {
        return {
            volatility: 0.15, // Default 15% volatility
            beta: 1.0, // Default beta
            currentPnL: 0,
            realizedPnL: 0,
            unrealizedPnL: 0,
            averageHoldTime: 24, // Default 24 hours
            winRate: 0.55 // Default 55% win rate
        };
    }
    createEmptyPortfolioRisk() {
        return {
            totalExposure: 0,
            availableCapital: this.riskProfile.bankroll,
            totalRisk: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            currentDrawdown: 0,
            valueAtRisk95: 0,
            valueAtRisk99: 0,
            expectedShortfall: 0,
            volatility: 0,
            beta: 0,
            correlationMatrix: {
                matrix: {},
                methodology: 'PEARSON',
                windowSize: 30,
                lastUpdated: new Date().toISOString(),
                stats: {
                    averageCorrelation: 0,
                    maxCorrelation: 0,
                    minCorrelation: 0,
                    significantCorrelations: 0,
                    clusters: []
                }
            },
            maxPositionCorrelation: 0,
            diversificationRatio: 1,
            exposureByCategory: {
                bySport: {},
                byPlayer: {},
                byMarketType: {},
                byGame: {},
                byTier: {},
                byTimeToGame: {}
            },
            concentrationRisk: {
                topGameExposure: 0,
                topPlayerExposure: 0,
                topSportExposure: 0,
                herfindahlIndex: 0,
                effectivePositions: 0
            },
            currentPnL: 0,
            realizedPnL: 0,
            unrealizedPnL: 0,
            averageHoldTime: 0,
            winRate: 0,
            lastUpdated: new Date().toISOString(),
            calculationTime: 0
        };
    }
}
exports.RiskManagementEngine = RiskManagementEngine;
