export interface Position {
  id: string;
  type: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  metadata: {
    asset: string;
    timestamp: string;
  };
}

export interface RiskMetrics {
  id: string;
  positionId: string;
  var95: number;
  var99: number;
  sharpeRatio: number;
  maxDrawdown: number;
  metadata: {
    calculationDate: string;
    modelVersion: string;
  };
}

export interface KellyResult {
  id: string;
  positionId: string;
  optimalFraction: number;
  expectedValue: number;
  winProbability: number;
  metadata: {
    calculationDate: string;
    modelVersion: string;
  };
}

export interface RiskManagerConfig {
  maxDrawdown: number;
  maxVar95: number;
  maxVar99: number;
  minSharpeRatio: number;
  maxPositionSize: number;
  maxLeverage: number;
}

// Additional risk type exports
export interface RiskLimits {
  maxExposure: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  maxWeeklyLoss: number;
  maxMonthlyLoss: number;
  maxCorrelation: number;
  minDiversification: number;
  stopLossPercentage: number;
}

export interface PortfolioPosition {
  id: string;
  propId: string;
  size: number;
  odds: number;
  expectedValue: number;
  risk: number;
  correlation: Record<string, number>;
  metadata: {
    sport: string;
    market: string;
    player: string;
    addedAt: string;
  };
}

export interface OptimizationResult {
  portfolio: PortfolioPosition[];
  metrics: {
    totalRisk: number;
    expectedReturn: number;
    sharpeRatio: number;
    diversificationRatio: number;
    maxDrawdown: number;
    var95: number;
    var99: number;
  };
  constraints: {
    satisfied: boolean;
    violations: string[];
  };
  metadata: {
    optimizationDate: string;
    algorithm: string;
    iterations: number;
  };
} 