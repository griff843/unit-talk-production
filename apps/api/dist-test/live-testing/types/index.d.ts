/**
 * Phase 9: Live Testing System Types
 *
 * Small stakes live validation testing types for real-money validation
 * of the Unit Talk syndicate-level ML betting system.
 */
import { ProfessionalFeaturesResult } from '../../professional/types';
export interface LiveTestingSystem {
    bettingIntegration: BettingAPIConfig;
    performanceTracking: PerformanceTracker;
    riskMonitoring: LiveRiskMonitor;
    financialReporting: FinancialReports;
    emergencyControls: EmergencySystem;
}
export interface BettingAPIConfig {
    books: SportsBookAPI[];
    primaryBook: string;
    backupBooks: string[];
    apiCredentials: Record<string, BookCredentials>;
    rateLimits: Record<string, RateLimit>;
    maxBetSize: number;
    maxDailyRisk: number;
    maxSingleExposure: number;
    enabledSports: string[];
    kellyMultiplier: number;
    correlationLimits: CorrelationLimits;
    emergencyStopLoss: number;
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
    reliability: number;
    latency: number;
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
    maxSameGame: number;
    maxSamePlayer: number;
    maxSameSport: number;
    maxPortfolioCorrelation: number;
}
export interface PerformanceTracker {
    realTimeMetrics: LiveMetrics;
    historicalPerformance: HistoricalResults;
    clvTracking: CLVTracker;
    statisticalSignificance: SignificanceTracker;
}
export interface LiveMetrics {
    sessionStartTime: string;
    currentWinRate: number;
    currentROI: number;
    currentCLV: number;
    totalBets: number;
    wins: number;
    losses: number;
    pending: number;
    totalStaked: number;
    totalReturns: number;
    netProfit: number;
    avgBetSize: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winStreak: number;
    lossStreak: number;
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
        winRateTarget: boolean;
        clvTarget: boolean;
        systemReliability: boolean;
        riskManagement: boolean;
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
    clv: number;
    clvCategory: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    timestamp: string;
    sport: string;
    market: string;
    professionalFeatures: ProfessionalFeaturesResult;
}
export interface CLVAggregateMetrics {
    totalTracks: number;
    positiveClvRate: number;
    avgClv: number;
    avgClvByFeature: Record<string, number>;
    clvDistribution: {
        positive: number;
        neutral: number;
        negative: number;
    };
    timeToLineMovement: number;
}
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
    currentPower: number;
}
export interface LiveRiskMonitor {
    realTimeRisk: RealTimeRisk;
    portfolioRisk: PortfolioRisk;
    kellyMonitoring: KellyMonitor;
    emergencyTriggers: EmergencyTrigger[];
}
export interface RealTimeRisk {
    currentExposure: number;
    maxExposure: number;
    utilizationRate: number;
    dailyStaked: number;
    dailyLimit: number;
    dailyBetsPlaced: number;
    dailyBetLimit: number;
    sameGameExposure: Record<string, number>;
    samePlayerExposure: Record<string, number>;
    sameSportExposure: Record<string, number>;
    portfolioCorrelation: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    activeAlerts: RiskAlert[];
}
export interface PortfolioRisk {
    totalValue: number;
    var95: number;
    expectedShortfall: number;
    maxDrawdown: number;
    currentDrawdown: number;
    avgKellyFraction: number;
    maxKellyFraction: number;
    kellyViolations: number;
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
export interface FinancialReports {
    realTimePnL: RealTimePnL;
    transactionCosts: TransactionCostAnalysis;
    attribution: PerformanceAttribution;
    riskReports: RiskReport[];
}
export interface RealTimePnL {
    sessionPnL: number;
    unrealizedPnL: number;
    realizedPnL: number;
    dailyPnL: number;
    weeklyPnL: number;
    monthlyPnL: number;
    totalPnL: number;
    pnlByBet: BetPnL[];
    pnlBySport: Record<string, number>;
    pnlByBook: Record<string, number>;
    pnlByFeature: Record<string, number>;
    roi: number;
    roiAnnualized: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
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
    windowSize: number;
    enabled: boolean;
    triggered: boolean;
    cooldownPeriod: number;
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
    escalationDelay: number;
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
export interface LiveBet {
    id: string;
    propId: string;
    betSlipId?: string;
    sport: string;
    market: string;
    selection: string;
    line: number;
    odds: number;
    stake: number;
    professionalScore: number;
    professionalFeatures: ProfessionalFeaturesResult;
    clvTrackingId: string;
    kellyFraction: number;
    book: string;
    placedAt: string;
    confirmedAt?: string;
    settledAt?: string;
    status: 'PENDING' | 'CONFIRMED' | 'SETTLED' | 'CANCELLED' | 'FAILED';
    result?: 'WIN' | 'LOSS' | 'PUSH';
    clv?: number;
    pnl?: number;
    roi?: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    correlationRisk: number;
    portfolioImpact: number;
    testingPhase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
    automaticallyPlaced: boolean;
    errorMessage?: string;
}
export interface TestingPhase {
    name: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
    description: string;
    startDate: string;
    endDate?: string;
    config: PhaseConfig;
    successCriteria: PhaseSuccessCriteria;
    status: 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'PAUSED';
    currentResults: PhaseResult;
}
export interface PhaseConfig {
    maxBetSize: number;
    maxDailyRisk: number;
    maxTotalRisk: number;
    enabledSports: string[];
    enabledFeatures: string[];
    minTestingDays: number;
    minBetsRequired: number;
    stopLossThreshold: number;
    kellyMultiplier: number;
}
export interface PhaseSuccessCriteria {
    minWinRate: number;
    minPositiveCLVRate: number;
    minSystemUptime: number;
    maxProcessingTime: number;
    properKellySizing: boolean;
    riskControlsFunctioning: boolean;
    minSampleSize: number;
    minConfidenceLevel: number;
    positiveROI: boolean;
    maxDrawdown: number;
}
export interface LiveTestingConfig {
    environment: 'SANDBOX' | 'PRODUCTION';
    testingMode: boolean;
    currentPhase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D';
    phases: Record<string, PhaseConfig>;
    globalLimits: GlobalLimits;
    monitoring: MonitoringConfig;
    integrations: IntegrationConfig;
}
export interface GlobalLimits {
    maxTestingBankroll: number;
    maxSingleBet: number;
    maxDailyRisk: number;
    maxConcurrentBets: number;
    maxKellyFraction: number;
}
export interface MonitoringConfig {
    enableRealTimeTracking: boolean;
    enableCLVTracking: boolean;
    enableRiskMonitoring: boolean;
    enablePerformanceTracking: boolean;
    alertThresholds: {
        drawdownPercent: number;
        consecutiveLosses: number;
        systemErrors: number;
        processingDelays: number;
    };
    reportingIntervals: {
        realTime: number;
        hourly: boolean;
        daily: boolean;
        weekly: boolean;
    };
}
export interface IntegrationConfig {
    enabledBooks: string[];
    primaryBook: string;
    oddsProviders: string[];
    newsServices: string[];
    notifications: {
        discord: boolean;
        email: boolean;
        sms: boolean;
    };
}
export * from './betting-api';
export * from './performance-tracking';
export * from './risk-monitoring';
export * from './financial-reporting';
export * from './emergency-system';
//# sourceMappingURL=index.d.ts.map