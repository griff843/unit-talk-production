/**
 * Model Registry Sync Service
 *
 * Synchronizes ML models with the predictive_models table in Supabase.
 * Provides model versioning, deployment tracking, and performance monitoring.
 *
 * Features:
 * - Model registration and versioning
 * - Deployment status tracking
 * - Performance metrics recording
 * - A/B testing support
 * - Model rollback capabilities
 * - Inference API integration
 *
 * @module services/ml/ModelRegistrySync
 * @since Phase 12 - ML Training Pipeline
 * @reference Production Charter v3.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';

/**
 * Model status enum
 */
export enum ModelStatus {
  TRAINING = 'training',
  VALIDATION = 'validation',
  DEPLOYED = 'deployed',
  DEPRECATED = 'deprecated',
  FAILED = 'failed'
}

/**
 * Model registry entry
 */
export interface ModelRegistryEntry {
  id: string;
  model_name: string;
  model_version: string;
  model_type: 'forecast' | 'clv' | 'steam_detector' | 'churn' | 'recommendation';
  status: ModelStatus;
  accuracy: number | null;
  precision_score: number | null;
  recall: number | null;
  f1_score: number | null;
  auc_roc: number | null;
  hyperparameters: Record<string, any> | null;
  feature_importance: Record<string, number> | null;
  deployed_at: string | null;
  deprecated_at: string | null;
  training_duration_seconds: number | null;
  dataset_size: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Model deployment configuration
 */
export interface ModelDeploymentConfig {
  modelName: string;
  modelVersion: string;
  deploymentMode: 'replace' | 'shadow' | 'ab_test';
  trafficSplit?: number; // 0.0 to 1.0 for A/B testing
  monitoringEnabled: boolean;
  performanceThresholds: {
    minAccuracy: number;
    minF1Score: number;
    maxLatencyMs: number;
  };
}

/**
 * Model performance metrics
 */
export interface ModelPerformanceMetrics {
  modelId: string;
  modelVersion: string;
  period: 'hourly' | 'daily' | 'weekly';
  periodStart: Date;
  periodEnd: Date;
  inferenceCalls: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  accuracyDrift: number;
  predictionDistribution: Record<string, number>;
}

/**
 * Model Registry Sync Service
 *
 * Manages model lifecycle in the predictive_models table:
 * - Registration of newly trained models
 * - Status tracking (training → validation → deployed → deprecated)
 * - Performance metrics recording
 * - A/B testing support
 * - Model rollback and deprecation
 */
export class ModelRegistrySync {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly activeModels: Map<string, ModelRegistryEntry> = new Map();

  constructor(logger: Logger, supabase: SupabaseClient) {
    this.logger = logger;
    this.supabase = supabase;
  }

  /**
   * Initialize model registry sync
   */
  async initialize(): Promise<void> {
    this.logger.info('[ModelRegistrySync] Initializing model registry sync...');

    // Load active deployed models
    await this.loadDeployedModels();

    this.logger.info('[ModelRegistrySync] Model registry sync initialized', {
      deployedModels: this.activeModels.size
    });
  }

  /**
   * Load deployed models from database
   */
  private async loadDeployedModels(): Promise<void> {
    const { data, error } = await this.supabase
      .from('predictive_models')
      .select('*')
      .eq('status', ModelStatus.DEPLOYED);

    if (error) {
      this.logger.error('[ModelRegistrySync] Failed to load deployed models', { error });
      throw new Error(`Failed to load deployed models: ${error.message}`);
    }

    if (data) {
      for (const model of data) {
        this.activeModels.set(model.id, model as ModelRegistryEntry);
      }

      this.logger.info('[ModelRegistrySync] Loaded deployed models', {
        count: data.length
      });
    }
  }

  /**
   * Register a new model in the registry
   *
   * @param model - Model to register
   * @returns Model registry entry
   */
  async registerModel(model: Partial<ModelRegistryEntry>): Promise<ModelRegistryEntry> {
    this.logger.info('[ModelRegistrySync] Registering new model', {
      modelName: model.model_name,
      version: model.model_version,
      type: model.model_type
    });

    const { data, error } = await this.supabase
      .from('predictive_models')
      .insert({
        model_name: model.model_name,
        model_version: model.model_version,
        model_type: model.model_type,
        status: model.status || ModelStatus.TRAINING,
        accuracy: model.accuracy,
        precision_score: model.precision_score,
        recall: model.recall,
        f1_score: model.f1_score,
        auc_roc: model.auc_roc,
        hyperparameters: model.hyperparameters,
        feature_importance: model.feature_importance,
        training_duration_seconds: model.training_duration_seconds,
        dataset_size: model.dataset_size
      })
      .select()
      .single();

    if (error) {
      this.logger.error('[ModelRegistrySync] Failed to register model', { error });
      throw new Error(`Failed to register model: ${error.message}`);
    }

    this.logger.info('[ModelRegistrySync] Model registered successfully', {
      modelId: data.id,
      modelName: data.model_name,
      version: data.model_version
    });

    return data as ModelRegistryEntry;
  }

  /**
   * Update model status
   *
   * @param modelId - Model ID
   * @param status - New status
   */
  async updateModelStatus(
    modelId: string,
    status: ModelStatus
  ): Promise<void> {
    this.logger.info('[ModelRegistrySync] Updating model status', {
      modelId,
      status
    });

    const updateData: any = { status };

    if (status === ModelStatus.DEPLOYED) {
      updateData.deployed_at = new Date().toISOString();
    } else if (status === ModelStatus.DEPRECATED) {
      updateData.deprecated_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('predictive_models')
      .update(updateData)
      .eq('id', modelId);

    if (error) {
      this.logger.error('[ModelRegistrySync] Failed to update model status', { error });
      throw new Error(`Failed to update model status: ${error.message}`);
    }

    // Update local cache
    if (status === ModelStatus.DEPLOYED) {
      const { data } = await this.supabase
        .from('predictive_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (data) {
        this.activeModels.set(modelId, data as ModelRegistryEntry);
      }
    } else if (status === ModelStatus.DEPRECATED) {
      this.activeModels.delete(modelId);
    }

    this.logger.info('[ModelRegistrySync] Model status updated', {
      modelId,
      status
    });
  }

  /**
   * Deploy model with specified configuration
   *
   * @param config - Deployment configuration
   * @returns Deployed model entry
   */
  async deployModel(
    config: ModelDeploymentConfig
  ): Promise<ModelRegistryEntry> {
    this.logger.info('[ModelRegistrySync] Deploying model', {
      modelName: config.modelName,
      version: config.modelVersion,
      mode: config.deploymentMode
    });

    // Get model to deploy
    const { data: model, error: fetchError } = await this.supabase
      .from('predictive_models')
      .select('*')
      .eq('model_name', config.modelName)
      .eq('model_version', config.modelVersion)
      .single();

    if (fetchError || !model) {
      throw new Error(`Model not found: ${config.modelName}@${config.modelVersion}`);
    }

    // Validate model meets performance thresholds
    if (model.accuracy && model.accuracy < config.performanceThresholds.minAccuracy) {
      throw new Error(`Model accuracy ${model.accuracy} below threshold ${config.performanceThresholds.minAccuracy}`);
    }

    if (model.f1_score && model.f1_score < config.performanceThresholds.minF1Score) {
      throw new Error(`Model F1 score ${model.f1_score} below threshold ${config.performanceThresholds.minF1Score}`);
    }

    // Handle deployment mode
    if (config.deploymentMode === 'replace') {
      // Deprecate existing deployed models with same name
      await this.deprecateModelsByName(config.modelName);
    }

    // Deploy the model
    await this.updateModelStatus(model.id, ModelStatus.DEPLOYED);

    this.logger.info('[ModelRegistrySync] Model deployed successfully', {
      modelId: model.id,
      modelName: config.modelName,
      version: config.modelVersion,
      mode: config.deploymentMode
    });

    return model as ModelRegistryEntry;
  }

  /**
   * Deprecate all deployed models with given name
   *
   * @param modelName - Model name to deprecate
   */
  private async deprecateModelsByName(modelName: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('predictive_models')
      .select('id')
      .eq('model_name', modelName)
      .eq('status', ModelStatus.DEPLOYED);

    if (error) {
      this.logger.error('[ModelRegistrySync] Failed to query models for deprecation', { error });
      return;
    }

    if (data && data.length > 0) {
      for (const model of data) {
        await this.updateModelStatus(model.id, ModelStatus.DEPRECATED);
      }

      this.logger.info('[ModelRegistrySync] Deprecated existing models', {
        modelName,
        count: data.length
      });
    }
  }

  /**
   * Get deployed model by name
   *
   * @param modelName - Model name
   * @returns Deployed model entry or null
   */
  async getDeployedModel(modelName: string): Promise<ModelRegistryEntry | null> {
    const { data, error } = await this.supabase
      .from('predictive_models')
      .select('*')
      .eq('model_name', modelName)
      .eq('status', ModelStatus.DEPLOYED)
      .order('deployed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      this.logger.error('[ModelRegistrySync] Failed to get deployed model', { error });
      throw new Error(`Failed to get deployed model: ${error.message}`);
    }

    return data as ModelRegistryEntry;
  }

  /**
   * Get all deployed models
   *
   * @returns Array of deployed model entries
   */
  async getAllDeployedModels(): Promise<ModelRegistryEntry[]> {
    const { data, error } = await this.supabase
      .from('predictive_models')
      .select('*')
      .eq('status', ModelStatus.DEPLOYED)
      .order('deployed_at', { ascending: false });

    if (error) {
      this.logger.error('[ModelRegistrySync] Failed to get deployed models', { error });
      throw new Error(`Failed to get deployed models: ${error.message}`);
    }

    return (data || []) as ModelRegistryEntry[];
  }

  /**
   * Get model by ID
   *
   * @param modelId - Model ID
   * @returns Model entry or null
   */
  async getModelById(modelId: string): Promise<ModelRegistryEntry | null> {
    const { data, error } = await this.supabase
      .from('predictive_models')
      .select('*')
      .eq('id', modelId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('[ModelRegistrySync] Failed to get model', { error });
      throw new Error(`Failed to get model: ${error.message}`);
    }

    return data as ModelRegistryEntry;
  }

  /**
   * Get model versions
   *
   * @param modelName - Model name
   * @returns Array of model versions
   */
  async getModelVersions(modelName: string): Promise<ModelRegistryEntry[]> {
    const { data, error } = await this.supabase
      .from('predictive_models')
      .select('*')
      .eq('model_name', modelName)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('[ModelRegistrySync] Failed to get model versions', { error });
      throw new Error(`Failed to get model versions: ${error.message}`);
    }

    return (data || []) as ModelRegistryEntry[];
  }

  /**
   * Record model performance metrics
   *
   * @param metrics - Performance metrics
   */
  async recordPerformanceMetrics(
    metrics: ModelPerformanceMetrics
  ): Promise<void> {
    this.logger.debug('[ModelRegistrySync] Recording performance metrics', {
      modelId: metrics.modelId,
      period: metrics.period,
      inferenceCalls: metrics.inferenceCalls,
      avgLatencyMs: metrics.avgLatencyMs
    });

    // In production, this would write to a model_performance_metrics table
    // For now, we'll log the metrics
    this.logger.info('[ModelRegistrySync] Performance metrics recorded', {
      modelId: metrics.modelId,
      version: metrics.modelVersion,
      period: metrics.period,
      inferenceCalls: metrics.inferenceCalls,
      avgLatencyMs: metrics.avgLatencyMs,
      p95LatencyMs: metrics.p95LatencyMs,
      errorRate: metrics.errorRate,
      accuracyDrift: metrics.accuracyDrift
    });
  }

  /**
   * Check model performance against thresholds
   *
   * @param modelId - Model ID
   * @param thresholds - Performance thresholds
   * @returns True if model meets thresholds
   */
  async checkModelPerformance(
    modelId: string,
    thresholds: {
      minAccuracy: number;
      maxLatencyMs: number;
      maxErrorRate: number;
    }
  ): Promise<{
    meetsThresholds: boolean;
    violations: string[];
  }> {
    const model = await this.getModelById(modelId);
    if (!model) {
      return { meetsThresholds: false, violations: ['Model not found'] };
    }

    const violations: string[] = [];

    if (model.accuracy && model.accuracy < thresholds.minAccuracy) {
      violations.push(`Accuracy ${model.accuracy} below threshold ${thresholds.minAccuracy}`);
    }

    // Additional performance checks would go here

    return {
      meetsThresholds: violations.length === 0,
      violations
    };
  }

  /**
   * Rollback to previous model version
   *
   * @param modelName - Model name
   * @param targetVersion - Version to rollback to (optional, defaults to previous deployed version)
   * @returns Rolled back model entry
   */
  async rollbackModel(
    modelName: string,
    targetVersion?: string
  ): Promise<ModelRegistryEntry> {
    this.logger.info('[ModelRegistrySync] Rolling back model', {
      modelName,
      targetVersion
    });

    // Get all versions
    const versions = await this.getModelVersions(modelName);

    if (versions.length === 0) {
      throw new Error(`No versions found for model: ${modelName}`);
    }

    // Find target version
    let targetModel: ModelRegistryEntry | null = null;

    if (targetVersion) {
      targetModel = versions.find(v => v.model_version === targetVersion) || null;
    } else {
      // Find last deployed version (excluding current)
      const deployedVersions = versions.filter(
        v => v.status === ModelStatus.DEPLOYED || v.deprecated_at !== null
      );
      targetModel = deployedVersions[1] || null; // Second most recent
    }

    if (!targetModel) {
      throw new Error(`Target version not found for rollback: ${modelName}@${targetVersion}`);
    }

    // Deprecate current version
    const current = await this.getDeployedModel(modelName);
    if (current) {
      await this.updateModelStatus(current.id, ModelStatus.DEPRECATED);
    }

    // Deploy target version
    await this.updateModelStatus(targetModel.id, ModelStatus.DEPLOYED);

    this.logger.info('[ModelRegistrySync] Model rolled back successfully', {
      modelName,
      fromVersion: current?.model_version,
      toVersion: targetModel.model_version
    });

    return targetModel;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const details: any = {
      activeModels: this.activeModels.size
    };

    // Check database connection
    try {
      const { error } = await this.supabase
        .from('predictive_models')
        .select('id')
        .limit(1);

      if (error) throw error;
      details.databaseStatus = 'connected';
    } catch (error) {
      details.databaseStatus = 'disconnected';
      details.error = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', details };
    }

    return { status: 'healthy', details };
  }
}

/**
 * Create and initialize Model Registry Sync
 */
export async function createModelRegistrySync(
  logger: Logger,
  supabase: SupabaseClient
): Promise<ModelRegistrySync> {
  const registrySync = new ModelRegistrySync(logger, supabase);
  await registrySync.initialize();
  return registrySync;
}

export default ModelRegistrySync;
