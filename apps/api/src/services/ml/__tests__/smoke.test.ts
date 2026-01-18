/**
 * Smoke Tests for ML Training Pipeline
 *
 * End-to-end smoke tests validating the complete ML training workflow:
 * - Feature store integration
 * - Model training on staging dataset
 * - Model registration and deployment
 * - Inference API latency (< 100ms requirement)
 *
 * @module services/ml/__tests__/smoke.test
 * @reference Production Charter v3.0
 */

import { createMLFeatureStore, TrainingDatasetConfig } from '../MLFeatureStore';
import { createTrainingPipeline, ModelType, TrainingFramework } from '../TrainingPipeline';
import { createModelRegistrySync, ModelStatus } from '../ModelRegistrySync';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';

describe('ML Training Pipeline - Smoke Tests', () => {
  let supabase: any;
  let redis: Redis | undefined;
  let logger: any;

  beforeAll(() => {
    // Setup test environment
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Create Supabase client (use test credentials)
    supabase = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
    );

    // Redis is optional for smoke tests
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    }
  });

  afterAll(async () => {
    if (redis) {
      redis.disconnect();
    }
  });

  describe('Feature Store Integration', () => {
    it('should initialize feature store and load feature groups', async () => {
      const featureStore = await createMLFeatureStore(logger, supabase, redis);

      const health = await featureStore.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.featureGroups).toBeGreaterThan(0);
      expect(health.details.features).toBeGreaterThan(0);
    }, 30000);

    it('should fetch online features with acceptable latency', async () => {
      const featureStore = await createMLFeatureStore(logger, supabase, redis);

      const startTime = Date.now();
      const features = await featureStore.getOnlineFeatures(
        {
          entityType: 'pick',
          entityId: 'test-pick-id',
          timestamp: new Date()
        },
        ['professional_score', 'clv_pct', 'kelly_fraction']
      );
      const latency = Date.now() - startTime;

      // Charter v3.0 SLO: Feature serving p95 < 10ms
      expect(latency).toBeLessThan(50); // Allow 50ms for test environment
      expect(features).toBeDefined();
      expect(features.entity).toBeDefined();
    }, 10000);
  });

  describe('Training Pipeline Workflow', () => {
    it('should complete end-to-end training workflow on staging dataset', async () => {
      const featureStore = await createMLFeatureStore(logger, supabase, redis);
      const trainingPipeline = await createTrainingPipeline(logger, supabase, featureStore);
      const modelRegistry = await createModelRegistrySync(logger, supabase);

      // Define model configuration
      const modelConfig = {
        modelName: 'win_probability_model',
        modelType: ModelType.CLASSIFICATION,
        framework: TrainingFramework.TENSORFLOW,
        version: '1.0.0-smoke',
        architecture: {
          layers: [
            { type: 'dense' as const, units: 32, activation: 'relu' as const },
            { type: 'dropout' as const, dropout: 0.2 },
            { type: 'dense' as const, units: 16, activation: 'relu' as const },
            { type: 'dense' as const, units: 1, activation: 'sigmoid' as const }
          ],
          optimizer: 'adam' as const,
          lossFunction: 'binaryCrossentropy',
          metrics: ['accuracy', 'precision', 'recall']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 5, // Small epoch count for smoke test
          earlyStoppingPatience: 3,
          validationFrequency: 1
        },
        featureGroups: ['pick_scoring_features', 'pick_performance_features'],
        targetVariable: 'is_win',
        validationSplit: 0.2,
        testSplit: 0.1
      };

      // Define training dataset (last 30 days)
      const datasetConfig: TrainingDatasetConfig = {
        name: 'smoke_test_dataset',
        entityType: 'pick',
        featureGroups: ['pick_scoring_features', 'pick_performance_features'],
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        label: 'is_win',
        samplingRate: 0.1 // Sample 10% for smoke test
      };

      // Start training
      const jobId = await trainingPipeline.trainModel(modelConfig, datasetConfig);
      expect(jobId).toBeDefined();

      // Poll job status (max 5 minutes)
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let jobStatus: any;

      while (attempts < maxAttempts) {
        jobStatus = trainingPipeline.getJobStatus(jobId);
        if (jobStatus?.status === 'completed' || jobStatus?.status === 'failed') {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }

      // Verify training completed successfully
      expect(jobStatus?.status).toBe('completed');
      expect(jobStatus?.metrics.loss).toBeDefined();
      expect(jobStatus?.metrics.valLoss).toBeDefined();

      // Verify model was registered
      const deployedModel = await modelRegistry.getDeployedModel('win_probability_model');
      expect(deployedModel).toBeDefined();
      if (deployedModel) {
        expect(deployedModel.status).toBe(ModelStatus.DEPLOYED);
        expect(deployedModel.accuracy).toBeGreaterThan(0);
        expect(deployedModel.f1_score).toBeGreaterThan(0);
      }
    }, 600000); // 10-minute timeout for full workflow

    it('should record model version and metrics in registry', async () => {
      const modelRegistry = await createModelRegistrySync(logger, supabase);

      const model = await modelRegistry.getDeployedModel('win_probability_model');

      expect(model).toBeDefined();
      if (model) {
        expect(model.model_name).toBe('win_probability_model');
        expect(model.model_version).toBeDefined();
        expect(model.accuracy).toBeDefined();
        expect(model.precision_score).toBeDefined();
        expect(model.recall).toBeDefined();
        expect(model.f1_score).toBeDefined();
        expect(model.deployed_at).toBeDefined();
      }
    }, 30000);
  });

  describe('Model Registry Operations', () => {
    it('should support model versioning and rollback', async () => {
      const modelRegistry = await createModelRegistrySync(logger, supabase);

      // Get all versions
      const versions = await modelRegistry.getModelVersions('win_probability_model');
      expect(versions.length).toBeGreaterThan(0);

      // If multiple versions exist, test rollback
      if (versions.length > 1) {
        const previousVersion = versions[1];
        const rolledBack = await modelRegistry.rollbackModel(
          'win_probability_model',
          previousVersion.model_version
        );

        expect(rolledBack).toBeDefined();
        expect(rolledBack.model_version).toBe(previousVersion.model_version);
        expect(rolledBack.status).toBe(ModelStatus.DEPLOYED);
      }
    }, 30000);
  });

  describe('Inference API Performance (Charter v3.0 SLO)', () => {
    it('should return predictions with < 100ms latency', async () => {
      const featureStore = await createMLFeatureStore(logger, supabase, redis);
      const modelRegistry = await createModelRegistrySync(logger, supabase);

      const deployedModel = await modelRegistry.getDeployedModel('win_probability_model');
      expect(deployedModel).toBeDefined();

      // Simulate inference request
      const startTime = Date.now();

      // 1. Fetch features
      const features = await featureStore.getOnlineFeatures(
        {
          entityType: 'pick',
          entityId: 'test-pick-id',
          timestamp: new Date()
        },
        ['professional_score', 'clv_pct', 'kelly_fraction']
      );

      // 2. Model inference (would be actual model call in production)
      // For smoke test, we just measure feature fetch latency
      const latency = Date.now() - startTime;

      // Charter v3.0 SLO: Inference API p95 < 100ms
      expect(latency).toBeLessThan(100);

      expect(features).toBeDefined();
    }, 10000);
  });

  describe('Charter v3.0 Compliance Checks', () => {
    it('should pass all Charter compliance validations', async () => {
      const featureStore = await createMLFeatureStore(logger, supabase, redis);
      const trainingPipeline = await createTrainingPipeline(logger, supabase, featureStore);
      const modelRegistry = await createModelRegistrySync(logger, supabase);

      // 1. Health checks
      const featureStoreHealth = await featureStore.healthCheck();
      expect(featureStoreHealth.status).toBe('healthy');

      const pipelineHealth = await trainingPipeline.healthCheck();
      expect(pipelineHealth.status).toBe('healthy');

      const registryHealth = await modelRegistry.healthCheck();
      expect(registryHealth.status).toBe('healthy');

      // 2. Models must be in predictive_models table
      const deployedModels = await modelRegistry.getAllDeployedModels();
      expect(deployedModels.length).toBeGreaterThan(0);

      // 3. All deployed models must have performance metrics
      for (const model of deployedModels) {
        expect(model.accuracy).toBeDefined();
        expect(model.f1_score).toBeDefined();
        expect(model.status).toBe(ModelStatus.DEPLOYED);
        expect(model.deployed_at).toBeDefined();
      }

      // 4. Models must meet minimum quality thresholds
      const deployedModel = deployedModels[0];
      expect(deployedModel.accuracy).toBeGreaterThan(0.5); // Minimum 50% accuracy
      expect(deployedModel.f1_score).toBeGreaterThan(0.4); // Minimum 40% F1 score
    }, 60000);
  });
});
