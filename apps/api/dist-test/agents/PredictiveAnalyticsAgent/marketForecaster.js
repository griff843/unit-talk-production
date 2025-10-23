"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketForecaster = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class MarketForecaster {
    constructor(logger) {
        this.forecastingModels = new Map();
        this.marketTrends = new Map();
        this.detectedAnomalies = new Map();
        this.identifiedOpportunities = new Map();
        this.assessedRisks = new Map();
        this.historicalPatterns = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('📈 Initializing MarketForecaster');
        await this.loadForecastingModels();
        await this.loadHistoricalPatterns();
        await this.loadMarketTrends();
        await this.loadAnomalyHistory();
        this.logger.info('✅ MarketForecaster initialized');
    }
    async detectTrends() {
        this.logger.info('🔍 Detecting market trends...');
        try {
            const trends = [];
            const marketData = await this.getRecentMarketData();
            for (const [marketId, data] of marketData) {
                const trendAnalysis = await this.analyzeTrendForMarket(marketId, data);
                if (trendAnalysis) {
                    const insight = {
                        insightId: `trend_${marketId}_${Date.now()}`,
                        type: 'trend',
                        severity: this.calculateTrendSeverity(trendAnalysis),
                        description: this.generateTrendDescription(trendAnalysis),
                        affectedMarkets: [marketId],
                        confidence: trendAnalysis.confidence,
                        timeframe: this.formatTimeframe(trendAnalysis.duration),
                        actionable: trendAnalysis.strength > 0.6,
                        recommendations: this.generateTrendRecommendations(trendAnalysis),
                        historicalPrecedent: await this.findHistoricalPrecedent(trendAnalysis),
                        timestamp: new Date()
                    };
                    trends.push(insight);
                    // Store trend data
                    const marketTrends = this.marketTrends.get(marketId) || [];
                    marketTrends.push(trendAnalysis);
                    this.marketTrends.set(marketId, marketTrends);
                }
            }
            this.logger.info(`✅ Detected ${trends.length} market trends`);
            return trends;
        }
        catch (error) {
            this.logger.error('❌ Failed to detect trends', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async detectAnomalies() {
        this.logger.info('🚨 Detecting market anomalies...');
        try {
            const anomalies = [];
            const marketData = await this.getRecentMarketData();
            for (const [marketId, data] of marketData) {
                const anomalyAnalysis = await this.analyzeAnomaliesForMarket(marketId, data);
                for (const anomaly of anomalyAnalysis) {
                    const insight = {
                        insightId: `anomaly_${marketId}_${Date.now()}`,
                        type: 'anomaly',
                        severity: anomaly.severity,
                        description: this.generateAnomalyDescription(anomaly),
                        affectedMarkets: [marketId],
                        confidence: anomaly.confidence,
                        timeframe: anomaly.timeframe,
                        actionable: anomaly.severity !== 'low',
                        recommendations: this.generateAnomalyRecommendations(anomaly),
                        timestamp: new Date()
                    };
                    anomalies.push(insight);
                    // Store anomaly data
                    const marketAnomalies = this.detectedAnomalies.get(marketId) || [];
                    marketAnomalies.push(anomaly);
                    this.detectedAnomalies.set(marketId, marketAnomalies);
                }
            }
            this.logger.info(`✅ Detected ${anomalies.length} market anomalies`);
            return anomalies;
        }
        catch (error) {
            this.logger.error('❌ Failed to detect anomalies', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async identifyOpportunities() {
        this.logger.info('💎 Identifying market opportunities...');
        try {
            const opportunities = [];
            // Identify arbitrage opportunities
            const arbitrageOpps = await this.identifyArbitrageOpportunities();
            opportunities.push(...arbitrageOpps);
            // Identify value betting opportunities
            const valueBetOpps = await this.identifyValueBettingOpportunities();
            opportunities.push(...valueBetOpps);
            // Identify market inefficiencies
            const inefficiencyOpps = await this.identifyMarketInefficiencies();
            opportunities.push(...inefficiencyOpps);
            // Identify trend reversal opportunities
            const reversalOpps = await this.identifyTrendReversalOpportunities();
            opportunities.push(...reversalOpps);
            this.logger.info(`✅ Identified ${opportunities.length} market opportunities`);
            return opportunities;
        }
        catch (error) {
            this.logger.error('❌ Failed to identify opportunities', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async assessMarketRisks() {
        this.logger.info('⚠️ Assessing market risks...');
        try {
            const risks = [];
            // Assess liquidity risks
            const liquidityRisks = await this.assessLiquidityRisks();
            risks.push(...liquidityRisks);
            // Assess volatility risks
            const volatilityRisks = await this.assessVolatilityRisks();
            risks.push(...volatilityRisks);
            // Assess correlation risks
            const correlationRisks = await this.assessCorrelationRisks();
            risks.push(...correlationRisks);
            // Assess systematic risks
            const systematicRisks = await this.assessSystematicRisks();
            risks.push(...systematicRisks);
            this.logger.info(`✅ Assessed ${risks.length} market risks`);
            return risks;
        }
        catch (error) {
            this.logger.error('❌ Failed to assess market risks', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async forecastMarketMovement(marketId, timeHorizon) {
        this.logger.info('🔮 Forecasting market movement', {
            marketId,
            timeHorizon
        });
        try {
            const marketData = await this.getMarketHistory(marketId);
            const bestModel = await this.selectBestModel(marketId, timeHorizon);
            const forecast = await this.generateForecast(marketData, bestModel, timeHorizon);
            return {
                marketId,
                forecast: {
                    predictedPrice: forecast.predictedPrice,
                    priceRange: forecast.priceRange,
                    direction: forecast.direction,
                    momentum: forecast.momentum,
                    volatility: forecast.volatility,
                    confidence: forecast.confidence
                },
                timeHorizon,
                model: bestModel.modelId,
                generatedAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('❌ Failed to forecast market movement', {
                marketId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Private Analysis Methods
    async analyzeTrendForMarket(marketId, data) {
        if (data.length < 10)
            return null; // Need sufficient data
        // Calculate trend indicators
        const prices = data.map(d => d.price);
        const volumes = data.map(d => d.volume || 1);
        // Simple moving averages
        const sma5 = this.calculateSMA(prices, 5);
        const sma20 = this.calculateSMA(prices, 20);
        // Trend direction
        const direction = sma5[sma5.length - 1] > sma20[sma20.length - 1] ? 'bullish' :
            sma5[sma5.length - 1] < sma20[sma20.length - 1] ? 'bearish' : 'neutral';
        // Trend strength
        const strength = this.calculateTrendStrength(prices);
        // Only return significant trends
        if (strength < 0.3)
            return null;
        // Calculate support and resistance levels
        const supportLevel = Math.min(...prices.slice(-10));
        const resistanceLevel = Math.max(...prices.slice(-10));
        // Calculate momentum
        const momentum = this.calculateMomentum(prices);
        // Calculate volatility
        const volatility = this.calculateVolatility(prices);
        return {
            trendId: `trend_${marketId}_${Date.now()}`,
            marketIds: [marketId],
            direction,
            strength,
            duration: data.length,
            confidence: this.calculateTrendConfidence(strength, momentum, volatility),
            supportLevel,
            resistanceLevel,
            momentum,
            volume: volumes.reduce((sum, v) => sum + v, 0) / volumes.length,
            volatility,
            startTime: new Date(data[0].timestamp),
            projectedEndTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            keyDrivers: await this.identifyTrendDrivers(marketId, direction, strength)
        };
    }
    async analyzeAnomaliesForMarket(marketId, data) {
        const anomalies = [];
        if (data.length < 20)
            return anomalies; // Need sufficient data for baseline
        const prices = data.map(d => d.price);
        const volumes = data.map(d => d.volume || 1);
        // Calculate statistical baselines
        const priceBaseline = this.calculateBaseline(prices);
        const volumeBaseline = this.calculateBaseline(volumes);
        // Check latest data points for anomalies
        const recentData = data.slice(-5);
        for (const point of recentData) {
            // Price spike detection
            const priceDeviation = Math.abs(point.price - priceBaseline.mean) / priceBaseline.stdDev;
            if (priceDeviation > 2.5) { // 2.5 standard deviations
                anomalies.push({
                    anomalyId: `price_spike_${marketId}_${point.timestamp}`,
                    marketId,
                    type: 'price_spike',
                    severity: priceDeviation > 4 ? 'critical' : priceDeviation > 3 ? 'high' : 'medium',
                    deviation: priceDeviation,
                    expectedValue: priceBaseline.mean,
                    actualValue: point.price,
                    confidence: Math.min(0.95, priceDeviation / 5),
                    timeframe: 'immediate',
                    potentialCauses: await this.identifyAnomalyCauses('price_spike', priceDeviation),
                    impactAssessment: this.assessAnomalyImpact('price_spike', priceDeviation),
                    detectedAt: new Date()
                });
            }
            // Volume surge detection
            const volumeDeviation = Math.abs((point.volume || 1) - volumeBaseline.mean) / volumeBaseline.stdDev;
            if (volumeDeviation > 3) {
                anomalies.push({
                    anomalyId: `volume_surge_${marketId}_${point.timestamp}`,
                    marketId,
                    type: 'volume_surge',
                    severity: volumeDeviation > 5 ? 'high' : 'medium',
                    deviation: volumeDeviation,
                    expectedValue: volumeBaseline.mean,
                    actualValue: point.volume || 1,
                    confidence: Math.min(0.9, volumeDeviation / 6),
                    timeframe: 'short-term',
                    potentialCauses: await this.identifyAnomalyCauses('volume_surge', volumeDeviation),
                    impactAssessment: this.assessAnomalyImpact('volume_surge', volumeDeviation),
                    detectedAt: new Date()
                });
            }
        }
        return anomalies;
    }
    async identifyArbitrageOpportunities() {
        const opportunities = [];
        // This would analyze cross-sportsbook price differences
        // For demonstration, create sample arbitrage opportunity
        const arbitrageOpportunity = {
            insightId: `arbitrage_${Date.now()}`,
            type: 'opportunity',
            severity: 'medium',
            description: 'Cross-sportsbook arbitrage opportunity detected with 3.2% guaranteed profit',
            affectedMarkets: ['market_1', 'market_2'],
            confidence: 0.85,
            timeframe: '15 minutes',
            actionable: true,
            recommendations: [
                'Place bet on Market A at Sportsbook 1',
                'Place opposing bet on Market B at Sportsbook 2',
                'Monitor odds for changes'
            ],
            timestamp: new Date()
        };
        opportunities.push(arbitrageOpportunity);
        return opportunities;
    }
    async identifyValueBettingOpportunities() {
        const opportunities = [];
        // Sample value betting opportunity
        const valueBetOpportunity = {
            insightId: `value_bet_${Date.now()}`,
            type: 'opportunity',
            severity: 'medium',
            description: 'Value betting opportunity: Market odds suggest 45% probability but model predicts 55%',
            affectedMarkets: ['market_3'],
            confidence: 0.72,
            timeframe: '2 hours',
            actionable: true,
            recommendations: [
                'Consider betting on undervalued outcome',
                'Monitor model confidence levels',
                'Adjust position size based on edge'
            ],
            timestamp: new Date()
        };
        opportunities.push(valueBetOpportunity);
        return opportunities;
    }
    async identifyMarketInefficiencies() {
        const opportunities = [];
        // Sample market inefficiency
        const inefficiencyOpportunity = {
            insightId: `inefficiency_${Date.now()}`,
            type: 'opportunity',
            severity: 'low',
            description: 'Market inefficiency detected: Slow price adjustment to news event',
            affectedMarkets: ['market_4'],
            confidence: 0.68,
            timeframe: '30 minutes',
            actionable: true,
            recommendations: [
                'Monitor price adjustment speed',
                'Consider timing-based strategy',
                'Watch for market correction'
            ],
            timestamp: new Date()
        };
        opportunities.push(inefficiencyOpportunity);
        return opportunities;
    }
    async identifyTrendReversalOpportunities() {
        const opportunities = [];
        // Sample trend reversal opportunity
        const reversalOpportunity = {
            insightId: `trend_reversal_${Date.now()}`,
            type: 'opportunity',
            severity: 'medium',
            description: 'Potential trend reversal detected: Strong support level tested multiple times',
            affectedMarkets: ['market_5'],
            confidence: 0.76,
            timeframe: '4 hours',
            actionable: true,
            recommendations: [
                'Monitor support level breaks',
                'Consider contrarian position',
                'Set tight stop losses'
            ],
            timestamp: new Date()
        };
        opportunities.push(reversalOpportunity);
        return opportunities;
    }
    async assessLiquidityRisks() {
        const risks = [];
        // Sample liquidity risk
        const liquidityRisk = {
            insightId: `liquidity_risk_${Date.now()}`,
            type: 'risk',
            severity: 'medium',
            description: 'Liquidity risk: Reduced market depth detected in major markets',
            affectedMarkets: ['market_1', 'market_2', 'market_3'],
            confidence: 0.82,
            timeframe: 'next 2 hours',
            actionable: true,
            recommendations: [
                'Reduce position sizes',
                'Monitor bid-ask spreads',
                'Consider alternative markets'
            ],
            timestamp: new Date()
        };
        risks.push(liquidityRisk);
        return risks;
    }
    async assessVolatilityRisks() {
        const risks = [];
        // Sample volatility risk
        const volatilityRisk = {
            insightId: `volatility_risk_${Date.now()}`,
            type: 'risk',
            severity: 'high',
            description: 'Elevated volatility risk: Market uncertainty due to upcoming events',
            affectedMarkets: ['market_4', 'market_5'],
            confidence: 0.89,
            timeframe: 'next 6 hours',
            actionable: true,
            recommendations: [
                'Implement volatility-based position sizing',
                'Consider hedging strategies',
                'Monitor news events closely'
            ],
            timestamp: new Date()
        };
        risks.push(volatilityRisk);
        return risks;
    }
    async assessCorrelationRisks() {
        const risks = [];
        // Sample correlation risk
        const correlationRisk = {
            insightId: `correlation_risk_${Date.now()}`,
            type: 'risk',
            severity: 'medium',
            description: 'Correlation risk: Increased correlation between typically independent markets',
            affectedMarkets: ['market_1', 'market_3', 'market_5'],
            confidence: 0.74,
            timeframe: 'ongoing',
            actionable: true,
            recommendations: [
                'Diversify across uncorrelated markets',
                'Reduce concentration in correlated positions',
                'Monitor correlation changes'
            ],
            timestamp: new Date()
        };
        risks.push(correlationRisk);
        return risks;
    }
    async assessSystematicRisks() {
        const risks = [];
        // Sample systematic risk
        const systematicRisk = {
            insightId: `systematic_risk_${Date.now()}`,
            type: 'risk',
            severity: 'low',
            description: 'Systematic risk: Regulatory changes may affect market structure',
            affectedMarkets: ['all_markets'],
            confidence: 0.65,
            timeframe: 'long-term',
            actionable: false,
            recommendations: [
                'Monitor regulatory developments',
                'Maintain operational flexibility',
                'Diversify across jurisdictions'
            ],
            timestamp: new Date()
        };
        risks.push(systematicRisk);
        return risks;
    }
    // Helper Methods
    async getRecentMarketData() {
        // This would fetch real market data
        const mockData = new Map();
        // Generate sample market data
        for (let i = 1; i <= 5; i++) {
            const marketId = `market_${i}`;
            const data = this.generateSampleMarketData(20); // 20 data points
            mockData.set(marketId, data);
        }
        return mockData;
    }
    generateSampleMarketData(points) {
        const data = [];
        let price = 1.85 + Math.random() * 0.3; // Starting price between 1.85-2.15
        for (let i = 0; i < points; i++) {
            price += (Math.random() - 0.5) * 0.1; // Random walk
            price = Math.max(1.1, Math.min(10.0, price)); // Keep within reasonable bounds
            data.push({
                timestamp: new Date(Date.now() - (points - i) * 60 * 1000), // 1 minute intervals
                price: parseFloat(price.toFixed(3)),
                volume: Math.floor(Math.random() * 1000) + 100
            });
        }
        return data;
    }
    calculateSMA(prices, period) {
        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }
    calculateTrendStrength(prices) {
        if (prices.length < 2)
            return 0;
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        const change = Math.abs(lastPrice - firstPrice) / firstPrice;
        // Calculate R-squared for trend line
        const rSquared = this.calculateRSquared(prices);
        return Math.min(1, change * 2 + rSquared);
    }
    calculateRSquared(prices) {
        // Simplified R-squared calculation for trend line
        const n = prices.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = prices;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const _sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const yMean = sumY / n;
        const ssRes = y.reduce((sum, yi, i) => {
            const predicted = slope * x[i] + intercept;
            return sum + Math.pow(yi - predicted, 2);
        }, 0);
        const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
    }
    calculateMomentum(prices) {
        if (prices.length < 10)
            return 0;
        const recent = prices.slice(-5);
        const earlier = prices.slice(-10, -5);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
        return (recentAvg - earlierAvg) / earlierAvg;
    }
    calculateVolatility(prices) {
        if (prices.length < 2)
            return 0;
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push(Math.log(prices[i] / prices[i - 1]));
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
    calculateBaseline(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return { mean, stdDev };
    }
    calculateTrendConfidence(strength, momentum, volatility) {
        // Higher strength and momentum increase confidence
        // Higher volatility decreases confidence
        const baseConfidence = strength * 0.5 + Math.abs(momentum) * 0.3;
        const volatilityPenalty = volatility * 0.2;
        return Math.max(0, Math.min(1, baseConfidence - volatilityPenalty));
    }
    calculateTrendSeverity(trend) {
        if (trend.strength > 0.8 && trend.confidence > 0.8)
            return 'critical';
        if (trend.strength > 0.6 && trend.confidence > 0.7)
            return 'high';
        if (trend.strength > 0.4 && trend.confidence > 0.6)
            return 'medium';
        return 'low';
    }
    generateTrendDescription(trend) {
        const direction = trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1);
        const strength = trend.strength > 0.7 ? 'strong' : trend.strength > 0.5 ? 'moderate' : 'weak';
        return `${direction} ${strength} trend detected with ${(trend.confidence * 100).toFixed(1)}% confidence. ` +
            `Support at ${trend.supportLevel.toFixed(3)}, resistance at ${trend.resistanceLevel.toFixed(3)}.`;
    }
    generateAnomalyDescription(anomaly) {
        const type = anomaly.type.replace('_', ' ').toUpperCase();
        return `${type} detected: ${anomaly.deviation.toFixed(2)} standard deviations from normal. ` +
            `Expected ${anomaly.expectedValue.toFixed(3)}, observed ${anomaly.actualValue.toFixed(3)}.`;
    }
    generateTrendRecommendations(trend) {
        const recommendations = [];
        if (trend.direction === 'bullish' && trend.strength > 0.6) {
            recommendations.push('Consider long positions near support level');
            recommendations.push('Monitor momentum for continuation signals');
        }
        else if (trend.direction === 'bearish' && trend.strength > 0.6) {
            recommendations.push('Consider short positions near resistance level');
            recommendations.push('Watch for bounce opportunities at support');
        }
        else {
            recommendations.push('Monitor for trend development');
            recommendations.push('Wait for clearer directional signals');
        }
        if (trend.volatility > 0.3) {
            recommendations.push('Use smaller position sizes due to high volatility');
        }
        return recommendations;
    }
    generateAnomalyRecommendations(anomaly) {
        const recommendations = [];
        switch (anomaly.type) {
            case 'price_spike':
                recommendations.push('Investigate news or events causing price movement');
                recommendations.push('Consider fading the spike if no fundamental reason');
                recommendations.push('Monitor for follow-through or reversal');
                break;
            case 'volume_surge':
                recommendations.push('Analyze if volume surge confirms price movement');
                recommendations.push('Look for institutional activity or news catalyst');
                recommendations.push('Prepare for increased volatility');
                break;
            default:
                recommendations.push('Monitor situation closely');
                recommendations.push('Adjust risk management accordingly');
        }
        return recommendations;
    }
    async identifyTrendDrivers(_marketId, direction, strength) {
        // This would analyze news, events, and other factors driving the trend
        const drivers = [];
        if (strength > 0.7) {
            drivers.push('Strong momentum');
        }
        if (direction === 'bullish') {
            drivers.push('Positive market sentiment', 'Increased buying pressure');
        }
        else if (direction === 'bearish') {
            drivers.push('Negative market sentiment', 'Increased selling pressure');
        }
        return drivers;
    }
    async identifyAnomalyCauses(type, deviation) {
        const causes = [];
        if (type === 'price_spike') {
            causes.push('Breaking news or announcement');
            if (deviation > 3) {
                causes.push('Large institutional order', 'Market manipulation concern');
            }
        }
        else if (type === 'volume_surge') {
            causes.push('Increased market interest', 'News event or announcement');
        }
        return causes;
    }
    assessAnomalyImpact(_type, deviation) {
        if (deviation > 4)
            return 'Significant market disruption expected';
        if (deviation > 3)
            return 'Moderate impact on market dynamics';
        if (deviation > 2)
            return 'Minor impact, monitor for developments';
        return 'Limited impact expected';
    }
    async findHistoricalPrecedent(trend) {
        // This would search historical data for similar patterns
        if (trend.strength > 0.8 && trend.direction === 'bullish') {
            return 'Similar pattern observed in Q2 2023 with 73% accuracy';
        }
        return undefined;
    }
    formatTimeframe(duration) {
        if (duration < 60)
            return `${duration} minutes`;
        if (duration < 1440)
            return `${Math.round(duration / 60)} hours`;
        return `${Math.round(duration / 1440)} days`;
    }
    async getMarketHistory(_marketId) {
        // This would fetch historical market data
        return this.generateSampleMarketData(100); // 100 historical points
    }
    async selectBestModel(_marketId, timeHorizon) {
        // Select the best performing model for this market and time horizon
        const models = Array.from(this.forecastingModels.values());
        // Filter by time horizon compatibility
        const compatibleModels = models.filter(m => m.timeHorizon <= timeHorizon * 1.5 && m.timeHorizon >= timeHorizon * 0.5);
        // Return the most accurate compatible model
        return compatibleModels.reduce((best, current) => current.accuracy > best.accuracy ? current : best, compatibleModels[0] || models[0]);
    }
    async generateForecast(data, model, timeHorizon) {
        // This would use the actual model to generate forecasts
        const prices = data.map(d => d.price);
        const lastPrice = prices[prices.length - 1];
        // Simple forecast based on trend and volatility
        const trend = this.calculateMomentum(prices);
        const volatility = this.calculateVolatility(prices);
        const predictedChange = trend * timeHorizon * 0.1; // Scale by time horizon
        const predictedPrice = lastPrice * (1 + predictedChange);
        const uncertainty = volatility * Math.sqrt(timeHorizon / 60); // Scale uncertainty by time
        return {
            predictedPrice,
            priceRange: {
                min: predictedPrice * (1 - uncertainty),
                max: predictedPrice * (1 + uncertainty)
            },
            direction: trend > 0.02 ? 'bullish' : trend < -0.02 ? 'bearish' : 'neutral',
            momentum: trend,
            volatility,
            confidence: model.accuracy * (1 - uncertainty)
        };
    }
    async loadForecastingModels() {
        const models = [
            {
                modelId: 'lstm_short_term',
                type: 'neural_network',
                accuracy: 0.72,
                timeHorizon: 60, // 1 hour
                updateFrequency: 'hourly',
                lastTrained: new Date(),
                features: ['price', 'volume', 'momentum', 'volatility'],
                hyperparameters: { layers: 3, neurons: 64, dropout: 0.2 }
            },
            {
                modelId: 'arima_medium_term',
                type: 'time_series',
                accuracy: 0.68,
                timeHorizon: 360, // 6 hours
                updateFrequency: 'daily',
                lastTrained: new Date(),
                features: ['price', 'trend', 'seasonality'],
                hyperparameters: { p: 2, d: 1, q: 2 }
            },
            {
                modelId: 'ensemble_long_term',
                type: 'ensemble',
                accuracy: 0.75,
                timeHorizon: 1440, // 24 hours
                updateFrequency: 'daily',
                lastTrained: new Date(),
                features: ['price', 'volume', 'sentiment', 'external_factors'],
                hyperparameters: { models: ['lstm', 'arima', 'gradient_boost'], weights: [0.4, 0.3, 0.3] }
            }
        ];
        for (const model of models) {
            this.forecastingModels.set(model.modelId, model);
        }
    }
    async loadHistoricalPatterns() {
        // Load historical market patterns for comparison
        const patterns = {
            'bullish_breakout': { success_rate: 0.73, avg_duration: 180 },
            'bearish_reversal': { success_rate: 0.68, avg_duration: 120 },
            'sideways_consolidation': { success_rate: 0.82, avg_duration: 240 }
        };
        for (const [patternName, pattern] of Object.entries(patterns)) {
            this.historicalPatterns.set(patternName, pattern);
        }
    }
    async loadMarketTrends() {
        try {
            const cachedTrends = await enhanced_cache_1.redisCache.getPattern('forecaster:trends:*');
            for (const [key, data] of cachedTrends) {
                const marketId = key.split(':').pop();
                if (marketId) {
                    const trends = JSON.parse(data);
                    trends.forEach((trend) => {
                        trend.startTime = new Date(trend.startTime);
                        trend.projectedEndTime = new Date(trend.projectedEndTime);
                    });
                    this.marketTrends.set(marketId, trends);
                }
            }
            this.logger.info(`📋 Loaded trends for ${this.marketTrends.size} markets`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load market trends from cache');
        }
    }
    async loadAnomalyHistory() {
        try {
            const cachedAnomalies = await enhanced_cache_1.redisCache.getPattern('forecaster:anomalies:*');
            for (const [key, data] of cachedAnomalies) {
                const marketId = key.split(':').pop();
                if (marketId) {
                    const anomalies = JSON.parse(data);
                    anomalies.forEach((anomaly) => {
                        anomaly.detectedAt = new Date(anomaly.detectedAt);
                    });
                    this.detectedAnomalies.set(marketId, anomalies);
                }
            }
            this.logger.info(`📋 Loaded anomaly history for ${this.detectedAnomalies.size} markets`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load anomaly history from cache');
        }
    }
    async isHealthy() {
        return this.forecastingModels.size > 0;
    }
    async cleanup() {
        // Save market trends
        for (const [marketId, trends] of this.marketTrends) {
            await enhanced_cache_1.redisCache.set(`forecaster:trends:${marketId}`, JSON.stringify(trends), 86400 // 24 hours TTL
            );
        }
        // Save anomaly history
        for (const [marketId, anomalies] of this.detectedAnomalies) {
            await enhanced_cache_1.redisCache.set(`forecaster:anomalies:${marketId}`, JSON.stringify(anomalies), 86400 // 24 hours TTL
            );
        }
        this.forecastingModels.clear();
        this.marketTrends.clear();
        this.detectedAnomalies.clear();
        this.identifiedOpportunities.clear();
        this.assessedRisks.clear();
        this.historicalPatterns.clear();
        this.logger.info('🧹 MarketForecaster cleanup completed');
    }
}
exports.MarketForecaster = MarketForecaster;
