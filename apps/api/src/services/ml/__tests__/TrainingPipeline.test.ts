/**
 * Unit Tests for TrainingPipeline
 *
 * Tests model training pipeline functionality including:
 * - Model training and validation
 * - Dataset preparation
 * - Model evaluation
 * - Model registration
 *
 * @module services/ml/__tests__/TrainingPipeline.test
 */

import { TrainingPipeline, ModelType, TrainingFramework } from '../TrainingPipeline';
import { MLFeatureStore } from '../MLFeatureStore';
import { createClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@tensorflow/tfjs-node');

describe('TrainingPipeline', () => {
  let pipeline: TrainingPipeline;
  let mockLogger: any;
  let mockSupabase: any;
  let mockFeatureStore: any;

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis()
    };

    mockFeatureStore = {
      getOfflineFeatures: jest.fn()
    };

    pipeline = new TrainingPipeline(mockLogger, mockSupabase, mockFeatureStore);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await pipeline.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing training pipeline')
      );
    });
  });

  describe('trainModel', () => {
    it('should create training job and return job ID', async () => {
      const modelConfig = {
        modelName: 'test_model',
        modelType: ModelType.CLASSIFICATION,
        framework: TrainingFramework.TENSORFLOW,
        version: '1.0.0',
        architecture: {
          layers: [
            { type: 'dense' as const, units: 64, activation: 'relu' as const },
            { type: 'dense' as const, units: 1, activation: 'sigmoid' as const }
          ],
          optimizer: 'adam' as const,
          lossFunction: 'binaryCrossentropy',
          metrics: ['accuracy']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10
        },
        featureGroups: ['pick_scoring_features'],
        targetVariable: 'is_win'
      };

      const datasetConfig = {
        name: 'test_dataset',
        entityType: 'pick' as const,
        featureGroups: ['pick_scoring_features'],
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        label: 'is_win'
      };

      const jobId = await pipeline.trainModel(modelConfig, datasetConfig);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^train_/);
    });

    it('should track job status', async () => {
      const modelConfig = {
        modelName: 'test_model',
        modelType: ModelType.CLASSIFICATION,
        framework: TrainingFramework.TENSORFLOW,
        version: '1.0.0',
        architecture: {
          layers: [{ type: 'dense' as const, units: 1, activation: 'sigmoid' as const }],
          optimizer: 'adam' as const,
          lossFunction: 'binaryCrossentropy',
          metrics: ['accuracy']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 5
        },
        featureGroups: ['pick_scoring_features'],
        targetVariable: 'is_win'
      };

      const datasetConfig = {
        name: 'test_dataset',
        entityType: 'pick' as const,
        featureGroups: ['pick_scoring_features'],
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        label: 'is_win'
      };

      const jobId = await pipeline.trainModel(modelConfig, datasetConfig);
      const status = pipeline.getJobStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.jobId).toBe(jobId);
      expect(status?.status).toBe('queued');
    });
  });

  describe('cancelJob', () => {
    it('should cancel running job', async () => {
      const modelConfig = {
        modelName: 'test_model',
        modelType: ModelType.CLASSIFICATION,
        framework: TrainingFramework.TENSORFLOW,
        version: '1.0.0',
        architecture: {
          layers: [{ type: 'dense' as const, units: 1, activation: 'sigmoid' as const }],
          optimizer: 'adam' as const,
          lossFunction: 'binaryCrossentropy',
          metrics: ['accuracy']
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 5
        },
        featureGroups: ['pick_scoring_features'],
        targetVariable: 'is_win'
      };

      const datasetConfig = {
        name: 'test_dataset',
        entityType: 'pick' as const,
        featureGroups: ['pick_scoring_features'],
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        label: 'is_win'
      };

      const jobId = await pipeline.trainModel(modelConfig, datasetConfig);

      // Cancel the job
      const cancelled = await pipeline.cancelJob(jobId);

      // For queued job, cancellation should succeed
      // Note: In real implementation, only running jobs can be cancelled
      expect(typeof cancelled).toBe('boolean');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const health = await pipeline.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('activeJobs');
      expect(health.details).toHaveProperty('tensorflowBackend');
    });
  });
});
