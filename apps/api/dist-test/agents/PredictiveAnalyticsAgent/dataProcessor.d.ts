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
export declare class DataProcessor {
    private readonly logger;
    private processingHistory;
    private qualityMetrics;
    private featureStore;
    private transformationPipeline;
    private outlierDetectors;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    processMarketData(rawData: MarketDataPoint[]): Promise<ProcessedData[]>;
    engineerFeatures(rawData: MarketDataPoint[]): Promise<MarketDataPoint[]>;
    validateDataQuality(data: ProcessedData[]): Promise<DataQualityReport>;
    private processDataPoint;
    private extractFeatures;
    private calculateTechnicalIndicators;
    private calculateMarketMetrics;
    private calculateSMA;
    private calculateEMA;
    private calculateRSI;
    private calculateMACD;
    private calculateBollingerBands;
    private calculateATR;
    private calculateMomentum;
    private calculateROC;
    private calculateWilliamR;
    private determineTrend;
    private calculateTrendStrength;
    private determineVolatilityRegime;
    private assessDataQuality;
    private cleanData;
    private detectDataOutliers;
    private isOutlier;
    private calculateDataTimeliness;
    private getVolumeMA;
    private getVolatilityRank;
    private getSourceReliability;
    private getMinutesToGame;
    private getMarketDepth;
    private getOrderFlow;
    private getTradeIntensity;
    private getHistoricalPrices;
    private calculateSupport;
    private calculateResistance;
    private calculateEfficiencyRatio;
    private calculateAnomalyScore;
    private calculateMarketSentiment;
    private calculatePressureIndex;
    private calculateDataPointQuality;
    private applyTransformation;
    private calculateDerivedFeatures;
    private generateInteractionFeatures;
    private createLagFeatures;
    private calculateRatioFeatures;
    private detectMissingData;
    private detectOutliers;
    private detectStaleData;
    private detectInconsistencies;
    private calculateMissingDataPercentage;
    private calculateOutlierPercentage;
    private calculateCompletenessScore;
    private calculateTimelinessScore;
    private calculateAccuracyScore;
    private calculateConsistencyScore;
    private handleOutliers;
    private fillMissingValues;
    private storeProcessedData;
    private updateQualityMetrics;
    private loadProcessingHistory;
    private loadQualityMetrics;
    private initializeFeatureEngineering;
    private setupOutlierDetection;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=dataProcessor.d.ts.map