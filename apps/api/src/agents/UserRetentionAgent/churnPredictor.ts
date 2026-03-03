import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface ChurnPrediction {
  userId: string;
  riskScore: number; // 0-1 scale
  probability: number; // 0-1 probability of churning in next 30 days
  timeToChurn: number; // estimated days until churn
  riskFactors: string[];
  confidence: number; // confidence in prediction
  modelVersion: string;
  timestamp: Date;
}

interface UserChurnFeatures {
  // Engagement features
  daysActive: number;
  daysSinceLastLogin: number;
  sessionFrequency: number;
  avgSessionDuration: number;
  featureUsage: Record<string, number>;

  // Behavioral features
  supportTickets: number;
  negativeFeedback: number;
  paymentIssues: number;
  downgrades: number;

  // Usage patterns
  weekdayActivity: number;
  weekendActivity: number;
  timeOfDayPattern: number[];
  consistencyScore: number;

  // Value indicators
  subscription_tier: string;
  monthlyValue: number;
  lifetimeValue: number;
  paymentHistory: string;

  // Social indicators
  referrals: number;
  communityParticipation: number;
  helpfulness: number;
}

interface ChurnModel {
  name: string;
  version: string;
  accuracy: number;
  features: string[];
  weights: Record<string, number>;
  thresholds: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
  };
}

export class ChurnPredictor {
  private readonly logger: Logger;
  private models: Map<string, ChurnModel> = new Map();
  private featureCache: Map<string, UserChurnFeatures> = new Map();
  private predictionCache: Map<string, ChurnPrediction> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('🔮 Initializing ChurnPredictor');

    await this.loadChurnModels();
    await this.loadFeatureCache();

    this.logger.info('✅ ChurnPredictor initialized');
  }

  async predictChurn(userId: string, userData: any): Promise<ChurnPrediction> {
    try {
      // Extract features
      const features = await this.extractUserFeatures(userId, userData);

      // Get prediction from ensemble of models
      const ensemblePrediction = await this.getEnsemblePrediction(features);

      // Identify risk factors
      const riskFactors = await this.identifyRiskFactors(features);

      // Calculate time to churn
      const timeToChurn = await this.estimateTimeToChurn(features, ensemblePrediction.riskScore);

      const prediction: ChurnPrediction = {
        userId,
        riskScore: ensemblePrediction.riskScore,
        probability: ensemblePrediction.probability,
        timeToChurn,
        riskFactors,
        confidence: ensemblePrediction.confidence,
        modelVersion: 'ensemble_v2.1',
        timestamp: new Date(),
      };

      // Cache prediction
      this.predictionCache.set(userId, prediction);
      await redisCache.set(
        `churn:prediction:${userId}`,
        JSON.stringify(prediction),
        3600 // 1 hour TTL
      );

      this.logger.debug('🎯 Churn prediction generated', {
        userId,
        riskScore: prediction.riskScore,
        probability: prediction.probability,
        timeToChurn: prediction.timeToChurn,
      });

      return prediction;
    } catch (error) {
      this.logger.error('❌ Failed to predict churn', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return conservative prediction on error
      return this.getConservativePrediction(userId);
    }
  }

  async calculateRiskScore(userId: string, currentData: any): Promise<number> {
    try {
      const features = await this.extractUserFeatures(userId, currentData);
      const prediction = await this.getEnsemblePrediction(features);
      return prediction.riskScore;
    } catch (error) {
      this.logger.warn('⚠️ Failed to calculate risk professional_score, returning default', {
        userId,
      });
      return 0.5; // Default neutral risk
    }
  }

  async batchPredict(userIds: string[]): Promise<Map<string, ChurnPrediction>> {
    const predictions = new Map<string, ChurnPrediction>();
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async userId => {
        try {
          const prediction = await this.predictChurn(userId, {});
          return { userId, prediction };
        } catch (error) {
          this.logger.warn('⚠️ Failed to predict churn in batch', { userId });
          return { userId, prediction: this.getConservativePrediction(userId) };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const { userId, prediction } of batchResults) {
        predictions.set(userId, prediction);
      }
    }

    return predictions;
  }

  // Feature Extraction
  private async extractUserFeatures(userId: string, userData: any): Promise<UserChurnFeatures> {
    // Check cache first
    const cached = this.featureCache.get(userId);
    if (cached) {
      return cached;
    }

    const features: UserChurnFeatures = {
      // Engagement features
      daysActive: await this.calculateDaysActive(userId),
      daysSinceLastLogin: await this.calculateDaysSinceLastLogin(userId),
      sessionFrequency: await this.calculateSessionFrequency(userId),
      avgSessionDuration: await this.calculateAvgSessionDuration(userId),
      featureUsage: await this.getFeatureUsage(userId),

      // Behavioral features
      supportTickets: await this.countSupportTickets(userId),
      negativeFeedback: await this.countNegativeFeedback(userId),
      paymentIssues: await this.countPaymentIssues(userId),
      downgrades: await this.countDowngrades(userId),

      // Usage patterns
      weekdayActivity: await this.calculateWeekdayActivity(userId),
      weekendActivity: await this.calculateWeekendActivity(userId),
      timeOfDayPattern: await this.getTimeOfDayPattern(userId),
      consistencyScore: await this.calculateConsistencyScore(userId),

      // Value indicators
      subscription_tier: userData.tier || 'free',
      monthlyValue: await this.getMonthlyValue(userId),
      lifetimeValue: await this.getLifetimeValue(userId),
      paymentHistory: await this.getPaymentHistory(userId),

      // Social indicators
      referrals: await this.countReferrals(userId),
      communityParticipation: await this.getCommunityParticipation(userId),
      helpfulness: await this.getHelpfulnessScore(userId),
    };

    // Cache features
    this.featureCache.set(userId, features);

    return features;
  }

  // Model Predictions
  private async getEnsemblePrediction(features: UserChurnFeatures): Promise<{
    riskScore: number;
    probability: number;
    confidence: number;
  }> {
    const predictions: Array<{ score: number; weight: number }> = [];

    // Logistic Regression Model
    const logisticPrediction = await this.getLogisticPrediction(features);
    predictions.push({ score: logisticPrediction, weight: 0.3 });

    // Random Forest Model
    const forestPrediction = await this.getRandomForestPrediction(features);
    predictions.push({ score: forestPrediction, weight: 0.25 });

    // Neural Network Model
    const neuralPrediction = await this.getNeuralNetworkPrediction(features);
    predictions.push({ score: neuralPrediction, weight: 0.25 });

    // Gradient Boosting Model
    const gradientPrediction = await this.getGradientBoostingPrediction(features);
    predictions.push({ score: gradientPrediction, weight: 0.2 });

    // Calculate weighted ensemble score
    const totalWeight = predictions.reduce((sum, p) => sum + p.weight, 0);
    const weightedScore = predictions.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight;

    // Calculate confidence based on prediction agreement
    const variance =
      predictions.reduce((sum, p) => sum + Math.pow(p.score - weightedScore, 2), 0) /
      predictions.length;
    const confidence = Math.max(0.1, 1 - Math.sqrt(variance));

    return {
      riskScore: Math.max(0, Math.min(1, weightedScore)),
      probability: this.convertRiskToProbability(weightedScore),
      confidence,
    };
  }

  private async getLogisticPrediction(features: UserChurnFeatures): Promise<number> {
    // Simplified logistic regression implementation
    const weights = {
      daysSinceLastLogin: 0.15,
      sessionFrequency: -0.12,
      supportTickets: 0.08,
      negativeFeedback: 0.1,
      paymentIssues: 0.2,
      consistencyScore: -0.09,
      lifetimeValue: -0.11,
      communityParticipation: -0.07,
    };

    let logit = -1.2; // intercept

    logit += weights.daysSinceLastLogin * Math.min(features.daysSinceLastLogin / 30, 1);
    logit += weights.sessionFrequency * Math.max(0, 1 - features.sessionFrequency / 10);
    logit += weights.supportTickets * Math.min(features.supportTickets / 5, 1);
    logit += weights.negativeFeedback * Math.min(features.negativeFeedback / 3, 1);
    logit += weights.paymentIssues * Math.min(features.paymentIssues / 2, 1);
    logit += weights.consistencyScore * features.consistencyScore;
    logit += weights.lifetimeValue * Math.min(features.lifetimeValue / 1000, 1);
    logit += weights.communityParticipation * Math.min(features.communityParticipation / 10, 1);

    return 1 / (1 + Math.exp(-logit));
  }

  private async getRandomForestPrediction(features: UserChurnFeatures): Promise<number> {
    // Simplified decision tree ensemble
    const trees = [
      this.evaluateTree1(features),
      this.evaluateTree2(features),
      this.evaluateTree3(features),
      this.evaluateTree4(features),
      this.evaluateTree5(features),
    ];

    return trees.reduce((sum, professional_score) => sum + professional_score, 0) / trees.length;
  }

  private async getNeuralNetworkPrediction(features: UserChurnFeatures): Promise<number> {
    // Simplified neural network (3 layers)
    const inputs = this.normalizeFeatures(features);

    // Hidden layer 1 (5 neurons)
    const h1 = this.relu([
      0.2 * inputs[0] - 0.1 * inputs[1] + 0.3 * inputs[2] - 0.4,
      -0.3 * inputs[0] + 0.4 * inputs[1] + 0.1 * inputs[2] + 0.2,
      0.1 * inputs[0] + 0.2 * inputs[1] - 0.3 * inputs[2] + 0.1,
      -0.2 * inputs[0] - 0.1 * inputs[1] + 0.4 * inputs[2] - 0.2,
      0.3 * inputs[0] + 0.3 * inputs[1] + 0.2 * inputs[2] + 0.1,
    ]);

    // Hidden layer 2 (3 neurons)
    const h2 = this.relu([
      0.4 * h1[0] - 0.2 * h1[1] + 0.1 * h1[2] + 0.3 * h1[3] - 0.1 * h1[4] + 0.2,
      -0.1 * h1[0] + 0.3 * h1[1] - 0.2 * h1[2] + 0.4 * h1[3] + 0.2 * h1[4] - 0.3,
      0.2 * h1[0] + 0.1 * h1[1] + 0.3 * h1[2] - 0.4 * h1[3] + 0.1 * h1[4] + 0.1,
    ]);

    // Output layer (1 neuron with sigmoid)
    const output = 0.5 * h2[0] + 0.3 * h2[1] - 0.2 * h2[2] + 0.1;
    return 1 / (1 + Math.exp(-output));
  }

  private async getGradientBoostingPrediction(features: UserChurnFeatures): Promise<number> {
    // Simplified gradient boosting (3 weak learners)
    let prediction = 0.5; // base prediction

    // Weak learner 1: focus on engagement
    if (features.daysSinceLastLogin > 7) prediction += 0.15;
    if (features.sessionFrequency < 2) prediction += 0.1;
    if (features.avgSessionDuration < 300) prediction += 0.08; // 5 minutes

    // Weak learner 2: focus on support issues
    if (features.supportTickets > 2) prediction += 0.12;
    if (features.negativeFeedback > 0) prediction += 0.1;
    if (features.paymentIssues > 0) prediction += 0.15;

    // Weak learner 3: focus on value and loyalty
    if (features.lifetimeValue < 100) prediction += 0.08;
    if (features.referrals === 0) prediction += 0.05;
    if (features.communityParticipation < 2) prediction += 0.06;

    return Math.max(0, Math.min(1, prediction));
  }

  // Risk Factor Identification
  private async identifyRiskFactors(features: UserChurnFeatures): Promise<string[]> {
    const riskFactors: string[] = [];

    // Engagement risk factors
    if (features.daysSinceLastLogin > 7) {
      riskFactors.push('Inactive for over a week');
    }
    if (features.sessionFrequency < 2) {
      riskFactors.push('Low session frequency');
    }
    if (features.avgSessionDuration < 300) {
      riskFactors.push('Short session duration');
    }

    // Support and satisfaction risk factors
    if (features.supportTickets > 2) {
      riskFactors.push('Multiple support tickets');
    }
    if (features.negativeFeedback > 0) {
      riskFactors.push('Negative feedback submitted');
    }
    if (features.paymentIssues > 0) {
      riskFactors.push('Payment issues encountered');
    }

    // Usage pattern risk factors
    if (features.consistencyScore < 0.3) {
      riskFactors.push('Inconsistent usage pattern');
    }
    if (features.weekdayActivity === 0 && features.weekendActivity === 0) {
      riskFactors.push('No recent activity');
    }

    // Value and engagement risk factors
    if (features.lifetimeValue < 50) {
      riskFactors.push('Low lifetime value');
    }
    if (features.communityParticipation === 0) {
      riskFactors.push('No community engagement');
    }
    if (features.referrals === 0 && features.daysActive > 30) {
      riskFactors.push('No referrals after 30 days');
    }

    // Tier-specific risk factors
    if (features.subscription_tier === 'free' && features.daysActive > 14) {
      riskFactors.push('Long-term free user');
    }
    if (features.downgrades > 0) {
      riskFactors.push('Recent subscription downgrade');
    }

    return riskFactors;
  }

  private async estimateTimeToChurn(
    features: UserChurnFeatures,
    riskScore: number
  ): Promise<number> {
    // Base time estimates by risk level
    let baseDays = 30; // Default 30 days

    if (riskScore > 0.8)
      baseDays = 7; // Very high risk
    else if (riskScore > 0.6)
      baseDays = 14; // High risk
    else if (riskScore > 0.4)
      baseDays = 21; // Medium risk
    else baseDays = 60; // Low risk

    // Adjust based on specific factors
    if (features.paymentIssues > 0) baseDays *= 0.5; // Payment issues accelerate churn
    if (features.supportTickets > 2) baseDays *= 0.7; // Multiple tickets indicate frustration
    if (features.lifetimeValue > 500) baseDays *= 1.5; // High value users take longer to churn
    if (features.communityParticipation > 5) baseDays *= 1.3; // Community engagement extends retention

    return Math.max(1, Math.round(baseDays));
  }

  // Helper Methods
  private convertRiskToProbability(riskScore: number): number {
    // Convert risk professional_score to 30-day churn probability
    return Math.max(0, Math.min(1, riskScore * 0.8 + 0.1));
  }

  private normalizeFeatures(features: UserChurnFeatures): number[] {
    return [
      Math.min(features.daysSinceLastLogin / 30, 1),
      Math.min(features.sessionFrequency / 10, 1),
      Math.min(features.supportTickets / 5, 1),
      Math.min(features.lifetimeValue / 1000, 1),
      features.consistencyScore,
    ];
  }

  private relu(values: number[]): number[] {
    return values.map(v => Math.max(0, v));
  }

  private evaluateTree1(features: UserChurnFeatures): number {
    if (features.daysSinceLastLogin > 14) return 0.8;
    if (features.sessionFrequency < 1) return 0.7;
    if (features.supportTickets > 3) return 0.6;
    return 0.2;
  }

  private evaluateTree2(features: UserChurnFeatures): number {
    if (features.paymentIssues > 0) return 0.9;
    if (features.negativeFeedback > 1) return 0.7;
    if (features.lifetimeValue < 50) return 0.5;
    return 0.1;
  }

  private evaluateTree3(features: UserChurnFeatures): number {
    if (features.consistencyScore < 0.2) return 0.8;
    if (features.avgSessionDuration < 180) return 0.6;
    if (features.communityParticipation === 0) return 0.4;
    return 0.2;
  }

  private evaluateTree4(features: UserChurnFeatures): number {
    if (features.downgrades > 0) return 0.7;
    if (features.subscription_tier === 'free' && features.daysActive > 21) return 0.5;
    if (features.referrals === 0 && features.daysActive > 30) return 0.4;
    return 0.1;
  }

  private evaluateTree5(features: UserChurnFeatures): number {
    if (features.weekdayActivity === 0 && features.weekendActivity === 0) return 0.9;
    if (features.featureUsage && Object.keys(features.featureUsage).length < 2) return 0.6;
    if (features.helpfulness < 1) return 0.3;
    return 0.1;
  }

  // Feature calculation methods (simplified - would integrate with actual data sources)
  private async calculateDaysActive(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:days_active:${userId}`);
    return cached ? parseInt(cached) : 30; // Default to 30 days
  }

  private async calculateDaysSinceLastLogin(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:last_login:${userId}`);
    if (cached) {
      const lastLogin = new Date(cached);
      return Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 1; // Default to 1 day
  }

  private async calculateSessionFrequency(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:session_freq:${userId}`);
    return cached ? parseFloat(cached) : 5; // Default to 5 sessions per week
  }

  private async calculateAvgSessionDuration(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:avg_session_duration:${userId}`);
    return cached ? parseFloat(cached) : 600; // Default to 10 minutes
  }

  private async getFeatureUsage(userId: string): Promise<Record<string, number>> {
    const cached = await redisCache.get(`user:feature_usage:${userId}`);
    return cached ? JSON.parse(cached) : { picks: 5, alerts: 2, stats: 1 };
  }

  private async countSupportTickets(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:support_tickets:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async countNegativeFeedback(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:negative_feedback:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async countPaymentIssues(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:payment_issues:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async countDowngrades(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:downgrades:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async calculateWeekdayActivity(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:weekday_activity:${userId}`);
    return cached ? parseFloat(cached) : 0.7;
  }

  private async calculateWeekendActivity(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:weekend_activity:${userId}`);
    return cached ? parseFloat(cached) : 0.3;
  }

  private async getTimeOfDayPattern(userId: string): Promise<number[]> {
    const cached = await redisCache.get(`user:time_pattern:${userId}`);
    return cached ? JSON.parse(cached) : new Array(24).fill(0.04); // Even distribution
  }

  private async calculateConsistencyScore(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:consistency:${userId}`);
    return cached ? parseFloat(cached) : 0.5;
  }

  private async getMonthlyValue(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:monthly_value:${userId}`);
    return cached ? parseFloat(cached) : 0;
  }

  private async getLifetimeValue(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:lifetime_value:${userId}`);
    return cached ? parseFloat(cached) : 0;
  }

  private async getPaymentHistory(userId: string): Promise<string> {
    const cached = await redisCache.get(`user:payment_history:${userId}`);
    return cached || 'good';
  }

  private async countReferrals(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:referrals:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async getCommunityParticipation(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:community_participation:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async getHelpfulnessScore(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:helpfulness:${userId}`);
    return cached ? parseFloat(cached) : 0;
  }

  private getConservativePrediction(userId: string): ChurnPrediction {
    return {
      userId,
      riskScore: 0.5,
      probability: 0.4,
      timeToChurn: 30,
      riskFactors: ['Prediction model unavailable'],
      confidence: 0.1,
      modelVersion: 'fallback_v1.0',
      timestamp: new Date(),
    };
  }

  private async loadChurnModels(): Promise<void> {
    // Load model configurations
    const models: ChurnModel[] = [
      {
        name: 'logistic_regression',
        version: '2.1',
        accuracy: 0.78,
        features: ['daysSinceLastLogin', 'sessionFrequency', 'supportTickets'],
        weights: { daysSinceLastLogin: 0.15, sessionFrequency: -0.12, supportTickets: 0.08 },
        thresholds: { low_risk: 0.3, medium_risk: 0.6, high_risk: 0.8 },
      },
    ];

    for (const model of models) {
      this.models.set(model.name, model);
    }
  }

  private async loadFeatureCache(): Promise<void> {
    // Load cached feature data
    try {
      const cachedFeatures = await redisCache.getPattern('churn:features:*');
      for (const [key, data] of cachedFeatures) {
        const userId = key.split(':').pop();
        if (userId) {
          this.featureCache.set(userId, JSON.parse(data));
        }
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load feature cache');
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.models.size > 0;
  }

  async cleanup(): Promise<void> {
    // Save feature cache
    for (const [userId, features] of this.featureCache) {
      await redisCache.set(
        `churn:features:${userId}`,
        JSON.stringify(features),
        3600 // 1 hour TTL
      );
    }

    this.models.clear();
    this.featureCache.clear();
    this.predictionCache.clear();

    this.logger.info('🧹 ChurnPredictor cleanup completed');
  }
}
