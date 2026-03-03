import { GradingFeatureSet } from '../../../types/GradingFeatureSet';

/**
 * Safe mathematical operations to prevent NaN errors in ML calculations
 */
function safeNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

function safeMultiply(a: any, b: any, defaultA: number = 0, defaultB: number = 1): number {
  const numA = safeNumber(a, defaultA);
  const numB = safeNumber(b, defaultB);
  const result = numA * numB;
  return isNaN(result) || !isFinite(result) ? 0 : result;
}

function safeDivide(numerator: any, denominator: any, defaultValue: number = 0): number {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 1);
  if (den === 0) return defaultValue;
  const result = num / den;
  return isNaN(result) || !isFinite(result) ? defaultValue : result;
}

export interface MLModelResult {
  score: number;
  professional_score?: number;
  confidence: number;
  featureImportance?: Record<string, number>;
}

export interface EnsembleResult extends MLModelResult {
  modelContributions: Record<string, number>;
  agreement: number;
}

/**
 * ML Model Manager for Fortune 100 Syndicate Level
 * Manages ensemble of ML models for advanced prop scoring
 */
export class MLModelManager {
  private modelVersions: Map<string, string> = new Map();
  private modelCache: Map<string, any> = new Map();

  constructor() {
    this.initializeCache();
    this.initializeModels();
  }

  /**
   * Initialize ML models
   */
  private initializeModels(): void {
    this.modelVersions.set('neuralNetwork', '2025.07.08-v1');
    this.modelVersions.set('gradientBoosting', '2025.07.08-v1');
    this.modelVersions.set('randomForest', '2025.07.08-v1');
    this.modelVersions.set('ensemble', '2025.07.08-v1');
  }

  /**
   * Score with Neural Network model
   */
  public async scoreWithNeuralNetwork(features: GradingFeatureSet): Promise<MLModelResult> {
    try {
      // Simplified neural network scoring with safe operations
      const baseScore = this.calculateBaseScore(features);
      const nnAdjustment = this.applyNeuralNetworkLogic(features);

      const finalScore = safeNumber(baseScore + nnAdjustment, 50);
      const clampedScore = Math.max(0, Math.min(100, finalScore));

      return {
        score: clampedScore,
        confidence: 0.85,
        featureImportance: this.calculateFeatureImportance(features, 'neuralNetwork'),
      };
    } catch (error) {
      console.warn('scoreWithNeuralNetwork failed:', error);
      return {
        score: 50,
        confidence: 0.5,
        featureImportance: {},
      };
    }
  }

  /**
   * Score with Gradient Boosting model
   */
  public async scoreWithGradientBoosting(features: GradingFeatureSet): Promise<MLModelResult> {
    try {
      // Simplified gradient boosting scoring with safe operations
      const baseScore = this.calculateBaseScore(features);
      const gbAdjustment = this.applyGradientBoostingLogic(features);

      const finalScore = safeNumber(baseScore + gbAdjustment, 50);
      const clampedScore = Math.max(0, Math.min(100, finalScore));

      return {
        score: clampedScore,
        confidence: 0.88,
        featureImportance: this.calculateFeatureImportance(features, 'gradientBoosting'),
      };
    } catch (error) {
      console.warn('scoreWithGradientBoosting failed:', error);
      return {
        score: 50,
        confidence: 0.5,
        featureImportance: {},
      };
    }
  }

  /**
   * Score with Random Forest model
   */
  public async scoreWithRandomForest(features: GradingFeatureSet): Promise<MLModelResult> {
    try {
      // Simplified random forest scoring with safe operations
      const baseScore = this.calculateBaseScore(features);
      const rfAdjustment = this.applyRandomForestLogic(features);

      const finalScore = safeNumber(baseScore + rfAdjustment, 50);
      const clampedScore = Math.max(0, Math.min(100, finalScore));

      return {
        score: clampedScore,
        confidence: 0.82,
        featureImportance: this.calculateFeatureImportance(features, 'randomForest'),
      };
    } catch (error) {
      console.warn('scoreWithRandomForest failed:', error);
      return {
        score: 50,
        confidence: 0.5,
        featureImportance: {},
      };
    }
  }

  /**
   * Score with Ensemble model
   */
  public async scoreWithEnsemble(features: GradingFeatureSet): Promise<EnsembleResult> {
    // Get individual model scores
    const [nn, gb, rf] = await Promise.all([
      this.scoreWithNeuralNetwork(features),
      this.scoreWithGradientBoosting(features),
      this.scoreWithRandomForest(features),
    ]);

    // Weighted ensemble
    const weights = { nn: 0.35, gb: 0.4, rf: 0.25 };
    const ensembleScore = nn.score * weights.nn + gb.score * weights.gb + rf.score * weights.rf;

    // Calculate model agreement
    const scores = [nn.score, gb.score, rf.score];
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance =
      scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    const agreement = Math.max(0, 1 - variance / 100);

    return {
      score: ensembleScore,
      confidence: (nn.confidence + gb.confidence + rf.confidence) / 3,
      featureImportance: this.combineFeatureImportance([nn, gb, rf]),
      modelContributions: {
        'Neural Network': nn.professional_score * weights.nn,
        'Gradient Boosting': gb.professional_score * weights.gb,
        'Random Forest': rf.professional_score * weights.rf,
      },
      agreement,
    };
  }

  /**
   * Calculate base professional_score from features with safe mathematical operations
   */
  public calculateBaseScore(features: GradingFeatureSet): number {
    let professional_score = 50; // Base professional_score

    try {
      // Core features (normalized to reasonable ranges)
      // Expected Value: Handle small percentages correctly
      const evValue = safeNumber(features.expectedValue, 0);
      if (evValue !== 0) {
        // Convert to percentage if it's a decimal (e.g., 0.0217 -> 2.17%)
        const evPercentage = evValue < 1 ? evValue * 100 : evValue;
        professional_score += Math.min(10, Math.max(-5, evPercentage / 1.5)); // 15% EV = 10 points, negative EV reduces professional_score
      }

      // Matchup Rating: 0-100 scale, 50 is neutral
      const matchupValue = safeNumber(features.matchupRating, 50);
      professional_score += (matchupValue - 50) / 5; // Scale to +/- 10 points

      // Player Form: 0-100 scale, 50 is neutral
      const formValue = safeNumber(features.playerForm, 50);
      professional_score += (formValue - 50) / 5; // Scale to +/- 10 points

      // Line Movement: Higher absolute movement is better
      const lineMovement = safeNumber(features.lineMovement, 0);
      professional_score += Math.min(5, Math.abs(lineMovement)); // Cap at 5 points

      // Advanced features (normalized)
      // Market Intelligence: 0-100 scale, 50 is neutral
      const marketIntel = safeNumber(features.marketIntelligence, 50);
      professional_score += (marketIntel - 50) / 10; // Scale to +/- 5 points

      // Sharp Money: 0-100 scale, 50 is neutral
      const sharpMoney = safeNumber(features.sharpMoney, 50);
      professional_score += (sharpMoney - 50) / 10; // Scale to +/- 5 points

      // Closing Line Value: Higher is better
      const closingLineValue = safeNumber(features.closingLineValue, 0);
      professional_score += Math.min(5, Math.abs(closingLineValue)); // Cap at 5 points

      // Risk adjustments
      // Correlation Risk: 0-1 scale, lower is better
      const correlationRisk = safeNumber(features.correlationRisk, 0);
      professional_score -= correlationRisk * 10; // Higher risk reduces professional_score

      // Volatility: varies by sport, but generally lower is better
      const volatility = safeNumber(features.volatility, 5);
      if (volatility > 0) {
        professional_score -= Math.min(5, volatility); // Reduce professional_score for high volatility
      }

      // Portfolio Impact: 0-1 scale, lower is better
      const portfolioImpact = safeNumber(features.portfolioImpact, 0);
      professional_score -= portfolioImpact * 10; // Higher impact reduces professional_score

      // Ensure professional_score stays within reasonable bounds
      professional_score = Math.max(0, Math.min(100, professional_score));

      return safeNumber(professional_score, 50);
    } catch (error) {
      console.warn('calculateBaseScore failed, using default:', error);
      return 50; // Safe fallback
    }
  }

  /**
   * Apply Neural Network specific logic
   */
  private applyNeuralNetworkLogic(features: GradingFeatureSet): number {
    // Neural networks excel at non-linear relationships
    let adjustment = 0;

    try {
      // Non-linear interactions - use safe operations
      const playerForm = safeNumber(features.playerForm, 50);
      const matchupRating = safeNumber(features.matchupRating, 50);
      if (playerForm > 0 && matchupRating > 0) {
        adjustment += Math.sqrt(playerForm * matchupRating) * 0.05; // Reduced multiplier
      }

      // Complex feature interactions
      const marketIntel = safeNumber(features.marketIntelligence, 50);
      const sharpMoney = safeNumber(features.sharpMoney, 50);
      if (marketIntel > 0 && sharpMoney > 0) {
        adjustment += (marketIntel * sharpMoney) / 2000; // Scale down significantly
      }

      // Expected value boost for neural network
      const evValue = safeNumber(features.expectedValue, 0);
      const evPercentage = evValue < 1 ? evValue * 100 : evValue;
      if (evPercentage > 0) {
        adjustment += Math.min(2, evPercentage / 5); // Cap at 2 points
      }

      return safeNumber(adjustment, 0);
    } catch (error) {
      console.warn('applyNeuralNetworkLogic failed:', error);
      return 0;
    }
  }

  /**
   * Apply Gradient Boosting specific logic
   */
  private applyGradientBoostingLogic(features: GradingFeatureSet): number {
    // Gradient boosting excels at feature importance and sequential learning
    let adjustment = 0;

    try {
      // Sequential feature importance with proper thresholds
      const evValue = safeNumber(features.expectedValue, 0);
      const evPercentage = evValue < 1 ? evValue * 100 : evValue;
      if (evPercentage > 2) {
        // 2% threshold
        adjustment += Math.min(3, evPercentage / 3);
      }

      const lineMovement = safeNumber(features.lineMovement, 0);
      if (Math.abs(lineMovement) > 1) {
        // 1 point threshold
        adjustment += Math.min(2, Math.abs(lineMovement) / 2);
      }

      const marketIntel = safeNumber(features.marketIntelligence, 50);
      if (marketIntel > 70) {
        // Above 70 threshold
        adjustment += Math.min(4, (marketIntel - 70) / 7.5);
      }

      const sharpMoney = safeNumber(features.sharpMoney, 50);
      if (sharpMoney > 65) {
        // Above 65 threshold
        adjustment += Math.min(2, (sharpMoney - 65) / 17.5);
      }

      return safeNumber(adjustment, 0);
    } catch (error) {
      console.warn('applyGradientBoostingLogic failed:', error);
      return 0;
    }
  }

  /**
   * Apply Random Forest specific logic
   */
  private applyRandomForestLogic(features: GradingFeatureSet): number {
    // Random Forest excels at handling diverse features and avoiding overfitting
    let adjustment = 0;

    try {
      // Ensemble of simple rules with safe operations
      const rules = [
        safeNumber(features.playerForm, 50) > 70 ? 1.5 : 0,
        safeNumber(features.injuryImpact, 0) < 2 ? 1 : 0,
        Math.abs(safeNumber(features.weatherImpact, 0)) < 1 ? 0.5 : 0,
        safeNumber(features.venueAdvantage, 0) > 3 ? 1 : 0,
        safeNumber(features.motivationalFactors, 0) > 4 ? 0.5 : 0,
        safeNumber(features.matchupRating, 50) > 75 ? 1.5 : 0,
        safeNumber(features.closingLineValue, 0) > 2 ? 1 : 0,
      ];

      adjustment = rules.reduce((sum, rule) => sum + rule, 0);

      return safeNumber(adjustment, 0);
    } catch (error) {
      console.warn('applyRandomForestLogic failed:', error);
      return 0;
    }
  }

  /**
   * Calculate feature importance for a specific model
   */
  private calculateFeatureImportance(
    features: GradingFeatureSet,
    modelType: string
  ): Record<string, number> {
    // Calculate feature importance based on model type
    const importance: Record<string, number> = {};

    if (modelType === 'neuralNetwork') {
      // Neural network feature importance
      if (features.expectedValue !== undefined) {
        importance['expectedValue'] = 0.25;
      }
      if (features.marketIntelligence !== undefined) {
        importance['marketIntelligence'] = 0.2;
      }
      if (features.playerForm !== undefined) {
        importance['playerForm'] = 0.15;
      }
      if (features.matchupRating !== undefined) {
        importance['matchupRating'] = 0.15;
      }
      if (features.sharpMoney !== undefined) {
        importance['sharpMoney'] = 0.12;
      }
      if (features.closingLineValue !== undefined) {
        importance['closingLineValue'] = 0.13;
      }
    } else if (modelType === 'gradientBoosting') {
      // Gradient boosting feature importance
      if (features.expectedValue !== undefined) {
        importance['expectedValue'] = 0.3;
      }
      if (features.lineMovement !== undefined) {
        importance['lineMovement'] = 0.18;
      }
      if (features.marketIntelligence !== undefined) {
        importance['marketIntelligence'] = 0.16;
      }
      if (features.playerForm !== undefined) {
        importance['playerForm'] = 0.14;
      }
      if (features.matchupRating !== undefined) {
        importance['matchupRating'] = 0.12;
      }
      if (features.injuryImpact !== undefined) {
        importance['injuryImpact'] = 0.1;
      }
    } else if (modelType === 'randomForest') {
      // Random forest feature importance
      if (features.playerForm !== undefined) {
        importance['playerForm'] = 0.22;
      }
      if (features.expectedValue !== undefined) {
        importance['expectedValue'] = 0.2;
      }
      if (features.matchupRating !== undefined) {
        importance['matchupRating'] = 0.18;
      }
      if (features.venueAdvantage !== undefined) {
        importance['venueAdvantage'] = 0.15;
      }
      if (features.motivationalFactors !== undefined) {
        importance['motivationalFactors'] = 0.12;
      }
      if (features.weatherImpact !== undefined) {
        importance['weatherImpact'] = 0.13;
      }
    }

    return importance;
  }

  /**
   * Combine feature importance from multiple models
   */
  private combineFeatureImportance(results: MLModelResult[]): Record<string, number> {
    const combined: Record<string, number> = {};
    const weights = [0.35, 0.4, 0.25]; // NN, GB, RF weights

    results.forEach((result, index) => {
      if (result.featureImportance) {
        Object.entries(result.featureImportance).forEach(([feature, importance]) => {
          if (!combined[feature]) {
            combined[feature] = 0;
          }
          combined[feature] += (importance as number) * (weights[index] || 0);
        });
      }
    });

    return combined;
  }

  /**
   * Get model version
   */
  public getModelVersion(): string {
    return this.modelVersions.get('ensemble') || '2025.07.08-v1';
  }

  /**
   * Update model version
   */
  public updateModelVersion(modelName: string, version: string): void {
    this.modelVersions.set(modelName, version);
  }

  /**
   * Get all model versions
   */
  public getModelVersions(): Record<string, string> {
    return Object.fromEntries(this.modelVersions);
  }

  private initializeCache(): void {
    // Initialize model cache with TTL
    this.modelCache = new Map();

    // Set up cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Clean every 5 minutes
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.modelCache.entries()) {
      if (now - value.timestamp > 1800000) {
        // 30 min TTL
        this.modelCache.delete(key);
      }
    }
  }
}
