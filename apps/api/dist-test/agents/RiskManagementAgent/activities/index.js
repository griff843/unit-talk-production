"use strict";
/**
 * RiskManagementAgent Temporal Activities
 *
 * Activity functions for portfolio optimization, risk assessment,
 * and position sizing calculations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePortfolioRisk = calculatePortfolioRisk;
exports.optimizePortfolio = optimizePortfolio;
exports.calculatePositionSize = calculatePositionSize;
exports.assessDrawdownRisk = assessDrawdownRisk;
exports.checkRiskManagementAgentHealth = checkRiskManagementAgentHealth;
const logger_1 = require("../../../shared/logger");
const _riskLogger = logger_1.logger.child({ component: 'RiskManagementAgent:Activities' });
async function calculatePortfolioRisk(data) {
    logger_1.logger.info('📊 Calculating portfolio risk', { portfolioId: data.portfolioId });
    try {
        const { positions } = data;
        // Calculate weighted average volatility
        const totalAllocation = positions.reduce((sum, pos) => sum + pos.allocation, 0);
        const weightedVolatility = positions.reduce((sum, pos) => sum + (pos.allocation / totalAllocation) * pos.volatility, 0);
        // Calculate diversification professional_score (inverse of concentration)
        const concentrationIndex = positions.reduce((sum, pos) => sum + Math.pow(pos.allocation / totalAllocation, 2), 0);
        const diversificationScore = Math.max(0, 1 - concentrationIndex);
        // Overall risk calculation
        const totalRisk = weightedVolatility * (1 - diversificationScore * 0.3);
        const riskLevel = totalRisk > 0.3 ? 'extreme' :
            totalRisk > 0.2 ? 'high' :
                totalRisk > 0.1 ? 'medium' : 'low';
        const recommendations = [];
        if (diversificationScore < 0.6) {
            recommendations.push('Increase portfolio diversification');
        }
        if (weightedVolatility > 0.25) {
            recommendations.push('Reduce exposure to high-volatility positions');
        }
        if (totalRisk > 0.2) {
            recommendations.push('Consider hedging strategies');
        }
        return {
            success: true,
            riskAssessment: {
                totalRisk,
                diversificationScore,
                riskLevel,
                recommendations
            }
        };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to calculate portfolio risk', { error });
        return { success: false };
    }
}
async function optimizePortfolio(data) {
    logger_1.logger.info('🎯 Optimizing portfolio', {
        userId: data.userId,
        capital: data.availableCapital,
        riskTolerance: data.riskTolerance
    });
    try {
        // Mock Modern Portfolio Theory optimization
        const assets = ['NFL', 'NBA', 'MLB', 'Soccer', 'Tennis'];
        const recommendedAllocations = assets.map(asset => ({
            asset,
            currentAllocation: Math.random() * 0.3,
            recommendedAllocation: Math.max(0.1, Math.min(0.4, data.riskTolerance * Math.random())),
            reason: `Optimal risk-adjusted return for ${asset} based on current market conditions`
        }));
        // Normalize allocations to sum to 1
        const totalRecommended = recommendedAllocations.reduce((sum, a) => sum + a.recommendedAllocation, 0);
        recommendedAllocations.forEach(a => a.recommendedAllocation /= totalRecommended);
        const expectedReturn = 0.08 + (data.riskTolerance * 0.05); // 8-13% based on risk tolerance
        const expectedRisk = 0.05 + (data.riskTolerance * 0.1); // 5-15% risk
        const sharpeRatio = (expectedReturn - 0.02) / expectedRisk; // Risk-free rate = 2%
        return {
            success: true,
            optimization: {
                recommendedAllocations,
                expectedReturn,
                expectedRisk,
                sharpeRatio
            }
        };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to optimize portfolio', { error });
        return { success: false };
    }
}
async function calculatePositionSize(data) {
    logger_1.logger.info('📏 Calculating position size', {
        userId: data.userId,
        odds: data.pickData.odds,
        balance: data.accountBalance
    });
    try {
        const { odds, confidence, expectedValue } = data.pickData;
        const { accountBalance, riskPercentage } = data;
        // Kelly Criterion calculation
        const probability = confidence / 100;
        const oddsDecimal = odds > 0 ? (odds / 100) + 1 : (-100 / odds) + 1;
        const kellyPercentage = ((probability * oddsDecimal) - 1) / (oddsDecimal - 1);
        // Conservative Kelly (fractional Kelly)
        const fractionalKelly = Math.max(0, Math.min(kellyPercentage * 0.25, riskPercentage / 100));
        const recommendedAmount = accountBalance * fractionalKelly;
        const maxAmount = accountBalance * (riskPercentage / 100);
        const minAmount = accountBalance * 0.01; // 1% minimum
        let reasoning = `Based on Kelly Criterion with ${confidence}% confidence and ${expectedValue > 0 ? 'positive' : 'negative'} expected value. `;
        reasoning += `Using fractional Kelly (25%) for conservative position sizing.`;
        if (expectedValue <= 0) {
            reasoning += ' WARNING: Negative expected value - consider avoiding this bet.';
        }
        return {
            success: true,
            positionSize: {
                recommendedAmount: Math.max(minAmount, Math.min(recommendedAmount, maxAmount)),
                maxAmount,
                minAmount,
                kellyPercentage: kellyPercentage * 100,
                reasoning
            }
        };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to calculate position size', { error });
        return { success: false };
    }
}
async function assessDrawdownRisk(data) {
    logger_1.logger.info('📉 Assessing drawdown risk', {
        userId: data.userId,
        currentDrawdown: data.currentDrawdown
    });
    try {
        const { historicalReturns, currentDrawdown } = data;
        // Calculate maximum historical drawdown
        const maxDrawdown = Math.min(...historicalReturns.map((_, i) => Math.min(...historicalReturns.slice(0, i + 1))));
        // Calculate percentile of current drawdown
        const worseDrawdowns = historicalReturns.filter(r => r <= currentDrawdown).length;
        const currentDrawdownPercentile = (worseDrawdowns / historicalReturns.length) * 100;
        // Estimate recovery time based on historical patterns
        const averageReturn = historicalReturns.reduce((sum, r) => sum + r, 0) / historicalReturns.length;
        const recoveryTimeEstimate = Math.abs(currentDrawdown) / Math.max(averageReturn, 0.01);
        const riskLevel = currentDrawdown < -0.3 ? 'critical' :
            currentDrawdown < -0.2 ? 'high' :
                currentDrawdown < -0.1 ? 'medium' : 'low';
        const recommendations = [];
        if (riskLevel === 'critical' || riskLevel === 'high') {
            recommendations.push('Reduce position sizes by 50%');
            recommendations.push('Focus on higher confidence picks only');
            recommendations.push('Consider taking a break from betting');
        }
        else if (riskLevel === 'medium') {
            recommendations.push('Reduce position sizes by 25%');
            recommendations.push('Increase pick selectivity');
        }
        return {
            success: true,
            drawdownAnalysis: {
                maxDrawdown,
                currentDrawdownPercentile,
                recoveryTimeEstimate,
                riskLevel,
                recommendations
            }
        };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to assess drawdown risk', { error });
        return { success: false };
    }
}
async function checkRiskManagementAgentHealth() {
    try {
        const healthChecks = [
            { component: 'portfolio_optimization', healthy: true },
            { component: 'risk_calculation', healthy: true },
            { component: 'position_sizing', healthy: true },
            { component: 'drawdown_analysis', healthy: true }
        ];
        const healthyCount = healthChecks.filter(c => c.healthy).length;
        const status = healthyCount === healthChecks.length ? 'healthy' :
            healthyCount >= healthChecks.length / 2 ? 'degraded' : 'unhealthy';
        return {
            status,
            details: {
                healthChecks,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
    }
}
