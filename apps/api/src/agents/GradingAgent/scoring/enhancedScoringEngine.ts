/**
 * Enhanced Scoring Engine
 * Implements professional capper analysis techniques based on capper insights analysis
 *
 * Key enhancements:
 * - Handedness split analysis (8% weight for MLB)
 * - Recent trend analysis (7% weight)
 * - Head-to-head historical performance (4% weight)
 * - Roster stability/chemistry impact (3% weight)
 * - Bullpen quality assessment (3% weight)
 * - Advanced situational splits (5% weight)
 */

import type {
  HandednessSplits,
  RecentTrends,
  HeadToHeadHistory,
  RosterStabilityData,
  BullpenQualityData,
  AdvancedSplits,
  EnhancedScoringWeights,
  EnhancedScoringResult,
  SportSpecificWeights,
  ContextualMultipliers,
  PerformanceMetrics,
} from './types/enhancedScoring';

// Export the types for external use
export type { EnhancedScoringResult };

export class EnhancedScoringEngine {
  private sportWeights: SportSpecificWeights;
  private contextualMultipliers: ContextualMultipliers;

  constructor() {
    this.sportWeights = this.initializeSportWeights();
    this.contextualMultipliers = this.initializeContextualMultipliers();
  }

  /**
   * Main enhanced scoring method
   */
  async calculateEnhancedScore(
    sport: string,
    playerData: any,
    gameContext: any,
    marketData: any
  ): Promise<EnhancedScoringResult> {
    const weights = this.sportWeights[sport as keyof SportSpecificWeights];
    if (!weights) {
      throw new Error(`Sport ${sport} not supported for enhanced scoring`);
    }

    // Calculate new enhanced components
    const handednessSplitsScore = await this.calculateHandednessSplitsScore(
      playerData,
      gameContext
    );
    const recentTrendsScore = await this.calculateRecentTrendsScore(playerData);
    const headToHeadScore = await this.calculateHeadToHeadScore(playerData, gameContext);
    const rosterStabilityScore = await this.calculateRosterStabilityScore(gameContext);
    const bullpenQualityScore = await this.calculateBullpenQualityScore(gameContext);
    const advancedSplitsScore = await this.calculateAdvancedSplitsScore(playerData, gameContext);

    // Apply contextual multipliers
    const contextMultiplier = this.getContextualMultiplier(gameContext);

    // Calculate weighted professional_score
    const enhancedScore =
      (handednessSplitsScore * weights.handednessSplits +
        recentTrendsScore * weights.recentTrendAnalysis +
        headToHeadScore * weights.headToHeadHistory +
        rosterStabilityScore * weights.rosterStabilityScore +
        bullpenQualityScore * weights.bullpenQualityScore +
        advancedSplitsScore * weights.advancedSplitAnalysis) *
      contextMultiplier;

    // Generate insights
    const result: EnhancedScoringResult = {
      handednessSplitsScore,
      recentTrendsScore,
      headToHeadScore,
      rosterStabilityScore,
      bullpenQualityScore,
      advancedSplitsScore,

      handednessAdvantage: this.determineHandednessAdvantage(handednessSplitsScore),
      trendMomentum: this.determineTrendMomentum(recentTrendsScore),
      historicalEdge: this.determineHistoricalEdge(headToHeadScore),
      teamStability: this.determineTeamStability(rosterStabilityScore),
      bullpenReliability: this.determineBullpenReliability(bullpenQualityScore),
      situationalEdge: this.determineSituationalEdge(advancedSplitsScore),

      enhancedScore,
      confidenceLevel: this.calculateConfidenceLevel(enhancedScore, [
        handednessSplitsScore,
        recentTrendsScore,
        headToHeadScore,
      ]),
      riskAssessment: this.assessRisk(enhancedScore, rosterStabilityScore),

      keyFactors: this.generateKeyFactors({
        handednessSplitsScore,
        recentTrendsScore,
        headToHeadScore,
        rosterStabilityScore,
        bullpenQualityScore,
        advancedSplitsScore,
      }),
      warnings: this.generateWarnings(rosterStabilityScore, bullpenQualityScore),
      recommendations: this.generateRecommendations(enhancedScore, {
        handednessAdvantage: this.determineHandednessAdvantage(handednessSplitsScore),
        trendMomentum: this.determineTrendMomentum(recentTrendsScore),
      }),
    };

    return result;
  }

  /**
   * Calculate handedness splits professional_score (8% weight for MLB)
   * Based on batter vs LHP/RHP and pitcher vs LHB/RHB performance
   */
  private async calculateHandednessSplitsScore(playerData: any, gameContext: any): Promise<number> {
    // Gracefully handle missing pitcher data
    const { player, opposingPitcher } = playerData || {};
    if (!opposingPitcher || !opposingPitcher.id) {
      // Return neutral professional_score when pitcher data unavailable
      return 50;
    }

    const pitcherHand = opposingPitcher?.throwing_hand || 'R';
    const batterHand = player?.batting_hand || 'R';

    let professional_score = 50; // Neutral baseline

    // Batter vs pitcher handedness analysis
    if (batterHand === 'L' && pitcherHand === 'L') {
      // Lefty vs lefty is generally tougher for batter
      professional_score -= 15;
    } else if (batterHand === 'R' && pitcherHand === 'L') {
      // Righty vs lefty can be advantageous
      professional_score += 10;
    } else if (batterHand === 'L' && pitcherHand === 'R') {
      // Lefty vs righty is often favorable
      professional_score += 12;
    }

    // Add historical splits data if available
    const batterSplits = await this.getBatterHandednessSplits(player.id);
    if (batterSplits) {
      const relevantSplit =
        pitcherHand === 'L' ? batterSplits.batterVsLHP : batterSplits.batterVsRHP;

      if (relevantSplit.ops > 0.8) professional_score += 20;
      else if (relevantSplit.ops > 0.75) professional_score += 10;
      else if (relevantSplit.ops < 0.65) professional_score -= 15;
      else if (relevantSplit.ops < 0.7) professional_score -= 8;
    }

    const pitcherSplits = await this.getPitcherHandednessSplits(opposingPitcher.id);
    if (pitcherSplits) {
      const relevantSplit =
        batterHand === 'L' ? pitcherSplits.pitcherVsLHB : pitcherSplits.pitcherVsRHB;

      if (relevantSplit.era < 3.0) professional_score -= 15;
      else if (relevantSplit.era < 3.5) professional_score -= 8;
      else if (relevantSplit.era > 4.5) professional_score += 15;
      else if (relevantSplit.era > 4.0) professional_score += 8;
    }

    return Math.max(0, Math.min(100, professional_score));
  }

  /**
   * Calculate recent trends professional_score (7% weight)
   * Based on performance over 3, 7, 15, 30 game windows
   */
  private async calculateRecentTrendsScore(playerData: any): Promise<number> {
    const trends = await this.getRecentTrends(playerData.player.id);
    if (!trends) return 50;

    let professional_score = 50;

    // Weight recent games more heavily (like cappers do)
    const last3Weight = 0.4;
    const last7Weight = 0.3;
    const last15Weight = 0.2;
    const last30Weight = 0.1;

    // Analyze hitting trends
    const last3Performance = this.normalizePerformance(trends.last3Games);
    const last7Performance = this.normalizePerformance(trends.last7Games);
    const last15Performance = this.normalizePerformance(trends.last15Games);
    const last30Performance = this.normalizePerformance(trends.last30Games);

    const trendScore =
      last3Performance * last3Weight +
      last7Performance * last7Weight +
      last15Performance * last15Weight +
      last30Performance * last30Weight;

    professional_score = 50 + trendScore * 50; // Convert to 0-100 scale

    // Apply trend direction bonus/penalty
    if (trends.trendDirection === 'improving') professional_score += 10;
    else if (trends.trendDirection === 'declining') professional_score -= 10;

    // Apply streak analysis (like cappers look for hot/cold streaks)
    if (trends.streakType === 'hitting' && trends.streakLength >= 5) professional_score += 15;
    else if (trends.streakType === 'cold' && trends.streakLength >= 5) professional_score -= 15;

    return Math.max(0, Math.min(100, professional_score));
  }

  /**
   * Calculate head-to-head professional_score (4% weight)
   * Based on historical player vs pitcher performance
   */
  private async calculateHeadToHeadScore(playerData: any, gameContext: any): Promise<number> {
    const h2h = await this.getHeadToHeadHistory(
      playerData.player.id,
      playerData.opposingPitcher?.id
    );

    if (!h2h || h2h.playerVsPitcher.atBats < 5) return 50;

    let professional_score = 50;
    const { playerVsPitcher } = h2h;

    // Historical performance analysis (key capper insight)
    if (playerVsPitcher.avg > 0.35) professional_score += 25;
    else if (playerVsPitcher.avg > 0.3) professional_score += 15;
    else if (playerVsPitcher.avg < 0.2) professional_score -= 20;
    else if (playerVsPitcher.avg < 0.25) professional_score -= 10;

    // Power analysis
    if (playerVsPitcher.homeRuns > 0 && playerVsPitcher.atBats <= 10) professional_score += 15;

    // Strikeout analysis
    const kRate = playerVsPitcher.strikeouts / playerVsPitcher.atBats;
    if (kRate < 0.15) professional_score += 10;
    else if (kRate > 0.35) professional_score -= 15;

    // Recent meetings matter more
    if (h2h.recentPerformance.length > 0) {
      const recentAvg =
        h2h.recentPerformance.reduce((sum, game) => sum + (game.avg || 0), 0) /
        h2h.recentPerformance.length;
      if (recentAvg > 0.4) professional_score += 10;
      else if (recentAvg < 0.2) professional_score -= 10;
    }

    return Math.max(0, Math.min(100, professional_score));
  }

  /**
   * Calculate roster stability professional_score (3% weight)
   * Based on recent trades, lineup changes, team chemistry
   */
  private async calculateRosterStabilityScore(gameContext: any): Promise<number> {
    const stability = await this.getRosterStabilityData(gameContext.team);
    if (!stability) return 50;

    let professional_score = stability.stabilityScore;

    // Trade deadline impact (key capper insight)
    if (stability.recentTrades.tradeDeadlineActivity) {
      const playersLost = stability.recentTrades.playersLost;
      if (playersLost >= 5)
        professional_score -= 25; // "Minnesota traded away ten players"
      else if (playersLost >= 3) professional_score -= 15;
      else if (playersLost >= 1) professional_score -= 8;
    }

    // Lineup chemistry
    if (stability.lineupChanges.consistencyScore < 60) professional_score -= 10;
    if (stability.chemistryIndicators.newPlayerIntegrationDays < 14) professional_score -= 8;

    return Math.max(0, Math.min(100, professional_score));
  }

  /**
   * Calculate bullpen quality professional_score (3% weight)
   * Based on bullpen strength and recent changes
   */
  private async calculateBullpenQualityScore(gameContext: any): Promise<number> {
    const bullpen = await this.getBullpenQualityData(gameContext.team);
    if (!bullpen) return 50;

    let professional_score = bullpen.qualityScore;

    // Recent bullpen changes impact (key capper insight)
    if (bullpen.recentChanges.tradedAway.length > 0) {
      professional_score -= bullpen.recentChanges.tradedAway.length * 8; // "traded two of their top relievers"
    }

    // Fatigue consideration
    if (bullpen.fatigueLevel > 80) professional_score -= 15;
    else if (bullpen.fatigueLevel > 70) professional_score -= 8;

    return Math.max(0, Math.min(100, professional_score));
  }

  /**
   * Calculate advanced splits professional_score (5% weight)
   * Based on monthly, park, weather, and situational performance
   */
  private async calculateAdvancedSplitsScore(playerData: any, gameContext: any): Promise<number> {
    const splits = await this.getAdvancedSplits(playerData.player.id);
    if (!splits) return 50;

    let professional_score = 50;

    // Monthly performance (key capper insight)
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const monthlyPerf = splits.monthly[currentMonth];
    if (monthlyPerf) {
      const monthScore = this.normalizePerformance(monthlyPerf);
      professional_score += monthScore * 20; // Monthly splits can be significant
    }

    // Park-specific performance
    const parkPerf = splits.parkSpecific[gameContext.venue];
    if (parkPerf) {
      const parkScore = this.normalizePerformance(parkPerf);
      professional_score += parkScore * 15;
    }

    // Weather considerations
    if (gameContext.weather?.temperature) {
      const temp = gameContext.weather.temperature;
      let weatherPerf;
      if (temp < 60) weatherPerf = splits.situational.temperature.cold;
      else if (temp > 80) weatherPerf = splits.situational.temperature.hot;
      else weatherPerf = splits.situational.temperature.moderate;

      if (weatherPerf) {
        const weatherScore = this.normalizePerformance(weatherPerf);
        professional_score += weatherScore * 10;
      }
    }

    return Math.max(0, Math.min(100, professional_score));
  }

  /**
   * Initialize sport-specific weights based on capper analysis
   */
  private initializeSportWeights(): SportSpecificWeights {
    return {
      MLB: {
        // NEW: Enhanced components based on capper insights
        handednessSplits: 0.08, // Major factor in MLB
        recentTrendAnalysis: 0.07, // Performance over recent games
        headToHeadHistory: 0.04, // Player vs player history
        rosterStabilityScore: 0.03, // Trade/chemistry impact
        bullpenQualityScore: 0.03, // Relief pitcher strength
        advancedSplitAnalysis: 0.05, // Monthly, park, situational splits

        // ADJUSTED: Core features (reduced to make room)
        expectedValue: 0.18, // Was 0.22
        lineMovement: 0.08, // Was 0.10
        matchupRating: 0.11, // Was 0.13
        playerForm: 0.07, // Was 0.09
        injuryImpact: 0.06, // Was 0.07
        weatherImpact: 0.04, // Increased for MLB

        // Market intelligence (slightly reduced)
        marketIntelligence: 0.12, // Was 0.15
        sharpMoney: 0.08, // Was 0.10
        volumeProfile: 0.06, // Was 0.07
        closingLineValue: 0.1, // Was 0.12

        // Professional features (maintained)
        steamDetection: 0.025,
        closingLinePrediction: 0.02,
        optimalTiming: 0.015,
        lineShoppingEdge: 0.015,
        publicVsSharpSplit: 0.02,
        marketTimingAdvantage: 0.01,
        injuryTimingEdge: 0.01,
        crossMarketDiscrepancy: 0.005,

        // Context (adjusted)
        playerFatigue: 0.04, // Was 0.05
        venueAdvantage: 0.05, // Increased for MLB park factors
        refereeImpact: 0.01, // Reduced for MLB (umpires less impact)
        paceImpact: 0.02, // Reduced for MLB
        motivationalFactors: 0.03, // Increased for rivalry/revenge games

        // Risk factors (maintained)
        correlationRisk: 0.09,
        volatility: 0.07,
        portfolioImpact: 0.1,

        // ML ensemble (slightly reduced)
        neuralNetwork: 0.15, // Was 0.18
        gradientBoosting: 0.18, // Was 0.22
        randomForest: 0.1, // Was 0.13
        ensemble: 0.22, // Was 0.27
      },

      // Other sports maintain current weights for now
      NBA: {} as EnhancedScoringWeights,
      NFL: {} as EnhancedScoringWeights,
      NHL: {} as EnhancedScoringWeights,
    };
  }

  /**
   * Initialize contextual multipliers
   */
  private initializeContextualMultipliers(): ContextualMultipliers {
    return {
      deadlineImpact: 1.2, // Trade deadline effects
      weatherGames: 1.5, // Weather impact on totals
      revengeGames: 1.1, // Motivational factors
      playoffRace: 1.3, // Late season implications
      rookieDebut: 1.4, // First-time situations
      streakSituations: 1.2, // Hot/cold streaks
    };
  }

  // Helper methods for scoring analysis
  private determineHandednessAdvantage(
    score: number
  ): 'strong' | 'moderate' | 'slight' | 'neutral' | 'disadvantage' {
    if (score >= 80) return 'strong';
    if (score >= 70) return 'moderate';
    if (score >= 60) return 'slight';
    if (score >= 40) return 'neutral';
    return 'disadvantage';
  }

  private determineTrendMomentum(score: number): 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' {
    if (score >= 80) return 'hot';
    if (score >= 65) return 'warm';
    if (score >= 35) return 'neutral';
    if (score >= 20) return 'cool';
    return 'cold';
  }

  private determineHistoricalEdge(
    score: number
  ): 'strong_batter' | 'slight_batter' | 'neutral' | 'slight_pitcher' | 'strong_pitcher' {
    if (score >= 75) return 'strong_batter';
    if (score >= 60) return 'slight_batter';
    if (score >= 40) return 'neutral';
    if (score >= 25) return 'slight_pitcher';
    return 'strong_pitcher';
  }

  private determineTeamStability(
    score: number
  ): 'very_stable' | 'stable' | 'moderate' | 'unstable' | 'very_unstable' {
    if (score >= 85) return 'very_stable';
    if (score >= 70) return 'stable';
    if (score >= 50) return 'moderate';
    if (score >= 30) return 'unstable';
    return 'very_unstable';
  }

  private determineBullpenReliability(
    score: number
  ): 'elite' | 'strong' | 'average' | 'weak' | 'poor' {
    if (score >= 85) return 'elite';
    if (score >= 70) return 'strong';
    if (score >= 50) return 'average';
    if (score >= 30) return 'weak';
    return 'poor';
  }

  private determineSituationalEdge(
    score: number
  ): 'strong' | 'moderate' | 'slight' | 'neutral' | 'negative' {
    if (score >= 75) return 'strong';
    if (score >= 65) return 'moderate';
    if (score >= 55) return 'slight';
    if (score >= 45) return 'neutral';
    return 'negative';
  }

  private calculateConfidenceLevel(enhancedScore: number, componentScores: number[]): number {
    // Higher confidence when multiple components agree
    const scoreVariance = this.calculateVariance(componentScores);
    const baseConfidence = enhancedScore;

    // Lower variance = higher confidence
    const variancePenalty = scoreVariance > 20 ? 10 : scoreVariance > 15 ? 5 : 0;

    return Math.max(0, Math.min(100, baseConfidence - variancePenalty));
  }

  private assessRisk(enhancedScore: number, stabilityScore: number): 'low' | 'medium' | 'high' {
    if (enhancedScore >= 70 && stabilityScore >= 60) return 'low';
    if (enhancedScore >= 50 && stabilityScore >= 40) return 'medium';
    return 'high';
  }

  private generateKeyFactors(scores: any): string[] {
    const factors: string[] = [];

    if (scores.handednessSplitsScore >= 70) factors.push('Favorable handedness matchup');
    if (scores.recentTrendsScore >= 75) factors.push('Player in excellent recent form');
    if (scores.headToHeadScore >= 70) factors.push('Strong historical vs opponent');
    if (scores.rosterStabilityScore <= 40) factors.push('Team roster disruption');
    if (scores.bullpenQualityScore <= 40) factors.push('Weakened bullpen');
    if (scores.advancedSplitsScore >= 70) factors.push('Favorable situational splits');

    return factors;
  }

  private generateWarnings(stabilityScore: number, bullpenScore: number): string[] {
    const warnings: string[] = [];

    if (stabilityScore <= 30) warnings.push('Significant roster instability - use caution');
    if (bullpenScore <= 30) warnings.push('Bullpen concerns may affect game length props');

    return warnings;
  }

  private generateRecommendations(score: number, context: any): string[] {
    const recommendations: string[] = [];

    if (score >= 75) recommendations.push('Strong play - consider higher confidence');
    else if (score <= 30) recommendations.push('Weak setup - consider avoiding');

    if (context.handednessAdvantage === 'strong') {
      recommendations.push('Leverage handedness advantage');
    }

    if (context.trendMomentum === 'hot') {
      recommendations.push('Player trending upward - good timing');
    }

    return recommendations;
  }

  // Data retrieval methods (to be implemented)
  private async getBatterHandednessSplits(playerId: string): Promise<HandednessSplits | null> {
    // TODO: Implement database query for batter splits
    return null;
  }

  private async getPitcherHandednessSplits(pitcherId: string): Promise<HandednessSplits | null> {
    // TODO: Implement database query for pitcher splits
    return null;
  }

  private async getRecentTrends(playerId: string): Promise<RecentTrends | null> {
    // TODO: Implement recent performance trends
    return null;
  }

  private async getHeadToHeadHistory(
    playerId: string,
    pitcherId: string
  ): Promise<HeadToHeadHistory | null> {
    // TODO: Implement head-to-head historical data
    return null;
  }

  private async getRosterStabilityData(team: string): Promise<RosterStabilityData | null> {
    // TODO: Implement roster stability analysis
    return null;
  }

  private async getBullpenQualityData(team: string): Promise<BullpenQualityData | null> {
    // TODO: Implement bullpen quality assessment
    return null;
  }

  private async getAdvancedSplits(playerId: string): Promise<AdvancedSplits | null> {
    // TODO: Implement advanced splits analysis
    return null;
  }

  private normalizePerformance(metrics: PerformanceMetrics): number {
    // TODO: Implement performance normalization
    return 0;
  }

  private getContextualMultiplier(gameContext: any): number {
    let multiplier = 1.0;

    if (gameContext.isTradeDeadline) multiplier *= this.contextualMultipliers.deadlineImpact;
    if (gameContext.hasSignificantWeather) multiplier *= this.contextualMultipliers.weatherGames;
    if (gameContext.isRevengeGame) multiplier *= this.contextualMultipliers.revengeGames;

    return multiplier;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
}

export const enhancedScoringEngine = new EnhancedScoringEngine();
