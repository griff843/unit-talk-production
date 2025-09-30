/**
 * Risk Management Types
 *
 * Comprehensive type definitions for the Phase 7 Risk Management system.
 * Designed for Fortune 100-grade risk controls and portfolio optimization.
 */

// ========================
// Core Risk Profile
// ========================

export interface RiskProfile {
  id: string;
  bankroll: number;
  maxBetPercentage: number;          // Maximum 5% of bankroll per bet
  maxDailyExposure: number;          // Maximum daily exposure limits
  maxWeeklyExposure: number;         // Maximum weekly exposure limits
  maxGameExposure: number;           // Maximum 15% exposure per game
  maxPlayerExposure: number;         // Maximum exposure per player
  maxSportExposure: number;          // Maximum exposure per sport
  correlationLimits: CorrelationLimits;
  varianceTargets: VarianceTargets;
  drawdownTriggers: DrawdownTriggers;
  kellyMultiplier: number;           // Default 0.25 for fractional Kelly
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  created: string;
  updated: string;
}

export interface CorrelationLimits {
  maxGameCorrelation: number;        // Max 15% exposure to single game
  maxPlayerCorrelation: number;      // Max correlation between players
  maxSportCorrelation: number;       // Max correlation across sports
  maxTimeCorrelation: number;        // Max same-day correlation
  maxPositionCorrelation: number;    // Max correlation between positions
}

export interface VarianceTargets {
  dailyVarianceLimit: number;        // Daily portfolio variance limit
  weeklyVarianceLimit: number;       // Weekly portfolio variance limit
  monthlyVarianceLimit: number;      // Monthly portfolio variance limit
  maxVolatility: number;             // Maximum portfolio volatility
  targetSharpeRatio: number;         // Target Sharpe ratio (1.5+)
}

export interface DrawdownTriggers {
  maxDrawdown: number;               // 15% maximum drawdown trigger
  emergencyStopDrawdown: number;     // 20% emergency stop
  positionReductionDrawdown: number; // 10% position reduction trigger
  alertDrawdown: number;             // 5% alert trigger
}

// ========================
// Portfolio & Positions
// ========================

export interface Position {
  id: string;
  propId: string;
  player: string;
  sport: string;
  gameId?: string;
  marketType: string;
  side: 'OVER' | 'UNDER' | 'YES' | 'NO';
  odds: number;
  line?: number;
  stake: number;
  potentialPayout: number;
  expectedValue: number;
  confidence: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  kellyFraction: number;

  // Risk Metrics
  riskMetrics: PositionRisk;
  correlations: Record<string, number>;

  // Timing
  placedAt: string;
  gameTime: string;
  hoursToGame: number;

  // Status
  status: 'ACTIVE' | 'SETTLED' | 'CANCELLED' | 'HEDGED';
  result?: 'WIN' | 'LOSS' | 'PUSH';
  settledAt?: string;

  // Metadata
  source: string;
  userId?: string;
  tags: string[];
  notes?: string;
}

export interface PositionRisk {
  individualRisk: number;            // Risk of this position alone (0-10)
  correlationRisk: number;           // Risk from correlations (0-10)
  concentrationRisk: number;         // Concentration risk score (0-10)
  liquidityRisk: number;             // Liquidity risk assessment (0-10)
  timingRisk: number;                // Time-to-game risk (0-10)
  portfolioContribution: number;     // Contribution to portfolio risk
  valueAtRisk: number;               // Position VaR (95%)
  expectedShortfall: number;         // Expected shortfall (CVaR)
  maxDrawdownContribution: number;   // Contribution to max drawdown
}

export interface PortfolioRisk {
  totalExposure: number;             // Total portfolio exposure
  availableCapital: number;          // Available capital for new positions
  totalRisk: number;                 // Total portfolio risk score
  sharpeRatio: number;               // Current Sharpe ratio
  maxDrawdown: number;               // Current maximum drawdown
  currentDrawdown: number;           // Current drawdown from peak
  valueAtRisk95: number;             // 95% VaR
  valueAtRisk99: number;             // 99% VaR
  expectedShortfall: number;         // Expected shortfall (CVaR)
  volatility: number;                // Portfolio volatility
  beta: number;                      // Portfolio beta

  // Correlation Analysis
  correlationMatrix: CorrelationMatrix;
  maxPositionCorrelation: number;    // Highest correlation between positions
  diversificationRatio: number;      // Portfolio diversification ratio

  // Exposure Breakdown
  exposureByCategory: ExposureBreakdown;
  concentrationRisk: ConcentrationRisk;

  // Performance Metrics
  currentPnL: number;                // Current P&L
  realizedPnL: number;               // Realized P&L
  unrealizedPnL: number;             // Unrealized P&L
  averageHoldTime: number;           // Average position hold time (hours)
  winRate: number;                   // Overall win rate

  // Timestamps
  lastUpdated: string;
  calculationTime: number;           // Calculation time in ms
}

export interface ExposureBreakdown {
  bySport: Record<string, number>;
  byPlayer: Record<string, number>;
  byMarketType: Record<string, number>;
  byGame: Record<string, number>;
  byTier: Record<string, number>;
  byTimeToGame: Record<string, number>;
}

export interface ConcentrationRisk {
  topGameExposure: number;           // Exposure to single largest game
  topPlayerExposure: number;         // Exposure to single largest player
  topSportExposure: number;          // Exposure to single largest sport
  herfindahlIndex: number;           // Portfolio concentration index
  effectivePositions: number;        // Effective number of positions
}

// ========================
// Kelly Criterion & Sizing
// ========================

export interface KellyResult {
  positionId: string;
  propId: string;

  // Kelly Calculation
  optimalFraction: number;           // Optimal Kelly fraction
  fractionalKelly: number;           // Conservative fractional Kelly (25%)
  recommendedStake: number;          // Recommended stake amount
  maxStake: number;                  // Maximum allowed stake

  // Input Parameters
  winProbability: number;            // Estimated win probability
  odds: number;                      // Betting odds
  expectedValue: number;             // Expected value (%)
  edge: number;                      // Betting edge

  // Risk Adjustments
  confidenceAdjustment: number;      // Confidence-based adjustment
  correlationAdjustment: number;     // Correlation-based adjustment
  portfolioAdjustment: number;       // Portfolio context adjustment

  // Validation
  riskScore: number;                 // Overall risk score (0-10)
  recommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
  warnings: string[];               // Risk warnings

  // Metadata
  calculatedAt: string;
  modelVersion: string;
  bankrollAtCalculation: number;
}

// ========================
// Correlation Analysis
// ========================

export interface CorrelationMatrix {
  matrix: Record<string, Record<string, number>>;
  methodology: 'PEARSON' | 'SPEARMAN' | 'KENDALL';
  windowSize: number;                // Days of data used
  lastUpdated: string;
  stats: CorrelationStats;
}

export interface CorrelationStats {
  averageCorrelation: number;
  maxCorrelation: number;
  minCorrelation: number;
  significantCorrelations: number;   // Count of correlations >0.5
  clusters: CorrelationCluster[];
}

export interface CorrelationCluster {
  id: string;
  positions: string[];              // Position IDs in cluster
  averageCorrelation: number;
  riskContribution: number;
}

// ========================
// Risk Metrics & Analysis
// ========================

export interface RiskMetrics {
  id: string;
  portfolioId: string;

  // Value at Risk
  var95: VaRResult;
  var99: VaRResult;

  // Expected Shortfall
  expectedShortfall95: ExpectedShortfallResult;
  expectedShortfall99: ExpectedShortfallResult;

  // Performance Metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  averageDrawdown: number;

  // Risk-Adjusted Returns
  riskAdjustedReturn: number;
  informationRatio: number;
  treynorRatio: number;

  // Stress Testing
  stressTestResults: StressTestResult[];

  // Metadata
  calculatedAt: string;
  methodology: string;
  confidenceLevel: number;
}

export interface VaRResult {
  value: number;                     // VaR amount
  percentage: number;                // VaR as % of portfolio
  timeHorizon: number;               // Time horizon (days)
  methodology: 'HISTORICAL' | 'PARAMETRIC' | 'MONTE_CARLO';
  confidenceLevel: number;           // 95% or 99%
  worstScenarios: ScenarioResult[];
}

export interface ExpectedShortfallResult {
  value: number;                     // Expected shortfall amount
  percentage: number;                // ES as % of portfolio
  timeHorizon: number;               // Time horizon (days)
  methodology: 'HISTORICAL' | 'PARAMETRIC' | 'MONTE_CARLO';
  confidenceLevel: number;           // 95% or 99%
  tailRisk: number;                  // Average loss in tail
}

export interface ScenarioResult {
  scenario: string;
  loss: number;
  probability: number;
  description: string;
}

export interface StressTestResult {
  scenarioName: string;
  portfolioLoss: number;
  worstPositions: string[];         // Position IDs with largest losses
  description: string;
  probability: number;
}

// ========================
// Risk Alerts & Controls
// ========================

export interface RiskAlert {
  id: string;
  type: 'EXPOSURE' | 'CORRELATION' | 'DRAWDOWN' | 'VAR' | 'CONCENTRATION' | 'KELLY' | 'VOLATILITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;

  // Thresholds
  threshold: number;
  currentValue: number;
  breachPercentage: number;

  // Recommendations
  recommendation: string;
  suggestedActions: RiskControlAction[];

  // Context
  affectedPositions: string[];       // Position IDs affected
  estimatedImpact: number;           // Estimated financial impact
  timeToResolve: number;             // Estimated time to resolve (hours)

  // Status
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
  priority: number;                  // 1-10 priority score

  // Timestamps
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;

  // Metadata
  category: string;
  tags: string[];
  relatedAlerts: string[];          // Related alert IDs
}

export interface RiskControlAction {
  id: string;
  type: 'REDUCE_POSITION' | 'HEDGE_POSITION' | 'HALT_TRADING' | 'REDUCE_EXPOSURE' | 'REBALANCE';
  description: string;
  targetPositions: string[];        // Position IDs to act on
  parameters: Record<string, any>;   // Action-specific parameters
  estimatedImpact: number;          // Estimated risk reduction
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';
  automated: boolean;                // Can be executed automatically
  requiresApproval: boolean;         // Requires manual approval
}

// ========================
// Portfolio Optimization
// ========================

export interface OptimizationResult {
  optimizationId: string;
  targetFunction: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY';

  // Current vs Optimized
  currentPortfolio: OptimizedPortfolio;
  optimizedPortfolio: OptimizedPortfolio;

  // Improvements
  riskReduction: number;             // Risk reduction (%)
  returnImprovement: number;         // Return improvement (%)
  sharpeImprovement: number;         // Sharpe ratio improvement

  // Recommended Actions
  rebalanceActions: RebalanceAction[];
  estimatedCost: number;             // Cost of rebalancing

  // Validation
  validationResults: ValidationResult[];

  // Metadata
  optimizedAt: string;
  methodology: string;
  constraints: OptimizationConstraints;
}

export interface OptimizedPortfolio {
  positions: OptimizedPosition[];
  totalRisk: number;
  expectedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  diversificationRatio: number;
}

export interface OptimizedPosition {
  positionId: string;
  currentWeight: number;             // Current portfolio weight
  optimizedWeight: number;           // Recommended portfolio weight
  weightChange: number;              // Required change
  currentStake: number;
  recommendedStake: number;
  stakeChange: number;
  reason: string;                    // Reason for change
}

export interface RebalanceAction {
  positionId: string;
  action: 'INCREASE' | 'DECREASE' | 'CLOSE' | 'HEDGE';
  currentStake: number;
  newStake: number;
  impact: number;                    // Risk impact
  priority: number;                  // Execution priority
}

export interface ValidationResult {
  check: string;
  passed: boolean;
  value: number;
  threshold: number;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
}

export interface OptimizationConstraints {
  maxPositionWeight: number;         // Max weight per position
  maxSectorWeight: number;           // Max weight per sector/sport
  minDiversification: number;        // Minimum diversification ratio
  maxTurnover: number;               // Maximum portfolio turnover
  liquidityMinimum: number;          // Minimum liquidity requirement
}

// ========================
// Dashboard & Monitoring
// ========================

export interface RiskDashboardData {
  portfolio: PortfolioRisk;
  alerts: RiskAlert[];
  metrics: RiskMetrics;
  performance: PerformanceMetrics;
  positions: Position[];

  // Real-time Updates
  lastUpdate: string;
  updateFrequency: number;           // Seconds between updates
  dataFreshness: Record<string, string>; // Last update by data type
}

export interface PerformanceMetrics {
  // Returns
  totalReturn: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  yearToDateReturn: number;

  // Risk-Adjusted
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;

  // Betting Specific
  winRate: number;
  averageOdds: number;
  averageStake: number;
  roi: number;                       // Return on investment
  clvPerformance: number;            // Closing line value performance

  // Efficiency
  kellyEfficiency: number;           // How close to optimal Kelly
  correlationEfficiency: number;     // Portfolio correlation efficiency
  timingEfficiency: number;          // Bet timing efficiency
}

// ========================
// Configuration Types
// ========================

export interface RiskManagementConfig {
  kelly: KellyConfig;
  correlation: CorrelationConfig;
  portfolio: PortfolioConfig;
  alerts: AlertConfig;
  monitoring: MonitoringConfig;
}

export interface KellyConfig {
  defaultMultiplier: number;         // Default 0.25
  maxKellyFraction: number;          // Maximum Kelly fraction (0.25)
  minEdgeThreshold: number;          // Minimum edge for betting (2%)
  confidenceAdjustment: boolean;     // Enable confidence adjustments
  correlationAdjustment: boolean;    // Enable correlation adjustments
  bankrollFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; // Bankroll update frequency
}

export interface CorrelationConfig {
  calculationMethod: 'PEARSON' | 'SPEARMAN' | 'KENDALL';
  windowSize: number;                // Days of data for correlation
  updateFrequency: number;           // Hours between updates
  significanceThreshold: number;     // Minimum correlation for significance (0.5)
  clusteringEnabled: boolean;        // Enable correlation clustering
}

export interface PortfolioConfig {
  maxPositions: number;              // Maximum number of positions
  rebalanceFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
  optimizationTarget: 'SHARPE' | 'RETURN' | 'RISK';
  constraintsEnabled: boolean;       // Enable optimization constraints
  liquidityRequirement: number;      // Minimum liquidity requirement
}

export interface AlertConfig {
  enabledTypes: RiskAlert['type'][];
  severityThresholds: Record<RiskAlert['severity'], number>;
  notificationChannels: ('EMAIL' | 'DISCORD' | 'SMS' | 'WEBHOOK')[];
  autoResolution: boolean;           // Enable automatic alert resolution
  suppressionDuration: number;       // Hours to suppress similar alerts
}

export interface MonitoringConfig {
  updateFrequency: number;           // Seconds between risk updates
  dashboardRefresh: number;          // Seconds between dashboard refresh
  metricsRetention: number;          // Days to retain metrics
  enableRealTimeAlerts: boolean;     // Enable real-time alerting
  performanceTracking: boolean;      // Enable performance tracking
}

// ========================
// Utility Types
// ========================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TimeHorizon = '1D' | '1W' | '1M' | '3M' | '1Y';
export type OptimizationObjective = 'MAXIMIZE_RETURN' | 'MINIMIZE_RISK' | 'MAXIMIZE_SHARPE' | 'KELLY_OPTIMAL';
export type RiskMeasure = 'VAR' | 'CVAR' | 'MAXDD' | 'VOLATILITY' | 'SHARPE' | 'SORTINO';