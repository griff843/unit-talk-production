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
  // ML Model Configuration
  modelVersion: string; // Default: 'v2.1'
  modelPath?: string;
  useEnsemble: boolean; // Default: true
  confidenceThreshold: number; // Default: 0.75

  // Prediction Parameters
  maxHoursAhead: number; // Default: 72 hours
  minHoursAhead: number; // Default: 0.5 hours
  updateFrequency: number; // Default: 15 minutes

  // Feature Weights
  historicalWeight: number; // Default: 0.3
  marketDynamicsWeight: number; // Default: 0.25
  injuryNewsWeight: number; // Default: 0.2
  weatherWeight: number; // Default: 0.15
  publicSentimentWeight: number; // Default: 0.1

  // Data Sources
  enabledDataSources: string[];
  historicalDepth: number; // Days of historical data
  maxDataLatency: number; // Max acceptable data age in minutes

  // Sport-specific configurations
  sportConfigs: Record<string, ClosingLineSportConfig>;
}

export interface ClosingLineSportConfig {
  sport: string;
  lineVolatility: number; // How much lines typically move
  injurySensitivity: number; // How much injuries affect lines
  weatherSensitivity: number; // How much weather affects lines
  publicInfluence: number; // How much public betting affects lines
  sharpTiming: number; // When sharp money typically comes in (hours before)
  typicalCloseTime: number; // Hours before game when lines close
}

export interface ClosingLinePredictionInput {
  propId: string;
  sport: string;
  market: string;
  player?: string;
  team1?: string;
  team2?: string;

  // Current state
  currentLine: number;
  currentOdds: number;
  timestamp: string;
  hoursUntilGame: number;

  // Historical context
  openingLine: number;
  lineHistory: HistoricalLinePoint[];
  similarGames: SimilarGameData[];

  // Market factors
  marketFactors: MarketFactors;

  // External factors
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
  similarity: number; // 0-1
  openingLine: number;
  closingLine: number;
  lineMovement: number;
  hoursTracked: number;
  outcome: 'OVER' | 'UNDER' | 'PUSH';
}

export interface MarketFactors {
  // Volume and betting patterns
  totalVolume: number;
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  sharpMoneyPercentage: number;
  publicMoneyPercentage: number;

  // Market structure
  bidAskSpread: number;
  liquidity: number;
  bookmakerCount: number;
  consensusVariance: number;

  // Timing factors
  timeDecay: number; // How much edge decays per hour
  optimalBetTiming: number; // Hours before game for optimal value
}

export interface InjuryReport {
  player: string;
  team: string;
  injuryType: string;
  severity: 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR';
  reportTime: string;
  impact: number; // 0-100
  lineImpact: number; // Expected line movement
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
  impact: number; // 0-100
}

export interface NewsEvent {
  timestamp: string;
  source: string;
  headline: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  reliability: number; // 0-1
  impact: number; // 0-100
  tags: string[];
}

export interface ClosingLinePredictionResult {
  // Core prediction
  predictedClosingLine: number;
  confidence: number; // 0-1
  predictionRange: {
    min: number;
    max: number;
    p25: number; // 25th percentile
    p75: number; // 75th percentile
  };

  // Movement analysis
  expectedMovement: number; // Points expected to move
  movementDirection: 'UP' | 'DOWN' | 'STABLE';
  movementProbability: number; // 0-1

  // Timing analysis
  timeRemaining: number; // Hours until game
  optimalEntryTiming: {
    bestTime: string; // ISO timestamp
    worstTime: string; // ISO timestamp
    currentValue: number; // Current entry value 0-100
    peakValue: number; // Best possible value 0-100
    reasoning: string;
  };

  // Contributing factors
  factors: {
    historical: FactorContribution;
    marketDynamics: FactorContribution;
    injuries: FactorContribution;
    weather: FactorContribution;
    publicSentiment: FactorContribution;
    sharpMoney: FactorContribution;
  };

  // Model performance
  modelInfo: {
    version: string;
    accuracy: number; // Historical accuracy on similar props
    sampleSize: number; // Number of similar props used for training
    lastUpdate: string;
    features: string[]; // Features used in prediction
  };

  // CLV estimation
  clvEstimate: {
    currentCLV: number; // If betting now
    optimalCLV: number; // If betting at optimal time
    expectedCLV: number; // Expected CLV with recommended timing
    clvDecayRate: number; // CLV loss per hour
  };

  // Risk assessment
  riskFactors: {
    volatilityRisk: number; // 0-1
    dataQualityRisk: number; // 0-1
    timingRisk: number; // 0-1
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };

  // Actionable insights
  recommendation: ClosingLineRecommendation;
}

export interface FactorContribution {
  impact: number; // -100 to +100 (negative = line goes down, positive = up)
  confidence: number; // 0-1
  weight: number; // Weight in final prediction
  evidence: string[];
  dataQuality: number; // 0-1
}

export interface ClosingLineRecommendation {
  action: 'BET_NOW' | 'WAIT_FOR_OPTIMAL' | 'MONITOR_AND_DECIDE' | 'AVOID';
  timing: {
    recommended: string; // ISO timestamp
    latest: string; // Latest acceptable time
    reasoning: string;
  };
  valueAssessment: {
    currentValue: number; // 0-100
    potentialValue: number; // 0-100
    riskAdjustedValue: number; // 0-100
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
  probability: number; // 0-1
}

// Closing Line Prediction Engine Interface
export interface ClosingLinePredictionEngine {
  // Core prediction
  predictClosingLine(input: ClosingLinePredictionInput): Promise<ClosingLinePredictionResult>;
  batchPredictLines(inputs: ClosingLinePredictionInput[]): Promise<ClosingLinePredictionResult[]>;

  // Model management
  updateModel(modelData: any): Promise<void>;
  getModelInfo(): ModelInfo;
  validateModel(): Promise<ModelValidationResult>;

  // Historical analysis
  backtestModel(period: string): Promise<BacktestResult>;
  getHistoricalAccuracy(filters?: AccuracyFilters): Promise<AccuracyMetrics>;

  // Monitoring
  getPerformanceMetrics(): Promise<PredictionPerformanceMetrics>;
  checkHealth(): Promise<EngineHealthStatus>;

  // Configuration
  updateConfig(config: Partial<ClosingLinePredictionConfig>): void;
  getConfig(): ClosingLinePredictionConfig;
}

export interface ModelInfo {
  version: string;
  trainedOn: string; // Date
  sampleSize: number;
  features: ModelFeature[];
  performance: ModelPerformance;
  sportCoverage: string[];
}

export interface ModelFeature {
  name: string;
  importance: number; // 0-1
  type: 'NUMERICAL' | 'CATEGORICAL' | 'TIME_SERIES';
  description: string;
}

export interface ModelPerformance {
  accuracy: number; // 0-1
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  r2: number; // R-squared
  calibration: number; // How well calibrated are confidence intervals
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
  profitability: number; // If following recommendations
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
  // Volume metrics
  totalPredictions: number;
  predictionsLast24h: number;
  avgProcessingTime: number; // ms

  // Accuracy metrics
  overallAccuracy: number;
  recentAccuracy: number; // Last 7 days
  accuracyTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';

  // Value metrics
  avgCLVCapture: number;
  optimalTimingSuccess: number; // % of times optimal timing was correct
  recommendationSuccess: number; // % of recommendations that were profitable

  // Model health
  modelFreshness: number; // Days since last retrain
  dataQuality: number; // 0-1
  predictionLatency: number; // ms

  // By sport breakdown
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