/**
 * EnhancedGradingWorkflow - Professional Prop Scoring with Feature Store Integration
 *
 * Features:
 * - 45-factor professional scoring system
 * - Material change detection and re-scoring
 * - Feature store integration for consistent data
 * - Idempotent processing with deduplication
 * - Real-time alerts for high-value opportunities
 * - Comprehensive risk management
 *
 * Handles 8K+ simultaneous props with sub-second processing
 */
export declare function EnhancedGradingWorkflow(params: {
    batchSize?: number;
    sports?: string[];
    priority?: 'normal' | 'high' | 'critical';
    scoringMethod?: 'weighted' | 'ensemble' | 'neural';
    features?: string[];
    onlyRegrade?: boolean;
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    processedProps: number;
    averageScore: number;
    highValueProps: number;
    materialChanges: number;
    alerts: number;
    duration: number;
    errors: string[];
}>;
/**
 * Scheduled EnhancedGradingWorkflow - Runs every 15 minutes for real-time scoring
 */
export declare function ScheduledEnhancedGradingWorkflow(): Promise<void>;
/**
 * Material Change Re-grading Workflow - Triggered by significant feature changes
 */
export declare function MaterialChangeGradingWorkflow(params: {
    propIds: string[];
    changedFeatures: string[];
    changeMagnitude: 'medium' | 'high' | 'critical';
}): Promise<void>;
//# sourceMappingURL=EnhancedGradingWorkflow.d.ts.map