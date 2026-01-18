/**
 * Ensemble Coordinator - Phase 13 Model Serving & Ensemble Layer
 *
 * Coordinates ensemble predictions with:
 * - Confidence-weighted blending
 * - Meta-learner (stacked regression) support
 * - Model selection and weighting strategies
 * - Diversity enforcement
 * - Dynamic weight adjustment based on recent performance
 *
 * @module services/ml/EnsembleCoordinator
 * @since Phase 13 - Model Serving & Ensemble Layer
 * @reference Production Charter v3.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { ModelRegistrySync, ModelRegistryEntry } from './ModelRegistrySync';

/**
 * Ensemble blending method
 */
export type EnsembleMethod =
  | 'weighted_average'   // Simple weighted average
  | 'confidence_weighted' // Weight by model confidence
  | 'performance_weighted' // Weight by recent performance
  | 'stacking'           // Meta-learner (stacked regression)
  | 'voting'             // Majority voting
  | 'bayesian';          // Bayesian model averaging

/**
 * Ensemble configuration
 */
export interface EnsembleConfig {
  method: EnsembleMethod;
  minModels: number;
  maxModels: number;
  diversityThreshold: number; // 0-1, minimum diversity required
  confidenceThreshold: number; // 0-1, minimum confidence to include
  enableMetaLearner: boolean;
  metaLearnerModelId?: string;
  weightDecayRate: number; // 0-1, how fast to decay old weights
  performanceLookbackDays: number; // Days to look back for performance
}

/**
 * Model contribution to ensemble
 */
export interface ModelContribution {
  modelId: string;
  modelName: string;
  modelVersion: string;
  prediction: number;
  confidence: number;
  weight: number;
  accuracy: number;
  recentPerformance: number;
}

/**
 * Ensemble prediction result
 */
export interface EnsemblePrediction {
  prediction: number;
  confidence: number;
  version: string;
  contributions: ModelContribution[];
  method: EnsembleMethod;
  diversity: number;
  featureImportance?: Record<string, number>;
  metadata: {
    modelsUsed: number;
    totalModelsAvailable: number;
    ensembleAccuracy: number;
    timestamp: string;
  };
}

/**
 * Meta-learner for stacked ensemble
 */
interface MetaLearner {
  modelId: string;
  weights: number[];
  intercept: number;
  accuracy: number;
  lastTrained: Date;
}

/**
 * Ensemble Coordinator - Manages multi-model ensemble predictions
 *
 * Supports multiple blending strategies:
 * 1. Weighted Average: Simple weighted combination
 * 2. Confidence Weighted: Weight by model confidence
 * 3. Performance Weighted: Weight by recent accuracy
 * 4. Stacking: Meta-learner learns optimal weights
 * 5. Voting: Majority vote with tie-breaking
 * 6. Bayesian: Bayesian model averaging
 */
export class EnsembleCoordinator {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly modelRegistry: ModelRegistrySync;
  private readonly config: EnsembleConfig;
  private metaLearner: MetaLearner | null = null;
  private readonly performanceCache: Map<string, number[]> = new Map();

  constructor(
    logger: Logger,
    supabase: SupabaseClient,
    modelRegistry: ModelRegistrySync,
    config?: Partial<EnsembleConfig>
  ) {
    this.logger = logger;
    this.supabase = supabase;
    this.modelRegistry = modelRegistry;

    // Default configuration
    this.config = {
      method: 'confidence_weighted',
      minModels: 3,
      maxModels: 8,
      diversityThreshold: 0.3,
      confidenceThreshold: 0.5,
      enableMetaLearner: true,
      weightDecayRate: 0.1,
      performanceLookbackDays: 7,
      ...config
    };
  }

  /**
   * Initialize ensemble coordinator
   */
  async initialize(): Promise<void> {
    this.logger.info('[EnsembleCoordinator] Initializing ensemble coordinator...');

    // Load meta-learner if enabled
    if (this.config.enableMetaLearner) {
      await this.loadMetaLearner();
    }

    // Load performance history
    await this.loadPerformanceHistory();

    this.logger.info('[EnsembleCoordinator] Ensemble coordinator initialized', {
      method: this.config.method,
      minModels: this.config.minModels,
      maxModels: this.config.maxModels,
      metaLearnerLoaded: this.metaLearner !== null
    });
  }

  /**
   * Generate ensemble prediction
   *
   * @param features - Input features
   * @param context - Optional context (betType, etc.)
   * @returns Ensemble prediction
   */
  async predict(
    features: Record<string, number>,
    context?: {
      betType?: string;
      confidenceThreshold?: number;
    }
  ): Promise<EnsemblePrediction> {
    this.logger.debug('[EnsembleCoordinator] Generating ensemble prediction');

    const startTime = Date.now();

    try {
      // Get deployed models
      const allModels = await this.modelRegistry.getAllDeployedModels();

      if (allModels.length === 0) {
        throw new Error('No deployed models available for ensemble');
      }

      // Filter models by context (e.g., betType specialization)
      const eligibleModels = this.filterModelsByContext(allModels, context);

      if (eligibleModels.length < this.config.minModels) {
        throw new Error(
          `Insufficient models: ${eligibleModels.length} < ${this.config.minModels}`
        );
      }

      // Generate predictions from all models
      const contributions = await this.generateModelContributions(
        eligibleModels,
        features,
        context
      );

      // Filter by confidence threshold
      const confidenceThreshold = context?.confidenceThreshold || this.config.confidenceThreshold;
      const filteredContributions = contributions.filter(
        c => c.confidence >= confidenceThreshold
      );

      if (filteredContributions.length < this.config.minModels) {
        this.logger.warn('[EnsembleCoordinator] Too few models meet confidence threshold', {
          total: contributions.length,
          filtered: filteredContributions.length,
          threshold: confidenceThreshold
        });
      }

      // Check diversity
      const diversity = this.calculateDiversity(filteredContributions);
      if (diversity < this.config.diversityThreshold) {
        this.logger.warn('[EnsembleCoordinator] Low ensemble diversity', {
          diversity,
          threshold: this.config.diversityThreshold
        });
      }

      // Blend predictions using configured method
      const prediction = await this.blendPredictions(
        filteredContributions,
        features,
        this.config.method
      );

      // Calculate ensemble confidence
      const confidence = this.calculateEnsembleConfidence(filteredContributions);

      // Calculate feature importance (aggregate from all models)
      const featureImportance = this.aggregateFeatureImportance(filteredContributions);

      // Build ensemble prediction result
      const ensemblePrediction: EnsemblePrediction = {
        prediction,
        confidence,
        version: this.generateEnsembleVersion(filteredContributions),
        contributions: filteredContributions,
        method: this.config.method,
        diversity,
        featureImportance,
        metadata: {
          modelsUsed: filteredContributions.length,
          totalModelsAvailable: allModels.length,
          ensembleAccuracy: this.calculateEnsembleAccuracy(filteredContributions),
          timestamp: new Date().toISOString()
        }
      };

      const latency = Date.now() - startTime;

      this.logger.info('[EnsembleCoordinator] Ensemble prediction complete', {
        prediction: ensemblePrediction.prediction,
        confidence: ensemblePrediction.confidence,
        modelsUsed: ensemblePrediction.metadata.modelsUsed,
        diversity,
        latencyMs: latency
      });

      return ensemblePrediction;

    } catch (error) {
      this.logger.error('[EnsembleCoordinator] Ensemble prediction failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Train meta-learner on historical predictions
   *
   * @param trainingData - Historical predictions and outcomes
   */
  async trainMetaLearner(
    trainingData: Array<{
      features: Record<string, number>;
      modelPredictions: Record<string, number>;
      actualOutcome: number;
    }>
  ): Promise<void> {
    this.logger.info('[EnsembleCoordinator] Training meta-learner', {
      samples: trainingData.length
    });

    if (trainingData.length < 100) {
      this.logger.warn('[EnsembleCoordinator] Insufficient training data for meta-learner');
      return;
    }

    try {
      // Get unique model IDs
      const modelIds = Array.from(
        new Set(
          trainingData.flatMap(sample => Object.keys(sample.modelPredictions))
        )
      );

      // Prepare training matrices
      const X: number[][] = []; // Model predictions
      const y: number[] = [];   // Actual outcomes

      for (const sample of trainingData) {
        const row = modelIds.map(id => sample.modelPredictions[id] || 0);
        X.push(row);
        y.push(sample.actualOutcome);
      }

      // Train simple linear regression (in production, use TensorFlow.js or similar)
      const weights = this.fitLinearRegression(X, y);

      // Create meta-learner
      this.metaLearner = {
        modelId: 'meta_learner_' + Date.now(),
        weights: weights.coefficients,
        intercept: weights.intercept,
        accuracy: this.evaluateMetaLearner(X, y, weights),
        lastTrained: new Date()
      };

      // Save meta-learner to database
      await this.saveMetaLearner();

      this.logger.info('[EnsembleCoordinator] Meta-learner trained successfully', {
        modelId: this.metaLearner.modelId,
        accuracy: this.metaLearner.accuracy,
        weights: this.metaLearner.weights.length
      });

    } catch (error) {
      this.logger.error('[EnsembleCoordinator] Meta-learner training failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update model weights based on recent performance
   *
   * @param modelId - Model ID
   * @param accuracy - Recent accuracy
   */
  async updateModelPerformance(modelId: string, accuracy: number): Promise<void> {
    const history = this.performanceCache.get(modelId) || [];
    history.push(accuracy);

    // Keep last N samples
    const maxSamples = 100;
    if (history.length > maxSamples) {
      history.shift();
    }

    this.performanceCache.set(modelId, history);

    // Save to database periodically
    if (history.length % 10 === 0) {
      await this.savePerformanceHistory(modelId, history);
    }
  }

  // Private methods

  private filterModelsByContext(
    models: ModelRegistryEntry[],
    context?: { betType?: string }
  ): ModelRegistryEntry[] {
    if (!context?.betType) {
      return models.slice(0, this.config.maxModels);
    }

    // Filter by model type or specialization
    // In production, this would check model metadata for specialization
    return models.slice(0, this.config.maxModels);
  }

  private async generateModelContributions(
    models: ModelRegistryEntry[],
    features: Record<string, number>,
    context?: any
  ): Promise<ModelContribution[]> {
    const contributions: ModelContribution[] = [];

    for (const model of models) {
      try {
        // Generate prediction from model (simplified)
        const prediction = await this.runModelPrediction(model, features);

        // Get recent performance
        const recentPerformance = this.getRecentPerformance(model.id);

        contributions.push({
          modelId: model.id,
          modelName: model.model_name,
          modelVersion: model.model_version,
          prediction: prediction.value,
          confidence: prediction.confidence,
          weight: this.calculateInitialWeight(model),
          accuracy: model.accuracy || 0.7,
          recentPerformance
        });

      } catch (error) {
        this.logger.warn('[EnsembleCoordinator] Model prediction failed', {
          modelId: model.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return contributions;
  }

  private async blendPredictions(
    contributions: ModelContribution[],
    features: Record<string, number>,
    method: EnsembleMethod
  ): Promise<number> {
    switch (method) {
      case 'weighted_average':
        return this.weightedAverage(contributions);

      case 'confidence_weighted':
        return this.confidenceWeightedAverage(contributions);

      case 'performance_weighted':
        return this.performanceWeightedAverage(contributions);

      case 'stacking':
        return this.stackingPrediction(contributions);

      case 'voting':
        return this.votingPrediction(contributions);

      case 'bayesian':
        return this.bayesianAverage(contributions);

      default:
        return this.weightedAverage(contributions);
    }
  }

  private weightedAverage(contributions: ModelContribution[]): number {
    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
    const weighted = contributions.reduce(
      (sum, c) => sum + c.prediction * c.weight,
      0
    );
    return weighted / totalWeight;
  }

  private confidenceWeightedAverage(contributions: ModelContribution[]): number {
    const totalConfidence = contributions.reduce((sum, c) => sum + c.confidence, 0);
    const weighted = contributions.reduce(
      (sum, c) => sum + c.prediction * c.confidence,
      0
    );
    return weighted / totalConfidence;
  }

  private performanceWeightedAverage(contributions: ModelContribution[]): number {
    const weights = contributions.map(c => {
      const recentPerf = c.recentPerformance || c.accuracy;
      return Math.pow(recentPerf, 2); // Square to emphasize better models
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weighted = contributions.reduce(
      (sum, c, i) => sum + c.prediction * weights[i],
      0
    );

    return weighted / totalWeight;
  }

  private stackingPrediction(contributions: ModelContribution[]): number {
    if (!this.metaLearner) {
      this.logger.warn('[EnsembleCoordinator] Meta-learner not available, falling back to weighted average');
      return this.weightedAverage(contributions);
    }

    // Apply meta-learner weights
    const predictions = contributions.map(c => c.prediction);
    let result = this.metaLearner.intercept;

    for (let i = 0; i < Math.min(predictions.length, this.metaLearner.weights.length); i++) {
      result += predictions[i] * this.metaLearner.weights[i];
    }

    // Ensure result is in valid range [0, 1]
    return Math.max(0, Math.min(1, result));
  }

  private votingPrediction(contributions: ModelContribution[]): number {
    const threshold = 0.5;
    const votes = contributions.map(c => c.prediction > threshold ? 1 : 0);
    const positiveVotes = votes.reduce((sum, v) => sum + v, 0);
    const voteRatio = positiveVotes / votes.length;

    // Convert to probability with smoothing
    return 0.1 + voteRatio * 0.8;
  }

  private bayesianAverage(contributions: ModelContribution[]): number {
    let prior = 0.5; // Neutral prior

    for (const contribution of contributions) {
      const likelihood = contribution.prediction;
      const evidence = contribution.confidence * contribution.accuracy;

      // Bayesian update
      const numerator = prior * likelihood * evidence;
      const denominator = numerator + (1 - prior) * (1 - likelihood) * evidence;

      prior = denominator > 0 ? numerator / denominator : prior;
    }

    return prior;
  }

  private calculateDiversity(contributions: ModelContribution[]): number {
    if (contributions.length < 2) return 0;

    const predictions = contributions.map(c => c.prediction);
    const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
    const variance = predictions.reduce(
      (sum, p) => sum + Math.pow(p - mean, 2),
      0
    ) / predictions.length;

    return Math.sqrt(variance);
  }

  private calculateEnsembleConfidence(contributions: ModelContribution[]): number {
    // Average confidence weighted by model accuracy
    const totalAccuracy = contributions.reduce((sum, c) => sum + c.accuracy, 0);
    const weightedConfidence = contributions.reduce(
      (sum, c) => sum + c.confidence * c.accuracy,
      0
    );

    return weightedConfidence / totalAccuracy;
  }

  private calculateEnsembleAccuracy(contributions: ModelContribution[]): number {
    // Estimate ensemble accuracy (simplified)
    // In production, track actual ensemble performance
    const accuracies = contributions.map(c => c.accuracy);
    const maxAccuracy = Math.max(...accuracies);
    const avgAccuracy = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;

    // Ensemble typically performs between average and best model
    return avgAccuracy + (maxAccuracy - avgAccuracy) * 0.5;
  }

  private aggregateFeatureImportance(
    contributions: ModelContribution[]
  ): Record<string, number> {
    const aggregated: Record<string, number> = {};

    // This would aggregate feature importance from all models
    // For now, return empty (would need access to model feature importance)

    return aggregated;
  }

  private calculateInitialWeight(model: ModelRegistryEntry): number {
    // Initial weight based on model accuracy
    return model.accuracy || 0.5;
  }

  private getRecentPerformance(modelId: string): number {
    const history = this.performanceCache.get(modelId);
    if (!history || history.length === 0) {
      return 0.7; // Default
    }

    // Recent performance with exponential weighting
    let weightedSum = 0;
    let weightTotal = 0;

    for (let i = 0; i < history.length; i++) {
      const weight = Math.pow(1 - this.config.weightDecayRate, history.length - i - 1);
      weightedSum += history[i] * weight;
      weightTotal += weight;
    }

    return weightedSum / weightTotal;
  }

  private async runModelPrediction(
    model: ModelRegistryEntry,
    features: Record<string, number>
  ): Promise<{ value: number; confidence: number }> {
    // Simplified - would call actual model inference
    const featureSum = Object.values(features).reduce((sum, val) => sum + val, 0);
    const featureAvg = featureSum / Object.keys(features).length;

    const prediction = Math.min(0.95, Math.max(0.05, featureAvg / 100));
    const confidence = model.accuracy || 0.7;

    return { value: prediction, confidence };
  }

  private generateEnsembleVersion(contributions: ModelContribution[]): string {
    const versions = contributions.map(c => c.modelVersion).join('_');
    return `ensemble_${this.config.method}_${versions.substring(0, 20)}`;
  }

  private fitLinearRegression(
    X: number[][],
    y: number[]
  ): { coefficients: number[]; intercept: number } {
    // Simplified linear regression using normal equation
    // In production, use proper ML library (TensorFlow.js, etc.)

    const n = X.length;
    const p = X[0].length;

    // Add intercept column
    const X_with_intercept = X.map(row => [1, ...row]);

    // Calculate X^T * X
    const XTX: number[][] = Array(p + 1).fill(0).map(() => Array(p + 1).fill(0));
    for (let i = 0; i < p + 1; i++) {
      for (let j = 0; j < p + 1; j++) {
        for (let k = 0; k < n; k++) {
          XTX[i][j] += X_with_intercept[k][i] * X_with_intercept[k][j];
        }
      }
    }

    // Calculate X^T * y
    const XTy: number[] = Array(p + 1).fill(0);
    for (let i = 0; i < p + 1; i++) {
      for (let k = 0; k < n; k++) {
        XTy[i] += X_with_intercept[k][i] * y[k];
      }
    }

    // Solve (X^T * X)^-1 * X^T * y (simplified - would use proper solver)
    const weights = this.solveLinearSystem(XTX, XTy);

    return {
      intercept: weights[0],
      coefficients: weights.slice(1)
    };
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    // Simplified Gaussian elimination
    // In production, use proper numerical library
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ratio = augmented[j][i] / augmented[i][i];
        for (let k = i; k <= n; k++) {
          augmented[j][k] -= ratio * augmented[i][k];
        }
      }
    }

    // Back substitution
    const x: number[] = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  }

  private evaluateMetaLearner(
    X: number[][],
    y: number[],
    weights: { coefficients: number[]; intercept: number }
  ): number {
    let correct = 0;

    for (let i = 0; i < X.length; i++) {
      let prediction = weights.intercept;
      for (let j = 0; j < X[i].length; j++) {
        prediction += X[i][j] * weights.coefficients[j];
      }

      const predicted = prediction > 0.5 ? 1 : 0;
      const actual = y[i] > 0.5 ? 1 : 0;

      if (predicted === actual) correct++;
    }

    return correct / X.length;
  }

  private async loadMetaLearner(): Promise<void> {
    try {
      if (!this.config.metaLearnerModelId) return;

      const { data, error } = await this.supabase
        .from('meta_learners')
        .select('*')
        .eq('id', this.config.metaLearnerModelId)
        .single();

      if (error || !data) {
        this.logger.debug('[EnsembleCoordinator] No meta-learner found');
        return;
      }

      this.metaLearner = {
        modelId: data.id,
        weights: data.weights,
        intercept: data.intercept,
        accuracy: data.accuracy,
        lastTrained: new Date(data.last_trained)
      };

      this.logger.info('[EnsembleCoordinator] Meta-learner loaded', {
        modelId: this.metaLearner.modelId,
        accuracy: this.metaLearner.accuracy
      });

    } catch (error) {
      this.logger.warn('[EnsembleCoordinator] Failed to load meta-learner', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async saveMetaLearner(): Promise<void> {
    if (!this.metaLearner) return;

    try {
      const { error } = await this.supabase
        .from('meta_learners')
        .upsert({
          id: this.metaLearner.modelId,
          weights: this.metaLearner.weights,
          intercept: this.metaLearner.intercept,
          accuracy: this.metaLearner.accuracy,
          last_trained: this.metaLearner.lastTrained.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      this.logger.error('[EnsembleCoordinator] Failed to save meta-learner', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async loadPerformanceHistory(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.performanceLookbackDays);

      const { data, error } = await this.supabase
        .from('model_performance_history')
        .select('model_id, accuracy')
        .gte('created_at', cutoffDate.toISOString());

      if (error || !data) {
        this.logger.debug('[EnsembleCoordinator] No performance history found');
        return;
      }

      // Group by model_id
      const grouped = data.reduce((acc, row) => {
        if (!acc[row.model_id]) {
          acc[row.model_id] = [];
        }
        acc[row.model_id].push(row.accuracy);
        return acc;
      }, {} as Record<string, number[]>);

      // Load into cache
      for (const [modelId, accuracies] of Object.entries(grouped)) {
        this.performanceCache.set(modelId, accuracies);
      }

      this.logger.info('[EnsembleCoordinator] Performance history loaded', {
        models: Object.keys(grouped).length
      });

    } catch (error) {
      this.logger.warn('[EnsembleCoordinator] Failed to load performance history', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async savePerformanceHistory(
    modelId: string,
    history: number[]
  ): Promise<void> {
    try {
      const records = history.slice(-10).map(accuracy => ({
        model_id: modelId,
        accuracy,
        created_at: new Date().toISOString()
      }));

      const { error } = await this.supabase
        .from('model_performance_history')
        .insert(records);

      if (error) throw error;

    } catch (error) {
      this.logger.debug('[EnsembleCoordinator] Failed to save performance history', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const deployedModels = await this.modelRegistry.getAllDeployedModels();

    const details = {
      deployedModels: deployedModels.length,
      minModelsRequired: this.config.minModels,
      method: this.config.method,
      metaLearnerActive: this.metaLearner !== null,
      performanceModels: this.performanceCache.size
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (deployedModels.length < this.config.minModels) {
      status = 'unhealthy';
    } else if (this.config.enableMetaLearner && !this.metaLearner) {
      status = 'degraded';
    }

    return { status, details };
  }
}

/**
 * Create and initialize Ensemble Coordinator
 */
export async function createEnsembleCoordinator(
  logger: Logger,
  supabase: SupabaseClient,
  modelRegistry: ModelRegistrySync,
  config?: Partial<EnsembleConfig>
): Promise<EnsembleCoordinator> {
  const coordinator = new EnsembleCoordinator(
    logger,
    supabase,
    modelRegistry,
    config
  );
  await coordinator.initialize();
  return coordinator;
}

export default EnsembleCoordinator;
