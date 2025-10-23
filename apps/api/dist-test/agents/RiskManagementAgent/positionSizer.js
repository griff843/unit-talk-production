"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionSizer = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class PositionSizer {
    constructor(logger) {
        this.sizingHistory = new Map();
        this.bankrollTracking = new Map();
        this.correlationMatrix = new Map();
        this.volatilityModels = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('🎯 Initializing PositionSizer');
        await this.loadSizingHistory();
        await this.loadBankrollTracking();
        await this.loadVolatilityModels();
        await this.loadCorrelationData();
        this.logger.info('✅ PositionSizer initialized');
    }
    async optimizePortfolio(positions, limits, bankroll, params) {
        this.logger.info('🎯 Optimizing portfolio position sizes', {
            positionCount: positions.length,
            bankroll,
            method: params?.method || 'kelly'
        });
        try {
            const defaultParams = {
                method: 'kelly',
                riskTolerance: 0.25,
                maxPositionSize: 0.05,
                targetVolatility: 0.15,
                correlationAdjustment: true,
                dynamicSizing: true,
                ...params
            };
            // Calculate optimal sizes for each position
            const optimizedPositions = [];
            for (const position of positions) {
                const optimizedPos = await this.optimizePosition(position, positions, bankroll, limits, defaultParams);
                optimizedPositions.push(optimizedPos);
            }
            // Apply portfolio-level constraints
            const portfolioOptimization = await this.applyPortfolioConstraints(optimizedPositions, bankroll, limits);
            // Calculate correlation adjustments
            const correlationAdjustments = await this.calculateCorrelationAdjustments(positions, portfolioOptimization.positions);
            // Apply dynamic risk scaling
            if (defaultParams.dynamicSizing) {
                await this.applyDynamicScaling(portfolioOptimization.positions, bankroll);
            }
            const result = {
                positions: portfolioOptimization.positions,
                totalRecommendedExposure: portfolioOptimization.totalExposure,
                riskReduction: await this.calculateRiskReduction(positions, portfolioOptimization.positions),
                expectedReturnChange: await this.calculateExpectedReturnChange(positions, portfolioOptimization.positions),
                diversificationImprovement: await this.calculateDiversificationImprovement(positions, portfolioOptimization.positions),
                correlationAdjustments
            };
            // Store optimization results
            await this.storeSizingDecision(positions[0]?.userId || 'unknown', result);
            this.logger.info('✅ Portfolio optimization completed', {
                positionsOptimized: result.positions.length,
                riskReduction: result.riskReduction,
                totalExposure: result.totalRecommendedExposure
            });
            return result;
        }
        catch (error) {
            this.logger.error('❌ Portfolio optimization failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async calculateOptimalSize(position, bankroll, riskTolerance = 0.25) {
        this.logger.debug('💰 Calculating optimal position size', {
            positionId: position.id,
            currentStake: position.stake,
            bankroll
        });
        try {
            // Calculate Kelly Criterion
            const kellyCalculation = await this.calculateKellyFraction(position);
            // Apply risk tolerance adjustment
            const adjustedKelly = kellyCalculation.kellyFraction * riskTolerance;
            // Calculate volatility-scaled size
            const volatilityScaledSize = await this.calculateVolatilityScaledSize(position, bankroll, 0.15 // Target 15% volatility
            );
            // Take the more conservative of the two
            const conservativeSize = Math.min(adjustedKelly * bankroll, volatilityScaledSize);
            // Apply position limits
            const maxSize = bankroll * 0.05; // 5% max position size
            const optimalSize = Math.min(conservativeSize, maxSize);
            return Math.max(0, optimalSize);
        }
        catch (error) {
            this.logger.error('❌ Failed to calculate optimal size', {
                positionId: position.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return position.stake; // Return current stake as fallback
        }
    }
    async calculateKellyFraction(position) {
        const p = this.calculateWinProbability(position);
        const b = position.odds - 1; // Net odds
        // Basic Kelly formula: f = (bp - q) / b
        const q = 1 - p;
        const kellyFraction = (b * p - q) / b;
        // Apply confidence adjustment based on data quality
        const confidence = await this.calculateConfidence(position);
        const confidenceAdjustment = confidence * 0.8 + 0.2; // 20-100% of Kelly
        // Apply risk adjustment for bet type volatility
        const riskAdjustment = this.calculateRiskAdjustment(position);
        // Apply correlation adjustment
        const correlationAdjustment = await this.calculateCorrelationAdjustment(position);
        const adjustedFraction = Math.max(0, kellyFraction * confidenceAdjustment * riskAdjustment * correlationAdjustment);
        return {
            kellyFraction,
            adjustedFraction,
            confidence,
            riskAdjustment,
            correlationAdjustment
        };
    }
    async sizeNewPosition(proposedPosition, existingPositions, bankroll, limits) {
        this.logger.info('🆕 Sizing new position', {
            betType: proposedPosition.betType,
            gameId: proposedPosition.gameId,
            existingPositions: existingPositions.length
        });
        try {
            // Create temporary position for calculations
            const tempPosition = {
                ...proposedPosition,
                id: 'temp_position',
                stake: 0,
                correlation: new Map()
            };
            // Calculate base position size
            const baseSize = await this.calculateOptimalSize(tempPosition, bankroll, 0.25);
            // Check portfolio-level constraints
            const currentExposure = existingPositions.reduce((sum, pos) => sum + pos.stake, 0);
            const proposedExposure = currentExposure + baseSize;
            // Respect daily exposure limit
            const maxAdditionalExposure = bankroll * limits.maxDailyExposure - currentExposure;
            if (maxAdditionalExposure <= 0) {
                this.logger.warn('⚠️ Daily exposure limit reached', {
                    currentExposure: currentExposure / bankroll,
                    limit: limits.maxDailyExposure
                });
                return 0;
            }
            // Check correlation constraints
            const correlationAdjustedSize = await this.adjustForCorrelations(tempPosition, existingPositions, Math.min(baseSize, maxAdditionalExposure), limits);
            // Apply concentration limits
            const concentrationAdjustedSize = await this.adjustForConcentration(tempPosition, existingPositions, correlationAdjustedSize, limits);
            const finalSize = Math.max(0, concentrationAdjustedSize);
            this.logger.info('✅ New position sized', {
                baseSize,
                finalSize,
                adjustmentRatio: baseSize > 0 ? finalSize / baseSize : 0
            });
            return finalSize;
        }
        catch (error) {
            this.logger.error('❌ Failed to size new position', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return 0;
        }
    }
    // Private Methods
    async optimizePosition(position, allPositions, bankroll, limits, params) {
        let recommendedSize;
        let reason;
        switch (params.method) {
            case 'kelly':
                const kellyCalc = await this.calculateKellyFraction(position);
                recommendedSize = kellyCalc.adjustedFraction * bankroll;
                reason = `Kelly Criterion (${(kellyCalc.kellyFraction * 100).toFixed(1)}% adjusted to ${(kellyCalc.adjustedFraction * 100).toFixed(1)}%)`;
                break;
            case 'fixed_percentage':
                recommendedSize = bankroll * params.riskTolerance;
                reason = `Fixed percentage (${(params.riskTolerance * 100).toFixed(1)}% of bankroll)`;
                break;
            case 'volatility_scaled':
                recommendedSize = await this.calculateVolatilityScaledSize(position, bankroll, params.targetVolatility);
                reason = `Volatility scaled (target ${(params.targetVolatility * 100).toFixed(1)}% volatility)`;
                break;
            case 'risk_parity':
                recommendedSize = await this.calculateRiskParitySize(position, allPositions, bankroll);
                reason = 'Risk parity allocation';
                break;
            case 'adaptive':
                recommendedSize = await this.calculateAdaptiveSize(position, allPositions, bankroll, params);
                reason = 'Adaptive sizing based on market conditions';
                break;
            default:
                recommendedSize = position.stake;
                reason = 'No adjustment (unknown method)';
        }
        // Apply position limits
        const maxSize = bankroll * Math.min(params.maxPositionSize, limits.maxSinglePosition);
        recommendedSize = Math.min(recommendedSize, maxSize);
        // Apply correlation adjustments if enabled
        if (params.correlationAdjustment) {
            const correlationFactor = await this.getCorrelationAdjustmentFactor(position, allPositions);
            recommendedSize *= correlationFactor;
            if (correlationFactor < 1) {
                reason += ` (reduced ${((1 - correlationFactor) * 100).toFixed(1)}% for correlation)`;
            }
        }
        const sizingRatio = position.stake > 0 ? recommendedSize / position.stake : 1;
        const changeRequired = Math.abs(sizingRatio - 1) > 0.1; // 10% threshold
        return {
            positionId: position.id,
            currentSize: position.stake,
            recommendedSize,
            sizingRatio,
            reason,
            changeRequired,
            riskImpact: await this.calculateRiskImpact(position, recommendedSize - position.stake),
            expectedReturnImpact: await this.calculateReturnImpact(position, recommendedSize - position.stake),
            priority: this.determinePriority(sizingRatio, position.riskContribution)
        };
    }
    calculateWinProbability(position) {
        // Convert odds to implied probability and adjust for expected value
        const impliedProbability = 1 / position.odds;
        const adjustedProbability = impliedProbability * (1 + position.expectedValue);
        return Math.min(0.95, Math.max(0.05, adjustedProbability));
    }
    async calculateConfidence(position) {
        // This would analyze data quality, sample size, model accuracy, etc.
        // For now, return a confidence based on bet type and expected value magnitude
        const baseConfidence = 0.7;
        const evConfidence = Math.min(0.3, Math.abs(position.expectedValue) * 2);
        const typeConfidence = this.getBetTypeConfidence(position.betType);
        return Math.min(0.95, baseConfidence + evConfidence + typeConfidence);
    }
    calculateRiskAdjustment(position) {
        // Higher volatility = lower position size
        const volatilityPenalty = Math.min(0.5, position.volatility);
        return Math.max(0.5, 1 - volatilityPenalty);
    }
    async calculateCorrelationAdjustment(position) {
        // This would analyze correlation with existing positions
        // For now, return a basic adjustment based on correlation data
        return 0.9; // 10% reduction for correlation risk
    }
    getBetTypeConfidence(betType) {
        const confidenceMap = {
            'moneyline': 0.15,
            'spread': 0.10,
            'total': 0.10,
            'prop': 0.05,
            'live': 0.02,
            'exotic': 0.0
        };
        return confidenceMap[betType] || 0.05;
    }
    async calculateVolatilityScaledSize(position, bankroll, targetVolatility) {
        // Size position to contribute target volatility to portfolio
        const positionVolatility = position.volatility;
        if (positionVolatility <= 0)
            return bankroll * 0.01; // 1% minimum
        const targetContribution = targetVolatility / Math.sqrt(252); // Daily target
        const scalingFactor = targetContribution / positionVolatility;
        return bankroll * Math.min(scalingFactor, 0.05); // Max 5% of bankroll
    }
    async calculateRiskParitySize(position, allPositions, bankroll) {
        // Equal risk contribution from each position
        if (allPositions.length === 0)
            return bankroll * 0.02;
        const targetRiskContribution = 1 / allPositions.length;
        const positionVolatility = position.volatility;
        if (positionVolatility <= 0)
            return bankroll * 0.01;
        // Size inversely proportional to volatility
        const riskParityWeight = targetRiskContribution / positionVolatility;
        return bankroll * Math.min(riskParityWeight, 0.05);
    }
    async calculateAdaptiveSize(position, allPositions, bankroll, params) {
        // Combine multiple sizing methods with adaptive weights
        const kellySize = (await this.calculateKellyFraction(position)).adjustedFraction * bankroll;
        const volatilitySize = await this.calculateVolatilityScaledSize(position, bankroll, params.targetVolatility);
        const riskParitySize = await this.calculateRiskParitySize(position, allPositions, bankroll);
        // Dynamic weights based on market conditions and position characteristics
        const kellyWeight = this.getAdaptiveWeight('kelly', position);
        const volatilityWeight = this.getAdaptiveWeight('volatility', position);
        const riskParityWeight = this.getAdaptiveWeight('risk_parity', position);
        const totalWeight = kellyWeight + volatilityWeight + riskParityWeight;
        return (kellySize * kellyWeight + volatilitySize * volatilityWeight + riskParitySize * riskParityWeight) / totalWeight;
    }
    getAdaptiveWeight(method, position) {
        // This would analyze current market conditions, position characteristics, etc.
        const baseWeights = {
            kelly: 0.5,
            volatility: 0.3,
            risk_parity: 0.2
        };
        return baseWeights[method] || 0.1;
    }
    async getCorrelationAdjustmentFactor(position, allPositions) {
        if (allPositions.length <= 1)
            return 1.0;
        let totalCorrelation = 0;
        let correlationCount = 0;
        for (const otherPosition of allPositions) {
            if (otherPosition.id === position.id)
                continue;
            const correlation = await this.getPositionCorrelation(position, otherPosition);
            totalCorrelation += Math.abs(correlation);
            correlationCount++;
        }
        const avgCorrelation = correlationCount > 0 ? totalCorrelation / correlationCount : 0;
        // Reduce size based on average correlation
        return Math.max(0.5, 1 - avgCorrelation * 0.5);
    }
    async getPositionCorrelation(pos1, pos2) {
        // Same game = high correlation
        if (pos1.gameId === pos2.gameId)
            return 0.8;
        // Same sport, same day = medium correlation
        if (this.isSameSport(pos1, pos2) && this.isSameDay(pos1, pos2))
            return 0.4;
        // Same sport, different day = low correlation
        if (this.isSameSport(pos1, pos2))
            return 0.2;
        // Different sports = minimal correlation
        return 0.05;
    }
    isSameSport(pos1, pos2) {
        return pos1.betType.split('_')[0] === pos2.betType.split('_')[0];
    }
    isSameDay(pos1, pos2) {
        const day1 = pos1.timestamp.toDateString();
        const day2 = pos2.timestamp.toDateString();
        return day1 === day2;
    }
    async applyPortfolioConstraints(optimizedPositions, bankroll, limits) {
        let totalExposure = optimizedPositions.reduce((sum, pos) => sum + pos.recommendedSize, 0);
        const maxExposure = bankroll * limits.maxDailyExposure;
        // Scale down if total exposure exceeds limit
        if (totalExposure > maxExposure) {
            const scaleFactor = maxExposure / totalExposure;
            for (const position of optimizedPositions) {
                position.recommendedSize *= scaleFactor;
                position.reason += ` (scaled ${(scaleFactor * 100).toFixed(1)}% for portfolio limit)`;
            }
            totalExposure = maxExposure;
        }
        return { positions: optimizedPositions, totalExposure };
    }
    async calculateCorrelationAdjustments(originalPositions, optimizedPositions) {
        const adjustments = [];
        for (let i = 0; i < originalPositions.length; i++) {
            for (let j = i + 1; j < originalPositions.length; j++) {
                const pos1 = originalPositions[i];
                const pos2 = originalPositions[j];
                const correlation = await this.getPositionCorrelation(pos1, pos2);
                if (correlation > 0.5) {
                    const opt1 = optimizedPositions.find(op => op.positionId === pos1.id);
                    const opt2 = optimizedPositions.find(op => op.positionId === pos2.id);
                    if (opt1 && opt2) {
                        const avgAdjustment = (opt1.sizingRatio + opt2.sizingRatio) / 2;
                        adjustments.push({
                            positionPair: [pos1.id, pos2.id],
                            correlationLevel: correlation,
                            recommendedAdjustment: avgAdjustment,
                            impact: correlation > 0.7 ? 'High correlation risk' : 'Medium correlation risk'
                        });
                    }
                }
            }
        }
        return adjustments;
    }
    async applyDynamicScaling(positions, bankroll) {
        // Apply dynamic scaling based on recent performance and market conditions
        const performanceScaling = await this.getPerformanceScaling();
        const marketConditionScaling = await this.getMarketConditionScaling();
        const totalScaling = performanceScaling * marketConditionScaling;
        if (totalScaling !== 1.0) {
            for (const position of positions) {
                position.recommendedSize *= totalScaling;
                position.reason += ` (dynamic scaling ${(totalScaling * 100).toFixed(1)}%)`;
            }
        }
    }
    async getPerformanceScaling() {
        // This would analyze recent performance to scale position sizes
        // Good performance = increase sizes, poor performance = decrease sizes
        return 1.0; // Neutral for now
    }
    async getMarketConditionScaling() {
        // This would analyze market volatility, liquidity, etc.
        // High volatility = smaller positions, stable markets = normal sizing
        return 1.0; // Neutral for now
    }
    async adjustForCorrelations(position, existingPositions, baseSize, limits) {
        let correlatedExposure = 0;
        for (const existingPos of existingPositions) {
            const correlation = await this.getPositionCorrelation(position, existingPos);
            if (correlation > 0.3) {
                correlatedExposure += existingPos.stake * correlation;
            }
        }
        const maxCorrelatedExposure = limits.maxCorrelatedExposure * (await this.getUserBankroll(position.userId));
        const availableCorrelatedCapacity = Math.max(0, maxCorrelatedExposure - correlatedExposure);
        return Math.min(baseSize, availableCorrelatedCapacity);
    }
    async adjustForConcentration(position, existingPositions, baseSize, limits) {
        // Group positions by asset class (sport/bet type)
        const assetClassExposure = this.calculateAssetClassExposure(position, existingPositions);
        const bankroll = await this.getUserBankroll(position.userId);
        const maxConcentration = bankroll * limits.concentrationLimit;
        const availableConcentrationCapacity = Math.max(0, maxConcentration - assetClassExposure);
        return Math.min(baseSize, availableConcentrationCapacity);
    }
    calculateAssetClassExposure(position, existingPositions) {
        const positionAssetClass = this.getAssetClass(position);
        return existingPositions
            .filter(pos => this.getAssetClass(pos) === positionAssetClass)
            .reduce((sum, pos) => sum + pos.stake, 0);
    }
    getAssetClass(position) {
        // Group by sport and bet type category
        const sport = position.betType.split('_')[0];
        const category = position.betType.includes('prop') ? 'prop' : 'main';
        return `${sport}_${category}`;
    }
    async getUserBankroll(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:bankroll:${userId}`);
        return cached ? parseFloat(cached) : 1000; // Default bankroll
    }
    async calculateRiskReduction(originalPositions, optimizedPositions) {
        // Simplified risk reduction calculation
        const originalRisk = originalPositions.reduce((sum, pos) => sum + pos.riskContribution, 0);
        const optimizedRisk = optimizedPositions.reduce((sum, pos) => sum + (pos.recommendedSize / 1000) * 0.05, 0); // Simplified risk calculation
        return Math.max(0, (originalRisk - optimizedRisk) / originalRisk);
    }
    async calculateExpectedReturnChange(originalPositions, optimizedPositions) {
        // Calculate change in expected returns from optimization
        let returnChange = 0;
        for (const optimized of optimizedPositions) {
            const original = originalPositions.find(p => p.id === optimized.positionId);
            if (original) {
                const sizeChange = optimized.recommendedSize - original.stake;
                returnChange += sizeChange * original.expectedValue;
            }
        }
        return returnChange;
    }
    async calculateDiversificationImprovement(originalPositions, optimizedPositions) {
        // Measure improvement in diversification from optimization
        // This would calculate the diversification ratio before and after
        return 0.05; // 5% improvement placeholder
    }
    async calculateRiskImpact(position, sizeChange) {
        return sizeChange * position.volatility * 0.1; // Simplified risk impact
    }
    async calculateReturnImpact(position, sizeChange) {
        return sizeChange * position.expectedValue;
    }
    determinePriority(sizingRatio, riskContribution) {
        const changeAmount = Math.abs(sizingRatio - 1);
        if (changeAmount > 0.5 || riskContribution > 0.1)
            return 'high';
        if (changeAmount > 0.2 || riskContribution > 0.05)
            return 'medium';
        return 'low';
    }
    async storeSizingDecision(userId, optimization) {
        const history = this.sizingHistory.get(userId) || [];
        history.push({
            timestamp: new Date(),
            optimization,
            positionCount: optimization.positions.length,
            totalExposure: optimization.totalRecommendedExposure
        });
        // Keep only last 30 decisions
        if (history.length > 30) {
            history.shift();
        }
        this.sizingHistory.set(userId, history);
        // Cache the decision
        await enhanced_cache_1.redisCache.set(`position_sizer:decision:${userId}:${Date.now()}`, JSON.stringify(optimization), 86400 // 24 hours TTL
        );
    }
    async loadSizingHistory() {
        try {
            const cachedHistory = await enhanced_cache_1.redisCache.getPattern('position_sizer:history:*');
            for (const [key, data] of cachedHistory) {
                const userId = key.split(':').pop();
                if (userId) {
                    const history = JSON.parse(data);
                    this.sizingHistory.set(userId, history);
                }
            }
            this.logger.info(`📋 Loaded sizing history for ${this.sizingHistory.size} users`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load sizing history from cache');
        }
    }
    async loadBankrollTracking() {
        // Load bankroll tracking data for dynamic sizing
        const defaultTracking = [1000, 1050, 1020, 1080, 1040]; // Sample bankroll history
        this.bankrollTracking.set('default', defaultTracking);
    }
    async loadVolatilityModels() {
        const models = {
            moneyline: { base_volatility: 0.3, adjustment_factor: 1.0 },
            spread: { base_volatility: 0.35, adjustment_factor: 1.1 },
            total: { base_volatility: 0.32, adjustment_factor: 1.05 },
            prop: { base_volatility: 0.45, adjustment_factor: 1.3 },
            live: { base_volatility: 0.55, adjustment_factor: 1.5 }
        };
        for (const [betType, model] of Object.entries(models)) {
            this.volatilityModels.set(betType, model);
        }
    }
    async loadCorrelationData() {
        // Load correlation data between different bet types and games
        try {
            const cached = await enhanced_cache_1.redisCache.get('position_sizer:correlations');
            if (cached) {
                const correlationData = JSON.parse(cached);
                this.correlationMatrix = new Map(correlationData);
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load correlation data, using defaults');
        }
    }
    async isHealthy() {
        return this.volatilityModels.size > 0;
    }
    async cleanup() {
        // Save sizing history
        for (const [userId, history] of this.sizingHistory) {
            await enhanced_cache_1.redisCache.set(`position_sizer:history:${userId}`, JSON.stringify(history), 86400 // 24 hours TTL
            );
        }
        this.sizingHistory.clear();
        this.bankrollTracking.clear();
        this.correlationMatrix.clear();
        this.volatilityModels.clear();
        this.logger.info('🧹 PositionSizer cleanup completed');
    }
}
exports.PositionSizer = PositionSizer;
