/**
 * Steam Detection Engine Types
 * Feature 1 of 8 Professional Capper Features
 *
 * Real-time steam move detection with volume correlation
 * Monitor line movements >2 points within 5 minutes
 * Correlate with betting volume and sharp money indicators
 */

export interface SteamDetectionConfig {
  // Line movement thresholds
  minLineMovement: number; // Default: 2.0 points
  timeWindow: number; // Default: 5 minutes
  volumeCorrelationThreshold: number; // Default: 0.7

  // Sharp money indicators
  reverseLineMovementWeight: number; // Default: 0.3
  volumeSpikeWeight: number; // Default: 0.25
  bookmakerReactionWeight: number; // Default: 0.25
  crossBookConsensusWeight: number; // Default: 0.2

  // Data sources
  enabledBooks: string[];
  updateFrequency: number; // Seconds between updates

  // Filtering
  minVolume: number; // Minimum betting volume
  sportSpecificThresholds: Record<string, SteamSportConfig>;
}

export interface SteamSportConfig {
  sport: string;
  lineMovementMultiplier: number; // Adjust thresholds by sport
  volumeMultiplier: number;
  steamFrequency: number; // How often steam occurs
  falsePositiveRate: number; // Expected false positive rate
}

export interface SteamDetectionInput {
  propId: string;
  sport: string;
  market: string;
  currentLine: number;
  currentOdds: number;
  timestamp: string;

  // Historical data (last 24 hours)
  lineHistory: LineDataPoint[];
  volumeHistory: VolumeDataPoint[];
  bookmakerData: BookmakerDataPoint[];
}

export interface LineDataPoint {
  timestamp: string;
  line: number;
  odds: number;
  bookmaker: string;
  volume?: number;
}

export interface VolumeDataPoint {
  timestamp: string;
  volume: number;
  side: 'OVER' | 'UNDER';
  bookmaker: string;
  isSharpMoney?: boolean;
}

export interface BookmakerDataPoint {
  timestamp: string;
  bookmaker: string;
  action: 'MOVE_LINE' | 'ADJUST_ODDS' | 'LIMIT_REDUCE' | 'SUSPEND';
  details: any;
}

export interface SteamAnalysisResult {
  // Core detection
  steamDetected: boolean;
  steamScore: number; // 0-100
  confidence: number; // 0-1
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Movement analysis
  lineMovement: {
    totalMovement: number; // Points moved
    timeToMove: number; // Minutes
    accelerationRate: number; // Points per minute^2
    consistency: number; // Cross-book consistency 0-1
  };

  // Volume correlation
  volumeCorrelation: {
    correlation: number; // 0-1
    volumeIncrease: number; // Percentage increase
    sharpMoneyPercentage: number; // 0-100
    publicMoneyPercentage: number; // 0-100
  };

  // Sharp money indicators
  sharpIndicators: {
    reverseLineMovement: SharpIndicator;
    volumeSpike: SharpIndicator;
    bookmakerReaction: SharpIndicator;
    crossBookConsensus: SharpIndicator;
    overallSharpScore: number; // 0-100
  };

  // Historical context
  historicalSteam: {
    similarSteamEvents: number; // Count in last 30 days
    avgSteamSuccess: number; // 0-1
    playerSteamHistory: number; // How often this player steams
    marketSteamHistory: number; // How often this market steams
  };

  // Predictive analysis
  predictions: {
    continuedMovement: number; // Probability of more movement
    reversalProbability: number; // Probability of line reversal
    finalLineEstimate: number; // Predicted closing line
    timeToStabilize: number; // Minutes until line stabilizes
  };

  // Actionable insights
  recommendation: SteamActionRecommendation;
}

export interface SharpIndicator {
  detected: boolean;
  score: number; // 0-100
  confidence: number; // 0-1
  evidence: string[];
  weight: number; // Contribution to overall score
}

export interface SteamActionRecommendation {
  action: 'BET_IMMEDIATELY' | 'MONITOR_CLOSELY' | 'WAIT_FOR_STABILITY' | 'AVOID_STEAM';
  reasoning: string;
  urgency: 'IMMEDIATE' | 'SOON' | 'MONITOR' | 'NO_ACTION';

  // Timing recommendations
  optimalEntryWindow: {
    start: string; // ISO timestamp
    end: string; // ISO timestamp
    reasoning: string;
  };

  // Risk assessment
  steamRisk: {
    falsePositiveRisk: number; // 0-1
    reversalRisk: number; // 0-1
    continuedrMovementRisk: number; // 0-1
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };

  // Expected value
  steamEdge: {
    currentEdge: number; // Current edge if betting now
    peakEdge: number; // Maximum edge if timing perfect
    expectedEdge: number; // Expected edge with recommendation
    edgeDecayRate: number; // Edge loss per minute
  };
}

export interface SteamDetectionMetrics {
  // Performance tracking
  totalDetections: number;
  truePositives: number;
  falsePositives: number;
  precision: number; // True positives / (True positives + False positives)
  recall: number; // True positives / (True positives + False negatives)
  f1Score: number;

  // Timing accuracy
  avgDetectionLatency: number; // Seconds from steam start to detection
  earlyDetectionRate: number; // % detected within first minute

  // Edge capture
  avgSteamEdge: number; // Average edge from steam bets
  steamBetSuccess: number; // Win rate on steam bets
  avgCLV: number; // Average CLV on steam bets

  // Market coverage
  marketsMonitored: number;
  steamEventsPerDay: number;
  avgSteamSize: number; // Average line movement

  // By sport breakdown
  sportMetrics: Record<string, SteamSportMetrics>;
}

export interface SteamSportMetrics {
  sport: string;
  detections: number;
  precision: number;
  avgEdge: number;
  avgCLV: number;
  steamFrequency: number; // Steams per day
}

export interface SteamMonitoringState {
  // Active monitoring
  activeProps: Map<string, SteamPropState>;
  recentSteams: SteamEvent[];
  systemLoad: number; // 0-1

  // Configuration
  config: SteamDetectionConfig;
  lastConfigUpdate: string;

  // Performance
  metrics: SteamDetectionMetrics;
  lastMetricsUpdate: string;

  // Health status
  health: {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    dataFeed: boolean; // Are we receiving line data?
    volumeFeed: boolean; // Are we receiving volume data?
    processingLatency: number; // ms
    errors: string[];
  };
}

export interface SteamPropState {
  propId: string;
  startMonitoring: string; // ISO timestamp
  currentLine: number;
  initialLine: number;
  totalMovement: number;
  lastUpdate: string;

  // Detection state
  steamStatus: 'MONITORING' | 'STEAM_DETECTED' | 'STEAM_ENDED' | 'FALSE_ALARM';
  lastAnalysis: SteamAnalysisResult;

  // Historical tracking
  lineHistory: LineDataPoint[];
  volumeHistory: VolumeDataPoint[];
  analysisHistory: SteamAnalysisResult[];
}

export interface SteamEvent {
  id: string;
  propId: string;
  sport: string;
  market: string;

  // Steam characteristics
  startTime: string;
  endTime?: string;
  duration?: number; // minutes
  lineMovement: number;
  volumeIncrease: number;

  // Classification
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confirmed: boolean; // Was this a real steam or false positive?

  // Outcome tracking
  finalResult?: 'WIN' | 'LOSS' | 'PUSH';
  clv?: number; // Closing line value achieved
  edge?: number; // Edge captured

  // Metadata
  detectModel: string;
  confidence: number;
  tags: string[];
}

// Steam Detection Engine Interface
export interface SteamDetectionEngine {
  // Core detection
  detectSteam(input: SteamDetectionInput): Promise<SteamAnalysisResult>;

  // Monitoring
  startMonitoring(propId: string): void;
  stopMonitoring(propId: string): void;
  getMonitoringState(): SteamMonitoringState;

  // Configuration
  updateConfig(config: Partial<SteamDetectionConfig>): void;
  getConfig(): SteamDetectionConfig;

  // Analytics
  getMetrics(): SteamDetectionMetrics;
  getSteamHistory(filters?: SteamHistoryFilters): SteamEvent[];

  // Health
  checkHealth(): Promise<EngineHealthStatus>;
}

export interface SteamHistoryFilters {
  sport?: string;
  market?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  severity?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
  confirmed?: boolean;
  minLineMovement?: number;
  maxLineMovement?: number;
}

export interface EngineHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  lastUpdate: string;
  checks: {
    dataConnectivity: boolean;
    processingSpeed: boolean;
    memoryUsage: boolean;
    errorRate: boolean;
  };
  warnings: string[];
  errors: string[];
}