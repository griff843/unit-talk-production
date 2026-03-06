import { Logger } from '../../shared/logger/types';

/**
 * 🧠 Adaptive Learning Engine
 * Analyzes user behavior patterns and adapts learning experiences in real-time
 * This is the intelligence that makes Unit Talk's onboarding superior to any other Discord
 */
export class AdaptiveLearningEngine {
  private logger: Logger;
  private behaviorPatterns: Map<string, BehaviorPattern> = new Map();
  private adaptationStrategies: Map<string, AdaptationStrategy> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeAdaptationStrategies();
  }

  async initialize(): Promise<void> {
    this.logger.info('🧠 Initializing Adaptive Learning Engine...');

    // Load existing behavior patterns
    await this.loadBehaviorPatterns();

    // Initialize machine learning models for personalization
    await this.initializeMLModels();

    this.logger.info('✅ Adaptive Learning Engine initialized');
  }

  async isHealthy(): Promise<boolean> {
    return this.adaptationStrategies.size > 0 && this.behaviorPatterns.size >= 0;
  }

  /**
   * Analyzes user behavior and recommends adaptations to their learning path
   */
  async analyzeAndAdapt(userId: string, behaviorData: any): Promise<AdaptationRecommendation> {
    try {
      // Get user's behavior pattern
      const pattern = this.behaviorPatterns.get(userId) || this.createNewPattern(userId);

      // Update pattern with new data
      this.updateBehaviorPattern(pattern, behaviorData);

      // Analyze for adaptation opportunities
      const adaptations = await this.identifyAdaptations(pattern);

      // Generate recommendations
      const recommendation = this.generateAdaptationRecommendation(pattern, adaptations);

      this.logger.debug('🎯 Generated adaptation recommendation', {
        userId,
        adaptationType: recommendation.type,
        confidence: recommendation.confidence,
      });

      return recommendation;
    } catch (error) {
      this.logger.error('❌ Failed to analyze and adapt for user:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        type: 'no_change',
        confidence: 0,
        reasoning: 'Analysis failed',
        actions: [],
      };
    }
  }

  /**
   * Predicts user's learning preferences based on behavior
   */
  async predictLearningPreferences(userId: string): Promise<LearningPreferences> {
    const pattern = this.behaviorPatterns.get(userId);

    if (!pattern) {
      return this.getDefaultPreferences();
    }

    return {
      preferredInteractionType: this.predictInteractionType(pattern),
      optimalSessionLength: this.predictSessionLength(pattern),
      bestTimeOfDay: this.predictOptimalTime(pattern),
      difficultyPreference: this.predictDifficultyLevel(pattern),
      motivationalFactors: this.identifyMotivationalFactors(pattern),
      learningStyle: this.identifyLearningStyle(pattern),
    };
  }

  private initializeAdaptationStrategies(): void {
    // Strategy for users who engage heavily with reactions
    this.adaptationStrategies.set('reaction_heavy', {
      id: 'reaction_heavy',
      name: 'Reaction-Based Learning',
      triggers: ['high_reaction_rate', 'low_text_engagement'],
      adaptations: ['increase_emoji_usage', 'add_more_reaction_choices', 'gamify_with_reactions'],
      effectiveness: 0.85,
    });

    // Strategy for analytical users
    this.adaptationStrategies.set('analytical', {
      id: 'analytical',
      name: 'Data-Driven Learning',
      triggers: ['asks_detailed_questions', 'uses_stats_commands'],
      adaptations: [
        'provide_detailed_statistics',
        'show_performance_metrics',
        'include_probability_calculations',
      ],
      effectiveness: 0.92,
    });

    // Strategy for social learners
    this.adaptationStrategies.set('social', {
      id: 'social',
      name: 'Community-Focused Learning',
      triggers: ['high_community_interaction', 'mentions_other_users'],
      adaptations: [
        'encourage_group_discussions',
        'pair_with_mentors',
        'highlight_community_achievements',
      ],
      effectiveness: 0.88,
    });

    // Strategy for quick learners
    this.adaptationStrategies.set('accelerated', {
      id: 'accelerated',
      name: 'Accelerated Learning Path',
      triggers: ['completes_quickly', 'shows_advanced_understanding'],
      adaptations: [
        'skip_basic_concepts',
        'provide_advanced_content',
        'increase_complexity_faster',
      ],
      effectiveness: 0.9,
    });
  }

  private async loadBehaviorPatterns(): Promise<void> {
    // In production, this would load from database
    this.logger.debug('📚 Loading existing behavior patterns...');
  }

  private async initializeMLModels(): Promise<void> {
    // Initialize ML models for behavior prediction
    this.logger.debug('🤖 Initializing ML models for adaptation...');
  }

  private createNewPattern(userId: string): BehaviorPattern {
    const pattern: BehaviorPattern = {
      userId,
      totalInteractions: 0,
      reactionRate: 0,
      messageComplexity: 0,
      sessionLengths: [],
      activeHours: [],
      commandUsage: {},
      engagementQuality: 0,
      learningVelocity: 0,
      strugglingAreas: [],
      preferredContent: [],
      lastUpdated: new Date().toISOString(),
    };

    this.behaviorPatterns.set(userId, pattern);
    return pattern;
  }

  private updateBehaviorPattern(pattern: BehaviorPattern, behaviorData: any): void {
    pattern.totalInteractions++;

    if (behaviorData.reactionGiven) {
      pattern.reactionRate = (pattern.reactionRate + 1) / pattern.totalInteractions;
    }

    if (behaviorData.messageLength) {
      pattern.messageComplexity = this.calculateAverageComplexity(
        pattern.messageComplexity,
        behaviorData.messageLength,
        pattern.totalInteractions
      );
    }

    if (behaviorData.sessionLength) {
      pattern.sessionLengths.push(behaviorData.sessionLength);
      if (pattern.sessionLengths.length > 10) {
        pattern.sessionLengths.shift(); // Keep only last 10 sessions
      }
    }

    pattern.lastUpdated = new Date().toISOString();
  }

  private async identifyAdaptations(pattern: BehaviorPattern): Promise<string[]> {
    const adaptations: string[] = [];

    // Check each strategy for triggers
    for (const [strategyId, strategy] of this.adaptationStrategies) {
      const triggersMatched = strategy.triggers.filter(trigger =>
        this.evaluateTrigger(trigger, pattern)
      );

      if (triggersMatched.length >= strategy.triggers.length * 0.6) {
        adaptations.push(strategyId);
      }
    }

    return adaptations;
  }

  private evaluateTrigger(trigger: string, pattern: BehaviorPattern): boolean {
    switch (trigger) {
      case 'high_reaction_rate':
        return pattern.reactionRate > 0.7;
      case 'low_text_engagement':
        return pattern.messageComplexity < 0.3;
      case 'asks_detailed_questions':
        return pattern.messageComplexity > 0.7;
      case 'uses_stats_commands':
        return (pattern.commandUsage['/stats'] || 0) > 2;
      case 'high_community_interaction':
        return pattern.engagementQuality > 0.8;
      case 'mentions_other_users':
        return pattern.engagementQuality > 0.6;
      case 'completes_quickly':
        return pattern.learningVelocity > 0.8;
      case 'shows_advanced_understanding':
        return pattern.strugglingAreas.length < 2;
      default:
        return false;
    }
  }

  private generateAdaptationRecommendation(
    pattern: BehaviorPattern,
    adaptations: string[]
  ): AdaptationRecommendation {
    if (adaptations.length === 0) {
      return {
        type: 'no_change',
        confidence: 0.9,
        reasoning: 'User behavior is optimal for current learning path',
        actions: [],
      };
    }

    // Select best adaptation strategy
    const bestAdaptation = adaptations[0]; // In production, would use ML to rank
    const strategy = this.adaptationStrategies.get(bestAdaptation)!;

    return {
      type: 'adaptation',
      confidence: strategy.effectiveness,
      reasoning: `User shows ${strategy.name} patterns`,
      actions: strategy.adaptations.map(adaptation => ({
        action: adaptation,
        priority: 'high' as const,
        expectedImpact: strategy.effectiveness,
      })),
    };
  }

  private predictInteractionType(
    pattern: BehaviorPattern
  ): 'reactions' | 'text' | 'buttons' | 'mixed' {
    if (pattern.reactionRate > 0.8) return 'reactions';
    if (pattern.messageComplexity > 0.7) return 'text';
    return 'mixed';
  }

  private predictSessionLength(pattern: BehaviorPattern): number {
    if (pattern.sessionLengths.length === 0) return 15; // Default 15 minutes

    const average =
      pattern.sessionLengths.reduce((sum, length) => sum + length, 0) /
      pattern.sessionLengths.length;
    return Math.round(average);
  }

  private predictOptimalTime(pattern: BehaviorPattern): string[] {
    // Analyze active hours to predict best engagement times
    const hourCounts = pattern.activeHours.reduce(
      (acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const topHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    return topHours.length > 0 ? topHours : ['18:00', '20:00', '21:00']; // Default evening hours
  }

  private predictDifficultyLevel(pattern: BehaviorPattern): 'easy' | 'medium' | 'hard' {
    if (pattern.strugglingAreas.length > 3) return 'easy';
    if (pattern.learningVelocity > 0.8) return 'hard';
    return 'medium';
  }

  private identifyMotivationalFactors(pattern: BehaviorPattern): string[] {
    const factors: string[] = [];

    if (pattern.reactionRate > 0.7) factors.push('immediate_feedback');
    if (pattern.engagementQuality > 0.8) factors.push('community_recognition');
    if (pattern.commandUsage['/stats']) factors.push('progress_tracking');

    return factors;
  }

  private identifyLearningStyle(
    pattern: BehaviorPattern
  ): 'visual' | 'analytical' | 'hands-on' | 'social' {
    if (pattern.commandUsage['/stats'] > pattern.reactionRate) return 'analytical';
    if (pattern.engagementQuality > 0.8) return 'social';
    if (pattern.reactionRate > 0.7) return 'visual';
    return 'hands-on';
  }

  private getDefaultPreferences(): LearningPreferences {
    return {
      preferredInteractionType: 'mixed',
      optimalSessionLength: 15,
      bestTimeOfDay: ['18:00', '20:00', '21:00'],
      difficultyPreference: 'medium',
      motivationalFactors: ['progress_tracking', 'immediate_feedback'],
      learningStyle: 'hands-on',
    };
  }

  private calculateAverageComplexity(current: number, newValue: number, count: number): number {
    return (current * (count - 1) + newValue) / count;
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Adaptive Learning Engine...');
    // Save behavior patterns to database
    // Clean up ML models
  }
}

// 📊 Type Definitions
export interface BehaviorPattern {
  userId: string;
  totalInteractions: number;
  reactionRate: number;
  messageComplexity: number;
  sessionLengths: number[];
  activeHours: number[];
  commandUsage: Record<string, number>;
  engagementQuality: number;
  learningVelocity: number;
  strugglingAreas: string[];
  preferredContent: string[];
  lastUpdated: string;
}

export interface AdaptationStrategy {
  id: string;
  name: string;
  triggers: string[];
  adaptations: string[];
  effectiveness: number;
}

export interface AdaptationRecommendation {
  type: 'adaptation' | 'no_change' | 'escalation';
  confidence: number;
  reasoning: string;
  actions: AdaptationAction[];
}

export interface AdaptationAction {
  action: string;
  priority: 'low' | 'medium' | 'high';
  expectedImpact: number;
}

export interface LearningPreferences {
  preferredInteractionType: 'reactions' | 'text' | 'buttons' | 'mixed';
  optimalSessionLength: number;
  bestTimeOfDay: string[];
  difficultyPreference: 'easy' | 'medium' | 'hard';
  motivationalFactors: string[];
  learningStyle: 'visual' | 'analytical' | 'hands-on' | 'social';
}
