/**
 * Closing Line Prediction Types
 * Feature 2 of 8 Professional Capper Features
 *
 * ML-powered line closure forecasting using historical patterns
 * Predict final closing line from current line + time remaining
 * Account for injury news, weather, and market dynamics
 * Optimize entry timing for maximum CLV capture
 */
export interface ClosingLinePredictionConfig {
    modelVersion: string;
    modelPath?: string;
    useEnsemble: boolean;
    confidenceThreshold: number;
    maxHoursAhead: number;
    minHoursAhead: number;
    updateFrequency: number;
    historicalWeight: number;
    marketDynamicsWeight: number;
    injuryNewsWeight: number;
    weatherWeight: number;
    publicSentimentWeight: number;
    enabledDataSources: string[];
    historicalDepth: number;
    maxDataLatency: number;
    sportConfigs: Record<string, ClosingLineSportConfig>;
}
export interface ClosingLineSportConfig {
    sport: string;
    lineVolatility: number;
    injurySensitivity: number;
    weatherSensitivity: number;
    publicInfluence: number;
    sharpTiming: number;
    typicalCloseTime: number;
}
export interface ClosingLinePredictionInput {
    propId: string;
    sport: string;
    market: string;
    player?: string;
    team1?: string;
    team2?: string;
    currentLine: number;
    currentOdds: number;
    timestamp: string;
    hoursUntilGame: number;
    openingLine: number;
    lineHistory: HistoricalLinePoint[];
    similarGames: SimilarGameData[];
    marketFactors: MarketFactors;
    injuryReports: InjuryReport[];
    weatherForecast?: WeatherData;
    newsEvents: NewsEvent[];
}
export interface HistoricalLinePoint {
    timestamp: string;
    line: number;
    odds: number;
    volume?: number;
    bookmaker: string;
    hoursUntilGame: number;
}
export interface SimilarGameData {
    gameId: string;
    sport: string;
    market: string;
    similarity: number;
    openingLine: number;
    closingLine: number;
    lineMovement: number;
    hoursTracked: number;
    outcome: 'OVER' | 'UNDER' | 'PUSH';
}
export interface MarketFactors {
    totalVolume: number;
    volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
    sharpMoneyPercentage: number;
    publicMoneyPercentage: number;
    bidAskSpread: number;
    liquidity: number;
    bookmakerCount: number;
    consensusVariance: number;
    timeDecay: number;
    optimalBetTiming: number;
}
export interface InjuryReport {
    player: string;
    team: string;
    injuryType: string;
    severity: 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR';
    reportTime: string;
    impact: number;
    lineImpact: number;
    confirmed: boolean;
}
export interface WeatherData {
    location: string;
    timestamp: string;
    temperature: number;
    windSpeed: number;
    precipitation: number;
    conditions: string;
    indoorVenue: boolean;
    impact: number;
}
export interface NewsEvent {
    timestamp: string;
    source: string;
    headline: string;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    reliability: number;
    impact: number;
    tags: string[];
}
export interface ClosingLinePredictionResult {
    predictedClosingLine: number;
    confidence: number;
    predictionRange: {
        min: number;
        max: number;
        p25: number;
        p75: number;
    };
    expectedMovement: number;
    movementDirection: 'UP' | 'DOWN' | 'STABLE';
    movementProbability: number;
    timeRemaining: number;
    optimalEntryTiming: {
        bestTime: string;
        worstTime: string;
        currentValue: number;
        peakValue: number;
        reasoning: string;
    };
    factors: {
        historical: FactorContribution;
        marketDynamics: FactorContribution;
        injuries: FactorContribution;
        weather: FactorContribution;
        publicSentiment: FactorContribution;
        sharpMoney: FactorContribution;
    };
    modelInfo: {
        version: string;
        accuracy: number;
        sampleSize: number;
        lastUpdate: string;
        features: string[];
    };
    clvEstimate: {
        currentCLV: number;
        optimalCLV: number;
        expectedCLV: number;
        clvDecayRate: number;
    };
    riskFactors: {
        volatilityRisk: number;
        dataQualityRisk: number;
        timingRisk: number;
        overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    recommendation: ClosingLineRecommendation;
}
export interface FactorContribution {
    impact: number;
    confidence: number;
    weight: number;
    evidence: string[];
    dataQuality: number;
}
export interface ClosingLineRecommendation {
    action: 'BET_NOW' | 'WAIT_FOR_OPTIMAL' | 'MONITOR_AND_DECIDE' | 'AVOID';
    timing: {
        recommended: string;
        latest: string;
        reasoning: string;
    };
    valueAssessment: {
        currentValue: number;
        potentialValue: number;
        riskAdjustedValue: number;
    };
    alerts: {
        priceAlerts: PriceAlert[];
        newsAlerts: string[];
        deadlines: string[];
    };
}
export interface PriceAlert {
    targetLine: number;
    direction: 'ABOVE' | 'BELOW';
    action: 'BET' | 'AVOID';
    reasoning: string;
    probability: number;
}
export interface ClosingLinePredictionEngine {
    predictClosingLine(input: ClosingLinePredictionInput): Promise<ClosingLinePredictionResult>;
    batchPredictLines(inputs: ClosingLinePredictionInput[]): Promise<ClosingLinePredictionResult[]>;
    updateModel(modelData: any): Promise<void>;
    getModelInfo(): ModelInfo;
    validateModel(): Promise<ModelValidationResult>;
    backtestModel(period: string): Promise<BacktestResult>;
    getHistoricalAccuracy(filters?: AccuracyFilters): Promise<AccuracyMetrics>;
    getPerformanceMetrics(): Promise<PredictionPerformanceMetrics>;
    checkHealth(): Promise<EngineHealthStatus>;
    updateConfig(config: Partial<ClosingLinePredictionConfig>): void;
    getConfig(): ClosingLinePredictionConfig;
}
export interface ModelInfo {
    version: string;
    trainedOn: string;
    sampleSize: number;
    features: ModelFeature[];
    performance: ModelPerformance;
    sportCoverage: string[];
}
export interface ModelFeature {
    name: string;
    importance: number;
    type: 'NUMERICAL' | 'CATEGORICAL' | 'TIME_SERIES';
    description: string;
}
export interface ModelPerformance {
    accuracy: number;
    mae: number;
    rmse: number;
    r2: number;
    calibration: number;
}
export interface ModelValidationResult {
    isValid: boolean;
    accuracy: number;
    issues: string[];
    recommendations: string[];
    testSampleSize: number;
    lastValidation: string;
}
export interface BacktestResult {
    period: string;
    totalPredictions: number;
    accuracy: number;
    mae: number;
    rmse: number;
    profitability: number;
    sharpRatio: number;
    maxDrawdown: number;
    byTimePeriod: Record<string, BacktestPeriodResult>;
    bySport: Record<string, BacktestSportResult>;
}
export interface BacktestPeriodResult {
    period: string;
    accuracy: number;
    profitability: number;
    sampleSize: number;
}
export interface BacktestSportResult {
    sport: string;
    accuracy: number;
    profitability: number;
    sampleSize: number;
    avgLineMovement: number;
}
export interface AccuracyFilters {
    sport?: string;
    market?: string;
    dateRange?: {
        start: string;
        end: string;
    };
    hoursAhead?: number[];
    minConfidence?: number;
}
export interface AccuracyMetrics {
    overall: number;
    byConfidenceBucket: Record<string, number>;
    byTimeBucket: Record<string, number>;
    bySport: Record<string, number>;
    sampleSize: number;
    period: string;
}
export interface PredictionPerformanceMetrics {
    totalPredictions: number;
    predictionsLast24h: number;
    avgProcessingTime: number;
    overallAccuracy: number;
    recentAccuracy: number;
    accuracyTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    avgCLVCapture: number;
    optimalTimingSuccess: number;
    recommendationSuccess: number;
    modelFreshness: number;
    dataQuality: number;
    predictionLatency: number;
    sportMetrics: Record<string, SportPredictionMetrics>;
}
export interface SportPredictionMetrics {
    sport: string;
    predictions: number;
    accuracy: number;
    avgCLV: number;
    profitability: number;
    volatility: number;
}
export interface EngineHealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    lastUpdate: string;
    modelHealth: boolean;
    dataHealth: boolean;
    performanceHealth: boolean;
    warnings: string[];
    errors: string[];
}
//# sourceMappingURL=closing-line-prediction.d.ts.map