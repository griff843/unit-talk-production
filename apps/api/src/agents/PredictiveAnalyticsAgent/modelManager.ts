import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface MLModel {
  modelId: string;
  name: string;
  type: 'classification' | 'regression' | 'time_series' | 'ensemble' | 'neural_network';
  version: string;
  status: 'training' | 'deployed' | 'deprecated' | 'failed';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  features: string[];
  hyperparameters: Record<string, any>;
  trainedOn: Date;
  lastUpdated: Date;
  datasetSize: number;
  validationScore: number;
  productionMetrics: ModelMetrics;
}

interface ModelMetrics {
  predictions: number;
  correctPredictions: number;
  averageConfidence: number;
  latency: number;
  errorRate: number;
  drift: number;
  lastEvaluated: Date;
}

interface TrainingJob {
  jobId: string;
  modelId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  datasetSize: number;
  progress: number;
  hyperparameters: Record<string, any>;
  results?: TrainingResults;
  errorMessage?: string;
}

interface TrainingResults {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  validationLoss: number;
  trainingTime: number;
  epochs: number;
  bestEpoch: number;
  learningCurve: number[];
  featureImportance: Record<string, number>;
}

interface ModelEvaluation {
  modelId: string;
  evaluationDate: Date;
  testAccuracy: number;
  productionAccuracy: number;
  drift: number;
  degradation: number;
  recommendation: 'maintain' | 'retrain' | 'replace' | 'deprecate';
  nextEvaluation: Date;
}

interface ModelPerformance {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  roc_auc: number;
  calibration: number;
  lastUpdated: Date;
  sampleSize: number;
  performanceTrend: 'improving' | 'declining' | 'stable';
}

interface AutoMLConfig {
  enabled: boolean;
  searchSpace: Record<string, any>;
  maxTrials: number;
  timeout: number;
  objectiveMetric: string;
  earlyStoppingPatience: number;
}

export class ModelManager {
  private readonly logger: Logger;
  private models: Map<string, MLModel> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private modelEvaluations: Map<string, ModelEvaluation> = new Map();
  private autoMLConfig: AutoMLConfig;
  private modelRegistry: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    
    this.autoMLConfig = {
      enabled: true,
      searchSpace: {
        learning_rate: [0.001, 0.01, 0.1],
        batch_size: [16, 32, 64, 128],
        hidden_layers: [1, 2, 3, 4],
        dropout: [0.1, 0.2, 0.3, 0.5]
      },
      maxTrials: 20,
      timeout: 3600, // 1 hour
      objectiveMetric: 'f1_score',
      earlyStoppingPatience: 10
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('🧠 Initializing ModelManager');
    
    await this.loadExistingModels();
    await this.loadTrainingJobs();
    await this.loadModelEvaluations();
    await this.initializeDefaultModels();
    
    this.logger.info('✅ ModelManager initialized');
  }

  async identifyModelsForUpdate(): Promise<string[]> {
    this.logger.info('🔍 Identifying models for update...');

    const modelsToUpdate: string[] = [];
    const currentTime = new Date();

    for (const [modelId, model] of this.models) {
      // Check if model needs updating based on performance drift
      const evaluation = this.modelEvaluations.get(modelId);
      
      if (evaluation) {
        // Update if accuracy has degraded significantly
        if (evaluation.degradation > 0.1) {
          modelsToUpdate.push(modelId);
          continue;
        }
        
        // Update if drift is detected
        if (evaluation.drift > 0.15) {
          modelsToUpdate.push(modelId);
          continue;
        }
      }
      
      // Update if model is too old
      const daysSinceUpdate = (currentTime.getTime() - model.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) { // Update weekly
        modelsToUpdate.push(modelId);
      }
      
      // Update if production metrics show poor performance
      if (model.productionMetrics.errorRate > 0.2) {
        modelsToUpdate.push(modelId);
      }
    }

    this.logger.info(`✅ Identified ${modelsToUpdate.length} models for update`);
    return modelsToUpdate;
  }

  async updateModel(modelId: string): Promise<boolean> {
    this.logger.info('🔄 Updating model', { modelId });

    try {
      const model = this.models.get(modelId);
      if (!model) {
        this.logger.error('❌ Model not found', { modelId });
        return false;
      }

      // Get fresh training data
      const trainingData = await this.getTrainingData(modelId);
      
      // Prepare updated hyperparameters
      const updatedHyperparameters = await this.optimizeHyperparameters(
        model, 
        trainingData
      );

      // Create training job
      const trainingJob = await this.createTrainingJob(
        modelId,
        trainingData,
        updatedHyperparameters
      );

      // Start training
      const success = await this.executeTraining(trainingJob);
      
      if (success) {
        // Update model with new version
        await this.deployUpdatedModel(modelId, trainingJob);
        this.logger.info('✅ Model updated successfully', { modelId });
        return true;
      } else {
        this.logger.error('❌ Model update failed', { modelId });
        return false;
      }

    } catch (error) {
      this.logger.error('❌ Failed to update model', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async checkRetrainingNeeds(): Promise<string[]> {
    this.logger.info('🔄 Checking retraining needs...');

    const modelsToRetrain: string[] = [];

    for (const [modelId, model] of this.models) {
      const needsRetraining = await this.evaluateRetrainingNeed(model);
      
      if (needsRetraining) {
        modelsToRetrain.push(modelId);
      }
    }

    this.logger.info(`✅ Identified ${modelsToRetrain.length} models needing retraining`);
    return modelsToRetrain;
  }

  async retrainModels(modelIds: string[]): Promise<boolean[]> {
    this.logger.info('🏋️ Retraining models', { count: modelIds.length });

    const results: boolean[] = [];

    for (const modelId of modelIds) {
      try {
        const success = await this.retrainModel(modelId);
        results.push(success);
      } catch (error) {
        this.logger.error('❌ Failed to retrain model', {
          modelId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        results.push(false);
      }
    }

    const successCount = results.filter(r => r).length;
    this.logger.info(`✅ Retrained ${successCount}/${modelIds.length} models successfully`);

    return results;
  }

  async getAllModels(): Promise<MLModel[]> {
    return Array.from(this.models.values());
  }

  async calculateModelPerformance(modelId: string): Promise<ModelPerformance> {
    this.logger.debug('📊 Calculating model performance', { modelId });

    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Calculate recent performance metrics
    const recentMetrics = await this.getRecentPerformanceMetrics(modelId);
    const historicalMetrics = await this.getHistoricalPerformanceMetrics(modelId);
    
    // Determine performance trend
    const trend = this.calculatePerformanceTrend(recentMetrics, historicalMetrics);

    const performance: ModelPerformance = {
      modelId,
      accuracy: model.productionMetrics.correctPredictions / Math.max(1, model.productionMetrics.predictions),
      precision: model.precision,
      recall: model.recall,
      f1Score: model.f1Score,
      roc_auc: await this.calculateROCAUC(modelId),
      calibration: await this.calculateCalibration(modelId),
      lastUpdated: new Date(),
      sampleSize: model.productionMetrics.predictions,
      performanceTrend: trend
    };

    return performance;
  }

  async deployNewModel(
    name: string, 
    type: MLModel['type'], 
    features: string[],
    hyperparameters: Record<string, any>
  ): Promise<string> {
    
    this.logger.info('🚀 Deploying new model', { name, type });

    try {
      const modelId = `${type}_${name}_${Date.now()}`;
      
      // Get training data
      const trainingData = await this.getTrainingData(modelId, features);
      
      // Create training job
      const trainingJob = await this.createTrainingJob(
        modelId,
        trainingData,
        hyperparameters
      );

      // Train the model
      const trainingSuccess = await this.executeTraining(trainingJob);
      
      if (!trainingSuccess) {
        throw new Error('Model training failed');
      }

      // Create model entry
      const model: MLModel = {
        modelId,
        name,
        type,
        version: '1.0.0',
        status: 'deployed',
        accuracy: trainingJob.results?.accuracy || 0,
        precision: trainingJob.results?.precision || 0,
        recall: trainingJob.results?.recall || 0,
        f1Score: trainingJob.results?.f1Score || 0,
        features,
        hyperparameters,
        trainedOn: new Date(),
        lastUpdated: new Date(),
        datasetSize: trainingJob.datasetSize,
        validationScore: trainingJob.results?.validationLoss || 0,
        productionMetrics: {
          predictions: 0,
          correctPredictions: 0,
          averageConfidence: 0,
          latency: 0,
          errorRate: 0,
          drift: 0,
          lastEvaluated: new Date()
        }
      };

      this.models.set(modelId, model);
      
      // Store in registry
      await this.storeModelInRegistry(model);

      this.logger.info('✅ New model deployed successfully', { modelId, name });
      return modelId;

    } catch (error) {
      this.logger.error('❌ Failed to deploy new model', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async runAutoML(
    features: string[],
    targetVariable: string,
    problemType: 'classification' | 'regression'
  ): Promise<string> {
    
    this.logger.info('🤖 Running AutoML', { 
      features: features.length, 
      targetVariable, 
      problemType 
    });

    try {
      if (!this.autoMLConfig.enabled) {
        throw new Error('AutoML is disabled');
      }

      const autoMLJobId = `automl_${Date.now()}`;
      
      // Get training data
      const trainingData = await this.getTrainingData(autoMLJobId, features);
      
      // Run hyperparameter optimization
      const bestHyperparameters = await this.runHyperparameterOptimization(
        trainingData,
        problemType
      );

      // Train best model
      const modelId = await this.deployNewModel(
        `automl_${problemType}`,
        problemType === 'classification' ? 'classification' : 'regression',
        features,
        bestHyperparameters
      );

      this.logger.info('✅ AutoML completed successfully', { modelId });
      return modelId;

    } catch (error) {
      this.logger.error('❌ AutoML failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private Methods
  private async evaluateRetrainingNeed(model: MLModel): Promise<boolean> {
    // Check various criteria for retraining
    
    // Performance degradation
    const evaluation = this.modelEvaluations.get(model.modelId);
    if (evaluation && evaluation.degradation > 0.15) {
      return true;
    }
    
    // Data drift
    if (evaluation && evaluation.drift > 0.2) {
      return true;
    }
    
    // Time-based retraining (monthly)
    const daysSinceTraining = (Date.now() - model.trainedOn.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceTraining > 30) {
      return true;
    }
    
    // Error rate threshold
    if (model.productionMetrics.errorRate > 0.25) {
      return true;
    }
    
    return false;
  }

  private async retrainModel(modelId: string): Promise<boolean> {
    const model = this.models.get(modelId);
    if (!model) return false;

    try {
      // Get fresh training data
      const trainingData = await this.getTrainingData(modelId);
      
      // Use existing hyperparameters but potentially optimize them
      let hyperparameters = model.hyperparameters;
      
      // Optimize hyperparameters if AutoML is enabled
      if (this.autoMLConfig.enabled) {
        hyperparameters = await this.optimizeHyperparameters(model, trainingData);
      }

      // Create retraining job
      const trainingJob = await this.createTrainingJob(
        modelId,
        trainingData,
        hyperparameters
      );

      // Execute training
      const success = await this.executeTraining(trainingJob);
      
      if (success) {
        // Update model with new training results
        model.accuracy = trainingJob.results?.accuracy || model.accuracy;
        model.precision = trainingJob.results?.precision || model.precision;
        model.recall = trainingJob.results?.recall || model.recall;
        model.f1Score = trainingJob.results?.f1Score || model.f1Score;
        model.trainedOn = new Date();
        model.lastUpdated = new Date();
        model.datasetSize = trainingJob.datasetSize;
        model.hyperparameters = hyperparameters;
        
        // Increment version
        const versionParts = model.version.split('.');
        versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
        model.version = versionParts.join('.');
        
        // Reset production metrics
        model.productionMetrics = {
          predictions: 0,
          correctPredictions: 0,
          averageConfidence: 0,
          latency: 0,
          errorRate: 0,
          drift: 0,
          lastEvaluated: new Date()
        };

        await this.storeModelInRegistry(model);
        return true;
      }
      
      return false;

    } catch (error) {
      this.logger.error('❌ Failed to retrain model', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private async getTrainingData(modelId: string, features?: string[]): Promise<any[]> {
    // This would fetch actual training data from database
    // For now, return mock training data
    
    const dataSize = 1000 + Math.floor(Math.random() * 4000); // 1000-5000 samples
    const mockData = [];
    
    for (let i = 0; i < dataSize; i++) {
      const sample: any = {
        id: i,
        target: Math.random() > 0.6 ? 1 : 0, // 60% positive class
      };
      
      // Add features
      const featureList = features || ['price', 'volume', 'momentum', 'volatility'];
      for (const feature of featureList) {
        sample[feature] = Math.random() * 100;
      }
      
      mockData.push(sample);
    }
    
    return mockData;
  }

  private async optimizeHyperparameters(
    model: MLModel, 
    trainingData: any[]
  ): Promise<Record<string, any>> {
    
    // Simplified hyperparameter optimization
    const currentParams = model.hyperparameters;
    const optimizedParams = { ...currentParams };
    
    // Randomly adjust learning rate
    if (currentParams.learning_rate) {
      const adjustment = (Math.random() - 0.5) * 0.002; // ±0.001
      optimizedParams.learning_rate = Math.max(0.0001, 
        Math.min(0.1, currentParams.learning_rate + adjustment));
    }
    
    // Randomly adjust batch size
    if (currentParams.batch_size) {
      const batchSizes = [16, 32, 64, 128];
      optimizedParams.batch_size = batchSizes[Math.floor(Math.random() * batchSizes.length)];
    }
    
    return optimizedParams;
  }

  private async createTrainingJob(
    modelId: string,
    trainingData: any[],
    hyperparameters: Record<string, any>
  ): Promise<TrainingJob> {
    
    const job: TrainingJob = {
      jobId: `job_${modelId}_${Date.now()}`,
      modelId,
      status: 'queued',
      startTime: new Date(),
      datasetSize: trainingData.length,
      progress: 0,
      hyperparameters
    };

    this.trainingJobs.set(job.jobId, job);
    return job;
  }

  private async executeTraining(job: TrainingJob): Promise<boolean> {
    this.logger.info('🏋️ Executing training job', { jobId: job.jobId });

    try {
      job.status = 'running';
      job.progress = 0;

      // Simulate training process
      const trainingTime = 30 + Math.random() * 60; // 30-90 seconds
      const epochs = 50 + Math.floor(Math.random() * 50); // 50-100 epochs
      
      for (let epoch = 1; epoch <= epochs; epoch++) {
        // Simulate training progress
        job.progress = epoch / epochs;
        
        // Small delay to simulate training
        await new Promise(resolve => setTimeout(resolve, trainingTime * 10)); // Speed up simulation
      }

      // Generate training results
      const baseAccuracy = 0.65 + Math.random() * 0.25; // 65-90% accuracy
      
      job.results = {
        accuracy: baseAccuracy,
        precision: baseAccuracy + (Math.random() - 0.5) * 0.1,
        recall: baseAccuracy + (Math.random() - 0.5) * 0.1,
        f1Score: baseAccuracy + (Math.random() - 0.5) * 0.05,
        validationLoss: (1 - baseAccuracy) + Math.random() * 0.2,
        trainingTime,
        epochs,
        bestEpoch: Math.floor(epochs * 0.8),
        learningCurve: this.generateLearningCurve(epochs),
        featureImportance: this.generateFeatureImportance(job.hyperparameters)
      };

      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 1.0;

      this.logger.info('✅ Training job completed', {
        jobId: job.jobId,
        accuracy: job.results.accuracy
      });

      return true;

    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();

      this.logger.error('❌ Training job failed', {
        jobId: job.jobId,
        error: job.errorMessage
      });

      return false;
    }
  }

  private generateLearningCurve(epochs: number): number[] {
    const curve = [];
    let loss = 1.0;
    
    for (let i = 0; i < epochs; i++) {
      loss = loss * (0.98 + Math.random() * 0.04); // Decreasing loss with noise
      curve.push(loss);
    }
    
    return curve;
  }

  private generateFeatureImportance(hyperparameters: Record<string, any>): Record<string, number> {
    const features = ['price', 'volume', 'momentum', 'volatility', 'trend'];
    const importance: Record<string, number> = {};
    
    let total = 0;
    for (const feature of features) {
      const value = Math.random();
      importance[feature] = value;
      total += value;
    }
    
    // Normalize to sum to 1
    for (const feature of features) {
      importance[feature] = importance[feature] / total;
    }
    
    return importance;
  }

  private async deployUpdatedModel(modelId: string, trainingJob: TrainingJob): Promise<void> {
    const model = this.models.get(modelId);
    if (!model || !trainingJob.results) return;

    // Update model with new training results
    model.accuracy = trainingJob.results.accuracy;
    model.precision = trainingJob.results.precision;
    model.recall = trainingJob.results.recall;
    model.f1Score = trainingJob.results.f1Score;
    model.lastUpdated = new Date();
    model.hyperparameters = trainingJob.hyperparameters;
    
    // Increment version
    const versionParts = model.version.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    model.version = versionParts.join('.');

    await this.storeModelInRegistry(model);
  }

  private async getRecentPerformanceMetrics(modelId: string): Promise<any> {
    // Get recent performance metrics from production
    const model = this.models.get(modelId);
    return model?.productionMetrics || {};
  }

  private async getHistoricalPerformanceMetrics(modelId: string): Promise<any> {
    // Get historical performance metrics
    const cached = await redisCache.get(`model:historical_metrics:${modelId}`);
    return cached ? JSON.parse(cached) : {};
  }

  private calculatePerformanceTrend(recent: any, historical: any): 'improving' | 'declining' | 'stable' {
    if (!recent.accuracy || !historical.accuracy) return 'stable';
    
    const change = recent.accuracy - historical.accuracy;
    
    if (change > 0.02) return 'improving';
    if (change < -0.02) return 'declining';
    return 'stable';
  }

  private async calculateROCAUC(modelId: string): Promise<number> {
    // Simplified ROC-AUC calculation
    const model = this.models.get(modelId);
    if (!model) return 0;
    
    // Estimate based on precision and recall
    return (model.precision + model.recall) / 2;
  }

  private async calculateCalibration(modelId: string): Promise<number> {
    // Simplified calibration professional_score
    const model = this.models.get(modelId);
    if (!model) return 0;
    
    // Estimate calibration based on confidence vs accuracy
    return model.productionMetrics.averageConfidence > 0 ? 
      Math.min(1, model.accuracy / model.productionMetrics.averageConfidence) : 0.5;
  }

  private async runHyperparameterOptimization(
    trainingData: any[],
    problemType: string
  ): Promise<Record<string, any>> {
    
    this.logger.info('🔍 Running hyperparameter optimization');

    // Simplified hyperparameter optimization
    const bestParams: Record<string, any> = {};
    
    // Select best parameters from search space
    if (this.autoMLConfig.searchSpace.learning_rate) {
      const lr_options = this.autoMLConfig.searchSpace.learning_rate;
      bestParams.learning_rate = lr_options[Math.floor(Math.random() * lr_options.length)];
    }
    
    if (this.autoMLConfig.searchSpace.batch_size) {
      const batch_options = this.autoMLConfig.searchSpace.batch_size;
      bestParams.batch_size = batch_options[Math.floor(Math.random() * batch_options.length)];
    }
    
    if (this.autoMLConfig.searchSpace.hidden_layers) {
      const layer_options = this.autoMLConfig.searchSpace.hidden_layers;
      bestParams.hidden_layers = layer_options[Math.floor(Math.random() * layer_options.length)];
    }
    
    if (this.autoMLConfig.searchSpace.dropout) {
      const dropout_options = this.autoMLConfig.searchSpace.dropout;
      bestParams.dropout = dropout_options[Math.floor(Math.random() * dropout_options.length)];
    }

    return bestParams;
  }

  private async storeModelInRegistry(model: MLModel): Promise<void> {
    // Store model metadata in registry
    this.modelRegistry.set(model.modelId, {
      metadata: model,
      storedAt: new Date()
    });

    // Cache model information
    await redisCache.set(
      `model:${model.modelId}`,
      JSON.stringify(model),
      86400 // 24 hours TTL
    );
  }

  private async loadExistingModels(): Promise<void> {
    try {
      const cachedModels = await redisCache.getPattern('model:*');
      
      for (const [key, data] of cachedModels) {
        if (key.includes(':')) {
          const model = JSON.parse(data);
          model.trainedOn = new Date(model.trainedOn);
          model.lastUpdated = new Date(model.lastUpdated);
          model.productionMetrics.lastEvaluated = new Date(model.productionMetrics.lastEvaluated);
          this.models.set(model.modelId, model);
        }
      }

      this.logger.info(`📋 Loaded ${this.models.size} existing models`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load existing models from cache');
    }
  }

  private async loadTrainingJobs(): Promise<void> {
    try {
      const cachedJobs = await redisCache.getPattern('training_job:*');
      
      for (const [key, data] of cachedJobs) {
        const job = JSON.parse(data);
        job.startTime = new Date(job.startTime);
        if (job.endTime) job.endTime = new Date(job.endTime);
        this.trainingJobs.set(job.jobId, job);
      }

      this.logger.info(`📋 Loaded ${this.trainingJobs.size} training jobs`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load training jobs from cache');
    }
  }

  private async loadModelEvaluations(): Promise<void> {
    try {
      const cachedEvaluations = await redisCache.getPattern('model_evaluation:*');
      
      for (const [key, data] of cachedEvaluations) {
        const evaluation = JSON.parse(data);
        evaluation.evaluationDate = new Date(evaluation.evaluationDate);
        evaluation.nextEvaluation = new Date(evaluation.nextEvaluation);
        this.modelEvaluations.set(evaluation.modelId, evaluation);
      }

      this.logger.info(`📋 Loaded ${this.modelEvaluations.size} model evaluations`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load model evaluations from cache');
    }
  }

  private async initializeDefaultModels(): Promise<void> {
    // Create default models if none exist
    if (this.models.size === 0) {
      const defaultModels: Omit<MLModel, 'modelId'>[] = [
        {
          name: 'outcome_predictor',
          type: 'classification',
          version: '1.0.0',
          status: 'deployed',
          accuracy: 0.72,
          precision: 0.75,
          recall: 0.68,
          f1Score: 0.71,
          features: ['odds', 'volume', 'trend', 'momentum'],
          hyperparameters: {
            learning_rate: 0.01,
            batch_size: 64,
            hidden_layers: 3,
            dropout: 0.3
          },
          trainedOn: new Date(),
          lastUpdated: new Date(),
          datasetSize: 10000,
          validationScore: 0.28,
          productionMetrics: {
            predictions: 1500,
            correctPredictions: 1080,
            averageConfidence: 0.73,
            latency: 45,
            errorRate: 0.28,
            drift: 0.05,
            lastEvaluated: new Date()
          }
        },
        {
          name: 'value_estimator',
          type: 'regression',
          version: '1.0.0',
          status: 'deployed',
          accuracy: 0.68,
          precision: 0.70,
          recall: 0.65,
          f1Score: 0.67,
          features: ['market_odds', 'true_odds', 'volume', 'sentiment'],
          hyperparameters: {
            learning_rate: 0.005,
            batch_size: 32,
            hidden_layers: 2,
            dropout: 0.2
          },
          trainedOn: new Date(),
          lastUpdated: new Date(),
          datasetSize: 15000,
          validationScore: 0.32,
          productionMetrics: {
            predictions: 800,
            correctPredictions: 544,
            averageConfidence: 0.69,
            latency: 38,
            errorRate: 0.32,
            drift: 0.08,
            lastEvaluated: new Date()
          }
        }
      ];

      for (const modelData of defaultModels) {
        const modelId = `${modelData.type}_${modelData.name}_${Date.now()}`;
        const model: MLModel = {
          modelId,
          ...modelData
        };
        
        this.models.set(modelId, model);
        await this.storeModelInRegistry(model);
      }

      this.logger.info(`✅ Initialized ${defaultModels.length} default models`);
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.models.size > 0;
  }

  async cleanup(): Promise<void> {
    // Save models
    for (const [modelId, model] of this.models) {
      await redisCache.set(
        `model:${modelId}`,
        JSON.stringify(model),
        86400 // 24 hours TTL
      );
    }

    // Save training jobs
    for (const [jobId, job] of this.trainingJobs) {
      await redisCache.set(
        `training_job:${jobId}`,
        JSON.stringify(job),
        86400 // 24 hours TTL
      );
    }

    // Save evaluations
    for (const [modelId, evaluation] of this.modelEvaluations) {
      await redisCache.set(
        `model_evaluation:${modelId}`,
        JSON.stringify(evaluation),
        86400 // 24 hours TTL
      );
    }

    this.models.clear();
    this.trainingJobs.clear();
    this.modelEvaluations.clear();
    this.modelRegistry.clear();
    
    this.logger.info('🧹 ModelManager cleanup completed');
  }
}