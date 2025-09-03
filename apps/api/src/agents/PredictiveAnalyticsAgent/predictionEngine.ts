import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface MarketContext {
  id: string;
  gameId: string;
  betType: string;
  status: 'active' | 'suspended' | 'closed';
  timeToEvent: number;
  currentOdds: number;
  volume: number;
  liquidity: number;
}

interface PredictionRequest {
  marketId: string;
  gameId: string;
  betType: string;
  features: Record<string, number>;
  context: MarketContext;
  modelPreferences?: string[];
  confidenceThreshold?: number;
}

interface PredictionResult {
  predictionId: string;
  marketId: string;
  gameId: string;
  betType: string;
  predictedOutcome: PredictedOutcome;
  confidence: number;
  expectedAccuracy: number;
  modelUsed: string;
  modelEnsemble: ModelContribution[];
  dataQuality: number;
  timeHorizon: number;
  uncertaintyBounds: UncertaintyBounds;
  featureImportance: Record<string, number>;
  createdAt: Date;
  expiresAt: Date;
}

interface PredictedOutcome {
  winProbability: number;
  expectedValue: number;
  oddsRange: { min: number; max: number };
  volatility: number;
  marketDirection: 'bullish' | 'bearish' | 'neutral';
  supportLevel: number;
  resistanceLevel: number;
  momentum: number;
  fairOdds: number;
  edgePercentage: number;
}

interface ModelContribution {
  modelId: string;
  prediction: number;
  confidence: number;
  weight: number;
  accuracy: number;
  latency: number;
}

interface UncertaintyBounds {
  lower: number;
  upper: number;
  standardError: number;
  confidenceInterval: number;
  predictionInterval: number;
}

interface EnsembleConfiguration {
  models: EnsembleModel[];
  aggregationMethod: 'weighted_average' | 'stacking' | 'voting' | 'bayesian';
  weightingStrategy: 'accuracy' | 'recency' | 'confidence' | 'adaptive';
  diversityThreshold: number;
  minimumModels: number;
  maximumModels: number;
}

interface EnsembleModel {
  modelId: string;
  type: 'linear' | 'tree' | 'neural' | 'ensemble' | 'custom';
  weight: number;
  accuracy: number;
  lastUpdated: Date;
  specialization: string[];
  enabled: boolean;
}

interface CalibrationData {
  predictedProbabilities: number[];
  actualOutcomes: number[];
  bins: CalibrationBin[];
  reliabilityScore: number;
  bsScore: number; // Brier Score
  logLoss: number;
  calibrationError: number;
}

interface CalibrationBin {
  minProb: number;
  maxProb: number;
  predictedProb: number;
  actualFreq: number;
  count: number;
  reliability: number;
}

interface PredictionMetrics {
  totalPredictions: number;
  averageConfidence: number;
  averageAccuracy: number;
  calibrationScore: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageEdge: number;
  modelPerformance: Map<string, ModelPerformanceMetrics>;
}

interface ModelPerformanceMetrics {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  calibration: number;
  sharpness: number;
  resolution: number;
  totalPredictions: number;
  lastEvaluated: Date;
}

export class PredictionEngine {
  private readonly logger: Logger;
  private ensembleConfig: EnsembleConfiguration;
  private calibrationData: Map<string, CalibrationData> = new Map();
  private predictionHistory: Map<string, PredictionResult[]> = new Map();
  private modelPerformance: Map<string, ModelPerformanceMetrics> = new Map();
  private confidenceThresholds: Map<string, number> = new Map();
  private featureScalers: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    
    this.ensembleConfig = {
      models: [],
      aggregationMethod: 'weighted_average',
      weightingStrategy: 'adaptive',
      diversityThreshold: 0.3,
      minimumModels: 3,
      maximumModels: 8
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('🎯 Initializing PredictionEngine');
    
    await this.loadEnsembleConfiguration();
    await this.loadCalibrationData();
    await this.loadPredictionHistory();
    await this.loadModelPerformance();
    await this.initializeFeatureScalers();
    
    this.logger.info('✅ PredictionEngine initialized');
  }

  async generatePrediction(market: MarketContext): Promise<PredictionResult | null> {
    this.logger.debug('🔮 Generating prediction for market', { 
      marketId: market.id, 
      betType: market.betType 
    });

    const predictionStartTime = Date.now();

    try {
      // 1. Prepare features and context
      const features = await this.prepareFeatures(market);
      const request: PredictionRequest = {
        marketId: market.id,
        gameId: market.gameId,
        betType: market.betType,
        features,
        context: market,
        confidenceThreshold: this.confidenceThresholds.get(market.betType) || 0.6
      };

      // 2. Validate request
      if (!await this.validatePredictionRequest(request)) {
        this.logger.warn('⚠️ Prediction request validation failed', { marketId: market.id });
        return null;
      }

      // 3. Select and prepare models
      const selectedModels = await this.selectModels(request);
      if (selectedModels.length < this.ensembleConfig.minimumModels) {
        this.logger.warn('⚠️ Insufficient models available for prediction', { 
          available: selectedModels.length,
          required: this.ensembleConfig.minimumModels
        });
        return null;
      }

      // 4. Generate ensemble predictions
      const modelContributions = await this.generateEnsemblePredictions(request, selectedModels);
      
      // 5. Aggregate predictions
      const aggregatedPrediction = await this.aggregatePredictions(modelContributions, request);
      
      // 6. Calculate uncertainty bounds
      const uncertaintyBounds = await this.calculateUncertaintyBounds(modelContributions);
      
      // 7. Apply calibration
      const calibratedPrediction = await this.applyCalibration(aggregatedPrediction, request.betType);
      
      // 8. Calculate feature importance
      const featureImportance = await this.calculateFeatureImportance(request, modelContributions);
      
      // 9. Assess prediction quality
      const dataQuality = await this.assessDataQuality(request);
      const expectedAccuracy = await this.estimateAccuracy(calibratedPrediction, modelContributions);

      // 10. Create final prediction result
      const predictionResult: PredictionResult = {
        predictionId: `pred_${market.id}_${Date.now()}`,
        marketId: market.id,
        gameId: market.gameId,
        betType: market.betType,
        predictedOutcome: calibratedPrediction,
        confidence: this.calculateOverallConfidence(modelContributions),
        expectedAccuracy,
        modelUsed: this.getEnsembleDescription(modelContributions),
        modelEnsemble: modelContributions,
        dataQuality,
        timeHorizon: market.timeToEvent,
        uncertaintyBounds,
        featureImportance,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + market.timeToEvent * 60 * 1000)
      };

      // 11. Store prediction
      await this.storePrediction(predictionResult);
      
      // 12. Update metrics
      await this.updatePredictionMetrics(predictionResult);

      const predictionTime = Date.now() - predictionStartTime;
      this.logger.info('✅ Prediction generated successfully', {
        predictionId: predictionResult.predictionId,
        confidence: predictionResult.confidence,
        winProbability: predictionResult.predictedOutcome.winProbability,
        expectedValue: predictionResult.predictedOutcome.expectedValue,
        processingTimeMs: predictionTime
      });

      return predictionResult;

    } catch (error) {
      this.logger.error('❌ Failed to generate prediction', {
        marketId: market.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async validatePrediction(
    predictionId: string, 
    actualOutcome: any
  ): Promise<{ accuracy: number; calibration: number; sharpness: number }> {
    
    this.logger.info('🔍 Validating prediction', { predictionId });

    try {
      const prediction = await this.getPredictionById(predictionId);
      if (!prediction) {
        throw new Error(`Prediction ${predictionId} not found`);
      }

      // Calculate accuracy
      const accuracy = this.calculateAccuracy(prediction, actualOutcome);
      
      // Update calibration data
      await this.updateCalibrationData(prediction, actualOutcome);
      
      // Calculate calibration metrics
      const calibration = await this.calculateCalibration(prediction.betType);
      
      // Calculate sharpness
      const sharpness = this.calculateSharpness(prediction);
      
      // Update model performance
      await this.updateModelPerformance(prediction, actualOutcome, accuracy);

      const validation = { accuracy, calibration, sharpness };
      
      this.logger.info('✅ Prediction validated', {
        predictionId,
        accuracy,
        calibration,
        sharpness
      });

      return validation;

    } catch (error) {
      this.logger.error('❌ Failed to validate prediction', {
        predictionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { accuracy: 0, calibration: 0, sharpness: 0 };
    }
  }

  async getEnsemblePerformance(): Promise<PredictionMetrics> {
    this.logger.debug('📊 Calculating ensemble performance metrics');

    try {
      const allPredictions = Array.from(this.predictionHistory.values()).flat();
      
      if (allPredictions.length === 0) {
        return this.getDefaultMetrics();
      }

      const totalPredictions = allPredictions.length;
      const averageConfidence = allPredictions.reduce((sum, p) => sum + p.confidence, 0) / totalPredictions;
      
      // These would be calculated from actual validation results
      const averageAccuracy = 0.72; // Placeholder
      const calibrationScore = 0.85; // Placeholder
      const sharpeRatio = 1.8; // Placeholder
      const maxDrawdown = 0.15; // Placeholder
      const winRate = 0.68; // Placeholder
      const averageEdge = 0.08; // Placeholder

      return {
        totalPredictions,
        averageConfidence,
        averageAccuracy,
        calibrationScore,
        sharpeRatio,
        maxDrawdown,
        winRate,
        averageEdge,
        modelPerformance: this.modelPerformance
      };

    } catch (error) {
      this.logger.error('❌ Failed to calculate ensemble performance', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return this.getDefaultMetrics();
    }
  }

  // Private Methods
  private async prepareFeatures(market: MarketContext): Promise<Record<string, number>> {
    return {
      // Market features
      current_odds: market.currentOdds,
      volume: market.volume,
      liquidity: market.liquidity,
      time_to_event: market.timeToEvent,
      
      // Derived features
      log_odds: Math.log(market.currentOdds),
      log_volume: Math.log(Math.max(1, market.volume)),
      liquidity_score: Math.min(1, market.liquidity / 10000),
      urgency_factor: Math.max(0, 1 - market.timeToEvent / 1440), // 24 hours max
      
      // Market structure
      bid_ask_spread: await this.getBidAskSpread(market.id),
      market_depth: await this.getMarketDepth(market.id),
      order_flow: await this.getOrderFlow(market.id),
      
      // Historical features
      price_momentum: await this.getPriceMomentum(market.id, 10),
      volatility: await this.getVolatility(market.id, 20),
      trend_strength: await this.getTrendStrength(market.id),
      
      // Contextual features
      hour_of_day: new Date().getHours(),
      day_of_week: new Date().getDay(),
      market_type_encoding: this.encodeMarketType(market.betType),
      
      // Risk features
      correlation_risk: await this.getCorrelationRisk(market.id),
      concentration_risk: await this.getConcentrationRisk(market.betType),
      liquidity_risk: await this.getLiquidityRisk(market.id)
    };
  }

  private async validatePredictionRequest(request: PredictionRequest): Promise<boolean> {
    // Check required fields
    if (!request.marketId || !request.gameId || !request.betType) {
      return false;
    }

    // Check feature completeness
    const requiredFeatures = ['current_odds', 'volume', 'time_to_event'];
    for (const feature of requiredFeatures) {
      if (!(feature in request.features)) {
        return false;
      }
    }

    // Check data quality
    const dataQuality = await this.assessDataQuality(request);
    if (dataQuality < 0.5) {
      return false;
    }

    return true;
  }

  private async selectModels(request: PredictionRequest): Promise<EnsembleModel[]> {
    const availableModels = this.ensembleConfig.models.filter(m => m.enabled);
    
    // Filter models by specialization
    const specializedModels = availableModels.filter(m => 
      m.specialization.length === 0 || 
      m.specialization.includes(request.betType) ||
      m.specialization.includes('general')
    );

    // Sort by performance and recency
    const sortedModels = specializedModels.sort((a, b) => {
      const aScore = a.accuracy * 0.7 + this.getRecencyScore(a.lastUpdated) * 0.3;
      const bScore = b.accuracy * 0.7 + this.getRecencyScore(b.lastUpdated) * 0.3;
      return bScore - aScore;
    });

    // Select top models up to maximum
    return sortedModels.slice(0, this.ensembleConfig.maximumModels);
  }

  private async generateEnsemblePredictions(
    request: PredictionRequest,
    models: EnsembleModel[]
  ): Promise<ModelContribution[]> {
    
    const contributions: ModelContribution[] = [];

    for (const model of models) {
      try {
        const modelStartTime = Date.now();
        const prediction = await this.generateModelPrediction(model, request);
        const modelLatency = Date.now() - modelStartTime;

        contributions.push({
          modelId: model.modelId,
          prediction,
          confidence: await this.getModelConfidence(model, request),
          weight: model.weight,
          accuracy: model.accuracy,
          latency: modelLatency
        });

      } catch (error) {
        this.logger.warn('⚠️ Model prediction failed', {
          modelId: model.modelId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return contributions;
  }

  private async generateModelPrediction(model: EnsembleModel, request: PredictionRequest): Promise<number> {
    // This would call the actual ML model for prediction
    // For now, simulate model predictions with some variation
    
    const baseProb = this.calculateBaselineProbability(request);
    const modelVariation = this.getModelVariation(model.type);
    const contextAdjustment = this.getContextualAdjustment(request);
    
    let prediction = baseProb + modelVariation + contextAdjustment;
    
    // Ensure prediction is within valid probability range
    prediction = Math.max(0.05, Math.min(0.95, prediction));
    
    return prediction;
  }

  private calculateBaselineProbability(request: PredictionRequest): number {
    // Convert odds to implied probability with some adjustments
    const impliedProb = 1 / request.features.current_odds;
    
    // Adjust based on volume and liquidity
    const volumeAdjustment = Math.log(request.features.volume + 1) * 0.01;
    const liquidityAdjustment = request.features.liquidity_score * 0.02;
    
    return impliedProb + volumeAdjustment + liquidityAdjustment;
  }

  private getModelVariation(modelType: string): number {
    const variations = {
      'linear': (Math.random() - 0.5) * 0.1,
      'tree': (Math.random() - 0.5) * 0.15,
      'neural': (Math.random() - 0.5) * 0.12,
      'ensemble': (Math.random() - 0.5) * 0.08,
      'custom': (Math.random() - 0.5) * 0.1
    };
    
    return variations[modelType as keyof typeof variations] || 0;
  }

  private getContextualAdjustment(request: PredictionRequest): number {
    let adjustment = 0;
    
    // Time urgency adjustment
    if (request.features.urgency_factor > 0.8) {
      adjustment += 0.02; // Higher urgency = slight increase in probability
    }
    
    // Market type adjustment
    if (request.betType.includes('prop')) {
      adjustment -= 0.01; // Props are generally harder to predict
    }
    
    return adjustment;
  }

  private async aggregatePredictions(
    contributions: ModelContribution[],
    request: PredictionRequest
  ): Promise<PredictedOutcome> {
    
    let aggregatedProb: number;
    
    switch (this.ensembleConfig.aggregationMethod) {
      case 'weighted_average':
        aggregatedProb = this.weightedAverage(contributions);
        break;
      case 'stacking':
        aggregatedProb = await this.stackingAggregation(contributions);
        break;
      case 'voting':
        aggregatedProb = this.votingAggregation(contributions);
        break;
      case 'bayesian':
        aggregatedProb = await this.bayesianAggregation(contributions);
        break;
      default:
        aggregatedProb = this.weightedAverage(contributions);
    }

    // Calculate derived outcomes
    const fairOdds = 1 / aggregatedProb;
    const currentOdds = request.features.current_odds;
    const expectedValue = (aggregatedProb * (currentOdds - 1)) - (1 - aggregatedProb);
    const edgePercentage = expectedValue / currentOdds;
    
    // Calculate volatility based on model disagreement
    const predictions = contributions.map(c => c.prediction);
    const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - aggregatedProb, 2), 0) / predictions.length;
    const volatility = Math.sqrt(variance);
    
    // Determine market direction
    const marketDirection = this.determineMarketDirection(aggregatedProb, request.features.current_odds);
    
    // Calculate support and resistance levels
    const supportLevel = await this.calculateSupport(request.marketId);
    const resistanceLevel = await this.calculateResistance(request.marketId);
    const momentum = await this.calculateMomentum(request.marketId);
    
    return {
      winProbability: aggregatedProb,
      expectedValue,
      oddsRange: {
        min: fairOdds * 0.95,
        max: fairOdds * 1.05
      },
      volatility,
      marketDirection,
      supportLevel,
      resistanceLevel,
      momentum,
      fairOdds,
      edgePercentage
    };
  }

  private weightedAverage(contributions: ModelContribution[]): number {
    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = contributions.reduce((sum, c) => sum + c.prediction * c.weight, 0);
    return weightedSum / totalWeight;
  }

  private async stackingAggregation(contributions: ModelContribution[]): Promise<number> {
    // Simplified stacking - in practice this would use a meta-learner
    const baseAvg = this.weightedAverage(contributions);
    const confidenceAdj = contributions.reduce((sum, c) => sum + c.confidence, 0) / contributions.length;
    return baseAvg * confidenceAdj;
  }

  private votingAggregation(contributions: ModelContribution[]): number {
    // Convert predictions to binary votes and then average
    const threshold = 0.5;
    const votes = contributions.map(c => c.prediction > threshold ? 1 : 0);
    const avgVote = votes.reduce((sum, vote) => sum + vote, 0) / votes.length;
    
    // Convert back to probability with some smoothing
    return 0.1 + avgVote * 0.8;
  }

  private async bayesianAggregation(contributions: ModelContribution[]): Promise<number> {
    // Simplified Bayesian aggregation
    let prior = 0.5; // Neutral prior
    
    for (const contribution of contributions) {
      const likelihood = contribution.prediction;
      const evidence = contribution.confidence;
      
      // Bayesian update (simplified)
      prior = (prior * likelihood * evidence) / 
              (prior * likelihood * evidence + (1 - prior) * (1 - likelihood) * evidence);
    }
    
    return prior;
  }

  private determineMarketDirection(
    predictedProb: number, 
    currentOdds: number
  ): 'bullish' | 'bearish' | 'neutral' {
    
    const impliedProb = 1 / currentOdds;
    const diff = predictedProb - impliedProb;
    
    if (diff > 0.05) return 'bullish';
    if (diff < -0.05) return 'bearish';
    return 'neutral';
  }

  private async calculateUncertaintyBounds(contributions: ModelContribution[]): Promise<UncertaintyBounds> {
    const predictions = contributions.map(c => c.prediction);
    const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
    
    const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length;
    const standardError = Math.sqrt(variance);
    
    // 95% confidence interval
    const confidenceInterval = 1.96 * standardError;
    const predictionInterval = 2.0 * standardError; // Slightly wider for prediction
    
    return {
      lower: Math.max(0, mean - confidenceInterval),
      upper: Math.min(1, mean + confidenceInterval),
      standardError,
      confidenceInterval,
      predictionInterval
    };
  }

  private async applyCalibration(
    outcome: PredictedOutcome, 
    betType: string
  ): Promise<PredictedOutcome> {
    
    const calibrationData = this.calibrationData.get(betType);
    if (!calibrationData || calibrationData.bins.length === 0) {
      return outcome; // No calibration data available
    }

    // Find appropriate calibration bin
    const bin = calibrationData.bins.find(b => 
      outcome.winProbability >= b.minProb && outcome.winProbability < b.maxProb
    );

    if (bin && bin.count > 10) { // Require sufficient data
      // Adjust probability based on calibration
      const calibrationAdjustment = bin.actualFreq - bin.predictedProb;
      outcome.winProbability += calibrationAdjustment * 0.5; // Partial adjustment
      outcome.winProbability = Math.max(0.05, Math.min(0.95, outcome.winProbability));
      
      // Recalculate derived values
      outcome.fairOdds = 1 / outcome.winProbability;
      outcome.expectedValue = (outcome.winProbability * (outcome.fairOdds - 1)) - (1 - outcome.winProbability);
      outcome.edgePercentage = outcome.expectedValue / outcome.fairOdds;
    }

    return outcome;
  }

  private async calculateFeatureImportance(
    request: PredictionRequest,
    contributions: ModelContribution[]
  ): Promise<Record<string, number>> {
    
    // Simplified feature importance calculation
    const importance: Record<string, number> = {};
    const features = Object.keys(request.features);
    
    // Assign importance based on feature type and contribution variance
    for (const feature of features) {
      let baseImportance = 0.1; // Default importance
      
      // Key features get higher importance
      if (['current_odds', 'volume', 'liquidity'].includes(feature)) {
        baseImportance = 0.3;
      } else if (['time_to_event', 'volatility', 'momentum'].includes(feature)) {
        baseImportance = 0.2;
      }
      
      // Add some randomness based on model contributions
      const contributionVariance = this.calculateContributionVariance(contributions);
      const adjustment = contributionVariance * (Math.random() - 0.5) * 0.1;
      
      importance[feature] = Math.max(0, baseImportance + adjustment);
    }
    
    // Normalize to sum to 1
    const total = Object.values(importance).reduce((sum, imp) => sum + imp, 0);
    for (const feature of features) {
      importance[feature] = importance[feature] / total;
    }
    
    return importance;
  }

  private calculateContributionVariance(contributions: ModelContribution[]): number {
    const predictions = contributions.map(c => c.prediction);
    const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
    return predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length;
  }

  private calculateOverallConfidence(contributions: ModelContribution[]): number {
    // Weight confidence by model accuracy
    const totalWeight = contributions.reduce((sum, c) => sum + c.accuracy, 0);
    const weightedConfidence = contributions.reduce((sum, c) => sum + c.confidence * c.accuracy, 0);
    return weightedConfidence / totalWeight;
  }

  private getEnsembleDescription(contributions: ModelContribution[]): string {
    const modelTypes = contributions.map(c => c.modelId.split('_')[0]).join('+');
    return `Ensemble(${modelTypes})`;
  }

  private async assessDataQuality(request: PredictionRequest): Promise<number> {
    let qualityScore = 1.0;
    
    // Check for missing features
    const requiredFeatures = ['current_odds', 'volume', 'liquidity', 'time_to_event'];
    const missingFeatures = requiredFeatures.filter(f => !(f in request.features));
    qualityScore -= missingFeatures.length * 0.1;
    
    // Check for reasonable values
    if (request.features.current_odds <= 1) qualityScore -= 0.2;
    if (request.features.volume < 0) qualityScore -= 0.1;
    if (request.features.time_to_event < 0) qualityScore -= 0.1;
    
    return Math.max(0, qualityScore);
  }

  private async estimateAccuracy(
    prediction: PredictedOutcome,
    contributions: ModelContribution[]
  ): Promise<number> {
    
    // Base accuracy on model ensemble performance
    const avgModelAccuracy = contributions.reduce((sum, c) => sum + c.accuracy, 0) / contributions.length;
    
    // Adjust based on confidence and uncertainty
    const confidenceBonus = prediction.winProbability > 0.3 && prediction.winProbability < 0.7 ? 0.05 : 0;
    const volatilityPenalty = prediction.volatility * 0.1;
    
    return Math.max(0.5, Math.min(0.95, avgModelAccuracy + confidenceBonus - volatilityPenalty));
  }

  // Placeholder helper methods
  private async getBidAskSpread(marketId: string): Promise<number> { return 0.02; }
  private async getMarketDepth(marketId: string): Promise<number> { return 0.5; }
  private async getOrderFlow(marketId: string): Promise<number> { return 0.3; }
  private async getPriceMomentum(marketId: string, period: number): Promise<number> { return 0.1; }
  private async getVolatility(marketId: string, period: number): Promise<number> { return 0.2; }
  private async getTrendStrength(marketId: string): Promise<number> { return 0.6; }
  private encodeMarketType(betType: string): number { return betType.length % 10; }
  private async getCorrelationRisk(marketId: string): Promise<number> { return 0.3; }
  private async getConcentrationRisk(betType: string): Promise<number> { return 0.2; }
  private async getLiquidityRisk(marketId: string): Promise<number> { return 0.1; }
  private getRecencyScore(lastUpdated: Date): number { 
    const hours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 1 - hours / 168); // Decay over 1 week
  }
  private async getModelConfidence(model: EnsembleModel, request: PredictionRequest): Promise<number> { 
    return 0.7 + Math.random() * 0.2; 
  }
  private async calculateSupport(marketId: string): Promise<number> { return 95; }
  private async calculateResistance(marketId: string): Promise<number> { return 105; }
  private async calculateMomentum(marketId: string): Promise<number> { return 0.3; }

  private calculateAccuracy(prediction: PredictionResult, actualOutcome: any): number {
    // Simplified accuracy calculation
    const predictedProb = prediction.predictedOutcome.winProbability;
    const actualResult = actualOutcome.result === 'win' ? 1 : 0;
    
    // Brier professional_score (lower is better, so we return 1 - brier_score)
    const brierScore = Math.pow(predictedProb - actualResult, 2);
    return Math.max(0, 1 - brierScore);
  }

  private calculateSharpness(prediction: PredictionResult): number {
    // Measure how far predictions are from 0.5 (neutrality)
    const prob = prediction.predictedOutcome.winProbability;
    return Math.abs(prob - 0.5) * 2; // Scale to 0-1
  }

  private async updateCalibrationData(prediction: PredictionResult, actualOutcome: any): Promise<void> {
    const betType = prediction.betType;
    const calibrationData = this.calibrationData.get(betType) || this.createEmptyCalibrationData();
    
    calibrationData.predictedProbabilities.push(prediction.predictedOutcome.winProbability);
    calibrationData.actualOutcomes.push(actualOutcome.result === 'win' ? 1 : 0);
    
    // Recalculate bins
    calibrationData.bins = this.calculateCalibrationBins(
      calibrationData.predictedProbabilities,
      calibrationData.actualOutcomes
    );
    
    this.calibrationData.set(betType, calibrationData);
  }

  private createEmptyCalibrationData(): CalibrationData {
    return {
      predictedProbabilities: [],
      actualOutcomes: [],
      bins: [],
      reliabilityScore: 0,
      bsScore: 0,
      logLoss: 0,
      calibrationError: 0
    };
  }

  private calculateCalibrationBins(predictions: number[], outcomes: number[]): CalibrationBin[] {
    const numBins = 10;
    const bins: CalibrationBin[] = [];
    
    for (let i = 0; i < numBins; i++) {
      const minProb = i / numBins;
      const maxProb = (i + 1) / numBins;
      
      const binIndices = predictions
        .map((pred, idx) => ({ pred, idx }))
        .filter(({ pred }) => pred >= minProb && pred < maxProb)
        .map(({ idx }) => idx);
      
      if (binIndices.length > 0) {
        const binPredictions = binIndices.map(idx => predictions[idx]);
        const binOutcomes = binIndices.map(idx => outcomes[idx]);
        
        const predictedProb = binPredictions.reduce((sum, pred) => sum + pred, 0) / binPredictions.length;
        const actualFreq = binOutcomes.reduce((sum, outcome) => sum + outcome, 0) / binOutcomes.length;
        
        bins.push({
          minProb,
          maxProb,
          predictedProb,
          actualFreq,
          count: binIndices.length,
          reliability: Math.abs(predictedProb - actualFreq)
        });
      }
    }
    
    return bins;
  }

  private async calculateCalibration(betType: string): Promise<number> {
    const calibrationData = this.calibrationData.get(betType);
    if (!calibrationData || calibrationData.bins.length === 0) {
      return 0.5; // Default calibration professional_score
    }
    
    // Calculate expected calibration error
    const totalCount = calibrationData.bins.reduce((sum, bin) => sum + bin.count, 0);
    const ece = calibrationData.bins.reduce((sum, bin) => {
      return sum + (bin.count / totalCount) * bin.reliability;
    }, 0);
    
    return Math.max(0, 1 - ece); // Higher professional_score = better calibration
  }

  private async updateModelPerformance(
    prediction: PredictionResult,
    actualOutcome: any,
    accuracy: number
  ): Promise<void> {
    
    for (const contribution of prediction.modelEnsemble) {
      const existing = this.modelPerformance.get(contribution.modelId);
      
      if (existing) {
        // Update running averages
        const alpha = 0.1; // Learning rate
        existing.accuracy = existing.accuracy * (1 - alpha) + accuracy * alpha;
        existing.totalPredictions += 1;
        existing.lastEvaluated = new Date();
      } else {
        // Create new performance record
        this.modelPerformance.set(contribution.modelId, {
          modelId: contribution.modelId,
          accuracy,
          precision: accuracy, // Simplified
          recall: accuracy, // Simplified
          f1Score: accuracy, // Simplified
          auc: accuracy, // Simplified
          calibration: 0.8, // Placeholder
          sharpness: 0.6, // Placeholder
          resolution: 0.7, // Placeholder
          totalPredictions: 1,
          lastEvaluated: new Date()
        });
      }
    }
  }

  private async getPredictionById(predictionId: string): Promise<PredictionResult | null> {
    const cached = await redisCache.get(`prediction:${predictionId}`);
    if (cached) {
      const prediction = JSON.parse(cached);
      prediction.createdAt = new Date(prediction.createdAt);
      prediction.expiresAt = new Date(prediction.expiresAt);
      return prediction;
    }
    return null;
  }

  private getDefaultMetrics(): PredictionMetrics {
    return {
      totalPredictions: 0,
      averageConfidence: 0,
      averageAccuracy: 0,
      calibrationScore: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      averageEdge: 0,
      modelPerformance: new Map()
    };
  }

  private async storePrediction(prediction: PredictionResult): Promise<void> {
    await redisCache.set(
      `prediction:${prediction.predictionId}`,
      JSON.stringify(prediction),
      prediction.timeHorizon * 60 * 1000 // TTL based on time horizon
    );
    
    // Add to history
    const history = this.predictionHistory.get(prediction.marketId) || [];
    history.push(prediction);
    if (history.length > 100) history.shift(); // Keep last 100
    this.predictionHistory.set(prediction.marketId, history);
  }

  private async updatePredictionMetrics(prediction: PredictionResult): Promise<void> {
    // Cache latest prediction metrics
    await redisCache.set(
      'prediction_engine:latest_prediction',
      JSON.stringify({
        predictionId: prediction.predictionId,
        confidence: prediction.confidence,
        winProbability: prediction.predictedOutcome.winProbability,
        expectedValue: prediction.predictedOutcome.expectedValue,
        timestamp: prediction.createdAt
      }),
      3600 // 1 hour TTL
    );
  }

  private async loadEnsembleConfiguration(): Promise<void> {
    try {
      const cached = await redisCache.get('prediction_engine:ensemble_config');
      if (cached) {
        this.ensembleConfig = JSON.parse(cached);
      } else {
        // Initialize with default models
        this.ensembleConfig.models = [
          {
            modelId: 'linear_baseline',
            type: 'linear',
            weight: 0.2,
            accuracy: 0.65,
            lastUpdated: new Date(),
            specialization: ['general'],
            enabled: true
          },
          {
            modelId: 'tree_ensemble',
            type: 'tree',
            weight: 0.3,
            accuracy: 0.72,
            lastUpdated: new Date(),
            specialization: ['general'],
            enabled: true
          },
          {
            modelId: 'neural_network',
            type: 'neural',
            weight: 0.3,
            accuracy: 0.68,
            lastUpdated: new Date(),
            specialization: ['general'],
            enabled: true
          },
          {
            modelId: 'custom_ensemble',
            type: 'ensemble',
            weight: 0.2,
            accuracy: 0.75,
            lastUpdated: new Date(),
            specialization: ['general'],
            enabled: true
          }
        ];
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load ensemble configuration');
    }
  }

  private async loadCalibrationData(): Promise<void> {
    try {
      const cached = await redisCache.getPattern('calibration:*');
      for (const [key, data] of cached) {
        const betType = key.split(':').pop();
        if (betType) {
          this.calibrationData.set(betType, JSON.parse(data));
        }
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load calibration data');
    }
  }

  private async loadPredictionHistory(): Promise<void> {
    try {
      const cached = await redisCache.getPattern('prediction_history:*');
      for (const [key, data] of cached) {
        const marketId = key.split(':').pop();
        if (marketId) {
          const history = JSON.parse(data);
          history.forEach((pred: any) => {
            pred.createdAt = new Date(pred.createdAt);
            pred.expiresAt = new Date(pred.expiresAt);
          });
          this.predictionHistory.set(marketId, history);
        }
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load prediction history');
    }
  }

  private async loadModelPerformance(): Promise<void> {
    try {
      const cached = await redisCache.getPattern('model_performance:*');
      for (const [key, data] of cached) {
        const modelId = key.split(':').pop();
        if (modelId) {
          const performance = JSON.parse(data);
          performance.lastEvaluated = new Date(performance.lastEvaluated);
          this.modelPerformance.set(modelId, performance);
        }
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load model performance');
    }
  }

  private async initializeFeatureScalers(): Promise<void> {
    // Initialize standard scalers for different feature types
    this.featureScalers.set('price_features', { mean: 100, std: 20 });
    this.featureScalers.set('volume_features', { mean: 1000, std: 500 });
    this.featureScalers.set('time_features', { mean: 720, std: 480 }); // 12 hours ± 8 hours
  }

  async isHealthy(): Promise<boolean> {
    return this.ensembleConfig.models.length > 0;
  }

  async cleanup(): Promise<void> {
    // Save ensemble configuration
    await redisCache.set(
      'prediction_engine:ensemble_config',
      JSON.stringify(this.ensembleConfig),
      86400 // 24 hours TTL
    );

    // Save calibration data
    for (const [betType, data] of this.calibrationData) {
      await redisCache.set(
        `calibration:${betType}`,
        JSON.stringify(data),
        86400 // 24 hours TTL
      );
    }

    // Save prediction history
    for (const [marketId, history] of this.predictionHistory) {
      await redisCache.set(
        `prediction_history:${marketId}`,
        JSON.stringify(history),
        86400 // 24 hours TTL
      );
    }

    // Save model performance
    for (const [modelId, performance] of this.modelPerformance) {
      await redisCache.set(
        `model_performance:${modelId}`,
        JSON.stringify(performance),
        86400 // 24 hours TTL
      );
    }

    this.calibrationData.clear();
    this.predictionHistory.clear();
    this.modelPerformance.clear();
    this.confidenceThresholds.clear();
    this.featureScalers.clear();
    
    this.logger.info('🧹 PredictionEngine cleanup completed');
  }
}