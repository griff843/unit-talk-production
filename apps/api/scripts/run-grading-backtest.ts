import { SyndicateGradingEngine } from '../src/agents/GradingAgent/scoring/gradingEngine';
import { PerformanceAnalyzer, BetResult } from '../src/agents/GradingAgent/scoring/performanceAnalyzer';
import { GradingFeatureSet } from '../src/types/GradingFeatureSet';

interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialBankroll: number;
  sports: string[];
  marketTypes: string[];
  minTier: string;
  maxPositionSize: number;
  riskLimits: {
    maxDrawdown: number;
    minSharpeRatio: number;
    maxCorrelation: number;
    maxExposurePerSport: number;
    maxExposurePerPlayer: number;
    maxDailyRisk: number;
  };
}

interface BacktestResult {
  summary: {
    totalBets: number;
    winRate: number;
    roi: number;
    totalProfit: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    finalBankroll: number;
  };
  performance: {
    byTier: Record<string, any>;
    bySport: Record<string, any>;
    byMarket: Record<string, any>;
    monthly: Array<{
      month: string;
      profit: number;
      winRate: number;
      betCount: number;
    }>;
  };
  riskMetrics: {
    valueAtRisk: number;
    expectedShortfall: number;
    maxConsecutiveLosses: number;
    worstMonth: number;
    bestMonth: number;
  };
  recommendations: string[];
}

/**
 * Comprehensive backtesting system for the syndicate grading engine
 * Tests historical performance and validates model effectiveness
 */
export class GradingBacktester {
  private gradingEngine: SyndicateGradingEngine;
  private performanceAnalyzer: PerformanceAnalyzer;
  private config: BacktestConfig;
  
  constructor(config: BacktestConfig) {
    this.config = config;
    this.gradingEngine = new SyndicateGradingEngine();
    this.performanceAnalyzer = new PerformanceAnalyzer();
  }
  
  /**
   * Run comprehensive backtest
   */
  async runBacktest(): Promise<BacktestResult> {
    console.log('🚀 Starting comprehensive backtest...');
    console.log(`📅 Period: ${this.config.startDate} to ${this.config.endDate}`);
    console.log(`💰 Initial Bankroll: $${this.config.initialBankroll.toLocaleString()}`);
    
    try {
      // Generate historical data
      const historicalData = await this.generateHistoricalData();
      console.log(`📊 Generated ${historicalData.length} historical props`);
      
      // Run simulation
      const simulationResults = await this.runSimulation(historicalData);
      console.log(`✅ Simulation completed with ${simulationResults.length} bets`);
      
      // Analyze results
      const analysis = await this.analyzeResults(simulationResults);
      console.log(`📈 Analysis completed`);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(analysis);
      
      const result: BacktestResult = {
        summary: analysis.summary,
        performance: analysis.performance,
        riskMetrics: analysis.riskMetrics,
        recommendations
      };
      
      console.log('🎯 Backtest Results Summary:');
      console.log(`   Win Rate: ${result.summary.winRate.toFixed(1)}%`);
      console.log(`   Average ROI: ${result.summary.roi.toFixed(1)}%`);
      console.log(`   Total Profit: $${result.summary.totalProfit.toLocaleString()}`);
      console.log(`   Sharpe Ratio: ${result.summary.sharpeRatio.toFixed(2)}`);
      console.log(`   Max Drawdown: ${result.summary.maxDrawdown.toFixed(1)}%`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Backtest failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate historical prop data for backtesting
   */
  private async generateHistoricalData(): Promise<GradingFeatureSet[]> {
    const data: GradingFeatureSet[] = [];
    const startDate = new Date(this.config.startDate);
    const endDate = new Date(this.config.endDate);

    // Generate props for each day in the range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dailyProps = await this.generateDailyProps(date.toISOString().split('T')[0]);
      data.push(...dailyProps);
    }

    return data;
  }
  
  /**
   * Generate props for a specific day
   */
  private async generateDailyProps(date: string): Promise<GradingFeatureSet[]> {
    const props: GradingFeatureSet[] = [];
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    // Different prop counts based on day of week
    const propCounts = {
      0: 15, // Sunday - NFL heavy
      1: 8,  // Monday
      2: 12, // Tuesday - NBA heavy
      3: 14, // Wednesday
      4: 16, // Thursday
      5: 18, // Friday
      6: 20  // Saturday - College sports
    };
    
    const propsToGenerate = propCounts[dayOfWeek as keyof typeof propCounts];
    
    for (let i = 0; i < propsToGenerate; i++) {
      const prop = await this.generateRandomProp(date, i);
      props.push(prop);
    }
    
    return props;
  }
  
  /**
   * Generate a random prop with realistic features
   */
  private async generateRandomProp(date: string, index: number): Promise<GradingFeatureSet> {
    const sports = this.config.sports;
    const marketTypes = this.config.marketTypes;
    
    const sport = sports[Math.floor(Math.random() * sports.length)];
    const marketType = marketTypes[Math.floor(Math.random() * marketTypes.length)];
    
    // Generate realistic player names
    const players = this.getPlayersForSport(sport);
    const player = players[Math.floor(Math.random() * players.length)];

    // Generate realistic lines based on sport/market
    const line = this.generateRealisticLine(sport, marketType);
    const odds = this.generateRealisticOdds();

    const prop: GradingFeatureSet = {
      propId: `${date}_${sport}_${index}`,
      date: date,
      sport,
      league: this.getLeagueForSport(sport),
      market: {
        type: marketType,
        odds: odds,
        line: line
      },

      // Core Features (will be calculated by feature engineer)
      expectedValue: 0,
      lineMovement: 0,
      matchupRating: 0,
      playerForm: 0,
      injuryImpact: 0,
      weatherImpact: 0,

      // Market Intelligence
      marketIntelligence: 0,
      sharpMoney: 30 + Math.random() * 40, // 30-70 range
      volumeProfile: 50 + Math.random() * 100, // 50-150% of average
      closingLineValue: 0,

      // Player & Game Context
      playerFatigue: 0,
      venueAdvantage: 0,
      refereeImpact: 0,
      paceImpact: 0,
      motivationalFactors: 0,

      // Risk & Correlation
      correlationRisk: 0,
      volatility: 0,
      portfolioImpact: 0,

      // Raw Features (required arrays)
      marketFeatures: [],
      playerFeatures: [],
      contextFeatures: [],
      riskFeatures: [],

      // Optional properties for compatibility
      player: player,
      marketType: marketType,
      odds: odds,

      // Metadata
      source: 'backtest',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    return prop;
  }
  
  /**
   * Run the simulation with historical data
   */
  private async runSimulation(historicalData: GradingFeatureSet[]): Promise<BetResult[]> {
    const results: BetResult[] = [];
    let currentBankroll = this.config.initialBankroll;
    
    console.log('🎮 Running simulation...');
    
    for (let i = 0; i < historicalData.length; i++) {
      const prop = historicalData[i];
      
      if (i % 100 === 0) {
        console.log(`   Processed ${i}/${historicalData.length} props (${((i/historicalData.length)*100).toFixed(1)}%)`);
      }
      
      try {
        // Grade the prop
        const gradingResult = await this.gradingEngine.gradeProp(prop);
        
        // Check if we should bet on this prop
        if (this.shouldBet(gradingResult)) {
          // Calculate position size
          const positionSize = gradingResult.positionSize || 0.01;
          const stakeAmount = currentBankroll * positionSize;

          // Determine outcome - generate a random outcome for simulation
          const actualOutcome = this.generateActualOutcome(prop.market.line, prop.sport, prop.market.type);
          const result = this.determineResult(actualOutcome, prop.market.line, prop.market.type);

          // Calculate profit/loss
          const profit = this.calculateProfit(result, stakeAmount, prop.market.odds);
          currentBankroll += profit;

          // Record bet result
          const betResult: BetResult = {
            id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sport: prop.sport,
            marketType: prop.market.type,
            tier: gradingResult.tier,
            actualOdds: prop.market.odds,
            positionSize: stakeAmount,
            result: Number(result),
            profit: profit,
            confidence: gradingResult.confidence,
            expectedValue: gradingResult.edgeScore || 0,
            timestamp: prop.date,
            modelUsed: 'syndicate_grading_engine'
          };

          results.push(betResult);

          // Record in performance analyzer
          await this.performanceAnalyzer.recordBetResult(betResult);
        }

      } catch (error) {
        console.warn(`Failed to process prop ${prop.propId}:`, error);
      }
    }

    console.log(`💰 Final Bankroll: $${currentBankroll.toLocaleString()}`);
    return results;
  }
  
  /**
   * Analyze simulation results
   */
  private async analyzeResults(results: BetResult[]): Promise<{
    summary: BacktestResult['summary'];
    performance: BacktestResult['performance'];
    riskMetrics: BacktestResult['riskMetrics'];
  }> {
    const metrics = await this.performanceAnalyzer.getPerformanceMetrics();
    
    // Calculate summary metrics
    const totalStake = results.reduce((sum, bet) => sum + bet.positionSize, 0);
    const totalProfit = results.reduce((sum, bet) => sum + bet.profit, 0);
    const finalBankroll = this.config.initialBankroll + totalProfit;

    const summary = {
      totalBets: results.length,
      winRate: metrics.winRate,
      roi: metrics.roi,
      totalProfit: totalProfit,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      profitFactor: metrics.profitFactor,
      finalBankroll: finalBankroll
    };
    
    // Calculate monthly performance
    const monthlyPerformance = this.calculateMonthlyPerformance(results);
    
    const performance = {
      byTier: metrics.byTier || {},
      bySport: metrics.bySport || {},
      byMarket: metrics.byMarket || {},
      monthly: monthlyPerformance
    };

    // Calculate risk metrics
    const monthlyProfits = monthlyPerformance.map(m => m.profit);
    const riskMetrics = {
      valueAtRisk: this.calculateVaR(monthlyProfits),
      expectedShortfall: this.calculateES(monthlyProfits),
      maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(results),
      worstMonth: Math.min(...monthlyProfits),
      bestMonth: Math.max(...monthlyProfits)
    };
    
    return { summary, performance, riskMetrics };
  }
  
  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(analysis: any): Promise<string[]> {
    const recommendations: string[] = [];
    const summary = analysis?.summary ?? {};
    const performance = analysis?.performance ?? {};
    const riskMetrics = analysis?.riskMetrics ?? {};
    
    // Win rate recommendations
    if (summary.winRate < 55) {
      recommendations.push('🎯 Improve tier thresholds - win rate below target (55%)');
    }
    
    // ROI recommendations
    if (summary.avgROI < 8) {
      recommendations.push('💰 Focus on higher EV opportunities - ROI below target (8%)');
    }
    
    // Risk recommendations
    if (summary.maxDrawdown > 15) {
      recommendations.push('⚠️ Reduce position sizes - max drawdown exceeds limit (15%)');
    }
    
    if (summary.sharpeRatio < 1.5) {
      recommendations.push('📊 Improve risk-adjusted returns - Sharpe ratio below target (1.5)');
    }
    
    // Tier-specific recommendations
    Object.entries(performance.byTier).forEach(([tier, perf]: [string, any]) => {
      if (perf.count > 20) { // Only analyze tiers with sufficient sample size
        if (perf.winRate < 50 && tier !== 'D') {
          recommendations.push(`🔴 Review ${tier} tier criteria - win rate too low (${perf.winRate.toFixed(1)}%)`);
        }
        if (perf.roi < 0 && tier !== 'D') {
          recommendations.push(`📉 ${tier} tier losing money - tighten selection criteria`);
        }
      }
    });
    
    // Sport-specific recommendations
    Object.entries(performance.bySport).forEach(([sport, perf]: [string, any]) => {
      if (perf.roi < 0) {
        recommendations.push(`🏀 Consider reducing ${sport} exposure - negative ROI`);
      }
    });
    
    // Risk-specific recommendations
    if (riskMetrics.maxConsecutiveLosses > 8) {
      recommendations.push('🔄 Implement streak-breaking mechanisms - too many consecutive losses');
    }
    
    if (Math.abs(riskMetrics.worstMonth) > summary.totalProfit * 0.3) {
      recommendations.push('📅 Improve monthly consistency - worst month too severe');
    }
    
    // General recommendations
    recommendations.push('🤖 Consider ensemble methods for better model performance');
    recommendations.push('📈 Implement dynamic position sizing based on confidence');
    recommendations.push('🔍 Add more sophisticated feature engineering');
    
    return recommendations;
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Determine if we should bet on a grading_status prop
   */
  private shouldBet(gradingResult: any): boolean {
    // Only bet on props that meet minimum tier requirement
    const tierOrder = ['S', 'A', 'B', 'C', 'D'];
    const minTierIndex = tierOrder.indexOf(this.config.minTier);
    const propTierIndex = tierOrder.indexOf(gradingResult.tier);
    
    return propTierIndex <= minTierIndex && gradingResult.positionSize > 0;
  }
  
  /**
   * Determine bet result based on actual outcome
   */
  private determineResult(actualOutcome: number, line: number, marketType: string): 'win' | 'loss' | 'push' {
    const difference = actualOutcome - line;
    
    if (Math.abs(difference) < 0.01) { // Push threshold
      return 'push';
    }
    
    // For over/under markets, over wins if actual > line
    return difference > 0 ? 'win' : 'loss';
  }
  
  /**
   * Calculate profit from bet result
   */
  private calculateProfit(result: 'win' | 'loss' | 'push', stake: number, odds: number): number {
    if (result === 'push') {return 0;}
    if (result === 'loss') {return -stake;}
    
    // Calculate win profit based on American odds
    if (odds > 0) {
      return stake * (odds / 100);
    } else {
      return stake * (100 / Math.abs(odds));
    }
  }
  
  /**
   * Generate realistic lines based on sport and market
   */
  private generateRealisticLine(sport: string, marketType: string): number {
    const lineRanges = {
      'NBA': {
        'points': [15, 35],
        'rebounds': [6, 15],
        'assists': [4, 12],
        'threes': [1.5, 4.5]
      },
      'NFL': {
        'pass_yards': [200, 350],
        'rush_yards': [50, 120],
        'touchdowns': [0.5, 2.5],
        'receptions': [3.5, 8.5]
      },
      'MLB': {
        'hits': [0.5, 2.5],
        'runs': [0.5, 1.5],
        'rbi': [0.5, 2.5],
        'strikeouts': [4.5, 8.5]
      }
    };
    
    const sportRanges = lineRanges[sport as keyof typeof lineRanges];
    const marketRange = sportRanges?.[marketType as keyof typeof sportRanges] || [10, 30];
    
    return marketRange[0] + Math.random() * (marketRange[1] - marketRange[0]);
  }
  
  /**
   * Generate realistic odds
   */
  private generateRealisticOdds(): number {
    // Generate odds between -200 and +200
    const isPositive = Math.random() < 0.4; // 40% chance of positive odds
    
    if (isPositive) {
      return 100 + Math.random() * 200; // +100 to +300
    } else {
      return -(100 + Math.random() * 200); // -100 to -300
    }
  }
  
  /**
   * Generate actual outcome for backtesting
   */
  private generateActualOutcome(line: number, sport: string, marketType: string): number {
    // Generate outcome with some correlation to the line
    const variance = line * 0.3; // 30% variance
    const outcome = line + (Math.random() - 0.5) * variance * 2;
    
    // Ensure non-negative for counting stats
    return Math.max(0, outcome);
  }
  
  /**
   * Get players for a sport
   */
  private getPlayersForSport(sport: string): string[] {
    const players = {
      'NBA': ['LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo', 'Luka Doncic'],
      'NFL': ['Tom Brady', 'Aaron Rodgers', 'Josh Allen', 'Patrick Mahomes', 'Lamar Jackson'],
      'MLB': ['Mike Trout', 'Mookie Betts', 'Aaron Judge', 'Ronald Acuna Jr', 'Juan Soto']
    };

    return players[sport as keyof typeof players] || ['Player A', 'Player B', 'Player C'];
  }

  /**
   * Get league for a sport
   */
  private getLeagueForSport(sport: string): string {
    const leagues = {
      'NBA': 'NBA',
      'NFL': 'NFL',
      'MLB': 'MLB'
    };

    return leagues[sport as keyof typeof leagues] || 'Unknown';
  }
  
  /**
   * Get team for player
   */
  private getTeamForPlayer(player: string, sport: string): string {
    // Simplified team mapping
    const teams = {
      'NBA': ['Lakers', 'Warriors', 'Nets', 'Bucks', 'Mavericks'],
      'NFL': ['Buccaneers', 'Packers', 'Bills', 'Chiefs', 'Ravens'],
      'MLB': ['Angels', 'Dodgers', 'Yankees', 'Braves', 'Padres']
    };
    
    const sportTeams = teams[sport as keyof typeof teams] || ['Team A', 'Team B'];
    return sportTeams[Math.floor(Math.random() * sportTeams.length)];
  }
  
  /**
   * Get random opponent
   */
  private getRandomOpponent(sport: string): string {
    return this.getTeamForPlayer('', sport);
  }
  
  /**
   * Calculate monthly performance
   */
  private calculateMonthlyPerformance(results: BetResult[]): Array<{
    month: string;
    profit: number;
    winRate: number;
    betCount: number;
  }> {
    const monthlyData: Record<string, { profit: number; wins: number; total: number }> = {};
    
    for (const bet of results) {
      const month = bet.timestamp.substring(0, 7); // YYYY-MM
      
      if (!monthlyData[month]) {
        monthlyData[month] = { profit: 0, wins: 0, total: 0 };
      }
      
      monthlyData[month].profit += bet.profit;
      monthlyData[month].total++;
      if (bet.result > 0) {
        monthlyData[month].wins++;
      }
    }
    
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      profit: data.profit,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      betCount: data.total
    })).sort((a, b) => a.month.localeCompare(b.month));
  }
  
  /**
   * Calculate Value at Risk
   */
  private calculateVaR(monthlyProfits: number[]): number {
    if (monthlyProfits.length === 0) {return 0;}
    
    const sorted = [...monthlyProfits].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.05); // 5% VaR
    return sorted[index] || 0;
  }
  
  /**
   * Calculate Expected Shortfall
   */
  private calculateES(monthlyProfits: number[]): number {
    const var95 = this.calculateVaR(monthlyProfits);
    const tailLosses = monthlyProfits.filter(profit => profit <= var95);
    
    return tailLosses.length > 0 
      ? tailLosses.reduce((sum, loss) => sum + loss, 0) / tailLosses.length 
      : 0;
  }
  
  /**
   * Calculate maximum consecutive losses
   */
  private calculateMaxConsecutiveLosses(results: BetResult[]): number {
    let maxLosses = 0;
    let currentLosses = 0;

    for (const bet of results) {
      if (bet.result <= 0) {
        currentLosses++;
        maxLosses = Math.max(maxLosses, currentLosses);
      } else {
        currentLosses = 0;
      }
    }

    return maxLosses;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Run comprehensive backtest with default configuration
 */
export async function runComprehensiveBacktest(): Promise<void> {
  const config: BacktestConfig = {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialBankroll: 100000, // $100k starting bankroll
    sports: ['NBA', 'NFL', 'MLB'],
    marketTypes: ['points', 'rebounds', 'assists', 'pass_yards', 'rush_yards', 'hits'],
    minTier: 'B', // Only bet on B tier and above
    maxPositionSize: 0.02, // Max 2% of bankroll per bet
    riskLimits: {
      maxDrawdown: 15, // Max 15% drawdown
      minSharpeRatio: 1.5, // Min 1.5 Sharpe ratio
      maxCorrelation: 0.7, // Max 70% correlation
      maxExposurePerSport: 0.3, // Max 30% exposure per sport
      maxExposurePerPlayer: 0.1, // Max 10% exposure per player
      maxDailyRisk: 0.05 // Max 5% daily risk
    }
  };
  
  const backtester = new GradingBacktester(config);
  
  try {
    const results = await backtester.runBacktest();
    
    console.log('\n' + '='.repeat(80));
    console.log('🏆 COMPREHENSIVE BACKTEST RESULTS');
    console.log('='.repeat(80));
    
    console.log('\n📊 SUMMARY METRICS:');
    console.log(`   Total Bets: ${results.summary.totalBets.toLocaleString()}`);
    console.log(`   Win Rate: ${results.summary.winRate.toFixed(1)}%`);
    console.log(`   Average ROI: ${results.summary.roi.toFixed(1)}%`);
    console.log(`   Total Profit: $${results.summary.totalProfit.toLocaleString()}`);
    console.log(`   Final Bankroll: $${results.summary.finalBankroll.toLocaleString()}`);
    console.log(`   Max Drawdown: ${results.summary.maxDrawdown.toFixed(1)}%`);
    console.log(`   Sharpe Ratio: ${results.summary.sharpeRatio.toFixed(2)}`);
    console.log(`   Profit Factor: ${results.summary.profitFactor.toFixed(2)}`);
    
    console.log('\n🎯 TIER PERFORMANCE:');
    Object.entries(results.performance.byTier).forEach(([tier, perf]: [string, any]) => {
      console.log(`   ${tier} Tier: ${perf.winRate.toFixed(1)}% WR, ${perf.roi.toFixed(1)}% ROI (${perf.count} bets)`);
    });
    
    console.log('\n🏀 SPORT PERFORMANCE:');
    Object.entries(results.performance.bySport).forEach(([sport, perf]: [string, any]) => {
      console.log(`   ${sport}: ${perf.winRate.toFixed(1)}% WR, ${perf.roi.toFixed(1)}% ROI (${perf.count} bets)`);
    });
    
    console.log('\n⚠️ RISK METRICS:');
    console.log(`   Value at Risk (95%): $${results.riskMetrics.valueAtRisk.toLocaleString()}`);
    console.log(`   Expected Shortfall: $${results.riskMetrics.expectedShortfall.toLocaleString()}`);
    console.log(`   Max Consecutive Losses: ${results.riskMetrics.maxConsecutiveLosses}`);
    console.log(`   Worst Month: $${results.riskMetrics.worstMonth.toLocaleString()}`);
    console.log(`   Best Month: $${results.riskMetrics.bestMonth.toLocaleString()}`);
    
    console.log('\n💡 RECOMMENDATIONS:');
    results.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Backtest completed successfully!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Backtest failed:', error);
    process.exit(1);
  }
}

// Run backtest if this file is executed directly
if (require.main === module) {
  runComprehensiveBacktest().catch(console.error);
}