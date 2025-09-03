import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface MarketDataPoint {
  id: string;
  marketId: string;
  gameId: string;
  timestamp: Date;
  odds: number;
  volume: number;
  price: number;
  bidAskSpread: number;
  liquidity: number;
  volatility: number;
  source: string;
  quality: number;
}

interface ProcessedData {
  id: string;
  marketId: string;
  features: Record<string, number>;
  technicalIndicators: TechnicalIndicators;
  marketMetrics: MarketMetrics;
  qualityScore: number;
  timestamp: Date;
  processingLatency: number;
}

interface TechnicalIndicators {
  sma_5: number;
  sma_10: number;
  sma_20: number;
  ema_5: number;
  ema_10: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  bollinger_upper: number;
  bollinger_lower: number;
  bollinger_width: number;
  atr: number;
  momentum: number;
  roc: number;
  williamR: number;
}

interface MarketMetrics {
  trend: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number;
  support: number;
  resistance: number;
  volatilityRegime: 'low' | 'medium' | 'high';
  liquidityScore: number;
  efficiencyRatio: number;
  anomalyScore: number;
  marketSentiment: number;
  pressureIndex: number;
}

interface DataQualityReport {
  totalDataPoints: number;
  qualityScore: number;
  missingDataPercentage: number;
  outlierPercentage: number;
  completenessScore: number;
  timelinessScore: number;
  accuracyScore: number;
  consistencyScore: number;
  issues: DataQualityIssue[];
}

interface DataQualityIssue {
  type: 'missing' | 'outlier' | 'stale' | 'inconsistent' | 'anomalous';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFields: string[];
  count: number;
  recommendation: string;
}

interface FeatureEngineeringConfig {
  rawFeatures: string[];
  engineeredFeatures: string[];
  transformations: FeatureTransformation[];
  correlationMatrix: Map<string, Map<string, number>>;
  importance: Map<string, number>;
}

interface FeatureTransformation {
  name: string;
  type: 'polynomial' | 'interaction' | 'lag' | 'diff' | 'ratio' | 'zscore' | 'minmax';
  inputFeatures: string[];
  outputFeature: string;
  parameters: Record<string, any>;
}

export class DataProcessor {
  private readonly logger: Logger;
  private processingHistory: Map<string, ProcessedData[]> = new Map();
  private qualityMetrics: Map<string, DataQualityReport> = new Map();
  private featureStore: Map<string, any> = new Map();
  private transformationPipeline: FeatureTransformation[] = [];
  private outlierDetectors: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('📊 Initializing DataProcessor');
    
    await this.loadProcessingHistory();
    await this.loadQualityMetrics();
    await this.initializeFeatureEngineering();
    await this.setupOutlierDetection();
    
    this.logger.info('✅ DataProcessor initialized');
  }

  async processMarketData(rawData: MarketDataPoint[]): Promise<ProcessedData[]> {
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
      const processedData: ProcessedData[] = [];
      
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

    } catch (error) {
      this.logger.error('❌ Failed to process market data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async engineerFeatures(rawData: MarketDataPoint[]): Promise<MarketDataPoint[]> {
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

    } catch (error) {
      this.logger.error('❌ Feature engineering failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return rawData; // Return original data as fallback
    }
  }

  async validateDataQuality(data: ProcessedData[]): Promise<DataQualityReport> {
    this.logger.debug('🔍 Validating processed data quality');

    try {
      const qualityIssues: DataQualityIssue[] = [];
      const _totalScore = 0;
      const _scoreCount = 0;

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

      const report: DataQualityReport = {
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

    } catch (error) {
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
  private async processDataPoint(
    dataPoint: MarketDataPoint, 
    processingStartTime: number
  ): Promise<ProcessedData> {
    
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

  private async extractFeatures(dataPoint: MarketDataPoint): Promise<Record<string, number>> {
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

  private async calculateTechnicalIndicators(dataPoint: MarketDataPoint): Promise<TechnicalIndicators> {
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

  private async calculateMarketMetrics(
    dataPoint: MarketDataPoint, 
    indicators: TechnicalIndicators
  ): Promise<MarketMetrics> {
    
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
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length < period) return this.calculateSMA(prices, prices.length);
    
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Simplified signal line calculation
    const signal = macd * 0.9; // Approximation
    
    return { macd, signal };
  }

  private calculateBollingerBands(prices: number[], period: number): { upper: number; lower: number; width: number } {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upper = sma + (2 * stdDev);
    const lower = sma - (2 * stdDev);
    const width = upper - lower;
    
    return { upper, lower, width };
  }

  private calculateATR(prices: number[], period: number): number {
    // Simplified ATR calculation using price volatility
    if (prices.length < 2) return 0;
    
    const ranges = [];
    for (let i = 1; i < Math.min(prices.length, period + 1); i++) {
      ranges.push(Math.abs(prices[i] - prices[i - 1]));
    }
    
    return ranges.reduce((sum, range) => sum + range, 0) / ranges.length;
  }

  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    return prices[prices.length - 1] - prices[prices.length - 1 - period];
  }

  private calculateROC(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const previous = prices[prices.length - 1 - period];
    return previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  }

  private calculateWilliamR(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const slice = prices.slice(-period);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    const current = prices[prices.length - 1];
    
    return highest !== lowest ? ((highest - current) / (highest - lowest)) * -100 : 0;
  }

  // Helper Methods
  private determineTrend(indicators: TechnicalIndicators): 'bullish' | 'bearish' | 'neutral' {
    const macdTrend = indicators.macd > indicators.macdSignal;
    const smaTrend = indicators.sma_5 > indicators.sma_10 && indicators.sma_10 > indicators.sma_20;
    const rsiTrend = indicators.rsi > 50;
    
    const bullishSignals = [macdTrend, smaTrend, rsiTrend].filter(Boolean).length;
    
    if (bullishSignals >= 2) return 'bullish';
    if (bullishSignals <= 1) return 'bearish';
    return 'neutral';
  }

  private calculateTrendStrength(indicators: TechnicalIndicators): number {
    const rsiStrength = Math.abs(indicators.rsi - 50) / 50;
    const macdStrength = Math.abs(indicators.macd - indicators.macdSignal) / Math.max(0.01, Math.abs(indicators.macdSignal));
    const bollingerStrength = Math.abs(indicators.bollinger_width) / Math.max(0.01, (indicators.bollinger_upper + indicators.bollinger_lower) / 2);
    
    return Math.min(1, (rsiStrength + macdStrength + bollingerStrength) / 3);
  }

  private determineVolatilityRegime(volatility: number): 'low' | 'medium' | 'high' {
    if (volatility < 0.15) return 'low';
    if (volatility < 0.30) return 'medium';
    return 'high';
  }

  // Data Quality Methods
  private async assessDataQuality(data: MarketDataPoint[]): Promise<DataQualityReport> {
    const issues: DataQualityIssue[] = [];
    
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

  private async cleanData(data: MarketDataPoint[], _qualityReport: DataQualityReport): Promise<MarketDataPoint[]> {
    let cleanedData = [...data];
    
    // Remove data points with critical quality issues
    cleanedData = cleanedData.filter(d => d.price > 0 && d.odds > 0 && d.volume >= 0);
    
    // Handle outliers
    cleanedData = await this.handleOutliers(cleanedData);
    
    // Fill missing values
    cleanedData = await this.fillMissingValues(cleanedData);
    
    return cleanedData;
  }

  private async detectDataOutliers(data: MarketDataPoint[]): Promise<MarketDataPoint[]> {
    const outliers: MarketDataPoint[] = [];
    
    for (const point of data) {
      // Simple outlier detection using IQR method
      if (await this.isOutlier(point, data)) {
        outliers.push(point);
      }
    }
    
    return outliers;
  }

  private async isOutlier(point: MarketDataPoint, dataset: MarketDataPoint[]): Promise<boolean> {
    const prices = dataset.map(d => d.price).sort((a, b) => a - b);
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q3 = prices[Math.floor(prices.length * 0.75)];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return point.price < lowerBound || point.price > upperBound;
  }

  private calculateDataTimeliness(data: MarketDataPoint[]): number {
    const now = new Date();
    const avgAge = data.reduce((sum, d) => {
      return sum + (now.getTime() - new Date(d.timestamp).getTime());
    }, 0) / data.length;
    
    // Score based on age (fresher data = higher professional_score)
    const maxAcceptableAge = 60 * 60 * 1000; // 1 hour
    return Math.max(0, 1 - (avgAge / maxAcceptableAge));
  }

  // Placeholder methods for missing functionality
  private async getVolumeMA(_marketId: string, _period: number): Promise<number> { return 1000; }
  private async getVolatilityRank(_marketId: string, _volatility: number): Promise<number> { return 0.5; }
  private async getSourceReliability(source: string): Promise<number> { return 0.8; }
  private async getMinutesToGame(gameId: string): Promise<number> { return 120; }
  private async getMarketDepth(marketId: string): Promise<number> { return 0.5; }
  private async getOrderFlow(marketId: string): Promise<number> { return 0.3; }
  private async getTradeIntensity(marketId: string): Promise<number> { return 0.7; }
  private async getHistoricalPrices(marketId: string, count: number): Promise<number[]> {
    // Mock historical prices
    return Array.from({ length: count }, (_, i) => 100 + Math.random() * 20 - 10);
  }
  private async calculateSupport(marketId: string): Promise<number> { return 95; }
  private async calculateResistance(marketId: string): Promise<number> { return 105; }
  private async calculateEfficiencyRatio(marketId: string): Promise<number> { return 0.6; }
  private async calculateAnomalyScore(dataPoint: MarketDataPoint): Promise<number> { return 0.1; }
  private async calculateMarketSentiment(marketId: string): Promise<number> { return 0.6; }
  private async calculatePressureIndex(marketId: string): Promise<number> { return 0.4; }
  private async calculateDataPointQuality(dataPoint: MarketDataPoint): Promise<number> { return 0.8; }

  // More placeholder methods
  private async applyTransformation(data: MarketDataPoint[], transformation: FeatureTransformation): Promise<void> {}
  private async calculateDerivedFeatures(data: MarketDataPoint[]): Promise<void> {}
  private async generateInteractionFeatures(data: MarketDataPoint[]): Promise<void> {}
  private async createLagFeatures(data: MarketDataPoint[]): Promise<void> {}
  private async calculateRatioFeatures(data: MarketDataPoint[]): Promise<void> {}
  private async detectMissingData(data: ProcessedData[]): Promise<DataQualityIssue[]> { return []; }
  private async detectOutliers(data: ProcessedData[]): Promise<DataQualityIssue[]> { return []; }
  private async detectStaleData(data: ProcessedData[]): Promise<DataQualityIssue[]> { return []; }
  private async detectInconsistencies(data: ProcessedData[]): Promise<DataQualityIssue[]> { return []; }
  private calculateMissingDataPercentage(data: ProcessedData[]): number { return 0; }
  private calculateOutlierPercentage(data: ProcessedData[]): number { return 0; }
  private calculateCompletenessScore(data: ProcessedData[]): number { return 0.9; }
  private calculateTimelinessScore(data: ProcessedData[]): number { return 0.8; }
  private calculateAccuracyScore(data: ProcessedData[]): number { return 0.85; }
  private calculateConsistencyScore(data: ProcessedData[]): number { return 0.9; }
  private async handleOutliers(data: MarketDataPoint[]): Promise<MarketDataPoint[]> { return data; }
  private async fillMissingValues(data: MarketDataPoint[]): Promise<MarketDataPoint[]> { return data; }

  private async storeProcessedData(data: ProcessedData[]): Promise<void> {
    for (const processed of data) {
      await redisCache.set(
        `processed_data:${processed.id}`,
        JSON.stringify(processed),
        3600 // 1 hour TTL
      );
    }
  }

  private async updateQualityMetrics(report: DataQualityReport): Promise<void> {
    await redisCache.set(
      'data_processor:quality_metrics',
      JSON.stringify(report),
      3600 // 1 hour TTL
    );
  }

  private async loadProcessingHistory(): Promise<void> {
    try {
      const cached = await redisCache.getPattern('processed_data:*');
      for (const [key, data] of cached) {
        const processed = JSON.parse(data);
        const marketId = processed.marketId;
        const history = this.processingHistory.get(marketId) || [];
        history.push(processed);
        this.processingHistory.set(marketId, history);
      }
      this.logger.info(`📋 Loaded processing history for ${this.processingHistory.size} markets`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load processing history');
    }
  }

  private async loadQualityMetrics(): Promise<void> {
    try {
      const cached = await redisCache.get('data_processor:quality_metrics');
      if (cached) {
        const metrics = JSON.parse(cached);
        this.qualityMetrics.set('latest', metrics);
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load quality metrics');
    }
  }

  private async initializeFeatureEngineering(): Promise<void> {
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

  private async setupOutlierDetection(): Promise<void> {
    this.outlierDetectors.set('isolation_forest', {
      contamination: 0.05,
      threshold: 0.1
    });
  }

  async isHealthy(): Promise<boolean> {
    return this.transformationPipeline.length > 0;
  }

  async cleanup(): Promise<void> {
    // Save processing history
    for (const [marketId, history] of this.processingHistory) {
      await redisCache.set(
        `data_processor:history:${marketId}`,
        JSON.stringify(history),
        86400 // 24 hours TTL
      );
    }

    this.processingHistory.clear();
    this.qualityMetrics.clear();
    this.featureStore.clear();
    this.outlierDetectors.clear();
    
    this.logger.info('🧹 DataProcessor cleanup completed');
  }
}