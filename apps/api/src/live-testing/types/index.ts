/**
 * Phase 9: Live Testing System Types
 *
 * Small stakes live validation testing types for real-money validation
 * of the Unit Talk syndicate-level ML betting system.
 */

import { ProfessionalFeaturesResult } from '../../professional/types';

// ========================================
// Core Live Testing System Interface
// ========================================

export interface LiveTestingSystem {
  bettingIntegration: BettingAPIConfig;
  performanceTracking: PerformanceTracker;
  riskMonitoring: LiveRiskMonitor;
  financialReporting: FinancialReports;
  emergencyControls: EmergencySystem;
}

// ========================================
// 1. Betting API Integration 💰
// ========================================

export interface BettingAPIConfig {
  // Sportsbook integrations
  books: SportsBookAPI[];
  primaryBook: string;
  backupBooks: string[];

  // API configuration
  apiCredentials: Record<string, BookCredentials>;
  rateLimits: Record<string, RateLimit>;

  // Betting controls
  maxBetSize: number;         // $50 during testing
  maxDailyRisk: number;       // $500 per day
  maxSingleExposure: number;  // $2000 total bankroll
  enabledSports: string[];

  // Risk management
  kellyMultiplier: number;    // 0.25 max Kelly fraction
  correlationLimits: CorrelationLimits;
  emergencyStopLoss: number;  // 10% drawdown
}

export interface SportsBookAPI {
  name: string;
  apiEndpoint: string;
  features: {
    placeBets: boolean;
    getOdds: boolean;
    checkBalance: boolean;
    getBetHistory: boolean;
    cancelBets: boolean;
  };
  limits: {
    minBet: number;
    maxBet: number;
    maxExposure: number;
  };
  reliability: number; // 0-1
  latency: number; // ms
}

export interface BookCredentials {
  apiKey: string;
  secretKey: string;
  accountId: string;
  environment: 'sandbox' | 'production';
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerDay: number;
  concurrent: number;
}

export interface CorrelationLimits {
  maxSameGame: number;        // Max bets on same game
  maxSamePlayer: number;      // Max bets on same player
  maxSameSport: number;       // Max bets on same sport
  maxPortfolioCorrelation: number; // Max portfolio correlation
}

// ========================================
// 2. Live Performance Tracking 📈
// ========================================

export interface PerformanceTracker {
  realTimeMetrics: LiveMetrics;
  historicalPerformance: HistoricalResults;
  clvTracking: CLVTracker;
  statisticalSignificance: SignificanceTracker;
}

export interface LiveMetrics {
  // Current session
  sessionStartTime: string;
  currentWinRate: number;
  currentROI: number;
  currentCLV: number;

  // Real-time tracking
  totalBets: number;
  wins: number;
  losses: number;
  pending: number;

  // Financial metrics
  totalStaked: number;
  totalReturns: number;
  netProfit: number;
  avgBetSize: number;

  // Performance indicators
  sharpeRatio: number;
  maxDrawdown: number;
  winStreak: number;
  lossStreak: number;

  // Professional features performance
  professionalFeaturesWinRate: number;
  steamDetectionAccuracy: number;
  closingLinePredictionAccuracy: number;
  optimalTimingSuccess: number;
}

export interface HistoricalResults {
  dailyResults: DailyResult[];
  weeklyResults: WeeklyResult[];
  byPhase: PhaseResult[];
  bySport: SportResult[];
  byFeature: FeatureResult[];
}

export interface DailyResult {
  date: string;
  totalBets: number;
  winRate: number;
  roi: number;
  clv: number;
  netProfit: number;
  drawdown: number;
  sharpeRatio: number;
}

export interface WeeklyResult extends DailyResult {
  week: string;
  avgBetSize: number;
  maxDrawdown: number;
  consistency: number;
}

export interface PhaseResult {
  phase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
  startDate: string;
  endDate: string;
  totalBets: number;
  winRate: number;
  roi: number;
  avgCLV: number;
  netProfit: number;
  successCriteria: {
    winRateTarget: boolean;    // >= 55%
    clvTarget: boolean;        // >= 60% positive
    systemReliability: boolean; // >= 99.5%
    riskManagement: boolean;   // Proper Kelly sizing
  };
}

export interface SportResult {
  sport: string;
  totalBets: number;
  winRate: number;
  roi: number;
  avgCLV: number;
  netProfit: number;
  confidence: number;
}

export interface FeatureResult {
  featureName: string;
  accuracy: number;
  impactOnWinRate: number;
  clvContribution: number;
  profitContribution: number;
}

// ========================================
// 3. CLV Tracking System 📊
// ========================================

export interface CLVTracker {
  activeTracks: CLVTrack[];
  completedTracks: CLVTrack[];
  aggregateMetrics: CLVAggregateMetrics;
}

export interface CLVTrack {
  betId: string;
  propId: string;
  initialLine: number;
  initialOdds: number;
  closingLine: number;
  closingOdds: number;
  clv: number; // Closing Line Value
  clvCategory: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  timestamp: string;
  sport: string;
  market: string;
  professionalFeatures: ProfessionalFeaturesResult;
}

export interface CLVAggregateMetrics {
  totalTracks: number;
  positiveClvRate: number; // Target: >= 60%
  avgClv: number;
  avgClvByFeature: Record<string, number>;
  clvDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  timeToLineMovement: number; // Average time until line moves
}

// ========================================
// 4. Statistical Significance Testing 🔬
// ========================================

export interface SignificanceTracker {
  sampleSize: number;
  winRateSignificance: SignificanceTest;
  roiSignificance: SignificanceTest;
  clvSignificance: SignificanceTest;
  readyForProduction: boolean;
}

export interface SignificanceTest {
  statistic: number;
  pValue: number;
  confidenceInterval: [number, number];
  significant: boolean;
  sampleSizeNeeded: number;
  currentPower: number; // Statistical power
}

// ========================================
// 5. Live Risk Monitor ⚡
// ========================================

export interface LiveRiskMonitor {
  realTimeRisk: RealTimeRisk;
  portfolioRisk: PortfolioRisk;
  kellyMonitoring: KellyMonitor;
  emergencyTriggers: EmergencyTrigger[];
}

export interface RealTimeRisk {
  currentExposure: number;
  maxExposure: number;
  utilizationRate: number; // Current / Max

  // Daily limits
  dailyStaked: number;
  dailyLimit: number;
  dailyBetsPlaced: number;
  dailyBetLimit: number;

  // Correlation risk
  sameGameExposure: Record<string, number>;
  samePlayerExposure: Record<string, number>;
  sameSportExposure: Record<string, number>;
  portfolioCorrelation: number;

  // Risk alerts
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  activeAlerts: RiskAlert[];
}

export interface PortfolioRisk {
  totalValue: number;
  var95: number; // 95% Value at Risk
  expectedShortfall: number; // Conditional VaR
  maxDrawdown: number;
  currentDrawdown: number;

  // Kelly criterion compliance
  avgKellyFraction: number;
  maxKellyFraction: number;
  kellyViolations: number;

  // Diversification metrics
  sportDiversification: number;
  marketDiversification: number;
  temporalDiversification: number;
}

export interface KellyMonitor {
  currentPositions: KellyPosition[];
  avgKellyFraction: number;
  maxKellyFraction: number;
  kellyViolations: KellyViolation[];
  optimalSizing: boolean;
}

export interface KellyPosition {
  betId: string;
  edge: number;
  kellyFraction: number;
  actualFraction: number;
  optimalStake: number;
  actualStake: number;
  deviationReason?: string;
}

export interface KellyViolation {
  betId: string;
  timestamp: string;
  recommendedFraction: number;
  actualFraction: number;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RiskAlert {
  id: string;
  type: 'EXPOSURE_LIMIT' | 'CORRELATION_RISK' | 'DRAWDOWN' | 'KELLY_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  autoResolved?: boolean;
}

export interface EmergencyTrigger {
  type: 'STOP_LOSS' | 'MAX_DRAWDOWN' | 'SYSTEM_ERROR' | 'MANUAL_STOP';
  threshold: number;
  currentValue: number;
  triggered: boolean;
  action: 'PAUSE_BETTING' | 'EMERGENCY_STOP' | 'REDUCE_EXPOSURE';
}

// ========================================
// 6. Financial Reports 💸
// ========================================

export interface FinancialReports {
  realTimePnL: RealTimePnL;
  transactionCosts: TransactionCostAnalysis;
  attribution: PerformanceAttribution;
  riskReports: RiskReport[];
}

export interface RealTimePnL {
  // Current session
  sessionPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;

  // Period performance
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalPnL: number;

  // Detailed breakdown
  pnlByBet: BetPnL[];
  pnlBySport: Record<string, number>;
  pnlByBook: Record<string, number>;
  pnlByFeature: Record<string, number>;

  // Performance metrics
  roi: number;
  roiAnnualized: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;

  // Risk metrics
  valueAtRisk: number;
  expectedShortfall: number;
  beta: number;
  alpha: number;
}

export interface BetPnL {
  betId: string;
  propId: string;
  sport: string;
  market: string;
  stake: number;
  odds: number;
  result: 'WIN' | 'LOSS' | 'PUSH' | 'PENDING';
  pnl: number;
  roi: number;
  clv: number;
  professionalScore: number;
  timestamp: string;
  settledAt?: string;
}

export interface TransactionCostAnalysis {
  totalCosts: number;
  costBreakdown: {
    commissions: number;
    spreads: number;
    slippage: number;
    taxes: number;
    other: number;
  };
  costPerBet: number;
  costAsPercentageOfStake: number;
  costAsPercentageOfPnL: number;
  costOptimization: CostOptimization;
}

export interface CostOptimization {
  recommendations: string[];
  potentialSavings: number;
  optimalBooks: string[];
  timingRecommendations: string[];
}

export interface PerformanceAttribution {
  totalReturn: number;
  attributions: {
    sport: Record<string, number>;
    feature: Record<string, number>;
    timing: Record<string, number>;
    book: Record<string, number>;
    kelly: number;
    lineShoppingEdge: number;
    professionalFeatures: number;
  };
  explanations: string[];
}

export interface RiskReport {
  reportDate: string;
  riskMetrics: {
    var95: number;
    expectedShortfall: number;
    maxDrawdown: number;
    portfolioVolatility: number;
    correlationRisk: number;
    concentrationRisk: number;
  };
  riskLimits: {
    exposureUtilization: number;
    kellyCompliance: number;
    diversificationScore: number;
  };
  recommendations: string[];
}

// ========================================
// 7. Emergency System 🚨
// ========================================

export interface EmergencySystem {
  stopLossTriggers: StopLossTrigger[];
  circuitBreakers: CircuitBreaker[];
  emergencyProcedures: EmergencyProcedure[];
  contactProtocols: ContactProtocol[];
}

export interface StopLossTrigger {
  name: string;
  type: 'DAILY_LOSS' | 'TOTAL_DRAWDOWN' | 'CONSECUTIVE_LOSSES' | 'SYSTEM_ERROR';
  threshold: number;
  currentValue: number;
  enabled: boolean;
  triggered: boolean;
  action: EmergencyAction;
}

export interface CircuitBreaker {
  name: string;
  condition: string;
  threshold: number;
  currentValue: number;
  windowSize: number; // Time window in minutes
  enabled: boolean;
  triggered: boolean;
  cooldownPeriod: number; // Minutes before reset
  action: EmergencyAction;
}

export interface EmergencyAction {
  type: 'PAUSE_BETTING' | 'EMERGENCY_STOP' | 'REDUCE_EXPOSURE' | 'NOTIFY_OPERATOR';
  immediate: boolean;
  reversible: boolean;
  parameters?: Record<string, any>;
}

export interface EmergencyProcedure {
  triggerType: string;
  steps: EmergencyStep[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoExecute: boolean;
}

export interface EmergencyStep {
  order: number;
  action: string;
  description: string;
  automated: boolean;
  timeoutSeconds?: number;
  rollbackPossible: boolean;
}

export interface ContactProtocol {
  triggerSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  contacts: Contact[];
  escalationDelay: number; // Minutes
  methods: ('EMAIL' | 'SMS' | 'DISCORD' | 'CALL')[];
}

export interface Contact {
  name: string;
  role: string;
  primary: boolean;
  email?: string;
  phone?: string;
  discordId?: string;
  timezone: string;
}

// ========================================
// 8. Live Bet Types
// ========================================

export interface LiveBet {
  // Identification
  id: string;
  propId: string;
  betSlipId?: string;

  // Bet details
  sport: string;
  market: string;
  selection: string;
  line: number;
  odds: number;
  stake: number;

  // Professional analysis
  professionalScore: number;
  professionalFeatures: ProfessionalFeaturesResult;
  clvTrackingId: string;
  kellyFraction: number;

  // Execution details
  book: string;
  placedAt: string;
  confirmedAt?: string;
  settledAt?: string;

  // Status tracking
  status: 'PENDING' | 'CONFIRMED' | 'SETTLED' | 'CANCELLED' | 'FAILED';
  result?: 'WIN' | 'LOSS' | 'PUSH';

  // Performance
  clv?: number;
  pnl?: number;
  roi?: number;

  // Risk management
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  correlationRisk: number;
  portfolioImpact: number;

  // Metadata
  testingPhase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
  automaticallyPlaced: boolean;
  errorMessage?: string;
}

// ========================================
// 9. Testing Phases
// ========================================

export interface TestingPhase {
  name: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
  description: string;
  startDate: string;
  endDate?: string;

  // Phase configuration
  config: PhaseConfig;

  // Success criteria
  successCriteria: PhaseSuccessCriteria;

  // Current status
  status: 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  currentResults: PhaseResult;
}

export interface PhaseConfig {
  // Betting limits
  maxBetSize: number;
  maxDailyRisk: number;
  maxTotalRisk: number;

  // Sport coverage
  enabledSports: string[];

  // Feature configuration
  enabledFeatures: string[];

  // Duration and volume
  minTestingDays: number;
  minBetsRequired: number;

  // Risk controls
  stopLossThreshold: number;
  kellyMultiplier: number;
}

export interface PhaseSuccessCriteria {
  // Performance targets
  minWinRate: number;        // 55%
  minPositiveCLVRate: number; // 60%
  minSystemUptime: number;   // 99.5%
  maxProcessingTime: number; // 3 seconds

  // Risk management
  properKellySizing: boolean;
  riskControlsFunctioning: boolean;

  // Statistical significance
  minSampleSize: number;
  minConfidenceLevel: number; // 0.95

  // Financial targets
  positiveROI: boolean;
  maxDrawdown: number; // 10%
}

// ========================================
// 10. Live Testing Configuration
// ========================================

export interface LiveTestingConfig {
  // Environment
  environment: 'SANDBOX' | 'PRODUCTION';
  testingMode: boolean;

  // Phases
  currentPhase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
  phases: Record<string, PhaseConfig>;

  // Global limits
  globalLimits: GlobalLimits;

  // Monitoring
  monitoring: MonitoringConfig;

  // Integrations
  integrations: IntegrationConfig;
}

export interface GlobalLimits {
  maxTestingBankroll: number; // $2000
  maxSingleBet: number;       // $50
  maxDailyRisk: number;       // $500
  maxConcurrentBets: number;  // 20
  maxKellyFraction: number;   // 0.25
}

export interface MonitoringConfig {
  enableRealTimeTracking: boolean;
  enableCLVTracking: boolean;
  enableRiskMonitoring: boolean;
  enablePerformanceTracking: boolean;

  // Alert thresholds
  alertThresholds: {
    drawdownPercent: number;
    consecutiveLosses: number;
    systemErrors: number;
    processingDelays: number;
  };

  // Reporting frequency
  reportingIntervals: {
    realTime: number;      // seconds
    hourly: boolean;
    daily: boolean;
    weekly: boolean;
  };
}

export interface IntegrationConfig {
  // Sportsbooks
  enabledBooks: string[];
  primaryBook: string;

  // External services
  oddsProviders: string[];
  newsServices: string[];

  // Notification channels
  notifications: {
    discord: boolean;
    email: boolean;
    sms: boolean;
  };
}

// ========================================
// Export all types
// ========================================

export * from './betting-api';
export * from './performance-tracking';
export * from './risk-monitoring';
export * from './financial-reporting';
export * from './emergency-system';