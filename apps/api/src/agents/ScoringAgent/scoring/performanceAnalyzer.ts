import { ScoringResult } from './gradingEngine';

export interface BetResult {
  id: string;
  sport: string;
  marketType: string;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  actualOdds: number;
  positionSize: number;
  result: number; // 1 for win, 0 for loss, 0.5 for push
  profit: number;
  confidence: number;
  expectedValue: number;
  timestamp: string;
  modelUsed: string;
}

export interface PerformanceMetrics {
  totalBets: number;
  winRate: number;
  roi: number;
  totalProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgStake: number;
  bestTier: string;
  worstTier: string;
  recentForm: number;
  byTier?: Record<string, { count: number; winRate: number; roi: number }>;
  bySport?: Record<string, { count: number; winRate: number; roi: number }>;
  byMarket?: Record<string, { count: number; winRate: number; roi: number }>;
}

/**
 * Fortune 100 Performance Analytics System
 * Tracks and analyzes grading performance with advanced metrics
 */
export class PerformanceAnalyzer {
  private betHistory: BetResult[] = [];
  private performanceCache: Map<string, PerformanceMetrics> = new Map();
  private lastCacheUpdate: string = new Date().toISOString();
  
  constructor() {
    // Initialize performance analyzer
  }

  /**
   * Record a bet result for performance tracking
   */
  public async recordBetResult(betResult: BetResult): Promise<void> {
    this.betHistory.push(betResult);
    
    // Clear cache to force recalculation
    this.performanceCache.clear();
    
    // Log performance milestone
    if (this.betHistory.length % 100 === 0) {
      console.log(`📊 Performance milestone: ${this.betHistory.length}
} bets recorded`);
      const metrics = await this.getPerformanceMetrics();
      console.log(`Current ROI: ${metrics.roi.toFixed(2)}%, Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  public async getPerformanceMetrics(timeframe: 'all' | '30d' | '7d' = 'all'): Promise<PerformanceMetrics> {
    const cacheKey = `metrics_${timeframe}
}`;
    
    // Check cache
    if (this.performanceCache.has(cacheKey) &&
        (Date.now() - new Date(this.lastCacheUpdate).getTime()) < 5 * 60 * 1000) { // 5 min cache
      return this.performanceCache.get(cacheKey)!;
    }

    // Filter bets based on timeframe
    let filteredBets = this.betHistory;
    if (timeframe !== 'all') {
      const cutoffDate = new Date();
      const days = timeframe === '30d' ? 30 : 7;
      cutoffDate.setDate(cutoffDate.getDate() - days);

      filteredBets = this.betHistory.filter(bet =>
        new Date(bet.timestamp) >= cutoffDate
      );
    }
    
    if (filteredBets.length === 0) {
      return this.getDefaultMetrics();
    }
    
    // Calculate metrics
    const totalBets = filteredBets.length;
    const wins = filteredBets.filter(bet => bet.result > 0).length;
    const winRate = wins / totalBets;
    
    const totalProfit = filteredBets.reduce((sum, bet) => sum + bet.profit, 0);
    const totalStake = filteredBets.reduce((sum, bet) => sum + bet.positionSize, 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const avgStake = totalStake / totalBets;
    
    // Risk-adjusted metrics
    const returns = filteredBets.map(bet => bet.profit / bet.positionSize);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
    
    const maxDrawdown = this.calculateMaxDrawdown(filteredBets);
    const profitFactor = this.calculateProfitFactor(filteredBets);

    // Tier analysis
    const tierPerformance = this.analyzeTierPerformance(filteredBets);
    const bestTier = Object.entries(tierPerformance)
      .sort((a, b) => b[1].roi - a[1].roi)[0]?.[0] || 'N/A';
    const worstTier = Object.entries(tierPerformance)
      .sort((a, b) => a[1].roi - b[1].roi)[0]?.[0] || 'N/A';

    // Recent form (last 10 bets)
    const recentBets = filteredBets.slice(-10);
    const recentWins = recentBets.filter(bet => bet.result > 0).length;
    const recentForm = recentBets.length > 0 ? recentWins / recentBets.length : 0;

    // Sport analysis
    const sportPerformance = this.analyzeSportPerformance(filteredBets);

    // Market analysis
    const marketPerformance = this.analyzeMarketPerformance(filteredBets);

    const metrics: PerformanceMetrics = {
      totalBets,
      winRate,
      roi,
      totalProfit,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      avgStake,
      bestTier,
      worstTier,
      recentForm,
      byTier: tierPerformance,
      bySport: sportPerformance,
      byMarket: marketPerformance
    };

    // Cache results
    this.performanceCache.set(cacheKey, metrics);
    this.lastCacheUpdate = new Date().toISOString();

    return metrics;
  }

  /**
   * Get historical accuracy for model validation
   */
  public async getHistoricalAccuracy(modelType?: string): Promise<{
    overall: number;
    byTier: Record<string, number>;
    byConfidence: Record<string, number>;
    trend: Array<{ date: string; accuracy: number }>;
  }> {
    let bets = this.betHistory;
    
    if (modelType) {
      bets = bets.filter(bet => bet.modelUsed === modelType);
    }
    
    if (bets.length === 0) {
      return {
        overall: 0,
        byTier: {},
        byConfidence: {},
        trend: []
      };
    }
    
    // Overall accuracy
    const correctPredictions = bets.filter(bet => bet.result > 0).length;
    const overall = correctPredictions / bets.length;
    
    // Accuracy by tier
    const byTier: Record<string, number> = {};
    const tierGroups = this.groupBy(bets, bet => bet.tier);
    Object.entries(tierGroups).forEach(([tier, tierBets]) => {
      const tierCorrect = tierBets.filter(bet => bet.result > 0).length;
      byTier[tier] = tierCorrect / tierBets.length;
    });
    
    // Accuracy by confidence ranges
    const byConfidence: Record<string, number> = {};
    const confidenceRanges = [
      { range: '80%+', filter: (bet: BetResult) => bet.confidence >= 80 },
      { range: '70-80%', filter: (bet: BetResult) => bet.confidence >= 70 && bet.confidence < 80 },
      { range: '60-70%', filter: (bet: BetResult) => bet.confidence >= 60 && bet.confidence < 70 },
      { range: '<60%', filter: (bet: BetResult) => bet.confidence < 60 }
    ];
    
    confidenceRanges.forEach(({ range, filter }) => {
      const rangeBets = bets.filter(filter);
      if (rangeBets.length > 0) {
        const rangeCorrect = rangeBets.filter(bet => bet.result > 0).length;
        byConfidence[range] = rangeCorrect / rangeBets.length;
      }
    });
    
    // Accuracy trend (last 30 days)
    const trend = this.calculateAccuracyTrend(bets);
    
    return {
      overall,
      byTier,
      byConfidence,
      trend
    };
  }

  /**
   * Log grading performance for continuous improvement
   */
  public async logGradingPerformance(
    gradingResult: ScoringResult,
    actualOutcome: number,
    actualProfit: number,
    sport?: string,
    marketType?: string,
    odds?: number
  ): Promise<void> {
    const betResult: BetResult = {
      id: `bet_${Date.now()}
}_${Math.random().toString(36).substr(2, 9)}`,
      sport: sport || 'Unknown',
      marketType: marketType || 'Unknown',
      tier: gradingResult.tier,
      actualOdds: odds || 0,
      positionSize: gradingResult.positionSize || 0.01,
      result: actualOutcome,
      profit: actualProfit,
      confidence: gradingResult.confidence,
      expectedValue: gradingResult.edgeScore || 0,
      timestamp: new Date().toISOString(),
      modelUsed: 'syndicate_grading_engine'
    };

    await this.recordBetResult(betResult);
  }

  /**
   * Get performance comparison between different models/strategies
   */
  public async getModelComparison(): Promise<Record<string, PerformanceMetrics>> {
    const modelGroups = this.groupBy(this.betHistory, bet => bet.modelUsed);
    const comparison: Record<string, PerformanceMetrics> = {};
    
    for (const [model, bets] of Object.entries(modelGroups)) {
      comparison[model] = await this.calculateMetricsForBets(bets);
    }
    
    return comparison;
  }

  /**
   * Export performance data for external analysis
   */
  public exportPerformanceData(): BetResult[] {
    return [...this.betHistory];
  }

  /**
   * Clear performance history (use with caution)
   */
  public clearHistory(): void {
    this.betHistory = [];
    this.performanceCache.clear();
  }

  // Private helper methods
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) {return 0;}
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateMaxDrawdown(bets: BetResult[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;
    
    for (const bet of bets) {
      runningTotal += bet.profit;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak > 0 ? (peak - runningTotal) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateProfitFactor(bets: BetResult[]): number {
    const wins = bets.filter(bet => bet.result > 0);
    const losses = bets.filter(bet => bet.result <= 0);
    
    const totalWins = wins.reduce((sum, bet) => sum + bet.profit, 0);
    const totalLosses = Math.abs(losses.reduce((sum, bet) => sum + bet.profit, 0));
    
    return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
  }

  private analyzeTierPerformance(bets: BetResult[]): Record<string, { count: number; winRate: number; roi: number }> {
    const tierGroups = this.groupBy(bets, bet => bet.tier);
    const tierPerformance: Record<string, { count: number; winRate: number; roi: number }> = {};
    
    Object.entries(tierGroups).forEach(([tier, tierBets]) => {
      const wins = tierBets.filter(bet => bet.result > 0).length;
      const totalProfit = tierBets.reduce((sum, bet) => sum + bet.profit, 0);
      const totalStake = tierBets.reduce((sum, bet) => sum + bet.positionSize, 0);
      
      tierPerformance[tier] = {
        count: tierBets.length,
        winRate: wins / tierBets.length,
        roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0
      };
    });

    return tierPerformance;
  }

  private calculateAccuracyTrend(bets: BetResult[]): { date: string; accuracy: number }[] {
    // Group bets by day
    const dailyGroups = this.groupBy(bets, bet => {
      const timestamp = bet.timestamp || Date.now();
      const dateStr = new Date(timestamp).toISOString().split('T')[0];
      return dateStr || new Date().toISOString().split('T')[0] || 'unknown';
    });

    return Object.entries(dailyGroups)
      .map(([date, dayBets]) => ({
        date,
        accuracy: dayBets.filter(bet => bet.result > 0).length / dayBets.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private async calculateMetricsForBets(bets: BetResult[]): Promise<PerformanceMetrics> {
    if (bets.length === 0) {
      return this.getDefaultMetrics();
    }

    const totalBets = bets.length;
    const wins = bets.filter(bet => bet.result > 0).length;
    const winRate = wins / totalBets;

    const totalProfit = bets.reduce((sum, bet) => sum + bet.profit, 0);
    const totalStake = bets.reduce((sum, bet) => sum + bet.positionSize, 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const avgStake = totalStake / totalBets;

    const returns = bets.map(bet => bet.profit / bet.positionSize);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    const maxDrawdown = this.calculateMaxDrawdown(bets);
    const profitFactor = this.calculateProfitFactor(bets);

    const tierPerformance = this.analyzeTierPerformance(bets);
    const bestTier = Object.entries(tierPerformance)
      .sort((a, b) => b[1].roi - a[1].roi)[0]?.[0] || 'N/A';
    const worstTier = Object.entries(tierPerformance)
      .sort((a, b) => a[1].roi - b[1].roi)[0]?.[0] || 'N/A';

    // Added: analyze performance by sport and market
    const sportPerformance = this.analyzeSportPerformance(bets);
    const marketPerformance = this.analyzeMarketPerformance(bets);

    const recentBets = bets.slice(-10);
    const recentWins = recentBets.filter(bet => bet.result > 0).length;
    const recentForm = recentBets.length > 0 ? recentWins / recentBets.length : 0;

    return {
      totalBets,
      winRate,
      roi,
      totalProfit,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      avgStake,
      bestTier,
      worstTier,
      recentForm,
      bySport: sportPerformance,
      byMarket: marketPerformance
    };
  }

  private analyzeSportPerformance(bets: BetResult[]): Record<string, { count: number; winRate: number; roi: number }> {
    const sportGroups = this.groupBy(bets, bet => bet.sport);
    const sportPerformance: Record<string, { count: number; winRate: number; roi: number }> = {};

    Object.entries(sportGroups).forEach(([sport, sportBets]) => {
      const wins = sportBets.filter(bet => bet.result > 0).length;
      const totalProfit = sportBets.reduce((sum, bet) => sum + bet.profit, 0);
      const totalStake = sportBets.reduce((sum, bet) => sum + bet.positionSize, 0);

      sportPerformance[sport] = {
        count: sportBets.length,
        winRate: wins / sportBets.length,
        roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0
      };
    });

    return sportPerformance;
  }

  private analyzeMarketPerformance(bets: BetResult[]): Record<string, { count: number; winRate: number; roi: number }> {
    const marketGroups = this.groupBy(bets, bet => bet.marketType);
    const marketPerformance: Record<string, { count: number; winRate: number; roi: number }> = {};

    Object.entries(marketGroups).forEach(([market, marketBets]) => {
      const wins = marketBets.filter(bet => bet.result > 0).length;
      const totalProfit = marketBets.reduce((sum, bet) => sum + bet.profit, 0);
      const totalStake = marketBets.reduce((sum, bet) => sum + bet.positionSize, 0);

      marketPerformance[market] = {
        count: marketBets.length,
        winRate: wins / marketBets.length,
        roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0
      };
    });

    return marketPerformance;
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      totalBets: 0,
      winRate: 0,
      roi: 0,
      totalProfit: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      avgStake: 0,
      bestTier: 'N/A',
      worstTier: 'N/A',
      recentForm: 0
    };
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {groups[key] = [];}
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}