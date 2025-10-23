/**
 * FeatureBuilderWorkflow - Real-time Feature Computation Engine
 *
 * Runs hourly to compute 45-factor scoring features including:
 * - Rolling averages and volatility metrics
 * - Market efficiency and steam detection
 * - Player form and correlation analysis
 * - Line movement and sharp money indicators
 *
 * Optimized for 8K+ simultaneous props with parallel processing
 */
export declare function FeatureBuilderWorkflow(params: {
    lookbackHours?: number;
    computeAll?: boolean;
    sports?: string[];
    batchSize?: number;
    features?: string[];
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    featuresComputed: Record<string, number>;
    totalProps: number;
    alerts: Array<{
        type: string;
        message: string;
        count: number;
    }>;
    duration: number;
    errors: string[];
}>;
/**
 * Scheduled FeatureBuilderWorkflow - Runs hourly for real-time features
 *
 * Optimized for continuous feature computation supporting:
 * - Real-time prop scoring and alerts
 * - Material change detection
 * - Steam move identification
 * - Risk management signals
 */
export declare function ScheduledFeatureBuilderWorkflow(): Promise<void>;
/**
 * Express FeatureBuilderWorkflow - Triggered by material changes
 *
 * Fast computation for time-critical scenarios:
 * - Steam moves requiring immediate analysis
 * - Line movements exceeding thresholds
 * - Breaking news impact assessment
 */
export declare function ExpressFeatureBuilderWorkflow(params: {
    propIds: string[];
    priority: 'normal' | 'high' | 'critical';
    features: string[];
}): Promise<void>;
//# sourceMappingURL=FeatureBuilderWorkflow.d.ts.map