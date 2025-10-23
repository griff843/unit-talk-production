"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedPredictor = exports.UnifiedPredictionInterface = void 0;
exports.predictProp = predictProp;
exports.predictProps = predictProps;
exports.getEnsembleStatus = getEnsembleStatus;
exports.getEnsemblePerformance = getEnsemblePerformance;
exports.trainEnsemble = trainEnsemble;
exports.validateEnsemble = validateEnsemble;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const logger_1 = require("../../utils/logger");
class UnifiedPredictionInterface {
    constructor(pythonPath = 'python', modelsDir = path_1.default.join(__dirname, '../../../ml-models')) {
        this.ensembleConfig = null;
        this.ensembleManifest = null;
        this.isInitialized = false;
        this.pythonPath = pythonPath;
        this.modelsDir = modelsDir;
        this.ensembleScriptPath = path_1.default.join(__dirname, 'meta-model-ensemble.py');
    }
    /**
     * Initialize the ensemble system
     */
    async initialize() {
        try {
            logger_1.logger.info('🚀 Initializing Unified Prediction Interface...');
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
            logger_1.logger.info('✅ Unified Prediction Interface initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to initialize Unified Prediction Interface:', error);
            throw error;
        }
    }
    /**
     * Make prediction for a single prop
     */
    async predict(propData) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            logger_1.logger.info(`🎯 Making prediction for ${propData.sport} prop: ${propData.prop_id}`);
            // Validate input
            this.validatePropData(propData);
            // Call Python ensemble system
            const prediction = await this.callPythonPredictor(propData);
            // Log prediction result
            this.logPredictionResult(propData, prediction);
            return prediction;
        }
        catch (error) {
            logger_1.logger.error('❌ Prediction failed:', error);
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
    async predictBatch(propDataList) {
        logger_1.logger.info(`🎯 Making batch predictions for ${propDataList.length} props`);
        const results = [];
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
    async getSystemStatus() {
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
    async getPerformanceStats() {
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
    async trainEnsemble() {
        try {
            logger_1.logger.info('🚀 Training ensemble system...');
            const result = await this.callPythonScript('train');
            // Reload configuration after training
            await this.loadEnsembleConfig();
            logger_1.logger.info('✅ Ensemble training completed successfully');
            return result;
        }
        catch (error) {
            logger_1.logger.error('❌ Ensemble training failed:', error);
            throw error;
        }
    }
    /**
     * Validate ensemble system
     */
    async validateEnsemble() {
        try {
            logger_1.logger.info('🔍 Validating ensemble system...');
            const result = await this.callPythonScript('validate');
            logger_1.logger.info('✅ Ensemble validation completed');
            return result;
        }
        catch (error) {
            logger_1.logger.error('❌ Ensemble validation failed:', error);
            throw error;
        }
    }
    // Private methods
    async loadEnsembleConfig() {
        try {
            // Find latest ensemble configuration
            const ensembleDir = path_1.default.join(this.modelsDir, 'ensemble');
            const files = await promises_1.default.readdir(ensembleDir);
            const configFiles = files.filter(f => f.startsWith('ensemble_config_') && f.endsWith('.json'));
            const manifestFiles = files.filter(f => f.startsWith('ensemble_manifest_') && f.endsWith('.json'));
            if (configFiles.length === 0 || manifestFiles.length === 0) {
                logger_1.logger.warn('⚠️ No ensemble configuration found, will train new ensemble');
                return;
            }
            // Load latest config and manifest
            const latestConfig = configFiles.sort().pop();
            const latestManifest = manifestFiles.sort().pop();
            const configPath = path_1.default.join(ensembleDir, latestConfig);
            const manifestPath = path_1.default.join(ensembleDir, latestManifest);
            const configData = await promises_1.default.readFile(configPath, 'utf-8');
            const manifestData = await promises_1.default.readFile(manifestPath, 'utf-8');
            this.ensembleConfig = JSON.parse(configData);
            this.ensembleManifest = JSON.parse(manifestData);
            logger_1.logger.info(`✅ Loaded ensemble config: ${latestConfig}`);
            logger_1.logger.info(`✅ Loaded ensemble manifest: ${latestManifest}`);
        }
        catch (error) {
            logger_1.logger.warn('⚠️ Failed to load ensemble configuration:', error);
        }
    }
    validatePropData(propData) {
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
    async callPythonPredictor(propData) {
        return new Promise((resolve, reject) => {
            const pythonProcess = (0, child_process_1.spawn)(this.pythonPath, [
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
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse Python output: ${error}`));
                    }
                }
                else {
                    reject(new Error(`Python process failed with code ${code}: ${stderr}`));
                }
            });
            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error}`));
            });
        });
    }
    async callPythonScript(operation, args) {
        return new Promise((resolve, reject) => {
            const scriptArgs = [this.ensembleScriptPath, operation];
            if (args) {
                scriptArgs.push(JSON.stringify(args));
            }
            const pythonProcess = (0, child_process_1.spawn)(this.pythonPath, scriptArgs);
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
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse Python output: ${error}`));
                    }
                }
                else {
                    reject(new Error(`Python process failed with code ${code}: ${stderr}`));
                }
            });
            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error}`));
            });
        });
    }
    async fileExists(filePath) {
        try {
            await promises_1.default.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    logPredictionResult(propData, prediction) {
        const logLevel = prediction.meets_confidence_threshold ? 'info' : 'warn';
        logger_1.logger[logLevel](`🎯 Prediction result for ${propData.sport} ${propData.prop_id}:`, {
            sport: prediction.sport,
            ensemble_probability: prediction.ensemble_prediction.probability,
            ensemble_confidence: prediction.ensemble_prediction.confidence,
            recommendation: prediction.recommendation,
            meets_threshold: prediction.meets_confidence_threshold
        });
    }
}
exports.UnifiedPredictionInterface = UnifiedPredictionInterface;
// Export singleton instance
exports.unifiedPredictor = new UnifiedPredictionInterface();
// Convenience functions
async function predictProp(propData) {
    return exports.unifiedPredictor.predict(propData);
}
async function predictProps(propDataList) {
    return exports.unifiedPredictor.predictBatch(propDataList);
}
async function getEnsembleStatus() {
    return exports.unifiedPredictor.getSystemStatus();
}
async function getEnsemblePerformance() {
    return exports.unifiedPredictor.getPerformanceStats();
}
async function trainEnsemble() {
    return exports.unifiedPredictor.trainEnsemble();
}
async function validateEnsemble() {
    return exports.unifiedPredictor.validateEnsemble();
}
