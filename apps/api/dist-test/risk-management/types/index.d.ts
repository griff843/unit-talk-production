/**
 * Risk Management Types
 *
 * Comprehensive type definitions for the Phase 7 Risk Management system.
 * Designed for Fortune 100-grade risk controls and portfolio optimization.
 */
export interface RiskProfile {
    id: string;
    bankroll: number;
    maxBetPercentage: number;
    maxDailyExposure: number;
    maxWeeklyExposure: number;
    maxGameExposure: number;
    maxPlayerExposure: number;
    maxSportExposure: number;
    correlationLimits: CorrelationLimits;
    varianceTargets: VarianceTargets;
    drawdownTriggers: DrawdownTriggers;
    kellyMultiplier: number;
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    created: string;
    updated: string;
}
export interface CorrelationLimits {
    maxGameCorrelation: number;
    maxPlayerCorrelation: number;
    maxSportCorrelation: number;
    maxTimeCorrelation: number;
    maxPositionCorrelation: number;
}
export interface VarianceTargets {
    dailyVarianceLimit: number;
    weeklyVarianceLimit: number;
    monthlyVarianceLimit: number;
    maxVolatility: number;
    targetSharpeRatio: number;
}
export interface DrawdownTriggers {
    maxDrawdown: number;
    emergencyStopDrawdown: number;
    positionReductionDrawdown: number;
    alertDrawdown: number;
}
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
    riskMetrics: PositionRisk;
    correlations: Record<string, number>;
    placedAt: string;
    gameTime: string;
    hoursToGame: number;
    status: 'ACTIVE' | 'SETTLED' | 'CANCELLED' | 'HEDGED';
    result?: 'WIN' | 'LOSS' | 'PUSH';
    settledAt?: string;
    source: string;
    userId?: string;
    tags: string[];
    notes?: string;
}
export interface PositionRisk {
    individualRisk: number;
    correlationRisk: number;
    concentrationRisk: number;
    liquidityRisk: number;
    timingRisk: number;
    portfolioContribution: number;
    valueAtRisk: number;
    expectedShortfall: number;
    maxDrawdownContribution: number;
}
export interface PortfolioRisk {
    totalExposure: number;
    availableCapital: number;
    totalRisk: number;
    sharpeRatio: number;
    maxDrawdown: number;
    currentDrawdown: number;
    valueAtRisk95: number;
    valueAtRisk99: number;
    expectedShortfall: number;
    volatility: number;
    beta: number;
    correlationMatrix: CorrelationMatrix;
    maxPositionCorrelation: number;
    diversificationRatio: number;
    exposureByCategory: ExposureBreakdown;
    concentrationRisk: ConcentrationRisk;
    currentPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    averageHoldTime: number;
    winRate: number;
    lastUpdated: string;
    calculationTime: number;
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
    topGameExposure: number;
    topPlayerExposure: number;
    topSportExposure: number;
    herfindahlIndex: number;
    effectivePositions: number;
}
export interface KellyResult {
    positionId: string;
    propId: string;
    optimalFraction: number;
    fractionalKelly: number;
    recommendedStake: number;
    maxStake: number;
    winProbability: number;
    odds: number;
    expectedValue: number;
    edge: number;
    confidenceAdjustment: number;
    correlationAdjustment: number;
    portfolioAdjustment: number;
    riskScore: number;
    recommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
    warnings: string[];
    calculatedAt: string;
    modelVersion: string;
    bankrollAtCalculation: number;
}
export interface CorrelationMatrix {
    matrix: Record<string, Record<string, number>>;
    methodology: 'PEARSON' | 'SPEARMAN' | 'KENDALL';
    windowSize: number;
    lastUpdated: string;
    stats: CorrelationStats;
}
export interface CorrelationStats {
    averageCorrelation: number;
    maxCorrelation: number;
    minCorrelation: number;
    significantCorrelations: number;
    clusters: CorrelationCluster[];
}
export interface CorrelationCluster {
    id: string;
    positions: string[];
    averageCorrelation: number;
    riskContribution: number;
}
export interface RiskMetrics {
    id: string;
    portfolioId: string;
    var95: VaRResult;
    var99: VaRResult;
    expectedShortfall95: ExpectedShortfallResult;
    expectedShortfall99: ExpectedShortfallResult;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    averageDrawdown: number;
    riskAdjustedReturn: number;
    informationRatio: number;
    treynorRatio: number;
    stressTestResults: StressTestResult[];
    calculatedAt: string;
    methodology: string;
    confidenceLevel: number;
}
export interface VaRResult {
    value: number;
    percentage: number;
    timeHorizon: number;
    methodology: 'HISTORICAL' | 'PARAMETRIC' | 'MONTE_CARLO';
    confidenceLevel: number;
    worstScenarios: ScenarioResult[];
}
export interface ExpectedShortfallResult {
    value: number;
    percentage: number;
    timeHorizon: number;
    methodology: 'HISTORICAL' | 'PARAMETRIC' | 'MONTE_CARLO';
    confidenceLevel: number;
    tailRisk: number;
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
    worstPositions: string[];
    description: string;
    probability: number;
}
export interface RiskAlert {
    id: string;
    type: 'EXPOSURE' | 'CORRELATION' | 'DRAWDOWN' | 'VAR' | 'CONCENTRATION' | 'KELLY' | 'VOLATILITY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    message: string;
    threshold: number;
    currentValue: number;
    breachPercentage: number;
    recommendation: string;
    suggestedActions: RiskControlAction[];
    affectedPositions: string[];
    estimatedImpact: number;
    timeToResolve: number;
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
    priority: number;
    triggeredAt: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
    category: string;
    tags: string[];
    relatedAlerts: string[];
}
export interface RiskControlAction {
    id: string;
    type: 'REDUCE_POSITION' | 'HEDGE_POSITION' | 'HALT_TRADING' | 'REDUCE_EXPOSURE' | 'REBALANCE';
    description: string;
    targetPositions: string[];
    parameters: Record<string, any>;
    estimatedImpact: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';
    automated: boolean;
    requiresApproval: boolean;
}
export interface OptimizationResult {
    optimizationId: string;
    targetFunction: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY';
    currentPortfolio: OptimizedPortfolio;
    optimizedPortfolio: OptimizedPortfolio;
    riskReduction: number;
    returnImprovement: number;
    sharpeImprovement: number;
    rebalanceActions: RebalanceAction[];
    estimatedCost: number;
    validationResults: ValidationResult[];
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
    currentWeight: number;
    optimizedWeight: number;
    weightChange: number;
    currentStake: number;
    recommendedStake: number;
    stakeChange: number;
    reason: string;
}
export interface RebalanceAction {
    positionId: string;
    action: 'INCREASE' | 'DECREASE' | 'CLOSE' | 'HEDGE';
    currentStake: number;
    newStake: number;
    impact: number;
    priority: number;
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
    maxPositionWeight: number;
    maxSectorWeight: number;
    minDiversification: number;
    maxTurnover: number;
    liquidityMinimum: number;
}
export interface RiskDashboardData {
    portfolio: PortfolioRisk;
    alerts: RiskAlert[];
    metrics: RiskMetrics;
    performance: PerformanceMetrics;
    positions: Position[];
    lastUpdate: string;
    updateFrequency: number;
    dataFreshness: Record<string, string>;
}
export interface PerformanceMetrics {
    totalReturn: number;
    dailyReturn: number;
    weeklyReturn: number;
    monthlyReturn: number;
    yearToDateReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    volatility: number;
    winRate: number;
    averageOdds: number;
    averageStake: number;
    roi: number;
    clvPerformance: number;
    kellyEfficiency: number;
    correlationEfficiency: number;
    timingEfficiency: number;
}
export interface RiskManagementConfig {
    kelly: KellyConfig;
    correlation: CorrelationConfig;
    portfolio: PortfolioConfig;
    alerts: AlertConfig;
    monitoring: MonitoringConfig;
}
export interface KellyConfig {
    defaultMultiplier: number;
    maxKellyFraction: number;
    minEdgeThreshold: number;
    confidenceAdjustment: boolean;
    correlationAdjustment: boolean;
    bankrollFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}
export interface CorrelationConfig {
    calculationMethod: 'PEARSON' | 'SPEARMAN' | 'KENDALL';
    windowSize: number;
    updateFrequency: number;
    significanceThreshold: number;
    clusteringEnabled: boolean;
}
export interface PortfolioConfig {
    maxPositions: number;
    rebalanceFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
    optimizationTarget: 'SHARPE' | 'RETURN' | 'RISK';
    constraintsEnabled: boolean;
    liquidityRequirement: number;
}
export interface AlertConfig {
    enabledTypes: RiskAlert['type'][];
    severityThresholds: Record<RiskAlert['severity'], number>;
    notificationChannels: ('EMAIL' | 'DISCORD' | 'SMS' | 'WEBHOOK')[];
    autoResolution: boolean;
    suppressionDuration: number;
}
export interface MonitoringConfig {
    updateFrequency: number;
    dashboardRefresh: number;
    metricsRetention: number;
    enableRealTimeAlerts: boolean;
    performanceTracking: boolean;
}
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TimeHorizon = '1D' | '1W' | '1M' | '3M' | '1Y';
export type OptimizationObjective = 'MAXIMIZE_RETURN' | 'MINIMIZE_RISK' | 'MAXIMIZE_SHARPE' | 'KELLY_OPTIMAL';
export type RiskMeasure = 'VAR' | 'CVAR' | 'MAXDD' | 'VOLATILITY' | 'SHARPE' | 'SORTINO';
//# sourceMappingURL=index.d.ts.map