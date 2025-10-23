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
export declare class UnifiedPredictionInterface {
    private ensembleConfig;
    private ensembleManifest;
    private pythonPath;
    private ensembleScriptPath;
    private modelsDir;
    private isInitialized;
    constructor(pythonPath?: string, modelsDir?: string);
    /**
     * Initialize the ensemble system
     */
    initialize(): Promise<void>;
    /**
     * Make prediction for a single prop
     */
    predict(propData: PropData): Promise<PredictionResult>;
    /**
     * Make predictions for multiple props
     */
    predictBatch(propDataList: PropData[]): Promise<PredictionResult[]>;
    /**
     * Get ensemble system status
     */
    getSystemStatus(): Promise<{
        initialized: boolean;
        ensemble_config: EnsembleConfig | null;
        manifest: EnsembleManifest | null;
        sports_supported: string[];
        deployment_ready: boolean;
    }>;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): Promise<Record<string, any>>;
    /**
     * Train the ensemble system
     */
    trainEnsemble(): Promise<{
        success: boolean;
        performance_report: Record<string, any>;
        output_dir: string;
    }>;
    /**
     * Validate ensemble system
     */
    validateEnsemble(): Promise<{
        validation_passed: boolean;
        accuracy: number;
        target_met: boolean;
        detailed_results: Record<string, any>;
    }>;
    private loadEnsembleConfig;
    private validatePropData;
    private callPythonPredictor;
    private callPythonScript;
    private fileExists;
    private logPredictionResult;
}
export declare const unifiedPredictor: UnifiedPredictionInterface;
export declare function predictProp(propData: PropData): Promise<PredictionResult>;
export declare function predictProps(propDataList: PropData[]): Promise<PredictionResult[]>;
export declare function getEnsembleStatus(): Promise<{
    initialized: boolean;
    ensemble_config: EnsembleConfig | null;
    manifest: EnsembleManifest | null;
    sports_supported: string[];
    deployment_ready: boolean;
}>;
export declare function getEnsemblePerformance(): Promise<Record<string, any>>;
export declare function trainEnsemble(): Promise<{
    success: boolean;
    performance_report: Record<string, any>;
    output_dir: string;
}>;
export declare function validateEnsemble(): Promise<{
    validation_passed: boolean;
    accuracy: number;
    target_met: boolean;
    detailed_results: Record<string, any>;
}>;
//# sourceMappingURL=unified-prediction-interface.d.ts.map