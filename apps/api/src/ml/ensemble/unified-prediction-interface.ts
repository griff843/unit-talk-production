/**
 * Unified Prediction Interface for Phase 4 Ensemble System
 * ========================================================
 *
 * Production-ready TypeScript interface for the meta-model ensemble system.
 * Routes predictions to appropriate sport models and combines results.
 *
 * Features:
 * - Unified interface for all 7 sports
 * - Real-time prediction routing
 * - Confidence-based filtering
 * - Performance monitoring integration
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../../utils/logger';

// Types
export interface PropData {
  sport: 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'NCAAF' | 'NCAAB' | 'WNBA';
  prop_id: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  hour_of_day?: number;
  day_of_week?: number;
  is_primetime?: boolean;
  is_weekend?: boolean;
  [key: string]: any;
}

export interface SportPrediction {
  probability: number;
  binary: number;
  confidence: number;
}

export interface EnsemblePrediction {
  probability: number;
  binary: number;
  confidence: number;
}

export interface PredictionResult {
  sport: string;
  sport_prediction: SportPrediction;
  ensemble_prediction: EnsemblePrediction;
  final_prediction: number | null;
  meets_confidence_threshold: boolean;
  recommendation: string;
  metadata: {
    model_version: string;
    timestamp: string;
    confidence_threshold: number;
  };
  error?: string;
}

export interface EnsembleConfig {
  ensemble_version: string;
  sports: string[];
  ensemble_weights: Record<string, number>;
  confidence_threshold: number;
  target_accuracy: number;
  performance_stats: Record<string, any>;
  individual_performances: Record<string, number>;
  timestamp: string;
}

export interface EnsembleManifest {
  ensemble_name: string;
  version: string;
  description: string;
  sports_supported: string[];
  target_accuracy: number;
  achieved_accuracy: number;
  confidence_threshold: number;
  deployment_ready: boolean;
  files: {
    meta_model: string;
    meta_scaler: string;
    config: string;
  };
  timestamp: string;
}

export class UnifiedPredictionInterface {
  private ensembleConfig: EnsembleConfig | null = null;
  private ensembleManifest: EnsembleManifest | null = null;
  private pythonPath: string;
  private ensembleScriptPath: string;
  private modelsDir: string;
  private isInitialized = false;

  constructor(
    pythonPath: string = 'python',
    modelsDir: string = path.join(__dirname, '../../../ml-models')
  ) {
    this.pythonPath = pythonPath;
    this.modelsDir = modelsDir;
    this.ensembleScriptPath = path.join(__dirname, 'meta-model-ensemble.py');
  }

  /**
   * Initialize the ensemble system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Unified Prediction Interface...');

      // Load ensemble configuration
      await this.loadEnsembleConfig();

      // Verify Python script exists
      const scriptExists = await this.fileExists(this.ensembleScriptPath);
      if (!scriptExists) {
        throw new Error(`Ensemble script not found: ${this.ensembleScriptPath}`);
      }

      // Verify models directory exists
      const modelsExist = await this.fileExists(this.modelsDir);
      if (!modelsExist) {
        throw new Error(`Models directory not found: ${this.modelsDir}`);
      }

      this.isInitialized = true;
      logger.info('✅ Unified Prediction Interface initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Unified Prediction Interface:', error);
      throw error;
    }
  }

  /**
   * Make prediction for a single prop
   */
  async predict(propData: PropData): Promise<PredictionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info(`🎯 Making prediction for ${propData.sport} prop: ${propData.prop_id}`);

      // Validate input
      this.validatePropData(propData);

      // Call Python ensemble system
      const prediction = await this.callPythonPredictor(propData);

      // Log prediction result
      this.logPredictionResult(propData, prediction);

      return prediction;

    } catch (error) {
      logger.error('❌ Prediction failed:', error);
      return {
        sport: propData.sport,
        sport_prediction: { probability: 0.5, binary: 0, confidence: 0 },
        ensemble_prediction: { probability: 0.5, binary: 0, confidence: 0 },
        final_prediction: null,
        meets_confidence_threshold: false,
        recommendation: 'ERROR - Prediction failed',
        metadata: {
          model_version: 'error',
          timestamp: new Date().toISOString(),
          confidence_threshold: 0.6
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Make predictions for multiple props
   */
  async predictBatch(propDataList: PropData[]): Promise<PredictionResult[]> {
    logger.info(`🎯 Making batch predictions for ${propDataList.length} props`);

    const results: PredictionResult[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < propDataList.length; i += batchSize) {
      const batch = propDataList.slice(i, i + batchSize);
      const batchPromises = batch.map(propData => this.predict(propData));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches
      if (i + batchSize < propDataList.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get ensemble system status
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    ensemble_config: EnsembleConfig | null;
    manifest: EnsembleManifest | null;
    sports_supported: string[];
    deployment_ready: boolean;
  }> {
    return {
      initialized: this.isInitialized,
      ensemble_config: this.ensembleConfig,
      manifest: this.ensembleManifest,
      sports_supported: this.ensembleConfig?.sports || [],
      deployment_ready: this.ensembleManifest?.deployment_ready || false
    };
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(): Promise<Record<string, any>> {
    if (!this.ensembleConfig) {
      throw new Error('Ensemble not initialized');
    }

    return {
      ensemble_performance: this.ensembleConfig.performance_stats,
      individual_performances: this.ensembleConfig.individual_performances,
      ensemble_weights: this.ensembleConfig.ensemble_weights,
      target_accuracy: this.ensembleConfig.target_accuracy,
      confidence_threshold: this.ensembleConfig.confidence_threshold
    };
  }

  /**
   * Train the ensemble system
   */
  async trainEnsemble(): Promise<{
    success: boolean;
    performance_report: Record<string, any>;
    output_dir: string;
  }> {
    try {
      logger.info('🚀 Training ensemble system...');

      const result = await this.callPythonScript('train');

      // Reload configuration after training
      await this.loadEnsembleConfig();

      logger.info('✅ Ensemble training completed successfully');
      return result;

    } catch (error) {
      logger.error('❌ Ensemble training failed:', error);
      throw error;
    }
  }

  /**
   * Validate ensemble system
   */
  async validateEnsemble(): Promise<{
    validation_passed: boolean;
    accuracy: number;
    target_met: boolean;
    detailed_results: Record<string, any>;
  }> {
    try {
      logger.info('🔍 Validating ensemble system...');

      const result = await this.callPythonScript('validate');

      logger.info('✅ Ensemble validation completed');
      return result;

    } catch (error) {
      logger.error('❌ Ensemble validation failed:', error);
      throw error;
    }
  }

  // Private methods

  private async loadEnsembleConfig(): Promise<void> {
    try {
      // Find latest ensemble configuration
      const ensembleDir = path.join(this.modelsDir, 'ensemble');
      const files = await fs.readdir(ensembleDir);

      const configFiles = files.filter(f => f.startsWith('ensemble_config_') && f.endsWith('.json'));
      const manifestFiles = files.filter(f => f.startsWith('ensemble_manifest_') && f.endsWith('.json'));

      if (configFiles.length === 0 || manifestFiles.length === 0) {
        logger.warn('⚠️ No ensemble configuration found, will train new ensemble');
        return;
      }

      // Load latest config and manifest
      const latestConfig = configFiles.sort().pop()!;
      const latestManifest = manifestFiles.sort().pop()!;

      const configPath = path.join(ensembleDir, latestConfig);
      const manifestPath = path.join(ensembleDir, latestManifest);

      const configData = await fs.readFile(configPath, 'utf-8');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');

      this.ensembleConfig = JSON.parse(configData);
      this.ensembleManifest = JSON.parse(manifestData);

      logger.info(`✅ Loaded ensemble config: ${latestConfig}`);
      logger.info(`✅ Loaded ensemble manifest: ${latestManifest}`);

    } catch (error) {
      logger.warn('⚠️ Failed to load ensemble configuration:', error);
    }
  }

  private validatePropData(propData: PropData): void {
    const requiredFields = ['sport', 'prop_id', 'player_name', 'stat_type', 'line'];

    for (const field of requiredFields) {
      if (!(field in propData) || propData[field] === null || propData[field] === undefined) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const validSports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA'];
    if (!validSports.includes(propData.sport)) {
      throw new Error(`Invalid sport: ${propData.sport}. Must be one of: ${validSports.join(', ')}`);
    }

    if (typeof propData.line !== 'number' || propData.line <= 0) {
      throw new Error('Line must be a positive number');
    }
  }

  private async callPythonPredictor(propData: PropData): Promise<PredictionResult> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, [
        this.ensembleScriptPath,
        'predict',
        JSON.stringify(propData)
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${error}`));
          }
        } else {
          reject(new Error(`Python process failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error}`));
      });
    });
  }

  private async callPythonScript(operation: string, args?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptArgs = [this.ensembleScriptPath, operation];
      if (args) {
        scriptArgs.push(JSON.stringify(args));
      }

      const pythonProcess = spawn(this.pythonPath, scriptArgs);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${error}`));
          }
        } else {
          reject(new Error(`Python process failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error}`));
      });
    });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private logPredictionResult(propData: PropData, prediction: PredictionResult): void {
    const logLevel = prediction.meets_confidence_threshold ? 'info' : 'warn';

    logger[logLevel](`🎯 Prediction result for ${propData.sport} ${propData.prop_id}:`, {
      sport: prediction.sport,
      ensemble_probability: prediction.ensemble_prediction.probability,
      ensemble_confidence: prediction.ensemble_prediction.confidence,
      recommendation: prediction.recommendation,
      meets_threshold: prediction.meets_confidence_threshold
    });
  }
}

// Export singleton instance
export const unifiedPredictor = new UnifiedPredictionInterface();

// Convenience functions
export async function predictProp(propData: PropData): Promise<PredictionResult> {
  return unifiedPredictor.predict(propData);
}

export async function predictProps(propDataList: PropData[]): Promise<PredictionResult[]> {
  return unifiedPredictor.predictBatch(propDataList);
}

export async function getEnsembleStatus() {
  return unifiedPredictor.getSystemStatus();
}

export async function getEnsemblePerformance() {
  return unifiedPredictor.getPerformanceStats();
}

export async function trainEnsemble() {
  return unifiedPredictor.trainEnsemble();
}

export async function validateEnsemble() {
  return unifiedPredictor.validateEnsemble();
}