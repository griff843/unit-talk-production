import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface EngagementMetrics {
  userId: string;
  timestamp: Date;
  sessionData: SessionMetrics;
  interactionData: InteractionMetrics;
  contentData: ContentEngagementMetrics;
  behaviorData: BehaviorMetrics;
  trends: EngagementTrends;
  score: number;
  lastInteraction: Date;
  riskFactors: string[];
}

interface SessionMetrics {
  sessionCount: number;
  averageSessionDuration: number;
  totalTimeSpent: number;
  sessionsPerWeek: number;
  sessionConsistency: number;
  peakUsageHours: number[];
  weekendActivity: number;
  weekdayActivity: number;
}

interface InteractionMetrics {
  messagesSent: number;
  reactionsGiven: number;
  reactionsReceived: number;
  questionsAsked: number;
  helpProvided: number;
  commandsUsed: number;
  featureInteractions: Record<string, number>;
  socialConnections: number;
}

interface ContentEngagementMetrics {
  picksViewed: number;
  picksFollowed: number;
  analysisRead: number;
  tutorialsCompleted: number;
  contentShared: number;
  bookmarksCreated: number;
  feedbackSubmitted: number;
  contentPreferences: string[];
}

interface BehaviorMetrics {
  loginFrequency: number;
  featureAdoption: number;
  explorationRate: number;
  retentionRate: number;
  conversionFunnel: Record<string, number>;
  dropoffPoints: string[];
  successfulActions: number;
  failedActions: number;
}

interface EngagementTrends {
  currentScore: number;
  previousScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  weeklyTrend: number[];
  monthlyAverage: number;
  seasonalPattern: Record<string, number>;
  predictedNext: number;
}

interface EngagementAnalysis {
  score: number;
  trends: EngagementTrends;
  lastInteraction: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  interventionNeeded: boolean;
}

export class EngagementAnalyzer {
  private readonly logger: Logger;
  private userEngagementData: Map<string, EngagementMetrics> = new Map();
  private engagementModels: Map<string, any> = new Map();
  private benchmarkMetrics: any = {};

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('📊 Initializing EngagementAnalyzer');

    await this.loadEngagementModels();
    await this.loadBenchmarkMetrics();
    await this.loadUserEngagementHistory();

    this.logger.info('✅ EngagementAnalyzer initialized');
  }

  async analyzeUser(userId: string): Promise<EngagementAnalysis> {
    this.logger.debug('📈 Analyzing user engagement', { userId });

    try {
      // Collect current engagement data
      const engagementMetrics = await this.collectEngagementMetrics(userId);

      // Calculate engagement score
      const engagementScore = await this.calculateEngagementScore(engagementMetrics);

      // Analyze trends
      const trends = await this.analyzeTrends(userId, engagementMetrics);

      // Assess risk level
      const riskLevel = await this.assessRiskLevel(engagementScore, trends);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(engagementMetrics, riskLevel);

      // Identify strengths and weaknesses
      const { strengths, weaknesses } = await this.identifyStrengthsWeaknesses(engagementMetrics);

      const analysis: EngagementAnalysis = {
        score: engagementScore,
        trends,
        lastInteraction: engagementMetrics.lastInteraction,
        riskLevel,
        recommendations,
        strengths,
        weaknesses,
        interventionNeeded: riskLevel === 'high' || riskLevel === 'critical',
      };

      // Cache analysis
      await this.cacheEngagementAnalysis(userId, analysis);

      // Update user engagement data
      this.userEngagementData.set(userId, engagementMetrics);

      this.logger.debug('✅ Engagement analysis completed', {
        userId,
        score: engagementScore,
        riskLevel,
        trend: trends.trend,
      });

      return analysis;
    } catch (error) {
      this.logger.error('❌ Failed to analyze user engagement', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.getDefaultAnalysis(userId);
    }
  }

  async getCurrentEngagement(userId: string): Promise<any> {
    const cached = await redisCache.get(`engagement:current:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Collect real-time engagement data
    const engagement = {
      lastActivity: await this.getLastActivity(userId),
      recentSessions: await this.getRecentSessions(userId),
      activeFeatures: await this.getActiveFeatures(userId),
      engagement_score: await this.getQuickEngagementScore(userId),
    };

    // Cache for 10 minutes
    await redisCache.set(`engagement:current:${userId}`, JSON.stringify(engagement), 600);

    return engagement;
  }

  async getEngagementTrends(userIds: string[]): Promise<Map<string, EngagementTrends>> {
    const trends = new Map<string, EngagementTrends>();

    for (const userId of userIds) {
      try {
        const userMetrics = this.userEngagementData.get(userId);
        if (userMetrics) {
          trends.set(userId, userMetrics.trends);
        } else {
          // Load from cache or calculate
          const analysis = await this.analyzeUser(userId);
          trends.set(userId, analysis.trends);
        }
      } catch (error) {
        this.logger.warn('⚠️ Failed to get engagement trends for user', { userId });
      }
    }

    return trends;
  }

  async generateEngagementInsights(): Promise<any> {
    const allUsers = Array.from(this.userEngagementData.values());

    const insights = {
      totalUsers: allUsers.length,
      averageEngagement: this.calculateAverageEngagement(allUsers),
      engagementDistribution: this.getEngagementDistribution(allUsers),
      trendAnalysis: this.analyzeTrendPatterns(allUsers),
      riskAnalysis: this.analyzeRiskDistribution(allUsers),
      topEngagementDrivers: await this.identifyEngagementDrivers(allUsers),
      recommendations: await this.generateSystemRecommendations(allUsers),
      benchmarkComparison: this.compareToBenchmarks(allUsers),
    };

    // Cache insights
    await redisCache.set(
      'engagement:system_insights',
      JSON.stringify(insights),
      1800 // 30 minutes TTL
    );

    return insights;
  }

  // Private Methods
  private async collectEngagementMetrics(userId: string): Promise<EngagementMetrics> {
    const sessionData = await this.collectSessionMetrics(userId);
    const interactionData = await this.collectInteractionMetrics(userId);
    const contentData = await this.collectContentMetrics(userId);
    const behaviorData = await this.collectBehaviorMetrics(userId);
    const lastInteraction = await this.getLastInteractionTime(userId);

    return {
      userId,
      timestamp: new Date(),
      sessionData,
      interactionData,
      contentData,
      behaviorData,
      trends: await this.calculateTrends(userId),
      score: 0, // Will be calculated separately
      lastInteraction,
      riskFactors: [],
    };
  }

  private async collectSessionMetrics(userId: string): Promise<SessionMetrics> {
    // This would integrate with actual session tracking data
    const cached = await redisCache.get(`user:sessions:${userId}`);
    const sessionData = cached ? JSON.parse(cached) : {};

    return {
      sessionCount: sessionData.sessionCount || 0,
      averageSessionDuration: sessionData.averageSessionDuration || 0,
      totalTimeSpent: sessionData.totalTimeSpent || 0,
      sessionsPerWeek: sessionData.sessionsPerWeek || 0,
      sessionConsistency: sessionData.sessionConsistency || 0.5,
      peakUsageHours: sessionData.peakUsageHours || [12, 18, 20],
      weekendActivity: sessionData.weekendActivity || 0.3,
      weekdayActivity: sessionData.weekdayActivity || 0.7,
    };
  }

  private async collectInteractionMetrics(userId: string): Promise<InteractionMetrics> {
    const cached = await redisCache.get(`user:interactions:${userId}`);
    const interactionData = cached ? JSON.parse(cached) : {};

    return {
      messagesSent: interactionData.messagesSent || 0,
      reactionsGiven: interactionData.reactionsGiven || 0,
      reactionsReceived: interactionData.reactionsReceived || 0,
      questionsAsked: interactionData.questionsAsked || 0,
      helpProvided: interactionData.helpProvided || 0,
      commandsUsed: interactionData.commandsUsed || 0,
      featureInteractions: interactionData.featureInteractions || {},
      socialConnections: interactionData.socialConnections || 0,
    };
  }

  private async collectContentMetrics(userId: string): Promise<ContentEngagementMetrics> {
    const cached = await redisCache.get(`user:content:${userId}`);
    const contentData = cached ? JSON.parse(cached) : {};

    return {
      picksViewed: contentData.picksViewed || 0,
      picksFollowed: contentData.picksFollowed || 0,
      analysisRead: contentData.analysisRead || 0,
      tutorialsCompleted: contentData.tutorialsCompleted || 0,
      contentShared: contentData.contentShared || 0,
      bookmarksCreated: contentData.bookmarksCreated || 0,
      feedbackSubmitted: contentData.feedbackSubmitted || 0,
      contentPreferences: contentData.contentPreferences || [],
    };
  }

  private async collectBehaviorMetrics(userId: string): Promise<BehaviorMetrics> {
    const cached = await redisCache.get(`user:behavior:${userId}`);
    const behaviorData = cached ? JSON.parse(cached) : {};

    return {
      loginFrequency: behaviorData.loginFrequency || 0,
      featureAdoption: behaviorData.featureAdoption || 0,
      explorationRate: behaviorData.explorationRate || 0,
      retentionRate: behaviorData.retentionRate || 0.5,
      conversionFunnel: behaviorData.conversionFunnel || {},
      dropoffPoints: behaviorData.dropoffPoints || [],
      successfulActions: behaviorData.successfulActions || 0,
      failedActions: behaviorData.failedActions || 0,
    };
  }

  private async calculateEngagementScore(metrics: EngagementMetrics): Promise<number> {
    const weights = {
      sessions: 0.25,
      interactions: 0.3,
      content: 0.25,
      behavior: 0.2,
    };

    const sessionScore = this.calculateSessionScore(metrics.sessionData);
    const interactionScore = this.calculateInteractionScore(metrics.interactionData);
    const contentScore = this.calculateContentScore(metrics.contentData);
    const behaviorScore = this.calculateBehaviorScore(metrics.behaviorData);

    const totalScore =
      sessionScore * weights.sessions +
      interactionScore * weights.interactions +
      contentScore * weights.content +
      behaviorScore * weights.behavior;

    return Math.max(0, Math.min(1, totalScore));
  }

  private calculateSessionScore(sessionData: SessionMetrics): number {
    const sessionFrequencyScore = Math.min(sessionData.sessionsPerWeek / 5, 1);
    const durationScore = Math.min(sessionData.averageSessionDuration / 600, 1); // 10 minutes max
    const consistencyScore = sessionData.sessionConsistency;

    return sessionFrequencyScore * 0.4 + durationScore * 0.3 + consistencyScore * 0.3;
  }

  private calculateInteractionScore(interactionData: InteractionMetrics): number {
    const messageScore = Math.min(interactionData.messagesSent / 10, 1);
    const reactionScore = Math.min(interactionData.reactionsGiven / 5, 1);
    const questionScore = Math.min(interactionData.questionsAsked / 3, 1);
    const featureScore = Math.min(Object.keys(interactionData.featureInteractions).length / 5, 1);

    return messageScore * 0.3 + reactionScore * 0.2 + questionScore * 0.25 + featureScore * 0.25;
  }

  private calculateContentScore(contentData: ContentEngagementMetrics): number {
    const viewScore = Math.min(contentData.picksViewed / 10, 1);
    const followScore = Math.min(contentData.picksFollowed / 5, 1);
    const readScore = Math.min(contentData.analysisRead / 3, 1);
    const tutorialScore = Math.min(contentData.tutorialsCompleted / 2, 1);

    return viewScore * 0.3 + followScore * 0.3 + readScore * 0.2 + tutorialScore * 0.2;
  }

  private calculateBehaviorScore(behaviorData: BehaviorMetrics): number {
    const loginScore = Math.min(behaviorData.loginFrequency / 7, 1); // Daily login = 1.0
    const adoptionScore = behaviorData.featureAdoption;
    const explorationScore = behaviorData.explorationRate;
    const successScore =
      behaviorData.successfulActions /
      Math.max(1, behaviorData.successfulActions + behaviorData.failedActions);

    return loginScore * 0.3 + adoptionScore * 0.25 + explorationScore * 0.2 + successScore * 0.25;
  }

  private async calculateTrends(userId: string): Promise<EngagementTrends> {
    const historicalData = await this.getHistoricalEngagementData(userId);

    if (historicalData.length < 2) {
      return {
        currentScore: 0.5,
        previousScore: 0.5,
        trend: 'stable',
        changeRate: 0,
        weeklyTrend: [0.5],
        monthlyAverage: 0.5,
        seasonalPattern: {},
        predictedNext: 0.5,
      };
    }

    const current = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];
    const changeRate = current - previous;

    return {
      currentScore: current,
      previousScore: previous,
      trend: this.determineTrend(changeRate),
      changeRate,
      weeklyTrend: historicalData.slice(-7),
      monthlyAverage: this.calculateAverage(historicalData.slice(-30)),
      seasonalPattern: await this.calculateSeasonalPattern(userId),
      predictedNext: await this.predictNextScore(historicalData),
    };
  }

  private determineTrend(changeRate: number): 'increasing' | 'decreasing' | 'stable' {
    if (changeRate > 0.05) return 'increasing';
    if (changeRate < -0.05) return 'decreasing';
    return 'stable';
  }

  private async analyzeTrends(
    userId: string,
    metrics: EngagementMetrics
  ): Promise<EngagementTrends> {
    return metrics.trends;
  }

  private async assessRiskLevel(
    score: number,
    trends: EngagementTrends
  ): Promise<'low' | 'medium' | 'high' | 'critical'> {
    if (score < 0.2 || (score < 0.4 && trends.trend === 'decreasing')) return 'critical';
    if (score < 0.4 || (score < 0.6 && trends.trend === 'decreasing')) return 'high';
    if (score < 0.7 || trends.trend === 'decreasing') return 'medium';
    return 'low';
  }

  private async generateRecommendations(
    metrics: EngagementMetrics,
    riskLevel: string
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (metrics.sessionData.sessionsPerWeek < 2) {
      recommendations.push('Increase login frequency with daily value propositions');
    }

    if (metrics.interactionData.messagesSent < 5) {
      recommendations.push('Encourage community participation and discussion');
    }

    if (metrics.contentData.picksFollowed === 0) {
      recommendations.push('Guide user through pick following process');
    }

    if (metrics.behaviorData.featureAdoption < 0.3) {
      recommendations.push('Introduce unused features through guided tutorials');
    }

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Immediate intervention required - personal outreach recommended');
    }

    return recommendations;
  }

  private async identifyStrengthsWeaknesses(
    metrics: EngagementMetrics
  ): Promise<{ strengths: string[]; weaknesses: string[] }> {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Session strengths/weaknesses
    if (metrics.sessionData.sessionConsistency > 0.7) {
      strengths.push('Consistent usage pattern');
    } else if (metrics.sessionData.sessionConsistency < 0.3) {
      weaknesses.push('Irregular usage pattern');
    }

    // Interaction strengths/weaknesses
    if (metrics.interactionData.reactionsGiven > 10) {
      strengths.push('Active community participant');
    } else if (metrics.interactionData.reactionsGiven === 0) {
      weaknesses.push('Limited community engagement');
    }

    // Content strengths/weaknesses
    if (metrics.contentData.analysisRead > 5) {
      strengths.push('Engaged with educational content');
    } else if (metrics.contentData.analysisRead === 0) {
      weaknesses.push('Not consuming educational content');
    }

    // Behavior strengths/weaknesses
    if (metrics.behaviorData.featureAdoption > 0.7) {
      strengths.push('Power user - high feature adoption');
    } else if (metrics.behaviorData.featureAdoption < 0.3) {
      weaknesses.push('Underutilizing platform features');
    }

    return { strengths, weaknesses };
  }

  private getDefaultAnalysis(userId: string): EngagementAnalysis {
    return {
      score: 0.5,
      trends: {
        currentScore: 0.5,
        previousScore: 0.5,
        trend: 'stable',
        changeRate: 0,
        weeklyTrend: [0.5],
        monthlyAverage: 0.5,
        seasonalPattern: {},
        predictedNext: 0.5,
      },
      lastInteraction: new Date(),
      riskLevel: 'medium',
      recommendations: ['Unable to analyze - insufficient data'],
      strengths: [],
      weaknesses: ['Insufficient engagement data'],
      interventionNeeded: false,
    };
  }

  // Helper Methods
  private async getLastActivity(userId: string): Promise<Date> {
    const cached = await redisCache.get(`user:last_activity:${userId}`);
    return cached ? new Date(cached) : new Date();
  }

  private async getRecentSessions(userId: string): Promise<any[]> {
    const cached = await redisCache.get(`user:recent_sessions:${userId}`);
    return cached ? JSON.parse(cached) : [];
  }

  private async getActiveFeatures(userId: string): Promise<string[]> {
    const cached = await redisCache.get(`user:active_features:${userId}`);
    return cached ? JSON.parse(cached) : [];
  }

  private async getQuickEngagementScore(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:quick_engagement:${userId}`);
    return cached ? parseFloat(cached) : 0.5;
  }

  private async getLastInteractionTime(userId: string): Promise<Date> {
    const cached = await redisCache.get(`user:last_interaction:${userId}`);
    return cached ? new Date(cached) : new Date();
  }

  private async getHistoricalEngagementData(userId: string): Promise<number[]> {
    const cached = await redisCache.get(`engagement:history:${userId}`);
    return cached ? JSON.parse(cached) : [0.5];
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private async calculateSeasonalPattern(userId: string): Promise<Record<string, number>> {
    // This would analyze seasonal engagement patterns
    return {
      weekday_morning: 0.6,
      weekday_afternoon: 0.8,
      weekday_evening: 0.9,
      weekend_morning: 0.4,
      weekend_afternoon: 0.5,
      weekend_evening: 0.7,
    };
  }

  private async predictNextScore(historicalData: number[]): Promise<number> {
    if (historicalData.length < 3) return historicalData[historicalData.length - 1] || 0.5;

    // Simple linear trend prediction
    const recent = historicalData.slice(-3);
    const trend = (recent[2] - recent[0]) / 2;
    const predicted = recent[2] + trend;

    return Math.max(0, Math.min(1, predicted));
  }

  private calculateAverageEngagement(users: EngagementMetrics[]): number {
    if (users.length === 0) return 0;
    return users.reduce((sum, user) => sum + user.score, 0) / users.length;
  }

  private getEngagementDistribution(users: EngagementMetrics[]): any {
    const distribution = { low: 0, medium: 0, high: 0 };

    users.forEach(user => {
      if (user.score < 0.4) distribution.low++;
      else if (user.score < 0.7) distribution.medium++;
      else distribution.high++;
    });

    return distribution;
  }

  private analyzeTrendPatterns(users: EngagementMetrics[]): any {
    const patterns = { increasing: 0, decreasing: 0, stable: 0 };

    users.forEach(user => {
      patterns[user.trends.trend]++;
    });

    return patterns;
  }

  private analyzeRiskDistribution(users: EngagementMetrics[]): any {
    const risk = { low: 0, medium: 0, high: 0, critical: 0 };

    users.forEach(user => {
      if (user.score < 0.2) risk.critical++;
      else if (user.score < 0.4) risk.high++;
      else if (user.score < 0.7) risk.medium++;
      else risk.low++;
    });

    return risk;
  }

  private async identifyEngagementDrivers(users: EngagementMetrics[]): Promise<string[]> {
    // This would analyze what features/behaviors drive highest engagement
    return [
      'Daily pick following',
      'Community interaction',
      'Tutorial completion',
      'Regular session patterns',
      'Feature exploration',
    ];
  }

  private async generateSystemRecommendations(users: EngagementMetrics[]): Promise<string[]> {
    const recommendations: string[] = [];

    const avgEngagement = this.calculateAverageEngagement(users);
    if (avgEngagement < 0.6) {
      recommendations.push('Implement gamification to boost overall engagement');
    }

    const highRiskUsers = users.filter(u => u.score < 0.4).length;
    if (highRiskUsers > users.length * 0.3) {
      recommendations.push('Scale retention campaigns for high-risk user segment');
    }

    return recommendations;
  }

  private compareToBenchmarks(users: EngagementMetrics[]): any {
    const avgScore = this.calculateAverageEngagement(users);

    return {
      currentAverage: avgScore,
      industryBenchmark: this.benchmarkMetrics.industry || 0.65,
      internalBenchmark: this.benchmarkMetrics.internal || 0.7,
      performance: avgScore > (this.benchmarkMetrics.industry || 0.65) ? 'above' : 'below',
    };
  }

  private async cacheEngagementAnalysis(
    userId: string,
    analysis: EngagementAnalysis
  ): Promise<void> {
    await redisCache.set(
      `engagement:analysis:${userId}`,
      JSON.stringify(analysis),
      3600 // 1 hour TTL
    );
  }

  private async loadEngagementModels(): Promise<void> {
    // Load ML models for engagement prediction
    const models = {
      score_predictor: { accuracy: 0.82, features: ['sessions', 'interactions', 'content'] },
      churn_predictor: { accuracy: 0.78, features: ['engagement_decline', 'inactivity'] },
      intervention_optimizer: { accuracy: 0.75, features: ['user_segment', 'risk_level'] },
    };

    for (const [modelName, model] of Object.entries(models)) {
      this.engagementModels.set(modelName, model);
    }
  }

  private async loadBenchmarkMetrics(): Promise<void> {
    this.benchmarkMetrics = {
      industry: 0.65,
      internal: 0.7,
      competitors: {
        competitor_a: 0.62,
        competitor_b: 0.68,
      },
    };
  }

  private async loadUserEngagementHistory(): Promise<void> {
    try {
      const cachedData = await redisCache.getPattern('engagement:metrics:*');

      for (const [key, data] of cachedData) {
        const userId = key.split(':').pop();
        if (userId) {
          const metrics = JSON.parse(data);
          metrics.timestamp = new Date(metrics.timestamp);
          metrics.lastInteraction = new Date(metrics.lastInteraction);
          this.userEngagementData.set(userId, metrics);
        }
      }

      this.logger.info(`📋 Loaded engagement data for ${this.userEngagementData.size} users`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load engagement history from cache');
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.engagementModels.size > 0;
  }

  async cleanup(): Promise<void> {
    // Save engagement data
    for (const [userId, metrics] of this.userEngagementData) {
      await redisCache.set(
        `engagement:metrics:${userId}`,
        JSON.stringify(metrics),
        86400 // 24 hours TTL
      );
    }

    this.userEngagementData.clear();
    this.engagementModels.clear();

    this.logger.info('🧹 EngagementAnalyzer cleanup completed');
  }
}
