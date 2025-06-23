import { BettingAnalysis, AICoachingInsight, PickData } from '../types';

/**
 * AI Analysis Service - Provides intelligent betting analysis and coaching
 */
export class AIAnalysisService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
  }

  /**
   * Analyze a betting pick and provide insights
   */
  async analyzePick(pickData: PickData, context?: any): Promise<BettingAnalysis> {
    try {
      // Mock implementation - replace with actual AI analysis
      const analysis: BettingAnalysis = {
        confidence_score: this.calculateConfidenceScore(pickData),
        expected_value: this.calculateExpectedValue(pickData),
        risk_assessment: this.assessRisk(pickData),
        key_factors: this.identifyKeyFactors(pickData, context),
        recommendations: this.generateRecommendations(pickData),
        market_context: this.analyzeMarketContext(pickData)
      };

      return analysis;
    } catch (error) {
      console.error('Error analyzing pick:', error);
      throw new Error('Failed to analyze pick');
    }
  }

  /**
   * Generate personalized coaching insights
   */
  async generateCoachingInsights(
    userId: string, 
    recentPicks: PickData[], 
    userPreferences?: any
  ): Promise<AICoachingInsight[]> {
    try {
      const insights: AICoachingInsight[] = [];

      // Analyze betting patterns
      const patternInsights = this.analyzePatterns(recentPicks);
      insights.push(...patternInsights);

      // Bankroll management insights
      const bankrollInsights = this.analyzeBankrollManagement(recentPicks);
      insights.push(...bankrollInsights);

      // Sport-specific insights
      const sportInsights = this.analyzeSportPerformance(recentPicks);
      insights.push(...sportInsights);

      // Market timing insights
      const timingInsights = this.analyzeMarketTiming(recentPicks);
      insights.push(...timingInsights);

      return insights.sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority));
    } catch (error) {
      console.error('Error generating coaching insights:', error);
      return [];
    }
  }

  /**
   * Analyze parlay correlation and optimization
   */
  async analyzeParlayCorrelation(legs: any[]): Promise<any> {
    try {
      // Mock implementation - replace with actual correlation analysis
      const correlationMatrix = this.calculateCorrelationMatrix(legs);
      const optimizationSuggestions = this.generateOptimizationSuggestions(legs, correlationMatrix);
      
      return {
        correlation_score: this.calculateOverallCorrelation(correlationMatrix),
        risk_level: this.assessParlayRisk(legs, correlationMatrix),
        expected_value: this.calculateParlayEV(legs),
        optimization_suggestions: optimizationSuggestions,
        alternative_combinations: this.suggestAlternatives(legs)
      };
    } catch (error) {
      console.error('Error analyzing parlay correlation:', error);
      return null;
    }
  }

  /**
   * Generate market movement predictions
   */
  async predictMarketMovement(pickData: PickData): Promise<any> {
    try {
      // Mock implementation - replace with actual ML model
      return {
        predicted_direction: 'up',
        confidence: 0.75,
        magnitude: 2.5,
        timeframe: '2-4 hours',
        factors: [
          'Sharp money detected',
          'Injury news pending',
          'Weather conditions improving'
        ]
      };
    } catch (error) {
      console.error('Error predicting market movement:', error);
      return null;
    }
  }

  /**
   * Calculate confidence score based on multiple factors
   */
  private calculateConfidenceScore(pickData: PickData): number {
    let score = 0.5; // Base score

    // Adjust based on odds value
    if (pickData.odds > 0) {
      score += Math.min(pickData.odds / 1000, 0.2);
    } else {
      score += Math.min(Math.abs(pickData.odds) / 500, 0.2);
    }

    // Adjust based on user confidence
    score += (pickData.confidence - 5) * 0.05;

    // Adjust based on stake size (smaller stakes = higher confidence in model)
    if (pickData.stake < 50) score += 0.1;
    if (pickData.stake > 200) score -= 0.1;

    return Math.max(0.1, Math.min(0.95, score));
  }

  /**
   * Calculate expected value
   */
  private calculateExpectedValue(pickData: PickData): number {
    const impliedProbability = this.oddsToImpliedProbability(pickData.odds);
    const estimatedProbability = this.estimateWinProbability(pickData);
    
    if (pickData.odds > 0) {
      return (estimatedProbability * pickData.odds) - ((1 - estimatedProbability) * 100);
    } else {
      return (estimatedProbability * (100 / Math.abs(pickData.odds)) * 100) - ((1 - estimatedProbability) * 100);
    }
  }

  /**
   * Assess risk level
   */
  private assessRisk(pickData: PickData): 'LOW' | 'MEDIUM' | 'HIGH' {
    const factors = [
      pickData.stake > 100 ? 1 : 0,
      Math.abs(pickData.odds) < 150 ? 0 : 1,
      pickData.confidence < 6 ? 1 : 0,
      pickData.bet_type === 'parlay' ? 1 : 0
    ];

    const riskScore = factors.reduce((sum, factor) => sum + factor, 0);

    if (riskScore <= 1) return 'LOW';
    if (riskScore <= 2) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Identify key factors affecting the pick
   */
  private identifyKeyFactors(pickData: PickData, context?: any): string[] {
    const factors = [];

    // Sport-specific factors
    switch (pickData.sport.toLowerCase()) {
      case 'nfl':
        factors.push('Weather conditions', 'Injury reports', 'Rest advantage');
        break;
      case 'nba':
        factors.push('Back-to-back games', 'Home court advantage', 'Recent form');
        break;
      case 'mlb':
        factors.push('Pitcher matchup', 'Ballpark factors', 'Bullpen usage');
        break;
    }

    // Bet type specific factors
    if (pickData.bet_type.includes('total')) {
      factors.push('Pace of play', 'Defensive efficiency');
    }
    if (pickData.bet_type.includes('spread')) {
      factors.push('ATS trends', 'Motivation factors');
    }

    return factors;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(pickData: PickData): string[] {
    const recommendations = [];

    if (pickData.stake > 100) {
      recommendations.push('Consider reducing stake size for better bankroll management');
    }

    if (pickData.confidence < 6) {
      recommendations.push('Low confidence pick - consider passing or reducing stake');
    }

    if (Math.abs(pickData.odds) > 300) {
      recommendations.push('High odds pick - ensure proper bankroll allocation');
    }

    return recommendations;
  }

  /**
   * Analyze market context
   */
  private analyzeMarketContext(pickData: PickData): string {
    // Mock implementation - replace with actual market analysis
    return `Market showing ${pickData.odds > 0 ? 'underdog' : 'favorite'} value. Recent line movement suggests ${Math.random() > 0.5 ? 'sharp' : 'public'} money influence.`;
  }

  /**
   * Analyze betting patterns
   */
  private analyzePatterns(picks: PickData[]): AICoachingInsight[] {
    const insights: AICoachingInsight[] = [];

    // Check for overconfidence
    const avgConfidence = picks.reduce((sum, pick) => sum + pick.confidence, 0) / picks.length;
    if (avgConfidence > 8) {
      insights.push({
        type: 'WARNING',
        title: 'Overconfidence Pattern Detected',
        description: 'Your average confidence is very high. Consider being more selective with high-confidence picks.',
        actionable: true,
        priority: 'HIGH',
        category: 'PSYCHOLOGY'
      });
    }

    // Check for bet sizing consistency
    const stakes = picks.map(p => p.stake);
    const stakeVariance = this.calculateVariance(stakes);
    if (stakeVariance > 10000) {
      insights.push({
        type: 'TIP',
        title: 'Inconsistent Bet Sizing',
        description: 'Your bet sizes vary significantly. Consider implementing a more systematic approach.',
        actionable: true,
        priority: 'MEDIUM',
        category: 'BANKROLL'
      });
    }

    return insights;
  }

  /**
   * Analyze bankroll management
   */
  private analyzeBankrollManagement(picks: PickData[]): AICoachingInsight[] {
    const insights: AICoachingInsight[] = [];
    const totalStaked = picks.reduce((sum, pick) => sum + pick.stake, 0);
    const avgStake = totalStaked / picks.length;

    if (avgStake > 200) {
      insights.push({
        type: 'WARNING',
        title: 'High Average Stake Size',
        description: 'Your average bet size may be too large for optimal bankroll management.',
        actionable: true,
        priority: 'HIGH',
        category: 'BANKROLL'
      });
    }

    return insights;
  }

  /**
   * Analyze sport-specific performance
   */
  private analyzeSportPerformance(picks: PickData[]): AICoachingInsight[] {
    const insights: AICoachingInsight[] = [];
    const sportGroups = this.groupBySport(picks);

    Object.entries(sportGroups).forEach(([sport, sportPicks]) => {
      const winRate = this.calculateWinRate(sportPicks);
      if (winRate < 0.45) {
        insights.push({
          type: 'OPPORTUNITY',
          title: `Struggling in ${sport.toUpperCase()}`,
          description: `Your ${sport} picks are underperforming. Consider focusing on your stronger sports.`,
          actionable: true,
          priority: 'MEDIUM',
          category: 'STRATEGY'
        });
      }
    });

    return insights;
  }

  /**
   * Analyze market timing
   */
  private analyzeMarketTiming(picks: PickData[]): AICoachingInsight[] {
    const insights: AICoachingInsight[] = [];

    // Mock timing analysis
    const earlyPicks = picks.filter(p => new Date(p.created_at).getHours() < 12).length;
    const latePicks = picks.length - earlyPicks;

    if (latePicks > earlyPicks * 2) {
      insights.push({
        type: 'TIP',
        title: 'Late Market Entry Pattern',
        description: 'You tend to place bets late in the day when lines may be less favorable.',
        actionable: true,
        priority: 'LOW',
        category: 'STRATEGY'
      });
    }

    return insights;
  }

  // Helper methods
  private priorityScore(priority: string): number {
    const scores = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return scores[priority as keyof typeof scores] || 0;
  }

  private oddsToImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  private estimateWinProbability(pickData: PickData): number {
    // Mock implementation - replace with actual ML model
    const baseProb = this.oddsToImpliedProbability(pickData.odds);
    const confidenceAdjustment = (pickData.confidence - 5) * 0.02;
    return Math.max(0.1, Math.min(0.9, baseProb + confidenceAdjustment));
  }

  private calculateCorrelationMatrix(legs: any[]): number[][] {
    // Mock implementation
    const size = legs.length;
    const matrix = Array(size).fill(null).map(() => Array(size).fill(0));
    
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          // Mock correlation calculation
          matrix[i][j] = Math.random() * 0.6 - 0.3;
        }
      }
    }
    
    return matrix;
  }

  private calculateOverallCorrelation(matrix: number[][]): number {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        sum += Math.abs(matrix[i][j]);
        count++;
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  private assessParlayRisk(legs: any[], correlationMatrix: number[][]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const avgCorrelation = this.calculateOverallCorrelation(correlationMatrix);
    const legCount = legs.length;

    if (legCount >= 5 || avgCorrelation > 0.3) return 'HIGH';
    if (legCount >= 3 || avgCorrelation > 0.15) return 'MEDIUM';
    return 'LOW';
  }

  private calculateParlayEV(legs: any[]): number {
    // Mock implementation
    return legs.reduce((ev, leg) => ev * 0.95, 1) - 1;
  }

  private generateOptimizationSuggestions(legs: any[], correlationMatrix: number[][]): string[] {
    const suggestions = [];
    
    if (legs.length > 4) {
      suggestions.push('Consider reducing to 3-4 legs for better odds');
    }
    
    const highCorrelation = this.calculateOverallCorrelation(correlationMatrix);
    if (highCorrelation > 0.2) {
      suggestions.push('Some legs may be correlated - consider alternatives');
    }
    
    return suggestions;
  }

  private suggestAlternatives(legs: any[]): any[] {
    // Mock implementation
    return legs.slice(0, Math.min(3, legs.length));
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private groupBySport(picks: PickData[]): Record<string, PickData[]> {
    return picks.reduce((groups, pick) => {
      const sport = pick.sport.toLowerCase();
      if (!groups[sport]) groups[sport] = [];
      groups[sport].push(pick);
      return groups;
    }, {} as Record<string, PickData[]>);
  }

  private calculateWinRate(picks: PickData[]): number {
    const gradedPicks = picks.filter(p => p.status === 'won' || p.status === 'lost');
    if (gradedPicks.length === 0) return 0.5;
    
    const wins = gradedPicks.filter(p => p.status === 'won').length;
    return wins / gradedPicks.length;
  }
}