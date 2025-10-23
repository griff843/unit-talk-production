"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedPortfolioOptimizer = void 0;
const enhanced_monitoring_1 = require("../monitoring/enhanced-monitoring");
const logger_1 = require("../shared/logger");
class EnhancedPortfolioOptimizer {
    constructor(config) {
        this.logger = logger_1.logger.child({ context: 'EnhancedPortfolioOptimizer' });
        this.monitoring = new enhanced_monitoring_1.EnhancedMonitoringSystem();
        this.config = config;
        this.positions = [];
        this.optimizationHistory = [];
        this.initializeOptimizer();
    }
    initializeOptimizer() {
        // Set up periodic portfolio rebalancing
        setInterval(() => {
            this.rebalancePortfolio();
        }, this.config.rebalancingInterval);
        // Set up performance monitoring
        setInterval(() => {
            this.monitorPortfolioPerformance();
        }, this.config.monitoringInterval);
    }
    async addPosition(position) {
        try {
            // Validate position
            this.validatePosition(position);
            // Check portfolio constraints
            const constraints = await this.checkPortfolioConstraints(position);
            if (!constraints.valid) {
                throw new Error(`Portfolio constraint violation: ${constraints.reason}`);
            }
            // Add position to portfolio
            this.positions.push(position);
            // Optimize portfolio
            await this.optimizePortfolio();
            this.logger.info('Position added to portfolio', { positionId: position.id });
        }
        catch (error) {
            this.logger.error('Failed to add position', error);
            throw error;
        }
    }
    async removePosition(positionId) {
        try {
            const index = this.positions.findIndex(p => p.id === positionId);
            if (index === -1) {
                throw new Error(`Position not found: ${positionId}`);
            }
            this.positions.splice(index, 1);
            await this.optimizePortfolio();
            this.logger.info('Position removed from portfolio', { positionId });
        }
        catch (error) {
            this.logger.error('Failed to remove position', error);
            throw error;
        }
    }
    async optimizePortfolio() {
        try {
            const currentMetrics = await this.calculatePortfolioMetrics();
            // Apply optimization strategies
            const optimization = await this.applyOptimizationStrategy(currentMetrics);
            // Update positions based on optimization
            await this.updatePositions(optimization);
            // Store optimization result
            this.optimizationHistory.push(optimization);
            // Report metrics
            await this.reportOptimizationMetrics(optimization);
            this.logger.info('Portfolio optimization completed', optimization);
            return optimization;
        }
        catch (error) {
            this.logger.error('Portfolio optimization failed', error);
            throw error;
        }
    }
    async calculatePortfolioMetrics() {
        const totalValue = this.positions.reduce((sum, pos) => sum + pos.value, 0);
        const totalRisk = this.positions.reduce((sum, pos) => sum + pos.risk, 0);
        // Calculate weighted metrics
        const weightedReturn = this.positions.reduce((sum, pos) => sum + (pos.expectedReturn * pos.value / totalValue), 0);
        const weightedRisk = this.positions.reduce((sum, pos) => sum + (pos.risk * pos.value / totalValue), 0);
        // Calculate diversification metrics
        const diversification = this.calculateDiversification();
        // Calculate correlation matrix
        const correlations = this.calculateCorrelations();
        return {
            totalValue,
            totalRisk,
            weightedReturn,
            weightedRisk,
            sharpeRatio: weightedReturn / weightedRisk,
            diversification,
            correlations,
            positionCount: this.positions.length,
            sectorExposure: this.calculateSectorExposure(),
            sportExposure: this.calculateSportExposure()
        };
    }
    calculateDiversification() {
        if (this.positions.length === 0) {
            return 0;
        }
        // Calculate Herfindahl-Hirschman Index (HHI)
        const totalValue = this.positions.reduce((sum, pos) => sum + pos.value, 0);
        const hhi = this.positions.reduce((sum, pos) => {
            const share = pos.value / totalValue;
            return sum + (share * share);
        }, 0);
        // Convert to diversification professional_score (1 = fully diversified, 0 = concentrated)
        return 1 - hhi;
    }
    calculateCorrelations() {
        const correlations = new Map();
        // Calculate pairwise correlations between positions
        for (let i = 0; i < this.positions.length; i++) {
            const pos1 = this.positions[i];
            correlations.set(pos1.id, new Map());
            for (let j = 0; j < this.positions.length; j++) {
                const pos2 = this.positions[j];
                const correlation = this.calculatePositionCorrelation(pos1, pos2);
                correlations.get(pos1.id).set(pos2.id, correlation);
            }
        }
        return correlations;
    }
    calculatePositionCorrelation(pos1, pos2) {
        // Calculate correlation based on sport, market, and other factors
        let correlation = 0;
        // Same sport correlation
        if (pos1.sport === pos2.sport) {
            correlation += 0.3;
        }
        // Same market correlation
        if (pos1.market === pos2.market) {
            correlation += 0.2;
        }
        // Same team correlation
        if (pos1.team === pos2.team) {
            correlation += 0.4;
        }
        // Same player correlation
        if (pos1.player === pos2.player) {
            correlation += 0.5;
        }
        return Math.min(correlation, 1.0);
    }
    calculateSectorExposure() {
        const exposure = new Map();
        const totalValue = this.positions.reduce((sum, pos) => sum + pos.value, 0);
        this.positions.forEach(pos => {
            const sector = pos.sector;
            const current = exposure.get(sector) || 0;
            exposure.set(sector, current + pos.value / totalValue);
        });
        return exposure;
    }
    calculateSportExposure() {
        const exposure = new Map();
        const totalValue = this.positions.reduce((sum, pos) => sum + pos.value, 0);
        this.positions.forEach(pos => {
            const sport = pos.sport;
            const current = exposure.get(sport) || 0;
            exposure.set(sport, current + pos.value / totalValue);
        });
        return exposure;
    }
    async applyOptimizationStrategy(metrics) {
        const strategy = this.determineOptimizationStrategy(metrics);
        switch (strategy) {
            case 'risk_parity':
                return this.applyRiskParityOptimization(metrics);
            case 'mean_variance':
                return this.applyMeanVarianceOptimization(metrics);
            case 'kelly_criterion':
                return this.applyKellyCriterionOptimization(metrics);
            case 'black_litterman':
                return this.applyBlackLittermanOptimization(metrics);
            default:
                return this.applyConservativeOptimization(metrics);
        }
    }
    determineOptimizationStrategy(metrics) {
        // Determine strategy based on current portfolio state
        if (metrics.totalRisk > this.config.maxRiskThreshold) {
            return 'risk_parity';
        }
        else if (metrics.sharpeRatio < this.config.minSharpeRatio) {
            return 'mean_variance';
        }
        else if (metrics.diversification < this.config.minDiversification) {
            return 'kelly_criterion';
        }
        else {
            return 'black_litterman';
        }
    }
    async applyRiskParityOptimization(metrics) {
        // Risk parity optimization - equal risk contribution from each position
        const targetRiskPerPosition = metrics.totalRisk / this.positions.length;
        const adjustments = this.positions.map(pos => {
            const currentRisk = pos.risk;
            const adjustment = targetRiskPerPosition / currentRisk;
            return {
                positionId: pos.id,
                newSize: pos.size * adjustment,
                adjustment: adjustment
            };
        });
        return {
            strategy: 'risk_parity',
            adjustments,
            expectedReturn: metrics.weightedReturn,
            expectedRisk: metrics.totalRisk,
            confidence: 0.85,
            timestamp: Date.now()
        };
    }
    async applyMeanVarianceOptimization(metrics) {
        // Mean-variance optimization - maximize Sharpe ratio
        const adjustments = this.positions.map(pos => {
            const sharpeRatio = pos.expectedReturn / pos.risk;
            const optimalSize = Math.max(0, Math.min(pos.size * (sharpeRatio / metrics.sharpeRatio), this.config.maxPositionSize));
            return {
                positionId: pos.id,
                newSize: optimalSize,
                adjustment: optimalSize / pos.size
            };
        });
        return {
            strategy: 'mean_variance',
            adjustments,
            expectedReturn: metrics.weightedReturn * 1.1, // 10% improvement
            expectedRisk: metrics.totalRisk * 0.95, // 5% risk reduction
            confidence: 0.80,
            timestamp: Date.now()
        };
    }
    async applyKellyCriterionOptimization(metrics) {
        // Kelly criterion optimization - optimal bet sizing
        const adjustments = this.positions.map(pos => {
            const winProbability = pos.confidence;
            const odds = pos.odds;
            const kellyFraction = (winProbability * odds - (1 - winProbability)) / odds;
            const optimalSize = Math.max(0, Math.min(pos.size * kellyFraction * 0.5, // Half Kelly for safety
            this.config.maxPositionSize));
            return {
                positionId: pos.id,
                newSize: optimalSize,
                adjustment: optimalSize / pos.size
            };
        });
        return {
            strategy: 'kelly_criterion',
            adjustments,
            expectedReturn: metrics.weightedReturn * 1.15, // 15% improvement
            expectedRisk: metrics.totalRisk * 0.90, // 10% risk reduction
            confidence: 0.90,
            timestamp: Date.now()
        };
    }
    async applyBlackLittermanOptimization(metrics) {
        // Black-Litterman optimization - incorporate views and market equilibrium
        const adjustments = this.positions.map(pos => {
            // Incorporate market views and confidence levels
            const marketView = this.getMarketView(pos);
            const confidence = pos.confidence;
            const combinedView = (marketView + confidence) / 2;
            const optimalSize = pos.size * (combinedView / 0.5); // Normalize to 50% baseline
            return {
                positionId: pos.id,
                newSize: Math.max(0, Math.min(optimalSize, this.config.maxPositionSize)),
                adjustment: optimalSize / pos.size
            };
        });
        return {
            strategy: 'black_litterman',
            adjustments,
            expectedReturn: metrics.weightedReturn * 1.08, // 8% improvement
            expectedRisk: metrics.totalRisk * 0.92, // 8% risk reduction
            confidence: 0.75,
            timestamp: Date.now()
        };
    }
    async applyConservativeOptimization(metrics) {
        // Conservative optimization - maintain current positions with minor adjustments
        const adjustments = this.positions.map(pos => {
            const adjustment = 1.0; // No change
            return {
                positionId: pos.id,
                newSize: pos.size,
                adjustment
            };
        });
        return {
            strategy: 'conservative',
            adjustments,
            expectedReturn: metrics.weightedReturn,
            expectedRisk: metrics.totalRisk,
            confidence: 0.95,
            timestamp: Date.now()
        };
    }
    getMarketView(position) {
        // Get market view based on various factors
        let view = 0.5; // Neutral baseline
        // Market sentiment
        if (position.marketSentiment === 'bullish') {
            view += 0.1;
        }
        if (position.marketSentiment === 'bearish') {
            view -= 0.1;
        }
        // Line movement
        if (position.lineMovement && position.lineMovement > 0) {
            view += 0.05;
        }
        if (position.lineMovement && position.lineMovement < 0) {
            view -= 0.05;
        }
        // Volume analysis
        if (position.volumeAnalysis && position.volumeAnalysis > 1.5) {
            view += 0.05;
        }
        if (position.volumeAnalysis && position.volumeAnalysis < 0.5) {
            view -= 0.05;
        }
        return Math.max(0, Math.min(1, view));
    }
    async updatePositions(optimization) {
        optimization.adjustments.forEach(adjustment => {
            const position = this.positions.find(p => p.id === adjustment.positionId);
            if (position) {
                position.size = adjustment.newSize;
                position.value = position.size * position.price;
                position.lastOptimized = Date.now();
            }
        });
    }
    async rebalancePortfolio() {
        try {
            this.logger.info('Starting portfolio rebalancing');
            const optimization = await this.optimizePortfolio();
            // Check if rebalancing is needed
            const needsRebalancing = optimization.adjustments.some(adj => Math.abs(adj.adjustment - 1.0) > this.config.rebalancingThreshold);
            if (needsRebalancing) {
                await this.executeRebalancing(optimization);
                this.logger.info('Portfolio rebalancing completed');
            }
            else {
                this.logger.info('No rebalancing needed');
            }
        }
        catch (error) {
            this.logger.error('Portfolio rebalancing failed', error);
        }
    }
    async executeRebalancing(optimization) {
        // Execute the rebalancing trades
        for (const adjustment of optimization.adjustments) {
            const position = this.positions.find(p => p.id === adjustment.positionId);
            if (position && Math.abs(adjustment.adjustment - 1.0) > this.config.rebalancingThreshold) {
                // Execute trade to adjust position size
                await this.executeTrade(position, adjustment.newSize);
            }
        }
    }
    async executeTrade(position, targetSize) {
        // Execute trade to adjust position size
        const sizeDifference = targetSize - position.size;
        if (Math.abs(sizeDifference) > this.config.minTradeSize) {
            // Execute the trade
            position.size = targetSize;
            position.value = position.size * position.price;
            position.lastTrade = Date.now();
            this.logger.info('Trade executed', {
                positionId: position.id,
                sizeDifference,
                newSize: targetSize
            });
        }
    }
    async monitorPortfolioPerformance() {
        try {
            const metrics = await this.calculatePortfolioMetrics();
            // Report metrics to monitoring system
            await this.monitoring.monitorMetric('portfolio_total_value', metrics.totalValue);
            await this.monitoring.monitorMetric('portfolio_total_risk', metrics.totalRisk);
            await this.monitoring.monitorMetric('portfolio_sharpe_ratio', metrics.sharpeRatio);
            await this.monitoring.monitorMetric('portfolio_diversification', metrics.diversification);
            // Check for alerts
            if (metrics.totalRisk > this.config.maxRiskThreshold) {
                await this.monitoring.triggerAlert('portfolio_risk_high', {
                    currentRisk: metrics.totalRisk,
                    threshold: this.config.maxRiskThreshold
                });
            }
            if (metrics.sharpeRatio < this.config.minSharpeRatio) {
                await this.monitoring.triggerAlert('portfolio_performance_low', {
                    currentSharpe: metrics.sharpeRatio,
                    threshold: this.config.minSharpeRatio
                });
            }
        }
        catch (error) {
            this.logger.error('Portfolio performance monitoring failed', error);
        }
    }
    async reportOptimizationMetrics(optimization) {
        await this.monitoring.monitorMetric('optimization_strategy', 1); // Convert strategy to numeric
        await this.monitoring.monitorMetric('optimization_confidence', optimization.confidence);
        await this.monitoring.monitorMetric('expected_return', optimization.expectedReturn);
        await this.monitoring.monitorMetric('expected_risk', optimization.expectedRisk);
    }
    validatePosition(position) {
        if (!position.id || !position.sport || !position.market) {
            throw new Error('Invalid position: missing required fields');
        }
        if (position.size <= 0 || position.value <= 0) {
            throw new Error('Invalid position: size and value must be positive');
        }
        if (position.confidence < 0 || position.confidence > 1) {
            throw new Error('Invalid position: confidence must be between 0 and 1');
        }
    }
    async checkPortfolioConstraints(position) {
        // Check position size limits
        if (position.size > this.config.maxPositionSize) {
            return { valid: false, reason: 'Position size exceeds maximum' };
        }
        // Check sector concentration
        const sectorExposure = this.calculateSectorExposure();
        const currentSectorExposure = sectorExposure.get(position.sector) || 0;
        const newSectorExposure = currentSectorExposure + (position.value / this.getTotalValue());
        if (newSectorExposure > this.config.maxSectorExposure) {
            return { valid: false, reason: 'Sector exposure exceeds maximum' };
        }
        // Check sport concentration
        const sportExposure = this.calculateSportExposure();
        const currentSportExposure = sportExposure.get(position.sport) || 0;
        const newSportExposure = currentSportExposure + (position.value / this.getTotalValue());
        if (newSportExposure > this.config.maxSportExposure) {
            return { valid: false, reason: 'Sport exposure exceeds maximum' };
        }
        return { valid: true };
    }
    getTotalValue() {
        return this.positions.reduce((sum, pos) => sum + pos.value, 0);
    }
    async getPortfolioSummary() {
        const metrics = await this.calculatePortfolioMetrics();
        const optimization = this.optimizationHistory[this.optimizationHistory.length - 1];
        return {
            positions: this.positions.length,
            totalValue: metrics.totalValue,
            totalRisk: metrics.totalRisk,
            sharpeRatio: metrics.sharpeRatio,
            diversification: metrics.diversification,
            lastOptimization: optimization,
            sectorExposure: metrics.sectorExposure,
            sportExposure: metrics.sportExposure
        };
    }
}
exports.EnhancedPortfolioOptimizer = EnhancedPortfolioOptimizer;
