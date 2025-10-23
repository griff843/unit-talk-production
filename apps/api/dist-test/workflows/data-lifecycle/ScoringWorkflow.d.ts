/**
 * ScoringWorkflow - Professional Pick Scoring Engine
 *
 * Reads feature vectors from WARM tier and applies ensemble scoring
 * with devigging, Kelly fraction calculation, and grade assignment.
 *
 * Grade Distribution:
 * - S-tier: Score >= 85, Edge >= 8%, Kelly >= 0.03 (Elite picks)
 * - A-tier: Score >= 75, Edge >= 5%, Kelly >= 0.02 (Strong picks)
 * - B-tier: Score >= 65, Edge >= 3%, Kelly >= 0.01 (Good picks)
 * - C-tier: Score >= 55, Edge >= 1%, Kelly >= 0.005 (Marginal picks)
 * - D-tier: Score >= 45, Edge >= 0% (Weak picks)
 * - F-tier: Score < 45 or negative edge (Avoid)
 */
export declare function ScoringWorkflow(params: {
    batchSize?: number;
    ensembleWeights?: Record<string, number>;
    minConfidence?: number;
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    propsScored: number;
    gradeDistribution: Record<string, number>;
    averageScore: number;
    averageEdge: number;
    alerts: Array<{
        type: string;
        message: string;
        count: number;
    }>;
    duration: number;
    errors: string[];
}>;
/**
 * Scheduled ScoringWorkflow - Runs every 30 minutes for continuous scoring
 *
 * Optimized for high-throughput professional scoring supporting:
 * - Real-time feature store consumption
 * - Professional grade assignment
 * - Kelly criterion position sizing
 * - Edge detection and alerts
 */
export declare function ScheduledScoringWorkflow(): Promise<void>;
/**
 * Express ScoringWorkflow - Triggered by feature completion events
 *
 * Fast scoring for time-critical scenarios:
 * - New feature computations requiring immediate scoring
 * - Material change events needing rapid assessment
 * - Real-time opportunity identification
 */
export declare function ExpressScoringWorkflow(params: {
    propIds: string[];
    priority: 'normal' | 'high' | 'critical';
    minGrade?: 'S' | 'A' | 'B' | 'C';
}): Promise<void>;
//# sourceMappingURL=ScoringWorkflow.d.ts.map