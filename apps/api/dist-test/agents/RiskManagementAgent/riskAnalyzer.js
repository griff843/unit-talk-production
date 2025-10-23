"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskAnalyzer = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class RiskAnalyzer {
    constructor(logger) {
        this.correlationHistory = new Map();
        this.riskModels = new Map();
        this.benchmarkData = new Map();
        this.stressScenarios = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('📊 Initializing RiskAnalyzer');
        await this.loadRiskModels();
        await this.loadBenchmarkData();
        await this.loadStressScenarios();
        await this.loadCorrelationHistory();
        this.logger.info('✅ RiskAnalyzer initialized');
    }
    async analyzePortfolio(positions, bankroll) {
        this.logger.info('📈 Analyzing portfolio risk', {
            positionCount: positions.length,
            bankroll
        });
        try {
            // Calculate basic portfolio metrics
            const totalExposure = this.calculateTotalExposure(positions, bankroll);
            const portfolioReturns = await this.simulatePortfolioReturns(positions, 1000);
            // Risk metrics
            const valueAtRisk = this.calculateVaR(portfolioReturns, 0.05); // 5% VaR
            const expectedShortfall = this.calculateExpectedShortfall(portfolioReturns, 0.05);
            const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);
            const sharpeRatio = this.calculateSharpeRatio(portfolioReturns);
            // Concentration and diversification
            const concentrationRisk = this.calculateConcentrationRisk(positions);
            const diversificationBenefit = await this.calculateDiversificationBenefit(positions);
            // Correlation and liquidity risks
            const correlationRisk = await this.calculateCorrelationRisk(positions);
            const liquidityRisk = await this.calculateLiquidityRisk(positions);
            // Overall risk professional_score
            const riskScore = await this.calculateOverallRiskScore({
                totalExposure,
                valueAtRisk,
                concentrationRisk,
                correlationRisk,
                liquidityRisk,
                diversificationBenefit
            });
            // Scenario analysis
            const scenarios = await this.performScenarioAnalysis(positions);
            const analysis = {
                totalExposure,
                riskScore,
                maxDrawdown,
                valueAtRisk,
                expectedShortfall,
                sharpeRatio,
                diversificationBenefit,
                concentrationRisk,
                liquidityRisk,
                correlationRisk,
                scenarios
            };
            this.logger.info('✅ Portfolio risk analysis completed', {
                riskScore,
                totalExposure,
                valueAtRisk
            });
            return analysis;
        }
        catch (error) {
            this.logger.error('❌ Portfolio risk analysis failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async calculateCorrelations(positions) {
        this.logger.info('🔗 Calculating position correlations');
        const correlations = new Map();
        try {
            for (let i = 0; i < positions.length; i++) {
                for (let j = i + 1; j < positions.length; j++) {
                    const pos1 = positions[i];
                    const pos2 = positions[j];
                    const correlationKey = `${pos1.id}_${pos2.id}`;
                    const correlation = await this.calculatePairwiseCorrelation(pos1, pos2);
                    correlations.set(correlationKey, correlation);
                }
            }
            // Store correlation data for historical tracking
            await this.updateCorrelationHistory(correlations);
            return correlations;
        }
        catch (error) {
            this.logger.error('❌ Correlation calculation failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async performStressTest(positions, scenarios) {
        this.logger.info('🧪 Performing stress test', {
            positions: positions.length,
            scenarios: scenarios.length
        });
        const stressResults = new Map();
        try {
            for (const scenarioName of scenarios) {
                const scenario = this.stressScenarios.get(scenarioName);
                if (!scenario)
                    continue;
                const stressedReturns = await this.applyStressScenario(positions, scenario);
                const stressedMetrics = this.calculateRiskMetrics(stressedReturns);
                stressResults.set(scenarioName, {
                    scenario: scenario.description,
                    probability: scenario.probability,
                    portfolioReturn: stressedReturns.reduce((sum, r) => sum + r, 0) / stressedReturns.length,
                    worstCase: Math.min(...stressedReturns),
                    valueAtRisk: this.calculateVaR(stressedReturns, 0.05),
                    expectedShortfall: this.calculateExpectedShortfall(stressedReturns, 0.05),
                    exceedsLimits: stressedMetrics.maxDrawdown > 0.2 // 20% drawdown limit
                });
            }
            return stressResults;
        }
        catch (error) {
            this.logger.error('❌ Stress test failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async detectCorrelationShifts() {
        this.logger.info('🔄 Detecting correlation shifts');
        const changes = [];
        try {
            for (const [pair, history] of this.correlationHistory) {
                if (history.length < 10)
                    continue; // Need sufficient history
                const recent = history.slice(-5); // Last 5 observations
                const historical = history.slice(0, -5); // Historical data
                const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
                const historicalAvg = historical.reduce((sum, val) => sum + val, 0) / historical.length;
                const change = Math.abs(recentAvg - historicalAvg);
                if (change > 0.3) { // Significant change threshold
                    const [asset1, asset2] = pair.split('_');
                    changes.push({
                        assets: [asset1, asset2],
                        oldCorrelation: historicalAvg,
                        newCorrelation: recentAvg,
                        changeDate: new Date(),
                        significanceLevel: Math.min(change / 0.3, 1.0),
                        impactOnPortfolio: this.calculateCorrelationChangeImpact(pair, change)
                    });
                }
            }
            return changes.sort((a, b) => b.significanceLevel - a.significanceLevel);
        }
        catch (error) {
            this.logger.error('❌ Correlation shift detection failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async calculateRiskFactorExposures(positions) {
        this.logger.info('📊 Calculating risk factor exposures');
        const exposures = [];
        try {
            // Define risk factors
            const riskFactors = [
                'market_direction',
                'volatility',
                'sport_specific',
                'time_decay',
                'liquidity',
                'correlation'
            ];
            for (const factor of riskFactors) {
                const exposure = await this.calculateFactorExposure(positions, factor);
                const contribution = await this.calculateFactorContribution(positions, factor);
                const sensitivity = await this.calculateFactorSensitivity(positions, factor);
                exposures.push({
                    factorName: factor,
                    exposure,
                    contribution,
                    sensitivity,
                    riskAttribution: exposure * sensitivity
                });
            }
            return exposures.sort((a, b) => b.riskAttribution - a.riskAttribution);
        }
        catch (error) {
            this.logger.error('❌ Risk factor exposure calculation failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    // Private calculation methods
    calculateTotalExposure(positions, bankroll) {
        const totalStake = positions.reduce((sum, pos) => sum + pos.stake, 0);
        return totalStake / bankroll;
    }
    async simulatePortfolioReturns(positions, numSimulations) {
        const returns = [];
        for (let i = 0; i < numSimulations; i++) {
            let portfolioReturn = 0;
            for (const position of positions) {
                const random = Math.random();
                const winProbability = 1 / position.odds + position.expectedValue;
                if (random < winProbability) {
                    // Win scenario
                    portfolioReturn += position.stake * (position.odds - 1);
                }
                else {
                    // Loss scenario
                    portfolioReturn -= position.stake;
                }
            }
            returns.push(portfolioReturn);
        }
        return returns;
    }
    calculateVaR(returns, confidence) {
        const sortedReturns = returns.sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * returns.length);
        return -sortedReturns[index]; // Negative because VaR is typically positive for losses
    }
    calculateExpectedShortfall(returns, confidence) {
        const sortedReturns = returns.sort((a, b) => a - b);
        const varIndex = Math.floor((1 - confidence) * returns.length);
        const tailReturns = sortedReturns.slice(0, varIndex);
        if (tailReturns.length === 0)
            return 0;
        const averageTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
        return -averageTailReturn;
    }
    calculateMaxDrawdown(returns) {
        let maxDrawdown = 0;
        let peak = returns[0];
        let cumulative = 0;
        for (const ret of returns) {
            cumulative += ret;
            peak = Math.max(peak, cumulative);
            const drawdown = (peak - cumulative) / Math.abs(peak);
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        return maxDrawdown;
    }
    calculateSharpeRatio(returns) {
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
    calculateConcentrationRisk(positions) {
        const totalStake = positions.reduce((sum, pos) => sum + pos.stake, 0);
        if (totalStake === 0)
            return 0;
        // Herfindahl-Hirschman Index
        const hhi = positions.reduce((sum, pos) => {
            const weight = pos.stake / totalStake;
            return sum + weight * weight;
        }, 0);
        return hhi;
    }
    async calculateDiversificationBenefit(positions) {
        if (positions.length <= 1)
            return 0;
        // Calculate portfolio volatility vs sum of individual volatilities
        const individualVolSum = positions.reduce((sum, pos) => sum + pos.volatility, 0);
        const portfolioVol = await this.calculatePortfolioVolatility(positions);
        return Math.max(0, (individualVolSum - portfolioVol) / individualVolSum);
    }
    async calculateCorrelationRisk(positions) {
        if (positions.length <= 1)
            return 0;
        let totalCorrelation = 0;
        let pairCount = 0;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const correlation = await this.calculatePairwiseCorrelation(positions[i], positions[j]);
                totalCorrelation += Math.abs(correlation);
                pairCount++;
            }
        }
        return pairCount > 0 ? totalCorrelation / pairCount : 0;
    }
    async calculateLiquidityRisk(positions) {
        // Simplified liquidity risk based on bet types and game timing
        const liquidityScores = positions.map(pos => {
            // Live bets are less liquid
            if (pos.betType.includes('live'))
                return 0.8;
            // Exotic bets are less liquid
            if (pos.betType.includes('prop') || pos.betType.includes('exotic'))
                return 0.6;
            // Standard bets are more liquid
            return 0.2;
        });
        return liquidityScores.reduce((sum, professional_score) => sum + professional_score, 0) / liquidityScores.length;
    }
    async calculateOverallRiskScore(metrics) {
        const weights = {
            exposure: 0.25,
            var: 0.20,
            concentration: 0.20,
            correlation: 0.15,
            liquidity: 0.10,
            diversification: -0.10 // Negative weight (diversification reduces risk)
        };
        // Normalize metrics to 0-1 scale
        const normalizedMetrics = {
            exposure: Math.min(metrics.totalExposure / 0.5, 1), // 50% exposure = 1.0
            var: Math.min(metrics.valueAtRisk / 0.2, 1), // 20% VaR = 1.0
            concentration: Math.min(metrics.concentrationRisk / 0.5, 1),
            correlation: Math.min(metrics.correlationRisk / 0.8, 1),
            liquidity: Math.min(metrics.liquidityRisk / 0.8, 1),
            diversification: metrics.diversificationBenefit
        };
        const riskScore = Object.entries(weights).reduce((professional_score, [metric, weight]) => {
            return professional_score + weight * normalizedMetrics[metric];
        }, 0);
        return Math.max(0, Math.min(1, riskScore));
    }
    async performScenarioAnalysis(positions) {
        const scenarios = [];
        // Market stress scenario
        const marketStress = await this.calculateScenario(positions, 'market_stress', {
            correlationIncrease: 0.3,
            volatilityIncrease: 0.5,
            returnDecrease: 0.2
        });
        scenarios.push(marketStress);
        // Liquidity crisis scenario
        const liquidityCrisis = await this.calculateScenario(positions, 'liquidity_crisis', {
            liquidityDecrease: 0.4,
            spreadIncrease: 0.3
        });
        scenarios.push(liquidityCrisis);
        // Black swan scenario
        const blackSwan = await this.calculateScenario(positions, 'black_swan', {
            extremeMove: 0.8,
            correlationSpike: 0.9
        });
        scenarios.push(blackSwan);
        return scenarios;
    }
    async calculateScenario(positions, scenarioName, parameters) {
        // Simplified scenario calculation
        const baseReturn = positions.reduce((sum, pos) => sum + pos.expectedValue * pos.stake, 0);
        let adjustedReturn = baseReturn;
        if (parameters.returnDecrease) {
            adjustedReturn *= (1 - parameters.returnDecrease);
        }
        if (parameters.extremeMove) {
            adjustedReturn *= (1 - parameters.extremeMove);
        }
        return {
            name: scenarioName,
            probability: this.getScenarioProbability(scenarioName),
            expectedReturn: adjustedReturn,
            worstCaseReturn: adjustedReturn * 0.5,
            bestCaseReturn: adjustedReturn * 1.2,
            impactDescription: this.getScenarioDescription(scenarioName)
        };
    }
    getScenarioProbability(scenarioName) {
        const probabilities = {
            market_stress: 0.15,
            liquidity_crisis: 0.05,
            black_swan: 0.01
        };
        return probabilities[scenarioName] || 0.1;
    }
    getScenarioDescription(scenarioName) {
        const descriptions = {
            market_stress: 'Market-wide stress increases correlations and volatility',
            liquidity_crisis: 'Reduced liquidity increases spreads and execution risk',
            black_swan: 'Extreme unexpected event causes significant losses'
        };
        return descriptions[scenarioName] || 'Unexpected market scenario';
    }
    async calculatePairwiseCorrelation(pos1, pos2) {
        // Simplified correlation calculation based on bet types and games
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
        // This would check actual sport classification
        return pos1.betType.split('_')[0] === pos2.betType.split('_')[0];
    }
    isSameDay(pos1, pos2) {
        const day1 = pos1.timestamp.toDateString();
        const day2 = pos2.timestamp.toDateString();
        return day1 === day2;
    }
    async calculatePortfolioVolatility(positions) {
        // Simplified portfolio volatility calculation
        const weights = positions.map(pos => pos.stake / positions.reduce((sum, p) => sum + p.stake, 0));
        const volatilities = positions.map(pos => pos.volatility);
        let portfolioVariance = 0;
        for (let i = 0; i < positions.length; i++) {
            for (let j = 0; j < positions.length; j++) {
                const correlation = i === j ? 1 : await this.calculatePairwiseCorrelation(positions[i], positions[j]);
                portfolioVariance += weights[i] * weights[j] * volatilities[i] * volatilities[j] * correlation;
            }
        }
        return Math.sqrt(portfolioVariance);
    }
    async applyStressScenario(positions, scenario) {
        // Apply stress scenario to simulate returns
        return this.simulatePortfolioReturns(positions, 100); // Simplified
    }
    calculateRiskMetrics(returns) {
        return {
            valueAtRisk: this.calculateVaR(returns, 0.05),
            expectedShortfall: this.calculateExpectedShortfall(returns, 0.05),
            maxDrawdown: this.calculateMaxDrawdown(returns),
            volatility: Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length),
            beta: 1.0, // Simplified
            correlation: 0.5, // Simplified
            skewness: 0, // Simplified
            kurtosis: 3, // Simplified
            sharpeRatio: this.calculateSharpeRatio(returns),
            sortintoRatio: 0, // Simplified
            calmarRatio: 0 // Simplified
        };
    }
    calculateCorrelationChangeImpact(pair, change) {
        // Simplified impact calculation
        return change * 0.1; // 10% of correlation change affects portfolio
    }
    async calculateFactorExposure(positions, factor) {
        // Simplified factor exposure calculation
        const exposureMap = {
            market_direction: 0.7,
            volatility: 0.5,
            sport_specific: 0.8,
            time_decay: 0.3,
            liquidity: 0.4,
            correlation: 0.6
        };
        return exposureMap[factor] || 0.5;
    }
    async calculateFactorContribution(positions, factor) {
        // Simplified factor contribution calculation
        return Math.random() * 0.3; // 0-30% contribution
    }
    async calculateFactorSensitivity(positions, factor) {
        // Simplified factor sensitivity calculation
        return Math.random() * 0.5 + 0.5; // 0.5-1.0 sensitivity
    }
    async updateCorrelationHistory(correlations) {
        for (const [pair, correlation] of correlations) {
            const history = this.correlationHistory.get(pair) || [];
            history.push(correlation);
            // Keep only last 30 observations
            if (history.length > 30) {
                history.shift();
            }
            this.correlationHistory.set(pair, history);
        }
    }
    async loadRiskModels() {
        const models = {
            var_model: { confidence_level: 0.05, lookback_days: 30 },
            correlation_model: { decay_factor: 0.94, min_observations: 10 },
            stress_model: { severity_levels: [0.1, 0.25, 0.5, 0.95] }
        };
        for (const [modelName, model] of Object.entries(models)) {
            this.riskModels.set(modelName, model);
        }
    }
    async loadBenchmarkData() {
        // Load benchmark data for comparison
        const benchmarks = {
            market_return: [0.02, 0.01, -0.01, 0.03, 0.02],
            risk_free_rate: [0.005, 0.005, 0.005, 0.005, 0.005]
        };
        for (const [benchmark, data] of Object.entries(benchmarks)) {
            this.benchmarkData.set(benchmark, data);
        }
    }
    async loadStressScenarios() {
        const scenarios = {
            market_stress: {
                description: 'Market stress with increased correlations',
                probability: 0.15,
                parameters: { correlation_increase: 0.3, volatility_increase: 0.5 }
            },
            liquidity_crisis: {
                description: 'Liquidity crisis with wider spreads',
                probability: 0.05,
                parameters: { liquidity_decrease: 0.4, spread_increase: 0.3 }
            },
            black_swan: {
                description: 'Extreme unexpected event',
                probability: 0.01,
                parameters: { extreme_move: 0.8, correlation_spike: 0.9 }
            }
        };
        for (const [scenarioName, scenario] of Object.entries(scenarios)) {
            this.stressScenarios.set(scenarioName, scenario);
        }
    }
    async loadCorrelationHistory() {
        try {
            const cachedHistory = await enhanced_cache_1.redisCache.getPattern('risk:correlation_history:*');
            for (const [key, data] of cachedHistory) {
                const pair = key.split(':').pop();
                if (pair) {
                    const history = JSON.parse(data);
                    this.correlationHistory.set(pair, history);
                }
            }
            this.logger.info(`📋 Loaded correlation history for ${this.correlationHistory.size} pairs`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load correlation history from cache');
        }
    }
    async isHealthy() {
        return this.riskModels.size > 0 && this.stressScenarios.size > 0;
    }
    async cleanup() {
        // Save correlation history
        for (const [pair, history] of this.correlationHistory) {
            await enhanced_cache_1.redisCache.set(`risk:correlation_history:${pair}`, JSON.stringify(history), 86400 // 24 hours TTL
            );
        }
        this.correlationHistory.clear();
        this.riskModels.clear();
        this.benchmarkData.clear();
        this.stressScenarios.clear();
        this.logger.info('🧹 RiskAnalyzer cleanup completed');
    }
}
exports.RiskAnalyzer = RiskAnalyzer;
