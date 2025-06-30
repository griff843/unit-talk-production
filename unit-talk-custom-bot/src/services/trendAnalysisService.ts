import { DatabaseService } from './database';

export interface PickData {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_under: 'over' | 'under';
  odds: number;
  result: 'win' | 'loss' | 'push';
  actual_value: number;
  confidence: number;
  created_at: string;
  pick_type: string;
  discord_id: string;
  stake: number;
  profit_loss: number;
}

export interface StreakAnalysis {
  player_name: string;
  stat_type: string;
  current_streak: number;
  streak_type: 'win' | 'loss';
  streak_probability: number;
  historical_win_rate: number;
  games_analyzed: number;
  confidence_score: number;
}

export interface TrendBreak {
  player_name: string;
  stat_type: string;
  line: number;
  over_under: 'over' | 'under';
  historical_hit_rate: number;
  recent_hit_rate: number;
  deviation_percentage: number;
  confidence_score: number;
  sample_size: number;
  trend_break_type: 'performance_decline' | 'performance_surge';
  reasoning: string;
}

export interface StatisticalOutlier {
  player_name: string;
  stat_type: string;
  current_line: number;
  historical_average: number;
  standard_deviation: number;
  z_score: number;
  outlier_type: 'high' | 'low';
  confidence_score: number;
  sample_size: number;
}

export interface RegressionAnalysis {
  player_name: string;
  stat_type: string;
  current_performance: number;
  expected_regression: number;
  regression_confidence: number;
  over_performance_streak: number;
  under_performance_streak: number;
}

export interface TrendAnalysisSummary {
  streaks: StreakAnalysis[];
  trend_breaks: TrendBreak[];
  statistical_outliers: StatisticalOutlier[];
  regression_candidates: RegressionAnalysis[];
  analysis_metadata: {
    total_picks_analyzed: number;
    date_range: {
      start: string;
      end: string;
    };
    confidence_threshold: number;
    min_sample_size: number;
  };
}

export class TrendAnalysisService {
  constructor(private databaseService: DatabaseService) {}

  /**
   * Perform comprehensive trend analysis on historical picks
   */
  async performTrendAnalysis(options: {
    days_back?: number;
    min_sample_size?: number;
    confidence_threshold?: number;
    sport_filter?: string;
  } = {}): Promise<TrendAnalysisSummary> {
    const {
      days_back = 30,
      min_sample_size = 5,
      confidence_threshold = 0.7,
      sport_filter
    } = options;

    try {
      // Get historical picks
      const picks = await this.getHistoricalPicks(days_back, sport_filter);
      
      if (!picks || picks.length === 0) {
        return this.createEmptyAnalysis(days_back, min_sample_size, confidence_threshold);
      }

      // Perform different types of analysis
      const streaks = await this.analyzeStreaks(picks, min_sample_size);
      const trendBreaks = await this.analyzeTrendBreaks(picks, min_sample_size);
      const statisticalOutliers = await this.analyzeStatisticalOutliers(picks, min_sample_size);
      const regressionCandidates = await this.analyzeRegressionToMean(picks, min_sample_size);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days_back);
      const endDate = new Date();

      return {
        streaks: streaks.filter(s => s.confidence_score >= confidence_threshold),
        trend_breaks: trendBreaks.filter(tb => tb.confidence_score >= confidence_threshold),
        statistical_outliers: statisticalOutliers.filter(so => so.confidence_score >= confidence_threshold),
        regression_candidates: regressionCandidates.filter(rc => rc.regression_confidence >= confidence_threshold),
        analysis_metadata: {
          total_picks_analyzed: picks.length,
          date_range: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          },
          confidence_threshold,
          min_sample_size
        }
      };
    } catch (error) {
      console.error('Error performing trend analysis:', error);
      return this.createEmptyAnalysis(days_back, min_sample_size, confidence_threshold);
    }
  }

  /**
   * Get historical picks from the database
   */
  private async getHistoricalPicks(daysBack: number, sportFilter?: string): Promise<PickData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    let query = this.databaseService.client
      .from('final_picks')
      .select(`
        id,
        player_name,
        stat_type,
        line,
        over_under,
        odds,
        result,
        actual_value,
        confidence,
        created_at,
        pick_type,
        discord_id,
        stake,
        profit_loss
      `)
      .gte('created_at', startDate.toISOString())
      .not('result', 'is', null)
      .not('player_name', 'is', null)
      .not('stat_type', 'is', null)
      .not('line', 'is', null)
      .not('actual_value', 'is', null)
      .order('created_at', { ascending: false });

    if (sportFilter) {
      query = query.ilike('pick_type', `%${sportFilter}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching historical picks:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Analyze winning/losing streaks for players and stat types
   */
  private async analyzeStreaks(picks: PickData[], minSampleSize: number): Promise<StreakAnalysis[]> {
    const streaks: StreakAnalysis[] = [];
    const groupedPicks = this.groupPicksByPlayerStat(picks);

    for (const [key, playerPicks] of groupedPicks.entries()) {
      if (playerPicks.length < minSampleSize) continue;

      const [playerName, statType] = key.split('|');
      const sortedPicks = playerPicks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate current streak
      let currentStreak = 0;
      let streakType: 'win' | 'loss' = 'win';
      
      if (sortedPicks.length > 0) {
        const firstResult = sortedPicks[0].result;
        if (firstResult === 'push') {
          continue; // Skip if most recent is a push
        }
        
        streakType = firstResult as 'win' | 'loss';
        
        for (const pick of sortedPicks) {
          if (pick.result === streakType) {
            currentStreak++;
          } else if (pick.result !== 'push') {
            break;
          }
        }
      }

      if (currentStreak >= 3) { // Only consider streaks of 3 or more
        const totalGames = sortedPicks.filter(p => p.result !== 'push').length;
        const wins = sortedPicks.filter(p => p.result === 'win').length;
        const historicalWinRate = wins / totalGames;
        
        const streakProbability = Math.pow(
          streakType === 'win' ? historicalWinRate : (1 - historicalWinRate),
          currentStreak
        );

        const confidenceScore = this.calculateStreakConfidence(currentStreak, streakProbability, totalGames);

        streaks.push({
          player_name: playerName,
          stat_type: statType,
          current_streak: currentStreak,
          streak_type: streakType,
          streak_probability: streakProbability,
          historical_win_rate: historicalWinRate,
          games_analyzed: totalGames,
          confidence_score: confidenceScore
        });
      }
    }

    return streaks.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  /**
   * Analyze trend breaks - when recent performance significantly differs from historical
   */
  private async analyzeTrendBreaks(picks: PickData[], minSampleSize: number): Promise<TrendBreak[]> {
    const trendBreaks: TrendBreak[] = [];
    const groupedPicks = this.groupPicksByPlayerStat(picks);

    for (const [key, playerPicks] of groupedPicks.entries()) {
      if (playerPicks.length < minSampleSize) continue;

      const [playerName, statType] = key.split('|');
      const sortedPicks = playerPicks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Split into recent (last 25%) and historical (rest)
      const recentCount = Math.max(3, Math.floor(sortedPicks.length * 0.25));
      const recentPicks = sortedPicks.slice(0, recentCount);
      const historicalPicks = sortedPicks.slice(recentCount);

      if (historicalPicks.length < minSampleSize) continue;

      const recentWins = recentPicks.filter(p => p.result === 'win').length;
      const recentTotal = recentPicks.filter(p => p.result !== 'push').length;
      const recentHitRate = recentTotal > 0 ? recentWins / recentTotal : 0;

      const historicalWins = historicalPicks.filter(p => p.result === 'win').length;
      const historicalTotal = historicalPicks.filter(p => p.result !== 'push').length;
      const historicalHitRate = historicalTotal > 0 ? historicalWins / historicalTotal : 0;

      const deviationPercentage = Math.abs((recentHitRate - historicalHitRate) / historicalHitRate) * 100;

      if (deviationPercentage >= 25) { // Significant deviation threshold
        const trendBreakType: 'performance_decline' | 'performance_surge' =
          recentHitRate < historicalHitRate ? 'performance_decline' : 'performance_surge';

        const confidenceScore = this.calculateTrendBreakConfidence(deviationPercentage, recentTotal, historicalTotal);
        const mostCommonLine = this.getMostCommonLine(playerPicks);
        const mostCommonOverUnder = this.getMostCommonOverUnder(playerPicks);

        trendBreaks.push({
          player_name: playerName,
          stat_type: statType,
          line: mostCommonLine,
          over_under: mostCommonOverUnder,
          historical_hit_rate: historicalHitRate,
          recent_hit_rate: recentHitRate,
          deviation_percentage: deviationPercentage,
          confidence_score: confidenceScore,
          sample_size: sortedPicks.length,
          trend_break_type: trendBreakType,
          reasoning: `Recent ${recentCount} games show ${deviationPercentage.toFixed(1)}% ${trendBreakType.replace('_', ' ')} vs historical average`
        });
      }
    }

    return trendBreaks.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  /**
   * Analyze statistical outliers using z-score analysis
   */
  private async analyzeStatisticalOutliers(picks: PickData[], minSampleSize: number): Promise<StatisticalOutlier[]> {
    const outliers: StatisticalOutlier[] = [];
    const groupedPicks = this.groupPicksByPlayerStat(picks);

    for (const [key, playerPicks] of groupedPicks.entries()) {
      if (playerPicks.length < minSampleSize) continue;

      const [playerName, statType] = key.split('|');
      const lines = playerPicks.map(p => p.line);
      
      const mean = lines.reduce((sum, line) => sum + line, 0) / lines.length;
      const variance = lines.reduce((sum, line) => sum + Math.pow(line - mean, 2), 0) / lines.length;
      const standardDeviation = Math.sqrt(variance);

      if (standardDeviation === 0) continue; // No variation in lines

      // Check most recent line for outlier status
      const sortedPicks = playerPicks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const currentLine = sortedPicks[0].line;
      const zScore = Math.abs(currentLine - mean) / standardDeviation;

      if (zScore >= 2) { // 2+ standard deviations = outlier
        const outlierType: 'high' | 'low' = currentLine > mean ? 'high' : 'low';
        const confidenceScore = Math.min(0.95, zScore / 4); // Cap at 95% confidence

        outliers.push({
          player_name: playerName,
          stat_type: statType,
          current_line: currentLine,
          historical_average: mean,
          standard_deviation: standardDeviation,
          z_score: zScore,
          outlier_type: outlierType,
          confidence_score: confidenceScore,
          sample_size: playerPicks.length
        });
      }
    }

    return outliers.sort((a, b) => b.z_score - a.z_score);
  }

  /**
   * Analyze regression to mean candidates
   */
  private async analyzeRegressionToMean(picks: PickData[], minSampleSize: number): Promise<RegressionAnalysis[]> {
    const regressionCandidates: RegressionAnalysis[] = [];
    const groupedPicks = this.groupPicksByPlayerStat(picks);

    for (const [key, playerPicks] of groupedPicks.entries()) {
      if (playerPicks.length < minSampleSize) continue;

      const [playerName, statType] = key.split('|');
      const sortedPicks = playerPicks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Calculate recent performance vs expected
      const recentCount = Math.min(5, Math.floor(sortedPicks.length * 0.3));
      const recentPicks = sortedPicks.slice(0, recentCount);
      
      const recentPerformance = recentPicks.map(p => {
        const target = p.over_under === 'over' ? p.line : -p.line;
        const actual = p.over_under === 'over' ? p.actual_value : -p.actual_value;
        return actual - target;
      });

      const avgRecentPerformance = recentPerformance.reduce((sum, perf) => sum + perf, 0) / recentPerformance.length;
      
      // Calculate historical average performance
      const historicalPicks = sortedPicks.slice(recentCount);
      const historicalPerformance = historicalPicks.map(p => {
        const target = p.over_under === 'over' ? p.line : -p.line;
        const actual = p.over_under === 'over' ? p.actual_value : -p.actual_value;
        return actual - target;
      });

      const avgHistoricalPerformance = historicalPerformance.length > 0 
        ? historicalPerformance.reduce((sum, perf) => sum + perf, 0) / historicalPerformance.length 
        : 0;

      // Check for significant over/under performance
      const performanceDiff = Math.abs(avgRecentPerformance - avgHistoricalPerformance);
      
      if (performanceDiff >= 1.5) { // Significant performance difference
        let overPerformanceStreak = 0;
        let underPerformanceStreak = 0;

        // Count consecutive over/under performances
        for (const perf of recentPerformance) {
          if (perf > avgHistoricalPerformance + 0.5) {
            overPerformanceStreak++;
          } else if (perf < avgHistoricalPerformance - 0.5) {
            underPerformanceStreak++;
          } else {
            break;
          }
        }

        const regressionConfidence = Math.min(0.9, performanceDiff / 5); // Cap at 90%

        regressionCandidates.push({
          player_name: playerName,
          stat_type: statType,
          current_performance: avgRecentPerformance,
          expected_regression: avgHistoricalPerformance,
          regression_confidence: regressionConfidence,
          over_performance_streak: overPerformanceStreak,
          under_performance_streak: underPerformanceStreak
        });
      }
    }

    return regressionCandidates.sort((a, b) => b.regression_confidence - a.regression_confidence);
  }

  /**
   * Group picks by player and stat type
   */
  private groupPicksByPlayerStat(picks: PickData[]): Map<string, PickData[]> {
    const grouped = new Map<string, PickData[]>();
    
    for (const pick of picks) {
      const key = `${pick.player_name}|${pick.stat_type}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(pick);
    }
    
    return grouped;
  }

  /**
   * Calculate confidence score for streaks
   */
  private calculateStreakConfidence(streakLength: number, probability: number, sampleSize: number): number {
    const rarityScore = Math.max(0, 1 - probability * 10); // Lower probability = higher rarity
    const lengthScore = Math.min(1, streakLength / 10); // Longer streaks = higher score
    const sampleScore = Math.min(1, sampleSize / 20); // More data = higher confidence
    
    return (rarityScore * 0.5 + lengthScore * 0.3 + sampleScore * 0.2);
  }

  /**
   * Calculate confidence score for trend breaks
   */
  private calculateTrendBreakConfidence(deviationPercentage: number, recentSampleSize: number, historicalSampleSize: number): number {
    const deviationScore = Math.min(1, deviationPercentage / 100);
    const recentSampleScore = Math.min(1, recentSampleSize / 10);
    const historicalSampleScore = Math.min(1, historicalSampleSize / 20);
    
    return (deviationScore * 0.6 + recentSampleScore * 0.2 + historicalSampleScore * 0.2);
  }

  /**
   * Get the most common line for a set of picks
   */
  private getMostCommonLine(picks: PickData[]): number {
    const lineCounts = new Map<number, number>();
    
    for (const pick of picks) {
      lineCounts.set(pick.line, (lineCounts.get(pick.line) || 0) + 1);
    }
    
    let mostCommonLine = picks[0].line;
    let maxCount = 0;
    
    for (const [line, count] of lineCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonLine = line;
      }
    }
    
    return mostCommonLine;
  }

  /**
   * Get the most common over/under for a set of picks
   */
  private getMostCommonOverUnder(picks: PickData[]): 'over' | 'under' {
    const overCount = picks.filter(p => p.over_under === 'over').length;
    const underCount = picks.filter(p => p.over_under === 'under').length;
    
    return overCount >= underCount ? 'over' : 'under';
  }

  /**
   * Create empty analysis structure
   */
  private createEmptyAnalysis(daysBack: number, minSampleSize: number, confidenceThreshold: number): TrendAnalysisSummary {
    return {
      streaks: [],
      trend_breaks: [],
      statistical_outliers: [],
      regression_candidates: [],
      analysis_metadata: {
        total_picks_analyzed: 0,
        date_range: {
          start: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        confidence_threshold: confidenceThreshold,
        min_sample_size: minSampleSize
      }
    };
  }
}