"use strict";
/**
 * Risk Metrics Calculator
 *
 * Professional-grade risk metrics calculation engine implementing industry-standard
 * risk measures including VaR, Expected Shortfall, Sharpe ratio, and drawdown analysis.
 * Supports multiple methodologies and stress testing scenarios.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskMetricsCalculator = void 0;
const logger_1 = require("../../utils/logger");
class RiskMetricsCalculator {
    constructor(riskProfile) {
        this.logger = (0, logger_1.createLogger)('RiskMetricsCalculator');
        // Historical performance data
        this.performanceHistory = [];
        this.MAX_HISTORY_DAYS = 365;
        // Calculation cache
        this.metricsCache = new Map();
        this.CACHE_TTL = 300000; // 5 minutes
        this.riskProfile = riskProfile;
        this.logger.info('Risk Metrics Calculator initialized', {
            profileId: riskProfile.id,
            riskTolerance: riskProfile.riskTolerance
        });
    }
    /**
     * Calculate comprehensive risk metrics for portfolio
     */
    async calculateComprehensiveMetrics(positions) {
        const startTime = Date.now();
        try {
            const portfolioValue = this.calculatePortfolioValue(positions);
            const cacheKey = this.generateCacheKey(positions);
            // Check cache first
            const cached = this.metricsCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                this.logger.debug('Returning cached risk metrics', { cacheKey });
                return cached.metrics;
            }
            // Calculate VaR for both confidence levels
            const [var95, var99] = await Promise.all([
                this.calculateVaR(positions, { confidenceLevel: 0.95, timeHorizon: 1, methodology: 'HISTORICAL' }),
                this.calculateVaR(positions, { confidenceLevel: 0.99, timeHorizon: 1, methodology: 'HISTORICAL' })
            ]);
            // Calculate Expected Shortfall
            const [es95, es99] = await Promise.all([
                this.calculateExpectedShortfall(positions, { confidenceLevel: 0.95, timeHorizon: 1, methodology: 'HISTORICAL' }),
                this.calculateExpectedShortfall(positions, { confidenceLevel: 0.99, timeHorizon: 1, methodology: 'HISTORICAL' })
            ]);
            // Calculate performance metrics
            const [sharpeRatio, sortinoRatio, calmarRatio] = await Promise.all([
                this.calculateSharpeRatio(positions),
                this.calculateSortinoRatio(positions),
                this.calculateCalmarRatio(positions)
            ]);
            // Calculate drawdown metrics
            const [maxDrawdown, averageDrawdown] = await Promise.all([
                this.calculateMaxDrawdown(positions),
                this.calculateAverageDrawdown(positions)
            ]);
            // Calculate risk-adjusted metrics
            const [riskAdjustedReturn, informationRatio, treynorRatio] = await Promise.all([
                this.calculateRiskAdjustedReturn(positions),
                this.calculateInformationRatio(positions),
                this.calculateTreynorRatio(positions)
            ]);
            // Run stress tests
            const stressTestResults = await this.runStressTests(positions);
            const metrics = {
                id: `risk-metrics-${Date.now()}`,
                portfolioId: `portfolio-${this.riskProfile.id}`,
                var95,
                var99,
                expectedShortfall95: es95,
                expectedShortfall99: es99,
                sharpeRatio,
                sortinoRatio,
                calmarRatio,
                maxDrawdown,
                averageDrawdown,
                riskAdjustedReturn,
                informationRatio,
                treynorRatio,
                stressTestResults,
                calculatedAt: new Date().toISOString(),
                methodology: 'COMPREHENSIVE',
                confidenceLevel: 0.95
            };
            // Cache the results
            this.metricsCache.set(cacheKey, {
                metrics,
                timestamp: Date.now(),
                ttl: this.CACHE_TTL
            });
            this.logger.info('Risk metrics calculation completed', {
                portfolioValue,
                var95: var95.value,
                sharpeRatio,
                maxDrawdown,
                processingTime: Date.now() - startTime
            });
            return metrics;
        }
        catch (error) {
            this.logger.error('Risk metrics calculation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                positionsCount: positions.length
            });
            return this.createFallbackMetrics();
        }
    }
    /**
     * Calculate Value at Risk using specified methodology
     */
    async calculateVaR(positions, options) {
        const portfolioValue = this.calculatePortfolioValue(positions);
        switch (options.methodology) {
            case 'HISTORICAL':
                return await this.calculateHistoricalVaR(positions, options);
            case 'PARAMETRIC':
                return await this.calculateParametricVaR(positions, options);
            case 'MONTE_CARLO':
                return await this.calculateMonteCarloVaR(positions, options);
            default:
                throw new Error(`Unsupported VaR methodology: ${options.methodology}`);
        }
    }
    /**
     * Calculate Expected Shortfall (Conditional VaR)
     */
    async calculateExpectedShortfall(positions, options) {
        const portfolioValue = this.calculatePortfolioValue(positions);
        // First calculate VaR
        const varResult = await this.calculateVaR(positions, options);
        // Then calculate Expected Shortfall beyond VaR
        const historicalReturns = this.getHistoricalReturns(options.windowSize || 252);
        const sortedReturns = historicalReturns.sort((a, b) => a - b);
        const varIndex = Math.floor((1 - options.confidenceLevel) * sortedReturns.length);
        const tailReturns = sortedReturns.slice(0, varIndex);
        const averageTailReturn = tailReturns.length > 0
            ? tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length
            : 0;
        const expectedShortfall = Math.abs(averageTailReturn * portfolioValue);
        return {
            value: expectedShortfall,
            percentage: expectedShortfall / portfolioValue,
            timeHorizon: options.timeHorizon,
            methodology: options.methodology,
            confidenceLevel: options.confidenceLevel,
            tailRisk: Math.abs(averageTailReturn)
        };
    }
    /**
     * Calculate Sharpe ratio
     */
    async calculateSharpeRatio(positions) {
        if (positions.length === 0)
            return 0;
        const returns = this.getHistoricalReturns(252); // 1 year of data
        if (returns.length < 30)
            return 0; // Need minimum data
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const volatility = this.calculateStandardDeviation(returns);
        const riskFreeRate = 0.02 / 252; // 2% annual risk-free rate, daily
        const excessReturn = avgReturn - riskFreeRate;
        return volatility > 0 ? (excessReturn / volatility) * Math.sqrt(252) : 0; // Annualized
    }
    /**
     * Calculate Sortino ratio (downside deviation only)
     */
    async calculateSortinoRatio(positions) {
        if (positions.length === 0)
            return 0;
        const returns = this.getHistoricalReturns(252);
        if (returns.length < 30)
            return 0;
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const riskFreeRate = 0.02 / 252;
        // Calculate downside deviation (only negative returns)
        const negativeReturns = returns.filter(ret => ret < riskFreeRate);
        if (negativeReturns.length === 0)
            return Infinity;
        const downsideDeviation = this.calculateStandardDeviation(negativeReturns);
        const excessReturn = avgReturn - riskFreeRate;
        return downsideDeviation > 0 ? (excessReturn / downsideDeviation) * Math.sqrt(252) : 0;
    }
    /**
     * Calculate Calmar ratio (return/max drawdown)
     */
    async calculateCalmarRatio(positions) {
        if (positions.length === 0)
            return 0;
        const returns = this.getHistoricalReturns(252);
        if (returns.length < 30)
            return 0;
        const annualizedReturn = (returns.reduce((sum, ret) => sum + ret, 0) / returns.length) * 252;
        const maxDrawdown = await this.calculateMaxDrawdown(positions);
        return maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    }
    /**
     * Calculate maximum drawdown
     */
    async calculateMaxDrawdown(positions) {
        const returns = this.getHistoricalReturns(252);
        if (returns.length === 0)
            return 0;
        let peak = 0;
        let maxDrawdown = 0;
        let cumulative = 0;
        for (const dailyReturn of returns) {
            cumulative += dailyReturn;
            peak = Math.max(peak, cumulative);
            const drawdown = peak - cumulative;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        return maxDrawdown;
    }
    /**
     * Calculate current drawdown from peak
     */
    async calculateCurrentDrawdown(positions) {
        const returns = this.getHistoricalReturns(252);
        if (returns.length === 0)
            return 0;
        let peak = 0;
        let cumulative = 0;
        for (const dailyReturn of returns) {
            cumulative += dailyReturn;
            peak = Math.max(peak, cumulative);
        }
        return Math.max(0, peak - cumulative);
    }
    /**
     * Calculate average drawdown
     */
    async calculateAverageDrawdown(positions) {
        const returns = this.getHistoricalReturns(252);
        if (returns.length === 0)
            return 0;
        const drawdowns = [];
        let peak = 0;
        let cumulative = 0;
        for (const dailyReturn of returns) {
            cumulative += dailyReturn;
            peak = Math.max(peak, cumulative);
            const drawdown = peak - cumulative;
            if (drawdown > 0) {
                drawdowns.push(drawdown);
            }
        }
        return drawdowns.length > 0
            ? drawdowns.reduce((sum, dd) => sum + dd, 0) / drawdowns.length
            : 0;
    }
    /**
     * Calculate risk-adjusted return
     */
    async calculateRiskAdjustedReturn(positions) {
        if (positions.length === 0)
            return 0;
        const returns = this.getHistoricalReturns(252);
        if (returns.length < 30)
            return 0;
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const volatility = this.calculateStandardDeviation(returns);
        return volatility > 0 ? avgReturn / volatility : 0;
    }
    /**
     * Calculate Information ratio
     */
    async calculateInformationRatio(positions) {
        // For betting portfolios, we compare against a benchmark of random betting
        // This is a simplified implementation
        const returns = this.getHistoricalReturns(252);
        if (returns.length < 30)
            return 0;
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const benchmarkReturn = -0.05 / 252; // Assume -5% annual benchmark (typical betting loss)
        const excessReturn = avgReturn - benchmarkReturn;
        const trackingError = this.calculateStandardDeviation(returns);
        return trackingError > 0 ? excessReturn / trackingError : 0;
    }
    /**
     * Calculate Treynor ratio
     */
    async calculateTreynorRatio(positions) {
        // For betting portfolios, beta is typically 1 (no market correlation)
        // This is a simplified implementation
        const sharpeRatio = await this.calculateSharpeRatio(positions);
        const beta = 1.0; // Assume beta of 1 for betting portfolios
        return beta > 0 ? sharpeRatio / beta : 0;
    }
    /**
     * Run comprehensive stress tests
     */
    async runStressTests(positions) {
        const stressTests = [];
        // Scenario 1: Market crash (all positions lose)
        const crashLoss = positions.reduce((sum, pos) => sum + pos.stake, 0);
        stressTests.push({
            scenarioName: 'Total Market Crash',
            portfolioLoss: crashLoss,
            worstPositions: positions.map(p => p.id),
            description: 'All positions lose simultaneously',
            probability: 0.001 // 0.1% probability
        });
        // Scenario 2: Single sport shutdown
        const sportExposures = this.calculateSportExposures(positions);
        const maxSportExposure = Math.max(...Object.values(sportExposures));
        stressTests.push({
            scenarioName: 'Single Sport Shutdown',
            portfolioLoss: maxSportExposure,
            worstPositions: positions.filter(p => sportExposures[p.sport] === maxSportExposure).map(p => p.id),
            description: 'Largest sport exposure becomes total loss',
            probability: 0.01 // 1% probability
        });
        // Scenario 3: High correlation cluster loss
        const clusterLoss = this.calculateLargestClusterExposure(positions);
        stressTests.push({
            scenarioName: 'Correlation Cluster Loss',
            portfolioLoss: clusterLoss.exposure,
            worstPositions: clusterLoss.positions,
            description: 'Highly correlated positions lose together',
            probability: 0.05 // 5% probability
        });
        // Scenario 4: Volatility spike
        const volatilityLoss = this.calculateVolatilityStressLoss(positions);
        stressTests.push({
            scenarioName: 'Volatility Spike',
            portfolioLoss: volatilityLoss,
            worstPositions: positions.filter(p => p.riskMetrics?.individualRisk > 7).map(p => p.id),
            description: 'High volatility affects risky positions',
            probability: 0.10 // 10% probability
        });
        return stressTests.sort((a, b) => b.portfolioLoss - a.portfolioLoss);
    }
    // ========================================
    // VaR Calculation Methods
    // ========================================
    /**
     * Calculate Historical VaR
     */
    async calculateHistoricalVaR(positions, options) {
        const portfolioValue = this.calculatePortfolioValue(positions);
        const returns = this.getHistoricalReturns(options.windowSize || 252);
        if (returns.length === 0) {
            return this.createFallbackVaR(portfolioValue, options);
        }
        // Sort returns from worst to best
        const sortedReturns = returns.sort((a, b) => a - b);
        const varIndex = Math.floor((1 - options.confidenceLevel) * sortedReturns.length);
        const varReturn = sortedReturns[varIndex] || 0;
        const varValue = Math.abs(varReturn * portfolioValue);
        // Get worst scenarios for context
        const worstScenarios = sortedReturns
            .slice(0, Math.min(5, varIndex))
            .map((ret, idx) => ({
            scenario: `Historical scenario ${idx + 1}`,
            loss: Math.abs(ret * portfolioValue),
            probability: 1 / returns.length,
            description: `Historical loss of ${(ret * 100).toFixed(2)}%`
        }));
        return {
            value: varValue,
            percentage: Math.abs(varReturn),
            timeHorizon: options.timeHorizon,
            methodology: 'HISTORICAL',
            confidenceLevel: options.confidenceLevel,
            worstScenarios
        };
    }
    /**
     * Calculate Parametric VaR (assumes normal distribution)
     */
    async calculateParametricVaR(positions, options) {
        const portfolioValue = this.calculatePortfolioValue(positions);
        const returns = this.getHistoricalReturns(options.windowSize || 252);
        if (returns.length === 0) {
            return this.createFallbackVaR(portfolioValue, options);
        }
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const volatility = this.calculateStandardDeviation(returns);
        // Z-scores for confidence levels
        const zScores = { 0.95: 1.645, 0.99: 2.326 };
        const zScore = zScores[options.confidenceLevel] || 1.645;
        const varReturn = avgReturn - (zScore * volatility);
        const varValue = Math.abs(varReturn * portfolioValue);
        return {
            value: varValue,
            percentage: Math.abs(varReturn),
            timeHorizon: options.timeHorizon,
            methodology: 'PARAMETRIC',
            confidenceLevel: options.confidenceLevel,
            worstScenarios: []
        };
    }
    /**
     * Calculate Monte Carlo VaR
     */
    async calculateMonteCarloVaR(positions, options) {
        const portfolioValue = this.calculatePortfolioValue(positions);
        const historicalReturns = this.getHistoricalReturns(options.windowSize || 252);
        if (historicalReturns.length === 0) {
            return this.createFallbackVaR(portfolioValue, options);
        }
        const simulations = options.simulations || 10000;
        const simulatedReturns = [];
        const avgReturn = historicalReturns.reduce((sum, ret) => sum + ret, 0) / historicalReturns.length;
        const volatility = this.calculateStandardDeviation(historicalReturns);
        // Run Monte Carlo simulations
        for (let i = 0; i < simulations; i++) {
            const randomReturn = this.generateNormalRandom(avgReturn, volatility);
            simulatedReturns.push(randomReturn);
        }
        // Calculate VaR from simulated returns
        const sortedReturns = simulatedReturns.sort((a, b) => a - b);
        const varIndex = Math.floor((1 - options.confidenceLevel) * sortedReturns.length);
        const varReturn = sortedReturns[varIndex] || 0;
        const varValue = Math.abs(varReturn * portfolioValue);
        return {
            value: varValue,
            percentage: Math.abs(varReturn),
            timeHorizon: options.timeHorizon,
            methodology: 'MONTE_CARLO',
            confidenceLevel: options.confidenceLevel,
            worstScenarios: []
        };
    }
    // ========================================
    // Helper Methods
    // ========================================
    calculatePortfolioValue(positions) {
        return positions.reduce((sum, pos) => sum + pos.stake, 0);
    }
    getHistoricalReturns(days) {
        // This would typically come from a database
        // For now, return simulated returns
        const returns = [];
        for (let i = 0; i < Math.min(days, this.performanceHistory.length); i++) {
            if (this.performanceHistory[i]) {
                returns.push(this.performanceHistory[i].dailyReturn);
            }
        }
        // If no historical data, generate some sample returns for testing
        if (returns.length === 0) {
            for (let i = 0; i < Math.min(days, 100); i++) {
                returns.push(this.generateNormalRandom(0.001, 0.02)); // 0.1% daily return, 2% volatility
            }
        }
        return returns;
    }
    calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    generateNormalRandom(mean, stdDev) {
        // Box-Muller transformation for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + stdDev * z0;
    }
    calculateSportExposures(positions) {
        const exposures = {};
        positions.forEach(pos => {
            exposures[pos.sport] = (exposures[pos.sport] || 0) + pos.stake;
        });
        return exposures;
    }
    calculateLargestClusterExposure(positions) {
        // Simplified clustering based on same game
        const gameGroups = {};
        positions.forEach(pos => {
            if (pos.gameId) {
                if (!gameGroups[pos.gameId]) {
                    gameGroups[pos.gameId] = [];
                }
                gameGroups[pos.gameId].push(pos);
            }
        });
        let maxExposure = 0;
        let maxPositions = [];
        Object.values(gameGroups).forEach(group => {
            const exposure = group.reduce((sum, pos) => sum + pos.stake, 0);
            if (exposure > maxExposure) {
                maxExposure = exposure;
                maxPositions = group.map(p => p.id);
            }
        });
        return { exposure: maxExposure, positions: maxPositions };
    }
    calculateVolatilityStressLoss(positions) {
        // Assume 2x volatility affects risky positions more
        return positions
            .filter(p => p.riskMetrics?.individualRisk > 6)
            .reduce((sum, pos) => sum + pos.stake * 0.3, 0); // 30% loss on risky positions
    }
    generateCacheKey(positions) {
        const positionIds = positions.map(p => p.id).sort().join(',');
        return `metrics-${positionIds.substring(0, 50)}-${positions.length}`;
    }
    createFallbackVaR(portfolioValue, options) {
        const fallbackVaR = portfolioValue * 0.05; // 5% of portfolio value
        return {
            value: fallbackVaR,
            percentage: 0.05,
            timeHorizon: options.timeHorizon,
            methodology: options.methodology,
            confidenceLevel: options.confidenceLevel,
            worstScenarios: []
        };
    }
    createFallbackMetrics() {
        return {
            id: `risk-metrics-fallback-${Date.now()}`,
            portfolioId: `portfolio-${this.riskProfile.id}`,
            var95: this.createFallbackVaR(0, { confidenceLevel: 0.95, timeHorizon: 1, methodology: 'HISTORICAL' }),
            var99: this.createFallbackVaR(0, { confidenceLevel: 0.99, timeHorizon: 1, methodology: 'HISTORICAL' }),
            expectedShortfall95: {
                value: 0,
                percentage: 0,
                timeHorizon: 1,
                methodology: 'HISTORICAL',
                confidenceLevel: 0.95,
                tailRisk: 0
            },
            expectedShortfall99: {
                value: 0,
                percentage: 0,
                timeHorizon: 1,
                methodology: 'HISTORICAL',
                confidenceLevel: 0.99,
                tailRisk: 0
            },
            sharpeRatio: 0,
            sortinoRatio: 0,
            calmarRatio: 0,
            maxDrawdown: 0,
            averageDrawdown: 0,
            riskAdjustedReturn: 0,
            informationRatio: 0,
            treynorRatio: 0,
            stressTestResults: [],
            calculatedAt: new Date().toISOString(),
            methodology: 'FALLBACK',
            confidenceLevel: 0.95
        };
    }
    /**
     * Add performance data point
     */
    addPerformanceData(data) {
        this.performanceHistory.unshift(data);
        // Limit history size
        if (this.performanceHistory.length > this.MAX_HISTORY_DAYS) {
            this.performanceHistory = this.performanceHistory.slice(0, this.MAX_HISTORY_DAYS);
        }
    }
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile) {
        this.riskProfile = newProfile;
        // Clear cache when profile changes
        this.metricsCache.clear();
    }
    /**
     * Get calculation statistics
     */
    getCalculationStatistics() {
        return {
            cacheSize: this.metricsCache.size,
            historyLength: this.performanceHistory.length,
            availableMetrics: Array.from(this.metricsCache.keys())
        };
    }
}
exports.RiskMetricsCalculator = RiskMetricsCalculator;
