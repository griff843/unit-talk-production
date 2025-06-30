import { SupabaseService } from './supabase';
import { 
  UserPickSubmission, 
  GradingResult, 
  GradingFactor, 
  BettingAnalysis, 
  CoachingRecommendation,
  RiskAssessment,
  UserTier 
} from '../types';
import { logger } from '../utils/logger';

export class PickGradingService {
  private supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  /**
   * Grade a user-submitted pick using advanced algorithms
   */
  async gradeUserPick(pickSubmission: UserPickSubmission): Promise<GradingResult> {
    try {
      logger.info(`Grading pick for user ${pickSubmission.userId}: ${pickSubmission.description}`);

      // Extract key factors for grading
      const factors = await this.extractGradingFactors(pickSubmission);
      
      // Calculate edge using multiple algorithms
      const edge = await this.calculateEdge(pickSubmission, factors);

      // Determine tier based on edge and confidence
      const tier = this.determineTier(edge, pickSubmission.confidence || 50);

      // Calculate overall confidence score
      const confidence = this.calculateConfidence(factors);

      // Generate feedback and coaching notes
      const feedback = await this.generateFeedback(pickSubmission, factors, edge);
      const coachNotes = await this.generateCoachingNotes(pickSubmission, factors);

      // Identify improvement areas
      const improvementAreas = this.identifyImprovementAreas(factors);

      const result: GradingResult = {
        pick_id: pickSubmission.id || 'temp-id',
        pickId: pickSubmission.id || 'temp-id',
        status: 'won', // This will be updated when the pick is settled
        actual_result: 'pending',
        expected_value: edge,
        profit_loss: 0, // Will be calculated when settled
        grade: tier as 'S' | 'A' | 'B' | 'C' | 'D' | 'F',
        edge,
        tier,
        confidence,
        factors,
        feedback: typeof feedback === 'string' ? feedback : JSON.stringify(feedback), // Convert object to string
        reasoning: coachNotes,
        risk_assessment: confidence > 80 ? 'low' : confidence > 60 ? 'medium' : 'high',
        created_at: new Date()
      };

      // Save grading result
      await this.saveGradingResult(result);

      logger.info(`Pick graded successfully: Edge ${edge}%, Tier ${tier}, Confidence ${confidence}%`);
      return result;

    } catch (error) {
      logger.error('Failed to grade pick:', error);
      throw error;
    }
  }

  /**
   * Extract grading factors from pick submission
   */
  private async extractGradingFactors(pick: UserPickSubmission): Promise<GradingFactor[]> {
    const factors: GradingFactor[] = [];

    // Odds analysis
    const oddsValue = pick.odds ? parseFloat(pick.odds) : 0;
    const oddsAnalysis = this.analyzeOdds(oddsValue);
    factors.push({
      name: 'Odds Value',
      category: 'value',
      weight: 0.25,
      score: oddsAnalysis.score,
      description: oddsAnalysis.description
    });

    // Market analysis (if available)
    const marketData = await this.getMarketData(pick.description || '');
    if (marketData) {
      factors.push({
        name: 'Market Movement',
        category: 'market',
        weight: 0.20,
        score: marketData.favorability,
        description: `Line moved ${marketData.movement > 0 ? 'favorably' : 'unfavorably'} by ${Math.abs(marketData.movement)} points`
      });
    }

    // Timing analysis
    const timingAnalysis = this.analyzePickTiming(pick);
    factors.push({
      name: 'Pick Timing',
      category: 'timing',
      weight: 0.15,
      score: timingAnalysis.score,
      description: timingAnalysis.timing
    });

    // Historical performance
    const userHistory = await this.getUserHistoricalPerformance(pick.userId || '', pick.description || '');
    factors.push({
      name: 'User Track Record',
      category: 'history',
      weight: 0.25,
      score: userHistory.score,
      description: userHistory.description
    });

    // Risk assessment
    const riskAssessment = this.assessPickRisk(pick);
    factors.push({
      name: 'Risk Level',
      category: 'risk',
      weight: 0.15,
      score: riskAssessment.level === 'high' ? 30 : riskAssessment.level === 'medium' ? 15 : 5,
      description: `Risk level assessed as ${riskAssessment.level}`
    });

    return factors;
  }

  /**
   * Calculate edge using weighted factor analysis
   */
  private async calculateEdge(pick: UserPickSubmission, factors: GradingFactor[]): Promise<number> {
    let weightedScore = 0;
    let totalWeight = 0;

    factors.forEach(factor => {
      weightedScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    });

    const baseEdge = (weightedScore / totalWeight) - 50; // Normalize to edge percentage

    // Apply confidence multiplier
    const confidenceMultiplier = (pick.confidence || 50) / 10;
    const adjustedEdge = baseEdge * confidenceMultiplier;

    // Apply unit size penalty for oversized bets
    const unitPenalty = (pick.units || 1) > 3 ? Math.max(0.8, 1 - ((pick.units || 1) - 3) * 0.1) : 1;

    return Math.round(adjustedEdge * unitPenalty * 100) / 100;
  }

  /**
   * Determine pick tier based on edge and confidence
   */
  private determineTier(edge: number, confidence: number): string {
    if (edge >= 8 && confidence >= 9) return 'Elite';
    if (edge >= 5 && confidence >= 8) return 'Premium';
    if (edge >= 3 && confidence >= 7) return 'Strong';
    if (edge >= 1 && confidence >= 6) return 'Good';
    if (edge >= 0) return 'Fair';
    return 'Avoid';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(factors: GradingFactor[]): number {
    const avgScore = factors.reduce((sum, factor) => sum + factor.score, 0) / factors.length;
    const consistency = this.calculateConsistency(factors);
    
    return Math.round((avgScore * 0.7 + consistency * 0.3) * 100) / 100;
  }

  /**
   * Calculate consistency score across factors
   */
  private calculateConsistency(factors: GradingFactor[]): number {
    const scores = factors.map(f => f.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency
    return Math.max(0, 100 - standardDeviation * 2);
  }

  /**
   * Generate detailed feedback for the pick
   */
  private async generateFeedback(
    pick: UserPickSubmission, 
    factors: GradingFactor[], 
    edge: number
  ): Promise<string> {
    let feedback = `**Pick Analysis Summary:**\n\n`;

    // Overall assessment
    if (edge >= 5) {
      feedback += `✅ **Strong Pick** - This shows excellent edge potential (${edge}%)\n\n`;
    } else if (edge >= 2) {
      feedback += `⚠️ **Decent Pick** - Moderate edge identified (${edge}%)\n\n`;
    } else if (edge >= 0) {
      feedback += `🔶 **Marginal Pick** - Limited edge (${edge}%)\n\n`;
    } else {
      feedback += `❌ **Avoid** - Negative edge detected (${edge}%)\n\n`;
    }

    // Factor breakdown
    feedback += `**Key Factors:**\n`;
    factors.forEach(factor => {
      const emoji = factor.score >= 70 ? '✅' : factor.score >= 50 ? '⚠️' : '❌';
      feedback += `${emoji} ${factor.name}: ${Math.round(factor.score)}% - ${factor.description}\n`;
    });

    // Unit size assessment
    if ((pick.units || 0) > 3) {
      feedback += `\n⚠️ **Unit Size Warning**: ${pick.units} units is aggressive. Consider reducing to 1-3 units for better bankroll management.\n`;
    }

    // Confidence vs edge alignment
    const confidenceEdgeGap = Math.abs((pick.confidence || 0) * 10 - (edge + 50));
    if (confidenceEdgeGap > 20) {
      feedback += `\n🎯 **Calibration Note**: Your confidence (${pick.confidence || 0}/10) doesn't align with calculated edge. Consider adjusting your confidence assessment.\n`;
    }

    return feedback;
  }

  /**
   * Generate personalized coaching notes
   */
  private async generateCoachingNotes(
    pick: UserPickSubmission, 
    factors: GradingFactor[]
  ): Promise<string> {
    const userStats = await this.getUserStats(pick.userId);
    let notes = `**Coaching Notes:**\n\n`;

    // Identify strengths
    const strongFactors = factors.filter(f => f.score >= 70);
    if (strongFactors.length > 0) {
      notes += `**Strengths:**\n`;
      strongFactors.forEach(factor => {
        notes += `• Strong ${factor.name.toLowerCase()} analysis\n`;
      });
      notes += `\n`;
    }

    // Identify areas for improvement
    const weakFactors = factors.filter(f => f.score < 50);
    if (weakFactors.length > 0) {
      notes += `**Areas to Improve:**\n`;
      weakFactors.forEach(factor => {
        notes += `• Focus more on ${factor.name.toLowerCase()}\n`;
      });
      notes += `\n`;
    }

    // Personalized recommendations based on user history
    if (userStats) {
      if (userStats.avgUnits > 2.5) {
        notes += `• Consider reducing average unit size (currently ${userStats.avgUnits})\n`;
      }
      
      if (userStats.winRate < 0.55) {
        notes += `• Focus on higher-edge opportunities to improve win rate\n`;
      }

      if (userStats.recentStreak < -3) {
        notes += `• Take a break or reduce unit sizes during cold streaks\n`;
      }
    }

    return notes;
  }

  /**
   * Identify specific improvement areas
   */
  private identifyImprovementAreas(factors: GradingFactor[]): string[] {
    const improvements: string[] = [];
    
    factors.forEach(factor => {
      if (factor.score < 50) {
        switch (factor.name) {
          case 'Odds Value':
            improvements.push('Line shopping and odds comparison');
            break;
          case 'Market Movement':
            improvements.push('Tracking line movement and market sentiment');
            break;
          case 'Historical Edge':
            improvements.push('Research historical matchup data');
            break;
          case 'Sharp Money':
            improvements.push('Following professional betting patterns');
            break;
          case 'Contextual Factors':
            improvements.push('Injury reports and weather analysis');
            break;
          case 'Personal History':
            improvements.push('Self-awareness of betting patterns');
            break;
        }
      }
    });

    return improvements;
  }

  /**
   * Analyze odds value and return score with description
   */
  private analyzeOdds(odds: number): { score: number; description: string } {
    // Convert American odds to implied probability
    let impliedProb: number;
    if (odds > 0) {
      impliedProb = 100 / (odds + 100);
    } else {
      impliedProb = Math.abs(odds) / (Math.abs(odds) + 100);
    }

    // Score based on value (lower implied probability = better value for positive odds)
    let score: number;
    let description: string;

    if (odds > 200) {
      score = 85; // High value underdog
      description = `Strong value at +${odds} odds (${(impliedProb * 100).toFixed(1)}% implied)`;
    } else if (odds > 100) {
      score = 70; // Moderate value underdog
      description = `Good value at +${odds} odds (${(impliedProb * 100).toFixed(1)}% implied)`;
    } else if (odds > -110) {
      score = 60; // Pick'em or slight favorite
      description = `Fair value at ${odds} odds (${(impliedProb * 100).toFixed(1)}% implied)`;
    } else if (odds > -200) {
      score = 45; // Moderate favorite
      description = `Limited value at ${odds} odds (${(impliedProb * 100).toFixed(1)}% implied)`;
    } else {
      score = 25; // Heavy favorite
      description = `Poor value at ${odds} odds (${(impliedProb * 100).toFixed(1)}% implied)`;
    }

    return { score, description };
  }

  /**
   * Get market data for analysis
   */
  private async getMarketData(description: string): Promise<{ favorability: number; movement: number } | null> {
    // Mock implementation - in real scenario would fetch from odds API
    return {
      favorability: Math.random() * 100,
      movement: (Math.random() - 0.5) * 10
    };
  }

  /**
   * Get historical performance data
   */
  private async getHistoricalPerformance(description: string): Promise<any> {
    // This would query your historical database
    // Placeholder implementation
    return {
      winRate: 0.52 + (Math.random() - 0.5) * 0.2,
      sampleSize: Math.floor(Math.random() * 100) + 20
    };
  }

  /**
   * Analyze sharp money indicators
   */
  private async analyzeSharpMoney(description: string): Promise<{ score: number; description: string }> {
    // This would integrate with sharp money tracking
    // Placeholder implementation
    const sharpPercentage = Math.random() * 100;
    
    return {
      score: sharpPercentage,
      description: `${sharpPercentage.toFixed(0)}% of sharp money on this side`
    };
  }

  /**
   * Analyze contextual factors
   */
  private async analyzeContextualFactors(description: string): Promise<{ score: number; description: string }> {
    // This would analyze injuries, weather, etc.
    // Placeholder implementation
    const factors = ['No significant injuries', 'Weather favorable', 'Rest advantage'];
    const score = 60 + Math.random() * 30;
    
    return {
      score,
      description: factors.join(', ')
    };
  }

  /**
   * Get user's historical performance on similar picks
   */
  private async getUserHistoricalPerformance(userId: string, description: string): Promise<{ score: number; description: string }> {
    try {
      const { data: userPicks } = await this.supabaseService.client
        .from('user_picks')
        .select('result')
        .eq('user_id', userId)
        .not('result', 'is', null)
        .limit(20);

      if (!userPicks || userPicks.length === 0) {
        return {
          score: 50,
          description: 'No historical data available'
        };
      }

      const wins = userPicks.filter(pick => pick.result === 'win').length;
      const winRate = wins / userPicks.length;
      const score = winRate * 100;

      return {
        score,
        description: `${wins}/${userPicks.length} similar picks won (${(winRate * 100).toFixed(1)}%)`
      };
    } catch (error) {
      return {
        score: 50,
        description: 'Unable to analyze historical performance'
      };
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(userId: string): Promise<any> {
    try {
      const { data: stats } = await this.supabaseService.client
        .from('user_profiles')
        .select('stats')
        .eq('discord_id', userId)
        .single();

      return stats?.stats;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save grading result to database
   */
  private async saveGradingResult(result: GradingResult): Promise<void> {
    try {
      await this.supabaseService.client
        .from('pick_gradings')
        .insert({
          pick_id: result.pickId,
          edge: result.edge,
          tier: result.tier,
          confidence: result.confidence,
          factors: result.factors,
          feedback: result.feedback,
          coach_notes: result.coachNotes,
          improvement_areas: result.improvementAreas,
          graded_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to save grading result:', error);
    }
  }

  /**
   * Update pick result when game completes
   */
  async updatePickResult(pickId: string, result: 'win' | 'loss' | 'push'): Promise<void> {
    try {
      await this.supabaseService.client
        .from('user_picks')
        .update({
          result,
          graded_at: new Date().toISOString()
        })
        .eq('id', pickId);

      // Update user stats
      await this.updateUserStats(pickId, result);

    } catch (error) {
      logger.error('Failed to update pick result:', error);
    }
  }

  /**
   * Update user statistics after pick result
   */
  private async updateUserStats(pickId: string, result: 'win' | 'loss' | 'push'): Promise<void> {
    try {
      // Get pick details
      const { data: pick } = await this.supabaseService.client
        .from('user_picks')
        .select('user_id, units')
        .eq('id', pickId)
        .single();

      if (!pick) return;

      // Calculate profit/loss
      let profitLoss = 0;
      if (result === 'win') {
        profitLoss = pick.units; // Simplified - would use actual odds
      } else if (result === 'loss') {
        profitLoss = -pick.units;
      }

      // Update user profile stats
      await this.supabaseService.client.rpc('update_user_stats', {
        user_discord_id: pick.user_id,
        pick_result: result,
        units_change: profitLoss
      });

    } catch (error) {
      logger.error('Failed to update user stats:', error);
    }
  }
}

export class CoachingService {
  private supabaseService: SupabaseService;
  private gradingService: PickGradingService;

  constructor(supabaseService: SupabaseService, gradingService: PickGradingService) {
    this.supabaseService = supabaseService;
    this.gradingService = gradingService;
  }

  /**
   * Generate personalized betting analysis and coaching
   */
  async generateBettingAnalysis(userId: string, period: string = '30d'): Promise<BettingAnalysis> {
    try {
      const userPicks = await this.getUserPicks(userId, period);
      const analysis = this.analyzeBettingPatterns(userPicks);
      const recommendations = await this.generateRecommendations(userId, analysis);
      const riskAssessmentObj = this.assessRisk(analysis);
      const riskAssessment = typeof riskAssessmentObj === 'string' ? riskAssessmentObj : riskAssessmentObj.level;

      return {
        userId,
        period,
        totalBets: analysis.totalBets,
        winRate: analysis.winRate,
        profitLoss: analysis.profitLoss,
        avgOdds: analysis.avgOdds,
        avgUnits: analysis.avgUnits,
        avgEdge: analysis.avgEdge || 0,
        sportBreakdown: analysis.sportBreakdown,
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        trends: analysis.trends || [],
        recommendations,
        riskAssessment,
        edge: analysis.avgEdge || 0,
        confidence: analysis.confidence || 0.5,
        factors: analysis.factors || {},
        riskLevel: riskAssessment
      };
    } catch (error) {
      logger.error('Failed to generate betting analysis:', error);
      throw error;
    }
  }

  /**
   * Get user picks for analysis period
   */
  private async getUserPicks(userId: string, period: string): Promise<any[]> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: picks } = await this.supabaseService.client
      .from('user_picks')
      .select('*')
      .eq('user_id', userId)
      .gte('submitted_at', cutoffDate.toISOString())
      .order('submitted_at', { ascending: false });

    return picks || [];
  }

  /**
   * Analyze betting patterns
   */
  private analyzeBettingPatterns(picks: any[]): any {
    const totalBets = picks.length;
    const completedPicks = picks.filter(p => p.result && p.result !== 'pending');
    const wins = completedPicks.filter(p => p.result === 'win').length;
    const winRate = completedPicks.length > 0 ? wins / completedPicks.length : 0;
    
    const profitLoss = completedPicks.reduce((sum, pick) => {
      if (pick.result === 'win') return sum + pick.units;
      if (pick.result === 'loss') return sum - pick.units;
      return sum;
    }, 0);

    const avgUnits = picks.reduce((sum, pick) => sum + pick.units, 0) / totalBets;
    const avgOdds = picks.reduce((sum, pick) => sum + Math.abs(pick.odds || 0), 0) / totalBets;

    // Sport breakdown
    const sportBreakdown: Record<string, any> = {};
    picks.forEach(pick => {
      const sport = this.extractSport(pick.description);
      if (!sportBreakdown[sport]) {
        sportBreakdown[sport] = { count: 0, wins: 0, units: 0 };
      }
      sportBreakdown[sport].count++;
      if (pick.result === 'win') sportBreakdown[sport].wins++;
      sportBreakdown[sport].units += pick.result === 'win' ? pick.units : 
                                     pick.result === 'loss' ? -pick.units : 0;
    });

    return {
      totalBets,
      winRate,
      profitLoss,
      avgOdds,
      avgUnits,
      sportBreakdown
    };
  }

  /**
   * Generate personalized recommendations
   */
  private async generateRecommendations(userId: string, analysis: any): Promise<CoachingRecommendation[]> {
    const recommendations: CoachingRecommendation[] = [];

    // Bankroll management
    if (analysis.avgUnits > 3) {
      recommendations.push({
        id: `rec_${Date.now()}_1`,
        type: 'bankroll',
        category: 'bankroll',
        priority: 'high',
        title: 'Reduce Unit Sizes',
        description: `Your average bet size (${analysis.avgUnits.toFixed(1)} units) is too aggressive for optimal bankroll management.`,
        actionItems: [
          'Limit individual bets to 1-3 units maximum',
          'Reserve 5+ unit bets for only the highest-edge opportunities',
          'Consider the Kelly Criterion for optimal bet sizing'
        ],
        expectedImpact: 'high'
      });
    }

    // Win rate improvement
    if (analysis.winRate < 0.53) {
      recommendations.push({
        id: `rec_${Date.now()}_2`,
        type: 'research',
        category: 'strategy',
        priority: 'high',
        title: 'Improve Pick Selection',
        description: `Your win rate (${(analysis.winRate * 100).toFixed(1)}%) needs improvement to be profitable long-term.`,
        actionItems: [
          'Focus on higher-edge opportunities only',
          'Spend more time on research and analysis',
          'Consider following proven handicappers initially'
        ],
        expectedImpact: 'high'
      });
    }

    // Sport focus
    const bestSport = Object.entries(analysis.sportBreakdown)
      .sort(([,a], [,b]) => (b as any).units - (a as any).units)[0];

    if (bestSport && Object.keys(analysis.sportBreakdown).length > 2) {
      recommendations.push({
        id: `rec_${Date.now()}_3`,
        type: 'sport_focus',
        category: 'strategy',
        priority: 'medium',
        title: `Focus on ${bestSport[0]}`,
        description: `You're most profitable in ${bestSport[0]} (+${(bestSport[1] as any).units.toFixed(1)} units).`,
        actionItems: [
          `Increase focus on ${bestSport[0]} betting`,
          'Reduce exposure to less profitable sports',
          'Develop deeper expertise in your strongest sport'
        ],
        expectedImpact: 'medium'
      });
    }

    // Timing recommendations
    if (analysis.totalBets > 50) {
      recommendations.push({
        id: `rec_${Date.now()}_4`,
        type: 'timing',
        category: 'discipline',
        priority: 'low',
        title: 'Bet Frequency Management',
        description: 'Consider quality over quantity in your betting approach.',
        actionItems: [
          'Limit daily bet count to maintain quality',
          'Avoid betting when tilted or emotional',
          'Take breaks during losing streaks'
        ],
        expectedImpact: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Assess user's risk level
   */
  private assessRisk(analysis: any): RiskAssessment {
    let riskScore = 0;
    const factors: string[] = [];
    const suggestions: string[] = [];

    // Unit size risk
    if (analysis.avgUnits > 5) {
      riskScore += 30;
      factors.push('Very high average unit size');
      suggestions.push('Reduce bet sizes immediately');
    } else if (analysis.avgUnits > 3) {
      riskScore += 15;
      factors.push('High average unit size');
      suggestions.push('Consider smaller unit sizes');
    }

    // Win rate risk
    if (analysis.winRate < 0.50) {
      riskScore += 25;
      factors.push('Below-average win rate');
      suggestions.push('Focus on pick quality over quantity');
    }

    // Profit/loss risk
    if (analysis.profitLoss < -20) {
      riskScore += 20;
      factors.push('Significant losses');
      suggestions.push('Take a break and reassess strategy');
    }

    // Determine risk level
    let level: 'conservative' | 'moderate' | 'aggressive' | 'reckless';
    if (riskScore >= 50) level = 'reckless';
    else if (riskScore >= 30) level = 'aggressive';
    else if (riskScore >= 15) level = 'moderate';
    else level = 'conservative';

    // Max recommended units based on risk
    const maxRecommendedUnits = level === 'reckless' ? 1 :
                               level === 'aggressive' ? 2 :
                               level === 'moderate' ? 3 : 5;

    return {
      level,
      score: riskScore,
      factors,
      warnings: suggestions,
      maxRecommendedUnits
    };
  }

  /**
   * Extract sport from pick description
   */
  private extractSport(description: string): string {
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'Soccer', 'Tennis', 'Golf'];
    const desc = description.toUpperCase();
    
    for (const sport of sports) {
      if (desc.includes(sport)) return sport;
    }
    
    return 'Other';
  }

  /**
   * Schedule coaching session
   */
  async scheduleCoachingSession(userId: string, preferences: any): Promise<void> {
    try {
      await this.supabaseService.client
        .from('coaching_sessions')
        .insert({
          user_id: userId,
          scheduled_at: preferences.scheduledAt,
          type: preferences.type || 'general',
          status: 'scheduled',
          created_at: new Date().toISOString()
        });

      logger.info(`Coaching session scheduled for user ${userId}`);
    } catch (error) {
      logger.error('Failed to schedule coaching session:', error);
    }
  }

  /**
   * Get coaching history for user
   */
  async getCoachingHistory(userId: string): Promise<any[]> {
    try {
      const { data: sessions } = await this.supabaseService.client
        .from('coaching_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return sessions || [];
    } catch (error) {
      logger.error('Failed to get coaching history:', error);
      return [];
    }
  }

  /**
   * Assess pick risk
   */
  assessPickRisk(pick: any): any {
    const odds = parseFloat(pick.odds) || 0;
    const units = parseFloat(pick.units) || 1;

    let riskLevel = 'medium';
    let score = 50;

    if (odds > 200 || units > 5) {
      riskLevel = 'high';
      score = 30;
    } else if (odds < -200 && units <= 2) {
      riskLevel = 'low';
      score = 80;
    }

    return {
      level: riskLevel,
      score,
      factors: {
        odds: odds > 200 ? 'high' : odds < -200 ? 'low' : 'medium',
        units: units > 5 ? 'high' : units <= 2 ? 'low' : 'medium'
      }
    };
  }

  /**
   * Analyze pick timing
   */
  analyzePickTiming(pick: any): any {
    const submittedAt = new Date(pick.submittedAt || Date.now());
    const gameTime = new Date(pick.gameTime || Date.now());
    const hoursBeforeGame = (gameTime.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);

    let timing = 'optimal';
    let score = 75;

    if (hoursBeforeGame < 1) {
      timing = 'last-minute';
      score = 40;
    } else if (hoursBeforeGame < 4) {
      timing = 'late';
      score = 60;
    } else if (hoursBeforeGame > 48) {
      timing = 'early';
      score = 65;
    }

    return {
      timing,
      score,
      hoursBeforeGame: Math.round(hoursBeforeGame * 10) / 10
    };
  }

  /**
   * Analyze user history
   */
  analyzeUserHistory(picks: any[]): any {
    const totalPicks = picks.length;
    const winningPicks = picks.filter(p => p.result === 'win').length;
    const winRate = totalPicks > 0 ? winningPicks / totalPicks : 0;

    return {
      totalPicks,
      winningPicks,
      winRate,
      consistency: winRate > 0.6 ? 'high' : winRate > 0.4 ? 'medium' : 'low'
    };
  }

  /**
   * Get detailed coaching for a specific pick
   */
  async getDetailedCoaching(pick: any): Promise<BettingAnalysis> {
    try {
      const analysis = await this.generateBettingAnalysis(pick.userId || pick.user_id, '30d');

      // Add specific coaching insights for this pick
      const insights = [
        `This ${pick.sport} pick has ${pick.confidence}% confidence`,
        `Your recent win rate in ${pick.sport} is ${(analysis.winRate * 100).toFixed(1)}%`,
        `Recommended stake: ${pick.units} units based on your bankroll`
      ];

      const improvements = [
        'Consider diversifying across more sports',
        'Track your performance by bet type',
        'Monitor line movement before placing bets'
      ];

      return {
        ...analysis,
        summary: `Detailed analysis for your ${pick.sport} pick with ${pick.confidence}% confidence`,
        insights,
        improvements
      };
    } catch (error) {
      logger.error('Failed to get detailed coaching:', error);
      throw error;
    }
  }

  /**
   * Get general coaching based on recent picks
   */
  async getGeneralCoaching(recentPicks: any[]): Promise<BettingAnalysis> {
    try {
      if (recentPicks.length === 0) {
        return {
          userId: '',
          period: '30d',
          totalBets: 0,
          winRate: 0,
          profitLoss: 0,
          avgOdds: 0,
          avgUnits: 0,
          avgEdge: 0,
          sportBreakdown: {},
          recommendations: ['Start by submitting your first pick!'],
          riskAssessment: 'LOW',
          edge: 0,
          confidence: 0,
          factors: {},
          riskLevel: 'LOW',
          summary: 'Welcome to Unit Talk! Submit your first pick to get personalized coaching.',
          insights: ['Track your picks consistently', 'Focus on value betting', 'Manage your bankroll wisely'],
          improvements: ['Submit more picks for better analysis', 'Add reasoning to your picks', 'Set realistic expectations']
        };
      }

      const userId = recentPicks[0].userId || recentPicks[0].user_id;
      const analysis = await this.generateBettingAnalysis(userId, '30d');

      const insights = [
        `You've submitted ${analysis.totalBets} picks with a ${(analysis.winRate * 100).toFixed(1)}% win rate`,
        `Your average stake is ${analysis.avgUnits.toFixed(1)} units`,
        `Most active sport: ${Object.keys(analysis.sportBreakdown)[0] || 'N/A'}`
      ];

      const improvements = [
        'Consider tracking your reasoning for each pick',
        'Monitor your performance by sport and bet type',
        'Set stop-loss limits to protect your bankroll'
      ];

      return {
        ...analysis,
        summary: `General coaching based on your last ${recentPicks.length} picks`,
        insights,
        improvements
      };
    } catch (error) {
      logger.error('Failed to get general coaching:', error);
      throw error;
    }
  }

  /**
   * Analyze pick timing factors
   */
  private analyzePickTiming(pick: UserPickSubmission): { score: number; timing: string } {
    // Simple timing analysis - in a real implementation, this would analyze
    // when the pick was made relative to game time, line movements, etc.
    const now = new Date();
    const submittedAt = pick.submittedAt ? new Date(pick.submittedAt) : now;

    // For now, return a default analysis
    return {
      score: 0.7, // Default score
      timing: 'Pick submitted at optimal timing window'
    };
  }

  /**
   * Assess pick risk factors
   */
  private assessPickRisk(pick: UserPickSubmission): { score: number; description: string } {
    // Simple risk assessment based on units and confidence
    const units = pick.units || 1;
    const confidence = pick.confidence || 50;

    let riskScore = 0.5; // Default medium risk
    let description = 'Medium risk pick';

    if (units > 3 || confidence < 30) {
      riskScore = 0.3; // High risk
      description = 'High risk pick - consider reducing stake';
    } else if (units <= 1 && confidence > 70) {
      riskScore = 0.8; // Low risk
      description = 'Low risk pick with good confidence';
    }

    return {
      score: riskScore,
      description
    };
  }
}

export const pickGradingService = new PickGradingService({} as SupabaseService);
export const coachingService = new CoachingService({} as SupabaseService, pickGradingService);