// import { Pick } from '../types';
// import { GradingResult } from '../agents/GradingAgent/scoring/gradingEngine';
import { AdvancedPerformanceMetrics } from '../agents/GradingAgent/scoring/advancedBacktesting';

export interface DashboardData {
  // Real-time Performance
  livePerformance: {
    todayPicks: number;
    todayWinRate: number;
    todayROI: number;
    todayProfit: number;
    activePicks: number;
    pendingResults: number;
  };

  // Current Picks
  currentPicks: Array<{
    id: string;
    sport: string;
    player: string;
    marketType: string;
    line: number;
    odds: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    confidence: number;
    edgeScore: number;
    positionSize: number;
    expectedValue: number;
    gameTime: string;
    status: 'PENDING' | 'WON' | 'LOST' | 'PUSH';
    actualResult?: number;
    profit?: number;
  }>;

  // Performance Metrics
  performance: {
    overall: AdvancedPerformanceMetrics;
    last7Days: AdvancedPerformanceMetrics;
    last30Days: AdvancedPerformanceMetrics;
    thisMonth: AdvancedPerformanceMetrics;
  };

  // Tier Analysis
  tierAnalysis: {
    distribution: Record<string, number>;
    performance: Record<
      string,
      {
        count: number;
        winRate: number;
        roi: number;
        avgConfidence: number;
        profitFactor: number;
      }
    >;
  };

  // Sport Analysis
  sportAnalysis: {
    distribution: Record<string, number>;
    performance: Record<
      string,
      {
        count: number;
        winRate: number;
        roi: number;
        bestTier: string;
        recentForm: number;
      }
    >;
  };

  // Market Analysis
  marketAnalysis: {
    distribution: Record<string, number>;
    performance: Record<
      string,
      {
        count: number;
        winRate: number;
        roi: number;
        avgOdds: number;
        profitability: number;
      }
    >;
  };

  // Risk Metrics
  riskMetrics: {
    currentExposure: number;
    maxDrawdown: number;
    valueAtRisk: number;
    sharpeRatio: number;
    correlationRisk: number;
    portfolioRisk: number;
    riskAlerts: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
      timestamp: string;
    }>;
  };

  // Charts Data
  charts: {
    profitChart: Array<{ date: string; profit: number; cumulative: number }>;
    winRateChart: Array<{ date: string; winRate: number; picks: number }>;
    tierChart: Array<{ tier: string; count: number; winRate: number; roi: number }>;
    sportChart: Array<{ sport: string; count: number; winRate: number; roi: number }>;
    confidenceChart: Array<{ range: string; count: number; winRate: number; roi: number }>;
    oddsChart: Array<{ range: string; count: number; winRate: number; roi: number }>;
  };

  // Streaks & Trends
  streaks: {
    current: { type: 'win' | 'loss'; count: number };
    longestWin: number;
    longestLoss: number;
    recentTrend: 'UP' | 'DOWN' | 'STABLE';
    momentum: number;
  };

  // Top Performers
  topPerformers: {
    players: Array<{
      name: string;
      sport: string;
      picks: number;
      winRate: number;
      roi: number;
      profit: number;
    }>;
    sports: Array<{
      sport: string;
      picks: number;
      winRate: number;
      roi: number;
      profit: number;
    }>;
    markets: Array<{
      marketType: string;
      picks: number;
      winRate: number;
      roi: number;
      profit: number;
    }>;
  };

  // Alerts & Notifications
  alerts: Array<{
    id: string;
    type: 'PERFORMANCE' | 'RISK' | 'OPPORTUNITY' | 'SYSTEM';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    message: string;
    timestamp: string;
    actionRequired: boolean;
    recommendation?: string;
  }>;

  // System Status
  systemStatus: {
    lastUpdate: string;
    dataFreshness: number; // minutes since last update
    systemHealth: 'HEALTHY' | 'WARNING' | 'ERROR';
    activeModels: string[];
    processingQueue: number;
    uptime: string;
  };
}

/**
 * Fortune 100 Dashboard API System
 * Provides comprehensive real-time data for subscriber and operator dashboards
 */
export class DashboardAPI {
  private cachedData: DashboardData | null = null;
  private lastUpdate: string = new Date().toISOString();
  private updateInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize dashboard API
    this.startAutoUpdate();
  }

  /**
   * Get comprehensive dashboard data
   */
  public async getDashboardData(
    _timeframe: '24h' | '7d' | '30d' | 'all' = '30d'
  ): Promise<DashboardData> {
    if (this.shouldRefreshCache()) {
      await this.refreshDashboardData();
    }

    return this.cachedData || (await this.generateDefaultDashboardData());
  }

  /**
   * Get real-time performance data
   */
  public async getLivePerformance(): Promise<DashboardData['livePerformance']> {
    // This would connect to real-time data sources
    return {
      todayPicks: 12,
      todayWinRate: 0.75,
      todayROI: 8.5,
      todayProfit: 1250,
      activePicks: 8,
      pendingResults: 3,
    };
  }

  /**
   * Get current active picks
   */
  public async getCurrentPicks(): Promise<DashboardData['currentPicks']> {
    // This would fetch from database
    return [
      {
        id: 'pick_001',
        sport: 'NBA',
        player: 'LeBron James',
        marketType: 'Points',
        line: 25.5,
        odds: -110,
        tier: 'A',
        confidence: 82,
        edgeScore: 12.5,
        positionSize: 0.03,
        expectedValue: 8.2,
        gameTime: '2025-07-08T20:00:00Z',
        status: 'PENDING',
      },
      {
        id: 'pick_002',
        sport: 'NFL',
        player: 'Josh Allen',
        marketType: 'Passing Yards',
        line: 275.5,
        odds: +105,
        tier: 'S',
        confidence: 88,
        edgeScore: 18.3,
        positionSize: 0.04,
        expectedValue: 15.7,
        gameTime: '2025-07-08T21:00:00Z',
        status: 'PENDING',
      },
    ];
  }

  /**
   * Get tier analysis data
   */
  public async getTierAnalysis(): Promise<DashboardData['tierAnalysis']> {
    return {
      distribution: {
        S: 15,
        A: 45,
        B: 78,
        C: 32,
        D: 8,
      },
      performance: {
        S: { count: 15, winRate: 0.87, roi: 18.5, avgConfidence: 88, profitFactor: 3.2 },
        A: { count: 45, winRate: 0.78, roi: 12.3, avgConfidence: 82, profitFactor: 2.1 },
        B: { count: 78, winRate: 0.68, roi: 8.7, avgConfidence: 72, profitFactor: 1.6 },
        C: { count: 32, winRate: 0.56, roi: 3.2, avgConfidence: 62, profitFactor: 1.1 },
        D: { count: 8, winRate: 0.38, roi: -5.5, avgConfidence: 45, profitFactor: 0.7 },
      },
    };
  }

  /**
   * Get sport analysis data
   */
  public async getSportAnalysis(): Promise<DashboardData['sportAnalysis']> {
    return {
      distribution: {
        NBA: 65,
        NFL: 48,
        MLB: 32,
        NHL: 28,
        NCAAB: 15,
      },
      performance: {
        NBA: { count: 65, winRate: 0.72, roi: 11.5, bestTier: 'A', recentForm: 0.78 },
        NFL: { count: 48, winRate: 0.69, roi: 9.8, bestTier: 'S', recentForm: 0.71 },
        MLB: { count: 32, winRate: 0.66, roi: 7.2, bestTier: 'B', recentForm: 0.69 },
        NHL: { count: 28, winRate: 0.64, roi: 6.5, bestTier: 'A', recentForm: 0.67 },
        NCAAB: { count: 15, winRate: 0.6, roi: 4.8, bestTier: 'B', recentForm: 0.63 },
      },
    };
  }

  /**
   * Get risk metrics
   */
  public async getRiskMetrics(): Promise<DashboardData['riskMetrics']> {
    return {
      currentExposure: 0.15,
      maxDrawdown: 0.08,
      valueAtRisk: 0.04,
      sharpeRatio: 1.45,
      correlationRisk: 0.12,
      portfolioRisk: 0.18,
      riskAlerts: [
        {
          type: 'EXPOSURE',
          severity: 'MEDIUM',
          message: 'NBA exposure at 35% of portfolio',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  /**
   * Get chart data for visualizations
   */
  public async getChartData(): Promise<DashboardData['charts']> {
    return {
      profitChart: this.generateProfitChartData(),
      winRateChart: this.generateWinRateChartData(),
      tierChart: this.generateTierChartData(),
      sportChart: this.generateSportChartData(),
      confidenceChart: this.generateConfidenceChartData(),
      oddsChart: this.generateOddsChartData(),
    };
  }

  /**
   * Get streak and trend data
   */
  public async getStreakData(): Promise<DashboardData['streaks']> {
    return {
      current: { type: 'win', count: 5 },
      longestWin: 12,
      longestLoss: 4,
      recentTrend: 'UP',
      momentum: 0.15,
    };
  }

  /**
   * Get top performers
   */
  public async getTopPerformers(): Promise<DashboardData['topPerformers']> {
    return {
      players: [
        { name: 'LeBron James', sport: 'NBA', picks: 8, winRate: 0.88, roi: 15.2, profit: 1250 },
        { name: 'Josh Allen', sport: 'NFL', picks: 6, winRate: 0.83, roi: 12.8, profit: 980 },
        { name: 'Connor McDavid', sport: 'NHL', picks: 5, winRate: 0.8, roi: 11.5, profit: 750 },
      ],
      sports: [
        { sport: 'NBA', picks: 65, winRate: 0.72, roi: 11.5, profit: 5250 },
        { sport: 'NFL', picks: 48, winRate: 0.69, roi: 9.8, profit: 3850 },
        { sport: 'MLB', picks: 32, winRate: 0.66, roi: 7.2, profit: 2100 },
      ],
      markets: [
        { marketType: 'Points', picks: 45, winRate: 0.73, roi: 12.1, profit: 3200 },
        { marketType: 'Assists', picks: 32, winRate: 0.69, roi: 9.5, profit: 2100 },
        { marketType: 'Rebounds', picks: 28, winRate: 0.68, roi: 8.8, profit: 1850 },
      ],
    };
  }

  /**
   * Get system alerts
   */
  public async getAlerts(): Promise<DashboardData['alerts']> {
    return [
      {
        id: 'alert_001',
        type: 'PERFORMANCE',
        severity: 'HIGH',
        title: 'S-Tier Performance Spike',
        message: 'S-tier picks showing 87% win rate over last 7 days',
        timestamp: new Date().toISOString(),
        actionRequired: false,
        recommendation: 'Consider increasing S-tier allocation',
      },
      {
        id: 'alert_002',
        type: 'RISK',
        severity: 'MEDIUM',
        title: 'NBA Exposure Warning',
        message: 'NBA exposure at 35% of total portfolio',
        timestamp: new Date().toISOString(),
        actionRequired: true,
        recommendation: 'Diversify into other sports or reduce position sizes',
      },
    ];
  }

  /**
   * Get system status
   */
  public async getSystemStatus(): Promise<DashboardData['systemStatus']> {
    return {
      lastUpdate: new Date().toISOString(),
      dataFreshness: 2,
      systemHealth: 'HEALTHY',
      activeModels: ['Neural Network', 'Gradient Boosting', 'Random Forest', 'Ensemble'],
      processingQueue: 3,
      uptime: '99.8%',
    };
  }

  /**
   * Refresh dashboard data cache
   */
  private async refreshDashboardData(): Promise<void> {
    const [
      livePerformance,
      currentPicks,
      tierAnalysis,
      sportAnalysis,
      riskMetrics,
      charts,
      streaks,
      topPerformers,
      alerts,
      systemStatus,
    ] = await Promise.all([
      this.getLivePerformance(),
      this.getCurrentPicks(),
      this.getTierAnalysis(),
      this.getSportAnalysis(),
      this.getRiskMetrics(),
      this.getChartData(),
      this.getStreakData(),
      this.getTopPerformers(),
      this.getAlerts(),
      this.getSystemStatus(),
    ]);

    // Generate performance metrics (simplified)
    const performance = {
      overall: await this.generatePerformanceMetrics('all'),
      last7Days: await this.generatePerformanceMetrics('7d'),
      last30Days: await this.generatePerformanceMetrics('30d'),
      thisMonth: await this.generatePerformanceMetrics('month'),
    };

    // Generate market analysis
    const marketAnalysis = {
      distribution: {
        Points: 45,
        Assists: 32,
        Rebounds: 28,
        'Passing Yards': 25,
        'Rushing Yards': 18,
      },
      performance: {
        Points: { count: 45, winRate: 0.73, roi: 12.1, avgOdds: -115, profitability: 3200 },
        Assists: { count: 32, winRate: 0.69, roi: 9.5, avgOdds: -108, profitability: 2100 },
        Rebounds: { count: 28, winRate: 0.68, roi: 8.8, avgOdds: -112, profitability: 1850 },
      },
    };

    this.cachedData = {
      livePerformance,
      currentPicks,
      performance,
      tierAnalysis,
      sportAnalysis,
      marketAnalysis,
      riskMetrics,
      charts,
      streaks,
      topPerformers,
      alerts,
      systemStatus,
    };

    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Check if cache should be refreshed
   */
  private shouldRefreshCache(): boolean {
    return (
      !this.cachedData || Date.now() - new Date(this.lastUpdate).getTime() > this.updateInterval
    );
  }

  /**
   * Start automatic cache updates
   */
  private startAutoUpdate(): void {
    setInterval(async () => {
      try {
        await this.refreshDashboardData();
      } catch (_error) {
        console.error('Dashboard auto-update failed:', _error);
      }
    }, this.updateInterval);
  }

  /**
   * Generate default dashboard data
   */
  private async generateDefaultDashboardData(): Promise<DashboardData> {
    // Return default/empty dashboard data structure
    return {
      livePerformance: {
        todayPicks: 0,
        todayWinRate: 0,
        todayROI: 0,
        todayProfit: 0,
        activePicks: 0,
        pendingResults: 0,
      },
      currentPicks: [],
      performance: {
        overall: await this.generatePerformanceMetrics('all'),
        last7Days: await this.generatePerformanceMetrics('7d'),
        last30Days: await this.generatePerformanceMetrics('30d'),
        thisMonth: await this.generatePerformanceMetrics('month'),
      },
      tierAnalysis: { distribution: {}, performance: {} },
      sportAnalysis: { distribution: {}, performance: {} },
      marketAnalysis: { distribution: {}, performance: {} },
      riskMetrics: {
        currentExposure: 0,
        maxDrawdown: 0,
        valueAtRisk: 0,
        sharpeRatio: 0,
        correlationRisk: 0,
        portfolioRisk: 0,
        riskAlerts: [],
      },
      charts: {
        profitChart: [],
        winRateChart: [],
        tierChart: [],
        sportChart: [],
        confidenceChart: [],
        oddsChart: [],
      },
      streaks: {
        current: { type: 'win', count: 0 },
        longestWin: 0,
        longestLoss: 0,
        recentTrend: 'STABLE',
        momentum: 0,
      },
      topPerformers: {
        players: [],
        sports: [],
        markets: [],
      },
      alerts: [],
      systemStatus: {
        lastUpdate: new Date().toISOString(),
        dataFreshness: 0,
        systemHealth: 'HEALTHY',
        activeModels: [],
        processingQueue: 0,
        uptime: '100%',
      },
    };
  }

  // Chart data generators
  private generateProfitChartData(): Array<{ date: string; profit: number; cumulative: number }> {
    const data = [];
    let cumulative = 0;

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);
      const profit = (Math.random() - 0.3) * 500; // Slightly positive bias
      cumulative += profit;

      data.push({
        date: date.toISOString().split('T')[0] || date.toDateString(),
        profit: Math.round(profit),
        cumulative: Math.round(cumulative),
      });
    }

    return data;
  }

  private generateWinRateChartData(): Array<{ date: string; winRate: number; picks: number }> {
    const data = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      data.push({
        date: date.toISOString().split('T')[0] || date.toDateString(),
        winRate: 0.6 + Math.random() * 0.3, // 60-90% range
        picks: Math.floor(Math.random() * 10) + 1,
      });
    }

    return data;
  }

  private generateTierChartData(): Array<{
    tier: string;
    count: number;
    winRate: number;
    roi: number;
  }> {
    return [
      { tier: 'S', count: 15, winRate: 0.87, roi: 18.5 },
      { tier: 'A', count: 45, winRate: 0.78, roi: 12.3 },
      { tier: 'B', count: 78, winRate: 0.68, roi: 8.7 },
      { tier: 'C', count: 32, winRate: 0.56, roi: 3.2 },
      { tier: 'D', count: 8, winRate: 0.38, roi: -5.5 },
    ];
  }

  private generateSportChartData(): Array<{
    sport: string;
    count: number;
    winRate: number;
    roi: number;
  }> {
    return [
      { sport: 'NBA', count: 65, winRate: 0.72, roi: 11.5 },
      { sport: 'NFL', count: 48, winRate: 0.69, roi: 9.8 },
      { sport: 'MLB', count: 32, winRate: 0.66, roi: 7.2 },
      { sport: 'NHL', count: 28, winRate: 0.64, roi: 6.5 },
      { sport: 'NCAAB', count: 15, winRate: 0.6, roi: 4.8 },
    ];
  }

  private generateConfidenceChartData(): Array<{
    range: string;
    count: number;
    winRate: number;
    roi: number;
  }> {
    return [
      { range: '80%+', count: 25, winRate: 0.84, roi: 15.2 },
      { range: '70-80%', count: 45, winRate: 0.73, roi: 10.8 },
      { range: '60-70%', count: 65, winRate: 0.65, roi: 6.5 },
      { range: '<60%', count: 23, winRate: 0.48, roi: -2.1 },
    ];
  }

  private generateOddsChartData(): Array<{
    range: string;
    count: number;
    winRate: number;
    roi: number;
  }> {
    return [
      { range: '-200 to -150', count: 18, winRate: 0.78, roi: 8.5 },
      { range: '-150 to -110', count: 52, winRate: 0.71, roi: 9.2 },
      { range: '-110 to +110', count: 68, winRate: 0.68, roi: 10.1 },
      { range: '+110 to +200', count: 35, winRate: 0.63, roi: 11.8 },
      { range: '+200+', count: 15, winRate: 0.53, roi: 15.2 },
    ];
  }

  private async generatePerformanceMetrics(
    _timeframe: string
  ): Promise<AdvancedPerformanceMetrics> {
    // Simplified performance metrics generation
    return {
      totalPicks: 178,
      winRate: 0.71,
      roi: 10.5,
      totalProfit: 8750,
      avgStake: 0.025,
      sharpeRatio: 1.45,
      sortinoRatio: 1.82,
      calmarRatio: 1.25,
      maxDrawdown: 0.08,
      valueAtRisk: 0.04,
      expectedShortfall: 0.06,
      tierPerformance: {},
      sportPerformance: {},
      marketPerformance: {},
      monthlyPerformance: [],
      weeklyPerformance: [],
      streakAnalysis: {
        longestWinStreak: 12,
        longestLoseStreak: 4,
        currentStreak: { type: 'win', count: 5 },
        avgWinStreak: 6.2,
        avgLoseStreak: 2.8,
      },
      oddsAnalysis: {
        favoritePerformance: { winRate: 0.74, roi: 8.5, count: 85 },
        underdogPerformance: { winRate: 0.68, roi: 12.8, count: 93 },
        sweetSpot: { oddsRange: '-110 to +110', winRate: 0.68, roi: 10.1 },
      },
      confidenceAnalysis: {
        highConfidence: { winRate: 0.84, roi: 15.2, count: 25 },
        mediumConfidence: { winRate: 0.73, roi: 10.8, count: 45 },
        lowConfidence: { winRate: 0.48, roi: -2.1, count: 23 },
      },
      modelAccuracy: {
        neuralNetwork: 0.82,
        gradientBoosting: 0.85,
        randomForest: 0.78,
        ensemble: 0.87,
        overallAgreement: 0.83,
      },
      topFeatures: [
        { feature: 'expectedValue', importance: 0.25, correlation: 0.78, performance: 0.82 },
        { feature: 'marketIntelligence', importance: 0.2, correlation: 0.72, performance: 0.79 },
      ],
      projectedPerformance: {
        nextMonth: { expectedROI: 11.2, confidence: 0.75 },
        nextQuarter: { expectedROI: 10.8, confidence: 0.65 },
        riskAdjustedTargets: {
          conservative: 7.5,
          moderate: 10.5,
          aggressive: 13.8,
        },
      },
    };
  }

  /**
   * Get filtered dashboard data based on criteria
   */
  public async getFilteredData(filters: {
    sport?: string;
    tier?: string;
    timeframe?: string;
    minConfidence?: number;
  }): Promise<Partial<DashboardData>> {
    const fullData = await this.getDashboardData();

    // Apply filters to current picks
    let filteredPicks = fullData.currentPicks;

    if (filters.sport) {
      filteredPicks = filteredPicks.filter(pick => pick.sport === filters.sport);
    }

    if (filters.tier) {
      filteredPicks = filteredPicks.filter(pick => pick.tier === filters.tier);
    }

    if (filters.minConfidence !== undefined) {
      filteredPicks = filteredPicks.filter(pick => pick.confidence >= filters.minConfidence!);
    }

    return {
      ...fullData,
      currentPicks: filteredPicks,
    };
  }

  /**
   * Export dashboard data for external use
   */
  public async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const data = await this.getDashboardData();

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV export would be implemented here
    return 'CSV export not implemented yet';
  }
}
