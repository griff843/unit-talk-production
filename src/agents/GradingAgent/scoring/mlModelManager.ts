import { GradingFeatureSet } from '../../../types/GradingFeatureSet';

export interface MLModelResult {
  score: number;
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
    // Simplified neural network scoring
    const baseScore = this.calculateBaseScore(features);
    const nnAdjustment = this.applyNeuralNetworkLogic(features);
    
    return {
      score: Math.max(0, Math.min(100, baseScore + nnAdjustment)),
      confidence: 0.85,
      featureImportance: this.calculateFeatureImportance(features, 'neuralNetwork')
    };
  }

  /**
   * Score with Gradient Boosting model
   */
  public async scoreWithGradientBoosting(features: GradingFeatureSet): Promise<MLModelResult> {
    // Simplified gradient boosting scoring
    const baseScore = this.calculateBaseScore(features);
    const gbAdjustment = this.applyGradientBoostingLogic(features);
    
    return {
      score: Math.max(0, Math.min(100, baseScore + gbAdjustment)),
      confidence: 0.88,
      featureImportance: this.calculateFeatureImportance(features, 'gradientBoosting')
    };
  }

  /**
   * Score with Random Forest model
   */
  public async scoreWithRandomForest(features: GradingFeatureSet): Promise<MLModelResult> {
    // Simplified random forest scoring
    const baseScore = this.calculateBaseScore(features);
    const rfAdjustment = this.applyRandomForestLogic(features);
    
    return {
      score: Math.max(0, Math.min(100, baseScore + rfAdjustment)),
      confidence: 0.82,
      featureImportance: this.calculateFeatureImportance(features, 'randomForest')
    };
  }

  /**
   * Score with Ensemble model
   */
  public async scoreWithEnsemble(features: GradingFeatureSet): Promise<EnsembleResult> {
    // Get individual model scores
    const [nn, gb, rf] = await Promise.all([
      this.scoreWithNeuralNetwork(features),
      this.scoreWithGradientBoosting(features),
      this.scoreWithRandomForest(features)
    ]);

    // Weighted ensemble
    const weights = { nn: 0.35, gb: 0.40, rf: 0.25  
};
    const ensembleScore = (
      nn.score * weights.nn +
      gb.score * weights.gb +
      rf.score * weights.rf
    );

    // Calculate model agreement
    const scores = [nn.score, gb.score, rf.score];
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    const agreement = Math.max(0, 1 - (variance / 100));

    return {
      score: ensembleScore,
      confidence: (nn.confidence + gb.confidence + rf.confidence) / 3,
      featureImportance: this.combineFeatureImportance([nn, gb, rf]),
      modelContributions: {
        'Neural Network': nn.score * weights.nn,
        'Gradient Boosting': gb.score * weights.gb,
        'Random Forest': rf.score * weights.rf
      },
      agreement
    };
  }

  /**
   * Calculate base score from features
   */
  private calculateBaseScore(features: GradingFeatureSet): number {
    let score = 50; // Base score

    // Core features (normalized to reasonable ranges)
    score += Math.min(10, (features.expectedValue || 0) / 1.5); // 15% EV = 10 points
    score += ((features.matchupRating || 50) - 50) / 5; // 0-100 scale, 50 is neutral
    score += ((features.playerForm || 50) - 50) / 5; // 0-100 scale, 50 is neutral
    score += Math.min(5, Math.abs(features.lineMovement || 0)); // Cap at 5 points

    // Advanced features (normalized)
    score += ((features.marketIntelligence || 50) - 50) / 10; // 0-100 scale
    score += ((features.sharpMoney || 50) - 50) / 10; // 0-100 scale
    score += Math.min(5, Math.abs(features.closingLineValue || 0)); // Cap at 5 points

    // Risk adjustments
    score -= (features.correlationRisk || 0) * 10; // Higher risk reduces score
    score -= (features.volatility || 0) * 10; // Higher volatility reduces score

    return score;
  }

  /**
   * Apply Neural Network specific logic
   */
  private applyNeuralNetworkLogic(features: GradingFeatureSet): number {
    // Neural networks excel at non-linear relationships
    let adjustment = 0;
    
    // Non-linear interactions
    if (features.playerForm && features.matchupRating) {
      adjustment += Math.sqrt(features.playerForm * features.matchupRating) * 0.5;
    }
    
    // Complex feature interactions
    if (features.marketIntelligence && features.sharpMoney) {
      adjustment += (features.marketIntelligence * features.sharpMoney) / 20;
    }
    
    return adjustment;
  }

  /**
   * Apply Gradient Boosting specific logic
   */
  private applyGradientBoostingLogic(features: GradingFeatureSet): number {
    // Gradient boosting excels at feature importance and sequential learning
    let adjustment = 0;
    
    // Sequential feature importance
    if (features.expectedValue && features.expectedValue > 5) {
      adjustment += 3;
    }
    
    if (features.lineMovement && Math.abs(features.lineMovement) > 2) {
      adjustment += 2;
    }
    
    if (features.marketIntelligence && features.marketIntelligence > 7) {
      adjustment += 4;
    }
    
    return adjustment;
  }

  /**
   * Apply Random Forest specific logic
   */
  private applyRandomForestLogic(features: GradingFeatureSet): number {
    // Random Forest excels at handling diverse features and avoiding overfitting
    let adjustment = 0;
    
    // Ensemble of simple rules
    const rules = [
      features.playerForm && features.playerForm > 7 ? 2 : 0,
      features.injuryImpact && features.injuryImpact < 3 ? 1.5 : 0,
      features.weatherImpact && Math.abs(features.weatherImpact) < 2 ? 1 : 0,
      features.venueAdvantage && features.venueAdvantage > 5 ? 1.5 : 0,
      features.motivationalFactors && features.motivationalFactors > 6 ? 1 : 0
    ];
    
    adjustment = rules.reduce((sum, rule) => sum + rule, 0);
    
    return adjustment;
  }

  /**
   * Calculate feature importance for a specific model
   */
  private calculateFeatureImportance(features: GradingFeatureSet, modelType: string): Record<string, number> {
    // Calculate feature importance based on model type
    const importance: Record<string, number> = {};

    if (modelType === 'neuralNetwork') {
      // Neural network feature importance
      if (features.expectedValue !== undefined) {
        importance['expectedValue'] = 0.25;
      }
      if (features.marketIntelligence !== undefined) {
        importance['marketIntelligence'] = 0.20;
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
        importance['expectedValue'] = 0.30;
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
        importance['injuryImpact'] = 0.10;
      }
    } else if (modelType === 'randomForest') {
      // Random forest feature importance
      if (features.playerForm !== undefined) {
        importance['playerForm'] = 0.22;
      }
      if (features.expectedValue !== undefined) {
        importance['expectedValue'] = 0.20;
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
    const weights = [0.35, 0.40, 0.25]; // NN, GB, RF weights

    results.forEach((result, index) => {
      if (result.featureImportance) {
        Object.entries(result.featureImportance).forEach(([feature, importance]) => {
          if (!combined[feature]) combined[feature] = 0;
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
}