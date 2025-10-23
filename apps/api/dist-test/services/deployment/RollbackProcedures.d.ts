/**
 * Comprehensive Rollback Procedures Service
 *
 * Advanced rollback system for feature flag deployments with:
 * - Intelligent rollback triggers
 * - Multi-phase rollback strategies
 * - State preservation and recovery
 * - Impact minimization protocols
 * - Automated incident management
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface RollbackTrigger {
    type: 'manual' | 'automatic' | 'scheduled' | 'dependency_failure';
    severity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    triggeredBy: string;
    metadata: Record<string, any>;
    requiresApproval: boolean;
}
export interface RollbackStrategy {
    name: string;
    description: string;
    phases: RollbackPhase[];
    estimatedDuration: number;
    riskLevel: 'low' | 'medium' | 'high';
    prerequisites: string[];
    successCriteria: string[];
}
export interface RollbackPhase {
    phaseName: string;
    description: string;
    actions: RollbackAction[];
    validationChecks: string[];
    timeoutSeconds: number;
    retryCount: number;
    rollbackOnFailure: boolean;
}
export interface RollbackAction {
    actionType: 'flag_update' | 'database_rollback' | 'cache_clear' | 'service_restart' | 'notification' | 'custom';
    description: string;
    parameters: Record<string, any>;
    timeoutSeconds: number;
    critical: boolean;
    compensatingAction?: RollbackAction;
}
export interface RollbackExecution {
    executionId: string;
    flagName: string;
    strategy: RollbackStrategy;
    trigger: RollbackTrigger;
    startTime: string;
    endTime?: string;
    status: 'planning' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
    currentPhase: number;
    phases: RollbackPhaseResult[];
    totalDuration?: number;
    impactAssessment: ImpactAssessment;
    recovery: RecoveryPlan;
}
export interface RollbackPhaseResult {
    phaseName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    duration?: number;
    actions: RollbackActionResult[];
    validationResults: ValidationResult[];
    errors: string[];
}
export interface RollbackActionResult {
    actionType: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    duration?: number;
    result?: any;
    error?: string;
    compensatingActionExecuted?: boolean;
}
export interface ValidationResult {
    checkName: string;
    passed: boolean;
    result: any;
    error?: string;
    timestamp: string;
}
export interface ImpactAssessment {
    estimatedUsersAffected: number;
    estimatedRevenueImpact: number;
    serviceDegradation: 'none' | 'minimal' | 'moderate' | 'severe';
    rollbackComplexity: 'simple' | 'moderate' | 'complex' | 'high_risk';
    dependentServices: string[];
    mitigationStrategies: string[];
}
export interface RecoveryPlan {
    estimatedRecoveryTime: number;
    recoverySteps: string[];
    postRollbackTasks: string[];
    preventionMeasures: string[];
    followUpActions: string[];
}
export declare class RollbackProcedures {
    private logger;
    private supabase;
    private featureFlagService;
    private validationGates;
    private activeRollbacks;
    private rollbackStrategies;
    private rollbackHistory;
    private successRate;
    private averageRollbackTime;
    constructor(supabase: SupabaseClient);
    /**
     * Initialize predefined rollback strategies
     */
    private initializeRollbackStrategies;
    /**
     * Execute rollback for a feature flag
     */
    executeRollback(flagName: string, trigger: RollbackTrigger, strategyName?: string): Promise<string>;
    /**
     * Execute rollback phases sequentially
     */
    private executeRollbackPhases;
    /**
     * Execute individual rollback phase
     */
    private executeRollbackPhase;
    /**
     * Execute individual rollback action
     */
    private executeRollbackAction;
    /**
     * Execute flag update action
     */
    private executeFlagUpdateAction;
    /**
     * Execute database rollback action
     */
    private executeDatabaseRollbackAction;
    /**
     * Execute cache clear action
     */
    private executeCacheClearAction;
    /**
     * Execute service restart action
     */
    private executeServiceRestartAction;
    /**
     * Execute notification action
     */
    private executeNotificationAction;
    /**
     * Execute custom action
     */
    private executeCustomAction;
    /**
     * Run validation check
     */
    private runValidationCheck;
    /**
     * Select appropriate rollback strategy
     */
    private selectRollbackStrategy;
    /**
     * Assess rollback impact
     */
    private assessRollbackImpact;
    /**
     * Create recovery plan
     */
    private createRecoveryPlan;
    private storeRollbackExecution;
    private emitRollbackEvent;
    private requestRollbackApproval;
    private updateSuccessMetrics;
    private startRollbackMonitoring;
    private monitorActiveRollbacks;
    /**
     * Get rollback execution status
     */
    getRollbackStatus(executionId: string): RollbackExecution | null;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: {
            successRate: number;
            averageRollbackTimeMs: number;
            activeRollbacks: number;
            totalRollbacks: number;
        };
    };
}
//# sourceMappingURL=RollbackProcedures.d.ts.map