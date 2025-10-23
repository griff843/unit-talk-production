"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProcessor = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class DataProcessor {
    constructor(logger) {
        this.processingHistory = new Map();
        this.qualityMetrics = new Map();
        this.featureStore = new Map();
        this.transformationPipeline = [];
        this.outlierDetectors = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('📊 Initializing DataProcessor');
        await this.loadProcessingHistory();
        await this.loadQualityMetrics();
        await this.initializeFeatureEngineering();
        await this.setupOutlierDetection();
        this.logger.info('✅ DataProcessor initialized');
    }
    async processMarketData(rawData) {
        this.logger.info('🔄 Processing market data', { dataPoints: rawData.length });
        const processingStartTime = Date.now();
        try {
            // 1. Data quality assessment
            const qualityReport = await this.assessDataQuality(rawData);
            // 2. Data cleaning and filtering
            const cleanedData = await this.cleanData(rawData, qualityReport);
            // 3. Feature engineering
            const engineeredData = await this.engineerFeatures(cleanedData);
            // 4. Technical indicator calculation
            const processedData = [];
            for (const dataPoint of engineeredData) {
                const processed = await this.processDataPoint(dataPoint, processingStartTime);
                processedData.push(processed);
            }
            // 5. Store processed data
            await this.storeProcessedData(processedData);
            // 6. Update quality metrics
            await this.updateQualityMetrics(qualityReport);
            const processingTime = Date.now() - processingStartTime;
            this.logger.info('✅ Market data processed successfully', {
                inputPoints: rawData.length,
                outputPoints: processedData.length,
                processingTimeMs: processingTime,
                qualityScore: qualityReport.qualityScore
            });
            return processedData;
        }
        catch (error) {
            this.logger.error('❌ Failed to process market data', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async engineerFeatures(rawData) {
        this.logger.debug('🔧 Engineering features for market data');
        try {
            const engineeredData = [...rawData];
            // Apply transformation pipeline
            for (const transformation of this.transformationPipeline) {
                await this.applyTransformation(engineeredData, transformation);
            }
            // Calculate derived features
            await this.calculateDerivedFeatures(engineeredData);
            // Generate interaction features
            await this.generateInteractionFeatures(engineeredData);
            // Create lag features
            await this.createLagFeatures(engineeredData);
            // Calculate ratio features
            await this.calculateRatioFeatures(engineeredData);
            this.logger.debug('✅ Feature engineering completed', {
                transformations: this.transformationPipeline.length,
                dataPoints: engineeredData.length
            });
            return engineeredData;
        }
        catch (error) {
            this.logger.error('❌ Feature engineering failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return rawData; // Return original data as fallback
        }
    }
    async validateDataQuality(data) {
        this.logger.debug('🔍 Validating processed data quality');
        try {
            const qualityIssues = [];
            // TODO: Implement quality scoring logic
            // const totalScore = 0;
            // const scoreCount = 0;
            // Check for missing data
            const missingDataIssues = await this.detectMissingData(data);
            qualityIssues.push(...missingDataIssues);
            // Check for outliers
            const outlierIssues = await this.detectOutliers(data);
            qualityIssues.push(...outlierIssues);
            // Check data staleness
            const stalenessIssues = await this.detectStaleData(data);
            qualityIssues.push(...stalenessIssues);
            // Check consistency
            const consistencyIssues = await this.detectInconsistencies(data);
            qualityIssues.push(...consistencyIssues);
            // Calculate overall quality professional_score
            const criticalIssues = qualityIssues.filter(i => i.severity === 'critical').length;
            const highIssues = qualityIssues.filter(i => i.severity === 'high').length;
            const mediumIssues = qualityIssues.filter(i => i.severity === 'medium').length;
            const qualityScore = Math.max(0, 1 - (criticalIssues * 0.3 + highIssues * 0.2 + mediumIssues * 0.1));
            const report = {
                totalDataPoints: data.length,
                qualityScore,
                missingDataPercentage: this.calculateMissingDataPercentage(data),
                outlierPercentage: this.calculateOutlierPercentage(data),
                completenessScore: this.calculateCompletenessScore(data),
                timelinessScore: this.calculateTimelinessScore(data),
                accuracyScore: this.calculateAccuracyScore(data),
                consistencyScore: this.calculateConsistencyScore(data),
                issues: qualityIssues
            };
            return report;
        }
        catch (error) {
            this.logger.error('❌ Data quality validation failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                totalDataPoints: data.length,
                qualityScore: 0.5,
                missingDataPercentage: 0,
                outlierPercentage: 0,
                completenessScore: 0.5,
                timelinessScore: 0.5,
                accuracyScore: 0.5,
                consistencyScore: 0.5,
                issues: []
            };
        }
    }
    // Private Methods
    async processDataPoint(dataPoint, processingStartTime) {
        const features = await this.extractFeatures(dataPoint);
        const technicalIndicators = await this.calculateTechnicalIndicators(dataPoint);
        const marketMetrics = await this.calculateMarketMetrics(dataPoint, technicalIndicators);
        const qualityScore = await this.calculateDataPointQuality(dataPoint);
        return {
            id: `processed_${dataPoint.id}`,
            marketId: dataPoint.marketId,
            features,
            technicalIndicators,
            marketMetrics,
            qualityScore,
            timestamp: new Date(),
            processingLatency: Date.now() - processingStartTime
        };
    }
    async extractFeatures(dataPoint) {
        return {
            // Price features
            price: dataPoint.price,
            odds: dataPoint.odds,
            log_price: Math.log(dataPoint.price),
            log_odds: Math.log(dataPoint.odds),
            // Volume features
            volume: dataPoint.volume,
            log_volume: Math.log(Math.max(1, dataPoint.volume)),
            volume_ma_ratio: dataPoint.volume / Math.max(1, await this.getVolumeMA(dataPoint.marketId, 20)),
            // Spread features
            bid_ask_spread: dataPoint.bidAskSpread,
            spread_percentage: dataPoint.bidAskSpread / Math.max(0.01, dataPoint.price),
            // Liquidity features
            liquidity: dataPoint.liquidity,
            liquidity_score: Math.min(1, dataPoint.liquidity / 10000),
            // Volatility features
            volatility: dataPoint.volatility,
            volatility_rank: await this.getVolatilityRank(dataPoint.marketId, dataPoint.volatility),
            // Quality features
            data_quality: dataPoint.quality,
            source_reliability: await this.getSourceReliability(dataPoint.source),
            // Time features
            hour_of_day: new Date(dataPoint.timestamp).getHours(),
            day_of_week: new Date(dataPoint.timestamp).getDay(),
            minutes_to_game: await this.getMinutesToGame(dataPoint.gameId),
            // Market structure features
            market_depth: await this.getMarketDepth(dataPoint.marketId),
            order_flow: await this.getOrderFlow(dataPoint.marketId),
            trade_intensity: await this.getTradeIntensity(dataPoint.marketId)
        };
    }
    async calculateTechnicalIndicators(dataPoint) {
        const historicalPrices = await this.getHistoricalPrices(dataPoint.marketId, 50);
        return {
            sma_5: this.calculateSMA(historicalPrices, 5),
            sma_10: this.calculateSMA(historicalPrices, 10),
            sma_20: this.calculateSMA(historicalPrices, 20),
            ema_5: this.calculateEMA(historicalPrices, 5),
            ema_10: this.calculateEMA(historicalPrices, 10),
            rsi: this.calculateRSI(historicalPrices, 14),
            macd: this.calculateMACD(historicalPrices).macd,
            macdSignal: this.calculateMACD(historicalPrices).signal,
            bollinger_upper: this.calculateBollingerBands(historicalPrices, 20).upper,
            bollinger_lower: this.calculateBollingerBands(historicalPrices, 20).lower,
            bollinger_width: this.calculateBollingerBands(historicalPrices, 20).width,
            atr: this.calculateATR(historicalPrices, 14),
            momentum: this.calculateMomentum(historicalPrices, 10),
            roc: this.calculateROC(historicalPrices, 10),
            williamR: this.calculateWilliamR(historicalPrices, 14)
        };
    }
    async calculateMarketMetrics(dataPoint, indicators) {
        const trend = this.determineTrend(indicators);
        const trendStrength = this.calculateTrendStrength(indicators);
        const support = await this.calculateSupport(dataPoint.marketId);
        const resistance = await this.calculateResistance(dataPoint.marketId);
        const volatilityRegime = this.determineVolatilityRegime(dataPoint.volatility);
        const liquidityScore = Math.min(1, dataPoint.liquidity / 10000);
        const efficiencyRatio = await this.calculateEfficiencyRatio(dataPoint.marketId);
        const anomalyScore = await this.calculateAnomalyScore(dataPoint);
        const marketSentiment = await this.calculateMarketSentiment(dataPoint.marketId);
        const pressureIndex = await this.calculatePressureIndex(dataPoint.marketId);
        return {
            trend,
            trendStrength,
            support,
            resistance,
            volatilityRegime,
            liquidityScore,
            efficiencyRatio,
            anomalyScore,
            marketSentiment,
            pressureIndex
        };
    }
    // Technical Indicator Calculations
    calculateSMA(prices, period) {
        if (prices.length < period)
            return prices[prices.length - 1] || 0;
        const slice = prices.slice(-period);
        return slice.reduce((sum, price) => sum + price, 0) / period;
    }
    calculateEMA(prices, period) {
        if (prices.length === 0)
            return 0;
        if (prices.length < period)
            return this.calculateSMA(prices, prices.length);
        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(prices.slice(0, period), period);
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }
        return ema;
    }
    calculateRSI(prices, period) {
        if (prices.length < period + 1)
            return 50;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = prices[prices.length - i] - prices[prices.length - i - 1];
            if (change >= 0)
                gains += change;
            else
                losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macd = ema12 - ema26;
        // Simplified signal line calculation
        const signal = macd * 0.9; // Approximation
        return { macd, signal };
    }
    calculateBollingerBands(prices, period) {
        const sma = this.calculateSMA(prices, period);
        const slice = prices.slice(-period);
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upper = sma + (2 * stdDev);
        const lower = sma - (2 * stdDev);
        const width = upper - lower;
        return { upper, lower, width };
    }
    calculateATR(prices, period) {
        // Simplified ATR calculation using price volatility
        if (prices.length < 2)
            return 0;
        const ranges = [];
        for (let i = 1; i < Math.min(prices.length, period + 1); i++) {
            ranges.push(Math.abs(prices[i] - prices[i - 1]));
        }
        return ranges.reduce((sum, range) => sum + range, 0) / ranges.length;
    }
    calculateMomentum(prices, period) {
        if (prices.length < period + 1)
            return 0;
        return prices[prices.length - 1] - prices[prices.length - 1 - period];
    }
    calculateROC(prices, period) {
        if (prices.length < period + 1)
            return 0;
        const current = prices[prices.length - 1];
        const previous = prices[prices.length - 1 - period];
        return previous !== 0 ? ((current - previous) / previous) * 100 : 0;
    }
    calculateWilliamR(prices, period) {
        if (prices.length < period)
            return 0;
        const slice = prices.slice(-period);
        const highest = Math.max(...slice);
        const lowest = Math.min(...slice);
        const current = prices[prices.length - 1];
        return highest !== lowest ? ((highest - current) / (highest - lowest)) * -100 : 0;
    }
    // Helper Methods
    determineTrend(indicators) {
        const macdTrend = indicators.macd > indicators.macdSignal;
        const smaTrend = indicators.sma_5 > indicators.sma_10 && indicators.sma_10 > indicators.sma_20;
        const rsiTrend = indicators.rsi > 50;
        const bullishSignals = [macdTrend, smaTrend, rsiTrend].filter(Boolean).length;
        if (bullishSignals >= 2)
            return 'bullish';
        if (bullishSignals <= 1)
            return 'bearish';
        return 'neutral';
    }
    calculateTrendStrength(indicators) {
        const rsiStrength = Math.abs(indicators.rsi - 50) / 50;
        const macdStrength = Math.abs(indicators.macd - indicators.macdSignal) / Math.max(0.01, Math.abs(indicators.macdSignal));
        const bollingerStrength = Math.abs(indicators.bollinger_width) / Math.max(0.01, (indicators.bollinger_upper + indicators.bollinger_lower) / 2);
        return Math.min(1, (rsiStrength + macdStrength + bollingerStrength) / 3);
    }
    determineVolatilityRegime(volatility) {
        if (volatility < 0.15)
            return 'low';
        if (volatility < 0.30)
            return 'medium';
        return 'high';
    }
    // Data Quality Methods
    async assessDataQuality(data) {
        const issues = [];
        // Check for missing data
        const missingCount = data.filter(d => !d.price || !d.odds || !d.volume).length;
        if (missingCount > 0) {
            issues.push({
                type: 'missing',
                severity: missingCount > data.length * 0.1 ? 'high' : 'medium',
                description: `${missingCount} data points have missing required fields`,
                affectedFields: ['price', 'odds', 'volume'],
                count: missingCount,
                recommendation: 'Implement data validation and fallback mechanisms'
            });
        }
        // Check for outliers
        const outliers = await this.detectDataOutliers(data);
        if (outliers.length > 0) {
            issues.push({
                type: 'outlier',
                severity: outliers.length > data.length * 0.05 ? 'medium' : 'low',
                description: `${outliers.length} potential outlier data points detected`,
                affectedFields: ['price', 'odds', 'volume'],
                count: outliers.length,
                recommendation: 'Review outlier detection thresholds and data sources'
            });
        }
        const qualityScore = Math.max(0, 1 - (issues.length * 0.1));
        return {
            totalDataPoints: data.length,
            qualityScore,
            missingDataPercentage: (missingCount / Math.max(1, data.length)) * 100,
            outlierPercentage: (outliers.length / Math.max(1, data.length)) * 100,
            completenessScore: 1 - (missingCount / Math.max(1, data.length)),
            timelinessScore: this.calculateDataTimeliness(data),
            accuracyScore: 0.8, // Placeholder
            consistencyScore: 0.85, // Placeholder
            issues
        };
    }
    async cleanData(data, _qualityReport) {
        let cleanedData = [...data];
        // Remove data points with critical quality issues
        cleanedData = cleanedData.filter(d => d.price > 0 && d.odds > 0 && d.volume >= 0);
        // Handle outliers
        cleanedData = await this.handleOutliers(cleanedData);
        // Fill missing values
        cleanedData = await this.fillMissingValues(cleanedData);
        return cleanedData;
    }
    async detectDataOutliers(data) {
        const outliers = [];
        for (const point of data) {
            // Simple outlier detection using IQR method
            if (await this.isOutlier(point, data)) {
                outliers.push(point);
            }
        }
        return outliers;
    }
    async isOutlier(point, dataset) {
        const prices = dataset.map(d => d.price).sort((a, b) => a - b);
        const q1 = prices[Math.floor(prices.length * 0.25)];
        const q3 = prices[Math.floor(prices.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        return point.price < lowerBound || point.price > upperBound;
    }
    calculateDataTimeliness(data) {
        const now = new Date();
        const avgAge = data.reduce((sum, d) => {
            return sum + (now.getTime() - new Date(d.timestamp).getTime());
        }, 0) / data.length;
        // Score based on age (fresher data = higher professional_score)
        const maxAcceptableAge = 60 * 60 * 1000; // 1 hour
        return Math.max(0, 1 - (avgAge / maxAcceptableAge));
    }
    // Placeholder methods for missing functionality
    async getVolumeMA(_marketId, _period) { return 1000; }
    async getVolatilityRank(_marketId, _volatility) { return 0.5; }
    async getSourceReliability(_source) { return 0.8; }
    async getMinutesToGame(_gameId) { return 120; }
    async getMarketDepth(_marketId) { return 0.5; }
    async getOrderFlow(_marketId) { return 0.3; }
    async getTradeIntensity(_marketId) { return 0.7; }
    async getHistoricalPrices(_marketId, count) {
        // Mock historical prices
        return Array.from({ length: count }, (_, _i) => 100 + Math.random() * 20 - 10);
    }
    async calculateSupport(_marketId) { return 95; }
    async calculateResistance(_marketId) { return 105; }
    async calculateEfficiencyRatio(_marketId) { return 0.6; }
    async calculateAnomalyScore(_dataPoint) { return 0.1; }
    async calculateMarketSentiment(_marketId) { return 0.6; }
    async calculatePressureIndex(_marketId) { return 0.4; }
    async calculateDataPointQuality(_dataPoint) { return 0.8; }
    // More placeholder methods
    async applyTransformation(_data, _transformation) { }
    async calculateDerivedFeatures(_data) { }
    async generateInteractionFeatures(_data) { }
    async createLagFeatures(_data) { }
    async calculateRatioFeatures(_data) { }
    async detectMissingData(_data) { return []; }
    async detectOutliers(_data) { return []; }
    async detectStaleData(_data) { return []; }
    async detectInconsistencies(_data) { return []; }
    calculateMissingDataPercentage(_data) { return 0; }
    calculateOutlierPercentage(_data) { return 0; }
    calculateCompletenessScore(_data) { return 0.9; }
    calculateTimelinessScore(_data) { return 0.8; }
    calculateAccuracyScore(_data) { return 0.85; }
    calculateConsistencyScore(_data) { return 0.9; }
    async handleOutliers(_data) { return _data; }
    async fillMissingValues(_data) { return _data; }
    async storeProcessedData(data) {
        for (const processed of data) {
            await enhanced_cache_1.redisCache.set(`processed_data:${processed.id}`, JSON.stringify(processed), 3600 // 1 hour TTL
            );
        }
    }
    async updateQualityMetrics(report) {
        await enhanced_cache_1.redisCache.set('data_processor:quality_metrics', JSON.stringify(report), 3600 // 1 hour TTL
        );
    }
    async loadProcessingHistory() {
        try {
            const cached = await enhanced_cache_1.redisCache.getPattern('processed_data:*');
            for (const [_key, data] of cached) {
                const processed = JSON.parse(data);
                const marketId = processed.marketId;
                const history = this.processingHistory.get(marketId) || [];
                history.push(processed);
                this.processingHistory.set(marketId, history);
            }
            this.logger.info(`📋 Loaded processing history for ${this.processingHistory.size} markets`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load processing history');
        }
    }
    async loadQualityMetrics() {
        try {
            const cached = await enhanced_cache_1.redisCache.get('data_processor:quality_metrics');
            if (cached) {
                const metrics = JSON.parse(cached);
                this.qualityMetrics.set('latest', metrics);
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load quality metrics');
        }
    }
    async initializeFeatureEngineering() {
        this.transformationPipeline = [
            {
                name: 'log_transform',
                type: 'polynomial',
                inputFeatures: ['price', 'volume'],
                outputFeature: 'log_features',
                parameters: { degree: 1, log: true }
            },
            {
                name: 'price_momentum',
                type: 'lag',
                inputFeatures: ['price'],
                outputFeature: 'price_momentum',
                parameters: { lags: [1, 5, 10] }
            }
        ];
    }
    async setupOutlierDetection() {
        this.outlierDetectors.set('isolation_forest', {
            contamination: 0.05,
            threshold: 0.1
        });
    }
    async isHealthy() {
        return this.transformationPipeline.length > 0;
    }
    async cleanup() {
        // Save processing history
        for (const [marketId, history] of this.processingHistory) {
            await enhanced_cache_1.redisCache.set(`data_processor:history:${marketId}`, JSON.stringify(history), 86400 // 24 hours TTL
            );
        }
        this.processingHistory.clear();
        this.qualityMetrics.clear();
        this.featureStore.clear();
        this.outlierDetectors.clear();
        this.logger.info('🧹 DataProcessor cleanup completed');
    }
}
exports.DataProcessor = DataProcessor;
